import type { GameId } from "@onlinearcade/core";
export type GameDefinition = {
  id: GameId | "cloudbound" | "party-planet";
  title: string;
  category: string;
  type: string;
  art: string;
  tag: string;
  desc: string;
  playable: boolean;
  controls: string;
  objective: string;
};
export const games: GameDefinition[] = [
  {
    id: "neon-dash",
    title: "Neon Dash",
    category: "Arcade",
    type: "2D · SOLO",
    art: "neon",
    tag: "REMASTERED",
    desc: "A neon city. A perfect jump. An endless chase.",
    playable: true,
    controls: "← → / A D move · Space / ↑ jump · Tap to jump",
    objective: "Dodge the spikes. Your score increases with survival time.",
  },
  {
    id: "sunset-circuit",
    title: "Sunset Circuit",
    category: "Racing",
    type: "3D · TIME TRIAL",
    art: "racing",
    tag: "4 TRACKS · 3D",
    desc: "Four worlds. New elevations. Own every corner.",
    playable: true,
    controls: "↑ / W accelerate · ↓ / S brake · ← → / A D steer",
    objective:
      "Choose one of four courses and complete three laps through every gate. Brake for the corners and use Shift to boost.",
  },
  {
    id: "starfall",
    title: "Starfall",
    category: "Shooters",
    type: "2D · SURVIVAL",
    art: "space",
    tag: "NEW",
    desc: "One pilot. A sky full of trouble.",
    playable: true,
    controls: "Arrow keys / WASD move · Auto-fire · Drag to steer on touch",
    objective:
      "Destroy incoming drones. You have 3 shields; survive as waves get faster.",
  },
  {
    id: "prism-break",
    title: "Prism Break",
    category: "Arcade",
    type: "2D · SKILL",
    art: "prism",
    tag: "NEW",
    desc: "Find your angle. Shatter the spectrum.",
    playable: true,
    controls: "← → / A D or pointer to move · Space / tap to launch",
    objective:
      "Clear every crystal with 3 lives. Paddle position controls the bounce angle.",
  },
  {
    id: "tile-shift",
    title: "Tile Shift",
    category: "Puzzles",
    type: "2D · PUZZLE",
    art: "tiles",
    tag: "NEW",
    desc: "Fifteen tiles. One satisfying solution.",
    playable: true,
    controls: "Click / tap a tile beside the gap · Arrow keys move the gap",
    objective:
      "Arrange tiles 1–15 from left to right with the gap at the bottom right. Fewer moves and faster solves earn more points.",
  },
  {
    id: "cloudbound",
    title: "Cloudbound",
    category: "Parkour",
    type: "3D · SOLO",
    art: "cloud",
    tag: "IN DEVELOPMENT",
    desc: "The only way is up. A new world is taking shape.",
    playable: false,
    controls: "",
    objective: "",
  },
  {
    id: "party-planet",
    title: "Party Planet",
    category: "Party Games",
    type: "2D · MULTIPLAYER",
    art: "party",
    tag: "IN DEVELOPMENT",
    desc: "Small games. Big friendships. Coming later.",
    playable: false,
    controls: "",
    objective: "",
  },
];
export const playableGames = games.filter((g) => g.playable);
export const gameById = (id: string) => games.find((g) => g.id === id)!;
