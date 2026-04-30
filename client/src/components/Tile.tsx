import { useEffect, useRef } from "react";
import type { Participant } from "../../../shared/protocol.js";
import { createSyncedPlayer, type SyncedPlayer } from "../player/youtube.js";

export type TileVariant = "primary" | "pip" | "cam";

export interface TileProps {
  participant: Participant;
  videoId: string;
  muted: boolean;
  playAtServerMs: number | null;
  expectedSec: number | null;
  getOffsetMs: () => number;
  variant?: TileVariant;
  camNumber?: number;
  isLive?: boolean;
}

function formatTimecode(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec < 0) return "00:00";
  const total = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
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
      if (cancelled) { p.dispose(); return; }
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

  const tc = formatTimecode(props.expectedSec);
  const cam = formatCam(props.camNumber);
  const className = `tile ${
    variant === "primary" ? "tile-primary" : variant === "pip" ? "tile-pip" : "tile-cam"
  }`;

  return (
    <div className={className}>
      <div ref={containerRef} className="tile-player" />

      {variant === "primary" && (
        <>
          <div className="tile-rec" aria-hidden="true">
            <span className="d" />
            REC
          </div>
          {props.expectedSec !== null && <div className="tile-tc">{tc}</div>}
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
          {props.expectedSec !== null && <div className="tile-tc">{tc}</div>}
          <div className="tile-name-tag">{props.participant.name}</div>
        </>
      )}

      {variant === "cam" && (
        <>
          <div className="tile-cam">{cam}</div>
          {props.expectedSec !== null && <div className="tile-tc">{tc}</div>}
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
