import { circleHitsBox, moveTile, isSolved } from "./index";
export type ArcadeKind =
  | "neon-dash"
  | "starfall"
  | "prism-break"
  | "tile-shift";
export type PuzzleDifficulty = "easy" | "normal" | "hard";
export type ArcadeInput = {
  x: number;
  y: number;
  action: boolean;
  jump: boolean;
  pointer?: { x: number; y: number };
  tap?: { x: number; y: number };
};
export const noArcadeInput = (): ArcadeInput => ({
  x: 0,
  y: 0,
  action: false,
  jump: false,
});
export type ArcadeEvent = {
  kind:
    | "hit"
    | "pickup"
    | "jump"
    | "shot"
    | "clear"
    | "move"
    | "boost"
    | "finish";
  x: number;
  y: number;
  color: number;
  amount?: number;
};
export type Foe = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  kind: "scout" | "weaver" | "gunner" | "boss";
  age: number;
  fire: number;
};
export type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  enemy: boolean;
};
export type Drop = {
  x: number;
  y: number;
  kind: "shield" | "power" | "wide" | "slow";
  age: number;
};
export type Crystal = {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  color: number;
};
export type RunnerObstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "spike" | "drone" | "double";
  passed: boolean;
};
export const runnerSpikeOffsets = (kind: RunnerObstacle["kind"]) =>
  kind === "double" ? [0, 42] : [0];
/** Inset player box against the visible triangle, rather than the triangle's empty bounding-box corners. */
export function runnerHitsObstacle(x: number, y: number, o: RunnerObstacle) {
  const left = x - 12,
    right = x + 12,
    top = y - 18,
    bottom = y + 18;
  if (o.kind === "drone")
    return (
      right > o.x + 4 &&
      left < o.x + o.width - 4 &&
      bottom > o.y + 4 &&
      top < o.y + o.height - 4
    );
  return runnerSpikeOffsets(o.kind).some((offset) => {
    const tip = o.y + 3,
      base = o.y + o.height - 2;
    if (bottom <= tip || top >= base) return false;
    const center = o.x + offset + 20,
      half = ((Math.min(bottom, base) - o.y) / o.height) * 20 - 2,
      near = Math.max(left - center, center - right, 0);
    return near < half;
  });
}
export class ArcadeSimulation {
  kind: ArcadeKind;
  time = 0;
  countdown = 2;
  score = 0;
  lives = 3;
  ended = false;
  won = false;
  events: ArcadeEvent[] = [];
  message = "GO!";
  messageTime = 0.8;
  player = { x: 155, y: 419, vx: 0, vy: 0 };
  invulnerable = 0;
  energy = 100;
  dash = 0;
  dashCooldown = 0;
  jumps = 0;
  grounded = true;
  buffer = 0;
  combo = 0;
  bestCombo = 0;
  comboTime = 0;
  collected = 0;
  distance = 0;
  speed = 300;
  obstacles: {
    x: number;
    y: number;
    width: number;
    height: number;
    kind: "spike" | "drone" | "double";
    passed: boolean;
  }[] = [];
  gems: { x: number; y: number; phase: number }[] = [];
  spawn = 1;
  gemSpawn = 0.8;
  shots: Shot[] = [];
  foes: Foe[] = [];
  drops: Drop[] = [];
  wave = 1;
  waveKills = 0;
  spawned = 0;
  bossSpawned = false;
  waveWait = 0;
  fire = 0;
  power = 0;
  kills = 0;
  uid = 0;
  paddle = 480;
  ball = { x: 480, y: 476, vx: 220, vy: -320, active: false };
  trail: { x: number; y: number }[] = [];
  crystals: Crystal[] = [];
  stage = 1;
  stageWait = 0;
  wide = 0;
  slow = 0;
  hitCombo = 0;
  board: number[] = [];
  moves = 0;
  history: number[] = [];
  hints = 0;
  undos = 0;
  hintTile = -1;
  puzzleDifficulty: PuzzleDifficulty;
  anim = 0;
  previousBoard: number[] = [];
  private rng: number;
  private accumulator = 0;
  private pendingJumps = 0;
  private jumpRequestTime = 0;
  private lastJump = false;
  private lastAction = false;
  private coyote = 0.08;
  constructor(
    kind: ArcadeKind,
    seed = Date.now(),
    difficulty: PuzzleDifficulty = "normal",
  ) {
    this.kind = kind;
    this.rng = seed >>> 0;
    this.puzzleDifficulty = difficulty;
    if (kind === "starfall") this.player = { x: 480, y: 440, vx: 0, vy: 0 };
    if (kind === "prism-break") this.makeStage();
    if (kind === "tile-shift") {
      this.board = Array.from({ length: 16 }, (_, i) => (i + 1) % 16);
      let previous = -1;
      for (
        let i = 0;
        i < { easy: 18, normal: 65, hard: 160 }[difficulty];
        i++
      ) {
        const e = this.board.indexOf(0),
          choices = [
            e - 4,
            e + 4,
            e % 4 ? e - 1 : -1,
            e % 4 < 3 ? e + 1 : -1,
          ].filter((n) => n >= 0 && n < 16 && n !== previous),
          next = choices[Math.floor(this.random() * choices.length)];
        previous = e;
        this.board = moveTile(this.board, next);
      }
      if (isSolved(this.board)) this.board = moveTile(this.board, 14);
      this.previousBoard = [...this.board];
      this.countdown = 0;
      this.message = "Arrange 1–15 · tap a tile beside the gap";
    }
  }
  random() {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }
  say(text: string, seconds = 1.6) {
    this.message = text;
    this.messageTime = seconds;
  }
  emit(
    kind: ArcadeEvent["kind"],
    x: number,
    y: number,
    color = 0xa5f3da,
    amount?: number,
  ) {
    this.events.push({ kind, x, y, color, amount });
  }
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
  advance(delta: number, input: ArcadeInput) {
    this.accumulator += Math.max(0, Math.min(0.1, delta));
    let once = true,
      steps = 0;
    while (this.accumulator + 1e-8 >= 1 / 120) {
      this.step({ ...input, tap: once ? input.tap : undefined });
      once = false;
      steps++;
      this.accumulator -= 1 / 120;
    }
    return steps;
  }
  step(input: ArcadeInput) {
    if (this.ended) return;
    const dt = 1 / 120;
    this.jumpRequestTime = Math.max(0, this.jumpRequestTime - dt);
    if (this.jumpRequestTime === 0) this.pendingJumps = 0;
    if (this.countdown > 0) {
      this.countdown = Math.max(0, this.countdown - dt);
      return;
    }
    this.time += dt;
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.anim = Math.max(0, this.anim - dt);
    if (this.kind === "neon-dash") this.runner(dt, input);
    if (this.kind === "starfall") this.shooter(dt, input);
    if (this.kind === "prism-break") this.breaker(dt, input);
    if (this.kind === "tile-shift" && input.tap) {
      const c = Math.floor((input.tap.x - 292) / 94),
        r = Math.floor((input.tap.y - 65) / 94);
      if (c >= 0 && c < 4 && r >= 0 && r < 4) this.tile(r * 4 + c);
    }
    this.lastJump = input.jump;
    this.lastAction = input.action;
  }
  queueJump() {
    if (this.kind !== "neon-dash" || this.ended) return;
    this.pendingJumps = Math.min(2, this.pendingJumps + 1);
    this.jumpRequestTime = 0.14;
  }
  clearInput() {
    this.pendingJumps = 0;
    this.jumpRequestTime = 0;
    this.buffer = 0;
    this.lastJump = false;
    this.lastAction = false;
  }
  finish(won = false) {
    if (this.ended) return;
    this.ended = true;
    this.won = won;
    this.emit("finish", 480, 260);
  }
  damage(x: number, y: number) {
    if (this.invulnerable > 0 || this.ended) return;
    this.lives--;
    this.invulnerable = 1.6;
    this.combo = 0;
    this.emit("hit", x, y, 0xfa9bab);
    this.say(this.lives ? "SHIELD LOST · KEEP GOING" : "RUN COMPLETE");
    if (this.lives <= 0) this.finish();
  }
  private runner(dt: number, input: ArcadeInput) {
    const p = this.player;
    this.speed = Math.min(530, 300 + this.time * 2.2);
    this.distance += this.speed * dt;
    const target = Math.max(-1, Math.min(1, input.x)) * 280;
    p.vx += (target - p.vx) * (1 - Math.exp(-dt * 16));
    p.x = Math.max(45, Math.min(790, p.x + p.vx * dt));
    if (this.pendingJumps > 0) {
      this.pendingJumps--;
      this.buffer = 0.12;
    } else if (input.jump && !this.lastJump) this.buffer = 0.12;
    this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? 0.08 : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && (this.coyote > 0 || this.jumps < 2)) {
      this.jumps = this.coyote > 0 ? 1 : this.jumps + 1;
      p.vy = this.jumps === 1 ? -610 : Math.min(p.vy, -510);
      this.grounded = false;
      this.coyote = 0;
      this.buffer = 0;
      this.emit("jump", p.x, p.y, 0x9df6dc);
    }
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dash = Math.max(0, this.dash - dt);
    this.energy = Math.min(100, this.energy + dt * 12);
    if (
      input.action &&
      !this.lastAction &&
      this.energy >= 40 &&
      this.dashCooldown <= 0
    ) {
      this.dash = 0.3;
      this.dashCooldown = 0.8;
      this.energy -= 40;
      this.emit("boost", p.x, p.y, 0xc4a6fc);
      this.say("PHASE DASH");
    }
    p.vy += 1450 * dt;
    p.y += p.vy * dt;
    if (p.y >= 419) {
      p.y = 419;
      p.vy = 0;
      this.grounded = true;
      this.jumps = 0;
    } else this.grounded = false;
    this.spawn -= dt;
    this.gemSpawn -= dt;
    this.comboTime -= dt;
    if (this.comboTime <= 0) this.combo = 0;
    if (this.spawn <= 0) {
      const kind =
        this.time > 15 && this.random() < 0.23
          ? "drone"
          : this.time > 8 && this.random() < 0.3
            ? "double"
            : "spike";
      this.obstacles.push({
        x: 1010,
        y: kind === "drone" ? 330 : 397,
        width: kind === "double" ? 82 : 40,
        height: kind === "drone" ? 34 : 43,
        kind,
        passed: false,
      });
      this.spawn = (kind === "double" ? 1.7 : 1.3) + this.random() * 0.65;
    }
    if (this.gemSpawn <= 0) {
      const y = 280 + this.random() * 65;
      for (let i = 0; i < 5; i++)
        this.gems.push({
          x: 1000 + i * 35,
          y: y - Math.sin((i / 4) * Math.PI) * 36,
          phase: this.random() * 6,
        });
      this.gemSpawn = 2.8 + this.random() * 1.7;
    }
    for (const o of this.obstacles) {
      o.x -= this.speed * dt;
      if (!o.passed && o.x + o.width < p.x - 16) {
        o.passed = true;
        this.score += 20;
      }
      if (
        this.dash <= 0 &&
        this.invulnerable <= 0 &&
        runnerHitsObstacle(p.x, p.y, o)
      ) {
        o.passed = true;
        this.damage(p.x, p.y);
      }
    }
    for (const gem of this.gems) {
      gem.x -= this.speed * dt;
      if (Math.hypot(gem.x - p.x, gem.y - p.y) < 29) {
        this.combo = Math.min(5, this.combo + 1);
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.comboTime = 2;
        const points = 25 * this.combo;
        this.score += points;
        this.collected++;
        this.energy = Math.min(100, this.energy + 3);
        this.emit("pickup", gem.x, gem.y, 0xffd291, points);
        gem.x = -100;
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.x > -120);
    this.gems = this.gems.filter((g) => g.x > -30);
  }
  get totalScore() {
    // Keep the existing cloud contract: Prism is a 0–2400 challenge in 50-point steps.
    if (this.kind === "prism-break") {
      const count = this.stage === 1 ? 48 : this.stage === 2 ? 32 : 40;
      const cleared = this.stageWait > 0 ? 0 : count - this.crystals.length;
      const progress = (this.stage - 1 + cleared / count) / 3;
      return Math.min(
        2400,
        Math.max(
          0,
          Math.ceil(
            (progress * 2100 + Math.min(300, this.bestCombo * 10)) / 50,
          ) * 50,
        ),
      );
    }
    return Math.round(
      this.score + (this.kind === "neon-dash" ? this.distance / 30 : 0),
    );
  }
  private shooter(dt: number, input: ArcadeInput) {
    const p = this.player,
      scale = Math.max(1, Math.hypot(input.x, input.y));
    p.x = Math.max(28, Math.min(932, p.x + (input.x / scale) * 360 * dt));
    p.y = Math.max(70, Math.min(495, p.y + (input.y / scale) * 360 * dt));
    if (input.pointer) {
      p.x +=
        (Math.max(28, Math.min(932, input.pointer.x)) - p.x) *
        (1 - Math.exp(-dt * 18));
      p.y +=
        (Math.max(70, Math.min(495, input.pointer.y)) - p.y) *
        (1 - Math.exp(-dt * 18));
    }
    this.energy = Math.min(100, this.energy + dt * 9);
    if (input.action && !this.lastAction && this.energy >= 100) {
      this.energy = 0;
      this.invulnerable = Math.max(this.invulnerable, 0.8);
      this.shots = this.shots.filter((s) => !s.enemy);
      for (const foe of this.foes) {
        const alive = foe.hp > 0;
        foe.hp -= foe.kind === "boss" ? 20 : 3;
        if (alive && foe.hp <= 0) {
          this.kills++;
          this.score += foe.kind === "boss" ? 2000 : 100;
          this.emit("clear", foe.x, foe.y, 0xa1e8fa);
        }
        this.emit("hit", foe.x, foe.y, 0xa1e8fa);
      }
      this.emit("boost", p.x, p.y, 0xa1e8fa);
      this.say("NOVA BURST");
    }
    this.power = Math.max(0, this.power - dt);
    this.fire -= dt;
    this.spawn -= dt;
    if (this.fire <= 0) {
      this.fire = this.power > 0 ? 0.11 : 0.18;
      for (const angle of this.power > 0 ? [-0.16, 0, 0.16] : [0])
        this.shots.push({
          x: p.x,
          y: p.y - 25,
          vx: Math.sin(angle) * 600,
          vy: -Math.cos(angle) * 600,
          enemy: false,
        });
      this.emit("shot", p.x, p.y - 25);
    }
    const quota = 6 + this.wave * 2;
    if (this.waveWait > 0) {
      this.waveWait -= dt;
      if (this.waveWait <= 0) {
        this.wave++;
        this.spawned = 0;
        this.bossSpawned = false;
        this.say(`WAVE ${this.wave}`, 2);
      }
    } else if (this.spawn <= 0 && this.spawned < quota) {
      const kind =
          this.wave > 1 && this.spawned % 4 === 3
            ? "gunner"
            : this.spawned % 3 === 2
              ? "weaver"
              : "scout",
        hp = kind === "gunner" ? 3 : kind === "weaver" ? 2 : 1;
      this.foes.push({
        id: ++this.uid,
        x: 70 + this.random() * 820,
        y: -30,
        vx: 0,
        vy: 65 + this.wave * 7,
        hp,
        maxHp: hp,
        kind,
        age: 0,
        fire: 1.2 + this.random(),
      });
      this.spawned++;
      this.spawn = Math.max(0.28, 0.7 - this.wave * 0.025);
    }
    if (!this.waveWait && this.spawned >= quota && !this.foes.length) {
      if (this.wave % 3 === 0 && !this.bossSpawned) {
        this.bossSpawned = true;
        const hp = 45 + this.wave * 5;
        this.foes.push({
          id: ++this.uid,
          x: 480,
          y: -60,
          vx: 0,
          vy: 60,
          hp,
          maxHp: hp,
          kind: "boss",
          age: 0,
          fire: 1.4,
        });
        this.say("DREADNOUGHT INBOUND", 2.5);
      } else {
        this.waveWait = 2;
        this.score += this.wave * 200;
        this.lives = Math.min(3, this.lives + 1);
        this.emit("clear", 480, 200);
        this.say("SECTOR CLEAR · SHIELD RESTORED", 2);
      }
    }
    for (const foe of this.foes) {
      if (foe.hp <= 0) continue;
      foe.age += dt;
      foe.fire -= dt;
      if (foe.kind === "boss") {
        foe.y = Math.min(110, foe.y + foe.vy * dt);
        foe.x = 480 + Math.sin(foe.age * 0.7) * 290;
      } else {
        foe.y += foe.vy * dt;
        if (foe.kind === "weaver") foe.x += Math.cos(foe.age * 3) * 110 * dt;
      }
      if (
        (foe.kind === "gunner" || foe.kind === "boss") &&
        foe.fire <= 0 &&
        foe.y > 20
      ) {
        foe.fire = foe.kind === "boss" ? 0.9 : 1.7;
        const a = Math.atan2(p.y - foe.y, p.x - foe.x);
        for (const offset of foe.kind === "boss" ? [-0.34, 0, 0.34] : [0])
          this.shots.push({
            x: foe.x,
            y: foe.y + 20,
            vx: Math.cos(a + offset) * 175,
            vy: Math.sin(a + offset) * 175,
            enemy: true,
          });
      }
      if (
        foe.hp > 0 &&
        Math.hypot(foe.x - p.x, foe.y - p.y) < (foe.kind === "boss" ? 65 : 30)
      ) {
        this.damage(p.x, p.y);
        if (foe.kind !== "boss") foe.hp = 0;
      }
      if (foe.y > 570) {
        foe.hp = 0;
        this.damage(p.x, p.y);
      }
    }
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.enemy) {
        if (Math.hypot(s.x - p.x, s.y - p.y) < 16 && this.invulnerable <= 0) {
          s.y = 1000;
          this.damage(p.x, p.y);
        }
      } else {
        const target = this.foes.find(
          (f) =>
            f.hp > 0 &&
            Math.abs(s.x - f.x) < (f.kind === "boss" ? 67 : 23) &&
            Math.abs(s.y - f.y) < (f.kind === "boss" ? 35 : 24),
        );
        if (target) {
          target.hp--;
          s.y = -100;
          this.emit("hit", target.x, target.y, 0xf4b0cc, 3);
          if (target.hp === 0) {
            this.kills++;
            this.combo = Math.min(5, this.combo + 1);
            this.bestCombo = Math.max(this.bestCombo, this.combo);
            this.comboTime = 2;
            this.score +=
              (target.kind === "boss" ? 2000 : 100) *
              Math.max(1, Math.ceil(this.combo / 2));
            this.emit("clear", target.x, target.y, 0xf4b0cc);
            if (this.kills % 8 === 0 || target.kind === "boss")
              this.drops.push({
                x: target.x,
                y: target.y,
                kind: this.lives < 3 ? "shield" : "power",
                age: 0,
              });
          }
        }
      }
    }
    this.comboTime -= dt;
    if (this.comboTime <= 0) this.combo = 0;
    this.foes = this.foes.filter((f) => f.hp > 0);
    this.shots = this.shots
      .filter((s) => s.y > -50 && s.y < 600 && s.x > -30 && s.x < 990)
      .slice(-300);
    this.updateDrops(dt);
  }
  private updateDrops(dt: number) {
    for (const d of this.drops) {
      d.y += 70 * dt;
      d.age += dt;
      const x = this.kind === "prism-break" ? this.paddle : this.player.x,
        y = this.kind === "prism-break" ? 490 : this.player.y;
      if (
        Math.hypot(d.x - x, d.y - y) <
        (this.kind === "prism-break" ? this.paddleWidth / 2 + 8 : 32)
      ) {
        if (d.kind === "shield") this.lives = Math.min(3, this.lives + 1);
        if (d.kind === "power") this.power = 10;
        if (d.kind === "wide") this.wide = 12;
        if (d.kind === "slow") this.slow = 10;
        this.emit("pickup", d.x, d.y, 0xa5edce);
        this.say(
          d.kind === "shield"
            ? "SHIELD RESTORED"
            : d.kind === "power"
              ? "TRIPLE SHOT · 10s"
              : d.kind === "wide"
                ? "WIDE PADDLE · 12s"
                : "SLOW FIELD · 10s",
        );
        d.y = 1000;
      }
    }
    this.drops = this.drops.filter((d) => d.y < 560);
  }
  get paddleWidth() {
    return this.wide > 0 ? 180 : 120;
  }
  makeStage() {
    const colors = [0xf6a2b4, 0xffbb88, 0xf6de9c, 0xb8dca7, 0x8ed9d5, 0xb6a3eb];
    this.crystals = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 8; col++) {
        if (
          (this.stage === 2 && (row + col) % 3 === 0) ||
          (this.stage === 3 && row < 2 && col > 1 && col < 6)
        )
          continue;
        const hp = this.stage === 1 ? 1 : (row * 2 + col) % 4 === 1 ? 2 : 1;
        this.crystals.push({
          x: 64 + col * 105,
          y: 90 + row * 35,
          width: 94,
          height: 24,
          hp,
          maxHp: hp,
          color: colors[row],
        });
      }
  }
  get prismLaunch() {
    // Starting further to one side steers the first shot back into the board.
    const angle = (480 - this.paddle) * 0.00145;
    return { vx: Math.sin(angle) * 400, vy: -Math.cos(angle) * 400 };
  }
  private breaker(dt: number, input: ArcadeInput) {
    this.paddle = Math.max(
      this.paddleWidth / 2 + 12,
      Math.min(
        948 - this.paddleWidth / 2,
        input.pointer ? input.pointer.x : this.paddle + input.x * 570 * dt,
      ),
    );
    this.wide = Math.max(0, this.wide - dt);
    this.slow = Math.max(0, this.slow - dt);
    this.updateDrops(dt);
    if (this.stageWait > 0) {
      this.stageWait -= dt;
      if (this.stageWait <= 0) {
        this.makeStage();
        this.ball.active = false;
        this.ball.vx = 200;
        this.ball.vy = -320;
      }
      return;
    }
    const b = this.ball;
    if (!b.active) {
      b.x = this.paddle;
      b.y = 476;
      if (input.action || input.tap) {
        b.active = true;
        Object.assign(b, this.prismLaunch);
        this.emit("jump", b.x, b.y);
        this.say("Find your angle", 1);
      }
      return;
    }
    this.trail.push({ x: b.x, y: b.y });
    if (this.trail.length > 24) this.trail.shift();
    const factor = this.slow > 0 ? 0.7 : 1,
      px = b.x,
      py = b.y;
    b.x += b.vx * dt * factor;
    b.y += b.vy * dt * factor;
    if (b.x < 18 || b.x > 942) {
      b.vx = b.x < 18 ? Math.abs(b.vx) : -Math.abs(b.vx);
      b.x = Math.max(18, Math.min(942, b.x));
    }
    if (b.y < 55) {
      b.vy = Math.abs(b.vy);
      b.y = 55;
    }
    const half = this.paddleWidth / 2;
    if (
      b.vy > 0 &&
      py <= 482 &&
      b.y >= 482 &&
      Math.abs(b.x - this.paddle) < half + 8
    ) {
      const angle =
          Math.max(-1, Math.min(1, (b.x - this.paddle) / (half + 8))) * 1.08,
        speed = Math.min(650, Math.hypot(b.vx, b.vy) + 8);
      b.vx = Math.sin(angle) * speed;
      b.vy = -Math.cos(angle) * speed;
      b.y = 481;
      this.hitCombo = 0;
      this.emit("move", b.x, b.y, 0xc8b2f6);
    }
    const hit = this.crystals.find((c) => circleHitsBox(b.x, b.y, 8, c));
    if (hit) {
      if (py + 8 <= hit.y || py - 8 >= hit.y + hit.height) {
        b.vy *= -1;
        b.y = py < hit.y ? hit.y - 8.1 : hit.y + hit.height + 8.1;
      } else {
        b.vx *= -1;
        b.x = px < hit.x ? hit.x - 8.1 : hit.x + hit.width + 8.1;
      }
      hit.hp--;
      this.emit("hit", b.x, b.y, hit.color);
      if (hit.hp <= 0) {
        this.crystals = this.crystals.filter((c) => c !== hit);
        this.hitCombo++;
        this.bestCombo = Math.max(this.bestCombo, this.hitCombo);
        this.score += 50 * Math.min(5, this.hitCombo);
        this.emit("clear", hit.x + 47, hit.y + 12, hit.color);
        if (this.crystals.length % 9 === 0)
          this.drops.push({
            x: hit.x + 47,
            y: hit.y,
            kind: this.crystals.length % 2 ? "wide" : "slow",
            age: 0,
          });
        if (!this.crystals.length) {
          this.score += 500 * this.stage;
          if (this.stage === 3) {
            this.finish(true);
            return;
          }
          this.stage++;
          this.stageWait = 2;
          this.say(`SECTOR CLEAR · NEXT: ${this.stage}/3`, 2);
          b.active = false;
          this.trail = [];
          this.drops = [];
        }
      }
    }
    if (b.y > 560) {
      this.lives--;
      b.active = false;
      b.vx = 220;
      b.vy = -320;
      this.trail = [];
      this.hitCombo = 0;
      this.say("BALL LOST · LAUNCH AGAIN");
      this.emit("hit", this.paddle, 490, 0xf49cac);
      if (this.lives <= 0) this.finish();
    }
  }
  tile(index: number) {
    if (this.kind !== "tile-shift" || this.ended || this.anim > 0) return false;
    const next = moveTile(this.board, index);
    if (next.every((v, i) => v === this.board[i])) return false;
    this.history.push(this.board.indexOf(0));
    this.previousBoard = [...this.board];
    this.board = next;
    this.moves++;
    this.anim = 0.14;
    this.hintTile = -1;
    this.emit(
      "move",
      292 + (index % 4) * 94 + 42,
      65 + Math.floor(index / 4) * 94 + 42,
    );
    if (isSolved(this.board)) {
      this.anim = 0;
      this.score = Math.max(
        100,
        20000 -
          this.moves * 40 -
          Math.floor(this.time) * 10 -
          this.hints * 600 -
          this.undos * 120,
      );
      this.finish(true);
    }
    return true;
  }
  undo() {
    if (
      this.kind !== "tile-shift" ||
      this.ended ||
      this.anim > 0 ||
      !this.history.length
    )
      return false;
    const index = this.history.pop()!;
    this.previousBoard = [...this.board];
    this.board = moveTile(this.board, index);
    this.undos++;
    this.moves++;
    this.anim = 0.14;
    this.hintTile = -1;
    this.emit("move", 480, 250);
    return true;
  }
  hint() {
    if (this.kind !== "tile-shift" || this.ended) return;
    const e = this.board.indexOf(0),
      options = [
        e - 4,
        e + 4,
        e % 4 ? e - 1 : -1,
        e % 4 < 3 ? e + 1 : -1,
      ].filter((i) => i >= 0 && i < 16);
    this.hintTile = options.reduce(
      (best, i) =>
        puzzleDistance(moveTile(this.board, i)) <
        puzzleDistance(moveTile(this.board, best))
          ? i
          : best,
      options[0],
    );
    this.hints++;
    this.say("SUGGESTED MOVE · −600 POINTS", 2);
  }
  get detail() {
    if (this.kind === "neon-dash")
      return `${this.lives} shields · ${Math.floor(this.distance / 10)}m · ${this.collected} shards · best chain ×${this.bestCombo}`;
    if (this.kind === "starfall")
      return `${this.lives} shields · Wave ${this.wave} · ${this.kills} drones · Nova ${Math.floor(this.energy)}%`;
    if (this.kind === "prism-break")
      return `${this.lives} lives · Sector ${this.stage}/3 · ${this.crystals.length} crystals · chain ×${this.hitCombo}`;
    return `${this.moves} moves · ${Math.floor(this.time)}s · ${this.board.filter((n, i) => n && n === i + 1).length}/15 in place · ${this.hints} hints · ${this.undos} undos`;
  }
}
export function puzzleDistance(board: readonly number[]) {
  return board.reduce(
    (n, t, i) =>
      t
        ? n +
          Math.abs(Math.floor(i / 4) - Math.floor((t - 1) / 4)) +
          Math.abs((i % 4) - ((t - 1) % 4))
        : n,
    0,
  );
}
