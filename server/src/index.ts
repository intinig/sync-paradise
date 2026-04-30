import express from "express";
import { config, assertProductionConfig } from "./config.js";

assertProductionConfig();

const app = express();

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const server = app.listen(config.port, () => {
  console.log(`[server] listening on :${config.port} (${config.nodeEnv})`);
});

function shutdown(signal: string) {
  console.log(`[server] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
