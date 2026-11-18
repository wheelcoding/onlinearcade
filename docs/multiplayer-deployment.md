# Put parties and chat online

The website stays on **GitHub Pages**. A separate **Node.js + Socket.IO server** runs rooms and chat. GitHub Pages cannot run this server. Starting `npm run dev` on your computer does not put the server online for your friends.

## 1. Deploy the server to Render

[Deploy the OnlineArcade server on Render](https://render.com/deploy?repo=https://github.com/wheelcoding/onlinearcade)

Sign in to Render, connect the `wheelcoding/onlinearcade` repository, and create the Blueprint. Review the selected **Free** plan before creating the service. The repository's `render.yaml` supplies the build/start commands, health check, Node version and allowed website origin. There are no passwords or API keys to enter.

Wait for the service to say **Live**, then copy its actual public HTTPS URL from Render (ending in `.onrender.com`). Do not guess the hostname. Open `<your-service-url>/health`: it must return `{"status":"ok","service":"onlinearcade-multiplayer","version":2}`. Render automatically provides HTTPS and WebSocket support.

Free Render services sleep when idle. The first connection can take about a minute to wake up; clients retry automatically. This is free hosting, not an always-on uptime guarantee. Rooms/chat are in memory: deployments or service restarts clear them. Use an always-on plan and durable shared storage if continuous availability and history become requirements. One instance only; do not add replicas without a shared room store and Socket.IO adapter.

## 2. Connect GitHub Pages

Open [GitHub Actions variables](https://github.com/wheelcoding/onlinearcade/settings/variables/actions).

Create/update **`NEXT_PUBLIC_MULTIPLAYER_URL`** with the server's actual HTTPS URL, without `/socket.io` or `/health`. This URL is public and belongs in a variable, not a secret. Keep the existing Supabase variables.

Open [Deploy GitHub Pages](https://github.com/wheelcoding/onlinearcade/actions/workflows/pages.yml), choose **Run workflow** on `main`, and wait for the deployment to complete. The endpoint is compiled into the static website, so this rebuild is necessary.

If someone else is helping with setup, send them just the public Render URL. Do not send your Render password, GitHub token, database password or Supabase secret/service-role key.

## 3. Verify with two browsers/devices

1. Open https://wheelcoding.github.io/onlinearcade/ and scroll to Multiplayer. Wait for **Connected to the arcade** or the actual connected player count. Counts represent server connections, not unique accounts.
2. Create a party, copy the six-character code and join from a second browser/device.
3. Send a message in each direction. A different party must not receive either message.
4. Both players click **I'm ready**. The host can now start independent Neon Dash runs together.
5. Refresh one tab: it should resume its member session. On a temporary network loss the member has 45 seconds to reconnect. The host role transfers to a connected member when needed.
6. Leave explicitly to remove a member immediately. The host can remove another member; the removed session cannot resume.

## Troubleshooting

- **Awaiting server activation:** the public frontend build has no valid multiplayer endpoint. Add the variable and redeploy Pages. Production endpoints must use HTTPS and cannot point to localhost.
- **Reconnecting / waking up:** check the Render service, logs and `/health`. A free instance may be sleeping. A Retry button is available; do not repeatedly create services.
- **Health works but the browser cannot connect:** Render `WEB_ORIGIN` must be `https://wheelcoding.github.io` (origin only, no `/onlinearcade` path). If hosting the frontend elsewhere, add its exact origin to the comma-separated list and redeploy the server.
- **Room disappeared:** the server restarted, the host removed you, or every member left/disconnected beyond the grace period. Create a new room.
- **Same session open in another tab:** resume credentials are tab-scoped. Duplicated tabs can copy session storage; create a fresh room/member in the second tab rather than trying to take over an already-connected member.

## What is implemented

Server-validated names, codes, capacity, room membership, host permissions, ready checks, private chat (300 characters, last 50 messages), connection limits, per-socket action limits and a separate chat throttle. Resume tokens are random, owner-only, never exposed in public party state, invalidated on leave/kick, and stored in tab session storage. Display names are guest labels, not verified account identities. Chat is rendered as plain text; no raw HTML or automatic link execution.

The party start is a synchronized launch of **independent** Neon Dash games. Shared racing/player movement and verified competitive party scoring are not implemented. This service doesn't claim those features exist.

Local development: `npm install && npm run dev`. Local server origin defaults to `http://localhost:3000`; frontend defaults to `http://localhost:3001`. Production startup rejects the localhost origin default. The Render blueprint sets `TRUST_PROXY=true` for forwarded client-IP connection limits; do not enable it when directly exposing an untrusted proxy path.
