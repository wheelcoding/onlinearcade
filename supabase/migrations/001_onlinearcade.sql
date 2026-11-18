-- Run this complete file ONCE in Supabase SQL Editor. Do not run the older
-- apps/server/migrations scaffolding: this migration uses Supabase Auth directly.
BEGIN;
CREATE TABLE public.oa_profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 20 AND display_name ~ '^[[:alnum:] _-]+$'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.oa_runs (
 event_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.oa_profiles(user_id) ON DELETE CASCADE,
 game_id text NOT NULL CHECK (game_id IN ('neon-dash','starfall','prism-break','tile-shift','sunset-circuit')),
 variant_id text NOT NULL DEFAULT 'default',
 rules_version integer NOT NULL DEFAULT 1,
 score bigint NOT NULL CHECK (score BETWEEN 0 AND 1000000000),
 duration_ms bigint,
 best_lap_ms bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((game_id='sunset-circuit' AND rules_version=2 AND variant_id IN ('sunset-bay','alpine-pass','ember-canyon','midnight-harbor') AND duration_ms IS NOT NULL AND best_lap_ms IS NOT NULL AND duration_ms BETWEEN 15000 AND 86400000 AND best_lap_ms>=5000 AND best_lap_ms*3<=duration_ms+2)
 OR (game_id<>'sunset-circuit' AND rules_version=1 AND variant_id='default' AND duration_ms IS NULL AND best_lap_ms IS NULL))
);
COMMENT ON TABLE public.oa_runs IS 'Client-reported community results, NOT replay-verified ranked scores.';
CREATE INDEX oa_runs_board ON public.oa_runs(game_id,variant_id,user_id,score DESC,created_at,event_id);
CREATE INDEX oa_runs_times ON public.oa_runs(variant_id,user_id,duration_ms,created_at) WHERE game_id='sunset-circuit';
CREATE INDEX oa_runs_rate ON public.oa_runs(user_id,created_at);
ALTER TABLE public.oa_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oa_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oa_profiles,public.oa_runs FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT ON public.oa_profiles,public.oa_runs TO authenticated;
CREATE POLICY oa_profile_read_own ON public.oa_profiles FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY oa_runs_read_own ON public.oa_runs FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
-- No direct INSERT/UPDATE/DELETE policies or grants. Writes use bounded RPCs.
CREATE FUNCTION public.oa_profile(p_display_name text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_name text:=btrim(p_display_name); v_profile public.oa_profiles;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_display_name IS NOT NULL AND (char_length(v_name) NOT BETWEEN 1 AND 20 OR v_name !~ '^[[:alnum:] _-]+$') THEN RAISE EXCEPTION 'Use 1-20 letters, numbers, spaces, _ or -'; END IF;
 INSERT INTO public.oa_profiles(user_id,display_name) VALUES (v_uid,COALESCE(v_name,'Player '||left(v_uid::text,6))) ON CONFLICT(user_id) DO NOTHING;
 IF p_display_name IS NOT NULL THEN UPDATE public.oa_profiles SET display_name=v_name WHERE user_id=v_uid; END IF;
 SELECT * INTO v_profile FROM public.oa_profiles WHERE user_id=v_uid;
 RETURN jsonb_build_object('id',v_uid,'displayName',v_profile.display_name);
END $$;
CREATE FUNCTION public.oa_submit_run(p_event_id uuid,p_game_id text,p_variant_id text,p_score bigint,p_duration_ms bigint DEFAULT NULL,p_best_lap_ms bigint DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_existing public.oa_runs; v_score bigint:=p_score; v_target integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_event_id IS NULL OR p_game_id IS NULL OR p_variant_id IS NULL OR p_score IS NULL OR p_score<0 OR p_score>1000000000 THEN RAISE EXCEPTION 'Invalid result'; END IF;
 IF p_game_id NOT IN ('neon-dash','starfall','prism-break','tile-shift','sunset-circuit') THEN RAISE EXCEPTION 'Unknown game'; END IF;
 IF p_game_id='sunset-circuit' THEN
  v_target:=CASE p_variant_id WHEN 'sunset-bay' THEN 65 WHEN 'alpine-pass' THEN 90 WHEN 'ember-canyon' THEN 100 WHEN 'midnight-harbor' THEN 95 END;
  IF v_target IS NULL OR p_duration_ms IS NULL OR p_best_lap_ms IS NULL OR p_duration_ms NOT BETWEEN 15000 AND 86400000 OR p_best_lap_ms<5000 OR p_best_lap_ms*3>p_duration_ms+2 THEN RAISE EXCEPTION 'Invalid track timing'; END IF;
  v_score:=greatest(500,round(15000000.0*v_target/p_duration_ms)::bigint);
 ELSE
  IF p_variant_id<>'default' OR p_duration_ms IS NOT NULL OR p_best_lap_ms IS NOT NULL THEN RAISE EXCEPTION 'Invalid game variant'; END IF;
  IF (p_game_id='prism-break' AND (p_score>2400 OR p_score%50<>0)) OR (p_game_id='starfall' AND p_score%100<>0) OR (p_game_id='tile-shift' AND (p_score<100 OR p_score>20000 OR p_score%10<>0)) THEN RAISE EXCEPTION 'Invalid game score'; END IF;
 END IF;
 PERFORM public.oa_profile();
 -- Serialize per-account submissions before checking rate limits and inserting.
 PERFORM 1 FROM public.oa_profiles WHERE user_id=v_uid FOR UPDATE;
 SELECT * INTO v_existing FROM public.oa_runs WHERE event_id=p_event_id;
 IF FOUND THEN
  IF v_existing.user_id<>v_uid OR v_existing.game_id<>p_game_id OR v_existing.variant_id<>p_variant_id OR v_existing.score<>v_score OR v_existing.duration_ms IS DISTINCT FROM p_duration_ms OR v_existing.best_lap_ms IS DISTINCT FROM p_best_lap_ms THEN RAISE EXCEPTION 'Run reference already used'; END IF;
  RETURN;
 END IF;
 IF (SELECT count(*) FROM public.oa_runs WHERE user_id=v_uid AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'Too many results. Try again in a minute.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.oa_runs(event_id,user_id,game_id,variant_id,rules_version,score,duration_ms,best_lap_ms)
 VALUES(p_event_id,v_uid,p_game_id,p_variant_id,CASE WHEN p_game_id='sunset-circuit' THEN 2 ELSE 1 END,v_score,p_duration_ms,p_best_lap_ms);
END $$;
CREATE FUNCTION public.oa_get_progress() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_games jsonb; v_races jsonb;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_object_agg(game_id,stats) INTO v_games FROM (
  SELECT game_id,jsonb_build_object('best',max(score),'runs',count(*),'total',sum(score)) AS stats FROM public.oa_runs WHERE user_id=v_uid GROUP BY game_id
 ) games;
 SELECT jsonb_object_agg(variant_id,stats) INTO v_races FROM (
  SELECT variant_id,jsonb_build_object('bestTimeMs',min(duration_ms),'bestLapMs',min(best_lap_ms),'races',count(*)) AS stats FROM public.oa_runs WHERE user_id=v_uid AND game_id='sunset-circuit' GROUP BY variant_id
 ) races;
 RETURN jsonb_build_object('version',2,'games',coalesce(v_games,'{}'::jsonb),'races',coalesce(v_races,'{}'::jsonb));
END $$;
CREATE FUNCTION public.oa_leaderboard(p_game_id text,p_variant_id text DEFAULT 'default',p_limit integer DEFAULT 25)
RETURNS TABLE("position" bigint,display_name text,score bigint,duration_ms bigint,runs bigint,achieved_at timestamptz,is_self boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_game_id IS NULL OR p_game_id NOT IN ('neon-dash','starfall','prism-break','tile-shift','sunset-circuit') OR p_variant_id IS NULL OR
 (p_game_id='sunset-circuit' AND p_variant_id NOT IN ('sunset-bay','alpine-pass','ember-canyon','midnight-harbor')) OR (p_game_id<>'sunset-circuit' AND p_variant_id<>'default') THEN RAISE EXCEPTION 'Invalid board'; END IF;
 RETURN QUERY WITH best AS (
  SELECT DISTINCT ON (r.user_id) r.user_id,r.score,r.duration_ms,r.created_at,r.event_id FROM public.oa_runs r
  WHERE r.game_id=p_game_id AND r.variant_id=p_variant_id
  ORDER BY r.user_id,CASE WHEN p_game_id='sunset-circuit' THEN r.duration_ms END ASC,r.score DESC,r.created_at,r.event_id
 ),counts AS (SELECT r.user_id,count(*) AS total FROM public.oa_runs r WHERE r.game_id=p_game_id AND r.variant_id=p_variant_id GROUP BY r.user_id)
 SELECT row_number() OVER(ORDER BY CASE WHEN p_game_id='sunset-circuit' THEN b.duration_ms END ASC,CASE WHEN p_game_id<>'sunset-circuit' THEN b.score END DESC,b.created_at,b.user_id),p.display_name,b.score,b.duration_ms,c.total,b.created_at,coalesce(b.user_id=auth.uid(),false)
 FROM best b JOIN public.oa_profiles p ON p.user_id=b.user_id JOIN counts c ON c.user_id=b.user_id
 ORDER BY 1 LIMIT least(50,greatest(1,coalesce(p_limit,25)));
END $$;
REVOKE ALL ON FUNCTION public.oa_profile(text),public.oa_submit_run(uuid,text,text,bigint,bigint,bigint),public.oa_get_progress(),public.oa_leaderboard(text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oa_profile(text),public.oa_submit_run(uuid,text,text,bigint,bigint,bigint),public.oa_get_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.oa_leaderboard(text,text,integer) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
