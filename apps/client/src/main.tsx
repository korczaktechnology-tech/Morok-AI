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


type ResizeDirection = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
type PanelGeometry = {
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  curve?: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
};

function ResizablePanel({
  id,
  className,
  children,
  minWidth = 120,
  minHeight = 90,
  maxWidth = 1200,
  maxHeight = 900,
}: {
  id: string;
  className: string;
  children: ReactNode;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState<PanelGeometry>({});
  const [interaction, setInteraction] = useState<"resize" | "move" | "curve" | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("morok-dashboard-geometry");
    if (!saved) return;
    try {
      const all = JSON.parse(saved) as Record<string, PanelGeometry>;
      if (all[id]) setGeometry(all[id]);
    } catch {}
  }, [id]);

  const normalizeGeometry = (): PanelGeometry | null => {
    const element = ref.current;
    if (!element) return null;
    const parent = element.offsetParent as HTMLElement | null;
    if (!parent) return null;
    const rect = element.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left - parentRect.left,
      top: rect.top - parentRect.top,
    };
  };

  const saveGeometry = (current: PanelGeometry) => {
    try {
      const saved = JSON.parse(localStorage.getItem("morok-dashboard-geometry") || "{}") as Record<string, PanelGeometry>;
      saved[id] = current;
      localStorage.setItem("morok-dashboard-geometry", JSON.stringify(saved));
    } catch {}
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
    event.preventDefault();
    event.stopPropagation();
    const element = ref.current;
    const base = normalizeGeometry();
    if (!element || !base) return;

    // Ctrl + left click on a resize side/corner switches that handle into curvature mode.
    if (event.ctrlKey) {
      startCurve(event, direction);
      return;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...base };
    setInteraction("resize");

    const move = (e: PointerEvent) => {
      const next: PanelGeometry = { ...start };
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (direction.includes("e")) {
        next.width = Math.max(minWidth, Math.min(maxWidth, (start.width || 0) + dx));
      }
      if (direction.includes("s")) {
        next.height = Math.max(minHeight, Math.min(maxHeight, (start.height || 0) + dy));
      }
      if (direction.includes("w")) {
        const width = Math.max(minWidth, Math.min(maxWidth, (start.width || 0) - dx));
        next.width = width;
        next.left = (start.left || 0) + (start.width || 0) - width;
      }
      if (direction.includes("n")) {
        const height = Math.max(minHeight, Math.min(maxHeight, (start.height || 0) - dy));
        next.height = height;
        next.top = (start.top || 0) + (start.height || 0) - height;
      }
      setGeometry(next);
    };

    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      setInteraction(null);
      setGeometry(current => {
        saveGeometry(current);
        return current;
      });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  };

  function startCurve(event: React.PointerEvent<HTMLDivElement>, direction: ResizeDirection) {
    event.preventDefault();
    event.stopPropagation();
    const element = ref.current;
    const base = normalizeGeometry();
    if (!element || !base) return;

    const rect = element.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const width = Math.max(1, base.width || rect.width);
    const height = Math.max(1, base.height || rect.height);
    const side = direction.includes("e") ? "right" : direction.includes("w") ? "left" : direction.includes("n") ? "top" : "bottom";

    // The exact click point becomes the anchor of the curve.
    const anchorX = Math.max(0, Math.min(width, startX - rect.left));
    const anchorY = Math.max(0, Math.min(height, startY - rect.top));
    const startCurveValues = base.curve || { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
    const startValue = Math.max(
      startCurveValues.topLeft,
      startCurveValues.topRight,
      startCurveValues.bottomRight,
      startCurveValues.bottomLeft
    );
    setInteraction("curve");

    const move = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const delta = side === "left" || side === "right" ? dx : dy;
      const signed = side === "left" || side === "top" ? -delta : delta;
      const amount = Math.max(0, Math.min(Math.min(width, height) * 0.48, startValue + signed));

      const curve = { ...startCurveValues };
      const xRatio = width ? anchorX / width : 0.5;
      const yRatio = height ? anchorY / height : 0.5;
      if (side === "top") {
        curve.topLeft = amount * (1 - xRatio);
        curve.topRight = amount * xRatio;
      } else if (side === "right") {
        curve.topRight = amount * (1 - yRatio);
        curve.bottomRight = amount * yRatio;
      } else if (side === "bottom") {
        curve.bottomLeft = amount * (1 - xRatio);
        curve.bottomRight = amount * xRatio;
      } else {
        curve.topLeft = amount * (1 - yRatio);
        curve.bottomLeft = amount * yRatio;
      }

      // The clicked point controls where the curvature is concentrated.
      setGeometry(current => ({ ...current, curve }));
    };

    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      setInteraction(null);
      setGeometry(current => {
        saveGeometry(current);
        return current;
      });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  const startMove = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const base = normalizeGeometry();
    if (!base) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...base };
    setInteraction("move");
    event.currentTarget.setPointerCapture(event.pointerId);

    const move = (e: PointerEvent) => {
      const parent = ref.current?.offsetParent as HTMLElement | null;
      if (!parent) return;
      const maxLeft = Math.max(0, parent.clientWidth - (start.width || 0));
      const maxTop = Math.max(0, parent.clientHeight - (start.height || 0));
      const left = Math.max(0, Math.min(maxLeft, (start.left || 0) + e.clientX - startX));
      const top = Math.max(0, Math.min(maxTop, (start.top || 0) + e.clientY - startY));
      setGeometry(current => ({ ...current, left, top }));
    };

    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      setInteraction(null);
      setGeometry(current => {
        saveGeometry(current);
        return current;
      });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  };

  const curve = geometry.curve || { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
  const style = {
    ...(geometry.width !== undefined ? { "--panel-width": `${geometry.width}px` } : {}),
    ...(geometry.height !== undefined ? { "--panel-height": `${geometry.height}px` } : {}),
    ...(geometry.left !== undefined ? { "--panel-left": `${geometry.left}px` } : {}),
    ...(geometry.top !== undefined ? { "--panel-top": `${geometry.top}px` } : {}),
    "--panel-curve-tl": `${curve.topLeft}px`,
    "--panel-curve-tr": `${curve.topRight}px`,
    "--panel-curve-br": `${curve.bottomRight}px`,
    "--panel-curve-bl": `${curve.bottomLeft}px`,
  } as React.CSSProperties;

  return (
    <section
      ref={ref as RefObject<HTMLElement>}
      className={`morokResizablePanel ${className} ${interaction ? "is-interacting" : ""}`}
      style={style}
    >
      <div className="panelMoveHandle" onPointerDown={startMove} title="Arrastar painel" aria-label={`Mover painel ${id}`} />
      {children}
      <div className="resizeHandle resizeHandleN" onPointerDown={e => startResize(e, "n")} />
      <div className="resizeHandle resizeHandleE" onPointerDown={e => startResize(e, "e")} />
      <div className="resizeHandle resizeHandleS" onPointerDown={e => startResize(e, "s")} />
      <div className="resizeHandle resizeHandleW" onPointerDown={e => startResize(e, "w")} />
      <div className="resizeHandle resizeHandleNE" onPointerDown={e => startResize(e, "ne")} />
      <div className="resizeHandle resizeHandleNW" onPointerDown={e => startResize(e, "nw")} />
      <div className="resizeHandle resizeHandleSE" onPointerDown={e => startResize(e, "se")} />
      <div className="resizeHandle resizeHandleSW" onPointerDown={e => startResize(e, "sw")} />
    </section>
  );
}
