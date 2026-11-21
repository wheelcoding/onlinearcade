"use client";
import { useEffect, useRef, useState } from "react";
import {
  CloudSimulation,
  CLOUD_PLATFORMS,
  CLOUD_CHAPTERS,
  type CloudInput,
  type CloudResult,
} from "@onlinearcade/core";
import { Pause, Play } from "lucide-react";
import {
  PlayOptions,
  PlayScreen,
  PlayTouchControls,
  isGameInput,
} from "./PlayScreen";
import { createCloudView, type CloudView } from "./games/cloudbound-view";
import { createArcadeAudio } from "../lib/arcade-audio";
import { cloudRecordKey, parseCloudResult } from "../lib/cloudbound-records";
type Hud = {
  time: number;
  falls: number;
  crystals: number;
  checkpoint: number;
  reached: number;
  grounded: boolean;
  dash: number;
  finished: boolean;
  result: CloudResult | null;
  respawn: number;
};
const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(Math.floor(ms / 10) % 100).padStart(2, "0")}`;
export default function Cloudbound({
  onClose,
  accountId,
}: {
  onClose: () => void;
  accountId?: string;
}) {
  const audio = useRef<ReturnType<typeof createArcadeAudio> | null>(null);
  const [muted, setMuted] = useState(false);
  const [attempt, setAttempt] = useState(0),
    [hud, setHud] = useState<Hud | null>(null),
    [paused, setPaused] = useState(false),
    [error, setError] = useState(""),
    [best, setBest] = useState<CloudResult | null>(null),
    [recordNotice, setRecordNotice] = useState("");
  const mount = useRef<HTMLDivElement>(null),
    keys = useRef(new Set<string>()),
    touch = useRef(new Set<string>()),
    simRef = useRef<CloudSimulation | null>(null),
    pauseRef = useRef(false);
  const pause = (value: boolean) => {
    pauseRef.current = value;
    setPaused(value);
    keys.current.clear();
    touch.current.clear();
    simRef.current?.clearInput();
  };
  useEffect(() => {
    audio.current = createArcadeAudio();
    return () => {
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    try {
      setBest(
        parseCloudResult(
          JSON.parse(localStorage.getItem(cloudRecordKey(accountId)) || "null"),
        ),
      );
    } catch {}
  }, [accountId]);
  useEffect(() => {
    if (!mount.current) return;
    const sim = new CloudSimulation();
    simRef.current = sim;
    pauseRef.current = false;
    setPaused(false);
    setError("");
    setHud(null);
    let view: CloudView;
    try {
      view = createCloudView(mount.current, sim);
    } catch {
      setError(
        "The game renderer could not start. Close the game and try again.",
      );
      return;
    }
    let raf = 0,
      last = performance.now(),
      hudAt = 0,
      reported = false,
      finalHud = false;
    let previous = { jumps: 0, crystals: 0, checkpoint: 0, falls: 0, dash: 0 };
    const held = (...codes: string[]) =>
      codes.some((c) => keys.current.has(c) || touch.current.has(c));
    const input = (): CloudInput => ({
      x: Number(held("KeyD", "ArrowRight")) - Number(held("KeyA", "ArrowLeft")),
      forward:
        Number(held("KeyW", "ArrowUp")) - Number(held("KeyS", "ArrowDown")),
      jump: held("Space"),
      dash: held("ShiftLeft", "ShiftRight", "KeyX"),
    });
    const keydown = (e: KeyboardEvent) => {
      if (!isGameInput(e)) return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.code === "KeyP" && !e.repeat) {
        pause(!pauseRef.current);
        return;
      }
      if (pauseRef.current || sim.finished) return;
      audio.current?.unlock();
      if (e.code === "KeyR" && !e.repeat) sim.respawn();
      if (e.code === "Space" && !e.repeat) sim.queueJump();
      if (["ShiftLeft", "ShiftRight", "KeyX"].includes(e.code) && !e.repeat)
        sim.queueDash();
      keys.current.add(e.code);
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.code),
      blur = () => {
        if (!sim.finished) pause(true);
      },
      hidden = () => {
        if (document.hidden) blur();
      };
    const animate = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pauseRef.current) {
        sim.advance(dt, input());
        if (sim.jumps > previous.jumps) audio.current?.cue("jump");
        if (sim.crystals.size > previous.crystals) audio.current?.cue("pickup");
        if (sim.checkpoint > previous.checkpoint) audio.current?.cue("clear");
        if (sim.falls > previous.falls) audio.current?.cue("hit");
        if (sim.dashCooldown > previous.dash) audio.current?.cue("boost");
        previous = {
          jumps: sim.jumps,
          crystals: sim.crystals.size,
          checkpoint: sim.checkpoint,
          falls: sim.falls,
          dash: sim.dashCooldown,
        };
        if (sim.finished && !reported && sim.result) {
          reported = true;
          audio.current?.cue("finish");
          setBest((previous) => {
            const next =
              !previous || sim.result!.elapsedMs < previous.elapsedMs
                ? sim.result!
                : previous;
            try {
              localStorage.setItem(
                cloudRecordKey(accountId),
                JSON.stringify(next),
              );
            } catch {
              setRecordNotice("This browser could not save your best time.");
            }
            return next;
          });
        }
      }
      if ((now - hudAt > 70 || sim.finished) && !finalHud) {
        hudAt = now;
        setHud({
          time: sim.time,
          falls: sim.falls,
          crystals: sim.crystals.size,
          checkpoint: sim.checkpoint,
          reached: sim.reached,
          grounded: sim.standing !== null,
          dash: sim.dashCooldown,
          finished: sim.finished,
          result: sim.result,
          respawn: sim.respawnPulse,
        });
        if (sim.finished) finalHud = true;
      }
      view.draw(sim, pauseRef.current ? 0 : dt);
      raf = requestAnimationFrame(animate);
    };
    const resize = new ResizeObserver(view.resize);
    resize.observe(mount.current);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      view.dispose();
      keys.current.clear();
      touch.current.clear();
      simRef.current = null;
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [attempt, accountId]);
  const restart = () => {
    setRecordNotice("");
    pause(false);
    setAttempt((value) => value + 1);
  };
  const timeMs = ((hud?.time ?? 0) + (hud?.falls ?? 0) * 3) * 1000;
  return (
    <PlayScreen
      name="Cloudbound"
      onExit={onClose}
      className="play-cloud"
      tools={
        <>
          <button
            className="play-icon"
            disabled={!!error || hud?.finished}
            aria-label={paused ? "Resume climb" : "Pause climb"}
            onClick={() => pause(!paused)}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <PlayOptions>
            <p>
              <strong>Cloudbound</strong>
            </p>
            <p>
              WASD or arrows to move. Tap Space twice for a double jump and
              Shift to dash. Aim for the landing ring.
            </p>
            <p>
              Gold islands save your checkpoint. Falling or pressing R sends you
              back with a three-second penalty.
            </p>
            {best && (
              <p>
                Best climb {time(best.elapsedMs)} · {best.crystals}/31 crystals
              </p>
            )}
            <button
              disabled={hud?.finished || !!error}
              onClick={() => simRef.current?.respawn()}
            >
              Return to checkpoint (+3s)
            </button>
            <button onClick={restart}>Restart climb</button>
            <button
              aria-pressed={muted}
              onClick={() => {
                audio.current?.unlock();
                audio.current?.setMuted(!muted);
                setMuted(!muted);
              }}
            >
              {muted ? "Turn sound on" : "Mute sound"}
            </button>
          </PlayOptions>
        </>
      }
    >
      <div tabIndex={-1} className="play-field">
        <div
          className="cloud-canvas"
          ref={mount}
          aria-label="Cloudbound floating island course"
        />
      </div>
      <div className="cloud-hud play-hud">
        <span className="hud-extra">
          <small>Region</small>
          <strong>
            {CLOUD_CHAPTERS[Math.min(2, Math.floor((hud?.reached ?? 0) / 10))]}
          </strong>
        </span>
        <span>
          <small>Time</small>
          <strong>{time(timeMs)}</strong>
        </span>
        <span>
          <small>Crystals</small>
          <strong>✦ {hud?.crystals ?? 0}/31</strong>
        </span>
      </div>
      <div
        className="cloud-progress"
        aria-label={`Island ${(hud?.reached ?? 0) + 1} of 31`}
      >
        {CLOUD_PLATFORMS.map((platform) => (
          <span
            key={platform.id}
            className={`${platform.id <= (hud?.reached ?? 0) ? "reached" : ""} ${platform.id % 10 === 0 ? "checkpoint" : ""}`}
          />
        ))}
      </div>
      {!paused && !hud?.finished && (
        <>
          {(hud?.respawn ?? 0) > 0.2 && (
            <p className="play-message" role="status">
              Checkpoint restored · +3 seconds
            </p>
          )}
          <div className="play-corner">
            <span>Dash</span>
            <progress
              className="play-meter"
              max={1.25}
              value={Math.max(0, 1.25 - (hud?.dash ?? 0))}
              aria-label="Air dash charge"
            />
            <strong>{hud?.dash ? `${hud.dash.toFixed(1)}s` : "Ready"}</strong>
            <span>{hud?.falls ?? 0} falls</span>
          </div>
          <PlayTouchControls
            left={[
              ["KeyA", "←", "Move left"],
              ["KeyW", "↑", "Move forward"],
              ["KeyS", "↓", "Move backward"],
              ["KeyD", "→", "Move right"],
            ]}
            right={[
              ["ShiftLeft", "Dash", "Air dash"],
              ["Space", "Jump"],
            ]}
            disabled={!!error}
            onKey={(key, down) => {
              if (!down) {
                touch.current.delete(key);
                return;
              }
              audio.current?.unlock();
              touch.current.add(key);
              if (key === "Space") simRef.current?.queueJump();
              if (key === "ShiftLeft") simRef.current?.queueDash();
            }}
          />
        </>
      )}
      {(paused || hud?.finished || error) && (
        <div className="play-center" role={error ? "alert" : undefined}>
          <h2>
            {error
              ? "Cloudbound could not start"
              : hud?.finished
                ? "Summit reached"
                : "Paused"}
          </h2>
          {error && <p>{error}</p>}
          {hud?.result && (
            <>
              <strong className="play-result">
                {time(hud.result.elapsedMs)}
              </strong>
              <p>
                {"★".repeat(hud.result.medal)} · {hud.crystals}/31 crystals ·{" "}
                {hud.falls} recoveries
              </p>
              {recordNotice && <p role="status">{recordNotice}</p>}
            </>
          )}
          <button
            className="primary"
            onClick={() =>
              paused && !hud?.finished && !error ? pause(false) : restart()
            }
          >
            {error
              ? "Try again"
              : hud?.finished
                ? "Climb again"
                : "Resume climb"}
          </button>
        </div>
      )}
    </PlayScreen>
  );
}
