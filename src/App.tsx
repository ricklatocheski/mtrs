import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  ListFilter,
  History,
  Settings,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Leaf,
  HardDrive,
  Cloud,
  Search,
  Undo2,
  SkipForward,
  CheckCheck,
  FileSpreadsheet,
  X,
  AlertCircle,
  RefreshCw,
  LogOut,
  Database,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import {
  empty,
  fields,
  display,
  effectiveState,
  validateBackup,
  normalize,
  type Snapshot,
  type MTR,
  type Command,
  type DataRow,
} from "./domain";
import { readTables, prepare, type Table } from "./importer";
import {
  localLoad,
  localApply,
  localSubscribe,
  tabActor,
  supabase,
  remoteLoad,
  remoteApply,
  workspace,
  type RemoteSnapshot,
} from "./storage";
import { exportData, exportBackup } from "./exporter";
import ConferenceDialog from "./ConferenceDialog";
type Page = "painel" | "fila" | "registros" | "historico" | "config";
const labels: Record<string, string> = {
  pendente: "Pendente",
  conferencia: "Em conferência",
  concluido: "Concluído",
};
const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR") : "—";
const nav = [
  ["painel", "Visão geral", LayoutDashboard],
  ["fila", "Conferência", ClipboardCheck],
  ["registros", "Todos os MTRs", ListFilter],
  ["historico", "Histórico", History],
  ["config", "Configurações", Settings],
] as const;
function Badge({ r }: { r: MTR }) {
  const state = effectiveState(r);
  return (
    <span className={"badge " + state}>
      {state === "concluido" ? (
        <Check size={13} />
      ) : (
        <span className="status-dot" />
      )}
      {labels[state]}
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
  branded = false,
  reviewReady = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  branded?: boolean;
  reviewReady?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={(wide ? "modal wide" : "modal") + (branded ? " branded" : "")}
      onCancel={onClose}
    >
      {branded && (
        <aside className="import-brand-panel">
          <img src="/guararapes.png" alt="Guararapes Painéis" />
          <div className="import-brand-message">
            <span className="import-brand-symbol">
              <Leaf size={28} />
            </span>
            <span className="eyebrow">CONTROLE DE MTR</span>
            <h3>
              Cada documento.
              <br />
              Uma etapa
              <br />
              bem cuidada.
            </h3>
            <p>Organize seu relatório e acompanhe as baixas com clareza.</p>
          </div>
          <div className="import-brand-footer">
            <ShieldCheck size={18} />
            <span>
              Precisão em cada etapa
              <br />
              da gestão ambiental.
            </span>
          </div>
        </aside>
      )}
      <div className={branded ? "import-modal-content" : undefined}>
        {branded && (
          <ol className="import-steps" aria-label="Etapas da importação">
            {["Relatório", "Revisão", "Confirmação"].map((label, index) => (
              <li
                key={label}
                className={
                  (index === (reviewReady ? 1 : 0) ? "active " : "") +
                  (reviewReady && index === 0 ? "done" : "")
                }
                aria-current={
                  index === (reviewReady ? 1 : 0) ? "step" : undefined
                }
              >
                <span>
                  {reviewReady && index === 0 ? <Check size={12} /> : index + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
        )}
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export default function App() {
  const [doc, setDoc] = useState<Snapshot>(empty);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState<Page>(
    () => (location.pathname.slice(1) as Page) || "painel",
  );
  const [mode, setMode] = useState<"local" | "shared">(() =>
    localStorage.getItem("mtr-mode") === "shared" && supabase
      ? "shared"
      : "local",
  );
  const [actor, setActor] = useState(tabActor);
  const [user, setUser] = useState<string | null>(null);
  const [remote, setRemote] = useState<RemoteSnapshot | null>(null);
  const remoteVersion = useRef(-1);
  const [connection, setConnection] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [conferenceOpen, setConferenceOpen] = useState(false);
  const [queueIds, setQueueIds] = useState<string[] | null>(null);
  const [queueBatchName, setQueueBatchName] = useState("Todos os lotes");
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [lastDone, setLastDone] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [tables, setTables] = useState<Table[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState(0);
  const [encoding, setEncoding] = useState("auto");
  const [preview, setPreview] = useState<ReturnType<typeof prepare> | null>(
    null,
  );
  const [importError, setImportError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [scope, setScope] = useState("todos");
  const [format, setFormat] = useState("xlsx");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [generator, setGenerator] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const [audit, setAudit] = useState<MTR | null>(null);
  const [reviewBatch, setReviewBatch] = useState<string | null>(null);
  const [backup, setBackup] = useState<Snapshot | null>(null);
  const [backupReplace, setBackupReplace] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [retry, setRetry] = useState<Command | null>(null);
  const current = doc.records.find((r) => r.id === selected);
  const done = doc.records.filter((r) => r.state === "concluido").length;
  const active = doc.records.filter(
    (r) => effectiveState(r) === "conferencia",
  ).length;
  const pending = doc.records.length - done - active;
  const progress = doc.records.length
    ? Math.round((done / doc.records.length) * 100)
    : 0;
  const latest = doc.batches.at(-1);
  useEffect(() => {
    const last = [...doc.events]
      .reverse()
      .find(
        (e) =>
          e.actor === actor && e.action === "Baixa informada pelo operador",
      );
    const r = doc.records.find((r) => r.id === last?.mtr);
    setLastDone(
      last && r?.state === "concluido" && r.completedAt === last.at
        ? last.mtr
        : null,
    );
  }, [doc, actor]);
  const say = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 3500);
  };
  function go(p: Page) {
    setPage(p);
    history.pushState({}, "", p === "painel" ? "/" : "/" + p);
  }
  useEffect(() => {
    const fn = () => setPage((location.pathname.slice(1) as Page) || "painel");
    window.addEventListener("popstate", fn);
    return () => window.removeEventListener("popstate", fn);
  }, []);
  function acceptRemote(s: RemoteSnapshot) {
    if (s.version < remoteVersion.current) return;
    remoteVersion.current = s.version;
    setRemote(s);
    setDoc(s.doc);
  }
  async function refresh() {
    try {
      if (mode === "local") {
        setDoc(await localLoad());
        setConnection("");
      } else {
        const s = await remoteLoad();
        acceptRemote(s);
      }
      setLoaded(true);
    } catch (e) {
      setError(String((e as Error).message));
      setLoaded(true);
    }
  }
  useEffect(() => {
    setSelected(null);
    setConferenceOpen(false);
    setQueueIds(null);
    setDoc(empty());
    setRemote(null);
    remoteVersion.current = -1;
    setLoaded(false);
    setError("");
    if (mode === "local") {
      setActor(tabActor());
      void refresh();
      return localSubscribe(() => void refresh());
    }
    if (!supabase) return;
    let dispose: undefined | (() => void);
    let live = true;
    const start = async () => {
      const { data } = await supabase!.auth.getSession();
      if (!live) return;
      setUser(data.session?.user.email ?? null);
      if (data.session) {
        setActor(data.session.user.id);
        await refresh();
      } else setLoaded(true);
    };
    void start();
    const { data: auth } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user.email ?? null);
        if (session) {
          setActor(session.user.id);
          setTimeout(() => void refresh(), 0);
        } else {
          setDoc(empty());
          setRemote(null);
          remoteVersion.current = -1;
        }
      },
    );
    const channel = supabase
      .channel("mtr-" + workspace)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mtr_workspaces",
          filter: "id=eq." + workspace,
        },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (live)
          setConnection(
            status === "SUBSCRIBED"
              ? "Sincronização em tempo real ativa"
              : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
                ? "Conexão em tempo real indisponível. Atualize para tentar novamente."
                : "Conectando ao tempo real…",
          );
      });
    dispose = () => {
      void supabase!.removeChannel(channel);
      auth.subscription.unsubscribe();
    };
    return () => {
      live = false;
      dispose?.();
    };
  }, [mode]);
  useEffect(() => {
    const timer = setInterval(() => setDoc((s) => ({ ...s })), 15000);
    const fn = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", fn);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", fn);
    };
  }, [mode]);
  async function execute(cmd: Command): Promise<Snapshot | null> {
    if (busy) return null;
    setBusy(true);
    setError("");
    try {
      let next: Snapshot;
      if (mode === "local") {
        next = await localApply(cmd, actor);
        setDoc(next);
      } else {
        if (!remote)
          throw Error("Entre na conta e carregue os dados compartilhados.");
        const s = await remoteApply(cmd, remote, actor);
        acceptRemote(s);
        next = s.doc;
      }
      setRetry(null);
      return next;
    } catch (e) {
      setError((e as Error).message);
      if (mode === "shared") {
        setRetry(cmd);
        try {
          const s = await remoteLoad();
          acceptRemote(s);
        } catch {
          /* retain last confirmed snapshot */
        }
      }
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function openRecord(r: MTR, preserveQueue = false) {
    let source = doc;
    if (
      current &&
      current.id !== r.id &&
      effectiveState(current) === "conferencia" &&
      current.owner === actor
    ) {
      const released = await execute({ type: "release", id: current.id });
      if (!released) return;
      source = released;
    }
    if (!preserveQueue) {
      setQueueIds(null);
      setQueueBatchName("Todos os lotes");
      setSkippedIds([]);
    }
    setConferenceOpen(true);
    setSelected(r.id);
    setVisited((v) => [...v.filter((id) => id !== r.id), r.id]);
    if (effectiveState(r) !== "concluido") await claimAfter(r.id, source);
  }
  const nextRecord = (
    s: Snapshot,
    except?: string,
    scope = queueIds,
    skipped: string[] = [],
  ) => {
    const start = s.records.findIndex((r) => r.id === except);
    const order = [
      ...s.records.slice(start + 1),
      ...s.records.slice(0, start + 1),
    ];
    return order.find(
      (r) =>
        r.id !== except &&
        (!scope || scope.includes(r.id)) &&
        !skipped.includes(r.id) &&
        effectiveState(r) !== "concluido" &&
        !(effectiveState(r) === "conferencia" && r.owner !== actor),
    );
  };
  async function advance(s: Snapshot, except?: string, skipped = skippedIds) {
    const next = nextRecord(s, except, queueIds, skipped);
    if (next) {
      setSelected(next.id);
      setVisited((v) => [...v, next.id]);
      await claimAfter(next.id, s);
    } else setSelected(null);
  }
  // Use the returned server version for sequential operations; React state updates are asynchronous.
  async function claimAfter(id: string, s: Snapshot) {
    try {
      setBusy(true);
      setError("");
      if (mode === "local") {
        setDoc(await localApply({ type: "claim", id }, actor));
      } else {
        const latestRemote = await remoteLoad();
        const result = await remoteApply(
          { type: "claim", id },
          latestRemote,
          actor,
        );
        acceptRemote(result);
      }
    } catch (e) {
      setError((e as Error).message);
      if (mode === "local") setDoc(await localLoad());
      else {
        try {
          acceptRemote(await remoteLoad());
        } catch {
          /* keep confirmed state */
        }
      }
    } finally {
      setBusy(false);
    }
  }
  async function complete() {
    if (!current) return;
    const s = await execute({ type: "complete", id: current.id });
    if (s) {
      setLastDone(current.id);
      say("Baixa registrada como informada pelo operador.");
      await advance(s, current.id);
    }
  }
  async function skip() {
    if (!current) return;
    const s = await execute({ type: "release", id: current.id });
    if (s) {
      say("MTR mantido pendente.");
      const skipped = [...new Set([...skippedIds, current.id])];
      setSkippedIds(skipped);
      await advance(s, current.id, skipped);
    }
  }
  async function beginConference(source = doc, scope = queueIds) {
    setQueueIds(scope);
    setQueueBatchName(
      scope
        ? (source.batches.at(-1)?.name ?? "Lote importado")
        : "Todos os lotes",
    );
    setSkippedIds([]);
    setVisited([]);
    setError("");
    setConferenceOpen(true);
    const next = nextRecord(source, undefined, scope, []);
    setSelected(next?.id ?? null);
    if (next) {
      setVisited([next.id]);
      await claimAfter(next.id, source);
    }
  }
  async function closeConference() {
    if (busy) return;
    if (
      current &&
      effectiveState(current) === "conferencia" &&
      current.owner === actor
    ) {
      const released = await execute({ type: "release", id: current.id });
      if (!released) return;
    }
    setConferenceOpen(false);
    setSelected(null);
  }
  async function undoLast() {
    if (!lastDone) return;
    const id = lastDone;
    const result = await execute({ type: "undo", id });
    if (result) {
      setLastDone(null);
      say("Conclusão desfeita.");
      if (!current) {
        setSelected(id);
        setVisited((v) => [...v, id]);
        await claimAfter(id, result);
      }
    }
  }
  async function previousRecord() {
    const previous = visited.at(-2);
    const record = doc.records.find((r) => r.id === previous);
    if (record) {
      setVisited((v) => v.slice(0, -2));
      await openRecord(record, true);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      say("Copiado");
      return true;
    } catch {
      setError(
        "O navegador não autorizou a cópia. Selecione o texto e use Ctrl+C.",
      );
      return false;
    }
  }
  async function loadFile(f: File, enc = encoding) {
    setFile(f);
    setPreview(null);
    setImportError("");
    try {
      const t = await readTables(f, enc);
      setTables(t);
      setSheet(0);
      if (t.length === 1) setPreview(prepare(t[0], f.name));
    } catch (e) {
      setImportError((e as Error).message);
      setTables([]);
    }
  }
  const chooseSheet = (index: number) => {
    setSheet(index);
    try {
      setPreview(prepare(tables[index], file!.name));
      setImportError("");
    } catch (e) {
      setPreview(null);
      setImportError((e as Error).message);
    }
  };
  async function importConfirm() {
    if (!preview) return;
    const s = await execute({ type: "import", ...preview });
    if (s) {
      setImportOpen(false);
      setPreview(null);
      setTables([]);
      setFile(null);
      say("Lote importado. Histórico anterior preservado.");
      go("painel");
      await beginConference(
        s,
        preview.records.map((r) => r.id),
      );
    }
  }
  function changeMode(value: "local" | "shared") {
    setMode(value);
    localStorage.setItem("mtr-mode", value);
    setSelected(null);
    setConferenceOpen(false);
    setQueueIds(null);
    setLastDone(null);
    setRetry(null);
  }
  const allGenerators = [
    ...new Set(doc.records.map((r) => r.data["Gerador Nome"])),
  ].sort();
  const dateISO = (s: string) => s.split("/").reverse().join("-");
  const filtered = doc.records.filter((r) => {
    const st = effectiveState(r);
    return (
      (!search ||
        normalize(Object.values(r.data).join(" ")).includes(
          normalize(search),
        )) &&
      (status === "todos" || st === status) &&
      (!generator || r.data["Gerador Nome"] === generator) &&
      (!from || dateISO(r.data["Data de Emissão"]) >= from) &&
      (!to || dateISO(r.data["Data de Emissão"]) <= to) &&
      (!batchFilter || r.sources.some((x) => x.batch === batchFilter))
    );
  });
  useEffect(
    () => setTablePage(0),
    [search, status, generator, from, to, batchFilter],
  );
  const subtitle =
    page === "painel"
      ? "Acompanhe cada etapa. Mantenha tudo em dia."
      : page === "fila"
        ? "Conferência manual, um documento por vez."
        : page === "registros"
          ? "Consulte, filtre e retome seus documentos."
          : page === "historico"
            ? "Rastreabilidade de cada ação realizada."
            : "Armazenamento, acesso e segurança dos dados.";
  const queueRecords = doc.records.filter(
    (r) => !queueIds || queueIds.includes(r.id),
  );
  const reviewed = doc.batches.find((b) => b.id === reviewBatch);
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("painel");
          }}
        >
          <img src="/guararapes.png" alt="Guararapes Painéis" />
        </a>
        <div className="nav-label">Recebimento</div>
        <nav aria-label="Navegação principal">
          {nav.map(([id, title, Icon]) => (
            <button
              key={id}
              aria-label={title}
              aria-current={page === id ? "page" : undefined}
              onClick={() => {
                go(id);
                if (id === "fila") void beginConference();
              }}
              className={page === id ? "nav-item selected" : "nav-item"}
            >
              <Icon size={19} />
              <span>{title}</span>
              {page === id && (
                <ChevronRight className="nav-chevron" size={16} />
              )}
            </button>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Gestão ambiental <ChevronRight size={14} />
            <strong>Controle de MTR</strong>
          </div>
          <div className="topbar-right">
            <span className="environment">
              <span className="status-dot" />
              {mode === "local"
                ? "Armazenamento local"
                : "Ambiente compartilhado"}
            </span>
            <span className="today">
              {new Date().toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">CONTROLE DE MANIFESTOS</span>
              <h1>{nav.find((x) => x[0] === page)?.[1] ?? "Visão geral"}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={() => setExportOpen(true)}
              >
                <Download size={17} />
                Exportar
              </button>
              <button
                className="button primary"
                onClick={() => setImportOpen(true)}
              >
                <Upload size={17} />
                Importar relatório
              </button>
            </div>
          </div>
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={19} />
              <span>{error}</span>
              {retry && (
                <button onClick={() => void execute(retry)}>
                  Tentar novamente
                </button>
              )}
              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label="Fechar erro"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {mode === "shared" && connection && (
            <div className="notice">
              <Cloud size={17} />
              {connection}
              <button onClick={() => void refresh()}>Atualizar</button>
            </div>
          )}
          {!loaded ? (
            <div className="empty panel">Carregando dados salvos…</div>
          ) : mode === "shared" && !user ? (
            <section className="panel login">
              <Cloud size={32} />
              <h2>Acesse o ambiente compartilhado</h2>
              <p>Use uma conta autorizada pelo administrador do workspace.</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const result = await supabase!.auth.signInWithPassword({
                    email,
                    password,
                  });
                  if (result.error) setError(result.error.message);
                  setBusy(false);
                }}
              >
                <label>
                  E-mail
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Senha
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button disabled={busy} className="button primary">
                  Entrar
                </button>
              </form>
              <button
                className="text-button"
                onClick={() => changeMode("local")}
              >
                Usar modo local
              </button>
            </section>
          ) : (
            <>
              {(page === "painel" || page === "fila") && (
                <>
                  <div className="stats-grid">
                    <Stat
                      title="Total de MTRs"
                      value={doc.records.length}
                      note="Documentos elegíveis"
                      icon={<FileSpreadsheet />}
                    />
                    <Stat
                      title="Pendentes"
                      value={pending}
                      note="Aguardando conferência"
                      icon={<ClipboardCheck />}
                      color="amber"
                    />
                    <Stat
                      title="Em conferência"
                      value={active}
                      note="Em atendimento agora"
                      icon={<RefreshCw />}
                      color="blue"
                    />
                    <Stat
                      title="Concluídos"
                      value={done}
                      note="Baixas informadas"
                      icon={<CheckCheck />}
                      color="green"
                    />
                  </div>
                  <section className="progress-panel">
                    <div className="progress-main">
                      <div>
                        <strong>Progresso das baixas</strong>
                        <span>
                          {done} de {doc.records.length} documentos concluídos
                        </span>
                      </div>
                      <b>
                        {progress}
                        <small>%</small>
                      </b>
                    </div>
                    <div className="progress-track">
                      <div style={{ width: progress + "%" }} />
                    </div>
                    <div className="progress-footer">
                      <span>
                        <FileSpreadsheet size={14} />
                        {latest ? latest.name : "Nenhum lote importado"}
                      </span>
                      <button
                        className="text-button"
                        disabled={!latest}
                        onClick={() => setReviewBatch(latest!.id)}
                      >
                        Detalhes do lote <ChevronRight size={14} />
                      </button>
                    </div>
                  </section>
                </>
              )}
              {page === "painel" && (
                <>
                  <div className="dashboard-columns">
                    <section className="panel start-panel">
                      <div className="section-title">
                        <div className="section-icon">
                          <ClipboardCheck size={21} />
                        </div>
                        <h2>Fila de conferência</h2>
                        <span className="subtle-tag">
                          {pending + active} a conferir
                        </span>
                      </div>
                      <div className="start-content">
                        <span className="eyebrow">SEU PRÓXIMO PASSO</span>
                        <h3>
                          {doc.records.length === 0
                            ? "Seu controle começa aqui"
                            : done === doc.records.length
                              ? "Tudo conferido por aqui."
                              : "Cada documento, uma etapa concluída."}
                        </h3>
                        <p>
                          {doc.records.length === 0
                            ? "Importe seu relatório para selecionar os MTRs elegíveis e organizar a fila de baixas."
                            : done === doc.records.length
                              ? "Todas as baixas foram informadas pelos operadores. Consulte o histórico ou importe um novo lote."
                              : "Abra o próximo MTR, confira os dados e registre a baixa após realizá-la no portal oficial."}
                        </p>
                        <button
                          className="button primary"
                          onClick={() => {
                            if (!doc.records.length) setImportOpen(true);
                            else if (done === doc.records.length)
                              go("registros");
                            else void beginConference(doc, null);
                          }}
                        >
                          <ClipboardCheck size={18} />
                          {!doc.records.length
                            ? "Importar primeiro relatório"
                            : done === doc.records.length
                              ? "Consultar documentos"
                              : "Iniciar conferência"}
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className="manual-note">
                        <ShieldCheck size={17} />
                        <span>
                          Conferência assistida. A baixa é realizada por você no
                          portal oficial.
                        </span>
                      </div>
                    </section>
                    <section className="panel lots-panel">
                      <div className="section-title">
                        <h2>Últimos lotes</h2>
                        <span className="subtle-tag">{doc.batches.length}</span>
                      </div>
                      {!doc.batches.length ? (
                        <div className="empty small">
                          <FileSpreadsheet size={30} />
                          <strong>Nenhum relatório importado</strong>
                          <p>Seus lotes aparecerão aqui.</p>
                        </div>
                      ) : (
                        <div className="lot-list">
                          {[...doc.batches]
                            .reverse()
                            .slice(0, 4)
                            .map((b) => (
                              <button
                                key={b.id}
                                className="lot"
                                onClick={() => setReviewBatch(b.id)}
                              >
                                <span className="file-icon">
                                  <FileSpreadsheet size={21} />
                                </span>
                                <div>
                                  <strong>{b.name}</strong>
                                  <small>
                                    {fmt(b.at)} • {b.stats.eligible} elegíveis
                                  </small>
                                </div>
                                <ChevronRight size={16} />
                              </button>
                            ))}
                        </div>
                      )}
                      <div className="privacy-note">
                        <HardDrive size={16} />
                        <span>
                          {mode === "local"
                            ? "Salvo apenas neste navegador. Faça backups regularmente."
                            : "Operações salvas após confirmação do servidor."}
                        </span>
                      </div>
                    </section>
                  </div>
                  <section className="panel recent-panel">
                    <div className="section-title">
                      <h2>Documentos recentes</h2>
                      <button
                        className="text-button"
                        onClick={() => go("registros")}
                      >
                        Ver todos <ChevronRight size={15} />
                      </button>
                    </div>
                    {doc.records.length ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>MTR Nº</th>
                              <th>EMISSÃO</th>
                              <th>GERADOR</th>
                              <th>PLACA</th>
                              <th>ACOMPANHAMENTO</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {doc.records
                              .slice(-5)
                              .reverse()
                              .map((r) => (
                                <tr key={r.id}>
                                  <td className="mtr-link">
                                    <button onClick={() => void openRecord(r)}>
                                      {r.id}
                                    </button>
                                    {r.conflict && <AlertCircle size={14} />}
                                  </td>
                                  <td>{r.data["Data de Emissão"]}</td>
                                  <td>{r.data["Gerador Nome"]}</td>
                                  <td>{display(r.data.Placa)}</td>
                                  <td>
                                    <Badge r={r} />
                                  </td>
                                  <td>
                                    <button
                                      className="icon-button"
                                      aria-label={"Abrir MTR " + r.id}
                                      onClick={() => void openRecord(r)}
                                    >
                                      <ChevronRight size={17} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty">
                        <div className="empty-icon">
                          <ListFilter size={28} />
                        </div>
                        <strong>
                          Os documentos do seu relatório aparecem aqui
                        </strong>
                        <p>
                          Importe um arquivo .xlsx, .xls ou .csv para começar.
                        </p>
                      </div>
                    )}
                  </section>
                </>
              )}
              {page === "fila" && (
                <section className="panel queue-panel">
                  <div className="section-title">
                    <h2>Conferência de MTR</h2>
                    <span className="subtle-tag">Um documento por vez</span>
                  </div>
                  <div className="empty">
                    <ClipboardCheck size={40} />
                    <h2>
                      {done === doc.records.length && done
                        ? "Tudo conferido por aqui"
                        : "Retome sua conferência"}
                    </h2>
                    <p>
                      Os dados de cada MTR aparecem em uma janela, com cópia
                      individual e confirmação da baixa.
                    </p>
                    <button
                      className="button primary"
                      disabled={busy || !doc.records.length}
                      onClick={() => void beginConference(doc, null)}
                    >
                      Abrir conferência
                    </button>
                  </div>
                </section>
              )}
              {page === "registros" && (
                <section className="panel">
                  <div className="filters">
                    <div className="search-input">
                      <Search size={18} />
                      <input
                        placeholder="Buscar MTR, motorista, placa, gerador…"
                        aria-label="Buscar MTR"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      aria-label="Estado de acompanhamento"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="todos">Todos os estados</option>
                      {Object.entries(labels).map(([k, v]) => (
                        <option value={k} key={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Gerador"
                      value={generator}
                      onChange={(e) => setGenerator(e.target.value)}
                    >
                      <option value="">Todos os geradores</option>
                      {allGenerators.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                    <label>
                      Emissão de
                      <input
                        aria-label="Emissão de"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      até
                      <input
                        aria-label="Emissão até"
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Lote"
                      value={batchFilter}
                      onChange={(e) => setBatchFilter(e.target.value)}
                    >
                      <option value="">Todos os lotes</option>
                      {doc.batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} • {fmt(b.at)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSearch("");
                        setStatus("todos");
                        setGenerator("");
                        setFrom("");
                        setTo("");
                        setBatchFilter("");
                      }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {fields.map((k) => (
                            <th key={k}>{k}</th>
                          ))}
                          <th>Acompanhamento</th>
                          <th>Conclusão</th>
                          <th>Operador</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered
                          .slice(tablePage * 25, (tablePage + 1) * 25)
                          .map((r) => (
                            <tr key={r.id}>
                              {fields.map((k) => (
                                <td key={k}>
                                  {k === "MTR Nº" ? (
                                    <button
                                      className="text-button"
                                      onClick={() => void openRecord(r)}
                                    >
                                      {r.id}
                                      {r.conflict && <AlertCircle size={14} />}
                                    </button>
                                  ) : [
                                      "Motorista",
                                      "Placa",
                                      "Observações do Gerador",
                                    ].includes(k) ? (
                                    display(r.data[k])
                                  ) : (
                                    r.data[k]
                                  )}
                                </td>
                              ))}
                              <td>
                                <Badge r={r} />
                              </td>
                              <td>{fmt(r.completedAt)}</td>
                              <td>{r.completedBy ?? "—"}</td>
                              <td>
                                <div className="inline-actions">
                                  <button
                                    className="text-button"
                                    onClick={() => void openRecord(r)}
                                  >
                                    Abrir
                                  </button>
                                  <button
                                    className="text-button"
                                    onClick={() => setAudit(r)}
                                  >
                                    Histórico
                                  </button>
                                  {r.state === "concluido" && (
                                    <button
                                      className="text-button"
                                      disabled={busy}
                                      onClick={() =>
                                        void execute({
                                          type: "reopen",
                                          id: r.id,
                                        })
                                      }
                                    >
                                      Reabrir
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!filtered.length && (
                    <div className="empty">Nenhum MTR encontrado.</div>
                  )}
                  <div className="pagination">
                    <span>{filtered.length} documentos encontrados</span>
                    <button
                      className="icon-button"
                      disabled={!tablePage}
                      aria-label="Página anterior"
                      onClick={() => setTablePage((p) => p - 1)}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span>
                      Página {tablePage + 1} de{" "}
                      {Math.max(1, Math.ceil(filtered.length / 25))}
                    </span>
                    <button
                      className="icon-button"
                      disabled={(tablePage + 1) * 25 >= filtered.length}
                      aria-label="Próxima página"
                      onClick={() => setTablePage((p) => p + 1)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </section>
              )}
              {page === "historico" && (
                <section className="panel">
                  <div className="section-title">
                    <h2>Registro de atividades</h2>
                    <span className="subtle-tag">
                      {doc.events.length} eventos
                    </span>
                  </div>
                  <div className="search-input history-search">
                    <Search size={18} />
                    <input
                      aria-label="Buscar histórico"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar no histórico…"
                    />
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Data e hora</th>
                          <th>MTR</th>
                          <th>Ação</th>
                          <th>Operador</th>
                          <th>Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...doc.events]
                          .reverse()
                          .filter((e) =>
                            normalize(Object.values(e).join(" ")).includes(
                              normalize(search),
                            ),
                          )
                          .slice(0, 500)
                          .map((e) => (
                            <tr key={e.id}>
                              <td>{fmt(e.at)}</td>
                              <td>{e.mtr || "Lote"}</td>
                              <td>{e.action}</td>
                              <td>{e.actor}</td>
                              <td>{e.detail || "—"}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!doc.events.length && (
                    <div className="empty">
                      As ações realizadas serão registradas aqui.
                    </div>
                  )}
                  <div className="privacy-note">
                    Exibição de até 500 eventos por busca. A exportação inclui o
                    histórico completo.
                  </div>
                </section>
              )}
              {page === "config" && (
                <div className="settings-grid">
                  <section className="panel settings-panel">
                    <HardDrive size={26} />
                    <h2>Armazenamento</h2>
                    <p>
                      No modo local, os dados ficam no IndexedDB deste
                      navegador. Outras abas recebem as atualizações
                      automaticamente.
                    </p>
                    <div className="mode-options">
                      <button
                        className={
                          "mode-option " + (mode === "local" ? "chosen" : "")
                        }
                        onClick={() => changeMode("local")}
                      >
                        <HardDrive />
                        Modo local{mode === "local" && <Check size={16} />}
                      </button>
                      <button
                        disabled={!supabase}
                        className={
                          "mode-option " + (mode === "shared" ? "chosen" : "")
                        }
                        onClick={() => changeMode("shared")}
                      >
                        <Cloud />
                        Compartilhado{mode === "shared" && <Check size={16} />}
                      </button>
                    </div>
                    <p className="muted">
                      {supabase
                        ? "Workspace configurado: " + workspace
                        : "Supabase não configurado. Siga o README e preencha as variáveis de ambiente para ativar o modo compartilhado."}
                    </p>
                    {user && (
                      <button
                        className="button secondary"
                        onClick={() => void supabase?.auth.signOut()}
                      >
                        <LogOut size={17} />
                        Sair da conta
                      </button>
                    )}
                    <p className="muted">
                      Os modos mantêm bases separadas. Use backup JSON e
                      mesclagem para transferir registros conscientemente.
                    </p>
                  </section>
                  <section className="panel settings-panel">
                    <Database size={26} />
                    <h2>Backup e restauração</h2>
                    <p>
                      Exporte um backup com registros, lotes, origens e
                      histórico. O arquivo é validado antes da restauração.
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => exportBackup(doc)}
                    >
                      <Download size={17} />
                      Exportar backup JSON
                    </button>
                    <label className="button secondary file-label">
                      <Upload size={17} />
                      Restaurar backup
                      <input
                        type="file"
                        accept=".json"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            if (f.size > 50 * 1024 * 1024)
                              throw Error("Backup excede 50 MB.");
                            setBackup(
                              validateBackup(JSON.parse(await f.text())),
                            );
                            setBackupReplace(false);
                          } catch (err) {
                            setError(
                              "Backup inválido: " + (err as Error).message,
                            );
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <p className="muted">
                      Faça cópias regulares. Limpar os dados do navegador remove
                      o armazenamento local.
                    </p>
                  </section>
                  <section className="panel settings-panel">
                    <ShieldCheck size={26} />
                    <h2>Critérios de conferência</h2>
                    <p>
                      Apenas situação “Salvo”. Exclusão exata do gerador
                      GUARARAPES PAINEIS S/A, com normalização de acentos,
                      espaços e variações de S/A.
                    </p>
                    <p>
                      Motorista, placa e observações vazios são exibidos como
                      GRC. O conteúdo original permanece nas origens.
                    </p>
                    <p>
                      Uma reserva dura cinco minutos. Abrir, copiar ou aguardar
                      nunca conclui um MTR.
                    </p>
                  </section>
                </div>
              )}
            </>
          )}
          <footer>
            <span>
              Guararapes Painéis <span className="footer-divider">|</span>{" "}
              Gestão ambiental
            </span>
            <span>
              <ShieldCheck size={14} />
              Apoio à conferência manual de MTR
            </span>
          </footer>
        </main>
      </div>
      {toast && !conferenceOpen && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {conferenceOpen && (
        <ConferenceDialog
          current={current}
          records={queueRecords}
          actor={actor}
          filename={queueBatchName}
          busy={busy}
          canPrevious={visited.length > 1}
          lastDone={
            lastDone && queueRecords.some((r) => r.id === lastDone)
              ? lastDone
              : null
          }
          notice={toast}
          error={error}
          onCopy={copy}
          onClose={() => void closeConference()}
          onComplete={() => void complete()}
          onSkip={() => void skip()}
          onPrevious={() => void previousRecord()}
          onUndo={() => void undoLast()}
          onResume={() => void beginConference()}
          onReserve={() => {
            if (current) void claimAfter(current.id, doc);
          }}
          onReopen={async () => {
            if (current) {
              const result = await execute({ type: "reopen", id: current.id });
              if (result) await claimAfter(current.id, result);
            }
          }}
          onReview={() => {
            if (current) setAudit(current);
          }}
          onRetry={retry ? () => void execute(retry) : undefined}
        />
      )}
      {importOpen && (
        <Modal
          title="Importar relatório"
          wide
          branded
          reviewReady={!!preview}
          onClose={() => setImportOpen(false)}
        >
          <p className="modal-description">
            Os arquivos são lidos neste navegador. Revise a seleção antes de
            importar.
          </p>
          <div
            className="drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void loadFile(f);
            }}
          >
            <div className="empty-icon">
              <Upload size={25} />
            </div>
            <strong>
              {file ? file.name : "Arraste seu relatório até aqui"}
            </strong>
            <p>XLSX, XLS ou CSV • até 30 MB</p>
            <button
              className="button secondary"
              onClick={() => fileInput.current?.click()}
            >
              Selecionar arquivo
            </button>
            <input
              hidden
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                if (e.target.files?.[0]) void loadFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>
          <div className="import-selects">
            {file && /\.csv$/i.test(file.name) && (
              <label>
                Codificação do CSV
                <select
                  value={encoding}
                  onChange={(e) => {
                    setEncoding(e.target.value);
                    void loadFile(file, e.target.value);
                  }}
                >
                  <option value="auto">
                    Automática (UTF-8 / Windows-1252)
                  </option>
                  <option value="utf-8">UTF-8</option>
                  <option value="windows-1252">Windows-1252 / Latin-1</option>
                  <option value="utf-16le">UTF-16 LE</option>
                  <option value="utf-16be">UTF-16 BE</option>
                </select>
              </label>
            )}
            {tables.length > 1 && (
              <label>
                Aba da planilha
                <select
                  aria-label="Aba da planilha"
                  value={preview ? sheet : ""}
                  onChange={(e) => chooseSheet(+e.target.value)}
                >
                  <option value="" disabled>
                    Selecione a aba
                  </option>
                  {tables.map((t, i) => (
                    <option key={i} value={i}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {importError && (
            <div className="notice error" role="alert">
              {importError}
            </div>
          )}
          {preview && (
            <>
              <ImportSummary batch={preview.batch} />
              <p className="muted">
                {
                  preview.records.filter((r) =>
                    doc.records.some((x) => x.id === r.id),
                  ).length
                }{" "}
                MTRs já existentes: acompanhamento e conclusões serão
                preservados.{" "}
                {
                  preview.records.filter(
                    (r) =>
                      r.conflict ||
                      doc.records.some(
                        (x) =>
                          x.id === r.id &&
                          JSON.stringify(x.data) !== JSON.stringify(r.data),
                      ),
                  ).length
                }{" "}
                divergências para revisão.
              </p>
              <p className="muted">
                {
                  new Set(
                    [...preview.batch.ignored, ...preview.batch.issues]
                      .filter((origin) =>
                        doc.records.some((r) => r.id === origin.data["MTR Nº"]),
                      )
                      .map((origin) => origin.data["MTR Nº"]),
                  ).size
                }{" "}
                MTRs já cadastrados aparecem em origens ignoradas ou
                inconsistentes. Essas origens também serão anexadas e
                sinalizadas, preservando o acompanhamento atual.
              </p>
              <h3>Prévia dos elegíveis</h3>
              <div className="table-wrap preview-table">
                <table>
                  <thead>
                    <tr>
                      {fields.map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.records.slice(0, 8).map((r) => (
                      <tr key={r.id}>
                        {fields.map((k) => (
                          <td key={k}>
                            {[
                              "Motorista",
                              "Placa",
                              "Observações do Gerador",
                            ].includes(k)
                              ? display(r.data[k])
                              : r.data[k]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Issues issues={preview.batch.issues} />
            </>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setImportOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={!preview || busy}
              onClick={() => void importConfirm()}
            >
              <Check size={17} />
              Confirmar importação
              {preview ? " • " + preview.records.length + " MTRs" : ""}
            </button>
          </div>
        </Modal>
      )}
      {exportOpen && (
        <Modal title="Exportar dados" onClose={() => setExportOpen(false)}>
          <div className="form-stack">
            <label>
              Conteúdo
              <select
                aria-label="Conteúdo"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="todos">Todos os registros</option>
                <option value="pendentes">
                  Pendentes (inclui em conferência)
                </option>
                <option value="concluidos">Concluídos</option>
                <option value="historico">
                  Histórico de alterações e conclusões
                </option>
              </select>
            </label>
            <label>
              Formato
              <select
                aria-label="Formato"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV (ponto e vírgula)</option>
              </select>
            </label>
            <p className="muted">
              A exportação usa o conteúdo selecionado de toda a base,
              independentemente dos filtros da tela. Conteúdos que podem iniciar
              fórmulas são neutralizados.
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="button primary"
              onClick={() => {
                exportData(doc, scope, format);
                setExportOpen(false);
                say("Exportação gerada.");
              }}
            >
              <Download size={17} />
              Baixar arquivo
            </button>
          </div>
        </Modal>
      )}
      {audit && (
        <Modal
          title={"Origens e histórico • MTR " + audit.id}
          wide
          onClose={() => setAudit(null)}
        >
          <p className="modal-description">
            As origens preservam os sete campos importados, inclusive os
            conteúdos vazios. Escolher uma origem não modifica conclusões
            anteriores.
          </p>
          {(doc.records.find((r) => r.id === audit.id) ?? audit).sources.map(
            (s, i) => (
              <div className="source-card" key={i}>
                <div className="source-title">
                  <strong>
                    Origem {i + 1} • linha {s.line}
                  </strong>
                  <span>
                    {doc.batches.find((b) => b.id === s.batch)?.name ?? s.batch}
                  </span>
                </div>
                <dl>
                  {fields.map((k) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{(s.raw ?? s.data)[k] || <em>(vazio)</em>}</dd>
                    </div>
                  ))}
                </dl>
                {doc.records.find((r) => r.id === audit.id)?.conflict && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={async () => {
                      const result = await execute({
                        type: "resolve",
                        id: audit.id,
                        data: s.data,
                      });
                      if (result) {
                        say("Divergência revisada.");
                        setAudit(null);
                      }
                    }}
                  >
                    Usar esta origem após revisão
                  </button>
                )}
              </div>
            ),
          )}
          <h3>Histórico deste MTR</h3>
          {doc.events
            .filter((e) => e.mtr === audit.id)
            .reverse()
            .map((e) => (
              <div className="event-line" key={e.id}>
                <strong>{e.action}</strong>
                <span>
                  {fmt(e.at)} • {e.actor}
                </span>
                <p>{e.detail}</p>
              </div>
            ))}
        </Modal>
      )}
      {reviewed && (
        <Modal
          title="Detalhes do lote"
          wide
          onClose={() => setReviewBatch(null)}
        >
          <h3>{reviewed.name}</h3>
          <p className="muted">
            Aba: {reviewed.sheet} • Importado em {fmt(reviewed.at)}
          </p>
          <ImportSummary batch={reviewed} />
          <Issues issues={reviewed.issues} />
          <details>
            <summary>
              Ver registros ignorados ({reviewed.ignored.length})
            </summary>
            <Issues issues={reviewed.ignored} title="Registros ignorados" />
          </details>
        </Modal>
      )}
      {backup && (
        <Modal
          title="Restaurar backup validado"
          onClose={() => setBackup(null)}
        >
          <p>
            {backup.records.length} MTRs, {backup.batches.length} lotes e{" "}
            {backup.events.length} eventos.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={backupReplace}
              disabled={mode === "shared"}
              onChange={(e) => setBackupReplace(e.target.checked)}
            />
            Substituir toda a base local
          </label>
          <p className="muted">
            {backupReplace
              ? "A base atual será substituída integralmente. Exporte um backup antes de continuar."
              : "Mesclar mantém estados, conclusões e reservas dos MTRs existentes. Novos MTRs são acrescentados."}
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => exportBackup(doc)}
            >
              Salvar backup atual
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (
                  backupReplace &&
                  !window.confirm(
                    "Substituir toda a base local? Esta ação remove os dados atuais que não estão no backup.",
                  )
                )
                  return;
                const s = await execute({
                  type: "restore",
                  snapshot: backup,
                  replace: backupReplace,
                });
                if (s) {
                  setBackup(null);
                  say("Backup restaurado.");
                }
              }}
            >
              {backupReplace ? "Confirmar substituição" : "Mesclar backup"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Stat({
  title,
  value,
  note,
  icon,
  color = "neutral",
}: {
  title: string;
  value: number;
  note: string;
  icon: ReactNode;
  color?: string;
}) {
  return (
    <div className={"stat-card " + color}>
      <div className="stat-top">
        <span>{title}</span>
        <div className="stat-icon">{icon}</div>
      </div>
      <strong>{value.toLocaleString("pt-BR")}</strong>
      <p>{note}</p>
    </div>
  );
}
function ImportSummary({
  batch,
}: {
  batch: ReturnType<typeof prepare>["batch"];
}) {
  return (
    <>
      <div className="import-stats">
        {[
          ["Linhas lidas", batch.stats.read],
          ["MTRs únicos elegíveis", batch.stats.eligible],
          ["Ignorados por situação", batch.stats.ignoredStatus],
          ["Ignorados pelo gerador", batch.stats.ignoredGenerator],
          ["Duplicidades elegíveis", batch.stats.duplicates],
          ["Inconsistências", batch.stats.inconsistencies],
        ].map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <details className="count-criteria">
        <summary>Como as contagens são calculadas</summary>
        <p>
          Linhas vazias são desconsideradas. Cada linha entra em uma única
          categoria, nesta ordem: dados essenciais inválidos; situação diferente
          de Salvo; gerador excluído; elegível. Nos elegíveis, a primeira
          ocorrência conta como MTR único e as seguintes como duplicidades.
          Assim, linhas lidas = únicos + duplicidades + ignorados por situação +
          ignorados pelo gerador + inconsistências. Divergências são avisos
          adicionais e podem incluir origens não elegíveis do mesmo MTR.
        </p>
      </details>
    </>
  );
}
function Issues({
  issues,
  title = "Inconsistências",
}: {
  issues: ReturnType<typeof prepare>["batch"]["issues"];
  title?: string;
}) {
  return issues.length ? (
    <div>
      <h3>
        {title} ({issues.length})
      </h3>
      <div className="table-wrap issues-table">
        <table>
          <thead>
            <tr>
              <th>Linha</th>
              <th>MTR</th>
              <th>Motivo</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((x, i) => (
              <tr key={i}>
                <td>{x.line}</td>
                <td>{x.data["MTR Nº"] || "(vazio)"}</td>
                <td>{x.reason}</td>
                <td>
                  <details>
                    <summary>Dados originais</summary>
                    <pre>{JSON.stringify(x.data, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;
}
