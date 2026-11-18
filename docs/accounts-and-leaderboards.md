# Account and leaderboard extension points

Supabase email/password accounts, cloud records and community leaderboards are now implemented; activate them using [Supabase setup](supabase-setup.md). Guest history stays local. Community results are explicitly unverified. The provider-agnostic design below describes the additional backend work required for replay-verified competitive rankings.

## Boundaries already implemented

`@onlinearcade/core` owns stable `GameId` values, versioned `LocalProgress`, per-game stats, legacy migration, and the `AuthProvider` and `LeaderboardService` contracts. The web app persists through a `ProgressRepository` boundary. Phaser and Three.js engines emit completion scores; they do not read localStorage or know about accounts. Game IDs never depend on display titles. `apps/server/migrations/001_accounts_and_leaderboards.sql` provides a future PostgreSQL schema, not an active database.

## Add accounts later

1. Choose an OIDC identity provider or hosted auth service. Implement `AuthProvider` using its maintained SDK. Use authorization code + PKCE, verify issuer/audience/expiry on the backend, and map `(provider, subject)` to an immutable internal account UUID. Never treat a local nickname or party socket ID as account identity. Do not implement password storage in the arcade.
2. Host the authenticated API separately from GitHub Pages. Set exact CORS allowlists, use HTTPS and short-lived tokens (or secure, HTTP-only session cookies with CSRF protection). Keep all secret keys and database access on the backend. Public frontend configuration is not secret.
3. Render provider-backed sign-in/profile state only after an adapter is configured. Guests should still be able to play every solo game. Authenticated profiles and stats are loaded from the server, so signing into another device retrieves the same account.
4. Apply and evolve the migration on a private PostgreSQL instance. Provision a least-privilege server role; do not expose direct database writes to clients. Define seasons explicitly before opening ranked runs.

## API contract to implement

- `GET /v1/me`: authenticated account; 401 means guest/expired session.
- `GET /v1/leaderboards/:gameId?seasonId=...&cursor=...`: `LeaderboardService.getBoard` output, ordered by score descending, then achievedAt and accountId for deterministic ties. Cursor pagination and rank must use the same order and a consistent snapshot.
- `POST /v1/runs` with gameId: server obtains accountId from verified identity, fixes rulesVersion/season/seed, and returns a one-use `RunTicket` with expiry.
- `POST /v1/runs/:runId/finish` with timestamped inputs: verify ownership, expiry and replay limits; atomically move the run to pending once. Repeated requests return the existing outcome. A background verifier updates to verified/rejected. Never accept an arbitrary client score as verified.
- `GET /v1/me/progress`: per-game server progress for cross-device profiles.

Current games use frame-based/browser input and some non-seeded randomness. Before enabling **ranked** results, extract fixed-timestep, versioned deterministic simulations and seeded generators into the shared package, record bounded input logs, and replay them server-side. Contracts and SQL are prepared; the anti-cheat verifier is not implemented. Server-verified leaderboards stay disabled until that work is complete. Private party runs remain independent, casual sessions.

## Guest migration and privacy

`oa-progress-v2` separates scores by game and validates finite nonnegative integer records. Existing `oa-records` Neon Dash stats are imported only when the new schema is absent/invalid; the original key is left untouched. Signing in later must not silently turn local results into verified ranked runs. Offer an explicit import of **unverified personal history** using an idempotent installation/import ID, and keep it out of global rankings. Signing out must clear cached account data while leaving the guest profile separate. Add account export/deletion, display-name moderation, and retention limits before a public account launch.

## Verification

Shared tests cover separate records, migration, malformed data, deterministic solvable tile shuffles, legal moves and collision boundaries. Party integration tests still use two real Socket.IO clients. The SQL is a reviewed starting schema and has not been executed against a provisioned PostgreSQL database.

## World Tour track identity

Racing rules version 2 introduces stable variant IDs: `sunset-bay`, `alpine-pass`, `ember-canyon`, and `midnight-harbor`. `RaceResult` carries variant, rules version, completed race duration, best lap, and casual points. The browser stores per-track personal race/lap times under `oa-racing-v2`; original oval points remain untouched in generic arcade history and are never imported as new track times. Recovery adds two seconds. The future service contracts accept `variantId`, and migration 002 adds variant keys and time indexes. Any cross-device time board must filter by track, rules version, season and verified state, and order duration ascending with stable ties. The migrations remain unapplied scaffolding; live records remain local and unverified.
