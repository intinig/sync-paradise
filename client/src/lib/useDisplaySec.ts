import { useEffect, useState } from "react";

/**
 * Returns a smoothly-ticking (1Hz) "seconds since the song started" value
 * derived from the server's `playAtServerMs` and the client's NTP offset.
 *
 * Used purely for the visible timecode burns (tile badges, public-grid feed
 * banner). NOT for drift correction — the server-authoritative `expectedSec`
 * in the Zustand store is what `correctDrift` consumes.
 *
 * Returns `null` while `playAtServerMs` is null (lobby, countdown, cooldown,
 * any non-PLAYING state) so callers can render a placeholder.
 */
export function useDisplaySec(
  playAtServerMs: number | null,
  offsetMs: number,
): number | null {
  const [sec, setSec] = useState<number | null>(null);
  useEffect(() => {
    if (playAtServerMs === null) {
      setSec(null);
      return;
    }
    const tick = () => setSec((Date.now() + offsetMs - playAtServerMs) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [playAtServerMs, offsetMs]);
  return sec;
}
