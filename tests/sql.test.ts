import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { empty, reduce, type Snapshot, type Command } from "../src/domain";
import { prepare } from "../src/importer";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  W = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
async function user(id: string) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function load() {
  return (
    await db.query<{ version: number; doc: Snapshot }>(
      "select version,doc from public.mtr_workspaces where id=$1",
      [W],
    )
  ).rows[0];
}
async function apply(cmd: Command, id = A) {
  await user(id);
  const s = await load();
  const next = reduce(s.doc, cmd, id);
  try {
    return (
      await db.query<{ result: { version: number; doc: Snapshot } }>(
        "select public.mtr_apply($1,$2,$3::jsonb,$4,$5) as result",
        [
          W,
          s.version,
          JSON.stringify(next),
          cmd.type,
          "id" in cmd ? cmd.id : null,
        ],
      )
    ).rows[0].result;
  } catch (e) {
    console.error((e as { where?: string }).where);
    throw e;
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';insert into auth.users values ('${A}'),('${B}');`,
  );
  const sql = readFileSync(
    new URL("../supabase/setup.sql", import.meta.url),
    "utf8",
  ).replace(
    "alter publication supabase_realtime add table public.mtr_workspaces;",
    "",
  );
  await db.exec(sql);
  await db.query("insert into public.mtr_workspaces(id,name) values($1,$2)", [
    W,
    "Teste sintético",
  ]);
  await db.query(
    "insert into public.mtr_members(workspace_id,user_id) values($1,$2),($1,$3)",
    [W, A, B],
  );
});
afterAll(async () => {
  await db?.close();
});
describe.sequential("SQL real em PostgreSQL WASM (PGlite)", () => {
  it("rejeita ação nula e versão nula", async () => {
    await user(A);
    const s = await load();
    await expect(
      db.query("select public.mtr_apply($1,$2,$3::jsonb,$4,$5)", [
        W,
        s.version,
        JSON.stringify(s.doc),
        null,
        null,
      ]),
    ).rejects.toThrow("Ação inválida");
    await expect(
      db.query("select public.mtr_apply($1,$2,$3::jsonb,$4,$5)", [
        W,
        null,
        JSON.stringify(s.doc),
        "import",
        null,
      ]),
    ).rejects.toThrow("Conflito");
  });
  it("importa por RPC e mantém auditoria gerada pelo servidor", async () => {
    const batch = prepare(
      {
        name: "Teste",
        rows: [
          [
            "MTR Nº",
            "Situação",
            "Data de Emissão",
            "Motorista",
            "Placa",
            "Gerador Nome",
            "Observações do Gerador",
          ],
          ["0001", "Salvo", "20/11/2026", "", "", "SINTÉTICO", ""],
        ],
      },
      "sintetico.csv",
    );
    const s = await apply({ type: "import", ...batch });
    expect(s.doc.records[0].state).toBe("pendente");
    expect(s.doc.events[0].actor).toBe(A);
    expect(s.version).toBe(1);
  });
  it("impede reserva de outro operador e rejeita CAS com versão vencida", async () => {
    await apply({ type: "claim", id: "0001" });
    const s = await load();
    await user(B);
    const forged = structuredClone(s.doc);
    forged.records[0].owner = B;
    await expect(
      db.query("select public.mtr_apply($1,$2,$3::jsonb,$4,$5)", [
        W,
        s.version,
        JSON.stringify(forged),
        "claim",
        "0001",
      ]),
    ).rejects.toThrow("reservado");
    await expect(
      db.query("select public.mtr_apply($1,$2,$3::jsonb,$4,$5)", [
        W,
        s.version - 1,
        JSON.stringify(forged),
        "claim",
        "0001",
      ]),
    ).rejects.toThrow("Conflito");
  });
  it("confirma apenas uma vez e identifica o operador no servidor", async () => {
    const s = await apply({ type: "complete", id: "0001" });
    expect(s.doc.records[0].completedBy).toBe(A);
    expect(s.doc.events.at(-1)?.action).toBe("Baixa informada pelo operador");
    await user(B);
    await expect(
      db.query("select public.mtr_apply($1,$2,$3::jsonb,$4,$5)", [
        W,
        s.version,
        JSON.stringify(s.doc),
        "complete",
        "0001",
      ]),
    ).rejects.toThrow("concluído");
  });
  it("desfaz a última conclusão e preserva a situação original", async () => {
    const s = await apply({ type: "undo", id: "0001" });
    expect(s.doc.records[0].state).toBe("pendente");
    expect(s.doc.records[0].data.Situação).toBe("Salvo");
  });
  it("RLS nega leitura a não membros e bloqueia escrita direta de membros", async () => {
    await user("44444444-4444-4444-8444-444444444444");
    await db.exec("set role authenticated");
    expect(
      (await db.query("select * from public.mtr_workspaces")).rows,
    ).toHaveLength(0);
    await db.exec("reset role");
    await user(A);
    await db.exec("set role authenticated");
    expect(
      (await db.query("select * from public.mtr_workspaces")).rows,
    ).toHaveLength(1);
    await expect(
      db.query("update public.mtr_workspaces set version=99 where id=$1", [W]),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
  });
  it("rejeita RPC sem vínculo no workspace", async () => {
    await user("44444444-4444-4444-8444-444444444444");
    const s = await load();
    await expect(
      db.query("select public.mtr_apply($1,$2,$3::jsonb,$4,$5)", [
        W,
        s.version,
        JSON.stringify(s.doc),
        "claim",
        "0001",
      ]),
    ).rejects.toThrow("autorizado");
  });
});
