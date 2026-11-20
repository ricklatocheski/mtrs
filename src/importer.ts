import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  fields,
  normalize,
  excludedGenerator,
  signature,
  type DataRow,
  type Batch,
  type MTR,
} from "./domain";
export type Table = { name: string; rows: unknown[][] };
export function decode(bytes: Uint8Array, encoding = "auto"): string {
  if (encoding !== "auto")
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  if (bytes[0] === 255 && bytes[1] === 254)
    return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 254 && bytes[1] === 255)
    return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
export function csvTable(text: string): unknown[][] {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    delimiter: "",
    delimitersToGuess: [";", ",", "\t", "|"],
  });
  const errors = result.errors.filter(
    (e) => e.code !== "UndetectableDelimiter",
  );
  if (errors.length)
    throw Error("CSV inválido: " + errors.map((e) => e.message).join("; "));
  return result.data;
}
export async function readTables(
  file: File,
  encoding = "auto",
): Promise<Table[]> {
  if (file.size > 30 * 1024 * 1024)
    throw Error("O limite por arquivo é 30 MB. Divida o relatório em lotes.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.csv$/i.test(file.name))
    return [{ name: "CSV", rows: csvTable(decode(bytes, encoding)) }];
  if (!/\.xlsx?$/i.test(file.name)) throw Error("Selecione CSV, XLS ou XLSX.");
  const workbook = XLSX.read(bytes, {
    type: "array",
    cellDates: false,
    cellText: true,
  });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet["!ref"]) return { name, rows: [] };
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    if ((range.e.r + 1) * (range.e.c + 1) > 2_000_000)
      throw Error("Planilha muito grande. Divida em arquivos menores.");
    const rows: unknown[][] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: unknown[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        // Preserve formatted identifiers (including Excel custom zero-padding) but keep date serials numeric.
        row.push(
          cell
            ? {
                v: cell.v,
                w: cell.w,
                t: cell.t,
                date1904: !!workbook.Workbook?.WBProps?.date1904,
              }
            : "",
        );
      }
      rows.push(row);
    }
    return { name, rows };
  });
}
type Cell = { v: unknown; w?: string; t?: string; date1904?: boolean };
const cell = (x: unknown): Cell =>
  x !== null && typeof x === "object" && "v" in x ? (x as Cell) : { v: x };
function textValue(x: unknown): string {
  const c = cell(x);
  if (c.v == null) return "";
  if (typeof c.v === "number") {
    if (!Number.isSafeInteger(c.v)) return c.w ?? String(c.v);
    return c.w && !/[eE][+-]?\d/.test(c.w) && /^\d+$/.test(c.w)
      ? c.w
      : String(c.v);
  }
  return String(c.v);
}
export function dateValue(value: unknown): string | null {
  const c = cell(value);
  let y: number, m: number, d: number;
  if (typeof c.v === "number") {
    const x = XLSX.SSF.parse_date_code(c.v, { date1904: c.date1904 });
    if (!x) return null;
    ({ y, m, d } = x);
  } else {
    const str = String(c.v ?? "").trim();
    let a = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
    if (a) {
      d = +a[1];
      m = +a[2];
      y = +a[3];
    } else {
      a = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
      if (!a) return null;
      y = +a[1];
      m = +a[2];
      d = +a[3];
    }
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    y < 1900 ||
    y > 2200 ||
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return null;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
const header = (x: unknown) =>
  normalize(textValue(x))
    .replace(/[º°ª]/g, "O")
    .replace(/[^A-Z0-9]/g, "");
export function prepare(
  table: Table,
  filename: string,
): { batch: Batch; records: MTR[] } {
  const first = table.rows.findIndex((row) =>
    row.some((v) => textValue(v).trim()),
  );
  if (first < 0) throw Error("A aba está vazia.");
  const heads = table.rows[first].map(header);
  const indexes = fields.map((k) => heads.indexOf(header(k)));
  const missing = fields.filter((_, i) => indexes[i] < 0);
  if (missing.length)
    throw Error("Colunas obrigatórias ausentes: " + missing.join(", "));
  if (indexes.some((i) => heads.filter((h) => h === heads[i]).length > 1))
    throw Error(
      "Existem cabeçalhos obrigatórios repetidos. Corrija a planilha.",
    );
  const batch: Batch = {
    id: crypto.randomUUID(),
    name: filename,
    sheet: table.name,
    at: new Date().toISOString(),
    stats: {
      read: 0,
      eligible: 0,
      ignoredStatus: 0,
      ignoredGenerator: 0,
      duplicates: 0,
      inconsistencies: 0,
    },
    issues: [],
    ignored: [],
  };
  const records: MTR[] = [];
  const all: { line: number; data: DataRow; raw: DataRow }[] = [];
  table.rows.slice(first + 1).forEach((row, index) => {
    if (!row.some((v) => textValue(v).trim())) return;
    batch.stats.read++;
    const line = first + index + 2;
    const data = Object.fromEntries(
      fields.map((k, i) => [k, textValue(row[indexes[i]])]),
    ) as DataRow;
    const raw = structuredClone(data);
    data["MTR Nº"] = data["MTR Nº"].trim();
    all.push({ line, data, raw });
    // Classification is exclusive: invalid essentials, situation, generator, eligible/duplicate.
    const date = dateValue(row[indexes[2]]);
    const reason = !/^\d+$/.test(data["MTR Nº"])
      ? "MTR ausente ou inválido: esperado número em texto, sem notação científica."
      : !date
        ? "Data de emissão ausente ou inválida."
        : !data["Gerador Nome"].trim()
          ? "Gerador Nome vazio."
          : !data["Situação"].trim()
            ? "Situação vazia."
            : null;
    if (reason) {
      batch.stats.inconsistencies++;
      batch.issues.push({ line, reason, data, raw });
      return;
    }
    data["Data de Emissão"] = date!;
    if (normalize(data["Situação"]) !== "SALVO") {
      batch.stats.ignoredStatus++;
      batch.ignored.push({
        raw,
        line,
        data,
        reason: "Situação diferente de Salvo.",
      });
      return;
    }
    if (excludedGenerator(data["Gerador Nome"])) {
      batch.stats.ignoredGenerator++;
      batch.ignored.push({
        raw,
        line,
        data,
        reason: "Gerador é GUARARAPES PAINEIS S/A.",
      });
      return;
    }
    const found = records.find((r) => r.id === data["MTR Nº"]);
    if (found) {
      batch.stats.duplicates++;
      found.sources.push({ batch: batch.id, line, data, raw });
      found.conflict ||= signature(found.data) !== signature(data);
    } else
      records.push({
        id: data["MTR Nº"],
        data,
        state: "pendente",
        completedAt: null,
        completedBy: null,
        owner: null,
        lease: null,
        sources: [{ batch: batch.id, line, data, raw }],
        conflict: false,
      });
  });
  for (const r of records)
    for (const a of all.filter((x) => x.data["MTR Nº"] === r.id))
      if (!r.sources.some((x) => x.line === a.line)) {
        r.sources.push({ batch: batch.id, ...a });
        r.conflict = true;
      }
  batch.stats.eligible = records.length;
  return { batch, records };
}
