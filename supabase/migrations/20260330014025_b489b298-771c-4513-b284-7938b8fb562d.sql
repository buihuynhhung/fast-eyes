
-- Tournament tables
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_code text NOT NULL UNIQUE,
  name text NOT NULL,
  host_id text NOT NULL,
  format text NOT NULL DEFAULT 'knockout' CHECK (format IN ('knockout', 'round_robin')),
  max_players integer NOT NULL DEFAULT 8,
  grid_size integer NOT NULL DEFAULT 25,
  status text NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'in_progress', 'finished')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tournament_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  session_id text NOT NULL,
  player_color text NOT NULL DEFAULT '#00ff41',
  total_score integer NOT NULL DEFAULT 0,
  is_eliminated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, session_id)
);

CREATE TABLE public.tournament_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'playing', 'finished')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.tournament_rounds(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.game_rooms(id),
  match_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'playing', 'finished')),
  winner_id uuid REFERENCES public.tournament_players(id),
  is_bye boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tournament_match_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  tournament_player_id uuid NOT NULL REFERENCES public.tournament_players(id) ON DELETE CASCADE,
  final_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_match_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Anyone can create tournaments" ON public.tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tournaments" ON public.tournaments FOR UPDATE USING (true);

CREATE POLICY "Anyone can view tournament_players" ON public.tournament_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join tournaments" ON public.tournament_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tournament_players" ON public.tournament_players FOR UPDATE USING (true);

CREATE POLICY "Anyone can view tournament_rounds" ON public.tournament_rounds FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tournament_rounds" ON public.tournament_rounds FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tournament_rounds" ON public.tournament_rounds FOR UPDATE USING (true);

CREATE POLICY "Anyone can view tournament_matches" ON public.tournament_matches FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tournament_matches" ON public.tournament_matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tournament_matches" ON public.tournament_matches FOR UPDATE USING (true);

CREATE POLICY "Anyone can view tournament_match_players" ON public.tournament_match_players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tournament_match_players" ON public.tournament_match_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tournament_match_players" ON public.tournament_match_players FOR UPDATE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_match_players;

-- RPC: create_tournament
CREATE OR REPLACE FUNCTION public.create_tournament(
  p_name text,
  p_host_id text,
  p_format text,
  p_max_players integer,
  p_grid_size integer,
  p_host_name text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_tournament_id uuid;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i integer;
  v_colors text[] := ARRAY['hsl(120,100%,50%)','hsl(0,100%,50%)','hsl(210,100%,60%)','hsl(60,100%,50%)','hsl(280,100%,60%)','hsl(30,100%,55%)','hsl(180,100%,45%)','hsl(330,100%,55%)'];
BEGIN
  -- Generate unique 6-char code
  LOOP
    v_code := '';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tournaments WHERE tournament_code = v_code);
  END LOOP;

  INSERT INTO public.tournaments (tournament_code, name, host_id, format, max_players, grid_size)
  VALUES (v_code, p_name, p_host_id, p_format, p_max_players, p_grid_size)
  RETURNING id INTO v_tournament_id;

  -- Auto-join the host
  INSERT INTO public.tournament_players (tournament_id, player_name, session_id, player_color)
  VALUES (v_tournament_id, p_host_name, p_host_id, v_colors[1]);

  RETURN jsonb_build_object('success', true, 'tournament_code', v_code);
END;
$$;

-- RPC: join_tournament
CREATE OR REPLACE FUNCTION public.join_tournament(
  p_tournament_code text,
  p_session_id text,
  p_player_name text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_tournament record;
  v_player_count integer;
  v_color_index integer;
  v_colors text[] := ARRAY['hsl(120,100%,50%)','hsl(0,100%,50%)','hsl(210,100%,60%)','hsl(60,100%,50%)','hsl(280,100%,60%)','hsl(30,100%,55%)','hsl(180,100%,45%)','hsl(330,100%,55%)'];
BEGIN
  SELECT * INTO v_tournament FROM public.tournaments WHERE tournament_code = p_tournament_code;

  IF v_tournament IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.status != 'registration' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration closed');
  END IF;

  -- Check if already joined
  IF EXISTS (SELECT 1 FROM public.tournament_players WHERE tournament_id = v_tournament.id AND session_id = p_session_id) THEN
    RETURN jsonb_build_object('success', true, 'tournament_code', p_tournament_code);
  END IF;

  SELECT COUNT(*) INTO v_player_count FROM public.tournament_players WHERE tournament_id = v_tournament.id;

  IF v_player_count >= v_tournament.max_players THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament is full');
  END IF;

  v_color_index := (v_player_count % array_length(v_colors, 1)) + 1;

  INSERT INTO public.tournament_players (tournament_id, player_name, session_id, player_color)
  VALUES (v_tournament.id, p_player_name, p_session_id, v_colors[v_color_index]);

  RETURN jsonb_build_object('success', true, 'tournament_code', p_tournament_code);
END;
$$;

-- RPC: advance_tournament
CREATE OR REPLACE FUNCTION public.advance_tournament(
  p_room_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_match record;
  v_tournament record;
  v_round record;
  v_winner_id uuid;
  v_max_score integer;
  v_unfinished integer;
  v_round_id uuid;
  v_match_id uuid;
  v_room_id uuid;
  v_room_code text;
  v_grid_seed text;
  v_winners uuid[];
  v_match_num integer;
  v_i integer;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_k integer;
BEGIN
  -- Find the match for this room
  SELECT * INTO v_match FROM public.tournament_matches WHERE room_id = p_room_id AND status != 'finished' LIMIT 1;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active match for this room');
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;

  -- Determine winner by score from players table in the game room
  SELECT tmp.tournament_player_id, p.score INTO v_winner_id, v_max_score
  FROM public.tournament_match_players tmp
  JOIN public.tournament_players tp ON tp.id = tmp.tournament_player_id
  JOIN public.players p ON p.session_id = tp.session_id AND p.room_id = p_room_id
  WHERE tmp.match_id = v_match.id
  ORDER BY p.score DESC
  LIMIT 1;

  -- Update match player scores
  UPDATE public.tournament_match_players tmp
  SET final_score = p.score
  FROM public.tournament_players tp
  JOIN public.players p ON p.session_id = tp.session_id AND p.room_id = p_room_id
  WHERE tmp.match_id = v_match.id AND tmp.tournament_player_id = tp.id;

  -- Mark match finished
  UPDATE public.tournament_matches SET status = 'finished', winner_id = v_winner_id WHERE id = v_match.id;

  -- Update total scores
  UPDATE public.tournament_players tp
  SET total_score = tp.total_score + tmp.final_score
  FROM public.tournament_match_players tmp
  WHERE tmp.match_id = v_match.id AND tmp.tournament_player_id = tp.id;

  -- Check if round is done
  SELECT COUNT(*) INTO v_unfinished FROM public.tournament_matches WHERE round_id = v_match.round_id AND status != 'finished';

  IF v_unfinished > 0 THEN
    RETURN jsonb_build_object('success', true, 'round_complete', false);
  END IF;

  -- Round complete
  UPDATE public.tournament_rounds SET status = 'finished' WHERE id = v_match.round_id;

  IF v_tournament.format = 'knockout' THEN
    -- Get winners
    SELECT array_agg(winner_id) INTO v_winners FROM public.tournament_matches WHERE round_id = v_match.round_id AND winner_id IS NOT NULL;

    -- Eliminate losers
    UPDATE public.tournament_players tp SET is_eliminated = true
    WHERE tp.tournament_id = v_tournament.id AND tp.is_eliminated = false AND tp.id != ALL(v_winners);

    IF array_length(v_winners, 1) <= 1 THEN
      UPDATE public.tournaments SET status = 'finished' WHERE id = v_tournament.id;
      RETURN jsonb_build_object('success', true, 'round_complete', true, 'tournament_finished', true);
    END IF;

    -- Create next round
    SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_i FROM public.tournament_rounds WHERE tournament_id = v_tournament.id;
    INSERT INTO public.tournament_rounds (tournament_id, round_number, status)
    VALUES (v_tournament.id, v_i, 'playing')
    RETURNING id INTO v_round_id;

    v_match_num := 1;
    v_i := 1;
    WHILE v_i <= array_length(v_winners, 1) LOOP
      IF v_i + 1 <= array_length(v_winners, 1) THEN
        v_room_code := '';
        FOR v_k IN 1..6 LOOP
          v_room_code := v_room_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
        END LOOP;
        v_grid_seed := v_room_code || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;

        INSERT INTO public.game_rooms (room_code, host_id, max_numbers, grid_seed, status)
        VALUES (v_room_code, v_tournament.host_id, v_tournament.grid_size, v_grid_seed, 'waiting')
        RETURNING id INTO v_room_id;

        INSERT INTO public.tournament_matches (tournament_id, round_id, room_id, match_number, status)
        VALUES (v_tournament.id, v_round_id, v_room_id, v_match_num, 'pending')
        RETURNING id INTO v_match_id;

        INSERT INTO public.tournament_match_players (match_id, tournament_player_id)
        VALUES (v_match_id, v_winners[v_i]), (v_match_id, v_winners[v_i + 1]);

        v_i := v_i + 2;
      ELSE
        INSERT INTO public.tournament_matches (tournament_id, round_id, match_number, status, winner_id, is_bye)
        VALUES (v_tournament.id, v_round_id, v_match_num, 'finished', v_winners[v_i], true)
        RETURNING id INTO v_match_id;

        INSERT INTO public.tournament_match_players (match_id, tournament_player_id)
        VALUES (v_match_id, v_winners[v_i]);

        v_i := v_i + 1;
      END IF;
      v_match_num := v_match_num + 1;
    END LOOP;
  ELSE
    -- Round-robin: all matches in one round, tournament done
    UPDATE public.tournaments SET status = 'finished' WHERE id = v_tournament.id;
    RETURN jsonb_build_object('success', true, 'round_complete', true, 'tournament_finished', true);
  END IF;

  RETURN jsonb_build_object('success', true, 'round_complete', true, 'tournament_finished', false);
END;
$$;

-- Drop old start_tournament and recreate with correct signature
DROP FUNCTION IF EXISTS public.start_tournament(text, text);
CREATE OR REPLACE FUNCTION public.start_tournament(
  p_tournament_code text,
  p_session_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
