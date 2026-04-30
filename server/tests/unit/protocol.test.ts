import { describe, it, expect } from "vitest";
import {
  type ClientMessage,
  type ServerMessage,
  type RoomStateMessage,
  type Participant,
  ROOM_STATES,
} from "../../../shared/protocol.js";

describe("protocol", () => {
  it("ROOM_STATES contains exactly the four expected states", () => {
    expect([...ROOM_STATES].sort()).toEqual(["COOLDOWN", "COUNTDOWN", "LOBBY", "PLAYING"]);
  });

  it("a RoomStateMessage shape compiles and round-trips through JSON", () => {
    const p: Participant = { id: "u1", name: "Alice", picture: "https://x/y.jpg" };
    const msg: RoomStateMessage = {
      type: "room_state",
      state: "LOBBY",
      participants: [p],
      you: { ...p, role: "participant" },
      videoId: "fPO76Jlnz6c",
      playAtServerMs: null,
      endAtServerMs: null,
      cooldownEndsAtServerMs: null,
      serverNow: 1_700_000_000_000,
    };
    const round: ServerMessage = JSON.parse(JSON.stringify(msg));
    expect(round.type).toBe("room_state");
  });

  it("a ping ClientMessage compiles", () => {
    const m: ClientMessage = { type: "ping", t0: 123 };
    expect(m.type).toBe("ping");
  });
});
