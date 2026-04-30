/**
 * Network-lag compensation for the server's `playhead` broadcast.
 *
 * The server broadcasts `(expectedSec, serverNow)` at server-time `serverNow`.
 * By the time the client receives it, server-time has advanced by half the
 * round-trip; the client estimates "current server time" as
 * `Date.now() + offsetMs` (where offsetMs is the NTP-style clock offset).
 *
 * The naïve compensation is `expectedSec + (serverNowEstimate - serverNow) / 1000`.
 * That works when the offset is calibrated. But the OffsetEstimator returns
 * 0 until the first ping/pong sample arrives — and if the local wall clock
 * is grossly skewed from the server's (say, the laptop's clock is 30 minutes
 * fast), the "elapsed since broadcast" calculation produces a huge positive
 * number, and the player would seek forward by minutes.
 *
 * Guard: if the implied elapsed is outside the plausible window for one
 * server playhead broadcast (5s tick + a couple seconds of network slack),
 * skip the compensation entirely. The drift threshold absorbs the small
 * residual error from an uncompensated playhead.
 */

export const MAX_PLAUSIBLE_LAG_MS = 10_000;

export function compensatedExpectedSec(args: {
  expectedSec: number;
  serverNowAtBroadcast: number;
  serverNowEstimate: number;
}): number {
  const elapsedRaw = args.serverNowEstimate - args.serverNowAtBroadcast;
  const compensable = elapsedRaw >= 0 && elapsedRaw <= MAX_PLAUSIBLE_LAG_MS;
  const elapsedMs = compensable ? elapsedRaw : 0;
  return args.expectedSec + elapsedMs / 1000;
}
