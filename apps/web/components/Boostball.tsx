"use client";
import { useEffect, useRef, useState } from "react";
import {
  BoostballSimulation,
  BOOSTBALL_PADS,
  boostballBot,
  type BallInput,
  type BallState,
} from "@onlinearcade/core";
import type { OnlineRaceLink } from "../lib/use-party";
import type { BallCamera, BallView } from "./games/boostball-view";
import { Pause, Play, Zap } from "lucide-react";
import {
  PlayOptions,
  PlayScreen,
  PlayTouchControls,
  driveKeys,
  isGameInput,
} from "./PlayScreen";
import { createArcadeAudio } from "../lib/arcade-audio";

const MATCH_CONNECTED = "Connected · server-controlled match";

function ArenaMap({ state, mine }: { state: BallState; mine: string }) {
  const point = (x: number, y: number) => ({ cx: 8 + x / 6, cy: 8 + y / 6 });
  const pads = state.pads;
  return (
    <svg className="ball-minimap" viewBox="0 0 176 106" aria-hidden="true">
      <rect
        x="8"
        y="8"
        width="160"
        height="90"
        rx="6"
        fill="#1b363b"
        stroke="#8fbab388"
      />
      <path
        d="M88 8v90M8 39h23v28H8m160-28h-23v28h23"
        fill="none"
        stroke="#8fbab372"
      />
      <circle cx="88" cy="53" r="15" fill="none" stroke="#8fbab372" />
      <path
        d="M5 43v20"
        stroke="#79d7ff"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M171 43v20"
        stroke="#ffb078"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {pads &&
        BOOSTBALL_PADS.map((pad, index) => (
          <circle
            key={index}
            {...point(pad.x, pad.y)}
            r="2.2"
            fill={pads[index] > 0 ? "#596765" : "#ffe884"}
          />
        ))}
      {state.cars
        .filter((car) => car.active)
        .map((car) => (
          <circle
            key={car.id}
            {...point(car.x, car.y)}
            r={car.id === mine ? 4.2 : 3.3}
            fill={car.team ? "#ffac70" : "#70cdff"}
            stroke={car.id === mine ? "#fff6dc" : "#172830"}
            strokeWidth="1.6"
          />
        ))}
      <circle
        {...point(state.ball.x, state.ball.y)}
        r="3.2"
        fill="#fff6d8"
        stroke="#111c29"
        strokeWidth="1"
      />
    </svg>
  );
}

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
    [practice, setPractice] = useState<"match" | "free">("match"),
    [hud, setHud] = useState<BallState | null>(null),
    [notice, setNotice] = useState("Loading stadium…"),
    [error, setError] = useState(""),
    [cameraMode, setCameraMode] = useState<BallCamera>("chase"),
    [loading, setLoading] = useState(false),
    [muted, setMuted] = useState(false),
    [paused, setPaused] = useState(false);
  const cameraRef = useRef<BallCamera>("chase");
  const freePlay = !link && practice === "free";
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
      previousGoals = 0,
      previousTouch = 0,
      previousFuel = 100,
      previousCount = 0;
    const mine = link?.memberId ?? "you";
    const sim = link
      ? null
      : new BoostballSimulation(
          freePlay
            ? [{ id: mine, name: "You" }]
            : [
                { id: mine, name: "You" },
                { id: "bot", name: "Sparky · AI" },
              ],
          freePlay,
        );
    const soloInputs = new Map<string, BallInput>();
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
      drift: held.current.has("KeyZ"),
      dodge: held.current.has("KeyX") || queued.current.dodge,
      jump: held.current.has("Space") || queued.current.jump,
    });
    const state = (p: BallState & { sessionId: string }) => {
      if (p.sessionId !== link?.session.id || (latest && p.tick < latest.tick))
        return;
      latest = p;
      lastPacket = performance.now();
      setNotice(MATCH_CONNECTED);
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
              soloInputs.set(mine, input());
              if (!freePlay)
                soloInputs.set("bot", boostballBot(sim.state, "bot"));
              sim.advance(dt, soloInputs);
              if (sim.state.tick > tick)
                queued.current = { jump: false, dodge: false };
              latest = sim.state;
            }
            const s = latest;
            if (s) {
              const totalGoals = s.score[0] + s.score[1];
              if (totalGoals > previousGoals) audio.current?.cue("finish");
              previousGoals = totalGoals;
              const count = Math.ceil(s.countdown);
              if (count && count !== previousCount) audio.current?.cue("move");
              if (!count && previousCount && !s.complete)
                audio.current?.cue("kickoff");
              previousCount = count;
              if (s.lastTouch && s.lastTouch.tick > previousTouch) {
                previousTouch = s.lastTouch.tick;
                if (s.tick - previousTouch < 20)
                  audio.current?.cue("ball-contact");
              }
              const fuel = s.cars.find((car) => car.id === mine)?.fuel ?? 100;
              if (!count && fuel - previousFuel > 19)
                audio.current?.cue("pickup");
              previousFuel = fuel;
              if (now - hudAt > 100) {
                hudAt = now;
                setHud({
                  ...s,
                  score: [...s.score],
                  ball: { ...s.ball },
                  pads: s.pads && [...s.pads],
                  cars: s.cars.map((c) => ({ ...c })),
                });
                if (link && now - lastPacket > 3000 && !s.complete)
                  setNotice("Waiting for server snapshots…");
              }
              try {
                view?.draw(s, pauseRef.current ? 0 : dt, cameraRef.current);
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
  }, [link, attempt, freePlay]);
  const car = hud?.cars.find((value) => value.id === (link?.memberId ?? "you"));
  const upgradedRules = !link || !!hud?.pads;
  const score = hud?.score ?? [0, 0];
  const seconds = hud?.overtime
    ? Math.floor(hud.time)
    : Math.ceil(hud?.time ?? 180);
  const speed = car ? Math.round(Math.hypot(car.vx, car.vy) * 0.3) : 0;
  const scorer = hud?.cars.find((player) => player.id === hud.lastGoal?.scorer);
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
                {link
                  ? "Live party"
                  : freePlay
                    ? "Free play"
                    : "Practice vs Sparky (AI)"}
              </strong>
            </p>
            <p>
              WASD or arrows to drive. Shift boosts, Space jumps and X dodges. C
              switches camera.{" "}
              {upgradedRules &&
                "Hold Z to powerslide. Steer while dodging to change direction."}
            </p>
            {upgradedRules && (
              <p>Drive over a glowing gold pad for 35 boost.</p>
            )}
            {!link && (
              <label>
                Practice mode
                <select
                  value={practice}
                  onChange={(event) => {
                    pause(false);
                    setPractice(
                      event.target.value === "free" ? "free" : "match",
                    );
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    mount.current?.parentElement?.focus({
                      preventScroll: true,
                    });
                  }}
                >
                  <option value="match">Match vs Sparky</option>
                  <option value="free">Free play</option>
                </select>
              </label>
            )}
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
                <button onClick={restart}>
                  {freePlay ? "Reset field" : "Restart practice"}
                </button>
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
        role="group"
        aria-label="Boostball score and time"
      >
        <strong className="ball-blue">
          <span>Blue</span> <b>{score[0]}</b>
        </strong>
        <div className="ball-clock">
          {hud?.overtime && <small>Overtime</small>}
          <strong>
            {hud?.complete
              ? "FT"
              : freePlay
                ? "Free play"
                : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
          </strong>
        </div>
        <strong className="ball-orange">
          <b>{score[1]}</b> <span>Orange</span>
        </strong>
      </div>
      {hud && !hud.complete && (
        <>
          {link && notice !== MATCH_CONNECTED ? (
            <p className="play-message" role="status">
              {notice}
            </p>
          ) : (
            hud.countdown > 0 && (
              <div
                className="ball-kickoff"
                role="status"
                data-team={
                  hud.goal.includes("GOAL") ? hud.lastGoal?.team : undefined
                }
              >
                <strong>{hud.goal}</strong>
                {scorer && hud.goal.includes("GOAL") && (
                  <span>{scorer.name}</span>
                )}
                <b>{Math.ceil(hud.countdown)}</b>
              </div>
            )
          )}
          <ArenaMap state={hud} mine={link?.memberId ?? "you"} />
          <div className="play-corner ball-fuel">
            <div className="ball-speed">
              <strong>{speed}</strong>
              <small>KM/H</small>
            </div>
            <div className="ball-boost-meter">
              <div>
                <Zap size={14} aria-hidden="true" />
                <span>Boost</span>
                <strong>{Math.round(car?.fuel ?? 100)}%</strong>
              </div>
              <progress
                className="play-meter"
                max={100}
                value={car?.fuel ?? 100}
                aria-label="Boost fuel"
              />
              <small>
                {car?.drifting
                  ? "Powerslide"
                  : car?.height && car.height > 1
                    ? "Airborne"
                    : car?.cooldown
                      ? `Dodge ${car.cooldown.toFixed(1)}s`
                      : "Dodge ready"}
              </small>
            </div>
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
            left={
              upgradedRules
                ? [...driveKeys, ["KeyZ", "Slide", "Powerslide"]]
                : driveKeys
            }
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
                  : `${score[0] > score[1] ? "Blue" : "Orange"} wins${hud.overtime ? " in overtime" : ""}`
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
                    {!!player.goals &&
                      ` · ${player.goals} ${player.goals === 1 ? "goal" : "goals"}`}
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
