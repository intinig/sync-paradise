import { useEffect, useMemo, useState } from "react";
import { useRoom } from "./state/room.js";
import { SyncWs } from "./api/ws.js";
import { fetchMe } from "./api/auth.js";
import { Lobby } from "./views/Lobby.js";
import { Player } from "./views/Player.js";
import { PublicGrid } from "./views/PublicGrid.js";

export function App() {
  const route = window.location.pathname.startsWith("/grid") ? "grid" : "main";
  const { state, applyRoomState, applyParticipants, setOffset, setConnected, you } = useRoom();
  const [meChecked, setMeChecked] = useState(false);
  const [ws, setWs] = useState<SyncWs | null>(null);

  useEffect(() => {
    fetchMe().then(() => setMeChecked(true));
  }, []);

  useEffect(() => {
    if (!meChecked) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws`;
    const sock = new SyncWs({
      url,
      onMessage: (msg) => {
        if (msg.type === "room_state") {
          applyRoomState(msg);
          setConnected(true);
        } else if (msg.type === "participants") {
          applyParticipants(msg.participants);
        }
      },
      onOffsetChange: setOffset,
    });
    setWs(sock);
    return () => sock.close();
  }, [meChecked, applyRoomState, applyParticipants, setConnected, setOffset]);

  const getOffsetMs = useMemo(() => () => ws?.offsetMs() ?? 0, [ws]);

  if (!meChecked) return null;
  if (route === "grid") return <PublicGrid getOffsetMs={getOffsetMs} />;
  if (state === "PLAYING" && you) return <Player getOffsetMs={getOffsetMs} />;
  return <Lobby />;
}
