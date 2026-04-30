import type { ClientMessage, ServerMessage } from "../../../shared/protocol.js";
import { OffsetEstimator } from "./clockOffset.js";

export interface SyncWsOptions {
  url: string;
  onMessage: (msg: ServerMessage) => void;
  onOffsetChange?: (offsetMs: number) => void;
}

export class SyncWs {
  private ws: WebSocket | null = null;
  private estimator = new OffsetEstimator(5);
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(private readonly opts: SyncWsOptions) {
    this.connect();
  }

  offsetMs(): number {
    return this.estimator.offsetMs();
  }

  close(): void {
    this.closed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  private connect(): void {
    const ws = new WebSocket(this.opts.url);
    this.ws = ws;
    ws.onopen = () => {
      this.startPings();
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(ev.data) as ServerMessage; } catch { return; }
      if (msg.type === "pong") {
        const t2 = Date.now();
        this.estimator.addSample(msg.t0, msg.t1, t2);
        this.opts.onOffsetChange?.(this.estimator.offsetMs());
        return;
      }
      this.opts.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
      if (this.closed) return;
      this.reconnectTimer = setTimeout(() => this.connect(), 1000);
    };
    ws.onerror = () => { /* onclose will follow */ };
  }

  private startPings(): void {
    this.sendPing();
    this.pingTimer = setInterval(() => this.sendPing(), 30_000);
  }

  private sendPing(): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientMessage = { type: "ping", t0: Date.now() };
    try { ws.send(JSON.stringify(msg)); } catch { /* connection dropped */ }
  }
}
