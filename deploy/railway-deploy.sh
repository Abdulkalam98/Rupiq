#!/bin/bash
# ============================================================
# RUPIQ — Backend Deploy to Railway
# ============================================================

set -e

echo "🚀 Deploying Rupiq backend to Railway..."
echo ""

# Check Railway CLI
if ! command -v railway &> /dev/null; then
  echo "Installing Railway CLI..."
  npm install -g @railway/cli
fi

# Login
railway login

# Init project (first time only)
# railway init

# Link to existing project
# railway link

# Set environment variables
# Copy values from backend/.env — never hardcode secrets in this script
echo "Setting environment variables..."
echo ""
echo "⚠️  Set these via Railway Dashboard or CLI:"
echo "   railway variables set SUPABASE_URL=..."
echo "   railway variables set SUPABASE_ANON_KEY=..."
echo "   railway variables set SUPABASE_SERVICE_KEY=..."
echo "   railway variables set GOOGLE_CLIENT_ID=..."
echo "   railway variables set GOOGLE_CLIENT_SECRET=..."
echo "   railway variables set GMAIL_REDIRECT_URI=https://YOUR_RAILWAY_DOMAIN/api/gmail/callback"
echo "   railway variables set FRONTEND_URL=https://YOUR_VERCEL_DOMAIN"
echo "   railway variables set TOKEN_ENCRYPTION_SECRET=..."
echo "   railway variables set CRON_SECRET=..."
echo "   railway variables set GEMINI_API_KEY=..."
echo "   railway variables set RESEND_API_KEY=..."
echo ""
echo "   Replace YOUR_RAILWAY_DOMAIN and YOUR_VERCEL_DOMAIN after first deploy."
echo ""

# Deploy
railway up

echo ""
echo "✅ Backend deployed!"
echo "   Run 'railway logs' to check status"
echo "   Run 'railway domain' to get your production URL"
