import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green rounded-lg flex items-center justify-center font-display text-sm font-extrabold text-ink">₹</div>
          <span className="font-display text-lg font-extrabold">Rup<span className="text-green">iq</span></span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-extrabold mb-8">Privacy Policy</h1>

        <div className="prose prose-sm max-w-none space-y-6 text-muted">
          <section>
            <h2 className="font-display text-lg font-bold text-ink">What data we access</h2>
            <p>
              When you connect Gmail, Rupiq requests <strong className="text-ink">read-only access</strong> to your email
              (scope: <code className="bg-white px-1.5 py-0.5 rounded text-xs">gmail.readonly</code>). We search for emails
              from known financial institutions (banks, credit card issuers, brokerages, and credit bureaus) and extract
              only PDF statement attachments.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">What we do with it</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Extract PDF statement attachments from financial institution emails</li>
              <li>Parse transaction data from those PDFs using our backend parser</li>
              <li>Run AI analysis on the structured transaction data</li>
              <li>Show you a financial health score and actionable insights</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">What we do NOT do</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>We <strong className="text-ink">never</strong> read your personal emails — only emails from known bank/financial senders</li>
              <li>We <strong className="text-ink">never</strong> send emails on your behalf</li>
              <li>We <strong className="text-ink">never</strong> modify or delete any emails</li>
              <li>We <strong className="text-ink">never</strong> store email content — only extracted transaction data</li>
              <li>We <strong className="text-ink">never</strong> share your data with third parties</li>
              <li>PDF files are deleted from memory immediately after parsing — never persisted to storage</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Token security</h2>
            <p>
              Your Gmail OAuth tokens are encrypted using AES encryption before being stored in our database.
              They are never logged, never exposed to the frontend, and never accessible in plaintext.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">How to disconnect</h2>
            <p>
              Go to <Link href="/settings" className="text-green underline">Settings</Link> and click
              "Disconnect Gmail". This immediately deactivates your tokens. Your existing financial analysis
              data remains unless you explicitly request deletion.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Data deletion</h2>
            <p>
              To request complete deletion of all your data, email us at{" "}
              <strong className="text-ink">privacy@rupiq.in</strong>. We will delete all your
              profile data, transaction data, analysis results, and Gmail tokens within 7 days.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Manual PDF uploads</h2>
            <p>
              If you upload PDFs manually instead of using Gmail, the same privacy rules apply: PDFs are
              parsed in memory and deleted from storage immediately after transaction extraction.
            </p>
          </section>

          <p className="text-xs text-muted/50 pt-4">
            Last updated: April 2026
          </p>
        </div>
      </main>
    </div>
  );
}
