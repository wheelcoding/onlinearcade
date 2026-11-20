import { test } from "node:test";
import assert from "node:assert/strict";
import { CloudSimulation, CLOUD_PLATFORMS, cloudIdle } from "./cloudbound";
const advance = (s: CloudSimulation, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 120); i++)
    s.advance(1 / 120, cloudIdle());
};
test("Cloudbound fixed-step movement agrees at 30, 60 and 144 Hz; D moves screen-right", () => {
  const states = [30, 60, 144].map((fps) => {
    const s = new CloudSimulation();
    for (let i = 0; i < fps / 2; i++)
      s.advance(1 / fps, { x: 1, forward: 0, jump: true, dash: false });
    return s;
  });
  assert.ok(states[0].x < 0);
  assert.ok(states[0].y > 0);
  for (const s of states.slice(1)) {
    assert.ok(Math.abs(s.x - states[0].x) < 1e-8);
    assert.ok(Math.abs(s.y - states[0].y) < 1e-8);
  }
});
test("queued taps preserve double jumps, held jump cannot repeat, pause clears gestures and dash must recharge", () => {
  const s = new CloudSimulation();
  s.queueJump();
  s.queueJump();
  s.advance(1 / 60, cloudIdle());
  assert.equal(s.jumps, 2);
  const vy = s.vy;
  s.advance(1 / 120, { ...cloudIdle(), jump: true });
  assert.ok(s.vy < vy);
  assert.equal(s.jumps, 2);
  const cleared = new CloudSimulation();
  cleared.queueJump();
  cleared.clearInput();
  cleared.advance(1 / 60, cloudIdle());
  assert.equal(cleared.y, 0);
  const dash = new CloudSimulation();
  dash.queueDash();
  dash.advance(1 / 60, cloudIdle());
  assert.ok(dash.vz > 10);
  const cooldown = dash.dashCooldown;
  dash.queueDash();
  dash.advance(1 / 60, cloudIdle());
  assert.ok(dash.dashCooldown < cooldown);
});
test("swept feet land on raised islands and solid undersides block upward tunneling", () => {
  const p = CLOUD_PLATFORMS[1],
    s = new CloudSimulation();
  Object.assign(s, {
    x: p.x,
    z: p.z,
    y: p.y + 4,
    vy: -25,
    standing: null,
    jumps: 2,
  });
  advance(s, 0.2);
  assert.equal(s.standing, 1);
  assert.equal(s.y, p.y);
  assert.equal(s.vy, 0);
  const below = new CloudSimulation();
  Object.assign(below, {
    x: p.x,
    z: p.z,
    y: p.y - 3,
    vy: 12,
    standing: null,
    jumps: 2,
  });
  advance(below, 0.15);
  assert.ok(below.y + 1.65 <= p.y - 0.8 + 0.001);
  assert.equal(below.standing, null);
});
test("moving islands carry the player; crumbling islands collapse and recover", () => {
  const moving = CLOUD_PLATFORMS[4],
    s = new CloudSimulation(),
    pose = s.pose(moving);
  Object.assign(s, { x: pose.x, y: pose.y, z: pose.z, standing: 4 });
  advance(s, 0.5);
  assert.ok(Math.abs(s.x - s.pose(moving).x) < 1e-6);
  assert.equal(s.standing, 4);
  const p = CLOUD_PLATFORMS[3],
    c = new CloudSimulation();
  Object.assign(c, { x: p.x, y: p.y + 1, z: p.z, standing: null, vy: -1 });
  advance(c, 0.4);
  assert.equal(c.standing, 3);
  advance(c, 1.4);
  assert.equal(c.visible(p), false);
  Object.assign(c, { x: 0, y: 0, z: 0, standing: 0, vy: 0 });
  advance(c, 3.1);
  assert.equal(c.visible(p), true);
});
test("every island and crystal is reachable through continuous controls, with checkpoints and a final result", () => {
  const s = new CloudSimulation(),
    visited = new Set<number>([0]);
  let next = 1,
    air = 0,
    jumped = false;
  for (let i = 0; i < 12000 && !s.finished; i++) {
    const target = s.pose(CLOUD_PLATFORMS[next]),
      dx = target.x - s.x,
      dz = target.z - s.z,
      length = Math.hypot(dx, dz),
      input = cloudIdle();
    input.x = -dx / Math.max(1, length);
    input.forward = dz / Math.max(1, length);
    if (s.standing !== null) {
      visited.add(s.standing);
      air = 0;
      if (s.standing === next) {
        next = Math.min(30, next + 1);
        jumped = false;
      } else if (!jumped) {
        input.jump = true;
        jumped = true;
      }
    } else {
      air++;
      if (air === 25) input.jump = true;
      if (air === 35 && length > 4) input.dash = true;
    }
    s.advance(1 / 60, input);
  }
  visited.add(s.standing!);
  assert.equal(s.finished, true);
  assert.equal(visited.size, 31);
  assert.equal(s.falls, 0);
  assert.equal(s.crystals.size, 31);
  assert.equal(s.checkpoint, 20);
  assert.equal(s.result?.medal, 3);
  const result = JSON.stringify(s.result);
  s.respawn();
  advance(s, 1);
  assert.equal(JSON.stringify(s.result), result);
});
test("checkpoint recovery adds one fall, preserves crystals and clears movement without rewinding the clock", () => {
  const s = new CloudSimulation(),
    p = CLOUD_PLATFORMS[10];
  Object.assign(s, { x: p.x, z: p.z, y: p.y + 1, vy: -1, standing: null });
  advance(s, 0.4);
  assert.equal(s.checkpoint, 10);
  const gems = s.crystals.size,
    t = s.time;
  s.vx = 7;
  s.respawn();
  assert.equal(s.falls, 1);
  assert.equal(s.time, t);
  assert.equal(s.y, p.y);
  assert.equal(s.vx, 0);
  assert.equal(s.crystals.size, gems);
});
