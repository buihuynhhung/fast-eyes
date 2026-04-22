-- Add is_spectator column to players
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS is_spectator BOOLEAN NOT NULL DEFAULT false;

-- Update start_game: count only non-spectator players
CREATE OR REPLACE FUNCTION public.start_game(p_room_id uuid, p_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_host_id TEXT;
  v_status TEXT;
  v_player_count INTEGER;
BEGIN
  SELECT host_id, status INTO v_host_id, v_status
  FROM public.game_rooms WHERE id = p_room_id;
  
  IF v_host_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;
  
  IF v_host_id != p_session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the host can start the game');
  END IF;
  
  IF v_status != 'waiting' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game is not in waiting state');
  END IF;
  
  SELECT COUNT(*) INTO v_player_count FROM public.players 
  WHERE room_id = p_room_id AND is_spectator = false;
  IF v_player_count < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Need at least 2 players');
  END IF;
  
  UPDATE public.game_rooms 
  SET status = 'playing', started_at = NOW()
  WHERE id = p_room_id;
  
  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Update claim_number: reject spectators
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
BEGIN
  SELECT session_id, is_spectator INTO v_player_session, v_is_spectator
  FROM public.players WHERE id = p_player_id;
  
  IF v_player_session IS NULL OR v_player_session != p_session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session');
  END IF;
  
  IF v_is_spectator THEN
    RETURN jsonb_build_object('success', false, 'error', 'Spectators cannot claim numbers');
  END IF;
  
  SELECT current_target, max_numbers, status INTO v_current_target, v_max_numbers, v_room_status
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
    UPDATE public.game_rooms 
    SET current_target = v_current_target + 1,
        status = 'finished',
        finished_at = NOW()
    WHERE id = p_room_id;
    
    RETURN jsonb_build_object('success', true, 'finished', true);
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