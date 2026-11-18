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
export type PartySession = { id: string; game: "neon-dash"; startsAt: number };
export type PartyState = {
  code: string;
  host: string;
  players: PartyPlayer[];
  session: PartySession | null;
  messages: ChatMessage[];
};
export type PartyAction = {
  action: "create" | "join" | "leave" | "ready" | "start" | "chat" | "kick";
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
