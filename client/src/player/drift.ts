/**
 * Two-state drift policy:
 *
 * - Below DRIFT_TOLERANCE_SEC the player is considered "in sync" and we leave
 *   it alone. 1.5s is well above the inter-platform first-frame variance
 *   (iOS Safari vs macOS Chrome can sit 200–500ms apart at startup) plus
 *   network-message latency plus YouTube buffer hiccups. Anything tighter
 *   produces a visible glitch every 5s as the loop repeatedly seeks against
 *   structural noise.
 * - At or above the threshold we hard-seek to the expected position. A single
 *   audible cut on a real desync (network freeze, tab backgrounded) is
 *   preferable to constant correction against the system's normal jitter.
 *
 * For a 4-minute video this means worst-case 1.5s of drift between two
 * viewers — barely perceptible when watching apart, well below the threshold
 * where the public grid's overlapping-audio illusion would break down.
 */
export const DRIFT_TOLERANCE_SEC = 1.5;

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
