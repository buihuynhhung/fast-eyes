-- Add database constraints for input validation
ALTER TABLE public.chat_messages 
ADD CONSTRAINT message_length_check 
CHECK (char_length(message) <= 500 AND char_length(message) >= 1);

ALTER TABLE public.chat_messages 
ADD CONSTRAINT player_name_length_check 
CHECK (char_length(player_name) <= 50 AND char_length(player_name) >= 1);

ALTER TABLE public.players 
ADD CONSTRAINT player_name_length_check 
CHECK (char_length(player_name) <= 20 AND char_length(player_name) >= 1);

ALTER TABLE public.game_rooms 
ADD CONSTRAINT room_code_length_check 
CHECK (char_length(room_code) = 6);

-- Create atomic claim_number function to prevent race conditions
CREATE OR REPLACE FUNCTION public.claim_number(
  p_room_id UUID,
  p_player_id UUID,
  p_number INTEGER,
  p_session_id TEXT
) RETURNS jsonb AS $$
DECLARE
  v_current_target INTEGER;
  v_max_numbers INTEGER;
  v_player_session TEXT;
  v_room_status TEXT;
BEGIN
  -- Validate player session
  SELECT session_id INTO v_player_session 
  FROM public.players WHERE id = p_player_id;
  
  IF v_player_session IS NULL OR v_player_session != p_session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session');
  END IF;
  
  -- Get and lock the room row
  SELECT current_target, max_numbers, status INTO v_current_target, v_max_numbers, v_room_status
  FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  
  -- Validate game is playing
  IF v_room_status != 'playing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not in progress');
  END IF;
  
  -- Validate number matches target
  IF p_number != v_current_target THEN
    RETURN jsonb_build_object('success', false, 'error', 'Number already claimed');
  END IF;
  
  -- Atomically claim number
  INSERT INTO public.claimed_numbers (room_id, number, player_id)
  VALUES (p_room_id, p_number, p_player_id);
  
  -- Update player score
  UPDATE public.players SET score = score + 1 WHERE id = p_player_id;
  
  -- Update room target
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;