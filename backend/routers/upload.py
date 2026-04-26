"""Manual PDF upload — drag-and-drop or file browser upload."""

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from supabase import create_client

from services.pdf_parser import parse_pdf_file, parse_pdf_bytes, detect_statement_type_from_pdf

router = APIRouter()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))


def _get_user_id(request: Request) -> str:
    user_id = request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(401, "Missing x-user-id header")
    return user_id


@router.post("/pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    password: str = Form(default=None),
    user_id: str = Depends(_get_user_id),
):
    """Upload a bank/CC/demat/CIBIL statement PDF for parsing."""

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")

    # Read file into memory
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(400, "File too large — max 10MB")

    # Upload to Supabase Storage
    file_id = str(uuid.uuid4())
    storage_path = f"{user_id}/{file_id}_{file.filename}"

    supabase.storage.from_("statements").upload(
        storage_path, contents, {"content-type": "application/pdf"}
    )

    # Create upload record
    upload = (
        supabase.table("pdf_uploads")
        .insert(
            {
                "user_id": user_id,
                "filename": file.filename,
                "storage_path": storage_path,
                "source": "manual_upload",
                "status": "parsing",
            }
        )
        .execute()
    )
    upload_id = upload.data[0]["id"]

    try:
        # Parse PDF from bytes
        import io

        pdf_bytes = io.BytesIO(contents)
        parse_result = parse_pdf_bytes(pdf_bytes)

        # Detect statement type from content
        stmt_type = detect_statement_type_from_pdf(parse_result)

        # Update upload record with parsed info
        supabase.table("pdf_uploads").update(
            {
                "bank_name": parse_result["bank_name"],
                "statement_type": stmt_type,
                "status": "parsed",
            }
        ).eq("id", upload_id).execute()

        # Save transactions
        txs = [
            {"upload_id": upload_id, "user_id": user_id, **tx}
            for tx in parse_result["transactions"]
        ]
        if txs:
            supabase.table("transactions").insert(txs).execute()

        # Delete PDF from storage immediately after parsing
        supabase.storage.from_("statements").remove([storage_path])

        return {
            "upload_id": upload_id,
            "bank_name": parse_result["bank_name"],
            "statement_type": stmt_type,
            "transaction_count": parse_result["transaction_count"],
            "status": "parsed",
        }

    except Exception as e:
        supabase.table("pdf_uploads").update(
            {"status": "failed", "error_message": str(e)}
        ).eq("id", upload_id).execute()

        # Clean up storage on failure too
        supabase.storage.from_("statements").remove([storage_path])

        raise HTTPException(500, f"Failed to parse PDF: {str(e)}")


@router.get("/history")
async def upload_history(user_id: str = Depends(_get_user_id)):
    """Get all uploads for a user."""
    uploads = (
        supabase.table("pdf_uploads")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"uploads": uploads.data}
