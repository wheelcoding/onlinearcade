# OnlineArcade

An original, responsive browser arcade built with Next.js, React, TypeScript, Tailwind, Phaser, Three.js, Node.js and Socket.IO. Artwork is original CSS and procedural Phaser graphics; no downloaded assets or keys required.

## Local development

Requires Node.js 22+ and npm 10+.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The multiplayer server runs on http://localhost:3001. Open a second browser/tab to test creating and joining a private party.

```sh
npm run check
npm test
npm run build
```

## Workspaces

- `apps/web`: Next.js app, Tailwind styling, game catalog, local profile/records, lazy-loaded Phaser game.
- `apps/server`: Node HTTP / Socket.IO party server, integration tests.
- `packages/games`: reusable Three.js scene experiments. The playable kart engine lives in `apps/web/components/games`.
- `packages/core`: shared game IDs, records, puzzle/collision logic, and future account/leaderboard contracts.

## Neon Dash

Use Left/Right arrows or A/D to move and Space/Up to double jump. Collect gold shards for a score bonus. On touch devices tap the game or Jump button. Dodge obstacles, build a score, and restart after a collision. Records persist in this browser, and are not verified global scores. The game loads only when launched.

## Multiplayer scope

Real server-connected presence, private six-character codes, up to eight players, create/join/leave, host transfer on disconnect, and synchronized independent Neon Dash starts. This is a party/session foundation: it does not simulate shared player movement or verify scores. No fabricated player counts, wins, rankings, or game statistics. Rooms and sessions are in memory and reset when the server restarts. Users have local display names, not authenticated accounts.

Server validates actions, names, codes, capacity and host permissions. Each socket has a token bucket (15 burst, 1 request/second refill); payload limit 4 KB. For public production deploy behind a TLS reverse proxy with IP-based connection limits, and add authentication, durable rooms, score verification and a shared Socket.IO adapter before scaling horizontally.

## Production

`npm run build` creates static frontend output at `apps/web/out` and server JS at `apps/server/dist`. Serve the frontend through a static host. Run `npm run start -w @onlinearcade/server` on a Node host with WebSocket support.

Set `NEXT_PUBLIC_MULTIPLAYER_URL` **before building** the web app to your public HTTPS Socket.IO server URL. Set server `WEB_ORIGIN` to the exact frontend origin (comma separated if multiple), and optionally `PORT` (default 3001). See `.env.example`. Without a reachable server the frontend displays an offline state and local Neon Dash remains playable. Sites static hosting cannot run this persistent Node server; deploy it separately.

Future games are explicitly marked in development and have no launch controls. Leaderboards show browser-local per-game runs, high score and total score; verified wins are deferred.

## GitHub Pages

The `Deploy GitHub Pages` workflow publishes the static frontend at
https://wheelcoding.github.io/onlinearcade/ using the `/onlinearcade` Next.js base path.
It deploys pushes to `main`; development branches run CI without publishing.

Pages repository settings must use **GitHub Actions** as the build source.
Optionally set the repository Actions variable `NEXT_PUBLIC_MULTIPLAYER_URL`
to your separately hosted HTTPS Socket.IO server before deploying; set that
server's `WEB_ORIGIN=https://wheelcoding.github.io`. Without this variable,
Pages serves the complete solo game and displays multiplayer as offline.

To build the Pages version locally:

```sh
NEXT_PUBLIC_BASE_PATH=/onlinearcade npm run build
```

## Expanded arcade

Five playable games now ship: **Neon Dash** (double-jump runner and collectible shards), **Sunset Circuit** (Three.js 3D kart time trial, 3 laps), **Starfall** (auto-fire survival shooter), **Prism Break** (48-crystal brick breaker), and **Tile Shift** (solvable 15-puzzle). Cloudbound and Party Planet remain marked in development.

Every game includes keyboard/touch controls and restart. New games share pause, fullscreen, instructions, an end-of-run overlay and cleanup of engine resources. The new game art is original inline SVG; the engines draw procedural graphics. No external assets are required.

Scores are per game; old Neon Dash records migrate to the versioned format automatically. Only completed runs are recorded. New engines pause when the page is hidden. 3D racing requires WebGL and shows an error if unavailable. Time trial uses sequential track checkpoints; this is casual local scoring, not a server anti-cheat system.

`packages/core` contains game IDs, progress validation, tested puzzle/collision logic and future account/leaderboard service contracts. Read [account architecture](docs/accounts-and-leaderboards.md) for the identity, authenticated API, database, guest-import and score-verification extension plan. Supabase sign-in and cloud sync are available after the dashboard activation described below.

## Sunset Circuit World Tour

The racer now includes four distinct courses: Sunset Bay (coast), Alpine Pass (elevated mountain bends), Ember Canyon (red-rock desert), and Midnight Harbor (neon city/docks). Choose a track and graphics quality in the garage. Complete three laps through all 24 checkpoint sectors in order; reverse driving, skipped gates and off-road gates do not earn lap credit. Roads use continuous spline layouts, elevation, curbs, guardrails, piers, acceleration strips and original procedural scenery with GPU-instanced props.

W/Up accelerates, S/Down brakes, A/Left and D/Right steer, Shift spends recharging boost, and Space recovers to the last checkpoint with a two-second penalty. Touch buttons provide the same actions. The race UI includes a countdown, live minimap, speed/boost gauges, lap timer and per-track best race/lap times. Fullscreen, pause, restart and track switching are available. New track times are separate from the original oval's arcade points. These are casual local records, not verified online rankings.

## Supabase accounts and cloud records

Email/password sign-up, sign-in, email confirmation, password reset, public display names, cross-device records and per-game/per-track **community (unverified)** boards are implemented. Activate them using [Supabase setup](docs/supabase-setup.md): run the Supabase migration, configure Auth redirects/email delivery, add the two public repository build variables, then run a new Pages deployment. Never use a secret/service-role key in the frontend. The optional backend activation does not affect guest play or require moving the site off GitHub Pages.
