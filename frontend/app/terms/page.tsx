import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green rounded-lg flex items-center justify-center font-display text-sm font-extrabold text-ink">₹</div>
          <span className="font-display text-lg font-extrabold">Rup<span className="text-green">iq</span></span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-extrabold mb-8">Terms of Service</h1>

        <div className="prose prose-sm max-w-none space-y-6 text-muted">
          <section>
            <h2 className="font-display text-lg font-bold text-ink">Service description</h2>
            <p>
              Rupiq is an AI-powered personal finance assistant that analyses your bank statements,
              credit card statements, demat/brokerage statements, and CIBIL reports to provide financial
              health insights and actionable recommendations.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Not financial advice</h2>
            <p>
              Rupiq provides informational analysis only. It is <strong className="text-ink">not</strong> a
              registered financial advisor. The insights, scores, and recommendations provided should not be
              treated as professional financial, investment, or tax advice. Always consult a qualified
              financial advisor before making significant financial decisions.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">User responsibility</h2>
            <p>
              You are responsible for the accuracy of the documents you upload or provide access to via Gmail.
              Rupiq analyses data as-is and cannot verify the authenticity of financial statements.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Data handling</h2>
            <p>
              See our <Link href="/privacy" className="text-green underline">Privacy Policy</Link> for
              details on how we handle your data. In summary: read-only Gmail access, PDFs deleted after
              parsing, tokens encrypted, no data shared with third parties.
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
