import { useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

type Txn = {
  id: string;
  amount: number | string;
  category: string | null;
  category_source?: string | null;
  needs_ai_categorization?: boolean | null;
  occurred_at: string;
  description?: string | null;
};

function descOf(row: Txn) {
  if (row.description && String(row.description).trim()) return String(row.description).trim();
  return "(no description)";
}

function formatINR(n: number | string, currency = "₹") {
  return `${currency}${Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-IN")}`;
}

async function fetchCategories(): Promise<string[]> {
  const set = new Set<string>();
  const { data: tx } = await supabase
    .from("transactions")
    .select("category")
    .not("category", "is", null);
  for (const r of (tx as { category: string | null }[]) ?? []) {
    const c = (r.category ?? "").trim();
    if (c) set.add(c);
  }
  try {
    const { data: fx } = await supabase
      .from("fixed_expenses")
      .select("category")
      .not("category", "is", null);
    for (const r of (fx as { category: string | null }[]) ?? []) {
      const c = (r.category ?? "").trim();
      if (c) set.add(c);
    }
  } catch {
    /* ignore */
  }
  const list = [...set].sort();
  if (!list.includes("Other")) list.push("Other");
  return list;
}

async function saveCorrection(transactionId: string, category: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/learn-category-rule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      transaction_id: transactionId,
      category,
      apply_to_existing: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save category");
  }
  return res.json();
}

export function CategoryEditor({
  transaction,
  categories: catsProp,
  onSaved,
}: {
  transaction: Txn;
  categories?: string[];
  onSaved?: (id: string, category: string, result: unknown) => void;
}) {
  const [cats, setCats] = useState<string[]>(catsProp ?? []);
  const [value, setValue] = useState(transaction.category ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!catsProp) fetchCategories().then(setCats).catch(() => {});
  }, [catsProp]);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (!next || next === transaction.category) {
      setValue(next);
      return;
    }
    setValue(next);
    setSaving(true);
    setSaved(false);
    try {
      const result = await saveCorrection(transaction.id, next);
      setSaved(true);
      onSaved?.(transaction.id, next, result);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setValue(transaction.category ?? "");
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const isAI = transaction.category_source === "ai";
  const isUnclassified = !transaction.category;

  return (
    <div className="inline-flex items-center gap-1.5">
      <select
        value={value}
        onChange={onChange}
        disabled={saving}
        className="text-xs px-2 py-1 rounded-md border border-border bg-background text-foreground max-w-[160px]"
      >
        <option value="" disabled={!isUnclassified}>
          {isUnclassified ? "Pick a category…" : "—"}
        </option>
        {cats.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {isAI && !saved && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-[#8b7fd6] bg-[#f0edfb] tracking-wider">
          AI
        </span>
      )}
      {saving && <span className="text-xs text-muted-foreground">saving…</span>}
      {saved && <span className="text-xs text-primary">✓ saved</span>}
    </div>
  );
}

export function ReviewCategories({ currency = "₹" }: { currency?: string }) {
  const [rows, setRows] = useState<Txn[]>([]);
  const [, setCats] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const [{ data }, categories] = await Promise.all([
      supabase
        .from("transactions")
        .select("id,amount,category,category_source,needs_ai_categorization,occurred_at,description")
        .or("category_source.eq.ai,needs_ai_categorization.eq.true")
        .order("occurred_at", { ascending: false })
        .limit(200),
      fetchCategories(),
    ]);
    setRows((data as Txn[]) ?? []);
    setCats(categories);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const pending = useMemo(
    () => rows.filter((r) => !confirmedIds.has(r.id)),
    [rows, confirmedIds],
  );

  function markConfirmed(id: string) {
    setConfirmedIds((prev) => new Set(prev).add(id));
  }

  async function confirmAsIs(row: Txn) {
    if (!row.category) return;
    try {
      await saveCorrection(row.id, row.category);
      markConfirmed(row.id);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (loading) {
    return <div className="text-center text-muted-foreground py-10">Loading transactions to review…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Review categories</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pending.length === 0
            ? "All caught up — nothing to review."
            : `${pending.length} transaction${pending.length === 1 ? "" : "s"} to confirm or correct.`}
        </p>
      </div>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          {pending.map((row) => (
            <div
              key={row.id}
              className="flex justify-between items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{descOf(row)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(row.occurred_at).toLocaleDateString("en-IN")} · {formatINR(row.amount, currency)}
                  {row.category_source === "ai" && row.category && (
                    <span className="text-[#8b7fd6]"> · AI guessed "{row.category}"</span>
                  )}
                  {!row.category && <span className="text-[#e0a44c]"> · not categorized</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <CategoryEditor
                  transaction={row}
                  onSaved={(id) => markConfirmed(id)}
                />
                {row.category_source === "ai" && row.category && (
                  <button
                    onClick={() => confirmAsIs(row)}
                    className="text-xs px-3 py-1.5 rounded-md border border-primary text-primary font-medium hover:bg-primary/5"
                  >
                    Looks right
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && (
        <div className="flex items-center justify-center gap-3 py-10 text-primary">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 font-bold">
            ✓
          </span>
          Everything's categorized.
        </div>
      )}
    </div>
  );
}
