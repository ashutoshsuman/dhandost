import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Check, Loader2, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase, type Transaction } from "@/lib/supabase";
import { formatINR, formatDate } from "@/lib/format";
import { Button, Field, Input, Select } from "@/components/ui-primitives";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { fetchThreePaths, storePathsResponse, getAppliedPlanTxIds } from "@/lib/three-paths";
import { CategoryEditor as ReviewCategoryEditor } from "@/components/CategoryReview";


export const Route = createFileRoute("/transactions")({
  component: () => (
    <Layout>
      <TransactionsPage />
    </Layout>
  ),
});

function TransactionsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // editingId/updateCategory removed — inline ReviewCategoryEditor handles category edits now
  const [planFor, setPlanFor] = useState<Transaction | null>(null);
  const [computing, setComputing] = useState(false);
  const [appliedTxIds, setAppliedTxIds] = useState<string[]>([]);

  useEffect(() => {
    setAppliedTxIds(getAppliedPlanTxIds());
  }, []);



  const { data: txs, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });


  // dynamic categories: defaults + any in-use custom ones
  const dynamicCats = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...((txs ?? []).map((t) => t.category).filter(Boolean) as string[])]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">{txs?.length ?? 0} entries</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)}>Add Manual Transaction</Button>
          <Link
            to="/import"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium hover:bg-secondary"
          >
            Upload Bank CSV
          </Link>
        </div>
      </div>

      {open && <AddForm onClose={() => setOpen(false)} categories={dynamicCats} />}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Date</th>
              <th className="text-right px-4 py-2.5 font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 font-medium">Category</th>
              <th className="text-left px-4 py-2.5 font-medium">Description</th>
              <th className="text-left px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && (txs ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No transactions yet.</td></tr>
            )}
            {(txs ?? []).map((t) => (
              <tr key={t.id} className="hover:bg-secondary/30">
                <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">{formatDate(t.occurred_at)}</td>
                <td
                  className="px-4 py-2.5 text-right tabular-nums font-medium whitespace-nowrap"
                  style={{ color: t.direction === "credit" ? "var(--credit)" : "var(--debit)" }}
                >
                  {t.direction === "credit" ? "+" : "−"}{formatINR(t.amount)}
                </td>
                <td className="px-4 py-2.5">
                  <ReviewCategoryEditor
                    transaction={t as any}
                    categories={dynamicCats}
                    onSaved={() => qc.invalidateQueries({ queryKey: ["transactions"] })}
                  />
                </td>
                <td className="px-4 py-2.5 max-w-xs truncate">{t.description || "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{t.source}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  {appliedTxIds.includes(t.id) ? (
                    <span className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground">
                      <Check className="h-3 w-3" />
                      Plan applied
                    </span>
                  ) : (
                    <button
                      onClick={() => setPlanFor(t)}
                      className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                      title="Help me with a plan"
                    >
                      <Sparkles className="h-3 w-3" />
                      Help me with a plan
                    </button>
                  )}

                  <Button variant="destructive" onClick={() => del.mutate(t.id)}>Delete</Button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {planFor && (
        <PlanModal
          tx={planFor}
          computing={computing}
          onClose={() => { if (!computing) setPlanFor(null); }}
          onPick={async (kind) => {
            if (kind === "planned") { setPlanFor(null); return; }
            setComputing(true);
            try {
              const resp = await fetchThreePaths({
                trigger_type: kind,
                trigger_amount: Number(planFor.amount),
                trigger_description: planFor.description,
                trigger_transaction_id: planFor.id,
              });
              storePathsResponse(resp);
              navigate({ to: "/paths" });
            } catch (e) {
              alert((e as Error).message);
              setComputing(false);
            }
          }}

        />
      )}
    </div>
  );
}

function PlanModal({
  tx, computing, onClose, onPick,
}: {
  tx: Transaction;
  computing: boolean;
  onClose: () => void;
  onPick: (kind: "surprise_income" | "surprise_expense" | "planned") => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {computing ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Relax while computing your options…</p>
          </div>
        ) : (
          <>
            <h3 className="text-base font-semibold">
              Was this a surprise income, a surprise expense, or a planned transaction?
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(tx.occurred_at)} · {formatINR(tx.amount)} {tx.description ? `· ${tx.description}` : ""}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={() => onPick("surprise_income")} disabled={tx.direction !== "credit"}>
                Surprise income
              </Button>
              <Button onClick={() => onPick("surprise_expense")} disabled={tx.direction !== "debit"}>
                Surprise expense
              </Button>
              <Button variant="outline" onClick={() => onPick("planned")}>Planned</Button>
            </div>
            <div className="mt-4 text-right">
              <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}




function AddForm({ onClose, categories }: { onClose: () => void; categories: string[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    occurred_at: new Date().toISOString().slice(0, 10),
    amount: "",
    direction: "debit" as "debit" | "credit",
    category: "",
    customCategory: "",
    description: "",
  });
  const [customMode, setCustomMode] = useState(false);

  const add = useMutation({
    mutationFn: async () => {
      const cat = customMode ? form.customCategory.trim() : form.category;
      const { error } = await supabase.from("transactions").insert({
        occurred_at: form.occurred_at,
        amount: parseFloat(parseFloat(form.amount).toFixed(2)),
        direction: form.direction,
        category: cat || null,
        description: form.description || null,
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
      className="rounded-lg border border-border bg-card p-5 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Field label="Date">
          <Input type="date" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} required />
        </Field>
        <Field label="Direction">
          <Select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as "debit" | "credit" })}>
            <option value="credit">Income (credit)</option>
            <option value="debit">Expense (debit)</option>
          </Select>
        </Field>
        <Field label="Amount (₹)">
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
        </Field>
        <Field label="Category">
          {customMode ? (
            <div className="flex gap-1">
              <Input
                autoFocus
                value={form.customCategory}
                onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                placeholder="Custom"
              />
              <button type="button" onClick={() => setCustomMode(false)} className="text-xs text-muted-foreground px-2">↩</button>
            </div>
          ) : (
            <Select
              value={form.category}
              onChange={(e) => {
                if (e.target.value === "__custom__") { setCustomMode(true); setForm({ ...form, category: "" }); }
                else setForm({ ...form, category: e.target.value });
              }}
            >
              <option value="">—</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">+ Add custom</option>
            </Select>
          )}
        </Field>
        <Field label="Description">
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </div>
      {add.isError && <p className="text-sm text-destructive">{(add.error as Error).message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={add.isPending}>{add.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
