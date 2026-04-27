# Rupiq — Project Context for Future Enhancements

## Overview
Rupiq is a dual-mode AI personal finance assistant for India. It auto-pulls financial statements from Gmail (read-only) and supports manual PDF upload. Both feed into a Gemini AI analysis pipeline that provides a unified financial health score, spending breakdown, and actionable insights.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Next.js 14  │────▶│  FastAPI Backend  │────▶│   Supabase   │
│  (Vercel)    │     │   (Railway)       │     │  (Postgres)  │
└─────────────┘     └──────────────────┘     └──────────────┘
                           │                        │
                    ┌──────┴──────┐          ┌──────┴──────┐
                    │  Gmail API  │          │ Edge Funcs  │
                    │  Gemini AI  │          │  (Deno)     │
                    └─────────────┘          └─────────────┘
```

## Tech Stack

| Layer      | Technology                              | Hosting      |
|------------|----------------------------------------|--------------|
| Frontend   | Next.js 14 (App Router), Tailwind CSS  | Vercel       |
| Backend    | FastAPI (Python 3.11+)                 | Railway      |
| Database   | PostgreSQL via Supabase                | Supabase     |
| Auth       | Supabase Auth (Google OAuth + email)   | Supabase     |
| AI Engine  | Google Gemini 1.5 Flash                | API          |
| Email      | Gmail API (gmail.readonly scope)       | Google Cloud |
| PDF Parse  | pdfplumber (in-memory)                 | Backend      |
| Cron       | Supabase Edge Functions (Deno) + pg_cron | Supabase   |
| Emails     | Resend                                 | API          |

## Project Structure

```
Rupiq/
├── backend/
│   ├── main.py                          # FastAPI entry, CORS, 4 routers
│   ├── requirements.txt                 # Python dependencies
│   ├── Procfile                         # Railway start command
│   ├── routers/
│   │   ├── gmail_auth.py                # /api/gmail — OAuth connect/callback/status/disconnect
│   │   ├── gmail_scan.py                # /api/gmail — scan/status/history/scan-internal
│   │   ├── upload.py                    # /api/upload — PDF upload + parse
│   │   └── analysis.py                  # /api/analysis — trigger/latest/history
│   ├── services/
│   │   ├── supabase_client.py           # Lazy Supabase client singleton
│   │   ├── gmail_scanner.py             # Gmail search, PDF extraction, transaction parsing
│   │   ├── pdf_parser.py                # pdfplumber parser, categorization, bank detection
│   │   └── ai_analyser.py              # Gemini AI analysis engine
│   └── migrations/
│       ├── 001_base_schema.sql          # profiles, pdf_uploads, transactions, analysis_results
│       ├── 002_gmail_tables.sql         # gmail_tokens, email_statements, scan_jobs
│       ├── 003_encryption_helpers.sql   # encrypt_token(), decrypt_token() (pgcrypto AES)
│       └── 004_cron_schedule.sql        # pg_cron monthly scan schedule
├── frontend/
│   ├── app/
│   │   ├── page.tsx                     # Landing page
│   │   ├── login/page.tsx               # Login (Google OAuth + email/password)
│   │   ├── dashboard/page.tsx           # Main dashboard (score, breakdown, insights)
│   │   ├── upload/page.tsx              # Drag-and-drop PDF upload
│   │   ├── report/[id]/page.tsx         # Full analysis report
│   │   ├── settings/page.tsx            # Gmail disconnect
│   │   ├── privacy/page.tsx             # Privacy policy
│   │   ├── terms/page.tsx               # Terms of service
│   │   └── layout.tsx                   # Root layout
│   ├── components/
│   │   └── gmail/
│   │       ├── GmailConnectCard.tsx     # Gmail connect CTA card
│   │       └── ScanProgress.tsx         # Animated scan progress overlay
│   ├── lib/
│   │   ├── api.ts                       # Typed API wrapper (gmail, upload, analysis)
│   │   └── supabase.ts                  # Browser Supabase client
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── package.json
├── supabase/
│   ├── functions/
│   │   └── monthly-scan/
│   │       └── index.ts                 # Deno Edge Function for monthly cron
│   └── deploy.sh
├── deploy/
│   └── post-deploy.sh                   # Post-deploy configuration script
└── .gitignore
```

## Database Schema (Supabase PostgreSQL)

### Tables
1. **profiles** — auto-created on auth.users insert (trigger)
   - `id` (uuid, FK auth.users), `full_name`, `avatar_url`, timestamps
2. **pdf_uploads** — tracks both manual uploads and Gmail extractions
   - `user_id`, `filename`, `storage_path`, `bank_name`, `statement_type`, `source` (manual_upload|gmail_auto), `status`
3. **transactions** — parsed from PDFs
   - `upload_id`, `user_id`, `date`, `description`, `amount`, `type` (credit|debit), `category`, `is_emi`, `is_interest`
4. **analysis_results** — Gemini AI output
   - `user_id`, `upload_ids[]`, `financial_score`, `top_action`, `summary`, `insights`, `cross_statement_insights`, `spending_breakdown`, `monthly_trend`
5. **gmail_tokens** — encrypted OAuth tokens (pgcrypto AES)
   - `user_id`, `access_token`, `refresh_token`, `gmail_email`, `is_active`, `scope`, `token_expiry`, `last_synced_at`
6. **email_statements** — Gmail-extracted statement metadata
   - `user_id`, `gmail_message_id` (dedup), `sender_email`, `subject`, `statement_type`, `institution_name`, `processing_status`, `upload_id`
7. **scan_jobs** — Gmail scan job tracking
   - `user_id`, `triggered_by` (manual|cron), `status`, `emails_found`, `pdfs_extracted`, timestamps

### RLS (Row Level Security)
All tables have RLS enabled. Users can only read/write their own data via `auth.uid() = user_id` policies.

### Encryption
- Gmail tokens encrypted at rest using pgcrypto AES-256
- `encrypt_token(token, secret)` and `decrypt_token(encrypted, secret)` SQL functions
- Secret stored in `TOKEN_ENCRYPTION_SECRET` env var

## Backend API Endpoints

### Gmail Auth (`/api/gmail`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/connect` | Get Google OAuth URL for Gmail consent |
| GET | `/callback` | OAuth callback — exchanges code, encrypts tokens |
| GET | `/status` | Check if Gmail is connected |
| DELETE | `/disconnect` | Soft-disconnect Gmail |

### Gmail Scan (`/api/gmail`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/scan` | Trigger background Gmail scan |
| GET | `/scan/status/{job_id}` | Poll scan progress |
| GET | `/scan/history` | Get all extracted statements |
| POST | `/scan-internal` | Cron-only endpoint (x-cron-secret auth) |

### Upload (`/api/upload`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/pdf` | Upload and parse a statement PDF |
| GET | `/history` | Get upload history |

### Analysis (`/api/analysis`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/analyse` | Trigger Gemini AI analysis |
| GET | `/latest` | Get most recent analysis |
| GET | `/{analysis_id}` | Get specific analysis |
| GET | `/` | Analysis history |

## Auth Flow
1. **Standard login**: Supabase Auth with Google OAuth or email/password
2. **Gmail connect**: Separate opt-in flow via `/api/gmail/connect` → Google OAuth with `gmail.readonly` scope → callback encrypts tokens → stored in `gmail_tokens`

## Gmail Scanner
- Searches for financial emails from 25+ Indian institutions (HDFC, SBI, ICICI, Axis, Zerodha, etc.)
- Supports 4 statement types: `bank`, `credit_card`, `demat`, `cibil`
- Recursive PDF attachment extraction
- Deduplication via `gmail_message_id` unique index
- In-memory PDF parsing (never written to disk)
- Background task execution via FastAPI BackgroundTasks

## PDF Parser
- Uses pdfplumber for text extraction
- 20+ transaction categories (groceries, utilities, rent, salary, investments, etc.)
- EMI and interest charge detection
- Bank name detection from PDF content
- Supports both file path and BytesIO (for Gmail attachments)

## AI Analysis (Gemini 1.5 Flash)
- Cross-statement analysis across all 4 types
- Financial health score (0-100)
- Top action recommendation
- Spending breakdown by category
- Monthly trend analysis
- Indian-context insights (uses ₹, lakh, crore)
- Structured JSON output format

## Environment Variables

### Backend (.env)
```
SUPABASE_URL=https://rqjmzinnrvqelnaplroi.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
GOOGLE_CLIENT_ID=655947996631-pn2npktsdgjf88ef039moccg5e4g5r18.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<google_client_secret>
GMAIL_REDIRECT_URI=<railway_url>/api/gmail/callback
GEMINI_API_KEY=<gemini_api_key>
FRONTEND_URL=https://rupiq.vercel.app
RESEND_API_KEY=<resend_api_key>
TOKEN_ENCRYPTION_SECRET=<32_char_random_string>
CRON_SECRET=<random_string>
```

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://rqjmzinnrvqelnaplroi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_BACKEND_URL=<railway_url>
```

## Deployment

### Vercel (Frontend)
- URL: https://rupiq.vercel.app
- Auto-deploys from GitHub `main` branch
- Root directory: `frontend`
- Framework: Next.js

### Railway (Backend)
- Auto-deploys from GitHub `main` branch
- Root directory: `backend`
- Procfile: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check: GET `/health`

### Supabase
- Project ref: `rqjmzinnrvqelnaplroi`
- Edge Function: `monthly-scan` (Deno, called by pg_cron)
- Storage bucket: `statements` (private)

## Key Design Decisions
1. **Lazy initialization**: Supabase client and Gemini model use lazy init (`get_supabase()`, `_get_gemini()`) to prevent startup crashes when env vars load after module import
2. **In-memory PDF processing**: PDFs are never written to disk, parsed from BytesIO
3. **Encrypted tokens**: Gmail OAuth tokens encrypted with pgcrypto AES before storage
4. **Background scanning**: Gmail scans run as background tasks, frontend polls for status
5. **Deduplication**: Gmail messages tracked by `gmail_message_id` to prevent re-processing
6. **Separate OAuth flows**: Login (Supabase Auth) and Gmail connect are independent

## Common Enhancement Areas
- Add more Indian bank/institution patterns in `gmail_scanner.py` STATEMENT_PATTERNS
- Add new transaction categories in `pdf_parser.py`
- Enhance Gemini prompt in `ai_analyser.py` ANALYSIS_SYSTEM_PROMPT
- Add new frontend pages/components under `frontend/app/`
- Add new API endpoints by creating routers in `backend/routers/` and registering in `main.py`

## Google Cloud Console Setup
- Project: (your Google Cloud project)
- OAuth Client Type: **Web Application** (NOT Desktop)
- Authorized redirect URIs: `<RAILWAY_URL>/api/gmail/callback`
- Authorized JS origins: `https://rupiq.vercel.app`
- Scopes: `gmail.readonly`
- OAuth consent screen: External, with privacy/terms URLs pointing to Vercel

## Supabase Auth Configuration
- Site URL: `https://rupiq.vercel.app`
- Redirect URLs: `https://rupiq.vercel.app/dashboard`
- Google provider: enabled with same OAuth client credentials
