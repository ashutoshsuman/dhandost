import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const Route = createFileRoute("/api/public/move-goal-funds")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { from_goal_id?: string; to_goal_id?: string; amount?: number };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        const { from_goal_id, to_goal_id, amount } = body;
        if (!from_goal_id || !to_goal_id) return json({ error: "from_goal_id and to_goal_id are required" }, 400);
        if (from_goal_id === to_goal_id) return json({ error: "Source and destination must differ" }, 400);
        const amt = Number(amount);
        if (!isFinite(amt) || amt <= 0) return json({ error: "amount must be a positive number" }, 400);

        const { data: goals, error: readErr } = await db
          .from("goals")
          .select("id, name, current_amount, target_amount")
          .in("id", [from_goal_id, to_goal_id]);
        if (readErr) return json({ error: readErr.message }, 500);
        const from = goals?.find((g) => g.id === from_goal_id);
        const to = goals?.find((g) => g.id === to_goal_id);
        if (!from || !to) return json({ error: "One or both goals not found" }, 404);

        const fromBal = Number(from.current_amount ?? 0);
        if (amt > fromBal) {
          return json({ error: `${from.name} only has ${fromBal}` }, 400);
        }

        const target = Number(to.target_amount ?? 0);
        const toCur = Number(to.current_amount ?? 0);
        const room = target > 0 ? Math.max(0, target - toCur) : Infinity;
        const moved = Math.min(amt, room);
        const capped = moved < amt;
        if (moved <= 0) return json({ error: `${to.name} is already at its target` }, 400);

        const { error: e1 } = await db
          .from("goals")
          .update({ current_amount: fromBal - moved })
          .eq("id", from.id);
        if (e1) return json({ error: e1.message }, 500);

        const { error: e2 } = await db
          .from("goals")
          .update({ current_amount: toCur + moved })
          .eq("id", to.id);
        if (e2) {
          // best-effort rollback
          await db.from("goals").update({ current_amount: fromBal }).eq("id", from.id);
          return json({ error: e2.message }, 500);
        }

        return json({
          ok: true,
          actually_moved: moved,
          capped,
          from: { id: from.id, name: from.name },
          to: { id: to.id, name: to.name },
        });
      },
    },
  },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
