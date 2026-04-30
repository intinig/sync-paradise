import { describe, it, expect } from "vitest";
import { decideDriftAction } from "../../../client/src/player/drift.js";

describe("decideDriftAction", () => {
  it("returns 'none' when within 50ms", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 10.04 })).toEqual({ kind: "none" });
  });

  it("returns 'rate-up' when slightly behind", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 9.7 })).toEqual({ kind: "rate", rate: 1.05 });
  });

  it("returns 'rate-down' when slightly ahead", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 10.3 })).toEqual({ kind: "rate", rate: 0.95 });
  });

  it("returns 'seek' when more than 0.5s off", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 8.5 })).toEqual({ kind: "seek", toSec: 10 });
    expect(decideDriftAction({ expectedSec: 10, currentSec: 11.6 })).toEqual({ kind: "seek", toSec: 10 });
  });
});
