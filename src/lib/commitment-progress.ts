export type CommitmentState = {
  commitment_type?: string;
  status?: string;
  confirmed_at?: string;
};

const IST_OFFSET = 330 * 60 * 1000;

export function istMonthBounds(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - IST_OFFSET).toISOString(),
    end: new Date(Date.UTC(year, month + 1, 1) - IST_OFFSET).toISOString(),
  };
}

export function splitCommitments<T extends CommitmentState>(rows: T[], now = new Date()) {
  const { start, end } = istMonthBounds(now);
  const ongoing = rows.filter((row) => row.status === "active" &&
    (row.commitment_type === "reduce_discretionary" || row.commitment_type === "delay_goal"));
  const pending = rows.filter((row) => row.status === "pending" &&
    (row.commitment_type === "debt_paydown" || row.commitment_type === "allocate_savings"));
  const actions = rows.filter((row) =>
    (row.status === "confirmed" || row.status === "completed") &&
    (row.commitment_type === "debt_paydown" || row.commitment_type === "allocate_savings"));
  const isThisMonth = (row: T) => {
    const confirmed = row.confirmed_at ? new Date(row.confirmed_at).getTime() : NaN;
    return confirmed >= Date.parse(start) && confirmed < Date.parse(end);
  };
  return { ongoing, pending, badgeCount: ongoing.length + pending.length,
    done: actions.filter(isThisMonth), past: actions.filter((row) => !isThisMonth(row)) };
}

export function reductionProgress(baseline: number | undefined, cut: number, spent: number) {
  if (baseline == null || !Number.isFinite(baseline)) return null;
  const target = baseline - cut;
  return { baseline, target, spent, review: target <= 0, over: spent > target,
    percent: target > 0 ? Math.min(100, Math.max(0, spent / target * 100)) : 0 };
}

export function categoryDebitSpend(
  rows: { category: string | null; direction: string; amount: number | string; occurred_at: string }[],
  now = new Date(),
) {
  const { start, end } = istMonthBounds(now);
  const totals = new Map<string, number>();
  for (const row of rows) {
    const timestamp = Date.parse(row.occurred_at);
    if (!row.category || row.direction !== "debit" || timestamp < Date.parse(start) ||
      timestamp >= Date.parse(end) || !Number.isFinite(timestamp)) continue;
    totals.set(row.category, (totals.get(row.category) ?? 0) + Math.abs(Number(row.amount) || 0));
  }
  return totals;
}

export const cancellationUpdate = { status: "cancelled" } as const;