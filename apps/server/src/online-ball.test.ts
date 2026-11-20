import { test } from "node:test";
import assert from "node:assert/strict";
import { OnlineBall } from "./online-ball.js";
const roster = [
  { memberId: "a", name: "Alex", color: "#fff" },
  { memberId: "b", name: "Sam", color: "#fff" },
];
const cmd = {
  sessionId: "match",
  seq: 1,
  input: { throttle: 1, steer: 0, boost: true, dodge: false },
};
test("ball controls reject spoofed ownership, invalid sessions, nonfinite values and replayed sequences", () => {
  const game = new OnlineBall("match", roster);
  game.sim.state.countdown = 0;
  for (const raw of [
    null,
    {},
    { ...cmd, sessionId: "other" },
    { ...cmd, seq: NaN },
    { ...cmd, input: { ...cmd.input, throttle: 2 } },
    { ...cmd, input: { ...cmd.input, steer: Infinity } },
    { ...cmd, input: { ...cmd.input, boost: "true" } },
    { ...cmd, input: { ...cmd.input, jump: "true" } },
  ])
    assert.equal(game.command("a", raw, 1000), false);
  assert.equal(game.command("outsider", cmd, 1000), false);
  assert.equal(
    game.command("a", { ...cmd, score: [999, 0], x: 10000 }, 1000),
    true,
  );
  assert.equal(game.command("a", cmd, 1001), false);
  game.advance(0.1, new Set(["a", "b"]), 1100);
  assert.ok(game.sim.state.cars[0].x > 220);
  assert.deepEqual(game.sim.state.score, [0, 0]);
  const fuel = game.sim.state.cars[0].fuel;
  game.advance(0.1, new Set(["a", "b"]), 1500);
  assert.ok(game.sim.state.cars[0].fuel > fuel);
  assert.equal(game.command("a", { ...cmd, seq: 2 }, 1600), true);
  const fuel2 = game.sim.state.cars[0].fuel;
  game.advance(0.1, new Set(["b"]), 1601);
  assert.ok(game.sim.state.cars[0].fuel > fuel2);
  game.exit("a");
  assert.equal(game.command("a", { ...cmd, seq: 3 }, 1700), false);
});

test("server owns jump height and rejects client-supplied altitude", () => {
  const game = new OnlineBall("match", roster);
  game.sim.state.countdown = 0;
  assert.equal(
    game.command(
      "a",
      { ...cmd, height: 99999, input: { ...cmd.input, jump: true } },
      1000,
    ),
    true,
  );
  game.advance(0.1, new Set(["a", "b"]), 1050);
  assert.ok(
    game.sim.state.cars[0].height > 0 && game.sim.state.cars[0].height < 30,
  );
  game.advance(0.1, new Set(["a", "b"]), 1500);
  assert.equal(game.inputs.get("a")?.input.jump, true);
  assert.ok(Number.isFinite(game.sim.state.cars[0].height));
});
