-- Fix #1: Remove unrestricted UPDATE policy on players table
-- The claim_number function already handles score updates securely
DROP POLICY IF EXISTS "Anyone can update players" ON public.players;

-- Fix #2: Remove unrestricted UPDATE policy on game_rooms table
DROP POLICY IF EXISTS "Anyone can update game rooms" ON public.game_rooms;

-- Create secure RPC function for starting the game (host only)
CREATE OR REPLACE FUNCTION public.start_game(p_room_id UUID, p_session_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_host_id TEXT;
  v_status TEXT;
  v_player_count INTEGER;
BEGIN
  -- Get room info
  SELECT host_id, status INTO v_host_id, v_status
  FROM public.game_rooms WHERE id = p_room_id;
  
  IF v_host_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;
  
  -- Verify caller is the host
  IF v_host_id != p_session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the host can start the game');
  END IF;
  
  -- Check game is in waiting state
  IF v_status != 'waiting' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game is not in waiting state');
  END IF;
  
  -- Check minimum player count
  SELECT COUNT(*) INTO v_player_count FROM public.players WHERE room_id = p_room_id;
  IF v_player_count < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Need at least 2 players');
  END IF;
  
  -- Start the game
  UPDATE public.game_rooms 
  SET status = 'playing', started_at = NOW()
  WHERE id = p_room_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create secure RPC function for resetting the game (host only)
CREATE OR REPLACE FUNCTION public.reset_game(p_room_id UUID, p_session_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_host_id TEXT;
  v_room_code TEXT;
BEGIN
  -- Get room info
  SELECT host_id, room_code INTO v_host_id, v_room_code
  FROM public.game_rooms WHERE id = p_room_id;
  
  IF v_host_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;
  
  -- Verify caller is the host
  IF v_host_id != p_session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the host can reset the game');
  END IF;
  
  -- Reset the game room
  UPDATE public.game_rooms 
  SET status = 'waiting',
      current_target = 1,
      started_at = NULL,
      finished_at = NULL,
      grid_seed = v_room_code || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT
  WHERE id = p_room_id;
  
  -- Reset all player scores
  UPDATE public.players SET score = 0 WHERE room_id = p_room_id;
  
  -- Delete all claimed numbers
  DELETE FROM public.claimed_numbers WHERE room_id = p_room_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;