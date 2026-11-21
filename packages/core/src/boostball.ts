import {
  BOOSTBALL_BALL_RADIUS as BALL_RADIUS,
  getBoostballArena,
  type BoostballArenaId,
} from "./boostball-arena";
export * from "./boostball-arena";

export type BallInput = {
  throttle: number;
  steer: number;
  boost: boolean;
  dodge: boolean;
  jump?: boolean;
  drift?: boolean;
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
  boosting?: boolean;
  drifting?: boolean;
  dodgeSide?: number;
  goals?: number;
};
type BallImpact = { tick: number; x: number; y: number; height: number };
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
  arena?: BoostballArenaId;
  overtime?: boolean;
  pads?: number[];
  lastTouch?: BallImpact & { carId: string; speed: number };
  lastGoal?: BallImpact & { team: number; scorer?: string };
};
const CAR_MAX_SPEED = 550;
export const BALL_IDLE: BallInput = {
  throttle: 0,
  steer: 0,
  boost: false,
  dodge: false,
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export class BoostballSimulation {
  state: BallState;
  readonly arena;
  private accumulator = 0;
  private jumpHeld = new Set<string>();
  private dodgeHeld = new Set<string>();
  constructor(
    roster: { id: string; name: string }[],
    private readonly freePlay = false,
    arenaId: BoostballArenaId = "expanded",
  ) {
    this.arena = getBoostballArena(arenaId);
    const { centerX, centerY, pads } = this.arena;
    this.state = {
      arena: arenaId,
      tick: 0,
      time: 180,
      countdown: freePlay ? 0 : 3,
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
        goals: 0,
      })),
      ball: {
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        height: BALL_RADIUS,
        vz: 0,
      },
      goal: "Kickoff",
      pads: pads.map(() => 0),
    };
    this.reset();
  }
  private reset() {
    const { centerX, centerY, kickoffOffset, gridSpacing } = this.arena;
    this.state.ball = {
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      height: BALL_RADIUS,
      vz: 0,
    };
    this.state.lastTouch = undefined;
    this.state.pads?.fill(0);
    this.jumpHeld.clear();
    this.dodgeHeld.clear();
    this.state.cars.forEach((c, i) => {
      c.x = centerX + (c.team ? kickoffOffset : -kickoffOffset);
      c.y =
        centerY +
        (Math.floor(i / 2) -
          (this.state.cars.filter((p) => p.team === c.team).length - 1) / 2) *
          gridSpacing;
      c.vx = c.vy = c.vz = c.height = 0;
      c.angle = c.team ? Math.PI : 0;
      c.fuel = 100;
      c.cooldown = 0;
      c.boosting = c.drifting = false;
      c.dodgeSide = 0;
    });
  }
  exit(id: string) {
    const c = this.state.cars.find((c) => c.id === id);
    if (c) {
      c.active = false;
      c.vx = c.vy = c.vz = c.height = 0;
      c.boosting = c.drifting = false;
      this.jumpHeld.delete(id);
      this.dodgeHeld.delete(id);
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
    const {
      length,
      centerX,
      centerY,
      carBounds,
      ballBounds,
      goalHalfWidth,
      goalHeight,
      scoreInset,
      pads: padLocations,
    } = this.arena;
    if (s.complete) return;
    s.tick++;
    if (s.countdown > 0) {
      s.countdown = Math.max(0, s.countdown - dt);
      return;
    }
    if (!this.freePlay) {
      s.time = s.overtime ? s.time + dt : Math.max(0, s.time - dt);
      if (!s.overtime && s.time === 0) {
        if (s.score[0] !== s.score[1]) s.complete = true;
        else {
          s.overtime = true;
          s.goal = "Overtime";
          s.countdown = 3;
          this.reset();
        }
        return;
      }
    }
    const cars = s.cars.filter((c) => c.active);
    const pads = (s.pads ??= padLocations.map(() => 0));
    for (let i = 0; i < pads.length; i++) pads[i] = Math.max(0, pads[i] - dt);
    for (const c of cars) {
      const u = inputs.get(c.id) ?? BALL_IDLE;
      c.cooldown = Math.max(0, c.cooldown - dt);
      if (u.jump && !this.jumpHeld.has(c.id) && c.height <= 0.1) c.vz = 245;
      if (u.jump) this.jumpHeld.add(c.id);
      else this.jumpHeld.delete(c.id);
      const airborne = c.height > 0.1 || c.vz > 0;
      const steer = clamp(u.steer, -1, 1);
      const speedRatio = Math.min(1, Math.hypot(c.vx, c.vy) / CAR_MAX_SPEED);
      const forward = c.vx * Math.cos(c.angle) + c.vy * Math.sin(c.angle);
      const drifting = !!u.drift && !airborne && speedRatio > 0.12;
      const turn = airborne ? 2.5 : drifting ? 4.6 : 3.7 - speedRatio * 1.55;
      c.angle += steer * turn * dt * (forward < -15 ? -1 : 1);
      const boosting = u.boost && c.fuel > 0;
      c.boosting = boosting;
      c.drifting = drifting;
      const throttle = clamp(u.throttle, -1, 1);
      const motor = throttle * (throttle < 0 ? 330 : 445);
      const force = motor + (boosting ? 650 : 0);
      c.fuel = clamp(
        c.fuel + (u.boost ? (boosting ? -38 : 0) : 12) * dt,
        0,
        100,
      );
      if (u.dodge && !this.dodgeHeld.has(c.id) && c.cooldown === 0) {
        const heading = c.angle + steer * (Math.PI / 2.4);
        c.vx += Math.cos(heading) * 230;
        c.vy += Math.sin(heading) * 230;
        if (airborne) c.vz = Math.max(-35, c.vz);
        c.cooldown = 1.4;
        c.dodgeSide = steer;
      }
      if (u.dodge) this.dodgeHeld.add(c.id);
      else this.dodgeHeld.delete(c.id);
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
      const grip = airborne ? 1.25 : drifting ? 1.8 : 9;
      const lateral = -c.vx * Math.sin(c.angle) + c.vy * Math.cos(c.angle);
      const slip = lateral * (1 - Math.exp(-grip * dt));
      c.vx += Math.sin(c.angle) * slip;
      c.vy -= Math.cos(c.angle) * slip;
      const drag = Math.exp(-(drifting ? 0.92 : 1.35) * dt);
      c.vx *= drag;
      c.vy *= drag;
      const speed = Math.hypot(c.vx, c.vy);
      if (speed > CAR_MAX_SPEED) {
        c.vx *= CAR_MAX_SPEED / speed;
        c.vy *= CAR_MAX_SPEED / speed;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.x < carBounds.left || c.x > carBounds.right) {
        c.x = clamp(c.x, carBounds.left, carBounds.right);
        c.vx *= -0.55;
      }
      if (c.y < carBounds.top || c.y > carBounds.bottom) {
        c.y = clamp(c.y, carBounds.top, carBounds.bottom);
        c.vy *= -0.55;
      }
      if (!airborne && c.fuel < 99.5) {
        for (const [i, pad] of padLocations.entries()) {
          if (pads[i] === 0 && Math.hypot(c.x - pad.x, c.y - pad.y) < 23) {
            c.fuel = Math.min(100, c.fuel + 35);
            pads[i] = 5;
            break;
          }
        }
      }
    }
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
          a.x = clamp(a.x - nx * overlap, carBounds.left, carBounds.right);
          a.y = clamp(a.y - ny * overlap, carBounds.top, carBounds.bottom);
          b.x = clamp(b.x + nx * overlap, carBounds.left, carBounds.right);
          b.y = clamp(b.y + ny * overlap, carBounds.top, carBounds.bottom);
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
    b.height ??= BALL_RADIUS;
    b.vz ??= 0;
    b.vz -= 430 * dt;
    b.height += b.vz * dt;
    if (b.height < BALL_RADIUS) {
      b.height = BALL_RADIUS;
      b.vz = Math.abs(b.vz) < 35 ? 0 : -b.vz * 0.66;
    }
    if (b.height > 160) {
      b.height = 160;
      b.vz = -Math.abs(b.vz) * 0.7;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const ballDrag = Math.exp(-(b.height <= BALL_RADIUS ? 0.4 : 0.08) * dt);
    b.vx *= ballDrag;
    b.vy *= ballDrag;
    for (const c of cars) {
      const dx = b.x - c.x,
        dy = b.y - c.y,
        d = Math.hypot(dx, dy),
        vertical = b.height - (c.height + 10),
        reach = Math.sqrt(Math.max(0, 35 ** 2 - vertical ** 2));
      if (d < reach) {
        const nx = d ? dx / d : Math.cos(c.angle),
          ny = d ? dy / d : Math.sin(c.angle);
        b.x = c.x + nx * reach;
        b.y = c.y + ny * reach;
        const v = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
        if (v < 0) {
          b.vz = Math.max(
            b.vz,
            Math.min(
              250,
              Math.max(0, -v - 65) * 0.29 + Math.max(0, c.vz) * 0.7,
            ),
          );
          b.vx -= 1.8 * v * nx;
          b.vy -= 1.8 * v * ny;
          c.vx += v * nx * 0.2;
          c.vy += v * ny * 0.2;
          if (v < -25) {
            s.lastTouch = {
              tick: s.tick,
              carId: c.id,
              speed: -v,
              x: b.x,
              y: b.y,
              height: b.height,
            };
          }
        }
      }
    }
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 850) {
      b.vx *= 850 / speed;
      b.vy *= 850 / speed;
    }
    // The whole ball must clear the posts, crossbar and line.
    const clearMouth =
      Math.abs(b.y - centerY) <= goalHalfWidth - BALL_RADIUS &&
      b.height + BALL_RADIUS < goalHeight;
    if (clearMouth && (b.x < scoreInset || b.x > length - scoreInset)) {
      const team = b.x > centerX ? 0 : 1;
      const scorer = s.cars.find(
        (car) => car.id === s.lastTouch?.carId && car.team === team,
      );
      if (scorer) scorer.goals = (scorer.goals ?? 0) + 1;
      s.score[team]++;
      s.lastGoal = {
        tick: s.tick,
        team,
        scorer: scorer?.id,
        x: b.x,
        y: b.y,
        height: b.height,
      };
      s.goal = `${team ? "ORANGE" : "BLUE"} GOAL!`;
      if (s.overtime) s.complete = true;
      else {
        s.countdown = this.freePlay ? 1.2 : 2.5;
        this.reset();
      }
      return;
    }
    if (!clearMouth && (b.x < ballBounds.left || b.x > ballBounds.right)) {
      b.vx = (b.x < ballBounds.left ? 1 : -1) * Math.abs(b.vx) * 0.86;
      b.x = clamp(b.x, ballBounds.left, ballBounds.right);
    }
    if (b.y < ballBounds.top || b.y > ballBounds.bottom) {
      b.vy = (b.y < ballBounds.top ? 1 : -1) * Math.abs(b.vy) * 0.86;
      b.y = clamp(b.y, ballBounds.top, ballBounds.bottom);
    }
  }
}

/** Offline practice opponent only; never inserted into multiplayer rosters. */
export function boostballBot(state: BallState, id: string): BallInput {
  const bot = state.cars.find((c) => c.id === id);
  if (!bot || !bot.active) return BALL_IDLE;
  const { length, centerY, ballBounds, goalHalfWidth } = getBoostballArena(
    state.arena,
  );
  const b = state.ball,
    goalX = bot.team ? 0 : length;
  const separation = Math.hypot(b.x - bot.x, b.y - bot.y);
  const interceptTime = Math.min(0.38, separation / 580);
  const ballX = clamp(
    b.x + b.vx * interceptTime,
    ballBounds.left,
    ballBounds.right,
  );
  const ballY = clamp(
    b.y + b.vy * interceptTime,
    ballBounds.top,
    ballBounds.bottom,
  );
  const blocker = state.cars.find(
    (c) =>
      c.active &&
      c.team !== bot.team &&
      (c.x - b.x) * (goalX - b.x) > 0 &&
      Math.abs(c.y - b.y) < 45,
  );
  const shootingLane = (goalHalfWidth - BALL_RADIUS) * 0.86;
  const goalY =
    centerY +
    (blocker ? (blocker.y >= centerY ? -shootingLane : shootingLane) : 0);
  const distance = Math.hypot(goalX - ballX, goalY - ballY) || 1;
  const nx = (goalX - ballX) / distance,
    ny = (goalY - ballY) / distance;
  const dx = ballX - bot.x,
    dy = ballY - bot.y;
  const attacking = dx * nx + dy * ny > 18 && Math.abs(dx * ny - dy * nx) < 16;
  const tx = attacking
    ? ballX + nx * 65
    : clamp(ballX - nx * 74, ballBounds.left + 17, ballBounds.right - 17);
  const ty = attacking
    ? ballY + ny * 65
    : clamp(ballY - ny * 74, ballBounds.top + 17, ballBounds.bottom - 17);
  let angle = Math.atan2(ty - bot.y, tx - bot.x) - bot.angle;
  angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  const turn = Math.abs(angle);
  return {
    throttle: turn > 0.85 ? 0 : turn > 0.42 ? 0.4 : 0.88,
    steer: clamp(angle * 2.6, -1, 1),
    drift: turn > 1 && Math.hypot(bot.vx, bot.vy) > 170,
    boost: attacking && turn < 0.13 && separation > 150,
    jump: attacking && (b.height ?? BALL_RADIUS) > 42 && separation < 88,
    dodge: attacking && turn < 0.13 && separation < 62,
  };
}
