-- ============================================================
-- RUPIQ — BASE SCHEMA (v1 tables)
-- Run this FIRST in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── PROFILES (extends Supabase auth.users) ──
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── PDF UPLOADS ──
CREATE TABLE public.pdf_uploads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT,
  bank_name TEXT,
  statement_type TEXT CHECK (statement_type IN ('bank','credit_card','demat','cibil','unknown')),
  source TEXT DEFAULT 'manual_upload' CHECK (source IN ('manual_upload','gmail_auto')),
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded','parsing','parsed','analysing','analysed','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pdf_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own uploads" ON public.pdf_uploads FOR ALL USING (auth.uid() = user_id);

-- ── TRANSACTIONS (parsed from PDFs) ──
CREATE TABLE public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  upload_id UUID REFERENCES public.pdf_uploads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT CHECK (type IN ('credit','debit')),
  category TEXT,
  is_emi BOOLEAN DEFAULT FALSE,
  is_interest BOOLEAN DEFAULT FALSE,
  statement_type TEXT CHECK (statement_type IN ('bank','credit_card','demat','cibil','unknown')),
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_transactions_upload ON public.transactions(upload_id);
CREATE INDEX idx_transactions_user ON public.transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON public.transactions(user_id, category);

-- ── AI ANALYSIS RESULTS ──
CREATE TABLE public.analysis_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  upload_ids UUID[] NOT NULL,
  financial_score INTEGER CHECK (financial_score BETWEEN 0 AND 100),
  top_action TEXT,
  summary JSONB,
  insights JSONB,
  cross_statement_insights JSONB,
  spending_breakdown JSONB,
  monthly_trend JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own analysis" ON public.analysis_results FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_analysis_user ON public.analysis_results(user_id, created_at DESC);
