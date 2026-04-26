# Deploy the monthly-scan Edge Function to Supabase
# Run from the project root

# 1. Install Supabase CLI (if not installed)
# npm install -g supabase

# 2. Login
# supabase login

# 3. Link to your project
supabase link --project-ref rqjmzinnrvqelnaplroi

# 4. Deploy the Edge Function
supabase functions deploy monthly-scan

# 5. Set secrets for the Edge Function (use your actual values from backend/.env)
# supabase secrets set BACKEND_URL=http://localhost:8000
# supabase secrets set RESEND_API_KEY=your_resend_key
# supabase secrets set CRON_SECRET=your_cron_secret

# For production, update BACKEND_URL:
# supabase secrets set BACKEND_URL=https://your-railway-domain.railway.app
