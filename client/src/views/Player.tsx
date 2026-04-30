import { useRoom } from "../state/room.js";
import { Tile } from "../components/Tile.js";
import { SyncIndicator } from "../components/SyncIndicator.js";

export function Player(props: { getOffsetMs: () => number }) {
  const { participants, you, videoId, playAtServerMs, offsetMs, expectedSec } = useRoom();

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
            getOffsetMs={props.getOffsetMs}
            variant="pip"
            camNumber={camNumberFor(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
