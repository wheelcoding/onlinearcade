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
- `packages/games`: Three.js kart scene foundation. Not exposed as playable.

## Neon Dash

Use Left/Right arrows to move and Space/Up to jump. On touch devices tap the game or Jump button. Dodge obstacles, build a score, and restart after a collision. Records persist in this browser, and are not verified global scores. The game loads only when launched.

## Multiplayer scope

Real server-connected presence, private six-character codes, up to eight players, create/join/leave, host transfer on disconnect, and synchronized independent Neon Dash starts. This is a party/session foundation: it does not simulate shared player movement or verify scores. No fabricated player counts, wins, rankings, or game statistics. Rooms and sessions are in memory and reset when the server restarts. Users have local display names, not authenticated accounts.

Server validates actions, names, codes, capacity and host permissions. Each socket has a token bucket (15 burst, 1 request/second refill); payload limit 4 KB. For public production deploy behind a TLS reverse proxy with IP-based connection limits, and add authentication, durable rooms, score verification and a shared Socket.IO adapter before scaling horizontally.

## Production

`npm run build` creates static frontend output at `apps/web/out` and server JS at `apps/server/dist`. Serve the frontend through a static host. Run `npm run start -w @onlinearcade/server` on a Node host with WebSocket support.

Set `NEXT_PUBLIC_MULTIPLAYER_URL` **before building** the web app to your public HTTPS Socket.IO server URL. Set server `WEB_ORIGIN` to the exact frontend origin (comma separated if multiple), and optionally `PORT` (default 3001). See `.env.example`. Without a reachable server the frontend displays an offline state and local Neon Dash remains playable. Sites static hosting cannot run this persistent Node server; deploy it separately.

Future games are explicitly marked in development and have no launch controls. Shooter and puzzle categories show honest empty states. Leaderboards show browser-local runs, high score and total score; verified wins are deferred.
