export type BallInput = {
  throttle: number;
  steer: number;
  boost: boolean;
  dodge: boolean;
  jump?: boolean;
};
export type BallCar = {
  id: string;
  name: string;
  team: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  fuel: number;
  cooldown: number;
  height: number;
  vz: number;
};
export type BallState = {
  tick: number;
  time: number;
  countdown: number;
  complete: boolean;
  score: number[];
  cars: BallCar[];
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    height?: number;
    vz?: number;
  };
  goal: string;
};
export const BALL_IDLE: BallInput = {
  throttle: 0,
  steer: 0,
  boost: false,
  dodge: false,
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export class BoostballSimulation {
  state: BallState;
  private accumulator = 0;
  private jumpHeld = new Set<string>();
  constructor(roster: { id: string; name: string }[]) {
    this.state = {
      tick: 0,
      time: 180,
      countdown: 3,
      complete: false,
      score: [0, 0],
      cars: roster.slice(0, 8).map((p, i) => ({
        ...p,
        team: i % 2,
        active: true,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle: 0,
        fuel: 100,
        cooldown: 0,
        height: 0,
        vz: 0,
      })),
      ball: { x: 480, y: 270, vx: 0, vy: 0, height: 17, vz: 0 },
      goal: "Kickoff",
    };
    this.reset();
  }
  private reset() {
    this.state.ball = { x: 480, y: 270, vx: 0, vy: 0, height: 17, vz: 0 };
    this.jumpHeld.clear();
    this.state.cars.forEach((c, i) => {
      c.x = c.team ? 740 : 220;
      c.y =
        270 +
        (Math.floor(i / 2) -
          (this.state.cars.filter((p) => p.team === c.team).length - 1) / 2) *
          75;
      c.vx = c.vy = c.vz = c.height = 0;
      c.angle = c.team ? Math.PI : 0;
      c.fuel = 100;
      c.cooldown = 0;
    });
  }
  exit(id: string) {
    const c = this.state.cars.find((c) => c.id === id);
    if (c) {
      c.active = false;
      c.vx = c.vy = c.vz = c.height = 0;
    }
    if (!this.state.cars.some((c) => c.active)) this.state.complete = true;
  }
  advance(dt: number, inputs: ReadonlyMap<string, BallInput>) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator + 1e-9 >= 1 / 120) {
      this.accumulator -= 1 / 120;
      this.step(1 / 120, inputs);
    }
  }
  private step(dt: number, inputs: ReadonlyMap<string, BallInput>) {
    const s = this.state;
    if (s.complete) return;
    s.tick++;
    if (s.countdown > 0) {
      s.countdown = Math.max(0, s.countdown - dt);
      return;
    }
    s.time = Math.max(0, s.time - dt);
    if (!s.time) {
      s.complete = true;
      return;
    }
    for (const c of s.cars.filter((c) => c.active)) {
      const u = inputs.get(c.id) ?? BALL_IDLE;
      c.cooldown = Math.max(0, c.cooldown - dt);
      if (u.jump && !this.jumpHeld.has(c.id) && c.height <= 0.1) c.vz = 245;
      if (u.jump) this.jumpHeld.add(c.id);
      else this.jumpHeld.delete(c.id);
      const airborne = c.height > 0.1 || c.vz > 0;

      const forward = c.vx * Math.cos(c.angle) + c.vy * Math.sin(c.angle);
      c.angle += clamp(u.steer, -1, 1) * 3.4 * dt * (forward < -15 ? -1 : 1);
      const boosting = u.boost && c.fuel > 0;
      let force = clamp(u.throttle, -1, 1) * 380 + (boosting ? 650 : 0);
      c.fuel = clamp(
        c.fuel + (u.boost ? (boosting ? -38 : 0) : 15) * dt,
        0,
        100,
      );
      if (u.dodge && c.cooldown === 0) {
        force += 200 / dt;
        c.cooldown = 1.4;
      }
      if (airborne) {
        c.vz += (-580 + (boosting ? 420 : 0)) * dt;
        c.height += c.vz * dt;
        if (c.height <= 0) {
          c.height = 0;
          c.vz = 0;
        }
        if (c.height > 150) {
          c.height = 150;
          c.vz = Math.min(0, c.vz);
        }
      }
      c.vx += Math.cos(c.angle) * force * dt;
      c.vy += Math.sin(c.angle) * force * dt;
      // Grip damps lateral drift while retaining speed through turns.
      const lateral = -c.vx * Math.sin(c.angle) + c.vy * Math.cos(c.angle);
      c.vx +=
        Math.sin(c.angle) * lateral * Math.min(1, dt * (airborne ? 1.2 : 7));
      c.vy -=
        Math.cos(c.angle) * lateral * Math.min(1, dt * (airborne ? 1.2 : 7));
      const drag = Math.exp(-1.4 * dt);
      c.vx *= drag;
      c.vy *= drag;
      const speed = Math.hypot(c.vx, c.vy);
      if (speed > 520) {
        c.vx *= 520 / speed;
        c.vy *= 520 / speed;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.x < 48 || c.x > 912) {
        c.x = clamp(c.x, 48, 912);
        c.vx *= -0.55;
      }
      if (c.y < 48 || c.y > 492) {
        c.y = clamp(c.y, 48, 492);
        c.vy *= -0.55;
      }
    }
    const cars = s.cars.filter((c) => c.active);
    for (let i = 0; i < cars.length; i++)
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i],
          b = cars[j],
          dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy);
        if (d < 36 && Math.abs(a.height - b.height) < 22) {
          const nx = d ? dx / d : 1,
            ny = d ? dy / d : 0,
            overlap = (36 - d) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const v = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (v < 0) {
            a.vx += v * nx * 0.8;
            a.vy += v * ny * 0.8;
            b.vx -= v * nx * 0.8;
            b.vy -= v * ny * 0.8;
          }
        }
      }
    const b = s.ball;
    b.height ??= 17;
    b.vz ??= 0;
    b.vz -= 430 * dt;
    b.height += b.vz * dt;
    if (b.height < 17) {
      b.height = 17;
      b.vz = Math.abs(b.vz) < 35 ? 0 : -b.vz * 0.66;
    }
    if (b.height > 160) {
      b.height = 160;
      b.vz = -Math.abs(b.vz) * 0.7;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= Math.exp(-0.32 * dt);
    b.vy *= Math.exp(-0.32 * dt);
    for (const c of cars) {
      const dx = b.x - c.x,
        dy = b.y - c.y,
        d = Math.hypot(dx, dy);
      if (d < 35 && Math.abs(b.height - (c.height + 10)) < 30) {
        const nx = d ? dx / d : Math.cos(c.angle),
          ny = d ? dy / d : Math.sin(c.angle);
        b.x = c.x + nx * 35;
        b.y = c.y + ny * 35;
        const v = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
        if (v < 0) {
          b.vz = Math.max(
            b.vz,
            Math.min(240, 35 + Math.abs(v) * 0.18 + Math.max(0, c.vz) * 0.65),
          );
          b.vx -= 1.8 * v * nx;
          b.vy -= 1.8 * v * ny;
          c.vx += v * nx * 0.2;
          c.vy += v * ny * 0.2;
        }
      }
    }
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 850) {
      b.vx *= 850 / speed;
      b.vy *= 850 / speed;
    }
    if ((b.x < 26 || b.x > 934) && b.y > 210 && b.y < 330 && b.height < 73) {
      const team = b.x > 934 ? 0 : 1;
      s.score[team]++;
      s.goal = `${team ? "ORANGE" : "BLUE"} GOAL!`;
      s.countdown = 2.5;
      this.reset();
      return;
    }
    if (
      (b.y <= 210 || b.y >= 330 || b.height >= 73) &&
      (b.x < 46 || b.x > 914)
    ) {
      b.x = clamp(b.x, 46, 914);
      b.vx *= -0.86;
    }
    if (b.y < 46 || b.y > 494) {
      b.y = clamp(b.y, 46, 494);
      b.vy *= -0.86;
    }
  }
}

/** Offline practice opponent only; never inserted into multiplayer rosters. */
export function boostballBot(state: BallState, id: string): BallInput {
  const bot = state.cars.find((c) => c.id === id);
  if (!bot || !bot.active) return BALL_IDLE;
  const b = state.ball,
    goalX = bot.team ? 0 : 960;
  const distance = Math.hypot(goalX - b.x, 270 - b.y) || 1;
  const nx = (goalX - b.x) / distance,
    ny = (270 - b.y) / distance;
  const dx = b.x - bot.x,
    dy = b.y - bot.y;
  const attacking = dx * nx + dy * ny > 20 && Math.abs(dx * ny - dy * nx) < 26;
  const tx = attacking ? b.x + nx * 70 : clamp(b.x - nx * 90, 65, 895);
  const ty = attacking ? b.y + ny * 70 : clamp(b.y - ny * 90, 65, 475);
  let angle = Math.atan2(ty - bot.y, tx - bot.x) - bot.angle;
  angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  return {
    throttle: Math.abs(angle) > 0.65 ? 0 : 0.8,
    steer: clamp(angle * 2.6, -1, 1),
    boost: attacking && Math.abs(angle) < 0.12 && Math.hypot(dx, dy) > 150,
    jump: attacking && (b.height ?? 17) > 42 && Math.hypot(dx, dy) < 90,
    dodge: attacking && Math.abs(angle) < 0.1 && Math.hypot(dx, dy) < 65,
  };
}
