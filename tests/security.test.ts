import { beforeAll, afterAll, it, expect, describe } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  W = "33333333-3333-4333-8333-333333333333",
  SA = "55555555-5555-4555-8555-555555555555",
  SB = "66666666-6666-4666-8666-666666666666";
let db: PGlite;
async function jwt(user = A, session = SA) {
  await db.query("select set_config('mtr.jwt',$1,false)", [
    JSON.stringify({ sub: user, session_id: session }),
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz not null);create function auth.jwt() returns jsonb language sql stable as 'select coalesce(nullif(current_setting(''mtr.jwt'',true),''''),''{}'')::jsonb';create function auth.uid() returns uuid language sql stable as 'select (auth.jwt()->>''sub'')::uuid';`,
  );
  await db.exec(
    readFileSync(
      new URL("../supabase/setup.sql", import.meta.url),
      "utf8",
    ).replace(
      "alter publication supabase_realtime add table public.mtr_workspaces;",
      "",
    ),
  );
  await db.exec(
    readFileSync(
      new URL("../supabase/migrations/002_access.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL("../supabase/migrations/003_registration.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.query("insert into auth.users values($1),($2)", [A, B]);
  await db.query(
    "insert into auth.sessions values($1,$2,now()),($3,$4,now())",
    [SA, A, SB, B],
  );
  await db.query("insert into public.mtr_workspaces(id,name) values($1,$2)", [
    W,
    "Segurança sintética",
  ]);
  await db.query(
    "insert into public.mtr_members(workspace_id,user_id,username,role) values($1,$2,'admin','admin'),($1,$3,'operador','operator')",
    [W, A, B],
  );
  await jwt();
});
afterAll(async () => {
  await db?.close();
});
describe.sequential("acesso de 24h imposto pelo banco", () => {
  it("retorna prazo de 24h sem retornar senha nos cadastros", async () => {
    const r = await db.query<{
      context: { expiresAt: string; serverNow: string };
    }>("select public.mtr_session_context($1) as context", [W]);
    const s = r.rows[0].context;
    expect(Date.parse(s.expiresAt) - Date.parse(s.serverNow)).toBeGreaterThan(
      23.9 * 3600000,
    );
    const list = await db.query("select public.mtr_list_members($1) as users", [
      W,
    ]);
    expect(JSON.stringify(list.rows)).not.toContain("password");
  });
  it("nega leitura e escrita exatamente após 24h, mesmo com token existente", async () => {
    await db.query(
      "update auth.sessions set created_at=clock_timestamp()-interval '24 hours 1 second' where id=$1",
      [SA],
    );
    await db.exec("set role authenticated");
    expect(
      (await db.query("select * from public.mtr_workspaces")).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        'select public.mtr_apply($1,0,\'{"records":[],"batches":[],"events":[]}\'::jsonb,\'import\',null)',
        [W],
      ),
    ).rejects.toThrow("Sessão expirada");
    await db.exec("reset role");
    await db.query(
      "update auth.sessions set created_at=clock_timestamp() where id=$1",
      [SA],
    );
  });
  it("não aceita sessão de outra pessoa nem acesso ao RPC interno", async () => {
    await jwt(A, SB);
    expect(
      (
        await db.query<{ valid: boolean }>(
          "select public.mtr_session_valid() as valid",
        )
      ).rows[0].valid,
    ).toBe(false);
    await jwt();
    await db.exec("set role authenticated");
    await expect(
      db.query(
        "select public.mtr_apply_internal($1,0,'{}'::jsonb,'import',null)",
        [W],
      ),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
  });
  it("operador não lista usuários nem concede acesso diretamente", async () => {
    await jwt(B, SB);
    await expect(
      db.query("select public.mtr_list_members($1)", [W]),
    ).rejects.toThrow("administradores");
    await db.exec("set role authenticated");
    await expect(
      db.query("update public.mtr_members set role='admin' where user_id=$1", [
        B,
      ]),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
    await jwt();
  });
  it("bloqueio revoga acesso e o último administrador é preservado", async () => {
    await db.query("select public.mtr_set_member_active($1,$2,false)", [W, B]);
    await jwt(B, SB);
    await expect(
      db.query("select public.mtr_session_context($1)", [W]),
    ).rejects.toThrow("Sessão expirada");
    await jwt();
    await expect(
      db.query("select public.mtr_set_member_active($1,$2,false)", [W, A]),
    ).rejects.toThrow("último administrador");
    await db.query("select public.mtr_set_member_active($1,$2,true)", [W, B]);
  });
});
