import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { invokeFn } from "@/lib/invokeFn";

type Txn = {
  id: string;
  amount: number | string;
  occurred_at: string;
  description?: string | null;
};

function formatINR(n: number | string, currency = "₹") {
  return `${currency}${Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-IN")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function SelfTransferReview({ currency = "₹" }: { currency?: string }) {
  const [rows, setRows] = useState<Txn[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id,amount,occurred_at,description")
        .eq("self_transfer_confidence", "name_match")
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (mounted) setRows((data as Txn[]) ?? []);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function resolve(row: Txn, choice: "yes" | "no") {
    setBusyId(row.id);
    try {
      await invokeFn("resolve-self-transfer", {
        transaction_id: row.id,
        resolution: choice === "yes" ? "genuine_income" : "self_transfer",
      });
      setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id));
      queryClient.invalidateQueries({ queryKey: ["review-count"] });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (!rows || rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="border-t border-border pt-5">
        <h2 className="text-xl font-semibold">Possible Self-Transfers</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {rows.length} transaction{rows.length === 1 ? "" : "s"} that might be transfers between your own accounts.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex justify-between items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {row.description?.trim() || "(no description)"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(row.occurred_at)}
                <span className="ml-1.5">{formatINR(row.amount, currency)}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1 italic">
                This looks like it might be a transfer from your own account.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => resolve(row, "yes")}
                disabled={busyId === row.id}
                className="text-xs px-3 py-1.5 rounded-md border border-primary bg-primary text-primary-foreground font-medium hover:opacity-90 cursor-pointer disabled:opacity-50"
              >
                Yes, this is income
              </button>
              <button
                onClick={() => resolve(row, "no")}
                disabled={busyId === row.id}
                className="text-xs px-3 py-1.5 rounded-md border border-border text-foreground font-medium hover:bg-secondary cursor-pointer disabled:opacity-50"
              >
                No, it's my own money
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
