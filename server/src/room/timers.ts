export type TimerHandle = number;

export interface Timers {
  now(): number;
  setTimeout(cb: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
  setInterval(cb: () => void, periodMs: number): TimerHandle;
  clearInterval(handle: TimerHandle): void;
}

export class RealTimers implements Timers {
  now(): number {
    return Date.now();
  }
  setTimeout(cb: () => void, delayMs: number): TimerHandle {
    return setTimeout(cb, delayMs) as unknown as TimerHandle;
  }
  clearTimeout(handle: TimerHandle): void {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  }
  setInterval(cb: () => void, periodMs: number): TimerHandle {
    return setInterval(cb, periodMs) as unknown as TimerHandle;
  }
  clearInterval(handle: TimerHandle): void {
    clearInterval(handle as unknown as ReturnType<typeof setInterval>);
  }
}

interface ScheduledTimeout {
  id: TimerHandle;
  fireAt: number;
  cb: () => void;
  cancelled: boolean;
}
interface ScheduledInterval {
  id: TimerHandle;
  nextFire: number;
  period: number;
  cb: () => void;
  cancelled: boolean;
}

export class FakeTimers implements Timers {
  private current: number;
  private nextId = 1;
  private timeouts: ScheduledTimeout[] = [];
  private intervals: ScheduledInterval[] = [];

  constructor(start = 0) {
    this.current = start;
  }
  now(): number {
    return this.current;
  }
  setTimeout(cb: () => void, delayMs: number): TimerHandle {
    const id = this.nextId++;
    this.timeouts.push({ id, fireAt: this.current + delayMs, cb, cancelled: false });
    return id;
  }
  clearTimeout(handle: TimerHandle): void {
    const t = this.timeouts.find((x) => x.id === handle);
    if (t) t.cancelled = true;
  }
  setInterval(cb: () => void, periodMs: number): TimerHandle {
    if (periodMs <= 0) throw new Error("interval period must be > 0");
    const id = this.nextId++;
    this.intervals.push({ id, nextFire: this.current + periodMs, period: periodMs, cb, cancelled: false });
    return id;
  }
  clearInterval(handle: TimerHandle): void {
    const i = this.intervals.find((x) => x.id === handle);
    if (i) i.cancelled = true;
  }

  /** Advance time by deltaMs, firing every due timer in time order. */
  advance(deltaMs: number): void {
    const target = this.current + deltaMs;
    while (true) {
      const dueTimeout = this.timeouts
        .filter((t) => !t.cancelled && t.fireAt <= target)
        .sort((a, b) => a.fireAt - b.fireAt)[0];
      const dueInterval = this.intervals
        .filter((i) => !i.cancelled && i.nextFire <= target)
        .sort((a, b) => a.nextFire - b.nextFire)[0];

      const tTime = dueTimeout?.fireAt ?? Infinity;
      const iTime = dueInterval?.nextFire ?? Infinity;
      const earliest = Math.min(tTime, iTime);
      if (earliest === Infinity) break;

      this.current = earliest;
      if (tTime <= iTime && dueTimeout) {
        dueTimeout.cancelled = true;
        dueTimeout.cb();
      } else if (dueInterval) {
        dueInterval.cb();
        dueInterval.nextFire += dueInterval.period;
      }
    }
    this.current = target;
  }
}
