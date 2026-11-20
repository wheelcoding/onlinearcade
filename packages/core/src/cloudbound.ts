export const CLOUD_CHAPTERS = [
  "Dawn Gardens",
  "Azure Ruins",
  "Starlight Summit",
] as const;
export type CloudPlatform = {
  id: number;
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  kind: "island" | "moving" | "crumble" | "checkpoint" | "goal";
};
export type CloudInput = {
  x: number;
  forward: number;
  jump: boolean;
  dash: boolean;
};
export type CloudResult = {
  version: 1;
  elapsedMs: number;
  falls: number;
  crystals: number;
  medal: 1 | 2 | 3;
};
export const CLOUD_PLATFORMS: readonly CloudPlatform[] = Array.from(
  { length: 31 },
  (_, id) => ({
    id,
    x: Math.sin(id * 0.77) * 4.2,
    y: id * 0.48,
    z:
      id <= 10
        ? id * 5.8
        : id <= 20
          ? 58 + (id - 10) * 6.2
          : 120 + (id - 20) * 6.6,
    w: id % 10 === 0 ? 7 : id < 10 ? 4.6 : id < 20 ? 4 : 3.4,
    d: id % 10 === 0 ? 7 : id < 10 ? 4.6 : id < 20 ? 4 : 3.4,
    kind:
      id === 30
        ? "goal"
        : id % 10 === 0
          ? "checkpoint"
          : id % 7 === 4
            ? "moving"
            : id % 6 === 3
              ? "crumble"
              : "island",
  }),
);
export const cloudIdle = (): CloudInput => ({
  x: 0,
  forward: 0,
  jump: false,
  dash: false,
});
export class CloudSimulation {
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  time = 0;
  falls = 0;
  checkpoint = 0;
  reached = 0;
  standing: number | null = 0;
  jumps = 0;
  dashLeft = 0;
  dashCooldown = 0;
  landPulse = 0;
  respawnPulse = 0;
  finished = false;
  result: CloudResult | null = null;
  readonly crystals = new Set<number>();
  readonly crumble = new Map<number, { left: number; returnAt: number }>();
  private queuedJumps = 0;
  private queuedDash = false;
  private gestureTTL = 0;
  private accumulator = 0;
  private coyote = 0.12;
  private buffer = 0;
  private lastJump = false;
  private lastDash = false;
  constructor() {
    this.respawn(false);
  }
  pose(p: CloudPlatform, time = this.time) {
    return {
      x: p.x + (p.kind === "moving" ? Math.sin(time * 1.4 + p.id) * 1.15 : 0),
      y: p.y,
      z: p.z,
    };
  }
  visible(p: CloudPlatform) {
    return (
      p.kind !== "crumble" ||
      !this.crumble.has(p.id) ||
      this.crumble.get(p.id)!.left > 0
    );
  }
  advance(delta: number, input: CloudInput) {
    this.accumulator += Math.max(0, Math.min(0.25, delta));
    while (this.accumulator + 1e-9 >= 1 / 120) {
      this.accumulator -= 1 / 120;
      this.step(input, 1 / 120);
    }
  }
  queueJump() {
    if (!this.finished) {
      this.queuedJumps = Math.min(2, this.queuedJumps + 1);
      this.gestureTTL = 0.15;
    }
  }
  queueDash() {
    if (!this.finished) {
      this.queuedDash = true;
      this.gestureTTL = 0.15;
    }
  }
  clearInput() {
    this.queuedJumps = 0;
    this.queuedDash = false;
    this.gestureTTL = 0;
    this.lastJump = false;
    this.lastDash = false;
    this.buffer = 0;
  }
  respawn(penalty = true) {
    if (this.finished) return;
    if (penalty) {
      this.falls++;
      this.respawnPulse = 1;
    }
    const p = CLOUD_PLATFORMS[this.checkpoint],
      v = this.pose(p);
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    this.vx = this.vy = this.vz = 0;
    this.standing = p.id;
    this.jumps = 0;
    this.coyote = 0.12;
    this.buffer = 0;
    this.dashLeft = 0;
    this.dashCooldown = 0;
    this.clearInput();
    this.crumble.clear();
  }
  private step(input: CloudInput, dt: number) {
    if (this.finished) return;
    const oldTime = this.time;
    this.time += dt;
    this.landPulse = Math.max(0, this.landPulse - dt * 3);
    this.respawnPulse = Math.max(0, this.respawnPulse - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashLeft = Math.max(0, this.dashLeft - dt);
    this.buffer = Math.max(0, this.buffer - dt);
    for (const [id, c] of this.crumble) {
      if (c.left > 0) {
        c.left -= dt;
        if (c.left <= 0) c.returnAt = this.time + 3;
      } else if (this.time >= c.returnAt) this.crumble.delete(id);
    }
    if (this.standing !== null) {
      const p = CLOUD_PLATFORMS[this.standing],
        a = this.pose(p, oldTime),
        b = this.pose(p);
      this.x += b.x - a.x;
      this.z += b.z - a.z;
      if (!this.visible(p)) this.standing = null;
    }
    if (this.standing !== null) {
      this.coyote = 0.12;
      this.jumps = 0;
    } else this.coyote = Math.max(0, this.coyote - dt);
    this.gestureTTL = Math.max(0, this.gestureTTL - dt);
    if (this.gestureTTL === 0) {
      this.queuedJumps = 0;
      this.queuedDash = false;
    }
    if (this.queuedJumps > 0) {
      this.queuedJumps--;
      this.buffer = 0.13;
    } else if (input.jump && !this.lastJump) this.buffer = 0.13;
    this.lastJump = input.jump;
    if (
      this.buffer > 0 &&
      (this.standing !== null || this.coyote > 0 || this.jumps < 2)
    ) {
      const first = this.standing !== null || this.coyote > 0;
      this.vy = first ? 9.4 : 8.4;
      this.jumps = first ? 1 : 2;
      this.standing = null;
      this.coyote = 0;
      this.buffer = 0;
    }
    const rawX = Number.isFinite(input.x)
        ? Math.max(-1, Math.min(1, input.x))
        : 0,
      rawZ = Number.isFinite(input.forward)
        ? Math.max(-1, Math.min(1, input.forward))
        : 0,
      len = Math.max(1, Math.hypot(rawX, rawZ));
    // The follow camera looks along +Z: its screen-right axis is world -X.
    const dx = -rawX / len,
      dz = rawZ / len;
    if (
      (this.queuedDash || (input.dash && !this.lastDash)) &&
      this.dashCooldown === 0
    ) {
      const length = Math.hypot(dx, dz);
      this.vx = (length > 0.1 ? dx / length : 0) * 15;
      this.vz = (length > 0.1 ? dz / length : 1) * 15;
      this.dashLeft = 0.18;
      this.dashCooldown = 1.25;
    }
    this.queuedDash = false;
    this.lastDash = input.dash;
    if (this.dashLeft === 0) {
      const blend = 1 - Math.exp(-dt * (this.standing !== null ? 15 : 8));
      this.vx += (dx * 7.2 - this.vx) * blend;
      this.vz += (dz * 7.2 - this.vz) * blend;
    }
    const ox = this.x,
      oy = this.y,
      oz = this.z;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    if (this.standing !== null) {
      const p = CLOUD_PLATFORMS[this.standing],
        v = this.pose(p);
      if (
        Math.abs(this.x - v.x) > p.w / 2 + 0.18 ||
        Math.abs(this.z - v.z) > p.d / 2 + 0.18
      )
        this.standing = null;
    }
    if (this.standing === null) {
      this.vy -= 23 * dt;
      this.y += this.vy * dt;
      for (const p of CLOUD_PLATFORMS) {
        if (!this.visible(p)) continue;
        const v = this.pose(p),
          halfW = p.w / 2 + 0.28,
          halfD = p.d / 2 + 0.28;
        if (this.vy <= 0 && oy >= v.y - 0.015 && this.y <= v.y) {
          const t = (oy - v.y) / Math.max(0.00001, oy - this.y),
            crossX = ox + (this.x - ox) * t,
            crossZ = oz + (this.z - oz) * t;
          if (
            Math.abs(crossX - v.x) <= halfW &&
            Math.abs(crossZ - v.z) <= halfD
          ) {
            this.y = v.y;
            this.vy = 0;
            this.standing = p.id;
            this.jumps = 0;
            this.coyote = 0.12;
            this.landPulse = 1;
            this.reached = Math.max(this.reached, p.id);
            if (p.kind === "checkpoint" && p.id > this.checkpoint)
              this.checkpoint = p.id;
            if (p.kind === "crumble" && !this.crumble.has(p.id))
              this.crumble.set(p.id, { left: 1.3, returnAt: 0 });
            break;
          }
        }
        // Solid undersides and sides keep jumps from passing through the islands.
        if (Math.abs(this.x - v.x) < halfW && Math.abs(this.z - v.z) < halfD) {
          const bottom = v.y - 0.8;
          if (this.vy > 0 && oy + 1.65 <= bottom && this.y + 1.65 >= bottom) {
            this.y = bottom - 1.65;
            this.vy = 0;
          } else if (this.y < v.y - 0.1 && this.y + 1.65 > bottom) {
            if (Math.abs(ox - v.x) >= halfW) {
              this.x = v.x + Math.sign(ox - v.x) * halfW;
              this.vx = 0;
            } else if (Math.abs(oz - v.z) >= halfD) {
              this.z = v.z + Math.sign(oz - v.z) * halfD;
              this.vz = 0;
            }
          }
        }
      }
    }
    for (const p of CLOUD_PLATFORMS) {
      if (this.crystals.has(p.id)) continue;
      const v = this.pose(p);
      if (
        Math.hypot(this.x - v.x, this.z - v.z) < 0.95 &&
        this.y <= v.y + 2.1 &&
        this.y + 1.6 >= v.y + 1.4
      )
        this.crystals.add(p.id);
    }
    if (this.y < CLOUD_PLATFORMS[this.checkpoint].y - 15) this.respawn();
    if (
      this.standing === 30 &&
      Math.hypot(
        this.x - CLOUD_PLATFORMS[30].x,
        this.z - CLOUD_PLATFORMS[30].z,
      ) < 2
    ) {
      this.finished = true;
      const elapsedMs = Math.round((this.time + this.falls * 3) * 1000);
      this.result = {
        version: 1,
        elapsedMs,
        falls: this.falls,
        crystals: this.crystals.size,
        medal:
          elapsedMs < 100000 && this.falls === 0
            ? 3
            : elapsedMs < 160000
              ? 2
              : 1,
      };
    }
  }
}
