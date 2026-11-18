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
        ctx.fillStyle =
          sim.track.biome === "city"
            ? "#2c4259"
            : sim.track.biome === "canyon"
              ? "#a9664e"
              : "#426b60";
        ctx.beginPath();
        ctx.arc(prop.x, prop.z, prop.size, 0, Math.PI * 2);
        ctx.fill();
        if (sim.track.biome === "city") {
          ctx.fillStyle = "#97d1c9";
          ctx.fillRect(prop.x - 1, prop.z - 1, 2, 0.4);
        }
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
