
-- RPC: start_tournament (fixed - removed record[] type)
CREATE OR REPLACE FUNCTION public.start_tournament(
  p_tournament_code text,
  p_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tournament record;
  v_player_ids uuid[];
  v_player_count integer;
  v_round_id uuid;
  v_match_id uuid;
  v_room_id uuid;
  v_room_code text;
  v_grid_seed text;
  v_i integer;
  v_j integer;
  v_match_num integer;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_k integer;
BEGIN
  SELECT * INTO v_tournament FROM public.tournaments WHERE tournament_code = p_tournament_code;
  
  IF v_tournament IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.host_id != p_session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only host can start');
  END IF;

  IF v_tournament.status != 'registration' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament already started');
  END IF;

  SELECT array_agg(id ORDER BY random()) INTO v_player_ids
  FROM public.tournament_players WHERE tournament_id = v_tournament.id;

  v_player_count := array_length(v_player_ids, 1);

  IF v_player_count < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Need at least 2 players');
  END IF;

  UPDATE public.tournaments SET status = 'in_progress' WHERE id = v_tournament.id;

  INSERT INTO public.tournament_rounds (tournament_id, round_number, status)
  VALUES (v_tournament.id, 1, 'playing')
  RETURNING id INTO v_round_id;

  IF v_tournament.format = 'knockout' THEN
    v_match_num := 1;
    v_i := 1;
    WHILE v_i <= v_player_count LOOP
      IF v_i + 1 <= v_player_count THEN
        v_room_code := '';
        FOR v_k IN 1..6 LOOP
          v_room_code := v_room_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
        END LOOP;
        v_grid_seed := v_room_code || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;

        INSERT INTO public.game_rooms (room_code, host_id, max_numbers, grid_seed, status)
        VALUES (v_room_code, p_session_id, v_tournament.grid_size, v_grid_seed, 'waiting')
        RETURNING id INTO v_room_id;

        INSERT INTO public.tournament_matches (tournament_id, round_id, room_id, match_number, status)
        VALUES (v_tournament.id, v_round_id, v_room_id, v_match_num, 'pending')
        RETURNING id INTO v_match_id;

        INSERT INTO public.tournament_match_players (match_id, tournament_player_id)
        VALUES (v_match_id, v_player_ids[v_i]), (v_match_id, v_player_ids[v_i + 1]);

        v_i := v_i + 2;
      ELSE
        INSERT INTO public.tournament_matches (tournament_id, round_id, match_number, status, winner_id, is_bye)
        VALUES (v_tournament.id, v_round_id, v_match_num, 'finished', v_player_ids[v_i], true)
        RETURNING id INTO v_match_id;

        INSERT INTO public.tournament_match_players (match_id, tournament_player_id)
        VALUES (v_match_id, v_player_ids[v_i]);

        v_i := v_i + 1;
      END IF;
      v_match_num := v_match_num + 1;
    END LOOP;
  ELSE
    v_match_num := 1;
    FOR v_i IN 1..v_player_count LOOP
      FOR v_j IN (v_i + 1)..v_player_count LOOP
        v_room_code := '';
        FOR v_k IN 1..6 LOOP
          v_room_code := v_room_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
        END LOOP;
        v_grid_seed := v_room_code || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;

        INSERT INTO public.game_rooms (room_code, host_id, max_numbers, grid_seed, status)
        VALUES (v_room_code, p_session_id, v_tournament.grid_size, v_grid_seed, 'waiting')
        RETURNING id INTO v_room_id;

        INSERT INTO public.tournament_matches (tournament_id, round_id, room_id, match_number, status)
        VALUES (v_tournament.id, v_round_id, v_room_id, v_match_num, 'pending')
        RETURNING id INTO v_match_id;

        INSERT INTO public.tournament_match_players (match_id, tournament_player_id)
        VALUES (v_match_id, v_player_ids[v_i]), (v_match_id, v_player_ids[v_j]);

        v_match_num := v_match_num + 1;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
