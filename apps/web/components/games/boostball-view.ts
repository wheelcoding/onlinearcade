import * as T from "three";
import { createBallSoftwareRenderer } from "./boostball-software";
import type { BallState } from "@onlinearcade/core";
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
  scene.background = new T.Color(0x09111e);
  scene.fog = new T.Fog(0x09111e, 80, 180);
  const camera = new T.PerspectiveCamera(62, 1, 0.1, 240);
  camera.position.set(-43, 15, 16);
  const look = new T.Vector3(0, 1, 0);
  let softwareFrame = 0;
  let firstFrame = true,
    time = 0,
    lastScore = 0,
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
    white = standard(0xd5f3ea, 0.6),
    blue = glow(BLUE),
    orange = glow(ORANGE),
    glass = standard(0x152c40, 0.14, 0.8);
  scene.add(new T.HemisphereLight(0xc0e6ff, 0x283024, 2));
  const sun = new T.DirectionalLight(0xffebd8, 3.2);
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
  ctx.fillStyle = "#183f3d";
  ctx.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? "#214c46" : "#1b443f";
    ctx.fillRect(i * 128, 0, 128, 1024);
  }
  let seed = 41;
  for (let i = 0; i < 22000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = seed % 2048;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const y = seed % 1024;
    ctx.fillStyle = i % 2 ? "#c8e3a90b" : "#051c220f";
    ctx.fillRect(x, y, 1, 3);
  }
  ctx.strokeStyle = "#b6ded1";
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.7;
  ctx.strokeRect(14, 14, 2020, 996);
  ctx.beginPath();
  ctx.moveTo(1024, 14);
  ctx.lineTo(1024, 1010);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(1024, 512, 184, 184, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const right of [false, true]) {
    const x = right ? 1726 : 14;
    ctx.strokeRect(x, 282, 308, 460);
    ctx.beginPath();
    ctx.arc(right ? 1810 : 238, 512, 75, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#d5f0dd";
  ctx.beginPath();
  ctx.arc(1024, 512, 7, 0, Math.PI * 2);
  ctx.fill();
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
  for (const z of [-SIDE_WALL_Z, SIDE_WALL_Z]) {
    box(75, 14, 0.18, boardMat, scene, 0, 7, z);
    box(75, 0.12, 0.18, glow(0x65a3be, 0.8), scene, 0, 0.12, z);
    box(75, 0.1, 0.14, steel, scene, 0, 2.6, z);
  }
  for (const sign of [-1, 1]) {
    const x = sign * END_WALL_X,
      team = sign > 0 ? orange : blue;
    for (const z of [-12.5, 12.5]) {
      box(0.18, 14, 15, boardMat, scene, x, 7, z);
      box(0.16, 0.16, 15, team, scene, x, 0.13, z);
    }
    box(0.18, 6.5, 10.5, boardMat, scene, x, 10.75, 0);
    // Recessed net, glowing posts, crossbar and goal sensor apron.
    for (const z of [-5.25, 5.25]) {
      box(0.28, 7.5, 0.28, team, scene, x, 3.75, z);
      box(3.4, 0.2, 0.2, steel, scene, x + sign * 1.6, 7.45, z);
    }
    box(0.28, 0.28, 10.75, team, scene, x, 7.5, 0);
    box(0.2, 0.2, 10.75, steel, scene, x + sign * 3.4, 7.45, 0);
    const net = new T.LineBasicMaterial({
      color: sign > 0 ? 0xe6b697 : 0x87c9e2,
      transparent: true,
      opacity: 0.32,
    });
    materials.add(net);
    const vertices: number[] = [];
    const back = x + sign * 3.4;
    for (let y = 0.2; y <= 7.5; y += 0.55) {
      vertices.push(back, y, -5.25, back, y, 5.25);
      for (const z of [-5.25, 5.25]) vertices.push(x, y, z, back, y, z);
    }
    for (let z = -5.25; z <= 5.25; z += 0.55)
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
      box(5, 0.22, 1, glow(0xe4f1ff, 2.5), scene, x, 16, side * 21);
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
  // Illuminated perimeter screens: original stadium identity, no outside branding.
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 1024;
  signCanvas.height = 128;
  const sc = signCanvas.getContext("2d")!;
  sc.fillStyle = "#0c1b2c";
  sc.fillRect(0, 0, 1024, 128);
  sc.fillStyle = "#c7f2ed";
  sc.font = "bold 50px sans-serif";
  sc.textAlign = "center";
  sc.fillText("B O O S T B A L L   /   NIGHT LEAGUE", 512, 82);
  const signTexture = new T.CanvasTexture(signCanvas);
  signTexture.colorSpace = T.SRGBColorSpace;
  textures.add(signTexture);
  const signMat = new T.MeshBasicMaterial({
    map: signTexture,
    side: T.DoubleSide,
  });
  materials.add(signMat);
  for (const z of [-22, 22]) {
    const sign = mesh(new T.PlaneGeometry(35, 4.4), signMat, scene, 0, 3, z);
    if (z > 0) sign.rotation.y = Math.PI;
  }
  // Boost recharge indicators, animated rings with no false pickup mechanics.
  const pads: T.Mesh[] = [];
  for (const x of [-25, 0, 25])
    for (const z of [-14, 14]) {
      const ring = mesh(
        new T.TorusGeometry(0.8, 0.07, 6, 24),
        glow(0xf7c566, 1.2),
        scene,
        x,
        0.08,
        z,
      );
      ring.rotation.x = Math.PI / 2;
      pads.push(ring);
    }
  const ballGroup = new T.Group();
  scene.add(ballGroup);
  const ballGeo = new T.IcosahedronGeometry(1.416, 2),
    ballMaterial = standard(0xf1f6de, 0.27, 0.35);
  mesh(ballGeo, ballMaterial, ballGroup);
  const seams = mesh(
    new T.IcosahedronGeometry(1.43, 0),
    new T.MeshBasicMaterial({ color: 0x143b50, wireframe: true }),
    ballGroup,
  );
  materials.add(seams.material as T.Material);
  const core = mesh(
    new T.SphereGeometry(0.5, 12, 8),
    glow(0x8df2ff, 1.5),
    ballGroup,
  );
  core.visible = false;
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
  type CarModel = {
    root: T.Group;
    body: T.Group;
    wheels: T.Group[];
    flames: T.Mesh[];
    tag: T.Sprite;
    ring: T.Mesh;
    pose: T.Vector3;
    angle: number;
    lastDodge: number;
    flip: number;
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
    const paint = standard(team ? ORANGE : BLUE, 0.28, 0.55),
      trim = glow(team ? ORANGE : BLUE, 1.1),
      tire = standard(0x080d14, 0.92),
      rim = standard(0x9cabb8, 0.3, 0.85);
    mesh(roundedBody(3.5, 1.8, 0.55), paint, body, 0, 0.5, 0);
    box(3.25, 0.2, 1.85, dark, body, 0, 0.45, 0);
    const cabin = box(1.55, 0.65, 1.47, glass, body, -0.25, 1.35, 0);
    cabin.rotation.z = -0.06;
    box(1.7, 0.12, 1.5, paint, body, -0.3, 1.75, 0);
    box(1.4, 0.08, 0.18, white, body, 0.9, 1.12, 0);
    for (const z of [-0.65, 0.65]) {
      box(0.12, 0.1, 0.42, glow(0xf6f8cf, 2), body, 1.77, 0.9, z);
      box(0.12, 0.12, 0.4, glow(0xff3e58, 1.3), body, -1.77, 0.87, z);
      box(0.1, 0.6, 0.1, dark, body, -1.35, 1.35, z);
    }
    box(0.38, 0.12, 2.05, paint, body, -1.4, 1.7, 0);
    box(2.4, 0.035, 0.11, trim, body, 0, 0.52, 0.94);
    box(2.4, 0.035, 0.11, trim, body, 0, 0.52, -0.94);
    const wheels: T.Group[] = [];
    for (const x of [-1.05, 1.05])
      for (const z of [-1, 1]) {
        const pivot = new T.Group();
        pivot.position.set(x, 0.47, z);
        body.add(pivot);
        const wheel = mesh(
          new T.CylinderGeometry(0.43, 0.43, 0.3, 14),
          tire,
          pivot,
        );
        wheel.rotation.x = Math.PI / 2;
        const hub = mesh(
          new T.CylinderGeometry(0.23, 0.23, 0.32, 8),
          rim,
          pivot,
        );
        hub.rotation.x = Math.PI / 2;
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
    c.fillStyle = "#071220cc";
    c.fillRect(0, 0, 512, 80);
    c.fillStyle = team ? "#ffc99b" : "#98e4ff";
    c.font = "bold 28px sans-serif";
    c.textAlign = "center";
    c.fillText(name.slice(0, 24) + (id === mine ? " · YOU" : ""), 256, 51);
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
    tag.scale.set(5.8, 0.9, 1);
    root.add(tag);
    tag.position.y = 3.2;
    const ring = mesh(
      new T.TorusGeometry(2.1, 0.045, 5, 40),
      glow(id === mine ? 0xffefbc : team ? ORANGE : BLUE, 0.7),
      scene,
    );
    ring.rotation.x = Math.PI / 2;
    ring.visible = id === mine;
    const car = {
      root,
      body,
      wheels,
      flames,
      tag,
      ring,
      pose: new T.Vector3(),
      angle: 0,
      lastDodge: 0,
      flip: 0,
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
  scene.add(particles);
  let cursor = 0;
  const emit = (p: T.Vector3, color: number, count: number, power: number) => {
    const c = new T.Color(color);
    for (let j = 0; j < count; j++) {
      const i = cursor++ % life.length;
      life[i] = 1;
      positions.set([p.x, p.y, p.z], i * 3);
      colors.set([c.r, c.g, c.b], i * 3);
      velocity.set(
        [
          (Math.random() - 0.5) * power,
          Math.random() * power * 0.6,
          (Math.random() - 0.5) * power,
        ],
        i * 3,
      );
    }
  };
  const resize = () => {
    const w = Math.max(1, target.clientWidth),
      h = Math.max(1, target.clientHeight);
    if (renderer instanceof T.WebGLRenderer) renderer.setSize(w, h, false);
    else renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(target);
  resize();
  const ballScreen = new T.Vector3();
  const ballPose = new T.Vector3(),
    desired = new T.Vector3(),
    aim = new T.Vector3();
  return {
    software,
    draw(state, dt, mode) {
      dt = Math.min(0.05, Math.max(0, dt));
      time += dt;
      const blend = 1 - Math.exp(-dt * 18);
      const bp = scale(state.ball.x, state.ball.y, state.ball.height ?? 17);
      if (firstFrame || ballPose.distanceTo(bp) > 14) ballPose.copy(bp);
      else ballPose.lerp(bp, blend);
      ballGroup.position.copy(ballPose);
      ballGroup.rotation.z -= (state.ball.vx * dt) / 250;
      ballGroup.rotation.x += (state.ball.vy * dt) / 250;
      ballShadow.position.set(ballPose.x, 0.035, ballPose.z);
      ballShadow.scale.setScalar(1 + (ballPose.y - 1.4) * 0.08);
      ballShadowMat.opacity = Math.max(0.09, 0.35 - ballPose.y * 0.012);
      marker.position.set(ballPose.x, 0.045, ballPose.z);
      for (const c of state.cars) {
        const model = cars.get(c.id) ?? makeCar(c.id, c.name, c.team);
        model.root.visible = c.active;
        model.ring.visible = c.active && c.id === mine;
        if (!c.active) continue;
        const p = scale(c.x, c.y, c.height ?? 0);
        if (firstFrame || model.pose.distanceTo(p) > 12) model.pose.copy(p);
        else model.pose.lerp(p, blend);
        if (firstFrame) model.angle = c.angle;
        else
          model.angle +=
            Math.atan2(
              Math.sin(c.angle - model.angle),
              Math.cos(c.angle - model.angle),
            ) * blend;
        model.root.position.copy(model.pose);
        model.body.rotation.y = -model.angle;
        const speed = Math.hypot(c.vx, c.vy);
        model.body.rotation.x =
          -Math.sin(time * 13) * Math.min(0.025, speed / 18000);
        model.body.rotation.z =
          c.height > 0
            ? Math.max(-0.25, Math.min(0.25, -c.vz / 800))
            : Math.sin(time * 11) * Math.min(0.015, speed / 20000);
        if (c.cooldown > model.lastDodge + 0.7) model.flip = 1;
        model.lastDodge = c.cooldown;
        if (model.flip > 0) {
          model.flip = Math.max(0, model.flip - dt * 3);
          model.body.rotation.z -=
            c.height > 2
              ? (1 - model.flip) * Math.PI * 2
              : Math.sin(model.flip * Math.PI) * 0.14;
        }
        for (const wheel of model.wheels) wheel.rotation.z -= (speed * dt) / 55;
        for (const flame of model.flames) {
          flame.visible = speed > 300 && c.fuel > 0;
          flame.scale.y = 0.6 + speed / 300 + Math.sin(time * 50) * 0.2;
        }
        if (speed > 300 && c.fuel > 0)
          emit(
            model.pose
              .clone()
              .add(
                new T.Vector3(
                  -Math.cos(c.angle) * 2,
                  0.75,
                  -Math.sin(c.angle) * 2,
                ),
              ),
            c.team ? ORANGE : BLUE,
            1,
            2,
          );
        model.ring.position.set(p.x, 0.05, p.z);
        model.tag.position.y = 3.2;
      }
      const total = state.score[0] + state.score[1];
      if (total > lastScore) {
        lastScore = total;
        goalFlash = 1;
        const winning = state.goal.startsWith("BLUE") ? BLUE : ORANGE;
        emit(
          new T.Vector3(state.goal.startsWith("BLUE") ? 37 : -37, 3, 0),
          winning,
          110,
          23,
        );
      }
      goalFlash = Math.max(0, goalFlash - dt * 0.7);
      sun.intensity = 3.2 + goalFlash * 2;
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
      pads.forEach((pad, i) => {
        pad.scale.setScalar(1 + Math.sin(time * 2 + i) * 0.05);
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
        const distance = mode === "ball" ? 14 : 12 + speed / 140;
        desired.set(
          p.x - dx * distance,
          Math.max(8, p.y + 7.5) + speed / 230,
          p.z - dz * distance,
        );
        // Keep the follow camera inside the walls for a clear view near goals.
        desired.x = T.MathUtils.clamp(desired.x, 1 - END_WALL_X, END_WALL_X - 1);
        desired.z = T.MathUtils.clamp(desired.z, 1 - SIDE_WALL_Z, SIDE_WALL_Z - 1);
        const followDistance = Math.hypot(desired.x - p.x, desired.z - p.z);
        aim.lerp(p, Math.max(0, 1 - followDistance / distance));
        camera.fov =
          62 + Math.min(10, speed / 50) + Math.max(0, 1.1 - camera.aspect) * 20;
      }
      if (firstFrame) {
        camera.position.copy(desired);
        look.copy(aim);
      } else {
        camera.position.lerp(desired, 1 - Math.exp(-dt * 4.5));
        look.lerp(aim, 1 - Math.exp(-dt * 7));
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
      if (!software || softwareFrame >= 1 / 24 || firstFrame) {
        renderer.render(scene, camera);
        softwareFrame = 0;
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
