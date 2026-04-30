import { useEffect, useMemo, useRef, useState } from "react";
import { useRoom } from "./state/room.js";
import { SyncWs } from "./api/ws.js";
import { fetchMe, logout } from "./api/auth.js";
import { Lobby } from "./views/Lobby.js";
import { Player } from "./views/Player.js";
import { PublicGrid } from "./views/PublicGrid.js";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function Chyron(props: { route: "main" | "grid" }) {
  const { state, you } = useRoom();
  // Decorative session-time burn. Derived from a fixed start timestamp on
  // every tick (rather than incrementing state from a setInterval drift),
  // which keeps the displayed value accurate even if the runtime throttles
  // intervals on backgrounded tabs or low-end mobile.
  const [, forceTick] = useState(0);
  const startRef = useRef<number>(performance.now());
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);
  const elapsedMs = performance.now() - startRef.current;
  const totalFrames = Math.floor((elapsedMs / 1000) * 30);
  const f = totalFrames % 30;
  const totalSec = Math.floor(totalFrames / 30);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60) % 24;
  const tc = { h, m, s, f };

  const channel =
    props.route === "grid"
      ? "SYNCER'S PARADISE · GLOBAL FEED"
      : state === "PLAYING"
        ? "SYNCER'S PARADISE · ON AIR"
        : state === "COUNTDOWN"
          ? "SYNCER'S PARADISE · COUNTDOWN"
          : state === "COOLDOWN"
            ? "SYNCER'S PARADISE · TAPE REWIND"
            : "SYNCER'S PARADISE · STANDBY";

  return (
    <header className="chyron">
      <div className="rec" aria-label="recording">
        <span className="rec-dot" />
        <span>REC</span>
      </div>
      <div className="channel">{channel}</div>
      <div className="timecode">
        {pad(tc.h)}:{pad(tc.m)}:{pad(tc.s)}:{pad(tc.f)}
      </div>
      {you ? (
        <div className="you">
          <span className="you-name">▶ {you.name}</span>
          <button className="logout" onClick={logout} aria-label="log out">
            EJECT
          </button>
        </div>
      ) : (
        <div className="you" aria-hidden="true">
          <span>▶ GUEST FEED</span>
        </div>
      )}
    </header>
  );
}

export function App() {
  const route = window.location.pathname.startsWith("/grid") ? "grid" : "main";
  const {
    state,
    applyRoomState,
    applyParticipants,
    setOffset,
    setConnected,
    setExpectedSec,
    you,
  } = useRoom();
  const [meChecked, setMeChecked] = useState(false);
  const [ws, setWs] = useState<SyncWs | null>(null);

  useEffect(() => {
    fetchMe().then(() => setMeChecked(true));
  }, []);

  useEffect(() => {
    if (!meChecked) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws`;
    const sock: SyncWs = new SyncWs({
      url,
      onMessage: (msg) => {
        if (msg.type === "room_state") {
          applyRoomState(msg);
          setConnected(true);
        } else if (msg.type === "participants") {
          applyParticipants(msg.participants);
        } else if (msg.type === "playhead") {
          // The server's `expectedSec` was true at the moment it called
          // `serverNow`. By the time this message arrived, server-time has
          // advanced by roughly half the round-trip — using the raw value
          // makes the player look ~50–300ms behind for the entire window
          // until the next message, which on cellular alone can exceed the
          // drift threshold and trigger a needless seek.
          //
          // Compensate by adding the wall-clock time elapsed between the
          // server's broadcast and now (in server time, which we estimate
          // via the NTP-style offset). On a local network this adjustment
          // is small; on cellular it's the difference between a smooth
          // playback and a glitch every 5 seconds.
          const offset = sock.offsetMs();
          const serverNowEstimate = Date.now() + offset;
          const elapsedSinceBroadcastMs = Math.max(0, serverNowEstimate - msg.serverNow);
          setExpectedSec(msg.expectedSec + elapsedSinceBroadcastMs / 1000);
        }
      },
      onOffsetChange: setOffset,
    });
    setWs(sock);
    return () => sock.close();
  }, [meChecked, applyRoomState, applyParticipants, setConnected, setOffset, setExpectedSec]);

  const getOffsetMs = useMemo(() => () => ws?.offsetMs() ?? 0, [ws]);

  if (!meChecked) return null;

  let view;
  if (route === "grid") {
    view = <PublicGrid getOffsetMs={getOffsetMs} />;
  } else if (state === "PLAYING" && you?.role === "participant") {
    view = <Player getOffsetMs={getOffsetMs} />;
  } else if (state === "PLAYING" && you?.role === "spectator") {
    // Mid-round late joiners get the spectator grid until COOLDOWN promotes them.
    view = <PublicGrid getOffsetMs={getOffsetMs} />;
  } else {
    view = <Lobby />;
  }

  return (
    <div className="app-shell">
      <Chyron route={route} />
      <main className="stage">{view}</main>
    </div>
  );
}
