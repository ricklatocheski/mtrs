import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import * as XLSX from "xlsx";
import {
  fields,
  empty,
  reduce,
  excludedGenerator,
  display,
  effectiveState,
  validateBackup,
  type MTR,
} from "../src/domain";
import {
  csvTable,
  decode,
  prepare,
  dateValue,
  readTables,
} from "../src/importer";
import { safe, rowsFor } from "../src/exporter";
import { localApply, localLoad } from "../src/storage";
const headers = [...fields, "Destinador Nome", "Extra"];
const line = (
  id = "000123",
  status = "Salvo",
  generator = "FORNECEDOR SINTÉTICO",
  note = "",
) => [
  id,
  status,
  "20/11/2026",
  "",
  " ",
  generator,
  note,
  "GUARARAPES PAINEIS S/A",
  "ignorar",
];
const sample = (rows: unknown[][] = [line()]) =>
  prepare({ name: "Dados", rows: [headers, ...rows] }, "sintetico.csv");
describe("importação e regras auditáveis", () => {
  it("lê CSV com ;, aspas, acentos, observações multilinha e colunas fora de ordem", () => {
    const csv =
      'Extra;Observações do Gerador;Placa;Motorista;Data de Emissão;Situação;MTR Nº;Gerador Nome;Destinador Nome\r\nx;"Madeira; \"\"limpa\"\"\nAtenção";;;20/11/2026;Salvo;00001;FORNECEDOR;GUARARAPES PAINEIS S/A';
    const p = prepare({ name: "CSV", rows: csvTable(csv) }, "x.csv");
    expect(p.records[0].id).toBe("00001");
    expect(p.records[0].data["Observações do Gerador"]).toBe(
      'Madeira; "limpa"\nAtenção',
    );
    expect(p.records).toHaveLength(1);
  });
  it("exclui apenas o gerador exato com S/A equivalente e aceita as outras empresas", () => {
    for (const s of [
      " GUARARAPES   PAINÉIS s/a ",
      "Guararapes Painéis S.A.",
      "guararapes paineis sa",
      "GUARARAPES PAINEIS S / A",
    ])
      expect(excludedGenerator(s)).toBe(true);
    for (const s of [
      "INDUSTRIA DE COMPENSADOS GUARARAPES",
      "Industria de Compensados Guararapes Ltda",
      "GUARARAPES PAINEIS S/A OUTRA",
    ])
      expect(excludedGenerator(s)).toBe(false);
    const p = sample([
      line("01"),
      line("02", "MTR recebido"),
      line("03", "Cancelado"),
      line("04", "Salvo", "GUARARAPES PAINEIS S/A"),
      line("05", "Salvo", "INDUSTRIA DE COMPENSADOS GUARARAPES"),
      line("06", "Salvo", "Industria de Compensados Guararapes Ltda"),
    ]);
    expect(p.records.map((r) => r.id)).toEqual(["01", "05", "06"]);
    expect(p.batch.stats).toMatchObject({
      read: 6,
      eligible: 3,
      ignoredStatus: 2,
      ignoredGenerator: 1,
    });
  });
  it("consolida duplicidades e sinaliza divergências preservando origens", () => {
    const p = sample([line(), line(), line("000123", "Salvo", "OUTRA ORIGEM")]);
    expect(p.records).toHaveLength(1);
    expect(p.records[0].sources).toHaveLength(3);
    expect(p.records[0].conflict).toBe(true);
    expect(p.batch.stats.duplicates).toBe(2);
  });
  it("sinaliza também quando o mesmo MTR tem situações de origem divergentes", () => {
    const p = sample([line(), line("000123", "Cancelado")]);
    expect(p.records[0].conflict).toBe(true);
    expect(p.records[0].sources).toHaveLength(2);
  });
  it("explica inconsistências e fecha a equação de contagem", () => {
    const p = sample([
      line(""),
      ["02", "Salvo", "31/02/2026", "", "", "Gerador", ""],
      line("01"),
      line("01"),
      line("03", "Cancelado"),
    ]);
    const s = p.batch.stats;
    expect(s.inconsistencies).toBe(2);
    expect(s.read).toBe(
      s.eligible +
        s.duplicates +
        s.ignoredStatus +
        s.ignoredGenerator +
        s.inconsistencies,
    );
  });
  it("valida cabeçalhos e normaliza acentos e espaços", () => {
    expect(() =>
      prepare({ name: "x", rows: [["MTR Nº"], ["01"]] }, "x"),
    ).toThrow("Situação");
    const h = headers.map(
      (s) =>
        s
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase() + "  ",
    );
    expect(prepare({ name: "x", rows: [h, line()] }, "x").records).toHaveLength(
      1,
    );
  });
  it("preserva vazios e só exibe GRC nos campos definidos", () => {
    const r = sample().records[0];
    expect(r.data.Motorista).toBe("");
    expect(display(r.data.Motorista)).toBe("GRC");
    expect(display(" ")).toBe("GRC");
    expect(display("João")).toBe("João");
    expect(display(r.data.Placa)).toBe("GRC");
    expect(display(r.data["Observações do Gerador"])).toBe("GRC");
  });
  it("interpreta datas brasileiras, seriais Excel e rejeita datas impossíveis", () => {
    expect(dateValue("02/03/2026")).toBe("02/03/2026");
    expect(dateValue(45292)).toBe("01/01/2024");
    expect(dateValue("31/02/2026")).toBe(null);
    expect(dateValue("2026-11-20")).toBe("20/11/2026");
  });
  it("decodifica UTF-8, Windows-1252 e UTF-16 com BOM", () => {
    expect(decode(new Uint8Array([0x4a, 0x6f, 0xe3, 0x6f]))).toBe("João");
    expect(decode(new TextEncoder().encode("Atenção"))).toBe("Atenção");
    expect(decode(new Uint8Array([255, 254, 65, 0]))).toBe("A");
  });
  it.each(["xlsx", "xls"] as const)(
    "lê %s com múltiplas abas, zeros formatados e data numérica",
    async (ext) => {
      const book = XLSX.utils.book_new();
      const sh = XLSX.utils.aoa_to_sheet([
        headers,
        [
          123,
          "Salvo",
          45292,
          "",
          "",
          "FORNECEDOR",
          "",
          "GUARARAPES PAINEIS S/A",
        ],
      ]);
      sh.A2.z = "000000";
      XLSX.utils.book_append_sheet(book, sh, "A");
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.aoa_to_sheet([headers, line("00099")]),
        "B",
      );
      const bytes = XLSX.write(book, {
        type: "array",
        bookType: ext === "xls" ? "biff8" : "xlsx",
      });
      const tables = await readTables(new File([bytes], "dados." + ext));
      expect(tables).toHaveLength(2);
      const p = prepare(tables[0], "dados." + ext);
      expect(p.records[0].id).toBe("000123");
      expect(p.records[0].data["Data de Emissão"]).toBe("01/01/2024");
    },
  );
});
describe("acompanhamento, concorrência e backup", () => {
  it("sinaliza alteração posterior para Cancelado sem apagar uma conclusão anterior", () => {
    const p = sample([line("01")]);
    let s = reduce(empty(), { type: "import", ...p }, "A");
    s = reduce(s, { type: "claim", id: "01" }, "A");
    s = reduce(s, { type: "complete", id: "01" }, "A");
    s = reduce(
      s,
      { type: "import", ...sample([line("01", "Cancelado")]) },
      "A",
    );
    expect(s.records[0].state).toBe("concluido");
    expect(s.records[0].conflict).toBe(true);
    expect(s.records[0].sources.at(-1)?.data.Situação).toBe("Cancelado");
    expect(s.records[0].data.Situação).toBe("Salvo");
  });
  const now = "2026-11-20T15:00:00.000Z";
  const actor = "operador-A";
  const initial = () => {
    const p = sample([line("01"), line("02")]);
    return reduce(empty(), { type: "import", ...p }, actor, now);
  };
  it("abrir reserva e jamais conclui automaticamente; só a confirmação conclui", () => {
    let s = initial();
    s = reduce(s, { type: "claim", id: "01" }, actor, now);
    expect(s.records[0].state).toBe("conferencia");
    s = reduce(s, { type: "complete", id: "01" }, actor, now);
    expect(s.records[0].state).toBe("concluido");
    expect(s.records[0].data.Situação).toBe("Salvo");
    expect(s.records[0].completedBy).toBe(actor);
    expect(() => reduce(s, { type: "complete", id: "01" }, actor, now)).toThrow(
      "já foi concluído",
    );
  });
  it("pula, retoma, desfaz e reabre com auditoria", () => {
    let s = initial();
    s = reduce(s, { type: "claim", id: "01" }, actor, now);
    s = reduce(s, { type: "release", id: "01" }, actor, now);
    expect(s.records[0].state).toBe("pendente");
    s = reduce(s, { type: "claim", id: "01" }, actor, now);
    s = reduce(s, { type: "complete", id: "01" }, actor, now);
    s = reduce(s, { type: "undo", id: "01" }, actor, now);
    expect(s.records[0].completedAt).toBe(null);
    s = reduce(s, { type: "claim", id: "01" }, actor, now);
    s = reduce(s, { type: "complete", id: "01" }, actor, now);
    s = reduce(s, { type: "reopen", id: "01" }, actor, now);
    expect(s.events.some((e) => e.action === "Reaberto")).toBe(true);
  });
  it("bloqueia outros operadores até a reserva expirar", () => {
    const s = reduce(initial(), { type: "claim", id: "01" }, actor, now);
    expect(() => reduce(s, { type: "claim", id: "01" }, "B", now)).toThrow(
      "reservado",
    );
    expect(effectiveState(s.records[0], Date.parse(now) + 300001)).toBe(
      "pendente",
    );
    expect(() =>
      reduce(
        s,
        { type: "complete", id: "01" },
        actor,
        "2026-11-20T15:06:00.000Z",
      ),
    ).toThrow("expirou");
    expect(
      reduce(s, { type: "claim", id: "01" }, "B", "2026-11-20T15:06:00.000Z")
        .records[0].owner,
    ).toBe("B");
  });
  it("reimportação conserva a conclusão e assinala alteração", () => {
    let s = reduce(initial(), { type: "claim", id: "01" }, actor, now);
    s = reduce(s, { type: "complete", id: "01" }, actor, now);
    s = reduce(
      s,
      { type: "import", ...sample([line("01", "Salvo", "NOVO GERADOR")]) },
      actor,
      now,
    );
    expect(s.records[0].state).toBe("concluido");
    expect(s.records[0].data["Gerador Nome"]).toBe("FORNECEDOR SINTÉTICO");
    expect(s.records[0].conflict).toBe(true);
    expect(s.records[0].sources).toHaveLength(2);
  });
  it("bloqueia conclusão divergente e libera após revisão de origem", () => {
    let s = reduce(
      empty(),
      { type: "import", ...sample([line("01"), line("01", "Salvo", "OUTRA")]) },
      actor,
      now,
    );
    s = reduce(s, { type: "claim", id: "01" }, actor, now);
    expect(() => reduce(s, { type: "complete", id: "01" }, actor, now)).toThrow(
      "divergentes",
    );
    s = reduce(
      s,
      { type: "resolve", id: "01", data: s.records[0].sources[1].data },
      actor,
      now,
    );
    expect(
      reduce(s, { type: "complete", id: "01" }, actor, now).records[0].state,
    ).toBe("concluido");
  });
  it("valida backup antes de restaurar e preserva conclusão na mesclagem", () => {
    let s = reduce(initial(), { type: "claim", id: "01" }, actor, now);
    s = reduce(s, { type: "complete", id: "01" }, actor, now);
    const valid = validateBackup({
      format: "guararapes-mtr",
      version: 1,
      snapshot: initial(),
    });
    s = reduce(
      s,
      { type: "restore", snapshot: valid, replace: false },
      actor,
      now,
    );
    expect(s.records[0].state).toBe("concluido");
    expect(() => validateBackup({ format: "outro" })).toThrow();
    const invalid = initial();
    invalid.records[0].id = "bad";
    expect(() =>
      validateBackup({
        format: "guararapes-mtr",
        version: 1,
        snapshot: invalid,
      }),
    ).toThrow();
  });
  it("IndexedDB serializa ações concorrentes e mantém dados em nova leitura", async () => {
    await localApply(
      { type: "restore", snapshot: empty(), replace: true },
      actor,
    );
    await localApply({ type: "import", ...sample([line("01")]) }, actor);
    const results = await Promise.allSettled([
      localApply({ type: "claim", id: "01" }, "A"),
      localApply({ type: "claim", id: "01" }, "B"),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await localLoad()).records[0].state).toBe("conferencia");
  });
  it("neutraliza fórmulas no CSV/XLSX e conserva zeros à esquerda", () => {
    for (const s of ["=CMD()", " +SUM(1)", "\t@x", "-1"])
      expect(safe(s)).toBe("'" + s);
    expect(safe("00001")).toBe("00001");
    const r = sample([line("00001", "Salvo", "=1+1")]).records[0];
    const rows = rowsFor([r]);
    expect(rows[0]["Gerador Nome"]).toBe("'=1+1");
    expect(rows[0]["MTR Nº"]).toBe("00001");
  });
});
