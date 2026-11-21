import * as T from "three";
import { createBallSoftwareRenderer } from "./boostball-software";
import { BOOSTBALL_PADS, type BallState } from "@onlinearcade/core";
export type BallCamera = "chase" | "ball" | "stadium";
export type BallView = {
  draw: (state: BallState, dt: number, mode: BallCamera) => void;
  dispose: () => void;
  software: boolean;
};
const BLUE = 0x39c5ff,
  ORANGE = 0xff934f;
const END_WALL_X = 37.25;
const SIDE_WALL_Z = 20;
const scale = (x: number, y: number, height = 0) =>
  new T.Vector3((x - 480) / 12, height / 12, (y - 270) / 12);
/** Procedural original models and textures; no remote assets or per-frame geometry allocation. */
export function createBoostballView(
  target: HTMLElement,
  mine: string,
  indicator: HTMLElement | null,
  onLost: () => void,
): BallView {
  let renderer: T.WebGLRenderer | ReturnType<typeof createBallSoftwareRenderer>;
  let software = false;
  try {
    const gpu = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    gpu.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    gpu.outputColorSpace = T.SRGBColorSpace;
    gpu.toneMapping = T.ACESFilmicToneMapping;
    gpu.toneMappingExposure = 1.18;
    gpu.shadowMap.enabled = target.clientWidth > 600;
    gpu.shadowMap.type = T.PCFSoftShadowMap;
    renderer = gpu;
  } catch {
    software = true;
    renderer = createBallSoftwareRenderer();
  }
  renderer.domElement.setAttribute("aria-label", "Boostball 3D stadium");
  target.appendChild(renderer.domElement);
  const lost = (e: Event) => {
    e.preventDefault();
    onLost();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  const scene = new T.Scene();
  scene.background = new T.Color(0x191b35);
  scene.fog = new T.Fog(0x191b35, 88, 190);
  const camera = new T.PerspectiveCamera(62, 1, 0.1, 240);
  camera.position.set(-43, 15, 16);
  const look = new T.Vector3(0, 1, 0);
  let softwareFrame = 0;
  let firstFrame = true,
    time = 0,
    lastScore = 0,
    lastTouch = 0,
    previousCountdown = 0,
    previousMode: BallCamera = "chase",
    needsDraw = true,
    goalFlash = 0;
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  const standard = (color: number, roughness = 0.55, metalness = 0.15) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(m);
    return m;
  };
  const glow = (color: number, intensity = 1.5) => {
    const m = new T.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.35,
    });
    materials.add(m);
    return m;
  };
  const mesh = (
    geo: T.BufferGeometry,
    mat: T.Material,
    parent: T.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    geometries.add(geo);
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    parent: T.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) => mesh(new T.BoxGeometry(w, h, d), mat, parent, x, y, z);
  const dark = standard(0x111d2b, 0.65, 0.55),
    steel = standard(0x36495b, 0.4, 0.7),
    blue = glow(BLUE),
    orange = glow(ORANGE),
    glass = standard(0x152c40, 0.14, 0.8);
  scene.add(new T.HemisphereLight(0xccd9ff, 0x51745d, 1.85));
  const sun = new T.DirectionalLight(0xffead1, 2.7);
  sun.position.set(-20, 42, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -48,
    right: 48,
    top: 30,
    bottom: -30,
    near: 1,
    far: 100,
  });
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const fill = new T.DirectionalLight(0x7cacff, 1.6);
  fill.position.set(30, 15, -30);
  scene.add(fill);
  // Procedural turf: blades, mowing bands, center circle and regulation-inspired markings.
  const turfCanvas = document.createElement("canvas");
  turfCanvas.width = 2048;
  turfCanvas.height = 1024;
  const ctx = turfCanvas.getContext("2d")!;
  ctx.fillStyle = "#244953";
  ctx.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? "#2b5659" : "#264c52";
    ctx.fillRect(i * 128, 0, 128, 1024);
  }
  let seed = 41;
  for (let i = 0; i < 22000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = (seed >>> 13) % 2048;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const y = (seed >>> 13) % 1024;
    ctx.fillStyle = i % 2 ? "#d0ffca12" : "#071c341b";
    ctx.fillRect(x, y, 1, 3);
  }
  ctx.strokeStyle = "#c0e1da";
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.7;
  ctx.strokeRect(14, 14, 2020, 996);
  ctx.beginPath();
  ctx.moveTo(1024, 14);
  ctx.lineTo(1024, 1010);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(1024, 512, 184, 0, Math.PI * 2);
  ctx.fillStyle = "#1b394d";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d1ede2";
  ctx.beginPath();
  ctx.moveTo(1068, 410);
  ctx.lineTo(949, 534);
  ctx.lineTo(1014, 534);
  ctx.lineTo(983, 623);
  ctx.lineTo(1100, 490);
  ctx.lineTo(1038, 490);
  ctx.closePath();
  ctx.fill();
  for (const right of [false, true]) {
    const x = right ? 1726 : 14;
    ctx.fillStyle = right ? "#f8a3642e" : "#68d8f832";
    ctx.fillRect(x, 282, 308, 460);
    ctx.strokeRect(x, 282, 308, 460);
    ctx.beginPath();
    ctx.arc(right ? 1810 : 238, 512, 75, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const turf = new T.CanvasTexture(turfCanvas);
  turf.colorSpace = T.SRGBColorSpace;
  turf.anisotropy = Math.min(
    8,
    renderer instanceof T.WebGLRenderer
      ? renderer.capabilities.getMaxAnisotropy()
      : 1,
  );
  textures.add(turf);
  const turfMat = new T.MeshStandardMaterial({ map: turf, roughness: 0.95 });
  materials.add(turfMat);
  const pitch = mesh(new T.PlaneGeometry(74.4, 39.4, 16, 8), turfMat, scene);
  pitch.rotation.x = -Math.PI / 2;
  pitch.renderOrder = -10;
  box(86, 1, 52, dark, scene, 0, -0.65, 0).renderOrder = -20;
  // Transparent boards preserve a clear chase camera and show all genuine collision boundaries.
  const boardMat = new T.MeshStandardMaterial({
    color: 0x89b9d0,
    transparent: true,
    opacity: 0.12,
    roughness: 0.25,
    depthWrite: false,
  });
  materials.add(boardMat);
  for (const side of [-1, 1]) {
    const z = side * SIDE_WALL_Z;
    box(75, 14, 0.18, boardMat, scene, 0, 7, z);
    box(75, 0.58, 0.24, dark, scene, 0, 0.28, z);
    box(37.4, 0.1, 0.28, blue, scene, -18.7, 0.59, z);
    box(37.4, 0.1, 0.28, orange, scene, 18.7, 0.59, z);
    box(75, 0.1, 0.14, steel, scene, 0, 3.2, z);
    for (let x = -36; x <= 36; x += 9)
      box(0.13, 3.2, 0.16, steel, scene, x, 1.6, z);
  }
  for (const sign of [-1, 1]) {
    const x = sign * END_WALL_X,
      team = sign > 0 ? orange : blue;
    for (const z of [-12.5, 12.5]) {
      box(0.18, 14, 15, boardMat, scene, x, 7, z);
      box(0.28, 0.65, 15, dark, scene, x, 0.32, z);
      box(0.31, 0.15, 15, team, scene, x, 0.69, z);
    }
    box(0.18, 6.5, 10.5, boardMat, scene, x, 10.75, 0);
    // Recessed net, glowing posts, crossbar and goal sensor apron.
    for (const z of [-5.25, 5.25]) {
      box(0.41, 7.5, 0.38, team, scene, x, 3.75, z);
      box(3.4, 0.17, 0.22, steel, scene, x + sign * 1.6, 7.45, z);
    }
    box(0.28, 0.28, 10.75, team, scene, x, 7.5, 0);
    box(0.2, 0.2, 10.75, steel, scene, x + sign * 3.4, 7.45, 0);
    const net = new T.LineBasicMaterial({
      color: sign > 0 ? 0xe6b697 : 0x87c9e2,
      transparent: true,
      opacity: 0.62,
    });
    materials.add(net);
    const vertices: number[] = [];
    const back = x + sign * 3.4;
    for (let y = 0.2; y <= 7.5; y += 0.48) {
      vertices.push(back, y, -5.25, back, y, 5.25);
      for (const z of [-5.25, 5.25]) vertices.push(x, y, z, back, y, z);
    }
    for (let z = -5.25; z <= 5.25; z += 0.48)
      vertices.push(back, 0, z, back, 7.5, z, x, 7.5, z, back, 7.5, z);
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geometries.add(geo);
    scene.add(new T.LineSegments(geo, net));
    box(
      3.4,
      0.04,
      10.5,
      standard(sign > 0 ? 0x653d2d : 0x1f5168),
      scene,
      x + sign * 1.7,
      0.02,
      0,
    );
    const light = new T.PointLight(sign > 0 ? ORANGE : BLUE, 70, 25, 2);
    light.position.set(x, 5, 0);
    scene.add(light);
  }
  // Tiered grandstands, steel roof ribs, light gantries and a distant city skyline.
  const seats = standard(0x25354b, 0.8),
    concrete = standard(0x303f51, 0.9);
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 5; tier++)
      box(
        88,
        1.2,
        2.8,
        tier % 2 ? dark : concrete,
        scene,
        0,
        1 + tier * 1.55,
        side * (24 + tier * 2.7),
      );
    const crowdGeo = new T.BoxGeometry(0.45, 0.7, 0.5);
    geometries.add(crowdGeo);
    const crowd = new T.InstancedMesh(crowdGeo, seats, 450);
    const matrix = new T.Matrix4(),
      color = new T.Color();
    for (let i = 0; i < 450; i++) {
      const row = Math.floor(i / 90);
      matrix.makeTranslation(
        -43 + (i % 90) * 0.96,
        2 + row * 1.55,
        side * (24 + row * 2.7),
      );
      crowd.setMatrixAt(i, matrix);
      crowd.setColorAt(
        i,
        color.setHex(
          i % 7 === 0 ? 0xffad70 : i % 5 === 0 ? 0x63d6ed : 0x596c86,
        ),
      );
    }
    crowd.instanceMatrix.needsUpdate = true;
    scene.add(crowd);
    for (let x = -42; x <= 42; x += 14) {
      box(0.4, 17, 0.4, steel, scene, x, 8, side * 34);
      const rib = box(0.25, 0.25, 18, steel, scene, x, 16, side * 28);
      rib.rotation.x = side * 0.13;
      box(5.4, 0.4, 1.25, dark, scene, x, 16.2, side * 21);
      box(
        5,
        0.17,
        1,
        glow(side > 0 ? 0xffdfa3 : 0xc6e8ff, 2.1),
        scene,
        x,
        15.95,
        side * 21,
      );
    }
    box(
      88,
      0.14,
      0.2,
      glow(side < 0 ? BLUE : ORANGE, 0.7),
      scene,
      0,
      9,
      side * 35,
    );
  }
  for (let i = 0; i < 28; i++) {
    const x = -95 + i * 7.1,
      h = 7 + ((i * 13) % 17);
    box(
      4,
      h,
      5,
      standard(i % 2 ? 0x18243b : 0x111b2f),
      scene,
      x,
      h / 2,
      -70 - (i % 3) * 5,
    );
    for (let floor = 3; floor < h; floor += 3)
      box(
        3,
        0.13,
        0.05,
        glow(i % 2 ? 0xf5b27c : 0x75a5e7, 0.5),
        scene,
        x,
        floor,
        -67.45 - (i % 3) * 5,
      );
  }
  const moon = mesh(
    new T.SphereGeometry(5, 24, 16),
    glow(0xa7b4d3, 0.6),
    scene,
    -65,
    53,
    -95,
  );
  moon.castShadow = false;
  // Branded rink boards and paired live score displays above the goals.
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 1024;
  signCanvas.height = 128;
  const sc = signCanvas.getContext("2d")!;
  const ribbon = sc.createLinearGradient(0, 0, 1024, 100);
  ribbon.addColorStop(0, "#28526a");
  ribbon.addColorStop(0.54, "#17283e");
  ribbon.addColorStop(1, "#744855");
  sc.fillStyle = ribbon;
  sc.fillRect(0, 0, 1024, 128);
  sc.fillStyle = "#e1c9a8";
  sc.fillRect(0, 0, 1024, 4);
  sc.fillRect(0, 124, 1024, 4);
  sc.fillStyle = "#edebd7";
  sc.font = "900 58px sans-serif";
  sc.textAlign = "center";
  sc.fillText("B O O S T B A L L", 512, 84);
  const signTexture = new T.CanvasTexture(signCanvas);
  signTexture.colorSpace = T.SRGBColorSpace;
  textures.add(signTexture);
  const signMat = new T.MeshBasicMaterial({
    map: signTexture,
    side: T.DoubleSide,
  });
  materials.add(signMat);
  for (const z of [-22, 22]) {
    const sign = mesh(new T.PlaneGeometry(45, 3.6), signMat, scene, 0, 3.36, z);
    sign.castShadow = false;
    if (z > 0) sign.rotation.y = Math.PI;
  }
  const scoreCanvas = document.createElement("canvas");
  scoreCanvas.width = 640;
  scoreCanvas.height = 160;
  const scoreCtx = scoreCanvas.getContext("2d")!;
  const scoreTexture = new T.CanvasTexture(scoreCanvas);
  scoreTexture.colorSpace = T.SRGBColorSpace;
  textures.add(scoreTexture);
  const scoreMat = new T.MeshBasicMaterial({ map: scoreTexture });
  materials.add(scoreMat);
  let boardText = "";
  const paintScore = (state: BallState) => {
    const value = `${state.score[0]}:${state.score[1]}:${!!state.overtime}`;
    if (value === boardText) return;
    boardText = value;
    scoreCtx.fillStyle = "#182539";
    scoreCtx.fillRect(0, 0, 640, 160);
    scoreCtx.fillStyle = "#285975";
    scoreCtx.fillRect(5, 5, 145, 150);
    scoreCtx.fillStyle = "#834b45";
    scoreCtx.fillRect(490, 5, 145, 150);
    scoreCtx.fillStyle = "#fff1ce";
    scoreCtx.font = "900 88px sans-serif";
    scoreCtx.textAlign = "center";
    scoreCtx.fillText(String(state.score[0]), 78, 115);
    scoreCtx.fillText(String(state.score[1]), 562, 115);
    scoreCtx.font = "900 35px sans-serif";
    scoreCtx.fillText(state.overtime ? "OVERTIME" : "BOOSTBALL", 320, 96);
    scoreTexture.needsUpdate = true;
  };
  for (const side of [-1, 1]) {
    const team = side > 0 ? orange : blue;
    const x = side * 43;
    box(0.66, 4.2, 16.7, dark, scene, x, 11.4, 0);
    box(0.9, 0.13, 16.9, team, scene, x, 13.5, 0);
    box(0.9, 0.13, 16.9, team, scene, x, 9.3, 0);
    for (const z of [-12, 12]) {
      box(0.5, 15, 0.7, steel, scene, x, 7.5, z);
      box(0.22, 10, 0.44, team, scene, x - side * 0.45, 6.6, z);
    }
    const panel = mesh(
      new T.PlaneGeometry(16, 4),
      scoreMat,
      scene,
      x - side * 0.36,
      11.4,
      0,
    );
    panel.rotation.y = (side * -Math.PI) / 2;
    panel.castShadow = false;
  }
  const padReady = glow(0xffda80, 1.45);
  const padSpent = standard(0x667767, 0.42, 0.7);
  const padRing = new T.TorusGeometry(1.3, 0.075, 6, 24);
  const padCore = new T.OctahedronGeometry(0.4);
  const padBase = new T.CylinderGeometry(1.1, 1.23, 0.11, 12);
  const pads = BOOSTBALL_PADS.map((point) => {
    const p = scale(point.x, point.y);
    const base = mesh(padBase, dark, scene, p.x, 0.05, p.z);
    const ring = mesh(padRing, padReady, scene, p.x, 0.11, p.z);
    ring.rotation.x = Math.PI / 2;
    const token = mesh(padCore, padReady, scene, p.x, 0.73, p.z);
    base.castShadow = ring.castShadow = token.castShadow = false;
    return { base, ring, token };
  });
  const ballGroup = new T.Group();
  scene.add(ballGroup);
  const ballGeo = new T.IcosahedronGeometry(1.416, 2),
    ballMaterial = standard(0xffffff, 0.36, 0.18);
  const vertices = ballGeo.getAttribute("position");
  const panels = new T.IcosahedronGeometry(1, 0);
  const tips = panels.getAttribute("position");
  const directions = Array.from({ length: tips.count }, (_, index) =>
    new T.Vector3().fromBufferAttribute(tips, index),
  );
  panels.dispose();
  const centroid = new T.Vector3(),
    corner = new T.Vector3();
  const ballColors = new Float32Array(vertices.count * 3);
  const panelColors = [
    new T.Color(0x162943),
    new T.Color(0xf3ebd4),
    new T.Color(0x97dce9),
  ];
  for (let i = 0; i < vertices.count; i += 3) {
    centroid
      .fromBufferAttribute(vertices, i)
      .add(corner.fromBufferAttribute(vertices, i + 1))
      .add(corner.fromBufferAttribute(vertices, i + 2))
      .normalize();
    const dot = Math.max(
      ...directions.map((direction) => centroid.dot(direction)),
    );
    const color = panelColors[dot > 0.978 ? 0 : dot > 0.944 ? 2 : 1];
    for (let j = i; j < i + 3; j++) color.toArray(ballColors, j * 3);
  }
  ballGeo.setAttribute("color", new T.BufferAttribute(ballColors, 3));
  ballMaterial.vertexColors = true;
  mesh(ballGeo, ballMaterial, ballGroup);
  const ballShadowMat = new T.MeshBasicMaterial({
    color: 0x000d15,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  materials.add(ballShadowMat);
  const ballShadow = mesh(
    new T.CircleGeometry(1.5, 24),
    ballShadowMat,
    scene,
    0,
    0.025,
    0,
  );
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.castShadow = false;
  const marker = mesh(
    new T.TorusGeometry(1.8, 0.055, 6, 36),
    glow(0xf6edbf, 0.9),
    scene,
    0,
    0.04,
    0,
  );
  marker.rotation.x = Math.PI / 2;
  const carShadowGeo = new T.CircleGeometry(1.56, 20);
  const nose = glow(0xffeed0, 1.5);
  const brakeLights = glow(0xff5863, 1.3);
  const rubber = standard(0x111724, 0.92);
  const rim = standard(0xb7c6ce, 0.24, 0.7);
  type CarModel = {
    root: T.Group;
    body: T.Group;
    wheels: T.Group[];
    flames: T.Mesh[];
    tag: T.Sprite;
    ring: T.Mesh;
    shadow: T.Mesh;
    pose: T.Vector3;
    angle: number;
    lastDodge: number;
    flip: number;
    lastFuel: number;
  };
  const cars = new Map<string, CarModel>();
  const roundedBody = (w: number, d: number, h: number) => {
    const shape = new T.Shape();
    shape.moveTo(-w / 2 + 0.2, -d / 2);
    shape.lineTo(w / 2 - 0.2, -d / 2);
    shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + 0.2);
    shape.lineTo(w / 2, d / 2 - 0.2);
    shape.quadraticCurveTo(w / 2, d / 2, w / 2 - 0.2, d / 2);
    shape.lineTo(-w / 2 + 0.2, d / 2);
    shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - 0.2);
    shape.lineTo(-w / 2, -d / 2 + 0.2);
    shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + 0.2, -d / 2);
    const geo = new T.ExtrudeGeometry(shape, {
      depth: h,
      steps: 1,
      bevelEnabled: true,
      bevelSize: 0.09,
      bevelThickness: 0.08,
      bevelSegments: 2,
      curveSegments: 3,
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
  };
  const makeCar = (id: string, name: string, team: number) => {
    const root = new T.Group(),
      body = new T.Group();
    root.add(body);
    scene.add(root);
    const paint = standard(team ? 0xfa8f62 : 0x449fe2, 0.26, 0.38),
      accent = standard(team ? 0xf8c488 : 0xb2e6ef, 0.32, 0.25),
      trim = team ? orange : blue;
    mesh(roundedBody(3.55, 1.94, 0.48), paint, body, 0, 0.43, 0);
    box(3.4, 0.22, 2.02, dark, body, 0, 0.42, 0);
    const cabin = mesh(
      roundedBody(1.55, 1.43, 0.55),
      glass,
      body,
      -0.26,
      0.9,
      0,
    );
    cabin.rotation.z = -0.1;
    box(1.15, 0.12, 1.3, paint, body, -0.41, 1.5, 0);
    box(3.28, 0.068, 0.35, accent, body, 0, 0.927, 0);
    box(1.05, 0.075, 0.35, accent, body, -0.41, 1.6, 0);
    box(0.31, 0.27, 1.95, dark, body, 1.65, 0.46, 0);
    box(0.18, 0.12, 0.82, steel, body, 1.83, 0.51, 0);
    for (const z of [-0.65, 0.65]) {
      box(0.12, 0.13, 0.48, nose, body, 1.77, 0.777, z);
      box(0.12, 0.11, 0.48, brakeLights, body, -1.79, 0.74, z);
      box(0.1, 0.6, 0.1, dark, body, -1.35, 1.35, z);
    }
    box(0.44, 0.11, 2.15, accent, body, -1.42, 1.67, 0);
    for (const side of [-1, 1]) {
      box(2.46, 0.09, 0.13, trim, body, 0, 0.52, side * 0.98);
      const panel = box(1.2, 0.19, 0.07, accent, body, -0.42, 0.77, side);
      panel.rotation.z = -0.18;
    }
    const wheels: T.Group[] = [];
    for (const x of [-1.05, 1.05])
      for (const z of [-1, 1]) {
        const pivot = new T.Group();
        pivot.position.set(x, 0.47, z);
        body.add(pivot);
        const wheel = mesh(
          new T.CylinderGeometry(0.46, 0.46, 0.34, 14),
          rubber,
          pivot,
        );
        wheel.rotation.x = Math.PI / 2;
        const hub = mesh(
          new T.CylinderGeometry(0.27, 0.27, 0.36, 8),
          rim,
          pivot,
        );
        hub.rotation.x = Math.PI / 2;
        const inner = mesh(
          new T.CylinderGeometry(0.11, 0.11, 0.38, 6),
          trim,
          pivot,
        );
        inner.rotation.x = Math.PI / 2;
        wheels.push(pivot);
      }
    const flames: T.Mesh[] = [];
    for (const z of [-0.45, 0.45]) {
      const nozzle = mesh(
        new T.CylinderGeometry(0.18, 0.2, 0.35, 10),
        steel,
        body,
        -1.85,
        0.75,
        z,
      );
      nozzle.rotation.z = Math.PI / 2;
      const flame = mesh(
        new T.ConeGeometry(0.21, 1, 10),
        glow(team ? 0xffd084 : 0x9feaff, 2.4),
        body,
        -2.3,
        0.75,
        z,
      );
      flame.rotation.z = Math.PI / 2;
      flames.push(flame);
    }
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 80;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#0a1426d9";
    c.beginPath();
    c.roundRect(18, 5, 476, 70, 28);
    c.fill();
    c.fillStyle = team ? "#ffc99b" : "#98e4ff";
    c.font = "bold 35px sans-serif";
    c.textAlign = "center";
    c.fillText(id === mine ? "YOU" : name.slice(0, 24), 256, 52, 428);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    textures.add(texture);
    const tagMat = new T.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    materials.add(tagMat);
    const tag = new T.Sprite(tagMat);
    tag.scale.set(4.15, 0.65, 1);
    root.add(tag);
    tag.position.y = 3.2;
    const ring = mesh(
      new T.TorusGeometry(2.1, 0.045, 5, 40),
      glow(id === mine ? 0xffefbc : team ? ORANGE : BLUE, 0.7),
      scene,
    );
    ring.rotation.x = Math.PI / 2;
    ring.visible = id === mine;
    ring.castShadow = false;
    const shadow = mesh(carShadowGeo, ballShadowMat, scene);
    shadow.rotation.x = -Math.PI / 2;
    shadow.castShadow = false;
    const car = {
      root,
      body,
      wheels,
      flames,
      tag,
      ring,
      shadow,
      pose: new T.Vector3(),
      angle: 0,
      lastDodge: 0,
      flip: 0,
      lastFuel: 100,
    };
    cars.set(id, car);
    return car;
  };
  // Fixed-size exhaust/goal particle pool: bounded memory and draw calls.
  const particleGeo = new T.BufferGeometry(),
    positions = new Float32Array(180 * 3),
    colors = new Float32Array(180 * 3),
    life = new Float32Array(180),
    velocity = new Float32Array(180 * 3);
  geometries.add(particleGeo);
  particleGeo.setAttribute("position", new T.BufferAttribute(positions, 3));
  particleGeo.setAttribute("color", new T.BufferAttribute(colors, 3));
  const particleMat = new T.PointsMaterial({
    size: 0.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  materials.add(particleMat);
  const particles = new T.Points(particleGeo, particleMat);
  particles.frustumCulled = false;
  scene.add(particles);
  let cursor = 0;
  const effectColor = new T.Color();
  const emit = (p: T.Vector3, color: number, count: number, power: number) => {
    effectColor.setHex(color);
    for (let j = 0; j < count; j++) {
      const i = cursor++ % life.length;
      life[i] = 1;
      const offset = i * 3;
      p.toArray(positions, offset);
      effectColor.toArray(colors, offset);
      velocity[offset] = (Math.random() - 0.5) * power;
      velocity[offset + 1] = Math.random() * power * 0.6;
      velocity[offset + 2] = (Math.random() - 0.5) * power;
    }
  };
  const shockMat = new T.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: T.DoubleSide,
  });
  materials.add(shockMat);
  const shock = mesh(new T.RingGeometry(0.82, 1, 40), shockMat, scene);
  shock.rotation.y = Math.PI / 2;
  shock.castShadow = false;
  const resize = () => {
    const w = Math.max(1, target.clientWidth),
      h = Math.max(1, target.clientHeight);
    if (renderer instanceof T.WebGLRenderer) renderer.setSize(w, h, false);
    else renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needsDraw = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(target);
  resize();
  const ballScreen = new T.Vector3();
  const ballPose = new T.Vector3(),
    desired = new T.Vector3(),
    aim = new T.Vector3(),
    ballTarget = new T.Vector3(),
    carTarget = new T.Vector3(),
    effectAt = new T.Vector3(),
    rollAxis = new T.Vector3();
  return {
    software,
    draw(state, dt, mode) {
      dt = Math.min(0.05, Math.max(0, dt));
      const changedCamera = mode !== previousMode;
      if (dt === 0 && !changedCamera && !needsDraw) return;
      const newKickoff =
        firstFrame || (state.countdown > 0 && previousCountdown === 0);
      const overheadChanged =
        changedCamera && (previousMode === "stadium" || mode === "stadium");
      previousMode = mode;
      previousCountdown = state.countdown;
      time += dt;
      const blend = 1 - Math.exp(-dt * 18);
      ballTarget.set(
        (state.ball.x - 480) / 12,
        (state.ball.height ?? 17) / 12,
        (state.ball.y - 270) / 12,
      );
      if (newKickoff) ballPose.copy(ballTarget);
      else ballPose.lerp(ballTarget, blend);
      ballGroup.position.copy(ballPose);
      rollAxis.set(state.ball.vy, 0, -state.ball.vx);
      const ballSpeed = rollAxis.length();
      if (ballSpeed > 0.1) {
        rollAxis.divideScalar(ballSpeed);
        ballGroup.rotateOnWorldAxis(
          rollAxis,
          (ballSpeed * dt) / (ballPose.y < 1.5 ? 17 : 34),
        );
      }
      ballShadow.position.set(ballPose.x, 0.035, ballPose.z);
      ballShadow.scale.setScalar(1 + (ballPose.y - 1.4) * 0.08);
      ballShadowMat.opacity = Math.max(0.09, 0.35 - ballPose.y * 0.012);
      marker.position.set(ballPose.x, 0.045, ballPose.z);
      marker.scale.setScalar(1 + Math.max(0, ballPose.y - 1.5) * 0.025);
      for (const c of state.cars) {
        const model = cars.get(c.id) ?? makeCar(c.id, c.name, c.team);
        model.root.visible = c.active;
        model.ring.visible = c.active && c.id === mine;
        model.shadow.visible = c.active;
        if (!c.active) continue;
        carTarget.set((c.x - 480) / 12, (c.height ?? 0) / 12, (c.y - 270) / 12);
        if (newKickoff) model.pose.copy(carTarget);
        else model.pose.lerp(carTarget, blend);
        const turn = Math.atan2(
          Math.sin(c.angle - model.angle),
          Math.cos(c.angle - model.angle),
        );
        if (newKickoff) model.angle = c.angle;
        else model.angle += turn * blend;
        model.root.position.copy(model.pose);
        model.body.rotation.y = -model.angle;
        const speed = Math.hypot(c.vx, c.vy);
        const sideways = c.vy * Math.cos(c.angle) - c.vx * Math.sin(c.angle);
        model.body.rotation.x = T.MathUtils.clamp(
          sideways / (c.drifting ? 1100 : 2000),
          -0.2,
          0.2,
        );
        model.body.rotation.z =
          c.height > 0
            ? Math.max(-0.25, Math.min(0.25, -c.vz / 800))
            : Math.sin(time * 11) * Math.min(0.015, speed / 20000);
        if (!newKickoff && c.cooldown > model.lastDodge + 0.7) model.flip = 1;
        if (newKickoff) model.flip = 0;
        model.lastDodge = c.cooldown;
        if (model.flip > 0) {
          model.flip = Math.max(0, model.flip - dt * 3);
          const roll =
            c.height > 2
              ? (1 - model.flip) * Math.PI * 2
              : Math.sin(model.flip * Math.PI) * 0.15;
          if (Math.abs(c.dodgeSide ?? 0) > 0.1)
            model.body.rotation.x += roll * Math.sign(c.dodgeSide ?? 0);
          else model.body.rotation.z -= roll;
        }
        for (const wheel of model.wheels) {
          wheel.rotation.z -= (speed * dt) / 5.5;
          if (wheel.position.x > 0)
            wheel.rotation.y = T.MathUtils.clamp(turn * -1.2, -0.48, 0.48);
        }
        const boosting = c.boosting ?? (speed > 300 && c.fuel > 0);
        for (const flame of model.flames) {
          flame.visible = boosting;
          flame.scale.y = 0.85 + speed / 280 + Math.sin(time * 48) * 0.23;
        }
        if (dt && (boosting || (c.drifting && Math.abs(sideways) > 45))) {
          effectAt.set(
            model.pose.x - Math.cos(c.angle) * 2.15,
            model.pose.y + (boosting ? 0.75 : 0.2),
            model.pose.z - Math.sin(c.angle) * 2.15,
          );
          emit(
            effectAt,
            boosting ? (c.team ? ORANGE : BLUE) : 0xd7b6a3,
            1,
            boosting ? 4 : 2,
          );
        }
        if (!newKickoff && c.fuel - model.lastFuel > 19)
          emit(model.pose, 0xffdc8a, 11, 7);
        model.lastFuel = c.fuel;
        model.ring.position.set(model.pose.x, 0.066, model.pose.z);
        model.shadow.position.set(model.pose.x, 0.044, model.pose.z);
        model.shadow.scale.set(
          1.14 + model.pose.y * 0.026,
          0.86 + model.pose.y * 0.026,
          1,
        );
        model.shadow.rotation.z = -model.angle;
        model.tag.position.y = 2.7;
      }
      const touch = state.lastTouch;
      if (touch && touch.tick > lastTouch) {
        lastTouch = touch.tick;
        if (state.tick - touch.tick < 20) {
          const hitAt = scale(touch.x, touch.y, touch.height);
          emit(
            hitAt,
            0xffedbb,
            Math.min(28, 5 + Math.floor(touch.speed / 18)),
            10,
          );
        }
      }
      const total = state.score[0] + state.score[1];
      if (total > lastScore) {
        lastScore = total;
        goalFlash = 1;
        const team =
          state.lastGoal?.team ?? Number(!state.goal.startsWith("BLUE"));
        const winning = team ? ORANGE : BLUE;
        shock.position.copy(
          state.lastGoal
            ? scale(state.lastGoal.x, state.lastGoal.y, state.lastGoal.height)
            : effectAt.set(team ? -37 : 37, 3, 0),
        );
        shock.position.x = team ? -36.6 : 36.6;
        shockMat.color.setHex(winning);
        emit(shock.position, winning, 120, 29);
      }
      paintScore(state);
      goalFlash = Math.max(0, goalFlash - dt * 0.87);
      sun.intensity = 2.7 + goalFlash * 1.25;
      shock.visible = goalFlash > 0;
      shock.scale.setScalar(0.4 + (1 - goalFlash) * 7.5);
      shockMat.opacity = goalFlash * 0.72;
      for (let i = 0; i < life.length; i++) {
        if (life[i] <= 0) {
          positions[i * 3 + 1] = -20;
          continue;
        }
        life[i] -= dt;
        for (let k = 0; k < 3; k++)
          positions[i * 3 + k] += velocity[i * 3 + k] * dt;
        velocity[i * 3 + 1] -= 9 * dt;
        colors[i * 3] *= 0.99;
        colors[i * 3 + 1] *= 0.99;
        colors[i * 3 + 2] *= 0.99;
      }
      particleGeo.attributes.position.needsUpdate = true;
      particleGeo.attributes.color.needsUpdate = true;
      pads.forEach(({ base, ring, token }, i) => {
        const cooldown = state.pads?.[i];
        const present = cooldown !== undefined;
        const ready = present && cooldown <= 0;
        base.visible = ring.visible = present;
        token.visible = ready;
        ring.material = ready ? padReady : padSpent;
        token.rotation.y = time * 2.5 + i;
        token.position.y = 0.77 + Math.sin(time * 4 + i) * 0.19;
      });
      const player =
        state.cars.find((c) => c.id === mine && c.active) ??
        state.cars.find((c) => c.active);
      const model = player ? cars.get(player.id) : undefined;
      if (mode === "stadium" || !player || !model) {
        if (camera.aspect < 1) desired.set(-59, 80, 0);
        else desired.set(0, 58, 50);
        aim.set(0, 0, 0);
        camera.fov = camera.aspect < 1 ? 69 : 58;
      } else {
        const p = model.pose;
        let dx = Math.cos(model.angle),
          dz = Math.sin(model.angle);
        if (mode === "ball") {
          const distance = Math.hypot(ballPose.x - p.x, ballPose.z - p.z);
          if (distance > 2) {
            dx = (ballPose.x - p.x) / distance;
            dz = (ballPose.z - p.z) / distance;
          }
          aim.copy(p).lerp(ballPose, 0.65);
          aim.y = Math.max(1, aim.y);
        } else aim.set(p.x + dx * 9, Math.max(1.4, p.y + 1.4), p.z + dz * 9);
        const speed = Math.hypot(player.vx, player.vy);
        const portrait = camera.aspect < 0.9;
        const distance =
          (mode === "ball" ? 13.6 : 11.8) + speed / 160 + (portrait ? 2.5 : 0);
        desired.set(
          p.x - dx * distance,
          Math.max(7.6, p.y + 6.9) + speed / 250 + (portrait ? 1.9 : 0),
          p.z - dz * distance,
        );
        // Keep the follow camera inside the walls for a clear view near goals.
        desired.x = T.MathUtils.clamp(
          desired.x,
          1 - END_WALL_X,
          END_WALL_X - 1,
        );
        desired.z = T.MathUtils.clamp(
          desired.z,
          1 - SIDE_WALL_Z,
          SIDE_WALL_Z - 1,
        );
        const followDistance = Math.hypot(desired.x - p.x, desired.z - p.z);
        const wall = Math.max(0, 1 - followDistance / distance);
        aim.lerp(p, wall * 0.72);
        desired.y += wall * 3.8;
        camera.fov =
          60 + Math.min(9, speed / 65) + Math.max(0, 1.05 - camera.aspect) * 20;
      }
      if (newKickoff || overheadChanged || dt === 0) {
        camera.position.copy(desired);
        look.copy(aim);
      } else {
        camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
        look.lerp(aim, 1 - Math.exp(-dt * 9));
      }
      camera.lookAt(look);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      if (indicator) {
        ballScreen.copy(ballPose).project(camera);
        const behind = ballScreen.z > 1;
        const visible =
          !behind &&
          ballScreen.z >= -1 &&
          Math.abs(ballScreen.x) < 0.88 &&
          Math.abs(ballScreen.y) < 0.87;
        indicator.hidden =
          visible ||
          mode === "stadium" ||
          state.complete ||
          state.countdown > 0;
        if (!indicator.hidden) {
          const x = behind ? -ballScreen.x : ballScreen.x;
          const y = behind ? -ballScreen.y : ballScreen.y;
          indicator.style.left = `${Math.max(8, Math.min(92, 50 + x * 42))}%`;
          indicator.style.top = `${Math.max(16, Math.min(80, 50 - y * 38))}%`;
          indicator.style.setProperty(
            "--ball-direction",
            `${Math.atan2(-y, x)}rad`,
          );
        }
      }
      softwareFrame += dt;
      if (!software || softwareFrame >= 1 / 24 || needsDraw || changedCamera) {
        renderer.render(scene, camera);
        softwareFrame = 0;
        needsDraw = false;
      }
      firstFrame = false;
    },
    dispose() {
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
