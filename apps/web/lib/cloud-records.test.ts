import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AccountOutbox,
  makeGameRun,
  makeRaceRun,
  parseBoard,
  parseCloudProgress,
  validPending,
} from "./cloud-records";
const store = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  } as unknown as Storage;
};
test("account outboxes are isolated and retries retain the same run ID", () => {
  const storage = store(),
    a = new AccountOutbox(storage, "alice"),
    b = new AccountOutbox(storage, "bob"),
    run = makeGameRun("starfall", 100, crypto.randomUUID());
  a.add(run);
  a.add(run);
  assert.equal(a.load().length, 1);
  assert.deepEqual(b.load(), []);
  assert.equal(a.load()[0].eventId, run.eventId);
  a.remove(run.eventId);
  assert.deepEqual(a.load(), []);
  assert.equal(validPending({ ...run, score: NaN }), false);
});
test("race payloads preserve track identity and progress parser rejects malformed values", () => {
  const run = makeRaceRun({
    trackId: "alpine-pass",
    rulesVersion: 2,
    score: 1000,
    durationMs: 90000,
    bestLapMs: 29000,
  });
  assert.equal(run.variantId, "alpine-pass");
  assert.equal(run.gameId, "sunset-circuit");
  assert.throws(() => makeGameRun("sunset-circuit", 100));
  assert.deepEqual(
    parseCloudProgress({
      version: 2,
      games: { starfall: { best: -1 } },
      races: {},
    }).progress.games,
    {},
  );
  assert.throws(() => parseBoard([{ display_name: "Fake" }]));
  assert.throws(() => makeGameRun("starfall", Infinity));
});
