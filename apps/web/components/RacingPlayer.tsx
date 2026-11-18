"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  TRACKS,
  getTrack,
  sampleTrack,
  trackLength,
  saveRaceResult,
  type TrackId,
  type RaceResult,
  type RaceRecords,
} from "@onlinearcade/core";
import type { GameControl } from "./games/PhaserArcade";
import type { RaceHud } from "./games/KartCircuit";
import { useAccount } from "./account/AccountProvider";
import TrackMap from "./games/TrackMap";
import { BrowserRaceRepository, formatRaceTime } from "../lib/race-records";
const Kart = dynamic(() => import("./games/KartCircuit"), { ssr: false });
const initialHud: RaceHud = {
  speed: 0,
  lap: 1,
  elapsedMs: 0,
  lapMs: 0,
  bestLapMs: 0,
  lastLapMs: 0,
  boost: 100,
  progress: 0,
  x: 70,
  z: 0,
  countdown: 3,
  offRoad: false,
  finished: false,
  checkpoint: 0,
};
export default function RacingPlayer({
  onClose,
  onScore,
}: {
  onClose: () => void;
  onScore: (score: number) => void;
}) {
  const cloud = useAccount();
  const [selected, setSelected] = useState<TrackId>("sunset-bay"),
    [racing, setRacing] = useState(false),
    [quality, setQuality] = useState<"balanced" | "high">("balanced"),
    [localRecords, setRecords] = useState<RaceRecords>({}),
    [race, setRace] = useState(initialHud),
    [hud, setHud] = useState({
      score: 0,
      detail: "Loading course…",
      ended: false,
    }),
    [result, setResult] = useState<RaceResult | null>(null),
    [paused, setPaused] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [help, setHelp] = useState(false),
    [isBest, setIsBest] = useState(false);
  const control = useRef<GameControl | null>(null),
    dialog = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  const records = cloud.user ? cloud.raceRecords : localRecords;
  const track = getTrack(selected),
    record = records[selected],
    samples = sampleTrack(track),
    elevations = samples.map((p) => p.y);
  useEffect(() => {
    try {
      setRecords(new BrowserRaceRepository(localStorage).load());
    } catch {}
    const before = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),select",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const hidden = () => {
      if (document.hidden && control.current) {
        control.current.pause(true);
        setPaused(true);
      }
    };
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", hidden);
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, []);
  function start() {
    setError("");
    setPaused(false);
    setResult(null);
    setRace(initialHud);
    setHud({ score: 0, detail: "Loading course…", ended: false });
    setRacing(true);
    dialog.current?.focus();
  }
  function restart() {
    setPaused(false);
    setResult(null);
    control.current?.restart();
    control.current?.pause(false);
  }
  function togglePause() {
    control.current?.pause(!paused);
    setPaused(!paused);
  }
  function finish(value: RaceResult) {
    setResult(value);
    setIsBest(
      !records[value.trackId] ||
        value.durationMs < records[value.trackId]!.bestTimeMs,
    );
    if (cloud.user) {
      cloud.submitRace(value);
      return;
    }
    const next = saveRaceResult(records, value);
    setRecords(next);
    try {
      new BrowserRaceRepository(localStorage).save(records, value);
    } catch {
      setNotice(
        "Storage is unavailable. These track records will last for this visit only.",
      );
    }
  }
  return (
    <div className="modal racing-modal">
      <div
        className="game-dialog racing-dialog"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Sunset Circuit racing"
        tabIndex={-1}
      >
        <div className="race-heading">
          <div>
            <span className="eyebrow">
              ONLINEARCADE ORIGINAL · 3D TIME TRIAL
            </span>
            <h2>
              Sunset Circuit<span className="race-edition">WORLD TOUR</span>
            </h2>
          </div>
          <div className="race-heading-actions">
            {racing && (
              <button
                onClick={() => {
                  setRacing(false);
                  setPaused(false);
                  setError("");
                }}
              >
                ← Tracks
              </button>
            )}
            <button onClick={onClose} aria-label="Close racing game">
              ✕
            </button>
          </div>
        </div>
        {!racing ? (
          <div className="race-garage">
            <div className="garage-intro">
              <div>
                <span className="eyebrow">
                  FOUR DESTINATIONS. ONE FASTER LAP.
                </span>
                <h3>Find your racing line.</h3>
                <p>
                  Pick a course. Learn its corners. Make every second count.
                </p>
              </div>
              <span className="garage-stamp">
                4 TRACKS
                <br />
                <b>3 LAPS</b>
              </span>
            </div>
            <div className="track-grid">
              {TRACKS.map((t, i) => (
                <button
                  key={t.id}
                  className={`track-card biome-${t.biome} ${selected === t.id ? "selected" : ""}`}
                  aria-pressed={selected === t.id}
                  onClick={() => setSelected(t.id)}
                >
                  <div className="track-card-visual">
                    <div className="track-sky-orb" />
                    <span className="track-number">0{i + 1}</span>
                    <span className="track-difficulty">{t.difficulty}</span>
                    <TrackMap track={t} />
                    <span className="track-biome">
                      {
                        {
                          coast: "COASTAL GRAND PRIX",
                          alpine: "MOUNTAIN SWITCHBACKS",
                          canyon: "DESERT ENDURANCE",
                          city: "NEON NIGHT RUN",
                        }[t.biome]
                      }
                    </span>
                  </div>
                  <div className="track-card-copy">
                    <h4>
                      {t.name}
                      <span>{selected === t.id ? "✓" : "↗"}</span>
                    </h4>
                    <p>{t.subtitle}</p>
                    <div className="track-record-line">
                      <span>
                        {Math.round(trackLength(sampleTrack(t)))} m / lap
                      </span>
                      <strong>
                        {records[t.id]
                          ? formatRaceTime(records[t.id]!.bestTimeMs)
                          : "Set the first time"}
                      </strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="race-launch">
              <div>
                <span className="eyebrow">YOUR NEXT DESTINATION</span>
                <h3>{track.name}</h3>
                <p>
                  {Math.round(trackLength(samples))} m / lap <i>·</i>{" "}
                  {Math.round(
                    Math.max(...elevations) - Math.min(...elevations),
                  )}{" "}
                  m elevation change <i>·</i> 3 laps
                </p>
                <small>
                  Best race {formatRaceTime(record?.bestTimeMs || 0)} <i>·</i>{" "}
                  Best lap {formatRaceTime(record?.bestLapMs || 0)}
                </small>
              </div>
              <div className="race-launch-actions">
                <label>
                  Graphics
                  <select
                    value={quality}
                    onChange={(e) =>
                      setQuality(e.target.value as "balanced" | "high")
                    }
                  >
                    <option value="balanced">Balanced</option>
                    <option value="high">High detail</option>
                  </select>
                </label>
                <button className="primary" onClick={start}>
                  Start your engines <span>↗</span>
                </button>
              </div>
            </div>
            <p className="race-local-note">
              {cloud.user
                ? "New track times sync to your account. Community records are unverified."
                : "Guest track times stay on this browser. Sign in from My profile to save new races across devices."}
            </p>
          </div>
        ) : (
          <>
            <div className="engine-stage racing-stage">
              <Kart
                gameId="sunset-circuit"
                trackId={selected}
                quality={quality}
                onScore={onScore}
                onHud={setHud}
                onError={setError}
                control={control}
                onRaceFinish={finish}
                onRaceHud={setRace}
              />
              <div className="race-top-hud">
                <div className="race-lap-badge">
                  <small>{track.name.toUpperCase()}</small>
                  <strong>
                    LAP {race.lap}
                    <span> / 3</span>
                  </strong>
                  <span>{race.checkpoint + 1} / 24 gates</span>
                </div>
                <div className="race-timing">
                  <span>
                    RACE <b>{formatRaceTime(Math.max(1, race.elapsedMs))}</b>
                  </span>
                  <span>
                    THIS LAP <b>{formatRaceTime(race.lapMs)}</b>
                  </span>
                  <span>
                    BEST LAP{" "}
                    <b>
                      {formatRaceTime(race.bestLapMs || record?.bestLapMs || 0)}
                    </b>
                  </span>
                </div>
              </div>
              <div className="race-minimap">
                <TrackMap
                  track={track}
                  position={{ x: race.x, z: race.z }}
                  small
                />
              </div>
              <div className="race-bottom-hud">
                <div className="race-speed">
                  <strong>{race.speed.toString().padStart(3, "0")}</strong>
                  <span>KM/H</span>
                </div>
                <div className="race-boost">
                  <span>
                    BOOST <b>SHIFT</b>
                  </span>
                  <progress
                    max="100"
                    value={race.boost}
                    aria-label="Boost energy"
                  />
                </div>
                {race.offRoad && (
                  <span className="offroad-label">SHOULDER — SLOW DOWN</span>
                )}
              </div>
              {race.countdown > 0 && !paused && !error && (
                <div className="race-countdown">
                  <span>
                    {hud.detail === "Loading course…"
                      ? "BUILDING YOUR WORLD"
                      : "GET READY"}
                  </span>
                  <strong>
                    {hud.detail === "Loading course…" ? "…" : race.countdown}
                  </strong>
                </div>
              )}
              {(paused || hud.ended || error) && (
                <div className="engine-overlay race-end">
                  <span className="eyebrow">
                    {error
                      ? "ENGINE NOTICE"
                      : hud.ended
                        ? isBest
                          ? "NEW PERSONAL BEST"
                          : "CHEQUERED FLAG"
                        : "PIT STOP"}
                  </span>
                  <h2>
                    {error
                      ? "Track unavailable"
                      : hud.ended
                        ? track.name
                        : "Race paused"}
                  </h2>
                  {hud.ended && result ? (
                    <>
                      <strong>{formatRaceTime(result.durationMs)}</strong>
                      <div className="finish-stats">
                        <span>
                          BEST LAP <b>{formatRaceTime(result.bestLapMs)}</b>
                        </span>
                        <span>
                          POINTS <b>{result.score.toLocaleString()}</b>
                        </span>
                      </div>
                    </>
                  ) : (
                    <p>{error || "Your race clock is paused."}</p>
                  )}
                  <div className="race-end-actions">
                    {!error && (
                      <button
                        className="primary"
                        onClick={hud.ended ? restart : togglePause}
                      >
                        {hud.ended ? "Race again ↻" : "Resume ▷"}
                      </button>
                    )}
                    <button
                      className="secondary"
                      onClick={() => {
                        setRacing(false);
                        setPaused(false);
                        setError("");
                      }}
                    >
                      Choose another track
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="race-toolbar">
              <span className="race-condition">{hud.detail}</span>
              <div>
                <button
                  disabled={
                    hud.ended || !!error || hud.detail === "Loading course…"
                  }
                  onClick={togglePause}
                >
                  {paused ? "▷ Resume" : "Ⅱ Pause"}
                </button>
                <button disabled={!!error} onClick={restart}>
                  ↻ Restart
                </button>
                <button onClick={() => setHelp(!help)} aria-expanded={help}>
                  ? Controls
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (document.fullscreenElement)
                        await document.exitFullscreen();
                      else await dialog.current?.requestFullscreen();
                    } catch {
                      setNotice("Fullscreen is unavailable in this browser.");
                    }
                  }}
                >
                  ⛶
                </button>
              </div>
            </div>
            {help && (
              <div className="game-instructions">
                <b>
                  W / ↑ gas · S / ↓ brake · A / ← left · D / → right · Shift
                  boost · Space recover (+2 seconds)
                </b>
                <p>
                  Follow the glowing gate arches in order for three laps. Brake
                  before tight bends. Boost recharges when released. The striped
                  acceleration pads also add speed. Recovery returns you to your
                  latest checkpoint.
                </p>
              </div>
            )}
            <div className="touch-controls suite-controls race-touch">
              {[
                ["ArrowLeft", "← LEFT"],
                ["ArrowRight", "RIGHT →"],
                ["ArrowUp", "GAS ↑"],
                ["ArrowDown", "BRAKE ↓"],
                ["ShiftLeft", "BOOST ⚡"],
                ["Space", "RECOVER"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    control.current?.key(key, true);
                  }}
                  onPointerUp={() => control.current?.key(key, false)}
                  onPointerCancel={() => control.current?.key(key, false)}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
        {notice && (
          <p className="error" role="status">
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
