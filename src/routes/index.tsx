import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { supabase, type Transaction, type Goal, type FixedExpense } from "@/lib/supabase";
import { formatINR, formatDate } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: () => (
    <Layout>
      <Overview />
    </Layout>
  ),
});

function Overview() {
  const { data: txs } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });
  const { data: goals } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("priority");
      if (error) throw error;
      return data as Goal[];
    },
  });
  const { data: fixed } = useQuery({
    queryKey: ["fixed_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fixed_expenses").select("*").eq("active", true);
      if (error) throw error;
      return data as FixedExpense[];
    },
  });

  const now = new Date();
  const monthTxs = (txs ?? []).filter((t) => {
    const d = new Date(t.occurred_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const credit = monthTxs.filter((t) => t.direction === "credit").reduce((s, t) => s + Number(t.amount), 0);
  const debit = monthTxs.filter((t) => t.direction === "debit").reduce((s, t) => s + Number(t.amount), 0);
  const fixedTotal = (fixed ?? []).reduce((s, f) => s + Number(f.amount), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Income this month" value={formatINR(credit)} tone="credit" />
        <Stat label="Spent this month" value={formatINR(debit)} tone="debit" />
        <Stat label="Net" value={formatINR(credit - debit)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Fixed monthly commitments" subtitle={`${fixed?.length ?? 0} items · ${formatINR(fixedTotal)} / month`}>
          <ul className="divide-y divide-border">
            {(fixed ?? []).map((f) => (
              <li key={f.id} className="py-2 flex items-center justify-between text-sm">
                <span>
                  {f.name}
                  {f.day_of_month ? <span className="text-muted-foreground"> · day {f.day_of_month}</span> : null}
                </span>
                <span className="tabular-nums">{formatINR(f.amount)}</span>
              </li>
            ))}
            {(!fixed || fixed.length === 0) && <p className="text-sm text-muted-foreground py-2">None yet.</p>}
          </ul>
        </Card>

        <Card title="Goals" subtitle={`${goals?.length ?? 0} active`}>
          <ul className="space-y-3">
            {(goals ?? []).map((g) => {
              const pct = Math.min(100, (Number(g.current_amount ?? 0) / Number(g.target_amount)) * 100);
              return (
                <li key={g.id}>
                  <div className="flex justify-between text-sm">
                    <span>{g.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatINR(g.current_amount)} / {formatINR(g.target_amount)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">by {formatDate(g.target_date)}</p>
                </li>
              );
            })}
            {(!goals || goals.length === 0) && <p className="text-sm text-muted-foreground">None yet.</p>}
          </ul>
        </Card>
      </div>

      <Card title="Recent transactions">
        <ul className="divide-y divide-border">
          {(txs ?? []).slice(0, 8).map((t) => (
            <li key={t.id} className="py-2.5 flex items-center justify-between text-sm">
              <div>
                <p>{t.description || t.category || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(t.occurred_at)}
                  {t.category ? ` · ${t.category}` : ""}
                </p>
              </div>
              <span
                className="tabular-nums"
                style={{ color: t.direction === "credit" ? "var(--credit)" : "var(--debit)" }}
              >
                {t.direction === "credit" ? "+" : "−"}
                {formatINR(t.amount)}
              </span>
            </li>
          ))}
          {(!txs || txs.length === 0) && (
            <p className="text-sm text-muted-foreground py-2">No transactions yet.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "credit" | "debit" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className="text-2xl font-semibold mt-2 tabular-nums"
        style={tone ? { color: tone === "credit" ? "var(--credit)" : "var(--debit)" } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}
