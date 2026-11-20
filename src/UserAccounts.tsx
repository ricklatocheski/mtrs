import { useEffect, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAccess } from "./AuthGate";
import { supabase, workspace } from "./storage";
import {
  normalizedUsername,
  validUsername,
  type UserAccount,
} from "./access-model";
export default function UserAccounts() {
  const { member } = useAccess();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newPassword, setNewPassword] = useState("");
  async function load() {
    if (!supabase || member?.role !== "admin") return;
    const result = await supabase.rpc("mtr_list_members", {
      p_workspace: workspace,
    });
    if (result.error) setError("Não foi possível carregar os usuários.");
    else setUsers(result.data);
  }
  useEffect(() => {
    void load();
  }, [member?.userId]);
  if (!member)
    return (
      <section className="panel settings-panel">
        <ShieldCheck />
        <h2>Cadastros de acesso</h2>
        <p>
          O cadastro de usuários está disponível no ambiente autenticado. O modo
          local mantém os dados apenas neste navegador.
        </p>
      </section>
    );
  return (
    <div className="accounts-layout">
      {member.role === "admin" && (
        <section className="panel account-create">
          <div className="section-title">
            <UserRound size={20} />
            <h2>Cadastrar usuário</h2>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setNotice("");
              const user = normalizedUsername(username);
              if (!validUsername(user)) {
                setError(
                  "Use de 3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.",
                );
                return;
              }
              setBusy(true);
              try {
                const result = await supabase!.functions.invoke("mtr-users", {
                  body: {
                    action: "create",
                    workspace,
                    username: user,
                    password,
                  },
                });
                if (result.error || result.data?.error)
                  throw Error(
                    result.data?.error ??
                      "Não foi possível cadastrar. Confira os dados e tente novamente.",
                  );
                setUsername("");
                setPassword("");
                setNotice("Usuário cadastrado. O acesso já está disponível.");
                await load();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Usuário
              <input
                aria-label="Novo usuário"
                autoComplete="off"
                value={username}
                minLength={3}
                maxLength={40}
                required
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              Senha
              <div className="account-password">
                <input
                  aria-label="Senha do novo usuário"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  required
                  minLength={10}
                  maxLength={128}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <small>Mínimo de 10 caracteres.</small>
            </label>
            <button className="button primary" disabled={busy}>
              <Plus size={17} />
              {busy ? "Cadastrando…" : "Cadastrar usuário"}
            </button>
          </form>
        </section>
      )}
      <section className="panel accounts-list">
        <div className="section-title">
          <h2>
            {member.role === "admin" ? "Usuários cadastrados" : "Minha conta"}
          </h2>
          {member.role === "admin" && (
            <button
              className="icon-button"
              aria-label="Atualizar usuários"
              onClick={() => void load()}
            >
              <RefreshCw size={17} />
            </button>
          )}
        </div>
        {member.role === "admin" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Perfil</th>
                  <th>Acesso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.userId}>
                    <td>{user.username}</td>
                    <td>
                      {user.role === "admin" ? "Administrador" : "Operador"}
                    </td>
                    <td>
                      <span
                        className={
                          "badge " + (user.active ? "concluido" : "pendente")
                        }
                      >
                        {user.active ? "Ativo" : "Bloqueado"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        disabled={busy || user.userId === member.userId}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          const result = await supabase!.rpc(
                            "mtr_set_member_active",
                            {
                              p_workspace: workspace,
                              p_user: user.userId,
                              p_active: !user.active,
                            },
                          );
                          if (result.error) setError(result.error.message);
                          else await load();
                          setBusy(false);
                        }}
                      >
                        {user.active ? "Bloquear" : "Reativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="settings-panel">
            <strong>{member.username}</strong>
            <p>O cadastro de novos acessos é feito pelo administrador.</p>
          </div>
        )}
      </section>
      <section className="panel account-create">
        <div className="section-title">
          <LockKeyhole size={20} />
          <h2>Alterar minha senha</h2>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setNotice("");
            const result = await supabase!.auth.updateUser({
              password: newPassword,
            });
            setNewPassword("");
            if (result.error)
              setError("Não foi possível alterar a senha. Tente novamente.");
            else setNotice("Senha alterada.");
            setBusy(false);
          }}
        >
          <label>
            Nova senha
            <input
              type="password"
              aria-label="Minha nova senha"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <button className="button secondary" disabled={busy}>
            Salvar nova senha
          </button>
        </form>
      </section>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
