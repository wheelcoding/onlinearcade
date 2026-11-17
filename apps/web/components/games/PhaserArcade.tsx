"use client";
import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import {
  moveTile,
  isSolved,
  shuffledBoard,
  circleHitsBox,
  type GameId,
} from "@onlinearcade/core";
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
};
export default function PhaserArcade({
  gameId,
  onScore,
  onHud,
  onError,
  control,
}: EngineProps) {
  const mount = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onScore, onHud, onError });
  callbacks.current = { onScore, onHud, onError };
  useEffect(() => {
    let disposed = false;
    let game: Phaser.Game | undefined;
    import("phaser")
      .then(({ default: P }) => {
        if (disposed || !mount.current) return;
        class Arcade extends P.Scene {
          gfx!: Phaser.GameObjects.Graphics;
          keys = new Set<string>();
          score = 0;
          lives = 3;
          ended = false;
          paused = false;
          clock = 0;
          lastHud = -1;
          ship = { x: 480, y: 450 };
          shots: { x: number; y: number }[] = [];
          enemies: { x: number; y: number; speed: number; hp: number }[] = [];
          particles: {
            x: number;
            y: number;
            vx: number;
            vy: number;
            life: number;
            color: number;
          }[] = [];
          spawn = 0;
          fire = 0;
          invulnerable = 0;
          paddle = 480;
          ball = { x: 480, y: 450, vx: 230, vy: -300, active: false };
          bricks: {
            x: number;
            y: number;
            width: number;
            height: number;
            color: number;
          }[] = [];
          board: number[] = [];
          moves = 0;
          tileLabels: Phaser.GameObjects.Text[] = [];
          stars: { x: number; y: number; z: number }[] = [];
          create() {
            this.gfx = this.add.graphics();
            this.keys.clear();
            this.score = 0;
            this.lives = 3;
            this.ended = false;
            this.paused = false;
            this.clock = 0;
            this.lastHud = -1;
            this.shots = [];
            this.enemies = [];
            this.particles = [];
            this.spawn = 0;
            this.fire = 0;
            this.invulnerable = 0;
            this.ship = { x: 480, y: 450 };
            this.paddle = 480;
            this.ball = { x: 480, y: 450, vx: 230, vy: -300, active: false };
            this.moves = 0;
            this.board = shuffledBoard(Date.now());
            this.stars = Array.from({ length: 90 }, () => ({
              x: Math.random() * 960,
              y: Math.random() * 540,
              z: Math.random() + 0.25,
            }));
            this.bricks = Array.from({ length: 48 }, (_, i) => ({
              x: 64 + (i % 8) * 105,
              y: 80 + Math.floor(i / 8) * 35,
              width: 94,
              height: 24,
              color: [
                0xf6a2b4, 0xffbb88, 0xf6de9c, 0xb8dca7, 0x8ed9d5, 0xb6a3eb,
              ][Math.floor(i / 8)],
            }));
            this.tileLabels = Array.from({ length: 16 }, () =>
              this.add
                .text(0, 0, "", {
                  fontFamily: "Arial",
                  fontSize: "29px",
                  fontStyle: "bold",
                  color: "#1d3040",
                })
                .setOrigin(0.5),
            );
            this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
              const key = e.code;
              this.keys.add(key);
              if (
                [
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "Space",
                ].includes(key)
              )
                e.preventDefault();
              if (!e.repeat) this.keyAction(key);
            });
            this.input.keyboard!.on("keyup", (e: KeyboardEvent) =>
              this.keys.delete(e.code),
            );
            this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
              if (this.paused) return;
              if (gameId === "starfall" && p.isDown) {
                this.ship.x = P.Math.Clamp(p.x, 25, 935);
                this.ship.y = P.Math.Clamp(p.y, 50, 510);
              }
              if (gameId === "prism-break")
                this.paddle = P.Math.Clamp(p.x, 65, 895);
            });
            this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
              if (this.paused || this.ended) return;
              if (gameId === "prism-break") this.ball.active = true;
              if (gameId === "tile-shift") {
                const col = Math.floor((p.x - 292) / 94),
                  row = Math.floor((p.y - 65) / 94);
                if (col >= 0 && col < 4 && row >= 0 && row < 4)
                  this.tile(row * 4 + col);
              }
            });
            this.game.events.on(P.Core.Events.BLUR, this.blur, this);
            this.events.once("shutdown", () =>
              this.game.events.off(P.Core.Events.BLUR, this.blur, this),
            );
            control.current = {
              key: (key, down) => {
                if (down) {
                  this.keys.add(key);
                  this.keyAction(key);
                } else this.keys.delete(key);
              },
              restart: () => this.scene.restart(),
              pause: (paused) => {
                this.paused = paused;
                this.keys.clear();
              },
            };
            this.hud();
          }
          blur() {
            this.keys.clear();
          }
          keyAction(key: string) {
            if (this.paused || this.ended) return;
            if (key === "Space") this.ball.active = true;
            if (gameId === "tile-shift") {
              const e = this.board.indexOf(0),
                target =
                  key === "ArrowLeft"
                    ? e % 4 > 0
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
              this.tile(target);
            }
          }
          tile(index: number) {
            const next = moveTile(this.board, index);
            if (next.some((v, i) => v !== this.board[i])) {
              this.moves++;
              this.board = next;
              this.burst(480, 250, 0xa6ead2, 5);
              if (isSolved(next)) {
                this.score = Math.max(
                  100,
                  20000 - this.moves * 40 - Math.floor(this.clock) * 10,
                );
                this.finish("Puzzle solved!");
              }
              this.hud();
            }
          }
          burst(x: number, y: number, color: number, count = 18) {
            for (let i = 0; i < count; i++) {
              const a = Math.random() * Math.PI * 2,
                s = 50 + Math.random() * 190;
              this.particles.push({
                x,
                y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: 0.4 + Math.random() * 0.4,
                color,
              });
            }
          }
          finish(detail: string) {
            if (this.ended) return;
            this.ended = true;
            callbacks.current.onScore(this.score);
            callbacks.current.onHud({ score: this.score, detail, ended: true });
          }
          hud() {
            if (this.ended) return;
            callbacks.current.onHud({
              score: this.score,
              detail:
                gameId === "starfall"
                  ? `${this.lives} shields · Wave ${1 + Math.floor(this.clock / 15)}`
                  : gameId === "prism-break"
                    ? `${this.lives} lives · ${this.bricks.length} crystals left`
                    : `${this.moves} moves · ${Math.floor(this.clock)}s`,
              ended: false,
            });
          }
          update(_time: number, delta: number) {
            if (this.paused) return;
            const dt = Math.min(delta, 40) / 1000;
            const g = this.gfx;
            g.clear();
            g.fillStyle(gameId === "tile-shift" ? 0x132632 : 0x11172d);
            g.fillRect(0, 0, 960, 540);
            for (const s of this.stars) {
              if (!this.ended) s.y = (s.y + dt * 25 * s.z) % 540;
              g.fillStyle(0xbec8ed, 0.25 + s.z * 0.35);
              g.fillCircle(s.x, s.y, s.z * 1.4);
            }
            g.lineStyle(1, 0x819bcc, 0.06);
            for (let x = 0; x < 960; x += 60) g.lineBetween(x, 0, x, 540);
            for (let y = 0; y < 540; y += 60) g.lineBetween(0, y, 960, y);
            if (!this.ended) {
              this.clock += dt;
              if (gameId === "starfall") this.shooter(dt);
              if (gameId === "prism-break") this.breaker(dt);
              if (Math.floor(this.clock) !== this.lastHud) {
                this.lastHud = Math.floor(this.clock);
                this.hud();
              }
            }
            if (gameId === "starfall") {
              for (const e of this.enemies) {
                g.fillStyle(0xef8b9f, 0.12);
                g.fillCircle(e.x, e.y, 32);
                g.fillStyle(e.hp > 1 ? 0xc5a7ee : 0xf69db0);
                g.fillTriangle(
                  e.x,
                  e.y + 18,
                  e.x - 22,
                  e.y - 13,
                  e.x + 22,
                  e.y - 13,
                );
                g.fillStyle(0x513655);
                g.fillCircle(e.x, e.y, 7);
              }
              for (const b of this.shots) {
                g.fillStyle(0x83ffe0, 0.15);
                g.fillRoundedRect(b.x - 7, b.y - 15, 14, 28, 6);
                g.fillStyle(0xc6fff1);
                g.fillRoundedRect(b.x - 2, b.y - 13, 4, 22, 2);
              }
              if (
                this.invulnerable <= 0 ||
                Math.floor(this.clock * 12) % 2 === 0
              ) {
                g.fillStyle(0xa0f5d7, 0.12);
                g.fillCircle(this.ship.x, this.ship.y, 35);
                g.fillStyle(0xa7f3db);
                g.fillTriangle(
                  this.ship.x,
                  this.ship.y - 23,
                  this.ship.x - 23,
                  this.ship.y + 20,
                  this.ship.x + 23,
                  this.ship.y + 20,
                );
                g.fillStyle(0x35455d);
                g.fillTriangle(
                  this.ship.x,
                  this.ship.y - 12,
                  this.ship.x - 8,
                  this.ship.y + 12,
                  this.ship.x + 8,
                  this.ship.y + 12,
                );
                g.fillStyle(0xffb47e);
                g.fillTriangle(
                  this.ship.x - 6,
                  this.ship.y + 20,
                  this.ship.x + 6,
                  this.ship.y + 20,
                  this.ship.x,
                  this.ship.y + 32 + Math.random() * 12,
                );
              }
            }
            if (gameId === "prism-break") {
              for (const b of this.bricks) {
                g.fillStyle(b.color, 0.12);
                g.fillRoundedRect(
                  b.x - 3,
                  b.y - 3,
                  b.width + 6,
                  b.height + 6,
                  7,
                );
                g.fillStyle(b.color);
                g.fillRoundedRect(b.x, b.y, b.width, b.height, 5);
                g.fillStyle(0xffffff, 0.35);
                g.fillRoundedRect(b.x + 5, b.y + 3, b.width - 10, 3, 2);
              }
              g.fillStyle(0xbeb0f3, 0.18);
              g.fillRoundedRect(this.paddle - 68, 487, 136, 25, 12);
              g.fillStyle(0xbeb0f3);
              g.fillRoundedRect(this.paddle - 60, 490, 120, 12, 6);
              g.fillStyle(0xa0ffdf, 0.12);
              g.fillCircle(this.ball.x, this.ball.y, 20);
              g.fillStyle(0xf9edc7);
              g.fillCircle(this.ball.x, this.ball.y, 8);
            }
            if (gameId === "tile-shift") {
              g.fillStyle(0x0a1725, 0.5);
              g.fillRoundedRect(275, 48, 410, 410, 22);
              this.board.forEach((n, i) => {
                const x = 292 + (i % 4) * 94,
                  y = 65 + Math.floor(i / 4) * 94;
                if (n) {
                  const solved = n === i + 1;
                  g.fillStyle(solved ? 0xadd6bd : 0x8eb6cc);
                  g.fillRoundedRect(x, y, 85, 85, 12);
                  g.fillStyle(0xffffff, 0.18);
                  g.fillRoundedRect(x + 5, y + 5, 75, 5, 3);
                }
                this.tileLabels[i]
                  .setPosition(x + 42, y + 42)
                  .setText(n ? String(n) : "");
              });
            }
            this.particles = this.particles.filter((p) => p.life > 0);
            for (const p of this.particles) {
              p.life -= dt;
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              g.fillStyle(p.color, Math.max(0, p.life));
              g.fillCircle(p.x, p.y, 3);
            }
          }
          shooter(dt: number) {
            const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA"),
              right = this.keys.has("ArrowRight") || this.keys.has("KeyD"),
              up = this.keys.has("ArrowUp") || this.keys.has("KeyW"),
              down = this.keys.has("ArrowDown") || this.keys.has("KeyS");
            this.ship.x = P.Math.Clamp(
              this.ship.x + (Number(right) - Number(left)) * 360 * dt,
              25,
              935,
            );
            this.ship.y = P.Math.Clamp(
              this.ship.y + (Number(down) - Number(up)) * 360 * dt,
              35,
              510,
            );
            this.invulnerable -= dt;
            this.fire -= dt;
            this.spawn -= dt;
            if (this.fire <= 0) {
              this.fire = 0.16;
              this.shots.push({ x: this.ship.x, y: this.ship.y - 25 });
            }
            if (this.spawn <= 0) {
              this.spawn = Math.max(0.22, 0.85 - this.clock * 0.007);
              this.enemies.push({
                x: 35 + Math.random() * 890,
                y: -30,
                speed: 90 + Math.random() * 40 + this.clock * 2,
                hp: this.clock > 30 ? 2 : 1,
              });
            }
            for (const b of this.shots) b.y -= 650 * dt;
            for (const e of this.enemies) {
              e.y += e.speed * dt;
              for (const b of this.shots) {
                if (Math.abs(b.x - e.x) < 24 && Math.abs(b.y - e.y) < 24) {
                  b.y = -100;
                  e.hp--;
                  this.burst(e.x, e.y, 0xffaab8, 8);
                  if (e.hp <= 0) {
                    this.score += 100;
                    this.hud();
                    break;
                  }
                }
              }
              if (
                e.hp > 0 &&
                (Math.hypot(e.x - this.ship.x, e.y - this.ship.y) < 31 ||
                  e.y > 565)
              ) {
                e.hp = 0;
                if (this.invulnerable <= 0) {
                  this.lives--;
                  this.invulnerable = 1.2;
                  this.burst(this.ship.x, this.ship.y, 0xa8f7df);
                  this.cameras.main.shake(120, 0.004);
                  this.hud();
                  if (this.lives <= 0) {
                    this.finish("Shields depleted. Nice flying, pilot.");
                    return;
                  }
                }
              }
            }
            this.enemies = this.enemies.filter((e) => e.hp > 0);
            this.shots = this.shots.filter((b) => b.y > -30);
          }
          breaker(dt: number) {
            this.paddle = P.Math.Clamp(
              this.paddle +
                ((this.keys.has("ArrowRight") || this.keys.has("KeyD")
                  ? 1
                  : 0) -
                  (this.keys.has("ArrowLeft") || this.keys.has("KeyA")
                    ? 1
                    : 0)) *
                  530 *
                  dt,
              65,
              895,
            );
            const b = this.ball;
            if (!b.active) {
              b.x = this.paddle;
              b.y = 476;
              return;
            }
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.x < 10 || b.x > 950) {
              b.vx *= -1;
              b.x = P.Math.Clamp(b.x, 10, 950);
            }
            if (b.y < 12) {
              b.vy = Math.abs(b.vy);
              b.y = 12;
            }
            if (
              b.vy > 0 &&
              b.y >= 480 &&
              b.y <= 505 &&
              Math.abs(b.x - this.paddle) < 68
            ) {
              const angle = ((b.x - this.paddle) / 68) * 1.05,
                speed = Math.min(600, Math.hypot(b.vx, b.vy) + 12);
              b.vx = Math.sin(angle) * speed;
              b.vy = -Math.cos(angle) * speed;
              b.y = 479;
              this.burst(b.x, b.y, 0xc3b4f0, 6);
            }
            const index = this.bricks.findIndex((r) =>
              circleHitsBox(b.x, b.y, 8, r),
            );
            if (index >= 0) {
              const r = this.bricks[index],
                prevY = b.y - b.vy * dt;
              if (prevY < r.y || prevY > r.y + r.height) b.vy *= -1;
              else b.vx *= -1;
              this.bricks.splice(index, 1);
              this.score += 50;
              this.burst(b.x, b.y, r.color);
              this.hud();
              if (!this.bricks.length)
                this.finish("Spectrum cleared. Perfectly shattered.");
            }
            if (b.y > 560) {
              this.lives--;
              b.active = false;
              b.vx = 230;
              b.vy = -300;
              this.hud();
              if (this.lives <= 0)
                this.finish("Out of lives. Find your next angle.");
            }
          }
        }
        game = new P.Game({
          type: P.AUTO,
          parent: mount.current,
          width: 960,
          height: 540,
          scale: { mode: P.Scale.FIT, autoCenter: P.Scale.CENTER_BOTH },
          scene: Arcade,
          render: { antialias: true },
        });
      })
      .catch(() =>
        callbacks.current.onError(
          "This game could not load. Please close it and try again.",
        ),
      );
    return () => {
      disposed = true;
      control.current = null;
      game?.destroy(true);
    };
  }, [gameId, control]);
  return (
    <div
      ref={mount}
      className="canvas-wrap engine-canvas"
      aria-label="Game canvas"
    />
  );
}
