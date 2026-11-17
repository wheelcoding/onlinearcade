import { test } from "node:test";
import assert from "node:assert/strict";
import { BrowserRaceRepository, formatRaceTime } from "./race-records";
test("race clock carries rounded centiseconds into the next minute", () => {
  assert.equal(formatRaceTime(59999), "1:00.00");
  assert.equal(formatRaceTime(61010), "1:01.01");
  assert.equal(formatRaceTime(0), "—");
  assert.equal(formatRaceTime(NaN), "—");
});
test("track history persists without touching arcade history and corrupt records recover", () => {
  const values = new Map([["oa-progress-v2", "original"]]);
  const storage = {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  } as unknown as Storage;
  const repo = new BrowserRaceRepository(storage);
  repo.save(
    {},
    {
      trackId: "midnight-harbor",
      rulesVersion: 2,
      durationMs: 120000,
      bestLapMs: 39000,
      score: 1000,
    },
  );
  assert.equal(repo.load()["midnight-harbor"]?.bestTimeMs, 120000);
  assert.equal(values.get("oa-progress-v2"), "original");
  values.set("oa-racing-v2", "bad JSON");
  assert.deepEqual(repo.load(), {});
});
