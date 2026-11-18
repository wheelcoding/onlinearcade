import * as T from "three";
/** Small bounded weather field follows the kart; original geometry, no textures. */
export function createRaceAtmosphere(scene: T.Scene, biome: string) {
  const rain = biome === "city",
    snow = biome === "alpine",
    count = rain ? 90 : 65,
    positions = new Float32Array(count * 6),
    geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  const material = new T.LineBasicMaterial({
    color: rain
      ? "#acd0e5"
      : snow
        ? "#e0eeea"
        : biome === "canyon"
          ? "#efc398"
          : "#e4d8ab",
    transparent: true,
    opacity: rain ? 0.22 : snow ? 0.48 : 0.2,
    depthWrite: false,
  });
  const field = new T.LineSegments(geometry, material);
  field.frustumCulled = false;
  scene.add(field);
  return {
    update(time: number, x: number, y: number, z: number) {
      for (let i = 0; i < count; i++) {
        const px =
            x +
            ((((i * 17.73 + time * (rain ? -4 : 1.4)) % 45) + 45) % 45) -
            22.5,
          pz = z + ((((i * 23.91 + time * 0.5) % 45) + 45) % 45) - 22.5,
          py =
            y +
            ((((i * 3.17 - time * (rain ? 19 : snow ? 2 : 0.35)) % 17) + 17) %
              17),
          base = i * 6,
          length = rain ? 1.2 : snow ? 0.09 : 0.035;
        positions.set(
          [px, py, pz, px + (rain ? 0.18 : 0), py - length, pz],
          base,
        );
      }
      geometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      scene.remove(field);
      geometry.dispose();
      material.dispose();
    },
  };
}
