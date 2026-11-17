-- Future PostgreSQL migration; apply after 001 when an authenticated backend is provisioned.
BEGIN;
INSERT INTO game_rules (game_id,rules_version) VALUES ('sunset-circuit','2');
CREATE TABLE game_variants (
 game_id text NOT NULL,
 rules_version text NOT NULL,
 variant_id text NOT NULL,
 PRIMARY KEY (game_id,rules_version,variant_id),
 FOREIGN KEY (game_id,rules_version) REFERENCES game_rules(game_id,rules_version)
);
INSERT INTO game_variants SELECT game_id,rules_version,'default' FROM game_rules;
INSERT INTO game_variants VALUES
 ('sunset-circuit','2','sunset-bay'),('sunset-circuit','2','alpine-pass'),
 ('sunset-circuit','2','ember-canyon'),('sunset-circuit','2','midnight-harbor');
ALTER TABLE game_runs ADD COLUMN variant_id text NOT NULL DEFAULT 'default';
ALTER TABLE game_runs ADD COLUMN duration_ms integer CHECK (duration_ms > 0);
ALTER TABLE game_runs ADD COLUMN best_lap_ms integer CHECK (best_lap_ms > 0 AND best_lap_ms <= duration_ms);
ALTER TABLE game_runs ADD CONSTRAINT game_runs_variant_fk FOREIGN KEY (game_id,rules_version,variant_id) REFERENCES game_variants(game_id,rules_version,variant_id);
DROP VIEW best_scores;
CREATE VIEW best_scores AS
 SELECT DISTINCT ON (game_id,rules_version,variant_id,season_id,account_id)
 game_id,rules_version,variant_id,season_id,account_id,score,finished_at,id AS run_id
 FROM game_runs WHERE status='verified'
 ORDER BY game_id,rules_version,variant_id,season_id,account_id,score DESC,finished_at,id;
CREATE INDEX verified_track_times ON game_runs (game_id,rules_version,variant_id,season_id,duration_ms,finished_at,id) WHERE status='verified' AND duration_ms IS NOT NULL;
REVOKE ALL ON game_variants,best_scores FROM PUBLIC;
COMMIT;
