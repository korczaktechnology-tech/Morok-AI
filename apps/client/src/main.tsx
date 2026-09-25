import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = import.meta.env.VITE_API_URL ?? "https://morok-ai.onrender.com";

type Msg = { role: "user" | "assistant"; content: string };
type Task = { id: string; title: string; status: string; dueAt?: string };
type Memory = { id: string; content: string };
type Doc = { id: string; name: string; format: string; content?: string };
type Event = { id: string; title: string; startsAt: string; endsAt?: string; notes?: string };
type ModuleKey =
  | "home"
  | "systems"
  | "documents"
  | "processes"
  | "teams"
  | "reports"
  | "chat"
  | "tasks"
  | "memory"
  | "files"
  | "calendar"
  | "contacts"
  | "notifications"
  | "automations"
  | "integrations"
  | "vault"
  | "settings";

declare global {
  interface Window {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
    morokDesktop?: {
      isAvailable?: () => Promise<boolean>;
      execute?: (action: string, payload?: unknown) => Promise<unknown>;
    };
  }
}

const nav: { key: ModuleKey; label: string; icon: string }[] = [
  { key: "home", label: "INÍCIO", icon: "⌂" },
  { key: "systems", label: "SISTEMAS", icon: "▦" },
  { key: "documents", label: "DOCUMENTOS", icon: "▤" },
  { key: "processes", label: "PROCESSOS", icon: "◌" },
  { key: "teams", label: "EQUIPES", icon: "♙" },
  { key: "reports", label: "RELATÓRIOS", icon: "▥" },
  { key: "settings", label: "CONFIGURAÇÕES", icon: "⚙" }
];

const secondary: { key: ModuleKey; label: string }[] = [
  { key: "chat", label: "MOROK AI" },
  { key: "tasks", label: "TAREFAS" },
  { key: "memory", label: "MEMÓRIA" },
  { key: "files", label: "ARQUIVOS" },
  { key: "calendar", label: "AGENDA" },
  { key: "contacts", label: "CONTATOS" },
  { key: "notifications", label: "NOTIFICAÇÕES" },
  { key: "automations", label: "AUTOMAÇÕES" },
  { key: "integrations", label: "INTEGRAÇÕES" },
  { key: "vault", label: "COFRE" }
];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="navIcon" aria-hidden="true">{children}</span>;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("morok_token") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("OFFLINE");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  const [tab, setTab] = useState<ModuleKey>("home");
  const [notice, setNotice] = useState("");
  const [conversationId, setConversationId] = useState(localStorage.getItem("morok_conversation") ?? "");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [secretCount, setSecretCount] = useState(0);
  const [contacts, setContacts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [localAgent, setLocalAgent] = useState(false);
  const [brasiliaTime, setBrasiliaTime] = useState("00:00:00");
  const [brasiliaDate, setBrasiliaDate] = useState("00/00/0000");
  const [temperature, setTemperature] = useState<string | null>(null);
  const [weatherPlace, setWeatherPlace] = useState("LOCALIZAÇÃO NÃO DISPONÍVEL");

  const speech = useMemo(() => {
    const C = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    return C ? new C() : null;
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setBrasiliaTime(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now));
      setBrasiliaDate(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(now));
    };
    tick(); const id = window.setInterval(tick, 1000); return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m&timezone=auto`);
        if (!r.ok) return; const d = await r.json();
        if (Number.isFinite(d.current?.temperature_2m)) setTemperature(`${Math.round(d.current.temperature_2m)}°C`);
        setWeatherPlace(`${coords.latitude.toFixed(1)}°, ${coords.longitude.toFixed(1)}°`);
      } catch {}
    }, () => setWeatherPlace("LOCALIZAÇÃO BLOQUEADA"), { timeout: 8000, maximumAge: 300000 });
  }, []);

  useEffect(() => {
    fetch(API + "/health").then(r => setStatus(r.ok ? "ONLINE" : "OFFLINE")).catch(() => setStatus("OFFLINE"));
    window.morokDesktop?.isAvailable?.().then(Boolean).then(setLocalAgent).catch(() => setLocalAgent(false));
  }, []);

  useEffect(() => () => {
    speech?.stop();
    window.speechSynthesis?.cancel();
  }, [speech]);

  async function request(path: string, init: RequestInit = {}) {
    const r = await fetch(API + path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {})
      }
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error ?? "request_failed");
    return d;
  }

  async function auth(path: string) {
    setLoading(true);
    try {
      const d = await request(path, { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("morok_token", d.token);
      setToken(d.token);
      setNotice("Acesso autorizado");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation() {
    if (!conversationId) return;
    try {
      const d = await request("/api/v1/conversations/" + conversationId);
      setMessages((d.conversation.messages ?? [])
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .map((m: any) => ({ role: m.role, content: m.content })));
    } catch {}
  }

  async function loadData() {
    try {
      const [t, cal, m, d, v, c, n, a, i, fl] = await Promise.all([
        request("/api/v1/tasks"), request("/api/v1/calendar"), request("/api/v1/memories"),
        request("/api/v1/documents"), request("/api/v1/vault"), request("/api/v1/contacts"),
        request("/api/v1/notifications"), request("/api/v1/automations"),
        request("/api/v1/integrations"), request("/api/v1/files")
      ]);
      setTasks(t.tasks ?? []); setEvents(cal.events ?? []); setMemories(m.memories ?? []);
      setDocs(d.documents ?? []); setSecretCount((v.secrets ?? []).length);
      setContacts(c.contacts ?? []); setNotifications(n.notifications ?? []);
      setAutomations(a.automations ?? []); setIntegrations(i.integrations ?? []); setFiles(fl.files ?? []);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao carregar dados");
    }
  }

  useEffect(() => {
    if (token) { void loadConversation(); void loadData(); }
  }, [token]);

  async function send(text = input) {
    if (!text.trim() || !token || loading) return;
    const value = text.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", content: value }, { role: "assistant", content: "" }]);
    setLoading(true);
    try {
      const params = new URLSearchParams({ message: value, ...(conversationId ? { conversationId } : {}) });
      const r = await fetch(API + "/api/v1/messages/stream?" + params.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok || !r.body) throw new Error("stream_failed");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", full = "";
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const d = JSON.parse(payload);
            if (d.conversationId && !conversationId) {
              setConversationId(d.conversationId);
              localStorage.setItem("morok_conversation", d.conversationId);
            }
            if (d.chunk) {
              full += d.chunk;
              setMessages(m => { const copy = [...m]; copy[copy.length - 1] = { role: "assistant", content: full }; return copy; });
            }
          } catch {}
        }
      }
      if (speaking && full) window.speechSynthesis?.speak(new SpeechSynthesisUtterance(full));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha de comunicação");
      setMessages(m => m.slice(0, -1));
    } finally { setLoading(false); }
  }

  function startVoice() {
    if (!speech) { setNotice("Reconhecimento de voz não suportado neste navegador"); return; }
    speech.lang = "pt-BR"; speech.continuous = false; speech.interimResults = false;
    speech.onstart = () => setListening(true); speech.onend = () => setListening(false);
    speech.onresult = (e: any) => { const text = e.results[0]?.[0]?.transcript ?? ""; setInput(text); void send(text); };
    speech.start();
  }

  async function addTask() {
    const title = window.prompt("Título da tarefa"); if (!title) return;
    try { const d = await request("/api/v1/tasks", { method: "POST", body: JSON.stringify({ title }) }); setTasks(x => [d.task, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function completeTask(id: string) {
    try { await request("/api/v1/tasks/" + id + "/complete", { method: "POST" }); setTasks(x => x.map(t => t.id === id ? { ...t, status: "completed" } : t)); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addEvent() {
    const title = window.prompt("Título do evento"); if (!title) return;
    const startsAt = window.prompt("Início (ISO 8601)", new Date().toISOString()); if (!startsAt) return;
    try { const d = await request("/api/v1/calendar", { method: "POST", body: JSON.stringify({ title, startsAt }) }); setEvents(x => [d.event, ...x].sort((a,b) => a.startsAt.localeCompare(b.startsAt))); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addContact() {
    const name = window.prompt("Nome do contato"); if (!name) return;
    try { const d = await request("/api/v1/contacts", { method: "POST", body: JSON.stringify({ name, email: window.prompt("E-mail") ?? undefined, phone: window.prompt("Telefone") ?? undefined }) }); setContacts(x => [d.contact, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addNotification() {
    const content = window.prompt("Notificação"); if (!content) return;
    try { const d = await request("/api/v1/notifications", { method: "POST", body: JSON.stringify({ content }) }); setNotifications(x => [d.notification, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addAutomation() {
    const name = window.prompt("Nome da automação"); if (!name) return;
    const type = window.prompt("Gatilho: interval ou at", "interval"); if (type !== "interval" && type !== "at") return;
    const value = window.prompt(type === "interval" ? "Intervalo em segundos" : "Data/hora ISO"); if (!value) return;
    const actionType = window.prompt("Ação: notification.create ou task.create", "notification.create");
    if (actionType !== "notification.create" && actionType !== "task.create") return;
    const content = window.prompt(actionType === "task.create" ? "Título da tarefa" : "Conteúdo da notificação"); if (!content) return;
    try {
      const d = await request("/api/v1/automations", { method: "POST", body: JSON.stringify({ name, trigger: { type, value }, action: { type: actionType, input: actionType === "task.create" ? { title: content } : { content } } }) });
      setAutomations(x => [d.automation, ...x]);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function toggleAutomation(a: any) {
    try { const d = await request("/api/v1/automations/" + a.id, { method: "PATCH", body: JSON.stringify({ enabled: !a.enabled }) }); setAutomations(x => x.map(v => v.id === a.id ? d.automation : v)); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addSecret() {
    const name = window.prompt("Nome da credencial"); if (!name) return;
    const value = window.prompt("Valor secreto"); if (!value) return;
    try { await request("/api/v1/vault", { method: "POST", body: JSON.stringify({ name, value, kind: "credential" }) }); setSecretCount(x => x + 1); setNotice("Credencial armazenada"); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function toggleIntegration(a: any) {
    try { const d = await request("/api/v1/integrations/" + a.id, { method: "PATCH", body: JSON.stringify({ enabled: !a.enabled }) }); setIntegrations(x => x.map(v => v.id === a.id ? d.integration : v)); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addIntegration() {
    const name = window.prompt("Nome da integração"); if (!name) return;
    const endpoint = window.prompt("Endpoint HTTPS"); if (!endpoint) return;
    const secret = window.prompt("Bearer/token"); if (!secret) return;
    try { const d = await request("/api/v1/integrations", { method: "POST", body: JSON.stringify({ name, endpoint, secret, type: "webhook" }) }); setIntegrations(x => [d.integration, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addFile() {
    const name = window.prompt("Nome do arquivo"); if (!name) return;
    const content = window.prompt("Conteúdo do arquivo", "") ?? "";
    try { const d = await request("/api/v1/files", { method: "POST", body: JSON.stringify({ name, mimeType: "text/plain", contentBase64: btoa(unescape(encodeURIComponent(content))) }) }); setFiles(x => [d.file, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function deleteFile(id: string) {
    try { await request("/api/v1/files/" + id, { method: "DELETE" }); setFiles(x => x.filter(v => v.id !== id)); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function deleteDoc(id: string) {
    try { await request("/api/v1/documents/" + id, { method: "DELETE" }); setDocs(x => x.filter(v => v.id !== id)); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addMemory() {
    const content = window.prompt("Memória"); if (!content) return;
    try { const d = await request("/api/v1/memories", { method: "POST", body: JSON.stringify({ content }) }); setMemories(x => [d.memory, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addDoc() {
    const name = window.prompt("Nome do documento", "novo.md"); if (!name) return;
    const content = window.prompt("Conteúdo", "") ?? "";
    try {
      const format = name.endsWith(".json") ? "json" : name.endsWith(".csv") ? "csv" : name.endsWith(".html") ? "html" : name.endsWith(".txt") ? "text" : "markdown";
      const d = await request("/api/v1/documents", { method: "POST", body: JSON.stringify({ name, format, content }) }); setDocs(x => [d.document, ...x]);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function openDoc(id: string) {
    try {
      const d = await request("/api/v1/documents/" + id); const next = window.prompt("Editar documento", d.document.content);
      if (next === null) return;
      const u = await request("/api/v1/documents/" + id, { method: "PATCH", body: JSON.stringify({ content: next }) });
      setDocs(x => x.map(v => v.id === id ? u.document : v));
    } catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  function logout() { localStorage.removeItem("morok_token"); setToken(""); setMessages([]); }

  if (!token) return (
    <main className="loginShell">
      <div className="loginGlow glowOne" /><div className="loginGlow glowTwo" />
      <section className="loginPanel">
        <div className="brandMark"><span className="brandHex">M</span><div><strong>MOROK</strong><small>PERSONAL INTELLIGENCE SYSTEM</small></div></div>
        <div className="loginOrb"><span /></div>
        <p className="eyebrow">SECURE CORE ACCESS / LINUX READY</p>
        <h1>Acesse o núcleo.</h1>
        <p className="loginCopy">Interface operacional do Morok. A mesma camada visual poderá ser executada no aplicativo desktop.</p>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-MAIL" />
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="SENHA" />
        <div className="loginActions"><button onClick={() => void auth("/api/v1/auth/login")} disabled={loading}>ENTRAR</button><button className="ghost" onClick={() => void auth("/api/v1/auth/register")} disabled={loading}>CRIAR CONTA</button></div>
        <p className="loginHint">{notice || "Conexão criptografada com o núcleo Morok."}</p>
      </section>
    </main>
  );

  const unread = notifications.length;
  const activeTasks = tasks.filter(t => t.status !== "completed").length;
  const activeAutomations = automations.filter(a => a.enabled).length;
  const memoryCount = memories.length;
  const title = nav.find(x => x.key === tab)?.label ?? secondary.find(x => x.key === tab)?.label ?? "MOROK AI";

  function Dashboard() {
    return <div className="dashboard">
      <section className="telemetry leftTelemetry">
        <Telemetry label="CPU" value="12%" width="22%" icon="◫" />
        <Telemetry label="MEMÓRIA RAM" value="48%" width="48%" icon="▣" />
        <Telemetry label="ARMAZENAMENTO" value="67%" width="67%" icon="◉" />
        <Telemetry label="REDE" value="1.2 Gbps" width="73%" icon="⌁" />
        <Panel title="PROCESSOS ATIVOS">
          {["KORCZAK FLOW 324 MB","KORCZAK ERP 512 MB","KORCZAK VISION 448 MB","KORCZAK OPS 287 MB","KORCZAK CONNECT 196 MB","MOROK CORE ONLINE"].map((x,i)=><div className="processRow" key={x}><i className={i === 5 ? "violet" : ""} /><span>{x}</span></div>)}
        </Panel>
      </section>
      <section className="systemRail">
        <Panel title="SISTEMAS">
          {[["ERP","▦"],["FLOW","⌁"],["OPS","◈"],["VISION","◎"],["CONNECT","♧"],["MOBILE","▣"],["DOCUMENTS","▤"],["AI","✦"]].map(([name,icon]) =>
            <button className="systemRailRow" key={name} onClick={()=>setTab(name==="AI"?"chat":name==="DOCUMENTS"?"documents":"systems")}><Icon>{icon}</Icon><span>{name}</span></button>
          )}
        </Panel>
      </section>
      <section className="heroCore">
        <div className="coreLabel"><span>KOS</span><small>ONLINE</small></div>
        <div className="scanLines" />
        <EarthGlobe />
        <div className="orbit orbitA" /><div className="orbit orbitB" /><div className="orbit orbitC" />
        <div className="coreRings" />
        <div className="coreReadout"><span>◉</span><b>MOROK CORE</b><small>OPERAÇÃO ESTÁVEL</small></div>
        <div className="coreMetrics"><span>IA <b>ONLINE</b></span><span>API <b>{status}</b></span><span>AGENTE <b>{localAgent ? "LOCAL" : "WEB"}</b></span></div>
      </section>
      <section className="telemetry rightTelemetry">
        <Panel title="NOTIFICAÇÕES">{notifications.slice(0,4).map((n:any,i)=><div className="feedRow" key={n.id ?? i}><b>{String(i+1).padStart(2,"0")}</b><span>{n.content}</span></div>)}{notifications.length===0&&<div className="muted">Nenhuma notificação pendente.</div>}</Panel>
        <Panel title="ATIVIDADE RECENTE">{events.slice(0,5).map(e=><div className="feedRow" key={e.id}><b>{new Date(e.startsAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</b><span>{e.title}</span></div>)}{events.length===0&&<div className="muted">Nenhuma atividade registrada.</div>}</Panel>
        <div className="objective"><span>◎</span><div><small>OBJETIVO ATUAL</small><b>EVOLUÇÃO CONTÍNUA</b></div><div className="progress"><i /></div></div>
      </section>
      <section className="morokBrief"><div className="miniOrb"><span /></div><div><small>MOROK / ASSISTENTE VIRTUAL</small><p>Olá, Korczak.<br />Todos os sistemas estão operando normalmente.</p><div className="wave"><i/><i/><i/><i/><i/><i/><i/><i/></div></div></section>
      <div className="quickActions">{[
        ["ANALISAR","⌕","chat"],["PLANEJAR","▦","calendar"],["EXECUTAR","▶","tasks"],["MONITORAR","▥","processes"],["OTIMIZAR","⚙","settings"]
      ].map(([label,icon,key],i)=><button key={label} className={i===2?"execute":""} onClick={()=>setTab(key as ModuleKey)}><Icon>{icon}</Icon><span>{label}</span></button>)}</div>
      <div className="operationChart"><div className="chartTitle">OPERAÇÕES <span>ESTÁVEIS</span></div><svg viewBox="0 0 420 100" preserveAspectRatio="none"><path d="M0 76 L28 70 L52 78 L79 53 L104 61 L132 45 L158 52 L184 32 L211 48 L239 37 L266 43 L294 22 L321 34 L349 18 L377 29 L420 10 L420 100 L0 100Z" fill="rgba(75,95,255,.16)"/><path d="M0 76 L28 70 L52 78 L79 53 L104 61 L132 45 L158 52 L184 32 L211 48 L239 37 L266 43 L294 22 L321 34 L349 18 L377 29 L420 10" fill="none" stroke="#6678ff" strokeWidth="2"/></svg></div><div className="statsStrip">
        <Stat label="TAREFAS ATIVAS" value={String(activeTasks)} />
        <Stat label="MEMÓRIAS" value={String(memoryCount)} />
        <Stat label="AUTOMAÇÕES" value={String(activeAutomations)} />
        <Stat label="ALERTAS" value={String(unread)} />
      </div>
    </div>;
  }

  return <main className="appShell">
    <header className="topBar">
      <div className="topBrand"><div className="kosLogo"><span>K</span><i>O</i><b>S</b></div><div><small>KORCZAK OPERATIONS SYSTEM</small></div></div>
      <div className="tagline">MAIS CONTROLE. MAIS RESULTADOS.</div>
      <div className="topInfo"><span className="clock">{brasiliaTime}</span><span>{brasiliaDate}</span><span>◌ {temperature ?? "—°C"}</span><span>LOCAL · {weatherPlace}</span></div>
    </header>
    <aside className="sideNav">
      <div className="navSection"><small>NAVEGAÇÃO PRINCIPAL</small>{nav.map(item=><button className={tab===item.key?"active":""} onClick={()=>setTab(item.key)} key={item.key}><Icon>{item.icon}</Icon><span>{item.label}</span></button>)}</div>
      <div className="navSection"><small>RECURSOS MOROK</small>{secondary.slice(0,5).map(item=><button className={tab===item.key?"active secondaryActive":""} onClick={()=>setTab(item.key)} key={item.key}><Icon>◈</Icon><span>{item.label}</span></button>)}</div>
      <div className="sideFooter"><span className={status==="ONLINE"?"dot online":"dot"} /> API {status}<small>v0.1 · CORE READY</small></div>
    </aside>
    <section className="mainStage">
      {tab!=="home" && <div className="stageHeader"><div><span className="eyebrow">KOS // MOROK COMMAND CENTER</span><h1>{title}</h1></div><div className="headerStatus"><span>◉</span> SISTEMA {status}</div></div>}
      {tab==="home" ? <Dashboard /> : tab==="systems" ? <Systems setTab={setTab} /> : tab==="processes" ? <Processes tasks={tasks} automations={automations} integrations={integrations} /> : tab==="teams" ? <Teams contacts={contacts} /> : tab==="reports" ? <Reports tasks={tasks} events={events} docs={docs} /> : tab==="chat" ? <Chat messages={messages} input={input} setInput={setInput} send={send} loading={loading} startVoice={startVoice} listening={listening} speaking={speaking} setSpeaking={setSpeaking} /> : tab==="documents" ? <Module title="Documentos" action={addDoc}>{docs.map(d=><Item key={d.id} title={d.name} meta={d.format}><button onClick={()=>void openDoc(d.id)}>ABRIR</button><button onClick={()=>void deleteDoc(d.id)}>EXCLUIR</button></Item>)}</Module> : tab==="tasks" ? <Module title="Tarefas" action={addTask}>{tasks.map(t=><Item key={t.id} title={t.title} meta={t.status}>{t.status!=="completed"&&<button onClick={()=>void completeTask(t.id)}>CONCLUIR</button>}</Item>)}</Module> : tab==="memory" ? <Module title="Memória" action={addMemory}>{memories.map(m=><Item key={m.id} title={m.content} meta="MEMÓRIA PERSISTENTE" />)}</Module> : tab==="files" ? <Module title="Arquivos" action={addFile}>{files.map(f=><Item key={f.id} title={f.name} meta={f.mimeType}><button onClick={()=>void deleteFile(f.id)}>EXCLUIR</button></Item>)}</Module> : tab==="calendar" ? <Module title="Agenda" action={addEvent}>{events.map(e=><Item key={e.id} title={e.title} meta={new Date(e.startsAt).toLocaleString("pt-BR")} />)}</Module> : tab==="contacts" ? <Module title="Contatos" action={addContact}>{contacts.map(c=><Item key={c.id} title={c.name} meta={c.email ?? c.phone ?? "SEM CONTATO"} />)}</Module> : tab==="notifications" ? <Module title="Notificações" action={addNotification}>{notifications.map(n=><Item key={n.id} title={n.content} meta={new Date(n.createdAt).toLocaleString("pt-BR")} />)}</Module> : tab==="automations" ? <Module title="Automações" action={addAutomation}>{automations.map(a=><Item key={a.id} title={a.name} meta={a.trigger.type + ":" + a.trigger.value}><button onClick={()=>void toggleAutomation(a)}>{a.enabled?"DESATIVAR":"ATIVAR"}</button></Item>)}</Module> : tab==="integrations" ? <Module title="Integrações" action={addIntegration}>{integrations.map(a=><Item key={a.id} title={a.name} meta={a.type}><button onClick={()=>void toggleIntegration(a)}>{a.enabled?"DESATIVAR":"ATIVAR"}</button></Item>)}</Module> : tab==="vault" ? <Module title="Cofre" action={addSecret}><Item title={String(secretCount)} meta="CREDENCIAIS PROTEGIDAS POR CRIPTOGRAFIA" /></Module> : <Settings speaking={speaking} setSpeaking={setSpeaking} secretCount={secretCount} newConversation={()=>{localStorage.removeItem("morok_conversation");setConversationId("");setMessages([])}} localAgent={localAgent} notice={notice} /> }
    </section>
    <aside className="imageNav">
      {[["home","⌂","INÍCIO"],["systems","▦","SISTEMAS"],["documents","▤","DOCUMENTOS"],["processes","◌","PROCESSOS"],["teams","♙","EQUIPES"],["reports","▥","RELATÓRIOS"],["settings","⚙","CONFIGURAÇÕES"]].map(([key,icon,label])=><button className={tab===key?"active":""} key={key} onClick={()=>setTab(key as ModuleKey)}><Icon>{icon}</Icon><span>{label}</span></button>)}
    </aside>
  </main>;
}

function EarthGlobe(){
  const canvasRef=useRef<HTMLCanvasElement>(null); const rotation=useRef(-0.5); const dragging=useRef(false); const lastX=useRef(0); const velocity=useRef(0);
  useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;let raf=0;const dpr=Math.min(devicePixelRatio||1,2);const land=[[-165,55],[-130,50],[-105,42],[-90,30],[-80,20],[-75,5],[-65,0],[-55,-20],[-50,-40],[-40,-20],[-50,0],[-70,15],[-90,32],[-120,48],[-165,55],[-80,12],[-70,4],[-62,-8],[-55,-18],[-50,-30],[-58,-35],[-68,-20],[-75,-5],[-80,12],[-10,35],[5,45],[25,50],[45,35],[50,20],[35,8],[20,10],[10,-5],[0,5],[-10,20],[-10,35],[35,-12],[55,-20],[70,-5],[75,12],[60,25],[45,12],[35,-12]];
  const draw=()=>{const r=canvas.getBoundingClientRect(),w=r.width,h=r.height;if(canvas.width!==w*dpr||canvas.height!==h*dpr){canvas.width=w*dpr;canvas.height=h*dpr}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const R=Math.min(w,h)*.39,cx=w/2,cy=h/2;if(!dragging.current)rotation.current+=.0017+velocity.current*.001;velocity.current*=.96;const g=ctx.createRadialGradient(cx-R*.34,cy-R*.4,R*.02,cx,cy,R*1.15);g.addColorStop(0,"#bfe1ff");g.addColorStop(.12,"#4b91ff");g.addColorStop(.42,"#1939c5");g.addColorStop(.78,"#071150");g.addColorStop(1,"#01030e");ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.fillStyle=g;ctx.fill();ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.clip();const p=(lo,la)=>{const L=lo*Math.PI/180+rotation.current,P=la*Math.PI/180;const x=Math.sin(L)*Math.cos(P),y=Math.sin(P),z=Math.cos(L)*Math.cos(P);return{x:cx+x*R,y:cy-y*R*.96,z}};ctx.lineWidth=.65;for(let la=-60;la<=60;la+=20){ctx.beginPath();for(let lo=-180;lo<=180;lo+=4){const q=p(lo,la);lo===-180?ctx.moveTo(q.x,q.y):ctx.lineTo(q.x,q.y)}ctx.strokeStyle="rgba(130,170,255,.3)";ctx.stroke()}for(let lo=-160;lo<=180;lo+=20){ctx.beginPath();for(let la=-88;la<=88;la+=4){const q=p(lo,la);la===-88?ctx.moveTo(q.x,q.y):ctx.lineTo(q.x,q.y)}ctx.strokeStyle="rgba(120,160,255,.26)";ctx.stroke()}for(let k=0;k<3;k++){ctx.beginPath();land.slice(k===0?0:k===1?15:24,k===0?15:k===1?24:land.length).forEach(([lo,la]: [number,number],i)=>{const q=p(lo,la);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath();ctx.fillStyle="rgba(73,137,255,.72)";ctx.shadowColor="#438cff";ctx.shadowBlur=6;ctx.fill();ctx.shadowBlur=0}for(let i=0;i<28;i++){const q=p(-170+i*28,Math.sin(i*1.7)*42);if(q.z>.1){ctx.beginPath();ctx.arc(q.x,q.y,1.7,0,7);ctx.fillStyle=i%5===0?"#ff3c62":"#7ca7ff";ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0}}const l=ctx.createLinearGradient(cx-R,cy-R,cx+R,cy+R);l.addColorStop(0,"rgba(255,255,255,.2)");l.addColorStop(.28,"transparent");l.addColorStop(.7,"rgba(0,0,0,.18)");l.addColorStop(1,"rgba(0,0,0,.8)");ctx.fillStyle=l;ctx.fillRect(cx-R,cy-R,R*2,R*2);ctx.restore();ctx.beginPath();ctx.arc(cx,cy,R+2,0,7);ctx.strokeStyle="rgba(87,137,255,.9)";ctx.shadowColor="#386cff";ctx.shadowBlur=18;ctx.stroke();ctx.shadowBlur=0;raf=requestAnimationFrame(draw)};draw();return()=>cancelAnimationFrame(raf)},[]);
  const down=(e:React.PointerEvent)=>{dragging.current=true;lastX.current=e.clientX;(e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId)};const move=(e:React.PointerEvent)=>{if(!dragging.current)return;const dx=e.clientX-lastX.current;lastX.current=e.clientX;rotation.current+=dx*.008;velocity.current=dx};const up=()=>{dragging.current=false};return <div className="earthGlobe"><canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/><div className="earthGlow"/></div>;
}

function Telemetry(p:{label:string;value:string;width:string;icon:string}){return <div className="telemetryCard"><Icon>{p.icon}</Icon><div><div><span>{p.label}</span><b>{p.value}</b></div><div className="bar"><i style={{width:p.width}} /></div></div></div>}
function Panel(p:{title:string;children:React.ReactNode}){return <div className="holoPanel"><div className="panelTitle"><span>{p.title}</span><i /></div>{p.children}</div>}
function Stat(p:{label:string;value:string}){return <div><small>{p.label}</small><b>{p.value}</b></div>}
function Item(p:{title:string;meta:string;children?:React.ReactNode}){return <div className="dataItem"><div><b>{p.title}</b><small>{p.meta}</small></div><div className="itemActions">{p.children}</div></div>}
function Module(p:{title:string;action?:()=>void;children:React.ReactNode}){return <section className="modulePanel"><div className="moduleHeader"><div><span className="eyebrow">MOROK CORE MODULE</span><h2>{p.title}</h2></div>{p.action&&<button onClick={p.action}>+ NOVO</button>}</div><div className="dataList">{p.children}</div></section>}

function Systems({setTab}:{setTab:(x:ModuleKey)=>void}){const systems=[["KORCZAK ERP","GESTÃO EMPRESARIAL","▦"],["KORCZAK FLOW","AUTOMAÇÃO DE PROCESSOS","⌁"],["KORCZAK OPS","OPERAÇÃO E PRODUÇÃO","◈"],["KORCZAK VISION","GESTÃO VISUAL","◎"],["KORCZAK CONNECT","INTEGRAÇÕES","♧"],["KORCZAK MOBILE","OPERAÇÃO MÓVEL","▣"],["MOROK AI","ASSISTENTE INTELIGENTE","✦"],["KORCZAK DOCUMENTS","GESTÃO DOCUMENTAL","▤"]];return <section className="systemsGrid">{systems.map(([name,desc,icon],i)=><button className="systemCard" key={name} onClick={()=>setTab(i===6?"chat":i===7?"documents":"processes")}><span>{icon}</span><div><b>{name}</b><small>{desc}</small></div><i>↗</i></button>)}</section>}
function Processes({tasks,automations,integrations}:{tasks:Task[];automations:any[];integrations:any[]}){return <section className="reportGrid"><Panel title="PROCESSOS EM EXECUÇÃO"><div className="bigNumber">{tasks.filter(t=>t.status!=="completed").length}</div><span className="muted">tarefas pendentes</span></Panel><Panel title="AUTOMAÇÕES ATIVAS"><div className="bigNumber">{automations.filter(a=>a.enabled).length}</div><span className="muted">rotinas habilitadas</span></Panel><Panel title="INTEGRAÇÕES"><div className="bigNumber">{integrations.length}</div><span className="muted">conexões configuradas</span></Panel><Panel title="ESTADO OPERACIONAL"><div className="statusMatrix"><span>API <b>ONLINE</b></span><span>IA <b>READY</b></span><span>DB <b>CONNECTED</b></span><span>AGENTE <b>PREPARED</b></span></div></Panel></section>}
function Teams({contacts}:{contacts:any[]}){return <Module title="Equipes e contatos"><div className="teamHero"><div className="teamCore">♙</div><div><b>REDE OPERACIONAL</b><p>{contacts.length} contatos registrados no núcleo atual.</p></div></div>{contacts.slice(0,8).map(c=><Item key={c.id} title={c.name} meta={c.email??c.phone??"SEM CONTATO"} />)}</Module>}
function Reports({tasks,events,docs}:{tasks:Task[];events:Event[];docs:Doc[]}){return <section className="reportGrid"><Panel title="TAREFAS"><div className="bigNumber">{tasks.length}</div><span className="muted">registros</span></Panel><Panel title="AGENDA"><div className="bigNumber">{events.length}</div><span className="muted">eventos</span></Panel><Panel title="DOCUMENTOS"><div className="bigNumber">{docs.length}</div><span className="muted">arquivos documentais</span></Panel><Panel title="PERFORMANCE"><div className="chart"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><small>atividade do núcleo</small></Panel></section>}
function Chat(p:{messages:Msg[];input:string;setInput:(v:string)=>void;send:(v?:string)=>void;loading:boolean;startVoice:()=>void;listening:boolean;speaking:boolean;setSpeaking:(v:boolean)=>void}){return <section className="chatPanel"><div className="chatHeader"><div className="miniOrb"><span/></div><div><b>MOROK</b><small>ASSISTENTE VIRTUAL · {p.loading?"PROCESSANDO":"PRONTO"}</small></div><button onClick={()=>p.setSpeaking(!p.speaking)}>VOZ {p.speaking?"ON":"OFF"}</button></div><div className="chatMessages">{p.messages.length===0?<div className="emptyChat"><div className="miniOrb large"><span/></div><b>Olá, Korczak.</b><span>Estou pronto para analisar, planejar, executar e monitorar.</span></div>:p.messages.map((m,i)=><article className={m.role} key={i}><small>{m.role==="user"?"VOCÊ":"MOROK"}</small><p>{m.content||"PROCESSANDO..."}</p></article>)}</div><form onSubmit={e=>{e.preventDefault();p.send()}}><button type="button" className={p.listening?"voice active":"voice"} onClick={p.startVoice}>◉</button><input value={p.input} onChange={e=>p.setInput(e.target.value)} placeholder="Digite uma instrução para o Morok..." /><button disabled={p.loading||!p.input.trim()}>ENVIAR</button></form></section>}
function Settings(p:{speaking:boolean;setSpeaking:(v:boolean)=>void;secretCount:number;newConversation:()=>void;localAgent:boolean;notice:string}){return <Module title="Configurações"><Item title="Voz do Morok" meta={p.speaking?"SÍNTESE DE VOZ ATIVA":"SÍNTESE DE VOZ DESATIVADA"}><button onClick={()=>p.setSpeaking(!p.speaking)}>{p.speaking?"DESATIVAR":"ATIVAR"}</button></Item><Item title="Cofre seguro" meta={p.secretCount+" credenciais armazenadas"} /><Item title="Agente local" meta={p.localAgent?"DESKTOP DISPONÍVEL":"INTERFACE PREPARADA PARA AGENTE DESKTOP"} /><Item title="Conversa" meta="Limpar contexto local"><button onClick={p.newConversation}>NOVA CONVERSA</button></Item><div className="settingsNotice">{p.notice}</div></Module>}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
