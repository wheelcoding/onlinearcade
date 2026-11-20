import type { TrackId, Vehicle, RaceInput } from "@onlinearcade/core";
/** Public wire contract. Resume credentials are sent only to their owner, never in room state. */
export type PartyPlayer = {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
};
export type ChatMessage = {
  id: string;
  playerId: string;
  name: string;
  text: string;
  sentAt: number;
};
export type RaceRoster = { memberId: string; name: string; color: string };
export type PartySession = {
  id: string;
  game: "neon-dash" | "kart-circuit" | "party-planet" | "boostball";
  startsAt: number;
  track?: TrackId;
  racers?: RaceRoster[];
};
export type RacePacket = {
  sessionId: string;
  tick: number;
  time: number;
  countdown: number;
  cars: Vehicle[];
  withdrawn: number[];
  complete: boolean;
};
export type RaceCommand = {
  sessionId: string;
  seq: number;
  input: RaceInput;
  recover?: boolean;
};
export type PartyState = {
  code: string;
  host: string;
  players: PartyPlayer[];
  session: PartySession | null;
  messages: ChatMessage[];
};
export type PartyAction = {
  action: "create" | "join" | "leave" | "ready" | "start" | "chat" | "kick";
  game?: "neon-dash" | "kart-circuit" | "party-planet" | "boostball";
  track?: TrackId;
  name?: string;
  code?: string;
  ready?: boolean;
  text?: string;
  playerId?: string;
};
export type PartyReply = {
  ok?: boolean;
  error?: string;
  memberId?: string;
  resumeToken?: string;
};
