import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import WebSocket from "ws";
import { mountWs } from "../../src/ws/server.js";
import { sealSession } from "../../src/auth/session.js";
import type { ServerMessage } from "../../../shared/protocol.js";

const SECRET = "0123456789abcdef0123456789abcdef";

interface TestServer {
  port: number;
  close: () => void;
}

async function start(): Promise<TestServer> {
  const app = express();
  const server = http.createServer(app);
  mountWs(server, {
    sessionSecret: SECRET,
    countdownMs: 10_000,
    cooldownMs: 30_000,
    playheadIntervalMs: 5_000,
    videoId: "fPO76Jlnz6c",
    videoDurationMs: 256_000,
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      resolve({ port, close: () => server.close() });
    });
  });
}

function connect(port: number, cookie?: string): Promise<{ ws: WebSocket; messages: ServerMessage[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    const messages: ServerMessage[] = [];
    ws.on("message", (data) => {
      messages.push(JSON.parse(data.toString()) as ServerMessage);
    });
    ws.on("open", () => resolve({ ws, messages }));
    ws.on("error", reject);
  });
}

async function waitFor<T>(check: () => T | undefined, timeoutMs = 1000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = check();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("waitFor timed out");
}

describe("WS server", () => {
  let srv: TestServer;
  beforeAll(async () => { srv = await start(); });
  afterAll(() => { srv.close(); });

  it("anonymous client receives room_state with you=null on connect", async () => {
    const { ws, messages } = await connect(srv.port);
    await waitFor(() => messages.find((m) => m.type === "room_state"));
    const msg = messages.find((m) => m.type === "room_state")!;
    if (msg.type !== "room_state") throw new Error("narrowing");
    expect(msg.you).toBeNull();
    ws.close();
  });

  it("authed client (sealed cookie) receives room_state with role=participant", async () => {
    const cookieValue = await sealSession(
      { id: "u-1", name: "Alice", picture: "p.jpg" },
      SECRET,
    );
    const cookieHeader = `__Host-session=${encodeURIComponent(cookieValue)}`;
    const { ws, messages } = await connect(srv.port, cookieHeader);
    await waitFor(() => messages.find((m) => m.type === "room_state"));
    const msg = messages.find((m) => m.type === "room_state")!;
    if (msg.type !== "room_state") throw new Error("narrowing");
    expect(msg.you?.role).toBe("participant");
    expect(msg.you?.id).toBe("u-1");
    ws.close();
  });

  it("ping is answered with pong containing t0 and t1", async () => {
    const { ws, messages } = await connect(srv.port);
    await waitFor(() => messages.find((m) => m.type === "room_state"));
    ws.send(JSON.stringify({ type: "ping", t0: 12345 }));
    const pong = await waitFor(() => messages.find((m) => m.type === "pong"));
    if (pong.type !== "pong") throw new Error("narrowing");
    expect(pong.t0).toBe(12345);
    expect(typeof pong.t1).toBe("number");
    ws.close();
  });

  it("two authed clients trigger COUNTDOWN broadcast", async () => {
    const aliceCookie = `__Host-session=${encodeURIComponent(
      await sealSession({ id: "u-a", name: "Alice", picture: "" }, SECRET),
    )}`;
    const bobCookie = `__Host-session=${encodeURIComponent(
      await sealSession({ id: "u-b", name: "Bob", picture: "" }, SECRET),
    )}`;
    const a = await connect(srv.port, aliceCookie);
    const b = await connect(srv.port, bobCookie);
    const aCountdown = await waitFor(() =>
      a.messages.find((m) => m.type === "room_state" && m.state === "COUNTDOWN"),
    );
    const bCountdown = await waitFor(() =>
      b.messages.find((m) => m.type === "room_state" && m.state === "COUNTDOWN"),
    );
    if (aCountdown.type !== "room_state" || bCountdown.type !== "room_state") {
      throw new Error("narrowing");
    }
    expect(aCountdown.playAtServerMs).toBe(bCountdown.playAtServerMs);
    a.ws.close();
    b.ws.close();
  });
});
