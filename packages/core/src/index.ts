export const GAME_IDS = [
  "neon-dash",
  "sunset-circuit",
  "starfall",
  "prism-break",
  "tile-shift",
] as const;
export type GameId = (typeof GAME_IDS)[number];
export type GameStats = { best: number; runs: number; total: number };
export type LocalProgress = {
  version: 2;
  games: Partial<Record<GameId, GameStats>>;
};
export const emptyProgress = (): LocalProgress => ({ version: 2, games: {} });
export const emptyStats = (): GameStats => ({ best: 0, runs: 0, total: 0 });
const validNumber = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
export function parseProgress(value: unknown, legacy?: unknown): LocalProgress {
  const result = emptyProgress();
  const validStats = (v: unknown): v is GameStats =>
    !!v &&
    typeof v === "object" &&
    "best" in v &&
    "runs" in v &&
    "total" in v &&
    validNumber(v.best) &&
    validNumber(v.runs) &&
    validNumber(v.total) &&
    v.total >= v.best;
  if (
    value &&
    typeof value === "object" &&
    "version" in value &&
    value.version === 2 &&
    "games" in value &&
    value.games &&
    typeof value.games === "object"
  ) {
    for (const id of GAME_IDS) {
      const v = (value.games as Record<string, unknown>)[id];
      if (validStats(v))
        result.games[id] = { best: v.best, runs: v.runs, total: v.total };
    }
  } else if (validStats(legacy)) result.games["neon-dash"] = { ...legacy };
  return result;
}
export function recordRun(
  progress: LocalProgress,
  gameId: GameId,
  score: number,
): LocalProgress {
  if (
    !GAME_IDS.includes(gameId) ||
    !validNumber(score) ||
    score > 1_000_000_000
  )
    throw new Error("Invalid game result");
  const prev = progress.games[gameId] || emptyStats();
  return {
    version: 2,
    games: {
      ...progress.games,
      [gameId]: {
        best: Math.max(prev.best, score),
        runs: prev.runs + 1,
        total: Math.min(Number.MAX_SAFE_INTEGER, prev.total + score),
      },
    },
  };
}
// Shared future service contracts. Auth adapters must obtain identity from a verified session.
export type Account = { id: string; displayName: string; avatarUrl?: string };
export interface AuthProvider {
  getAccount(): Promise<Account | null>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}
export type LeaderboardEntry = {
  rank: number;
  accountId: string;
  displayName: string;
  score: number;
  achievedAt: string;
};
export type RunTicket = {
  runId: string;
  gameId: GameId;
  variantId?: string;
  rulesVersion: string;
  seed: number;
  expiresAt: string;
};
export type GameInput = { tick: number; action: string; value?: number };
export interface LeaderboardService {
  getBoard(
    gameId: GameId,
    seasonId: string,
    cursor?: string,
    variantId?: string,
  ): Promise<{ entries: LeaderboardEntry[]; nextCursor?: string }>;
  startRun(gameId: GameId, variantId?: string): Promise<RunTicket>;
  finishRun(
    runId: string,
    inputs: GameInput[],
  ): Promise<{ status: "pending" | "verified" | "rejected" }>;
}
export function moveTile(board: readonly number[], index: number): number[] {
  const empty = board.indexOf(0);
  const size = Math.sqrt(board.length);
  if (!Number.isInteger(size) || index < 0 || index >= board.length)
    return [...board];
  if (
    Math.abs(Math.floor(empty / size) - Math.floor(index / size)) +
      Math.abs((empty % size) - (index % size)) !==
    1
  )
    return [...board];
  const next = [...board];
  [next[empty], next[index]] = [next[index], next[empty]];
  return next;
}
export const isSolved = (board: readonly number[]) =>
  board.every((n, i) => n === (i + 1) % board.length);
export function shuffledBoard(seed: number, steps = 160): number[] {
  let board = Array.from({ length: 16 }, (_, i) => (i + 1) % 16),
    previous = -1;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let n = 0; n < steps; n++) {
    const e = board.indexOf(0),
      options = [
        e - 4,
        e + 4,
        e % 4 > 0 ? e - 1 : -1,
        e % 4 < 3 ? e + 1 : -1,
      ].filter((i) => i >= 0 && i < 16 && i !== previous);
    const chosen = options[Math.floor(random() * options.length)];
    previous = e;
    board = moveTile(board, chosen);
  }
  return isSolved(board) ? moveTile(board, 14) : board;
}
export function circleHitsBox(
  x: number,
  y: number,
  r: number,
  b: { x: number; y: number; width: number; height: number },
) {
  const nearX = Math.max(b.x, Math.min(x, b.x + b.width)),
    nearY = Math.max(b.y, Math.min(y, b.y + b.height));
  return (x - nearX) ** 2 + (y - nearY) ** 2 <= r * r;
}
export * from "./racing";
export * from "./race-sim";
export * from "./arcade-sim";
export * from "./party-planet";
export * from "./cloudbound";
export * from "./boostball";
