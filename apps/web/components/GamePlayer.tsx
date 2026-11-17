"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GameId } from "@onlinearcade/core";
import type { GameControl } from "./games/PhaserArcade";
import { gameById } from "../lib/catalog";
const PhaserArcade = dynamic(() => import("./games/PhaserArcade"), {
  ssr: false,
});
const RacingPlayer = dynamic(() => import("./RacingPlayer"), { ssr: false });
export default function GamePlayer(props: {
  gameId: GameId;
  onClose: () => void;
  onScore: (score: number) => void;
}) {
  return props.gameId === "sunset-circuit" ? (
    <RacingPlayer onClose={props.onClose} onScore={props.onScore} />
  ) : (
    <ArcadePlayer {...props} />
  );
}
function ArcadePlayer({
  gameId,
  onClose,
  onScore,
}: {
  gameId: GameId;
  onClose: () => void;
  onScore: (score: number) => void;
}) {
  const game = gameById(gameId),
    control = useRef<GameControl | null>(null),
    dialog = useRef<HTMLDivElement>(null),
    [hud, setHud] = useState({
      score: 0,
      detail: "Loading engine…",
      ended: false,
    }),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false),
    [help, setHelp] = useState(true);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex="0"]',
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
      if (document.hidden) {
        control.current?.pause(true);
        setPaused(true);
      }
    };
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", hidden);
      document.body.style.overflow = old;
      before?.focus();
    };
  }, []);
  const Engine = PhaserArcade;
  function togglePause() {
    control.current?.pause(!paused);
    setPaused(!paused);
  }
  return (
    <div className="modal game-modal">
      <div
        className="game-dialog advanced-dialog"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={game.title}
        tabIndex={-1}
      >
        <div className="game-top">
          <div>
            <span className="eyebrow">{game.type} · LOCAL RUN</span>
            <h2>{game.title}</h2>
          </div>
          <span className="score">
            {gameId === "sunset-circuit" && !hud.ended
              ? "TIME TRIAL"
              : hud.score.toString().padStart(5, "0")}
          </span>
          <button onClick={onClose} aria-label="Close game">
            ✕
          </button>
        </div>
        <div className="engine-stage">
          <Engine
            gameId={gameId}
            onScore={onScore}
            onHud={setHud}
            onError={setError}
            control={control}
          />
          {(paused || hud.ended || error) && (
            <div className="engine-overlay">
              <span className="eyebrow">
                {error
                  ? "ENGINE NOTICE"
                  : hud.ended
                    ? "RUN COMPLETE"
                    : "TAKE A BREATHER"}
              </span>
              <h2>
                {error
                  ? "Couldn’t start"
                  : hud.ended
                    ? "Nicely played."
                    : "Paused"}
              </h2>
              <p>{error || hud.detail}</p>
              {!error &&
                (hud.ended ? (
                  <>
                    <strong>
                      {hud.score.toLocaleString()} <small>POINTS</small>
                    </strong>
                    <button
                      className="primary"
                      onClick={() => {
                        control.current?.restart();
                        setPaused(false);
                        control.current?.pause(false);
                      }}
                    >
                      Play again ↻
                    </button>
                  </>
                ) : (
                  <button className="primary" onClick={togglePause}>
                    Resume game ▷
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="engine-status" aria-live="polite">
          {hud.detail}
        </div>
        <div className="game-toolbar">
          <button
            onClick={togglePause}
            disabled={hud.ended || !!error || hud.detail === "Loading engine…"}
          >
            {paused ? "▷ Resume" : "Ⅱ Pause"}
          </button>
          <button
            onClick={() => {
              control.current?.restart();
              control.current?.pause(false);
              setPaused(false);
            }}
            disabled={!!error || hud.detail === "Loading engine…"}
          >
            ↻ Restart
          </button>
          <button onClick={() => setHelp(!help)} aria-expanded={help}>
            ? How to play
          </button>
          <button
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await dialog.current?.requestFullscreen();
              } catch {
                setHelp(true);
              }
            }}
          >
            ⛶ Fullscreen
          </button>
        </div>
        {help && (
          <div className="game-instructions">
            <b>{game.controls}</b>
            <p>{game.objective}</p>
            {gameId === "sunset-circuit" && (
              <small>Space recovers your kart to the latest checkpoint.</small>
            )}
          </div>
        )}
        <div className="touch-controls suite-controls">
          {[
            ["ArrowLeft", "←"],
            ["ArrowRight", "→"],
            ["ArrowUp", gameId === "sunset-circuit" ? "GAS ↑" : "↑"],
            ["ArrowDown", gameId === "sunset-circuit" ? "BRAKE ↓" : "↓"],
            ["Space", "ACTION"],
          ]
            .filter(([k]) => gameId !== "tile-shift" || k !== "Space")
            .map(([key, label]) => (
              <button
                key={key}
                aria-label={
                  key === "Space" ? "Action" : key.replace("Arrow", "Move ")
                }
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
      </div>
    </div>
  );
}
