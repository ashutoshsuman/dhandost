import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: () => (
    <Layout>
      <LivePlan />
    </Layout>
  ),
});

type PlanGoal = {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
  required_monthly_savings: number;
  status: "on_track" | "at_risk" | "behind" | string;
  percent_complete: number;
  target_date: string;
  priority: number;
};

type PlanResponse = {
  expected_monthly_income: number;
  total_fixed_outflows: number;
  total_goal_savings_required: number;
  discretionary_headroom: number;
  total_debt_balance: number;
  weighted_avg_interest_rate: number;
  goals: PlanGoal[];
  computed_at: string;
};

function LivePlan() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["hyper-action"],
    queryFn: async () => {
      const res = await fetch(
        "https://ibjsdafxjggjyamkdjeh.supabase.co/functions/v1/hyper-action",
        {
          headers: {
            Authorization:
              "Bearer sb_publishable_ztTyEdZPNNfk5PjttJimDg_-g3fmC0D",
          },
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as PlanResponse;
    },
  });

  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Live Plan</h1>
          <p className="text-sm text-muted-foreground mt-1">{monthLabel}</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading your plan…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-border bg-card p-5 text-sm">
          <p className="font-medium">Could not load your plan. Please try again.</p>
        </div>
      )}

      {data && (
        <>
          <section className="rounded-lg border border-border bg-card divide-y divide-border">
            <BreakdownRow
              label="Monthly Income"
              amount={data.expected_monthly_income}
              tone="credit"
            />
            <BreakdownRow
              label="Fixed Expenses"
              amount={data.total_fixed_outflows}
              tone="debit"
            />
            <BreakdownRow
              label="Goal Savings Required"
              amount={data.total_goal_savings_required}
              tone="debit"
            />
            <BreakdownRow
              label="Discretionary Headroom"
              amount={data.discretionary_headroom}
              tone="muted"
            />
          </section>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Goals</h2>
            {(data.goals ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No goals yet.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(data.goals ?? []).map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BreakdownRow({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: "credit" | "debit" | "muted";
}) {
  const color =
    tone === "credit"
      ? "var(--credit)"
      : tone === "debit"
      ? "var(--debit)"
      : undefined;
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span
          className="tabular-nums font-medium"
          style={color ? { color } : undefined}
        >
          {formatINR(amount)}
        </span>
      </div>
    </div>
  );
}

function GoalCard({ goal }: { goal: PlanGoal }) {
  const pct = Math.min(100, Math.max(0, goal.percent_complete));
  const status = goal.status;
  const styles = statusStyles(status);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{goal.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
            {formatINR(goal.current_amount)} / {formatINR(goal.target_amount)}
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
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: styles.fg }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{pct.toFixed(1)}% complete</span>
        <span className="tabular-nums">
          {formatINR(goal.required_monthly_savings)}/mo
        </span>
      </div>
    </div>
  );
}

function statusLabel(s: string) {
  if (s === "at_risk") return "At risk";
  if (s === "behind") return "Behind";
  return "On track";
}

function statusStyles(s: string): { bg: string; fg: string } {
  if (s === "behind") return { bg: "oklch(0.92 0.04 25)", fg: "oklch(0.45 0.12 25)" };
  if (s === "at_risk") return { bg: "oklch(0.94 0.05 80)", fg: "oklch(0.5 0.11 75)" };
  return { bg: "oklch(0.93 0.05 150)", fg: "oklch(0.42 0.09 150)" };
}
