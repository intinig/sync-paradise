import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, assertProductionConfig } from "./config.js";
import { mountGoogleAuth } from "./auth/google.js";
import { COOKIE_NAME, sealSession, unsealSession } from "./auth/session.js";
import { mountWs } from "./ws/server.js";
import { VIDEO_ID, VIDEO_DURATION_MS } from "./video.js";

assertProductionConfig();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/me", async (req, res) => {
  const cookieHeader = req.headers.cookie ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) {
    res.json(null);
    return;
  }
  const value = decodeURIComponent(cookie.split("=").slice(1).join("="));
  const user = await unsealSession(value, config.sessionSecret);
  res.json(user);
});

mountGoogleAuth(app, {
  clientId: config.googleClientId,
  clientSecret: config.googleClientSecret,
  baseUrl: config.baseUrl,
  sessionSecret: config.sessionSecret,
});

if (config.nodeEnv === "test") {
  app.get("/auth/test-login", async (req, res) => {
    const name = typeof req.query.name === "string" ? req.query.name : "Tester";
    const id = typeof req.query.id === "string" ? req.query.id : `t-${Math.random().toString(36).slice(2, 8)}`;
    const sealed = await sealSession(
      { id, name, picture: "https://placehold.co/64x64" },
      config.sessionSecret,
    );
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(sealed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
    );
    res.redirect(302, "/");
  });
  console.log("[server] WARNING: /auth/test-login mounted (NODE_ENV=test)");
} else {
  app.use("/auth/test-login", (_req, res) => {
    res.status(404).send("not found");
  });
}

const clientDist = path.resolve(__dirname, "../client");
app.use(express.static(clientDist));
app.get(/^\/(?!auth|me|healthz|ws).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = http.createServer(app);
mountWs(server, {
  sessionSecret: config.sessionSecret,
  countdownMs: config.countdownSeconds * 1000,
  cooldownMs: config.cooldownSeconds * 1000,
  playheadIntervalMs: 5_000,
  videoId: VIDEO_ID,
  videoDurationMs: VIDEO_DURATION_MS,
});

server.listen(config.port, () => {
  console.log(`[server] listening on :${config.port} (${config.nodeEnv})`);
});

function shutdown(signal: string) {
  console.log(`[server] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
