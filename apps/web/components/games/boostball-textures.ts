import type { BoostballArena } from "@onlinearcade/core";

function surface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas graphics unavailable");
  return { canvas, context };
}

export function paintBoostballPitch(arena: BoostballArena) {
  const {
    field,
    centerX,
    centerY,
    penaltyDepth,
    penaltyHalfWidth,
    goalAreaDepth,
    goalAreaHalfWidth,
    centerCircle,
  } = arena;
  const length = field.right - field.left;
  const width = field.bottom - field.top;
  const { canvas, context: ctx } = surface(2048, 1152);
  const sx = canvas.width / length;
  const sy = canvas.height / width;
  ctx.setTransform(sx, 0, 0, sy, -field.left * sx, -field.top * sy);

  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = i % 2 ? "#285754" : "#2d625a";
    ctx.fillRect(
      field.left + (i * length) / 18,
      field.top,
      length / 18 + 0.5,
      width,
    );
  }
  const shade = ctx.createLinearGradient(0, field.top, 0, field.bottom);
  shade.addColorStop(0, "#071b3b6b");
  shade.addColorStop(0.26, "#0b3b2f16");
  shade.addColorStop(0.5, "#1d806020");
  shade.addColorStop(0.74, "#0b3b2f16");
  shade.addColorStop(1, "#2c182d70");
  ctx.fillStyle = shade;
  ctx.fillRect(field.left, field.top, length, width);
  let seed = 41;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 21000; i++) {
    ctx.fillStyle = i % 2 ? "#dcffbd14" : "#051f2c28";
    ctx.fillRect(
      field.left + random() * length,
      field.top + random() * width,
      0.8,
      0.6 + random() * 1.6,
    );
  }

  ctx.fillStyle = "#152d402b";
  ctx.fillRect(field.left, field.top + 2, length, 42);
  ctx.fillRect(field.left, field.bottom - 44, length, 42);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#cee5cfb8";
  ctx.strokeRect(field.left + 2, field.top + 2, length - 4, width - 4);
  ctx.beginPath();
  ctx.moveTo(centerX, field.top + 2);
  ctx.lineTo(centerX, field.bottom - 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY, centerCircle, 0, Math.PI * 2);
  ctx.fillStyle = "#213f50b3";
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(centerX, centerY);
  const crest = centerCircle * 0.009;
  ctx.scale(crest, crest);
  ctx.fillStyle = "#e5efce";
  ctx.beginPath();
  ctx.moveTo(33, -58);
  ctx.lineTo(-49, 8);
  ctx.lineTo(-4, 8);
  ctx.lineTo(-27, 58);
  ctx.lineTo(56, -13);
  ctx.lineTo(13, -13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  for (const side of [-1, 1]) {
    const line = side < 0 ? field.left + 2 : field.right - 2;
    const away = side === 1;
    ctx.fillStyle = away ? "#ed8f4930" : "#55c7f039";
    ctx.strokeStyle = away ? "#ffba83d9" : "#98d9efdb";
    ctx.fillRect(
      line,
      centerY - penaltyHalfWidth,
      -side * penaltyDepth,
      penaltyHalfWidth * 2,
    );
    ctx.strokeRect(
      line,
      centerY - penaltyHalfWidth,
      -side * penaltyDepth,
      penaltyHalfWidth * 2,
    );
    ctx.strokeRect(
      line,
      centerY - goalAreaHalfWidth,
      -side * goalAreaDepth,
      goalAreaHalfWidth * 2,
    );
    ctx.beginPath();
    ctx.ellipse(
      line - side * penaltyDepth,
      centerY,
      42,
      penaltyHalfWidth * 0.48,
      0,
      away ? Math.PI / 2 : -Math.PI / 2,
      away ? Math.PI * 1.5 : Math.PI / 2,
    );
    ctx.stroke();

    ctx.lineWidth = 2;
    for (let i = 1; i < 9; i++) {
      const x = line - (side * i * length) / 18;
      for (const y of [field.top + 11, field.bottom - 11]) {
        ctx.strokeRect(x - 7, y - 2, 14, 4);
      }
    }
    ctx.lineWidth = 3;
  }
  return canvas;
}

export function paintBoostballStands() {
  const { canvas, context: ctx } = surface(768, 112);
  const shirts = [
    "#a5b6cb",
    "#6a87ae",
    "#d28f74",
    "#86b7a8",
    "#465678",
    "#b795b2",
  ];
  ctx.fillStyle = "#182334";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < 4; row++) {
    const y = 14 + row * 26;
    ctx.fillStyle = row % 2 ? "#344760" : "#293b52";
    ctx.fillRect(0, y - 12, canvas.width, 24);
    for (let seat = 0; seat < 49; seat++) {
      const x = 8 + seat * 16 + (row % 2) * 7;
      if ((seat + row * 4) % 11 === 0) {
        ctx.fillStyle = "#1d2e44";
        ctx.fillRect(x - 6, y - 10, 13, 23);
        continue;
      }
      ctx.fillStyle =
        shirts[(seat * 7 + row * 11 + (seat % 7)) % shirts.length];
      ctx.fillRect(x - 5, y + 1, 10, 9);
      ctx.fillStyle = seat % 3 === 0 ? "#b6907a" : "#d8b59b";
      ctx.beginPath();
      ctx.arc(x, y - 2, 3.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

export function paintBoostballSkyline() {
  const { canvas, context: ctx } = surface(1536, 448);
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#24263e");
  sky.addColorStop(0.49, "#585071");
  sky.addColorStop(0.82, "#b4807d");
  sky.addColorStop(1, "#e9ac79");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const light = ctx.createRadialGradient(1070, 287, 28, 1070, 287, 215);
  light.addColorStop(0, "#f6bd8d96");
  light.addColorStop(1, "#ef9a6f00");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffcf9c";
  ctx.beginPath();
  ctx.arc(1070, 287, 61, 0, Math.PI * 2);
  ctx.fill();
  for (let layer = 0; layer < 3; layer++) {
    const spacing = 29 + layer * 16;
    for (let i = -1; i * spacing < canvas.width; i++) {
      const x = i * spacing + layer * 28;
      const top =
        (layer + 1) * 25 + 223 + Math.abs((i * 71 + layer * 17) % 113);
      const w = spacing - 3 - Math.abs((i * 7) % 16);
      ctx.fillStyle = ["#665470", "#434460", "#262e46"][layer];
      ctx.fillRect(x, top, w, canvas.height - top);
      if (i % 5 === 0) ctx.fillRect(x + w * 0.28, top - 19, w * 0.35, 22);
      for (let y = top + 10; y < canvas.height - 12; y += 12) {
        for (let j = x + 5; j < x + w - 4; j += 8) {
          if ((j * 5 + y * 7 + i * 17) % 13 < 5) {
            ctx.fillStyle = layer === 2 ? "#f4bd805c" : "#fac0952b";
            ctx.fillRect(j, y, 3, 4);
          }
        }
      }
    }
  }
  return canvas;
}
