import * as T from "three";
import {
  projectToTrack,
  trackPose,
  ghostPose,
  cornerSpeed,
  type RaceSimulation,
  type GhostFrame,
} from "@onlinearcade/core";
import { createRacingWorld } from "./racing-world";
import { createCanvasRace, type RaceView } from "./race-canvas";
function buildKart(color: string, ghost = false) {
  const group = new T.Group(),
    wheels: { pivot: T.Group; tire: T.Mesh; front: boolean }[] = [];
  const material = (color: string, metalness = 0.15) =>
    new T.MeshStandardMaterial({
      color,
      metalness,
      roughness: 0.4,
      transparent: ghost,
      opacity: ghost ? 0.25 : 1,
      depthWrite: !ghost,
    });
  const body = material(color, 0.35),
    rubber = material("#19232e"),
    trim = material("#f5e0b8", 0.4),
    glass = material("#294a5a", 0.65);
  const part = (
    geo: T.BufferGeometry,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new T.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = !ghost;
    group.add(mesh);
    return mesh;
  };
  part(new T.BoxGeometry(1.85, 0.4, 3.2), body, 0, 0.65, 0);
  part(new T.BoxGeometry(1.2, 0.6, 1.15), glass, 0, 1.12, -0.1);
  part(new T.BoxGeometry(1.05, 0.08, 0.95), trim, 0, 0.88, 0.95);
  part(new T.BoxGeometry(2.1, 0.14, 0.5), trim, 0, 1.08, -1.5);
  part(new T.BoxGeometry(2.05, 0.15, 0.25), rubber, 0, 0.4, 1.72);
  for (const x of [-0.7, 0.7]) {
    part(new T.BoxGeometry(0.1, 0.4, 0.17), body, x, 0.93, -1.5);
    part(new T.BoxGeometry(0.35, 0.12, 0.06), trim, x, 0.75, 1.62);
  }
  for (const x of [-1.04, 1.04])
    for (const z of [-1, 1]) {
      const pivot = new T.Group();
      pivot.position.set(x, 0.44, z);
      group.add(pivot);
      const tire = new T.Mesh(
        new T.CylinderGeometry(0.43, 0.43, 0.4, 12),
        rubber,
      );
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = !ghost;
      pivot.add(tire);
      const hub = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.42, 8), trim);
      hub.rotation.z = Math.PI / 2;
      pivot.add(hub);
      wheels.push({ pivot, tire, front: z > 0 });
    }
  const tail = part(
    new T.BoxGeometry(1.2, 0.13, 0.07),
    new T.MeshStandardMaterial({
      color: "#f96b59",
      emissive: "#e34a38",
      emissiveIntensity: 1.5,
      transparent: ghost,
      opacity: ghost ? 0.25 : 1,
    }),
    0,
    0.7,
    -1.62,
  );
  const flame = part(
    new T.ConeGeometry(0.24, 1.2, 8),
    new T.MeshBasicMaterial({
      color: "#9ce9ee",
      transparent: true,
      opacity: 0.8,
    }),
    0,
    0.6,
    -2,
  );
  flame.rotation.x = -Math.PI / 2;
  flame.visible = false;
  return { group, wheels, tail, flame };
}
export function createRaceView(
  target: HTMLElement,
  sim: RaceSimulation,
  quality: "balanced" | "high",
): RaceView {
  let renderer: T.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    return createCanvasRace(target, sim);
  }
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, quality === "high" ? 1.8 : 1.25),
  );
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  target.appendChild(renderer.domElement);
  const world = createRacingWorld(sim.track, sim.samples),
    { scene } = world;
  world.sun.shadow.mapSize.set(
    quality === "high" ? 2048 : 1024,
    quality === "high" ? 2048 : 1024,
  );
  world.gate.visible = false;
  const camera = new T.PerspectiveCamera(66, 16 / 9, 0.1, 650),
    desired = new T.Vector3(),
    look = new T.Vector3(),
    models = sim.cars.map((c) => buildKart(c.color)),
    ghost = buildKart("#a6e8ef", true);
  models.forEach((m) => scene.add(m.group));
  scene.add(ghost.group);
  ghost.group.visible = false;
  if (sim.track.biome === "city") {
    const light = new T.SpotLight("#e5f6db", 50, 35, Math.PI / 5, 0.6, 1.4);
    light.position.set(0, 1.1, 1.7);
    const aim = new T.Object3D();
    aim.position.set(0, 0.1, 14);
    models[0].group.add(aim, light);
    light.target = aim;
  }
  const arrowGeometry = new T.BufferGeometry();
  arrowGeometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [-0.5, 0.02, -0.7, 0, 0.02, 0.6, 0.5, 0.02, -0.7, 0, 0.02, -0.35],
      3,
    ),
  );
  arrowGeometry.setIndex([0, 1, 3, 1, 2, 3]);
  arrowGeometry.computeVertexNormals();
  const line = new T.InstancedMesh(
    arrowGeometry,
    new T.MeshBasicMaterial({
      color: "#a9ddc3",
      transparent: true,
      opacity: 0.55,
      side: T.DoubleSide,
      depthWrite: false,
    }),
    28,
  );
  line.instanceMatrix.setUsage(T.DynamicDrawUsage);
  line.frustumCulled = false;
  scene.add(line);
  const skidPositions = new Float32Array(420 * 6),
    skidGeometry = new T.BufferGeometry();
  skidGeometry.setAttribute(
    "position",
    new T.BufferAttribute(skidPositions, 3),
  );
  skidGeometry.setDrawRange(0, 0);
  const skidMaterial = new T.LineBasicMaterial({
      color: "#1a2330",
      transparent: true,
      opacity: 0.65,
    }),
    skids = new T.LineSegments(skidGeometry, skidMaterial);
  skids.frustumCulled = false;
  scene.add(skids);
  let skidIndex = 0,
    skidCount = 0,
    lastSkid: { x: number; z: number }[] | null = null,
    lastTick = -1,
    cameraYaw = sim.player.heading;
  const sparkPositions = new Float32Array(48 * 3),
    sparkLife = new Float32Array(48),
    sparkVelocity = new Float32Array(48 * 3);
  const sparkGeometry = new T.BufferGeometry();
  sparkGeometry.setAttribute(
    "position",
    new T.BufferAttribute(sparkPositions, 3),
  );
  const sparkMaterial = new T.PointsMaterial({
    color: "#ffbd75",
    size: 0.2,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const sparks = new T.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  scene.add(sparks);
  sparkPositions.fill(-1000);
  let sparkIndex = 0;
  const safeColor = new T.Color("#9bd9bd"),
    brakeColor = new T.Color("#ee9d7e");
  const dummy = new T.Object3D();
  const resize = () => {
    const w = target.clientWidth,
      h = target.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const p = sim.player,
    start = projectToTrack(sim.samples, p.x, p.z);
  camera.position.set(
    p.x - Math.sin(p.heading) * 10,
    start.y + 5,
    p.z - Math.cos(p.heading) * 10,
  );
  return {
    mode: "3d",
    resize,
    draw: (state, dt, replay, racingLine) => {
      const player = state.player;
      for (let i = 0; i < state.cars.length; i++) {
        const car = state.cars[i],
          m = models[i],
          road = projectToTrack(state.samples, car.x, car.z);
        m.group.position.set(car.x, road.y + 0.05, car.z);
        m.group.rotation.set(
          -Math.atan(
            road.slope * Math.cos(car.heading - Math.atan2(road.tx, road.tz)),
          ),
          car.heading,
          car.steer * Math.min(Math.abs(car.speed) * 0.002, 0.07),
        );
        m.tail.visible = car.lastInput.brake > 0.1;
        m.flame.visible = car.boosting || car.turbo > 0;
        m.flame.scale.y = 0.8 + Math.sin(state.tick * 0.8) * 0.2;
        for (const wheel of m.wheels) {
          wheel.tire.rotation.x += (car.speed * dt) / 0.43;
          if (wheel.front) wheel.pivot.rotation.y = -car.steer * 0.4;
        }
      }
      const pose = replay
        ? ghostPose(replay, state.time + player.penalty)
        : null;
      ghost.group.visible = !!pose;
      if (pose) {
        const road = projectToTrack(state.samples, pose.x, pose.z);
        ghost.group.position.set(pose.x, road.y + 0.12, pose.z);
        ghost.group.rotation.y = pose.heading;
      }
      line.visible = racingLine;
      for (let i = 0; i < 28; i++) {
        const t = player.progress + ((i + 1) * 3.7) / state.length,
          point = trackPose(state.samples, t),
          safe = cornerSpeed(state.samples, t, state.length, 16);
        dummy.position.set(point.x, point.y + 0.16, point.z);
        dummy.rotation.set(0, Math.atan2(point.tx, point.tz), 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        line.setMatrixAt(i, dummy.matrix);
        line.setColorAt(
          i,
          Math.abs(player.speed) > safe + 4 ? brakeColor : safeColor,
        );
      }
      line.instanceMatrix.needsUpdate = true;
      if (line.instanceColor) line.instanceColor.needsUpdate = true;
      if (state.tick < lastTick) {
        lastSkid = null;
        skidCount = 0;
        skidIndex = 0;
        skidGeometry.setDrawRange(0, 0);
        sparkLife.fill(0);
        sparkPositions.fill(-1000);
      }
      const sparkDt = Math.min(dt, 0.05);
      for (let i = 0; i < 48; i++)
        if (sparkLife[i] > 0) {
          sparkLife[i] -= sparkDt;
          const j = i * 3;
          if (sparkLife[i] <= 0) sparkPositions[j + 1] = -1000;
          else {
            sparkVelocity[j + 1] -= 6 * sparkDt;
            for (let k = 0; k < 3; k++)
              sparkPositions[j + k] += sparkVelocity[j + k] * sparkDt;
          }
        }
      if (
        player.drifting &&
        player.driftCharge > 0.3 &&
        lastTick !== state.tick
      ) {
        const y = projectToTrack(state.samples, player.x, player.z).y;
        for (const side of [-1, 1]) {
          const i = sparkIndex,
            j = i * 3;
          sparkIndex = (sparkIndex + 1) % 48;
          sparkLife[i] = 0.3;
          sparkPositions.set(
            [
              player.x -
                Math.sin(player.heading) +
                Math.cos(player.heading) * side,
              y + 0.3,
              player.z -
                Math.cos(player.heading) -
                Math.sin(player.heading) * side,
            ],
            j,
          );
          sparkVelocity.set(
            [-player.vx * 0.15 + side * 2, 1.5, -player.vz * 0.15],
            j,
          );
        }
      }
      sparkMaterial.color.set(
        player.driftCharge >= 2.3
          ? "#d8a5ff"
          : player.driftCharge >= 1.1
            ? "#ffc16e"
            : "#9fe8ed",
      );
      sparkGeometry.attributes.position.needsUpdate = true;
      if (lastTick !== state.tick) {
        lastTick = state.tick;
        if (player.drifting) {
          const road = projectToTrack(state.samples, player.x, player.z),
            positions = [-1, 1].map((side) => ({
              x:
                player.x -
                Math.sin(player.heading) +
                Math.cos(player.heading) * side,
              z:
                player.z -
                Math.cos(player.heading) -
                Math.sin(player.heading) * side,
            }));
          if (lastSkid)
            for (let side = 0; side < 2; side++) {
              const a = lastSkid[side],
                b = positions[side];
              skidPositions.set(
                [a.x, road.y + 0.17, a.z, b.x, road.y + 0.17, b.z],
                skidIndex * 6,
              );
              skidIndex = (skidIndex + 1) % 420;
              skidCount = Math.min(420, skidCount + 1);
            }
          lastSkid = positions;
          skidGeometry.attributes.position.needsUpdate = true;
          skidGeometry.setDrawRange(0, skidCount * 2);
        } else lastSkid = null;
      }
      const road = projectToTrack(state.samples, player.x, player.z),
        v = Math.hypot(player.vx, player.vz),
        direction = v > 5 ? Math.atan2(player.vx, player.vz) : player.heading;
      cameraYaw +=
        Math.atan2(
          Math.sin(direction - cameraYaw),
          Math.cos(direction - cameraYaw),
        ) *
        (1 - Math.exp(-dt * 5));
      const distance = 9 + v * 0.1;
      desired.set(
        player.x - Math.sin(cameraYaw) * distance,
        road.y + 4.9 + v * 0.015,
        player.z - Math.cos(cameraYaw) * distance,
      );
      camera.position.lerp(desired, 1 - Math.exp(-dt * 7));
      look.set(
        player.x + Math.sin(cameraYaw) * 6,
        road.y + 1.05,
        player.z + Math.cos(cameraYaw) * 6,
      );
      camera.lookAt(look);
      const targetFov =
        64 + v * 0.13 + (player.boosting || player.turbo > 0 ? 5 : 0);
      if (Math.abs(camera.fov - targetFov) > 0.02) {
        camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-dt * 4));
        camera.updateProjectionMatrix();
      }
      world.update(state.time);
      renderer.render(scene, camera);
    },
    dispose: () => {
      sparkGeometry.dispose();
      sparkMaterial.dispose();
      skidGeometry.dispose();
      skidMaterial.dispose();
      world.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
