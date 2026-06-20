import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { invokeFn } from "@/lib/invokeFn";
import { formatINR } from "@/lib/format";
import { Button, Field, Input } from "@/components/ui-primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [confirmDelete, setConfirmDelete] = useState<Debt | null>(null);

  const { data } = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .order("interest_rate_annual", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((d: Debt) => d.active !== false) as Debt[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await invokeFn("delete-debt", { debt_id: id, confirmed: true });
    },
    onSuccess: () => {
      if (typeof pendo !== 'undefined' && confirmDelete) {
        pendo.track("debt_deleted", {
          debt_id: confirmDelete.id,
          debt_name: confirmDelete.name,
          balance: Number(confirmDelete.balance),
          interest_rate_annual: Number(confirmDelete.interest_rate_annual),
        });
      }
      qc.invalidateQueries({ queryKey: ["debts"] });
      setConfirmDelete(null);
    },
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
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{Number(d.interest_rate_annual).toFixed(2)}%</td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="destructive" onClick={() => setConfirmDelete(d)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o && !del.isPending) setConfirmDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this debt?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this debt
              {confirmDelete?.name ? ` "${confirmDelete.name}"` : ""}
              {confirmDelete ? ` with balance ${formatINR(confirmDelete.balance)}` : ""}
              {confirmDelete ? ` and interest rate ${Number(confirmDelete.interest_rate_annual).toFixed(2)}% p.a.` : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending} className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={del.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) del.mutate(confirmDelete.id);
              }}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", balance: "", interest_rate_annual: "" });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("debts").insert({
        name: form.name,
        balance: parseFloat(form.balance),
        interest_rate_annual: parseFloat(form.interest_rate_annual),
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (typeof pendo !== 'undefined') {
        pendo.track("debt_added", {
          debt_name: form.name,
          balance: parseFloat(form.balance),
          interest_rate_annual: parseFloat(form.interest_rate_annual),
        });
      }
      qc.invalidateQueries({ queryKey: ["debts"] });
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
      className="rounded-lg border border-border bg-card p-5 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="HDFC Credit Card" required /></Field>
        <Field label="Current balance (₹)"><Input type="number" step="0.01" min="0" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} required /></Field>
        <Field label="Interest rate (% p.a.)"><Input type="number" step="0.01" min="0" value={form.interest_rate_annual} onChange={(e) => setForm({ ...form, interest_rate_annual: e.target.value })} required /></Field>
      </div>
      {add.isError && <p className="text-sm text-destructive">{(add.error as Error).message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={add.isPending}>{add.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
