import { useEffect, useState } from "react";
import { useRoom } from "../state/room.js";
import { Tile } from "../components/Tile.js";
import { SyncIndicator } from "../components/SyncIndicator.js";

export function Player(props: { getOffsetMs: () => number }) {
  const { participants, you, videoId, playAtServerMs, offsetMs, expectedSec } = useRoom();

  // Smooth 1Hz interpolation purely for the visual TC overlay on each tile.
  // Drift correction still uses `expectedSec` from the store (server-
  // authoritative, every 5s); this value just keeps the burned-in timecode
  // ticking visibly between those broadcasts.
  const [displaySec, setDisplaySec] = useState<number | null>(null);
  useEffect(() => {
    if (playAtServerMs === null) {
      setDisplaySec(null);
      return;
    }
    const tick = () => setDisplaySec((Date.now() + offsetMs - playAtServerMs) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [playAtServerMs, offsetMs]);

  if (!you) return null;
  const others = participants.filter((p) => p.id !== you.id);
  const me = participants.find((p) => p.id === you.id) ?? you;
  // Stable cam numbers based on alphabetical id order so the same person gets
  // the same CAM-NN across the room.
  const orderedAll = [...participants].sort((a, b) => a.id.localeCompare(b.id));
  const camNumberFor = (id: string) => orderedAll.findIndex((p) => p.id === id) + 1;

  return (
    <div className="player-view">
      <div style={{ position: "relative" }}>
        <Tile
          participant={me}
          videoId={videoId}
          muted={false}
          playAtServerMs={playAtServerMs}
          expectedSec={expectedSec}
          displaySec={displaySec}
          getOffsetMs={props.getOffsetMs}
          variant="primary"
          camNumber={camNumberFor(me.id)}
        />
        <SyncIndicator offsetMs={offsetMs} />
      </div>
      <div className="player-strip">
        {others.map((p) => (
          <Tile
            key={p.id}
            participant={p}
            videoId={videoId}
            muted={true}
            playAtServerMs={playAtServerMs}
            expectedSec={expectedSec}
            displaySec={displaySec}
            getOffsetMs={props.getOffsetMs}
            variant="pip"
            camNumber={camNumberFor(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
