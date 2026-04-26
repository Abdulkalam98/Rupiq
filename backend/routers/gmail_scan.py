"""Gmail scan API — trigger scans, poll status, view history."""

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Depends
from services.gmail_scanner import scan_gmail_for_statements
from services.supabase_client import get_supabase
import os

router = APIRouter()


def _get_user_id(request: Request) -> str:
    user_id = request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(401, "Missing x-user-id header")
    return user_id


# ── 1. Manual scan trigger (user clicks "Sync Now") ──────────
@router.post("/scan")
async def trigger_scan(
    background_tasks: BackgroundTasks,
    user_id: str = Depends(_get_user_id),
):
    """Trigger a Gmail scan. Runs in background — poll /scan/status for progress."""

    # Check Gmail is connected
    sb = get_supabase()
    token = (
        sb.table("gmail_tokens")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    if not token.data:
        raise HTTPException(400, "Gmail not connected. Please connect Gmail first.")

    # Create scan job record
    job = (
        sb.table("scan_jobs")
        .insert({"user_id": user_id, "triggered_by": "manual", "status": "running"})
        .execute()
    )
    job_id = job.data[0]["id"]

    # Run in background
    background_tasks.add_task(scan_gmail_for_statements, user_id, job_id)

    return {
        "scan_job_id": job_id,
        "status": "started",
        "message": "Scanning your Gmail for statements...",
    }


# ── 2. Poll scan status (frontend polls every 3s) ────────────
@router.get("/scan/status/{job_id}")
async def scan_status(job_id: str, user_id: str = Depends(_get_user_id)):
    """Get the current status of a scan job."""
    job = (
        get_supabase().table("scan_jobs")
        .select("*")
        .eq("id", job_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not job.data:
        raise HTTPException(404, "Scan job not found")
    return job.data[0]


# ── 3. Email statement history ────────────────────────────────
@router.get("/scan/history")
async def scan_history(user_id: str = Depends(_get_user_id)):
    """Get all email statements found across all scans."""
    stmts = (
        get_supabase().table("email_statements")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"statements": stmts.data}


# ── 4. Internal cron endpoint (called by Supabase Edge Function) ─
@router.post("/scan-internal")
async def internal_cron_scan(request: Request, background_tasks: BackgroundTasks):
    """Called by monthly cron Edge Function — not exposed to public."""
    cron_secret = request.headers.get("x-cron-secret")
    if cron_secret != os.getenv("CRON_SECRET"):
        raise HTTPException(401, "Unauthorized")

    body = await request.json()
    user_id = body["user_id"]
    job_id = body["job_id"]

    background_tasks.add_task(scan_gmail_for_statements, user_id, job_id, days_back=35)
    return {"status": "scan_started"}
