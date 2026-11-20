"use client";
import { useEffect, useRef, useState } from "react";
import {
  CloudSimulation,
  CLOUD_PLATFORMS,
  CLOUD_CHAPTERS,
  type CloudInput,
  type CloudResult,
} from "@onlinearcade/core";
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
  const [started, setStarted] = useState(false),
    [attempt, setAttempt] = useState(0),
    [hud, setHud] = useState<Hud | null>(null),
    [paused, setPaused] = useState(false),
    [help, setHelp] = useState(false),
    [error, setError] = useState(""),
    [renderer, setRenderer] = useState(""),
    [best, setBest] = useState<CloudResult | null>(null),
    [recordNotice, setRecordNotice] = useState("");
  const mount = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLElement>(null),
    keys = useRef(new Set<string>()),
    touch = useRef(new Set<string>()),
    simRef = useRef<CloudSimulation | null>(null),
    pauseRef = useRef(false),
    close = useRef(onClose);
  close.current = onClose;
  const pause = (value: boolean) => {
    pauseRef.current = value;
    setPaused(value);
    keys.current.clear();
    touch.current.clear();
    simRef.current?.clearInput();
  };
  useEffect(() => () => audio.current?.dispose(), []);
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
    const before = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.code === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled])",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
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
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, []);
  useEffect(() => {
    if (!started || !mount.current) return;
    const sim = new CloudSimulation();
    simRef.current = sim;
    pauseRef.current = false;
    setPaused(false);
    setError("");
    setHud(null);
    let view: CloudView;
    try {
      view = createCloudView(mount.current, sim);
      setRenderer(view.mode);
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
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
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
  }, [started, attempt, accountId]);
  const restart = () => {
    setHelp(false);
    setRecordNotice("");
    pause(false);
    setAttempt((n) => n + 1);
  };
  const button = (code: string, label: string, accessible = label) => (
    <button
      key={code}
      aria-label={accessible}
      onPointerDown={(e) => {
        e.preventDefault();
        if (paused) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        audio.current?.unlock();
        touch.current.add(code);
        if (code === "Space") simRef.current?.queueJump();
        if (code === "ShiftLeft") simRef.current?.queueDash();
      }}
      onPointerUp={() => touch.current.delete(code)}
      onPointerCancel={() => touch.current.delete(code)}
      onLostPointerCapture={() => touch.current.delete(code)}
    >
      {label}
    </button>
  );
  return (
    <div className="modal">
      <section
        className="game-dialog cloud-dialog"
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Cloudbound"
      >
        <div className="cloud-header">
          <div>
            <span className="eyebrow">3D PARKOUR · SOLO ADVENTURE</span>
            <h2>
              Cloudbound<span>✦</span>
            </h2>
          </div>
          <button
            className="secondary"
            aria-label="Close Cloudbound"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {!started ? (
          <div className="cloud-welcome">
            <div className="cloud-welcome-art" aria-hidden="true">
              <span>☁</span>
              <i>✦</i>
              <b>↑</b>
            </div>
            <span className="eyebrow">THE SUMMIT IS CALLING</span>
            <h3>
              A little courage.
              <br />A lot of sky.
            </h3>
            <p>
              Leap across 31 floating islands through Dawn Gardens, Azure Ruins
              and Starlight Summit. Find crystals, light checkpoints and reach
              the summit portal.
            </p>
            <div className="cloud-features">
              <span>Double jump</span>
              <span>Air dash</span>
              <span>Moving islands</span>
              <span>Checkpoints</span>
            </div>
            <button
              className="primary"
              onClick={() => {
                audio.current ??= createArcadeAudio();
                audio.current.unlock();
                setStarted(true);
              }}
            >
              Begin the climb ↗
            </button>
            <p className="cloud-instructions">
              WASD / arrows move · Space double jump · Shift / X dash · R
              recover · P pause. Touch controls included. Camera follows
              automatically; no mouse lock needed.
            </p>
            {best && (
              <p>
                Best on this browser: <strong>{time(best.elapsedMs)}</strong> ·{" "}
                {best.crystals}/31 crystals
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="cloud-hud">
              <span>
                <small>REGION</small>
                <strong>
                  {
                    CLOUD_CHAPTERS[
                      Math.min(2, Math.floor((hud?.reached ?? 0) / 10))
                    ]
                  }
                </strong>
              </span>
              <span>
                <small>RUN TIME</small>
                <strong>
                  {time(((hud?.time ?? 0) + (hud?.falls ?? 0) * 3) * 1000)}
                </strong>
              </span>
              <span>
                <small>CRYSTALS</small>
                <strong>✦ {hud?.crystals ?? 0} / 31</strong>
              </span>
              <span>
                <small>RECOVERIES</small>
                <strong>
                  {hud?.falls ?? 0} <em>+3s each</em>
                </strong>
              </span>
            </div>
            <div className="cloud-stage">
              <div
                className="cloud-canvas"
                ref={mount}
                aria-label="Cloudbound floating island course"
              />
              {paused && !hud?.finished && (
                <div className="cloud-overlay">
                  <span className="eyebrow">TAKE A BREATHER</span>
                  <h3>Paused above the clouds.</h3>
                  <button className="primary" onClick={() => pause(false)}>
                    Resume climb
                  </button>
                </div>
              )}
              {hud?.finished && (
                <div className="cloud-overlay cloud-victory">
                  <span className="eyebrow">SUMMIT REACHED</span>
                  <h3>You’re Cloudbound.</h3>
                  <p className="cloud-medal">
                    {"★".repeat(hud.result?.medal ?? 1)}
                  </p>
                  <strong>{time(hud.result!.elapsedMs)}</strong>
                  <p>
                    {hud.crystals}/31 crystals · {hud.falls} recoveries
                  </p>
                  <button className="primary" onClick={restart}>
                    Chase a faster climb ↗
                  </button>
                  <button className="secondary" onClick={onClose}>
                    Back to arcade
                  </button>
                </div>
              )}
              {!paused && !hud?.finished && (
                <div className="cloud-corner-cue">
                  {(hud?.respawn ?? 0) > 0.2
                    ? "Back at your checkpoint · keep climbing"
                    : hud?.grounded
                      ? "Space to jump · again in midair"
                      : "Double jump to reach farther"}
                </div>
              )}
            </div>
            <div
              className="cloud-progress"
              aria-label={`Reached island ${(hud?.reached ?? 0) + 1} of 31`}
            >
              {CLOUD_PLATFORMS.map((p) => (
                <span
                  key={p.id}
                  className={`${p.id <= (hud?.reached ?? 0) ? "reached" : ""} ${p.id % 10 === 0 ? "checkpoint" : ""}`}
                />
              ))}
            </div>
            <div className="cloud-toolbar">
              <button
                className="secondary"
                disabled={hud?.finished}
                onClick={() => pause(!paused)}
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                className="secondary"
                disabled={hud?.finished}
                onClick={() => {
                  simRef.current?.respawn();
                }}
              >
                Checkpoint ↺ <small>+3s</small>
              </button>
              <button className="secondary" onClick={restart}>
                Restart
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setHelp(!help);
                  if (!help) pause(true);
                }}
              >
                How to play
              </button>
              <button
                className="secondary"
                onClick={() => {
                  audio.current?.unlock();
                  audio.current?.setMuted(!muted);
                  setMuted(!muted);
                }}
              >
                {muted ? "Sound off" : "Sound on"}
              </button>
              <span className="cloud-dash-meter">
                DASH{" "}
                <i
                  style={{
                    width: `${Math.max(0, 1 - (hud?.dash ?? 0) / 1.25) * 100}%`,
                  }}
                />
              </span>
            </div>
            <div className="cloud-touch">
              <div>
                {button("KeyA", "←", "Move left")}
                {button("KeyW", "↑", "Move forward")}
                {button("KeyS", "↓", "Move backward")}
                {button("KeyD", "→", "Move right")}
              </div>
              <div>
                {button("Space", "JUMP ↑", "Jump")}
                {button("ShiftLeft", "DASH ✦", "Air dash")}
              </div>
            </div>
            {help && (
              <div className="cloud-help">
                <strong>The climb</strong>
                <p>
                  Use WASD or arrows. W moves away from the camera. Tap Space
                  twice for a double jump; hold a direction and tap Shift/X to
                  dash. Use the landing ring to judge your jump.
                </p>
                <p>
                  Gold islands save your checkpoint. Coral cracked islands
                  crumble after 1.3 seconds and return after 3 seconds. Moving
                  islands carry you. Falling returns you to your checkpoint with
                  a three-second penalty; collected crystals stay collected.
                  Reach the last island’s portal to finish.
                </p>
                <p>
                  Gold medal: under 1:40 with no recoveries. Silver: under 2:40.
                  Bronze: finish the climb. Best times are saved on this
                  browser, separately from cloud leaderboards.
                </p>
                <button
                  className="secondary"
                  onClick={() => {
                    setHelp(false);
                    pause(false);
                  }}
                >
                  Got it · resume
                </button>
              </div>
            )}
            {error && <p role="alert">{error}</p>}
            <p className="muted" role="status">
              {renderer === "2d"
                ? "2D compatibility renderer · identical 3D movement and checkpoints"
                : "Three.js · original floating worlds"}{" "}
              ·{" "}
              {best
                ? `Browser best ${time(best.elapsedMs)}`
                : "Finish the climb to set your first browser best."}
              {recordNotice && ` · ${recordNotice}`}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
