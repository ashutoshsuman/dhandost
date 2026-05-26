import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, string>[];
};

export async function parseFile(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return parseCSV(file);
  }
  if (name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    return parseXLSX(file);
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return parsePDF(file);
  }
  // try CSV as fallback
  return parseCSV(file);
}

function parseCSV(file: File): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) =>
        resolve({ headers: res.meta.fields ?? [], rows: res.data }),
      error: (err) => reject(err),
    });
  });
}

async function parseXLSX(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  // Pick the sheet with the most rows
  let best: { headers: string[]; rows: Record<string, string>[] } = {
    headers: [],
    rows: [],
  };
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      raw: false,
      dateNF: "yyyy-mm-dd",
    }) as string[][];
    if (!aoa.length) continue;
    // Find header row: row that contains "date" or "narration" etc.
    let headerIdx = 0;
    for (let i = 0; i < Math.min(aoa.length, 25); i++) {
      const joined = (aoa[i] || []).map((c) => String(c ?? "").toLowerCase()).join("|");
      if (/date/.test(joined) && /(amount|debit|credit|withdraw|deposit|balance)/.test(joined)) {
        headerIdx = i;
        break;
      }
    }
    const rawHeaders = (aoa[headerIdx] || []).map((c, i) =>
      String(c ?? "").trim() || `col_${i + 1}`,
    );
    // Deduplicate
    const seen: Record<string, number> = {};
    const headers = rawHeaders.map((h) => {
      seen[h] = (seen[h] ?? 0) + 1;
      return seen[h] > 1 ? `${h}_${seen[h]}` : h;
    });
    const rows: Record<string, string>[] = [];
    for (let i = headerIdx + 1; i < aoa.length; i++) {
      const r = aoa[i] || [];
      if (!r.some((c) => String(c ?? "").trim())) continue;
      const obj: Record<string, string> = {};
      headers.forEach((h, j) => {
        obj[h] = r[j] == null ? "" : String(r[j]);
      });
      rows.push(obj);
    }
    if (rows.length > best.rows.length) best = { headers, rows };
  }
  return best;
}

async function parsePDF(file: File): Promise<ParsedSheet> {
  // dynamic import to avoid SSR issues
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  // Use a worker bundled via vite ?url
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  // Collect text items per line across all pages using y-coordinate grouping
  const allLines: { y: number; page: number; items: { x: number; str: string }[] }[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lineMap = new Map<number, { x: number; str: string }[]>();
    for (const item of tc.items as any[]) {
      const str: string = item.str;
      if (!str || !str.trim()) continue;
      const tr = item.transform as number[];
      const x = tr[4];
      const y = Math.round(tr[5]);
      // bucket by ~3px
      const key = Math.round(y / 3) * 3;
      if (!lineMap.has(key)) lineMap.set(key, []);
      lineMap.get(key)!.push({ x, str });
    }
    for (const [y, items] of lineMap) {
      items.sort((a, b) => a.x - b.x);
      allLines.push({ y, page: p, items });
    }
  }

  // Heuristic: find lines that look like transactions (start with a date)
  const dateRe = /^(\d{1,2}[\/\-\.][A-Za-z0-9]{2,4}[\/\-\.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/;
  const amtRe = /-?[\d,]+\.\d{2}/g;

  const rows: Record<string, string>[] = [];
  for (const line of allLines) {
    // join items with spaces, collapse multiple spaces from large gaps
    const parts = line.items.map((i) => i.str.trim()).filter(Boolean);
    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    if (!dateRe.test(text)) continue;

    const dateMatch = text.match(dateRe)!;
    const date = dateMatch[0];
    const rest = text.slice(dateMatch[0].length).trim();
    const amts = rest.match(amtRe) || [];
    if (!amts.length) continue;

    // Strategy: last numeric usually = balance, the one(s) before = txn amount
    // Try: if there are >= 2 numbers, txn = second-to-last; else txn = last
    const balance = amts.length >= 2 ? amts[amts.length - 1] : "";
    const amount = amts.length >= 2 ? amts[amts.length - 2] : amts[amts.length - 1];

    // Description = text between date and first amount
    const firstAmtIdx = rest.indexOf(amts[0]);
    const description = (firstAmtIdx > 0 ? rest.slice(0, firstAmtIdx) : rest).trim();

    // Try to detect Dr/Cr markers
    const drcr = /\b(cr|dr)\b/i.exec(rest);
    let debit = "";
    let credit = "";
    if (drcr) {
      if (drcr[1].toLowerCase() === "cr") credit = amount;
      else debit = amount;
    } else if (amts.length >= 3) {
      // some statements have separate debit & credit columns; assume order debit, credit, balance
      debit = amts[amts.length - 3];
      credit = amts[amts.length - 2];
    }

    rows.push({
      Date: date,
      Description: description,
      Amount: amount,
      Debit: debit,
      Credit: credit,
      Balance: balance,
    });
  }

  return {
    headers: ["Date", "Description", "Amount", "Debit", "Credit", "Balance"],
    rows,
  };
}
