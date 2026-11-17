import * as T from "three";
import {
  projectToTrack,
  trackPose,
  trackLength,
  type Point3,
  type TrackDefinition,
} from "@onlinearcade/core";
export const PALETTES = {
  coast: {
    sky: "#d8a99c",
    ground: "#6e8a76",
    fog: "#d8a99c",
    road: "#414952",
    accent: "#ffd19a",
    leaf: "#628d76",
    rock: "#a5908d",
    sun: "#ffe6bd",
  },
  alpine: {
    sky: "#a9c7d8",
    ground: "#69877c",
    fog: "#b6ccd8",
    road: "#414d5b",
    accent: "#b8e4e2",
    leaf: "#456e62",
    rock: "#7c8c99",
    sun: "#e2f2f0",
  },
  canyon: {
    sky: "#d6a187",
    ground: "#bd825e",
    fog: "#d6a187",
    road: "#554951",
    accent: "#ffc17f",
    leaf: "#6a886b",
    rock: "#a95949",
    sun: "#ffdf9e",
  },
  city: {
    sky: "#111a32",
    ground: "#273342",
    fog: "#17223d",
    road: "#354155",
    accent: "#92f6df",
    leaf: "#4c6877",
    rock: "#394560",
    sun: "#cfdbfb",
  },
};
/** Original procedural world assets. Repeated props share instanced geometry/materials. */
export function createRacingWorld(track: TrackDefinition, samples: Point3[]) {
  const palette = PALETTES[track.biome],
    night = track.biome === "city",
    scene = new T.Scene();
  scene.background = new T.Color(palette.sky);
  scene.fog = new T.Fog(palette.fog, 130, 420);
  scene.add(
    new T.HemisphereLight(
      night ? "#aac6fa" : "#ffe9c5",
      night ? "#243048" : "#515d70",
      night ? 1.7 : 2.1,
    ),
  );
  const sun = new T.DirectionalLight(
    night ? "#abc6fc" : "#ffddb6",
    night ? 1.5 : 2.8,
  );
  sun.position.set(-70, 110, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -135,
    right: 135,
    top: 135,
    bottom: -135,
    far: 350,
  });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const materials = new Map<string, T.MeshStandardMaterial>();
  const material = (color: string, glow = 0) => {
    const key = color + ":" + glow;
    if (!materials.has(key))
      materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: night ? 0.45 : 0.85,
          emissive: color,
          emissiveIntensity: glow,
        }),
      );
    return materials.get(key)!;
  };
  function object(
    geometry: T.BufferGeometry,
    mat: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const mesh = new T.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  const batches = new Map<
      string,
      { shape: string; color: string; glow: number; matrices: T.Matrix4[] }
    >(),
    dummy = new T.Object3D();
  function prop(
    shape: "box" | "cone" | "cylinder" | "sphere",
    color: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ry = 0,
    rz = 0,
    glow = 0,
  ) {
    const key = shape + color + glow;
    if (!batches.has(key))
      batches.set(key, { shape, color, glow, matrices: [] });
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    batches.get(key)!.matrices.push(dummy.matrix.clone());
  }
  const groundHeight = (x: number, z: number) => {
    let y =
      Math.sin(x * 0.024) *
        Math.cos(z * 0.033) *
        (track.biome === "alpine" ? 13 : 3) -
      2;
    const road = projectToTrack(samples, x, z);
    if (road.distance < 28) y = Math.min(y, road.y - 1.4);
    if (track.biome === "coast" && x > 110) y = -3.2;
    return y;
  };
  const at = (progress: number, offset = 0) => {
    const p = trackPose(samples, progress);
    return {
      ...p,
      x: p.x - p.tz * offset,
      z: p.z + p.tx * offset,
      heading: Math.atan2(p.tx, p.tz),
    };
  };
  function label(
    text: string,
    width: number,
    height: number,
    color = "#f7e9d5",
    background = "#283345",
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = color;
    ctx.lineWidth = 12;
    ctx.strokeRect(12, 12, 1000, 232);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 82px Arial";
    ctx.fillText(text.toUpperCase(), 512, 138, 940);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const mesh = object(
      new T.PlaneGeometry(width, height),
      new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }),
    );
    return mesh;
  }
  function asphalt() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = palette.road;
    ctx.fillRect(0, 0, 128, 128);
    let seed = 72;
    for (let i = 0; i < 4500; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      ctx.fillStyle = i % 2 ? "#ffffff0c" : "#00000012";
      ctx.fillRect(seed % 128, (seed >>> 8) % 128, 1, 1);
    }
    const texture = new T.CanvasTexture(c);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }
  const roadMat = new T.MeshStandardMaterial({
    map: asphalt(),
    roughness: night ? 0.35 : 0.9,
    side: T.DoubleSide,
  });
  function ribbon(width: number, raise: number, mat: T.Material) {
    const vertices: number[] = [],
      uv: number[] = [],
      indices: number[] = [],
      length = trackLength(samples);
    for (let i = 0; i <= samples.length; i++) {
      const p = trackPose(samples, i / samples.length);
      for (const side of [-1, 1]) {
        vertices.push(
          p.x - ((p.tz * width) / 2) * side,
          p.y + raise,
          p.z + ((p.tx * width) / 2) * side,
        );
        uv.push((side + 1) / 2, ((i / samples.length) * length) / 10);
      }
      if (i < samples.length) {
        const k = i * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const road = object(geometry, mat);
    road.castShadow = false;
    return road;
  }
  ribbon(
    track.width + 5,
    0.04,
    material(track.biome === "canyon" ? "#c59475" : "#a5aa9a"),
  );
  ribbon(track.width, 0.08, roadMat);
  const terrain = new T.PlaneGeometry(750, 750, 70, 70);
  terrain.rotateX(-Math.PI / 2);
  const positions = terrain.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    positions.setY(i, groundHeight(x, z));
  }
  terrain.computeVertexNormals();
  object(terrain, material(palette.ground)).castShadow = false;
  const railPaths = [-1, 1].map((sign) =>
    samples.map((_, i) => {
      const p = at(i / samples.length, sign * (track.width / 2 + 2));
      return new T.Vector3(p.x, p.y + 1.15, p.z);
    }),
  );
  for (const path of railPaths) {
    const rail = object(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(path, true),
        360,
        0.16,
        5,
        true,
      ),
      material(night ? palette.accent : "#bfc9c7", night ? 0.6 : 0),
    );
    rail.castShadow = false;
  }
  for (let i = 0; i < 180; i++) {
    const t = i / 180,
      p = at(t);
    if (i % 2 === 0)
      prop(
        "box",
        night ? "#d5e6e6" : "#f2dec3",
        p.x,
        p.y + 0.13,
        p.z,
        0.25,
        0.03,
        1.6,
        p.heading,
      );
    for (const side of [-1, 1]) {
      const curb = at(t, side * (track.width / 2 + 0.45));
      prop(
        "box",
        i % 2 ? palette.accent : "#8b6670",
        curb.x,
        curb.y + 0.12,
        curb.z,
        1,
        0.16,
        (trackLength(samples) / 180) * 0.9,
        p.heading,
      );
      if (i % 3 === 0) {
        const post = at(t, side * (track.width / 2 + 2));
        prop(
          "box",
          night ? "#516984" : "#a4afaa",
          post.x,
          post.y + 0.6,
          post.z,
          0.22,
          1.2,
          0.22,
          p.heading,
        );
      }
    }
    if (i % 9 === 0) {
      const base = groundHeight(p.x, p.z);
      prop(
        "cylinder",
        "#6a7176",
        p.x,
        (base + p.y - 0.4) / 2,
        p.z,
        1.2,
        Math.max(0.4, p.y - base - 0.4),
        1.2,
      );
      prop(
        "box",
        "#787e83",
        p.x,
        p.y - 0.5,
        p.z,
        track.width + 2,
        0.8,
        2,
        p.heading,
      );
    }
  }
  // Start/finish complex: pit wall, gantry, checkerboard, grandstand, garages and signs.
  const start = at(0);
  for (let i = 0; i < 14; i++) {
    const p = at(0, ((i - 6.5) * track.width) / 14);
    prop(
      "box",
      i % 2 ? "#f9eddb" : "#26313d",
      p.x,
      p.y + 0.14,
      p.z,
      track.width / 14,
      0.035,
      1.5,
      start.heading,
    );
  }
  for (const side of [-1, 1]) {
    const p = at(0, side * (track.width / 2 + 1.3));
    prop("box", "#364456", p.x, p.y + 3.5, p.z, 0.7, 7, 0.7, start.heading);
  }
  prop(
    "box",
    "#334154",
    start.x,
    start.y + 7,
    start.z,
    track.width + 4,
    1.5,
    1.3,
    start.heading,
  );
  const banner = label(track.name, track.width + 2, 1.2, palette.accent);
  banner.position.set(
    start.x - start.tx * 0.72,
    start.y + 7,
    start.z - start.tz * 0.72,
  );
  banner.rotation.y = start.heading + Math.PI;
  const pits = at(0.04, -(track.width / 2 + 13));
  prop("box", "#455463", pits.x, pits.y + 2.6, pits.z, 12, 5, 22, pits.heading);
  prop(
    "box",
    palette.accent,
    pits.x,
    pits.y + 5.3,
    pits.z,
    13,
    0.35,
    23,
    pits.heading,
  );
  for (let row = 0; row < 2; row++)
    for (let j = 0; j < 8; j++) {
      const dz = (j - 3.5) * 2.3;
      prop(
        "box",
        night ? "#d6bfa1" : "#8fb5c0",
        pits.x + Math.cos(pits.heading) * 6.05 + Math.sin(pits.heading) * dz,
        pits.y + 1.5 + row * 2,
        pits.z - Math.sin(pits.heading) * 6.05 + Math.cos(pits.heading) * dz,
        0.1,
        1,
        1.3,
        pits.heading,
        0,
        night ? 0.7 : 0,
      );
    }
  const stand = at(0.96, track.width / 2 + 13);
  for (let row = 0; row < 4; row++) {
    const offset = row * 1.5;
    prop(
      "box",
      "#586478",
      stand.x - stand.tz * offset,
      stand.y + 0.6 + row * 0.7,
      stand.z + stand.tx * offset,
      1.8,
      0.65,
      22,
      stand.heading,
    );
    for (let seat = 0; seat < 13; seat++) {
      const along = (seat - 6) * 1.5;
      prop(
        "box",
        seat % 3 === 0 ? palette.accent : "#a4b9c6",
        stand.x - stand.tz * offset + stand.tx * along,
        stand.y + 1 + row * 0.7,
        stand.z + stand.tx * offset + stand.tz * along,
        0.6,
        0.5,
        0.6,
        stand.heading,
      );
    }
  }
  prop(
    "box",
    "#394b61",
    stand.x - stand.tz * 2,
    stand.y + 5.3,
    stand.z + stand.tx * 2,
    9,
    0.25,
    25,
    stand.heading,
  );
  for (const along of [-10, 10])
    prop(
      "cylinder",
      "#526474",
      stand.x + stand.tx * along,
      stand.y + 2.5,
      stand.z + stand.tz * along,
      0.2,
      5,
      0.2,
    );
  for (let checkpoint = 1; checkpoint < 24; checkpoint++) {
    const p = at(checkpoint / 24, track.width / 2 + 3.2);
    prop(
      "box",
      palette.accent,
      p.x,
      p.y + 1.7,
      p.z,
      0.7,
      2.5,
      0.3,
      p.heading,
      0,
      night ? 0.5 : 0,
    );
    if (checkpoint % 4 === 0) {
      const sign = label(`SECTOR ${checkpoint / 4}`, 4, 1.1, palette.accent);
      sign.position.set(p.x, p.y + 3.5, p.z);
      sign.rotation.y = p.heading + Math.PI;
    }
  }
  for (const t of [0.18, 0.6])
    for (let stripe = 0; stripe < 7; stripe++) {
      const p = at(t + stripe * 0.0018);
      prop(
        "box",
        palette.accent,
        p.x,
        p.y + 0.14,
        p.z,
        track.width * 0.7,
        0.04,
        0.5,
        p.heading,
        0,
        night ? 1 : 0.15,
      );
    }
  // Theme-specific props are deterministic and stay clear of every road segment.
  let seed = track.id.length * 191;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 240; i++) {
    const x = (random() - 0.5) * 410,
      z = (random() - 0.5) * 360,
      p = projectToTrack(samples, x, z);
    if (
      p.distance < track.width / 2 + 9 ||
      (Math.abs(x) < 8 && Math.abs(z) < 8)
    )
      continue;
    if (track.biome === "coast" && x > 105) continue;
    const h = 4 + random() * 8,
      base = groundHeight(x, z);
    if (track.biome === "alpine") {
      prop("cylinder", "#615852", x, base + h * 0.3, z, 0.5, h * 0.6, 0.5);
      for (let tier = 0; tier < 3; tier++)
        prop(
          "cone",
          tier % 2 ? "#4c7969" : "#365f56",
          x,
          base + h * (0.45 + tier * 0.2),
          z,
          h * (0.28 - tier * 0.045),
          h * 0.65,
          h * (0.28 - tier * 0.045),
        );
      if (i % 5 === 0)
        prop(
          "cone",
          "#dce5dc",
          x,
          base + h * 1.05,
          z,
          h * 0.11,
          h * 0.3,
          h * 0.11,
        );
    } else if (track.biome === "coast") {
      prop(
        "cylinder",
        "#8b7864",
        x,
        base + h * 0.5,
        z,
        0.45,
        h,
        0.45,
        0,
        -0.12,
      );
      for (let f = 0; f < 6; f++)
        prop(
          "box",
          palette.leaf,
          x,
          base + h,
          z,
          4.5,
          0.16,
          0.8,
          (f * Math.PI) / 3,
          -0.14,
        );
      prop("sphere", "#a5b48b", x + 1, base + 0.7, z + 1, 2, 1.5, 2);
    } else if (track.biome === "canyon") {
      if (i % 3 === 0) {
        for (let tier = 0; tier < 3; tier++)
          prop(
            "cylinder",
            ["#965648", "#b96e50", "#c58b61"][tier],
            x,
            base + tier * 3 + 2,
            z,
            5 - tier * 0.6,
            4,
            5 - tier * 0.6,
            i,
          );
      } else {
        prop("cylinder", "#66806b", x, base + h * 0.25, z, 0.7, h * 0.5, 0.7);
        prop("box", "#66806b", x + 1, base + h * 0.3, z, 2.2, 0.6, 0.65);
        prop(
          "cylinder",
          "#66806b",
          x + 2,
          base + h * 0.4,
          z,
          0.6,
          h * 0.25,
          0.6,
        );
      }
    } else {
      const height = 8 + random() * 35,
        width = 5 + random() * 8;
      prop(
        "box",
        i % 2 ? "#34425d" : "#26374f",
        x,
        base + height / 2,
        z,
        width,
        height,
        width,
      );
      prop(
        "box",
        "#52647c",
        x,
        base + height + 0.2,
        z,
        width + 0.5,
        0.5,
        width + 0.5,
      );
      for (let row = 1; row < height / 3; row++)
        for (let col = 0; col < 3; col++)
          if (random() > 0.35)
            prop(
              "box",
              i % 3 === 0 ? "#e9b9a1" : "#8fd7d1",
              x - width / 2 + 0.8 + (col * (width - 1.6)) / 2,
              base + row * 3,
              z - width / 2 - 0.03,
              0.7,
              1,
              0.04,
              0,
              0,
              0.7,
            );
    }
  }
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2,
      r = 245 + random() * 50,
      h = 30 + random() * 55;
    prop(
      "cone",
      palette.rock,
      Math.cos(angle) * r,
      h * 0.25 - 8,
      Math.sin(angle) * r,
      35 + random() * 25,
      h,
      35 + random() * 25,
      i,
    );
    if (track.biome === "alpine")
      prop(
        "cone",
        "#dce8e4",
        Math.cos(angle) * r,
        h * 0.65 - 8,
        Math.sin(angle) * r,
        13,
        h * 0.24,
        13,
        i,
      );
  }
  const moving: T.Object3D[] = [];
  if (track.biome === "coast") {
    const water = object(
      new T.PlaneGeometry(500, 900),
      new T.MeshStandardMaterial({
        color: "#638f9e",
        metalness: 0.45,
        roughness: 0.3,
      }),
      360,
      -1.9,
      0,
    );
    water.rotation.x = -Math.PI / 2;
    water.castShadow = false;
    for (let i = 0; i < 4; i++) {
      const boat = new T.Group();
      boat.position.set(145 + i * 40, -1.2, -80 + i * 58);
      const hull = new T.Mesh(
        new T.BoxGeometry(4, 0.8, 10),
        material("#eee0bf"),
      );
      boat.add(hull);
      const mast = new T.Mesh(
        new T.CylinderGeometry(0.1, 0.1, 13, 6),
        material("#e4d4b6"),
      );
      mast.position.y = 6.7;
      boat.add(mast);
      const sail = new T.Mesh(
        new T.ConeGeometry(4, 10, 3),
        material(i % 2 ? "#df9f87" : "#dbe1c1"),
      );
      sail.position.set(1.5, 7, 0);
      boat.add(sail);
      scene.add(boat);
      moving.push(boat);
    }
    prop("cylinder", "#a29480", 120, -2, 80, 15, 2, 15);
    prop("cylinder", "#e6ddc7", 120, 12, 80, 5, 26, 5);
    for (let i = 0; i < 4; i++)
      prop(
        "cylinder",
        i % 2 ? "#d58173" : "#e6ddc7",
        120,
        4 + i * 5,
        80,
        5.05,
        2.5,
        5.05,
      );
    prop("cone", "#49576a", 120, 27, 80, 7, 5, 7);
    prop("sphere", "#ffdf9e", 120, 24, 80, 2, 2, 2, 0, 0, 1);
  }
  if (track.biome === "alpine") {
    for (const t of [0.27, 0.29, 0.31, 0.33]) {
      const p = at(t);
      const arch = object(
        new T.TorusGeometry(track.width / 2 + 2, 0.65, 8, 24, Math.PI),
        material("#8d9f9f"),
        p.x,
        p.y + 0.25,
        p.z,
      );
      arch.rotation.y = p.heading;
      prop(
        "box",
        "#7d8f8e",
        p.x - p.tz * (track.width / 2 + 2),
        p.y + 2,
        p.z + p.tx * (track.width / 2 + 2),
        1,
        4,
        1,
      );
    }
    const p = at(0.48, 28);
    prop("box", "#a17e69", p.x, 3, p.z, 13, 7, 11, p.heading);
    prop("cone", "#4e6671", p.x, 8, p.z, 10, 5, 10, p.heading + Math.PI / 4);
  }
  if (track.biome === "canyon") {
    const p = at(0.63, 33);
    for (const side of [-1, 1])
      prop("box", "#aa604c", p.x + side * 12, 9, p.z, 5, 22, 8);
    prop("box", "#b37554", p.x, 19, p.z, 29, 5, 8);
    for (let i = 0; i < 8; i++) {
      const q = at(0.64 + i * 0.008, track.width / 2 + 6);
      prop(
        "sphere",
        "#c58c61",
        q.x,
        q.y + 1.2,
        q.z,
        3 + (i % 3),
        3,
        3 + (i % 3),
      );
    }
  }
  if (night) {
    for (let i = 0; i < 16; i++) {
      const p = at(i / 16, track.width / 2 + 3.5);
      prop("cylinder", "#3e526a", p.x, p.y + 4, p.z, 0.25, 8, 0.25);
      prop(
        "box",
        palette.accent,
        p.x,
        p.y + 8,
        p.z,
        2,
        0.15,
        1.2,
        p.heading,
        0,
        1.8,
      );
      if (i % 4 === 0) {
        const light = new T.PointLight("#93e3df", 35, 28, 2);
        light.position.set(p.x, p.y + 6, p.z);
        scene.add(light);
      }
    }
    for (const t of [0.4, 0.41, 0.42, 0.43, 0.44]) {
      const p = at(t);
      const arch = object(
        new T.TorusGeometry(track.width / 2 + 1, 0.13, 6, 28, Math.PI),
        material("#bda2fb", 2),
        p.x,
        p.y + 0.3,
        p.z,
      );
      arch.rotation.y = p.heading;
    }
    for (let i = 0; i < 12; i++) {
      const p = at(0.69 + i * 0.006, 25 + (i % 3) * 5);
      prop(
        "box",
        i % 2 ? "#836483" : "#456d7e",
        p.x,
        1 + (i % 3) * 2.7,
        p.z,
        4,
        2.6,
        9,
        p.heading,
      );
      for (let line = 0; line < 5; line++)
        prop(
          "box",
          "#9da5ae",
          p.x - p.tz * 2.03,
          p.y + 1,
          p.z + p.tx * 2.03,
          0.08,
          2,
          0.12,
          p.heading,
        );
    }
    const crane = at(0.72, 48);
    prop("box", "#d3a983", crane.x, 15, crane.z, 1.1, 32, 1.1);
    prop("box", "#d3a983", crane.x + 10, 30, crane.z, 35, 1, 1);
    prop("cylinder", "#8a9aaf", crane.x + 24, 22, crane.z, 0.08, 15, 0.08);
  }
  const orb = object(
    new T.SphereGeometry(night ? 10 : 14, 24, 16),
    new T.MeshBasicMaterial({ color: palette.sun }),
    -170,
    95,
    -180,
  );
  orb.castShadow = false;
  for (const batch of batches.values()) {
    const geometry =
      batch.shape === "cone"
        ? new T.ConeGeometry(1, 1, 7)
        : batch.shape === "cylinder"
          ? new T.CylinderGeometry(0.5, 0.5, 1, 8)
          : batch.shape === "sphere"
            ? new T.IcosahedronGeometry(0.5, 1)
            : new T.BoxGeometry(1, 1, 1);
    const instanced = new T.InstancedMesh(
      geometry,
      material(batch.color, batch.glow),
      batch.matrices.length,
    );
    batch.matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
    instanced.castShadow = batch.shape !== "sphere";
    instanced.receiveShadow = true;
    scene.add(instanced);
  }
  const gate = object(
    new T.TorusGeometry(track.width * 0.48, 0.11, 6, 32, Math.PI),
    new T.MeshBasicMaterial({
      color: palette.accent,
      transparent: true,
      opacity: 0.6,
    }),
  );
  gate.castShadow = false;
  return {
    scene,
    sun,
    gate,
    palette,
    update: (time: number) => {
      moving.forEach((boat, i) => {
        boat.position.y = -1.7 + Math.sin(time + i) * 0.15;
        boat.rotation.z = Math.sin(time * 0.6 + i) * 0.025;
      });
    },
    dispose: () => {
      const geometries = new Set<T.BufferGeometry>(),
        mats = new Set<T.Material>(),
        textures = new Set<T.Texture>();
      scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          if (o instanceof T.InstancedMesh) o.dispose();
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            mats.add(m);
            if ("map" in m && m.map instanceof T.Texture) textures.add(m.map);
          }
        }
      });
      geometries.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      sun.shadow.dispose();
    },
  };
}
