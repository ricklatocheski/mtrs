import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import LoginGuardian, { type GuardianMood } from "./LoginGuardian";
import { challengeMatches, createLoginChallenge } from "./login-challenge";
import "./access.css";
import "./guardian.css";

type Stage = "credentials" | "reaching" | "challenge" | "checking" | "success";
type Props = {
  loading: boolean;
  configured: boolean;
  error: string;
  allowLocal: boolean;
  onLogin: (username: string, password: string) => Promise<boolean>;
  onComplete: () => void;
  onLocal: () => void;
};
export default function AnimatedLogin({
  loading,
  configured,
  error,
  allowLocal,
  onLogin,
  onComplete,
  onLocal,
}: Props) {
  const [stage, setStage] = useState<Stage>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [privateFocus, setPrivateFocus] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [paused, setPaused] = useState(false);
  const [question, setQuestion] = useState(createLoginChallenge);
  const [answer, setAnswer] = useState("");
  const [answerError, setAnswerError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const answerInput = useRef<HTMLInputElement>(null);
  const usernameInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  useEffect(() => {
    if (stage !== "reaching" && stage !== "success") return;
    const reduce =
      paused || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(
      () => {
        if (stage === "reaching") setStage("challenge");
        else complete.current();
      },
      reduce ? 0 : stage === "reaching" ? 720 : 850,
    );
    return () => clearTimeout(timer);
  }, [stage, paused]);
  useEffect(() => {
    if (stage === "challenge") {
      answerInput.current?.focus();
      if (attempt) answerInput.current?.select();
    }
  }, [stage, attempt]);

  const mood: GuardianMood =
    stage === "credentials"
      ? privateFocus || showPassword
        ? "private"
        : "idle"
      : stage;
  const caption = {
    idle: "Pode entrar. Estou de olho por aqui.",
    private: "Sua senha? Eu não vou olhar.",
    reaching: "Opa, só mais um instante…",
    challenge: "Uma continha antes de continuar?",
    checking: "Tudo certo. Conferindo seu acesso…",
    success: "Acesso liberado. Bem-vindo!",
  }[mood];
  const inChallenge =
    stage === "challenge" || stage === "checking" || stage === "success";
  async function verify() {
    if (submitting.current) return;
    if (!challengeMatches(question, answer)) {
      setAnswerError("Quase! Confira a conta e tente de novo.");
      setAttempt((value) => value + 1);
      answerInput.current?.select();
      return;
    }
    submitting.current = true;
    setAnswerError("");
    setStage("checking");
    try {
      const accepted = await onLogin(username, password);
      setPassword("");
      if (accepted) setStage("success");
      else {
        setStage("credentials");
        setShowPassword(false);
        requestAnimationFrame(() => usernameInput.current?.focus());
      }
    } catch {
      setPassword("");
      setStage("credentials");
      setAnswerError("Não foi possível entrar. Tente novamente.");
    } finally {
      submitting.current = false;
    }
  }
  return (
    <main
      className={`access-page guardian-page${paused ? " motion-paused" : ""}`}
    >
      <section
        className={`access-card guardian-card stage-${stage}`}
        aria-label="Acesso ao controle de MTR"
      >
        <aside className="access-brand guardian-brand">
          <img src="/guararapes.png" alt="Guararapes Painéis" />
          <div className="guardian-intro">
            <span className="guardian-kicker">
              UM NOVO OLHAR PARA O SEU DIA
            </span>
            <h1>
              Seu acesso.
              <br />
              <em>Bem acompanhado.</em>
            </h1>
          </div>
          <div className="guardian-scene">
            <LoginGuardian mood={mood} paused={paused} />
            <div className="guardian-speech" role="status" aria-live="polite">
              <span className="speech-dot" />
              {caption}
            </div>
          </div>
          <footer className="guardian-brand-footer">
            <span>
              CONTROLE DE MTR <i /> GUARARAPES
            </span>
            <button
              type="button"
              className="guardian-motion"
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
              aria-label={paused ? "Ativar animações" : "Pausar animações"}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          </footer>
        </aside>
        <div className="access-form guardian-form">
          <div className="login-step-label">
            <span className="access-lock">
              <ShieldCheck size={20} />
            </span>
            <span>AMBIENTE EXCLUSIVO</span>
            <span className="login-step-count">
              {inChallenge ? "02" : "01"}
              <i>/ 02</i>
            </span>
          </div>
          {!inChallenge ? (
            <>
              <span className="eyebrow">BOM TER VOCÊ POR AQUI</span>
              <h2>Bem-vindo de volta</h2>
              <p>
                Entre com seus dados.
                <br />O nosso guardião acompanha você.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (loading || !configured || stage !== "credentials") return;
                  setQuestion(createLoginChallenge());
                  setAnswer("");
                  setAnswerError("");
                  setPrivateFocus(false);
                  setStage("reaching");
                }}
              >
                <label>
                  Usuário
                  <div className="access-input">
                    <UserRound size={18} />
                    <input
                      ref={usernameInput}
                      aria-label="Usuário"
                      autoComplete="username"
                      required
                      maxLength={254}
                      value={username}
                      disabled={loading || stage === "reaching"}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Seu usuário"
                    />
                  </div>
                </label>
                <label>
                  Senha
                  <div className="access-input">
                    <LockKeyhole size={18} />
                    <input
                      aria-label="Senha"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      maxLength={128}
                      value={password}
                      disabled={loading || stage === "reaching"}
                      onFocus={() => setPrivateFocus(true)}
                      onBlur={() => setPrivateFocus(false)}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Sua senha"
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      aria-pressed={showPassword}
                      disabled={stage === "reaching"}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>
                {(error || answerError) && (
                  <div className="access-error" role="alert">
                    {error || answerError}
                  </div>
                )}
                {!configured && (
                  <div className="access-error">
                    O acesso deste ambiente ainda não foi ativado. Contate o
                    administrador.
                  </div>
                )}
                <div className="login-submit-wrap">
                  <button
                    className="button primary login-submit"
                    disabled={loading || stage === "reaching" || !configured}
                  >
                    {loading
                      ? "Validando acesso…"
                      : stage === "reaching"
                        ? "Um instante…"
                        : "Entrar no painel"}
                    <ArrowRight size={18} />
                  </button>
                  <svg
                    className="login-catching-hand"
                    viewBox="0 0 130 90"
                    aria-hidden="true"
                  >
                    <path
                      d="M0 48h43l9-8 5-24c2-9 12-7 11 2l-2 19 29-9c9-3 13 7 5 11l-11 5 17-3c9-1 11 9 3 12l-20 6 12-1c9 0 9 10 1 12L71 81H0"
                      fill="#d2aa74"
                      stroke="#9c744c"
                      strokeWidth="2"
                    />
                    <path
                      d="m51 44 12 15m-4-16 7 5M0 49h27v32H0"
                      fill="#385b49"
                      stroke="#244437"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </form>
            </>
          ) : (
            <div className="guardian-challenge-content">
              <span className="eyebrow">UM INSTANTE COM O GUARDIÃO</span>
              <h2>
                {stage === "success"
                  ? "Tudo pronto!"
                  : stage === "checking"
                    ? "Conferindo seu acesso"
                    : "Só mais uma continha"}
              </h2>
              <p>
                {stage === "success"
                  ? "Seu painel está esperando por você."
                  : stage === "checking"
                    ? "Validando seu usuário e sua senha."
                    : "Resolva o desafio para continuar."}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (stage === "challenge") void verify();
                }}
                aria-busy={stage === "checking"}
              >
                <div className={`guardian-math-card math-${stage}`}>
                  <span className="math-card-tag">
                    <Sparkles size={14} /> DESAFIO DO GUARDIÃO
                  </span>
                  {stage === "success" ? (
                    <span className="math-success">
                      <Check size={48} />
                    </span>
                  ) : (
                    <div
                      className="guardian-equation"
                      aria-label="Conta do guardião"
                    >
                      <span>{question.left}</span>
                      <i>{question.operator}</i>
                      <span>{question.right}</span>
                      <i>=</i>
                      <span className="math-question">?</span>
                    </div>
                  )}
                  <span className="math-card-foot">
                    {stage === "success"
                      ? "BEM-VINDO AO SEU PAINEL"
                      : stage === "checking"
                        ? "VALIDANDO CREDENCIAIS"
                        : "PODE RESPONDER COM CALMA"}
                  </span>
                </div>
                {stage === "challenge" && (
                  <>
                    <label>
                      Sua resposta
                      <div
                        className={`access-input math-answer${answerError ? " answer-error" : ""}`}
                        key={attempt}
                      >
                        <input
                          ref={answerInput}
                          aria-label="Sua resposta"
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={2}
                          value={answer}
                          required
                          onChange={(event) => {
                            setAnswer(
                              event.target.value.replace(/[^0-9]/g, ""),
                            );
                            setAnswerError("");
                          }}
                          placeholder="Digite o resultado"
                          aria-invalid={!!answerError}
                          aria-describedby={
                            answerError ? "math-feedback" : undefined
                          }
                        />
                      </div>
                    </label>
                    {answerError && (
                      <div
                        className="access-error"
                        id="math-feedback"
                        role="alert"
                      >
                        {answerError}
                      </div>
                    )}
                    <button className="button primary">
                      Validar e entrar
                      <ArrowRight size={18} />
                    </button>
                    <div className="math-secondary">
                      <button
                        type="button"
                        onClick={() => {
                          setStage("credentials");
                          setAnswerError("");
                        }}
                      >
                        <ArrowLeft size={14} />
                        Voltar ao login
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuestion(createLoginChallenge());
                          setAnswer("");
                          setAnswerError("");
                          answerInput.current?.focus();
                        }}
                      >
                        <RefreshCw size={13} />
                        Outra conta
                      </button>
                    </div>
                  </>
                )}
                {stage === "checking" && (
                  <div className="guardian-checking" role="status">
                    <span className="login-spinner" />
                    Validando acesso…
                  </div>
                )}
                {stage === "success" && (
                  <div className="guardian-welcome" role="status">
                    <Check size={17} />
                    Acesso liberado
                  </div>
                )}
              </form>
            </div>
          )}
          <div className="access-session">
            <LockKeyhole size={14} />
            <span>
              Acesso pessoal · Sessão de 24 horas
              <br />
              Seus dados, no seu ambiente.
            </span>
          </div>
          {allowLocal && stage === "credentials" && (
            <button type="button" className="access-local" onClick={onLocal}>
              Abrir modo local neste computador
            </button>
          )}
        </div>
      </section>
      <p className="guardian-page-footer">
        GUARARAPES PAINÉIS <span>·</span> GESTÃO AMBIENTAL
      </p>
    </main>
  );
}
