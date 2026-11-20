"use client";
import { useEffect, useRef, useState } from "react";
import {
  PlanetSimulation,
  PLANET_ROUNDS,
  PLANET_COLORS,
  planetTile,
  type PlanetState,
  type PlanetInput,
} from "@onlinearcade/core";
import type { OnlineRaceLink } from "../lib/use-party";
import type Phaser from "phaser";
type Packet = PlanetState & { sessionId: string };
export default function PartyPlanet({
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
    [hud, setHud] = useState<PlanetState | null>(null),
    [notice, setNotice] = useState("Loading the planet…"),
    [error, setError] = useState("");
  const mount = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLElement>(null),
    keyboard = useRef(new Set<string>()),
    touch = useRef(new Set<string>()),
    close = useRef(onClose);
  close.current = onClose;
  const exit = () => {
    if (link) link.socket.emit("planet:exit", link.session.id);
    close.current();
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (link) link.socket.emit("planet:exit", link.session.id);
        close.current();
      }
      if (e.key === "Tab") {
        const buttons = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled])",
        );
        if (buttons?.length) {
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
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [link]);
  useEffect(() => {
    if ((!practice && !link) || !mount.current) return;
    setError("");
    let disposed = false,
      game: Phaser.Game | undefined;
    const target = mount.current,
      roster = link?.session.racers?.map((p) => ({
        id: p.memberId,
        name: p.name,
        color: p.color,
      })) ?? [{ id: "practice", name: "You", color: PLANET_COLORS[0] }];
    const mine = link?.memberId ?? "practice",
      sim = link ? null : new PlanetSimulation(roster, attempt + 51);
    let latest: PlanetState | null = sim?.state ?? null,
      lastPacket = performance.now(),
      seq = Date.now(),
      lastHud = 0;
    const held = (...codes: string[]) =>
      codes.some((c) => keyboard.current.has(c) || touch.current.has(c));
    const input = (): PlanetInput => ({
      x: Number(held("KeyD", "ArrowRight")) - Number(held("KeyA", "ArrowLeft")),
      y: Number(held("KeyS", "ArrowDown")) - Number(held("KeyW", "ArrowUp")),
    });
    const state = (p: Packet) => {
      if (p.sessionId !== link?.session.id || (latest && p.tick < latest.tick))
        return;
      latest = p;
      lastPacket = performance.now();
      setNotice("Connected · live party match");
    };
    const sync = () => {
      keyboard.current.clear();
      touch.current.clear();
      setNotice("Reconnecting to your party…");
      link?.socket.emit("planet:sync", link.session.id);
    };
    const disconnected = () => {
      keyboard.current.clear();
      touch.current.clear();
      setNotice("Connection interrupted. Reconnecting; movement stops safely.");
    };
    const removed = () => {
      setError(
        "You are no longer in this party. Return to the lobby to join again.",
      );
      keyboard.current.clear();
      touch.current.clear();
    };
    const keydown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code))
        e.preventDefault();
      keyboard.current.add(e.code);
    };
    const keyup = (e: KeyboardEvent) => keyboard.current.delete(e.code),
      blur = () => {
        keyboard.current.clear();
        touch.current.clear();
      };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    link?.socket.on("planet:state", state);
    link?.socket.on("connect", sync);
    link?.socket.on("disconnect", disconnected);
    link?.socket.on("party:removed", removed);
    link?.socket.emit("planet:sync", link.session.id);
    const send = setInterval(() => {
      if (link?.socket.connected && !latest?.complete)
        link.socket.emit("planet:input", {
          sessionId: link.session.id,
          seq: ++seq,
          input: input(),
        });
    }, 1000 / 30);
    import("phaser")
      .then(({ default: P }) => {
        if (disposed) return;
        class Planet extends P.Scene {
          graphics!: Phaser.GameObjects.Graphics;
          labels: Phaser.GameObjects.Text[] = [];
          positions = new Map<string, { x: number; y: number }>();
          create() {
            this.graphics = this.add.graphics();
            this.labels = roster.map(() =>
              this.add
                .text(0, 0, "", {
                  fontFamily: "system-ui",
                  fontSize: "14px",
                  color: "#fff4d7",
                  backgroundColor: "#171a32cc",
                  padding: { x: 5, y: 3 },
                })
                .setOrigin(0.5, 0),
            );
            setNotice(
              link
                ? "Connecting to the match…"
                : "Solo practice · no other players or bots",
            );
          }
          update(now: number, delta: number) {
            if (sim) {
              sim.advance(delta / 1000, new Map([[mine, input()]]));
              latest = sim.state;
            }
            const s = latest;
            if (!s) return;
            if (now - lastHud > 100) {
              lastHud = now;
              setHud({ ...s, players: s.players.map((p) => ({ ...p })) });
            }
            if (link && performance.now() - lastPacket > 3000 && !s.complete)
              setNotice(
                "Waiting for the server. The match will resume when connected.",
              );
            const g = this.graphics;
            g.clear();
            g.fillStyle(0x11172e);
            g.fillRect(0, 0, 960, 540);
            for (let i = 0; i < 65; i++) {
              g.fillStyle(0xc2d8ef, 0.22 + (i % 3) * 0.15);
              g.fillCircle((i * 137) % 960, (i * 83) % 540, 1 + (i % 2));
            }
            g.lineStyle(14, 0x66568d, 0.4);
            g.strokeEllipse(810, 80, 170, 60);
            g.fillStyle(0x8d77ae);
            g.fillCircle(810, 80, 47);
            g.fillStyle(0xb7a2ca, 0.4);
            g.fillCircle(797, 66, 14);
            g.fillStyle(0x000000, 0.25);
            g.fillRoundedRect(48, 78, 864, 434, 30);
            g.fillStyle(0x363455);
            g.fillRoundedRect(48, 58, 864, 434, 30);
            for (let row = 0; row < 5; row++)
              for (let col = 0; col < 8; col++) {
                const tile = planetTile(60 + col * 105 + 1, 70 + row * 84 + 1),
                  safe = s.round !== 2 || tile === s.safe,
                  closing = s.round === 2 && s.time % 4 > 3;
                g.fillStyle(
                  s.round === 2
                    ? parseInt(PLANET_COLORS[tile].slice(1), 16)
                    : (row + col) % 2
                      ? 0x4b496e
                      : 0x424264,
                  closing && !safe ? 0.2 : 0.85,
                );
                g.fillRoundedRect(62 + col * 105, 72 + row * 84, 101, 80, 8);
                if (s.round === 2) {
                  g.lineStyle(2, safe ? 0xfff4c9 : 0x26243c, safe ? 0.9 : 0.25);
                  g.strokeRoundedRect(
                    62 + col * 105,
                    72 + row * 84,
                    101,
                    80,
                    8,
                  );
                  for (let n = 0; n <= tile; n++) {
                    g.fillStyle(0x1b2039, 0.6);
                    g.fillCircle(
                      78 + col * 105 + (n % 3) * 12,
                      87 + row * 84 + Math.floor(n / 3) * 12,
                      3,
                    );
                  }
                }
              }
            for (const o of s.objects) {
              if (s.round === 0) {
                g.fillStyle(0xffda7a, 0.12);
                g.fillCircle(o.x, o.y, 24);
                const points = [];
                for (let i = 0; i < 10; i++) {
                  const angle = (i * Math.PI) / 5 - Math.PI / 2,
                    r = i % 2 ? 8 : 17;
                  points.push(
                    new P.Geom.Point(
                      o.x + Math.cos(angle) * r,
                      o.y + Math.sin(angle) * r,
                    ),
                  );
                }
                g.fillStyle(0xffd879);
                g.fillPoints(points, true);
                g.lineStyle(2, 0xfff0bd);
                g.strokePoints(points, true);
              } else if (o.age < 0.85) {
                g.lineStyle(3, 0xffa981, 0.9);
                g.strokeCircle(o.x, 92, 15 + Math.sin(now / 100) * 4);
                g.lineBetween(o.x, 75, o.x, 110);
              } else {
                g.fillStyle(0xf99567, 0.3);
                g.fillTriangle(
                  o.x - 15,
                  o.y,
                  o.x + 15,
                  o.y,
                  o.x - o.vx * 0.12,
                  o.y - 45,
                );
                g.fillStyle(0xe18173);
                g.fillCircle(o.x, o.y, 18);
                g.fillStyle(0x6f4c6d);
                g.fillCircle(o.x + 5, o.y - 4, 6);
                g.fillStyle(0xffbd87);
                g.fillCircle(o.x - 7, o.y + 4, 4);
              }
            }
            s.players.forEach((p, i) => {
              const label = this.labels[i];
              if (!label) return;
              label.setVisible(p.active);
              if (!p.active) return;
              const old = this.positions.get(p.id) ?? { x: p.x, y: p.y };
              const t = 1 - Math.exp(-delta / 35);
              if (Math.hypot(p.x - old.x, p.y - old.y) > 100) {
                old.x = p.x;
                old.y = p.y;
              } else {
                old.x += (p.x - old.x) * t;
                old.y += (p.y - old.y) * t;
              }
              this.positions.set(p.id, old);
              const { x, y } = old;
              g.fillStyle(0x101224, 0.3);
              g.fillEllipse(x, y + 18, 42, 14);
              g.fillStyle(parseInt(p.color.slice(1), 16));
              g.fillRoundedRect(x - 15, y - 18, 30, 36, 11);
              g.fillStyle(0xfff3d3, 0.6);
              g.fillRoundedRect(x - 10, y - 15, 20, 7, 3);
              g.fillStyle(0x162d48);
              g.fillRoundedRect(x - 11, y - 6, 22, 13, 5);
              g.fillStyle(0xa4f2ed);
              g.fillRoundedRect(x - 8, y - 4, 7, 4, 2);
              g.fillStyle(0xffe6bb);
              g.fillRoundedRect(x - 13, y + 12, 10, 7, 3);
              g.fillRoundedRect(x + 3, y + 12, 10, 7, 3);
              if (p.shield > 0 || p.id === mine) {
                g.lineStyle(
                  p.id === mine ? 3 : 2,
                  p.shield > 0 ? 0xffffff : 0xffdc90,
                  0.65,
                );
                g.strokeEllipse(x, y, 46, 52);
              }
              label
                .setText(p.name + (p.id === mine ? " · YOU" : ""))
                .setPosition(x, y + 28);
            });
          }
        }
        try {
          game = new P.Game({
            type: P.CANVAS,
            parent: target,
            width: 960,
            height: 540,
            backgroundColor: "#11172e",
            scene: Planet,
            scale: { mode: P.Scale.FIT, autoCenter: P.Scale.CENTER_BOTH },
            audio: { noAudio: true },
            render: { antialias: true },
            input: { keyboard: false },
          });
        } catch {
          setError("The game could not start. Close it and try again.");
        }
      })
      .catch(() => {
        if (!disposed)
          setError(
            "Could not load the game engine. Check your connection and try again.",
          );
      });
    return () => {
      disposed = true;
      clearInterval(send);
      game?.destroy(true);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      keyboard.current.clear();
      touch.current.clear();
      link?.socket.off("planet:state", state);
      link?.socket.off("connect", sync);
      link?.socket.off("disconnect", disconnected);
      link?.socket.off("party:removed", removed);
    };
  }, [practice, link, attempt]);
  const scores = [...(hud?.players ?? [])].sort((a, b) => b.score - a.score),
    completed = hud?.complete;
  return (
    <div className="modal">
      <section
        className="game-dialog planet-dialog"
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Party Planet"
      >
        <div className="game-top">
          <div>
            <small>
              PARTY PLANET · {link ? "LIVE MULTIPLAYER" : "SOLO PRACTICE"}
            </small>
            <h2>Small planet. Big party.</h2>
          </div>
          <button onClick={exit} aria-label="Close Party Planet">
            ✕
          </button>
        </div>
        {!practice && !link ? (
          <div className="planet-welcome">
            <span className="planet-orbit">✦</span>
            <h3>Three rounds. One champion.</h3>
            <p>
              Collect stars, dodge meteors, and find the safe color. Move with
              WASD, arrow keys, or touch controls.
            </p>
            <div className="planet-round-cards">
              {PLANET_ROUNDS.map((r, i) => (
                <article key={r.name}>
                  <strong>
                    0{i + 1} · {r.name}
                  </strong>
                  <p>{r.rule}</p>
                </article>
              ))}
            </div>
            <button
              className="primary"
              onClick={() => {
                setHud(null);
                setPractice(true);
              }}
            >
              Practice solo
            </button>
            <button className="secondary" onClick={onFriends}>
              Play with friends →
            </button>
            <p className="muted">
              Friends need a private party and the updated multiplayer server.
              No bots or simulated online players.
            </p>
          </div>
        ) : (
          <>
            <div className="planet-status" role="status">
              <strong>
                {completed
                  ? "Party results"
                  : `Round ${(hud?.round ?? 0) + 1} / 3 · ${PLANET_ROUNDS[hud?.round ?? 0].name}`}
              </strong>
              <span>
                {completed
                  ? "Match complete"
                  : hud?.countdown
                    ? `Get ready · ${Math.ceil(hud.countdown)}`
                    : `${Math.max(0, Math.ceil(20 - (hud?.time ?? 0)))}s left`}
              </span>
            </div>
            <p>
              {completed
                ? scores.some((p) => p.active)
                  ? scores
                      .filter(
                        (p) =>
                          p.active &&
                          p.score ===
                            Math.max(
                              ...scores
                                .filter((p) => p.active)
                                .map((p) => p.score),
                            ),
                      )
                      .map((p) => p.name)
                      .join(" & ") + " · top score"
                  : "All players left the match"
                : PLANET_ROUNDS[hud?.round ?? 0].rule}
            </p>
            {hud?.round === 2 && !completed && (
              <p
                className="planet-safe"
                style={{ borderColor: PLANET_COLORS[hud.safe] }}
              >
                SAFE TILE: <strong>{hud.safe + 1} dots</strong> ·{" "}
                {Math.max(0, 4 - (hud.time % 4)).toFixed(1)}s to lock-in
              </p>
            )}
            <div
              className="planet-canvas"
              ref={mount}
              aria-label="Party Planet arena"
            />
            <p className="muted" role="status">
              {notice}
            </p>
            {error && <p role="alert">{error}</p>}
            <ol className="planet-scores">
              {scores.map((p) => (
                <li key={p.id}>
                  <span style={{ color: p.color }}>●</span> {p.name}:{" "}
                  <strong>{p.score}</strong>
                  {!p.active ? " · left match" : ""}
                </li>
              ))}
            </ol>
            {!completed && (
              <div className="planet-controls">
                {[
                  ["KeyA", "←"],
                  ["KeyW", "↑"],
                  ["KeyS", "↓"],
                  ["KeyD", "→"],
                ].map(([code, label]) => (
                  <button
                    key={code}
                    aria-label={`Move ${label}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      touch.current.add(code);
                    }}
                    onPointerUp={() => touch.current.delete(code)}
                    onPointerCancel={() => touch.current.delete(code)}
                    onLostPointerCapture={() => touch.current.delete(code)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {!link && (
              <button
                className="secondary"
                onClick={() => {
                  setHud(null);
                  setAttempt((n) => n + 1);
                }}
              >
                Restart practice
              </button>
            )}
            <p className="muted">
              {link
                ? "The match continues when you switch tabs. Results stay in this party."
                : "Practice scores stay in this session. Invite friends for a shared match."}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
