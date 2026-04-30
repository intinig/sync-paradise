/**
 * Two-state drift policy:
 *
 * - Below DRIFT_TOLERANCE_SEC the player is considered "in sync" and we leave
 *   it alone. 300ms is comfortably above the noise floor of inter-browser
 *   YouTube playback drift, so we don't fight normal jitter.
 * - At or above the threshold we hard-seek to the expected position. A single
 *   audible cut once per song is preferable to constant rate-nudging at every
 *   5s tick, which produces audible warbling and rarely converges.
 */
export const DRIFT_TOLERANCE_SEC = 0.3;

export type DriftAction =
  | { kind: "none" }
  | { kind: "seek"; toSec: number };

export function decideDriftAction(args: {
  expectedSec: number;
  currentSec: number;
}): DriftAction {
  const abs = Math.abs(args.currentSec - args.expectedSec);
  if (abs < DRIFT_TOLERANCE_SEC) return { kind: "none" };
  return { kind: "seek", toSec: args.expectedSec };
}
