import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Info, RefreshCw, ChevronDown, CheckCircle2, PartyPopper } from "lucide-react";
import { Layout } from "@/components/Layout";
import { formatINR, formatDate } from "@/lib/format";
import { supabase, type Goal } from "@/lib/supabase";
import SpendSummary from "@/components/SpendSummary";

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

type ActiveCommitment = {
  action?: string;
  amount?: number;
  target?: string;
  category?: string;
  description?: string;
};

type PlanResponse = {
  expected_monthly_income: number;
  total_fixed_outflows: number;
  total_goal_savings_required: number;
  discretionary_headroom: number;
  total_committed_reductions?: number;
  projected_discretionary_headroom?: number;
  active_commitments?: ActiveCommitment[];
  total_debt_balance: number;
  weighted_avg_interest_rate: number;
  debt_count?: number;
  goals: PlanGoal[];
  computed_at: string;
};

const PLAN_URL =
  "https://ibjsdafxjggjyamkdjeh.supabase.co/functions/v1/hyper-action";
const PUBLISHABLE_KEY = "sb_publishable_ztTyEdZPNNfk5PjttJimDg_-g3fmC0D";

function LivePlan() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["compute-plan"],
    queryFn: async () => {
      const res = await fetch(PLAN_URL, {
        headers: {
          apikey: PUBLISHABLE_KEY,
          Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as PlanResponse;
    },
  });

  const { data: completedGoals } = useQuery({
    queryKey: ["completed-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("status", "completed")
        .order("target_date", { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          Computing your plan…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <p className="text-base font-medium">Couldn't load plan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong while computing your plan.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-secondary cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const headroom = data.discretionary_headroom;

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-8">
      <SpendSummary />
      {/* Financial Snapshot KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Headroom */}
        <div className="rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Current Headroom
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
            {formatINR(headroom)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            available this month
          </p>
        </div>

        {/* Committed Improvement */}
        <div className="rounded-xl border border-success/30 bg-card p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Committed Improvement
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-success">
            {formatINR(data.total_committed_reductions ?? 0)}
            <span className="text-sm font-medium text-muted-foreground ml-0.5">/mo</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            from active commitments
          </p>
        </div>

        {/* Projected Headroom */}
        <div className="rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Projected Headroom
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
            {formatINR(data.projected_discretionary_headroom ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            After active commitments
          </p>
        </div>
      </section>

      {/* Breakdown */}
      <section className="rounded-xl border border-border bg-card divide-y divide-border">
        <BreakdownRow
          label="Expected monthly income"
          amount={data.expected_monthly_income}
          prefix=""
          detail="Sum of recurring credits and configured monthly income sources."
        />
        <BreakdownRow
          label="Fixed outflows"
          amount={data.total_fixed_outflows}
          prefix="−"
          detail="Total of your active fixed expenses (rent, EMIs, subscriptions, utilities)."
        />
        <BreakdownRow
          label="Goal savings required"
          amount={data.total_goal_savings_required}
          prefix="−"
          detail="Monthly savings needed across all active goals to stay on track."
        />
        <BreakdownRow
          label="Discretionary headroom"
          amount={headroom}
          prefix="="
          highlight
          detail="What remains after income minus fixed outflows and goal savings."
        />
      </section>

      {/* Debt */}
      {data.total_debt_balance > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {formatINR(data.total_debt_balance)} across{" "}
          {data.debt_count ?? "your"} debts at avg{" "}
          {data.weighted_avg_interest_rate?.toFixed(1)}% interest.
        </p>
      )}

      {/* Active Goals */}
      {data.goals && data.goals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Goals
          </h2>
          <div className="space-y-3">
            {data.goals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        </section>
      )}

      {/* Completed Goals */}
      {completedGoals && completedGoals.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Completed
            </h2>
            <PartyPopper className="h-3.5 w-3.5 text-green-600" />
          </div>
          <div className="space-y-3">
            {completedGoals.map((g) => (
              <CompletedGoalCard key={g.id} goal={g} />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
        <span>
          Last computed:{" "}
          {data.computed_at
            ? new Date(data.computed_at).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 hover:text-foreground disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw
            className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </footer>
    </div>
  );
}


function BreakdownRow({
  label,
  amount,
  prefix,
  highlight,
  detail,
}: {
  label: string;
  amount: number;
  prefix: string;
  highlight?: boolean;
  detail: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={highlight ? "bg-secondary/40" : ""}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between text-sm hover:bg-secondary/30 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <span className={highlight ? "font-medium" : ""}>{label}</span>
          <Info className="h-3 w-3 text-muted-foreground/60" />
        </span>
        <span
          className={`tabular-nums ${
            highlight ? "font-semibold text-base" : "font-medium"
          }`}
        >
          {prefix && (
            <span className="text-muted-foreground mr-1.5">{prefix}</span>
          )}
          {formatINR(amount)}
        </span>
      </button>
      {open && (
        <div className="px-5 pb-4 text-xs text-muted-foreground leading-relaxed">
          {detail}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal }: { goal: PlanGoal }) {
  const [open, setOpen] = useState(false);
  const pct = Math.min(100, Math.max(0, goal.percent_complete));
  const styles = statusStyles(goal.status);

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium truncate">{goal.name}</p>
            {goal.target_date && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Target {formatDate(goal.target_date)}
              </p>
            )}
          </div>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ backgroundColor: styles.bg, color: styles.fg }}
          >
            {statusLabel(goal.status)}
          </span>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums mb-1.5">
            <span>
              {formatINR(goal.current_amount)} /{" "}
              {formatINR(goal.target_amount)}
            </span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: styles.fg }}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-foreground/80">
            Save{" "}
            <span className="tabular-nums font-medium">
              {formatINR(goal.required_monthly_savings)}
            </span>
            /month to stay on track
          </p>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          Required monthly savings is derived from the gap between{" "}
          {formatINR(goal.target_amount - goal.current_amount)} remaining and
          the months until {formatDate(goal.target_date)}. Status reflects
          whether your current pace meets that schedule.
        </div>
      )}
    </div>
  );
}

function CompletedGoalCard({ goal }: { goal: Goal }) {
  return (
    <div className="rounded-xl border border-green-200/60 bg-green-50/40 p-4 ring-1 ring-green-500/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate text-green-800">{goal.name}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 whitespace-nowrap">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </span>
          </div>
          <p className="text-xs text-green-600/80 mt-0.5">
            Target achieved by {formatDate(goal.target_date)}
          </p>
        </div>
        <PartyPopper className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-green-700/80 tabular-nums mb-1.5">
          <span>
            {formatINR(goal.current_amount ?? 0)} /{" "}
            {formatINR(goal.target_amount)}
          </span>
          <span>100%</span>
        </div>
        <div className="h-1.5 bg-green-200/40 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: "100%" }} />
        </div>
      </div>

      <p className="mt-3 text-xs text-green-700/90 font-medium">
        Congratulations — you crushed this goal!
      </p>
    </div>
  );
}

function statusLabel(s: string) {
  if (s === "at_risk") return "At risk";
  if (s === "behind") return "Behind";
  return "On track";
}

function statusStyles(s: string): { bg: string; fg: string } {
  if (s === "behind")
    return { bg: "oklch(0.94 0.03 25)", fg: "oklch(0.48 0.10 25)" };
  if (s === "at_risk")
    return { bg: "oklch(0.95 0.04 80)", fg: "oklch(0.52 0.09 75)" };
  return { bg: "oklch(0.94 0.04 160)", fg: "oklch(0.45 0.08 160)" };
}
