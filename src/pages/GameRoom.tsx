import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, Play, ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useGameSession } from '@/hooks/useGameSession';
import { useAntiCheat } from '@/hooks/useAntiCheat';
import { NumberGrid } from '@/components/game/NumberGrid';
import { GameTimer } from '@/components/game/GameTimer';
import { PlayerList } from '@/components/game/PlayerList';
import { ChatBox } from '@/components/game/ChatBox';
import { VictoryOverlay } from '@/components/game/VictoryOverlay';
import { TargetIndicator } from '@/components/game/TargetIndicator';
import { GameRoom, Player, ChatMessage } from '@/types/game';

export default function GameRoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const sessionId = useGameSession();
  
  useAntiCheat();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [claimedNumbers, setClaimedNumbers] = useState<Map<number, { playerId: string; playerColor: string }>>(new Map());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showVictory, setShowVictory] = useState(false);
  const [finalTime, setFinalTime] = useState(0);

  // Fetch initial data
  useEffect(() => {
    if (!roomCode || !sessionId) return;

    const fetchData = async () => {
      try {
        // Fetch room
        const { data: roomData, error: roomError } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('room_code', roomCode)
          .single();

        if (roomError || !roomData) {
          toast({
            title: "Room not found",
            description: "This room doesn't exist.",
            variant: "destructive",
          });
          navigate('/');
          return;
        }

        setRoom(roomData as GameRoom);

        // Fetch players
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomData.id);

        if (playersData) {
          setPlayers(playersData as Player[]);
          const me = playersData.find(p => p.session_id === sessionId);
          setCurrentPlayer(me as Player || null);
        }

        // Fetch claimed numbers
        const { data: claimedData } = await supabase
          .from('claimed_numbers')
          .select('*, players(player_color)')
          .eq('room_id', roomData.id);

        if (claimedData) {
          const claimedMap = new Map();
          claimedData.forEach((c: any) => {
            claimedMap.set(c.number, {
              playerId: c.player_id,
              playerColor: c.players?.player_color || 'hsl(180, 100%, 50%)',
            });
          });
          setClaimedNumbers(claimedMap);
        }

        // Fetch messages
        const { data: messagesData } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', roomData.id)
          .order('created_at', { ascending: true });

        if (messagesData) {
          setMessages(messagesData as ChatMessage[]);
        }

        // Check if game already finished
        if (roomData.status === 'finished' && roomData.started_at && roomData.finished_at) {
          const start = new Date(roomData.started_at).getTime();
          const end = new Date(roomData.finished_at).getTime();
          setFinalTime(end - start);
          setShowVictory(true);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [roomCode, sessionId, navigate, toast]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!room?.id) return;

    const roomChannel = supabase
      .channel(`room-${room.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${room.id}`,
      }, (payload) => {
        const newRoom = payload.new as GameRoom;
        setRoom(newRoom);
        
        if (newRoom.status === 'finished' && newRoom.started_at && newRoom.finished_at) {
          const start = new Date(newRoom.started_at).getTime();
          const end = new Date(newRoom.finished_at).getTime();
          setFinalTime(end - start);
          setShowVictory(true);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${room.id}`,
      }, async () => {
        const { data } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', room.id);
        if (data) {
          setPlayers(data as Player[]);
          const me = data.find(p => p.session_id === sessionId);
          setCurrentPlayer(me as Player || null);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'claimed_numbers',
        filter: `room_id=eq.${room.id}`,
      }, async (payload) => {
        const claimed = payload.new as any;
        const { data: playerData } = await supabase
          .from('players')
          .select('player_color')
          .eq('id', claimed.player_id)
          .single();
        
        setClaimedNumbers(prev => {
          const newMap = new Map(prev);
          newMap.set(claimed.number, {
            playerId: claimed.player_id,
            playerColor: playerData?.player_color || 'hsl(180, 100%, 50%)',
          });
          return newMap;
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [room?.id, sessionId]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({
      title: "Copied!",
      description: "Room code copied to clipboard.",
    });
  };

  const startGame = async () => {
    if (!room || players.length < 2) {
      toast({
        title: "Need more players",
        description: "At least 2 players are required to start.",
        variant: "destructive",
      });
      return;
    }

    try {
      await supabase
        .from('game_rooms')
        .update({
          status: 'playing',
          started_at: new Date().toISOString(),
        })
        .eq('id', room.id);

      await supabase.from('chat_messages').insert({
        room_id: room.id,
        player_name: 'System',
        message: 'Game started! Find the numbers in order!',
        is_system: true,
      });
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const handleNumberClick = useCallback(async (number: number) => {
    if (!room || !currentPlayer || room.status !== 'playing') return;
    if (number !== room.current_target) return;
    if (claimedNumbers.has(number)) return;

    try {
      // Claim the number
      await supabase.from('claimed_numbers').insert({
        room_id: room.id,
        number: number,
        player_id: currentPlayer.id,
      });

      // Update player score
      await supabase
        .from('players')
        .update({ score: currentPlayer.score + 1 })
        .eq('id', currentPlayer.id);

      // Update room target
      const nextTarget = number + 1;
      const isFinished = nextTarget > room.max_numbers;

      if (isFinished) {
        await supabase
          .from('game_rooms')
          .update({
            current_target: nextTarget,
            status: 'finished',
            finished_at: new Date().toISOString(),
          })
          .eq('id', room.id);

        await supabase.from('chat_messages').insert({
          room_id: room.id,
          player_name: 'System',
          message: `${currentPlayer.player_name} finished the game!`,
          is_system: true,
        });
      } else {
        await supabase
          .from('game_rooms')
          .update({ current_target: nextTarget })
          .eq('id', room.id);

        // Milestone messages
        if (number % 10 === 0) {
          await supabase.from('chat_messages').insert({
            room_id: room.id,
            player_name: 'System',
            message: `${currentPlayer.player_name} reached number ${number}!`,
            is_system: true,
          });
        }
      }
    } catch (error) {
      console.error('Error claiming number:', error);
    }
  }, [room, currentPlayer, claimedNumbers]);

  const sendMessage = async (message: string) => {
    if (!room || !currentPlayer) return;

    try {
      await supabase.from('chat_messages').insert({
        room_id: room.id,
        player_id: currentPlayer.id,
        player_name: currentPlayer.player_name,
        message: message,
        is_system: false,
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handlePlayAgain = async () => {
    if (!room || !currentPlayer?.is_host) return;

    try {
      // Reset room
      await supabase
        .from('game_rooms')
        .update({
          status: 'waiting',
          current_target: 1,
          started_at: null,
          finished_at: null,
          grid_seed: `${room.room_code}_${Date.now()}`,
        })
        .eq('id', room.id);

      // Reset player scores
      await supabase
        .from('players')
        .update({ score: 0 })
        .eq('room_id', room.id);

      // Delete claimed numbers
      await supabase
        .from('claimed_numbers')
        .delete()
        .eq('room_id', room.id);

      setClaimedNumbers(new Map());
      setShowVictory(false);

      await supabase.from('chat_messages').insert({
        room_id: room.id,
        player_name: 'System',
        message: 'Room reset! Ready for a new game.',
        is_system: true,
      });
    } catch (error) {
      console.error('Error resetting game:', error);
    }
  };

  const handleBackToLobby = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!room) {
    return null;
  }

  const isHost = currentPlayer?.is_host;
  const isWaiting = room.status === 'waiting';
  const isPlaying = room.status === 'playing';

  return (
    <div className="min-h-screen bg-background cyber-grid relative">
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline pointer-events-none z-10" />

      {/* Background glow effects */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px]" />

      <div className="relative z-20 h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-border">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Leave
          </Button>

          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg neon-border cursor-pointer hover:bg-primary/10"
              onClick={copyRoomCode}
            >
              <span className="font-display text-xl text-primary tracking-widest">
                {roomCode}
              </span>
              <Copy className="w-4 h-4 text-primary" />
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{players.length}/4</span>
            </div>
          </div>

          {isPlaying && room.started_at && (
            <GameTimer
              startedAt={room.started_at}
              finishedAt={room.finished_at}
              isPlaying={isPlaying}
            />
          )}
        </header>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Game area */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto">
            {isWaiting ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8"
              >
                <div>
                  <h2 className="font-display text-3xl md:text-4xl text-primary neon-text mb-2">
                    WAITING FOR PLAYERS
                  </h2>
                  <p className="text-muted-foreground">
                    Share the room code: <span className="text-primary font-display">{roomCode}</span>
                  </p>
                  <p className="text-muted-foreground mt-2">
                    Grid size: <span className="text-secondary">{room.max_numbers} numbers</span>
                  </p>
                </div>

                <div className="animate-pulse">
                  <div className="w-20 h-20 mx-auto rounded-full border-4 border-primary/50 flex items-center justify-center">
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                </div>

                {isHost && (
                  <Button
                    onClick={startGame}
                    disabled={players.length < 2}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground font-display text-xl px-8 py-6"
                  >
                    <Play className="w-6 h-6 mr-2" />
                    START GAME
                  </Button>
                )}

                {!isHost && (
                  <p className="text-muted-foreground">
                    Waiting for host to start the game...
                  </p>
                )}
              </motion.div>
            ) : (
              <div className="w-full max-w-5xl">
                <div className="flex justify-center mb-6">
                  <TargetIndicator
                    currentTarget={room.current_target}
                    maxNumbers={room.max_numbers}
                  />
                </div>
                
                <NumberGrid
                  maxNumbers={room.max_numbers}
                  gridSeed={room.grid_seed || room.room_code}
                  currentTarget={room.current_target}
                  claimedNumbers={claimedNumbers}
                  onNumberClick={handleNumberClick}
                  disabled={room.status !== 'playing'}
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-80 border-l border-border flex flex-col bg-card/50">
            <div className="p-4 border-b border-border">
              <PlayerList players={players} currentPlayerId={currentPlayer?.id} />
            </div>
            <div className="flex-1 min-h-0">
              <ChatBox
                messages={messages}
                players={players}
                onSendMessage={sendMessage}
                currentPlayerName={currentPlayer?.player_name || ''}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Victory overlay */}
      {showVictory && (
        <VictoryOverlay
          players={players}
          finalTime={finalTime}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={handleBackToLobby}
        />
      )}
    </div>
  );
}
