import { useRoom } from "../state/room.js";
import { Countdown } from "../components/Countdown.js";
import { googleLoginUrl, logout } from "../api/auth.js";

export function Lobby() {
  const { state, participants, you, playAtServerMs, cooldownEndsAtServerMs, offsetMs } = useRoom();
  if (!you) {
    return (
      <div className="lobby">
        <h1>Sync Paradise</h1>
        <p>Sign in to join the next sync of <i>Gangsta's Paradise</i>.</p>
        <a href={googleLoginUrl()}><button>Sign in with Google</button></a>
        <p style={{ marginTop: "2rem" }}><a href="/grid">Just want to watch? See the public grid →</a></p>
      </div>
    );
  }
  return (
    <div className="lobby">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Hi, {you.name}</span>
        <button onClick={logout}>Logout</button>
      </header>
      <h1>Sync Paradise</h1>
      {state === "LOBBY" && (
        <p>Waiting for someone else to join… ({participants.length}/2)</p>
      )}
      {state === "COUNTDOWN" && playAtServerMs !== null && (
        <>
          <Countdown targetServerMs={playAtServerMs} offsetMs={offsetMs} />
          <p>Get ready.</p>
        </>
      )}
      {state === "COOLDOWN" && cooldownEndsAtServerMs !== null && (
        <>
          <Countdown targetServerMs={cooldownEndsAtServerMs} offsetMs={offsetMs} />
          <p>Next round shortly. Stay or come back.</p>
        </>
      )}
      <div className="lobby-grid">
        {participants.map((p) => (
          <div key={p.id} title={p.name}>
            <img src={p.picture} alt={p.name} />
          </div>
        ))}
      </div>
    </div>
  );
}
