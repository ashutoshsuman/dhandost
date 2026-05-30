import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase, type Goal } from "@/lib/supabase";
import { formatINR, formatDate } from "@/lib/format";
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
import MoveMoney from "@/components/MoveMoney";

export const Route = createFileRoute("/goals")({
  component: () => (
    <Layout>
      <GoalsPage />
    </Layout>
  ),
});

function GoalsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Goal | null>(null);

  const { data } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("priority", { ascending: true });
      if (error) throw error;
      return data as Goal[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, current_amount }: { id: string; current_amount: number }) => {
      const { error } = await supabase.from("goals").update({ current_amount }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setConfirmDelete(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">Track things that matter the most.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Add goal</Button>
      </div>

      {open && <AddForm onClose={() => setOpen(false)} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data ?? []).map((g) => {
          const cur = Number(g.current_amount ?? 0);
          const tgt = Number(g.target_amount);
          const pct = Math.min(100, (cur / tgt) * 100);
          return (
            <div key={g.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">by {formatDate(g.target_date)}</p>
                </div>
                <Button variant="destructive" onClick={() => setConfirmDelete(g)}>Delete</Button>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm tabular-nums">
                  <span>{formatINR(cur)}</span>
                  <span className="text-muted-foreground">of {formatINR(tgt)}</span>
                </div>
                <div className="mt-1.5 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{pct.toFixed(1)}% complete</p>
              </div>
              <UpdateProgress
                currentAmount={cur}
                isPending={update.isPending && update.variables?.id === g.id}
                onUpdate={(v) => update.mutate({ id: g.id, current_amount: v })}
              />
            </div>
          );
        })}
        {(data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No goals yet.</p>
        )}
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o && !del.isPending) setConfirmDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this goal
              {confirmDelete?.name ? ` "${confirmDelete.name}"` : ""}
              {confirmDelete ? ` with target amount ${formatINR(confirmDelete.target_amount)}` : ""}
              {confirmDelete?.target_date ? ` and target date ${formatDate(confirmDelete.target_date)}` : ""}? This action cannot be undone.
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

function UpdateProgress({ currentAmount, isPending, onUpdate }: { currentAmount: number; isPending: boolean; onUpdate: (v: number) => void }) {
  const [val, setVal] = useState(String(currentAmount));
  const parsed = parseFloat(val);
  const changed = !isNaN(parsed) && parsed !== currentAmount;
  return (
    <div className="mt-4 flex items-center gap-2">
      <Input
        type="number"
        step="0.01"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="flex-1"
      />
      <Button
        type="button"
        onClick={() => onUpdate(parsed)}
        disabled={!changed || isPending}
      >
        {isPending ? "Updating…" : "Update progress"}
      </Button>
    </div>
  );
}

function AddForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", target_amount: "", current_amount: "0",
    target_date: "", priority: "1",
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("goals").insert({
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount || "0"),
        target_date: form.target_date,
        priority: parseInt(form.priority),
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); onClose(); },
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
      className="rounded-lg border border-border bg-card p-5 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="Target (₹)"><Input type="number" step="0.01" min="0" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} required /></Field>
        <Field label="Current (₹)"><Input type="number" step="0.01" min="0" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} /></Field>
        <Field label="Target date"><Input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} required /></Field>
        <Field label="Priority"><Input type="number" min="1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></Field>
      </div>
      {add.isError && <p className="text-sm text-destructive">{(add.error as Error).message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={add.isPending}>{add.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
