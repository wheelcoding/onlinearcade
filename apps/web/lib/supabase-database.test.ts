import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
test("Supabase migration enforces ownership, idempotency, limits and per-track community ranking", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated; INSERT INTO auth.users VALUES ('${alice}'),('${bob}');`,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../../../supabase/migrations/001_onlinearcade.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const asUser = async (id: string) => {
      await db.exec(
        `RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`,
      );
    };
    const run = async (
      id: string,
      game: string,
      variant: string,
      score: number,
      duration: number | null = null,
      lap: number | null = null,
    ) =>
      db.query("SELECT public.oa_submit_run($1,$2,$3,$4,$5,$6)", [
        id,
        game,
        variant,
        score,
        duration,
        lap,
      ]);
    await asUser(alice);
    await db.query("SELECT public.oa_profile($1)", ["Alice"]);
    const event = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await run(event, "starfall", "default", 100);
    await run(event, "starfall", "default", 100);
    let own = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.oa_runs",
    );
    assert.equal(own.rows[0].count, 1);
    await assert.rejects(
      run(event, "starfall", "default", 200),
      /already used/,
    );
    await assert.rejects(
      run(crypto.randomUUID(), "prism-break", "default", 2500),
      /Invalid game score/,
    );
    await assert.rejects(
      run(
        crypto.randomUUID(),
        "sunset-circuit",
        "bad-track",
        9000,
        90000,
        29000,
      ),
      /Invalid track timing/,
    );
    await assert.rejects(
      db.query("SELECT public.oa_profile('<script>')"),
      /letters/,
    );
    await run(
      crypto.randomUUID(),
      "sunset-circuit",
      "sunset-bay",
      999999,
      90000,
      29000,
    );
    await run(
      crypto.randomUUID(),
      "sunset-circuit",
      "alpine-pass",
      999999,
      120000,
      39000,
    );
    await asUser(bob);
    await db.query("SELECT public.oa_profile($1)", ["Bob"]);
    own = await db.query("SELECT count(*)::int AS count FROM public.oa_runs");
    assert.equal(own.rows[0].count, 0);
    await assert.rejects(
      db.query(
        `INSERT INTO public.oa_runs(event_id,user_id,game_id,score) VALUES ('${crypto.randomUUID()}','${alice}','starfall',900)`,
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        `UPDATE public.oa_profiles SET display_name='Stolen' WHERE user_id='${alice}'`,
      ),
      /permission denied/,
    );
    await run(crypto.randomUUID(), "starfall", "default", 300);
    await run(
      crypto.randomUUID(),
      "sunset-circuit",
      "sunset-bay",
      1,
      80000,
      26000,
    );
    await assert.rejects(
      run(event, "starfall", "default", 100),
      /already used/,
    );
    const board = await db.query<{
      display_name: string;
      duration_ms: number;
      is_self: boolean;
    }>("SELECT * FROM public.oa_leaderboard('sunset-circuit','sunset-bay',25)");
    assert.deepEqual(
      board.rows.map((r) => r.display_name),
      ["Bob", "Alice"],
    );
    assert.equal(Number(board.rows[0].duration_ms), 80000);
    assert.equal(board.rows[0].is_self, true);
    const progress = await db.query<{ data: any }>(
      "SELECT public.oa_get_progress() AS data",
    );
    assert.equal(progress.rows[0].data.games.starfall.best, 300);
    assert.equal(progress.rows[0].data.races["alpine-pass"], undefined);
    assert.equal(progress.rows[0].data.races["sunset-bay"].bestTimeMs, 80000);
    await db.exec(
      "RESET ROLE; SET ROLE anon; SELECT set_config('request.jwt.claim.sub','',false)",
    );
    await assert.rejects(
      db.query("SELECT * FROM public.oa_profiles"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("SELECT public.oa_get_progress()"),
      /permission denied/,
    );
    const publicBoard = await db.query<{
      display_name: string;
      is_self: boolean;
    }>("SELECT * FROM public.oa_leaderboard('starfall','default',25)");
    assert.deepEqual(
      publicBoard.rows.map((r) => r.display_name),
      ["Bob", "Alice"],
    );
    assert.equal(
      publicBoard.rows.some((r) => r.is_self),
      false,
    );
    await asUser(alice);
    for (let n = 0; n < 27; n++)
      await run(crypto.randomUUID(), "starfall", "default", 100);
    await assert.rejects(
      run(crypto.randomUUID(), "starfall", "default", 100),
      /Too many results/,
    );
    await run(event, "starfall", "default", 100);
  } finally {
    await db.close();
  }
});
