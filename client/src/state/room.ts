import { create } from "zustand";
import type { RoomState, Participant, You } from "../../../shared/protocol.js";

interface RoomStore {
  connected: boolean;
  state: RoomState;
  participants: Participant[];
  you: You | null;
  videoId: string;
  playAtServerMs: number | null;
  endAtServerMs: number | null;
  cooldownEndsAtServerMs: number | null;
  offsetMs: number;
  /**
   * Server-authoritative playhead position in seconds since the video started.
   * Updated by the server's `playhead` broadcast every 5 seconds during
   * PLAYING. null when no playhead has been received this session (lobby,
   * countdown, before the first tick of PLAYING, or cooldown).
   */
  expectedSec: number | null;
  setConnected: (v: boolean) => void;
  setOffset: (v: number) => void;
  setExpectedSec: (v: number | null) => void;
  applyRoomState: (s: {
    state: RoomState;
    participants: Participant[];
    you: You | null;
    videoId: string;
    playAtServerMs: number | null;
    endAtServerMs: number | null;
    cooldownEndsAtServerMs: number | null;
  }) => void;
  applyParticipants: (p: Participant[]) => void;
}

export const useRoom = create<RoomStore>((set) => ({
  connected: false,
  state: "LOBBY",
  participants: [],
  you: null,
  videoId: "fPO76Jlnz6c",
  playAtServerMs: null,
  endAtServerMs: null,
  cooldownEndsAtServerMs: null,
  offsetMs: 0,
  expectedSec: null,
  setConnected: (v) => set({ connected: v }),
  setOffset: (v) => set({ offsetMs: v }),
  setExpectedSec: (v) => set({ expectedSec: v }),
  applyRoomState: (s) =>
    set((prev) => ({
      state: s.state,
      participants: s.participants,
      you: s.you,
      videoId: s.videoId,
      playAtServerMs: s.playAtServerMs,
      endAtServerMs: s.endAtServerMs,
      cooldownEndsAtServerMs: s.cooldownEndsAtServerMs,
      // Drop a stale playhead when leaving PLAYING; preserve it during PLAYING
      // so a re-broadcast (participant join/leave) doesn't blank it briefly
      // between server playhead ticks.
      expectedSec: s.state === "PLAYING" ? prev.expectedSec : null,
    })),
  applyParticipants: (p) => set({ participants: p }),
}));
