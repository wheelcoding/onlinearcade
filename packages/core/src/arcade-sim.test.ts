import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ArcadeSimulation,
  noArcadeInput,
  puzzleDistance,
  moveTile,
  isSolved,
} from "./index";
const ready = (kind: ConstructorParameters<typeof ArcadeSimulation>[0]) => {
  const s = new ArcadeSimulation(kind, 42);
  s.countdown = 0;
  return s;
};
const ticks = (s: ArcadeSimulation, n: number, input = noArcadeInput()) => {
  for (let i = 0; i < n; i++) s.step(input);
};
test("runner movement is independent of 30, 60 and 144 Hz rendering", () => {
  const runs = [30, 60, 144].map((fps) => {
    const s = ready("neon-dash");
    for (let i = 0; i < fps * 2; i++)
      s.advance(1 / fps, { ...noArcadeInput(), x: 0.5 });
    return s;
  });
  for (const s of runs) {
    assert.ok(Math.abs(s.distance - runs[0].distance) < 1e-6);
    assert.ok(Math.abs(s.player.x - runs[0].player.x) < 1e-6);
    assert.equal(s.totalScore, runs[0].totalScore);
  }
});
test("runner short taps clear a spike, double jumps require release, phase dash spends energy", () => {
  const s = ready("neon-dash");
  s.step({ ...noArcadeInput(), jump: true });
  ticks(s, 30);
  assert.ok(s.player.y < 376);
  const before = s.player.vy;
  s.step({ ...noArcadeInput(), jump: true });
  assert.equal(s.jumps, 2);
  assert.ok(s.player.vy < before);
  ticks(s, 5, { ...noArcadeInput(), jump: true });
  assert.equal(s.jumps, 2);
  s.step({ ...noArcadeInput(), action: true });
  assert.ok(s.dash > 0);
  assert.ok(s.energy < 61);
  const energy = s.energy;
  ticks(s, 5, { ...noArcadeInput(), action: true });
  assert.ok(s.energy >= energy);
  assert.ok(s.energy < 65);
});
test("runner collision grants invulnerability and gems chain without repeat pickups", () => {
  const s = ready("neon-dash");
  s.obstacles = [
    { x: 150, y: 397, width: 40, height: 43, kind: "spike", passed: false },
  ];
  ticks(s, 2);
  assert.equal(s.lives, 2);
  ticks(s, 20);
  assert.equal(s.lives, 2);
  s.gems = [
    { x: s.player.x, y: s.player.y, phase: 0 },
    { x: s.player.x + 2, y: s.player.y, phase: 0 },
  ];
  s.step(noArcadeInput());
  assert.equal(s.collected, 2);
  assert.equal(s.combo, 2);
  assert.ok(s.totalScore >= 75);
  ticks(s, 5);
  assert.equal(s.collected, 2);
});
test("shooter normalized diagonal movement, aimed enemy fire and bounded projectiles", () => {
  const s = ready("starfall"),
    start = { ...s.player };
  ticks(s, 30, { ...noArcadeInput(), x: 1, y: -1 });
  assert.ok(
    Math.abs(Math.hypot(s.player.x - start.x, s.player.y - start.y) - 90) <
      1e-6,
  );
  s.foes = [
    {
      id: 1,
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      hp: 3,
      maxHp: 3,
      kind: "gunner",
      age: 0,
      fire: 0,
    },
  ];
  s.step(noArcadeInput());
  const shot = s.shots.find((s) => s.enemy)!;
  assert.ok(shot.vx > 0 && shot.vy > 0);
  for (let i = 0; i < 1200 && !s.ended; i++) s.step(noArcadeInput());
  assert.ok(s.shots.length <= 300);
});
test("every third shooter wave has a real damageable boss and advances only after defeat", () => {
  const s = ready("starfall");
  s.wave = 3;
  s.spawned = 12;
  s.spawn = 10;
  s.foes = [];
  s.step(noArcadeInput());
  assert.equal(s.foes[0].kind, "boss");
  const boss = s.foes[0];
  boss.y = 110;
  s.shots.push({ x: boss.x, y: boss.y + 2, vx: 0, vy: -100, enemy: false });
  const hp = boss.hp;
  s.step(noArcadeInput());
  assert.equal(boss.hp, hp - 1);
  assert.equal(s.wave, 3);
  boss.hp = 0;
  s.step(noArcadeInput());
  s.step(noArcadeInput());
  assert.ok(s.waveWait > 0);
  ticks(s, 250);
  assert.equal(s.wave, 4);
  assert.equal(s.bossSpawned, false);
});
test("nova requires full charge and removes enemy shots without granting invincibility forever", () => {
  const s = ready("starfall");
  s.shots.push({ x: 100, y: 300, vx: 0, vy: 100, enemy: true });
  s.step({ ...noArcadeInput(), action: true });
  assert.equal(s.energy, 0);
  assert.equal(
    s.shots.some((s) => s.enemy),
    false,
  );
  assert.ok(s.invulnerable > 0);
  s.step(noArcadeInput());
  s.step({ ...noArcadeInput(), action: true });
  assert.ok(s.energy < 1);
  ticks(s, 120);
  assert.equal(s.invulnerable, 0);
});
test("breaker armored crystals take two hits and sectors use different layouts", () => {
  const s = ready("prism-break");
  const first = s.crystals.length;
  s.stage = 2;
  s.makeStage();
  assert.ok(s.crystals.length < first);
  const c = s.crystals.find((c) => c.hp === 2)!;
  s.ball = { x: c.x + 47, y: c.y - 9, vx: 0, vy: 300, active: true };
  s.step(noArcadeInput());
  assert.equal(c.hp, 1);
  assert.ok(s.crystals.includes(c));
  s.ball = { x: c.x + 47, y: c.y - 9, vx: 0, vy: 300, active: true };
  s.step(noArcadeInput());
  assert.ok(!s.crystals.includes(c));
});
test("breaker catches falling powerups, bounces away from walls and resets after a miss", () => {
  const s = ready("prism-break");
  s.drops = [{ x: 480, y: 485, kind: "wide", age: 0 }];
  s.step(noArcadeInput());
  assert.equal(s.paddleWidth, 180);
  s.ball = { x: 941, y: 350, vx: 650, vy: 0, active: true };
  s.step(noArcadeInput());
  assert.ok(s.ball.vx < 0);
  s.ball = { x: 100, y: 559, vx: 0, vy: 400, active: true };
  s.step(noArcadeInput());
  assert.equal(s.lives, 2);
  assert.equal(s.ball.active, false);
  s.step(noArcadeInput());
  assert.equal(s.ball.x, s.paddle);
});
test("breaker final crystal completes once, stops scoring and all three sectors are reachable", () => {
  const s = ready("prism-break");
  for (let stage = 1; stage <= 3; stage++) {
    s.stage = stage;
    s.stageWait = 0;
    s.crystals = [
      { x: 400, y: 120, width: 94, height: 24, hp: 1, maxHp: 1, color: 0 },
    ];
    s.ball = { x: 440, y: 111, vx: 0, vy: 300, active: true };
    s.step(noArcadeInput());
    if (stage < 3) {
      assert.equal(s.ended, false);
      assert.equal(s.stage, stage + 1);
      ticks(s, 250);
      assert.ok(s.crystals.length > 0);
    }
  }
  assert.ok(s.ended && s.won);
  const score = s.totalScore;
  ticks(s, 10);
  assert.equal(s.totalScore, score);
});
test("all puzzle difficulties generate reproducible, solvable, unsolved boards", () => {
  for (const difficulty of ["easy", "normal", "hard"] as const)
    for (let seed = 1; seed < 40; seed++) {
      const s = new ArcadeSimulation("tile-shift", seed, difficulty);
      assert.deepEqual(
        [...s.board].sort((a, b) => a - b),
        Array.from({ length: 16 }, (_, i) => i),
      );
      assert.equal(isSolved(s.board), false);
      let inversions = 0;
      for (let i = 0; i < 16; i++)
        for (let j = i + 1; j < 16; j++)
          if (s.board[i] && s.board[j] && s.board[i] > s.board[j]) inversions++;
      assert.equal((inversions + Math.floor(s.board.indexOf(0) / 4)) % 2, 1);
      assert.deepEqual(
        s.board,
        new ArcadeSimulation("tile-shift", seed, difficulty).board,
      );
    }
});
test("tile undo restores the previous board; hints highlight a legal tile and incur a score penalty", () => {
  const s = ready("tile-shift"),
    original = [...s.board];
  s.hint();
  assert.notDeepEqual(moveTile(s.board, s.hintTile), s.board);
  assert.equal(s.hints, 1);
  assert.ok(s.tile(s.hintTile));
  ticks(s, 20);
  assert.ok(s.undo());
  assert.deepEqual(s.board, original);
  assert.equal(s.undos, 1);
  assert.equal(s.moves, 2);
  s.anim = 0;
  s.board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15];
  s.previousBoard = [...s.board];
  assert.equal(puzzleDistance(s.board), 1);
  s.tile(15);
  assert.ok(s.ended && s.won);
  assert.equal(
    s.totalScore,
    20000 - 3 * 40 - Math.floor(s.time) * 10 - 600 - 120,
  );
});
