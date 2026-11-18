import {
  HANDLING_VERSION,
  TRACK_IDS,
  type TrackId,
  type TourResult,
  type GhostFrame,
  type RaceMode,
} from "@onlinearcade/core";
export type TourRecord = {
  medal: 0 | 1 | 2 | 3;
  bestTimeMs: number;
  bestPlace: number;
  runs: number;
};
export type Replay = { version: 3; durationMs: number; frames: GhostFrame[] };
export type TourCareer = {
  version: 3;
  records: Partial<Record<TrackId, Partial<Record<RaceMode, TourRecord>>>>;
  ghosts: Partial<Record<TrackId, Replay>>;
  paint: string;
};
export const PAINTS = [
  { id: "tangerine", name: "Tangerine", color: "#f4a05f", stars: 0 },
  { id: "seafoam", name: "Seafoam", color: "#9dd8bf", stars: 2 },
  { id: "ultraviolet", name: "Ultraviolet", color: "#b29ae8", stars: 6 },
  { id: "midnight", name: "Midnight Gold", color: "#d7bf82", stars: 10 },
] as const;
export const emptyCareer = (): TourCareer => ({
  version: 3,
  records: {},
  ghosts: {},
  paint: "tangerine",
});
export function careerStars(career: TourCareer) {
  return TRACK_IDS.reduce(
    (total, id) => total + (career.records[id]?.["grand-prix"]?.medal || 0),
    0,
  );
}
export function validReplay(value: unknown): value is Replay {
  if (!value || typeof value !== "object") return false;
  const r = value as Replay;
  if (
    r.version !== HANDLING_VERSION ||
    !Number.isSafeInteger(r.durationMs) ||
    r.durationMs < 10000 ||
    r.durationMs > 600000 ||
    !Array.isArray(r.frames) ||
    r.frames.length < 2 ||
    r.frames.length > 6100
  )
    return false;
  let lastTime = -1,
    lastProgress = -0.1;
  for (const f of r.frames) {
    if (
      !f ||
      ![f.t, f.x, f.z, f.heading, f.progress].every(Number.isFinite) ||
      f.t < lastTime ||
      f.t < 0 ||
      f.t > r.durationMs / 1000 + 0.1 ||
      Math.abs(f.x) > 400 ||
      Math.abs(f.z) > 400 ||
      f.progress < lastProgress - 0.001 ||
      f.progress > 3.05
    )
      return false;
    lastTime = f.t;
    lastProgress = f.progress;
  }
  return lastTime >= r.durationMs / 1000 - 0.25;
}
export function parseCareer(raw: unknown): TourCareer {
  const out = emptyCareer();
  if (
    !raw ||
    typeof raw !== "object" ||
    (raw as TourCareer).version !== HANDLING_VERSION
  )
    return out;
  const r = raw as TourCareer;
  for (const id of TRACK_IDS) {
    for (const mode of ["grand-prix", "time-trial"] as const) {
      const entry = r.records?.[id]?.[mode];
      if (
        entry &&
        [entry.medal, entry.bestTimeMs, entry.bestPlace, entry.runs].every(
          Number.isSafeInteger,
        ) &&
        entry.medal >= 0 &&
        entry.medal <= 3 &&
        entry.bestTimeMs > 0 &&
        entry.bestPlace >= 1 &&
        entry.bestPlace <= 5 &&
        entry.runs > 0
      ) {
        out.records[id] ??= {};
        out.records[id]![mode] = { ...entry };
      }
    }
    if (validReplay(r.ghosts?.[id])) out.ghosts[id] = r.ghosts[id];
  }
  const paint = PAINTS.find((p) => p.id === r.paint);
  if (paint && careerStars(out) >= paint.stars) out.paint = paint.id;
  return out;
}
export function recordTour(
  career: TourCareer,
  outcome: TourResult,
  replay: Replay | null,
): TourCareer {
  const id = outcome.result.trackId,
    mode = outcome.mode;
  if (
    !TRACK_IDS.includes(id) ||
    !["grand-prix", "time-trial"].includes(mode) ||
    !Number.isSafeInteger(outcome.result.durationMs) ||
    outcome.result.durationMs <= 0
  )
    throw new Error("Invalid tour result");
  const prev = career.records[id]?.[mode],
    entry = {
      medal: Math.max(prev?.medal || 0, outcome.medal) as 0 | 1 | 2 | 3,
      bestTimeMs: Math.min(
        prev?.bestTimeMs || Infinity,
        outcome.result.durationMs,
      ),
      bestPlace: Math.min(prev?.bestPlace || 5, outcome.place),
      runs: (prev?.runs || 0) + 1,
    };
  const next = {
    ...career,
    records: {
      ...career.records,
      [id]: { ...career.records[id], [mode]: entry },
    },
    ghosts: { ...career.ghosts },
  };
  if (
    mode === "time-trial" &&
    outcome.recoveries === 0 &&
    replay &&
    validReplay(replay) &&
    replay.durationMs === outcome.result.durationMs &&
    (!next.ghosts[id] || replay.durationMs < next.ghosts[id]!.durationMs)
  )
    next.ghosts[id] = replay;
  return next;
}
export class TourRepository {
  constructor(
    private storage: Storage,
    private owner = "guest",
  ) {}
  load() {
    try {
      return parseCareer(
        JSON.parse(this.storage.getItem("oa-tour-v3:" + this.owner) || "null"),
      );
    } catch {
      return emptyCareer();
    }
  }
  save(career: TourCareer) {
    this.storage.setItem("oa-tour-v3:" + this.owner, JSON.stringify(career));
  }
}
