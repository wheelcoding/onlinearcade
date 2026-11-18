import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RaceSimulation,
  idleInput,
  FIXED_STEP,
  ghostPose,
  ghostDelta,
  TRACKS,
  trackPose,
} from "./index";
const ready = () => {
  const s = new RaceSimulation("sunset-bay", "time-trial");
  s.countdown = 0;
  return s;
};
test("real handling: A turns screen left and D turns screen right with momentum", () => {
  for (const steer of [-1, 1]) {
    const s = ready(),
      p = s.player,
      h = p.heading;
    p.vx = Math.sin(h) * 15;
    p.vz = Math.cos(h) * 15;
    p.speed = 15;
    s.step({ ...idleInput(), steer, throttle: 1 });
    const side =
      (Math.sin(p.heading) - Math.sin(h)) * -Math.cos(h) +
      (Math.cos(p.heading) - Math.cos(h)) * Math.sin(h);
    assert.ok(side * steer > 0);
    assert.ok(Math.hypot(p.vx, p.vz) > 14);
  }
});
test("fixed-step simulation agrees at 30, 60 and 144 rendered frames per second", () => {
  const states = [30, 60, 144].map((fps) => {
    const s = ready();
    for (let i = 0; i < fps * 3; i++)
      s.advance(1 / fps, { ...idleInput(), throttle: 1 });
    return s;
  });
  for (const s of states) {
    assert.equal(s.tick, 180);
    assert.ok(Math.abs(s.player.x - states[0].player.x) < 1e-8);
    assert.ok(Math.abs(s.player.z - states[0].player.z) < 1e-8);
  }
});
test("braking requires a deliberate hold before reverse and empty boost does not recharge held", () => {
  const s = ready(),
    p = s.player,
    h = p.heading;
  p.vx = Math.sin(h) * 5;
  p.vz = Math.cos(h) * 5;
  for (let i = 0; i < 12; i++) s.step({ ...idleInput(), brake: 1 });
  assert.ok(p.speed >= 0);
  for (let i = 0; i < 90; i++) s.step({ ...idleInput(), brake: 1 });
  assert.ok(p.speed < -1);
  p.energy = 0;
  s.step({ ...idleInput(), boost: true });
  assert.equal(p.energy, 0);
  s.step(idleInput());
  assert.ok(p.energy > 0);
});
test("a real sustained sliding corner earns a release turbo, collisions stay finite", () => {
  const s = ready();
  let charged = 0;
  for (let i = 0; i < 1000 && s.player.drifts < 2; i++) {
    const input = s.aiInput(s.player);
    input.drift = i % 240 < 170;
    s.step(input);
    charged = Math.max(charged, s.player.driftCharge);
  }
  assert.ok(charged > 1.1);
  assert.ok(s.player.drifts >= 2);
  assert.equal(s.player.collisions, 0);
  const p = s.player,
    pose = trackPose(s.samples, 0.1);
  p.x = pose.x - pose.tz * (s.track.width / 2 + 0.6);
  p.z = pose.z + pose.tx * (s.track.width / 2 + 0.6);
  p.vx = -pose.tz * 25;
  p.vz = pose.tx * 25;
  p.heading = Math.atan2(p.vx, p.vz);
  for (let i = 0; i < 60; i++) s.step(idleInput());
  assert.ok([p.x, p.z, p.vx, p.vz, p.speed].every(Number.isFinite));
  assert.ok(p.collisions > 0);
  assert.ok(p.collisions < 5);
});
test("four actual AI drivers complete every course through ordered gates", () => {
  for (const track of TRACKS) {
    const s = new RaceSimulation(track.id, "grand-prix", "club");
    for (let i = 0; i < 60 * 150 && !s.finished; i++)
      s.step(s.aiInput(s.player));
    assert.ok(s.finished, track.id);
    assert.equal(s.outcome?.lapTimes.length, 3);
    assert.equal(s.player.collisions, 0);
    for (const c of s.cars.slice(1)) {
      assert.ok(c.laps >= 2, `${track.id} ${c.name}`);
      assert.ok(c.raceProgress > 2.8);
      assert.equal(c.collisions, 0);
    }
    assert.equal(s.standings.length, 5);
    assert.equal(s.outcome?.result.rulesVersion, 2);
  }
});
test("AI pace is driven by genuine different speed targets, without teleporting", () => {
  const times = (["rookie", "club", "expert"] as const).map((d) => {
    const s = new RaceSimulation("sunset-bay", "grand-prix", d);
    for (let i = 0; i < 60 * 150 && !s.finished; i++)
      s.step(s.aiInput(s.player));
    assert.ok(s.finished);
    return s.time;
  });
  assert.ok(times[0] > times[1] + 5);
  assert.ok(times[1] > times[2] + 3);
});
test("recovery adds a penalty, cancels drift and cannot grant a lap or run during countdown", () => {
  const s = ready();
  s.player.lastGate = 8;
  s.player.turbo = 1;
  s.player.driftCharge = 2;
  s.recover();
  assert.equal(s.player.penalty, 2);
  assert.equal(s.player.laps, 0);
  assert.equal(s.player.turbo, 0);
  assert.equal(s.player.driftCharge, 0);
  s.recover();
  assert.equal(s.player.penalty, 2);
  const fresh = new RaceSimulation("sunset-bay");
  fresh.recover();
  assert.equal(fresh.player.penalty, 0);
  assert.equal(fresh.time, 0);
  fresh.advance(FIXED_STEP, idleInput());
  assert.equal(fresh.time, 0);
});
test("ghost interpolation wraps headings along shortest arc and compares equal progress", () => {
  const frames = [
    { t: 0, x: 0, z: 0, heading: Math.PI - 0.1, progress: 0 },
    { t: 10, x: 10, z: 20, heading: -Math.PI + 0.1, progress: 1 },
  ];
  const p = ghostPose(frames, 5)!;
  assert.equal(p.x, 5);
  assert.equal(p.z, 10);
  assert.ok(Math.abs(p.heading - Math.PI) < 1e-8);
  assert.equal(ghostDelta(frames, 0.5, 4), -1);
  assert.equal(ghostDelta(frames, 0.5, 6), 1);
  assert.equal(ghostDelta(frames, 2, 12), null);
  assert.equal(ghostPose([], 2), null);
});
