from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from services.supabase_client import get_supabase
from urllib.parse import quote
import os
import logging

# Railway terminates TLS at the proxy → app sees HTTP internally.
# These tell oauthlib to accept HTTP redirect URIs and extra scopes.
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

logger = logging.getLogger(__name__)

router = APIRouter()

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def _get_user_id(request: Request) -> str:
    """Extract user_id from request header (set by frontend auth middleware)."""
    user_id = request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(401, "Missing x-user-id header")
    return user_id


def _build_flow() -> Flow:
    """Build Google OAuth flow configured for gmail.readonly only."""
    return Flow.from_client_config(
        {
            "web": {
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "redirect_uris": [os.getenv("GMAIL_REDIRECT_URI")],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=os.getenv("GMAIL_REDIRECT_URI"),
    )


# ── 1. Start Gmail OAuth ─────────────────────────────────────
@router.get("/connect")
async def gmail_connect(user_id: str = Depends(_get_user_id)):
    """Return a Google OAuth URL. Frontend redirects the user to it."""
    flow = _build_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",          # always show consent → guarantees refresh_token
        state=user_id,             # round-trip the user id through OAuth state
    )
    return {"auth_url": auth_url}


# ── 2. OAuth Callback ────────────────────────────────────────
@router.get("/callback")
async def gmail_callback(request: Request, code: str, state: str, error: str = None):
    """Google redirects here after consent. Exchange code for tokens."""

    frontend = os.getenv("FRONTEND_URL", "http://localhost:3000")

    if error:
        # User denied access or something went wrong
        return RedirectResponse(f"{frontend}/dashboard?gmail=denied")

    user_id = state

    # Exchange auth code for tokens
    try:
        flow = _build_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials
    except Exception as e:
        logger.error(f"Gmail token exchange failed: {e}")
        redirect_uri = os.getenv("GMAIL_REDIRECT_URI")
        logger.error(f"GMAIL_REDIRECT_URI={redirect_uri}, callback URL={request.url}")
        return RedirectResponse(f"{frontend}/dashboard?gmail=error&reason=token_exchange")

    # Hard-check: scope MUST be readonly
    granted = set(credentials.scopes or [])
    if "https://www.googleapis.com/auth/gmail.readonly" not in granted:
        raise HTTPException(400, "Invalid scope — only gmail.readonly is accepted")

    encryption_secret = os.getenv("TOKEN_ENCRYPTION_SECRET")

    try:
        # Encrypt both tokens before persisting
        sb = get_supabase()
        enc_access = (
            sb.rpc(
                "encrypt_token",
                {"token": credentials.token, "secret": encryption_secret},
            )
            .execute()
            .data
        )
        enc_refresh = (
            sb.rpc(
                "encrypt_token",
                {"token": credentials.refresh_token, "secret": encryption_secret},
            )
            .execute()
            .data
        )

        # Fetch the Gmail address from the id_token (or userinfo)
        gmail_email = None
        if credentials.id_token and isinstance(credentials.id_token, dict):
            gmail_email = credentials.id_token.get("email")

        # Upsert — allows user to reconnect Gmail
        sb.table("gmail_tokens").upsert(
            {
                "user_id": user_id,
                "access_token": enc_access,
                "refresh_token": enc_refresh,
                "token_expiry": (
                    credentials.expiry.isoformat() if credentials.expiry else None
                ),
                "gmail_email": gmail_email,
                "is_active": True,
            },
            on_conflict="user_id",
        ).execute()
    except Exception as e:
        logger.error(f"Gmail token storage failed: {e}")
        return RedirectResponse(f"{frontend}/dashboard?gmail=error&reason=storage&detail={quote(str(e))}")

    return RedirectResponse(
        f"{frontend}/dashboard?gmail=connected&scan=starting"
    )


# ── 3. Check Gmail connection status ─────────────────────────
@router.get("/status")
async def gmail_status(user_id: str = Depends(_get_user_id)):
    """Check if user has an active Gmail connection."""
    result = (
        get_supabase().table("gmail_tokens")
        .select("gmail_email, is_active, connected_at, last_synced_at")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )

    if not result.data:
        return {"connected": False}

    row = result.data[0]
    return {
        "connected": True,
        "gmail_email": row["gmail_email"],
        "connected_at": row["connected_at"],
        "last_synced_at": row["last_synced_at"],
    }


# ── 4. Disconnect Gmail ──────────────────────────────────────
@router.delete("/disconnect")
async def gmail_disconnect(user_id: str = Depends(_get_user_id)):
    """Revoke Gmail access. Keeps existing parsed data intact."""
    get_supabase().table("gmail_tokens").update({"is_active": False}).eq(
        "user_id", user_id
    ).execute()
    return {"message": "Gmail disconnected. Your existing financial data is not deleted."}


# ── 5. Save PDF password for statement decryption ─────────────
@router.post("/pdf-password")
async def set_pdf_password(request: Request, user_id: str = Depends(_get_user_id)):
    """Save an encrypted PDF password for auto-scanning password-protected statements."""
    body = await request.json()
    password = body.get("password", "")
    if not password:
        raise HTTPException(400, "Password is required")

    sb = get_supabase()
    encryption_secret = os.getenv("TOKEN_ENCRYPTION_SECRET")

    enc_password = (
        sb.rpc("encrypt_token", {"token": password, "secret": encryption_secret})
        .execute()
        .data
    )

    sb.table("gmail_tokens").update(
        {"pdf_password": enc_password}
    ).eq("user_id", user_id).eq("is_active", True).execute()

    return {"message": "PDF password saved securely."}
