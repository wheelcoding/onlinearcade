"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Pause, Play } from "lucide-react";
import type { PuzzleDifficulty, GameId } from "@onlinearcade/core";
import type { ArcadeHud, GameControl } from "./games/PhaserArcade";
import { gameById } from "../lib/catalog";
import {
  PlayOptions,
  PlayScreen,
  PlayTouchControls,
  type TouchKey,
} from "./PlayScreen";

const PhaserArcade = dynamic(() => import("./games/PhaserArcade"), {
  ssr: false,
});
const RacingPlayer = dynamic(() => import("./RacingPlayer"), { ssr: false });
type Props = {
  gameId: GameId;
  onClose: () => void;
  onScore: (score: number) => void;
};

export default function GamePlayer(props: Props) {
  return props.gameId === "sunset-circuit" ? (
    <RacingPlayer onClose={props.onClose} onScore={props.onScore} />
  ) : (
    <ArcadePlayer {...props} />
  );
}

const horizontal: readonly TouchKey[] = [
  ["ArrowLeft", "←", "Move left"],
  ["ArrowRight", "→", "Move right"],
];

function ArcadePlayer({ gameId, onClose, onScore }: Props) {
  const game = gameById(gameId);
  const puzzle = gameId === "tile-shift";
  const control = useRef<GameControl | null>(null);
  const [hud, setHud] = useState<ArcadeHud | null>(null);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>("normal");
  const [engine, setEngine] = useState(0);

  function pause(value: boolean) {
    if (!control.current || hud?.ended) return;
    control.current.pause(value);
    setPaused(value);
  }

  function restart() {
    setPaused(false);
    if (control.current && !error) {
      control.current.restart();
    } else {
      setError("");
      setHud(null);
      setEngine((value) => value + 1);
    }
  }

  function press(key: string) {
    control.current?.key(key, true);
    control.current?.key(key, false);
  }

  useEffect(() => {
    const hidden = () => {
      if (document.hidden && control.current) {
        control.current.pause(true);
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);

  const ready = !!hud && !error;
  const clock = Math.floor(hud?.time ?? 0);
  const status = puzzle
    ? `${hud?.moves ?? 0} moves`
    : gameId === "neon-dash"
      ? `${Math.floor((hud?.distance ?? 0) / 10)} m`
      : gameId === "starfall"
        ? `Wave ${hud?.wave ?? 1}`
        : `Sector ${hud?.sector ?? 1}/3`;
  const actionKeys: readonly TouchKey[] =
    gameId === "neon-dash"
      ? [
          ["ShiftLeft", "Phase dash"],
          ["Space", "Jump"],
        ]
      : gameId === "starfall"
        ? [["Space", "Nova burst"]]
        : [["Space", "Launch ball"]];

  return (
    <PlayScreen
      name={game.title}
      className={`play-fixed-world play-${gameId} ${puzzle ? "play-puzzle" : ""}`}
      onExit={onClose}
      tools={
        <>
          <button
            className="play-icon"
            aria-label={paused ? "Resume game" : "Pause game"}
            title={paused ? "Resume game (P)" : "Pause game (P)"}
            disabled={!ready || hud.ended}
            onClick={() => pause(!paused)}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <PlayOptions>
            <p>
              <strong>{game.title}</strong>
            </p>
            <p>{game.controls}</p>
            <p>{game.objective}</p>
            {puzzle && (
              <label>
                Puzzle difficulty
                <select
                  value={difficulty}
                  onChange={(event) => {
                    setDifficulty(event.target.value as PuzzleDifficulty);
                    setHud(null);
                    setPaused(false);
                    setError("");
                  }}
                >
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            )}
            <button onClick={restart}>
              {puzzle ? "New puzzle" : "Restart run"}
            </button>
            <button
              aria-pressed={muted}
              onClick={() => setMuted((value) => !value)}
            >
              {muted ? "Turn sound on" : "Mute sound"}
            </button>
          </PlayOptions>
        </>
      }
    >
      <div tabIndex={-1} className="play-field">
        <PhaserArcade
          key={engine}
          muted={muted}
          puzzleDifficulty={difficulty}
          onPauseRequest={() => pause(!paused)}
          gameId={gameId}
          onScore={onScore}
          onHud={setHud}
          onError={setError}
          control={control}
        />
      </div>
      {ready && (
        <div className="play-hud arcade-hud" aria-label={hud.detail}>
          <span>{status}</span>
          {puzzle ? (
            <>
              <strong>
                {Math.floor(clock / 60)}:{String(clock % 60).padStart(2, "0")}
              </strong>
              <span className="hud-extra">{hud.inPlace}/15 placed</span>
            </>
          ) : (
            <>
              <strong>{hud.score.toLocaleString()}</strong>
              <span className="play-lives" aria-label={`${hud.lives} left`}>
                {"◆".repeat(Math.max(0, hud.lives))}
                {"◇".repeat(Math.max(0, 3 - hud.lives))}
              </span>
            </>
          )}
        </div>
      )}
      {ready &&
        !paused &&
        !hud.ended &&
        (gameId === "neon-dash" || gameId === "starfall") && (
          <div className="play-corner">
            <span>{gameId === "neon-dash" ? "Phase" : "Nova"}</span>
            <progress
              className="play-meter"
              max={100}
              value={hud.energy}
              aria-label={
                gameId === "neon-dash" ? "Phase charge" : "Nova charge"
              }
            />
            <strong>
              {(
                gameId === "neon-dash"
                  ? hud.energy >= 40 && hud.dashCooldown <= 0
                  : hud.energy >= 100
              )
                ? "Ready"
                : `${Math.floor(hud.energy)}%`}
            </strong>
            {gameId === "neon-dash" && hud.chain > 1 && (
              <span>×{hud.chain}</span>
            )}
          </div>
        )}
      {puzzle ? (
        <div className="play-puzzle-bar">
          <button
            disabled={!ready || hud.ended || paused || !hud.canUndo}
            onClick={() => press("KeyU")}
          >
            Undo <span>−120</span>
          </button>
          <button
            disabled={!ready || hud.ended || paused}
            onClick={() => press("KeyH")}
          >
            Hint <span>−600</span>
          </button>
          <button onClick={restart}>New puzzle</button>
        </div>
      ) : (
        <PlayTouchControls
          left={gameId === "starfall" ? [] : horizontal}
          right={actionKeys}
          disabled={!ready || hud.ended || paused}
          onKey={(key, down) => control.current?.key(key, down)}
        />
      )}
      {(!ready || paused || hud.ended) && (
        <div className="play-center" role={error ? "alert" : undefined}>
          <h2>
            {error
              ? "Game unavailable"
              : !ready
                ? `Loading ${game.title}…`
                : hud.ended
                  ? hud.won
                    ? "Challenge complete"
                    : "Run complete"
                  : "Paused"}
          </h2>
          {(error || (hud?.ended && hud.detail)) && (
            <p>{error || hud?.detail}</p>
          )}
          {hud?.ended && (
            <strong className="play-result">
              {hud.score.toLocaleString()} pts
            </strong>
          )}
          {(ready || error) && (
            <button
              className="primary"
              onClick={paused && !hud?.ended ? () => pause(false) : restart}
            >
              {error ? "Try again" : hud?.ended ? "Play again" : "Resume game"}
            </button>
          )}
          {hud?.ended && (
            <button className="secondary" onClick={onClose}>
              Back to arcade
            </button>
          )}
        </div>
      )}
    </PlayScreen>
  );
}
