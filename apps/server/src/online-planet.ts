import { PlanetSimulation, type PlanetInput } from "@onlinearcade/core";
import type { RaceRoster } from "./protocol.js";
export class OnlinePlanet {
  readonly sim: PlanetSimulation;
  readonly inputs = new Map<
    string,
    { seq: number; at: number; input: PlanetInput }
  >();
  get complete() {
    return this.sim.state.complete;
  }
  constructor(
    readonly id: string,
    roster: RaceRoster[],
    seed = Date.now(),
  ) {
    this.sim = new PlanetSimulation(
      roster.map((p) => ({ id: p.memberId, name: p.name, color: p.color })),
      seed,
    );
  }
  command(id: string, raw: any, now = Date.now()) {
    if (
      this.complete ||
      !this.sim.state.players.some((p) => p.id === id && p.active) ||
      raw?.sessionId !== this.id ||
      !Number.isSafeInteger(raw.seq) ||
      raw.seq < 0 ||
      raw.seq <= (this.inputs.get(id)?.seq ?? -1) ||
      !raw.input ||
      !Number.isFinite(raw.input.x) ||
      !Number.isFinite(raw.input.y) ||
      Math.abs(raw.input.x) > 1 ||
      Math.abs(raw.input.y) > 1
    )
      return false;
    this.inputs.set(id, {
      seq: raw.seq,
      at: now,
      input: { x: raw.input.x, y: raw.input.y },
    });
    return true;
  }
  exit(id: string) {
    this.sim.exit(id);
    this.inputs.delete(id);
  }
  advance(dt: number, connected: ReadonlySet<string>, now = Date.now()) {
    const inputs = new Map<string, PlanetInput>();
    for (const [id, p] of this.inputs)
      if (connected.has(id) && now - p.at < 300) inputs.set(id, p.input);
    this.sim.advance(dt, inputs);
  }
  packet() {
    return { sessionId: this.id, ...this.sim.state };
  }
}
