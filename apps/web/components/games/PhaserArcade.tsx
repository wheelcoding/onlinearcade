"use client";
import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import {
  ArcadeSimulation,
  type ArcadeKind,
  type PuzzleDifficulty,
  type GameId,
} from "@onlinearcade/core";
import { createArcadeArt } from "./arcade-renderer";
import { createArcadeAudio } from "../../lib/arcade-audio";
export type GameControl = {
  key: (key: string, down: boolean) => void;
  restart: () => void;
  pause: (paused: boolean) => void;
};
export type EngineProps = {
  gameId: GameId;
  onScore: (score: number) => void;
  onHud: (hud: { score: number; detail: string; ended: boolean }) => void;
  onError: (message: string) => void;
  control: React.RefObject<GameControl | null>;
  muted?: boolean;
  puzzleDifficulty?: PuzzleDifficulty;
  onPauseRequest?: () => void;
};
export default function PhaserArcade({
  gameId,
  onScore,
  onHud,
  onError,
  control,
  muted = false,
  puzzleDifficulty = "normal",
  onPauseRequest,
}: EngineProps) {
  const mount = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onScore, onHud, onError, muted, onPauseRequest });
  callbacks.current = { onScore, onHud, onError, muted, onPauseRequest };
  useEffect(() => {
    let disposed = false,
      game: Phaser.Game | undefined;
    const audio = createArcadeAudio();
    import("phaser")
      .then(({ default: P }) => {
        if (disposed || !mount.current) return;
        class Arcade extends P.Scene {
          sim!: ArcadeSimulation;
          art!: ReturnType<typeof createArcadeArt>;
          keys = new Set<string>();
          paused = false;
          reported = false;
          hudAt = 0;
          pointer: { x: number; y: number } | null = null;
          dragging = false;
          pointerMode = false;
          tap: { x: number; y: number } | undefined;
          seed = Date.now();
          jumpPulse = 0;
          actionPulse = 0;
          create() {
            this.keys.clear();
            this.jumpPulse = 0;
            this.actionPulse = 0;
            this.pointerMode = false;
            this.dragging = false;
            this.paused = false;
            this.reported = false;
            this.hudAt = 0;
            this.pointer = null;
            this.tap = undefined;
            this.sim = new ArcadeSimulation(
              gameId as ArcadeKind,
              this.seed,
              puzzleDifficulty,
            );
            this.art = createArcadeArt(this, gameId);
            const act = (key: string, down: boolean) => {
              if (down) {
                audio.unlock();
                if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(key))
                  this.pointerMode = false;
              }
              if (key === "KeyP" && down) {
                callbacks.current.onPauseRequest?.();
                return;
              }
              if (this.paused || this.sim.ended) return;
              const was = this.keys.has(key);
              if (down) this.keys.add(key);
              else this.keys.delete(key);
              if (down && !was) {
                if (
                  gameId === "neon-dash" &&
                  ["Space", "ArrowUp"].includes(key)
                )
                  this.jumpPulse = 0.09;
                if (
                  gameId === "neon-dash"
                    ? ["ShiftLeft", "KeyX"].includes(key)
                    : key === "Space"
                )
                  this.actionPulse = 0.09;
                if (key === "KeyU") this.sim.undo();
                if (key === "KeyH") this.sim.hint();
                if (gameId === "tile-shift") {
                  const e = this.sim.board.indexOf(0),
                    index =
                      key === "ArrowLeft"
                        ? e % 4
                          ? e - 1
                          : -1
                        : key === "ArrowRight"
                          ? e % 4 < 3
                            ? e + 1
                            : -1
                          : key === "ArrowUp"
                            ? e - 4
                            : key === "ArrowDown"
                              ? e + 4
                              : -1;
                  if (index >= 0) this.sim.tile(index);
                }
              }
            };
            this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
              if (
                e.target instanceof HTMLSelectElement ||
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
              )
                return;
              if (
                [
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "Space",
                ].includes(e.code)
              )
                e.preventDefault();
              if (e.repeat && ["KeyP", "KeyH", "KeyU"].includes(e.code)) return;
              act(e.code, true);
            });
            this.input.keyboard!.on("keyup", (e: KeyboardEvent) =>
              act(e.code, false),
            );
            this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
              audio.unlock();
              if (this.paused || this.sim.ended) return;
              this.dragging = true;
              this.pointerMode = true;
              this.pointer = { x: p.x, y: p.y };
              this.tap =
                gameId === "tile-shift"
                  ? { x: p.x + 156, y: p.y - 67 }
                  : { x: p.x, y: p.y };
              if (gameId === "neon-dash") {
                this.keys.add("Space");
                this.jumpPulse = 0.09;
              }
            });
            this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
              this.pointerMode = true;
              this.pointer = { x: p.x, y: p.y };
            });
            this.input.on("pointerup", () => {
              this.dragging = false;
              this.keys.delete("Space");
            });
            this.input.on("pointerupoutside", () => {
              this.dragging = false;
              this.keys.delete("Space");
            });
            const blur = () => {
              this.keys.clear();
              this.jumpPulse = 0;
              this.actionPulse = 0;
              this.dragging = false;
              this.pointer = null;
            };
            this.game.events.on(P.Core.Events.BLUR, blur);
            const sound = (kind: string) => audio.cue(kind);
            this.game.events.on("arcade:sound", sound);
            this.events.once("shutdown", () => {
              this.game.events.off(P.Core.Events.BLUR, blur);
              this.game.events.off("arcade:sound", sound);
              this.art.dispose();
            });
            control.current = {
              key: act,
              restart: () => {
                this.seed = Date.now();
                this.scene.restart();
              },
              pause: (value) => {
                this.paused = value;
                this.keys.clear();
                this.jumpPulse = 0;
                this.actionPulse = 0;
                this.dragging = false;
                this.tap = undefined;
              },
            };
            this.art.draw(this.sim, 0, null);
            this.hud();
          }
          hud() {
            callbacks.current.onHud({
              score: this.sim.totalScore,
              detail: this.sim.ended
                ? (this.sim.won ? "CHALLENGE COMPLETE · " : "RUN COMPLETE · ") +
                  this.sim.detail
                : this.sim.detail,
              ended: this.sim.ended,
            });
          }
          update(now: number, delta: number) {
            if (this.paused) return;
            audio.setMuted(callbacks.current.muted);
            const dt = Math.min(0.1, delta / 1000);
            if (!this.sim.ended) {
              const input = {
                x:
                  Number(this.keys.has("ArrowRight") || this.keys.has("KeyD")) -
                  Number(this.keys.has("ArrowLeft") || this.keys.has("KeyA")),
                y:
                  Number(this.keys.has("ArrowDown") || this.keys.has("KeyS")) -
                  Number(this.keys.has("ArrowUp") || this.keys.has("KeyW")),
                jump:
                  this.jumpPulse > 0 ||
                  this.keys.has("Space") ||
                  this.keys.has("ArrowUp"),
                action:
                  this.actionPulse > 0 ||
                  (gameId === "neon-dash"
                    ? this.keys.has("ShiftLeft") || this.keys.has("KeyX")
                    : this.keys.has("Space")),
                tap: this.tap,
                pointer:
                  gameId === "prism-break" && this.pointerMode
                    ? this.pointer || undefined
                    : gameId === "starfall" && this.dragging
                      ? this.pointer || undefined
                      : undefined,
              };
              const steps = this.sim.advance(dt, input);
              if (steps) {
                this.tap = undefined;
                this.jumpPulse = Math.max(0, this.jumpPulse - dt);
                this.actionPulse = Math.max(0, this.actionPulse - dt);
              }
            }
            this.art.draw(this.sim, dt, this.pointer);
            if (this.sim.ended && !this.reported) {
              this.reported = true;
              callbacks.current.onScore(this.sim.totalScore);
              this.hud();
            } else if (now - this.hudAt > 120) {
              this.hudAt = now;
              this.hud();
            }
          }
        }
        game = new P.Game({
          type: P.AUTO,
          parent: mount.current,
          width: gameId === "tile-shift" ? 640 : 960,
          height: gameId === "tile-shift" ? 640 : 540,
          scale: { mode: P.Scale.FIT, autoCenter: P.Scale.CENTER_BOTH },
          scene: Arcade,
          render: { antialias: true },
          input: { activePointers: 3 },
        });
      })
      .catch(() =>
        callbacks.current.onError(
          "This game could not load. Close it and try again.",
        ),
      );
    return () => {
      disposed = true;
      control.current = null;
      game?.destroy(true);
      audio.dispose();
    };
  }, [gameId, control, puzzleDifficulty]);
  return (
    <div
      ref={mount}
      className={`canvas-wrap engine-canvas ${gameId === "tile-shift" ? "puzzle-canvas" : ""}`}
      aria-label={`${gameId} interactive game canvas`}
    />
  );
}
