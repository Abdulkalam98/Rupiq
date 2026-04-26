"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { upload, analysis, gmail } from "@/lib/api";
import Link from "next/link";

export default function UploadPage() {
  const supabase = createClient();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [analysing, setAnalysing] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const gs = await gmail.status(user.id).catch(() => ({ connected: false }));
      setGmailConnected(gs.connected);
    }
    init();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!userId) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are accepted");
      return;
    }
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const res = await upload.pdf(userId, file);
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    }
    setUploading(false);
  }, [userId]);

  async function handleAnalyse() {
    if (!userId || !result?.upload_id) return;
    setAnalysing(true);
    try {
      const res = await analysis.analyse(userId, [result.upload_id]);
      router.push(`/report/${res.analysis_id}`);
    } catch (e: any) {
      setError(e.message);
      setAnalysing(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green rounded-lg flex items-center justify-center font-display text-sm font-extrabold text-ink">₹</div>
          <span className="font-display text-lg font-extrabold">Rup<span className="text-green">iq</span></span>
        </Link>
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {gmailConnected && (
          <div className="bg-blue/5 border border-blue/20 rounded-xl p-4 mb-8 text-sm text-muted">
            <strong className="text-blue">Gmail is connected.</strong>{" "}
            Your statements are auto-imported monthly. Upload here if something's missing.
          </div>
        )}

        <h1 className="font-display text-3xl font-extrabold mb-2">Upload Statement</h1>
        <p className="text-muted mb-8">
          Drop any bank, credit card, demat, or CIBIL statement PDF.
        </p>

        {/* Drop zone */}
        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-2xl p-16 text-center transition cursor-pointer ${
              dragOver
                ? "border-green bg-green/5"
                : "border-border hover:border-muted"
            }`}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".pdf";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            {uploading ? (
              <>
                <div className="w-10 h-10 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted">Parsing your statement...</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">📄</div>
                <p className="font-display font-bold text-lg mb-1">
                  Drop your PDF here
                </p>
                <p className="text-sm text-muted">
                  or click to browse · max 10MB
                </p>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-orange/5 border border-orange/20 rounded-xl text-sm text-orange">
            {error}
          </div>
        )}

        {/* Parse result */}
        {result && (
          <div className="bg-white border border-border rounded-2xl p-6 mt-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-display font-bold">Statement parsed</p>
                <p className="text-sm text-muted">
                  {result.bank_name} · {result.statement_type?.replace("_", " ")} · {result.transaction_count} transactions
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAnalyse}
                disabled={analysing}
                className="px-6 py-3 bg-green text-ink font-display font-bold text-sm rounded-full hover:brightness-110 transition disabled:opacity-50"
              >
                {analysing ? "Analysing..." : "Run AI Analysis →"}
              </button>
              <button
                onClick={() => { setResult(null); setError(""); }}
                className="px-6 py-3 bg-paper border border-border text-sm font-medium rounded-full hover:bg-white transition"
              >
                Upload Another
              </button>
            </div>
          </div>
        )}

        {/* Supported banks */}
        <div className="mt-12">
          <p className="text-xs font-semibold tracking-[0.16em] uppercase text-muted mb-4">
            Supported Institutions
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Kotak",
              "HDFC Card", "ICICI Card", "SBI Card", "Amex",
              "Zerodha", "Groww", "Upstox", "CIBIL",
            ].map((name) => (
              <span key={name} className="px-3 py-1.5 bg-white border border-border rounded-full text-xs text-muted">
                {name}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
