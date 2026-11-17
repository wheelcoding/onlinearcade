"use client";
import { useEffect, useRef } from "react";
import * as T from "three";
import {
  getTrack,
  sampleTrack,
  trackPose,
  projectToTrack,
  advanceCheckpoint,
  steerHeading,
  CHECKPOINTS,
  type TrackId,
  type RaceResult,
} from "@onlinearcade/core";
import type { EngineProps } from "./PhaserArcade";
import { createRacingWorld } from "./racing-world";
export type RaceHud = {
  speed: number;
  lap: number;
  elapsedMs: number;
  lapMs: number;
  bestLapMs: number;
  lastLapMs: number;
  boost: number;
  progress: number;
  x: number;
  z: number;
  countdown: number;
  offRoad: boolean;
  finished: boolean;
  checkpoint: number;
};
type Props = EngineProps & {
  trackId?: TrackId;
  onRaceFinish?: (result: RaceResult) => void;
  onRaceHud?: (hud: RaceHud) => void;
  quality?: "balanced" | "high";
};
export default function KartCircuit({
  trackId = "sunset-bay",
  onScore,
  onHud,
  onError,
  control,
  onRaceFinish,
  onRaceHud,
  quality = "balanced",
}: Props) {
  const mount = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onScore, onHud, onError, onRaceFinish, onRaceHud });
  callbacks.current = { onScore, onHud, onError, onRaceFinish, onRaceHud };
  useEffect(() => {
    if (!mount.current) return;
    const target = mount.current;
    let disposed = false,
      frame = 0;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      callbacks.current.onError(
        "This course needs WebGL. Try another browser or one of the 2D games.",
      );
      return;
    }
    renderer.setPixelRatio(
      Math.min(devicePixelRatio, quality === "high" ? 1.8 : 1.25),
    );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    target.appendChild(renderer.domElement);
    const track = getTrack(trackId),
      samples = sampleTrack(track);
    let world: ReturnType<typeof createRacingWorld>;
    try {
      world = createRacingWorld(track, samples);
    } catch {
      renderer.dispose();
      renderer.domElement.remove();
      callbacks.current.onError(
        "Track scenery could not load. Close and try again.",
      );
      return;
    }
    world.sun.shadow.mapSize.set(
      quality === "high" ? 2048 : 1024,
      quality === "high" ? 2048 : 1024,
    );
    const { scene, palette } = world,
      camera = new T.PerspectiveCamera(62, 16 / 9, 0.1, 650),
      desired = new T.Vector3(),
      look = new T.Vector3();
    const kart = new T.Group();
    scene.add(kart);
    const materials = {
      body: new T.MeshStandardMaterial({
        color: track.biome === "city" ? "#8bd8ce" : "#f4a05f",
        metalness: 0.3,
        roughness: 0.35,
      }),
      rubber: new T.MeshStandardMaterial({ color: "#1b2632", roughness: 0.9 }),
      trim: new T.MeshStandardMaterial({
        color: "#e6dfc8",
        metalness: 0.35,
        roughness: 0.3,
      }),
      glass: new T.MeshStandardMaterial({
        color: "#2a4b5a",
        metalness: 0.7,
        roughness: 0.2,
      }),
      red: new T.MeshStandardMaterial({
        color: "#ef7866",
        emissive: "#fd5344",
        emissiveIntensity: 2,
      }),
    };
    function part(
      geometry: T.BufferGeometry,
      mat: T.Material,
      x: number,
      y: number,
      z: number,
    ) {
      const mesh = new T.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      kart.add(mesh);
      return mesh;
    }
    part(new T.BoxGeometry(1.9, 0.45, 3.4), materials.body, 0, 0.7, 0);
    part(new T.BoxGeometry(1.35, 0.6, 1.3), materials.glass, 0, 1.25, -0.15);
    part(new T.BoxGeometry(1.2, 0.07, 0.85), materials.trim, 0, 0.98, 1.05);
    part(new T.BoxGeometry(2.35, 0.15, 0.55), materials.trim, 0, 1.25, -1.6);
    for (const x of [-0.75, 0.75])
      part(new T.BoxGeometry(0.1, 0.4, 0.2), materials.body, x, 1.05, -1.6);
    part(new T.BoxGeometry(2.1, 0.15, 0.3), materials.rubber, 0, 0.45, 1.8);
    const wheels: { pivot: T.Group; tire: T.Mesh; front: boolean }[] = [];
    for (const x of [-1.03, 1.03])
      for (const z of [-1.05, 1.05]) {
        const pivot = new T.Group();
        pivot.position.set(x, 0.45, z);
        kart.add(pivot);
        const tire = new T.Mesh(
          new T.CylinderGeometry(0.44, 0.44, 0.4, 16),
          materials.rubber,
        );
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        pivot.add(tire);
        const hub = new T.Mesh(
          new T.CylinderGeometry(0.2, 0.2, 0.42, 8),
          materials.trim,
        );
        hub.rotation.z = Math.PI / 2;
        pivot.add(hub);
        wheels.push({ pivot, tire, front: z > 0 });
      }
    const tail = part(
      new T.BoxGeometry(1.35, 0.15, 0.1),
      materials.red,
      0,
      0.77,
      -1.73,
    );
    for (const x of [-0.65, 0.65])
      part(
        new T.BoxGeometry(0.38, 0.14, 0.08),
        new T.MeshStandardMaterial({
          color: "#fff5d4",
          emissive: "#fff0bd",
          emissiveIntensity: 2,
        }),
        x,
        0.82,
        1.74,
      );
    if (track.biome === "city")
      for (const x of [-0.65, 0.65]) {
        const light = new T.SpotLight("#d4f9ed", 45, 32, Math.PI / 6, 0.6, 1.5);
        light.position.set(x, 1, 1.7);
        const aim = new T.Object3D();
        aim.position.set(x, 0.1, 15);
        kart.add(aim);
        light.target = aim;
        kart.add(light);
      }
    const dustGeometry = new T.IcosahedronGeometry(1, 0),
      dustMat = new T.MeshBasicMaterial({
        color: track.biome === "canyon" ? "#deb58d" : palette.accent,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
      dust = new T.InstancedMesh(dustGeometry, dustMat, 45),
      dummy = new T.Object3D();
    dust.instanceMatrix.setUsage(T.DynamicDrawUsage);
    dust.frustumCulled = false;
    scene.add(dust);
    const particles = Array.from({ length: 45 }, () => ({
      x: 0,
      y: -20,
      z: 0,
      life: 0,
    }));
    let particleIndex = 0;
    let keys = new Set<string>(),
      speed = 0,
      heading = 0,
      x = 0,
      z = 0,
      elapsed = 0,
      lapStart = 0,
      bestLap = 0,
      lastLap = 0,
      laps = 0,
      lastGate = 0,
      boost = 100,
      countdown = 3,
      paused = false,
      ended = false,
      last = performance.now(),
      hudAt = 0,
      impact = 0,
      dustAt = 0;
    const emit = (now: number, force = false) => {
      if (!force && now - hudAt < 100) return;
      hudAt = now;
      const road = projectToTrack(samples, x, z);
      callbacks.current.onRaceHud?.({
        speed: Math.round(Math.abs(speed) * 4),
        lap: Math.min(3, laps + 1),
        elapsedMs: Math.round(elapsed * 1000),
        lapMs: Math.round((elapsed - lapStart) * 1000),
        bestLapMs: Math.round(bestLap * 1000),
        lastLapMs: Math.round(lastLap * 1000),
        boost: Math.round(boost),
        progress: road.progress,
        x,
        z,
        countdown: Math.max(0, Math.ceil(countdown)),
        offRoad: road.distance > track.width / 2,
        finished: ended,
        checkpoint: lastGate,
      });
      if (!ended)
        callbacks.current.onHud({
          score: 0,
          detail: `${track.name} · Lap ${Math.min(3, laps + 1)} / 3 · ${Math.round(Math.abs(speed) * 4)} km/h${road.distance > track.width / 2 ? " · SHOULDER" : ""}`,
          ended: false,
        });
    };
    const reset = () => {
      const p = trackPose(samples, 0);
      keys.clear();
      speed = 0;
      heading = Math.atan2(p.tx, p.tz);
      x = p.x;
      z = p.z;
      elapsed = 0;
      lapStart = 0;
      bestLap = 0;
      lastLap = 0;
      laps = 0;
      lastGate = 0;
      boost = 100;
      countdown = 3;
      ended = false;
      impact = 0;
      for (const particle of particles) particle.life = 0;
      camera.position.set(x - p.tx * 12, p.y + 7.5, z - p.tz * 12);
      emit(performance.now(), true);
    };
    const key = (code: string, down: boolean) => {
      if (down && (paused || ended)) return;
      if (down) keys.add(code);
      else keys.delete(code);
      if (code === "Space" && down && countdown <= 0) {
        const p = trackPose(samples, lastGate / CHECKPOINTS + 0.002);
        x = p.x;
        z = p.z;
        heading = Math.atan2(p.tx, p.tz);
        speed = 0;
        elapsed += 2;
        impact = 0.3;
      }
    };
    const keyDown = (event: KeyboardEvent) => {
        if (
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
            event.code,
          )
        )
          event.preventDefault();
        key(event.code, true);
      },
      keyUp = (event: KeyboardEvent) => key(event.code, false),
      blur = () => keys.clear();
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    control.current = {
      key,
      restart: reset,
      pause: (p) => {
        paused = p;
        keys.clear();
      },
    };
    const resize = () => {
      if (!target.clientWidth || !target.clientHeight) return;
      renderer.setSize(target.clientWidth, target.clientHeight, false);
      camera.aspect = target.clientWidth / target.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    reset();
    const animate = (now: number) => {
      if (disposed) return;
      const rawDt = Math.min((now - last) / 1000, 0.25),
        dt = Math.min(rawDt, 0.04);
      last = now;
      const roadBefore = projectToTrack(samples, x, z);
      let steering = 0,
        boosting = false;
      if (!paused && !ended) {
        if (countdown > 0) countdown = Math.max(0, countdown - rawDt);
        else {
          elapsed += rawDt;
          steering =
            Number(keys.has("KeyD") || keys.has("ArrowRight")) -
            Number(keys.has("KeyA") || keys.has("ArrowLeft"));
          const throttle = keys.has("KeyW") || keys.has("ArrowUp"),
            brake = keys.has("KeyS") || keys.has("ArrowDown"),
            off = roadBefore.distance > track.width / 2;
          boosting =
            (keys.has("ShiftLeft") || keys.has("ShiftRight")) &&
            boost > 0 &&
            throttle &&
            !off;
          boost = Math.max(
            0,
            Math.min(100, boost + (boosting ? -32 : 12) * dt),
          );
          const pad =
            !off &&
            [0.18, 0.6].some((p) => Math.abs(roadBefore.progress - p) < 0.013);
          speed +=
            ((throttle ? 23 : 0) +
              (boosting ? 28 : pad ? 16 : 0) -
              (brake ? 38 : 0) -
              speed * (off ? 1.6 : 0.38)) *
            dt;
          speed = Math.max(-8, Math.min(off ? 17 : boosting ? 60 : 48, speed));
          heading = steerHeading(heading, steering, speed, dt);
          x += Math.sin(heading) * speed * dt;
          z += Math.cos(heading) * speed * dt;
          const road = projectToTrack(samples, x, z);
          if (road.distance > track.width / 2 + 2.1) {
            const side = Math.sign(road.lateral) || 1,
              d = track.width / 2 + 2;
            x = road.x - road.tz * side * d;
            z = road.z + road.tx * side * d;
            speed *= 0.72;
            impact = 0.18;
          }
          const next = advanceCheckpoint(
            lastGate,
            laps,
            road.progress,
            road.distance <= track.width / 2 + 0.25,
          );
          if (next.laps > laps) {
            lastLap = elapsed - lapStart;
            bestLap = bestLap ? Math.min(bestLap, lastLap) : lastLap;
            lapStart = elapsed;
          }
          lastGate = next.lastGate;
          laps = next.laps;
          if (laps >= 3) {
            ended = true;
            const result: RaceResult = {
              trackId,
              rulesVersion: 2,
              durationMs: Math.max(1, Math.round(elapsed * 1000)),
              bestLapMs: Math.max(1, Math.round(bestLap * 1000)),
              score: Math.max(
                500,
                Math.round(
                  (15000 * track.targetSeconds) / Math.max(1, elapsed),
                ),
              ),
            };
            callbacks.current.onRaceFinish?.(result);
            callbacks.current.onScore(result.score);
            callbacks.current.onHud({
              score: result.score,
              detail: `${track.name} · 3 laps complete · ${elapsed.toFixed(2)}s`,
              ended: true,
            });
          }
        }
        world.update(elapsed + now * 0.0001);
        emit(now, ended);
      }
      const road = projectToTrack(samples, x, z);
      kart.position.set(
        x,
        road.y +
          0.12 +
          Math.sin(now * 0.01) * Math.min(Math.abs(speed) * 0.0005, 0.025),
        z,
      );
      kart.rotation.set(
        -Math.atan(
          road.slope * Math.cos(heading - Math.atan2(road.tx, road.tz)),
        ),
        heading,
        steering * Math.min(Math.abs(speed) * 0.002, 0.09),
      );
      tail.visible = keys.has("KeyS") || keys.has("ArrowDown");
      for (const wheel of wheels) {
        if (!paused && !ended) wheel.tire.rotation.x += (speed * dt) / 0.44;
        if (wheel.front) wheel.pivot.rotation.y = -steering * 0.45;
      }
      if (
        !paused &&
        !ended &&
        countdown <= 0 &&
        Math.abs(speed) > 8 &&
        now - dustAt > 65
      ) {
        dustAt = now;
        const p = particles[particleIndex++ % particles.length];
        p.x = x - Math.sin(heading) * 1.8;
        p.y = road.y + 0.35;
        p.z = z - Math.cos(heading) * 1.8;
        p.life = boosting ? 0.8 : 0.35;
      }
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!paused) p.life = Math.max(0, p.life - dt);
        dummy.position.set(p.x, p.life > 0 ? p.y : -20, p.z);
        dummy.scale.setScalar(p.life > 0 ? (1 - p.life) * 0.8 : 0.001);
        dummy.updateMatrix();
        dust.setMatrixAt(i, dummy.matrix);
      }
      dust.instanceMatrix.needsUpdate = true;
      const gatePose = trackPose(samples, (lastGate + 1) / CHECKPOINTS);
      world.gate.position.set(gatePose.x, gatePose.y + 0.25, gatePose.z);
      world.gate.rotation.y = Math.atan2(gatePose.tx, gatePose.tz);
      world.gate.visible = !ended;
      desired.set(
        x - Math.sin(heading) * (boosting ? 14 : 12),
        road.y + 7.5,
        z - Math.cos(heading) * (boosting ? 14 : 12),
      );
      camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
      if (impact > 0 && !paused) {
        impact -= dt;
        camera.position.x += Math.sin(now * 0.07) * impact * 0.4;
      }
      look.set(
        x + Math.sin(heading) * 5,
        road.y + 1.25,
        z + Math.cos(heading) * 5,
      );
      camera.lookAt(look);
      const fov =
        camera.fov + ((boosting ? 72 : 62) - camera.fov) * Math.min(1, dt * 4);
      if (Math.abs(fov - camera.fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const lost = (event: Event) => {
      event.preventDefault();
      callbacks.current.onError(
        "The graphics context was interrupted. Return to the garage and try again.",
      );
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      world.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      control.current = null;
    };
  }, [trackId, quality, control]);
  return (
    <div
      className="canvas-wrap engine-canvas kart-canvas"
      ref={mount}
      aria-label={`${getTrack(trackId).name} 3D racetrack`}
    />
  );
}
