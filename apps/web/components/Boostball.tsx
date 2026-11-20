"use client";
import { useEffect, useRef, useState } from "react";
import {
  BoostballSimulation,
  boostballBot,
  type BallInput,
  type BallState,
} from "@onlinearcade/core";
import type { OnlineRaceLink } from "../lib/use-party";
import type Phaser from "phaser";
const BLUE = 0x63d5ff,
  ORANGE = 0xffa159;
export default function Boostball({
  link,
  onClose,
  onFriends,
}: {
  link?: OnlineRaceLink;
  onClose: () => void;
  onFriends: () => void;
}) {
  const [practice, setPractice] = useState(false),
    [attempt, setAttempt] = useState(0),
    [hud, setHud] = useState<BallState | null>(null),
    [notice, setNotice] = useState("Loading stadium…"),
    [error, setError] = useState("");
  const mount = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLElement>(null),
    held = useRef(new Set<string>()),
    close = useRef(onClose);
  close.current = onClose;
  const exit = () => {
    link?.socket.emit("ball:exit", link.session.id);
    close.current();
  };
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        link?.socket.emit("ball:exit", link.session.id);
        close.current();
      }
      if (e.key === "Tab") {
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>(
          "button:not([disabled])",
        );
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", key);
      old?.focus();
    };
  }, [link]);
  useEffect(() => {
    if ((!practice && !link) || !mount.current) return;
    let disposed = false,
      game: Phaser.Game | undefined,
      seq = Date.now(),
      lastPacket = performance.now(),
      hudAt = 0;
    const mine = link?.memberId ?? "you";
    const sim = link
      ? null
      : new BoostballSimulation([
          { id: "you", name: "You" },
          { id: "bot", name: "Sparky · AI" },
        ]);
    let latest: BallState | null = sim?.state ?? null;
    setHud(null);
    setError("");
    setNotice(link ? "Connecting to match…" : "Practice · You vs Sparky (AI)");
    const input = (): BallInput => ({
      throttle:
        Number(held.current.has("KeyW") || held.current.has("ArrowUp")) -
        Number(held.current.has("KeyS") || held.current.has("ArrowDown")),
      steer:
        Number(held.current.has("KeyD") || held.current.has("ArrowRight")) -
        Number(held.current.has("KeyA") || held.current.has("ArrowLeft")),
      boost: held.current.has("ShiftLeft") || held.current.has("ShiftRight"),
      dodge: held.current.has("Space"),
    });
    const state = (p: BallState & { sessionId: string }) => {
      if (p.sessionId !== link?.session.id || (latest && p.tick < latest.tick))
        return;
      latest = p;
      lastPacket = performance.now();
      setNotice("Connected · server-controlled match");
    };
    const reset = () => {
      held.current.clear();
    };
    const sync = () => {
      reset();
      setNotice("Reconnecting to match…");
      link?.socket.emit("ball:sync", link.session.id);
    };
    const disconnected = () => {
      reset();
      setNotice("Connection lost. Reconnecting; controls stop safely.");
    };
    const removed = () => {
      reset();
      setError(
        "You left the party. Close the match and rejoin from the lobby.",
      );
    };
    const down = (e: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code,
        )
      )
        e.preventDefault();
      held.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    link?.socket.on("ball:state", state);
    link?.socket.on("connect", sync);
    link?.socket.on("disconnect", disconnected);
    link?.socket.on("party:removed", removed);
    link?.socket.emit("ball:sync", link.session.id);
    const send = setInterval(() => {
      if (link?.socket.connected && !latest?.complete)
        link.socket.emit("ball:input", {
          sessionId: link.session.id,
          seq: ++seq,
          input: input(),
        });
    }, 1000 / 30);
    import("phaser")
      .then(({ default: P }) => {
        if (disposed) return;
        class Stadium extends P.Scene {
          g!: Phaser.GameObjects.Graphics;
          labels: Phaser.GameObjects.Text[] = [];
          smooth = new Map<string, { x: number; y: number; angle: number }>();
          ballPosition: { x: number; y: number } | null = null;
          trail: { x: number; y: number; life: number; color: number }[] = [];
          create() {
            this.g = this.add.graphics();
            const roster = link?.session.racers?.map((p) => ({
              id: p.memberId,
              name: p.name,
            })) ?? [
              { id: "you", name: "You" },
              { id: "bot", name: "Sparky · AI" },
            ];
            this.labels = roster.map((p) =>
              this.add
                .text(0, 0, p.name + (p.id === mine ? " · YOU" : ""), {
                  fontFamily: "system-ui",
                  fontSize: "12px",
                  color: "#edf7ff",
                  backgroundColor: "#071327bb",
                  padding: { x: 5, y: 3 },
                })
                .setOrigin(0.5, 0),
            );
          }
          update(now: number, delta: number) {
            if (sim) {
              sim.advance(
                delta / 1000,
                new Map([
                  [mine, input()],
                  ["bot", boostballBot(sim.state, "bot")],
                ]),
              );
              latest = sim.state;
            }
            const s = latest;
            if (!s) return;
            if (now - hudAt > 100) {
              hudAt = now;
              setHud({
                ...s,
                score: [...s.score],
                cars: s.cars.map((c) => ({ ...c })),
              });
              if (link && performance.now() - lastPacket > 3000 && !s.complete)
                setNotice("Waiting for server snapshots…");
            }
            const g = this.g;
            g.clear();
            g.fillStyle(0x071020);
            g.fillRect(0, 0, 960, 540);
            // Original stadium: spectator lights, steel rails and neon goals.
            for (let i = 0; i < 100; i++) {
              g.fillStyle(i % 2 ? BLUE : ORANGE, 0.18 + (i % 3) * 0.12);
              g.fillRect(16 + i * 9.4, 10 + (i % 2) * 6, 3, 3);
              g.fillRect(16 + i * 9.4, 520 + (i % 2) * 6, 3, 3);
            }
            g.fillStyle(0x162a36);
            g.fillRoundedRect(26, 26, 908, 488, 22);
            for (let i = 0; i < 16; i++) {
              g.fillStyle(i % 2 ? 0x1b3942 : 0x19343d);
              g.fillRect(34 + i * 55.75, 34, 55.75, 472);
            }
            g.lineStyle(2, 0xc0eeed, 0.3);
            g.strokeRoundedRect(34, 34, 892, 472, 14);
            g.lineBetween(480, 34, 480, 506);
            g.strokeCircle(480, 270, 80);
            g.fillStyle(0xc0eeed, 0.5);
            g.fillCircle(480, 270, 4);
            for (const side of [0, 1]) {
              const x = side ? 786 : 34,
                color = side ? ORANGE : BLUE;
              g.lineStyle(2, color, 0.45);
              g.strokeRect(x, 166, 140, 208);
              g.strokeCircle(side ? 820 : 140, 270, 32);
              g.fillStyle(color, 0.15);
              g.fillRect(side ? 920 : 5, 207, 35, 126);
              g.lineStyle(4, color, 0.9);
              g.lineBetween(side ? 928 : 32, 34, side ? 928 : 32, 205);
              g.lineBetween(side ? 928 : 32, 335, side ? 928 : 32, 506);
              g.lineBetween(side ? 930 : 30, 208, side ? 954 : 6, 208);
              g.lineBetween(side ? 930 : 30, 332, side ? 954 : 6, 332);
              g.lineBetween(side ? 954 : 6, 208, side ? 954 : 6, 332);
              for (let y = 218; y < 332; y += 14) {
                g.lineStyle(1, color, 0.3);
                g.lineBetween(side ? 930 : 6, y, side ? 954 : 30, y);
              }
            }
            // Recharging boost pads are visual field markers; fuel recharges anywhere.
            for (const [x, y] of [
              [180, 100],
              [180, 440],
              [780, 100],
              [780, 440],
              [480, 100],
              [480, 440],
            ]) {
              g.lineStyle(2, 0xf6d590, 0.6);
              g.strokeCircle(x, y, 9);
              g.fillStyle(0xf6d590, 0.3);
              g.fillCircle(x, y, 4);
            }
            this.trail = this.trail.filter((t) => (t.life -= delta / 500) > 0);
            for (const t of this.trail) {
              g.fillStyle(t.color, t.life * 0.3);
              g.fillCircle(t.x, t.y, 5 * t.life);
            }
            s.cars.forEach((c, i) => {
              this.labels[i]?.setVisible(c.active);
              if (!c.active) return;
              const p = this.smooth.get(c.id) ?? {
                  x: c.x,
                  y: c.y,
                  angle: c.angle,
                },
                t = 1 - Math.exp(-delta / 40);
              if (Math.hypot(c.x - p.x, c.y - p.y) > 130) {
                p.x = c.x;
                p.y = c.y;
              } else {
                p.x += (c.x - p.x) * t;
                p.y += (c.y - p.y) * t;
              }
              p.angle +=
                Math.atan2(
                  Math.sin(c.angle - p.angle),
                  Math.cos(c.angle - p.angle),
                ) * t;
              this.smooth.set(c.id, p);
              const color = c.team ? ORANGE : BLUE;
              if (Math.hypot(c.vx, c.vy) > 270)
                this.trail.push({
                  x: p.x - Math.cos(p.angle) * 20,
                  y: p.y - Math.sin(p.angle) * 20,
                  life: 1,
                  color,
                });
              g.save();
              g.translateCanvas(p.x, p.y);
              g.rotateCanvas(p.angle);
              g.fillStyle(0x000000, 0.35);
              g.fillEllipse(3, 5, 48, 30);
              if (Math.hypot(c.vx, c.vy) > 300) {
                g.fillStyle(0xffce75, 0.8);
                g.fillTriangle(
                  -20,
                  -7,
                  -20,
                  7,
                  -40 - Math.sin(now / 50) * 8,
                  0,
                );
              }
              g.fillStyle(0x080d18);
              for (const y of [-17, 10])
                for (const x of [-14, 8]) g.fillRoundedRect(x, y, 12, 7, 2);
              g.fillStyle(color);
              g.fillRoundedRect(-22, -12, 44, 24, 7);
              g.lineStyle(1, 0xffffff, 0.7);
              g.strokeRoundedRect(-22, -12, 44, 24, 7);
              g.fillStyle(0x132740);
              g.fillRoundedRect(-9, -9, 18, 18, 4);
              g.fillStyle(0xd6f5ff, 0.8);
              g.fillRect(4, -7, 4, 14);
              g.fillStyle(0xfff7d8);
              g.fillRect(18, -9, 3, 5);
              g.fillRect(18, 4, 3, 5);
              g.fillStyle(0xf35970);
              g.fillRect(-22, -8, 3, 4);
              g.fillRect(-22, 4, 3, 4);
              g.restore();
              if (c.id === mine) {
                g.lineStyle(2, 0xffffff, 0.7);
                g.strokeCircle(p.x, p.y, 28);
              }
              this.labels[i]?.setPosition(p.x, p.y + 29);
            });
            const targetBall = s.ball;
            const b = this.ballPosition ?? { x: targetBall.x, y: targetBall.y };
            const ballBlend = 1 - Math.exp(-delta / 35);
            if (Math.hypot(targetBall.x - b.x, targetBall.y - b.y) > 150) {
              b.x = targetBall.x;
              b.y = targetBall.y;
            } else {
              b.x += (targetBall.x - b.x) * ballBlend;
              b.y += (targetBall.y - b.y) * ballBlend;
            }
            this.ballPosition = b;
            g.fillStyle(0xffffff, 0.07);
            g.fillCircle(b.x, b.y, 29);
            g.fillStyle(0x000000, 0.25);
            g.fillEllipse(b.x + 3, b.y + 8, 34, 22);
            g.fillStyle(0xe9f7ed);
            g.fillCircle(b.x, b.y, 17);
            g.lineStyle(2, 0x728e9f);
            g.strokeCircle(b.x, b.y, 17);
            for (let i = 0; i < 5; i++) {
              const a = (i * Math.PI * 2) / 5 + now / 2000;
              g.fillStyle(0x254658);
              g.fillCircle(b.x + Math.cos(a) * 10, b.y + Math.sin(a) * 10, 3);
            }
            g.fillStyle(0xffffff);
            g.fillCircle(b.x - 5, b.y - 6, 4);
          }
        }
        try {
          game = new P.Game({
            type: P.CANVAS,
            parent: mount.current!,
            width: 960,
            height: 540,
            scene: Stadium,
            scale: { mode: P.Scale.FIT, autoCenter: P.Scale.CENTER_BOTH },
            audio: { noAudio: true },
            input: { keyboard: false },
            render: { antialias: true },
          });
        } catch {
          setError("Could not start the stadium. Close and retry.");
        }
      })
      .catch(() => {
        if (!disposed)
          setError("Could not load the game. Check your connection and retry.");
      });
    return () => {
      disposed = true;
      clearInterval(send);
      game?.destroy(true);
      held.current.clear();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
      link?.socket.off("ball:state", state);
      link?.socket.off("connect", sync);
      link?.socket.off("disconnect", disconnected);
      link?.socket.off("party:removed", removed);
    };
  }, [practice, link, attempt]);
  const car = hud?.cars.find((c) => c.id === (link?.memberId ?? "you")),
    score = hud?.score ?? [0, 0];
  return (
    <div className="modal">
      <section
        className="game-dialog boostball-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Boostball"
        ref={dialog}
        tabIndex={-1}
      >
        <div className="game-top">
          <div>
            <small>
              BOOSTBALL · {link ? "LIVE MULTIPLAYER" : "CAR SOCCER"}
            </small>
            <h2>Full throttle. Top corner.</h2>
          </div>
          <button onClick={exit} aria-label="Close Boostball">
            ✕
          </button>
        </div>
        {!practice && !link ? (
          <div className="ball-welcome">
            <span className="ball-emblem">⚽</span>
            <p className="eyebrow">AN ORIGINAL ARCADE SPORT</p>
            <h3>Small cars. Giant goals.</h3>
            <p>
              Outdrive your friends in a neon stadium. Boost into the ball, bank
              shots off the walls, and dodge through the defense.
            </p>
            <div className="ball-features">
              <span>2–8 friends · balanced teams</span>
              <span>3-minute matches</span>
              <span>Keyboard & touch</span>
            </div>
            <button className="primary" onClick={() => setPractice(true)}>
              Practice vs AI
            </button>
            <button className="secondary" onClick={onFriends}>
              Play with friends →
            </button>
            <p className="muted">
              Practice is offline against a labeled AI. Online matches require a
              party and the updated server.
            </p>
          </div>
        ) : (
          <>
            <div className="ball-scoreboard">
              <strong className="ball-blue">
                BLUE <b>{score[0]}</b>
              </strong>
              <span>
                {hud?.complete
                  ? "FULL TIME"
                  : `${Math.floor((hud?.time ?? 180) / 60)}:${String(Math.floor((hud?.time ?? 180) % 60)).padStart(2, "0")}`}
              </span>
              <strong className="ball-orange">
                <b>{score[1]}</b> ORANGE
              </strong>
            </div>
            <p className="ball-announcement" role="status">
              {hud?.complete
                ? score[0] === score[1]
                  ? "Draw · well played!"
                  : `${score[0] > score[1] ? "Blue" : "Orange"} team wins!`
                : hud?.countdown
                  ? `${hud.goal} · ${Math.ceil(hud.countdown)}`
                  : `You are ${car?.team ? "ORANGE" : "BLUE"} · attack the ${car?.team ? "left" : "right"} goal`}
            </p>
            <div
              className="planet-canvas"
              ref={mount}
              aria-label="Boostball car soccer stadium"
            />
            <div className="ball-telemetry">
              <label>
                BOOST <progress max={100} value={car?.fuel ?? 100} />
                {Math.round(car?.fuel ?? 100)}%
              </label>
              <span>
                DODGE {car?.cooldown ? `${car.cooldown.toFixed(1)}s` : "READY"}
              </span>
            </div>
            <p className="muted" role="status">
              {notice}
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="ball-controls">
              {[
                ["KeyA", "←", "Steer left"],
                ["KeyD", "→", "Steer right"],
                ["KeyW", "GAS", "Accelerate"],
                ["KeyS", "BRAKE", "Brake or reverse"],
                ["ShiftLeft", "BOOST", "Boost"],
                ["Space", "DODGE", "Dodge burst"],
              ].map(([code, label, aria]) => (
                <button
                  key={code}
                  aria-label={aria}
                  disabled={hud?.complete}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    held.current.add(code);
                  }}
                  onPointerUp={() => held.current.delete(code)}
                  onPointerCancel={() => held.current.delete(code)}
                  onLostPointerCapture={() => held.current.delete(code)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="muted">
              W/S or ↑/↓ drive · A/D or ←/→ steer · Shift boost · Space dodge.
              Boost recharges when released.
            </p>
            {hud?.complete && (
              <ol className="planet-scores">
                {hud.cars.map((c) => (
                  <li
                    key={c.id}
                    className={c.team ? "ball-orange" : "ball-blue"}
                  >
                    {c.name} · {c.team ? "Orange" : "Blue"}
                    {!c.active ? " · left" : ""}
                  </li>
                ))}
              </ol>
            )}
            {!link ? (
              <button
                className="secondary"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Restart practice
              </button>
            ) : (
              <p className="muted">
                Return to your party after full time to ready up for a rematch.
                Match scores stay in this party.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
