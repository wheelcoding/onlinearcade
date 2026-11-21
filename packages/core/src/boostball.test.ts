import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BoostballSimulation,
  BALL_IDLE,
  getBoostballArena,
  boostballBot,
  type BallInput,
} from "./boostball";
const roster = [
  { id: "a", name: "Alex" },
  { id: "b", name: "Sam" },
];
const expanded = getBoostballArena("expanded");
const { length, centerX, centerY, goalHalfWidth } = expanded;
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
  assert.equal(s.state.cars[0].x, centerX - expanded.kickoffOffset);
  assert.equal(s.state.time, 180);
  assert.deepEqual(
    s.state.cars.map((c) => c.team),
    [0, 1],
  );
  s.state.countdown = 0;
  s.state.ball = { x: length - 60, y: centerY, vx: 400, vy: 0 };
  run(s, 0.2);
  assert.deepEqual(s.state.score, [1, 0]);
  assert.equal(s.state.ball.x, centerX);
  assert.ok(s.state.countdown > 0);
  assert.equal(s.state.cars[0].fuel, 100);
  s.state.countdown = 0;
  s.state.ball = { x: 60, y: centerY, vx: -400, vy: 0 };
  run(s, 0.2);
  assert.deepEqual(s.state.score, [1, 1]);
  s.state.countdown = 0;
  s.state.score[0]++;
  s.state.time = 0.02;
  run(s, 0.1);
  assert.equal(s.state.complete, true);
  const tick = s.state.tick;
  run(s, 1);
  assert.equal(s.state.tick, tick);
});

test("expanded Boostball has more playable field and an original-map fallback", () => {
  const s = new BoostballSimulation(roster);
  const classic = getBoostballArena();
  assert.equal(s.state.arena, "expanded");
  assert.ok(
    expanded.carBounds.right - expanded.carBounds.left >
      (classic.carBounds.right - classic.carBounds.left) * 1.3,
  );
  assert.ok(
    expanded.carBounds.bottom - expanded.carBounds.top >
      (classic.carBounds.bottom - classic.carBounds.top) * 1.3,
  );
  assert.equal(s.state.pads?.length, 10);
  s.state.countdown = 0;
  const car = s.state.cars[0];
  Object.assign(car, { x: 1020, y: 590, vx: 180 });
  run(s, 0.35, new Map([["a", drive]]));
  assert.ok(car.x > 1020);
  assert.equal(car.y, 590);
  const vintage = new BoostballSimulation(roster, false, "classic");
  assert.equal(vintage.state.cars[0].x, 220);
  assert.equal(vintage.state.ball.x, 480);
  assert.equal(vintage.state.pads?.length, 6);
});

test("a tie restarts at midfield in sudden death and the next goal wins", () => {
  const s = new BoostballSimulation(roster);
  s.state.countdown = 0;
  s.state.time = 0.01;
  run(s, 0.02);
  assert.equal(s.state.overtime, true);
  assert.equal(s.state.complete, false);
  assert.equal(s.state.ball.x, centerX);
  assert.ok(s.state.countdown > 2);
  run(s, 3.1);
  assert.ok(s.state.time > 0);
  const blue = s.state.cars[0];
  Object.assign(blue, { x: length - 110, y: centerY, vx: 500 });
  s.state.ball = { x: length - 72, y: centerY, vx: 0, vy: 0 };
  run(s, 0.2, new Map([["a", drive]]));
  assert.ok(s.state.complete);
  assert.deepEqual(s.state.score, [1, 0]);
  assert.equal(s.state.lastGoal?.scorer, blue.id);
  assert.equal(blue.goals, 1);
});

test("free play starts immediately, keeps running, and resets for another shot", () => {
  const s = new BoostballSimulation(roster.slice(0, 1), true);
  assert.equal(s.state.countdown, 0);
  s.state.time = 0.01;
  s.state.ball = { x: length - 60, y: centerY, vx: 400, vy: 0 };
  run(s, 0.2);
  assert.equal(s.state.time, 0.01);
  assert.equal(s.state.complete, false);
  assert.equal(s.state.overtime, undefined);
  assert.deepEqual(s.state.score, [1, 0]);
  assert.equal(s.state.ball.x, centerX);
  assert.ok(s.state.countdown < 1.2);
});

test("boost pads recharge, grant fuel once, and require a grounded car", () => {
  const s = new BoostballSimulation(roster);
  s.state.countdown = 0;
  const car = s.state.cars[0];
  Object.assign(car, expanded.pads.at(-1), { fuel: 20, height: 50 });
  run(s, 0.1);
  assert.equal(s.state.pads?.at(-1), 0);
  assert.ok(car.fuel < 24);
  car.height = car.vz = 0;
  run(s, 1 / 120);
  assert.equal(s.state.pads?.at(-1), 5);
  assert.ok(car.fuel > 55);
  run(s, 0.5);
  assert.ok(car.fuel < 65);
  assert.ok(s.state.pads!.at(-1)! < 5);
  car.fuel = 0;
  run(s, 4.6);
  assert.ok(car.fuel > 85);
});

test("powersliding turns more sharply and a held dodge gives only one directional burst", () => {
  const normal = new BoostballSimulation(roster);
  const slide = new BoostballSimulation(roster);
  for (const s of [normal, slide]) {
    s.state.countdown = 0;
    s.state.cars[0].vx = 270;
    run(s, 0.24, new Map([["a", { ...drive, steer: 1, drift: s === slide }]]));
  }
  assert.ok(slide.state.cars[0].angle > normal.state.cars[0].angle + 0.22);
  assert.ok(slide.state.cars[0].drifting);
  const dodge = new BoostballSimulation(roster);
  dodge.state.countdown = 0;
  const controls = new Map([["a", { ...BALL_IDLE, steer: -1, dodge: true }]]);
  run(dodge, 1 / 120, controls);
  const car = dodge.state.cars[0];
  assert.ok(car.vy < -175);
  assert.equal(car.dodgeSide, -1);
  run(dodge, 1.6, controls);
  assert.equal(car.cooldown, 0);
  run(dodge, 1 / 120);
  run(dodge, 1 / 120, controls);
  assert.ok(car.cooldown > 1);
});

test("a shot clipping the outside of a post bounces instead of scoring", () => {
  const s = new BoostballSimulation(roster);
  s.state.countdown = 0;
  s.state.ball = {
    x: length - 60,
    y: centerY + goalHalfWidth - 9,
    vx: 420,
    vy: 0,
  };
  run(s, 0.2);
  assert.equal(s.state.score[0], 0);
  assert.ok(s.state.ball.vx < 0);
});
test("walls outside goal mouths bounce; car contact transfers momentum to ball", () => {
  const s = new BoostballSimulation(roster);
  s.state.countdown = 0;
  s.state.ball = { x: length - 60, y: 120, vx: 400, vy: 0 };
  run(s, 0.2);
  assert.equal(s.state.score[0], 0);
  assert.ok(s.state.ball.vx < 0);
  const c = s.state.cars[0];
  c.x = centerX - 50;
  c.y = centerY;
  c.vx = 250;
  c.angle = 0;
  s.state.ball = { x: centerX - 10, y: centerY, vx: 0, vy: 0 };
  run(s, 0.2, new Map([["a", drive]]));
  assert.ok(s.state.ball.vx > 200);
  assert.ok(s.state.ball.x > centerX);
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
  assert.ok(c.y > centerY);
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
  s.state.ball = {
    x: length - 60,
    y: centerY,
    vx: 400,
    vy: 0,
    height: 110,
    vz: 0,
  };
  run(s, 0.12);
  assert.deepEqual(s.state.score, [0, 0]);
  assert.ok(s.state.ball.vx < 0);
  s.state.ball = {
    x: length - 60,
    y: centerY,
    vx: 400,
    vy: 0,
    height: 30,
    vz: 0,
  };
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
  a.x = b.x = centerX;
  a.y = b.y = centerY;
  a.height = 70;
  a.vz = 0;
  s.state.ball.x = 800;
  run(s, 0.01);
  assert.equal(a.x, b.x);
  assert.equal(a.y, b.y);
});

test("practice AI picks a shooting lane and can chip past a parked central defender", () => {
  const s = new BoostballSimulation(roster);
  for (let i = 0; i < 120 * 60 && s.state.score[1] === 0; i++)
    s.advance(1 / 120, new Map([["b", boostballBot(s.state, "b")]]));
  assert.ok(s.state.score[1] > 0);
  assert.equal(s.state.score[0], 0);
});
