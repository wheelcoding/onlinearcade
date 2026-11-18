# Activate accounts and community leaderboards

OnlineArcade remains a static GitHub Pages site. Supabase handles email/password authentication and PostgreSQL data. No service-role key or database password belongs in the frontend, repository, Actions variables, or chat.

## 1. Create the database objects

In your Supabase project, open **SQL Editor → New query**, paste the complete contents of [`supabase/migrations/001_onlinearcade.sql`](../supabase/migrations/001_onlinearcade.sql), and run it once. The whole migration is transactional. This creates the `oa_` tables, RLS policies, grants and bounded RPC functions. Do **not** apply `apps/server/migrations/001_*` or `002_*`; those are earlier architecture scaffolding, not the Supabase setup.

Tables expose only authenticated users' own rows. Public leaderboard RPCs return display names and results, not email addresses. Direct browser inserts, updates and deletes are denied. Profile and result writes require authenticated RPCs, results are idempotent by event UUID, and a per-account row lock serializes the 30-results/minute rate limit. Schema changes are not performed with the publishable key.

## 2. Configure Supabase Auth

Under **Authentication → Sign In / Providers**, enable **Email** authentication. Keep email confirmation enabled. The UI supports email/password sign-up, sign-in, forgotten-password reset, and choosing a new password from the recovery link. Supabase Auth handles password hashing and storage; application tables never contain passwords.

Under **Authentication → URL Configuration**:

- Site URL: `https://wheelcoding.github.io/onlinearcade/`
- Allowed Redirect URLs: `https://wheelcoding.github.io/onlinearcade/`
- For local development only, optionally add `http://localhost:3000/`.

The app uses the browser Supabase client and implicit auth callbacks because GitHub Pages has no server callback route. Confirmation and recovery links return to the site root under its base path. The SDK consumes session credentials in the callback URL; the app never logs them. Recovery opens the new-password form automatically.

Supabase's default email delivery has restrictions, including delivery to approved/team addresses and rate limits. Use your project-owner email for initial testing. To open sign-ups to other players, configure **Authentication → Email → SMTP Settings** with a production email provider and verified sender. Check your dashboard's current restrictions; no SMTP password belongs in this repository.

## 3. Configure GitHub Pages builds

Open **GitHub repository → Settings → Secrets and variables → Actions → Variables** and add these **repository variables**:

- `NEXT_PUBLIC_SUPABASE_URL`: your project's HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the `sb_publishable_...` key from Connect.

These two values are intentionally public and become part of the browser bundle. Never use a Supabase secret or `service_role` key. Keep values out of tracked files. The deployment workflow reads these variables at build time.

After setting the variables, open **Actions → Deploy GitHub Pages → Run workflow → main**. Re-running an older workflow attempt can retain an older configuration; start a new manual workflow run. A new push to main also builds with current variables.

For local development, put the public values in ignored `apps/web/.env.local` and run `npm run dev`. Without both values, the app stays in guest mode with local records.

## 4. Verify with real accounts

1. On the live site, open **Sign in / Profile → Create account**. Choose an email and password with at least 8 characters.
2. Confirm the email using the link, sign in, and choose a public display name.
3. Finish a game. Open **Community leaderboard** and verify the result appears. Each racing track has its own time board.
4. Sign into the same account on a second browser/device. Open **My cloud records** and check that game stats and track times are loaded there.
5. Sign out. Guest history stays separate, and account data is removed from visible state. Runs already queued under one account are never sent with another account's credentials.
6. Test **Forgot password?** and the returned new-password form. Do not share test passwords in chat.

The initial integration does not create real test accounts or send emails automatically. Authentication cannot be tested end-to-end without a configured project and an inbox controlled by the tester.

## Scope and score integrity

These are **community, unverified results**, not an anti-cheat ranked service. The backend validates authentication, identity, game/track IDs, score ranges, game-specific bounds and race timing bounds. Racing points are derived on the server from the submitted time. This blocks malformed results but cannot prove that client-reported gameplay occurred. Before enabling verified competitive rankings, implement the deterministic server replay described in `accounts-and-leaderboards.md`.

Only runs completed while signed in are uploaded. Existing guest history is not silently imported. Pending results are kept in an account-scoped outbox (up to 100), retried on reconnect and at one-minute intervals, with the same event IDs to prevent duplicates. Browser storage failures keep pending runs only for that visit. A different account cannot inherit another account's pending runs. Private cloud progress is authoritative after syncing; the public community board is read-only.

## Checks

`npm run check`, `npm test`, and `NEXT_PUBLIC_BASE_PATH=/onlinearcade npm run build` validate the workspaces. The database test executes the actual migration in an isolated PGlite PostgreSQL instance with test Auth roles/identities. It checks RLS, write restrictions, idempotency, account isolation, rate limits, private progress and per-track ordering without connecting to production.
