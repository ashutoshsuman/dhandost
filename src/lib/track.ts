import { supabase } from "@/lib/supabase";

export type EventName =
  | "statement_imported"
  | "transactions_categorized"
  | "three_paths_generated"
  | "path_applied"
  | "coach_message_sent"
  | "goal_created";

type Props = Record<string, string | number | boolean>;

export async function track(event: EventName, properties: Props = {}): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    // No .select() — users have no read access to analytics_events.
    await supabase.from("analytics_events").insert({
      user_id: userId,
      event_name: event,
      properties,
    });
  } catch {
    // Analytics must never break the app.
  }
}

/** Extract a categorized-row count from a categorize-transactions response. */
export function categorizedCount(r: unknown): number {
  const o = (r ?? {}) as Record<string, unknown>;
  for (const k of ["categorized", "updated", "count", "processed"]) {
    const v = o[k];
    if (typeof v === "number") return v;
    if (Array.isArray(v)) return v.length;
  }
  return 0;
}
