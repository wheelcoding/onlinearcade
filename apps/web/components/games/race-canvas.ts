import {
  trackPose,
  projectToTrack,
  type RaceSimulation,
  type GhostFrame,
  ghostPose,
} from "@onlinearcade/core";
export type RaceView = {
  draw: (
    sim: RaceSimulation,
    delta: number,
    ghost: readonly GhostFrame[] | null,
    line: boolean,
  ) => void;
  resize: () => void;
  dispose: () => void;
  mode: "3d" | "2d";
};
/** Compatibility renderer for devices with no WebGL. Uses the same simulation and opponents. */
export function createCanvasRace(
  target: HTMLElement,
  initial: RaceSimulation,
): RaceView {
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is unavailable");
  target.appendChild(canvas);
  let width = 960,
    height = 540,
    cameraHeading = initial.player.heading;
  const palettes = {
      coast: { ground: "#7a9584", road: "#465361", curb: "#f5d6a0" },
      alpine: { ground: "#597b73", road: "#4b5969", curb: "#bedfd2" },
      canyon: { ground: "#b68364", road: "#65545a", curb: "#f8c28e" },
      city: { ground: "#192b3d", road: "#35475e", curb: "#8de9d2" },
    },
    theme = palettes[initial.track.biome];
  const scenery = Array.from({ length: 170 }, (_, i) => ({
    x: Math.sin(i * 71.3) * 180,
    z: Math.cos(i * 53.7) * 160,
    size: 2 + (i % 4),
  })).filter(
    (p) =>
      projectToTrack(initial.samples, p.x, p.z).distance >
      initial.track.width / 2 + 8,
  );
  const resize = () => {
    width = Math.max(1, target.clientWidth);
    height = Math.max(1, target.clientHeight);
    const ratio = Math.min(devicePixelRatio, 1.5);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
  };
  resize();
  function car(
    x: number,
    z: number,
    heading: number,
    color: string,
    alpha = 1,
  ) {
    ctx!.save();
    ctx!.translate(x, z);
    ctx!.rotate(-heading);
    ctx!.globalAlpha = alpha;
    ctx!.fillStyle = "#111a29";
    for (const side of [-1, 1])
      for (const axle of [-1, 1])
        ctx!.fillRect(side * 1.05 - 0.2, axle * 0.95 - 0.4, 0.4, 0.8);
    ctx!.fillStyle = "#14203066";
    ctx!.fillRect(-0.8 + 0.2, -1.7 + 0.2, 1.9, 3.6);
    ctx!.fillStyle = color;
    ctx!.fillRect(-0.9, -1.65, 1.8, 3.3);
    ctx!.fillStyle = "#294457";
    ctx!.fillRect(-0.65, -0.5, 1.3, 1.1);
    ctx!.fillStyle = "#f5e7c1";
    ctx!.fillRect(-0.7, 1.05, 1.4, 0.22);
    ctx!.fillRect(-1.1, -1.5, 2.2, 0.22);
    ctx!.restore();
  }
  return {
    mode: "2d",
    resize,
    draw: (sim, dt, ghost, line) => {
      const ratio = canvas.width / width;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = theme.ground;
      ctx.fillRect(0, 0, width, height);
      const p = sim.player,
        velocity = Math.atan2(p.vx, p.vz),
        desired = Math.hypot(p.vx, p.vz) > 5 ? velocity : p.heading;
      cameraHeading +=
        Math.atan2(
          Math.sin(desired - cameraHeading),
          Math.cos(desired - cameraHeading),
        ) *
        (1 - Math.exp(-dt * 4));
      const scale =
          Math.min(width / 95, height / 65) / (1 + Math.abs(p.speed) * 0.006),
        c = Math.cos(cameraHeading),
        s = Math.sin(cameraHeading),
        a = -c * scale,
        b = -s * scale,
        cc = s * scale,
        d = -c * scale;
      ctx.transform(
        a,
        b,
        cc,
        d,
        width * 0.5 - a * p.x - cc * p.z,
        height * 0.63 - b * p.x - d * p.z,
      );
      for (const prop of scenery) {
        ctx.save();
        ctx.translate(prop.x, prop.z);
        const size = prop.size;
        ctx.fillStyle = "#0d1e3230";
        ctx.beginPath();
        ctx.ellipse(
          size * 0.6,
          size * 0.8,
          size * 1.3,
          size * 0.8,
          0.6,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        if (sim.track.biome === "city") {
          ctx.fillStyle = "#293b52";
          ctx.fillRect(-size, -size, size * 2, size * 2);
          ctx.fillStyle = "#41576b";
          ctx.fillRect(
            -size + 0.4,
            -size + 0.4,
            size * 2 - 0.8,
            size * 2 - 0.8,
          );
          ctx.fillStyle = "#9bdbd5";
          for (let row = 0; row < 3; row++)
            for (let col = 0; col < 3; col++)
              ctx.fillRect(
                -size + 0.7 + col * size * 0.55,
                -size + 0.8 + row * size * 0.55,
                0.35,
                0.5,
              );
          ctx.strokeStyle = "#b694df";
          ctx.lineWidth = 0.15;
          ctx.strokeRect(-size, -size, size * 2, size * 2);
        } else if (sim.track.biome === "canyon") {
          ctx.fillStyle = "#945948";
          ctx.beginPath();
          ctx.moveTo(-size, size * 0.7);
          ctx.lineTo(-size * 0.8, -size * 0.6);
          ctx.lineTo(size * 0.2, -size);
          ctx.lineTo(size, size * 0.2);
          ctx.lineTo(size * 0.6, size);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#c68a65";
          ctx.beginPath();
          ctx.ellipse(-0.2, -0.6, size * 0.7, size * 0.5, -0.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (sim.track.biome === "alpine") {
          ctx.fillStyle = "#345c56";
          for (let layer = 0; layer < 3; layer++) {
            ctx.beginPath();
            ctx.moveTo(0, -size - layer * 0.7);
            ctx.lineTo(-size + layer * 0.5, size * 0.5 - layer * 0.8);
            ctx.lineTo(size - layer * 0.5, size * 0.5 - layer * 0.8);
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = "#bdd4cb";
          ctx.beginPath();
          ctx.moveTo(0, -size - 1.4);
          ctx.lineTo(-size * 0.45, -size * 0.1);
          ctx.lineTo(size * 0.45, -size * 0.1);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.strokeStyle = "#a69978";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0.6, -1);
          ctx.stroke();
          ctx.strokeStyle = "#426e61";
          ctx.lineWidth = 0.7;
          for (let leaf = 0; leaf < 6; leaf++) {
            const angle = (leaf * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(0.6, -1);
            ctx.quadraticCurveTo(
              Math.sin(angle) * size * 0.6,
              -1 + Math.cos(angle) * size * 0.6,
              Math.sin(angle) * size,
              -1 + Math.cos(angle) * size,
            );
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      const path = () => {
        ctx.beginPath();
        sim.samples.forEach((point, i) =>
          i ? ctx.lineTo(point.x, point.z) : ctx.moveTo(point.x, point.z),
        );
        ctx.closePath();
      };
      ctx.lineJoin = "round";
      path();
      ctx.strokeStyle = "#18223044";
      ctx.lineWidth = sim.track.width + 6;
      ctx.stroke();
      path();
      ctx.strokeStyle = theme.curb;
      ctx.lineWidth = sim.track.width + 2;
      ctx.stroke();
      path();
      ctx.strokeStyle = "#9a6e7e";
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      path();
      ctx.strokeStyle = theme.road;
      ctx.lineWidth = sim.track.width;
      ctx.stroke();
      path();
      ctx.strokeStyle = "#e9ddbc88";
      ctx.lineWidth = 0.18;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const at of [0.18, 0.6]) {
        const strip = trackPose(sim.samples, at);
        ctx.save();
        ctx.translate(strip.x, strip.z);
        ctx.rotate(-Math.atan2(strip.tx, strip.tz));
        ctx.fillStyle = "#9ce9cc66";
        ctx.fillRect(-sim.track.width * 0.4, -1.6, sim.track.width * 0.8, 3.2);
        ctx.strokeStyle = "#d7f1bb";
        ctx.lineWidth = 0.2;
        for (const lane of [-1, 0, 1]) {
          ctx.beginPath();
          ctx.moveTo(lane * 2 - 0.8, -0.8);
          ctx.lineTo(lane * 2, 0.5);
          ctx.lineTo(lane * 2 + 0.8, -0.8);
          ctx.stroke();
        }
        ctx.restore();
      }
      const finish = trackPose(sim.samples, 0);
      ctx.save();
      ctx.translate(finish.x, finish.z);
      ctx.rotate(-Math.atan2(finish.tx, finish.tz));
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = i % 2 ? "#f4e9d0" : "#1f2f45";
        ctx.fillRect(
          -sim.track.width / 2 + (i * sim.track.width) / 14,
          -0.5,
          sim.track.width / 14,
          1,
        );
      }
      ctx.restore();
      if (line)
        for (let i = 1; i < 25; i++) {
          const point = trackPose(
            sim.samples,
            p.progress + (i * 3.5) / sim.length,
          );
          ctx.fillStyle = "#bcebdacc";
          ctx.beginPath();
          ctx.arc(point.x, point.z, 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      if (ghost) {
        const pose = ghostPose(ghost, sim.time + p.penalty);
        if (pose) car(pose.x, pose.z, pose.heading, "#b5eff1", 0.35);
      }
      for (const opponent of sim.cars.filter((c) => c.id !== 0))
        car(opponent.x, opponent.z, opponent.heading, opponent.color);
      if (p.drifting) {
        ctx.fillStyle = p.driftCharge >= 2.3 ? "#ffc88b" : "#9aeee9";
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(
            p.x - Math.sin(p.heading) * 1.8 + Math.cos(p.heading) * side,
            p.z - Math.cos(p.heading) * 1.8 - Math.sin(p.heading) * side,
            0.4,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      car(p.x, p.z, p.heading, p.color);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    },
    dispose: () => canvas.remove(),
  };
}
