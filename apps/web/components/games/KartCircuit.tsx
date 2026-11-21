"use client";
import { useEffect, useRef } from "react";
import {
  RaceSimulation,
  projectToTrack,
  ghostDelta,
  cornerSpeed,
  HANDLING_VERSION,
  type TrackId,
  type TourResult,
  type RaceMode,
  type RaceDifficulty,
  type GhostFrame,
} from "@onlinearcade/core";
import type { EngineProps } from "./PhaserArcade";
import { createRaceView } from "./race-renderer";
import type { RaceView } from "./race-canvas";
import type { Replay } from "../../lib/racing-career";
import { isGameInput } from "../PlayScreen";
import type { RaceAudio } from "../../lib/race-audio";
export type RaceHud = {
  speed: number;
  lap: number;
  elapsedMs: number;
  lapMs: number;
  bestLapMs: number;
  lastLapMs: number;
  boost: number;
  progress: number;
  x: number;
  z: number;
  countdown: number;
  offRoad: boolean;
  finished: boolean;
  checkpoint: number;
  position: number;
  driftCharge: number;
  drifting: boolean;
  turbo: boolean;
  gear: string;
  wrongWay: boolean;
  brakeHint: boolean;
  ghostDelta: number | null;
  renderer: "3d" | "2d";
  cue: string;
  standings: {
    id: number;
    name: string;
    color: string;
    position: number;
    gap: number;
    finished: boolean;
    x: number;
    z: number;
  }[];
};
type Props = EngineProps<{ score: number; detail: string; ended: boolean }> & {
  trackId?: TrackId;
  mode: RaceMode;
  difficulty: RaceDifficulty;
  paint: string;
  onTourFinish: (outcome: TourResult, replay: Replay | null) => void;
  onRaceHud: (hud: RaceHud) => void;
  onPauseRequest: (toggle?: boolean) => void;
  quality: "balanced" | "high";
  ghostReplay: Replay | null;
  racingLine: boolean;
  audio: RaceAudio | null;
};
export default function KartCircuit({
  trackId = "sunset-bay",
  mode,
  difficulty,
  paint,
  onScore,
  onHud,
  onError,
  control,
  onTourFinish,
  onRaceHud,
  onPauseRequest,
  quality,
  ghostReplay,
  racingLine,
  audio,
}: Props) {
  const mount = useRef<HTMLDivElement>(null),
    callbacks = useRef({
      onScore,
      onHud,
      onError,
      onTourFinish,
      onRaceHud,
      onPauseRequest,
      ghostReplay,
      racingLine,
      audio,
    });
  callbacks.current = {
    onScore,
    onHud,
    onError,
    onTourFinish,
    onRaceHud,
    onPauseRequest,
    ghostReplay,
    racingLine,
    audio,
  };
  useEffect(() => {
    if (!mount.current) return;
    const target = mount.current;
    let sim = new RaceSimulation(trackId, mode, difficulty, paint),
      view: RaceView;
    try {
      view = createRaceView(target, sim, quality);
    } catch {
      callbacks.current.onError(
        "The racing engine could not start. Please close and try again.",
      );
      return;
    }
    let disposed = false,
      frame = 0,
      last = performance.now(),
      hudAt = 0,
      paused = false,
      reported = false,
      trace: GhostFrame[] = [],
      nextTrace = 0.1,
      replay = callbacks.current.ghostReplay?.frames || null,
      cue = "",
      cueUntil = 0;
    const keys = new Set<string>();
    const recordFrame = () => {
      const p = sim.player;
      trace.push({
        t: sim.time + p.penalty,
        x: p.x,
        z: p.z,
        heading: p.heading,
        progress: Math.max(trace.at(-1)?.progress || 0, p.raceProgress),
      });
    };
    recordFrame();
    const emit = (now: number, force = false) => {
      if (!force && now - hudAt < 90) return;
      hudAt = now;
      const p = sim.player,
        speed = Math.abs(p.speed),
        bestLap = p.lapTimes.length ? Math.min(...p.lapTimes) : 0;
      callbacks.current.onRaceHud({
        speed: Math.round(speed * 3.6),
        lap: Math.min(3, p.laps + 1),
        elapsedMs: Math.round((sim.time + p.penalty) * 1000),
        lapMs: Math.round((sim.time + p.penalty - p.lapStart) * 1000),
        bestLapMs: bestLap,
        lastLapMs: p.lapTimes.at(-1) || 0,
        boost: Math.round(p.energy),
        progress: p.progress,
        x: p.x,
        z: p.z,
        countdown: Math.max(0, Math.ceil(sim.countdown - 1e-8)),
        offRoad:
          projectToTrack(sim.samples, p.x, p.z).distance > sim.track.width / 2,
        finished: sim.finished,
        checkpoint: p.lastGate,
        position: sim.position,
        driftCharge: p.driftCharge,
        drifting: p.drifting,
        turbo: p.turbo > 0 || p.boosting,
        gear:
          p.speed < -0.5
            ? "R"
            : speed < 0.5
              ? "N"
              : String(Math.min(5, Math.floor(speed / 8) + 1)),
        wrongWay: p.wrongWay > 1,
        brakeHint:
          callbacks.current.racingLine &&
          speed > cornerSpeed(sim.samples, p.progress, sim.length, 16) + 3,
        ghostDelta:
          mode === "time-trial" && replay
            ? ghostDelta(replay, p.raceProgress, sim.time + p.penalty)
            : null,
        renderer: view.mode,
        cue: now < cueUntil ? cue : "",
        standings: sim.standings.map((car, i) => ({
          id: car.id,
          name: car.name,
          color: car.color,
          position: i + 1,
          gap: Math.round((p.raceProgress - car.raceProgress) * sim.length),
          finished: car.finishedAt !== null,
          x: car.x,
          z: car.z,
        })),
      });
      if (!sim.finished)
        callbacks.current.onHud({
          score: 0,
          detail: `${sim.track.name} · ${mode === "grand-prix" ? "Grand Prix · 4 AI rivals" : "Time Trial"}${view.mode === "2d" ? " · 2D compatibility" : ""}`,
          ended: false,
        });
    };
    const reset = () => {
      sim = new RaceSimulation(trackId, mode, difficulty, paint);
      reported = false;
      trace = [];
      nextTrace = 0.1;
      replay = callbacks.current.ghostReplay?.frames || null;
      keys.clear();
      cue = "";
      cueUntil = 0;
      last = performance.now();
      recordFrame();
      emit(last, true);
    };
    const key = (code: string, down: boolean) => {
      if (down && code === "KeyP") {
        callbacks.current.onPauseRequest(true);
        return;
      }
      if (down && (paused || sim.finished)) return;
      const already = keys.has(code);
      if (down) keys.add(code);
      else keys.delete(code);
      if (down && !already) {
        callbacks.current.audio?.unlock();
        if (code === "KeyR") sim.recover();
      }
    };
    const keyDown = (event: KeyboardEvent) => {
        if (!isGameInput(event)) return;
        if (event.repeat && event.code === "KeyP") return;
        if (
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
            event.code,
          )
        )
          event.preventDefault();
        key(event.code, true);
      },
      keyUp = (event: KeyboardEvent) => key(event.code, false),
      blur = () => {
        keys.clear();
        if (!paused && !sim.finished) callbacks.current.onPauseRequest();
      };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    control.current = {
      key,
      restart: reset,
      pause: (value) => {
        paused = value;
        keys.clear();
        last = performance.now();
        callbacks.current.audio?.update(sim.player, true);
      },
    };
    const observer = new ResizeObserver(view.resize);
    observer.observe(target);
    emit(last, true);
    const animate = (now: number) => {
      if (disposed) return;
      let dt = (now - last) / 1000;
      last = now;
      // Visibility/blur pause explicitly; a rendering hitch only drops excess time.
      dt = Math.min(dt, 0.25);
      if (!paused && !sim.finished) {
        sim.advance(dt, {
          throttle: keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0,
          brake: keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0,
          steer:
            Number(keys.has("KeyD") || keys.has("ArrowRight")) -
            Number(keys.has("KeyA") || keys.has("ArrowLeft")),
          drift: keys.has("Space") || keys.has("KeyZ"),
          boost: keys.has("ShiftLeft") || keys.has("ShiftRight"),
        });
        for (const event of sim.takeEvents()) {
          callbacks.current.audio?.cue(event);
          if (event.carId !== 0) continue;
          const text =
            event.type === "drift-boost"
              ? event.value > 1
                ? "SUPER TURBO!"
                : "MINI-TURBO!"
              : event.type === "lap"
                ? event.value === 2
                  ? "FINAL LAP"
                  : event.value < 3
                    ? "LAP 2"
                    : ""
                : event.type === "collision"
                  ? "CONTACT"
                  : event.type === "recover"
                    ? "RECOVERED · +2 SECONDS"
                    : event.type === "pad"
                      ? "BOOST STRIP"
                      : event.type === "go"
                        ? "GO!"
                        : "";
          if (text) {
            cue = text;
            cueUntil = now + 1300;
          }
        }
        if (
          mode === "time-trial" &&
          sim.countdown <= 0 &&
          sim.time >= nextTrace &&
          trace.length < 6100
        ) {
          recordFrame();
          nextTrace = sim.time + 0.1;
        }
        if (sim.finished && !reported && sim.outcome) {
          reported = true;
          if (mode === "time-trial" && trace.length < 6100) recordFrame();
          const ghost: Replay | null =
            mode === "time-trial" &&
            sim.player.recoveries === 0 &&
            trace.length < 6100
              ? {
                  version: HANDLING_VERSION,
                  durationMs: sim.outcome.result.durationMs,
                  frames: trace,
                }
              : null;
          callbacks.current.onTourFinish(sim.outcome, ghost);
          if (mode === "time-trial")
            callbacks.current.onScore(sim.outcome.result.score);
          callbacks.current.onHud({
            score: sim.outcome.result.score,
            detail: "Race complete",
            ended: true,
          });
        }
        emit(now, sim.finished);
      }
      callbacks.current.audio?.update(
        sim.player,
        paused || sim.finished || sim.countdown > 0,
      );
      view.draw(
        sim,
        paused ? 0 : dt,
        mode === "time-trial" ? replay : null,
        callbacks.current.racingLine,
      );
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      callbacks.current.audio?.update(sim.player, true);
      view.dispose();
      control.current = null;
    };
  }, [trackId, mode, difficulty, paint, quality, control]);
  return (
    <div
      className="canvas-wrap engine-canvas kart-canvas"
      ref={mount}
      aria-label="Sunset Circuit race track"
    />
  );
}
