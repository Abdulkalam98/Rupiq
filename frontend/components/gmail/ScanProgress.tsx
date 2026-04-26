"use client";

import { useEffect, useState } from "react";
import { gmail } from "@/lib/api";

type ScanJob = {
  status: string;
  emails_found: number;
  pdfs_extracted: number;
  statements_analysed: number;
};

export default function ScanProgress({
  userId,
  jobId,
  onComplete,
}: {
  userId: string;
  jobId: string;
  onComplete: () => void;
}) {
  const [job, setJob] = useState<ScanJob | null>(null);
  const [phase, setPhase] = useState<"scanning" | "found" | "done" | "failed">("scanning");

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await gmail.scanStatus(userId, jobId);
        setJob(data);

        if (data.status === "completed") {
          setPhase(data.pdfs_extracted > 0 ? "done" : "done");
          clearInterval(interval);
          setTimeout(onComplete, 2500);
        } else if (data.status === "failed") {
          setPhase("failed");
          clearInterval(interval);
          setTimeout(onComplete, 3000);
        } else if (data.emails_found > 0) {
          setPhase("found");
        }
      } catch {
        // Keep polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [userId, jobId, onComplete]);

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* Animated logo */}
        <div className="w-20 h-20 bg-green rounded-2xl flex items-center justify-center font-display text-3xl font-extrabold text-ink mx-auto mb-8 animate-pulse-green">
          ₹
        </div>

        {phase === "scanning" && (
          <>
            <h2 className="font-display text-2xl font-extrabold text-white mb-3">
              Searching your Gmail...
            </h2>
            <p className="text-sm text-white/40">
              Looking for bank, credit card, demat & CIBIL statement emails
            </p>
            <div className="flex justify-center gap-2 mt-8">
              {["HDFC", "ICICI", "SBI", "Zerodha", "CIBIL"].map((name, i) => (
                <span
                  key={name}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-white/50"
                  style={{ animationDelay: `${i * 0.3}s`, animation: "pulse 2s ease-in-out infinite" }}
                >
                  {name}
                </span>
              ))}
            </div>
          </>
        )}

        {phase === "found" && job && (
          <>
            <h2 className="font-display text-2xl font-extrabold text-white mb-3">
              Found {job.emails_found} emails
            </h2>
            <p className="text-sm text-white/40">Extracting PDF attachments...</p>
            <div className="w-full bg-white/10 rounded-full h-2 mt-8 overflow-hidden">
              <div className="h-full bg-green rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </>
        )}

        {phase === "done" && job && (
          <>
            <h2 className="font-display text-2xl font-extrabold text-lime mb-3">
              {job.pdfs_extracted > 0
                ? `${job.pdfs_extracted} statement${job.pdfs_extracted > 1 ? "s" : ""} ready`
                : "No statements found"}
            </h2>
            <p className="text-sm text-white/40">
              {job.pdfs_extracted > 0
                ? "Redirecting to your dashboard..."
                : "Try uploading PDFs manually instead."}
            </p>
          </>
        )}

        {phase === "failed" && (
          <>
            <h2 className="font-display text-2xl font-extrabold text-orange mb-3">
              Scan failed
            </h2>
            <p className="text-sm text-white/40">
              Something went wrong. Returning to dashboard...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
