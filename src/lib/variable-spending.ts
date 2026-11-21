import type { QueryClient } from "@tanstack/react-query";
import { invokeFn } from "@/lib/invokeFn";
import { istMonthBounds } from "@/lib/commitment-progress";
import { supabase } from "@/lib/supabase";

export type SpendingStatus = "under" | "within" | "over";

export type VariableCategoryRow = {
  category: string;
  actual: number;
  baseline: number;
  variance: number;
  variance_percent?: number;
  status?: SpendingStatus;
};

export type VariableInsightsResponse = {
  total_baseline: number;
  total_actual: number;
  total_variance: number;
  top_risk_category?: string | null;
  forecast_total_month_end_spend?: number;
  forecast_total_variance?: number;
  forecast_skewed_by_one_offs?: boolean;
  implausible_overspend?: boolean;
  categories: VariableCategoryRow[];
};

export type PathSelectionRow = {
  trigger_type?: string | null;
  path_chosen?: string | null;
  trigger_event?: { trigger_transaction_id?: unknown } | null;
};

export type VariableTransactionRow = {
  id: string;
  category: string | null;
  amount: number | string;
  direction: string;
  occurred_at: string;
};

/** Recompute baselines without delaying or invalidating the user's completed action. */
export function rederiveVariableBaselines(qc: QueryClient): void {
  void invokeFn("derive-variable-expenses", {})
    .then(() => {
      void qc.invalidateQueries({ queryKey: ["variable-spending-insights"] });
      void qc.invalidateQueries({ queryKey: ["compute-plan"] });
    })
    .catch((error) => console.error("derive-variable-expenses failed", error));
}

export function handledSurpriseTransactionIds(rows: PathSelectionRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.trigger_type !== "surprise_expense" || row.path_chosen == null) continue;
    const id = row.trigger_event?.trigger_transaction_id;
    if (typeof id === "string" && id) ids.add(id);
  }
  return ids;
}

/** Remove plan-handled surprise debits from the current IST month's actual spend. */
export function excludeHandledSurpriseSpend(
  insights: VariableInsightsResponse,
  selections: PathSelectionRow[],
  transactions: VariableTransactionRow[],
  now = new Date(),
): VariableInsightsResponse {
  const handledIds = handledSurpriseTransactionIds(selections);
  if (handledIds.size === 0) return insights;

  const { start, end } = istMonthBounds(now);
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  const excludedByCategory = new Map<string, number>();

  for (const row of transactions) {
    if (!handledIds.has(row.id) || row.direction !== "debit" || !row.category) continue;
    const timestamp = Date.parse(row.occurred_at);
    if (!Number.isFinite(timestamp) || timestamp < startTime || timestamp >= endTime) continue;
    const amount = Math.abs(Number(row.amount) || 0);
    excludedByCategory.set(row.category, (excludedByCategory.get(row.category) ?? 0) + amount);
  }

  let deductedTotal = 0;
  const categories = insights.categories.map((category) => {
    const excluded = excludedByCategory.get(category.category) ?? 0;
    if (excluded === 0) return category;

    const originalActual = Number(category.actual) || 0;
    const deducted = Math.min(Math.max(0, originalActual), excluded);
    const actual = originalActual - deducted;
    const baseline = Number(category.baseline) || 0;
    const variance = actual - baseline;
    deductedTotal += deducted;

    const next = { ...category, actual, variance };
    // The API status describes its unadjusted actual, so let the UI recompute it.
    delete next.status;
    if (next.variance_percent !== undefined) {
      if (baseline === 0) delete next.variance_percent;
      else next.variance_percent = (variance / baseline) * 100;
    }
    return next;
  });

  if (deductedTotal === 0) return insights;

  const totalActual = Math.max(0, (Number(insights.total_actual) || 0) - deductedTotal);
  const topRisk = categories.reduce<VariableCategoryRow | null>((highest, category) => {
    if (category.variance <= 0) return highest;
    return !highest || category.variance > highest.variance ? category : highest;
  }, null);

  return {
    ...insights,
    categories,
    total_actual: totalActual,
    total_variance: totalActual - (Number(insights.total_baseline) || 0),
    top_risk_category: topRisk?.category ?? null,
  };
}

export async function fetchVariableSpendingInsights(): Promise<VariableInsightsResponse> {
  const [insights, selectionResult] = await Promise.all([
    invokeFn<VariableInsightsResponse>("variable-spending-insights"),
    supabase
      .from("path_selections")
      .select("trigger_type,path_chosen,trigger_event")
      .eq("trigger_type", "surprise_expense")
      .not("path_chosen", "is", null),
  ]);
  if (selectionResult.error) throw selectionResult.error;

  const selections = (selectionResult.data ?? []) as PathSelectionRow[];
  const handledIds = handledSurpriseTransactionIds(selections);
  if (handledIds.size === 0) return insights;

  const { data, error } = await supabase
    .from("transactions")
    .select("id,category,amount,direction,occurred_at")
    .in("id", [...handledIds]);
  if (error) throw error;

  return excludeHandledSurpriseSpend(
    insights,
    selections,
    (data ?? []) as VariableTransactionRow[],
  );
}
