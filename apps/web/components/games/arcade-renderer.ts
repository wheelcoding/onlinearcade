import type Phaser from "phaser";
import { runnerSpikeOffsets, type ArcadeSimulation } from "@onlinearcade/core";
import { createNeonCity } from "./neon-city";
export function createArcadeArt(scene: Phaser.Scene, kind: string) {
  const city = kind === "neon-dash" ? createNeonCity(scene) : null;
  const g = scene.add.graphics(),
    fx = scene.add.graphics();
  const labels = Array.from({ length: 40 }, () =>
    scene.add.text(0, 0, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#f6ebd0",
    }),
  );
  const particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    max: number;
    color: number;
  }[] = [];
  const text = (
    i: number,
    value: string,
    x: number,
    y: number,
    size = 18,
    color = "#f6ebd0",
    center = false,
  ) => {
    const label = labels[i];
    label.setVisible(true);
    if (label.text !== value) label.setText(value);
    if (label.style.fontSize !== size + "px") label.setFontSize(size);
    if (label.style.color !== color) label.setColor(color);
    label.setPosition(x, y).setOrigin(center ? 0.5 : 0, 0);
    return label;
  };
  function glow(x: number, y: number, r: number, color: number) {
    g.fillStyle(color, 0.035);
    g.fillCircle(x, y, r * 2);
    g.fillStyle(color, 0.09);
    g.fillCircle(x, y, r);
  }
  function poly(points: number[], color: number, alpha = 1) {
    g.fillStyle(color, alpha);
    g.fillPoints(
      Array.from({ length: points.length / 2 }, (_, i) => ({
        x: points[i * 2],
        y: points[i * 2 + 1],
      })),
      true,
    );
  }
  function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    r = 6,
    alpha = 1,
  ) {
    g.fillStyle(color, alpha);
    g.fillRoundedRect(x, y, w, h, r);
  }
  return {
    draw: (
      sim: ArcadeSimulation,
      dt: number,
      pointer: { x: number; y: number } | null,
    ) => {
      g.clear();
      fx.clear();
      labels.forEach((l) => l.setVisible(false));
      const t = sim.time,
        w = kind === "tile-shift" ? 400 : 960,
        h = kind === "tile-shift" ? 400 : 540;
      g.fillStyle(
        kind === "neon-dash"
          ? 0x12142b
          : kind === "tile-shift"
            ? 0x112733
            : 0x0d172b,
      );
      if (!city) g.fillRect(0, 0, w, h);
      city?.update(t);
      if (kind !== "tile-shift")
        for (let i = 0; i < 90; i++) {
          const z = 0.3 + (i % 5) * 0.25,
            x = (i * 137.43) % 960,
            y =
              kind === "neon-dash"
                ? (i * 53.1) % 300
                : (i * 71.3 + t * z * 35) % 540;
          g.fillStyle(0xc3d9f4, 0.18 + z * 0.3);
          g.fillCircle(x, y, z);
        }
      if (kind === "neon-dash") {
        glow(760, 140, 90, 0xcba0cf);
        for (let i = 0; i < 10; i++) {
          const y = 65 + i * 15,
            half = Math.sqrt(Math.max(0, 82 ** 2 - (y - 140) ** 2));
          rect(760 - half, y, half * 2, 9, i < 4 ? 0xf0b2ac : 0xad87ca, 1, 0.8);
        }
        rect(0, 440, 960, 100, 0x1b2038, 0);
        for (let i = 0; i < 18; i++) {
          const x = (i * 70 - sim.distance) % 1260;
          g.lineStyle(1, 0x536b97, 0.25);
          g.lineBetween(x, 444, x - 90, 540);
        }
        for (let i = 0; i < 5; i++) {
          g.lineStyle(1, 0x8a7cab, 0.18);
          g.lineBetween(0, 455 + i * 22, 960, 455 + i * 22);
        }
        rect(0, 440, 960, 3, 0x80f4da, 0);
        rect(0, 447, 960, 1, 0x9aa8ee, 0, 0.4);
        for (let i = 0; i < 25; i++) {
          const x = (i * 67 - t * 180) % 1000,
            y = (i * 39 + t * 250) % 440;
          g.lineStyle(1, 0x95cde8, 0.13);
          g.lineBetween(x, y, x - 5, y + 13);
        }
        for (const o of sim.obstacles) {
          const secondsAway = (o.x - sim.player.x) / sim.speed;
          const danger = secondsAway > 0 && secondsAway < 0.5 && sim.dash <= 0;
          glow(
            o.x + o.width / 2,
            o.y + o.height / 2,
            danger ? 42 : 26,
            danger ? 0xff985c : 0xf18da9,
          );
          if (danger) {
            rect(o.x - 9, 446, o.width + 18, 5, 0xffad73, 2, 0.72);
            for (let n = 0; n < o.width; n += 12) {
              g.lineStyle(2, 0xffdfad, 0.58);
              g.lineBetween(o.x + n, 457, o.x + n + 8, 450);
            }
          }
          if (o.kind === "drone") {
            rect(o.x, o.y, o.width, o.height, 0x5a3b69, 9);
            rect(o.x + 5, o.y + 6, o.width - 10, 5, 0xf8a3c6, 2);
            g.lineStyle(2, 0xeb9aba);
            for (const x of [o.x - 7, o.x + o.width + 7]) {
              g.strokeEllipse(
                x,
                o.y + 12,
                23,
                Math.max(3, Math.abs(Math.sin(t * 30)) * 10),
              );
            }
            rect(o.x + 13, o.y + 20, 14, 4, 0x22253c, 2);
          } else {
            for (const x of runnerSpikeOffsets(o.kind)) {
              poly(
                [o.x + x, o.y + 43, o.x + x + 20, o.y, o.x + x + 40, o.y + 43],
                0xd77298,
              );
              poly(
                [
                  o.x + x + 20,
                  o.y,
                  o.x + x + 25,
                  o.y + 43,
                  o.x + x + 40,
                  o.y + 43,
                ],
                0xf1a8c2,
              );
              g.lineStyle(2, 0xfbd1d7);
              g.lineBetween(o.x + x + 20, o.y + 3, o.x + x + 34, o.y + 35);
            }
            rect(o.x - 3, o.y + 40, o.width + 6, 5, 0x743d70, 2);
          }
        }
        for (const gem of sim.gems) {
          const y = gem.y + Math.sin(t * 4 + gem.phase) * 3;
          glow(gem.x, y, 13, 0xf6c67d);
          poly(
            [gem.x, y - 13, gem.x + 9, y, gem.x, y + 13, gem.x - 9, y],
            0xffd899,
          );
          poly(
            [gem.x, y - 13, gem.x + 2, y, gem.x, y + 13, gem.x - 9, y],
            0xeaa465,
          );
        }
        const p = sim.player;
        for (let i = 1; i < 8; i++)
          rect(
            p.x - 18 - i * 8,
            p.y - 14 + i,
            28 - i * 2,
            32 - i * 3,
            sim.dash > 0 ? 0xb99ae9 : 0x87e6cb,
            6,
            0.1 - i * 0.009,
          );
        {
          if (sim.invulnerable > 0) {
            g.lineStyle(2, 0xffd8a6, 0.6);
            g.strokeEllipse(p.x, p.y, 51, 59);
          }
          glow(p.x, p.y, 30, sim.dash > 0 ? 0xc5a5fc : 0x8be4d1);
          rect(p.x - 17, p.y - 21, 34, 42, 0x7fc7bb, 7);
          rect(p.x - 14, p.y - 19, 28, 6, 0xc4ffeb, 3);
          rect(p.x - 8, p.y - 10, 28, 14, 0x394666, 5);
          rect(p.x + 6, p.y - 8, 8, 7, 0xb4dbf6, 2);
          rect(p.x - 18, p.y + 6, 34, 7, 0x427d87, 2);
          for (const side of [-1, 1]) {
            const foot = sim.grounded ? Math.sin(t * 19) * side * 4 : side * 3;
            rect(p.x + side * 9 - 5 + foot, p.y + 14, 11, 7, 0x7ce2ce, 3);
          }
          if (sim.dash > 0) {
            g.lineStyle(3, 0xccb2ff, 0.8);
            g.strokeEllipse(p.x, p.y, 80, 60);
          }
        }
      }
      if (kind === "starfall") {
        for (let i = 0; i < 7; i++)
          glow(
            140 + i * 140,
            180 + Math.sin(i) * 150,
            70,
            i % 2 ? 0x724e9d : 0x355a83,
          );
        glow(790, 180, 110, 0x3b7883);
        g.fillStyle(0x254259);
        g.fillCircle(790, 180, 75);
        g.lineStyle(3, 0x50768a, 0.4);
        g.strokeEllipse(790, 180, 205, 50);
        for (let i = 0; i < 6; i++) {
          g.lineStyle(1, 0x6e92aa, 0.12);
          g.strokeEllipse(790, 180, 150 - i * 10, 22 + i * 12);
        }
        for (const s of sim.shots) {
          glow(s.x, s.y, 7, s.enemy ? 0xf48d9d : 0x98f2dc);
          rect(
            s.x - 2,
            s.y - 10,
            s.enemy ? 6 : 4,
            s.enemy ? 10 : 23,
            s.enemy ? 0xffacaa : 0xd6fff0,
            3,
          );
        }
        for (const e of sim.foes) {
          const x = e.x,
            y = e.y,
            boss = e.kind === "boss";
          glow(x, y, boss ? 80 : 25, 0xa97fba);
          // Telegraph the gunners' real fire timer instead of guessing from the animation.
          if (
            (boss || e.kind === "gunner") &&
            e.fire > 0 &&
            e.fire < 0.3 &&
            y > 20
          ) {
            const radius = (boss ? 34 : 15) + e.fire * 47;
            g.lineStyle(2, 0xffc18b, 1 - e.fire * 2);
            g.strokeCircle(x, y + 18, radius);
            const angle = Math.atan2(sim.player.y - y, sim.player.x - x);
            g.lineStyle(1, 0xffad86, 0.6);
            g.lineBetween(
              x,
              y + 19,
              x + Math.cos(angle) * 64,
              y + 19 + Math.sin(angle) * 64,
            );
          }
          if (boss) {
            poly(
              [
                x - 72,
                y - 22,
                x - 50,
                y - 36,
                x - 12,
                y - 21,
                x,
                y - 40,
                x + 12,
                y - 21,
                x + 50,
                y - 36,
                x + 72,
                y - 22,
                x + 58,
                y + 25,
                x + 12,
                y + 34,
                x,
                y + 22,
                x - 12,
                y + 34,
                x - 58,
                y + 25,
              ],
              0x685379,
            );
            rect(x - 36, y - 16, 72, 35, 0x2d344e, 8);
            glow(x, y, 20, 0xf2b1c8);
            g.fillStyle(0xf1bdd1);
            g.fillCircle(x, y, 10);
            for (const side of [-1, 1]) {
              rect(x + side * 54 - 5, y + 2, 10, 28, 0xd599b9, 2);
              rect(x + side * 28 - 3, y - 31, 6, 12, 0xc6adc9, 2);
            }
            rect(270, 67, 420, 8, 0x293344, 4);
            rect(270, 67, Math.max(1, (e.hp / e.maxHp) * 420), 8, 0xe9a0c1, 4);
            text(4, "DREADNOUGHT", 480, 80, 9, "#eec9dc", true);
          } else {
            const c =
              e.kind === "gunner"
                ? 0xc7a6f2
                : e.kind === "weaver"
                  ? 0xf2bd86
                  : 0xd78fb4;
            poly(
              [
                x,
                y + 23,
                x - 25,
                y - 13,
                x - 12,
                y - 21,
                x,
                y - 9,
                x + 12,
                y - 21,
                x + 25,
                y - 13,
              ],
              c,
            );
            poly([x, y + 12, x - 10, y - 9, x + 10, y - 9], 0x3f3859);
            rect(x - 3, y - 6, 6, 10, 0xffddd1, 2);
            for (let n = 0; n < e.hp; n++)
              rect(x - 13 + n * 10, y - 31, 7, 3, c, 1);
          }
        }
        const p = sim.player;
        if (sim.energy >= 100) {
          const pulse = 1 + Math.sin(t * 4) * 0.09;
          g.lineStyle(2, 0x8ff7ed, 0.8);
          g.strokeCircle(p.x, p.y, 37 * pulse);
          g.lineStyle(1, 0xc2edff, 0.35);
          g.strokeCircle(p.x, p.y, 43 * pulse);
        }
        if (sim.invulnerable <= 0 || Math.floor(t * 14) % 2 === 0) {
          glow(p.x, p.y, 40, 0x7fe4ce);
          poly(
            [
              p.x,
              p.y - 28,
              p.x - 13,
              p.y - 3,
              p.x - 30,
              p.y + 24,
              p.x - 11,
              p.y + 19,
              p.x,
              p.y + 25,
              p.x + 11,
              p.y + 19,
              p.x + 30,
              p.y + 24,
              p.x + 13,
              p.y - 3,
            ],
            0x92dfcf,
          );
          poly([p.x, p.y - 17, p.x - 8, p.y + 12, p.x + 8, p.y + 12], 0x35536c);
          rect(p.x - 3, p.y - 13, 6, 13, 0xd1f6ed, 3);
          poly(
            [
              p.x - 8,
              p.y + 22,
              p.x + 8,
              p.y + 22,
              p.x,
              p.y + 35 + Math.sin(t * 50) * 9,
            ],
            0xffc28e,
          );
          g.lineStyle(1, 0x9ce8e8, 0.3);
          g.strokeCircle(p.x, p.y, 40 + Math.sin(t * 3) * 2);
        }
      }
      if (kind === "prism-break") {
        for (let i = 0; i < 11; i++) {
          g.lineStyle(1, 0x897ec9, 0.09);
          g.lineBetween(480, 80, i * 105 - 50, 540);
        }
        for (let i = 0; i < 9; i++) {
          const y = 75 + i * i * 6;
          g.lineStyle(1, 0x7c97c3, 0.1);
          g.lineBetween(18, y, 942, y);
        }
        glow(480, 150, 150, 0x655a9d);
        rect(8, 54, 5, 455, 0x8785bc, 2, 0.4);
        rect(947, 54, 5, 455, 0x8785bc, 2, 0.4);
        for (const c of sim.crystals) {
          rect(c.x - 3, c.y - 3, c.width + 6, c.height + 6, c.color, 7, 0.08);
          rect(c.x, c.y + 3, c.width, c.height, 0x25344e, 5);
          rect(c.x, c.y, c.width, c.height, c.color, 5);
          poly(
            [
              c.x + 5,
              c.y + 2,
              c.x + c.width - 5,
              c.y + 2,
              c.x + c.width - 14,
              c.y + 8,
              c.x + 12,
              c.y + 8,
            ],
            0xffffff,
            0.35,
          );
          poly(
            [
              c.x + 4,
              c.y + c.height - 2,
              c.x + c.width - 4,
              c.y + c.height - 2,
              c.x + c.width - 12,
              c.y + 15,
              c.x + 12,
              c.y + 15,
            ],
            0x23304d,
            0.15,
          );
          if (c.hp > 1) {
            rect(c.x + 39, c.y + 8, 16, 8, 0x28344b, 2);
            rect(c.x + 44, c.y + 5, 6, 14, 0xf3e6ca, 1, 0.6);
          } else if (c.maxHp > 1) {
            g.lineStyle(1.5, 0x384358, 0.6);
            g.lineBetween(c.x + 35, c.y, c.x + 48, c.y + 13);
            g.lineBetween(c.x + 48, c.y + 13, c.x + 40, c.y + 24);
          }
        }
        sim.trail.forEach((p, i) => {
          g.fillStyle(0xa6e9dc, (i / sim.trail.length) * 0.25);
          g.fillCircle(p.x, p.y, 2 + (i / sim.trail.length) * 5);
        });
        const b = sim.ball;
        glow(b.x, b.y, 18, 0xcff6dd);
        g.fillStyle(0xfff0cd);
        g.fillCircle(b.x, b.y, 8);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(b.x - 2, b.y - 3, 3);
        const x = sim.paddle,
          half = sim.paddleWidth / 2;
        rect(x - half - 4, 487, sim.paddleWidth + 8, 21, 0xb79ce2, 10, 0.17);
        rect(x - half, 490, sim.paddleWidth, 13, 0x9676c5, 6);
        rect(x - half + 5, 490, sim.paddleWidth - 10, 5, 0xd6c1f1, 3);
        rect(x - half + 8, 496, 14, 6, 0x7be4d5, 2);
        rect(x + half - 22, 496, 14, 6, 0x7be4d5, 2);
        if (!b.active && !sim.stageWait && !sim.ended) {
          g.lineStyle(1, 0xc9eadc, 0.3);
          const velocity = sim.prismLaunch;
          for (let i = 1; i <= 12; i++) {
            const step = i * 0.043;
            const predicted = b.x + velocity.vx * step;
            const x =
              predicted < 18
                ? 36 - predicted
                : predicted > 942
                  ? 1884 - predicted
                  : predicted;
            g.fillStyle(0xa5f4e0, 0.9 - i * 0.048);
            g.fillCircle(
              x,
              b.y + velocity.vy * step,
              Math.max(1.6, 4 - i * 0.18),
            );
          }
          text(5, "SPACE / TAP TO LAUNCH", 480, 355, 13, "#cbdedb", true);
        }
        text(
          6,
          `${sim.wide > 0 ? `WIDE ${Math.ceil(sim.wide)}s  ` : ""}${sim.slow > 0 ? `SLOW ${Math.ceil(sim.slow)}s` : ""}`,
          480,
          518,
          9,
          "#cfc0eb",
          true,
        );
      }
      if (kind === "tile-shift") {
        glow(200, 200, 175, 0x5b9187);
        rect(3, 3, 394, 394, 0x0a1c28, 19);
        g.lineStyle(1, 0x99d7c3, 0.35);
        g.strokeRoundedRect(3, 3, 394, 394, 19);
        for (let i = 0; i < 16; i++) {
          const x = 16 + (i % 4) * 94,
            y = 16 + Math.floor(i / 4) * 94;
          rect(x, y, 85, 85, 0x1c3541, 12);
          if (!sim.board[i]) {
            g.lineStyle(1, 0x87b5ba, 0.25);
            g.strokeRoundedRect(x + 5, y + 5, 75, 75, 10);
          }
        }
        sim.board.forEach((n, i) => {
          if (!n) return;
          const from = sim.previousBoard.indexOf(n),
            ratio = 1 - (sim.anim / 0.14) ** 3,
            x = 16 + ((from % 4) * (1 - ratio) + (i % 4) * ratio) * 94,
            y =
              16 +
              (Math.floor(from / 4) * (1 - ratio) + Math.floor(i / 4) * ratio) *
                94,
            correct = n === i + 1,
            gap = sim.board.indexOf(0),
            legal =
              Math.abs(Math.floor(i / 4) - Math.floor(gap / 4)) +
                Math.abs((i % 4) - (gap % 4)) ===
              1,
            hover =
              pointer &&
              pointer.x > x &&
              pointer.x < x + 85 &&
              pointer.y > y &&
              pointer.y < y + 85;
          rect(x, y + 4, 85, 85, correct ? 0x477e77 : 0x3e647c, 12);
          rect(
            x,
            y,
            85,
            83,
            correct
              ? 0xa8d4bd
              : [0x91bad0, 0x9ec6cd, 0x8fafca, 0xa9bcda][
                  Math.floor((n - 1) / 4)
                ],
            12,
          );
          rect(x + 7, y + 5, 71, 5, 0xe9ffff, 3, 0.25);
          rect(x + 7, y + 70, 71, 6, 0x365b70, 2, 0.12);
          if (legal) {
            g.lineStyle(hover ? 3 : 1, 0xffe0a1, hover ? 0.9 : 0.35);
            g.strokeRoundedRect(x + 2, y + 2, 81, 79, 10);
          }
          if (i === sim.hintTile) {
            g.lineStyle(3, 0xffdb92, 0.65 + Math.sin(t * 5) * 0.3);
            g.strokeRoundedRect(x - 2, y - 2, 89, 87, 14);
          }
          text(5 + n, String(n), x + 42, y + 23, 30, "#203b4b", true);
          if (correct) {
            g.fillStyle(0x477e77, 0.5);
            g.fillCircle(x + 72, y + 13, 3);
          }
        });
      }
      if (kind !== "tile-shift")
        for (const d of sim.drops) {
          glow(d.x, d.y, 21, 0xb6f1d2);
          g.lineStyle(2, 0xb4e6cc);
          g.strokeCircle(d.x, d.y, 14);
          if (d.kind === "shield") {
            rect(d.x - 3, d.y - 9, 6, 18, 0xb9ecd8, 1);
            rect(d.x - 9, d.y - 3, 18, 6, 0xb9ecd8, 1);
          } else if (d.kind === "power") {
            poly([d.x, d.y - 8, d.x - 8, d.y + 7, d.x + 8, d.y + 7], 0xb9ecd8);
          } else {
            rect(d.x - 9, d.y - 4, 18, 8, 0xd5bcf0, 3);
          }
        }
      for (const ev of sim.takeEvents()) {
        const x = kind === "tile-shift" ? ev.x - 276 : ev.x,
          y = kind === "tile-shift" ? ev.y - 49 : ev.y,
          count = ev.kind === "shot" ? 0 : ev.kind === "clear" ? 20 : 10;
        for (let i = 0; i < count && particles.length < 280; i++) {
          const a = i * 2.4,
            s = 40 + (i % 5) * 28,
            life = 0.25 + (i % 4) * 0.12;
          particles.push({
            x,
            y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            life,
            max: life,
            color: ev.color,
          });
        }
        if (ev.kind === "hit" && ev.amount !== 3)
          scene.cameras.main.shake(
            kind === "neon-dash" ? 60 : 90,
            kind === "neon-dash" ? 0.0008 : 0.003,
          );
        scene.game.events.emit("arcade:sound", ev.kind);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 70 * dt;
        fx.fillStyle(p.color, p.life / p.max);
        fx.fillCircle(p.x, p.y, 2 + p.life * 2);
      }
      if (sim.countdown > 0) {
        rect(0, 0, w, h, 0x0b1324, 0, 0.35);
        text(36, "GET READY", w / 2, h / 2 - 55, 12, "#c6dedc", true);
        text(
          37,
          String(Math.ceil(sim.countdown)),
          w / 2,
          h / 2 - 27,
          70,
          "#fff1cf",
          true,
        );
      } else if (sim.messageTime > 0 && !sim.ended) {
        const y =
          kind === "tile-shift"
            ? 5
            : kind === "starfall"
              ? 130
              : kind === "prism-break"
                ? 340
                : 110;
        text(
          38,
          sim.message,
          w / 2,
          y,
          kind === "tile-shift" ? 11 : 16,
          "#f5d6a2",
          true,
        );
      }
    },
    dispose: () => {
      city?.dispose();
      g.destroy();
      fx.destroy();
      labels.forEach((l) => l.destroy());
    },
  };
}
