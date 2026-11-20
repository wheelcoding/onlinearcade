import { BoostballSimulation, type BallInput } from "@onlinearcade/core";
import type { RaceRoster } from "./protocol.js";
export class OnlineBall {
  readonly sim: BoostballSimulation;
  readonly inputs = new Map<
    string,
    { seq: number; at: number; input: BallInput }
  >();
  get complete() {
    return this.sim.state.complete;
  }
  constructor(
    readonly id: string,
    roster: RaceRoster[],
  ) {
    this.sim = new BoostballSimulation(
      roster.map((p) => ({ id: p.memberId, name: p.name, color: p.color })),
    );
  }
  command(id: string, raw: any, now = Date.now()) {
    if (
      this.complete ||
      !this.sim.state.cars.some((p) => p.id === id && p.active) ||
      raw?.sessionId !== this.id ||
      !Number.isSafeInteger(raw.seq) ||
      raw.seq < 0 ||
      raw.seq <= (this.inputs.get(id)?.seq ?? -1) ||
      !raw.input ||
      typeof raw.input.boost !== "boolean" ||
      typeof raw.input.dodge !== "boolean" ||
      !Number.isFinite(raw.input.throttle) ||
      !Number.isFinite(raw.input.steer) ||
      Math.abs(raw.input.throttle) > 1 ||
      Math.abs(raw.input.steer) > 1
    )
      return false;
    this.inputs.set(id, {
      seq: raw.seq,
      at: now,
      input: {
        throttle: raw.input.throttle,
        steer: raw.input.steer,
        boost: raw.input.boost,
        dodge: raw.input.dodge,
      },
    });
    return true;
  }
  exit(id: string) {
    this.sim.exit(id);
    this.inputs.delete(id);
  }
  advance(dt: number, connected: ReadonlySet<string>, now = Date.now()) {
    const inputs = new Map<string, BallInput>();
    for (const [id, p] of this.inputs)
      if (connected.has(id) && now - p.at < 300) inputs.set(id, p.input);
    this.sim.advance(dt, inputs);
  }
  packet() {
    return { sessionId: this.id, ...this.sim.state };
  }
}
