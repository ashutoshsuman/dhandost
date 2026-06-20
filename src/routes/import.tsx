import { createFileRoute } from "@tanstack/react-router";
import { parseFile } from "@/lib/parse-statement";
import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button, Field, Input, Select } from "@/components/ui-primitives";
import SecureUploadPanel from "@/components/SecureUploadPanel";

import { supabase } from "@/lib/supabase";
import { invokeFn } from "@/lib/invokeFn";
import { formatINR } from "@/lib/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/import")({
  component: () => (
    <Layout>
      <ImportPage />
    </Layout>
  ),
});

type Mapping = {
  date: string;
  description: string;
  amount: string;
  debit: string;
  credit: string;
  mode: "single" | "split";
};

const CATEGORIES = ["Food", "Transport", "Rent", "Utilities", "Shopping", "Health", "Entertainment", "Salary", "Investment", "Transfer", "Other"];

function guessCol(headers: string[], patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = headers.find((h) => p.test(h));
    if (m) return m;
  }
  return "";
}

function parseDate(s: string): string | null {
  if (!s) return null;
  s = s.trim();
  // dd/mm/yyyy or dd-mm-yyyy
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) {
    let [, d, mo, y] = m1;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2,"0")}-${m2[3].padStart(2,"0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseAmount(s: string): number | null {
  if (s === undefined || s === null) return null;
  const cleaned = String(s).replace(/[,₹\s]/g, "").trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.abs(n);
}

function ImportPage() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({
    date: "", description: "", amount: "", debit: "", credit: "", mode: "split",
  });
  const [defaultCategory, setDefaultCategory] = useState("");
  const [fileName, setFileName] = useState("");

  const onFile = async (file: File) => {
    setFileName(file.name);
    setHeaders([]);
    setRows([]);
    try {
      const { headers: hs, rows: rs } = await parseFile(file);
      setHeaders(hs);
      setRows(rs);
      const hasDebitCredit = guessCol(hs, [/debit|withdraw/i]) && guessCol(hs, [/credit|deposit/i]);
      const detectedMode = hasDebitCredit ? "split" : "single";
      setMapping({
        date: guessCol(hs, [/date|txn.?date|value.?date/i]),
        description: guessCol(hs, [/desc|narration|particulars|details|remarks/i]),
        amount: guessCol(hs, [/^amount$|amt/i]),
        debit: guessCol(hs, [/debit|withdraw/i]),
        credit: guessCol(hs, [/credit|deposit/i]),
        mode: detectedMode,
      });
      if (typeof pendo !== 'undefined') {
        pendo.track("bank_statement_parsed", {
          file_name: file.name,
          file_type: file.name.split(".").pop() || "",
          total_rows: rs.length,
          detected_columns: hs.length,
          column_mapping_mode: detectedMode,
        });
      }
    } catch (e) {
      console.error("Failed to parse file", e);
      alert("Could not parse this file. Try CSV or XLSX.");
    }
  };

  const preview = useMemo(() => {
    return rows.map((r) => {
      const occurred_at = parseDate(r[mapping.date] ?? "");
      const description = r[mapping.description] ?? "";
      let amount: number | null = null;
      let direction: "credit" | "debit" = "debit";
      if (mapping.mode === "split") {
        const d = parseAmount(r[mapping.debit] ?? "");
        const c = parseAmount(r[mapping.credit] ?? "");
        if (c && c > 0) { amount = c; direction = "credit"; }
        else if (d && d > 0) { amount = d; direction = "debit"; }
      } else {
        const raw = r[mapping.amount] ?? "";
        const sign = String(raw).trim().startsWith("-") ? "debit" : "credit";
        amount = parseAmount(raw);
        direction = sign;
      }
      const valid = !!occurred_at && amount !== null && amount > 0;
      return { occurred_at, description, amount, direction, valid, raw: r };
    });
  }, [rows, mapping]);

  const validCount = preview.filter((p) => p.valid).length;

  const importMut = useMutation({
    mutationFn: async () => {
      const payload = preview
        .filter((p) => p.valid)
        .map((p) => ({
          occurred_at: p.occurred_at!,
          amount: p.amount!,
          direction: p.direction,
          description: p.description || null,
          category: defaultCategory || null,
          source: "csv" as const,
        }));
      // chunk to avoid huge inserts
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase.from("transactions").insert(payload.slice(i, i + 500));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      const validRows = preview.filter((p) => p.valid).length;
      if (typeof pendo !== 'undefined') {
        pendo.track("bank_statement_imported", {
          file_name: fileName,
          file_type: fileName.split(".").pop() || "",
          total_rows: preview.length,
          valid_rows: validRows,
          skipped_rows: preview.length - validRows,
          default_category: defaultCategory || "",
          column_mapping_mode: mapping.mode,
        });
      }
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setRows([]); setHeaders([]); setFileName("");
      // fire-and-forget AI categorization of newly imported rows
      invokeFn("categorize-transactions", { limit: 500 })
        .then(() => qc.invalidateQueries({ queryKey: ["transactions"] }))
        .catch((e) => console.error("categorize-transactions failed", e));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import CSV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a bank statement (CSV, XLS/XLSX). Map the columns, preview, then confirm.
        </p>
      </div>

      <SecureUploadPanel />

      <div className="rounded-lg border border-border bg-card p-5">

        <Field label="Statement file">
          <input
            type="file"
            accept=".csv,.xls,.xlsx,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="text-sm cursor-pointer w-full"
          />
        </Field>
        {fileName && <p className="text-xs text-muted-foreground mt-2">{fileName} · {rows.length} rows</p>}
      </div>

      {headers.length > 0 && (
        <>
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Column mapping</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Date column">
                <ColSelect headers={headers} value={mapping.date} onChange={(v) => setMapping({ ...mapping, date: v })} />
              </Field>
              <Field label="Description column">
                <ColSelect headers={headers} value={mapping.description} onChange={(v) => setMapping({ ...mapping, description: v })} />
              </Field>
              <Field label="Amount style">
                <Select value={mapping.mode} onChange={(e) => setMapping({ ...mapping, mode: e.target.value as any })}>
                  <option value="split">Separate Debit / Credit columns</option>
                  <option value="single">Single Amount column (signed)</option>
                </Select>
              </Field>
              {mapping.mode === "split" ? (
                <>
                  <Field label="Debit column">
                    <ColSelect headers={headers} value={mapping.debit} onChange={(v) => setMapping({ ...mapping, debit: v })} />
                  </Field>
                  <Field label="Credit column">
                    <ColSelect headers={headers} value={mapping.credit} onChange={(v) => setMapping({ ...mapping, credit: v })} />
                  </Field>
                </>
              ) : (
                <Field label="Amount column">
                  <ColSelect headers={headers} value={mapping.amount} onChange={(v) => setMapping({ ...mapping, amount: v })} />
                </Field>
              )}
              <Field label="Default category (optional)">
                <Select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}>
                  <option value="">—</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Preview</h2>
                <p className="text-xs text-muted-foreground">
                  {validCount} valid · {preview.length - validCount} skipped
                </p>
              </div>
              <Button
                disabled={validCount === 0 || importMut.isPending}
                onClick={() => importMut.mutate()}
              >
                {importMut.isPending ? "Importing…" : `Import ${validCount} rows`}
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-left px-4 py-2 font-medium">Description</th>
                    <th className="text-right px-4 py-2 font-medium">Amount</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.slice(0, 200).map((p, i) => (
                    <tr key={i} className={p.valid ? "" : "opacity-60"}>
                      <td className="px-4 py-1.5 tabular-nums">{p.occurred_at ?? "—"}</td>
                      <td className="px-4 py-1.5 truncate max-w-xs">{p.description || "—"}</td>
                      <td
                        className="px-4 py-1.5 text-right tabular-nums"
                        style={{ color: p.direction === "credit" ? "var(--credit)" : "var(--debit)" }}
                      >
                        {p.amount !== null ? `${p.direction === "credit" ? "+" : "−"}${formatINR(p.amount)}` : "—"}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-muted-foreground">
                        {p.valid ? "OK" : "Skip"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 200 && (
                <p className="px-4 py-2 text-xs text-muted-foreground">Showing first 200 of {preview.length}.</p>
              )}
            </div>
            {importMut.isError && (
              <p className="px-5 py-3 text-sm text-destructive">{(importMut.error as Error).message}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ColSelect({ headers, value, onChange }: { headers: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
    </Select>
  );
}
