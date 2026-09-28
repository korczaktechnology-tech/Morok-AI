import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import si from "systeminformation";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let cachedStorage = 0;
let cachedStorageAt = 0;

type Metrics = {
  cpu: number;
  ram: number;
  storage: number;
  network: number;
  networkUnit: "Mbps";
  timestamp: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function readCpu(): Promise<number> {
  const load = await si.currentLoad();
  const value = Number(load.currentLoad);
  if (Number.isFinite(value)) return clamp(value, 0, 100);

  const cpus = await si.cpu();
  return cpus.cores > 0 ? 0 : 0;
}

async function readRam(): Promise<number> {
  const memory = await si.mem();
  if (!memory.total) return 0;
  return clamp((memory.used / memory.total) * 100, 0, 100);
}

async function readStorage(): Promise<number> {
  const disks = await si.fsSize();
  if (!disks.length) return 0;

  const systemRoot = process.platform === "win32" ? "C:" : "/";
  const preferred =
    disks.find(d => d.mount === systemRoot) ??
    disks.find(d => d.mount?.startsWith(systemRoot)) ??
    disks[0];

  return clamp(Number(preferred.use), 0, 100);
}

async function readNetwork(): Promise<number> {
  const stats = await si.networkStats();
  const active = stats.filter(item => item.operstate === "up");
  const source = active.length ? active : stats;
  if (!source.length) return 0;

  const bytesPerSecond = source.reduce(
    (sum, item) => sum + Math.max(0, Number(item.rx_sec) || 0) + Math.max(0, Number(item.tx_sec) || 0),
    0
  );

  // systeminformation calculates rx_sec/tx_sec from successive real interface counters.
  // Convert aggregate bytes/s to megabits/s and cap the HUD at 1024 Mbps.
  return clamp((bytesPerSecond * 8) / 1_000_000, 0, 1024);
}

async function readMetrics(): Promise<Metrics> {
  const [cpu, ram, network] = await Promise.all([
    readCpu(),
    readRam(),
    readNetwork()
  ]);

  const now = Date.now();
  if (now - cachedStorageAt >= 600_000) {
    cachedStorage = await readStorage();
    cachedStorageAt = now;
  }
  const storage = cachedStorage;

  return {
    cpu: Number(cpu.toFixed(1)),
    ram: Number(ram.toFixed(1)),
    storage: Number(storage.toFixed(1)),
    network: Number(network.toFixed(1)),
    networkUnit: "Mbps",
    timestamp: new Date().toISOString()
  };
}

ipcMain.handle("morok:execute", async (_event, request: { action?: string }) => {
  switch (request?.action) {
    case "system.requestMetricsPermission":
      // CPU/RAM/disk counters are OS-level telemetry. Desktop platforms do not
      // expose a browser permission prompt for these read-only measurements.
      return { granted: true, native: true };

    case "system.metrics":
      return readMetrics();

    default:
      throw new Error(`Unknown Morok desktop action: ${request?.action ?? "undefined"}`);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#05060b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const clientDist = path.resolve(__dirname, "../../client/dist/index.html");
  void mainWindow.loadFile(clientDist);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
