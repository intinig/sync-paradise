import { describe, it, expect } from "vitest";
import {
  compensatedExpectedSec,
  MAX_PLAUSIBLE_LAG_MS,
} from "../../../client/src/lib/playhead.js";

describe("compensatedExpectedSec", () => {
  it("MAX_PLAUSIBLE_LAG_MS is 10s — covers a server tick plus reasonable network slack", () => {
    expect(MAX_PLAUSIBLE_LAG_MS).toBe(10_000);
  });

  it("adds the elapsed wall-clock time when the offset estimate is plausible", () => {
    // Server broadcast at serverNow=1000 with expectedSec=5. Client receives
    // 200ms later (serverNowEstimate=1200). Client should consider the
    // "now-true" position to be 5.2s.
    const result = compensatedExpectedSec({
      expectedSec: 5,
      serverNowAtBroadcast: 1000,
      serverNowEstimate: 1200,
    });
    expect(result).toBeCloseTo(5.2, 5);
  });

  it("compensates at the boundary (exactly MAX_PLAUSIBLE_LAG_MS elapsed)", () => {
    const result = compensatedExpectedSec({
      expectedSec: 5,
      serverNowAtBroadcast: 0,
      serverNowEstimate: MAX_PLAUSIBLE_LAG_MS,
    });
    expect(result).toBe(5 + MAX_PLAUSIBLE_LAG_MS / 1000);
  });

  it("skips compensation when elapsed exceeds the plausible window (uncalibrated estimator + skewed clock)", () => {
    // Imagine the laptop clock is 30 minutes ahead of the server, AND the
    // OffsetEstimator hasn't received its first sample yet so offsetMs=0.
    // serverNowEstimate would be 30*60*1000 ahead of serverNowAtBroadcast.
    // Without the guard the player would seek forward 30 minutes.
    const result = compensatedExpectedSec({
      expectedSec: 5,
      serverNowAtBroadcast: 1000,
      serverNowEstimate: 1000 + 30 * 60 * 1000,
    });
    expect(result).toBe(5); // unchanged — no false compensation
  });

  it("skips compensation when elapsed is negative (server clock ahead of our estimate)", () => {
    const result = compensatedExpectedSec({
      expectedSec: 5,
      serverNowAtBroadcast: 1000,
      serverNowEstimate: 800,
    });
    expect(result).toBe(5);
  });

  it("just past the plausible window also skips", () => {
    const result = compensatedExpectedSec({
      expectedSec: 5,
      serverNowAtBroadcast: 0,
      serverNowEstimate: MAX_PLAUSIBLE_LAG_MS + 1,
    });
    expect(result).toBe(5);
  });

  it("preserves the server's expectedSec when there is no lag", () => {
    const result = compensatedExpectedSec({
      expectedSec: 5,
      serverNowAtBroadcast: 1000,
      serverNowEstimate: 1000,
    });
    expect(result).toBe(5);
  });
});
