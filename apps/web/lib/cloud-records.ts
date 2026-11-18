import {
  GAME_IDS,
  TRACK_IDS,
  parseProgress,
  parseRaceRecords,
  type GameId,
  type RaceResult,
} from "@onlinearcade/core";
export type PendingRun = {
  eventId: string;
  gameId: GameId;
  variantId: string;
  score: number;
  durationMs: number | null;
  bestLapMs: number | null;
};
export type BoardRow = {
  position: number;
  display_name: string;
  score: number;
  duration_ms: number | null;
  runs: number;
  achieved_at: string;
  is_self: boolean;
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validPending(v: unknown): v is PendingRun {
  if (!v || typeof v !== "object") return false;
  const r = v as PendingRun;
  return (
    typeof r.eventId === "string" &&
    uuid.test(r.eventId) &&
    GAME_IDS.includes(r.gameId) &&
    Number.isSafeInteger(r.score) &&
    r.score >= 0 &&
    r.score <= 1e9 &&
    (r.gameId === "sunset-circuit"
      ? TRACK_IDS.includes(r.variantId as (typeof TRACK_IDS)[number]) &&
        Number.isSafeInteger(r.durationMs) &&
        (r.durationMs ?? 0) >= 15000 &&
        Number.isSafeInteger(r.bestLapMs) &&
        (r.bestLapMs ?? 0) >= 5000 &&
        (r.bestLapMs ?? 0) * 3 <= (r.durationMs ?? 0) + 2
      : r.variantId === "default" &&
        r.durationMs === null &&
        r.bestLapMs === null)
  );
}
export function makeGameRun(
  gameId: GameId,
  score: number,
  eventId = crypto.randomUUID(),
): PendingRun {
  const result = {
    eventId,
    gameId,
    variantId: "default",
    score,
    durationMs: null,
    bestLapMs: null,
  };
  if (!validPending(result)) throw new Error("Invalid game result");
  return result;
}
export function makeRaceRun(
  race: RaceResult,
  eventId = crypto.randomUUID(),
): PendingRun {
  const result = {
    eventId,
    gameId: "sunset-circuit" as const,
    variantId: race.trackId,
    score: race.score,
    durationMs: race.durationMs,
    bestLapMs: race.bestLapMs,
  };
  if (race.rulesVersion !== 2 || !validPending(result))
    throw new Error("Invalid race result");
  return result;
}
export class AccountOutbox {
  constructor(
    private storage: Storage,
    private accountId: string,
  ) {}
  private key() {
    return "oa-outbox-v1:" + this.accountId;
  }
  load(): PendingRun[] {
    try {
      const value = JSON.parse(this.storage.getItem(this.key()) || "[]");
      return Array.isArray(value)
        ? value.filter(validPending).slice(0, 100)
        : [];
    } catch {
      return [];
    }
  }
  add(run: PendingRun) {
    if (!validPending(run)) throw new Error("Invalid game result");
    const queue = this.load();
    if (queue.some((r) => r.eventId === run.eventId)) return queue;
    if (queue.length >= 100)
      throw new Error(
        "Pending results are full. Reconnect before saving more runs.",
      );
    queue.push(run);
    this.storage.setItem(this.key(), JSON.stringify(queue));
    return queue;
  }
  replace(queue: PendingRun[]) {
    this.storage.setItem(
      this.key(),
      JSON.stringify(queue.filter(validPending).slice(0, 100)),
    );
  }
  remove(eventId: string) {
    const queue = this.load().filter((r) => r.eventId !== eventId);
    this.storage.setItem(this.key(), JSON.stringify(queue));
    return queue;
  }
}
export function parseCloudProgress(raw: unknown) {
  return {
    progress: parseProgress(raw),
    races: parseRaceRecords(
      raw && typeof raw === "object" && "races" in raw ? raw.races : null,
    ),
  };
}
export function parseBoard(raw: unknown): BoardRow[] {
  if (!Array.isArray(raw)) throw new Error("Invalid board response");
  return raw.map((r) => {
    if (
      !r ||
      !Number.isSafeInteger(r.position) ||
      r.position < 1 ||
      typeof r.display_name !== "string" ||
      r.display_name.length > 20 ||
      !Number.isSafeInteger(r.score) ||
      r.score < 0 ||
      !Number.isSafeInteger(r.runs) ||
      r.runs < 1 ||
      !(
        r.duration_ms === null ||
        (Number.isSafeInteger(r.duration_ms) && r.duration_ms > 0)
      ) ||
      typeof r.achieved_at !== "string" ||
      !Number.isFinite(Date.parse(r.achieved_at)) ||
      typeof r.is_self !== "boolean"
    )
      throw new Error("Invalid board response");
    return r as BoardRow;
  });
}
