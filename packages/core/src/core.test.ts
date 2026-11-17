import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyProgress,
  recordRun,
  parseProgress,
  shuffledBoard,
  moveTile,
  isSolved,
  circleHitsBox,
} from "./index";
test("records stay separated by game and preserve legacy Neon Dash stats", () => {
  const legacy = { best: 80, runs: 3, total: 140 };
  const p = parseProgress(null, legacy);
  const next = recordRun(p, "starfall", 250);
  assert.deepEqual(next.games["neon-dash"], legacy);
  assert.equal(next.games.starfall?.best, 250);
  assert.equal(p.games.starfall, undefined);
  assert.equal(recordRun(next, "starfall", 50).games.starfall?.best, 250);
  assert.throws(() => recordRun(next, "starfall", NaN));
  assert.deepEqual(
    parseProgress({
      version: 2,
      games: { starfall: { best: -1, runs: 1, total: 0 } },
    }),
    emptyProgress(),
  );
});
test("puzzle shuffles are reproducible permutations reachable from solved state", () => {
  for (let seed = 1; seed < 30; seed++) {
    const b = shuffledBoard(seed);
    assert.equal(new Set(b).size, 16);
    assert.equal(isSolved(b), false);
    assert.deepEqual(b, shuffledBoard(seed));
    const inversions = b.reduce(
      (total, x, i) =>
        total + (x ? b.slice(i + 1).filter((y) => y && y < x).length : 0),
      0,
    );
    const row = 4 - Math.floor(b.indexOf(0) / 4);
    assert.equal((inversions + row) % 2, 1);
  }
  const solved = Array.from({ length: 16 }, (_, i) => (i + 1) % 16);
  assert.equal(isSolved(moveTile(moveTile(solved, 14), 15)), true);
  assert.deepEqual(moveTile(solved, 0), solved);
});
test("collision uses actual distance to rectangle including corners", () => {
  const b = { x: 10, y: 10, width: 20, height: 20 };
  assert.equal(circleHitsBox(8, 15, 3, b), true);
  assert.equal(circleHitsBox(0, 0, 5, b), false);
  assert.equal(circleHitsBox(7, 7, 4, b), false);
});
