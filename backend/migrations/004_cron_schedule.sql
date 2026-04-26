-- ============================================================
-- RUPIQ — MONTHLY CRON SCHEDULE
-- Run AFTER deploying the monthly-scan Edge Function
-- Requires pg_cron and pg_net extensions (enable in Supabase Dashboard)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule: 1st of every month at 3:30 AM UTC (9:00 AM IST)
SELECT cron.schedule(
  'rupiq-monthly-gmail-scan',
  '30 3 1 * *',
  $$
  SELECT
    net.http_post(
      url := 'https://rqjmzinnrvqelnaplroi.supabase.co/functions/v1/monthly-scan',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Verify the cron job exists
-- SELECT * FROM cron.job WHERE jobname = 'rupiq-monthly-gmail-scan';

-- To remove the cron job if needed:
-- SELECT cron.unschedule('rupiq-monthly-gmail-scan');
