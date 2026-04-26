"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { gmail } from "@/lib/api";
import Link from "next/link";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [gmailStatus, setGmailStatus] = useState<any>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const gs = await gmail.status(user.id).catch(() => ({ connected: false }));
      setGmailStatus(gs);
    }
    init();
  }, []);

  async function handleDisconnect() {
    if (!userId) return;
    setDisconnecting(true);
    await gmail.disconnect(userId);
    setGmailStatus({ connected: false });
    setDisconnecting(false);
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green rounded-lg flex items-center justify-center font-display text-sm font-extrabold text-ink">₹</div>
          <span className="font-display text-lg font-extrabold">Rup<span className="text-green">iq</span></span>
        </Link>
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <h1 className="font-display text-3xl font-extrabold">Settings</h1>

        {/* Gmail section */}
        <div className="bg-white border border-border rounded-2xl p-6">
          <h3 className="font-display text-lg font-bold mb-4">Gmail Connection</h3>

          {gmailStatus?.connected ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-2.5 h-2.5 bg-green rounded-full" />
                <span className="text-sm">
                  Connected: <strong>{gmailStatus.gmail_email}</strong>
                </span>
              </div>
              {gmailStatus.last_synced_at && (
                <p className="text-sm text-muted mb-4">
                  Last synced: {new Date(gmailStatus.last_synced_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
              <div className="bg-orange/5 border border-orange/20 rounded-xl p-4 mb-4">
                <p className="text-sm text-muted">
                  Disconnecting will stop auto-import of new statements. Your existing financial data will <strong className="text-ink">not</strong> be deleted.
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-5 py-2.5 bg-white border border-orange/30 text-orange text-sm font-medium rounded-full hover:bg-orange/5 transition disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect Gmail"}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted mb-4">Gmail is not connected. Connect to auto-import statements monthly.</p>
              <Link
                href="/dashboard"
                className="inline-flex px-5 py-2.5 bg-green text-ink text-sm font-bold rounded-full hover:brightness-110 transition"
              >
                Connect Gmail →
              </Link>
            </div>
          )}
        </div>

        {/* Account section */}
        <div className="bg-white border border-border rounded-2xl p-6">
          <h3 className="font-display text-lg font-bold mb-4">Account</h3>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}
            className="px-5 py-2.5 bg-paper border border-border text-sm font-medium rounded-full hover:bg-ink hover:text-white transition"
          >
            Sign Out
          </button>
        </div>
      </main>
    </div>
  );
}
