import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { formatINR } from "@/lib/format";
import { Button, Field, Input } from "@/components/ui-primitives";

export const Route = createFileRoute("/debts")({
  component: () => (
    <Layout>
      <DebtsPage />
    </Layout>
  ),
});

type Debt = {
  id: string;
  name: string;
  balance: number;
  interest_rate_annual: number;
  active?: boolean | null;
};

function DebtsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .order("interest_rate", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((d: Debt) => d.active !== false) as Debt[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts"] }),
  });

  const total = (data ?? []).reduce((s, d) => s + Number(d.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Debts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            High-interest debt only — credit cards, personal loans. Mortgages and EMIs belong under Fixed Expenses.
          </p>
          <p className="text-sm text-muted-foreground mt-1">Outstanding: <span className="tabular-nums">{formatINR(total)}</span></p>
        </div>
        <Button onClick={() => setOpen(true)}>Add Debt</Button>
      </div>

      {open && <AddForm onClose={() => setOpen(false)} />}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-right px-4 py-2.5 font-medium">Balance</th>
              <th className="text-right px-4 py-2.5 font-medium">Interest (p.a.)</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No active debts.</td></tr>
            )}
            {(data ?? []).map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2.5">{d.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatINR(d.balance)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{Number(d.interest_rate).toFixed(2)}%</td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="destructive" onClick={() => del.mutate(d.id)}>Delete</Button>
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
  const [form, setForm] = useState({ name: "", balance: "", interest_rate: "" });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("debts").insert({
        name: form.name,
        balance: parseFloat(form.balance),
        interest_rate: parseFloat(form.interest_rate),
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["debts"] }); onClose(); },
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
      className="rounded-lg border border-border bg-card p-5 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="HDFC Credit Card" required /></Field>
        <Field label="Current balance (₹)"><Input type="number" step="0.01" min="0" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} required /></Field>
        <Field label="Interest rate (% p.a.)"><Input type="number" step="0.01" min="0" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} required /></Field>
      </div>
      {add.isError && <p className="text-sm text-destructive">{(add.error as Error).message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={add.isPending}>{add.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
