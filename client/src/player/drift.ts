export type DriftAction =
  | { kind: "none" }
  | { kind: "rate"; rate: number }
  | { kind: "seek"; toSec: number };

export function decideDriftAction(args: { expectedSec: number; currentSec: number }): DriftAction {
  const delta = args.currentSec - args.expectedSec;
  const abs = Math.abs(delta);
  if (abs <= 0.05) return { kind: "none" };
  if (abs > 0.5) return { kind: "seek", toSec: args.expectedSec };
  return { kind: "rate", rate: delta < 0 ? 1.05 : 0.95 };
}
