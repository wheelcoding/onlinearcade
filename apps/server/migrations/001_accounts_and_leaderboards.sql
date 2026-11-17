-- Future PostgreSQL migration. NOT automatically applied by the in-memory party server.
-- Execute only after selecting an identity provider and provisioning a private database.
BEGIN;
CREATE TABLE accounts (
 id uuid PRIMARY KEY,
 display_name varchar(20) NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 20),
 avatar_url text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_identities (
 provider text NOT NULL,
 provider_subject text NOT NULL,
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 PRIMARY KEY (provider,provider_subject)
);
CREATE TABLE game_rules (
 game_id text NOT NULL,
 rules_version text NOT NULL,
 PRIMARY KEY (game_id,rules_version)
);
INSERT INTO game_rules VALUES ('neon-dash','1'),('sunset-circuit','1'),('starfall','1'),('prism-break','1'),('tile-shift','1');
CREATE TABLE seasons (
 id text PRIMARY KEY,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz,
 CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE game_runs (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 game_id text NOT NULL,
 rules_version text NOT NULL,
 season_id text NOT NULL REFERENCES seasons(id),
 seed bigint NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 finished_at timestamptz,
 status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','pending','verified','rejected')),
 score bigint CHECK (score >= 0 AND score <= 1000000000),
 input_log jsonb,
 FOREIGN KEY (game_id,rules_version) REFERENCES game_rules(game_id,rules_version),
 CHECK (expires_at > started_at),
 CHECK (status <> 'verified' OR (finished_at IS NOT NULL AND score IS NOT NULL))
);
-- Only server-verified runs can appear in global boards. One best row per account/game/season.
CREATE INDEX verified_scores ON game_runs (game_id,season_id,account_id,score DESC,finished_at,id) WHERE status='verified';
CREATE VIEW best_scores AS
 SELECT DISTINCT ON (game_id,season_id,account_id)
 game_id,season_id,account_id,score,finished_at,id AS run_id
 FROM game_runs WHERE status='verified'
 ORDER BY game_id,season_id,account_id,score DESC,finished_at,id;
-- Grant access only to the backend role. Browser clients never receive DB credentials.
REVOKE ALL ON accounts,auth_identities,game_rules,seasons,game_runs,best_scores FROM PUBLIC;
COMMIT;
