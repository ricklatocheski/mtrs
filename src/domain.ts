import { z } from "zod";
export const fields = [
  "MTR Nº",
  "Situação",
  "Data de Emissão",
  "Motorista",
  "Placa",
  "Gerador Nome",
  "Observações do Gerador",
] as const;
export type DataRow = Record<(typeof fields)[number], string>;
export type State = "pendente" | "conferencia" | "concluido";
export type Source = {
  batch: string;
  line: number;
  data: DataRow;
  raw?: DataRow;
};
export type MTR = {
  id: string;
  data: DataRow;
  state: State;
  completedAt: string | null;
  completedBy: string | null;
  owner: string | null;
  lease: string | null;
  sources: Source[];
  conflict: boolean;
};
export type Issue = {
  line: number;
  reason: string;
  data: DataRow;
  raw?: DataRow;
};
export type Batch = {
  id: string;
  name: string;
  sheet: string;
  at: string;
  stats: {
    read: number;
    eligible: number;
    ignoredStatus: number;
    ignoredGenerator: number;
    duplicates: number;
    inconsistencies: number;
  };
  issues: Issue[];
  ignored: Issue[];
};
export type Event = {
  id: string;
  at: string;
  actor: string;
  action: string;
  mtr: string;
  detail: string;
};
export type Snapshot = { records: MTR[]; batches: Batch[]; events: Event[] };
export type Command =
  | { type: "import"; records: MTR[]; batch: Batch }
  | { type: "claim" | "release" | "complete" | "reopen" | "undo"; id: string }
  | { type: "resolve"; id: string; data: DataRow }
  | { type: "restore"; snapshot: Snapshot; replace: boolean };
export const empty = (): Snapshot => ({ records: [], batches: [], events: [] });
export const normalize = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
export const excludedGenerator = (s: string) =>
  /^GUARARAPES PAINEIS S\s*[/.]?\s*A\.?$/.test(normalize(s));
export const display = (s: string) => (s.trim() ? s : "GRC");
export const signature = (d: DataRow) =>
  JSON.stringify(fields.map((k) => d[k]));
export const effectiveState = (r: MTR, now = Date.now()): State =>
  r.state === "conferencia" && (!r.lease || Date.parse(r.lease) <= now)
    ? "pendente"
    : r.state;
export function reduce(
  doc: Snapshot,
  cmd: Command,
  actor: string,
  now = new Date().toISOString(),
): Snapshot {
  const s = structuredClone(doc);
  const log = (action: string, mtr: string, detail = "") =>
    s.events.push({
      id: crypto.randomUUID(),
      at: now,
      actor,
      action,
      mtr,
      detail,
    });
  if (cmd.type === "import") {
    for (const incoming of cmd.records) {
      const r = s.records.find((x) => x.id === incoming.id);
      if (r) {
        if (signature(r.data) !== signature(incoming.data)) {
          r.conflict = true;
          log(
            "Dados divergentes",
            r.id,
            "Dados vigentes preservados; consulte as origens.",
          );
        }
        r.sources.push(...incoming.sources);
        r.conflict ||= incoming.conflict;
      } else s.records.push(structuredClone(incoming));
    }
    for (const origin of [...cmd.batch.ignored, ...cmd.batch.issues]) {
      const existing = s.records.find((r) => r.id === origin.data["MTR Nº"]);
      if (
        existing &&
        !existing.sources.some(
          (src) => src.batch === cmd.batch.id && src.line === origin.line,
        )
      ) {
        existing.sources.push({
          batch: cmd.batch.id,
          line: origin.line,
          data: origin.data,
          raw: origin.raw,
        });
        existing.conflict = true;
        log(
          "Dados divergentes",
          existing.id,
          "Nova origem ignorada ou inconsistente: " +
            origin.reason +
            " Dados vigentes e conclusão preservados.",
        );
      }
    }
    s.batches.push(cmd.batch);
    log("Importação", "", cmd.batch.name);
    return s;
  }
  if (cmd.type === "restore") {
    // Existing conclusions and leases survive merge. Replace requires explicit UI confirmation.
    if (cmd.replace) {
      s.records = cmd.snapshot.records;
      s.batches = cmd.snapshot.batches;
      s.events = cmd.snapshot.events;
    } else {
      for (const r of cmd.snapshot.records) {
        const old = s.records.find((x) => x.id === r.id);
        if (!old) s.records.push(r);
        else {
          old.conflict ||= signature(old.data) !== signature(r.data);
          old.sources.push(
            ...r.sources.filter(
              (a) =>
                !old.sources.some(
                  (b) => JSON.stringify(a) === JSON.stringify(b),
                ),
            ),
          );
        }
      }
      s.batches.push(
        ...cmd.snapshot.batches.filter(
          (b) => !s.batches.some((x) => x.id === b.id),
        ),
      );
      s.events.push(
        ...cmd.snapshot.events.filter(
          (e) => !s.events.some((x) => x.id === e.id),
        ),
      );
    }
    log(
      "Backup restaurado",
      "",
      cmd.replace
        ? "Substituição explícita"
        : "Mesclagem preservando acompanhamento atual",
    );
    return s;
  }
  const r = s.records.find((x) => x.id === cmd.id);
  if (!r) throw Error("MTR não encontrado.");
  const active = effectiveState(r, Date.parse(now));
  if (active === "conferencia" && r.owner !== actor)
    throw Error(
      "Este MTR está reservado por outro operador. Atualize e tente novamente após a liberação.",
    );
  if (cmd.type === "claim") {
    if (active === "concluido") return s;
    r.state = "conferencia";
    r.owner = actor;
    r.lease = new Date(Date.parse(now) + 5 * 60_000).toISOString();
    log("Em conferência", r.id);
  } else if (cmd.type === "resolve") {
    if (!r.sources.some((x) => signature(x.data) === signature(cmd.data)))
      throw Error("Origem não encontrada.");
    if (
      normalize(cmd.data["Situação"]) !== "SALVO" ||
      excludedGenerator(cmd.data["Gerador Nome"])
    )
      throw Error("A origem escolhida não é elegível.");
    r.data = cmd.data;
    r.conflict = false;
    log(
      "Divergência revisada",
      r.id,
      "Origem escolhida: " + signature(cmd.data),
    );
  } else if (cmd.type === "release") {
    if (active === "concluido") return s;
    r.state = "pendente";
    r.owner = null;
    r.lease = null;
    log("Pulado / liberado", r.id);
  } else if (cmd.type === "complete") {
    if (active === "concluido") throw Error("Este MTR já foi concluído.");
    if (active !== "conferencia" || r.owner !== actor)
      throw Error("Reserve o MTR novamente: a reserva expirou.");
    if (r.conflict)
      throw Error(
        "Existem dados divergentes. Revise e escolha uma origem antes de confirmar.",
      );
    r.state = "concluido";
    r.completedAt = now;
    r.completedBy = actor;
    r.owner = null;
    r.lease = null;
    log("Baixa informada pelo operador", r.id);
  } else {
    if (active !== "concluido") throw Error("Este MTR não está concluído.");
    if (cmd.type === "undo") {
      const last = [...s.events]
        .reverse()
        .find(
          (e) =>
            e.actor === actor && e.action === "Baixa informada pelo operador",
        );
      if (!last || last.mtr !== r.id || last.at !== r.completedAt)
        throw Error("A última conclusão foi alterada por outro operador.");
    }
    r.state = "pendente";
    r.completedAt = null;
    r.completedBy = null;
    log(cmd.type === "undo" ? "Conclusão desfeita" : "Reaberto", r.id);
  }
  return s;
}
const dataSchema = z.object(
  Object.fromEntries(fields.map((k) => [k, z.string().max(100000)])) as Record<
    (typeof fields)[number],
    z.ZodString
  >,
);
const sourceSchema = z.object({
  batch: z.string(),
  line: z.number().int().positive(),
  data: dataSchema,
  raw: dataSchema.optional(),
});
const issueSchema = z.object({
  line: z.number().int().positive(),
  reason: z.string(),
  data: dataSchema,
  raw: dataSchema.optional(),
});
export const snapshotSchema = z.object({
  records: z.array(
    z.object({
      id: z.string().regex(/^\d+$/),
      data: dataSchema,
      state: z.enum(["pendente", "conferencia", "concluido"]),
      completedAt: z.iso.datetime().nullable(),
      completedBy: z.string().nullable(),
      owner: z.string().nullable(),
      lease: z.iso.datetime().nullable(),
      sources: z.array(sourceSchema).min(1),
      conflict: z.boolean(),
    }),
  ),
  batches: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      sheet: z.string(),
      at: z.iso.datetime(),
      stats: z.object({
        read: z.number().int().nonnegative(),
        eligible: z.number().int().nonnegative(),
        ignoredStatus: z.number().int().nonnegative(),
        ignoredGenerator: z.number().int().nonnegative(),
        duplicates: z.number().int().nonnegative(),
        inconsistencies: z.number().int().nonnegative(),
      }),
      issues: z.array(issueSchema),
      ignored: z.array(issueSchema),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      at: z.iso.datetime(),
      actor: z.string(),
      action: z.string(),
      mtr: z.string(),
      detail: z.string(),
    }),
  ),
});
export function validateBackup(value: unknown): Snapshot {
  const wrapper = z
    .object({
      format: z.literal("guararapes-mtr"),
      version: z.literal(1),
      snapshot: snapshotSchema,
    })
    .parse(value);
  const s = wrapper.snapshot;
  if (new Set(s.records.map((r) => r.id)).size !== s.records.length)
    throw Error("Backup contém números de MTR repetidos.");
  for (const r of s.records) {
    if (r.id !== r.data["MTR Nº"])
      throw Error("Número de MTR inconsistente no backup.");
    const a = r.data["Data de Emissão"].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!a) throw Error("Data inválida no backup.");
    const d = new Date(Date.UTC(+a[3], +a[2] - 1, +a[1]));
    if (
      d.getUTCDate() !== +a[1] ||
      d.getUTCMonth() !== +a[2] - 1 ||
      d.getUTCFullYear() !== +a[3]
    )
      throw Error("Data inválida no backup.");
    if (
      normalize(r.data["Situação"]) !== "SALVO" ||
      !r.data["Gerador Nome"].trim() ||
      excludedGenerator(r.data["Gerador Nome"])
    )
      throw Error("MTR não elegível no backup.");
    if (r.state === "concluido" && (!r.completedAt || !r.completedBy))
      throw Error("Conclusão sem identificação no backup.");
    if (r.state !== "concluido" && (r.completedAt || r.completedBy))
      throw Error("Estado e conclusão incompatíveis no backup.");
    if (r.state === "conferencia" && (!r.owner || !r.lease))
      throw Error("Reserva inválida no backup.");
  }
  return s;
}
