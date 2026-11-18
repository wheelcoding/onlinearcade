import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyCareer,
  recordTour,
  parseCareer,
  validReplay,
  TourRepository,
  careerStars,
  type Replay,
} from "./racing-career";
import type { TourResult } from "@onlinearcade/core";
const result: TourResult = {
  mode: "time-trial",
  place: 1,
  difficulty: "rookie",
  lapTimes: [20000, 20000, 20000],
  drifts: 2,
  collisions: 0,
  recoveries: 0,
  maxSpeed: 120,
  medal: 2,
  result: {
    trackId: "sunset-bay",
    rulesVersion: 2,
    durationMs: 60000,
    bestLapMs: 20000,
    score: 1000,
  },
};
const replay: Replay = {
  version: 3,
  durationMs: 60000,
  frames: [
    { t: 0, x: 0, z: 0, heading: 0, progress: 0 },
    { t: 60, x: 1, z: 2, heading: 1, progress: 3 },
  ],
};
test("personal ghost saves only a faster clean time trial; GP and TT records stay separate", () => {
  let c = recordTour(emptyCareer(), result, replay);
  assert.ok(c.ghosts["sunset-bay"]);
  c = recordTour(
    c,
    {
      ...result,
      recoveries: 1,
      result: { ...result.result, durationMs: 50000 },
    },
    { ...replay, durationMs: 50000 },
  );
  assert.equal(c.ghosts["sunset-bay"]?.durationMs, 60000);
  c = recordTour(c, { ...result, mode: "grand-prix", medal: 3 }, null);
  assert.equal(careerStars(c), 3);
  assert.equal(c.records["sunset-bay"]?.["time-trial"]?.runs, 2);
  assert.equal(c.records["sunset-bay"]?.["grand-prix"]?.runs, 1);
  assert.deepEqual(parseCareer(c), c);
});
test("damaged, old and backwards ghost recordings are discarded, locked paint cannot load", () => {
  assert.equal(validReplay({ ...replay, version: 2 }), false);
  assert.equal(
    validReplay({ ...replay, frames: [replay.frames[1], replay.frames[0]] }),
    false,
  );
  assert.equal(
    validReplay({
      ...replay,
      frames: [replay.frames[0], { ...replay.frames[1], x: Infinity }],
    }),
    false,
  );
  assert.deepEqual(parseCareer({ version: 2 }), emptyCareer());
  assert.equal(
    parseCareer({ ...emptyCareer(), paint: "midnight" }).paint,
    "tangerine",
  );
  const unlocked = recordTour(
    emptyCareer(),
    { ...result, mode: "grand-prix", medal: 3 },
    null,
  );
  assert.equal(parseCareer({ ...unlocked, paint: "seafoam" }).paint, "seafoam");
});
test("tour career is isolated by account and guest, corrupt storage recovers", () => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) || null,
    setItem: (k: string, v: string) => map.set(k, v),
  } as unknown as Storage;
  const a = new TourRepository(storage, "alice"),
    b = new TourRepository(storage, "bob"),
    guest = new TourRepository(storage);
  a.save(recordTour(emptyCareer(), result, replay));
  assert.ok(a.load().ghosts["sunset-bay"]);
  assert.deepEqual(b.load(), emptyCareer());
  assert.deepEqual(guest.load(), emptyCareer());
  map.set("oa-tour-v3:alice", "bad JSON");
  assert.deepEqual(a.load(), emptyCareer());
});
