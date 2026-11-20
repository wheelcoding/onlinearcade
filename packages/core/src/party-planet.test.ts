import { test } from "node:test";
import assert from "node:assert/strict";
import { PlanetSimulation, planetTile } from "./party-planet";
const roster = [
  { id: "a", name: "Alex", color: "#f4a05f" },
  { id: "b", name: "Sam", color: "#91cdbb" },
];
const run = (s: PlanetSimulation, seconds: number, inputs = new Map()) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) s.advance(1 / 60, inputs);
};
test("party movement is normalized, bounded and independent of rendered frame rate", () => {
  const positions = [30, 60, 144].map((fps) => {
    const s = new PlanetSimulation(roster, 7);
    s.state.countdown = 0;
    for (let i = 0; i < fps; i++)
      s.advance(1 / fps, new Map([["a", { x: 1, y: 1 }]]));
    return s.state.players[0];
  });
  assert.ok(Math.abs(positions[0].x - positions[2].x) < 0.01);
  assert.ok(
    Math.abs(Math.hypot(positions[1].x - 210, positions[1].y - 200) - 220) <
      0.01,
  );
  const s = new PlanetSimulation(roster);
  s.state.countdown = 0;
  run(s, 2, new Map([["a", { x: 999, y: NaN }]]));
  assert.ok(s.state.players[0].x <= 884);
  assert.ok(Number.isFinite(s.state.players[0].y));
});
test("a star can be claimed once, while warning meteors cannot hit and shields prevent repeated damage", () => {
  const s = new PlanetSimulation(roster);
  s.state.countdown = 0;
  s.state.objects.push({ id: 999, x: 210, y: 200, age: 0, vx: 0, vy: 0 });
  s.state.players[1].x = 210;
  s.state.players[1].y = 200;
  s.advance(1 / 60, new Map());
  assert.equal(
    s.state.players.reduce((n, p) => n + p.score, 0),
    10,
  );
  s.advance(1 / 60, new Map());
  assert.equal(
    s.state.players.reduce((n, p) => n + p.score, 0),
    10,
  );
  s.state.round = 1;
  s.state.time = 0;
  s.state.objects = [{ id: 50, x: 210, y: 200, age: 0, vx: 0, vy: 0 }];
  s.state.players.forEach((p) => (p.score = 10));
  run(s, 0.5);
  assert.equal(s.state.players[0].score, 10);
  run(s, 0.5);
  assert.equal(s.state.players[0].score, 7);
  run(s, 0.1);
  assert.equal(s.state.players[0].score, 7);
});
test("numbered color tiles match scoring and the game runs all three rounds to a stable result", () => {
  const s = new PlanetSimulation(roster, 8);
  const visited = new Set<number>();
  for (let i = 0; i < 4400; i++) {
    visited.add(s.state.round);
    s.advance(1 / 60, new Map());
  }
  assert.deepEqual([...visited], [0, 1, 2]);
  assert.equal(s.state.complete, true);
  const result = JSON.stringify(s.state);
  run(s, 1);
  assert.equal(JSON.stringify(s.state), result);
  const color = new PlanetSimulation(roster);
  color.state.countdown = 0;
  color.state.round = 2;
  color.state.players[0].x = 60 + 105 * 2 + 30;
  color.state.players[0].y = 100;
  assert.equal(planetTile(color.state.players[0].x, 100), 2);
  run(color, 4);
  assert.equal(color.state.players[0].score, 5);
});
test("practice has one real player; withdrawing removes participation without introducing bots", () => {
  const s = new PlanetSimulation([roster[0]]);
  assert.equal(s.state.players.length, 1);
  s.exit("a");
  run(s, 0.1);
  assert.equal(s.state.complete, true);
  assert.equal(s.state.players[0].active, false);
});
