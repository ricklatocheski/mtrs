export type UsersAdapter = {
  authorize: (token: string, workspace: string) => Promise<boolean>;
  bootstrapAllowed: (hash: string, workspace: string) => Promise<boolean>;
  createUser: (email: string, password: string) => Promise<string>;
  enroll: (
    workspace: string,
    id: string,
    username: string,
    bootstrapHash: string | null,
    token: string,
  ) => Promise<void>;
  removeUser: (id: string) => Promise<void>;
};
export function createUsersHandler(adapter: UsersAdapter) {
  return async (req: Request) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    };
    const reply = (status: number, data: object) =>
      new Response(JSON.stringify(data), { status, headers });
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    if (req.method !== "POST")
      return reply(405, { error: "Método não permitido." });
    let created: string | null = null;
    try {
      const raw = await req.text();
      if (raw.length > 8192)
        return reply(413, { error: "Solicitação muito grande." });
      const body = JSON.parse(raw);
      const { workspace, password } = body;
      const username = String(body.username ?? "")
        .trim()
        .toLowerCase();
      if (
        !["create", "bootstrap"].includes(body.action) ||
        typeof workspace !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(workspace) ||
        !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username) ||
        typeof password !== "string" ||
        password.length < 10 ||
        password.length > 128
      )
        return reply(400, {
          error: "Informe usuário válido e senha de 10 a 128 caracteres.",
        });
      let bootstrapHash: string | null = null;
      if (body.action === "bootstrap") {
        if (
          typeof body.token !== "string" ||
          body.token.length < 32 ||
          body.token.length > 128
        )
          return reply(403, { error: "Inicialização indisponível." });
        bootstrapHash = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(body.token),
            ),
          ),
          (x) => x.toString(16).padStart(2, "0"),
        ).join("");
        if (!(await adapter.bootstrapAllowed(bootstrapHash, workspace)))
          return reply(403, { error: "Inicialização indisponível." });
      } else {
        const token =
          req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        if (!token || !(await adapter.authorize(token, workspace)))
          return reply(403, {
            error: "Sessão expirada ou permissão insuficiente.",
          });
      }
      const email = `${username}.${workspace.replaceAll("-", "")}@usuarios.mtr.invalid`;
      created = await adapter.createUser(email, password);
      await adapter.enroll(
        workspace,
        created,
        username,
        bootstrapHash,
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "",
      );
      return reply(201, {
        user: {
          userId: created,
          username,
          role: bootstrapHash ? "admin" : "operator",
          active: true,
        },
      });
    } catch {
      if (created) {
        try {
          await adapter.removeUser(created);
        } catch {
          return reply(500, {
            error:
              "Falha no cadastro. Solicite ao administrador a revisão do acesso.",
          });
        }
      }
      return reply(400, {
        error:
          "Não foi possível cadastrar. O usuário pode já existir; confira os dados e tente novamente.",
      });
    }
  };
}
