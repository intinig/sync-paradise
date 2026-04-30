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
