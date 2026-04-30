import { WebSocketServer, type WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import { Room } from "../room/Room.js";
import { RealTimers } from "../room/timers.js";
import { unsealSession, COOKIE_NAME } from "../auth/session.js";
import type { ClientMessage, ServerMessage, Participant } from "../../../shared/protocol.js";

export interface MountWsOptions {
  sessionSecret: string;
  countdownMs: number;
  cooldownMs: number;
  playheadIntervalMs: number;
  videoId: string;
  videoDurationMs: number;
}

function parseCookieHeader(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        // Malformed percent-encoding in untrusted Cookie header.
        return null;
      }
    }
  }
  return null;
}

export function mountWs(server: HttpServer, opts: MountWsOptions): { room: Room } {
  const wss = new WebSocketServer({ noServer: true });
  const timers = new RealTimers();
  const sockToWs = new Map<object, WebSocket>();

  const room = new Room({
    timers,
    countdownMs: opts.countdownMs,
    cooldownMs: opts.cooldownMs,
    videoId: opts.videoId,
    videoDurationMs: opts.videoDurationMs,
    playheadIntervalMs: opts.playheadIntervalMs,
    send: (socket, msg) => {
      const ws = sockToWs.get(socket);
      if (!ws || ws.readyState !== ws.OPEN) return;
      try { ws.send(JSON.stringify(msg)); } catch { /* dead socket */ }
    },
  });

  server.on("upgrade", async (req, socket, head) => {
    try {
      if (!req.url || !req.url.startsWith("/ws")) {
        socket.destroy();
        return;
      }
      const cookieValue = parseCookieHeader(req.headers.cookie, COOKIE_NAME);
      let user: Participant | null = null;
      if (cookieValue) {
        user = await unsealSession(cookieValue, opts.sessionSecret);
      }
      // The TCP socket may have closed during the await above.
      if (socket.destroyed) return;
      wss.handleUpgrade(req, socket, head, (ws) => {
        const key: object = {};
        sockToWs.set(key, ws);
        room.onSocketJoin(key, user);
        ws.on("message", (data) => {
          let msg: ClientMessage;
          try { msg = JSON.parse(data.toString()) as ClientMessage; } catch { return; }
          if (msg.type === "ping") {
            const pong: ServerMessage = { type: "pong", t0: msg.t0, t1: timers.now() };
            if (ws.readyState === ws.OPEN) {
              try { ws.send(JSON.stringify(pong)); } catch { /* dead socket */ }
            }
          }
        });
        ws.on("close", () => {
          room.onSocketLeave(key);
          sockToWs.delete(key);
        });
        ws.on("error", () => {
          room.onSocketLeave(key);
          sockToWs.delete(key);
        });
      });
    } catch (err) {
      console.error("[ws] upgrade error", err);
      if (!socket.destroyed) socket.destroy();
    }
  });

  return { room };
}
