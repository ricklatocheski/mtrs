import { useEffect, useRef } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ClipboardCheck,
  Copy,
  FileText,
  Leaf,
  MessageSquareText,
  ShieldCheck,
  SkipForward,
  Truck,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { display, effectiveState, fields, type MTR } from "./domain";
import CopyButton from "./CopyButton";
import "./conference.css";

type Props = {
  current?: MTR;
  records: MTR[];
  actor: string;
  filename: string;
  busy: boolean;
  canPrevious: boolean;
  lastDone: string | null;
  notice: string;
  error: string;
  onCopy: (text: string) => Promise<boolean>;
  onClose: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onPrevious: () => void;
  onUndo: () => void;
  onResume: () => void;
  onReserve: () => void;
  onReopen: () => void;
  onReview: () => void;
  onRetry?: () => void;
};
const rowIcons = {
  "Data de Emissão": CalendarDays,
  Motorista: UserRound,
  Placa: Truck,
  "Gerador Nome": Building2,
  "Observações do Gerador": MessageSquareText,
};
const stateLabels = {
  pendente: "Pendente",
  conferencia: "Em conferência",
  concluido: "Concluído",
};

export default function ConferenceDialog(p: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  useEffect(() => {
    if (p.current) {
      ref.current
        ?.querySelector<HTMLButtonElement>(
          '[aria-label="Copiar número do MTR"]',
        )
        ?.focus({ preventScroll: true });
    } else {
      ref.current
        ?.querySelector<HTMLHeadingElement>(".conference-summary h1")
        ?.focus({ preventScroll: true });
    }
  }, [p.current?.id]);
  const done = p.records.filter((r) => r.state === "concluido").length;
  const remaining = p.records.length - done;
  const progress = p.records.length
    ? Math.round((done / p.records.length) * 100)
    : 0;
  const state = p.current ? effectiveState(p.current) : null;
  const owned =
    p.current && state === "conferencia" && p.current.owner === p.actor;
  const position = p.current
    ? p.records.findIndex((r) => r.id === p.current!.id) + 1
    : 0;
  const rowValue = (key: (typeof fields)[number]) =>
    ["Motorista", "Placa", "Observações do Gerador"].includes(key)
      ? display(p.current!.data[key])
      : p.current!.data[key];
  return (
    <dialog
      ref={ref}
      className="conference-dialog"
      aria-label="Conferência de MTR"
      onCancel={(e) => {
        e.preventDefault();
        if (!p.busy) p.onClose();
      }}
    >
      <div className="conference-layout">
        <aside className="conference-brand">
          <img src="/guararapes.png" alt="Guararapes Painéis" />
          <div className="conference-brand-message">
            <span className="conference-leaf">
              <Leaf size={28} />
            </span>
            <span className="conference-kicker">BAIXAS DE MTR</span>
            <h2>
              Confira.
              <br />
              Copie.
              <br />
              Conclua.
            </h2>
            <p>As informações que você precisa, um documento por vez.</p>
          </div>
          <div className="conference-progress">
            <div>
              <span>Seu progresso</span>
              <strong>{progress}%</strong>
            </div>
            <progress
              aria-label="Progresso da fila"
              max={Math.max(1, p.records.length)}
              value={done}
            />
            <p>
              <b>{done}</b> de {p.records.length} MTRs concluídos
            </p>
            <span className="conference-file" title={p.filename}>
              <FileText size={14} />
              {p.filename || "Fila de conferência"}
            </span>
          </div>
          <div className="conference-brand-note">
            <ShieldCheck size={17} />
            <span>
              Cada confirmação fica salva
              <br />
              no seu acompanhamento.
            </span>
          </div>
        </aside>
        <section className="conference-main">
          <header className="conference-top">
            <span>
              <ClipboardCheck size={16} />
              CONFERÊNCIA DE MTR
            </span>
            <div>
              {p.current && (
                <span className="conference-position">
                  MTR {position} de {p.records.length}
                </span>
              )}
              <button
                className="conference-close"
                aria-label="Fechar conferência"
                title="Pausar conferência"
                disabled={p.busy}
                onClick={p.onClose}
              >
                <X size={20} />
              </button>
            </div>
          </header>
          <div className="conference-scroll">
            {p.error && (
              <div className="conference-error" role="alert">
                <AlertCircle size={18} />
                <span>{p.error}</span>
                {p.onRetry && (
                  <button onClick={p.onRetry} disabled={p.busy}>
                    Tentar novamente
                  </button>
                )}
              </div>
            )}
            {p.current ? (
              <>
                <div
                  className={
                    "conference-document " +
                    (state === "concluido" ? "is-complete" : "")
                  }
                >
                  <div>
                    <span className="conference-label">
                      Manifesto de transporte de resíduos
                    </span>
                    <div className="conference-number">
                      <h1>{p.current.id}</h1>
                      <CopyButton
                        key={p.current.id + "-number"}
                        label="Copiar número do MTR"
                        withText
                        onClick={() => p.onCopy(p.current!.id)}
                      />
                    </div>
                  </div>
                  <span className={"badge " + state}>
                    {state === "concluido" ? (
                      <Check size={14} />
                    ) : (
                      <span className="status-dot" />
                    )}
                    {stateLabels[state!]}
                  </span>
                </div>
                <p className="conference-description">
                  Confira os dados e copie cada campo para preencher a baixa no
                  portal oficial.
                </p>
                {p.current.conflict && (
                  <div className="conference-conflict">
                    <AlertCircle size={18} />
                    <span>Este MTR tem dados divergentes entre origens.</span>
                    <button onClick={p.onReview}>Revisar origens</button>
                  </div>
                )}
                <div className="conference-fields">
                  {fields.slice(2).map((key) => {
                    const Icon = rowIcons[key as keyof typeof rowIcons];
                    return (
                      <div
                        className={
                          "conference-field " +
                          (key === "Observações do Gerador"
                            ? "observations"
                            : "")
                        }
                        key={key}
                      >
                        <div className="conference-field-heading">
                          <span>
                            <Icon size={15} />
                            {key}
                          </span>
                          <CopyButton
                            key={p.current!.id + key}
                            withText
                            label={"Copiar " + key}
                            onClick={() => p.onCopy(rowValue(key))}
                          />
                        </div>
                        <p>{rowValue(key)}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="conference-original">
                  <div className="conference-original-status">
                    <span>
                      Situação original:{" "}
                      <strong>{p.current.data.Situação}</strong>
                    </span>
                    <CopyButton
                      key={p.current.id + "-original-status"}
                      withText
                      label="Copiar Situação"
                      onClick={() => p.onCopy(p.current!.data.Situação)}
                    />
                  </div>
                  <button onClick={p.onReview}>Origens e histórico</button>
                  <button
                    className="conference-copy-all"
                    onClick={() =>
                      void p.onCopy(
                        fields
                          .map((key) => key + ": " + rowValue(key))
                          .join("\n"),
                      )
                    }
                  >
                    <Copy size={15} />
                    Copiar resumo completo
                  </button>
                </div>
                <div className="conference-manual-note">
                  <ShieldCheck size={17} />
                  <p>
                    Realize a baixa no portal oficial antes de confirmar. Aqui
                    fica registrada a sua informação de que a baixa foi
                    realizada.
                  </p>
                </div>
              </>
            ) : (
              <div className="conference-summary">
                <span className="conference-summary-icon">
                  {remaining ? (
                    <ClipboardCheck size={32} />
                  ) : (
                    <CheckCheck size={34} />
                  )}
                </span>
                <span className="conference-kicker">RESUMO DA CONFERÊNCIA</span>
                <h1 tabIndex={-1}>
                  {!p.records.length
                    ? "Nenhum MTR elegível nesta fila"
                    : remaining
                      ? "Há MTRs para retomar"
                      : "Fila concluída!"}
                </h1>
                <p>
                  {!p.records.length
                    ? "Confira os detalhes do lote para consultar os registros ignorados e as inconsistências."
                    : remaining
                      ? "Os documentos pulados ou reservados continuam pendentes. Você pode retomá-los quando estiver pronto."
                      : "Todas as baixas desta fila foram informadas pelos operadores. Seu progresso está salvo."}
                </p>
                <div className="conference-summary-stats">
                  <div>
                    <strong>{p.records.length}</strong>
                    <span>Documentos</span>
                  </div>
                  <div>
                    <strong>{done}</strong>
                    <span>Concluídos</span>
                  </div>
                  <div>
                    <strong>{remaining}</strong>
                    <span>A retomar</span>
                  </div>
                </div>
                {remaining > 0 && (
                  <button
                    className="button primary"
                    disabled={p.busy}
                    onClick={p.onResume}
                  >
                    <ClipboardCheck size={17} />
                    Retomar pendentes
                  </button>
                )}
              </div>
            )}
            {p.lastDone && (
              <div className="conference-last-done">
                <span>
                  <Check size={16} />
                  MTR {p.lastDone}: baixa registrada.
                </span>
                <button onClick={p.onUndo} disabled={p.busy}>
                  <Undo2 size={14} />
                  Desfazer última conclusão
                </button>
              </div>
            )}
            {p.notice && (
              <div className="conference-feedback" role="status">
                <Check size={15} />
                {p.notice}
              </div>
            )}
          </div>
          <div className="conference-actions">
            {p.current ? (
              <>
                <button
                  className="button secondary conference-previous"
                  disabled={p.busy || !p.canPrevious}
                  onClick={p.onPrevious}
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
                <button
                  className="button secondary"
                  disabled={
                    p.busy ||
                    state === "concluido" ||
                    (state === "conferencia" && !owned)
                  }
                  onClick={p.onSkip}
                >
                  <SkipForward size={16} />
                  Pular por enquanto
                </button>
                {state === "concluido" ? (
                  <button
                    className="button primary"
                    disabled={p.busy}
                    onClick={p.onReopen}
                  >
                    <Undo2 size={16} />
                    Reabrir MTR
                  </button>
                ) : owned ? (
                  <button
                    className="button primary conference-confirm"
                    disabled={p.busy || p.current.conflict}
                    onClick={(event) => {
                      if (event.detail <= 1) p.onComplete();
                    }}
                  >
                    <Check size={18} />
                    {p.busy ? "Salvando…" : "Confirmar baixa realizada"}
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={p.busy}
                    onClick={p.onReserve}
                  >
                    {p.busy ? "Carregando…" : "Reservar para conferir"}
                  </button>
                )}
              </>
            ) : (
              <button
                className="button secondary"
                disabled={p.busy}
                onClick={p.onClose}
              >
                Voltar ao painel
              </button>
            )}
          </div>
        </section>
      </div>
    </dialog>
  );
}
