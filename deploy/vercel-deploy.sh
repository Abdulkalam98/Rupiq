#!/bin/bash
# ============================================================
# RUPIQ — Frontend Deploy to Vercel
# ============================================================

set -e

echo "🚀 Deploying Rupiq frontend to Vercel..."
echo ""

# Check Vercel CLI
if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm install -g vercel
fi

cd frontend

# Set environment variables on Vercel
echo "Setting environment variables..."
echo ""
echo "⚠️  Set these in Vercel Dashboard → Project → Settings → Environment Variables:"
echo ""
echo "  NEXT_PUBLIC_SUPABASE_URL     = https://rqjmzinnrvqelnaplroi.supabase.co"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_dAvIRdqcliRyjmq1dIPl3A_KaXkyPRY"
echo "  NEXT_PUBLIC_BACKEND_URL       = https://YOUR_RAILWAY_DOMAIN"
echo ""

# Deploy
vercel --prod

echo ""
echo "✅ Frontend deployed!"
