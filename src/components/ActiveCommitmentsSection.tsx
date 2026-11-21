import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Clock, Loader2, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui-primitives";
import { supabase } from "@/lib/supabase";
import { formatINR, formatDate } from "@/lib/format";
import { withTimeout, TIMEOUT_FAST } from "@/lib/withTimeout";
import { cancellationUpdate, categoryDebitSpend, istMonthBounds, reductionProgress, splitCommitments } from "@/lib/commitment-progress";

export type ActiveCommitment = {
  id?: string;
  commitment_type?: "reduce_discretionary" | "delay_goal" | "debt_paydown" | "allocate_savings";
  status?: string;
  goal_name?: string;
  goal_id?: string;
  category?: string;
  monthly_amount?: number;
  duration_months?: number;
  delay_weeks?: number;
  ends_at?: string;
  debt_id?: string;
  debt_name?: string;
  paydown_amount?: number;
  balance_before?: number;
  balance_after?: number;
  confirmed_at?: string;
  interest_rate_annual?: number;
  savings_label?: string;
};

type SpendRow = { category: string | null; amount: number | string; direction: string; occurred_at: string };

export default function ActiveCommitmentsSection({ rows }: { rows: ActiveCommitment[] }) {
  const [pastOpen, setPastOpen] = useState(false);
  const qc = useQueryClient();
  const { ongoing, done, past } = splitCommitments(rows);
  const bounds = istMonthBounds();
  const progressQuery = useQuery({
    queryKey: ["variable-spending-insights", "commitment-progress", bounds.start],
    enabled: ongoing.some((row) => row.commitment_type === "reduce_discretionary"),
    queryFn: async () => {
      const baselineRequest = withTimeout(supabase.from("variable_expenses")
        .select("category,monthly_baseline"), TIMEOUT_FAST);
      const spendRequest = (async () => {
        const rows: SpendRow[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await withTimeout(supabase.from("transactions")
            .select("category,amount,direction,occurred_at")
            .eq("direction", "debit").gte("occurred_at", bounds.start).lt("occurred_at", bounds.end)
            .order("id").range(offset, offset + 999), TIMEOUT_FAST);
          if (error) throw error;
          const page = (data ?? []) as SpendRow[];
          rows.push(...page);
          if (page.length < 1000) return rows;
        }
      })();
      const [baselineResult, spend] = await Promise.all([baselineRequest, spendRequest]);
      if (baselineResult.error) throw baselineResult.error;
      const baselines = new Map<string, number>();
      for (const row of baselineResult.data ?? []) {
        if (row.monthly_baseline != null) baselines.set(row.category, Number(row.monthly_baseline));
      }
      return { baselines, spend: categoryDebitSpend(spend) };
    },
    retry: 1,
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await withTimeout(supabase.from("active_commitments")
        .update(cancellationUpdate).eq("id", id).eq("status", "active")
        .eq("commitment_type", "reduce_discretionary").select("id"), TIMEOUT_FAST);
      if (error) throw error;
      if (!data?.length) throw new Error("Commitment was not updated");
    },
    onSuccess: async () => {
      toast.success("Commitment cancelled");
      await Promise.all(["active-commitments", "dm-commitments", "compute-plan", "variable-spending-insights"]
        .map((key) => qc.invalidateQueries({ queryKey: [key] })));
    },
    onError: () => toast.error("Couldn't cancel commitment. Please try again."),
  });
  const totalCut = ongoing.reduce((total, row) => total +
    (row.commitment_type === "reduce_discretionary" ? row.monthly_amount ?? 0 : 0), 0);

  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        Active Commitments
        <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{ongoing.length}</span>
      </h2>
      {totalCut > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5">
          <TrendingDown className="h-4 w-4 text-success shrink-0" />
          <p className="text-sm text-foreground">You&apos;ve committed to spending <span className="font-semibold text-success">{formatINR(totalCut)}/month</span> less</p>
        </div>
      )}
      {ongoing.length === 0 && done.length === 0 && (
        <p className="text-sm text-muted-foreground">No active commitments. Choose a plan path to add one.</p>
      )}
      <div className="space-y-1.5">
        {ongoing.map((row, index) => {
          const isReduce = row.commitment_type === "reduce_discretionary";
          const category = row.category || "spending";
          const progress = isReduce && progressQuery.data ? reductionProgress(
            progressQuery.data.baselines.get(category), row.monthly_amount ?? 0,
            progressQuery.data.spend.get(category) ?? 0,
          ) : null;
          return (
            <div key={row.id ?? index} className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 mt-0.5">
                {isReduce ? <TrendingDown className="h-3.5 w-3.5 text-debit" /> : <Clock className="h-3.5 w-3.5 text-warning" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{isReduce ? `Reduce ${category}` : row.goal_name || "Goal"}</p>
                  <span className="text-sm font-semibold tabular-nums text-success">{isReduce ? `${formatINR(row.monthly_amount ?? 0)}/mo` : `${row.delay_weeks ?? 0} weeks`}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isReduce ? "1 active commitment" : `Delayed by ${row.delay_weeks ?? 0} weeks · 1 active commitment`}
                  {row.ends_at && <> · Ends: {formatDate(row.ends_at)}</>} · <span className="text-primary/80">Active</span>
                </p>
                {progress && (progress.review ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">Your {category} spending is now {formatINR(progress.baseline)}/month — below this {formatINR(row.monthly_amount ?? 0)} cut. Review this commitment.</p>
                    <Button variant="destructive" className="px-0 py-1 text-xs" disabled={!row.id || cancel.isPending}
                      onClick={() => { if (row.id) cancel.mutate(row.id); }}>
                      {cancel.isPending && cancel.variables === row.id ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Cancelling…</> : "Cancel commitment"}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs text-muted-foreground tabular-nums">This month: {formatINR(progress.spent)} of {formatINR(progress.target)}</p>
                    <div role="progressbar" aria-label={`${category} spending`} aria-valuemin={0} aria-valuemax={progress.target} aria-valuenow={Math.min(progress.spent, progress.target)}
                      aria-valuetext={`${formatINR(progress.spent)} of ${formatINR(progress.target)}`} className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${progress.over ? "bg-debit/60" : "bg-success"}`} style={{ width: `${progress.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {progressQuery.error && <div className="flex items-center gap-2 text-xs text-muted-foreground">Couldn&apos;t load spending progress.<Button variant="ghost" className="py-1 text-xs" onClick={() => progressQuery.refetch()}>Retry</Button></div>}
      {done.length > 0 && <div className="space-y-3"><h3 className="text-xs font-medium text-muted-foreground">Done this month</h3>{done.map((row, i) => <DoneAction key={row.id ?? i} row={row} />)}</div>}
      {past.length > 0 && (
        <div className="space-y-3">
          <Button variant="ghost" className="px-0 text-xs text-muted-foreground" aria-expanded={pastOpen} onClick={() => setPastOpen(!pastOpen)}>
            <ChevronDown className={`mr-1.5 h-3.5 w-3.5 transition-transform ${pastOpen ? "rotate-180" : ""}`} />Past actions ({past.length})
          </Button>
          {pastOpen && past.map((row, i) => <DoneAction key={row.id ?? i} row={row} />)}
        </div>
      )}
    </section>
  );
}

function DoneAction({ row }: { row: ActiveCommitment }) {
  const isDebt = row.commitment_type === "debt_paydown";
  const name = isDebt ? row.debt_name || "this debt" : row.savings_label || "savings";
  const date = row.confirmed_at ? new Date(row.confirmed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
  const rate = row.interest_rate_annual;
  return (
    <div className="rounded-lg border border-success/30 bg-success/5 p-4 flex items-start gap-3">
      <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-1" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{name} — {isDebt ? "payment confirmed" : "done"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatINR(row.paydown_amount ?? 0)} {isDebt ? `paid toward ${name}` : `set aside to your ${name}`}{date ? ` on ${date}` : ""}.
          {isDebt && <><br />Balance {formatINR(row.balance_before ?? 0)} → {formatINR(row.balance_after ?? Math.max(0, (row.balance_before ?? 0) - (row.paydown_amount ?? 0)))}{rate != null ? ` @ ${rate}% p.a.` : "."}</>}
          {!isDebt && <><br />This is now parked out of your spendable headroom.</>}
        </p>
      </div>
    </div>
  );
}