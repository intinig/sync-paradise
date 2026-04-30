import { useEffect, useState } from "react";
import { useRoom } from "../state/room.js";
import { Tile } from "../components/Tile.js";
import { Countdown } from "../components/Countdown.js";

export function PublicGrid(props: { getOffsetMs: () => number }) {
  const { state, participants, videoId, playAtServerMs, cooldownEndsAtServerMs, offsetMs } = useRoom();
  const [allUnmuted, setAllUnmuted] = useState(false);
  const [expectedSec, setExpectedSec] = useState<number | null>(null);
  useEffect(() => {
    if (state !== "PLAYING" || !playAtServerMs) return;
    const id = setInterval(() => {
      setExpectedSec((Date.now() + offsetMs - playAtServerMs) / 1000);
    }, 5000);
    return () => clearInterval(id);
  }, [state, playAtServerMs, offsetMs]);

  return (
    <div className="public-grid">
      {participants.length === 0 && (
        <div className="tile tile-empty">
          <p>No one's here yet.</p>
          <a href="/">Sign in →</a>
        </div>
      )}
      {participants.map((p) =>
        state === "PLAYING" && playAtServerMs !== null ? (
          <Tile
            key={p.id}
            participant={p}
            videoId={videoId}
            muted={!allUnmuted}
            playAtServerMs={playAtServerMs}
            expectedSec={expectedSec}
            getOffsetMs={props.getOffsetMs}
          />
        ) : (
          <div key={p.id} className="tile tile-empty">
            <img src={p.picture} alt={p.name} />
            <strong>{p.name}</strong>
            {state === "LOBBY" && <span>Waiting</span>}
            {state === "COUNTDOWN" && playAtServerMs !== null && (
              <span>Get ready — <Countdown targetServerMs={playAtServerMs} offsetMs={offsetMs} /></span>
            )}
            {state === "COOLDOWN" && cooldownEndsAtServerMs !== null && (
              <span>Up next — <Countdown targetServerMs={cooldownEndsAtServerMs} offsetMs={offsetMs} /></span>
            )}
          </div>
        ),
      )}
      <button className="unmute-all" onClick={() => setAllUnmuted((v) => !v)}>
        {allUnmuted ? "🔊 Mute all" : "🔇 Unmute all"}
      </button>
    </div>
  );
}
