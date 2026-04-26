-- ============================================================
-- RUPIQ — GMAIL AUTO-PULL TABLES (v2 additions)
-- Run AFTER 001_base_schema.sql
-- ============================================================

-- ── GMAIL OAUTH TOKENS (encrypted, never exposed to frontend) ──
CREATE TABLE public.gmail_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  gmail_email TEXT,
  scope TEXT DEFAULT 'https://www.googleapis.com/auth/gmail.readonly',
  is_active BOOLEAN DEFAULT TRUE,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  CONSTRAINT scope_readonly CHECK (scope = 'https://www.googleapis.com/auth/gmail.readonly')
);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own gmail tokens" ON public.gmail_tokens FOR ALL USING (auth.uid() = user_id);

-- ── EMAIL STATEMENTS (tracks every email found + processing state) ──
CREATE TABLE public.email_statements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  sender_email TEXT,
  subject TEXT,
  received_date TIMESTAMPTZ,
  statement_type TEXT CHECK (statement_type IN ('bank','credit_card','demat','cibil','unknown')),
  institution_name TEXT,
  attachment_filename TEXT,
  processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending','processing','parsed','analysed','failed','skipped')),
  upload_id UUID REFERENCES public.pdf_uploads(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_message_id)
);

ALTER TABLE public.email_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own email statements" ON public.email_statements FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_email_statements_message_id ON public.email_statements(user_id, gmail_message_id);
CREATE INDEX idx_email_statements_status ON public.email_statements(processing_status);

-- ── SCAN JOBS (tracks monthly cron runs) ──
CREATE TABLE public.scan_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  triggered_by TEXT CHECK (triggered_by IN ('cron','manual','onboarding')),
  status TEXT DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  emails_found INTEGER DEFAULT 0,
  pdfs_extracted INTEGER DEFAULT 0,
  statements_analysed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_details JSONB
);

ALTER TABLE public.scan_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own scan jobs" ON public.scan_jobs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_scan_jobs_user ON public.scan_jobs(user_id, started_at DESC);
