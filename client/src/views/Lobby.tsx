import { useRoom } from "../state/room.js";
import { Countdown } from "../components/Countdown.js";
import { googleLoginUrl } from "../api/auth.js";

export function Lobby() {
  const { state, participants, you, playAtServerMs, cooldownEndsAtServerMs, offsetMs } = useRoom();

  // Signed-out: marquee + sign-in CTA.
  if (!you) {
    return (
      <div className="lobby">
        <div className="lobby-colorbars" aria-hidden="true">
          <div className="b1" />
          <div className="b2" />
          <div className="b3" />
          <div className="b4" />
          <div className="b5" />
          <div className="b6" />
          <div className="b7">SMPTE</div>
        </div>

        <div className="lobby-hero">
          <div className="lobby-show-card">▼ NOW SHOWING ▼</div>
          <h1 className="lobby-title">
            SYNCER'S<span className="line2">PARADISE</span>
          </h1>
          <div className="lobby-meta">
            EST. <span>·</span> 2008 <span>·</span> FOR COOLIO <span>·</span> SINCE TAPED
          </div>
        </div>

        <div className="signin-block">
          <div className="press-play">▶ PRESS PLAY TO JOIN ◀</div>
          <a className="signin-btn" href={googleLoginUrl()}>
            SIGN IN — GOOGLE
          </a>
          <a className="lobby-grid-link" href="/grid">
            ▌ JUST WATCHING? GO TO GLOBAL FEED
          </a>
        </div>
      </div>
    );
  }

  // Signed-in lobby: hero + countdown box + crew list.
  return (
    <div className="lobby">
      <div className="lobby-hero">
        <div className="lobby-show-card">▼ NOW BOARDING ▼</div>
        <h1 className="lobby-title">
          SYNCER'S<span className="line2">PARADISE</span>
        </h1>
        <div className="lobby-meta">
          EST. <span>·</span> 2008 <span>·</span> FOR COOLIO <span>·</span> SINCE TAPED
        </div>
      </div>

      {state === "LOBBY" && (
        <div className="countdown-box">
          <div className="label">⌛ AWAITING SIGNAL</div>
          <div className="countdown-numerals">— —</div>
          <div className="sub">
            {participants.length} OF 2 ON DECK · {participants.length < 2 ? "NEED ONE MORE" : "STANDBY"}
          </div>
        </div>
      )}

      {state === "COUNTDOWN" && playAtServerMs !== null && (
        <div className="countdown-box">
          <div className="label">⌛ VIGIL T-MINUS</div>
          <Countdown targetServerMs={playAtServerMs} offsetMs={offsetMs} />
          <div className="sub">SIGNAL ACQUIRED · {participants.length} ON DECK</div>
        </div>
      )}

      {state === "COOLDOWN" && cooldownEndsAtServerMs !== null && (
        <div className="countdown-box">
          <div className="label">▌ TAPE REWIND ▌</div>
          <Countdown targetServerMs={cooldownEndsAtServerMs} offsetMs={offsetMs} />
          <div className="sub">NEXT VIGIL CUEING UP · STAY ON CHANNEL</div>
        </div>
      )}

      <div className="crew">
        {participants.map((p) => (
          <div className="crew-item" key={p.id}>
            <div className="crew-av">
              {p.picture ? (
                <img src={p.picture} alt="" />
              ) : (
                p.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="crew-name">{p.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
