import { describe, it, expect, vi } from "vitest";
import {
  usernameEmail,
  sessionRemaining,
  SESSION_MS,
  type MemberSession,
} from "../src/access-model";
import {
  createUsersHandler,
  type UsersAdapter,
} from "../supabase/functions/mtr-users/handler";
const workspace = "33333333-3333-4333-8333-333333333333";
const base: MemberSession = {
  userId: "x",
  username: "admin",
  role: "admin",
  serverNow: "2026-11-20T12:00:00Z",
  expiresAt: "2026-11-21T12:00:00Z",
};
describe("login e cadastro", () => {
  it("mapeia usuário sem expor e-mail pessoal e mede o prazo pelo relógio do servidor", () => {
    expect(usernameEmail(" Joao.Silva ", workspace)).toBe(
      "joao.silva.33333333333343338333333333333333@usuarios.mtr.invalid",
    );
    expect(sessionRemaining(base)).toBe(SESSION_MS);
    expect(sessionRemaining({ ...base, expiresAt: base.serverNow })).toBe(0);
    expect(() => usernameEmail("nome com espaços", workspace)).toThrow();
  });
  const deps = (): UsersAdapter => ({
    authorize: vi.fn().mockResolvedValue(true),
    bootstrapAllowed: vi.fn().mockResolvedValue(false),
    createUser: vi.fn().mockResolvedValue("new-user"),
    enroll: vi.fn().mockResolvedValue(undefined),
    removeUser: vi.fn().mockResolvedValue(undefined),
  });
  const req = (body: object, token = "valid") =>
    new Request("https://example.com/mtr-users", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });
  const input = {
    action: "create",
    workspace,
    username: "operador",
    password: "SenhaSomenteDeTeste42",
  };
  it("exige administrador autenticado antes de criar usuário", async () => {
    const d = deps();
    vi.mocked(d.authorize).mockResolvedValue(false);
    expect((await createUsersHandler(d)(req(input))).status).toBe(403);
    expect(d.createUser).not.toHaveBeenCalled();
  });
  it("retorna o cadastro sem senha e força perfil operador", async () => {
    const d = deps();
    const r = await createUsersHandler(d)(req({ ...input, role: "admin" }));
    expect(r.status).toBe(201);
    const json = await r.json();
    expect(json.user.role).toBe("operator");
    expect(JSON.stringify(json)).not.toContain(input.password);
    expect(d.enroll).toHaveBeenCalledWith(
      workspace,
      "new-user",
      "operador",
      null,
      "valid",
    );
  });
  it("reverte o usuário Auth quando o vínculo falha", async () => {
    const d = deps();
    vi.mocked(d.enroll).mockRejectedValue(Error("constraint"));
    expect((await createUsersHandler(d)(req(input))).status).toBe(400);
    expect(d.removeUser).toHaveBeenCalledWith("new-user");
  });
  it("inicialização é recusada sem segredo de uso único", async () => {
    const d = deps();
    expect(
      (
        await createUsersHandler(d)(
          req({ ...input, action: "bootstrap", token: "x".repeat(43) }),
        )
      ).status,
    ).toBe(403);
    expect(d.createUser).not.toHaveBeenCalled();
  });
});
