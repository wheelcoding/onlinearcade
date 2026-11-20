import { test } from "node:test";
import assert from "node:assert/strict";
import { OnlinePlanet } from "./online-planet.js";
const roster = [
  { memberId: "a", name: "Alex", color: "#f4a05f" },
  { memberId: "b", name: "Sam", color: "#91cdbb" },
];
const cmd = { sessionId: "p", seq: 1, input: { x: 1, y: 0 } };
test("planet validates membership, sequences and bounded finite controls; stale and disconnected controls become idle", () => {
  const game = new OnlinePlanet("p", roster, 4);
  game.sim.state.countdown = 0;
  for (const raw of [
    null,
    {},
    { ...cmd, sessionId: "wrong" },
    { ...cmd, seq: Infinity },
    { ...cmd, input: { x: NaN, y: 0 } },
    { ...cmd, input: { x: 2, y: 0 } },
  ])
    assert.equal(game.command("a", raw, 10000), false);
  assert.equal(game.command("outside", cmd, 10000), false);
  assert.equal(
    game.command("a", { ...cmd, score: 99999, x: 99999 }, 10000),
    true,
  );
  assert.equal(game.command("a", cmd, 10000), false);
  game.advance(0.1, new Set(["a", "b"]), 10100);
  const x = game.sim.state.players[0].x;
  assert.ok(x > 210);
  assert.equal(game.sim.state.players[0].score, 0);
  game.advance(0.1, new Set(["a"]), 10400);
  assert.equal(game.sim.state.players[0].x, x);
  assert.equal(game.command("a", { ...cmd, seq: 2 }, 10500), true);
  game.advance(0.1, new Set(["b"]), 10501);
  assert.equal(game.sim.state.players[0].x, x);
  game.exit("a");
  assert.equal(game.command("a", { ...cmd, seq: 3 }, 10502), false);
});
