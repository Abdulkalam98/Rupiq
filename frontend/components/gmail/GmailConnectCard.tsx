"use client";

import { gmail } from "@/lib/api";

export default function GmailConnectCard({ userId }: { userId: string }) {
  async function handleConnect() {
    const { auth_url } = await gmail.connect(userId);
    window.location.href = auth_url;
  }

  return (
    <div className="bg-ink rounded-2xl p-8 mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <div className="text-4xl mb-4">📧</div>
        <h2 className="font-display text-2xl font-extrabold text-white mb-2">
          Auto-import your statements
        </h2>
        <p className="text-sm text-white/40 max-w-md mb-6 leading-relaxed">
          Connect Gmail and Rupiq finds your bank, credit card, demat, and CIBIL statements
          automatically — every month.
        </p>

        {/* Permissions */}
        <div className="space-y-2 mb-8">
          {[
            "Read emails from your bank & financial institutions only",
            "Extract PDF statement attachments",
            "Never read personal emails",
            "Never send emails on your behalf",
            "Disconnect anytime from Settings",
          ].map((perm, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-green text-sm">✓</span>
              <span className="text-sm text-white/60">{perm}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleConnect}
            className="px-7 py-3.5 bg-green text-ink font-display font-bold text-sm rounded-full hover:brightness-110 transition"
          >
            Connect Gmail →
          </button>
          <a href="/upload" className="text-sm text-white/40 hover:text-white/60 transition">
            I'll upload PDFs manually
          </a>
        </div>
      </div>
    </div>
  );
}
