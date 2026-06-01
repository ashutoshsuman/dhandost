// Helpers for tracking whether a recovery plan has been applied this month.
// Mirrors the per-transaction "plan applied" persistence pattern.

const FLOW_FLAG_KEY = "recovery_plan_flow_active";

function currentMonthKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `recovery_plan_active_${y}_${m}`;
}

export function isRecoveryPlanActiveThisMonth(): boolean {
  try {
    return localStorage.getItem(currentMonthKey()) === "true";
  } catch {
    return false;
  }
}

export function markRecoveryPlanActiveThisMonth() {
  try {
    localStorage.setItem(currentMonthKey(), "true");
  } catch {
    // ignore
  }
}

/**
 * Mark the next three-paths apply as originating from the recovery plan flow,
 * so paths.tsx knows to set the monthly lock when the user picks a path.
 */
export function beginRecoveryPlanFlow() {
  try {
    sessionStorage.setItem(FLOW_FLAG_KEY, "true");
  } catch {
    // ignore
  }
}

export function consumeRecoveryPlanFlow(): boolean {
  try {
    const v = sessionStorage.getItem(FLOW_FLAG_KEY);
    if (v === "true") {
      sessionStorage.removeItem(FLOW_FLAG_KEY);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
