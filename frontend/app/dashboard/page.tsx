"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { gmail, analysis } from "@/lib/api";
import Link from "next/link";
import GmailConnectCard from "@/components/gmail/GmailConnectCard";
import ScanProgress from "@/components/gmail/ScanProgress";

type GmailStatus = { connected: boolean; gmail_email?: string; last_synced_at?: string };
type AnalysisData = { has_analysis: boolean; financial_score?: number; top_action?: string; id?: string; spending_breakdown?: Record<string, number>; insights?: any[]; created_at?: string };

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisData | null>(null);
  const [scanJobId, setScanJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      // Fetch gmail status + latest analysis in parallel
      const [gs, an] = await Promise.all([
        gmail.status(user.id).catch(() => ({ connected: false })),
        analysis.latest(user.id).catch(() => ({ has_analysis: false })),
      ]);
      setGmailStatus(gs);
      setLatestAnalysis(an);
      setLoading(false);

      // If redirected from Gmail OAuth with scan=starting, trigger scan
      if (params.get("gmail") === "connected" && params.get("scan") === "starting") {
        const scanResult = await gmail.scan(user.id);
        setScanJobId(scanResult.scan_job_id);
      }
    }
    init();
  }, []);

  async function handleSyncNow() {
    if (!userId) return;
    const result = await gmail.scan(userId);
    setScanJobId(result.scan_job_id);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show scan progress overlay
  if (scanJobId && userId) {
    return (
      <ScanProgress
        userId={userId}
        jobId={scanJobId}
        onComplete={() => {
          setScanJobId(null);
          // Refresh analysis
          analysis.latest(userId).then(setLatestAnalysis).catch(() => {});
          gmail.status(userId).then(setGmailStatus).catch(() => {});
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green rounded-lg flex items-center justify-center font-display text-sm font-extrabold text-ink">₹</div>
          <span className="font-display text-lg font-extrabold">Rup<span className="text-green">iq</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/upload" className="text-sm font-medium text-muted hover:text-ink">Upload PDF</Link>
          <Link href="/settings" className="text-sm font-medium text-muted hover:text-ink">Settings</Link>
          <button onClick={handleSignOut} className="text-sm text-muted hover:text-orange">Sign Out</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Gmail status bar */}
        {gmailStatus?.connected ? (
          <div className="flex items-center justify-between bg-white border border-border rounded-xl px-5 py-3 mb-8">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-green rounded-full" />
              <span className="text-sm text-muted">
                Gmail connected · <strong className="text-ink">{gmailStatus.gmail_email}</strong>
                {gmailStatus.last_synced_at && (
                  <> · Last synced {new Date(gmailStatus.last_synced_at).toLocaleDateString("en-IN")}</>
                )}
              </span>
            </div>
            <button onClick={handleSyncNow} className="text-sm font-medium text-green hover:text-green/80">
              Sync Now
            </button>
          </div>
        ) : (
          <GmailConnectCard userId={userId!} />
        )}

        {/* Analysis result */}
        {latestAnalysis?.has_analysis ? (
          <div className="space-y-6">
            {/* Score + Top Action */}
            <div className="bg-ink rounded-2xl p-8 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] uppercase text-lime mb-2">Financial Health Score</p>
                  <div className="font-display text-7xl font-extrabold text-lime">
                    {latestAnalysis.financial_score}
                  </div>
                  <p className="text-sm text-white/40 mt-1">/100</p>
                </div>
                <div className="text-right max-w-xs">
                  <p className="text-xs font-semibold tracking-[0.16em] uppercase text-orange mb-2">Top Action</p>
                  <p className="text-base font-medium leading-snug">{latestAnalysis.top_action}</p>
                </div>
              </div>
              <div className="mt-6">
                <Link
                  href={`/report/${latestAnalysis.id}`}
                  className="inline-flex px-6 py-3 bg-lime text-ink font-display font-bold text-sm rounded-full hover:brightness-110 transition"
                >
                  View Full Report →
                </Link>
              </div>
            </div>

            {/* Spending breakdown */}
            {latestAnalysis.spending_breakdown && (
              <div className="bg-white border border-border rounded-2xl p-6">
                <h3 className="font-display text-lg font-bold mb-4">Spending Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(latestAnalysis.spending_breakdown)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 8)
                    .map(([cat, amount]) => {
                      const max = Math.max(...Object.values(latestAnalysis.spending_breakdown!).map(Number));
                      const pct = max > 0 ? ((amount as number) / max) * 100 : 0;
                      return (
                        <div key={cat} className="flex items-center gap-4">
                          <span className="text-sm text-muted w-24 capitalize">{cat}</span>
                          <div className="flex-1 h-3 bg-paper rounded-full overflow-hidden">
                            <div className="h-full bg-green rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-medium w-24 text-right">
                            ₹{(amount as number).toLocaleString("en-IN")}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Insights */}
            {latestAnalysis.insights && latestAnalysis.insights.length > 0 && (
              <div className="bg-white border border-border rounded-2xl p-6">
                <h3 className="font-display text-lg font-bold mb-4">Insights</h3>
                <div className="space-y-3">
                  {latestAnalysis.insights.slice(0, 5).map((ins: any, i: number) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border ${
                        ins.type === "warning"
                          ? "bg-orange/5 border-orange/20"
                          : ins.type === "positive"
                          ? "bg-green/5 border-green/20"
                          : "bg-blue/5 border-blue/20"
                      }`}
                    >
                      <p className="font-display text-sm font-bold mb-1">{ins.title}</p>
                      <p className="text-sm text-muted">{ins.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* No analysis yet */
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="font-display text-2xl font-bold mb-2">No analysis yet</h2>
            <p className="text-muted mb-6">
              {gmailStatus?.connected
                ? "Hit 'Sync Now' above to scan your Gmail for statements."
                : "Connect Gmail or upload a statement PDF to get started."}
            </p>
            <Link
              href="/upload"
              className="inline-flex px-6 py-3 bg-ink text-white font-medium text-sm rounded-full hover:bg-ink/90 transition"
            >
              Upload a PDF →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
