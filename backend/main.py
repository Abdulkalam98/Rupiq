from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import traceback

load_dotenv()

app = FastAPI(title="Rupiq API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"app": "Rupiq", "version": "2.0.0", "status": "running"}


# ── Active routers (wrapped so health check works even if imports fail) ──
_import_errors = []

try:
    from routers.gmail_auth import router as gmail_auth_router
    app.include_router(gmail_auth_router, prefix="/api/gmail", tags=["Gmail Auth"])
except Exception as e:
    _import_errors.append(f"gmail_auth: {traceback.format_exc()}")

try:
    from routers.gmail_scan import router as gmail_scan_router
    app.include_router(gmail_scan_router, prefix="/api/gmail", tags=["Gmail Scan"])
except Exception as e:
    _import_errors.append(f"gmail_scan: {traceback.format_exc()}")

try:
    from routers.upload import router as upload_router
    app.include_router(upload_router, prefix="/api/upload", tags=["PDF Upload"])
except Exception as e:
    _import_errors.append(f"upload: {traceback.format_exc()}")

try:
    from routers.analysis import router as analysis_router
    app.include_router(analysis_router, prefix="/api/analysis", tags=["AI Analysis"])
except Exception as e:
    _import_errors.append(f"analysis: {traceback.format_exc()}")


@app.get("/debug/imports")
async def debug_imports():
    return {"errors": _import_errors if _import_errors else "all imports OK"}
