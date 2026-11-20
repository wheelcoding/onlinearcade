import { test } from "node:test";
import assert from "node:assert/strict";
import { idleInput } from "@onlinearcade/core";
import { OnlineRace } from "./online-race.js";
const roster = [
  { memberId: "a", name: "Alex", color: "#f4a05f" },
  { memberId: "b", name: "Sam", color: "#91cdbb" },
];
const cmd = (seq = 1) => ({
  sessionId: "race",
  seq,
  input: { ...idleInput(), throttle: 1 },
});
test("authoritative race validates ownership, finite bounded controls, sequences and session IDs", () => {
  const r = new OnlineRace("race", "sunset-bay", roster, 10000);
  for (const raw of [
    null,
    {},
    { ...cmd(), sessionId: "old" },
    { ...cmd(), seq: NaN },
    { ...cmd(), input: { ...idleInput(), steer: 2 } },
    { ...cmd(), input: { ...idleInput(), throttle: NaN } },
    { ...cmd(), input: { ...idleInput(), boost: 1 } },
  ])
    assert.equal(r.command("a", raw, 10000), false);
  assert.equal(r.command("outsider", cmd(), 10000), false);
  assert.equal(
    r.command(
      "a",
      { ...cmd(), x: 999999, score: 999999, memberId: "b" },
      10000,
    ),
    true,
  );
  assert.equal(r.command("a", cmd(), 10000), false);
  assert.equal(r.inputs.has(1), false);
  assert.ok(r.sim.player.x < 1000);
});
test("stale or disconnected controls stop accelerating, and each human has a separate kart", () => {
  const r = new OnlineRace("race", "sunset-bay", roster, 10000);
  r.sim.countdown = 0;
  r.command("a", cmd(), 10000);
  r.command("b", { ...cmd(), input: { ...idleInput(), steer: -1 } }, 10000);
  r.advance(0.1, new Set(["a", "b"]), 10100);
  assert.ok(r.sim.cars[0].speed > 0);
  assert.equal(r.sim.cars[1].lastInput.throttle, 0);
  assert.equal(r.sim.cars[1].lastInput.steer, -1);
  r.advance(0.1, new Set(["a", "b"]), 10400);
  assert.equal(r.sim.cars[0].lastInput.throttle, 0);
  r.command("a", cmd(2), 10500);
  r.advance(0.1, new Set(["b"]), 10501);
  assert.equal(r.sim.cars[0].lastInput.throttle, 0);
  r.exit("b");
  assert.equal(r.command("b", cmd(2), 10500), false);
  assert.ok(r.packet().withdrawn.includes(1));
});
test("first finisher does not stop the other racers; results and expiry are server owned", () => {
  const r = new OnlineRace("race", "sunset-bay", roster, 10000);
  r.sim.countdown = 0;
  r.sim.cars[0].finishedAt = 10;
  r.command("b", cmd(), 10000);
  r.advance(0.1, new Set(["a", "b"]), 10100);
  assert.equal(r.complete, false);
  assert.ok(r.sim.cars[1].speed > 0);
  r.exit("a");
  assert.equal(r.withdrawn.has(0), false);
  r.exit("b");
  r.advance(0.1, new Set(), 10200);
  assert.equal(r.complete, true);
  const expired = new OnlineRace("race", "alpine-pass", roster, 10000);
  expired.advance(0.1, new Set(), 610000);
  assert.equal(expired.complete, true);
  assert.equal(expired.packet().withdrawn.length, 2);
});
