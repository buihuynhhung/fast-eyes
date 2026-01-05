-- Enable REPLICA IDENTITY FULL for realtime to work correctly
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.game_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.claimed_numbers REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;