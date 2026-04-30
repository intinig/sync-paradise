import { useEffect, useRef } from "react";
import type { Participant } from "../../../shared/protocol.js";
import { createSyncedPlayer, type SyncedPlayer } from "../player/youtube.js";
import { formatTimecode } from "../lib/time.js";

export type TileVariant = "primary" | "pip" | "cam";

export interface TileProps {
  participant: Participant;
  videoId: string;
  muted: boolean;
  playAtServerMs: number | null;
  /**
   * Server-authoritative playhead position. Drives drift correction (the
   * player seeks if its currentTime is more than DRIFT_TOLERANCE_SEC from
   * this value). Updates every 5s when the server broadcasts.
   */
  expectedSec: number | null;
  /**
   * Smooth display value for the timecode burn overlay only. Updates at 1Hz
   * locally so the badge ticks visibly between server broadcasts. If
   * omitted, falls back to expectedSec — but expectedSec only updates every
   * 5s, so the badge would appear frozen for long stretches.
   */
  displaySec?: number | null;
  getOffsetMs: () => number;
  variant?: TileVariant;
  camNumber?: number;
  isLive?: boolean;
}

function formatCam(n: number | undefined): string {
  if (n === undefined) return "CAM-??";
  return `CAM-${String(n).padStart(2, "0")}`;
}

export function Tile(props: TileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<SyncedPlayer | null>(null);
  const variant: TileVariant = props.variant ?? "pip";

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;
    createSyncedPlayer({
      container: containerRef.current,
      videoId: props.videoId,
      muted: props.muted,
      getOffsetMs: props.getOffsetMs,
    }).then((p) => {
      if (cancelled) {
        p.dispose();
        return;
      }
      playerRef.current = p;
      if (!props.muted) {
        (window as unknown as { __lastPlayer?: typeof p }).__lastPlayer = p;
      }
      if (props.playAtServerMs !== null) p.scheduleStart(props.playAtServerMs);
    });
    return () => {
      cancelled = true;
      playerRef.current?.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.videoId]);

  useEffect(() => {
    if (props.playAtServerMs !== null) playerRef.current?.scheduleStart(props.playAtServerMs);
  }, [props.playAtServerMs]);

  useEffect(() => {
    playerRef.current?.setMuted(props.muted);
  }, [props.muted]);

  useEffect(() => {
    if (props.expectedSec !== null) playerRef.current?.correctDrift(props.expectedSec);
  }, [props.expectedSec]);

  // Display source: prefer the smooth, locally-interpolated `displaySec`; fall
  // back to the authoritative `expectedSec` if no display value is provided.
  const tcSource = props.displaySec ?? props.expectedSec;
  const tc = formatTimecode(tcSource);
  const cam = formatCam(props.camNumber);

  // The `tile-grid` variant class is *not* `.tile-cam` — that name is taken
  // by the absolute-positioned CAM-NN badge inside the tile. Sharing the
  // class here would inherit `position: absolute; top: 0.3rem; ...` onto the
  // grid container, breaking layout.
  const variantClass =
    variant === "primary" ? "tile-primary" : variant === "pip" ? "tile-pip" : "tile-grid";
  const className = `tile ${variantClass}`;

  return (
    <div className={className}>
      <div ref={containerRef} className="tile-player" />

      {variant === "primary" && (
        <>
          <div className="tile-rec" aria-hidden="true">
            <span className="d" />
            REC
          </div>
          {tcSource !== null && tcSource !== undefined && <div className="tile-tc">{tc}</div>}
          <div className="tile-lower-third">
            <span className="name">{props.participant.name}</span>
            <span className="show">SYNCER'S PARADISE</span>
            <span className="pt">PT. 1 OF VIGIL</span>
          </div>
        </>
      )}

      {variant === "pip" && (
        <>
          <div className="tile-cam">{cam}</div>
          {tcSource !== null && tcSource !== undefined && <div className="tile-tc">{tc}</div>}
          <div className="tile-name-tag">{props.participant.name}</div>
        </>
      )}

      {variant === "cam" && (
        <>
          <div className="tile-cam">{cam}</div>
          {tcSource !== null && tcSource !== undefined && <div className="tile-tc">{tc}</div>}
          {props.isLive && (
            <div className="tile-rec" aria-hidden="true">
              <span className="d" />
              LIVE
            </div>
          )}
          <div className="tile-name-tag">{props.participant.name}</div>
        </>
      )}
    </div>
  );
}
