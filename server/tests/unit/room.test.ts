import { describe, it, expect, vi, beforeEach } from "vitest";
import { Room } from "../../src/room/Room.js";
import { FakeTimers } from "../../src/room/timers.js";
import type { ServerMessage, Participant } from "../../../shared/protocol.js";

const alice: Participant = { id: "u-alice", name: "Alice", picture: "a.jpg" };
const bob: Participant = { id: "u-bob", name: "Bob", picture: "b.jpg" };
const carol: Participant = { id: "u-carol", name: "Carol", picture: "c.jpg" };

interface CapturedSend {
  socket: object;
  msg: ServerMessage;
}

function makeRoom() {
  const timers = new FakeTimers(1_000_000);
  const sent: CapturedSend[] = [];
  const room = new Room({
    timers,
    countdownMs: 10_000,
    cooldownMs: 30_000,
    videoId: "fPO76Jlnz6c",
    videoDurationMs: 256_000,
    playheadIntervalMs: 5_000,
    send: (socket, msg) => sent.push({ socket, msg }),
  });
  return { room, timers, sent };
}

describe("Room: lobby & joins", () => {
  it("a new room is in LOBBY with no participants", () => {
    const { room } = makeRoom();
    const snap = room.snapshot();
    expect(snap.state).toBe("LOBBY");
    expect(snap.participants).toEqual([]);
  });

  it("on participant join, the joining socket receives a room_state with role=participant", () => {
    const { room, sent } = makeRoom();
    const sock = { id: 1 };
    room.onSocketJoin(sock, alice);
    const msg = sent.find((s) => s.socket === sock)?.msg;
    expect(msg).toBeDefined();
    expect(msg!.type).toBe("room_state");
    if (msg!.type !== "room_state") throw new Error("type narrowing");
    expect(msg.state).toBe("LOBBY");
    expect(msg.you).toEqual({ ...alice, role: "participant" });
    expect(msg.participants).toEqual([alice]);
  });

  it("on spectator join (user=null), the socket receives room_state with you=null and role spectator semantics", () => {
    const { room, sent } = makeRoom();
    const sock = { id: 1 };
    room.onSocketJoin(sock, null);
    const msg = sent.find((s) => s.socket === sock)?.msg;
    expect(msg!.type).toBe("room_state");
    if (msg!.type !== "room_state") throw new Error("type narrowing");
    expect(msg.you).toBeNull();
    expect(msg.participants).toEqual([]);
  });

  it("a single participant alone stays in LOBBY (does not start COUNTDOWN)", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    timers.advance(60_000);
    expect(room.snapshot().state).toBe("LOBBY");
  });

  it("two participants from same user (two tabs) does NOT start COUNTDOWN", () => {
    const { room } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, alice);
    expect(room.snapshot().state).toBe("LOBBY");
    expect(room.snapshot().participants).toEqual([alice]);
  });

  it("dropping a socket removes the participant if it was the last", () => {
    const { room } = makeRoom();
    const s1 = { id: 1 };
    room.onSocketJoin(s1, alice);
    expect(room.snapshot().participants).toEqual([alice]);
    room.onSocketLeave(s1);
    expect(room.snapshot().participants).toEqual([]);
  });
});

describe("Room: COUNTDOWN start", () => {
  it("two distinct participants triggers COUNTDOWN with playAtServerMs = now+countdown", () => {
    const { room, timers, sent } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    sent.length = 0;
    room.onSocketJoin({ id: 2 }, bob);
    const snap = room.snapshot();
    expect(snap.state).toBe("COUNTDOWN");
    expect(snap.playAtServerMs).toBe(timers.now() + 10_000);
    const countdowns = sent.filter(
      (s) => s.msg.type === "room_state" && s.msg.state === "COUNTDOWN",
    );
    expect(countdowns.length).toBeGreaterThanOrEqual(2);
  });

  it("a third participant joining during COUNTDOWN does not reset playAtServerMs", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    const original = room.snapshot().playAtServerMs!;
    timers.advance(2_000);
    room.onSocketJoin({ id: 3 }, carol);
    expect(room.snapshot().state).toBe("COUNTDOWN");
    expect(room.snapshot().playAtServerMs).toBe(original);
  });
});

describe("Room: COUNTDOWN cancellation", () => {
  it("if a participant disconnects during COUNTDOWN and count drops to 1, returns to LOBBY", () => {
    const { room } = makeRoom();
    const s1 = { id: 1 };
    const s2 = { id: 2 };
    room.onSocketJoin(s1, alice);
    room.onSocketJoin(s2, bob);
    expect(room.snapshot().state).toBe("COUNTDOWN");
    room.onSocketLeave(s2);
    expect(room.snapshot().state).toBe("LOBBY");
    expect(room.snapshot().playAtServerMs).toBeNull();
  });

  it("the cancelled COUNTDOWN does not later trigger PLAYING when its timer would have fired", () => {
    const { room, timers } = makeRoom();
    const s1 = { id: 1 };
    const s2 = { id: 2 };
    room.onSocketJoin(s1, alice);
    room.onSocketJoin(s2, bob);
    room.onSocketLeave(s2);
    timers.advance(20_000);
    expect(room.snapshot().state).toBe("LOBBY");
  });
});

describe("Room: COUNTDOWN -> PLAYING", () => {
  it("after countdownMs elapses, room is PLAYING with endAtServerMs = playAt + duration", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    const playAt = room.snapshot().playAtServerMs!;
    timers.advance(10_000);
    const snap = room.snapshot();
    expect(snap.state).toBe("PLAYING");
    expect(snap.endAtServerMs).toBe(playAt + 256_000);
  });
});

describe("Room: playhead broadcast", () => {
  it("emits a playhead message every 5 seconds during PLAYING", () => {
    const { room, timers, sent } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // -> PLAYING
    sent.length = 0;
    timers.advance(5_000);
    const heads1 = sent.filter((s) => s.msg.type === "playhead");
    expect(heads1.length).toBe(2); // one per socket
    expect((heads1[0].msg as { expectedSec: number }).expectedSec).toBeCloseTo(5, 5);
    timers.advance(5_000);
    const heads2 = sent.filter((s) => s.msg.type === "playhead");
    expect(heads2.length).toBe(4);
  });
});

describe("Room: PLAYING -> COOLDOWN", () => {
  it("at endAtServerMs, transitions to COOLDOWN with cooldownEndsAtServerMs set", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // PLAYING
    timers.advance(256_000); // end of video
    const snap = room.snapshot();
    expect(snap.state).toBe("COOLDOWN");
    expect(snap.cooldownEndsAtServerMs).toBe(timers.now() + 30_000);
    expect(snap.playAtServerMs).toBeNull();
    expect(snap.endAtServerMs).toBeNull();
  });

  it("if all participants leave during PLAYING, transitions to COOLDOWN", () => {
    const { room, timers } = makeRoom();
    const s1 = { id: 1 };
    const s2 = { id: 2 };
    room.onSocketJoin(s1, alice);
    room.onSocketJoin(s2, bob);
    timers.advance(10_000); // PLAYING
    room.onSocketLeave(s1);
    room.onSocketLeave(s2);
    expect(room.snapshot().state).toBe("COOLDOWN");
  });

  it("playhead interval is cleared when leaving PLAYING", () => {
    const { room, timers, sent } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // PLAYING
    timers.advance(256_000); // video ends -> COOLDOWN
    sent.length = 0;
    timers.advance(10_000);
    const heads = sent.filter((s) => s.msg.type === "playhead");
    expect(heads.length).toBe(0);
  });
});

describe("Room: late joiner during PLAYING", () => {
  it("a logged-in user joining during PLAYING is reported as spectator and not in participants", () => {
    const { room, timers, sent } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // PLAYING
    sent.length = 0;
    const carolSocket = { id: 3 };
    room.onSocketJoin(carolSocket, carol);
    const carolMsg = sent.find((s) => s.socket === carolSocket)?.msg;
    expect(carolMsg!.type).toBe("room_state");
    if (carolMsg!.type !== "room_state") throw new Error("type narrowing");
    expect(carolMsg.you?.role).toBe("spectator");
    expect(carolMsg.participants.map((p) => p.id).sort()).toEqual(["u-alice", "u-bob"]);
  });

  it("on COOLDOWN entry, a previously-pending user becomes a participant", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // PLAYING
    room.onSocketJoin({ id: 3 }, carol);
    timers.advance(256_000); // -> COOLDOWN
    expect(room.snapshot().state).toBe("COOLDOWN");
    expect(room.snapshot().participants.map((p) => p.id).sort()).toEqual([
      "u-alice",
      "u-bob",
      "u-carol",
    ]);
  });

  it("if pending user disconnects before COOLDOWN, they do not become a participant", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000);
    const carolSocket = { id: 3 };
    room.onSocketJoin(carolSocket, carol);
    room.onSocketLeave(carolSocket);
    timers.advance(256_000);
    expect(room.snapshot().participants.map((p) => p.id).sort()).toEqual(["u-alice", "u-bob"]);
  });
});
