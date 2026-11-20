"use client";
import { useEffect, useRef, useState } from "react";
import { RaceSimulation, getTrack, type RaceInput } from "@onlinearcade/core";
import type { RacePacket } from "../../server/src/protocol";
import type { OnlineRaceLink } from "../lib/use-party";
import { createRaceView } from "./games/race-renderer";
import type { RaceView } from "./games/race-canvas";

/** Render authoritative snapshots; interpolate poses without inventing opponent movement. */
export default function OnlineKart({
  link,
  onClose,
}: {
  link: OnlineRaceLink;
  onClose: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLElement>(null),
    keys = useRef(new Set<string>()),
    close = useRef(onClose);
  close.current = onClose;
  const [hud, setHud] = useState<RacePacket | null>(null),
    [notice, setNotice] = useState("Connecting to the race…"),
    [error, setError] = useState("");
  const [renderer, setRenderer] = useState("");
  const { session, socket, memberId } = link;
  const myId = session.racers!.findIndex((p) => p.memberId === memberId);
  const exit = () => {
    socket.emit("race:exit", session.id);
    close.current();
  };
  useEffect(() => {
    if (!mount.current || myId < 0 || !session.track || !session.racers) return;
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
      setRenderer(view.mode);
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
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.code === "Escape") {
        socket.emit("race:exit", session.id);
        close.current();
        return;
      }
      if (e.key === "Tab") {
        const nodes = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),select,input",
        );
        if (nodes?.length) {
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
      }
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
    const before = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
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
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, [session, socket, memberId, myId]);
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
  const touch = (key: string, label: string) => (
    <button
      key={key}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        keys.current.add(key);
      }}
      onPointerUp={() => keys.current.delete(key)}
      onPointerCancel={() => keys.current.delete(key)}
      onLostPointerCapture={() => keys.current.delete(key)}
    >
      {label}
    </button>
  );
  return (
    <div className="modal">
      <section
        className="game-dialog online-race"
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Sunset Circuit online race"
      >
        <header>
          <div>
            <small>LIVE MULTIPLAYER · {session.racers?.length} DRIVERS</small>
            <h2>Sunset Circuit</h2>
            <small>
              {session.track ? getTrack(session.track).name : ""} · 3 laps
            </small>
          </div>
          <button className="secondary" onClick={exit}>
            Return to party
          </button>
        </header>
        <p role="status">
          {notice}
          {renderer === "2d" ? " · 2D compatibility renderer" : ""}
        </p>
        {error && <p role="alert">{error}</p>}
        <div
          className="canvas-wrap engine-canvas kart-canvas"
          ref={mount}
          aria-label="Shared online race track"
        />
        <div className="online-race-hud">
          <strong>
            {hud && hud.countdown > 0
              ? `Starting in ${Math.ceil(hud.countdown)}`
              : player?.finishedAt !== null && player
                ? `Finished · ${player.finishedAt!.toFixed(2)}s`
                : `Lap ${Math.min(3, (player?.laps ?? 0) + 1)} / 3`}
          </strong>
          <span>{Math.round(Math.abs(player?.speed ?? 0) * 3.6)} km/h</span>
          <span>Boost {Math.round(player?.energy ?? 100)}%</span>
          <span>
            Position{" "}
            {Math.max(1, standings.findIndex((c) => c.id === myId) + 1)} /{" "}
            {session.racers!.length}
          </span>
          <span>{(hud?.time ?? 0).toFixed(1)}s</span>
        </div>
        <ol className="online-race-standings">
          {standings.map((c) => (
            <li key={c.id}>
              <span style={{ color: c.color }}>
                {c.name}
                {c.id === myId ? " (you)" : ""}
              </span>{" "}
              —{" "}
              {hud?.withdrawn.includes(c.id)
                ? "Left race · DNF"
                : c.finishedAt !== null
                  ? `${c.finishedAt.toFixed(2)}s`
                  : `Lap ${Math.min(3, c.laps + 1)}`}
            </li>
          ))}
        </ol>
        <p className="muted">
          W / ↑ accelerate · S / ↓ brake · A D / ← → steer · Space drift · Shift
          boost · R recover (+2s). The race keeps running when you switch tabs.
          Online results stay in this party.
        </p>
        <div className="online-race-touch">
          {touch("KeyA", "←")}
          {touch("KeyD", "→")}
          {touch("KeyS", "Brake")}
          {touch("KeyW", "Accelerate")}
          {touch("Space", "Drift")}
          {touch("ShiftLeft", "Boost")}
        </div>
        <button
          className="secondary"
          onClick={() => {
            keys.current.add("KeyR");
          }}
        >
          Recover kart (+2s)
        </button>
      </section>
    </div>
  );
}
