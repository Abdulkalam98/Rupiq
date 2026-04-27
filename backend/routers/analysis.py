"""Analysis API — trigger AI analysis and fetch results."""

import os
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from services.ai_analyser import analyse_statements
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_user_id(request: Request) -> str:
    user_id = request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(401, "Missing x-user-id header")
    return user_id


class AnalyseRequest(BaseModel):
    upload_ids: list[str]


# ── 1. Trigger analysis ──────────────────────────────────────
@router.post("/analyse")
async def trigger_analysis(
    body: AnalyseRequest,
    user_id: str = Depends(_get_user_id),
):
    """Run Gemini AI analysis on one or more parsed statement uploads."""

    if not body.upload_ids:
        raise HTTPException(400, "At least one upload_id is required")

    try:
        # Verify uploads belong to this user
        for uid in body.upload_ids:
            check = (
                get_supabase().table("pdf_uploads")
                .select("id")
                .eq("id", uid)
                .eq("user_id", user_id)
                .execute()
            )
            if not check.data:
                raise HTTPException(404, f"Upload {uid} not found or not yours")

        logger.info(f"Starting analysis for user={user_id}, uploads={body.upload_ids}")
        result = await analyse_statements(user_id, body.upload_ids)

        if "error" in result:
            raise HTTPException(500, result["error"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(500, f"Analysis failed: {str(e)}")


# ── 2. Get latest analysis ────────────────────────────────────
@router.get("/latest")
async def latest_analysis(user_id: str = Depends(_get_user_id)):
    """Get the most recent analysis for this user."""
    result = (
        get_supabase().table("analysis_results")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        return {"has_analysis": False}

    return {"has_analysis": True, **result.data[0]}


# ── 3. Get specific analysis ─────────────────────────────────
@router.get("/{analysis_id}")
async def get_analysis(analysis_id: str, user_id: str = Depends(_get_user_id)):
    """Fetch a specific analysis by ID."""
    result = (
        get_supabase().table("analysis_results")
        .select("*")
        .eq("id", analysis_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(404, "Analysis not found")

    return result.data[0]


# ── 4. Analysis history ──────────────────────────────────────
@router.get("/")
async def analysis_history(user_id: str = Depends(_get_user_id)):
    """Get all past analyses for this user."""
    results = (
        get_supabase().table("analysis_results")
        .select("id, financial_score, top_action, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return {"analyses": results.data}
