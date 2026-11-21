import * as T from "three";
import { CLOUD_PLATFORMS, type CloudSimulation } from "@onlinearcade/core";
export type CloudView = {
  mode: "3d" | "2d";
  resize: () => void;
  draw: (sim: CloudSimulation, dt: number) => void;
  dispose: () => void;
};
const PALETTES = [
  { top: 0x9dc9ae, rock: 0x9b8a86, leaf: 0xf0b58d },
  { top: 0xb3d7e5, rock: 0x7e8da6, leaf: 0x8ac7c2 },
  { top: 0xc3b4de, rock: 0x817999, leaf: 0xd8b5ce },
];
export function createCloudView(
  target: HTMLElement,
  sim: CloudSimulation,
): CloudView {
  let renderer: T.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    return createCloudCanvas(target);
  }
  const scene = new T.Scene();
  scene.background = new T.Color(0xc3d6df);
  scene.fog = new T.FogExp2(0xc3d6df, 0.012);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = target.clientWidth >= 650;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  target.appendChild(renderer.domElement);
  const camera = new T.PerspectiveCamera(52, 1, 0.1, 220);
  scene.add(new T.HemisphereLight(0xffe8c9, 0x7183a7, 2.5));
  const sun = new T.DirectionalLight(0xffdfb4, 3.1);
  sun.position.set(-20, 40, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const mat = (color: number, roughness = 0.8) =>
    new T.MeshStandardMaterial({ color, roughness });
  const add = (
    geo: T.BufferGeometry,
    material: T.Material,
    parent: T.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const islands = CLOUD_PLATFORMS.map((p) => {
    const group = new T.Group(),
      theme = PALETTES[Math.min(2, Math.floor(p.id / 10))],
      stone = mat(theme.rock),
      top = mat(
        p.kind === "checkpoint" || p.kind === "goal" ? 0xf2d6a0 : theme.top,
      );
    const pose = sim.pose(p);
    group.position.set(pose.x, p.y, p.z);
    scene.add(group);
    add(new T.BoxGeometry(p.w, 0.5, p.d), top, group, 0, -0.25);
    add(
      new T.CylinderGeometry(p.w * 0.53, 0.2, 3.8, 5),
      stone,
      group,
      0,
      -2.3,
    ).rotation.y = p.id * 0.7;
    const rim = new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(p.w, 0.5, p.d)),
      new T.LineBasicMaterial({ color: 0xf4dfb4 }),
    );
    rim.position.y = -0.25;
    group.add(rim);
    if (p.kind === "crumble") {
      const line = new T.LineSegments(
        new T.EdgesGeometry(new T.BoxGeometry(p.w, 0.52, p.d)),
        new T.LineBasicMaterial({ color: 0xd77e6a }),
      );
      line.position.y = -0.24;
      group.add(line);
      for (let j = 0; j < 3; j++) {
        const crack = add(
          new T.BoxGeometry(0.045, 0.02, p.d * 0.5),
          mat(0x6e677d),
          group,
          -1 + j,
          0.02,
        );
        crack.rotation.y = 0.5 * j;
      }
    }
    for (let k = 0; k < 3; k++) {
      const vine = add(
        new T.CylinderGeometry(0.035, 0.02, 1.5 + k * 0.4, 4),
        mat(0x6c9785),
        group,
        p.w * 0.46,
        -1 - k * 0.1,
        (k - 1) * p.d * 0.3,
      );
      vine.rotation.z = 0.1 * Math.sin(k + p.id);
    }
    if (p.id % 10 === 0) {
      for (const side of [-1, 1]) {
        add(
          new T.CylinderGeometry(0.18, 0.3, 2.2, 7),
          mat(0xd5c6af),
          group,
          side * (p.w / 2 - 0.6),
          1.1,
          1.4,
        );
        add(
          new T.SphereGeometry(0.95, 6, 5),
          mat(theme.leaf),
          group,
          side * (p.w / 2 - 0.6),
          2.7,
          1.4,
        );
      }
      const ring = add(
        new T.TorusGeometry(1.35, 0.07, 8, 40),
        new T.MeshStandardMaterial({
          color: 0xffd383,
          emissive: 0xd5a85c,
          emissiveIntensity: 0.7,
        }),
        group,
        0,
        0.12,
        0,
      );
      ring.rotation.x = -Math.PI / 2;
    } else if (p.id % 3 === 0) {
      for (const side of [-1, 1]) {
        const grass = add(
          new T.ConeGeometry(0.2, 0.65, 4),
          mat(theme.leaf),
          group,
          side * p.w * 0.38,
          0.32,
          p.d * 0.35,
        );
        grass.rotation.z = side * 0.25;
      }
    }
    if (p.id >= 10 && p.id < 20 && p.id % 2 === 0) {
      add(
        new T.CylinderGeometry(0.3, 0.38, 2.1, 6),
        mat(0xd2d7e3),
        group,
        -p.w * 0.38,
        1.05,
        p.d * 0.35,
      );
      add(
        new T.BoxGeometry(0.8, 0.18, 0.7),
        mat(0xe6dfce),
        group,
        -p.w * 0.38,
        2.15,
        p.d * 0.35,
      );
    }
    return group;
  });
  const crystals = CLOUD_PLATFORMS.map((p) => {
    const m = add(
      new T.OctahedronGeometry(0.29),
      new T.MeshStandardMaterial({
        color: 0xffdb90,
        emissive: 0xe6ad56,
        emissiveIntensity: 0.55,
        metalness: 0.4,
        roughness: 0.3,
      }),
      scene,
    );
    return m;
  });
  const portal = new T.Group();
  portal.position.set(
    CLOUD_PLATFORMS[30].x,
    CLOUD_PLATFORMS[30].y + 2,
    CLOUD_PLATFORMS[30].z,
  );
  scene.add(portal);
  add(new T.TorusGeometry(1.7, 0.18, 12, 48), mat(0xf1d9a6), portal);
  const portalGlow = add(
    new T.CircleGeometry(1.5, 48),
    new T.MeshBasicMaterial({
      color: 0xd5f5f1,
      transparent: true,
      opacity: 0.32,
      side: T.DoubleSide,
    }),
    portal,
  );
  portalGlow.castShadow = false;
  const player = new T.Group();
  scene.add(player);
  const body = mat(0xf5dcb7),
    orange = mat(0xe89a6d),
    dark = mat(0x344763),
    visor = mat(0x6ba7b5, 0.25);
  add(new T.CapsuleGeometry(0.34, 0.45, 4, 8), body, player, 0, 0.85);
  add(new T.SphereGeometry(0.36, 12, 8), body, player, 0, 1.35);
  add(new T.BoxGeometry(0.58, 0.2, 0.22), visor, player, 0, 1.36, 0.26);
  add(new T.BoxGeometry(0.48, 0.5, 0.22), orange, player, 0, 0.9, -0.35);
  const legs = [-1, 1].map((side) => {
    const pivot = new T.Group();
    pivot.position.set(side * 0.19, 0.45, 0);
    player.add(pivot);
    add(new T.CapsuleGeometry(0.12, 0.28, 3, 6), dark, pivot, 0, -0.13);
    add(new T.BoxGeometry(0.25, 0.13, 0.4), orange, pivot, 0, -0.38, 0.05);
    return pivot;
  });
  const arms = [-1, 1].map((side) => {
    const arm = new T.Group();
    arm.position.set(side * 0.4, 1.05, 0);
    player.add(arm);
    add(new T.CapsuleGeometry(0.09, 0.28, 3, 6), orange, arm, 0, -0.12);
    return arm;
  });
  const scarf = add(
    new T.BoxGeometry(0.2, 0.055, 0.75),
    orange,
    player,
    0.13,
    1.2,
    -0.55,
  );
  const shadow = add(
    new T.CircleGeometry(0.5, 32),
    new T.MeshBasicMaterial({
      color: 0x344153,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    }),
    scene,
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.castShadow = false;
  const landing = add(
    new T.RingGeometry(0.38, 0.46, 32),
    new T.MeshBasicMaterial({
      color: 0xffe8b1,
      transparent: true,
      opacity: 0.8,
      side: T.DoubleSide,
    }),
    scene,
  );
  landing.rotation.x = -Math.PI / 2;
  landing.castShadow = false;
  const clouds = new T.Group();
  scene.add(clouds);
  const cloudMat = new T.MeshStandardMaterial({
    color: 0xfff4e6,
    roughness: 1,
    transparent: true,
    opacity: 0.78,
  });
  for (let i = 0; i < 45; i++) {
    const x = Math.sin(i * 17) * 24,
      z = i * 4.4 - 12,
      y = Math.cos(i * 7) * 3 - 8;
    for (let k = 0; k < 3; k++) {
      const c = add(
        new T.SphereGeometry(1, 7, 5),
        cloudMat,
        clouds,
        x + k * 1.8,
        y,
        z,
      );
      c.scale.set(3, 1.1 + k * 0.15, 2);
      c.castShadow = false;
      c.receiveShadow = false;
    }
  }
  const particles = new T.BufferGeometry(),
    positions = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    positions[i * 3] = Math.sin(i * 4) * 20;
    positions[i * 3 + 1] = Math.cos(i * 13) * 12;
    positions[i * 3 + 2] = i * 2;
  }
  particles.setAttribute("position", new T.BufferAttribute(positions, 3));
  const dust = new T.Points(
    particles,
    new T.PointsMaterial({
      color: 0xffebbd,
      size: 0.07,
      transparent: true,
      opacity: 0.8,
    }),
  );
  scene.add(dust);
  const nextRing = add(
    new T.TorusGeometry(1, 0.035, 8, 48),
    new T.MeshBasicMaterial({
      color: 0xd2fff2,
      transparent: true,
      opacity: 0.83,
    }),
    scene,
  );
  nextRing.castShadow = false;
  nextRing.rotation.x = -Math.PI / 2;
  const cameraTarget = new T.Vector3(),
    desired = new T.Vector3();
  camera.position.set(sim.x, sim.y + 10, sim.z - 14);
  const resize = () => {
    camera.aspect =
      Math.max(1, target.clientWidth) / Math.max(1, target.clientHeight);
    camera.fov = 52 + Math.max(0, 1 - camera.aspect) * 21;
    camera.updateProjectionMatrix();
    renderer.setSize(target.clientWidth, target.clientHeight);
  };
  resize();
  const skyColors = [
      new T.Color(0xc3d6df),
      new T.Color(0x9fbdd4),
      new T.Color(0x9c9fca),
    ],
    color = new T.Color();
  return {
    mode: "3d",
    resize,
    draw(s, dt) {
      const region = Math.max(0, Math.min(2, s.z / 58)),
        index = Math.floor(region);
      color
        .copy(skyColors[index])
        .lerp(skyColors[Math.min(2, index + 1)], region - index);
      (scene.background as T.Color).copy(color);
      (scene.fog as T.FogExp2).color.copy(color);
      CLOUD_PLATFORMS.forEach((p, i) => {
        const v = s.pose(p),
          g = islands[i];
        g.position.x = v.x;
        g.visible = s.visible(p);
        const c = s.crumble.get(p.id);
        g.rotation.z =
          c && c.left > 0 ? Math.sin(s.time * 45) * (0.02 * (1.3 - c.left)) : 0;
        crystals[i].visible = !s.crystals.has(p.id);
        crystals[i].position.set(
          v.x,
          p.y + 1.8 + Math.sin(s.time * 2 + i) * 0.12,
          p.z,
        );
        crystals[i].rotation.y = s.time * 1.8;
      });
      player.position.set(s.x, s.y, s.z);
      if (Math.hypot(s.vx, s.vz) > 0.3) {
        const heading = Math.atan2(s.vx, s.vz),
          d = Math.atan2(
            Math.sin(heading - player.rotation.y),
            Math.cos(heading - player.rotation.y),
          );
        player.rotation.y += d * (1 - Math.exp(-dt * 12));
      }
      const run =
        s.standing !== null
          ? Math.sin(s.time * 13) *
            Math.min(1, Math.hypot(s.vx, s.vz) / 5) *
            0.6
          : 0;
      legs[0].rotation.x = run;
      legs[1].rotation.x = -run;
      arms.forEach(
        (a, i) => (a.rotation.x = s.standing === null ? -1.1 : i ? run : -run),
      );
      scarf.rotation.x = 0.15 + Math.sin(s.time * 8) * 0.12;
      player.scale.set(
        1 + s.landPulse * 0.04,
        1 - s.landPulse * 0.06,
        1 + s.landPulse * 0.04,
      );
      const below = CLOUD_PLATFORMS.filter(
        (p) =>
          s.visible(p) &&
          p.y <= s.y + 0.05 &&
          Math.abs(s.x - s.pose(p).x) <= p.w / 2 &&
          Math.abs(s.z - p.z) <= p.d / 2,
      ).sort((a, b) => b.y - a.y)[0];
      shadow.visible = landing.visible = !!below;
      if (below) {
        shadow.position.set(s.x, below.y + 0.06, s.z);
        landing.position.copy(shadow.position);
        shadow.scale.setScalar(Math.max(0.5, 1 - (s.y - below.y) * 0.05));
        landing.visible = s.standing === null;
      }
      const next = CLOUD_PLATFORMS[s.reached + 1];
      nextRing.visible = !!next && s.visible(next);
      if (next && nextRing.visible) {
        const pose = s.pose(next);
        nextRing.position.set(pose.x, pose.y + 0.08, pose.z);
        nextRing.scale.setScalar(1.23 + Math.sin(s.time * 5) * 0.12);
      }
      const portrait = Math.max(0, 1 - camera.aspect);
      desired.set(s.x, s.y + 9.5 + portrait * 2.8, s.z - 13.5 - portrait * 3.4);
      camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
      cameraTarget.set(s.x, s.y + 1.1, s.z + 4.5);
      camera.lookAt(cameraTarget);
      sun.position.set(s.x - 14, s.y + 28, s.z - 12);
      sun.target.position.set(s.x, s.y, s.z + 5);
      sun.target.updateMatrixWorld();
      portal.rotation.z = Math.sin(s.time * 0.7) * 0.06;
      dust.position.x = Math.sin(s.time * 0.2);
      renderer.render(scene, camera);
    },
    dispose() {
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      scene.traverse((o) => {
        const m = o as T.Mesh;
        if (m.geometry) geometries.add(m.geometry);
        if (m.material)
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((a) =>
            materials.add(a),
          );
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
function createCloudCanvas(target: HTMLElement): CloudView {
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  target.appendChild(canvas);
  let w = 960,
    h = 540;
  const resize = () => {
    w = Math.max(1, target.clientWidth);
    h = Math.max(1, target.clientHeight);
    const ratio = Math.min(devicePixelRatio, 1.5);
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  };
  resize();
  return {
    mode: "2d",
    resize,
    draw(s) {
      const g = ctx!,
        scale = Math.min(w / 23, h / 15),
        project = (x: number, y: number, z: number) => ({
          x: w / 2 - (x - s.x) * scale,
          y: h * 0.65 - (z - s.z) * scale * 0.5 - (y - s.y) * scale,
        });
      g.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(
        0,
        s.reached < 10 ? "#b6cedc" : s.reached < 20 ? "#a2bad3" : "#9195bc",
      );
      sky.addColorStop(1, "#f1d7bb");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#fff3df77";
      for (let i = 0; i < 20; i++) {
        const x = (Math.sin(i * 27) * 0.5 + 0.5) * w,
          y = (i * 73) % h;
        g.beginPath();
        g.ellipse(x, y, 45 + (i % 3) * 20, 14, 0, 0, Math.PI * 2);
        g.fill();
      }
      for (const p of [...CLOUD_PLATFORMS].reverse()) {
        if (p.z < s.z - 10 || p.z > s.z + 50 || !s.visible(p)) continue;
        const v = s.pose(p),
          a = project(v.x - p.w / 2, p.y, p.z - p.d / 2),
          b = project(v.x + p.w / 2, p.y, p.z - p.d / 2),
          c = project(v.x + p.w / 2, p.y, p.z + p.d / 2),
          d = project(v.x - p.w / 2, p.y, p.z + p.d / 2);
        const poly = (points: { x: number; y: number }[], fill: string) => {
          g.fillStyle = fill;
          g.beginPath();
          points.forEach((v, i) =>
            i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y),
          );
          g.closePath();
          g.fill();
        };
        poly([a, b, { x: (a.x + b.x) / 2, y: a.y + scale * 3 }], "#8c8098");
        poly([b, c, { x: (a.x + b.x) / 2, y: a.y + scale * 3 }], "#726e89");
        const top =
          p.id % 10 === 0
            ? "#eed39f"
            : p.kind === "crumble"
              ? "#c2a8b2"
              : p.id < 10
                ? "#9ac4ac"
                : p.id < 20
                  ? "#b0d4df"
                  : "#c4b0db";
        poly([a, b, c, d], top);
        g.strokeStyle = "#fff1ce";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(a.x, a.y);
        [b, c, d, a].forEach((v) => g.lineTo(v.x, v.y));
        g.stroke();
        const center = project(v.x, p.y, p.z);
        if (p.kind === "checkpoint" || p.kind === "goal") {
          g.strokeStyle = "#fff3c2";
          g.lineWidth = 3;
          g.beginPath();
          g.ellipse(
            center.x,
            center.y,
            scale * 1.25,
            scale * 0.4,
            0,
            0,
            Math.PI * 2,
          );
          g.stroke();
        }
        if (p.kind === "goal") {
          g.strokeStyle = "#ffe6a4";
          g.lineWidth = 7;
          g.beginPath();
          g.ellipse(
            center.x,
            center.y - scale * 1.8,
            scale * 1.3,
            scale * 1.7,
            0,
            0,
            Math.PI * 2,
          );
          g.stroke();
        }
        if (!s.crystals.has(p.id)) {
          const cr = project(v.x, p.y + 1.8, p.z);
          poly(
            [
              { x: cr.x, y: cr.y - 9 },
              { x: cr.x + 6, y: cr.y },
              { x: cr.x, y: cr.y + 9 },
              { x: cr.x - 6, y: cr.y },
            ],
            "#ffe5a2",
          );
        }
        if (p.id === s.reached + 1) {
          const pulse = scale * (1.35 + Math.sin(s.time * 5) * 0.12);
          g.strokeStyle = "#f6fff0";
          g.lineWidth = 3;
          g.beginPath();
          g.ellipse(center.x, center.y, pulse, pulse * 0.32, 0, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = "#344153";
          g.font = "bold 13px system-ui";
          g.textAlign = "center";
          g.fillText("NEXT", center.x, center.y - scale * 0.4);
        }
      }
      const below = CLOUD_PLATFORMS.filter(
        (p) =>
          s.visible(p) &&
          p.y <= s.y + 0.05 &&
          Math.abs(s.x - s.pose(p).x) < p.w / 2 &&
          Math.abs(s.z - p.z) < p.d / 2,
      ).sort((a, b) => b.y - a.y)[0];
      if (below && s.standing === null) {
        const mark = project(s.x, below.y, s.z);
        g.strokeStyle = "#fff1c3";
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(mark.x, mark.y, scale * 0.5, scale * 0.2, 0, 0, Math.PI * 2);
        g.stroke();
      }
      const pos = project(s.x, s.y, s.z),
        size = scale * 0.35;
      g.fillStyle = "#3f485644";
      g.beginPath();
      g.ellipse(pos.x, pos.y + 4, size * 1.1, size * 0.35, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#e39b70";
      g.fillRect(pos.x - size, pos.y - size * 2.8, size * 2, size * 2.4);
      g.fillStyle = "#f8e1bb";
      g.fillRect(
        pos.x - size * 0.8,
        pos.y - size * 4.1,
        size * 1.6,
        size * 1.5,
      );
      g.fillStyle = "#477185";
      g.fillRect(
        pos.x - size * 0.65,
        pos.y - size * 3.7,
        size * 1.3,
        size * 0.5,
      );
      g.fillStyle = "#35485e";
      g.fillRect(
        pos.x - size * 0.8,
        pos.y - size * 0.5,
        size * 0.6,
        size * 0.7,
      );
      g.fillRect(
        pos.x + size * 0.2,
        pos.y - size * 0.5,
        size * 0.6,
        size * 0.7,
      );
    },
    dispose() {
      canvas.remove();
    },
  };
}
