"use client";
import { useEffect, useRef } from "react";
import type { EngineProps } from "./PhaserArcade";
export default function KartCircuit({
  onScore,
  onHud,
  onError,
  control,
}: EngineProps) {
  const mount = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onScore, onHud, onError });
  callbacks.current = { onScore, onHud, onError };
  useEffect(() => {
    let cancelled = false,
      cleanup = () => {};
    import("three")
      .then((T) => {
        if (cancelled || !mount.current) return;
        const target = mount.current;
        let renderer: import("three").WebGLRenderer;
        try {
          renderer = new T.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
          });
        } catch {
          callbacks.current.onError(
            "3D racing needs WebGL. Try another browser or one of the 2D games.",
          );
          return;
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        target.appendChild(renderer.domElement);
        const scene = new T.Scene();
        scene.background = new T.Color("#dfab9b");
        scene.fog = new T.Fog("#dfab9b", 110, 320);
        const camera = new T.PerspectiveCamera(62, 16 / 9, 0.1, 600);
        scene.add(new T.HemisphereLight("#ffe0b0", "#56546d", 2.2));
        const sun = new T.DirectionalLight("#ffcea0", 3);
        sun.position.set(-35, 75, 40);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, {
          left: -110,
          right: 110,
          top: 110,
          bottom: -110,
        });
        scene.add(sun);
        scene.add(sun.target);
        const mat = (color: string, extra = {}) =>
          new T.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
        const grass = mat("#718b77"),
          road = mat("#414450"),
          cream = mat("#f4d5ab"),
          red = mat("#d17d76"),
          trunk = mat("#665461"),
          leaf = mat("#607e73");
        function mesh(
          geometry: import("three").BufferGeometry,
          material: import("three").Material,
          x = 0,
          y = 0,
          z = 0,
        ) {
          const m = new T.Mesh(geometry, material);
          m.position.set(x, y, z);
          m.castShadow = true;
          m.receiveShadow = true;
          scene.add(m);
          return m;
        }
        mesh(new T.PlaneGeometry(1200, 1200), grass).rotation.x = -Math.PI / 2;
        function ribbon(
          rx: number,
          rz: number,
          width: number,
          y: number,
          material: import("three").Material,
        ) {
          const positions: number[] = [],
            indices: number[] = [];
          for (let i = 0; i <= 180; i++) {
            const a = (i / 180) * Math.PI * 2;
            for (const d of [-width / 2, width / 2])
              positions.push((rx + d) * Math.cos(a), y, (rz + d) * Math.sin(a));
            if (i < 180) {
              const n = i * 2;
              indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
            }
          }
          const geo = new T.BufferGeometry();
          geo.setAttribute(
            "position",
            new T.Float32BufferAttribute(positions, 3),
          );
          geo.setIndex(indices);
          geo.computeVertexNormals();
          const m = mesh(geo, material);
          m.material = material;
          m.castShadow = false;
          return m;
        }
        ribbon(65, 42, 19, 0.02, cream);
        ribbon(65, 42, 15, 0.04, road);
        // Repeated scenery uses GPU instancing rather than hundreds of draw calls.
        const instance = (
          geometry: import("three").BufferGeometry,
          material: import("three").Material,
          count: number,
        ) => {
          const group = new T.InstancedMesh(geometry, material, count);
          group.receiveShadow = true;
          scene.add(group);
          return group;
        };
        const marks = instance(new T.BoxGeometry(0.35, 0.04, 1.7), cream, 96),
          whiteCurbs = instance(new T.BoxGeometry(1.2, 0.12, 2.5), cream, 96),
          redCurbs = instance(new T.BoxGeometry(1.2, 0.12, 2.5), red, 96),
          dummy = new T.Object3D();
        let whites = 0,
          reds = 0;
        for (let i = 0; i < 96; i++) {
          const a = (i / 96) * Math.PI * 2;
          dummy.position.set(65 * Math.cos(a), 0.09, 42 * Math.sin(a));
          dummy.rotation.y = Math.atan2(-65 * Math.sin(a), 42 * Math.cos(a));
          dummy.updateMatrix();
          marks.setMatrixAt(i, dummy.matrix);
          for (const sign of [-1, 1]) {
            dummy.position.set(
              (65 + sign * 8.2) * Math.cos(a),
              0.09,
              (42 + sign * 8.2) * Math.sin(a),
            );
            dummy.updateMatrix();
            if (i % 2) whiteCurbs.setMatrixAt(whites++, dummy.matrix);
            else redCurbs.setMatrixAt(reds++, dummy.matrix);
          }
        }
        const trunks = instance(
            new T.CylinderGeometry(0.35, 0.5, 1, 6),
            trunk,
            70,
          ),
          leaves = instance(new T.ConeGeometry(1, 1, 7), leaf, 70);
        trunks.castShadow = true;
        leaves.castShadow = true;
        dummy.rotation.set(0, 0, 0);
        for (let i = 0; i < 70; i++) {
          const a = i * 2.39996,
            r = 95 + (i % 7) * 13,
            h = 3 + (i % 4),
            x = Math.cos(a) * r,
            z = Math.sin(a) * r;
          dummy.position.set(x, h / 2, z);
          dummy.scale.set(1, h, 1);
          dummy.updateMatrix();
          trunks.setMatrixAt(i, dummy.matrix);
          dummy.position.set(x, h * 1.3, z);
          dummy.scale.set(2.5 + (i % 3), h * 1.8, 2.5 + (i % 3));
          dummy.updateMatrix();
          leaves.setMatrixAt(i, dummy.matrix);
        }
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2,
            r = 240;
          const mountain = mesh(
            new T.ConeGeometry(35 + (i % 3) * 12, 40 + (i % 4) * 14, 5),
            mat(["#8a8190", "#9a8797", "#b89d9e"][i % 3]),
            Math.cos(a) * r,
            13,
            Math.sin(a) * r,
          );
          mountain.rotation.y = i;
        }
        mesh(
          new T.SphereGeometry(13, 24, 16),
          new T.MeshBasicMaterial({ color: "#ffe4b6" }),
          -120,
          85,
          -140,
        );
        for (let i = 0; i < 8; i++)
          mesh(
            new T.BoxGeometry(1, 0.05, 1.5),
            i % 2 ? road : cream,
            58 + i * 2,
            0.12,
            0,
          );
        // Original low-poly kart with body, cockpit, spoiler and four rubber tires.
        const kart = new T.Group();
        scene.add(kart);
        const bodyMat = mat("#fba363", { metalness: 0.25, roughness: 0.35 });
        const rubber = mat("#202936");
        const glass = mat("#344e60", { metalness: 0.5, roughness: 0.2 });
        function part(
          geo: import("three").BufferGeometry,
          m: import("three").Material,
          x: number,
          y: number,
          z: number,
        ) {
          const p = new T.Mesh(geo, m);
          p.position.set(x, y, z);
          p.castShadow = true;
          kart.add(p);
          return p;
        }
        part(new T.BoxGeometry(1.9, 0.55, 3.3), bodyMat, 0, 0.8, 0);
        part(new T.BoxGeometry(1.3, 0.65, 1.2), glass, 0, 1.35, -0.15);
        part(new T.BoxGeometry(2.3, 0.15, 0.5), cream, 0, 1.2, -1.6);
        part(new T.BoxGeometry(1.5, 0.1, 0.9), cream, 0, 1.1, 1.1);
        for (const x of [-1.05, 1.05])
          for (const z of [-1, 1]) {
            const wheel = part(
              new T.CylinderGeometry(0.47, 0.47, 0.45, 12),
              rubber,
              x,
              0.5,
              z,
            );
            wheel.rotation.z = Math.PI / 2;
          }
        const tail = part(
          new T.BoxGeometry(1.4, 0.18, 0.1),
          new T.MeshStandardMaterial({
            color: "#ff6254",
            emissive: "#ff3322",
            emissiveIntensity: 2,
          }),
          0,
          0.9,
          -1.7,
        );
        let keys = new Set<string>(),
          speed = 0,
          heading = 0,
          x = 65,
          z = 0,
          clock = 0,
          lap = 0,
          sector = 0,
          paused = false,
          ended = false,
          last = performance.now(),
          frame = 0,
          hudTime = 0;
        const reset = () => {
          keys.clear();
          speed = 0;
          heading = 0;
          x = 65;
          z = 0;
          clock = 0;
          lap = 0;
          sector = 0;
          ended = false;
          camera.position.set(65, 8, -13);
          callbacks.current.onHud({
            score: 0,
            detail: "Lap 1 / 3 · 0 km/h · 0.0s",
            ended: false,
          });
        };
        const key = (k: string, down: boolean) => {
          if (down && paused) return;
          if (down) keys.add(k);
          else keys.delete(k);
          if (k === "Space" && down && !ended) {
            const a = (sector / 8) * Math.PI * 2;
            x = 65 * Math.cos(a);
            z = 42 * Math.sin(a);
            heading = Math.atan2(-65 * Math.sin(a), 42 * Math.cos(a));
            speed = 0;
          }
        };
        const down = (e: KeyboardEvent) => {
          if (
            [
              "ArrowUp",
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
              "Space",
            ].includes(e.code)
          )
            e.preventDefault();
          key(e.code, true);
        };
        const up = (e: KeyboardEvent) => key(e.code, false);
        const blur = () => keys.clear();
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
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
          const w = target.clientWidth,
            h = target.clientHeight;
          if (!w || !h) return;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(target);
        resize();
        reset();
        const animate = (now: number) => {
          if (cancelled) return;
          const dt = Math.min((now - last) / 1000, 0.04);
          last = now;
          if (!paused && !ended) {
            clock += dt;
            const throttle = keys.has("ArrowUp") || keys.has("KeyW"),
              brake = keys.has("ArrowDown") || keys.has("KeyS");
            const off =
              Math.abs(Math.sqrt((x / 65) ** 2 + (z / 42) ** 2) - 1) > 0.16;
            speed +=
              ((throttle ? 22 : 0) -
                (brake ? 35 : 0) -
                speed * (off ? 1.8 : 0.35)) *
              dt;
            speed = Math.max(-8, Math.min(off ? 18 : 48, speed));
            const steering =
              Number(keys.has("ArrowRight") || keys.has("KeyD")) -
              Number(keys.has("ArrowLeft") || keys.has("KeyA"));
            // The follow camera looks along +Z: screen-right is a negative Y rotation.
            heading -=
              steering *
              1.55 *
              dt *
              Math.min(1, Math.abs(speed) / 8) *
              Math.sign(speed || 1);
            x += Math.sin(heading) * speed * dt;
            z += Math.cos(heading) * speed * dt;
            const a =
                (Math.atan2(z / 42, x / 65) + Math.PI * 2) % (Math.PI * 2),
              next = Math.floor((a / (Math.PI * 2)) * 8);
            if (!off && next === (sector + 1) % 8) {
              sector = next;
              if (sector === 0) lap++;
            }
            if (lap >= 3) {
              ended = true;
              const score = Math.max(500, 15000 - Math.floor(clock * 50));
              callbacks.current.onScore(score);
              callbacks.current.onHud({
                score,
                detail: `3 laps complete · ${clock.toFixed(2)}s`,
                ended: true,
              });
            } else if (now - hudTime > 100) {
              hudTime = now;
              callbacks.current.onHud({
                score: Math.floor(clock * 10),
                detail: `Lap ${lap + 1} / 3 · ${Math.round(Math.abs(speed) * 4)} km/h · ${clock.toFixed(1)}s${off ? " · OFF TRACK — Space to recover" : ""}`,
                ended: false,
              });
            }
          }
          kart.position.set(x, 0.05, z);
          kart.rotation.y = heading;
          tail.visible = keys.has("ArrowDown");
          const desired = new T.Vector3(
            x - Math.sin(heading) * 12,
            7,
            z - Math.cos(heading) * 12,
          );
          camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
          camera.lookAt(
            x + Math.sin(heading) * 5,
            1,
            z + Math.cos(heading) * 5,
          );
          renderer.render(scene, camera);
          frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        const lost = (event: Event) => {
          event.preventDefault();
          callbacks.current.onError(
            "Graphics context was interrupted. Close and reopen the game.",
          );
        };
        renderer.domElement.addEventListener("webglcontextlost", lost);
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          window.removeEventListener("keydown", down);
          window.removeEventListener("keyup", up);
          window.removeEventListener("blur", blur);
          renderer.domElement.removeEventListener("webglcontextlost", lost);
          const materials = new Set<import("three").Material>();
          scene.traverse((o) => {
            if (o instanceof T.Mesh) {
              if (o instanceof T.InstancedMesh) o.dispose();
              o.geometry.dispose();
              for (const m of Array.isArray(o.material)
                ? o.material
                : [o.material])
                materials.add(m);
            }
          });
          materials.forEach((m) => m.dispose());
          sun.shadow.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          control.current = null;
        };
      })
      .catch(() =>
        callbacks.current.onError(
          "The 3D engine could not load. Close and try again.",
        ),
      );
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [control]);
  return (
    <div
      className="canvas-wrap engine-canvas kart-canvas"
      ref={mount}
      aria-label="3D Sunset Circuit racetrack"
    />
  );
}
