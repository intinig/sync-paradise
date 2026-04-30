import { describe, it, expect } from "vitest";
import { decideStartAction } from "../../../client/src/player/scheduling.js";

describe("decideStartAction", () => {
  it("returns 'future' with pre-buffer delay when play time is more than 2s out", () => {
    const action = decideStartAction({
      playAtServerMs: 10_000,
      offsetMs: 0,
      nowMs: 0,
    });
    expect(action).toEqual({ kind: "future", preDelayMs: 8_000, playInMs: 10_000 });
  });

  it("returns 'imminent' when play time is within 2s", () => {
    const action = decideStartAction({
      playAtServerMs: 1_500,
      offsetMs: 0,
      nowMs: 0,
    });
    expect(action).toEqual({ kind: "imminent", playInMs: 1_500 });
  });

  it("returns 'live' with the current playhead when play time has already elapsed", () => {
    // Play started 7.5s ago in server time; the late joiner should jump to 7.5s.
    const action = decideStartAction({
      playAtServerMs: 0,
      offsetMs: 0,
      nowMs: 7_500,
    });
    expect(action).toEqual({ kind: "live", playheadSec: 7.5 });
  });

  it("respects the client clock offset when computing the live position", () => {
    // The server clock is 1000ms ahead of the client. The play time is "now" in
    // client time, which means it's 1000ms in the past from the server's view.
    // From the client's perspective (which schedules in client time), the
    // playAtClientMs = playAtServerMs - offsetMs = 5000 - 1000 = 4000. nowMs is
    // 5000, so the play started 1s ago by client time; we should jump to 1s.
    const action = decideStartAction({
      playAtServerMs: 5_000,
      offsetMs: 1_000,
      nowMs: 5_000,
    });
    expect(action).toEqual({ kind: "live", playheadSec: 1 });
  });

  it("clamps a tiny negative skew to playheadSec=0 (live, but at the very start)", () => {
    // 1ms past the play time — boundary case; we want kind=live but playheadSec ~0.
    const action = decideStartAction({
      playAtServerMs: 1_000,
      offsetMs: 0,
      nowMs: 1_001,
    });
    expect(action.kind).toBe("live");
    if (action.kind !== "live") throw new Error("narrowing");
    expect(action.playheadSec).toBeCloseTo(0.001, 3);
  });
});
