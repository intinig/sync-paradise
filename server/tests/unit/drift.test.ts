import { describe, it, expect } from "vitest";
import { decideDriftAction, DRIFT_TOLERANCE_SEC } from "../../../client/src/player/drift.js";

describe("decideDriftAction", () => {
  it("DRIFT_TOLERANCE_SEC is 1.5s — accommodates inter-platform jitter without firing on every tick", () => {
    expect(DRIFT_TOLERANCE_SEC).toBe(1.5);
  });

  it("returns 'none' when exactly in sync", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 10 })).toEqual({ kind: "none" });
  });

  it("returns 'none' for typical inter-browser drift (300ms behind)", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 9.7 })).toEqual({ kind: "none" });
  });

  it("returns 'none' for typical inter-browser drift (300ms ahead)", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 10.3 })).toEqual({ kind: "none" });
  });

  it("returns 'none' just under the threshold (1.499s off)", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 11.499 })).toEqual({ kind: "none" });
  });

  it("returns 'seek' at the threshold (1.5s behind)", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 8.5 })).toEqual({
      kind: "seek",
      toSec: 10,
    });
  });

  it("returns 'seek' at the threshold (1.5s ahead)", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 11.5 })).toEqual({
      kind: "seek",
      toSec: 10,
    });
  });

  it("returns 'seek' for large drift in either direction", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 5 })).toEqual({
      kind: "seek",
      toSec: 10,
    });
    expect(decideDriftAction({ expectedSec: 10, currentSec: 20 })).toEqual({
      kind: "seek",
      toSec: 10,
    });
  });
});
