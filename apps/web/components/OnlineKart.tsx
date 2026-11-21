"use client";
import { useEffect, useRef, useState } from "react";
import { RaceSimulation, getTrack, type RaceInput } from "@onlinearcade/core";
import type { RacePacket } from "../../server/src/protocol";
import type { OnlineRaceLink } from "../lib/use-party";
import { createRaceView } from "./games/race-renderer";
import type { RaceView } from "./games/race-canvas";
import TrackMap from "./games/TrackMap";
import {
  PlayOptions,
  PlayScreen,
  PlayTouchControls,
  driveKeys,
  isGameInput,
  raceKeys,
} from "./PlayScreen";

/** Render authoritative snapshots; interpolate poses without inventing opponent movement. */
export default function OnlineKart({
  link,
  onClose,
}: {
  link: OnlineRaceLink;
  onClose: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null),
    keys = useRef(new Set<string>());
  const [hud, setHud] = useState<RacePacket | null>(null),
    [notice, setNotice] = useState("Connecting to the race…"),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { session, socket, memberId } = link;
  const myId = session.racers!.findIndex((p) => p.memberId === memberId);
  const exit = () => {
    socket.emit("race:exit", session.id);
    onClose();
  };
  useEffect(() => {
    if (!mount.current || myId < 0 || !session.track || !session.racers) return;
    setError("");
    setNotice("Connecting to the race…");
    const sim = new RaceSimulation(
      session.track,
      "grand-prix",
      "club",
      session.racers[0].color,
      session.racers,
    );
    sim.playerId = myId;
    let view: RaceView;
    try {
      view = createRaceView(mount.current, sim, "balanced");
    } catch {
      setError(
        "The racing renderer could not start. Return to the party and try again.",
      );
      return;
    }
    let latest: RacePacket | null = null,
      previous: RacePacket | null = null,
      received = performance.now(),
      lastPacket = 0,
      raf = 0,
      seq = Date.now(),
      recover = false,
      lastDraw = performance.now();
    const input = (): RaceInput => ({
      throttle: +(keys.current.has("KeyW") || keys.current.has("ArrowUp")),
      brake: +(keys.current.has("KeyS") || keys.current.has("ArrowDown")),
      steer:
        +(keys.current.has("KeyD") || keys.current.has("ArrowRight")) -
        +(keys.current.has("KeyA") || keys.current.has("ArrowLeft")),
      drift: keys.current.has("Space") || keys.current.has("KeyZ"),
      boost: keys.current.has("ShiftLeft") || keys.current.has("ShiftRight"),
    });
    const state = (packet: RacePacket) => {
      if (
        packet.sessionId !== session.id ||
        packet.cars.length !== sim.cars.length ||
        (latest && packet.tick < latest.tick)
      )
        return;
      previous = latest;
      latest = packet;
      received = performance.now();
      lastPacket = received;
      setHud(packet);
      setNotice(
        packet.complete ? "Race complete" : "Live race · server connected",
      );
    };
    const sync = () => {
      keys.current.clear();
      setNotice("Reconnecting to the race…");
      socket.emit("race:sync", session.id);
    };
    const disconnected = () => {
      keys.current.clear();
      setNotice(
        "Connection lost · reconnecting. Your kart will coast to a stop.",
      );
    };
    const removed = () => {
      setError("You are no longer in this party.");
      keys.current.clear();
    };
    const keydown = (e: KeyboardEvent) => {
      if (!isGameInput(e)) return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.code === "KeyR" && !e.repeat) recover = true;
      keys.current.add(e.code);
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => {
      keys.current.clear();
    };
    socket.on("race:state", state);
    socket.on("connect", sync);
    socket.on("disconnect", disconnected);
    socket.on("party:removed", removed);
    socket.on("party", partyChanged);
    function partyChanged(party: unknown) {
      if (!party) removed();
    }
    socket.emit("race:sync", session.id);
    const interval = setInterval(() => {
      if (!socket.connected || latest?.complete) return;
      socket.emit("race:input", {
        sessionId: session.id,
        seq: ++seq,
        input: input(),
        recover: recover || keys.current.has("KeyR"),
      });
      recover = false;
      keys.current.delete("KeyR");
    }, 1000 / 30);
    const animate = (now: number) => {
      if (latest) {
        const alpha = Math.min(
          1,
          (now - received) /
            Math.max(
              33,
              previous ? ((latest.tick - previous.tick) * 1000) / 60 : 67,
            ),
        );
        latest.cars.forEach((car, i) => {
          Object.assign(sim.cars[i], car);
          const from = previous?.cars[i];
          if (from && Math.hypot(car.x - from.x, car.z - from.z) < 15) {
            sim.cars[i].x = from.x + (car.x - from.x) * alpha;
            sim.cars[i].z = from.z + (car.z - from.z) * alpha;
            sim.cars[i].heading =
              from.heading +
              Math.atan2(
                Math.sin(car.heading - from.heading),
                Math.cos(car.heading - from.heading),
              ) *
                alpha;
          }
        });
        sim.countdown = latest.countdown;
        sim.time = latest.time;
        sim.tick = latest.tick;
        sim.finished = latest.complete;
        if (now - lastPacket > 2500 && !latest.complete)
          setNotice(
            "Waiting for the server · controls will stop safely if disconnected.",
          );
      }
      view.draw(sim, Math.min((now - lastDraw) / 1000, 0.1), null, true);
      lastDraw = now;
      raf = requestAnimationFrame(animate);
    };
    const resize = new ResizeObserver(view.resize);
    resize.observe(mount.current);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    raf = requestAnimationFrame(animate);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(raf);
      resize.disconnect();
      view.dispose();
      keys.current.clear();
      socket.off("race:state", state);
      socket.off("connect", sync);
      socket.off("disconnect", disconnected);
      socket.off("party:removed", removed);
      socket.off("party", partyChanged);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  }, [session, socket, memberId, myId, attempt]);
  const player = hud?.cars[myId];
  const standings = [...(hud?.cars ?? [])].sort((a, b) => {
    if (hud?.withdrawn.includes(a.id) !== hud?.withdrawn.includes(b.id))
      return hud?.withdrawn.includes(a.id) ? 1 : -1;
    return a.finishedAt !== null && b.finishedAt !== null
      ? a.finishedAt - b.finishedAt
      : a.finishedAt !== null
        ? -1
        : b.finishedAt !== null
          ? 1
          : b.raceProgress - a.raceProgress;
  });
  const track = session.track ? getTrack(session.track) : null;
  const position = standings.findIndex((car) => car.id === myId) + 1;
  return (
    <PlayScreen
      name="Sunset Circuit online race"
      onExit={exit}
      exitLabel="Return to party"
      className="play-race play-online-race"
      tools={
        <PlayOptions>
          <p>
            <strong>Sunset Circuit · {track?.name}</strong>
          </p>
          <p>
            WASD or arrows to drive. Shift boosts. Space drifts. The race
            continues while you're away.
          </p>
          <button
            disabled={hud?.complete || !!error}
            onClick={() => keys.current.add("KeyR")}
          >
            Recover kart (+2s)
          </button>
          <p role="status">{notice}</p>
          {standings.map((car) => (
            <p key={car.id}>
              <strong>{car.name}</strong> ·{" "}
              {hud?.withdrawn.includes(car.id)
                ? "Left"
                : car.finishedAt === null
                  ? `Lap ${Math.min(3, car.laps + 1)}`
                  : `${car.finishedAt.toFixed(2)}s`}
            </p>
          ))}
        </PlayOptions>
      }
    >
      <div tabIndex={-1} className="play-field">
        <div
          className="canvas-wrap engine-canvas kart-canvas"
          ref={mount}
          aria-label="Shared online race track"
        />
        {track && player && (
          <div className="race-minimap">
            <TrackMap
              track={track}
              position={player}
              rivals={standings.filter((car) => car.id !== myId)}
              small
            />
          </div>
        )}
      </div>
      {player && (
        <div className="play-hud">
          <span>Lap {Math.min(3, player.laps + 1)}/3</span>
          <strong>
            P{position}/{session.racers?.length}
          </strong>
          <span className="hud-extra">{(hud?.time ?? 0).toFixed(1)}s</span>
        </div>
      )}
      {player && (
        <div className="play-corner">
          <strong>{Math.round(Math.abs(player.speed) * 3.6)} km/h</strong>
          <progress
            className="play-meter"
            max={100}
            value={player.energy}
            aria-label="Boost energy"
          />
        </div>
      )}
      {hud &&
        !hud.complete &&
        (hud.countdown > 0 || notice !== "Live race · server connected") && (
          <p className="play-message" role="status">
            {notice !== "Live race · server connected"
              ? notice
              : `Starting in ${Math.ceil(hud.countdown)}`}
          </p>
        )}
      <PlayTouchControls
        left={driveKeys}
        right={raceKeys}
        disabled={!hud || hud.complete || !!error}
        onKey={(key, down) => {
          if (down) keys.current.add(key);
          else keys.current.delete(key);
        }}
      />
      {(!hud || hud.complete || error) && (
        <div className="play-center" role={error ? "alert" : undefined}>
          <h2>
            {error
              ? "Race unavailable"
              : hud?.complete
                ? "Race results"
                : notice}
          </h2>
          {error && <p>{error}</p>}
          {hud?.complete && (
            <ol className="planet-scores">
              {standings.map((car) => (
                <li key={car.id}>
                  <span style={{ color: car.color }}>{car.name}</span> ·{" "}
                  {hud.withdrawn.includes(car.id) || car.finishedAt === null
                    ? "DNF"
                    : `${car.finishedAt.toFixed(2)}s`}
                </li>
              ))}
            </ol>
          )}
          {error && (
            <button
              className="primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Reconnect
            </button>
          )}
          {hud?.complete && (
            <button className="primary" onClick={exit}>
              Return to party
            </button>
          )}
        </div>
      )}
    </PlayScreen>
  );
}
