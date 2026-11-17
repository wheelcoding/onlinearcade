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
  const report = useRef(onScore);
  report.current = onScore;
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
          create() {
            this.physics.resume();
            this.elapsed = 0;
            this.next = 1000;
            this.ended = false;
            this.shown = -1;
            this.touchDirection = 0;
            setOver(false);
            setScore(0);
            setStatus("");
            this.cameras.main.setBackgroundColor("#17142d");
            const g = this.add.graphics();
            for (let i = 0; i < 45; i++) {
              g.fillStyle(0xb1a5f8, 0.5);
              g.fillCircle((i * 173) % 960, (i * 67) % 330, 1.5);
            }
            g.fillStyle(0x302850);
            for (let i = 0; i < 15; i++)
              g.fillRect(i * 75, 220 - (i % 4) * 30, 55, 220);
            g.lineStyle(1, 0x7948bd, 0.4);
            for (let i = 0; i < 20; i++)
              g.lineBetween(i * 60, 440, 480 + (i - 8) * 150, 540);
            g.lineStyle(3, 0x47f5dd);
            g.lineBetween(0, 440, 960, 440);
            const tex = this.make.graphics({ x: 0, y: 0 });
            tex.fillStyle(0x8df7da);
            tex.fillRoundedRect(0, 0, 34, 42, 7);
            tex.fillStyle(0x241e3b);
            tex.fillRect(20, 10, 9, 8);
            if (!this.textures.exists("runner")) tex.generateTexture("runner", 34, 42);
            tex.clear();
            tex.fillStyle(0xf988af);
            tex.fillTriangle(0, 44, 22, 0, 44, 44);
            if (!this.textures.exists("spike")) tex.generateTexture("spike", 44, 44);
            tex.destroy();
            this.ground = this.add.rectangle(480, 468, 960, 56, 0x252039);
            this.physics.add.existing(this.ground, true);
            this.player = this.physics.add.sprite(150, 380, "runner");
            this.player.setCollideWorldBounds(true);
            this.player.setGravityY(1450);
            this.physics.add.collider(this.player, this.ground);
            this.obstacles = this.physics.add.group({ allowGravity: false });
            this.physics.add.overlap(this.player, this.obstacles, () => {
              if (this.ended) return;
              this.ended = true;
              this.physics.pause();
              setOver(true);
              report.current(Math.floor(this.elapsed / 100));
            });
            this.keys = this.input.keyboard!.createCursorKeys();
            this.input.keyboard!.addCapture(["SPACE", "UP", "LEFT", "RIGHT"]);
            this.input.on("pointerdown", () => this.jump());
            this.input.keyboard!.on("keydown-SPACE", () => this.jump());
            this.input.keyboard!.on("keydown-UP", () => this.jump());
          }
          jump() {
            if (!this.ended && this.player.body?.touching.down)
              this.player.setVelocityY(-620);
          }
          update(_t: number, delta: number) {
            if (this.ended) return;
            this.elapsed += delta;
            const current = Math.floor(this.elapsed / 100);
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
    return () => {
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
      <div className="game-dialog">
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
        <div className="canvas-wrap" ref={mount} />
        {status && <p role="status">{status}</p>}
        <div className="game-bottom">
          <p>
            {over
              ? "Run complete. Beat your best?"
              : "← → move · Space / ↑ jump · Tap the game to jump"}
          </p>
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
