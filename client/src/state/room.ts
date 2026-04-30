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
  setConnected: (v: boolean) => void;
  setOffset: (v: number) => void;
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
  setConnected: (v) => set({ connected: v }),
  setOffset: (v) => set({ offsetMs: v }),
  applyRoomState: (s) => set({
    state: s.state,
    participants: s.participants,
    you: s.you,
    videoId: s.videoId,
    playAtServerMs: s.playAtServerMs,
    endAtServerMs: s.endAtServerMs,
    cooldownEndsAtServerMs: s.cooldownEndsAtServerMs,
  }),
  applyParticipants: (p) => set({ participants: p }),
}));
