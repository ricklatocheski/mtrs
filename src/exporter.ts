import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  fields,
  display,
  effectiveState,
  type Snapshot,
  type MTR,
} from "./domain";
export function safe(value: unknown) {
  const s = String(value ?? "");
  return /^[\s\u0000-\u001f]*[=+@\-]/.test(s) ? "'" + s : s;
}
export function rowsFor(records: MTR[]) {
  return records.map((r) =>
    Object.fromEntries([
      ...fields.map((k) => [
        k,
        safe(
          ["Motorista", "Placa", "Observações do Gerador"].includes(k)
            ? display(r.data[k])
            : r.data[k],
        ),
      ]),
      ["Estado de acompanhamento", effectiveState(r)],
      ["Data e hora da conclusão", r.completedAt ?? ""],
      ["Operador da conclusão", r.completedBy ?? ""],
      ["Divergência", r.conflict ? "Revisão necessária" : ""],
      ["Origens", r.sources.length],
    ]),
  );
}
export function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function exportData(doc: Snapshot, scope: string, format: string) {
  const records = doc.records.filter((r) =>
    scope === "pendentes"
      ? effectiveState(r) !== "concluido"
      : scope === "concluidos"
        ? r.state === "concluido"
        : true,
  );
  const historyHeaders = [
    ...fields,
    "Estado de acompanhamento",
    "Data e hora da conclusão",
    "Operador da conclusão",
    "Divergência",
    "Origens",
    "Ação",
    "Data do evento",
    "Operador do evento",
    "Detalhes",
  ];
  const rows =
    scope === "historico"
      ? doc.events.map((e) => {
          const r = doc.records.find((r) => r.id === e.mtr);
          return {
            ...(r
              ? rowsFor([r])[0]
              : Object.fromEntries(
                  fields.map((k) => [k, k === "MTR Nº" ? safe(e.mtr) : ""]),
                )),
            Ação: safe(e.action),
            "Data do evento": e.at,
            "Operador do evento": safe(e.actor),
            Detalhes: safe(e.detail),
          };
        })
      : rowsFor(records);
  const name = `guararapes-${scope}-${new Date().toISOString().slice(0, 10)}`;
  if (format === "csv")
    download(
      "\uFEFF" +
        Papa.unparse(rows, {
          delimiter: ";",
          newline: "\r\n",
          columns:
            scope === "historico"
              ? historyHeaders
              : [
                  ...fields,
                  "Estado de acompanhamento",
                  "Data e hora da conclusão",
                  "Operador da conclusão",
                  "Divergência",
                  "Origens",
                ],
        }),
      name + ".csv",
      "text/csv;charset=utf-8",
    );
  else {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows, {
      header:
        scope === "historico"
          ? historyHeaders
          : [
              ...fields,
              "Estado de acompanhamento",
              "Data e hora da conclusão",
              "Operador da conclusão",
              "Divergência",
              "Origens",
            ],
    });
    XLSX.utils.book_append_sheet(book, sheet, "MTR");
    download(
      XLSX.write(book, { type: "array", bookType: "xlsx" }),
      name + ".xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  }
}
export function exportBackup(snapshot: Snapshot) {
  download(
    JSON.stringify(
      {
        format: "guararapes-mtr",
        version: 1,
        exportedAt: new Date().toISOString(),
        snapshot,
      },
      null,
      2,
    ),
    "guararapes-backup-" + new Date().toISOString().slice(0, 10) + ".json",
    "application/json",
  );
}
