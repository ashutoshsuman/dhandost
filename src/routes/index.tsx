import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Info } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { formatINR, formatDate } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: () => (
    <Layout>
      <LivePlan />
    </Layout>
  ),
});

type Driver = {
  label: string;
  amount?: number | string | null;
  date?: string | null;
  note?: string | null;
};

type PlanGoal = {
  id?: string;
  name: string;
  current_amount?: number | string | null;
  target_amount?: number | string | null;
  status?: "on-track" | "at-risk" | "behind" | string;
  drivers?: Driver[];
};

type PlanResponse = {
  headroom?: number;
  expected_income?: number;
  fixed_outflows?: number;
  goal_savings_required?: number;
  month?: string;
  drivers?: {
    headroom?: Driver[];
    expected_income?: Driver[];
    fixed_outflows?: Driver[];
    goal_savings_required?: Driver[];
  };
  goals?: PlanGoal[];
};

function LivePlan() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["compute-plan"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("compute-plan", {
        body: { month: new Date().toISOString().slice(0, 7) },
      });
      if (error) throw error;
      return data as PlanResponse;
    },
  });

  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Live Plan</h1>
          <p className="text-sm text-muted-foreground mt-1">{data?.month ?? monthLabel}</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Computing your plan…</p>}
      {error && (
        <div className="rounded-lg border border-border bg-card p-5 text-sm">
          <p className="font-medium">Couldn't reach compute-plan.</p>
          <p className="text-muted-foreground mt-1">{(error as Error).message}</p>
        </div>
      )}

      {data && (
        <>
          <HeadroomHero
            amount={data.headroom ?? 0}
            drivers={data.drivers?.headroom}
          />

          <section className="rounded-lg border border-border bg-card divide-y divide-border">
            <BreakdownRow
              label="Expected income"
              amount={data.expected_income ?? 0}
              tone="credit"
              drivers={data.drivers?.expected_income}
            />
            <BreakdownRow
              label="Fixed outflows"
              amount={data.fixed_outflows ?? 0}
              tone="debit"
              drivers={data.drivers?.fixed_outflows}
            />
            <BreakdownRow
              label="Goal savings required"
              amount={data.goal_savings_required ?? 0}
              tone="debit"
              drivers={data.drivers?.goal_savings_required}
            />
            <BreakdownRow
              label="Headroom"
              amount={data.headroom ?? 0}
              tone="muted"
              drivers={data.drivers?.headroom}
            />
          </section>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Goals</h2>
            {(data.goals ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No goals yet.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(data.goals ?? []).map((g, i) => (
                <GoalCard key={g.id ?? i} goal={g} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HeadroomHero({ amount, drivers }: { amount: number; drivers?: Driver[] }) {
  const [open, setOpen] = useState(false);
  const negative = amount < 0;
  return (
    <section className="rounded-lg border border-border bg-card p-8">
      <div className="flex items-center gap-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Discretionary headroom this month
        </p>
        <InfoBtn open={open} onClick={() => setOpen((v) => !v)} />
      </div>
      <p
        className="mt-3 text-5xl font-semibold tabular-nums"
        style={{ color: negative ? "var(--debit)" : "var(--credit)" }}
      >
        {formatINR(amount)}
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        What's left after income, fixed costs, and goal savings.
      </p>
      {open && <DriversPanel drivers={drivers} />}
    </section>
  );
}

function BreakdownRow({
  label,
  amount,
  tone,
  drivers,
}: {
  label: string;
  amount: number;
  tone: "credit" | "debit" | "muted";
  drivers?: Driver[];
}) {
  const [open, setOpen] = useState(false);
  const color =
    tone === "credit" ? "var(--credit)" : tone === "debit" ? "var(--debit)" : undefined;
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span>{label}</span>
          <InfoBtn open={open} onClick={() => setOpen((v) => !v)} />
        </div>
        <span className="tabular-nums font-medium" style={color ? { color } : undefined}>
          {formatINR(amount)}
        </span>
      </div>
      {open && <DriversPanel drivers={drivers} />}
    </div>
  );
}

function GoalCard({ goal }: { goal: PlanGoal }) {
  const [open, setOpen] = useState(false);
  const current = Number(goal.current_amount ?? 0);
  const target = Number(goal.target_amount ?? 0);
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const status = (goal.status ?? "on-track") as string;
  const styles = statusStyles(status);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{goal.name}</p>
            <InfoBtn open={open} onClick={() => setOpen((v) => !v)} />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
            {formatINR(current)} / {formatINR(target)}
          </p>
        </div>
        <span
          className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ backgroundColor: styles.bg, color: styles.fg }}
        >
          {statusLabel(status)}
        </span>
      </div>
      <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: styles.fg }} />
      </div>
      {open && <DriversPanel drivers={goal.drivers} />}
    </div>
  );
}

function InfoBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Show details"
      aria-expanded={open}
      className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ${
        open ? "bg-secondary text-foreground" : ""
      }`}
    >
      <Info size={13} />
    </button>
  );
}

function DriversPanel({ drivers }: { drivers?: Driver[] }) {
  if (!drivers || drivers.length === 0) {
    return (
      <div className="mt-3 rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
        No driver details provided by compute-plan.
      </div>
    );
  }
  return (
    <ul className="mt-3 rounded-md bg-secondary/50 divide-y divide-border">
      {drivers.map((d, i) => (
        <li key={i} className="px-3 py-2 flex items-start justify-between gap-3 text-xs">
          <div className="min-w-0">
            <p className="truncate">{d.label}</p>
            {(d.date || d.note) && (
              <p className="text-muted-foreground mt-0.5">
                {d.date ? formatDate(d.date) : ""}
                {d.date && d.note ? " · " : ""}
                {d.note ?? ""}
              </p>
            )}
          </div>
          {d.amount != null && (
            <span className="tabular-nums text-muted-foreground whitespace-nowrap">
              {formatINR(d.amount)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function statusLabel(s: string) {
  if (s === "at-risk") return "At risk";
  if (s === "behind") return "Behind";
  return "On track";
}

function statusStyles(s: string): { bg: string; fg: string } {
  // Muted, not neon
  if (s === "behind") return { bg: "oklch(0.92 0.04 25)", fg: "oklch(0.45 0.12 25)" };
  if (s === "at-risk") return { bg: "oklch(0.94 0.05 80)", fg: "oklch(0.5 0.11 75)" };
  return { bg: "oklch(0.93 0.05 150)", fg: "oklch(0.42 0.09 150)" };
}
