import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Capacitor } from "@capacitor/core";
import "./styles.css";

const API = import.meta.env.VITE_API_URL ?? "https://morok-ai.onrender.com";
const MOROK_SUB_ICON = `${import.meta.env.BASE_URL}MorokSubIcon.svg`;
const MOROK_CENTER_ICON = `${import.meta.env.BASE_URL}MorokCenterIcon.svg`;

type Msg = { role: "user" | "assistant"; content: string };
type Task = { id: string; title: string; status: string; dueAt?: string };
type Memory = { id: string; content: string };
type Doc = { id: string; name: string; format: string; content?: string };
type Event = { id: string; title: string; startsAt: string; endsAt?: string; notes?: string };
type GithubWorkflow = { id: number; name: string; runNumber: number; commit: string; sha: string; status: string; conclusion: string | null; updatedAt: string };
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


type ResizeDirection = "e" | "s" | "se";

function ResizablePanel({
  id,
  className,
  children,
  minWidth = 120,
  minHeight = 90,
  maxWidth = 1200,
  maxHeight = 900,
  direction = "se",
}: {
  id: string;
  className: string;
  children: ReactNode;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  direction?: ResizeDirection;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState<{ width?: number; height?: number }>({});
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("morok-dashboard-sizes");
    if (!saved) return;
    try {
      const all = JSON.parse(saved) as Record<string, { width?: number; height?: number }>;
      if (all[id]) setSize(all[id]);
    } catch {}
  }, [id]);

  const startResize = (event: React.PointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
    event.preventDefault();
    event.stopPropagation();
    const element = ref.current;
    if (!element) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const start = element.getBoundingClientRect();
    setResizing(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    const move = (e: PointerEvent) => {
      const next: { width?: number; height?: number } = {};
      if (direction.includes("e")) {
        next.width = Math.max(minWidth, Math.min(maxWidth, start.width + e.clientX - startX));
      }
      if (direction.includes("s")) {
        next.height = Math.max(minHeight, Math.min(maxHeight, start.height + e.clientY - startY));
      }
      setSize(next);
    };

    const end = () => {
      setResizing(false);
      setSize(current => {
        try {
          const saved = JSON.parse(localStorage.getItem("morok-dashboard-sizes") || "{}") as Record<string, { width?: number; height?: number }>;
          saved[id] = current;
          localStorage.setItem("morok-dashboard-sizes", JSON.stringify(saved));
        } catch {}
        return current;
      });
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  };

  return (
    <section
      ref={ref as RefObject<HTMLElement>}
      className={`morokResizablePanel ${className} ${resizing ? "is-resizing" : ""}`}
      style={{
        ...(size.width ? { width: size.width } : {}),
        ...(size.height ? { height: size.height } : {}),
      }}
    >
      {children}
      <div className="resizeHandle resizeHandleE" onPointerDown={e => startResize(e, "e")} />
      <div className="resizeHandle resizeHandleS" onPointerDown={e => startResize(e, "s")} />
      <div className="resizeHandle resizeHandleSE" onPointerDown={e => startResize(e, "se")} />
    </section>
  );
}

function Dashboard() {
  const systems = ["ERP","FLOW","OPS","VISION","CONNECT","MOBILE","DOCUMENTS","AI"];
  const processes = [
    ["KORCZAK FLOW","324 MB"],["KORCZAK ERP","512 MB"],["KORCZAK VISION","448 MB"],
    ["KORCZAK OPS","287 MB"],["KORCZAK CONNECT","196 MB"],["KORCZAK MOBILE","143 MB"]
  ];
  const notifications = [
    ["3 processos concluídos","ok"],["1 nova solicitação","hot"],
    ["2 alertas de estoque","hot"],["Atualização disponível","info"]
  ];
  const activity = [
    ["14:32","Fluxo aprovado"],["14:21","Venda registrada"],["13:58","Produção iniciada"],
    ["13:47","Relatório gerado"],["13:12","Integração concluída"]
  ];
  const actions = [["⌕","ANALISAR"],["▦","PLANEJAR"],["▶","EXECUTAR"],["▥","MONITORAR"],["⚙","OTIMIZAR"]];

  return (
    <div className="morokFullDashboard">
      <div className="dashAmbient" aria-hidden="true" />
      <div className="dashTechLines" aria-hidden="true" />
      <header className="dashHeader">
        <div className="kosBrand">
          <div className="kosMark">K<span>O</span>S</div>
          <div>
            <strong>KORCZAK OPERATIONS SYSTEM</strong>
            <small>MAIS CONTROLE. MAIS RESULTADOS.</small>
          </div>
        </div>
        <div className="dashClock"><strong>14:37:26</strong><span>24 SET 2026</span></div>
        <div className="dashWeather"><span className="sunGlyph">☼</span><strong>22°C</strong><small>BRASIL, SP</small></div>
      </header>

      <aside className="dashLeft">
        <ResizablePanel id="resources" className="dashPanel resourcePanel" minWidth={250} minHeight={220}>
          {[
            ["CPU","12%"],["MEMÓRIA RAM","48%"],["ARMAZENAMENTO","67%"],["REDE","1.2 Gbps"]
          ].map(([label,value],i)=>
            <div className="resourceRow" key={label}>
              <span className={"resourceIcon ri"+i}>{i===0?"▣":i===1?"▤":i===2?"◉":"⌘"}</span>
              <div className="resourceData"><b>{label}</b><strong>{value}</strong><span className="resourceBar"><i style={{width:i===0?"12%":i===1?"48%":i===2?"67%":"54%"}}/></span></div>
            </div>
          )}
        </ResizablePanel>
        <ResizablePanel id="processes" className="dashPanel processPanel" minWidth={240} minHeight={170}>
          <h3>PROCESSOS ATIVOS</h3>
          {processes.map(([name,val],i)=><div className="processRow" key={name}><i className={"processDot p"+i}/><span>{name}</span><strong>{val}</strong></div>)}
        </ResizablePanel>
        <ResizablePanel id="assistant" className="assistantPanel" minWidth={260} minHeight={150}>
          <div className="miniRadar"><span/><i/><b/></div>
          <div><h3>MOROK</h3><small>ASSISTENTE VIRTUAL</small><p>Olá, Korczak.<br/>Todos os sistemas estão operando normalmente.</p><div className="wave">▁▃▅▂▆▃▇▂▅▁▃▆▂</div></div>
        </ResizablePanel>
      </aside>

      <ResizablePanel id="systems" className="dashSystems" minWidth={160} minHeight={300}>
        <div className="systemsEdge"/>
        <h2>SISTEMAS</h2>
        <ul>{systems.map((x,i)=><li key={x}><span className={"sysGlyph g"+i}>{["◉","♧","◌","◎","♧","□","▣","♧"][i]}</span>{x}</li>)}</ul>
      </ResizablePanel>

      <main className="dashCore">
        <div className="coreTopLabel"><b>KOS</b><span>CONNEX</span></div>
        <div className="coreRing ringA"/><div className="coreRing ringB"/><div className="coreRing ringC"/>
        <div className="coreRing ringD"/><div className="coreRing ringE"/>
        <div className="coreSweep sweep1"/><div className="coreSweep sweep2"/>
        <div className="coreStar star1"/><div className="coreStar star2"/><div className="coreStar star3"/><div className="coreStar star4"/>
        <div className="coreLogo"><img src={MOROK_CENTER_ICON} alt="Símbolo Morok"/></div>
        <div className="coreName">MOROK</div>
        <div className="coreSubtitle">INTELIGÊNCIA ARTIFICIAL<br/>ASSISTENTE VIRTUAL</div>
      </main>

      <aside className="dashRight">
        <ResizablePanel id="notifications" className="dashPanel notificationPanel" minWidth={220} minHeight={140}>
          <h3>NOTIFICAÇÕES</h3>
          {notifications.map(([x,c])=><div className="noticeRow" key={x}><i className={c}>◉</i><span>{x}</span></div>)}
        </ResizablePanel>
        <ResizablePanel id="activity" className="dashPanel activityPanel" minWidth={220} minHeight={140}>
          <h3>ATIVIDADE RECENTE</h3>
          {activity.map(([time,x])=><div className="activityRow" key={time}><b>{time}</b><span>{x}</span></div>)}
        </ResizablePanel>
      </aside>

      <ResizablePanel id="navigation" className="dashNav" minWidth={220} minHeight={260}>
        <nav className="dashNavInner">
          {["⌂|INÍCIO","▦|SISTEMAS","▤|DOCUMENTOS","♙|PROCESSOS","♟|EQUIPES","▥|RELATÓRIOS","⚙|CONFIGURAÇÕES"].map((item,i)=>{
            const [icon,label]=item.split("|"); return <button className={i===0?"active":""} key={label}><span>{icon}</span>{label}</button>
          })}
        </nav>
      </ResizablePanel>

      <ResizablePanel id="status" className="dashMiniStatus" minWidth={150} minHeight={100}>
        <div className="miniChart"><i/><i/><i/><i/><i/><i/><i/><i/></div>
        <span>OPERAÇÕES<br/><b>ESTÁVEIS</b></span>
        <span className="stable">✓ SEM ANOMALIAS</span>
      </ResizablePanel>

      <ResizablePanel id="goal" className="dashGoal" minWidth={250} minHeight={150}>
        <h3>OBJETIVO ATUAL</h3><b>EVOLUÇÃO CONTÍNUA</b><div className="goalBar"><i/></div>
        <p>“Tecnologia não é o futuro.<br/>É o presente que você constrói<br/>o amanhã.”</p><strong>— KORCZAK TECHNOLOGIES</strong>
      </ResizablePanel>

      <div className="dashActions">{actions.map(([icon,label],i)=><button className={i===2?"execute":""} key={label}><span>{icon}</span>{label}</button>)}</div>
      <footer className="dashFooter">KOS&nbsp; // &nbsp;KORCZAK OPERATIONS SYSTEM</footer>
    </div>
  );
}

function MobileDashboard({onOpenChat}:{onOpenChat:()=>void}){
  const activities=[
    ["11:41","Projeto KOS atualizado","blue"],
    ["11:32","Backup concluído","green"],
    ["10:58","Firewall ativo","purple"],
    ["10:23","Conexão com servidor","cyan"],
    ["09:17","Análise de segurança","red"]
  ];
  const projects=[
    ["KOS - Core System","Desenvolvimento","78%","78"],
    ["KOS - Integrações","Testes","43%","43"],
    ["Infraestrutura Cloud","Implantação","58%","58"]
  ];
  return <div className="mobileMorok">
    <header className="mobileTop">
      <div className="mobileStatus"><span>11:42</span><i>➤</i></div>
      <div className="mobileHeaderPanel">
        <div className="mobileBrand"><div className="mobileLogo"><img src={MOROK_SUB_ICON} alt="Morok" /></div><div><b>MOROK</b><small>IA ASSISTENTE DO KOS</small><em><span/> ONLINE <strong>|</strong> v2.8.4</em></div></div>
        <div className="mobileKos"><b>✦ KOS</b><small>KORCZAK<br/>OPERATIONAL<br/>SYSTEM</small></div>
        <div className="mobileDate"><span>14 SET 2025</span><b>11:42:17</b></div>
      </div>
    </header>

    <main className="mobileBody">
      <aside className="mobileSide">
        <b>SISTEMAS</b><span>PROJETOS</span><span>REDE</span><span>SEGURANÇA</span><span>ANALYTICS</span><i/>
        <p>“Mais do que<br/>tecnologia,<br/>é sobre<br/>o que você<br/>constrói.”</p><small>— MOROK</small>
      </aside>

      <section className="mobileCore">
        <button className="mobileCoreRings" type="button" onClick={onOpenChat} aria-label="Abrir conversa com o Morok">
          <span className="mobileCoreOrbit orbitA" />
          <span className="mobileCoreOrbit orbitB" />
          <span className="mobileCoreOrbit orbitC" />
          <span className="mobileCoreOrbit orbitD" />
          <span className="mobileCoreOrbit orbitE" />
          <span className="mobileCoreCrosshair crosshairH" />
          <span className="mobileCoreCrosshair crosshairV" />
          <span className="mobileCoreNode nodeTop" />
          <span className="mobileCoreNode nodeRight" />
          <span className="mobileCoreNode nodeBottom" />
          <span className="mobileCoreNode nodeLeft" />
          <span className="mobileCoreGlyph"><img src={MOROK_SUB_ICON} alt="Abrir conversa com o Morok" /></span>
          <b>MOROK</b>
          <span className="mobileCoreHint">TOQUE PARA CONVERSAR</span>
          <i>⌁⌁⌁</i>
        </button>
      </section>

      <aside className="mobileTelemetry">
        {[
          ["CPU","34%","cpu"],["RAM","61%","ram"],["DISCO","42%","disk"],["GPU","28%","gpu"]
        ].map(([label,value,type])=><div className={"mTelemetry "+type} key={label}><div className="mGauge"><b>{value}</b></div><section><b>{label}</b><i/><div className="mSpark"/></section></div>)}
        <div className="mSimpleStat"><b>♨</b><span>TEMP.<strong>42°C</strong></span></div>
        <div className="mSimpleStat"><b>◎</b><span>REDE<strong>98%</strong></span><i>▁▃▅▆▇</i></div>
      </aside>

      <section className="mobileRecent panelFrame">
        <h3>◷ <span>ATIVIDADE RECENTE</span></h3>
        {activities.map(([time,title,color])=><div className="mActivity" key={time}><i className={color}/><time>{time}</time><span>{title}</span></div>)}
      </section>

      <section className="mobileKosCard panelFrame">
        <b>KOS</b><em><span/> OPERACIONAL</em><p>Todos os sistemas funcionando normalmente.</p><i/><strong>↗</strong>
      </section>

      <nav className="mobileQuick">
        {[
          ["▦","PROJETOS","ACESSAR"],["☁","ARQUIVOS","ABRIR"],["♢","SEGURANÇA","PAINEL"],["◎","REDE","MONITORAR"],["⚙","UTILITÁRIOS","FERRAMENTAS"]
        ].map(([icon,title,sub])=><button key={title}><i>{icon}</i><b>{title}</b><small>{sub}</small></button>)}
      </nav>

      <section className="mobileProjects panelFrame">
        <h3>▱ <span>PROJETOS EM ANDAMENTO</span><em>3</em></h3>
        {projects.map(([title,meta,value,width])=><div className="mProject" key={title}><i>◇</i><div><b>{title}</b><small>{meta}</small></div><section><span><i style={{width:width+"%"}}/></span><b>{value}</b></section><strong>›</strong></div>)}
      </section>

      <section className="mobileEcosystem panelFrame">
        <div className="mEcoOrb">✦</div><div><b>KOS</b><small>ECOSSISTEMA INTEGRADO</small><p>Infraestrutura, processos<br/>e pessoas em um só lugar.</p><i/></div><button>↗ &nbsp; VER MAIS</button>
      </section>
    </main>
    <div className="mobileHomeBar"/>
  </div>;
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.1.0";
const GITHUB_RELEASES = "https://api.github.com/repos/korczaktechnology-tech/Morok-AI/releases?per_page=20";

function normalizeVersion(value:string){
  const base=value.trim().replace(/^v/i,"").split("-")[0]?.split("+")[0] ?? "";
  return base.split(".").map(x=>Number.parseInt(x,10)||0).slice(0,3).concat([0,0,0]).slice(0,3);
}
function compareVersions(a:string,b:string){
  const av=normalizeVersion(a),bv=normalizeVersion(b);
  for(let i=0;i<3;i++){ const ai=av[i] ?? 0; const bi=bv[i] ?? 0; if(ai>bi)return 1; if(ai<bi)return -1; }
  return 0;
}

function UpdateChecker(){
  const [update,setUpdate]=useState<{version:string;url:string;notes:string}|null>(null);

  // O verificador de atualização pertence somente ao aplicativo nativo mobile.
  // Desktop/web não deve consultar nem exibir a tela de atualização.
  const isMobileApp = Capacitor.isNativePlatform() && (Capacitor.getPlatform() === "android" || Capacitor.getPlatform() === "ios");
  const [checking,setChecking]=useState(false);

  useEffect(()=>{
    if(!isMobileApp)return;
    let active=true;
    const check=async()=>{
      if(checking)return;
      setChecking(true);
      try{
        const response=await fetch(GITHUB_RELEASES,{
          headers:{Accept:"application/vnd.github+json"},
          cache:"no-store"
        });
        if(!response.ok)return;
        const releases=await response.json();
        if(!active || !Array.isArray(releases))return;

        const release=releases
          .filter((item:any)=>item && !item.draft && !item.prerelease && item.tag_name)
          .sort((a:any,b:any)=>compareVersions(String(b.tag_name),String(a.tag_name)))[0];

        if(!release || compareVersions(String(release.tag_name),APP_VERSION)<=0)return;

        const apk=Array.isArray(release.assets)
          ? release.assets.find((asset:any)=>String(asset?.name||"").toLowerCase().endsWith(".apk"))
          : null;
        const url=apk?.browser_download_url || release.html_url;
        if(url && active){
          setUpdate({
            version:String(release.tag_name).replace(/^v/i,""),
            url,
            notes:String(release.body||"")
          });
        }
      }catch{}
      finally{
        if(active)setChecking(false);
      }
    };

    check();
    const onVisibility=()=>{if(document.visibilityState==="visible")check();};
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{
      active=false;
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[]);

  if(!isMobileApp || !update)return null;
  return <div className="morokUpdateOverlay" role="dialog" aria-modal="true" aria-label="Atualização disponível">
    <div className="morokUpdatePanel">
      <div className="morokUpdateCore"><span>M</span></div>
      <small>NOVA VERSÃO DISPONÍVEL</small>
      <h2>MOROK {update.version}</h2>
      <p>Uma versão mais recente do Morok foi encontrada no GitHub.</p>
      {update.notes && <div className="morokUpdateNotes">{update.notes.slice(0,700)}</div>}
      <div className="morokUpdateCurrent">VERSÃO ATUAL <b>{APP_VERSION}</b></div>
      <div className="morokUpdateActions">
        <button className="morokUpdateButton" onClick={()=>window.location.href=update.url}>ATUALIZAR AGORA</button>
        <button className="morokUpdateLater" onClick={()=>setUpdate(null)}>AGORA NÃO</button>
      </div>
    </div>
  </div>;
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
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [workflowMonitorOpen, setWorkflowMonitorOpen] = useState(false);
  const [githubWorkflows, setGithubWorkflows] = useState<GithubWorkflow[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowMonitorPosition, setWorkflowMonitorPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("morok_workflow_monitor_position") ?? "");
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return { x: saved.x, y: saved.y };
    } catch {}
    return { x: 18, y: 18 };
  });
  const workflowDragRef = useRef<{ pointerId:number; offsetX:number; offsetY:number } | null>(null);
  const workflowRequestRef = useRef<AbortController | null>(null);

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
    let disposed=false;
    let refreshTimer=0;

    const loadWorkflows=async()=>{
      if(disposed)return;
      workflowRequestRef.current?.abort();

      const controller=new AbortController();
      workflowRequestRef.current=controller;
      const timeout=window.setTimeout(()=>controller.abort(),12000);

      const mapGithubData=(workflowData:any,runData:any):GithubWorkflow[]=>{
        const latest=new Map<number,any>();
        for(const run of runData?.workflow_runs??[]){
          const current=latest.get(run.workflow_id);
          if(!current || Date.parse(run.updated_at)>Date.parse(current.updated_at))latest.set(run.workflow_id,run);
        }
        return (workflowData?.workflows??[]).map((workflow:any)=>{
          const run=latest.get(workflow.id);
          return {
            id:run?.id??workflow.id,
            workflowId:workflow.id,
            name:workflow.name,
            runNumber:run?.run_number??0,
            commit:run?.head_commit?.message?.split("\n")[0]??"SEM EXECUÇÃO",
            sha:run?.head_sha??"",
            status:run?.status??"idle",
            conclusion:run?.conclusion??null,
            updatedAt:run?.updated_at??"",
            workflowState:workflow.state
          };
        }).sort((a:GithubWorkflow,b:GithubWorkflow)=>a.name.localeCompare(b.name));
      };

      try{
        setWorkflowLoading(true);
        setWorkflowError(null);

        const response=await fetch(API+"/api/v1/github/workflows?ts="+Date.now(),{
          cache:"no-store",
          signal:controller.signal,
          headers:{Accept:"application/json","Cache-Control":"no-cache"}
        });
        if(!response.ok)throw new Error(`HTTP_${response.status}`);
        const data=await response.json() as {workflows?:GithubWorkflow[];error?:string};
        const workflows=data.workflows??[];
        if(!workflows.length && data.error)throw new Error(data.error);

        if(!disposed){
          setGithubWorkflows(workflows);
          if(workflows.length===0)setWorkflowError("NENHUM WORKFLOW ENCONTRADO");
        }
      }catch(error){
        if(disposed)return;
        if(error instanceof DOMException && error.name==="AbortError"){
          setWorkflowError("TEMPO LIMITE EXCEDIDO");
        }else{
          try{
            const [workflowResponse,runsResponse]=await Promise.all([
              fetch("https://api.github.com/repos/korczaktechnology-tech/Morok-AI/actions/workflows?per_page=100",{cache:"no-store"}),
              fetch("https://api.github.com/repos/korczaktechnology-tech/Morok-AI/actions/runs?per_page=100&sort=created&direction=desc",{cache:"no-store"})
            ]);
            if(!workflowResponse.ok||!runsResponse.ok)throw new Error("github_direct_failed");
            const [workflowData,runData]=await Promise.all([workflowResponse.json(),runsResponse.json()]);
            const workflows=mapGithubData(workflowData,runData);
            if(!disposed){
              setGithubWorkflows(workflows);
              if(workflows.length===0)setWorkflowError("NENHUM WORKFLOW ENCONTRADO");
              else setWorkflowError(null);
            }
          }catch{
            if(!disposed)setWorkflowError(error instanceof Error&&error.message.startsWith("HTTP_")?`ERRO DO SERVIDOR (${error.message.slice(5)})`:"NÃO FOI POSSÍVEL CARREGAR OS WORKFLOWS");
          }
        }
      }finally{
        window.clearTimeout(timeout);
        if(!disposed){
          setWorkflowLoading(false);
          workflowRequestRef.current=null;
        }
      }
    };

    if(workflowMonitorOpen){
      void loadWorkflows();
      refreshTimer=window.setInterval(()=>void loadWorkflows(),2000);
    }else{
      workflowRequestRef.current?.abort();
    }

    return()=>{
      disposed=true;
      window.clearInterval(refreshTimer);
      workflowRequestRef.current?.abort();
      workflowRequestRef.current=null;
    };
  }, [workflowMonitorOpen]);

  useEffect(()=>{
    try {
      localStorage.setItem("morok_workflow_monitor_position",JSON.stringify(workflowMonitorPosition));
    } catch {}
  }, [workflowMonitorPosition]);

  useEffect(()=>{
    const onPointerMove=(event:PointerEvent)=>{
      const drag=workflowDragRef.current;
      if(!drag)return;
      const width=Math.min(390,window.innerWidth-20);
      const height=Math.min(window.innerHeight*.78,560);
      const x=Math.max(8,Math.min(window.innerWidth-width-8,event.clientX-drag.offsetX));
      const y=Math.max(8,Math.min(window.innerHeight-height-8,event.clientY-drag.offsetY));
      setWorkflowMonitorPosition({x,y});
    };
    const onPointerUp=()=>{ workflowDragRef.current=null; };
    window.addEventListener("pointermove",onPointerMove);
    window.addEventListener("pointerup",onPointerUp);
    return()=>{ window.removeEventListener("pointermove",onPointerMove); window.removeEventListener("pointerup",onPointerUp); };
  }, []);

  useEffect(()=>{
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.ctrlKey&&event.altKey&&event.key.toLowerCase()==="k"){
        event.preventDefault();
        setWorkflowMonitorOpen(value=>!value);
      }
    };
    window.addEventListener("keydown",onKeyDown);
    return()=>window.removeEventListener("keydown",onKeyDown);
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
        <div className="brandMark"><span className="brandHex"><img src={MOROK_SUB_ICON} alt="Morok" /></span><div><strong>MOROK</strong><small>PERSONAL INTELLIGENCE SYSTEM</small></div></div>
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


  return (
    <>
      {workflowMonitorOpen && (
        <div
          className="workflowMonitor"
          style={{left:workflowMonitorPosition.x,top:workflowMonitorPosition.y}}
          role="status"
          aria-label="Status dos workflows do GitHub"
        >
          <div
            className="workflowMonitorHeader workflowMonitorDragHandle"
            onPointerDown={(event)=>{
              workflowDragRef.current={
                pointerId:event.pointerId,
                offsetX:event.clientX-workflowMonitorPosition.x,
                offsetY:event.clientY-workflowMonitorPosition.y
              };
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerUp={()=>{ workflowDragRef.current=null; }}
          >
            <span>GITHUB ACTIONS</span>
            <span className="workflowMonitorHint">ARRASTE · CTRL + ALT + K</span>
          </div>
          <div className="workflowMonitorList">
            {workflowLoading && githubWorkflows.length===0 ? (
              <div className="workflowMonitorEmpty">CARREGANDO WORKFLOWS...</div>
            ) : workflowError && githubWorkflows.length===0 ? (
              <div className="workflowMonitorEmpty">{workflowError}<button type="button" className="workflowMonitorRetry" onClick={()=>{setWorkflowError(null);setWorkflowMonitorOpen(false);window.setTimeout(()=>setWorkflowMonitorOpen(true),0);}}>TENTAR NOVAMENTE</button></div>
            ) : githubWorkflows.length===0 ? (
              <div className="workflowMonitorEmpty">NENHUM WORKFLOW DISPONÍVEL</div>
            ) : githubWorkflows.map(workflow=>{
              const state=
                workflow.status==="queued" ||
                workflow.status==="in_progress" ||
                workflow.status==="waiting" ||
                workflow.status==="requested" ||
                workflow.status==="pending"
                  ? "queued"
                  : workflow.conclusion==="success"
                    ? "success"
                    : "failure";
              return (
                <div className={`workflowMonitorItem ${state}`} key={workflow.id}>
                  <span className={`workflowStatusDot ${state}`} aria-label={state}/>
                  <div className="workflowMonitorInfo">
                    <div className="workflowMonitorName">{workflow.name}</div>
                    <div className="workflowMonitorMeta">
                      <span>WORKFLOW #{workflow.runNumber}</span>
                      <span>{workflow.commit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      <UpdateChecker />
      <main className="appShell">
        <section className="mainStage">
          <div className="desktopDashboard"><Dashboard /></div><div className="mobileDashboard"><MobileDashboard onOpenChat={()=>setMobileChatOpen(true)} /></div>
          {mobileChatOpen && <div className="mobileChatOverlay"><div className="mobileChatShell"><button className="mobileChatClose" type="button" onClick={()=>setMobileChatOpen(false)} aria-label="Fechar conversa">×</button><Chat messages={messages} input={input} setInput={setInput} send={(v)=>void send(v)} loading={loading} startVoice={startVoice} listening={listening} speaking={speaking} setSpeaking={setSpeaking} /></div></div>}
        </section>
      </main>
    </>
  );

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
}


createRoot(document.getElementById("root")!).render(<App />);
