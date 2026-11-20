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

Real server-connected presence, private six-character room codes, up to eight members, create/join/leave, ready checks, host transfer, host removal controls, room-only chat, and synchronized independent Neon Dash launches. A refresh or temporary disconnect can restore the same member using a private tab-scoped resume token for 45 seconds. Online counts are actual server connections, not unique account counts. Guest names are not verified account identities.

The server validates membership, names, codes, capacity, ready checks, host permissions and chat (1–300 characters, bounded to the latest 50 messages). Each socket has a token bucket (15 burst, 1 action/second refill), a separate chat limiter (5 burst, 1 message per 1.5 seconds), a 4 KB message limit, and connection limits. Resume credentials never appear in room snapshots or chat; leave/kick invalidates them. Rooms/chat are memory-only and reset on server restarts. This does not simulate shared movement or verify competitive scores.

The public service is configured at `https://onlinearcade-multiplayer.onrender.com` through `apps/web/config/multiplayer.json`. See **[multiplayer deployment](docs/multiplayer-deployment.md)** to maintain or replace it. GitHub’s `NEXT_PUBLIC_MULTIPLAYER_URL` variable can override this address and requires a Pages rebuild. Free instances can sleep; automatic reconnect handles cold starts. The website only displays real server connection counts.

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

Five playable games now ship: **Neon Dash** (double-jump runner and collectible shards), **Sunset Circuit** (Three.js kart Grand Prix and ghost Time Trial, 3 laps), **Starfall** (auto-fire survival shooter), **Prism Break** (48-crystal brick breaker), and **Tile Shift** (solvable 15-puzzle). Cloudbound and Party Planet remain marked in development.

Every game includes keyboard/touch controls and restart. New games share pause, fullscreen, instructions, an end-of-run overlay and cleanup of engine resources. The new game art is original inline SVG; the engines draw procedural graphics. No external assets are required.

Scores are per game; old Neon Dash records migrate to the versioned format automatically. Only completed runs are recorded. New engines pause when the page is hidden. Racing uses Three.js when WebGL is available and automatically falls back to a Canvas 2D chase view using the same simulation otherwise. Time trial uses sequential track checkpoints; this is casual local scoring, not a server anti-cheat system.

`packages/core` contains game IDs, progress validation, tested puzzle/collision logic and future account/leaderboard service contracts. Read [account architecture](docs/accounts-and-leaderboards.md) for the identity, authenticated API, database, guest-import and score-verification extension plan. Supabase sign-in and cloud sync are available after the dashboard activation described below.

## Sunset Circuit World Tour

The racer now includes four distinct courses: Sunset Bay (coast), Alpine Pass (elevated mountain bends), Ember Canyon (red-rock desert), and Midnight Harbor (neon city/docks). Choose a track and graphics quality in the garage. Complete three laps through all 24 checkpoint sectors in order; reverse driving, skipped gates and off-road gates do not earn lap credit. Roads use continuous spline layouts, elevation, curbs, guardrails, piers, acceleration strips and original procedural scenery with GPU-instanced props.

The version 3 handling runs at a fixed 60 Hz independently of rendering. Velocity, tire grip, speed-sensitive steering, braking/reverse, drift slip, slope, shoulder resistance, guardrail deflection and kart collisions are simulated. The chase camera follows momentum; animated front wheels, brake lights, turbo exhaust, skid marks, optional racing-line/braking hints and synthesized engine/gear/drift sounds give feedback without downloaded assets.

- **Grand Prix:** race four explicitly labeled AI drivers with Rookie, Club or Expert pace. They steer, brake and overtake using the same physics; no position teleporting or rubber-banding. Earn podium stars across the four courses to unlock cosmetic paints at 2, 6 and 10 stars.
- **Time Trial:** three-lap timed runs, medal targets, individual lap splits and a translucent personal-best ghost with a live delta. Only faster clean runs without recovery replace the ghost. Replays are bounded, validated and versioned so old handling recordings cannot load.
- **Controls:** W/Up gas, S/Down brake (hold after stopping to reverse), A/Left and D/Right steer. Hold Space/Z while cornering to drift; release after 1.1 seconds of actual slip for a mini-turbo, or 2.3 seconds for a super turbo. Shift spends nitro, which recharges when released. R recovers to the latest checkpoint (+2 seconds), P pauses. Touch provides simultaneous steering/gas/brake/drift/boost, with recovery in the toolbar. Pause clears held inputs; backgrounding freezes the clock.

Career stars, paint and ghosts are **browser-local**, isolated by account ID or guest. Signed-in **Time Trial** results still sync through the existing Supabase community-records API (payload rulesVersion 2); Grand Prix never uploads into that board. Existing times remain historical casual/unverified records across handling changes, not a competitive season. No database migration is needed for this update. Cross-device career/ghost storage and verified competitive rankings remain future work.

The regression suite drives every circuit using the real simulation and checks AI completion, steering direction, fixed-step consistency, braking, drift release, collisions, recovery, ghost interpolation and account-isolated career saves.

## Supabase accounts and cloud records

Email/password sign-up, sign-in, email confirmation, password reset, public display names, cross-device records and per-game/per-track **community (unverified)** boards are implemented. Activate them using [Supabase setup](docs/supabase-setup.md): run the Supabase migration, configure Auth redirects/email delivery, add the two public repository build variables, then run a new Pages deployment. Never use a secret/service-role key in the frontend. The optional backend activation does not affect guest play or require moving the site off GitHub Pages.

## Deluxe arcade update

All five playable games now have richer procedural graphics and feedback. The four 2D games share a fixed-step 120 Hz simulation and an accessible game shell with pause, restart, touch controls, fullscreen, loading/error states and optional synthesized sound. No external art/audio assets are downloaded.

- **Neon Dash:** three shields, consistent double jumps, buffered jump input, shard chains up to ×5, phase dashing with rechargeable energy, spike/double-spike/drone patterns, animated runner, rain and a layered neon skyline.
- **Starfall:** scouts, weaving drones and aimed-fire gunners, escalating finite waves, a damageable dreadnought every third wave, a rechargeable nova burst, shield/triple-shot pickups, kill chains, detailed ships and planetary scenery.
- **Prism Break:** three distinct sectors, two-hit armored crystals, accurate fixed-step ball contacts, ricochet chains, wide-paddle/slow-field pickups, faceted crystals and a persistent ball trail. Challenge scoring combines sector progress and chain skill into the existing 0–2,400 cloud score range in 50-point increments.
- **Tile Shift:** Easy/Normal/Hard solvable shuffles, a larger square board for mobile, smooth tile movement, legal-neighbor and correct-position feedback, undo (120-point penalty), and a legal suggested-move hint (600-point penalty). Hints use Manhattan distance and do not claim to be an optimal puzzle solver. U/H also invoke these assists.
- **Sunset Circuit:** biome-specific atmosphere (snow, dust, rain and sun motes), more detailed fallback scenery and visible boost strips, explicit Time Trial medal targets and a result-based driving tip. Existing driving physics, local career/ghost format and cloud timing contracts are preserved.

Only finished runs submit scores. The existing Supabase migration remains compatible: shooter bonuses stay in 100-point increments, puzzle penalties preserve 10-point increments, and Prism stays within its server-enforced score limit. Regression tests submit scores produced by the new simulation through the actual SQL RPC in PGlite. Historical community results remain casual and unverified across gameplay updates. No database migration or new credentials are needed.

### Neon Dash stability fixes

Spike rendering and collision now share the same two-spike geometry. Collision follows the triangular silhouette with a small forgiveness margin, so empty corners beside a spike's tip cannot damage the runner. Jump height is consistent, rapid taps queue individually, and keyboard/canvas/touch inputs no longer cancel one another. Pause and focus loss clear queued input. The runner stays visible during damage protection, with reduced shake. City windows/buildings are baked into three scrolling textures instead of rebuilt every frame; textures are cleaned up on restart and close.

### Shared Sunset Circuit races

Create a party, invite up to seven friends, choose **Sunset Circuit** and one of the four tracks, then have everyone ready up. The host starts one shared three-lap race. All karts are real party members; the Node server runs physics, collisions, boost, checkpoint validation and finish timing at 60 Hz, with room-only snapshots at 15 Hz and interpolated rendering. Keyboard and mobile controls send bounded inputs at 30 Hz, never positions or scores. Recovering adds two seconds. The race continues when a tab loses focus; stale/disconnected controls stop accelerating after 300 ms. Brief disconnections can resume through the existing party token; explicitly returning to the party withdraws an unfinished kart. Races expire after ten minutes. Online race results are party-local and do not enter solo careers or cloud leaderboards.

The server build bundles the shared TypeScript physics with esbuild so Render runs plain Node.js without a TypeScript runtime. The free Render instance holds rooms and races in memory; deployments clear active races. At most 12 races run concurrently per server instance. Shared racing requires the updated server (the health response includes `shared-kart-racing` in `features`).

### Party Planet

Party Planet is a Phaser game with three 20-second rounds: **Star Scramble** (10 points per star), **Meteor Mayhem** (survival points, telegraphed hazards and a short hit shield), and **Color Clash** (reach the safe numbered/dotted tile every four seconds). Hits/unsafe tiles cost three points, never below zero; ties share the top score. WASD, arrows and multi-touch directions work. Solo practice has exactly one player and no bots; it can restart without an account or server. Practice and party scores do not enter solo cloud leaderboards.

For a shared match, create/join a party, choose **Party Planet**, ready everyone and start. The server owns movement, collisions, pickups, round timers and scores. Membership, session IDs, increasing input sequences, bounds, per-socket throttles and stale-input timeouts are enforced. Rooms are isolated. The existing reconnect grace applies; explicitly closing the match withdraws the player. New matches cannot interrupt an active race or Party Planet match. The health response and Socket.IO `capabilities` advertise `party-planet`. Older deployments show an update-needed message and cannot start Party Planet; use **Render → Manual Deploy → Deploy latest commit** if auto-deployment is not enabled.
