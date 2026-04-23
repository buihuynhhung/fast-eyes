
-- 1) Add columns to game_rooms
ALTER TABLE public.game_rooms
  ADD COLUMN IF NOT EXISTS match_format INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_match INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS series_status TEXT NOT NULL DEFAULT 'in_progress';

-- 2) Create match_results table
CREATE TABLE IF NOT EXISTS public.match_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  match_number INTEGER NOT NULL,
  winner_player_id UUID,
  winner_name TEXT,
  winner_color TEXT,
  winner_score INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view match results" ON public.match_results;
CREATE POLICY "Anyone can view match results"
  ON public.match_results FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert match results" ON public.match_results;
CREATE POLICY "Anyone can insert match results"
  ON public.match_results FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete match results" ON public.match_results;
CREATE POLICY "Anyone can delete match results"
  ON public.match_results FOR DELETE
  USING (true);

ALTER TABLE public.match_results REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'match_results'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.match_results';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_match_results_room ON public.match_results(room_id, match_number);

-- 3) Update claim_number RPC: store result on finish, check series status
CREATE OR REPLACE FUNCTION public.claim_number(p_room_id uuid, p_player_id uuid, p_number integer, p_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_target INTEGER;
  v_max_numbers INTEGER;
  v_player_session TEXT;
  v_room_status TEXT;
  v_is_spectator BOOLEAN;
  v_match_format INTEGER;
  v_current_match INTEGER;
  v_started_at TIMESTAMPTZ;
  v_winner RECORD;
  v_duration INTEGER;
  v_max_wins INTEGER;
  v_threshold INTEGER;
BEGIN
  SELECT session_id, is_spectator INTO v_player_session, v_is_spectator
  FROM public.players WHERE id = p_player_id;

  IF v_player_session IS NULL OR v_player_session != p_session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session');
  END IF;

  IF v_is_spectator THEN
    RETURN jsonb_build_object('success', false, 'error', 'Spectators cannot claim numbers');
  END IF;

  SELECT current_target, max_numbers, status, match_format, current_match, started_at
    INTO v_current_target, v_max_numbers, v_room_status, v_match_format, v_current_match, v_started_at
  FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;

  IF v_room_status != 'playing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not in progress');
  END IF;

  IF p_number != v_current_target THEN
    RETURN jsonb_build_object('success', false, 'error', 'Number already claimed');
  END IF;

  INSERT INTO public.claimed_numbers (room_id, number, player_id)
  VALUES (p_room_id, p_number, p_player_id);

  UPDATE public.players SET score = score + 1 WHERE id = p_player_id;

  IF v_current_target + 1 > v_max_numbers THEN
    -- Match finished: determine winner (highest score, non-spectator)
    SELECT id, player_name, player_color, score
      INTO v_winner
      FROM public.players
     WHERE room_id = p_room_id AND is_spectator = false
     ORDER BY score DESC, created_at ASC
     LIMIT 1;

    v_duration := COALESCE(EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000, 0)::INTEGER;

    INSERT INTO public.match_results (room_id, match_number, winner_player_id, winner_name, winner_color, winner_score, duration_ms)
    VALUES (p_room_id, v_current_match, v_winner.id, v_winner.player_name, v_winner.player_color, v_winner.score, v_duration);

    UPDATE public.game_rooms
    SET current_target = v_current_target + 1,
        status = 'finished',
        finished_at = NOW()
    WHERE id = p_room_id;

    -- Check if series is over: someone has > match_format/2 wins
    v_threshold := (v_match_format / 2) + 1;
    SELECT COALESCE(MAX(c), 0) INTO v_max_wins
    FROM (
      SELECT COUNT(*) AS c
      FROM public.match_results
      WHERE room_id = p_room_id AND winner_player_id IS NOT NULL
      GROUP BY winner_player_id
    ) sub;

    IF v_max_wins >= v_threshold OR v_current_match >= v_match_format THEN
      UPDATE public.game_rooms SET series_status = 'finished' WHERE id = p_room_id;
      RETURN jsonb_build_object('success', true, 'finished', true, 'series_finished', true);
    END IF;

    RETURN jsonb_build_object('success', true, 'finished', true, 'series_finished', false);
  ELSE
    UPDATE public.game_rooms
    SET current_target = v_current_target + 1
    WHERE id = p_room_id;

    RETURN jsonb_build_object('success', true, 'finished', false);
  END IF;

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Number already claimed');
END;
$function$;

-- 4) New RPC: next_match
CREATE OR REPLACE FUNCTION public.next_match(p_room_id uuid, p_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_host_id TEXT;
  v_room_code TEXT;
  v_status TEXT;
  v_series_status TEXT;
  v_current_match INTEGER;
  v_match_format INTEGER;
BEGIN
  SELECT host_id, room_code, status, series_status, current_match, match_format
    INTO v_host_id, v_room_code, v_status, v_series_status, v_current_match, v_match_format
  FROM public.game_rooms WHERE id = p_room_id;

  IF v_host_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;

  IF v_host_id != p_session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the host can advance');
  END IF;

  IF v_series_status != 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Series already finished');
  END IF;

  IF v_status != 'finished' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not finished yet');
  END IF;

  IF v_current_match >= v_match_format THEN
    RETURN jsonb_build_object('success', false, 'error', 'No more matches in this series');
  END IF;

  UPDATE public.game_rooms
  SET status = 'waiting',
      current_target = 1,
      started_at = NULL,
      finished_at = NULL,
      current_match = v_current_match + 1,
      grid_seed = v_room_code || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '_' || (v_current_match + 1)::TEXT
  WHERE id = p_room_id;

  UPDATE public.players SET score = 0 WHERE room_id = p_room_id;

  DELETE FROM public.claimed_numbers WHERE room_id = p_room_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 5) Update reset_game to also reset series state and clear match_results
CREATE OR REPLACE FUNCTION public.reset_game(p_room_id uuid, p_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_host_id TEXT;
  v_room_code TEXT;
BEGIN
  SELECT host_id, room_code INTO v_host_id, v_room_code
  FROM public.game_rooms WHERE id = p_room_id;

  IF v_host_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;

  IF v_host_id != p_session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the host can reset the game');
  END IF;

  UPDATE public.game_rooms
  SET status = 'waiting',
      current_target = 1,
      started_at = NULL,
      finished_at = NULL,
      current_match = 1,
      series_status = 'in_progress',
      grid_seed = v_room_code || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT
  WHERE id = p_room_id;

  UPDATE public.players SET score = 0 WHERE room_id = p_room_id;

  DELETE FROM public.claimed_numbers WHERE room_id = p_room_id;
  DELETE FROM public.match_results WHERE room_id = p_room_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;
