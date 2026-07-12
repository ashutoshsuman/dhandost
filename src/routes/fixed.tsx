import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase, type FixedExpense } from "@/lib/supabase";
import { withTimeout, TIMEOUT_FAST } from "@/lib/withTimeout";
import { formatINR } from "@/lib/format";
import { Button, Field, Input, Select } from "@/components/ui-primitives";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
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

export const Route = createFileRoute("/fixed")({
  component: () => (
    <Layout>
      <FixedPage />
    </Layout>
  ),
});

function FixedPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<FixedExpense | null>(null);

  const { data } = useQuery({
    queryKey: ["fixed_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_expenses")
        .select("*")
        .order("day_of_month", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as FixedExpense[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (f: FixedExpense) => {
      const { error } = await supabase.from("fixed_expenses").update({ active: !f.active }).eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed_expenses"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fixed_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fixed_expenses"] });
      setConfirmDelete(null);
    },
  });

  const total = (data ?? []).filter((f) => f.active).reduce((s, f) => s + Number(f.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fixed monthly expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">{formatINR(total)} / month active</p>
        </div>
        <Button onClick={() => setOpen(true)}>Add expense</Button>
      </div>

      {open && <AddForm onClose={() => setOpen(false)} />}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Category</th>
              <th className="text-left px-4 py-2.5 font-medium">Day</th>
              <th className="text-right px-4 py-2.5 font-medium">Amount</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">None yet.</td></tr>
            )}
            {(data ?? []).map((f) => (
              <tr key={f.id} className={f.active ? "" : "opacity-50"}>
                <td className="px-4 py-2.5">{f.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{f.category || "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{f.day_of_month ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatINR(f.amount)}</td>
                <td className="px-4 py-2.5 text-right space-x-1">
                  <Button variant="ghost" onClick={() => toggle.mutate(f)}>
                    {f.active ? "Pause" : "Resume"}
                  </Button>
                  <Button variant="destructive" onClick={() => setConfirmDelete(f)}>Delete</Button>
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
            <AlertDialogTitle>Delete this fixed expense?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this fixed expense
              {confirmDelete?.name ? ` "${confirmDelete.name}"` : ""}
              {confirmDelete ? ` of ${formatINR(confirmDelete.amount)}` : ""}? This action cannot be undone.
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
  const [form, setForm] = useState({ name: "", amount: "", category: "", day_of_month: "" });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fixed_expenses").insert({
        name: form.name,
        amount: parseFloat(form.amount),
        category: form.category || null,
        day_of_month: form.day_of_month ? parseInt(form.day_of_month) : null,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fixed_expenses"] }); onClose(); },
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
      className="rounded-lg border border-border bg-card p-5 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="Amount (₹)"><Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">—</option>
            {DEFAULT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Day of month"><Input type="number" min="1" max="31" value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} /></Field>
      </div>
      {add.isError && <p className="text-sm text-destructive">{(add.error as Error).message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={add.isPending}>{add.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
