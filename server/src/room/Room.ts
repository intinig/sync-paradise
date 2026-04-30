import type {
  RoomState,
  RoomStateMessage,
  ServerMessage,
  Participant,
  You,
  Role,
} from "../../../shared/protocol.js";
import type { Timers, TimerHandle } from "./timers.js";
import { ParticipantSet } from "./participants.js";

export interface RoomOptions {
  timers: Timers;
  countdownMs: number;
  cooldownMs: number;
  videoId: string;
  videoDurationMs: number;
  playheadIntervalMs: number;
  send: (socket: object, msg: ServerMessage) => void;
}

interface SocketRecord {
  user: Participant | null; // null = spectator
  /** True iff this socket belongs to a user logged in mid-PLAYING (held until COOLDOWN). */
  pending: boolean;
}

export class Room {
  private state: RoomState = "LOBBY";
  private participants = new ParticipantSet();
  private sockets = new Map<object, SocketRecord>();
  /** Pending users (logged in during PLAYING) keyed by userId; promoted on COOLDOWN. */
  private pendingUsers = new Map<string, Participant>();

  private playAtServerMs: number | null = null;
  private endAtServerMs: number | null = null;
  private cooldownEndsAtServerMs: number | null = null;

  private countdownTimer: TimerHandle | null = null;
  private endTimer: TimerHandle | null = null;
  private cooldownTimer: TimerHandle | null = null;
  private playheadInterval: TimerHandle | null = null;

  constructor(private readonly opts: RoomOptions) {}

  snapshot() {
    return {
      state: this.state,
      participants: this.participants.list(),
      playAtServerMs: this.playAtServerMs,
      endAtServerMs: this.endAtServerMs,
      cooldownEndsAtServerMs: this.cooldownEndsAtServerMs,
    };
  }

  onSocketJoin(socket: object, user: Participant | null): void {
    const pending = user !== null && this.state === "PLAYING";
    if (user && !pending) {
      this.participants.addSocket(socket, user);
    } else if (user && pending) {
      this.pendingUsers.set(user.id, user);
    }
    this.sockets.set(socket, { user, pending });
    this.sendStateTo(socket);
    this.maybeStartCountdown();
  }

  onSocketLeave(socket: object): void {
    const rec = this.sockets.get(socket);
    if (!rec) return;
    this.sockets.delete(socket);
    if (rec.user && !rec.pending) {
      this.participants.removeSocket(socket);
    } else if (rec.user && rec.pending) {
      const stillPending = [...this.sockets.values()].some(
        (r) => r.user?.id === rec.user!.id && r.pending,
      );
      if (!stillPending) this.pendingUsers.delete(rec.user.id);
    }
    this.maybeCancelCountdown();
    this.maybeEndPlayingDueToEmpty();
  }

  private sendStateTo(socket: object): void {
    const rec = this.sockets.get(socket);
    const role: Role = rec?.user && !rec.pending ? "participant" : "spectator";
    const you: You | null = rec?.user ? { ...rec.user, role } : null;
    const msg: RoomStateMessage = {
      type: "room_state",
      state: this.state,
      participants: this.participants.list(),
      you,
      videoId: this.opts.videoId,
      playAtServerMs: this.playAtServerMs,
      endAtServerMs: this.endAtServerMs,
      cooldownEndsAtServerMs: this.cooldownEndsAtServerMs,
      serverNow: this.opts.timers.now(),
    };
    this.opts.send(socket, msg);
  }

  private broadcastState(): void {
    for (const socket of this.sockets.keys()) this.sendStateTo(socket);
  }

  private maybeStartCountdown(): void {
    if (this.state !== "LOBBY") return;
    if (this.participants.count() < 2) return;
    this.transitionToCountdown();
  }

  private maybeCancelCountdown(): void {
    if (this.state !== "COUNTDOWN") return;
    if (this.participants.count() >= 2) return;
    this.transitionToLobby();
  }

  private maybeEndPlayingDueToEmpty(): void {
    if (this.state !== "PLAYING") return;
    if (this.participants.count() > 0) return;
    this.transitionToCooldown();
  }

  // Stubs replaced in later tasks.
  private transitionToCountdown(): void {
    this.state = "COUNTDOWN";
    this.broadcastState();
  }
  private transitionToLobby(): void {
    this.state = "LOBBY";
    this.playAtServerMs = null;
    this.broadcastState();
  }
  private transitionToCooldown(): void {
    this.state = "COOLDOWN";
    this.broadcastState();
  }
}
