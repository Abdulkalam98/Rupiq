"""Gmail scanner — hunts for financial statement emails and extracts PDF attachments."""

import base64
import io
import os
import re
from datetime import datetime, timedelta

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from services.pdf_parser import parse_pdf_bytes
from services.supabase_client import get_supabase


# ── Statement detection config ────────────────────────────────

STATEMENT_PATTERNS = {
    "bank": {
        "senders": [
            "statements@hdfcbank.com",
            "noreply@sbi.co.in",
            "estatement@icicibank.com",
            "estatement@axisbank.com",
            "estatement@kotak.com",
            "estatement@yesbank.in",
            "accounts@indusind.com",
        ],
        "subject_keywords": [
            "account statement",
            "e-statement",
            "bank statement",
            "monthly statement",
        ],
        "institution_map": {
            "hdfc": "HDFC Bank",
            "sbi": "State Bank of India",
            "icici": "ICICI Bank",
            "axis": "Axis Bank",
            "kotak": "Kotak Bank",
            "yes": "Yes Bank",
        },
    },
    "credit_card": {
        "senders": [
            "creditcard@hdfcbank.com",
            "ccstatement@icicibank.com",
            "cards@axisbank.com",
            "creditcard@sbicard.com",
            "statements@amex.com",
            "noreply@indusind.com",
        ],
        "subject_keywords": [
            "credit card statement",
            "card statement",
            "payment due",
            "outstanding amount",
            "minimum payment",
        ],
        "institution_map": {
            "hdfc": "HDFC Credit Card",
            "icici": "ICICI Credit Card",
            "axis": "Axis Credit Card",
            "sbi": "SBI Card",
            "amex": "American Express",
        },
    },
    "demat": {
        "senders": [
            "noreply@zerodha.com",
            "support@groww.in",
            "noreply@upstox.com",
            "estatement@icicidirect.com",
            "statements@hdfcsec.com",
            "noreply@angelbroking.com",
            "statements@motilaloswal.com",
        ],
        "subject_keywords": [
            "holding statement",
            "portfolio statement",
            "demat statement",
            "contract note",
            "dp statement",
        ],
        "institution_map": {
            "zerodha": "Zerodha",
            "groww": "Groww",
            "upstox": "Upstox",
            "icicidirect": "ICICI Direct",
            "hdfcsec": "HDFC Securities",
            "angel": "Angel Broking",
        },
    },
    "cibil": {
        "senders": [
            "noreply@cibil.com",
            "alerts@cibiltransunion.com",
            "creditreport@bajajfinserv.com",
            "creditreport@paytm.com",
            "noreply@creditmantri.com",
            "reports@paisabazaar.com",
        ],
        "subject_keywords": [
            "credit score",
            "credit report",
            "cibil score",
            "cibil report",
            "credit information",
        ],
        "institution_map": {
            "cibil": "TransUnion CIBIL",
            "bajaj": "Bajaj Finserv",
            "paytm": "Paytm Credit",
            "creditmantri": "CreditMantri",
        },
    },
}


# ── Gmail query builder ───────────────────────────────────────

def build_gmail_query(days_back: int = 35) -> str:
    """Build Gmail search query covering all statement types from last N days."""
    since_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y/%m/%d")

    all_senders = []
    for pattern in STATEMENT_PATTERNS.values():
        all_senders.extend(pattern["senders"])

    sender_query = " OR ".join([f"from:{s}" for s in all_senders])

    subject_queries = [
        "subject:(account statement)",
        "subject:(credit card statement)",
        "subject:(demat statement)",
        "subject:(credit report)",
        "subject:(CIBIL)",
    ]
    subject_query = " OR ".join(subject_queries)

    return f"has:attachment filename:pdf ({sender_query} OR {subject_query}) after:{since_date}"


# ── Statement type + institution detection ────────────────────

def detect_statement_type(sender: str, subject: str) -> tuple:
    """Returns (statement_type, institution_name)."""
    sender_lower = sender.lower()
    subject_lower = subject.lower()

    for stmt_type, pattern in STATEMENT_PATTERNS.items():
        # Check sender match first
        if any(s in sender_lower for s in pattern["senders"]):
            institution = "Unknown"
            for key, name in pattern["institution_map"].items():
                if key in sender_lower:
                    institution = name
                    break
            return stmt_type, institution

        # Fallback: subject keyword match
        if any(kw in subject_lower for kw in pattern["subject_keywords"]):
            return stmt_type, "Unknown"

    return "unknown", "Unknown"


# ── Token management ──────────────────────────────────────────

def get_credentials(user_id: str) -> Credentials:
    """Fetch and decrypt Gmail tokens for a user."""
    sb = get_supabase()
    token_row = (
        sb.table("gmail_tokens")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .single()
        .execute()
    )

    if not token_row.data:
        raise ValueError(f"No active Gmail tokens for user {user_id}")

    secret = os.getenv("TOKEN_ENCRYPTION_SECRET")

    access_token = (
        sb.rpc("decrypt_token", {"encrypted": token_row.data["access_token"], "secret": secret})
        .execute()
        .data
    )
    refresh_token = (
        sb.rpc("decrypt_token", {"encrypted": token_row.data["refresh_token"], "secret": secret})
        .execute()
        .data
    )

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    )

    # Refresh if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        new_encrypted = (
            sb.rpc("encrypt_token", {"token": creds.token, "secret": secret})
            .execute()
            .data
        )
        sb.table("gmail_tokens").update(
            {"access_token": new_encrypted, "token_expiry": creds.expiry.isoformat()}
        ).eq("user_id", user_id).execute()

    return creds


# ── PDF attachment helpers ────────────────────────────────────

def _find_pdf_parts(payload: dict) -> list:
    """Recursively find all PDF attachment parts in a Gmail message payload."""
    pdf_parts = []

    # Check current part
    filename = payload.get("filename", "")
    if filename.lower().endswith(".pdf") and payload.get("body", {}).get("attachmentId"):
        pdf_parts.append(payload)

    # Recurse into nested parts
    for part in payload.get("parts", []):
        pdf_parts.extend(_find_pdf_parts(part))

    return pdf_parts


# ── Main scanner ──────────────────────────────────────────────

async def scan_gmail_for_statements(user_id: str, scan_job_id: str, days_back: int = 35) -> dict:
    """Find all financial statement emails and extract PDFs."""
    sb = get_supabase()

    results = {
        "found": 0,
        "extracted": 0,
        "skipped_duplicates": 0,
        "failed": 0,
        "statements": [],
    }

    try:
        creds = get_credentials(user_id)
        service = build("gmail", "v1", credentials=creds)

        query = build_gmail_query(days_back)
        messages_result = (
            service.users().messages().list(userId="me", q=query, maxResults=50).execute()
        )

        messages = messages_result.get("messages", [])
        results["found"] = len(messages)

        for msg in messages:
            try:
                # Skip duplicates
                existing = (
                    sb.table("email_statements")
                    .select("id")
                    .eq("user_id", user_id)
                    .eq("gmail_message_id", msg["id"])
                    .execute()
                )
                if existing.data:
                    results["skipped_duplicates"] += 1
                    continue

                # Fetch full message
                full_msg = (
                    service.users()
                    .messages()
                    .get(userId="me", id=msg["id"], format="full")
                    .execute()
                )

                headers = {h["name"]: h["value"] for h in full_msg["payload"]["headers"]}
                sender = headers.get("From", "")
                subject = headers.get("Subject", "")

                stmt_type, institution = detect_statement_type(sender, subject)

                # Find PDF attachments (recursive search through parts)
                pdf_parts = _find_pdf_parts(full_msg["payload"])

                if not pdf_parts:
                    sb.table("email_statements").insert(
                        {
                            "user_id": user_id,
                            "gmail_message_id": msg["id"],
                            "sender_email": sender,
                            "subject": subject,
                            "statement_type": stmt_type,
                            "institution_name": institution,
                            "processing_status": "skipped",
                            "error_message": "No PDF attachment found",
                        }
                    ).execute()
                    continue

                for part in pdf_parts:
                    attachment_id = part["body"]["attachmentId"]

                    # Download attachment
                    attachment = (
                        service.users()
                        .messages()
                        .attachments()
                        .get(userId="me", messageId=msg["id"], id=attachment_id)
                        .execute()
                    )

                    # Decode in memory — never written to disk
                    pdf_data = base64.urlsafe_b64decode(attachment["data"])
                    pdf_bytes = io.BytesIO(pdf_data)

                    # Record email statement
                    stmt_record = (
                        sb.table("email_statements")
                        .insert(
                            {
                                "user_id": user_id,
                                "gmail_message_id": msg["id"],
                                "sender_email": sender,
                                "subject": subject,
                                "statement_type": stmt_type,
                                "institution_name": institution,
                                "attachment_filename": part.get("filename"),
                                "processing_status": "processing",
                            }
                        )
                        .execute()
                    )
                    stmt_id = stmt_record.data[0]["id"]

                    # Parse PDF bytes directly
                    parse_result = parse_pdf_bytes(pdf_bytes, statement_type=stmt_type)

                    # Save to pdf_uploads (same table as manual uploads)
                    upload = (
                        sb.table("pdf_uploads")
                        .insert(
                            {
                                "user_id": user_id,
                                "filename": part.get("filename", "email_attachment.pdf"),
                                "storage_path": f"email_extracted/{user_id}/{msg['id']}",
                                "bank_name": institution,
                                "statement_type": stmt_type,
                                "source": "gmail_auto",
                                "status": "parsed",
                            }
                        )
                        .execute()
                    )
                    upload_id = upload.data[0]["id"]

                    # Save transactions
                    txs = [
                        {"upload_id": upload_id, "user_id": user_id, **tx}
                        for tx in parse_result["transactions"]
                    ]
                    if txs:
                        sb.table("transactions").insert(txs).execute()

                    # Update email_statements with result
                    sb.table("email_statements").update(
                        {"processing_status": "parsed", "upload_id": upload_id}
                    ).eq("id", stmt_id).execute()

                    results["extracted"] += 1
                    results["statements"].append(
                        {
                            "type": stmt_type,
                            "institution": institution,
                            "upload_id": upload_id,
                        }
                    )

                    # PDF bytes garbage-collected here
                    del pdf_data, pdf_bytes

            except Exception:
                results["failed"] += 1
                continue

        # Update last synced timestamp
        sb.table("gmail_tokens").update(
            {"last_synced_at": datetime.now().isoformat()}
        ).eq("user_id", user_id).execute()

        # Update scan job as completed
        sb.table("scan_jobs").update(
            {
                "status": "completed",
                "emails_found": results["found"],
                "pdfs_extracted": results["extracted"],
                "completed_at": datetime.now().isoformat(),
            }
        ).eq("id", scan_job_id).execute()

    except Exception as e:
        sb.table("scan_jobs").update(
            {"status": "failed", "error_details": {"error": str(e)}}
        ).eq("id", scan_job_id).execute()

    return results
