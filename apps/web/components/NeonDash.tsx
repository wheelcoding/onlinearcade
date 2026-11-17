"use client";
import type Phaser from "phaser";
import { useEffect, useRef, useState } from "react";
export default function NeonDash({
  onClose,
  onScore,
}: {
  onClose: () => void;
  onScore: (score: number) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<import("phaser").Game | null>(null);
  const [status, setStatus] = useState("Loading Neon Dash…");
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const dialog = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  const report = useRef(onScore);
  report.current = onScore;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key === "Tab") {
        const nodes = dialog.current?.querySelectorAll<HTMLButtonElement>(
          "button:not([disabled])",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      before?.focus();
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    import("phaser")
      .then(({ default: P }) => {
        if (disposed || !mount.current) return;
        class Dash extends P.Scene {
          player!: Phaser.Physics.Arcade.Sprite;
          obstacles!: Phaser.Physics.Arcade.Group;
          keys!: Phaser.Types.Input.Keyboard.CursorKeys;
          elapsed = 0;
          next = 0;
          ended = false;
          shown = -1;
          touchDirection = 0;
          ground!: Phaser.GameObjects.Rectangle;
          city!: Phaser.GameObjects.Graphics;
          fx!: Phaser.GameObjects.Graphics;
          trail: { x: number; y: number; life: number }[] = [];
          shards!: Phaser.Physics.Arcade.Group;
          bonus = 0;
          nextShard = 1500;
          jumps = 0;
          create() {
            this.physics.resume();
            this.elapsed = 0;
            this.next = 1000;
            this.ended = false;
            this.shown = -1;
            this.touchDirection = 0;
            this.bonus = 0;
            this.nextShard = 1500;
            this.jumps = 0;
            this.trail = [];
            setPaused(false);
            setOver(false);
            setScore(0);
            setStatus("");
            this.cameras.main.setBackgroundColor("#17142d");
            const g = this.add.graphics();
            for (let i = 0; i < 45; i++) {
              g.fillStyle(0xb1a5f8, 0.5);
              g.fillCircle((i * 173) % 960, (i * 67) % 330, 1.5);
            }
            // Layered skyline, sunset bands and parallax architecture, all original procedural art.
            g.fillStyle(0xe397ac, 0.08);
            g.fillCircle(730, 135, 120);
            for (let i = 0; i < 9; i++) {
              g.fillStyle(i < 4 ? 0xdca1c5 : 0xc18ac9, 0.85);
              const y = 65 + i * 14,
                half = Math.sqrt(Math.max(0, 80 * 80 - (y - 135) ** 2));
              g.fillRect(730 - half, y, half * 2, 9);
            }
            g.fillStyle(0x38335c);
            g.fillTriangle(380, 360, 570, 165, 780, 360);
            g.fillStyle(0x30294f);
            g.fillTriangle(610, 360, 820, 200, 1060, 360);
            this.city = this.add.graphics();
            for (let i = 0; i < 35; i++) {
              const x = i * 60,
                height = 80 + ((i * 47) % 130),
                y = 440 - height;
              this.city.fillStyle(i % 3 === 0 ? 0x39304f : 0x252640);
              this.city.fillRect(x, y, 48, height);
              this.city.lineStyle(1, 0x797094, 0.3);
              this.city.strokeRect(x, y, 48, height);
              for (let row = 0; row < height / 15 - 1; row++)
                for (let col = 0; col < 3; col++) {
                  this.city.fillStyle(
                    (row + col + i) % 4 === 0 ? 0xe6a9bf : 0x78a9bd,
                    (row + col + i) % 3 === 0 ? 0.65 : 0.18,
                  );
                  this.city.fillRect(x + 7 + col * 13, y + 10 + row * 15, 5, 5);
                }
            }
            g.lineStyle(1, 0x7948bd, 0.4);
            for (let i = 0; i < 20; i++)
              g.lineBetween(i * 60, 440, 480 + (i - 8) * 150, 540);
            g.lineStyle(3, 0x47f5dd);
            g.lineBetween(0, 440, 960, 440);
            const tex = this.make.graphics({ x: 0, y: 0 });
            tex.fillStyle(0x8df7da);
            tex.fillRoundedRect(0, 0, 34, 42, 7);
            tex.fillStyle(0x6ccbb7);
            tex.fillRect(0, 26, 34, 6);
            tex.fillStyle(0xd9fff0);
            tex.fillRoundedRect(3, 3, 27, 4, 2);
            tex.fillStyle(0x5d7997);
            tex.fillRoundedRect(6, 9, 28, 15, 4);
            tex.fillStyle(0x241e3b);
            tex.fillRect(20, 10, 9, 8);
            if (!this.textures.exists("runner"))
              tex.generateTexture("runner", 34, 42);
            tex.clear();
            tex.fillStyle(0xf988af);
            tex.fillTriangle(0, 44, 22, 0, 44, 44);
            if (!this.textures.exists("spike"))
              tex.generateTexture("spike", 44, 44);
            tex.clear();
            tex.fillStyle(0xf8ce96);
            tex.fillPoints(
              [
                { x: 9, y: 0 },
                { x: 18, y: 13 },
                { x: 9, y: 26 },
                { x: 0, y: 13 },
              ],
              true,
            );
            tex.lineStyle(2, 0xfff2ca);
            tex.strokePoints(
              [
                { x: 9, y: 0 },
                { x: 18, y: 13 },
                { x: 9, y: 26 },
                { x: 0, y: 13 },
              ],
              true,
            );
            if (!this.textures.exists("shard"))
              tex.generateTexture("shard", 18, 26);
            tex.destroy();
            this.ground = this.add.rectangle(480, 468, 960, 56, 0x252039);
            this.physics.add.existing(this.ground, true);
            this.player = this.physics.add.sprite(150, 380, "runner");
            this.player.setCollideWorldBounds(true);
            this.player.setGravityY(1450);
            this.physics.add.collider(this.player, this.ground);
            this.obstacles = this.physics.add.group({ allowGravity: false });
            this.shards = this.physics.add.group({ allowGravity: false });
            this.fx = this.add.graphics();
            this.physics.add.overlap(
              this.player,
              this.shards,
              (_player, shard) => {
                shard.destroy();
                this.bonus += 25;
                const text = this.add.text(
                  this.player.x,
                  this.player.y - 50,
                  "+25",
                  {
                    fontFamily: "Arial",
                    fontSize: "20px",
                    color: "#ffdba4",
                    fontStyle: "bold",
                  },
                );
                this.tweens.add({
                  targets: text,
                  y: text.y - 45,
                  alpha: 0,
                  duration: 700,
                  onComplete: () => text.destroy(),
                });
              },
            );
            this.physics.add.overlap(this.player, this.obstacles, () => {
              if (this.ended) return;
              this.ended = true;
              this.physics.pause();
              setOver(true);
              report.current(Math.floor(this.elapsed / 100) + this.bonus);
            });
            this.keys = this.input.keyboard!.createCursorKeys();
            this.input.keyboard!.on(
              "keydown-A",
              () => (this.touchDirection = -1),
            );
            this.input.keyboard!.on(
              "keydown-D",
              () => (this.touchDirection = 1),
            );
            this.input.keyboard!.on("keyup-A", () => (this.touchDirection = 0));
            this.input.keyboard!.on("keyup-D", () => (this.touchDirection = 0));
            this.input.keyboard!.addCapture(["SPACE", "UP", "LEFT", "RIGHT"]);
            this.input.on("pointerdown", () => this.jump());
            this.input.keyboard!.on("keydown-SPACE", () => this.jump());
            this.input.keyboard!.on("keydown-UP", () => this.jump());
          }
          jump() {
            if (!this.ended && this.jumps < 2) {
              this.jumps++;
              this.player.setVelocityY(this.jumps === 1 ? -620 : -520);
              this.trail.push({ x: this.player.x, y: this.player.y, life: 1 });
            }
          }
          update(_t: number, delta: number) {
            if (this.ended) return;
            this.elapsed += delta;
            if (
              this.player.body?.touching.down &&
              this.player.body.velocity.y >= 0
            )
              this.jumps = 0;
            this.city.x = -(this.elapsed * 0.025) % 960;
            this.fx.clear();
            this.trail.push({
              x: this.player.x - 15,
              y: this.player.y + 10,
              life: 0.45,
            });
            this.trail = this.trail.filter((p) => p.life > 0);
            for (const p of this.trail) {
              p.life -= delta / 1000;
              p.x -= delta * 0.2;
              this.fx.fillStyle(0x85f5d5, Math.max(0, p.life * 0.45));
              this.fx.fillRoundedRect(p.x - 8, p.y - 8, 16, 16, 4);
            }
            if (this.elapsed > this.nextShard) {
              const shard = this.shards.create(
                1000,
                P.Math.Between(290, 365),
                "shard",
              ) as Phaser.Physics.Arcade.Sprite;
              shard.setVelocityX(-Math.min(560, 300 + this.elapsed / 250));
              this.tweens.add({
                targets: shard,
                angle: 360,
                duration: 1600,
                repeat: -1,
              });
              this.nextShard = this.elapsed + P.Math.Between(1500, 2600);
            }
            this.shards.children.each((o) => {
              if ((o as Phaser.Physics.Arcade.Sprite).x < -50) o.destroy();
              return true;
            });
            const current = Math.floor(this.elapsed / 100) + this.bonus;
            if (current !== this.shown) {
              this.shown = current;
              setScore(current);
            }
            this.player.setVelocityX(
              this.keys.left.isDown
                ? -240
                : this.keys.right.isDown
                  ? 240
                  : this.touchDirection * 240,
            );
            this.player.x = P.Math.Clamp(this.player.x, 30, 820);
            if (this.elapsed > this.next) {
              const o = this.obstacles.create(
                1000,
                418,
                "spike",
              ) as Phaser.Physics.Arcade.Sprite;
              o.setVelocityX(-Math.min(560, 300 + this.elapsed / 250));
              o.body?.setSize(28, 34);
              this.next = this.elapsed + P.Math.Between(1150, 1850);
            }
            this.obstacles.children.each((o) => {
              if ((o as Phaser.Physics.Arcade.Sprite).x < -50) o.destroy();
              return true;
            });
          }
        }
        game.current = new P.Game({
          type: P.AUTO,
          parent: mount.current,
          width: 960,
          height: 540,
          scale: { mode: P.Scale.FIT, autoCenter: P.Scale.CENTER_BOTH },
          physics: { default: "arcade", arcade: { debug: false } },
          scene: Dash,
        });
      })
      .catch(() => setStatus("The game could not load. Close and try again."));
    const blur = () => {
      game.current?.scene.scenes[0]?.scene.pause();
      setPaused(true);
    };
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("blur", blur);
      disposed = true;
      game.current?.destroy(true);
      game.current = null;
    };
  }, []);
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Neon Dash"
    >
      <div className="game-dialog" ref={dialog} tabIndex={-1}>
        <div className="game-top">
          <div>
            <span className="eyebrow">NOW PLAYING</span>
            <h2>Neon Dash</h2>
          </div>
          <span className="score">{score.toString().padStart(5, "0")}</span>
          <button onClick={onClose} aria-label="Close game">
            ✕
          </button>
        </div>
        <div className="engine-stage">
          <div className="canvas-wrap" ref={mount} />
          {(over || paused) && (
            <div className="engine-overlay">
              <span className="eyebrow">
                {over ? "RUN COMPLETE" : "PAUSED"}
              </span>
              <h2>{over ? "One more run?" : "Catch your breath."}</h2>
              <strong>
                {score.toLocaleString()} <small>POINTS</small>
              </strong>
              <button
                className="primary"
                onClick={() => {
                  if (over) game.current?.scene.scenes[0].scene.restart();
                  else {
                    game.current?.scene.scenes[0].scene.resume();
                    setPaused(false);
                  }
                }}
              >
                {over ? "Play again ↻" : "Resume ▷"}
              </button>
            </div>
          )}
        </div>
        {status && <p role="status">{status}</p>}
        <div className="game-bottom">
          <p>
            {over
              ? "Run complete. Beat your best?"
              : "← → / A D move · Space / ↑ double jump · Collect gold shards"}
          </p>
          <button
            onClick={() => {
              const scene = game.current?.scene.scenes[0];
              if (!scene || over) return;
              if (paused) scene.scene.resume();
              else scene.scene.pause();
              setPaused(!paused);
            }}
            className="secondary"
          >
            {paused ? "▷ Resume" : "Ⅱ Pause"}
          </button>
          <button
            className="primary"
            onClick={() => game.current?.scene.scenes[0].scene.restart()}
          >
            ↻ Restart
          </button>
        </div>
        <div className="touch-controls">
          {[-1, 1].map((direction) => (
            <button
              key={direction}
              aria-label={direction < 0 ? "Move left" : "Move right"}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const scene = game.current?.scene.scenes[0] as unknown as {
                  touchDirection: number;
                };
                if (scene) scene.touchDirection = direction;
              }}
              onPointerUp={() => {
                const scene = game.current?.scene.scenes[0] as unknown as {
                  touchDirection: number;
                };
                if (scene) scene.touchDirection = 0;
              }}
              onPointerCancel={() => {
                const scene = game.current?.scene.scenes[0] as unknown as {
                  touchDirection: number;
                };
                if (scene) scene.touchDirection = 0;
              }}
            >
              {direction < 0 ? "←" : "→"}
            </button>
          ))}
          <button
            className="touch-jump"
            onPointerDown={() => {
              const scene = game.current?.scene.scenes[0] as unknown as {
                jump: () => void;
              };
              scene?.jump();
            }}
          >
            JUMP ↑
          </button>
        </div>
      </div>
    </div>
  );
}
