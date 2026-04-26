#!/bin/bash
# ============================================================
# RUPIQ — Post-Deploy: Update redirect URIs + Edge Function
# Run AFTER both Railway and Vercel deploys give you prod URLs
# ============================================================

set -e

RAILWAY_URL=""   # ← paste your Railway URL here
VERCEL_URL=""    # ← paste your Vercel URL here

if [ -z "$RAILWAY_URL" ] || [ -z "$VERCEL_URL" ]; then
  echo "❌ Set RAILWAY_URL and VERCEL_URL at the top of this script first"
  exit 1
fi

echo "🔧 Post-deploy configuration..."
echo "   Backend:  $RAILWAY_URL"
echo "   Frontend: $VERCEL_URL"
echo ""

# 1. Update Railway env vars with real URLs
echo "① Updating Railway redirect URIs..."
railway variables set \
  GMAIL_REDIRECT_URI="${RAILWAY_URL}/api/gmail/callback" \
  FRONTEND_URL="${VERCEL_URL}"

# 2. Update Supabase Edge Function secrets
echo "② Updating Supabase Edge Function secrets..."
echo "   Set these via: supabase secrets set BACKEND_URL=... RESEND_API_KEY=... CRON_SECRET=..."
cd supabase
supabase secrets set \
  BACKEND_URL="${RAILWAY_URL}"
# Also run manually: supabase secrets set RESEND_API_KEY=... CRON_SECRET=...

# 3. Deploy Edge Function
echo "③ Deploying monthly-scan Edge Function..."
supabase functions deploy monthly-scan
cd ..

echo ""
echo "✅ Post-deploy configuration complete!"
echo ""
echo "📋 MANUAL STEPS REMAINING:"
echo ""
echo "  1. Google Cloud Console → Credentials → OAuth Client:"
echo "     - Add authorized redirect URI: ${RAILWAY_URL}/api/gmail/callback"
echo "     - Add authorized JS origin: ${VERCEL_URL}"
echo ""
echo "  2. Google Cloud Console → OAuth consent screen:"
echo "     - Privacy policy URL: ${VERCEL_URL}/privacy"
echo "     - Terms of service URL: ${VERCEL_URL}/terms"
echo ""
echo "  3. Supabase Dashboard → Authentication → URL Configuration:"
echo "     - Site URL: ${VERCEL_URL}"
echo "     - Redirect URLs: ${VERCEL_URL}/dashboard"
echo ""
echo "  4. Supabase SQL Editor → Run: backend/migrations/004_cron_schedule.sql"
echo "     (update the Edge Function URL in that file first)"
echo ""
echo "  5. Supabase Dashboard → Storage → Create bucket: 'statements' (private)"
echo ""
echo "  6. Test full flow end-to-end on production"
