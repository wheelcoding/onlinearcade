import {
  getTrack,
  sampleTrack,
  trackLength,
  trackPose,
  projectToTrack,
  advanceCheckpoint,
  CHECKPOINTS,
  type TrackId,
  type Point3,
  type RaceResult,
} from "./racing";
export const HANDLING_VERSION = 3;
export const FIXED_STEP = 1 / 60;
export type RaceMode = "grand-prix" | "time-trial";
export type RaceDifficulty = "rookie" | "club" | "expert";
export type RaceInput = {
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  boost: boolean;
};
export const idleInput = (): RaceInput => ({
  throttle: 0,
  brake: 0,
  steer: 0,
  drift: false,
  boost: false,
});
export type RaceEvent = {
  type:
    | "go"
    | "countdown"
    | "lap"
    | "drift-boost"
    | "pad"
    | "collision"
    | "recover"
    | "finish";
  carId: number;
  value: number;
};
export type Vehicle = {
  id: number;
  name: string;
  color: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  steer: number;
  speed: number;
  energy: number;
  boosting: boolean;
  drifting: boolean;
  driftCharge: number;
  turbo: number;
  padCooldown: number;
  wallCooldown: number;
  reverseHold: number;
  recovering: number;
  lastGate: number;
  laps: number;
  progress: number;
  raceProgress: number;
  finishedAt: number | null;
  lapStart: number;
  lapTimes: number[];
  penalty: number;
  wrongWay: number;
  drifts: number;
  collisions: number;
  recoveries: number;
  maxSpeed: number;
  lastInput: RaceInput;
};
export type TourResult = {
  result: RaceResult;
  mode: RaceMode;
  place: number;
  difficulty: RaceDifficulty;
  lapTimes: number[];
  drifts: number;
  collisions: number;
  recoveries: number;
  maxSpeed: number;
  medal: 0 | 1 | 2 | 3;
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const AI_SETTINGS = {
  rookie: { speed: 22, corner: 7.5 },
  club: { speed: 28, corner: 12 },
  expert: { speed: 33, corner: 18 },
};
export const MEDAL_TIMES: Record<TrackId, number> = {
  "sunset-bay": 48000,
  "alpine-pass": 58000,
  "ember-canyon": 65000,
  "midnight-harbor": 65000,
};
export function trialMedal(track: TrackId, time: number): 0 | 1 | 2 | 3 {
  return time <= MEDAL_TIMES[track]
    ? 3
    : time <= MEDAL_TIMES[track] * 1.15
      ? 2
      : time <= MEDAL_TIMES[track] * 1.35
        ? 1
        : 0;
}
export function cornerSpeed(
  samples: readonly Point3[],
  progress: number,
  length: number,
  limit = 15,
) {
  let curve = 0;
  for (const distance of [6, 13, 22, 32]) {
    const a = trackPose(samples, progress + distance / length),
      b = trackPose(samples, progress + (distance + 5) / length);
    curve = Math.max(
      curve,
      Math.abs(wrap(Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz))) / 5,
    );
  }
  return clamp(Math.sqrt(limit / Math.max(0.004, curve)), 10, 36);
}
export class RaceSimulation {
  readonly track;
  readonly samples: Point3[];
  readonly length: number;
  readonly cars: Vehicle[];
  readonly mode: RaceMode;
  readonly difficulty: RaceDifficulty;
  playerId = 0;
  time = 0;
  countdown = 3;
  tick = 0;
  finished = false;
  outcome: TourResult | null = null;
  events: RaceEvent[] = [];
  private accumulator = 0;
  private lastCount = 3;
  constructor(
    trackId: TrackId,
    mode: RaceMode = "grand-prix",
    difficulty: RaceDifficulty = "rookie",
    color = "#f4a05f",
    readonly humans?: readonly { name: string; color: string }[],
  ) {
    this.track = getTrack(trackId);
    this.samples = sampleTrack(this.track);
    this.length = trackLength(this.samples);
    this.mode = mode;
    this.difficulty = difficulty;
    const names = ["YOU", "NOVA", "MILO", "RHEA", "ACE"],
      colors = [color, "#91cdbb", "#bc9ce1", "#f0ce80", "#88b3d8"];
    this.cars = Array.from(
      { length: humans?.length ?? (mode === "grand-prix" ? 5 : 1) },
      (_, id) => {
        const grid =
            mode === "grand-prix"
              ? ((humans?.length ?? 5) - 1 - id) * -0.012
              : 0,
          lane = mode === "grand-prix" ? (id % 2 === 0 ? -1 : 1) * 1.7 : 0,
          p = trackPose(this.samples, grid);
        return {
          id,
          name: humans?.[id].name ?? names[id],
          color: humans?.[id].color ?? colors[id],
          x: p.x - p.tz * lane,
          z: p.z + p.tx * lane,
          vx: 0,
          vz: 0,
          heading: Math.atan2(p.tx, p.tz),
          steer: 0,
          speed: 0,
          energy: 100,
          boosting: false,
          drifting: false,
          driftCharge: 0,
          turbo: 0,
          padCooldown: 0,
          wallCooldown: 0,
          reverseHold: 0,
          recovering: 0,
          lastGate: 0,
          laps: 0,
          progress: (grid + 1) % 1,
          raceProgress: grid,
          finishedAt: null,
          lapStart: 0,
          lapTimes: [],
          penalty: 0,
          wrongWay: 0,
          drifts: 0,
          collisions: 0,
          recoveries: 0,
          maxSpeed: 0,
          lastInput: idleInput(),
        };
      },
    );
  }
  get player() {
    return this.cars[this.playerId];
  }
  get standings() {
    return [...this.cars].sort((a, b) =>
      a.finishedAt !== null && b.finishedAt !== null
        ? a.finishedAt - b.finishedAt
        : a.finishedAt !== null
          ? -1
          : b.finishedAt !== null
            ? 1
            : b.raceProgress - a.raceProgress || a.id - b.id,
    );
  }
  get position() {
    return this.standings.findIndex((c) => c.id === this.playerId) + 1;
  }
  advance(
    delta: number,
    input: RaceInput,
    humanInputs?: ReadonlyMap<number, RaceInput>,
  ) {
    this.accumulator += clamp(delta, 0, 0.25);
    let steps = 0;
    while (this.accumulator + 1e-9 >= FIXED_STEP && steps < 15) {
      this.step(input, humanInputs);
      this.accumulator -= FIXED_STEP;
      steps++;
    }
    return steps;
  }
  step(input: RaceInput, humanInputs?: ReadonlyMap<number, RaceInput>) {
    if (this.finished) return;
    const dt = FIXED_STEP;
    this.tick++;
    if (this.countdown > 0) {
      this.countdown = Math.max(0, this.countdown - dt);
      const count = Math.ceil(this.countdown - 1e-8);
      if (count !== this.lastCount) {
        this.lastCount = count;
        this.events.push({
          type: count === 0 ? "go" : "countdown",
          carId: 0,
          value: count,
        });
      }
      return;
    }
    this.time += dt;
    for (const car of this.cars)
      this.drive(
        car,
        this.humans
          ? (humanInputs?.get(car.id) ?? idleInput())
          : car.id === 0
            ? input
            : this.aiInput(car),
        dt,
      );
    if (this.mode === "grand-prix") this.resolveCars();
    for (const car of this.cars) this.updateProgress(car);
    if (this.humans) {
      if (this.cars.every((c) => c.finishedAt !== null)) this.finished = true;
    } else if (this.player.finishedAt !== null) this.finish();
  }
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
  aiInput(car: Vehicle): RaceInput {
    const settings = AI_SETTINGS[this.difficulty],
      p = projectToTrack(this.samples, car.x, car.z),
      speed = Math.hypot(car.vx, car.vz),
      look = 7 + speed * 0.4;
    let lane = Math.sin(car.id * 2.7) * 1.1;
    const ahead = this.cars.find(
      (other) =>
        other.id !== car.id &&
        other.finishedAt === null &&
        Math.hypot(other.x - car.x, other.z - car.z) < 12 &&
        (other.x - car.x) * p.tx + (other.z - car.z) * p.tz > 0,
    );
    if (ahead) lane = (car.id % 2 ? 1 : -1) * 2.4;
    const target = trackPose(this.samples, p.progress + look / this.length),
      tx = target.x - target.tz * lane - car.x,
      tz = target.z + target.tx * lane - car.z,
      angle = wrap(Math.atan2(tx, tz) - car.heading),
      maxAngle = 0.6 / (1 + speed / 25);
    const steer = clamp(
      -Math.atan(
        (2.8 * 2 * Math.sin(angle)) / Math.max(3, Math.hypot(tx, tz)),
      ) / maxAngle,
      -1,
      1,
    );
    const targetSpeed =
      Math.min(
        settings.speed,
        cornerSpeed(this.samples, p.progress, this.length, settings.corner),
      ) *
      (0.97 + (car.id % 3) * 0.015);
    return {
      steer,
      throttle: speed < targetSpeed + 1 ? 1 : 0.1,
      brake:
        speed > targetSpeed + 1 ? clamp((speed - targetSpeed) / 7, 0, 1) : 0,
      drift: false,
      boost:
        this.difficulty !== "rookie" &&
        speed > 17 &&
        targetSpeed > 29 &&
        car.energy > 25 &&
        car.finishedAt === null,
    };
  }
  recover(carId = this.playerId) {
    const car = this.cars[carId];
    if (!car || car.finishedAt !== null) return;
    if (this.finished || this.countdown > 0 || car.recovering > 0) return;
    const p = trackPose(this.samples, car.lastGate / CHECKPOINTS + 0.003);
    Object.assign(car, {
      x: p.x,
      z: p.z,
      vx: 0,
      vz: 0,
      speed: 0,
      heading: Math.atan2(p.tx, p.tz),
      steer: 0,
      driftCharge: 0,
      drifting: false,
      turbo: 0,
      boosting: false,
      recovering: 1,
      wrongWay: 0,
    });
    car.penalty += 2;
    car.recoveries++;
    this.events.push({ type: "recover", carId, value: 2 });
  }
  private drive(car: Vehicle, raw: RaceInput, dt: number) {
    if (car.finishedAt !== null) {
      car.speed = car.vx = car.vz = 0;
      return;
    }
    const input = {
      throttle: clamp(raw.throttle, 0, 1),
      brake: clamp(raw.brake, 0, 1),
      steer: clamp(raw.steer, -1, 1),
      drift: raw.drift,
      boost: raw.boost,
    };
    car.lastInput = input;
    car.wallCooldown = Math.max(0, car.wallCooldown - dt);
    car.padCooldown = Math.max(0, car.padCooldown - dt);
    car.turbo = Math.max(0, car.turbo - dt);
    if (car.recovering > 0) {
      car.recovering -= dt;
      return;
    }
    const road = projectToTrack(this.samples, car.x, car.z),
      off = road.distance > this.track.width / 2,
      forwardSpeed =
        car.vx * Math.sin(car.heading) + car.vz * Math.cos(car.heading),
      abs = Math.abs(forwardSpeed);
    car.steer += (input.steer - car.steer) * (1 - Math.exp(-dt * 11));
    const wasDrifting = car.drifting;
    car.drifting =
      input.drift && forwardSpeed > 9 && Math.abs(car.steer) > 0.12 && !off;
    if (!car.drifting && wasDrifting) {
      if (car.driftCharge >= 1.1) {
        car.turbo = car.driftCharge >= 2.3 ? 1.6 : 0.85;
        car.drifts++;
        this.events.push({
          type: "drift-boost",
          carId: car.id,
          value: car.driftCharge >= 2.3 ? 2 : 1,
        });
      }
      car.driftCharge = 0;
    }
    const maxAngle = 0.6 / (1 + abs / 25),
      yaw = clamp(
        (-forwardSpeed / 2.8) *
          Math.tan(car.steer * maxAngle) *
          (car.drifting ? 1.18 : 1),
        -2.1,
        2.1,
      );
    car.heading += yaw * dt;
    const fx = Math.sin(car.heading),
      fz = Math.cos(car.heading),
      rx = -fz,
      rz = fx;
    let longitudinal = car.vx * fx + car.vz * fz,
      lateral = car.vx * rx + car.vz * rz;
    if (car.drifting && Math.abs(lateral) > 1.1)
      car.driftCharge = Math.min(3.2, car.driftCharge + dt);
    const boosting =
      input.boost &&
      car.energy > 0 &&
      input.throttle > 0.2 &&
      longitudinal > 4 &&
      !off;
    car.boosting = boosting;
    car.energy = clamp(
      car.energy + (boosting ? -28 : input.boost ? 0 : 10) * dt,
      0,
      100,
    );
    const turbo = boosting || car.turbo > 0;
    let acceleration =
      input.throttle *
      (17 * Math.max(0.18, 1 - Math.max(0, longitudinal) / 48));
    if (input.brake > 0.1) {
      if (longitudinal > 0.25) {
        acceleration -= 30 * input.brake;
        car.reverseHold = 0;
      } else {
        car.reverseHold += dt;
        if (car.reverseHold > 0.3) acceleration -= 9 * input.brake;
      }
    } else car.reverseHold = 0;
    if (input.throttle > 0.1 && longitudinal < 0) acceleration += 15;
    if (turbo) acceleration += 23;
    const slope = road.slope * (fx * road.tx + fz * road.tz);
    acceleration -= slope * 7;
    if (Math.abs(longitudinal) > 0.03)
      acceleration -=
        (0.6 + longitudinal * longitudinal * 0.007) *
        (longitudinal > 0 ? 1 : -1);
    if (off) acceleration -= longitudinal * 1.4;
    longitudinal += acceleration * dt;
    if (input.brake > 0 && car.reverseHold > 0 && car.reverseHold <= 0.3)
      longitudinal = 0;
    if (input.brake > 0 && forwardSpeed > 0 && longitudinal < 0)
      longitudinal = 0;
    if (!input.throttle && !input.brake && Math.abs(longitudinal) < 0.08)
      longitudinal = 0;
    const limit = off ? 17 : turbo ? 44 : 34;
    if (longitudinal > limit)
      longitudinal += (limit - longitudinal) * (1 - Math.exp(-dt * 5));
    longitudinal = Math.max(-7, longitudinal);
    lateral *= Math.exp(-(off ? 5 : car.drifting ? 2.3 : 13) * dt);
    car.vx = fx * longitudinal + rx * lateral;
    car.vz = fz * longitudinal + rz * lateral;
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    const after = projectToTrack(this.samples, car.x, car.z),
      boundary = this.track.width / 2 + 0.7;
    if (after.distance > boundary) {
      const side = Math.sign(after.lateral) || 1,
        nx = -after.tz * side,
        nz = after.tx * side;
      car.x = after.x + nx * boundary;
      car.z = after.z + nz * boundary;
      const outward = car.vx * nx + car.vz * nz;
      if (outward > 0) {
        car.vx -= outward * nx * 1.15;
        car.vz -= outward * nz * 1.15;
        car.vx *= 0.92;
        car.vz *= 0.92;
        if (car.wallCooldown <= 0 && outward > 2) {
          car.collisions++;
          this.events.push({
            type: "collision",
            carId: car.id,
            value: outward,
          });
          car.wallCooldown = 0.6;
        }
      }
      car.drifting = false;
      car.driftCharge = 0;
      car.turbo = 0;
    }
    if (
      !off &&
      car.padCooldown <= 0 &&
      [0.18, 0.6].some((p) => Math.abs(after.progress - p) < 0.008)
    ) {
      car.padCooldown = 1.3;
      car.turbo = Math.max(car.turbo, 0.8);
      this.events.push({ type: "pad", carId: car.id, value: 1 });
    }
    car.speed = car.vx * Math.sin(car.heading) + car.vz * Math.cos(car.heading);
    car.maxSpeed = Math.max(car.maxSpeed, Math.hypot(car.vx, car.vz));
    const goingForward = car.vx * after.tx + car.vz * after.tz;
    car.wrongWay =
      goingForward < -2
        ? car.wrongWay + dt
        : Math.max(0, car.wrongWay - dt * 2);
  }
  private resolveCars() {
    for (let i = 0; i < this.cars.length; i++)
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i],
          b = this.cars[j];
        if (
          a.finishedAt !== null ||
          b.finishedAt !== null ||
          a.recovering > 0 ||
          b.recovering > 0
        )
          continue;
        const dx = b.x - a.x,
          dz = b.z - a.z,
          d = Math.hypot(dx, dz),
          radius = 2.25;
        if (d >= radius) continue;
        const nx = d > 0.01 ? dx / d : 1,
          nz = d > 0.01 ? dz / d : 0,
          push = (radius - d) * 0.5;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        const relative = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (relative < 0) {
          const impulse = -relative * 0.55;
          a.vx -= impulse * nx;
          a.vz -= impulse * nz;
          b.vx += impulse * nx;
          b.vz += impulse * nz;
          if (Math.abs(relative) > 4 && a.wallCooldown <= 0) {
            this.events.push({
              type: "collision",
              carId: a.id,
              value: Math.abs(relative),
            });
            a.wallCooldown = 0.5;
            a.collisions++;
          }
        }
      }
  }
  private updateProgress(car: Vehicle) {
    const p = projectToTrack(this.samples, car.x, car.z);
    car.progress = p.progress;
    if (car.finishedAt !== null) return;
    const forward = car.vx * p.tx + car.vz * p.tz > 0.5,
      next = advanceCheckpoint(
        car.lastGate,
        car.laps,
        p.progress,
        p.distance <= this.track.width / 2 + 1,
        forward,
      );
    if (next.laps > car.laps) {
      const time = this.time + car.penalty;
      car.lapTimes.push(Math.round((time - car.lapStart) * 1000));
      car.lapStart = time;
      this.events.push({ type: "lap", carId: car.id, value: next.laps });
    }
    car.lastGate = next.lastGate;
    car.laps = next.laps;
    let delta = p.progress - car.lastGate / CHECKPOINTS;
    if (delta > 0.5) delta--;
    if (delta < -0.5) delta++;
    car.raceProgress =
      car.laps +
      car.lastGate / CHECKPOINTS +
      clamp(delta, -1 / CHECKPOINTS, 1 / CHECKPOINTS);
    if (car.laps >= 3) {
      car.finishedAt = this.time + car.penalty;
      this.events.push({
        type: "finish",
        carId: car.id,
        value: car.finishedAt,
      });
    }
  }
  private finish() {
    this.finished = true;
    const car = this.player,
      durationMs = Math.round(car.finishedAt! * 1000),
      score = Math.max(
        500,
        Math.round((15000000 * this.track.targetSeconds) / durationMs),
      ),
      place =
        this.cars.filter(
          (c) =>
            c.id !== 0 &&
            c.finishedAt !== null &&
            c.finishedAt! <= car.finishedAt!,
        ).length + 1;
    this.outcome = {
      mode: this.mode,
      difficulty: this.difficulty,
      place,
      result: {
        trackId: this.track.id,
        rulesVersion: 2,
        durationMs,
        bestLapMs: Math.min(...car.lapTimes),
        score,
      },
      lapTimes: [...car.lapTimes],
      drifts: car.drifts,
      collisions: car.collisions,
      recoveries: car.recoveries,
      maxSpeed: Math.round(car.maxSpeed * 3.6),
      medal:
        this.mode === "grand-prix"
          ? place === 1
            ? 3
            : place === 2
              ? 2
              : place === 3
                ? 1
                : 0
          : trialMedal(this.track.id, durationMs),
    };
  }
}
export type GhostFrame = {
  t: number;
  x: number;
  z: number;
  heading: number;
  progress: number;
};
export function ghostPose(frames: readonly GhostFrame[], time: number) {
  if (!frames.length) return null;
  let lo = 0,
    hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid].t <= time) lo = mid;
    else hi = mid - 1;
  }
  const a = frames[lo],
    b = frames[Math.min(lo + 1, frames.length - 1)],
    t = b.t > a.t ? clamp((time - a.t) / (b.t - a.t), 0, 1) : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    heading: a.heading + wrap(b.heading - a.heading) * t,
  };
}
export function ghostDelta(
  frames: readonly GhostFrame[],
  progress: number,
  time: number,
) {
  if (!frames.length || progress <= 0) return null;
  let lo = 0,
    hi = frames.length - 1;
  if (progress > frames[hi].progress) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (frames[mid].progress < progress) lo = mid + 1;
    else hi = mid;
  }
  const b = frames[lo],
    a = frames[Math.max(0, lo - 1)],
    fraction =
      b.progress > a.progress
        ? clamp((progress - a.progress) / (b.progress - a.progress), 0, 1)
        : 0;
  return time - (a.t + (b.t - a.t) * fraction);
}
