export const THREE_PATHS_URL =
  "https://ibjsdafxjggjyamkdjeh.supabase.co/functions/v1/clever-task";
export const PUBLISHABLE_KEY = "sb_publishable_ztTyEdZPNNfk5PjttJimDg_-g3fmC0D";

export type AllocationStep = {
  amount: number;
  target: string;
  action: string;
};

export type GoalImpact = {
  goal_id?: string;
  goal_name: string;
  delta_text: string; // e.g. "5 weeks ahead"
  new_status: "on_track" | "at_risk" | "behind" | string;
};

export type DiscretionaryImpact = {
  amount_per_month: number;
  months: number;
} | null;

export type PathOption = {
  label: string;
  description: string;
  allocation: AllocationStep[];
  goal_impacts: GoalImpact[];
  discretionary_impact?: DiscretionaryImpact;
};

export type ThreePathsResponse = {
  paths: PathOption[];
  trigger_type: string;
  trigger_amount: number;
  trigger_description: string | null;
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
  trigger_type: "surprise_income" | "surprise_expense";
  trigger_amount: number;
  trigger_description: string | null;
}): Promise<ThreePathsResponse> {
  const res = await fetch(THREE_PATHS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const data = await res.json();
  // Normalise to expected shape; fall back to raw if function already returns it.
  return {
    paths: data.paths ?? [],
    trigger_type: input.trigger_type,
    trigger_amount: input.trigger_amount,
    trigger_description: input.trigger_description,
    ...data,
  };
}
