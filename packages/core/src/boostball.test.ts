import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BoostballSimulation,
  BALL_IDLE,
  boostballBot,
  type BallInput,
} from "./boostball";
const roster = [
  { id: "a", name: "Alex" },
  { id: "b", name: "Sam" },
];
const drive: BallInput = { throttle: 1, steer: 0, boost: false, dodge: false };
const run = (
  s: BoostballSimulation,
  seconds: number,
  input = new Map<string, BallInput>(),
) => {
  for (let i = 0; i < Math.round(seconds * 120); i++) s.advance(1 / 120, input);
};
test("boostball countdown, team assignment, goals, kickoff reset and full time are authoritative", () => {
  const s = new BoostballSimulation(roster);
  run(s, 1, new Map([["a", drive]]));
  assert.equal(s.state.cars[0].x, 220);
  assert.equal(s.state.time, 180);
  assert.deepEqual(
    s.state.cars.map((c) => c.team),
    [0, 1],
  );
  s.state.countdown = 0;
  s.state.ball = { x: 900, y: 270, vx: 400, vy: 0 };
  run(s, 0.2);
  assert.deepEqual(s.state.score, [1, 0]);
  assert.equal(s.state.ball.x, 480);
  assert.ok(s.state.countdown > 0);
  assert.equal(s.state.cars[0].fuel, 100);
  s.state.countdown = 0;
  s.state.ball = { x: 60, y: 270, vx: -400, vy: 0 };
  run(s, 0.2);
  assert.deepEqual(s.state.score, [1, 1]);
  s.state.countdown = 0;
  s.state.time = 0.02;
  run(s, 0.1);
  assert.equal(s.state.complete, true);
  const tick = s.state.tick;
  run(s, 1);
  assert.equal(s.state.tick, tick);
});
test("walls outside goal mouths bounce; car contact transfers momentum to ball", () => {
  const s = new BoostballSimulation(roster);
  s.state.countdown = 0;
  s.state.ball = { x: 900, y: 120, vx: 400, vy: 0 };
  run(s, 0.2);
  assert.equal(s.state.score[0], 0);
  assert.ok(s.state.ball.vx < 0);
  const c = s.state.cars[0];
  c.x = 430;
  c.y = 270;
  c.vx = 250;
  c.angle = 0;
  s.state.ball = { x: 470, y: 270, vx: 0, vy: 0 };
  run(s, 0.2, new Map([["a", drive]]));
  assert.ok(s.state.ball.vx > 200);
  assert.ok(s.state.ball.x > 480);
});
test("steering follows heading, boost consumes fuel and recharges released; dodge has a cooldown", () => {
  const s = new BoostballSimulation(roster);
  s.state.countdown = 0;
  const c = s.state.cars[0];
  run(
    s,
    0.15,
    new Map([["a", { ...drive, steer: 1, boost: true, dodge: true }]]),
  );
  assert.ok(c.angle > 0);
  assert.ok(c.y > 270);
  assert.ok(c.fuel < 100);
  assert.ok(c.cooldown > 1);
  const fuel = c.fuel;
  run(s, 0.2);
  assert.ok(c.fuel > fuel);
  assert.ok(c.cooldown < 1.3);
});
test("fixed steps agree across frame rates and all eight cars remain finite under sustained collisions", () => {
  const frames = [30, 60, 144].map((fps) => {
    const s = new BoostballSimulation(roster);
    s.state.countdown = 0;
    for (let i = 0; i < fps * 2; i++)
      s.advance(1 / fps, new Map([["a", drive]]));
    return s.state.cars[0].x;
  });
  assert.ok(Math.max(...frames) - Math.min(...frames) < 0.01);
  const s = new BoostballSimulation(
    Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: String(i) })),
  );
  s.state.countdown = 0;
  for (let i = 0; i < 120 * 15; i++)
    s.advance(
      1 / 120,
      new Map(
        s.state.cars.map((c) => [
          c.id,
          { ...drive, steer: Math.sin(i / 50), boost: true, dodge: true },
        ]),
      ),
    );
  for (const c of s.state.cars)
    for (const n of [c.x, c.y, c.vx, c.vy, c.fuel])
      assert.ok(Number.isFinite(n));
  s.exit("0");
  assert.equal(s.state.cars[0].active, false);
  s.state.cars.forEach((c) => s.exit(c.id));
  assert.ok(s.state.complete);
});

test("practice AI can score in an open lane through actual driving", () => {
  const s = new BoostballSimulation(roster);
  s.state.cars[0].y = 100;
  for (let i = 0; i < 120 * 60 && s.state.score[1] === 0; i++)
    s.advance(1 / 120, new Map([["b", boostballBot(s.state, "b")]]));
  assert.ok(s.state.score[1] > 0);
});

test("jump requires release, boost extends airtime, and cars land safely", () => {
  const make = () => {
    const s = new BoostballSimulation(roster);
    s.state.countdown = 0;
    return s;
  };
  const normal = make(),
    boosted = make();
  let high = 0,
    boostHigh = 0;
  for (let i = 0; i < 180; i++) {
    normal.advance(1 / 120, new Map([["a", { ...BALL_IDLE, jump: true }]]));
    boosted.advance(
      1 / 120,
      new Map([["a", { ...BALL_IDLE, jump: true, boost: true }]]),
    );
    high = Math.max(high, normal.state.cars[0].height);
    boostHigh = Math.max(boostHigh, boosted.state.cars[0].height);
  }
  assert.ok(high > 40);
  assert.ok(boostHigh > high + 20);
  assert.equal(normal.state.cars[0].height, 0);
  run(normal, 1, new Map([["a", { ...BALL_IDLE, jump: true }]]));
  assert.equal(normal.state.cars[0].height, 0);
  run(normal, 0.02);
  run(normal, 0.1, new Map([["a", { ...BALL_IDLE, jump: true }]]));
  assert.ok(normal.state.cars[0].height > 10);
  run(boosted, 4);
  assert.equal(boosted.state.cars[0].height, 0);
  assert.equal(boosted.state.cars[0].vz, 0);
});

test("airborne balls bounce off the floor and a shot above the crossbar cannot score", () => {
  const s = new BoostballSimulation(roster);
  s.state.countdown = 0;
  s.state.ball = { x: 600, y: 130, vx: 0, vy: 0, height: 80, vz: -80 };
  run(s, 0.6);
  assert.ok(s.state.ball.height! >= 17);
  assert.ok(s.state.ball.vz! > 0);
  s.state.ball = { x: 900, y: 270, vx: 400, vy: 0, height: 110, vz: 0 };
  run(s, 0.12);
  assert.deepEqual(s.state.score, [0, 0]);
  assert.ok(s.state.ball.vx < 0);
  s.state.ball = { x: 900, y: 270, vx: 400, vy: 0, height: 30, vz: 0 };
  run(s, 0.2);
  assert.deepEqual(s.state.score, [1, 0]);
  assert.equal(s.state.ball.height, 17);
  assert.equal(s.state.cars[0].height, 0);
});

test("airborne cars clear grounded opponents and share identical jump trajectories across frame rates", () => {
  const heights = [30, 60, 144].map((fps) => {
    const s = new BoostballSimulation(roster);
    s.state.countdown = 0;
    for (let i = 0; i < fps * 0.5; i++)
      s.advance(1 / fps, new Map([["a", { ...BALL_IDLE, jump: true }]]));
    return s.state.cars[0].height;
  });
  assert.ok(Math.max(...heights) - Math.min(...heights) < 0.01);
  const s = new BoostballSimulation(roster);
  s.state.countdown = 0;
  const a = s.state.cars[0],
    b = s.state.cars[1];
  a.x = b.x = 480;
  a.y = b.y = 270;
  a.height = 70;
  a.vz = 0;
  s.state.ball.x = 800;
  run(s, 0.01);
  assert.equal(a.x, b.x);
  assert.equal(a.y, b.y);
});
