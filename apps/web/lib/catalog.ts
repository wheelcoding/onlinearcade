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
    tag: "DELUXE",
    desc: "Chain the shards. Phase through danger. Own the neon night.",
    playable: true,
    controls:
      "← → / A D move · Space / ↑ double jump · Shift / X phase dash · Tap to jump",
    objective:
      "Three shields, double jumps and a rechargeable phase dash. Chain shards up to ×5 and dodge spikes and hovering drones.",
  },
  {
    id: "sunset-circuit",
    title: "Sunset Circuit",
    category: "Racing",
    type: "3D · GRAND PRIX",
    art: "racing",
    tag: "4 TRACKS · 3D",
    desc: "Drift. Boost. Overtake. Four circuits, one podium.",
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
    tag: "DELUXE",
    desc: "Enemy squadrons. Nova bursts. A dreadnought on the horizon.",
    playable: true,
    controls:
      "Arrow keys / WASD move · Auto-fire · Space nova burst · Drag to steer on touch",
    objective:
      "Clear enemy waves and a boss every third wave. Collect shield/triple-shot upgrades. A fully charged nova clears hostile shots and damages enemies.",
  },
  {
    id: "prism-break",
    title: "Prism Break",
    category: "Arcade",
    type: "2D · SKILL",
    art: "prism",
    tag: "DELUXE",
    desc: "Three sectors. Armored crystals. Find the perfect ricochet.",
    playable: true,
    controls: "← → / A D or pointer to move · Space / tap to launch",
    objective:
      "Clear three sectors with 3 lives. Catch wide-paddle and slow-field power-ups, break armored crystals twice, and build ricochet chains. Challenge score: up to 2,400.",
  },
  {
    id: "tile-shift",
    title: "Tile Shift",
    category: "Puzzles",
    type: "2D · PUZZLE",
    art: "tiles",
    tag: "DELUXE",
    desc: "Slide into place. Three difficulties. One satisfying solution.",
    playable: true,
    controls:
      "Click / tap a tile beside the gap · Arrow keys move the gap · U undo · H hint",
    objective:
      "Arrange tiles 1–15 with the gap at bottom right. Choose Easy, Normal or Hard. Undo costs 120 points; a suggested-move hint costs 600. Hints are legal suggestions, not an optimal solver.",
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
    tag: "3 MINI-GAMES",
    desc: "Grab stars. Dodge meteors. Find your color. Party with friends or practice solo.",
    playable: true,
    controls: "WASD / arrows or touch directions to move",
    objective: "Three rounds. One party champion. Scores stay in the party.",
  },
];
export const rankedGames = games.filter(
  (g) => g.playable && g.id !== "party-planet",
);
export const gameById = (id: string) => games.find((g) => g.id === id)!;
