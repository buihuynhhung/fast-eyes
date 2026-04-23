import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Users, Plus, ArrowRight, Trophy, Swords, Eye, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  const [matchFormat, setMatchFormat] = useState<1 | 3 | 5>(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  // Tournament state
  const [showTournament, setShowTournament] = useState(false);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentFormat, setTournamentFormat] = useState<'knockout' | 'round_robin'>('knockout');
  const [tournamentMaxPlayers, setTournamentMaxPlayers] = useState(8);
  const [tournamentGridSize, setTournamentGridSize] = useState(25);
  const [tournamentCode, setTournamentCode] = useState('');
  const [isCreatingTournament, setIsCreatingTournament] = useState(false);
  const [isJoiningTournament, setIsJoiningTournament] = useState(false);

  const handleCreateClick = () => {
    if (!playerName.trim()) {
      toast({ title: "Enter your name", description: "Please enter a player name to continue.", variant: "destructive" });
      return;
    }
    setShowRoleDialog(true);
  };

  const createRoom = async (asSpectator: boolean) => {
    setShowRoleDialog(false);
    if (!playerName.trim()) {
      toast({ title: "Enter your name", description: "Please enter a player name to continue.", variant: "destructive" });
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
          match_format: matchFormat,
        } as any)
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
          is_spectator: asSpectator,
          session_id: sessionId,
        });
      if (playerError) throw playerError;
      const sysMsg = asSpectator
        ? `${playerName.trim()} created the room as game master`
        : `${playerName.trim()} created the room`;
      await supabase.from('chat_messages').insert({ room_id: room.id, player_name: 'System', message: sysMsg, is_system: true });
      navigate(`/room/${newRoomCode}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast({ title: "Error", description: "Failed to create room. Please try again.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) {
      toast({ title: "Enter your name", description: "Please enter a player name to continue.", variant: "destructive" });
      return;
    }
    if (!roomCode.trim()) {
      toast({ title: "Enter room code", description: "Please enter a room code to join.", variant: "destructive" });
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
        toast({ title: "Room not found", description: "Please check the room code and try again.", variant: "destructive" });
        return;
      }
      if (room.status !== 'waiting') {
        toast({ title: "Game in progress", description: "This game has already started.", variant: "destructive" });
        return;
      }
      const { data: existingPlayers } = await supabase.from('players').select('*').eq('room_id', room.id);
      const activePlayerCount = (existingPlayers || []).filter((p: any) => !p.is_spectator).length;
      if (activePlayerCount >= 4) {
        toast({ title: "Room full", description: "This room already has 4 players.", variant: "destructive" });
        return;
      }
      const existingPlayer = existingPlayers?.find(p => p.session_id === sessionId);
      if (existingPlayer) {
        navigate(`/room/${roomCode.toUpperCase()}`);
        return;
      }
      const colorIndex = (existingPlayers?.length || 0) % PLAYER_COLORS.length;
      const { error: playerError } = await supabase
        .from('players')
        .insert({ room_id: room.id, player_name: playerName.trim(), player_color: PLAYER_COLORS[colorIndex].hsl, is_host: false, session_id: sessionId });
      if (playerError) throw playerError;
      await supabase.from('chat_messages').insert({ room_id: room.id, player_name: 'System', message: `${playerName.trim()} joined the room`, is_system: true });
      navigate(`/room/${roomCode.toUpperCase()}`);
    } catch (error) {
      console.error('Error joining room:', error);
      toast({ title: "Error", description: "Failed to join room. Please try again.", variant: "destructive" });
    } finally {
      setIsJoining(false);
    }
  };

  const createTournament = async () => {
    if (!playerName.trim()) {
      toast({ title: "Enter your name", variant: "destructive" });
      return;
    }
    if (!tournamentName.trim()) {
      toast({ title: "Enter tournament name", variant: "destructive" });
      return;
    }
    localStorage.setItem('fast-eyes.playerName', playerName.trim());
    setIsCreatingTournament(true);
    try {
      const { data, error } = await (supabase.rpc as any)('create_tournament', {
        p_name: tournamentName.trim(),
        p_host_id: sessionId,
        p_format: tournamentFormat,
        p_max_players: tournamentMaxPlayers,
        p_grid_size: tournamentGridSize,
        p_host_name: playerName.trim(),
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean; tournament_code?: string; error?: string };
      if (!result.success) {
        toast({ title: result.error || 'Error', variant: 'destructive' });
        return;
      }
      navigate(`/tournament/${result.tournament_code}`);
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast({ title: "Error", description: "Failed to create tournament.", variant: "destructive" });
    } finally {
      setIsCreatingTournament(false);
    }
  };

  const joinTournament = async () => {
    if (!playerName.trim()) {
      toast({ title: "Enter your name", variant: "destructive" });
      return;
    }
    if (!tournamentCode.trim()) {
      toast({ title: "Enter tournament code", variant: "destructive" });
      return;
    }
    localStorage.setItem('fast-eyes.playerName', playerName.trim());
    setIsJoiningTournament(true);
    try {
      const { data, error } = await (supabase.rpc as any)('join_tournament', {
        p_tournament_code: tournamentCode.toUpperCase().trim(),
        p_session_id: sessionId,
        p_player_name: playerName.trim(),
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean; tournament_code?: string; error?: string };
      if (!result.success) {
        toast({ title: result.error || 'Error', variant: 'destructive' });
        return;
      }
      navigate(`/tournament/${tournamentCode.toUpperCase().trim()}`);
    } catch (error) {
      console.error('Error joining tournament:', error);
      toast({ title: "Error", description: "Failed to join tournament.", variant: "destructive" });
    } finally {
      setIsJoiningTournament(false);
    }
  };

  return (
    <div className="min-h-screen bg-background cyber-grid relative overflow-hidden">
      <div className="fixed inset-0 scanline pointer-events-none z-10" />
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

        {/* Mode toggle */}
        <div className="max-w-md mx-auto mb-6">
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => setShowTournament(false)}
              className={`flex-1 py-3 font-display text-sm flex items-center justify-center gap-2 transition-colors ${
                !showTournament ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <Swords className="w-4 h-4" />
              QUICK PLAY
            </button>
            <button
              onClick={() => setShowTournament(true)}
              className={`flex-1 py-3 font-display text-sm flex items-center justify-center gap-2 transition-colors ${
                showTournament ? 'bg-secondary text-secondary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <Trophy className="w-4 h-4" />
              TOURNAMENT
            </button>
          </div>
        </div>

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

          {!showTournament ? (
            <>
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
                  onClick={handleCreateClick}
                  disabled={isCreating || !sessionId || sessionLoading}
                  className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-display text-lg h-12"
                >
                  {isCreating ? "CREATING..." : <><span>CREATE ROOM</span><ArrowRight className="ml-2 w-5 h-5" /></>}
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
                  {isJoining ? "JOINING..." : <><span>JOIN ROOM</span><ArrowRight className="ml-2 w-5 h-5" /></>}
                </Button>
              </motion.div>
            </>
          ) : (
            <>
              {/* Create tournament */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="p-6 rounded-xl neon-border-pink bg-card"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-secondary" />
                  <h3 className="font-display text-xl text-secondary">CREATE TOURNAMENT</h3>
                </div>

                <div className="space-y-3 mb-4">
                  <Input
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    placeholder="Tournament name..."
                    className="bg-muted border-secondary/50 focus:border-secondary text-lg h-12"
                    maxLength={40}
                  />

                  <div>
                    <Label className="text-muted-foreground mb-2 block">Format</Label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTournamentFormat('knockout')}
                        className={`flex-1 py-2 px-3 rounded-lg font-display text-sm border transition-colors ${
                          tournamentFormat === 'knockout'
                            ? 'border-secondary bg-secondary/20 text-secondary'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        KNOCKOUT
                      </button>
                      <button
                        onClick={() => setTournamentFormat('round_robin')}
                        className={`flex-1 py-2 px-3 rounded-lg font-display text-sm border transition-colors ${
                          tournamentFormat === 'round_robin'
                            ? 'border-secondary bg-secondary/20 text-secondary'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ROUND ROBIN
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground mb-2 block">
                      Max Players: {tournamentMaxPlayers}
                    </Label>
                    <input
                      type="range"
                      min={2}
                      max={32}
                      value={tournamentMaxPlayers}
                      onChange={(e) => setTournamentMaxPlayers(Number(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-secondary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>2</span>
                      <span>32</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground mb-2 block">
                      Grid Size: {tournamentGridSize} numbers
                    </Label>
                    <input
                      type="range"
                      min={9}
                      max={100}
                      value={tournamentGridSize}
                      onChange={(e) => setTournamentGridSize(Number(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-secondary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>9</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={createTournament}
                  disabled={isCreatingTournament || !sessionId || sessionLoading}
                  className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-display text-lg h-12"
                >
                  {isCreatingTournament ? "CREATING..." : <><span>CREATE TOURNAMENT</span><ArrowRight className="ml-2 w-5 h-5" /></>}
                </Button>
              </motion.div>

              {/* Join tournament */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="p-6 rounded-xl neon-border-purple bg-card"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-accent" />
                  <h3 className="font-display text-xl text-accent">JOIN TOURNAMENT</h3>
                </div>
                <Input
                  value={tournamentCode}
                  onChange={(e) => setTournamentCode(e.target.value.toUpperCase())}
                  placeholder="Enter tournament code..."
                  className="bg-muted border-accent/50 focus:border-accent text-lg h-12 mb-4 uppercase tracking-widest text-center font-display"
                  maxLength={6}
                />
                <Button
                  onClick={joinTournament}
                  disabled={isJoiningTournament || !sessionId || sessionLoading}
                  className="w-full bg-accent hover:bg-accent/80 text-accent-foreground font-display text-lg h-12"
                >
                  {isJoiningTournament ? "JOINING..." : <><span>JOIN TOURNAMENT</span><ArrowRight className="ml-2 w-5 h-5" /></>}
                </Button>
              </motion.div>
            </>
          )}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-12 text-muted-foreground text-sm"
        >
          <p>2-4 players • Real-time multiplayer • Tournaments • No sign-up required</p>
        </motion.div>
      </div>

      {/* Role choice dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="bg-card border-secondary">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-secondary">
              CHỌN VAI TRÒ
            </DialogTitle>
            <DialogDescription>
              Bạn muốn vừa chơi vừa quản lý phòng, hay chỉ làm quản trò?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 mt-2">
            <button
              onClick={() => createRoom(false)}
              disabled={isCreating}
              className="group flex items-start gap-4 p-4 rounded-lg border-2 border-primary/40 hover:border-primary hover:bg-primary/10 transition-all text-left disabled:opacity-50"
            >
              <Gamepad2 className="w-8 h-8 text-primary shrink-0 mt-1" />
              <div className="flex-1">
                <div className="font-display text-lg text-primary">TÔI SẼ CHƠI</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Vừa chơi vừa quản lý phòng (chế độ thường).
                </p>
              </div>
            </button>
            <button
              onClick={() => createRoom(true)}
              disabled={isCreating}
              className="group flex items-start gap-4 p-4 rounded-lg border-2 border-accent/40 hover:border-accent hover:bg-accent/10 transition-all text-left disabled:opacity-50"
            >
              <Eye className="w-8 h-8 text-accent shrink-0 mt-1" />
              <div className="flex-1">
                <div className="font-display text-lg text-accent">CHỈ LÀM QUẢN TRÒ</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Không chơi, có quyền điều khiển + chia sẻ link cho khán giả xem.
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
