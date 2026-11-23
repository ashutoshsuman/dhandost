import { formatINRWhole } from "./format";

export type DiscretionaryCutAllocation = {
  target: string;
  amount?: number;
  monthly_amount?: number;
  duration_months?: number;
};

export type DiscretionaryCutCopy = {
  text: string;
  invalidFinalMonth: boolean;
};

function regularCutText(
  allocation: DiscretionaryCutAllocation,
  monthly: number,
  months: number,
  total: number,
): string {
  return `Reduce ${allocation.target} by ${formatINRWhole(monthly)}/month for ${months} months (${formatINRWhole(total)} total)`;
}

export function describeDiscretionaryCut(
  allocation: DiscretionaryCutAllocation,
): DiscretionaryCutCopy {
  const monthly = allocation.monthly_amount ?? 0;
  const months = allocation.duration_months ?? 0;
  const total = allocation.amount ?? 0;

  if (!monthly || !months) {
    return {
      text: `Reduce ${allocation.target} by ${formatINRWhole(total)}`,
      invalidFinalMonth: false,
    };
  }

  if (months === 1) {
    return {
      text: `Reduce ${allocation.target} by ${formatINRWhole(total)} this month`,
      invalidFinalMonth: false,
    };
  }

  const regularText = regularCutText(allocation, monthly, months, total);
  if (total === monthly * months) {
    return { text: regularText, invalidFinalMonth: false };
  }

  const last = total - monthly * (months - 1);
  if (last > 0 && last !== monthly) {
    const earlierMonths = months - 1;
    return {
      text: `Reduce ${allocation.target} by ${formatINRWhole(monthly)}/month for ${earlierMonths} ${earlierMonths === 1 ? "month" : "months"}, then ${formatINRWhole(last)} in the final month (${formatINRWhole(total)} total)`,
      invalidFinalMonth: false,
    };
  }

  return { text: regularText, invalidFinalMonth: last <= 0 };
}

export function sumMonthlyDiscretionaryCuts(
  allocations: Array<{
    action: string;
    monthly_amount?: number;
  }>,
): number {
  return allocations.reduce(
    (sum, allocation) =>
      allocation.action === "reduce_discretionary"
        ? sum + (allocation.monthly_amount ?? 0)
        : sum,
    0,
  );
}
