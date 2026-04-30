import { useEffect, useState } from "react";
import { useRoom } from "../state/room.js";
import { Tile } from "../components/Tile.js";
import { Countdown } from "../components/Countdown.js";

function formatFeedTc(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec < 0) return "00:00";
  const total = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function PublicGrid(props: { getOffsetMs: () => number }) {
  const {
    state,
    participants,
    videoId,
    playAtServerMs,
    cooldownEndsAtServerMs,
    offsetMs,
    expectedSec,
  } = useRoom();
  const [allUnmuted, setAllUnmuted] = useState(false);

  // Smooth-ticking display value for the banner only. Interpolated locally
  // each second from playAtServerMs so the banner looks alive between the
  // server's 5s playhead broadcasts. Tiles use the canonical `expectedSec`
  // from the store (server-authoritative) for drift correction.
  const [bannerSec, setBannerSec] = useState<number | null>(null);
  useEffect(() => {
    if (state !== "PLAYING" || !playAtServerMs) {
      setBannerSec(null);
      return;
    }
    const tick = () => setBannerSec((Date.now() + offsetMs - playAtServerMs) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state, playAtServerMs, offsetMs]);

  // Stable cam numbers across the room (alphabetical by id).
  const orderedAll = [...participants].sort((a, b) => a.id.localeCompare(b.id));
  const camNumberFor = (id: string) => orderedAll.findIndex((p) => p.id === id) + 1;

  const camCount = participants.length;
  const live = state === "PLAYING";

  return (
    <div className="public-grid">
      <div className="grid-banner">
        ▌ SYNCER'S PARADISE <span className="sep">/</span> GLOBAL FEED <span className="sep">/</span>{" "}
        {camCount} CAM{camCount === 1 ? "" : "S"} {live ? "LIVE" : "STANDBY"}
        {live && <span className="feed-tc">{formatFeedTc(bannerSec)}</span>}
      </div>

      <div className="cam-grid">
        {participants.length === 0 && (
          <div className="tile tile-empty">
            <div className="placeholder-av">∅</div>
            <div className="placeholder-name">— NO SIGNAL —</div>
            <div className="placeholder-status">tape standing by</div>
          </div>
        )}

        {participants.map((p) =>
          live && playAtServerMs !== null ? (
            <Tile
              key={p.id}
              participant={p}
              videoId={videoId}
              muted={!allUnmuted}
              playAtServerMs={playAtServerMs}
              expectedSec={expectedSec}
              getOffsetMs={props.getOffsetMs}
              variant="cam"
              camNumber={camNumberFor(p.id)}
              isLive={true}
            />
          ) : (
            <div key={p.id} className="tile tile-empty">
              <div className="placeholder-av">
                {p.picture ? <img src={p.picture} alt="" /> : p.name.charAt(0).toUpperCase()}
              </div>
              <div className="placeholder-name">{p.name}</div>
              {state === "LOBBY" && <div className="placeholder-status">▌ STANDBY ▌</div>}
              {state === "COUNTDOWN" && playAtServerMs !== null && (
                <div className="placeholder-status">
                  TAPING IN{" "}
                  <Countdown targetServerMs={playAtServerMs} offsetMs={offsetMs} variant="inline" />
                </div>
              )}
              {state === "COOLDOWN" && cooldownEndsAtServerMs !== null && (
                <div className="placeholder-status">
                  REWIND{" "}
                  <Countdown
                    targetServerMs={cooldownEndsAtServerMs}
                    offsetMs={offsetMs}
                    variant="inline"
                  />
                </div>
              )}
            </div>
          ),
        )}
      </div>

      <button className="unmute-floor" onClick={() => setAllUnmuted((v) => !v)}>
        {allUnmuted ? "▣ MUTE ALL FEEDS" : "▣ UNMUTE ALL FEEDS"}
      </button>
      <div className="footer-tc">▌ TAPE 0001 · A-SIDE ▌</div>
    </div>
  );
}
