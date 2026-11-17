export const TRACK_IDS = [
  "sunset-bay",
  "alpine-pass",
  "ember-canyon",
  "midnight-harbor",
] as const;
export type TrackId = (typeof TRACK_IDS)[number];
export type Point3 = { x: number; y: number; z: number };
export type TrackDefinition = {
  id: TrackId;
  name: string;
  subtitle: string;
  difficulty: string;
  biome: "coast" | "alpine" | "canyon" | "city";
  width: number;
  targetSeconds: number;
  points: readonly (readonly [number, number, number])[];
};
export const RACING_RULES_VERSION = 2;
export const TRACKS: readonly TrackDefinition[] = [
  {
    id: "sunset-bay",
    name: "Sunset Bay",
    subtitle: "Ocean air. Sweeping corners. Golden-hour racing.",
    difficulty: "ROOKIE",
    biome: "coast",
    width: 17,
    targetSeconds: 65,
    points: [
      [70, 0, 0],
      [62, 0, 45],
      [20, 0.5, 65],
      [-35, 1, 48],
      [-72, 3, 12],
      [-60, 3, -30],
      [-20, 1, -57],
      [28, 0.5, -48],
      [72, 0, -25],
    ],
  },
  {
    id: "alpine-pass",
    name: "Alpine Pass",
    subtitle: "Climb the ridge. Thread the viaduct. Brake for the hairpin.",
    difficulty: "TECHNICAL",
    biome: "alpine",
    width: 15,
    targetSeconds: 90,
    points: [
      [85, 1, 0],
      [65, 5, 50],
      [15, 13, 75],
      [-38, 19, 65],
      [-75, 15, 28],
      [-45, 8, 4],
      [-80, 6, -35],
      [-38, 3, -72],
      [18, 2, -55],
      [65, 1, -45],
    ],
  },
  {
    id: "ember-canyon",
    name: "Ember Canyon",
    subtitle: "Red-rock mesas, dusty straights and a twisting canyon climb.",
    difficulty: "EXPERT",
    biome: "canyon",
    width: 15,
    targetSeconds: 100,
    points: [
      [95, 1, 0],
      [75, 1, 50],
      [32, 3, 65],
      [0, 7, 30],
      [-38, 11, 60],
      [-85, 8, 35],
      [-90, 4, -18],
      [-48, 1, -65],
      [0, 2, -42],
      [45, 5, -75],
      [88, 2, -45],
    ],
  },
  {
    id: "midnight-harbor",
    name: "Midnight Harbor",
    subtitle: "Neon-lit docks. Elevated bends. A city that never brakes.",
    difficulty: "ADVANCED",
    biome: "city",
    width: 16,
    targetSeconds: 95,
    points: [
      [82, 2, 0],
      [78, 2, 58],
      [30, 2, 83],
      [-28, 3, 70],
      [-60, 6, 34],
      [-36, 8, 0],
      [-76, 6, -40],
      [-48, 3, -80],
      [10, 2, -70],
      [55, 2, -38],
      [82, 2, -40],
    ],
  },
];
export const getTrack = (id: TrackId) => TRACKS.find((t) => t.id === id)!;
export function sampleTrack(track: TrackDefinition, count = 360): Point3[] {
  const dense: Point3[] = [];
  const p = track.points,
    n = p.length;
  // Periodic cubic B-spline: C2-continuous bends avoid pinched inner curbs.
  const cubic = (a: number, b: number, c: number, d: number, t: number) =>
    ((1 - t) ** 3 * a +
      (3 * t ** 3 - 6 * t * t + 4) * b +
      (-3 * t ** 3 + 3 * t * t + 3 * t + 1) * c +
      t ** 3 * d) /
    6;
  for (let i = 0; i < n * 60; i++) {
    const k = Math.floor(i / 60),
      t = (i % 60) / 60;
    const a = p[(k + n - 1) % n],
      b = p[k],
      c = p[(k + 1) % n],
      d = p[(k + 2) % n];
    dense.push({
      x: cubic(a[0], b[0], c[0], d[0], t),
      y: cubic(a[1], b[1], c[1], d[1], t),
      z: cubic(a[2], b[2], c[2], d[2], t),
    });
  }
  dense.push({ ...dense[0] });
  const lengths = [0];
  for (let i = 1; i < dense.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          dense[i].x - dense[i - 1].x,
          dense[i].y - dense[i - 1].y,
          dense[i].z - dense[i - 1].z,
        ),
    );
  const total = lengths[lengths.length - 1];
  let segment = 0;
  return Array.from({ length: count }, (_, i) => {
    const distance = (i / count) * total;
    while (segment < dense.length - 2 && lengths[segment + 1] < distance)
      segment++;
    const t =
      (distance - lengths[segment]) / (lengths[segment + 1] - lengths[segment]);
    const a = dense[segment],
      b = dense[segment + 1];
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  });
}
export function trackLength(samples: readonly Point3[]) {
  return samples.reduce((length, p, i) => {
    const q = samples[(i + 1) % samples.length];
    return length + Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
  }, 0);
}
export function trackPose(samples: readonly Point3[], progress: number) {
  const f = (((progress % 1) + 1) % 1) * samples.length,
    i = Math.floor(f),
    a = samples[i],
    b = samples[(i + 1) % samples.length],
    t = f - i,
    dx = b.x - a.x,
    dz = b.z - a.z,
    length = Math.hypot(dx, dz);
  return {
    x: a.x + dx * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + dz * t,
    tx: dx / length,
    tz: dz / length,
    slope: (b.y - a.y) / length,
  };
}
export function projectToTrack(
  samples: readonly Point3[],
  x: number,
  z: number,
) {
  let distanceSq = Infinity,
    progress = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i],
      b = samples[(i + 1) % samples.length],
      dx = b.x - a.x,
      dz = b.z - a.z,
      t = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
      ),
      d = (x - a.x - dx * t) ** 2 + (z - a.z - dz * t) ** 2;
    if (d < distanceSq) {
      distanceSq = d;
      progress = (i + t) / samples.length;
    }
  }
  const pose = trackPose(samples, progress);
  return {
    ...pose,
    progress: progress % 1,
    distance: Math.sqrt(distanceSq),
    lateral: (x - pose.x) * -pose.tz + (z - pose.z) * pose.tx,
  };
}
export const CHECKPOINTS = 24;
export function advanceCheckpoint(
  lastGate: number,
  laps: number,
  progress: number,
  onRoad: boolean,
  movingForward = true,
) {
  const gate = Math.floor((((progress % 1) + 1) % 1) * CHECKPOINTS);
  if (onRoad && movingForward && gate === (lastGate + 1) % CHECKPOINTS)
    return { lastGate: gate, laps: laps + (gate === 0 ? 1 : 0) };
  return { lastGate, laps };
}
export function steerHeading(
  heading: number,
  input: number,
  speed: number,
  dt: number,
) {
  return (
    heading -
    input * 1.55 * dt * Math.min(1, Math.abs(speed) / 8) * Math.sign(speed || 1)
  );
}
export type RaceResult = {
  trackId: TrackId;
  rulesVersion: 2;
  durationMs: number;
  bestLapMs: number;
  score: number;
};
export type TrackRecord = {
  bestTimeMs: number;
  bestLapMs: number;
  races: number;
};
export type RaceRecords = Partial<Record<TrackId, TrackRecord>>;
export function parseRaceRecords(raw: unknown): RaceRecords {
  const out: RaceRecords = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of TRACK_IDS) {
    const r = (raw as Record<string, unknown>)[id];
    if (
      r &&
      typeof r === "object" &&
      "bestTimeMs" in r &&
      "bestLapMs" in r &&
      "races" in r &&
      [r.bestTimeMs, r.bestLapMs, r.races].every(
        (n) => typeof n === "number" && Number.isSafeInteger(n) && n > 0,
      ) &&
      Number(r.bestLapMs) <= Number(r.bestTimeMs)
    )
      out[id] = r as TrackRecord;
  }
  return out;
}
export function saveRaceResult(
  records: RaceRecords,
  result: RaceResult,
): RaceRecords {
  if (
    !TRACK_IDS.includes(result.trackId) ||
    result.rulesVersion !== 2 ||
    ![result.durationMs, result.bestLapMs, result.score].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) ||
    result.bestLapMs > result.durationMs
  )
    throw new Error("Invalid race result");
  const prev = records[result.trackId];
  return {
    ...records,
    [result.trackId]: {
      bestTimeMs: Math.min(prev?.bestTimeMs || Infinity, result.durationMs),
      bestLapMs: Math.min(prev?.bestLapMs || Infinity, result.bestLapMs),
      races: (prev?.races || 0) + 1,
    },
  };
}
export function stepBoost(
  energy: number,
  pressed: boolean,
  canBoost: boolean,
  dt: number,
) {
  const active = pressed && canBoost && energy > 0;
  return {
    active,
    energy: Math.max(
      0,
      Math.min(100, energy + (active ? -32 : pressed ? 0 : 12) * dt),
    ),
  };
}
