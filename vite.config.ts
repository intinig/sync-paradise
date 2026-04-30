import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "client",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://localhost:3000",
      "/me": "http://localhost:3000",
      "/healthz": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
});
