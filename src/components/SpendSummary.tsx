import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/lib/supabase";

const PALETTE = [
  "#1a9c6e",
  "#2bb6a3",
  "#4cc4d4",
  "#6aa3e0",
  "#8b7fd6",
  "#c879c0",
  "#e0796f",
  "#e0a44c",
  "#a3b84c",
  "#7d8a99",
];

const UNCATEGORIZED = "Uncategorized";

type Txn = { amount: number | string; category: string | null; occurred_at: string };

function formatINR(n: number, currency = "₹") {
  return `${currency}${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

function monthKey(d: string | Date) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(offset = 0) {
  const dt = new Date();
  dt.setMonth(dt.getMonth() + offset);
  return dt.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function SpendSummary({
  transactions: txnsProp,
  currency = "₹",
}: {
  transactions?: Txn[];
  currency?: string;
}) {
  const [view, setView] = useState<"breakdown" | "compare">("breakdown");
  const [transactions, setTransactions] = useState<Txn[]>(txnsProp ?? []);
  const [loading, setLoading] = useState(!txnsProp);

  useEffect(() => {
    if (txnsProp) {
      setTransactions(txnsProp);
      return;
    }
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setMonth(since.getMonth() - 1);
      since.setDate(1);
      const { data } = await supabase
        .from("transactions")
        .select("amount,category,occurred_at,direction")
        .eq("direction", "debit")
        .gte("occurred_at", since.toISOString());
      setTransactions((data as Txn[]) ?? []);
      setLoading(false);
    })();
  }, [txnsProp]);

  const now = new Date();
  const thisKey = monthKey(now);
  const lastDate = new Date(now);
  lastDate.setMonth(now.getMonth() - 1);
  const lastKey = monthKey(lastDate);

  const { thisMonth, lastMonth, thisTotal, lastTotal, topFive } = useMemo(() => {
    const thisM = new Map<string, number>();
    const lastM = new Map<string, number>();

    for (const t of transactions) {
      if (!t || t.amount == null || !t.occurred_at) continue;
      const amt = Math.abs(Number(t.amount) || 0);
      if (amt === 0) continue;
      const cat = (t.category && String(t.category).trim()) || UNCATEGORIZED;
      const key = monthKey(t.occurred_at);
      if (key === thisKey) thisM.set(cat, (thisM.get(cat) ?? 0) + amt);
      else if (key === lastKey) lastM.set(cat, (lastM.get(cat) ?? 0) + amt);
    }

    const thisArr = [...thisM.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    const lastArr = [...lastM.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const thisSum = thisArr.reduce((s, x) => s + x.amount, 0);
    const lastSum = lastArr.reduce((s, x) => s + x.amount, 0);

    return {
      thisMonth: thisArr,
      lastMonth: lastArr,
      thisTotal: thisSum,
      lastTotal: lastSum,
      topFive: thisArr.slice(0, 5),
    };
  }, [transactions, thisKey, lastKey]);

  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    thisMonth.forEach((d, i) => {
      map.set(
        d.category,
        d.category === UNCATEGORIZED
          ? PALETTE[PALETTE.length - 1]
          : PALETTE[i % (PALETTE.length - 1)],
      );
    });
    return map;
  }, [thisMonth]);

  const compareRows = useMemo(() => {
    const cats = new Set<string>([
      ...thisMonth.map((d) => d.category),
      ...lastMonth.map((d) => d.category),
    ]);
    const lastLookup = new Map(lastMonth.map((d) => [d.category, d.amount]));
    const thisLookup = new Map(thisMonth.map((d) => [d.category, d.amount]));
    return [...cats]
      .map((category) => {
        const cur = thisLookup.get(category) ?? 0;
        const prev = lastLookup.get(category) ?? 0;
        return { category, cur, prev, delta: cur - prev };
      })
      .sort((a, b) => b.cur - a.cur);
  }, [thisMonth, lastMonth]);

  const totalDelta = thisTotal - lastTotal;
  const totalDeltaPct = lastTotal > 0 ? (totalDelta / lastTotal) * 100 : null;
  const hasData = thisMonth.length > 0 || lastMonth.length > 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading spending…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Spending</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{monthLabel(0)}</p>
        </div>
        <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
          <button
            onClick={() => setView("breakdown")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              view === "breakdown"
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Breakdown
          </button>
          <button
            onClick={() => setView("compare")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              view === "compare"
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            vs last month
          </button>
        </div>
      </div>

      {!hasData && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No spending recorded yet this month or last month.
        </p>
      )}

      {hasData && view === "breakdown" && (
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-5 items-center">
          <div className="relative h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={thisMonth}
                  dataKey="amount"
                  nameKey="category"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  stroke="none"
                >
                  {thisMonth.map((d) => (
                    <Cell key={d.category} fill={colorFor.get(d.category)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [formatINR(value, currency), name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
              <span className="text-lg font-bold tabular-nums">{formatINR(thisTotal, currency)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {topFive.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing this month.</p>
            )}
            {topFive.map((d) => {
              const pct = thisTotal > 0 ? (d.amount / thisTotal) * 100 : 0;
              return (
                <div key={d.category} className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: colorFor.get(d.category) }}
                  />
                  <span className="flex-1 text-sm truncate">{d.category}</span>
                  <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
                    {pct.toFixed(0)}%
                  </span>
                  <span className="text-sm font-semibold tabular-nums w-20 text-right">
                    {formatINR(d.amount, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasData && view === "compare" && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground">This month</p>
              <p className="text-xl font-bold tabular-nums">{formatINR(thisTotal, currency)}</p>
            </div>
            <span className="text-base text-muted-foreground">
              {totalDelta === 0 ? "→" : totalDelta > 0 ? "▲" : "▼"}
            </span>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{monthLabel(-1)}</p>
              <p className="text-xl font-bold tabular-nums text-muted-foreground">
                {formatINR(lastTotal, currency)}
              </p>
            </div>
          </div>

          <div
            className="rounded-lg px-3 py-2 text-xs font-medium text-center"
            style={{
              background:
                totalDelta > 0
                  ? "color-mix(in oklab, var(--destructive) 12%, transparent)"
                  : totalDelta < 0
                  ? "color-mix(in oklab, var(--primary) 12%, transparent)"
                  : "var(--secondary)",
              color:
                totalDelta > 0
                  ? "var(--destructive)"
                  : totalDelta < 0
                  ? "var(--primary)"
                  : "var(--muted-foreground)",
            }}
          >
            {totalDelta === 0
              ? "Same as last month"
              : `${formatINR(totalDelta, currency)} ${totalDelta > 0 ? "more" : "less"}` +
                (totalDeltaPct != null ? ` (${Math.abs(totalDeltaPct).toFixed(0)}%)` : "") +
                " than last month"}
          </div>

          <div className="flex flex-col">
            {compareRows.map((r) => (
              <div
                key={r.category}
                className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2 border-b border-border last:border-b-0"
              >
                <span className="text-sm truncate">{r.category}</span>
                <span className="text-sm font-semibold tabular-nums w-20 text-right">
                  {formatINR(r.cur, currency)}
                </span>
                <span
                  className="text-xs font-medium tabular-nums w-24 text-right"
                  style={{
                    color:
                      r.delta > 0
                        ? "var(--destructive)"
                        : r.delta < 0
                        ? "var(--primary)"
                        : "var(--muted-foreground)",
                  }}
                >
                  {r.delta === 0
                    ? "—"
                    : `${r.delta > 0 ? "+" : "−"}${formatINR(r.delta, currency)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
