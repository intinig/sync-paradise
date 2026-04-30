import { describe, it, expect, vi } from "vitest";
import { RealTimers, FakeTimers, type Timers } from "../../src/room/timers.js";

describe("Timers", () => {
  it("RealTimers.now() approximates Date.now()", () => {
    const t: Timers = new RealTimers();
    const before = Date.now();
    const v = t.now();
    const after = Date.now();
    expect(v).toBeGreaterThanOrEqual(before);
    expect(v).toBeLessThanOrEqual(after);
  });

  it("FakeTimers.now() returns the configured time", () => {
    const t = new FakeTimers(1_000);
    expect(t.now()).toBe(1_000);
  });

  it("FakeTimers.advance fires due timeouts in order", () => {
    const t = new FakeTimers(0);
    const calls: string[] = [];
    t.setTimeout(() => calls.push("a"), 10);
    t.setTimeout(() => calls.push("b"), 5);
    t.setTimeout(() => calls.push("c"), 20);
    t.advance(15);
    expect(calls).toEqual(["b", "a"]);
    expect(t.now()).toBe(15);
    t.advance(10);
    expect(calls).toEqual(["b", "a", "c"]);
  });

  it("FakeTimers.clearTimeout cancels a pending timeout", () => {
    const t = new FakeTimers(0);
    const fn = vi.fn();
    const handle = t.setTimeout(fn, 100);
    t.clearTimeout(handle);
    t.advance(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it("FakeTimers.setInterval fires repeatedly", () => {
    const t = new FakeTimers(0);
    const calls: number[] = [];
    t.setInterval(() => calls.push(t.now()), 5);
    t.advance(17);
    expect(calls).toEqual([5, 10, 15]);
  });

  it("FakeTimers.clearInterval stops an interval", () => {
    const t = new FakeTimers(0);
    const fn = vi.fn();
    const h = t.setInterval(fn, 5);
    t.advance(10); // 2 calls
    t.clearInterval(h);
    t.advance(20);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
