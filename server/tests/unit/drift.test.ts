import { describe, it, expect } from "vitest";
import { decideDriftAction, DRIFT_TOLERANCE_SEC } from "../../../client/src/player/drift.js";

describe("decideDriftAction", () => {
  it("DRIFT_TOLERANCE_SEC is 0.3s — well above inter-browser jitter floor", () => {
    expect(DRIFT_TOLERANCE_SEC).toBe(0.3);
  });

  it("returns 'none' when exactly in sync", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 10 })).toEqual({ kind: "none" });
  });

  it("returns 'none' when within tolerance behind", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 9.85 })).toEqual({ kind: "none" });
  });

  it("returns 'none' when within tolerance ahead", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 10.25 })).toEqual({ kind: "none" });
  });

  it("returns 'none' just under the threshold (0.299s off)", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 10.299 })).toEqual({ kind: "none" });
  });

  it("returns 'seek' at the threshold (0.3s behind)", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 9.7 })).toEqual({
      kind: "seek",
      toSec: 10,
    });
  });

  it("returns 'seek' at the threshold (0.3s ahead)", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 10.3 })).toEqual({
      kind: "seek",
      toSec: 10,
    });
  });

  it("returns 'seek' for large drift in either direction", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 8.5 })).toEqual({
      kind: "seek",
      toSec: 10,
    });
    expect(decideDriftAction({ expectedSec: 10, currentSec: 11.6 })).toEqual({
      kind: "seek",
      toSec: 10,
    });
  });
});
