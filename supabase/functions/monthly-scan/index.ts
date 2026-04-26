import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const BACKEND_URL = Deno.env.get("BACKEND_URL")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

serve(async (req) => {
  // Auth: only allow calls from pg_cron or our backend
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get all users with active Gmail connections
  const { data: activeUsers, error } = await supabase
    .from("gmail_tokens")
    .select("user_id, gmail_email")
    .eq("is_active", true);

  if (error || !activeUsers || activeUsers.length === 0) {
    return new Response(
      JSON.stringify({
        message: "No active Gmail users",
        error: error?.message,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const results = [];

  for (const user of activeUsers) {
    try {
      // Create scan job
      const { data: job, error: jobErr } = await supabase
        .from("scan_jobs")
        .insert({
          user_id: user.user_id,
          triggered_by: "cron",
          status: "running",
        })
        .select()
        .single();

      if (jobErr || !job) {
        results.push({ user_id: user.user_id, error: jobErr?.message });
        continue;
      }

      // Trigger scan via backend internal endpoint
      const scanRes = await fetch(`${BACKEND_URL}/api/gmail/scan-internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": CRON_SECRET,
        },
        body: JSON.stringify({ user_id: user.user_id, job_id: job.id }),
      });

      if (!scanRes.ok) {
        results.push({
          user_id: user.user_id,
          error: `Backend returned ${scanRes.status}`,
        });
        continue;
      }

      // Wait briefly, then check results for notification
      // (The actual scan runs async — we check after a delay)
      await new Promise((r) => setTimeout(r, 30000)); // 30s wait

      const { data: completedJob } = await supabase
        .from("scan_jobs")
        .select("*")
        .eq("id", job.id)
        .single();

      const extracted = completedJob?.pdfs_extracted || 0;

      // Send notification email if statements were found
      if (extracted > 0 && user.gmail_email) {
        // Fetch the statements for this scan
        const { data: statements } = await supabase
          .from("email_statements")
          .select("statement_type, institution_name")
          .eq("user_id", user.user_id)
          .eq("processing_status", "parsed")
          .order("created_at", { ascending: false })
          .limit(extracted);

        await sendNotificationEmail(
          user.gmail_email,
          extracted,
          statements || []
        );
      }

      results.push({
        user_id: user.user_id,
        extracted,
        notified: extracted > 0,
      });
    } catch (err) {
      results.push({
        user_id: user.user_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return new Response(
    JSON.stringify({ processed: activeUsers.length, results }),
    { headers: { "Content-Type": "application/json" } }
  );
});

async function sendNotificationEmail(
  email: string,
  count: number,
  statements: Array<{ statement_type: string; institution_name: string }>
) {
  const stmtList = statements
    .map(
      (s) =>
        `<li style="padding:6px 0;color:#0A0A0F;">${s.institution_name} — <span style="color:#6B6B7A;">${s.statement_type.replace("_", " ")}</span></li>`
    )
    .join("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Rupiq <noreply@rupiq.in>",
      to: email,
      subject: `₹ Rupiq found ${count} new statement${count > 1 ? "s" : ""} — your analysis is ready`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 0;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
            <div style="width:32px;height:32px;background:#00C27C;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#0A0A0F;">₹</div>
            <span style="font-size:18px;font-weight:800;color:#0A0A0F;">Rupiq</span>
          </div>
          <h2 style="color:#0A0A0F;font-size:22px;margin-bottom:8px;">Your monthly financial picture is ready</h2>
          <p style="color:#6B6B7A;font-size:15px;line-height:1.6;">
            Rupiq automatically found and analysed <strong style="color:#0A0A0F;">${count} statement${count > 1 ? "s" : ""}</strong> from your Gmail:
          </p>
          <ul style="background:#F5F2EB;padding:16px 16px 16px 32px;border-radius:10px;margin:16px 0;font-size:14px;list-style:disc;">
            ${stmtList}
          </ul>
          <a href="https://rupiq.in/dashboard"
             style="display:inline-block;background:#00C27C;color:#0A0A0F;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px;">
            View Your Report →
          </a>
          <hr style="border:none;border-top:1px solid #E2DED5;margin:32px 0 16px;" />
          <p style="color:#6B6B7A;font-size:12px;line-height:1.6;">
            Rupiq reads your email in read-only mode. We never store your emails or PDFs.
            <a href="https://rupiq.in/settings" style="color:#4A9EFF;">Disconnect Gmail anytime</a>
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    console.error(`Failed to send email to ${email}: ${res.status}`);
  }
}
