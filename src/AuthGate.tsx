import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { supabase, workspace } from "./storage";
import {
  sessionRemaining,
  usernameEmail,
  type MemberSession,
} from "./access-model";
import "./access.css";
type Access = { member: MemberSession | null; signOut: () => Promise<void> };
const AccessContext = createContext<Access>({
  member: null,
  signOut: async () => {},
});
export const useAccess = () => useContext(AccessContext);
export default function AuthGate({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<MemberSession | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [local, setLocal] = useState(
    () => sessionStorage.getItem("mtr-local-preview") === "1",
  );
  const deadline = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0);
  const loopback =
    (import.meta.env.DEV ||
      import.meta.env.VITE_ALLOW_LOCAL_PREVIEW === "true") &&
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  async function signOut() {
    generation.current++;
    clearTimeout(timer.current);
    setMember(null);
    setPassword("");
    deadline.current = 0;
    if (supabase) await supabase.auth.signOut({ scope: "local" });
  }
  async function expire() {
    setError("Sua sessão de 24 horas terminou. Entre novamente.");
    await signOut();
  }
  async function check() {
    if (!supabase) return;
    const version = ++generation.current;
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        if (version === generation.current) setMember(null);
        return;
      }
      const result = await supabase.rpc("mtr_session_context", {
        p_workspace: workspace,
      });
      if (version !== generation.current) return;
      if (result.error) throw result.error;
      const value = result.data as MemberSession;
      const remaining = sessionRemaining(value);
      if (!remaining) {
        await expire();
        return;
      }
      deadline.current = performance.now() + remaining;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void expire(), remaining);
      setMember(value);
      setError("");
    } catch {
      if (version === generation.current) {
        setMember(null);
        setError("Acesso não autorizado ou sessão encerrada. Entre novamente.");
      }
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void check();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        generation.current++;
        clearTimeout(timer.current);
        setMember(null);
        setLoading(false);
      } else setTimeout(() => void check(), 0);
    });
    const focus = () => {
      if (document.visibilityState === "visible") {
        if (deadline.current && performance.now() >= deadline.current)
          void expire();
        else void check();
      }
    };
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("focus", focus);
    const poll = setInterval(() => {
      if (deadline.current && performance.now() >= deadline.current)
        void expire();
      else if (document.visibilityState === "visible") void check();
    }, 60000);
    return () => {
      generation.current++;
      data.subscription.unsubscribe();
      clearTimeout(timer.current);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", focus);
      window.removeEventListener("focus", focus);
    };
  }, []);
  if (local && loopback)
    return (
      <AccessContext.Provider
        key="local"
        value={{
          member: null,
          signOut: async () => {
            sessionStorage.removeItem("mtr-local-preview");
            setLocal(false);
          },
        }}
      >
        {children}
      </AccessContext.Provider>
    );
  if (member)
    return (
      <AccessContext.Provider key={member.userId} value={{ member, signOut }}>
        {children}
      </AccessContext.Provider>
    );
  return (
    <main className="access-page">
      <section className="access-card">
        <aside className="access-brand">
          <img src="/guararapes.png" alt="Guararapes Painéis" />
          <div>
            <ShieldCheck size={36} />
            <span>GESTÃO AMBIENTAL</span>
            <h1>
              Seu ambiente.
              <br />
              Seu acesso.
              <br />
              Tudo protegido.
            </h1>
            <p>
              Controle e acompanhamento
              <br />
              de baixas de MTR.
            </p>
          </div>
          <small>Guararapes Painéis</small>
        </aside>
        <div className="access-form">
          <span className="access-lock">
            <LockKeyhole size={24} />
          </span>
          <span className="eyebrow">CONTROLE DE MTR</span>
          <h2>Bem-vindo de volta</h2>
          <p>Entre com seu usuário e senha para continuar.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!supabase) return;
              setBusy(true);
              setError("");
              try {
                const email = usernameEmail(username, workspace);
                const result = await supabase.auth.signInWithPassword({
                  email,
                  password,
                });
                setPassword("");
                if (result.error) throw result.error;
                await check();
              } catch {
                setError(
                  "Usuário ou senha inválidos, ou conexão indisponível.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Usuário
              <div className="access-input">
                <UserRound size={17} />
                <input
                  aria-label="Usuário"
                  autoComplete="username"
                  required
                  maxLength={254}
                  value={username}
                  disabled={loading || busy}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Seu usuário"
                />
              </div>
            </label>
            <label>
              Senha
              <div className="access-input">
                <LockKeyhole size={17} />
                <input
                  aria-label="Senha"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password}
                  disabled={loading || busy}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                />
              </div>
            </label>
            {error && (
              <div className="access-error" role="alert">
                {error}
              </div>
            )}
            {!supabase && (
              <div className="access-error">
                O acesso deste ambiente ainda não foi ativado. Contate o
                administrador.
              </div>
            )}
            <button
              className="button primary"
              disabled={loading || busy || !supabase}
            >
              {loading
                ? "Validando acesso…"
                : busy
                  ? "Entrando…"
                  : "Entrar no painel"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="access-session">
            <ShieldCheck size={16} />
            <span>
              Sua sessão é válida por 24 horas.
              <br />
              Depois desse período, entre novamente.
            </span>
          </div>
          {loopback && (
            <button
              className="access-local"
              onClick={() => {
                sessionStorage.setItem("mtr-local-preview", "1");
                setLocal(true);
              }}
            >
              Abrir modo local neste computador
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
