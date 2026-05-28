import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Check, X, Loader2, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase, type Transaction } from "@/lib/supabase";
import { formatINR, formatDate } from "@/lib/format";
import { Button, Field, Input, Select } from "@/components/ui-primitives";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { fetchThreePaths, storePathsResponse } from "@/lib/three-paths";

  component: () => (
    <Layout>
      <TransactionsPage />
    </Layout>
  ),
});

function TransactionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const updateCategory = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string | null }) => {
      const { error } = await supabase.from("transactions").update({ category }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setEditingId(null);
    },
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
                  {editingId === t.id ? (
                    <CategoryEditor
                      value={t.category}
                      categories={dynamicCats}
                      onSave={(v) => updateCategory.mutate({ id: t.id, category: v })}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingId(t.id)}
                      className="text-left text-muted-foreground hover:text-foreground hover:underline"
                      title="Edit category"
                    >
                      {t.category || <span className="italic">add category</span>}
                    </button>
                  )}
                </td>
                <td className="px-4 py-2.5 max-w-xs truncate">{t.description || "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{t.source}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => setEditingId(t.id)}
                    className="inline-flex items-center justify-center p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPlanFor(t)}
                    className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    title="Help me with a plan"
                  >
                    <Sparkles className="h-3 w-3" />
                    Help me with a plan
                  </button>
                  <Button variant="destructive" onClick={() => del.mutate(t.id)}>Delete</Button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryEditor({
  value, categories, onSave, onCancel,
}: {
  value: string | null;
  categories: string[];
  onSave: (v: string | null) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"select" | "custom">("select");
  const [val, setVal] = useState(value ?? "");

  return (
    <div className="flex items-center gap-1.5">
      {mode === "select" ? (
        <Select
          value={categories.includes(val) ? val : ""}
          onChange={(e) => {
            if (e.target.value === "__custom__") { setMode("custom"); setVal(""); }
            else setVal(e.target.value);
          }}
          className="py-1 text-xs"
        >
          <option value="">—</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__custom__">+ Add custom</option>
        </Select>
      ) : (
        <Input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Custom category"
          className="py-1 text-xs"
        />
      )}
      <button onClick={() => onSave(val || null)} className="p-1 rounded hover:bg-secondary" title="Save">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={onCancel} className="p-1 rounded hover:bg-secondary" title="Cancel">
        <X className="h-3.5 w-3.5" />
      </button>
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
