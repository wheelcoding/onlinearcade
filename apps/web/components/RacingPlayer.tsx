"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  TRACKS,
  MEDAL_TIMES,
  getTrack,
  sampleTrack,
  trackLength,
  saveRaceResult,
  type TrackId,
  type TourResult,
  type RaceMode,
  type RaceDifficulty,
  type RaceRecords,
} from "@onlinearcade/core";
import type { GameControl } from "./games/PhaserArcade";
import type { RaceHud } from "./games/KartCircuit";
import { useAccount } from "./account/AccountProvider";
import TrackMap from "./games/TrackMap";
import { BrowserRaceRepository, formatRaceTime } from "../lib/race-records";
import {
  PAINTS,
  emptyCareer,
  careerStars,
  recordTour,
  TourRepository,
  type Replay,
} from "../lib/racing-career";
import { createRaceAudio, type RaceAudio } from "../lib/race-audio";
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
  position: 1,
  driftCharge: 0,
  drifting: false,
  turbo: false,
  gear: "N",
  wrongWay: false,
  brakeHint: false,
  ghostDelta: null,
  renderer: "3d",
  cue: "",
  standings: [],
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
    [result, setResult] = useState<TourResult | null>(null),
    [paused, setPaused] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [help, setHelp] = useState(false),
    [isBest, setIsBest] = useState(false);
  const [mode, setMode] = useState<RaceMode>("grand-prix");
  const [difficulty, setDifficulty] = useState<RaceDifficulty>("rookie");
  const [career, setCareer] = useState(emptyCareer);
  const [line, setLine] = useState(true);
  const [muted, setMuted] = useState(false);
  const audio = useRef<RaceAudio | null>(null);
  useEffect(() => {
    try {
      setCareer(
        new TourRepository(localStorage, cloud.user?.id || "guest").load(),
      );
    } catch {
      setCareer(emptyCareer());
      setNotice(
        "Browser storage is unavailable; career progress lasts for this visit only.",
      );
    }
  }, [cloud.user?.id]);
  useEffect(
    () => () => {
      audio.current?.dispose();
    },
    [],
  );
  function storeCareer(next: typeof career) {
    setCareer(next);
    try {
      new TourRepository(localStorage, cloud.user?.id || "guest").save(next);
    } catch {
      setNotice(
        "Browser storage is unavailable; career progress lasts for this visit only.",
      );
    }
  }
  const stars = careerStars(career);
  const paint = PAINTS.find((p) => p.id === career.paint) || PAINTS[0];
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
          "button:not([disabled]),select,input",
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
    audio.current ??= createRaceAudio();
    audio.current?.unlock();
    audio.current?.setMuted(muted);
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
    setHud({ score: 0, detail: "Getting ready…", ended: false });
    control.current?.restart();
    control.current?.pause(false);
  }
  function togglePause() {
    control.current?.pause(!paused);
    setPaused(!paused);
  }
  function finish(value: TourResult, replay: Replay | null) {
    setResult(value);
    setIsBest(
      !career.records[value.result.trackId]?.[mode] ||
        value.result.durationMs <
          career.records[value.result.trackId]![mode]!.bestTimeMs,
    );
    storeCareer(recordTour(career, value, replay));
    if (value.mode !== "time-trial") return;
    if (cloud.user) {
      cloud.submitRace(value.result);
      return;
    }
    const next = saveRaceResult(records, value.result);
    setRecords(next);
    try {
      new BrowserRaceRepository(localStorage).save(records, value.result);
    } catch {
      setNotice(
        "Storage is unavailable. Track records last for this visit only.",
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
            <span className="eyebrow">ONLINEARCADE ORIGINAL · KART RACING</span>
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
                  FOUR DESTINATIONS. FIVE DRIVERS. ONE PODIUM.
                </span>
                <h3>Earn your place on the grid.</h3>
                <p>
                  Brake into the bend. Hold a drift. Release a turbo. Make the
                  overtake.
                </p>
              </div>
              <span className="garage-stamp">
                4 TRACKS
                <br />
                <b>3 LAPS</b>
              </span>
            </div>
            <div className="tour-setup">
              <div className="mode-picker" aria-label="Race mode">
                {(["grand-prix", "time-trial"] as const).map((m) => (
                  <button
                    key={m}
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    <b>{m === "grand-prix" ? "Grand Prix" : "Time Trial"}</b>
                    <small>
                      {m === "grand-prix"
                        ? "Race four AI rivals · earn podium stars"
                        : "Beat the clock · chase your best ghost"}
                    </small>
                  </button>
                ))}
              </div>
              {mode === "grand-prix" && (
                <label>
                  AI pace{" "}
                  <select
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as RaceDifficulty)
                    }
                  >
                    <option value="rookie">Rookie · learn the lines</option>
                    <option value="club">Club · push your pace</option>
                    <option value="expert">
                      Expert · no room for mistakes
                    </option>
                  </select>
                </label>
              )}
              <div className="paint-picker">
                <span>GARAGE · {stars}/12 ★</span>
                {PAINTS.map((p) => (
                  <button
                    key={p.id}
                    disabled={stars < p.stars}
                    aria-pressed={career.paint === p.id}
                    title={`${p.name}${stars < p.stars ? ` · unlock at ${p.stars} stars` : ""}`}
                    onClick={() => storeCareer({ ...career, paint: p.id })}
                  >
                    <i style={{ background: p.color }} />
                    {p.name}
                    <small>
                      {stars < p.stars
                        ? `${p.stars} ★`
                        : career.paint === p.id
                          ? "Selected"
                          : "Unlocked"}
                    </small>
                  </button>
                ))}
              </div>
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
                        {career.records[t.id]?.[mode]
                          ? `${"★".repeat(career.records[t.id]![mode]!.medal)} ${formatRaceTime(career.records[t.id]![mode]!.bestTimeMs)}`
                          : "Set your first result"}
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
            {mode === "time-trial" && (
              <div className="medal-targets">
                <span>THREE-LAP MEDAL TARGETS</span>
                {[
                  ["Gold", 1],
                  ["Silver", 1.15],
                  ["Bronze", 1.35],
                ].map(([label, factor]) => (
                  <b key={label}>
                    {label}{" "}
                    <em>
                      {formatRaceTime(MEDAL_TIMES[selected] * Number(factor))}
                    </em>
                  </b>
                ))}
              </div>
            )}
            <div className="driving-primer">
              <span>
                <b>01 · BRAKE</b>Slow before a tight corner.
              </span>
              <span>
                <b>02 · DRIFT</b>Hold Space / Z while steering.
              </span>
              <span>
                <b>03 · RELEASE</b>Orange charge = turbo. Purple = super.
              </span>
            </div>
            <label className="race-assist">
              <input
                type="checkbox"
                checked={line}
                onChange={(e) => setLine(e.target.checked)}
              />{" "}
              Racing line & braking hints
            </label>
            <p className="race-local-note">
              Grand Prix career, paints, and ghosts are saved on this browser.
              Time Trial times{" "}
              {cloud.user
                ? "sync to your account as unverified community records."
                : "stay local; sign in from My profile for cross-device records."}
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
                mode={mode}
                difficulty={difficulty}
                paint={paint.color}
                ghostReplay={career.ghosts[selected] || null}
                racingLine={line}
                audio={audio.current}
                onPauseRequest={(toggle = false) => {
                  setPaused((prev) => {
                    const next = toggle ? !prev : true;
                    control.current?.pause(next);
                    return next;
                  });
                }}
                onTourFinish={finish}
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
              {mode === "grand-prix" && (
                <div className="race-standings">
                  <b>
                    P{race.position}
                    <small> / 5</small>
                  </b>
                  {race.standings.map((c) => (
                    <div key={c.id} className={c.id === 0 ? "you" : ""}>
                      <span style={{ color: c.color }}>
                        {c.position} {c.name}
                        {c.id ? " · AI" : ""}
                      </span>
                      <span>{c.id ? `${Math.abs(c.gap)}m` : "YOU"}</span>
                    </div>
                  ))}
                </div>
              )}
              {race.ghostDelta !== null && (
                <div
                  className={`ghost-delta ${race.ghostDelta < 0 ? "ahead" : ""}`}
                >
                  {race.ghostDelta > 0 ? "+" : ""}
                  {race.ghostDelta.toFixed(2)}s <small>VS PERSONAL GHOST</small>
                </div>
              )}
              <div className="race-feedback" role="status">
                {race.wrongWay
                  ? "WRONG WAY · TURN AROUND"
                  : race.cue ||
                    (race.brakeHint ? "BRAKE BEFORE THE CORNER" : "")}
              </div>
              <div className="race-minimap">
                <TrackMap
                  track={track}
                  position={{ x: race.x, z: race.z }}
                  rivals={race.standings.filter((c) => c.id !== 0)}
                  small
                />
              </div>
              <div className="race-bottom-hud">
                <div className="race-speed">
                  <strong>{race.speed.toString().padStart(3, "0")}</strong>
                  <span>KM/H · GEAR {race.gear}</span>
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
                <div className={`race-drift ${race.drifting ? "active" : ""}`}>
                  <span>
                    {race.turbo
                      ? "TURBO!"
                      : race.driftCharge > 2.3
                        ? "SUPER TURBO READY · RELEASE"
                        : race.driftCharge > 1.1
                          ? "TURBO READY · RELEASE"
                          : "DRIFT · SPACE / Z"}
                  </span>
                  <progress
                    value={race.driftCharge}
                    max={2.3}
                    aria-label="Drift charge"
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
                      <strong>
                        {mode === "grand-prix"
                          ? `P${result.place} · ${formatRaceTime(result.result.durationMs)}`
                          : formatRaceTime(result.result.durationMs)}
                      </strong>
                      <div className="finish-stats">
                        <span>
                          BEST LAP{" "}
                          <b>{formatRaceTime(result.result.bestLapMs)}</b>
                        </span>
                        <span>
                          POINTS <b>{result.result.score.toLocaleString()}</b>
                        </span>
                      </div>
                      <div className="tour-result">
                        <p className="race-coach">
                          {result.collisions > 3
                            ? "Next run: brake earlier and leave room on corner exits."
                            : result.drifts === 0
                              ? "Next run: try holding a drift through a long corner, then release for turbo."
                              : result.recoveries > 0
                                ? "Next run: stay on track and avoid the two-second recovery penalty."
                                : "Clean work. Try the next AI pace or chase a faster ghost."}
                        </p>
                        <div className="podium-stars">
                          {"★".repeat(result.medal)}
                          {"☆".repeat(3 - result.medal)}
                        </div>
                        <p>
                          {mode === "grand-prix"
                            ? `${stars}/12 career stars · earn podiums to unlock paints`
                            : "Race your personal ghost next time. Clean runs save a replay."}
                        </p>
                        <div>
                          {result.lapTimes.map((t, i) => (
                            <span key={i}>
                              LAP {i + 1} <b>{formatRaceTime(t)}</b>
                            </span>
                          ))}
                        </div>
                        <p>
                          {result.drifts} turbos · {result.collisions} contacts
                          · {result.recoveries} recoveries · {result.maxSpeed}{" "}
                          km/h top speed
                        </p>
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
                <button
                  onClick={() => {
                    setMuted(!muted);
                    audio.current?.setMuted(!muted);
                  }}
                  aria-pressed={muted}
                >
                  {muted ? "Sound off" : "Sound on"}
                </button>
                <button
                  disabled={paused || hud.ended}
                  onClick={() => {
                    control.current?.key("KeyR", true);
                    control.current?.key("KeyR", false);
                  }}
                >
                  Recover +2s
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
                  boost · Space / Z drift · R recover (+2 seconds) · P pause
                </b>
                <p>
                  Complete three laps. Brake before tight bends. Hold drift
                  while steering, then release after the charge turns orange for
                  a mini-turbo or purple for a super turbo. Boost recharges when
                  released. The striped acceleration pads also add speed.
                  Recovery returns you to your latest checkpoint.
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
                ["Space", "DRIFT ◇"],
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
