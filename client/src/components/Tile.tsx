import { useEffect, useRef } from "react";
import type { Participant } from "../../../shared/protocol.js";
import { createSyncedPlayer, type SyncedPlayer } from "../player/youtube.js";

export interface TileProps {
  participant: Participant;
  videoId: string;
  muted: boolean;
  playAtServerMs: number | null;
  expectedSec: number | null;
  getOffsetMs: () => number;
  showLabel?: boolean;
}

export function Tile(props: TileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<SyncedPlayer | null>(null);

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

  return (
    <div className="tile">
      <div ref={containerRef} className="tile-player" />
      {props.showLabel !== false && (
        <div className="tile-label">
          <img src={props.participant.picture} alt="" />
          <span>{props.participant.name}</span>
        </div>
      )}
    </div>
  );
}
