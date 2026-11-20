export const PLANET_ROUNDS = [
  { name: "Star Scramble", rule: "Collect stars. Each star earns 10 points." },
  {
    name: "Meteor Mayhem",
    rule: "Dodge the incoming meteors. Survive for points; hits cost 3.",
  },
  {
    name: "Color Clash",
    rule: "Stand on the numbered safe color when the timer closes. Safe tiles earn 5 points.",
  },
] as const;
export const PLANET_COLORS = [
  "#ef9a64",
  "#86cdb9",
  "#ac9be2",
  "#f1d37e",
  "#8fbfe3",
  "#ec99bd",
];
export type PlanetInput = { x: number; y: number };
export type PlanetPlayer = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  score: number;
  shield: number;
  active: boolean;
};
export type PlanetObject = {
  id: number;
  x: number;
  y: number;
  age: number;
  vx: number;
  vy: number;
};
export type PlanetState = {
  tick: number;
  round: number;
  time: number;
  countdown: number;
  complete: boolean;
  safe: number;
  players: PlanetPlayer[];
  objects: PlanetObject[];
};
export function planetTile(x: number, y: number) {
  return (Math.floor((x - 60) / 105) + Math.floor((y - 70) / 84) * 2 + 60) % 6;
}
/** Deterministic 60 Hz party game. The caller supplies only movement, never scores or positions. */
export class PlanetSimulation {
  state: PlanetState;
  private accumulator = 0;
  private seed: number;
  private serial = 0;
  private spawnAt = 0;
  private rewardAt = 1;
  private colorCycle = -1;
  constructor(
    roster: { id: string; name: string; color: string }[],
    seed = 17,
  ) {
    this.seed = seed >>> 0;
    this.state = {
      tick: 0,
      round: 0,
      time: 0,
      countdown: 3,
      complete: false,
      safe: 0,
      players: roster.map((p, i) => ({
        ...p,
        x: 210 + (i % 4) * 175,
        y: 200 + Math.floor(i / 4) * 150,
        score: 0,
        shield: 0,
        active: true,
      })),
      objects: [],
    };
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  exit(id: string) {
    const p = this.state.players.find((p) => p.id === id);
    if (p) p.active = false;
  }
  advance(delta: number, inputs: ReadonlyMap<string, PlanetInput>) {
    this.accumulator += Math.max(0, Math.min(0.25, delta));
    while (this.accumulator + 1e-9 >= 1 / 60) {
      this.accumulator -= 1 / 60;
      this.step(inputs);
    }
  }
  private step(inputs: ReadonlyMap<string, PlanetInput>) {
    const s = this.state,
      dt = 1 / 60;
    if (s.complete) return;
    s.tick++;
    if (!s.players.some((p) => p.active)) {
      s.complete = true;
      return;
    }
    if (s.countdown > 0) {
      s.countdown = Math.max(0, s.countdown - dt);
      return;
    }
    s.time += dt;
    for (const p of s.players) {
      p.shield = Math.max(0, p.shield - dt);
      if (!p.active) continue;
      const input = inputs.get(p.id) ?? { x: 0, y: 0 };
      const x = Number.isFinite(input.x)
          ? Math.max(-1, Math.min(1, input.x))
          : 0,
        y = Number.isFinite(input.y) ? Math.max(-1, Math.min(1, input.y)) : 0,
        length = Math.max(1, Math.hypot(x, y));
      p.x = Math.max(76, Math.min(884, p.x + (x / length) * 220 * dt));
      p.y = Math.max(86, Math.min(474, p.y + (y / length) * 220 * dt));
    }
    if (s.round === 0) {
      if (s.time >= this.spawnAt) {
        this.spawnAt += 0.55;
        s.objects.push({
          id: this.serial++,
          x: 95 + this.random() * 770,
          y: 105 + this.random() * 340,
          age: 0,
          vx: 0,
          vy: 0,
        });
      }
      for (const star of s.objects) {
        star.age += dt;
        const p = s.players
          .filter(
            (p) => p.active && Math.hypot(p.x - star.x, p.y - star.y) < 29,
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - star.x, a.y - star.y) -
              Math.hypot(b.x - star.x, b.y - star.y),
          )[0];
        if (p) {
          p.score += 10;
          star.age = 20;
        }
      }
      s.objects = s.objects.filter((o) => o.age < 12);
    } else if (s.round === 1) {
      if (s.time >= this.spawnAt) {
        this.spawnAt += 0.45;
        s.objects.push({
          id: this.serial++,
          x: 80 + this.random() * 800,
          y: 76,
          age: 0,
          vx: (this.random() - 0.5) * 95,
          vy: 130 + this.random() * 100,
        });
      }
      for (const meteor of s.objects) {
        meteor.age += dt;
        if (meteor.age < 0.85) continue;
        meteor.x += meteor.vx * dt;
        meteor.y += meteor.vy * dt;
        for (const p of s.players)
          if (
            p.active &&
            p.shield <= 0 &&
            Math.hypot(p.x - meteor.x, p.y - meteor.y) < 31
          ) {
            p.score = Math.max(0, p.score - 3);
            p.shield = 1.2;
          }
      }
      s.objects = s.objects.filter((o) => o.y < 530 && o.age < 7);
      if (s.time >= this.rewardAt) {
        this.rewardAt++;
        s.players
          .filter((p) => p.active && p.shield === 0)
          .forEach((p) => p.score++);
      }
    } else {
      const cycle = Math.floor(s.time / 4);
      if (cycle !== this.colorCycle) {
        this.colorCycle = cycle;
        s.safe = (cycle * 5 + 2) % 6;
      }
      if (s.time >= this.rewardAt * 4 - 0.01) {
        this.rewardAt++;
        for (const p of s.players)
          if (p.active) {
            if (planetTile(p.x, p.y) === s.safe) p.score += 5;
            else {
              p.score = Math.max(0, p.score - 3);
              p.shield = 1;
            }
          }
      }
    }
    if (s.time >= 20) {
      if (s.round === 2) {
        s.complete = true;
        return;
      }
      s.round++;
      s.time = 0;
      s.countdown = 4;
      s.objects = [];
      this.spawnAt = 0;
      this.rewardAt = 1;
      this.colorCycle = -1;
      s.players.forEach((p, i) => {
        p.x = 210 + (i % 4) * 175;
        p.y = 200 + Math.floor(i / 4) * 150;
        p.shield = 0;
      });
      if (s.round === 2) s.safe = 2;
    }
  }
}
