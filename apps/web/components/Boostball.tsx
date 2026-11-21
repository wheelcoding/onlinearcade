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
import { Pause, Play } from "lucide-react";
import {
  PlayOptions,
  PlayScreen,
  PlayTouchControls,
  driveKeys,
  isGameInput,
} from "./PlayScreen";
import { createArcadeAudio } from "../lib/arcade-audio";
export default function Boostball({
  link,
  onClose,
  onFriends,
}: {
  link?: OnlineRaceLink;
  onClose: () => void;
  onFriends: () => void;
}) {
  const [attempt, setAttempt] = useState(0),
    [hud, setHud] = useState<BallState | null>(null),
    [notice, setNotice] = useState("Loading stadium…"),
    [error, setError] = useState(""),
    [cameraMode, setCameraMode] = useState<BallCamera>("chase"),
    [loading, setLoading] = useState(false),
    [muted, setMuted] = useState(false),
    [paused, setPaused] = useState(false);
  const cameraRef = useRef<BallCamera>("chase");
  cameraRef.current = cameraMode;
  const mount = useRef<HTMLDivElement>(null),
    indicator = useRef<HTMLDivElement>(null),
    held = useRef(new Set<string>()),
    queued = useRef({ jump: false, dodge: false }),
    audio = useRef<ReturnType<typeof createArcadeAudio> | null>(null),
    pauseRef = useRef(false);
  const exit = () => {
    link?.socket.emit("ball:exit", link.session.id);
    onClose();
  };
  const pause = (value: boolean) => {
    if (link) return;
    pauseRef.current = value;
    setPaused(value);
    held.current.clear();
    queued.current = { jump: false, dodge: false };
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
    let disposed = false,
      view: BallView | undefined,
      frame = 0,
      paused = false,
      previousFrame = performance.now(),
      seq = Date.now(),
      lastPacket = performance.now(),
      hudAt = 0,
      previousGoals = 0;
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
      if (!isGameInput(e)) return;
      if (!e.repeat) audio.current?.unlock();
      if (e.code === "KeyP" && !e.repeat && !latest?.complete) {
        pause(!pauseRef.current);
        return;
      }
      if (pauseRef.current) return;
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
    const blur = () => {
      reset();
      if (!link && !latest?.complete) pause(true);
    };
    window.addEventListener("blur", blur);
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
          view = createBoostballView(
            mount.current,
            mine,
            indicator.current,
            () => {
              paused = true;
              held.current.clear();
              setError(
                "The 3D graphics context was interrupted. Use Reload stadium to reconnect.",
              );
            },
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
            if (sim && !pauseRef.current) {
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
              const totalGoals = s.score[0] + s.score[1];
              if (totalGoals > previousGoals) audio.current?.cue("finish");
              previousGoals = totalGoals;
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
      window.removeEventListener("blur", blur);
      link?.socket.off("ball:state", state);
      link?.socket.off("connect", sync);
      link?.socket.off("disconnect", disconnected);
      link?.socket.off("party:removed", removed);
    };
  }, [link, attempt]);
  const car = hud?.cars.find((value) => value.id === (link?.memberId ?? "you"));
  const score = hud?.score ?? [0, 0];
  const seconds = Math.ceil(hud?.time ?? 180);
  const restart = () => {
    pause(false);
    setAttempt((value) => value + 1);
  };
  const nextCamera = () =>
    setCameraMode((mode) =>
      mode === "chase" ? "ball" : mode === "ball" ? "stadium" : "chase",
    );
  return (
    <PlayScreen
      name="Boostball"
      className="play-ball"
      onExit={exit}
      exitLabel={link ? "Return to party" : undefined}
      tools={
        <>
          {!link && (
            <button
              className="play-icon"
              disabled={!hud || hud.complete || !!error}
              aria-label={paused ? "Resume match" : "Pause match"}
              onClick={() => pause(!paused)}
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          )}
          <PlayOptions>
            <p>
              <strong>
                Boostball {link ? "· Live party" : "· Practice vs Sparky (AI)"}
              </strong>
            </p>
            <p>
              WASD or arrows to drive. Shift boosts, Space jumps, X dodges, and
              C changes camera. Jump and boost to reach high balls.
            </p>
            <label>
              Camera
              <select
                value={cameraMode}
                onChange={(event) =>
                  setCameraMode(event.target.value as BallCamera)
                }
              >
                <option value="chase">Chase camera</option>
                <option value="ball">Ball camera</option>
                <option value="stadium">Stadium view</option>
              </select>
            </label>
            <button
              aria-pressed={muted}
              onClick={() => {
                audio.current?.unlock();
                setMuted(!muted);
              }}
            >
              {muted ? "Turn sound on" : "Mute sound"}
            </button>
            {!link && (
              <>
                <button onClick={restart}>Restart practice</button>
                <button onClick={onFriends}>Play with friends</button>
              </>
            )}
            {link && <p role="status">{notice}</p>}
          </PlayOptions>
        </>
      }
    >
      <div tabIndex={-1} className="play-field">
        <div
          className="ball-stage"
          ref={mount}
          aria-label="Boostball 3D car soccer stadium"
        />
        <div
          className="ball-indicator"
          ref={indicator}
          hidden
          aria-hidden="true"
        >
          <i />
        </div>
      </div>
      <div
        className="ball-scoreboard play-hud"
        aria-label="Boostball score and time"
      >
        <strong className="ball-blue">
          Blue <b>{score[0]}</b>
        </strong>
        <span>
          {hud?.complete
            ? "FT"
            : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
        </span>
        <strong className="ball-orange">
          <b>{score[1]}</b> Orange
        </strong>
      </div>
      {hud && !hud.complete && (
        <>
          {(hud.countdown > 0 ||
            (link && notice !== "Connected · server-controlled match")) && (
            <p className="play-message" role="status">
              {link && notice !== "Connected · server-controlled match"
                ? notice
                : `${hud.goal} · ${Math.ceil(hud.countdown)}`}
            </p>
          )}
          <div className="play-corner ball-fuel">
            <span>Boost</span>
            <progress
              className="play-meter"
              max={100}
              value={car?.fuel ?? 100}
              aria-label="Boost fuel"
            />
            <strong>{Math.round(car?.fuel ?? 100)}%</strong>
            <span>
              {car && (car.height ?? 0) > 1
                ? "Airborne"
                : car?.cooldown
                  ? `Dodge ${car.cooldown.toFixed(1)}s`
                  : "Dodge ready"}
            </span>
          </div>
          <button
            className="play-camera-icon play-icon"
            onClick={nextCamera}
            aria-label="Switch camera"
            title="Switch camera (C)"
          >
            {cameraMode === "chase"
              ? "Car"
              : cameraMode === "ball"
                ? "Ball"
                : "Wide"}
          </button>
          <PlayTouchControls
            left={driveKeys}
            right={[
              ["ArrowDown", "Brake"],
              ["ArrowUp", "Gas", "Accelerate"],
              ["ShiftLeft", "Boost"],
              ["Space", "Jump"],
              ["KeyX", "Dodge"],
            ]}
            disabled={!!error || paused}
            onKey={(code, down) => {
              if (!down) {
                held.current.delete(code);
                return;
              }
              audio.current?.unlock();
              if (code === "Space") queued.current.jump = true;
              if (code === "KeyX") queued.current.dodge = true;
              held.current.add(code);
            }}
          />
        </>
      )}
      {(loading || !hud || error || paused || hud.complete) && (
        <div className="play-center" role={error ? "alert" : undefined}>
          <h2>
            {error
              ? "Stadium unavailable"
              : hud?.complete
                ? score[0] === score[1]
                  ? "Full-time draw"
                  : `${score[0] > score[1] ? "Blue" : "Orange"} wins`
                : paused
                  ? "Paused"
                  : loading
                    ? "Loading stadium…"
                    : "Waiting for the match…"}
          </h2>
          {error && <p>{error}</p>}
          {hud?.complete && (
            <>
              <strong className="play-result">
                {score[0]} – {score[1]}
              </strong>
              <ol className="planet-scores">
                {hud.cars.map((player) => (
                  <li
                    key={player.id}
                    className={player.team ? "ball-orange" : "ball-blue"}
                  >
                    {player.name}
                    {player.active ? "" : " · left"}
                  </li>
                ))}
              </ol>
            </>
          )}
          {error && (
            <button className="primary" onClick={restart}>
              Reload stadium
            </button>
          )}
          {paused && !error && !hud?.complete && (
            <button className="primary" onClick={() => pause(false)}>
              Resume match
            </button>
          )}
          {hud?.complete && (
            <button className="primary" onClick={link ? exit : restart}>
              {link ? "Return to party" : "Play again"}
            </button>
          )}
        </div>
      )}
    </PlayScreen>
  );
}
