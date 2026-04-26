# Rupiq — AI Personal Finance Assistant

Dual-mode financial data ingestion:
- **Mode 1 (Auto):** Gmail read-only scan → detects bank/CC/demat/CIBIL emails → extracts PDFs → AI analysis
- **Mode 2 (Manual):** PDF upload → parse → AI analysis

## Project Structure

```
Rupiq/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── gmail_auth.py        # Gmail OAuth connect/disconnect
│   │   ├── gmail_scan.py        # Trigger + poll Gmail scans
│   │   ├── upload.py            # Manual PDF upload
│   │   └── analysis.py          # Gemini AI analysis
│   ├── services/
│   │   ├── gmail_scanner.py     # Email search + PDF extraction
│   │   ├── pdf_parser.py        # pdfplumber parsing
│   │   └── ai_analyser.py       # Gemini analysis engine
│   └── migrations/
│       ├── 001_base_schema.sql  # profiles, pdf_uploads, transactions, analysis_results
│       ├── 002_gmail_tables.sql # gmail_tokens, email_statements, scan_jobs
│       └── 003_encryption_helpers.sql # encrypt_token / decrypt_token
├── frontend/                    # Next.js app
│   ├── app/
│   ├── components/
│   └── lib/
└── supabase/
    └── functions/
        └── monthly-scan/        # Edge Function for cron
```

## Quick Start

### 1. Supabase Setup
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run migrations in order in the SQL Editor:
   - `backend/migrations/001_base_schema.sql`
   - `backend/migrations/002_gmail_tables.sql`
   - `backend/migrations/003_encryption_helpers.sql`
3. Copy your project URL and keys

### 2. Backend
```bash
cd backend
cp .env.example .env  # Fill in your keys
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Tech Stack
- **Backend:** FastAPI + Python
- **Database:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI:** Gemini 1.5 Flash (Google)
- **PDF Parsing:** pdfplumber
- **Gmail:** Google Gmail API (read-only)
- **Email:** Resend
- **Frontend:** Next.js + Tailwind CSS
- **Deploy:** Vercel (frontend) + Railway (backend)
