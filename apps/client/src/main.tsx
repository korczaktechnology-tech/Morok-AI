import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
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
  return <div className="dashboard cleanCommandCenter">
    <section className="heroCore">
      <EarthGlobe />
      <div className="orbit orbitA" />
      <div className="orbit orbitB" />
      <div className="orbit orbitC" />
      <div className="coreRings" />
    </section>
  </div>;
}
function EarthGlobe(){
  const mountRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const mount=mountRef.current;
    if(!mount)return;

    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0x010107);

    const camera=new THREE.PerspectiveCamera(34,1,0.1,100);
    camera.position.set(0,0,6.3);

    const renderer=new THREE.WebGLRenderer({
      antialias:true,
      alpha:false,
      powerPreference:"high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;
    renderer.setClearColor(0x010107,1);
    mount.appendChild(renderer.domElement);

    const ambient=new THREE.AmbientLight(0x4f62b8,1.15);
    scene.add(ambient);
    const sun=new THREE.DirectionalLight(0xc9dcff,3.1);
    sun.position.set(-3,1.8,4);
    scene.add(sun);
    const rim=new THREE.PointLight(0x8d42ff,7,7,2);
    rim.position.set(2,-.8,-2.5);
    scene.add(rim);
    const redRim=new THREE.PointLight(0xff254f,4.5,6,2);
    redRim.position.set(-2,-1,1.5);
    scene.add(redRim);

    const starGeometry=new THREE.BufferGeometry();
    const starPositions:number[]=[];
    for(let i=0;i<1800;i++){
      const radius=9+Math.random()*18;
      const theta=Math.random()*Math.PI*2;
      const phi=Math.acos(2*Math.random()-1);
      starPositions.push(
        radius*Math.sin(phi)*Math.cos(theta),
        radius*Math.cos(phi),
        radius*Math.sin(phi)*Math.sin(theta)
      );
    }
    starGeometry.setAttribute("position",new THREE.Float32BufferAttribute(starPositions,3));
    const stars=new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color:0x8192ff,
        size:.018,
        sizeAttenuation:true,
        transparent:true,
        opacity:.72,
        depthWrite:false
      })
    );
    scene.add(stars);

    const nebulaTexture=(()=>{
      const c=document.createElement("canvas");
      c.width=c.height=256;
      const x=c.getContext("2d");
      if(!x)return null;
      const g=x.createRadialGradient(128,128,4,128,128,128);
      g.addColorStop(0,"rgba(150,30,255,.28)");
      g.addColorStop(.28,"rgba(92,24,190,.16)");
      g.addColorStop(.62,"rgba(40,10,90,.07)");
      g.addColorStop(1,"rgba(0,0,0,0)");
      x.fillStyle=g;x.fillRect(0,0,256,256);
      return new THREE.CanvasTexture(c);
    })();

    const nebulaMaterial=nebulaTexture?new THREE.SpriteMaterial({
      map:nebulaTexture,
      color:0x8a32ff,
      transparent:true,
      opacity:.72,
      depthWrite:false,
      blending:THREE.AdditiveBlending
    }):null;
    if(nebulaMaterial){
      const s1=new THREE.Sprite(nebulaMaterial);s1.scale.set(7,4.5,1);s1.position.set(-4,1,-5);scene.add(s1);
      const s2=new THREE.Sprite(nebulaMaterial.clone());s2.material.color.setHex(0xff244f);s2.material.opacity=.34;s2.scale.set(6,4,1);s2.position.set(4,-1.5,-6);scene.add(s2);
      const s3=new THREE.Sprite(nebulaMaterial.clone());s3.material.color.setHex(0x3f66ff);s3.material.opacity=.22;s3.scale.set(5,5,1);s3.position.set(1,3,-7);scene.add(s3);
    }

    const earthSystem=new THREE.Group();
    earthSystem.rotation.x=-.12;
    earthSystem.rotation.y=-.48;
    scene.add(earthSystem);

    const textureLoader=new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
    textureLoader.setPath("");
    const loadedTextures:THREE.Texture[]=[];
    const loadTexture=(url:string,onLoad:(tex:THREE.Texture)=>void)=>{
      textureLoader.load(url,tex=>{
        loadedTextures.push(tex);
        onLoad(tex);
      },undefined,()=>{});
    };

    const earthMaterial=new THREE.MeshPhongMaterial({
      color:0xffffff,
      shininess:18,
      specular:new THREE.Color(0x6f7cff)
    });
    const earth=new THREE.Mesh(new THREE.SphereGeometry(1,128,128),earthMaterial);
    earthSystem.add(earth);

    loadTexture(
      "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
      tex=>{
        tex.colorSpace=THREE.SRGBColorSpace;
        tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
        earthMaterial.map=tex;
        earthMaterial.needsUpdate=true;
      }
    );

    loadTexture(
      "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
      tex=>{
        earthMaterial.normalMap=tex;
        earthMaterial.normalScale=new THREE.Vector2(.42,.42);
        earthMaterial.needsUpdate=true;
      }
    );

    loadTexture(
      "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg",
      tex=>{
        earthMaterial.specularMap=tex;
        earthMaterial.needsUpdate=true;
      }
    );

    const nightMaterial=new THREE.MeshBasicMaterial({
      color:0x6e72ff,
      transparent:true,
      opacity:.78,
      blending:THREE.AdditiveBlending,
      depthWrite:false
    });
    const night=new THREE.Mesh(new THREE.SphereGeometry(1.006,96,96),nightMaterial);
    earthSystem.add(night);
    loadTexture(
      "https://threejs.org/examples/textures/planets/earth_lights_2048.png",
      tex=>{
        nightMaterial.map=tex;
        nightMaterial.needsUpdate=true;
      }
    );

    const cloudMaterial=new THREE.MeshPhongMaterial({
      color:0xffffff,
      transparent:true,
      opacity:.18,
      depthWrite:false,
      blending:THREE.AdditiveBlending
    });
    const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.014,96,96),cloudMaterial);
    earthSystem.add(clouds);
    loadTexture(
      "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
      tex=>{
        cloudMaterial.map=tex;
        cloudMaterial.needsUpdate=true;
      }
    );

    const atmosphere=new THREE.Mesh(
      new THREE.SphereGeometry(1.075,96,96),
      new THREE.ShaderMaterial({
        uniforms:{glowColor:{value:new THREE.Color(0x426dff)},power:{value:3.1}},
        vertexShader:`
          varying vec3 vNormal;
          varying vec3 vView;
          void main(){
            vNormal=normalize(normalMatrix*normal);
            vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
            vView=normalize(-mvPosition.xyz);
            gl_Position=projectionMatrix*mvPosition;
          }
        `,
        fragmentShader:`
          uniform vec3 glowColor;
          uniform float power;
          varying vec3 vNormal;
          varying vec3 vView;
          void main(){
            float rim=pow(1.0-max(dot(vNormal,vView),0.0),power);
            gl_FragColor=vec4(glowColor,rim*.78);
          }
        `,
        side:THREE.BackSide,
        transparent:true,
        blending:THREE.AdditiveBlending,
        depthWrite:false
      })
    );
    earthSystem.add(atmosphere);

    const boundaryGroup=new THREE.Group();
    earthSystem.add(boundaryGroup);

    const toSphere=(lon:number,lat:number,radius=1.012)=>{
      const lo=(lon+180)*Math.PI/180;
      const la=lat*Math.PI/180;
      return new THREE.Vector3(
        -radius*Math.cos(la)*Math.sin(lo),
        radius*Math.sin(la),
        radius*Math.cos(la)*Math.cos(lo)
      );
    };

    const addGeoLine=(coords:any[],material:THREE.LineBasicMaterial)=>{
      if(!Array.isArray(coords)||coords.length<2)return;
      const points:THREE.Vector3[]=[];
      for(const pair of coords){
        if(!Array.isArray(pair)||pair.length<2)continue;
        points.push(toSphere(Number(pair[0]),Number(pair[1])));
      }
      if(points.length<2)return;
      const geometry=new THREE.BufferGeometry().setFromPoints(points);
      boundaryGroup.add(new THREE.Line(geometry,material));
    };

    const boundaryMaterial=new THREE.LineBasicMaterial({
      color:0x6e8fff,
      transparent:true,
      opacity:.62,
      depthWrite:false,
      blending:THREE.AdditiveBlending
    });

    fetch("https://raw.githubusercontent.com/datasets/geo-countries/main/data/countries.geojson")
      .then(r=>r.ok?r.json():null)
      .then((geo:any)=>{
        if(!geo?.features)return;
        for(const feature of geo.features){
          const g=feature.geometry;
          if(g?.type==="Polygon"){
            for(const ring of g.coordinates)addGeoLine(ring,boundaryMaterial);
          }else if(g?.type==="MultiPolygon"){
            for(const polygon of g.coordinates)for(const ring of polygon)addGeoLine(ring,boundaryMaterial);
          }
        }
      })
      .catch(()=>{});

    const admin1Material=new THREE.LineBasicMaterial({
      color:0xb24cff,
      transparent:true,
      opacity:.48,
      depthWrite:false,
      blending:THREE.AdditiveBlending
    });
    const admin1Url="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces_lines.geojson";
    fetch(admin1Url)
      .then(r=>r.ok?r.json():null)
      .then((geo:any)=>{
        if(!geo?.features)return;
        for(const feature of geo.features){
          const g=feature.geometry;
          if(g?.type==="LineString")addGeoLine(g.coordinates,admin1Material);
          else if(g?.type==="MultiLineString"){
            for(const line of g.coordinates)addGeoLine(line,admin1Material);
          }
        }
      })
      .catch(()=>{});

    const gridGroup=new THREE.Group();
    earthSystem.add(gridGroup);
    const gridMaterial=new THREE.LineBasicMaterial({
      color:0x6d8dff,
      transparent:true,
      opacity:.16,
      depthWrite:false,
      blending:THREE.AdditiveBlending
    });
    for(let lat=-80;lat<=80;lat+=10){
      const pts:THREE.Vector3[]=[];
      for(let lon=-180;lon<=180;lon+=3)pts.push(toSphere(lon,lat,1.008));
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gridMaterial));
    }
    for(let lon=-180;lon<180;lon+=10){
      const pts:THREE.Vector3[]=[];
      for(let lat=-90;lat<=90;lat+=3)pts.push(toSphere(lon,lat,1.008));
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gridMaterial));
    }

    const networkGroup=new THREE.Group();
    earthSystem.add(networkGroup);
    const nodeMaterial=new THREE.MeshBasicMaterial({color:0xff315c});
    const nodeGeometry=new THREE.SphereGeometry(.009,8,8);
    for(let i=0;i<160;i++){
      const lon=-180+Math.random()*360;
      const lat=-70+Math.random()*140;
      const node=new THREE.Mesh(nodeGeometry,nodeMaterial);
      node.position.copy(toSphere(lon,lat,1.018));
      networkGroup.add(node);
    }

    const orbitalGroup=new THREE.Group();
    scene.add(orbitalGroup);

    const makeRing=(radius:number,thickness:number,color:number,opacity:number,tiltX:number,tiltZ:number)=>{
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(radius,thickness,10,220),
        new THREE.MeshBasicMaterial({
          color,
          transparent:true,
          opacity,
          blending:THREE.AdditiveBlending,
          depthWrite:false
        })
      );
      ring.rotation.x=tiltX;
      ring.rotation.z=tiltZ;
      orbitalGroup.add(ring);
      return ring;
    };

    const ringA=makeRing(1.27,.0045,0x7448ff,.72,.34,-.22);
    const ringB=makeRing(1.39,.0025,0xff2d56,.52,-.5,.3);
    const ringC=makeRing(1.52,.002,0x3e74ff,.42,.92,.1);
    const ringD=makeRing(1.68,.0015,0xb23dff,.28,-.2,.78);

    const outerRings=new THREE.Group();
    scene.add(outerRings);
    for(let i=0;i<7;i++){
      const r=1.83+i*.075;
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(r,.0012+(i%3)*.0007,6,220),
        new THREE.MeshBasicMaterial({
          color:i%2?0x6f55ff:0xff315f,
          transparent:true,
          opacity:.16+(i%3)*.035,
          blending:THREE.AdditiveBlending,
          depthWrite:false
        })
      );
      ring.rotation.x=Math.PI/2;
      ring.rotation.z=i*.31;
      outerRings.add(ring);
    }

    const pulseGroup=new THREE.Group();
    scene.add(pulseGroup);
    const pulseGeometry=new THREE.BufferGeometry();
    const pulsePositions:number[]=[];
    for(let i=0;i<280;i++){
      const a=(i/280)*Math.PI*2;
      const r=1.82+(i%9)*.022;
      pulsePositions.push(Math.cos(a)*r,(Math.sin(a*.73)*.035),Math.sin(a)*r);
    }
    pulseGeometry.setAttribute("position",new THREE.Float32BufferAttribute(pulsePositions,3));
    const pulse=new THREE.Points(
      pulseGeometry,
      new THREE.PointsMaterial({
        color:0xb04cff,
        size:.012,
        transparent:true,
        opacity:.7,
        blending:THREE.AdditiveBlending,
        depthWrite:false
      })
    );
    pulseGroup.add(pulse);

    let raf=0;
    let lastTime=performance.now();
    let dragging=false;
    let lastPointer={x:0,y:0};
    let velocity={x:0,y:0};

    const onPointerDown=(e:PointerEvent)=>{
      dragging=true;
      lastPointer={x:e.clientX,y:e.clientY};
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove=(e:PointerEvent)=>{
      if(!dragging)return;
      const dx=e.clientX-lastPointer.x;
      const dy=e.clientY-lastPointer.y;
      lastPointer={x:e.clientX,y:e.clientY};
      earthSystem.rotation.y+=dx*.006;
      earthSystem.rotation.x+=dy*.0045;
      earthSystem.rotation.x=Math.max(-1.25,Math.min(1.25,earthSystem.rotation.x));
      velocity={x:dx*.0008,y:dy*.0005};
    };
    const onPointerUp=()=>{dragging=false};
    renderer.domElement.addEventListener("pointerdown",onPointerDown);
    renderer.domElement.addEventListener("pointermove",onPointerMove);
    renderer.domElement.addEventListener("pointerup",onPointerUp);
    renderer.domElement.addEventListener("pointercancel",onPointerUp);

    const resize=()=>{
      const w=Math.max(1,mount.clientWidth);
      const h=Math.max(1,mount.clientHeight);
      camera.aspect=w/h;
      camera.updateProjectionMatrix();
      renderer.setSize(w,h,false);
    };
    const resizeObserver=new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const animate=(now:number)=>{
      const dt=Math.min(.05,(now-lastTime)/1000);
      lastTime=now;

      if(!dragging){
        earthSystem.rotation.y+=dt*.04+velocity.x;
        earthSystem.rotation.x+=velocity.y;
        velocity.x*=.96;
        velocity.y*=.96;
      }

      clouds.rotation.y+=dt*.004;
      networkGroup.rotation.y+=dt*.002;
      orbitalGroup.rotation.y+=dt*.08;
      orbitalGroup.rotation.x+=dt*.017;
      ringA.rotation.z+=dt*.13;
      ringB.rotation.z-=dt*.09;
      ringC.rotation.x+=dt*.05;
      ringD.rotation.y-=dt*.035;
      outerRings.rotation.y-=dt*.012;
      outerRings.rotation.z+=dt*.006;
      pulse.rotation.y+=dt*.14;
      stars.rotation.y+=dt*.002;
      renderer.render(scene,camera);
      raf=requestAnimationFrame(animate);
    };
    raf=requestAnimationFrame(animate);

    return()=>{
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown",onPointerDown);
      renderer.domElement.removeEventListener("pointermove",onPointerMove);
      renderer.domElement.removeEventListener("pointerup",onPointerUp);
      renderer.domElement.removeEventListener("pointercancel",onPointerUp);
      earthSystem.traverse(o=>{
        const mesh=o as THREE.Mesh;
        if(mesh.geometry)mesh.geometry.dispose();
        const material=mesh.material as THREE.Material|THREE.Material[];
        if(Array.isArray(material))material.forEach(m=>m.dispose());
        else if(material)material.dispose();
      });
      scene.traverse(o=>{
        const mesh=o as THREE.Mesh;
        if(mesh.geometry)mesh.geometry.dispose();
      });
      renderer.dispose();
      if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);
    };
  },[]);

  return <div className="earthGlobe realEarth" ref={mountRef} aria-label="Globo 3D da Terra interativo" />;
}


  return (
    <main className="appShell">
      <section className="mainStage">
        <Dashboard />
      </section>
    </main>
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


createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
