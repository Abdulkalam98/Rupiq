"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { analysis } from "@/lib/api";
import Link from "next/link";

export default function ReportPage() {
  const supabase = createClient();
  const router = useRouter();
  const { id } = useParams();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      try {
        const result = await analysis.get(user.id, id as string);
        setData(result);
      } catch {
        router.push("/dashboard");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const score = data.financial_score || 0;
  const scoreColor = score >= 70 ? "text-green" : score >= 40 ? "text-orange" : "text-orange";

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green rounded-lg flex items-center justify-center font-display text-sm font-extrabold text-ink">₹</div>
          <span className="font-display text-lg font-extrabold">Rup<span className="text-green">iq</span></span>
        </Link>
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Score hero */}
        <div className="bg-ink rounded-2xl p-10 text-center">
          <p className="text-xs font-semibold tracking-[0.16em] uppercase text-lime mb-4">
            Financial Health Score
          </p>
          <div className={`font-display text-8xl font-extrabold ${scoreColor}`}>
            {score}
          </div>
          <p className="text-white/30 mt-1">/100</p>
          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-5 max-w-md mx-auto">
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-orange mb-2">
              #1 Action
            </p>
            <p className="text-white font-medium">{data.top_action}</p>
          </div>
        </div>

        {/* Summary */}
        {data.summary && (
          <div className="bg-white border border-border rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold mb-4">Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Income", value: data.summary.total_income, prefix: "₹" },
                { label: "Expenses", value: data.summary.total_expenses, prefix: "₹" },
                { label: "Investments", value: data.summary.total_investments, prefix: "₹" },
                { label: "Savings Rate", value: data.summary.savings_rate },
                { label: "Credit Utilization", value: data.summary.credit_utilization },
                { label: "Net Worth Est.", value: data.summary.net_worth_estimate, prefix: "₹" },
              ].filter((s) => s.value != null).map((s) => (
                <div key={s.label} className="bg-paper rounded-xl p-4">
                  <p className="text-xs text-muted mb-1">{s.label}</p>
                  <p className="font-display text-xl font-bold">
                    {s.prefix && typeof s.value === "number"
                      ? `${s.prefix}${s.value.toLocaleString("en-IN")}`
                      : s.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spending breakdown */}
        {data.spending_breakdown && (
          <div className="bg-white border border-border rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold mb-4">Spending Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(data.spending_breakdown)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([cat, amount]) => {
                  const max = Math.max(...Object.values(data.spending_breakdown).map(Number));
                  const pct = max > 0 ? ((amount as number) / max) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-4">
                      <span className="text-sm text-muted w-28 capitalize">{cat}</span>
                      <div className="flex-1 h-3 bg-paper rounded-full overflow-hidden">
                        <div className="h-full bg-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-medium w-28 text-right">
                        ₹{(amount as number).toLocaleString("en-IN")}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Cross-statement insights */}
        {data.cross_statement_insights && data.cross_statement_insights.length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold mb-4">Cross-Statement Insights</h3>
            <div className="space-y-3">
              {data.cross_statement_insights.map((cs: any, i: number) => (
                <div key={i} className="bg-purple/5 border border-purple/20 rounded-xl p-4">
                  <p className="text-sm font-medium mb-1">{cs.insight}</p>
                  <p className="text-sm text-green font-medium">{cs.action}</p>
                  {cs.annual_saving && (
                    <p className="text-xs text-muted mt-1">
                      Potential annual saving: ₹{cs.annual_saving.toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {data.insights && data.insights.length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold mb-4">All Insights</h3>
            <div className="space-y-3">
              {data.insights.map((ins: any, i: number) => (
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">{ins.category}</span>
                  </div>
                  <p className="font-display text-sm font-bold">{ins.title}</p>
                  <p className="text-sm text-muted mt-1">{ins.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly trend */}
        {data.monthly_trend && (
          <div className="bg-white border border-border rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold mb-4">Monthly Trend</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-paper rounded-xl p-4 text-center">
                <p className="text-xs text-muted mb-1">Income</p>
                <p className="font-display font-bold capitalize">{data.monthly_trend.income_trend}</p>
              </div>
              <div className="bg-paper rounded-xl p-4 text-center">
                <p className="text-xs text-muted mb-1">Expenses</p>
                <p className="font-display font-bold capitalize">{data.monthly_trend.expense_trend}</p>
              </div>
              <div className="bg-paper rounded-xl p-4 text-center">
                <p className="text-xs text-muted mb-1">Verdict</p>
                <p className="text-sm font-medium">{data.monthly_trend.verdict}</p>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted pt-4">
          Analysed on {new Date(data.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </main>
    </div>
  );
}
