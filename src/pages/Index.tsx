import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Users, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateRoomCode, PLAYER_COLORS } from '@/lib/gameUtils';
import { useGameSession } from '@/hooks/useGameSession';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sessionId, isLoading: sessionLoading } = useGameSession();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [maxNumbers, setMaxNumbers] = useState(25);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const createRoom = async () => {
    if (!playerName.trim()) {
      toast({
        title: "Enter your name",
        description: "Please enter a player name to continue.",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem('fast-eyes.playerName', playerName.trim());

    setIsCreating(true);
    try {
      const newRoomCode = generateRoomCode();
      const gridSeed = `${newRoomCode}_${Date.now()}`;

      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .insert({
          room_code: newRoomCode,
          host_id: sessionId,
          max_numbers: maxNumbers,
          grid_seed: gridSeed,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      const { error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          player_name: playerName.trim(),
          player_color: PLAYER_COLORS[0].hsl,
          is_host: true,
          session_id: sessionId,
        });

      if (playerError) throw playerError;

      // Send system message
      await supabase.from('chat_messages').insert({
        room_id: room.id,
        player_name: 'System',
        message: `${playerName.trim()} created the room`,
        is_system: true,
      });

      navigate(`/room/${newRoomCode}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: "Error",
        description: "Failed to create room. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) {
      toast({
        title: "Enter your name",
        description: "Please enter a player name to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!roomCode.trim()) {
      toast({
        title: "Enter room code",
        description: "Please enter a room code to join.",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem('fast-eyes.playerName', playerName.trim());

    setIsJoining(true);
    try {
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', roomCode.toUpperCase().trim())
        .single();

      if (roomError || !room) {
        toast({
          title: "Room not found",
          description: "Please check the room code and try again.",
          variant: "destructive",
        });
        return;
      }

      if (room.status !== 'waiting') {
        toast({
          title: "Game in progress",
          description: "This game has already started.",
          variant: "destructive",
        });
        return;
      }

      // Check player count
      const { data: existingPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id);

      if (existingPlayers && existingPlayers.length >= 4) {
        toast({
          title: "Room full",
          description: "This room already has 4 players.",
          variant: "destructive",
        });
        return;
      }

      // Check if already in room
      const existingPlayer = existingPlayers?.find(p => p.session_id === sessionId);
      if (existingPlayer) {
        navigate(`/room/${roomCode.toUpperCase()}`);
        return;
      }

      const colorIndex = existingPlayers?.length || 0;
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          player_name: playerName.trim(),
          player_color: PLAYER_COLORS[colorIndex].hsl,
          is_host: false,
          session_id: sessionId,
        });

      if (playerError) throw playerError;

      // Send system message
      await supabase.from('chat_messages').insert({
        room_id: room.id,
        player_name: 'System',
        message: `${playerName.trim()} joined the room`,
        is_system: true,
      });

      navigate(`/room/${roomCode.toUpperCase()}`);
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: "Error",
        description: "Failed to join room. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background cyber-grid relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline pointer-events-none z-10" />

      {/* Background glow effects */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[100px] translate-y-1/2" />

      <div className="relative z-20 container mx-auto px-4 py-8 md:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-flex items-center gap-3 mb-4"
          >
            <Zap className="w-10 h-10 md:w-12 md:h-12 text-primary" />
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl text-primary neon-text glitch-text">
              FAST EYES
            </h1>
            <Zap className="w-10 h-10 md:w-12 md:h-12 text-secondary" />
          </motion.div>
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl text-secondary neon-text mb-4">
            QUICK HANDS
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Race against friends to click numbers in order. The fastest eye and quickest hand wins!
          </p>
        </motion.div>

        {/* Main content */}
        <div className="max-w-md mx-auto space-y-8">
          {/* Player name input */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-xl neon-border bg-card"
          >
            <Label htmlFor="playerName" className="text-primary font-display text-lg mb-3 block">
              YOUR NAME
            </Label>
            <Input
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name..."
              className="bg-muted border-primary/50 focus:border-primary text-lg h-12"
              maxLength={20}
            />
          </motion.div>

          {/* Create room section */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-xl neon-border-pink bg-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-secondary" />
              <h3 className="font-display text-xl text-secondary">CREATE ROOM</h3>
            </div>
            
            <div className="mb-4">
              <Label htmlFor="maxNumbers" className="text-muted-foreground mb-2 block">
                Grid Size: {maxNumbers} numbers
              </Label>
              <input
                type="range"
                id="maxNumbers"
                min={9}
                max={100}
                value={maxNumbers}
                onChange={(e) => setMaxNumbers(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-secondary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>9</span>
                <span>100</span>
              </div>
            </div>

            <Button
              onClick={createRoom}
              disabled={isCreating || !sessionId || sessionLoading}
              className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-display text-lg h-12"
            >
              {isCreating ? (
                "CREATING..."
              ) : (
                <>
                  CREATE ROOM
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </motion.div>

          {/* Join room section */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="p-6 rounded-xl neon-border-purple bg-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-accent" />
              <h3 className="font-display text-xl text-accent">JOIN ROOM</h3>
            </div>
            
            <Input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter room code..."
              className="bg-muted border-accent/50 focus:border-accent text-lg h-12 mb-4 uppercase tracking-widest text-center font-display"
              maxLength={6}
            />

            <Button
              onClick={joinRoom}
              disabled={isJoining || !sessionId || sessionLoading}
              className="w-full bg-accent hover:bg-accent/80 text-accent-foreground font-display text-lg h-12"
            >
              {isJoining ? (
                "JOINING..."
              ) : (
                <>
                  JOIN ROOM
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-12 text-muted-foreground text-sm"
        >
          <p>2-4 players • Real-time multiplayer • No sign-up required</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
