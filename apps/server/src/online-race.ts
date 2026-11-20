import {
  RaceSimulation,
  idleInput,
  type RaceInput,
  type TrackId,
} from "@onlinearcade/core";
import type { RaceCommand, RacePacket, RaceRoster } from "./protocol.js";
/** A room owns one authoritative simulation. Clients can send controls, never poses or scores. */
export class OnlineRace {
  readonly sim: RaceSimulation;
  readonly inputs = new Map<
    number,
    { input: RaceInput; at: number; seq: number }
  >();
  readonly withdrawn = new Set<number>();
  complete = false;
  private lastRecover = new Map<number, number>();
  constructor(
    readonly id: string,
    track: TrackId,
    readonly roster: RaceRoster[],
    readonly createdAt = Date.now(),
  ) {
    this.sim = new RaceSimulation(
      track,
      "grand-prix",
      "club",
      roster[0].color,
      roster,
    );
  }
  command(memberId: string, raw: unknown, now = Date.now()) {
    const index = this.roster.findIndex((p) => p.memberId === memberId);
    if (
      index < 0 ||
      this.complete ||
      this.withdrawn.has(index) ||
      !raw ||
      typeof raw !== "object"
    )
      return false;
    const p = raw as RaceCommand,
      input = p.input;
    if (
      p.sessionId !== this.id ||
      !Number.isSafeInteger(p.seq) ||
      p.seq < 0 ||
      p.seq <= (this.inputs.get(index)?.seq ?? -1) ||
      !input ||
      ![input.throttle, input.brake, input.steer].every(Number.isFinite) ||
      input.throttle < 0 ||
      input.throttle > 1 ||
      input.brake < 0 ||
      input.brake > 1 ||
      Math.abs(input.steer) > 1 ||
      typeof input.drift !== "boolean" ||
      typeof input.boost !== "boolean" ||
      (p.recover !== undefined && typeof p.recover !== "boolean")
    )
      return false;
    // Copy only approved controls, ignoring supplied positions, identities and scores.
    this.inputs.set(index, {
      input: {
        throttle: input.throttle,
        brake: input.brake,
        steer: input.steer,
        drift: input.drift,
        boost: input.boost,
      },
      at: now,
      seq: p.seq,
    });
    if (p.recover && now - (this.lastRecover.get(index) ?? 0) > 1500) {
      this.sim.recover(index);
      this.lastRecover.set(index, now);
    }
    return true;
  }
  exit(memberId: string) {
    const index = this.roster.findIndex((p) => p.memberId === memberId);
    if (index >= 0 && this.sim.cars[index].finishedAt === null) {
      this.withdrawn.add(index);
      this.inputs.delete(index);
    }
  }
  advance(dt: number, connected: ReadonlySet<string>, now = Date.now()) {
    if (this.complete) return;
    const controls = new Map<number, RaceInput>();
    this.roster.forEach((p, i) => {
      const latest = this.inputs.get(i);
      if (
        !this.withdrawn.has(i) &&
        connected.has(p.memberId) &&
        latest &&
        now - latest.at < 300
      )
        controls.set(i, latest.input);
    });
    this.sim.advance(dt, idleInput(), controls);
    this.sim.takeEvents();
    if (now - this.createdAt >= 600000)
      this.sim.cars.forEach((car, i) => {
        if (car.finishedAt === null) this.withdrawn.add(i);
      });
    this.complete =
      this.sim.cars.every(
        (c, i) => c.finishedAt !== null || this.withdrawn.has(i),
      ) || now - this.createdAt >= 600000;
  }
  packet(): RacePacket {
    return {
      sessionId: this.id,
      tick: this.sim.tick,
      time: this.sim.time,
      countdown: this.sim.countdown,
      cars: this.sim.cars,
      withdrawn: [...this.withdrawn],
      complete: this.complete,
    };
  }
}
