import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AnimatedLogin from "./AnimatedLogin";
import { supabase, workspace } from "./storage";
import {
  sessionRemaining,
  usernameEmail,
  type MemberSession,
} from "./access-model";
type Access = { member: MemberSession | null; signOut: () => Promise<void> };
const AccessContext = createContext<Access>({
  member: null,
  signOut: async () => {},
});
export const useAccess = () => useContext(AccessContext);
export default function AuthGate({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<MemberSession | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [entering, setEntering] = useState(false);
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
  if (member && !entering)
    return (
      <AccessContext.Provider key={member.userId} value={{ member, signOut }}>
        {children}
      </AccessContext.Provider>
    );
  return (
    <AnimatedLogin
      loading={loading}
      configured={!!supabase}
      error={error}
      allowLocal={loopback}
      onLocal={() => {
        sessionStorage.setItem("mtr-local-preview", "1");
        setLocal(true);
      }}
      onComplete={() => setEntering(false)}
      onLogin={async (username, password) => {
        if (!supabase) return false;
        setEntering(true);
        setError("");
        try {
          const email = usernameEmail(username, workspace);
          const result = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (result.error) throw result.error;
          // The playful challenge never grants access: membership and session
          // are still verified by Supabase and the database before opening App.
          const context = await supabase.rpc("mtr_session_context", {
            p_workspace: workspace,
          });
          if (
            context.error ||
            !context.data ||
            !sessionRemaining(context.data as MemberSession)
          )
            throw Error("Acesso recusado.");
          const value = context.data as MemberSession;
          const remaining = sessionRemaining(value);
          deadline.current = performance.now() + remaining;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void expire(), remaining);
          setMember(value);
          setLoading(false);
          return true;
        } catch {
          setMember(null);
          setEntering(false);
          setError("Usuário ou senha inválidos, ou acesso não autorizado.");
          await supabase.auth.signOut({ scope: "local" });
          return false;
        }
      }}
    />
  );
}
