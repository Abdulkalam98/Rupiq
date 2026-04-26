from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="Rupiq API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Active routers ──
from routers.gmail_auth import router as gmail_auth_router
from routers.gmail_scan import router as gmail_scan_router
from routers.upload import router as upload_router
from routers.analysis import router as analysis_router

app.include_router(gmail_auth_router, prefix="/api/gmail", tags=["Gmail Auth"])
app.include_router(gmail_scan_router, prefix="/api/gmail", tags=["Gmail Scan"])
app.include_router(upload_router, prefix="/api/upload", tags=["PDF Upload"])
app.include_router(analysis_router, prefix="/api/analysis", tags=["AI Analysis"])


@app.get("/")
async def root():
    return {"app": "Rupiq", "version": "2.0.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
