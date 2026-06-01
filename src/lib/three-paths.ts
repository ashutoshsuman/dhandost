import { invokeFn } from "@/lib/invokeFn";

export type AllocationStep = {
  amount: number;
  target: string;
  action: string;
  monthly_amount?: number;
  duration_months?: number;
};

export type GoalImpact = {
  goal_id?: string;
  goal_name: string;
  delta_text: string; // e.g. "5 weeks ahead"
  new_status: "on_track" | "at_risk" | "behind" | string;
};

export type DiscretionaryImpact = number | null;

export type PathOption = {
  label: string;
  description: string;
  priority_value?: string;
  allocation: AllocationStep[];
  goal_impacts: GoalImpact[];
  discretionary_impact?: DiscretionaryImpact;
};


export type ThreePathsResponse = {
  paths: PathOption[];
  trigger_type: string;
  trigger_amount: number;
  trigger_description: string | null;
  path_selection_id?: string | null;
  trigger_transaction_id?: string | null;
};

const STORAGE_KEY = "three-paths-response";

export function storePathsResponse(data: ThreePathsResponse) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function readPathsResponse(): ThreePathsResponse | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ThreePathsResponse;
  } catch {
    return null;
  }
}

export async function fetchThreePaths(input: {
  trigger_type: "surprise_income" | "surprise_expense" | "drift_correction";
  trigger_amount: number;
  trigger_description: string | null;
  trigger_transaction_id?: string | null;
}): Promise<ThreePathsResponse> {
  const data = await invokeFn<Partial<ThreePathsResponse> & Record<string, unknown>>(
    "clever-task",
    input,
  );
  return {
    paths: (data.paths as PathOption[]) ?? [],
    trigger_type: input.trigger_type,
    trigger_amount: input.trigger_amount,
    trigger_description: input.trigger_description,
    trigger_transaction_id: input.trigger_transaction_id ?? null,
    ...data,
  } as ThreePathsResponse;
}

/**
 * Apply the chosen path via the apply-path Edge Function.
 */
export async function applyPath(input: {
  path_selection_id: string;
  chosen_path_label: string;
  chosen_index: number;
  priority_value?: string | null;
}): Promise<unknown> {
  return invokeFn("apply-path", {
    path_selection_id: input.path_selection_id,
    chosen_path_label: input.chosen_path_label,
    chosen_index: input.chosen_index,
    ...(input.priority_value ? { priority_value: input.priority_value } : {}),
  });
}


/**
 * Track which transactions already have an applied plan so the
 * "Help me with a plan" action can be hidden for them.
 */
const APPLIED_TX_KEY = "applied-plan-tx-ids";

export function getAppliedPlanTxIds(): string[] {
  try {
    const raw = localStorage.getItem(APPLIED_TX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

export function markPlanAppliedForTx(txId: string) {
  if (!txId) return;
  const ids = new Set(getAppliedPlanTxIds());
  ids.add(txId);
  try {
    localStorage.setItem(APPLIED_TX_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}
