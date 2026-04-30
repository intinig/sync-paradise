import { describe, it, expect } from "vitest";
import { formatTimecode, formatCountdown } from "../../../client/src/lib/time.js";

describe("formatTimecode", () => {
  it("formats single-digit seconds with leading zeros", () => {
    expect(formatTimecode(0)).toBe("00:00");
    expect(formatTimecode(5)).toBe("00:05");
    expect(formatTimecode(59)).toBe("00:59");
  });

  it("rolls over the minutes column past 60s", () => {
    expect(formatTimecode(60)).toBe("01:00");
    expect(formatTimecode(61)).toBe("01:01");
    expect(formatTimecode(125)).toBe("02:05");
  });

  it("floors fractional seconds", () => {
    expect(formatTimecode(15.9)).toBe("00:15");
  });

  it("returns 00:00 for null, NaN, and negative input", () => {
    expect(formatTimecode(null)).toBe("00:00");
    expect(formatTimecode(NaN)).toBe("00:00");
    expect(formatTimecode(-5)).toBe("00:00");
    expect(formatTimecode(Infinity)).toBe("00:00");
  });
});

describe("formatCountdown", () => {
  it("uses the spaced 'MM : SS' joiner", () => {
    expect(formatCountdown(8)).toBe("00 : 08");
    expect(formatCountdown(72)).toBe("01 : 12");
  });

  it("returns 00 : 00 for null / NaN / negative", () => {
    expect(formatCountdown(null)).toBe("00 : 00");
    expect(formatCountdown(-1)).toBe("00 : 00");
  });
});
