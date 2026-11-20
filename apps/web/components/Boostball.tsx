"use client";
import { useEffect, useRef, useState } from "react";
import {
  BoostballSimulation,
  boostballBot,
  type BallInput,
  type BallState,
} from "@onlinearcade/core";
import type { OnlineRaceLink } from "../lib/use-party";
import type { BallCamera, BallView } from "./games/boostball-view";
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
    [error, setError] = useState(""),
    [cameraMode, setCameraMode] = useState<BallCamera>("chase"),
    [loading, setLoading] = useState(false);
  const cameraRef = useRef<BallCamera>("chase");
  cameraRef.current = cameraMode;
  const mount = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLElement>(null),
    held = useRef(new Set<string>()),
    queued = useRef({ jump: false, dodge: false }),
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
      view: BallView | undefined,
      frame = 0,
      paused = false,
      previousFrame = performance.now(),
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
    setLoading(true);
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
      dodge: held.current.has("KeyX") || queued.current.dodge,
      jump: held.current.has("Space") || queued.current.jump,
    });
    const state = (p: BallState & { sessionId: string }) => {
      if (p.sessionId !== link?.session.id || (latest && p.tick < latest.tick))
        return;
      latest = p;
      lastPacket = performance.now();
      setNotice("Connected · server-controlled match");
    };
    const reset = () => {
      queued.current = { jump: false, dodge: false };
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
      if (e.code === "KeyC" && !e.repeat)
        setCameraMode((m) =>
          m === "chase" ? "ball" : m === "ball" ? "stadium" : "chase",
        );
      if (!e.repeat && e.code === "Space") queued.current.jump = true;
      if (!e.repeat && e.code === "KeyX") queued.current.dodge = true;
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
      if (link?.socket.connected && !latest?.complete) {
        link.socket.emit("ball:input", {
          sessionId: link.session.id,
          seq: ++seq,
          input: input(),
        });
        queued.current = { jump: false, dodge: false };
      }
    }, 1000 / 30);
    import("./games/boostball-view")
      .then(({ createBoostballView }) => {
        if (disposed || !mount.current) return;
        try {
          view = createBoostballView(mount.current, mine, () => {
            paused = true;
            held.current.clear();
            setError(
              "The 3D graphics context was interrupted. Use Reload stadium to reconnect.",
            );
          });
          if (view.software)
            setNotice(
              link
                ? "Connected · software 3D graphics"
                : "Practice · You vs Sparky (AI) · software 3D graphics",
            );
          setLoading(false);
          previousFrame = performance.now();
          const animate = (now: number) => {
            if (disposed || paused) return;
            const dt = Math.min(
              0.05,
              Math.max(0, (now - previousFrame) / 1000),
            );
            previousFrame = now;
            if (sim) {
              const tick = sim.state.tick;
              sim.advance(
                dt,
                new Map([
                  [mine, input()],
                  ["bot", boostballBot(sim.state, "bot")],
                ]),
              );
              if (sim.state.tick > tick)
                queued.current = { jump: false, dodge: false };
              latest = sim.state;
            }
            const s = latest;
            if (s) {
              if (now - hudAt > 100) {
                hudAt = now;
                setHud({
                  ...s,
                  score: [...s.score],
                  cars: s.cars.map((c) => ({ ...c })),
                });
                if (link && now - lastPacket > 3000 && !s.complete)
                  setNotice("Waiting for server snapshots…");
              }
              try {
                view?.draw(s, dt, cameraRef.current);
              } catch {
                paused = true;
                held.current.clear();
                setError(
                  "The stadium could not render. Use Reload stadium to retry.",
                );
                return;
              }
            }
            frame = requestAnimationFrame(animate);
          };
          frame = requestAnimationFrame(animate);
        } catch (cause) {
          console.error("Boostball stadium initialization failed", cause);
          setLoading(false);
          setError(
            "Could not start 3D graphics. Enable WebGL in your browser, then reload the stadium.",
          );
        }
      })
      .catch(() => {
        if (!disposed) {
          setLoading(false);
          setError(
            "Could not load the 3D stadium. Check your connection and retry.",
          );
        }
      });
    return () => {
      disposed = true;
      clearInterval(send);
      cancelAnimationFrame(frame);
      view?.dispose();
      reset();
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
              BOOSTBALL · {link ? "LIVE MULTIPLAYER" : "3D CAR SOCCER"}
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
              A floodlit stadium. Rocket-powered cars. Jump into aerial
              challenges, boost into the ball, and bank shots past your friends.
            </p>
            <div className="ball-features">
              <span>2–8 friends · balanced teams</span>
              <span>3-minute matches</span>
              <span>3D · three camera modes</span>
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
            <p className="ball-announcement" role="status">
              {hud?.complete
                ? score[0] === score[1]
                  ? "Draw · well played!"
                  : `${score[0] > score[1] ? "Blue" : "Orange"} team wins!`
                : hud?.countdown
                  ? `${hud.goal} · ${Math.ceil(hud.countdown)}`
                  : `You are ${car?.team ? "ORANGE" : "BLUE"} · attack the ${car?.team ? "BLUE" : "ORANGE"} goal`}
            </p>
            <div className="ball-camera-bar" aria-label="Camera mode">
              {(["chase", "ball", "stadium"] as const).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={cameraMode === mode}
                  onClick={() => setCameraMode(mode)}
                >
                  {mode === "chase"
                    ? "Chase camera"
                    : mode === "ball"
                      ? "Ball camera"
                      : "Stadium view"}
                </button>
              ))}
              <span>
                {car && (car.height ?? 0) > 1 ? "AIRBORNE" : "SPACE TO JUMP"}
              </span>
            </div>
            <div className="ball-stage-wrap">
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

              <div
                className="ball-stage"
                ref={mount}
                aria-label="Boostball 3D car soccer stadium"
              />
              {(loading || (!hud && !error)) && (
                <div className="ball-stage-loading" role="status">
                  {loading
                    ? "Building the 3D stadium…"
                    : "Waiting for the live match…"}
                </div>
              )}
            </div>
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
            {error && (
              <div role="alert" className="ball-graphics-error">
                <p>{error}</p>
                <button
                  className="secondary"
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  Reload stadium
                </button>
              </div>
            )}
            <div className="ball-controls">
              {[
                ["KeyA", "←", "Steer left"],
                ["KeyD", "→", "Steer right"],
                ["KeyW", "GAS", "Accelerate"],
                ["KeyS", "BRAKE", "Brake or reverse"],
                ["ShiftLeft", "BOOST", "Boost"],
                ["Space", "JUMP", "Jump"],
                ["KeyX", "DODGE", "Dodge burst"],
              ].map(([code, label, aria]) => (
                <button
                  key={code}
                  aria-label={aria}
                  disabled={hud?.complete}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    if (code === "Space") queued.current.jump = true;
                    if (code === "KeyX") queued.current.dodge = true;
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
              W/S or ↑/↓ drive · A/D or ←/→ steer · Shift boost · Space jump · X
              dodge · C camera. Boost recharges when released. Jump + boost
              extends airtime.
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
