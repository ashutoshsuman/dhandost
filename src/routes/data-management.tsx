import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, RefreshCw, AlertTriangle, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { invokeFn } from "@/lib/invokeFn";
import { formatINR, formatDate } from "@/lib/format";
import { Button, Input } from "@/components/ui-primitives";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/data-management")({
  component: () => (
    <Layout>
      <DataManagementPage />
    </Layout>
  ),
});

function DataManagementPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Data Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage, clean, or reset your financial data. All deletions are permanent.
        </p>
      </div>

      <GoalsSection />
      <DebtsSection />
      <CommitmentsSection />
      <TransactionsSection />

      <div className="border-t border-border pt-8">
        <DangerZone />
      </div>
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  onRefresh,
  children,
}: {
  title: string;
  subtitle?: string;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>
      <div>{children}</div>
    </section>
  );
}

function LoadingRows() {
  return (
    <div className="p-5 space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-3/4" />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="px-5 py-6 text-sm text-muted-foreground text-center">{label}</p>;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="mx-5 my-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

/* ---------- Goals ---------- */

type GoalRow = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number | null;
  status: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    paused: "bg-amber-100 text-amber-700",
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-600",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

function GoalsSection() {
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dm-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, name, target_amount, current_amount, status")
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GoalRow[];
    },
  });

  const onDelete = async (g: GoalRow) => {
    setBusyId(g.id);
    try {
      await invokeFn("delete-goal", { goal_id: g.id, confirmed: true });
      toast.success("Goal deleted");
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ["dm-goals"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
    } catch (e) {
      toast.error((e as Error).message || "Could not delete goal");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SectionShell title="Goals" subtitle="Delete a goal and its linked contributions." onRefresh={() => refetch()}>
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorBox message={(error as Error).message} />
      ) : !data || data.length === 0 ? (
        <Empty label="No goals yet" />
      ) : (
        <ul className="divide-y divide-border">
          {data.map((g) => (
            <li key={g.id}>
              <div className="flex items-center justify-between px-5 py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{g.name}</span>
                    <StatusBadge status={g.status} />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                    {formatINR(g.current_amount ?? 0)} of {formatINR(g.target_amount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmId(g.id)}
                  aria-label="Delete goal"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {confirmId === g.id && (
                <div className="px-5 py-3 bg-secondary/40 border-t border-border">
                  <p className="text-sm">
                    Delete <span className="font-medium">{g.name}</span>? This will also remove all
                    contributions and linked commitments. This cannot be undone.
                  </p>
                  <div className="mt-2.5 flex gap-2 justify-end">
                    <Button variant="ghost" onClick={() => setConfirmId(null)} disabled={busyId === g.id}>
                      Cancel
                    </Button>
                    <button
                      type="button"
                      onClick={() => onDelete(g)}
                      disabled={busyId === g.id}
                      className="inline-flex items-center rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-semibold hover:bg-destructive/90 disabled:opacity-50 cursor-pointer"
                    >
                      {busyId === g.id ? "Deleting…" : "Delete goal"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

/* ---------- Debts ---------- */

type DebtRow = { id: string; name: string; balance: number; interest_rate_annual: number };

function DebtsSection() {
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dm-debts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("id, name, balance, interest_rate_annual")
        .order("interest_rate_annual", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DebtRow[];
    },
  });

  const onDelete = async (d: DebtRow) => {
    setBusyId(d.id);
    try {
      await invokeFn("delete-debt", { debt_id: d.id, confirmed: true });
      toast.success("Debt deleted");
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ["dm-debts"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
    } catch (e) {
      toast.error((e as Error).message || "Could not delete debt");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SectionShell title="Debts" subtitle="Delete a debt and cancel any pending paydowns." onRefresh={() => refetch()}>
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorBox message={(error as Error).message} />
      ) : !data || data.length === 0 ? (
        <Empty label="No debts" />
      ) : (
        <ul className="divide-y divide-border">
          {data.map((d) => (
            <li key={d.id}>
              <div className="flex items-center justify-between px-5 py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                    {formatINR(d.balance)} @ {Number(d.interest_rate_annual).toFixed(2)}% p.a.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmId(d.id)}
                  aria-label="Delete debt"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {confirmId === d.id && (
                <div className="px-5 py-3 bg-secondary/40 border-t border-border">
                  <p className="text-sm">
                    Delete <span className="font-medium">{d.name}</span>? This will also cancel any
                    pending paydown commitments linked to it.
                  </p>
                  <div className="mt-2.5 flex gap-2 justify-end">
                    <Button variant="ghost" onClick={() => setConfirmId(null)} disabled={busyId === d.id}>
                      Cancel
                    </Button>
                    <button
                      type="button"
                      onClick={() => onDelete(d)}
                      disabled={busyId === d.id}
                      className="inline-flex items-center rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-semibold hover:bg-destructive/90 disabled:opacity-50 cursor-pointer"
                    >
                      {busyId === d.id ? "Deleting…" : "Delete debt"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

/* ---------- Commitments ---------- */

type CommitmentRow = {
  id: string;
  commitment_type: string | null;
  status: string;
  savings_label: string | null;
  category: string | null;
  goal_id: string | null;
  debt_id: string | null;
  monthly_amount: number | null;
  paydown_amount: number | null;
  created_at: string;
  goals?: { name: string }[] | null;
  debts?: { name: string }[] | null;
};

function CommitmentsSection() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const getLabel = (c: CommitmentRow) => {
    const goalName = c.goals?.[0]?.name ?? 'Unknown goal';
    const debtName = c.debts?.[0]?.name ?? 'Unknown debt';
    const amt = (val: number | null | undefined) => val != null ? `₹${Number(val).toLocaleString('en-IN')}` : '₹—';
    if (c.commitment_type === 'delay_goal')
      return `Delay goal · ${goalName}`;
    if (c.commitment_type === 'reduce_discretionary')
      return `Cut ${c.category ?? 'discretionary'} · ${amt(c.monthly_amount)}/mo`;
    if (c.commitment_type === 'debt_paydown')
      return `Pay down ${debtName} · ${amt(c.paydown_amount)}`;
    if (c.commitment_type === 'allocate_savings')
      return `Park savings · ${c.savings_label ?? 'Savings'} · ${amt(c.paydown_amount)}`;
    return c.commitment_type ?? '—';
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dm-commitments"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("active_commitments")
        .select(`
          id,
          commitment_type,
          status,
          monthly_amount,
          paydown_amount,
          savings_label,
          category,
          goal_id,
          debt_id,
          created_at,
          goals ( name ),
          debts ( name )
        `)
        .eq("user_id", user.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CommitmentRow[];
    },
  });

  const onCancel = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("active_commitments")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      toast.success("Commitment cancelled");
      qc.invalidateQueries({ queryKey: ["dm-commitments"] });
      qc.invalidateQueries({ queryKey: ["active-commitments"] });
    } catch (e) {
      toast.error((e as Error).message || "Could not cancel commitment");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SectionShell title="Commitments" subtitle="Cancel an active or pending commitment." onRefresh={() => refetch()}>
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorBox message={(error as Error).message} />
      ) : !data || data.length === 0 ? (
        <Empty label="No commitments" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Commitment</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((c) => {
                let amountText = "—";
                if (c.commitment_type === 'debt_paydown' || c.commitment_type === 'allocate_savings') {
                  amountText = c.paydown_amount != null ? `₹${Number(c.paydown_amount).toLocaleString('en-IN')}` : '₹—';
                } else if (c.commitment_type === 'delay_goal' || c.commitment_type === 'reduce_discretionary') {
                  amountText = c.monthly_amount != null ? `₹${Number(c.monthly_amount).toLocaleString('en-IN')}/mo` : '₹—';
                }
                const canCancel = c.status === "active" || c.status === "pending";
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-muted-foreground">{c.commitment_type ?? "—"}</td>
                    <td className="px-4 py-2 truncate max-w-[280px]">{getLabel(c)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{amount ? formatINR(amount) : "—"}</td>
                    <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-2 text-right">
                      {canCancel ? (
                        <Button
                          variant="outline"
                          onClick={() => onCancel(c.id)}
                          disabled={busyId === c.id}
                          className="text-xs"
                        >
                          {busyId === c.id ? "Cancelling…" : "Cancel"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}

/* ---------- Transactions ---------- */

type TxnRow = {
  id: string;
  occurred_at: string;
  description: string | null;
  amount: number;
  category: string | null;
  direction: "credit" | "debit";
};

function TransactionsSection() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showRangeConfirm, setShowRangeConfirm] = useState(false);
  const [rangeBusy, setRangeBusy] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dm-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, occurred_at, description, amount, category, direction")
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as TxnRow[];
    },
  });

  const deleteOne = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    setBusyId(id);
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Transaction deleted");
      qc.invalidateQueries({ queryKey: ["dm-transactions"] });
    } catch (e) {
      toast.error((e as Error).message || "Could not delete");
    } finally {
      setBusyId(null);
    }
  };

  const deleteRange = async () => {
    setRangeBusy(true);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", uid)
        .gte("occurred_at", from)
        .lte("occurred_at", to);
      if (error) throw error;
      toast.success("Transactions in range deleted");
      setShowRangeConfirm(false);
      qc.invalidateQueries({ queryKey: ["dm-transactions"] });
    } catch (e) {
      toast.error((e as Error).message || "Could not delete range");
    } finally {
      setRangeBusy(false);
    }
  };

  return (
    <SectionShell
      title="Transactions"
      subtitle="Showing the 50 most recent. Delete individually or by date range."
      onRefresh={() => refetch()}
    >
      <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-end gap-2 flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        </div>
        <button
          type="button"
          disabled={!from || !to}
          onClick={() => setShowRangeConfirm(true)}
          className="inline-flex items-center rounded-md border border-destructive/40 text-destructive px-3 py-2 text-xs font-semibold hover:bg-destructive/10 disabled:opacity-50 cursor-pointer"
        >
          Delete range
        </button>
      </div>

      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorBox message={(error as Error).message} />
      ) : !data || data.length === 0 ? (
        <Empty label="No transactions" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-left px-4 py-2 font-medium">Category</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
                <th className="text-left px-4 py-2 font-medium">Dir.</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{formatDate(t.occurred_at)}</td>
                  <td className="px-4 py-2 truncate max-w-[220px]">{t.description ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{t.category ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(t.amount)}</td>
                  <td className="px-4 py-2">
                    <span className={t.direction === "credit" ? "text-green-700" : "text-muted-foreground"}>
                      {t.direction}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      title="Delete this transaction?"
                      onClick={() => deleteOne(t.id)}
                      disabled={busyId === t.id}
                      aria-label="Delete transaction"
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRangeConfirm && (
        <Modal onClose={() => !rangeBusy && setShowRangeConfirm(false)}>
          <h3 className="text-lg font-semibold">Delete transactions in range?</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Delete all transactions from {formatDate(from)} to {formatDate(to)}? This will affect your
            Live Plan accuracy.
          </p>
          <div className="mt-4 flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowRangeConfirm(false)} disabled={rangeBusy}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={deleteRange}
              disabled={rangeBusy}
              className="inline-flex items-center rounded-md bg-destructive text-destructive-foreground px-3 py-2 text-sm font-semibold hover:bg-destructive/90 disabled:opacity-50 cursor-pointer"
            >
              {rangeBusy ? "Deleting…" : "Delete range"}
            </button>
          </div>
        </Modal>
      )}
    </SectionShell>
  );
}

/* ---------- Danger zone ---------- */

function DangerZone() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onReset = async () => {
    setBusy(true);
    setErr(null);
    try {
      await invokeFn("reset-user-data", { confirmed: true, confirmation_phrase: "RESET" });
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("recovery_plan_active_") || k.startsWith("dhandost_"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {/* ignore */}
      setOpen(false);
      toast.success("All data cleared. Ready for a fresh start.");
      setTimeout(() => navigate({ to: "/" }), 2000);
    } catch (e) {
      setErr((e as Error).message || "Could not reset data");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-lg p-5"
      style={{
        background: "color-mix(in oklab, hsl(var(--destructive)) 6%, transparent)",
        borderLeft: "3px solid hsl(var(--destructive))",
      }}
    >
      <h2 className="font-semibold flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" /> Reset all data
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Permanently deletes all your goals, debts, transactions, commitments, variable expenses,
        income sources, fixed expenses, and chat history. Use this for a fresh UAT start. This
        cannot be undone.
      </p>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => { setPhrase(""); setErr(null); setOpen(true); }}
          className="inline-flex items-center rounded-md border border-destructive/50 text-destructive px-3 py-2 text-sm font-semibold hover:bg-destructive/10 cursor-pointer"
        >
          Reset all my data
        </button>
      </div>

      {open && (
        <Modal onClose={() => !busy && setOpen(false)}>
          <h3 className="text-lg font-semibold">Are you absolutely sure?</h3>
          <p className="text-sm text-muted-foreground mt-2">
            This will erase everything. Your account will remain active but all financial data will
            be permanently deleted.
          </p>
          <div className="mt-4">
            <Input
              autoFocus
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="Type RESET to confirm"
            />
          </div>
          {err && (
            <p className="mt-3 text-sm text-destructive bg-destructive/5 border border-destructive/30 rounded-md px-3 py-2">
              {err}
            </p>
          )}
          <div className="mt-4 flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={onReset}
              disabled={busy || phrase !== "RESET"}
              className="inline-flex items-center gap-2 rounded-md bg-destructive text-destructive-foreground px-3 py-2 text-sm font-semibold hover:bg-destructive/90 disabled:opacity-50 cursor-pointer"
            >
              {busy && <span className="h-3 w-3 rounded-full border-2 border-current border-r-transparent animate-spin" />}
              {busy ? "Deleting…" : "Permanently delete all data"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Modal ---------- */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
