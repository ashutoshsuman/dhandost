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
