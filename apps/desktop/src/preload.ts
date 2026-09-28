import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("morokDesktop", {
  isAvailable: async () => true,
  execute: async (action: string, payload?: unknown) => {
    return ipcRenderer.invoke("morok:execute", { action, payload });
  }
});
