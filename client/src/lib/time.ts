/**
 * Format a non-negative number of seconds as the unspaced "MM:SS" used in
 * tile timecode burns and the public-grid feed banner. The lobby countdown
 * uses the spaced "MM : SS" variant — see `formatCountdown` below.
 *
 * Returns "00:00" for null / NaN / negative input so callers can pass values
 * that are not yet known without crashing.
 */
export function formatTimecode(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec < 0) return "00:00";
  const total = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Spaced variant for the countdown numerals — keeps the iconic "MM : SS"
 * spacing that reads like a VCR's blink. Same MM/SS math as formatTimecode;
 * only the joiner differs.
 */
export function formatCountdown(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec < 0) return "00 : 00";
  const total = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm} : ${ss}`;
}
