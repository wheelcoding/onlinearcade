import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRACKS,
  sampleTrack,
  trackLength,
  projectToTrack,
  trackPose,
  advanceCheckpoint,
  CHECKPOINTS,
  steerHeading,
  stepBoost,
  saveRaceResult,
  parseRaceRecords,
} from "./racing";
test("every course has a closed, finite, evenly sampled road and consistent projections", () => {
  for (const track of TRACKS) {
    const samples = sampleTrack(track);
    assert.equal(samples.length, 360);
    assert.ok(trackLength(samples) > 350);
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i],
        q = samples[(i + 1) % samples.length];
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < 4);
      const found = projectToTrack(samples, p.x, p.z);
      assert.ok(found.distance < 0.0001);
      assert.ok(Math.abs(found.y - p.y) < 0.001);
    }
    const pose = trackPose(samples, 0.23),
      off = projectToTrack(samples, pose.x - pose.tz * 3, pose.z + pose.tx * 3);
    assert.ok(Math.abs(off.distance - 3) < 0.15);
  }
});
test("lap credit needs every gate in order and ignores reverse, skipped and offroad gates", () => {
  let state = { lastGate: 0, laps: 0 };
  assert.deepEqual(advanceCheckpoint(0, 0, 0.5, true), state);
  assert.deepEqual(
    advanceCheckpoint(0, 0, 1 / CHECKPOINTS + 0.001, false),
    state,
  );
  for (let lap = 0; lap < 3; lap++)
    for (let gate = 1; gate <= CHECKPOINTS; gate++)
      state = advanceCheckpoint(
        state.lastGate,
        state.laps,
        ((gate % CHECKPOINTS) + 0.1) / CHECKPOINTS,
        true,
      );
  assert.equal(state.laps, 3);
  assert.deepEqual(advanceCheckpoint(0, 3, 0.99, true), state);
});
test("D steers screen right and A screen left from different follow-camera headings", () => {
  for (const heading of [0, 0.7, Math.PI, 4.8]) {
    const before = { x: Math.sin(heading), z: Math.cos(heading) },
      right = { x: -Math.cos(heading), z: Math.sin(heading) };
    for (const input of [-1, 1]) {
      const next = steerHeading(heading, input, 20, 0.02),
        side =
          (Math.sin(next) - before.x) * right.x +
          (Math.cos(next) - before.z) * right.z;
      assert.ok(side * input > 0);
    }
  }
});
test("race records separate tracks, reject invalid times and preserve personal bests", () => {
  const result = {
    trackId: "sunset-bay" as const,
    rulesVersion: 2 as const,
    durationMs: 90000,
    bestLapMs: 29000,
    score: 9000,
  };
  let r = saveRaceResult({}, result);
  r = saveRaceResult(r, {
    ...result,
    trackId: "alpine-pass",
    durationMs: 120000,
  });
  r = saveRaceResult(r, { ...result, durationMs: 100000, bestLapMs: 28000 });
  assert.equal(r["sunset-bay"]?.bestTimeMs, 90000);
  assert.equal(r["sunset-bay"]?.bestLapMs, 28000);
  assert.equal(r["alpine-pass"]?.races, 1);
  assert.deepEqual(parseRaceRecords(r), r);
  assert.deepEqual(parseRaceRecords({ "sunset-bay": { bestTimeMs: -1 } }), {});
  assert.throws(() => saveRaceResult(r, { ...result, durationMs: NaN }));
});
test("road bends leave room for the inside guardrail and distant route sections do not overlap", () => {
  for (const track of TRACKS) {
    const p = sampleTrack(track),
      length = trackLength(p);
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        ux = b.x - a.x,
        uz = b.z - a.z,
        vx = c.x - b.x,
        vz = c.z - b.z,
        angle = Math.acos(
          Math.max(
            -1,
            Math.min(
              1,
              (ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz)),
            ),
          ),
        );
      assert.ok(
        Math.hypot(ux, uz) / Math.max(angle, 0.00001) > track.width / 2 + 2,
        track.name + " pinched curb",
      );
      for (let j = i + 1; j < p.length; j++) {
        const gap = (Math.min(j - i, p.length - j + i) / p.length) * length;
        if (gap > 45)
          assert.ok(
            Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z) > track.width + 5,
            track.name + " overlapping road",
          );
      }
    }
  }
});
test("driving each complete course through projected points yields exactly three laps", () => {
  for (const track of TRACKS) {
    const samples = sampleTrack(track);
    let state = { lastGate: 0, laps: 0 };
    for (let i = 1; i <= samples.length * 3; i++) {
      const pose = trackPose(samples, i / samples.length + 0.00001),
        road = projectToTrack(samples, pose.x, pose.z);
      state = advanceCheckpoint(
        state.lastGate,
        state.laps,
        road.progress,
        road.distance < track.width / 2,
      );
    }
    assert.equal(state.laps, 3, track.name);
  }
});

test("boost must be released to recharge and never produces negative energy", () => {
  assert.deepEqual(stepBoost(0, true, true, 0.1), { active: false, energy: 0 });
  assert.deepEqual(stepBoost(0, false, true, 1), { active: false, energy: 12 });
  assert.deepEqual(stepBoost(1, true, true, 1), { active: true, energy: 0 });
  assert.deepEqual(stepBoost(90, false, true, 2), {
    active: false,
    energy: 100,
  });
  assert.deepEqual(stepBoost(10, true, false, 1), {
    active: false,
    energy: 10,
  });
});
