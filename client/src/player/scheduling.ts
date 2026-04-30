/**
 * Decide how to start playback for a tile.
 *
 * Three cases:
 * - **future**: play time is far enough out that we should pre-buffer at T-2s
 *   then play at T (seeking to 0 first).
 * - **imminent**: play time is within the next 2 seconds; play at T (seek to 0
 *   first) without an explicit pre-buffer phase.
 * - **live**: play time is already in the past — a late grid open, a reconnect
 *   mid-PLAYING, etc. Seek to the live position and play immediately. Without
 *   this branch, late joiners would replay from second 0 until the next drift
 *   tick yanked them forward.
 *
 * `playheadSec` is the elapsed time since play started. When the live branch
 * fires, `delayMs <= 0`, so `-delayMs / 1000 >= 0` — the Math.max(0, ...) is
 * a defensive belt-and-braces, not load-bearing arithmetic. The branch
 * triggers any time we open or reconnect after the scheduled play moment
 * (late /grid open, refresh mid-PLAYING, dropped+reconnected WS).
 */
export type StartAction =
  | { kind: "future"; preDelayMs: number; playInMs: number }
  | { kind: "imminent"; playInMs: number }
  | { kind: "live"; playheadSec: number };

const PRE_BUFFER_MS = 2000;

export function decideStartAction(args: {
  playAtServerMs: number;
  offsetMs: number;
  nowMs: number;
}): StartAction {
  const playAtClientMs = args.playAtServerMs - args.offsetMs;
  const delayMs = playAtClientMs - args.nowMs;
  if (delayMs <= 0) {
    return { kind: "live", playheadSec: Math.max(0, -delayMs / 1000) };
  }
  if (delayMs <= PRE_BUFFER_MS) {
    return { kind: "imminent", playInMs: delayMs };
  }
  return { kind: "future", preDelayMs: delayMs - PRE_BUFFER_MS, playInMs: delayMs };
}
