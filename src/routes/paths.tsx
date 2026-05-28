import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui-primitives";

import { supabase } from "@/lib/supabase";
import {
  applyPath,
  markPlanAppliedForTx,
  readPathsResponse,
  type AllocationStep,
  type PathOption,
  type ThreePathsResponse,
} from "@/lib/three-paths";

function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function renderAllocation(a: AllocationStep): string {
  switch (a.action) {
    case "reduce_discretionary": {
      const monthly = a.monthly_amount ?? 0;
      const months = a.duration_months ?? 0;
      const total = a.amount ?? 0;
      if (!monthly || !months) {
        return `→ Reduce ${a.target} by ${formatINR(total)}`;
      }
      return `→ Reduce ${a.target} by ${formatINR(monthly)}/month for ${months} months (${formatINR(total)} total)`;
    }
    case "delay_goal":
      return `→ Delay ${a.target}`;
    case "keep_flexible":
      return `→ ${formatINR(a.amount)} kept as flexible buffer`;
    case "pay_down_debt":
      return `→ ${formatINR(a.amount)} toward ${a.target} (debt)`;
    case "topup_cushion":
      return `→ ${formatINR(a.amount)} into ${a.target}`;
    case "fund_goal":
    default:
      return `→ ${formatINR(a.amount)} into ${a.target}`;
  }
}


export const Route = createFileRoute("/paths")({
  component: () => (
    <Layout>
      <PathsPage />
    </Layout>
  ),
});

const statusStyles: Record<string, string> = {
  on_track: "bg-emerald-50 text-emerald-700 border-emerald-200",
  at_risk: "bg-amber-50 text-amber-700 border-amber-200",
  behind: "bg-red-50 text-red-700 border-red-200",
};
const statusLabel: Record<string, string> = {
  on_track: "On track",
  at_risk: "At risk",
  behind: "Behind",
};

type Goal = {
  id: string;
  name: string;
  current_amount: number | null;
  target_date: string | null;
};
type Debt = { id: string; name: string; current_balance: number };

function safeNum(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
}

function matchGoal(goals: Goal[], target: string): Goal | undefined {
  const t = (target || "").toLowerCase();
  return (
    goals.find((g) => g.name?.toLowerCase() === t) ||
    goals.find((g) => g.name?.toLowerCase().includes(t)) ||
    goals.find((g) => t.includes(g.name?.toLowerCase() ?? ""))
  );
}
function matchDebt(debts: Debt[], target: string): Debt | undefined {
  const t = (target || "").toLowerCase();
  return (
    debts.find((d) => d.name?.toLowerCase() === t) ||
    debts.find((d) => d.name?.toLowerCase().includes(t)) ||
    debts.find((d) => t.includes(d.name?.toLowerCase() ?? ""))
  );
}

async function applyAllocations(steps: AllocationStep[]) {
  if (!steps?.length) return;

  const [{ data: goalsRaw }, { data: debtsRaw }] = await Promise.all([
    supabase.from("goals").select("id,name,current_amount,target_date"),
    supabase.from("debts").select("id,name,current_balance"),
  ]);
  const goals = (goalsRaw ?? []) as Goal[];
  const debts = (debtsRaw ?? []) as Debt[];

  // Aggregate per-target deltas to keep writes atomic-ish and avoid duplicates.
  const goalAdds = new Map<string, number>();
  const debtPays = new Map<string, number>();
  const goalDelayMonths = new Map<string, number>();

  for (const step of steps) {
    const amount = safeNum(step.amount);
    const action = step.action;

    if (action === "keep_flexible") continue;

    if (action === "fund_goal" || action === "topup_cushion") {
      if (amount <= 0) continue;
      let g = matchGoal(goals, step.target);
      // Cushion fallback: if topup_cushion target doesn't exist, skip silently
      // (do not invent a phantom goal). Backend should redirect, but guard here too.
      if (!g) continue;
      goalAdds.set(g.id, (goalAdds.get(g.id) ?? 0) + amount);
    } else if (action === "pay_down_debt") {
      if (amount <= 0) continue;
      const d = matchDebt(debts, step.target);
      if (!d) continue;
      debtPays.set(d.id, (debtPays.get(d.id) ?? 0) + amount);
    } else if (action === "delay_goal") {
      const g = matchGoal(goals, step.target);
      if (!g) continue;
      // amount field here is interpreted as months to delay (backend convention).
      const months = Math.max(1, Math.round(Number(step.amount) || 1));
      goalDelayMonths.set(g.id, (goalDelayMonths.get(g.id) ?? 0) + months);
    }
    // reduce_discretionary: nothing to persist on goals/debts.
  }

  // Apply goal balance updates
  for (const [id, delta] of goalAdds) {
    const g = goals.find((x) => x.id === id)!;
    const next = Math.max(0, Number(g.current_amount ?? 0) + delta);
    const { error } = await supabase
      .from("goals")
      .update({ current_amount: next })
      .eq("id", id);
    if (error) throw error;
  }

  // Apply debt paydowns
  for (const [id, delta] of debtPays) {
    const d = debts.find((x) => x.id === id)!;
    const next = Math.max(0, Number(d.current_balance ?? 0) - delta);
    const { error } = await supabase
      .from("debts")
      .update({ current_balance: next })
      .eq("id", id);
    if (error) throw error;
  }

  // Push target dates forward for delay_goal steps
  for (const [id, months] of goalDelayMonths) {
    const g = goals.find((x) => x.id === id)!;
    if (!g.target_date) continue;
    const d = new Date(g.target_date);
    if (isNaN(d.getTime())) continue;
    d.setMonth(d.getMonth() + months);
    const next = d.toISOString().slice(0, 10);
    const { error } = await supabase
      .from("goals")
      .update({ target_date: next })
      .eq("id", id);
    if (error) throw error;
  }
}

function PathsPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [data, setData] = useState<ThreePathsResponse | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const d = readPathsResponse();
    if (!d) navigate({ to: "/transactions" });
    else setData(d);
  }, [navigate]);
  const choose = async (path: PathOption | null, index = -1) => {

    if (saving || applied) return; // guard against double-submit
    const label = path?.label ?? null;
    setSaving(label ?? "__none__");
    try {
      if (path) {
        if (!data?.path_selection_id) {
          throw new Error("Missing plan reference — please regenerate the plan.");
        }
        // Grab the user's access token if signed in; falls back to publishable key.
        let accessToken: string | null = null;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          accessToken = sessionData.session?.access_token ?? null;
        } catch {
          accessToken = null;
        }
        await applyPath({
          path_selection_id: data.path_selection_id,
          chosen_path_label: path.label,
          chosen_index: index,
          priority_value: path.priority_value ?? null,
          access_token: accessToken,
        });

        // Hide "Help me with a plan" for this transaction going forward.
        if (data.trigger_transaction_id) {
          markPlanAppliedForTx(data.trigger_transaction_id);
        }
      } else {
        const { error } = await supabase.from("path_selections").insert({
          path_chosen: label,
        });
        if (error) console.error("path_selections insert failed:", error);
      }
      setApplied(true);
      if (path) {
        toast(
          `New Plan Applied '${path.label}' — your goals have been updated accordingly.`,
        );
      } else {
        toast("Plan unchanged.");
      }
      try {
        await router.invalidate();
      } catch {}
      navigate({ to: "/" });
    } catch (err) {
      console.error("Failed to apply path:", err);
      toast.error("Couldn't apply this plan — try again");
      setSaving(null);
    }
  };


  if (!data) return null;

  const isIncome = data.trigger_type === "surprise_income";
  const heading = isIncome
    ? `Three ways to use this ${formatINR(data.trigger_amount)}`
    : `Three ways to absorb this ${formatINR(data.trigger_amount)}`;
  const subLabel = isIncome ? "Surprise income" : "Surprise expense";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {subLabel}
          {data.trigger_description ? ` — ${data.trigger_description}` : ""}
        </p>
      </div>

      {applied && (
        <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          Path applied.
        </div>
      )}

      <div className="space-y-4">
        {data.paths.map((p, i) => (

          <PathCard
            key={i}
            path={p}
            saving={saving === p.label}
            disabled={saving !== null || applied}
            applied={applied}
            onChoose={() => choose(p, i)}

          />
        ))}

      </div>

      <div className="rounded-lg border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        This is general guidance, not investment advice. Specific products are intentionally not named.
      </div>

      <div className="flex justify-center">
        <Button
          variant="outline"
          disabled={saving !== null || applied}
          onClick={() => choose(null)}
        >
          {saving === "__none__" ? "Saving…" : "None of these — keep my plan unchanged"}
        </Button>
      </div>
    </div>
  );
}

function PathCard({
  path, saving, disabled, applied, onChoose,
}: { path: PathOption; saving: boolean; disabled: boolean; applied: boolean; onChoose: () => void }) {

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{path.label}</h2>
        <p className="text-sm text-muted-foreground mt-1">{path.description}</p>
      </div>

      {path.allocation?.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Allocation</div>
          <ul className="space-y-1 text-sm">
            {path.allocation.map((a, i) => (
              <li key={i} className="tabular-nums">
                {renderAllocation(a)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {path.goal_impacts?.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Goal impact</div>
          <ul className="space-y-1.5 text-sm">
            {path.goal_impacts.map((g, i) => (
              <li key={i} className="flex items-center gap-2 flex-wrap">
                <span>{g.goal_name}: {g.delta_text}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs border ${statusStyles[g.new_status] ?? "bg-secondary text-muted-foreground border-border"}`}
                >
                  {statusLabel[g.new_status] ?? g.new_status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {path.discretionary_impact &&
        Number.isFinite(path.discretionary_impact.amount_per_month) &&
        path.discretionary_impact.amount_per_month !== 0 && (
          <p className="text-sm text-muted-foreground">
            Discretionary spending: {formatINR(Math.abs(path.discretionary_impact.amount_per_month))} less per month
            {path.discretionary_impact.months > 1 ? ` for ${path.discretionary_impact.months} months` : null}
          </p>
        )}

      <div className="pt-2">
        <Button onClick={onChoose} disabled={disabled} className="w-full sm:w-auto">
          {applied ? "Path applied" : saving ? "Applying the selecting plan…" : "Choose this path"}
        </Button>
      </div>

    </div>
  );
}
