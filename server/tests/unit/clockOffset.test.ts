import { describe, it, expect } from "vitest";
import { OffsetEstimator } from "../../../client/src/api/clockOffset.js";

describe("OffsetEstimator", () => {
  it("starts with offset 0", () => {
    const e = new OffsetEstimator();
    expect(e.offsetMs()).toBe(0);
  });

  it("a single sample yields its computed offset", () => {
    const e = new OffsetEstimator(1);
    e.addSample(100, 1150, 200); // rtt = 100, midpoint = 150 (client), offset = 1150 - 150 = 1000
    expect(e.offsetMs()).toBe(1000);
  });

  it("median rejects an outlier", () => {
    const e = new OffsetEstimator(5);
    e.addSample(100, 1150, 200);
    e.addSample(110, 1160, 210);
    e.addSample(120, 1170, 220);
    e.addSample(130, 5180, 230);
    e.addSample(140, 1190, 240);
    expect(e.offsetMs()).toBe(1000);
  });

  it("keeps only the most recent N samples", () => {
    const e = new OffsetEstimator(3);
    e.addSample(0, 1000, 100);
    e.addSample(0, 2000, 100);
    e.addSample(0, 3000, 100);
    e.addSample(0, 4000, 100);
    expect(e.offsetMs()).toBe(2950);
  });
});
