import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        debug: resolve(__dirname, "index2.html"),
        svgDebug: resolve(__dirname, "3.html"),
        erp: resolve(__dirname, "erp.html"),
        flow: resolve(__dirname, "flow.html"),
        ops: resolve(__dirname, "ops.html"),
        vision: resolve(__dirname, "vision.html"),
        connect: resolve(__dirname, "connect.html"),
        mobile: resolve(__dirname, "mobile.html"),
        korczakAi: resolve(__dirname, "korczak-ai.html"),
        documents: resolve(__dirname, "documents.html")
      }
    }
  }
});
