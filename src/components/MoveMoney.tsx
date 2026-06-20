import { useMemo, useState } from "react";
import type { Goal } from "@/lib/supabase";
import { invokeFn } from "@/lib/invokeFn";


function formatINR(n: number | string | null | undefined, currency = "₹") {
  return `${currency}${Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-IN")}`;
}

type Props = {
  goals?: Goal[];
  onMoved?: () => void;
  currency?: string;
};

export default function MoveMoney({ goals = [], onMoved, currency = "₹" }: Props) {
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const fromGoal = useMemo(() => goals.find((g) => g.id === fromId), [goals, fromId]);
  const toGoal = useMemo(() => goals.find((g) => g.id === toId), [goals, toId]);

  const toRoom = useMemo(() => {
    if (!toGoal) return Infinity;
    const t = Number(toGoal.target_amount ?? 0);
    if (!t || t <= 0) return Infinity;
    return Math.max(0, t - Number(toGoal.current_amount ?? 0));
  }, [toGoal]);

  const amt = Number(amount);
  const sourceBalance = Number(fromGoal?.current_amount ?? 0);
  const tooMuchForSource = !!fromGoal && amt > sourceBalance;
  const willCap = !!toGoal && amt > toRoom;

  function reset() {
    setFromId("");
    setToId("");
    setAmount("");
    setMsg(null);
  }

  async function submit() {
    setMsg(null);
    if (!fromId || !toId) return setMsg({ type: "error", text: "Pick both goals." });
    if (fromId === toId) return setMsg({ type: "error", text: "Choose two different goals." });
    if (!isFinite(amt) || amt <= 0) return setMsg({ type: "error", text: "Enter a valid amount." });
    if (tooMuchForSource) {
      return setMsg({
        type: "error",
        text: `${fromGoal!.name} only has ${formatINR(sourceBalance, currency)}.`,
      });
    }

    setBusy(true);
    try {
      const data = await invokeFn<{
        actually_moved?: number;
        capped?: boolean;
        from: { name: string };
        to: { name: string };
      }>("move-goal-funds", {
        from_goal_id: fromId,
        to_goal_id: toId,
        amount: amt,
      });
      const moved = data.actually_moved ?? amt;
      const capNote = data.capped
        ? ` (capped to ${formatINR(moved, currency)} — destination near its target)`
        : "";
      if (typeof pendo !== 'undefined') {
        pendo.track("money_moved_between_goals", {
          from_goal_name: data.from.name,
          to_goal_name: data.to.name,
          requested_amount: amt,
          actually_moved: moved,
          was_capped: !!data.capped,
        });
      }
      setMsg({
        type: "success",
        text: `Moved ${formatINR(moved, currency)} from ${data.from.name} to ${data.to.name}${capNote}.`,
      });
      onMoved?.();
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1400);
    } catch (e) {
      setMsg({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        Move money between goals
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 max-w-md shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Move money</h3>
        <button
          type="button"
          onClick={() => { setOpen(false); reset(); }}
          className="cursor-pointer text-muted-foreground hover:text-foreground text-sm"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="w-16 text-sm text-muted-foreground">From</label>
          <select
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          >
            <option value="">Select goal…</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id} disabled={g.id === toId}>
                {g.name} — {formatINR(g.current_amount, currency)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="w-16 text-sm text-muted-foreground">To</label>
          <select
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
          >
            <option value="">Select goal…</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id} disabled={g.id === fromId}>
                {g.name} — {formatINR(g.current_amount, currency)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="w-16 text-sm text-muted-foreground">Amount</label>
          <input
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            type="number"
            min="0"
            value={amount}
            placeholder="0"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      {fromGoal && (
        <p className="text-xs text-muted-foreground mt-3 ml-[76px]">
          {fromGoal.name} has {formatINR(sourceBalance, currency)} available.
        </p>
      )}
      {tooMuchForSource && (
        <p className="text-xs text-amber-600 mt-1 ml-[76px] font-medium">
          That's more than {fromGoal!.name} holds.
        </p>
      )}
      {willCap && !tooMuchForSource && toGoal && (
        <p className="text-xs text-amber-600 mt-1 ml-[76px] font-medium">
          {toGoal.name} is near its target — only {formatINR(toRoom, currency)} will be moved.
        </p>
      )}

      {msg && (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            msg.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={() => { setOpen(false); reset(); }}
          disabled={busy}
          className="cursor-pointer inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || tooMuchForSource}
          className="cursor-pointer inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Moving…" : "Move money"}
        </button>
      </div>
    </div>
  );
}
