"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Pause, Play } from "lucide-react";
import {
  PlayOptions,
  PlayScreen,
  PlayTouchControls,
  driveKeys,
  raceKeys,
} from "./PlayScreen";
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
    [racing, setRacing] = useState(true),
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
    [isBest, setIsBest] = useState(false);
  const [mode, setMode] = useState<RaceMode>("grand-prix");
  const [difficulty, setDifficulty] = useState<RaceDifficulty>("rookie");
  const [career, setCareer] = useState(emptyCareer);
  const [line, setLine] = useState(true);
  const [muted, setMuted] = useState(false);
  const [audio, setAudio] = useState<RaceAudio | null>(null);
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
  useEffect(() => {
    const sound = createRaceAudio();
    setAudio(sound);
    return () => sound?.dispose();
  }, []);
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
  const control = useRef<GameControl | null>(null);
  const records = cloud.user ? cloud.raceRecords : localRecords;
  const track = getTrack(selected),
    record = records[selected],
    samples = useMemo(() => sampleTrack(track), [track]),
    elevations = samples.map((p) => p.y);
  useEffect(() => {
    try {
      setRecords(new BrowserRaceRepository(localStorage).load());
    } catch {}
    const hidden = () => {
      if (document.hidden && control.current) {
        control.current.pause(true);
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  function start() {
    audio?.unlock();
    audio?.setMuted(muted);
    setError("");
    setPaused(false);
    setResult(null);
    setRace(initialHud);
    setHud({ score: 0, detail: "Loading course…", ended: false });
    setRacing(true);
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
    <PlayScreen
      name="Sunset Circuit"
      className={racing ? "play-race" : "play-garage"}
      onExit={onClose}
      tools={
        racing && (
          <>
            <button
              className="play-icon"
              aria-label={paused ? "Resume race" : "Pause race"}
              disabled={!control.current || hud.ended || !!error}
              onClick={togglePause}
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <PlayOptions>
              <p>
                <strong>Sunset Circuit · {track.name}</strong>
              </p>
              <p>
                WASD or arrows to drive. Shift boosts. Hold Space to drift and
                release for turbo. P pauses.
              </p>
              <button onClick={() => setRacing(false)}>
                Choose track and mode
              </button>
              <button disabled={!!error} onClick={restart}>
                Restart race
              </button>
              <button
                disabled={paused || hud.ended || !!error}
                onClick={() => {
                  control.current?.key("KeyR", true);
                  control.current?.key("KeyR", false);
                }}
              >
                Recover kart (+2s)
              </button>
              <button aria-pressed={line} onClick={() => setLine(!line)}>
                Racing line {line ? "on" : "off"}
              </button>
              <button
                aria-pressed={muted}
                onClick={() => {
                  audio?.unlock();
                  audio?.setMuted(!muted);
                  setMuted(!muted);
                }}
              >
                {muted ? "Turn sound on" : "Mute sound"}
              </button>
            </PlayOptions>
          </>
        )
      }
    >
      {!racing ? (
        <>
          <h1>Sunset Circuit</h1>
          <div className="race-garage">
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
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  className={`track-card biome-${t.biome} ${selected === t.id ? "selected" : ""}`}
                  aria-pressed={selected === t.id}
                  onClick={() => setSelected(t.id)}
                >
                  <div className="track-card-visual">
                    <div className="track-sky-orb" />
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
                  Start race
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
                <b>Brake</b>Slow before a tight corner.
              </span>
              <span>
                <b>Drift</b>Hold Space / Z while steering.
              </span>
              <span>
                <b>Release</b>Orange charge = turbo. Purple = super.
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
        </>
      ) : (
        <>
          <div tabIndex={-1} className="play-field racing-stage">
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
              audio={audio}
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
                <small>{track.name}</small>
                <strong>
                  LAP {race.lap}
                  <span> / 3</span>
                </strong>
                <progress
                  className="play-meter"
                  aria-label="Lap gate progress"
                  max={24}
                  value={race.checkpoint}
                />
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
                : race.cue || (race.brakeHint ? "BRAKE BEFORE THE CORNER" : "")}
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
                        {result.drifts} turbos · {result.collisions} contacts ·{" "}
                        {result.recoveries} recoveries · {result.maxSpeed} km/h
                        top speed
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
          <PlayTouchControls
            left={driveKeys}
            right={raceKeys}
            disabled={paused || hud.ended || !!error || !control.current}
            onKey={(key, down) => control.current?.key(key, down)}
          />
        </>
      )}
      {notice && (
        <p className="play-message" role="status">
          {notice}
        </p>
      )}
    </PlayScreen>
  );
}
