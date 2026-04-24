CREATE OR REPLACE FUNCTION public.claim_number(p_room_id uuid, p_player_id uuid, p_number integer, p_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
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
  v_new_target INTEGER;
BEGIN
  -- Validate session/spectator (no row lock)
  SELECT session_id, is_spectator INTO v_player_session, v_is_spectator
  FROM public.players WHERE id = p_player_id;

  IF v_player_session IS NULL OR v_player_session != p_session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session');
  END IF;

  IF v_is_spectator THEN
    RETURN jsonb_build_object('success', false, 'error', 'Spectators cannot claim numbers');
  END IF;

  -- Read room state without locking
  SELECT max_numbers, status, match_format, current_match, started_at
    INTO v_max_numbers, v_room_status, v_match_format, v_current_match, v_started_at
  FROM public.game_rooms WHERE id = p_room_id;

  IF v_room_status != 'playing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not in progress');
  END IF;

  -- ATOMIC conditional update: only succeeds if current_target matches p_number.
  -- This is the single race-condition gate; no row locks are taken so
  -- parallel clicks for different numbers don't queue up.
  UPDATE public.game_rooms
     SET current_target = current_target + 1
   WHERE id = p_room_id
     AND current_target = p_number
     AND status = 'playing'
  RETURNING current_target INTO v_new_target;

  IF NOT FOUND THEN
    -- Either the number is wrong, or someone else just claimed it.
    -- Surface a clearer error.
    IF EXISTS (SELECT 1 FROM public.claimed_numbers WHERE room_id = p_room_id AND number = p_number) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Wrong number');
  END IF;

  -- We won the race for this number; record the claim and award score.
  BEGIN
    INSERT INTO public.claimed_numbers (room_id, number, player_id)
    VALUES (p_room_id, p_number, p_player_id);
  EXCEPTION WHEN unique_violation THEN
    -- Extremely unlikely now (UPDATE was atomic), but stay safe:
    -- roll back the target bump and report.
    UPDATE public.game_rooms SET current_target = current_target - 1
      WHERE id = p_room_id AND current_target = v_new_target;
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
  END;

  UPDATE public.players SET score = score + 1 WHERE id = p_player_id;

  -- Match finished?
  IF v_new_target > v_max_numbers THEN
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
       SET status = 'finished',
           finished_at = NOW()
     WHERE id = p_room_id;

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
  END IF;

  RETURN jsonb_build_object('success', true, 'finished', false);
END;
$function$;