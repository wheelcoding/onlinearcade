import * as T from "three";
/** A genuine perspective-projected 3D fallback for browsers without WebGL.
 * Uses the same meshes, camera, state and world coordinates as the GPU renderer.
 * Flat face lighting and painter sorting replace GPU shading/depth on this path.
 */
export function createBallSoftwareRenderer() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas graphics unavailable");
  let width = 1,
    height = 1;
  type Point = { x: number; y: number; z: number };
  type Face = {
    p: Point[];
    depth: number;
    layer?: number;
    color: string;
    alpha: number;
    image?: CanvasImageSource;
    uv?: number[];
    line?: boolean;
    sprite?: boolean;
  };
  const faces: Face[] = [];
  const matrix = new T.Matrix4(),
    normalMatrix = new T.Matrix3(),
    vertex = new T.Vector3(),
    normal = new T.Vector3(),
    light = new T.Vector3(-0.3, 0.85, 0.4).normalize();
  const base = new T.Color(),
    emissive = new T.Color();
  const project = (x: number, y: number, z: number): Point => {
    vertex.set(x, y, z).applyMatrix4(matrix);
    return {
      x: (vertex.x * 0.5 + 0.5) * width,
      y: (0.5 - vertex.y * 0.5) * height,
      z: vertex.z,
    };
  };
  const texture = (image: CanvasImageSource, p: Point[], uv: number[]) => {
    const im = image as HTMLCanvasElement;
    const w = im.width || 1,
      h = im.height || 1;
    const x0 = uv[0] * w,
      y0 = (1 - uv[1]) * h,
      x1 = uv[2] * w,
      y1 = (1 - uv[3]) * h,
      x2 = uv[4] * w,
      y2 = (1 - uv[5]) * h;
    const denominator = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
    if (Math.abs(denominator) < 0.001) return;
    const a =
      (p[0].x * (y1 - y2) + p[1].x * (y2 - y0) + p[2].x * (y0 - y1)) /
      denominator;
    const b =
      (p[0].y * (y1 - y2) + p[1].y * (y2 - y0) + p[2].y * (y0 - y1)) /
      denominator;
    const c =
      (p[0].x * (x2 - x1) + p[1].x * (x0 - x2) + p[2].x * (x1 - x0)) /
      denominator;
    const d =
      (p[0].y * (x2 - x1) + p[1].y * (x0 - x2) + p[2].y * (x1 - x0)) /
      denominator;
    const e =
      (p[0].x * (x1 * y2 - x2 * y1) +
        p[1].x * (x2 * y0 - x0 * y2) +
        p[2].x * (x0 * y1 - x1 * y0)) /
      denominator;
    const f =
      (p[0].y * (x1 * y2 - x2 * y1) +
        p[1].y * (x2 * y0 - x0 * y2) +
        p[2].y * (x0 * y1 - x1 * y0)) /
      denominator;
    ctx!.save();
    ctx!.clip();
    ctx!.transform(a, b, c, d, e, f);
    ctx!.drawImage(image, 0, 0);
    ctx!.restore();
  };
  return {
    domElement: canvas,
    setSize(w: number, h: number) {
      width = Math.max(1, Math.round(w));
      height = Math.max(1, Math.round(h));
      canvas.width = width;
      canvas.height = height;
    },
    render(scene: T.Scene, camera: T.Camera) {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      const projection = new T.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      faces.length = 0;
      ctx.fillStyle = "#0b1728";
      ctx.fillRect(0, 0, width, height);
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#0b1728");
      sky.addColorStop(1, "#283f50");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      scene.traverseVisible((object) => {
        if (object instanceof T.Sprite) {
          const mat = object.material;
          const image = mat.map?.image as CanvasImageSource | undefined;
          if (!image) return;
          matrix.copy(projection);
          const position = object.getWorldPosition(new T.Vector3());
          const p = project(position.x, position.y, position.z);
          if (p.z < -1 || p.z > 1) return;
          const size = object.getWorldScale(new T.Vector3());
          vertex.copy(position).applyMatrix4(camera.matrixWorldInverse);
          const fov = (camera as T.PerspectiveCamera).fov || 62;
          const w = Math.min(
            180,
            Math.max(
              35,
              (size.x * height) /
                (2 *
                  Math.tan((fov * Math.PI) / 360) *
                  Math.max(0.1, -vertex.z)),
            ),
          );
          faces.push({
            p: [
              { x: p.x - w / 2, y: p.y - w * 0.08, z: p.z },
              { x: p.x + w / 2, y: p.y + w * 0.08, z: p.z },
            ],
            depth: p.z - 0.0001,
            color: "#fff",
            alpha: 1,
            image,
            sprite: true,
          });
          return;
        }
        if (object instanceof T.InstancedMesh || object instanceof T.Points)
          return;
        if (object instanceof T.LineSegments) {
          const geo: T.BufferGeometry = object.geometry,
            pos = geo.getAttribute("position");
          const mat = object.material as T.LineBasicMaterial;
          matrix.multiplyMatrices(projection, object.matrixWorld);
          for (let i = 0; i + 1 < pos.count; i += 2) {
            const a = project(pos.getX(i), pos.getY(i), pos.getZ(i)),
              b = project(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
            if (a.z < -1 || a.z > 1 || b.z < -1 || b.z > 1) continue;
            faces.push({
              p: [a, b],
              depth: (a.z + b.z) / 2,
              color: "#" + mat.color.getHexString(),
              alpha: mat.opacity,
              line: true,
            });
          }
          return;
        }
        if (!(object instanceof T.Mesh)) return;
        const geo: T.BufferGeometry = object.geometry,
          pos = geo.getAttribute("position"),
          normals = geo.getAttribute("normal"),
          uvs = geo.getAttribute("uv"),
          indices = geo.index;
        matrix.multiplyMatrices(projection, object.matrixWorld);
        normalMatrix.getNormalMatrix(object.matrixWorld);
        const count = indices?.count ?? pos.count;
        for (let n = 0; n + 2 < count; n += 3) {
          const ids = [
            indices ? indices.getX(n) : n,
            indices ? indices.getX(n + 1) : n + 1,
            indices ? indices.getX(n + 2) : n + 2,
          ];
          const p = ids.map((i) =>
            project(pos.getX(i), pos.getY(i), pos.getZ(i)),
          );
          if (
            p.some((v) => v.z < -1 || v.z > 1) ||
            p.every((v) => v.x < 0) ||
            p.every((v) => v.x > width) ||
            p.every((v) => v.y < 0) ||
            p.every((v) => v.y > height)
          )
            continue;
          let mat: T.Material;
          if (Array.isArray(object.material)) {
            const group = geo.groups.find(
              (g) => n >= g.start && n < g.start + g.count,
            );
            mat = object.material[group?.materialIndex ?? 0];
          } else mat = object.material;
          if (!mat?.visible) continue;
          const area =
            (p[1].x - p[0].x) * (p[2].y - p[0].y) -
            (p[1].y - p[0].y) * (p[2].x - p[0].x);
          if (mat.side !== T.DoubleSide && area >= 0) continue;
          const colored = mat as T.MeshStandardMaterial;
          base.copy(colored.color ?? new T.Color(0xffffff));
          let intensity = 1;
          if (normals && !(mat instanceof T.MeshBasicMaterial)) {
            normal
              .set(
                normals.getX(ids[0]),
                normals.getY(ids[0]),
                normals.getZ(ids[0]),
              )
              .applyMatrix3(normalMatrix)
              .normalize();
            intensity = 0.5 + Math.max(0, normal.dot(light)) * 0.8;
          }
          base.multiplyScalar(intensity);
          if (colored.emissive) {
            emissive
              .copy(colored.emissive)
              .multiplyScalar(Math.min(1, colored.emissiveIntensity * 0.45));
            base.add(emissive);
          }
          const image = colored.map?.image as CanvasImageSource | undefined;
          faces.push({
            p,
            depth: (p[0].z + p[1].z + p[2].z) / 3,
            layer: object.renderOrder,
            color: base.getStyle(T.SRGBColorSpace),
            alpha: mat.opacity,
            line: (mat as T.MeshBasicMaterial).wireframe === true,
            image,
            uv:
              image && uvs
                ? ids.flatMap((i) => [uvs.getX(i), uvs.getY(i)])
                : undefined,
          });
        }
      });
      faces.sort(
        (a, b) => (a.layer ?? 0) - (b.layer ?? 0) || b.depth - a.depth,
      );
      for (const face of faces) {
        ctx.globalAlpha = face.alpha;
        if (face.sprite && face.image) {
          ctx.drawImage(
            face.image,
            face.p[0].x,
            face.p[0].y,
            face.p[1].x - face.p[0].x,
            face.p[1].y - face.p[0].y,
          );
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(face.p[0].x, face.p[0].y);
        for (let i = 1; i < face.p.length; i++)
          ctx.lineTo(face.p[i].x, face.p[i].y);
        if (face.line) {
          if (face.p.length > 2) ctx.closePath();
          ctx.strokeStyle = face.color;
          ctx.lineWidth = 0.8;
          ctx.stroke();
          continue;
        }
        ctx.closePath();
        if (face.image && face.uv) texture(face.image, face.p, face.uv);
        else {
          ctx.fillStyle = face.color;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
    dispose() {
      canvas.remove();
    },
    forceContextLoss() {},
  };
}
