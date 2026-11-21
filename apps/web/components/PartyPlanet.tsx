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
import {
  PlayOptions,
  PlayScreen,
  PlayTouchControls,
  isGameInput,
} from "./PlayScreen";
import { createArcadeAudio } from "../lib/arcade-audio";
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
  const [attempt, setAttempt] = useState(0),
    [hud, setHud] = useState<PlanetState | null>(null),
    [notice, setNotice] = useState("Loading the planet…"),
    [error, setError] = useState(""),
    [muted, setMuted] = useState(false);
  const mount = useRef<HTMLDivElement>(null),
    keyboard = useRef(new Set<string>()),
    touch = useRef(new Set<string>()),
    audio = useRef<ReturnType<typeof createArcadeAudio> | null>(null);
  const exit = () => {
    if (link) link.socket.emit("planet:exit", link.session.id);
    onClose();
  };
  useEffect(() => {
    audio.current = createArcadeAudio();
    return () => {
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => audio.current?.setMuted(muted), [muted]);
  useEffect(() => {
    if (!mount.current) return;
    setHud(null);
    setNotice(link ? "Connecting to the match…" : "Loading Party Planet…");
    setError("");
    let disposed = false,
      game: Phaser.Game | undefined,
      resize: ResizeObserver | undefined;
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
      if (!isGameInput(e)) return;
      if (!e.repeat) audio.current?.unlock();
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
          feedback = new Map<
            string,
            { score: number; shield: number; pulse: number; gained: boolean }
          >();
          lastRound = -1;

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
            if (!link) setNotice("Solo practice");
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
            if (s.round !== this.lastRound) {
              if (this.lastRound >= 0) audio.current?.cue("clear");
              this.lastRound = s.round;
              this.positions.clear();
              this.feedback.clear();
            }
            const g = this.graphics;
            g.clear();
            const accents = [0xffd879, 0xff9475, 0x9ceadc];
            const accent = accents[s.round];
            g.fillGradientStyle(0x10172f, 0x211c3d, 0x212851, 0x11162d);
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
            g.lineStyle(3, accent, 0.68);
            g.strokeRoundedRect(49, 59, 862, 432, 30);
            g.lineStyle(1, accent, 0.3);
            g.strokeRoundedRect(42, 51, 876, 447, 34);
            for (let i = 0; i < 21; i++) {
              g.fillStyle(accent, 0.2 + Math.sin(now / 400 - i * 0.4) * 0.16);
              g.fillRoundedRect(70 + i * 41, 66, 21, 2, 1);
              g.fillRoundedRect(70 + i * 41, 483, 21, 2, 1);
            }
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
                if (s.round !== 2) {
                  g.lineStyle(1, accent, 0.14);
                  g.lineBetween(
                    69 + col * 105,
                    76 + row * 84,
                    151 + col * 105,
                    76 + row * 84,
                  );
                }
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
              const cue = this.feedback.get(p.id) ?? {
                score: p.score,
                shield: p.shield,
                pulse: 0,
                gained: false,
              };
              if (p.score !== cue.score || p.shield > cue.shield + 0.2) {
                cue.gained = p.score > cue.score;
                cue.pulse = s.round === 1 && cue.gained ? 0.2 : 0.54;
                if (p.id === mine && (!cue.gained || s.round !== 1))
                  audio.current?.cue(cue.gained ? "pickup" : "hit");
              }
              cue.pulse = Math.max(0, cue.pulse - delta / 1000);
              cue.score = p.score;
              cue.shield = p.shield;
              this.feedback.set(p.id, cue);
              if (cue.pulse > 0) {
                const color = cue.gained ? 0xffdf93 : 0xff8f91;
                const radius = 22 + (0.55 - cue.pulse) * 66;
                g.lineStyle(3, color, cue.pulse * 1.7);
                g.strokeCircle(x, y, radius);
              }
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
            type: P.AUTO,
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
          resize = new ResizeObserver(() => game?.scale.refresh());
          resize.observe(target);
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
      resize?.disconnect();
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
  }, [link, attempt]);
  const scores = [...(hud?.players ?? [])].sort((a, b) => b.score - a.score);
  const players = scores.filter((player) => player.active);
  const winner = players
    .filter((player) => player.score === players[0]?.score)
    .map((player) => player.name)
    .join(" & ");
  const round = PLANET_ROUNDS[hud?.round ?? 0];
  const seconds = Math.max(0, Math.ceil(20 - (hud?.time ?? 0)));
  const restart = () => setAttempt((value) => value + 1);
  return (
    <PlayScreen
      name="Party Planet"
      className="play-fixed-world play-planet"
      onExit={exit}
      exitLabel={link ? "Return to party" : undefined}
      tools={
        <PlayOptions>
          <p>
            <strong>
              Party Planet {link ? "· Live party" : "· Solo practice"}
            </strong>
          </p>
          <p>Move with WASD, arrows, or the touch pad. {round.rule}</p>
          {link && (
            <p>{notice} The round keeps running while this menu is open.</p>
          )}
          {!link && (
            <>
              <button onClick={restart}>Restart practice</button>
              <button onClick={onFriends}>Play with friends</button>
            </>
          )}
          <button
            aria-pressed={muted}
            onClick={() => {
              audio.current?.unlock();
              setMuted(!muted);
            }}
          >
            {muted ? "Turn sound on" : "Mute sound"}
          </button>
        </PlayOptions>
      }
    >
      <div tabIndex={-1} className="play-field">
        <div
          className="planet-canvas"
          ref={mount}
          aria-label="Party Planet arena"
        />
      </div>
      {hud && (
        <div className="play-hud">
          <span className="hud-extra">Round {hud.round + 1}/3</span>
          <strong>{round.name}</strong>
          <span>
            {hud.countdown > 0 ? `${Math.ceil(hud.countdown)}…` : `${seconds}s`}
          </span>
        </div>
      )}
      {hud && !hud.complete && (
        <p className="play-message" role="status">
          {link && notice !== "Connected · live party match"
            ? notice
            : hud.round === 2 && !hud.countdown
              ? `Safe tile: ${hud.safe + 1} dots · ${(4 - (hud.time % 4)).toFixed(1)}s`
              : round.rule}
        </p>
      )}
      {scores.length > 0 && !hud?.complete && (
        <ol className="planet-scores planet-live-scores" aria-label="Scores">
          {scores.map((player) => (
            <li key={player.id}>
              <span style={{ color: player.color }}>●</span> {player.name}{" "}
              <strong>{player.score}</strong>
            </li>
          ))}
        </ol>
      )}
      <PlayTouchControls
        left={[
          ["KeyA", "←", "Move left"],
          ["KeyW", "↑", "Move up"],
          ["KeyS", "↓", "Move down"],
          ["KeyD", "→", "Move right"],
        ]}
        disabled={!hud || hud.complete || !!error}
        onKey={(code, down) => {
          if (down) {
            audio.current?.unlock();
            touch.current.add(code);
          } else touch.current.delete(code);
        }}
      />
      {(!hud || hud.complete || error) && (
        <div className="play-center" role={error ? "alert" : undefined}>
          <h2>
            {error
              ? "Party Planet unavailable"
              : hud?.complete
                ? link
                  ? "Party results"
                  : "Practice complete"
                : notice}
          </h2>
          {error && <p>{error}</p>}
          {hud?.complete && (
            <>
              <p>
                {link
                  ? winner
                    ? `${winner} · top score`
                    : "Everyone left the match"
                  : `${scores[0]?.score ?? 0} points`}
              </p>
              {link && (
                <ol className="planet-scores">
                  {scores.map((player) => (
                    <li key={player.id}>
                      <strong>{player.name}</strong> · {player.score}
                      {player.active ? "" : " · left"}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
          {(hud?.complete || error) && (
            <button className="primary" onClick={link ? exit : restart}>
              {link ? "Return to party" : error ? "Try again" : "Play again"}
            </button>
          )}
        </div>
      )}
    </PlayScreen>
  );
}
