import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Info, RefreshCw, ChevronDown, CheckCircle2, PartyPopper, Lightbulb, ArrowRight, TrendingDown, Clock, TrendingUp, Banknote } from "lucide-react";
import { Layout } from "@/components/Layout";
import { formatINR, formatDate } from "@/lib/format";
import { supabase, type Goal } from "@/lib/supabase";
import SpendSummary from "@/components/SpendSummary";
import VariableSpendingTracker from "@/components/VariableSpendingTracker";
import SpendingInsights from "@/components/SpendingInsights";

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
  id?: string;
  commitment_type?: "reduce_discretionary" | "delay_goal" | "debt_paydown";
  status?: "active" | "pending" | "confirmed" | string;
  goal_name?: string;
  goal_id?: string;
  category?: string;
  monthly_amount?: number;
  duration_months?: number;
  delay_weeks?: number;
  ends_at?: string;
  // Debt paydown fields
  debt_id?: string;
  debt_name?: string;
  paydown_amount?: number;
  balance_before?: number;
  balance_after?: number;
  confirmed_at?: string;
  interest_rate_annual?: number;
};

const visibleCommitmentStatuses = new Set(["active", "pending", "confirmed"]);

function isVisibleCommitment(commitment: ActiveCommitment) {
  return visibleCommitmentStatuses.has(commitment.status ?? "active");
}




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

function LivePlan() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["compute-plan"],
    queryFn: async () => {
      // Ensure the user is authenticated before invoking the edge function.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        await supabase.auth.signOut();
        throw new Error("Not authenticated");
      }
      // Shared authenticated supabase client — invoke() auto-attaches the
      // user's access token. Do NOT use fetch() or set headers manually.
      const { data, error } = await supabase.functions.invoke<PlanResponse>(
        "hyper-action",
        { body: {} },
      );
      if (error) {
        console.error("hyper-action failed:", error);
        throw error;
      }
      return data as PlanResponse;
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

  const { data: debtsList } = useQuery({
    queryKey: ["debts-for-commitments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("id,name,interest_rate_annual,balance");
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        interest_rate_annual: number | null;
        balance?: number | null;
        current_balance?: number | null;
      }>;
    },
  });

  const { data: activeCommitments } = useQuery({
    queryKey: ["active-commitments"],
    queryFn: async () => {
      // Primary source: the active_commitments view, which already exposes
      // debt_paydown rows with status 'pending' / 'confirmed'.
      const { data: viewData, error: viewError } = await supabase
        .from("active_commitments")
        .select("*")
        .in("status", ["active", "pending", "confirmed"]);
      if (viewError) throw viewError;
      const viewRows = (viewData ?? []) as ActiveCommitment[];

      // Best-effort enrichment from the source commitments table to fill in
      // debt_id when the view omits it. Any failure here must NOT drop the
      // view rows that are already rendering correctly.
      let debtRows: ActiveCommitment[] = [];
      try {
        const { data: debtData, error: debtError } = await supabase
          .from("commitments")
          .select("*")
          .eq("commitment_type", "debt_paydown")
          .in("status", ["pending", "confirmed"]);
        if (!debtError) debtRows = (debtData ?? []) as ActiveCommitment[];
      } catch {
        /* ignore — fall back to view rows alone */
      }

      const debtById = new Map<string, ActiveCommitment>();
      debtRows.forEach((r) => {
        if (r.id) debtById.set(r.id, r);
      });
      const merged: ActiveCommitment[] = viewRows.map((v) => {
        if (v.commitment_type !== "debt_paydown" || !v.id) return v;
        const extra = debtById.get(v.id);
        return extra
          ? {
              ...extra,
              ...v,
              debt_id: v.debt_id ?? extra.debt_id,
              debt_name: v.debt_name ?? extra.debt_name,
              interest_rate_annual:
                v.interest_rate_annual ?? extra.interest_rate_annual,
              balance_before: v.balance_before ?? extra.balance_before,
              balance_after: v.balance_after ?? extra.balance_after,
            }
          : v;
      });
      // Include any debt_paydown rows that exist only in the source table.
      const viewIds = new Set(viewRows.map((r) => r.id).filter(Boolean));
      debtRows.forEach((r) => {
        if (r.id && !viewIds.has(r.id)) merged.push(r);
      });
      return merged;
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
  const allCommitments = (activeCommitments ?? data.active_commitments ?? []).filter(
    isVisibleCommitment,
  );
  const committedMonthlyImprovement = allCommitments.reduce((sum, commitment) => {
    if (commitment.commitment_type !== "reduce_discretionary") return sum;
    return sum + (commitment.monthly_amount ?? 0);
  }, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-8">
      <SpendSummary />
      <VariableSpendingTracker />
      <SpendingInsights />
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
            {formatINR(committedMonthlyImprovement)}
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

      {/* Active Commitments */}
      {(() => {
        if (allCommitments.length === 0) {
          return (
            <section className="space-y-3">
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Active Commitments
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Actions you&apos;ve already committed to improve your finances.
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                <Lightbulb className="mx-auto h-5 w-5 text-muted-foreground/60" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  No active commitments yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Apply a Three Paths recommendation to start tracking commitments.
                </p>
                <Link
                  to="/paths"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  See Three Paths
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </section>
          );
        }

        const debtCommitments = allCommitments.filter(
          (c) => c.commitment_type === "debt_paydown",
        );
        const otherCommitments = allCommitments.filter(
          (c) => c.commitment_type !== "debt_paydown",
        );
        const debtMap = new Map((debtsList ?? []).map((d) => [d.id, d]));
        const resolveDebt = (commitment: ActiveCommitment) => {
          if (commitment.debt_id) {
            const byId = debtMap.get(commitment.debt_id);
            if (byId) return byId;
          }
          if (commitment.debt_name) {
            const name = commitment.debt_name.trim().toLowerCase();
            const byName = debtsList?.find(
              (d) => d.name?.trim().toLowerCase() === name,
            );
            if (byName) return byName;
          }
          if (commitment.balance_before != null) {
            const before = Math.round(Number(commitment.balance_before));
            const byBalance = debtsList?.find(
              (d) => Math.round(Number(d.balance ?? d.current_balance ?? -1)) === before,
            );
            if (byBalance) return byBalance;
          }
          return undefined;
        };

        const groups = new Map<string, {
          type: "reduce_discretionary" | "delay_goal";
          category?: string;
          goal_name?: string;
          goal_id?: string;
          monthly_amount: number;
          delay_weeks: number;
          count: number;
          latest_ends_at?: string;
        }>();
        for (const c of otherCommitments) {
          const isReduce = c.commitment_type === "reduce_discretionary";
          const key = isReduce
            ? `reduce|${c.category ?? ""}`
            : `delay|${(c as ActiveCommitment & { goal_id?: string }).goal_id ?? c.goal_name ?? ""}`;
          const existing = groups.get(key);
          if (existing) {
            existing.monthly_amount += c.monthly_amount ?? 0;
            existing.delay_weeks += c.delay_weeks ?? 0;
            existing.count += 1;
            if (c.ends_at && (!existing.latest_ends_at || c.ends_at > existing.latest_ends_at)) {
              existing.latest_ends_at = c.ends_at;
            }
          } else {
            groups.set(key, {
              type: isReduce ? "reduce_discretionary" : "delay_goal",
              category: c.category,
              goal_name: c.goal_name,
              monthly_amount: c.monthly_amount ?? 0,
              delay_weeks: c.delay_weeks ?? 0,
              count: 1,
              latest_ends_at: c.ends_at,
            });
          }
        }
        const grouped = Array.from(groups.values());
        const totalCount = allCommitments.length;
        return (
          <section className="space-y-3">
            <div>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Active Commitments
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {totalCount}
                </span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Actions you&apos;ve already committed to improve your finances.
              </p>
            </div>

            {/* Cash flow improvement banner */}
            {committedMonthlyImprovement > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5">
                <TrendingUp className="h-4 w-4 text-success shrink-0" />
                <p className="text-sm text-foreground">
                  Your active commitments are improving your monthly cash flow by{" "}
                  <span className="font-semibold text-success">
                    {formatINR(committedMonthlyImprovement)}/mo
                  </span>
                </p>
              </div>
            )}

            {/* Debt paydown cards (pending + confirmed) */}
            {debtCommitments.length > 0 && (
              <div className="space-y-3">
                {debtCommitments.map((c) => (
                  <DebtPaydownCard
                    key={c.id ?? `${c.debt_id}-${c.confirmed_at ?? "pending"}`}
                    commitment={c}
                    debt={resolveDebt(c)}
                    onConfirmed={() => refetch()}
                  />
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {grouped.map((g, i) => {
                const isReduce = g.type === "reduce_discretionary";
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 mt-0.5">
                      {isReduce ? (
                        <TrendingDown className="h-3.5 w-3.5 text-debit" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-warning" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {isReduce
                          ? `📉 Reduce ${g.category || "spending"}`
                          : `🎯 ${g.goal_name || "Goal"}`}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {isReduce ? (
                          <>
                            {g.count} active commitment{g.count === 1 ? "" : "s"}
                            {g.latest_ends_at && (
                              <>
                                <span className="mx-1">·</span>
                                Ends: {formatDate(g.latest_ends_at)}
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            Delayed by {g.delay_weeks} weeks
                            <span className="mx-1">·</span>
                            {g.count} active commitment{g.count === 1 ? "" : "s"}
                          </>
                        )}
                        <span className="mx-1">·</span>
                        <span className="text-primary/80">Active</span>
                      </p>
                    </div>

                    <span className="text-sm font-semibold tabular-nums text-success whitespace-nowrap shrink-0 mt-0.5">
                      {isReduce
                        ? `${formatINR(g.monthly_amount)}/mo`
                        : `${g.delay_weeks} weeks`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

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

type DebtRef = {
  id: string;
  name: string;
  interest_rate_annual: number | null;
  balance?: number | null;
  current_balance?: number | null;
} | undefined;

function fmtRupees(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  return `₹${v.toLocaleString("en-IN")}`;
}

function fmtRate(rate: number | null | undefined): string {
  if (rate == null || isNaN(Number(rate))) return "";
  const r = Number(rate);
  return ` @ ${r % 1 === 0 ? r.toFixed(0) : r.toFixed(2)}% p.a.`;
}

function fmtDMY(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DebtPaydownCard({
  commitment,
  debt,
  onConfirmed,
}: {
  commitment: ActiveCommitment;
  debt: DebtRef;
  onConfirmed: () => void;
}) {
  const qc = useQueryClient();
  const name = debt?.name ?? commitment.debt_name ?? "this debt";
  const rate = debt?.interest_rate_annual ?? commitment.interest_rate_annual ?? null;
  const amount = commitment.paydown_amount ?? 0;
  const before =
    commitment.balance_before ??
    debt?.current_balance ??
    debt?.balance ??
    0;
  const after = commitment.balance_after ?? Math.max(0, before - amount);
  const isConfirmed = commitment.status === "confirmed";

  const confirm = useMutation({
    mutationFn: async () => {
      if (!commitment.id) throw new Error("Missing commitment id");
      const { data, error } = await supabase.functions.invoke(
        "confirm-debt-paydown",
        { body: { commitment_id: commitment.id } },
      );
      if (error) {
        console.error("confirm-debt-paydown failed:", error);
        throw error;
      }
      return data;
    },
    onSuccess: async () => {
      toast("Payment confirmed — debt balance updated.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["debts"] }),
        qc.invalidateQueries({ queryKey: ["compute-plan"] }),
        qc.invalidateQueries({ queryKey: ["active-commitments"] }),
      ]);
      onConfirmed();
    },
    onError: (err) => {
      toast.error((err as Error).message || "Couldn't confirm payment");
    },
  });

  if (isConfirmed) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground">
                {name} — payment confirmed
              </p>
              <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                Done
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmtRupees(amount)} paid toward {name}
              {commitment.confirmed_at ? ` on ${fmtDMY(commitment.confirmed_at)}` : ""}.
              <br />
              Balance {fmtRupees(before)} → {fmtRupees(after)}{fmtRate(rate)}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/60">
          <Banknote className="h-4 w-4 text-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-foreground">
            Pay down {name}
          </p>
          <p className="text-sm text-muted-foreground">
            {fmtRupees(amount)} earmarked toward {name}.
            <br />
            Current balance {fmtRupees(before)}{fmtRate(rate)}.
            <br />
            Mark as paid once you&apos;ve made the payment to update your balance.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => confirm.mutate()}
              disabled={confirm.isPending || !commitment.id}
              className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-success-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              {confirm.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Confirming…
                </>
              ) : (
                "Mark as paid"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
