import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-green rounded-lg flex items-center justify-center font-display text-lg font-extrabold text-ink">
            ₹
          </div>
          <span className="font-display text-xl font-extrabold">
            Rup<span className="text-green">iq</span>
          </span>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 text-sm font-medium text-muted hover:text-ink transition"
          >
            Log in
          </Link>
          <Link
            href="/login?signup=true"
            className="px-5 py-2.5 bg-ink text-white text-sm font-medium rounded-full hover:bg-ink/90 transition"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-green/10 border border-green/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-green rounded-full animate-pulse-green" />
            <span className="text-xs font-medium text-green tracking-wide">
              Auto-imports from Gmail — like CRED
            </span>
          </div>

          <h1 className="font-display text-5xl sm:text-7xl font-extrabold leading-[0.95] tracking-tight mb-6">
            Know your money.
            <br />
            <span className="text-green">Fix it fast.</span>
          </h1>

          <p className="text-lg text-muted max-w-lg mb-10 leading-relaxed">
            Connect Gmail once — Rupiq auto-finds your bank, credit card, demat &amp; CIBIL
            statements every month. AI analyses everything and tells you the{" "}
            <strong className="text-ink">one thing</strong> to fix right now.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/login?signup=true"
              className="inline-flex items-center justify-center px-8 py-4 bg-green text-ink font-display font-bold text-base rounded-full hover:brightness-110 transition"
            >
              Start Free — Connect Gmail →
            </Link>
            <Link
              href="/login?signup=true"
              className="inline-flex items-center justify-center px-8 py-4 bg-white border border-border text-ink font-medium text-base rounded-full hover:bg-ink hover:text-white transition"
            >
              Upload PDF Instead
            </Link>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-3 mt-16">
          {[
            "📧 Auto Gmail scan",
            "🏦 All Indian banks",
            "💳 Credit cards",
            "📈 Demat & brokers",
            "📊 CIBIL score",
            "🤖 AI analysis",
            "🔒 Read-only access",
            "🗑️ PDFs deleted after parsing",
          ].map((f) => (
            <span
              key={f}
              className="px-4 py-2 bg-white border border-border rounded-full text-sm text-muted"
            >
              {f}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-ink py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.16em] uppercase text-green mb-3">
            How It Works
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-16">
            Two ways in. One financial picture.
          </h2>

          <div className="grid sm:grid-cols-4 gap-6">
            {[
              { step: "1", icon: "📧", title: "Connect Gmail", desc: "One-click read-only access. We only look for bank emails." },
              { step: "2", icon: "🔍", title: "Auto-detect", desc: "Rupiq finds statements from 25+ banks, cards & brokers." },
              { step: "3", icon: "⚙️", title: "AI Analysis", desc: "Gemini analyses all statements together for cross-insights." },
              { step: "4", icon: "✅", title: "One Action", desc: "Get your score and the single most impactful thing to fix." },
            ].map((s) => (
              <div key={s.step} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="text-3xl mb-4">{s.icon}</div>
                <div className="font-display text-sm font-bold text-lime mb-1">
                  Step {s.step}
                </div>
                <div className="font-display text-lg font-bold text-white mb-2">
                  {s.title}
                </div>
                <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="font-display text-lg font-extrabold text-white">
            Rup<span className="text-green">iq</span>
          </span>
          <div className="flex gap-6 text-sm text-white/30">
            <Link href="/privacy" className="hover:text-white/60">Privacy</Link>
            <Link href="/terms" className="hover:text-white/60">Terms</Link>
          </div>
          <span className="text-sm text-white/20">Know your money. Fix it fast.</span>
        </div>
      </footer>
    </div>
  );
}
