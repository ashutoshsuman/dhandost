import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase, type Transaction } from "@/lib/supabase";
import { formatINR, formatDate } from "@/lib/format";
import { Button, Field, Input, Select } from "@/components/ui-primitives";

export const Route = createFileRoute("/transactions")({
  component: () => (
    <Layout>
      <TransactionsPage />
    </Layout>
  ),
});

const CATEGORIES = ["Food", "Transport", "Rent", "Utilities", "Shopping", "Health", "Entertainment", "Salary", "Investment", "Transfer", "Other"];

function TransactionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">{txs?.length ?? 0} entries</p>
        </div>
        <Button onClick={() => setOpen(true)}>Add transaction</Button>
      </div>

      {open && <AddForm onClose={() => setOpen(false)} />}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Date</th>
              <th className="text-left px-4 py-2.5 font-medium">Description</th>
              <th className="text-left px-4 py-2.5 font-medium">Category</th>
              <th className="text-left px-4 py-2.5 font-medium">Source</th>
              <th className="text-right px-4 py-2.5 font-medium">Amount</th>
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
                <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{formatDate(t.occurred_at)}</td>
                <td className="px-4 py-2.5">{t.description || "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{t.category || "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{t.source}</td>
                <td
                  className="px-4 py-2.5 text-right tabular-nums font-medium"
                  style={{ color: t.direction === "credit" ? "var(--credit)" : "var(--debit)" }}
                >
                  {t.direction === "credit" ? "+" : "−"}{formatINR(t.amount)}
                </td>
                <td className="px-4 py-2.5 text-right">
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

function AddForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    occurred_at: new Date().toISOString().slice(0, 10),
    amount: "",
    direction: "debit" as "debit" | "credit",
    category: "",
    description: "",
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transactions").insert({
        occurred_at: form.occurred_at,
        amount: parseFloat(form.amount),
        direction: form.direction,
        category: form.category || null,
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
          <Select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as any })}>
            <option value="debit">Debit (spent)</option>
            <option value="credit">Credit (received)</option>
          </Select>
        </Field>
        <Field label="Amount (₹)">
          <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">—</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
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
