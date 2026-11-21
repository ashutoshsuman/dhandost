import { formatDate, formatINR } from "./format";

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value: string | null | undefined): Date | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export function formatGoalDate(value: string): string {
  const date = parseDateOnly(value);
  if (!date) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getDate()).padStart(2, "0")} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function getTomorrow(today = new Date()): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
}

export function isGoalTargetPassed(
  targetDate: string | null | undefined,
  isCompleted: boolean,
  today = new Date(),
): boolean {
  if (isCompleted) return false;
  const target = parseDateOnly(targetDate);
  if (!target) return false;
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return target.getTime() < todayOnly.getTime();
}

export function formatDelayGoalDuration(
  durationDays?: number,
  durationMonths?: number,
): string | null {
  if (durationDays != null) {
    if (durationDays < 60) {
      return `${durationDays} ${durationDays === 1 ? "day" : "days"}`;
    }
    const months = Math.round(durationDays / 30);
    return `about ${months} ${months === 1 ? "month" : "months"}`;
  }

  if (!durationMonths) return null;
  return `${durationMonths} ${durationMonths === 1 ? "month" : "months"}`;
}

export type GoalRevision = {
  original_target_date?: string | null;
  target_revised_at?: string | null;
};

export function isGoalRevised(revision: GoalRevision): boolean {
  return parseDateOnly(revision.original_target_date) !== undefined;
}

/** "Revised · originally 09 Sep 2026", or null when the goal was never revised. */
export function revisedGoalNote(revision: GoalRevision): string | null {
  if (!isGoalRevised(revision)) return null;
  return `Revised · originally ${formatGoalDate(revision.original_target_date as string)}`;
}

/** Explanation shown when a goal card is expanded. */
export function goalSavingsExplanation(
  remaining: number,
  targetDate: string,
  revision: GoalRevision,
): string {
  if (!isGoalRevised(revision)) {
    return `Required monthly savings is derived from the gap between ${formatINR(remaining)} remaining and the months until ${formatDate(targetDate)}. Status reflects whether your current pace meets that schedule.`;
  }
  const measuredFrom = parseDateOnly(revision.target_revised_at)
    ? `, measured from when you set this date (${formatGoalDate(revision.target_revised_at as string)})`
    : "";
  return `Required monthly savings is the ${formatINR(remaining)} still needed spread over the time until ${formatGoalDate(targetDate)}. Status compares your progress with that pace${measuredFrom}.`;
}
