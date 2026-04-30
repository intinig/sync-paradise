export const ROOM_STATES = ["LOBBY", "COUNTDOWN", "PLAYING", "COOLDOWN"] as const;
export type RoomState = (typeof ROOM_STATES)[number];

export type Role = "participant" | "spectator";

export interface Participant {
  id: string;
  name: string;
  picture: string;
}

export interface You extends Participant {
  role: Role;
}

export interface PingMessage {
  type: "ping";
  t0: number;
}
export interface HelloMessage {
  type: "hello";
}
export type ClientMessage = PingMessage | HelloMessage;

export interface PongMessage {
  type: "pong";
  t0: number;
  t1: number;
}
export interface RoomStateMessage {
  type: "room_state";
  state: RoomState;
  participants: Participant[];
  you: You | null;
  videoId: string;
  playAtServerMs: number | null;
  endAtServerMs: number | null;
  cooldownEndsAtServerMs: number | null;
  serverNow: number;
}
export interface ParticipantsMessage {
  type: "participants";
  participants: Participant[];
}
export interface PlayheadMessage {
  type: "playhead";
  expectedSec: number;
  serverNow: number;
}
export type ServerMessage =
  | PongMessage
  | RoomStateMessage
  | ParticipantsMessage
  | PlayheadMessage;
