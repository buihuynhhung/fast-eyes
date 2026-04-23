import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, Users, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CanvasNumberGrid } from '@/components/game/CanvasNumberGrid';
import { GameTimer } from '@/components/game/GameTimer';
import { PlayerList } from '@/components/game/PlayerList';
import { ChatBox } from '@/components/game/ChatBox';
import { TargetIndicator } from '@/components/game/TargetIndicator';
import { VictoryOverlay } from '@/components/game/VictoryOverlay';
import { GameRoom, Player, ChatMessage, MatchResult } from '@/types/game';

export default function SpectatorView() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [claimedNumbers, setClaimedNumbers] = useState<
    Map<number, { playerId: string; playerColor: string }>
  >(new Map());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showVictory, setShowVictory] = useState(false);
  const [finalTime, setFinalTime] = useState(0);

  // Initial fetch
  useEffect(() => {
    if (!roomCode) return;

    const fetchData = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('room_code', roomCode)
          .single();

        if (roomError || !roomData) {
          toast({
            title: 'Room not found',
            description: "This room doesn't exist.",
            variant: 'destructive',
          });
          navigate('/');
          return;
        }

        setRoom(roomData as GameRoom);

        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomData.id);
        if (playersData) setPlayers(playersData as Player[]);

        const { data: claimedData } = await supabase
          .from('claimed_numbers')
          .select('*, players(player_color)')
          .eq('room_id', roomData.id);
        if (claimedData) {
          const map = new Map();
          claimedData.forEach((c: any) => {
            map.set(c.number, {
              playerId: c.player_id,
              playerColor: c.players?.player_color || 'hsl(180, 100%, 50%)',
            });
          });
          setClaimedNumbers(map);
        }

        const { data: messagesData } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', roomData.id)
          .order('created_at', { ascending: true });
        if (messagesData) setMessages(messagesData as ChatMessage[]);

        const { data: resultsData } = await (supabase as any)
          .from('match_results')
          .select('*')
          .eq('room_id', roomData.id)
          .order('match_number', { ascending: true });
        if (resultsData) setMatchResults(resultsData as MatchResult[]);

        if (
          roomData.status === 'finished' &&
          roomData.started_at &&
          roomData.finished_at
        ) {
          const start = new Date(roomData.started_at).getTime();
          const end = new Date(roomData.finished_at).getTime();
          setFinalTime(end - start);
          setShowVictory(true);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching spectator data:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [roomCode, navigate, toast]);

  // Realtime subscriptions
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`watch-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const newRoom = payload.new as GameRoom;
          setRoom(newRoom);
          if (
            newRoom.status === 'finished' &&
            newRoom.started_at &&
            newRoom.finished_at
          ) {
            const start = new Date(newRoom.started_at).getTime();
            const end = new Date(newRoom.finished_at).getTime();
            setFinalTime(end - start);
            setShowVictory(true);
          }
          if (newRoom.status === 'waiting') {
            setClaimedNumbers(new Map());
            setShowVictory(false);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          const { data } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', room.id);
          if (data) setPlayers(data as Player[]);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'claimed_numbers',
          filter: `room_id=eq.${room.id}`,
        },
        async (payload) => {
          const claimed = payload.new as any;
          const { data: playerData } = await supabase
            .from('players')
            .select('player_color')
            .eq('id', claimed.player_id)
            .single();
          setClaimedNumbers((prev) => {
            const newMap = new Map(prev);
            newMap.set(claimed.number, {
              playerId: claimed.player_id,
              playerColor:
                playerData?.player_color || 'hsl(180, 100%, 50%)',
            });
            return newMap;
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_results',
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          const { data } = await (supabase as any)
            .from('match_results')
            .select('*')
            .eq('room_id', room.id)
            .order('match_number', { ascending: true });
          if (data) setMatchResults(data as MatchResult[]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: 'Link copied!', description: 'Spectator link copied.' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!room) return null;

  const isWaiting = room.status === 'waiting';
  const isPlaying = room.status === 'playing';
  const activePlayerCount = players.filter((p) => !p.is_spectator).length;
  const effectiveTarget = room.current_target ?? 1;
  const isBoSeries = (room.match_format || 1) > 1;
  const seriesWins = new Map<string, number>();
  matchResults.forEach((r) => {
    if (r.winner_player_id) {
      seriesWins.set(r.winner_player_id, (seriesWins.get(r.winner_player_id) || 0) + 1);
    }
  });

  return (
    <div className="min-h-screen bg-background cyber-grid relative">
      <div className="fixed inset-0 scanline pointer-events-none z-10" />
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

          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/20 text-accent border border-accent/40 font-display text-sm">
              <Eye className="w-4 h-4" /> ĐANG XEM
            </span>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg neon-border">
              <span className="font-display text-xl text-primary tracking-widest">
                {roomCode}
              </span>
            </div>
            <Button
              onClick={copyLink}
              size="sm"
              variant="outline"
              className="border-accent text-accent hover:bg-accent/10"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Copy link
            </Button>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{activePlayerCount}/4</span>
            </div>

            {isBoSeries && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-secondary/40 bg-secondary/10">
                <span className="font-display text-xs text-secondary">
                  VÁN {room.current_match || 1}/{room.match_format}
                </span>
                <span className="text-muted-foreground text-xs">·</span>
                <div className="flex items-center gap-2">
                  {players
                    .filter((p) => !p.is_spectator)
                    .map((p, idx, arr) => (
                      <span key={p.id} className="text-xs flex items-center gap-1">
                        <span style={{ color: p.player_color }} className="font-semibold">
                          {p.player_name}
                        </span>
                        <span style={{ color: p.player_color }} className="font-display">
                          {seriesWins.get(p.id) || 0}
                        </span>
                        {idx < arr.length - 1 && <span className="text-muted-foreground">-</span>}
                      </span>
                    ))}
                </div>
              </div>
            )}
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
          <div className="flex-1 flex flex-col items-center justify-start p-4 overflow-hidden min-h-0">
            {isWaiting ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 my-auto"
              >
                <div>
                  <h2 className="font-display text-3xl md:text-4xl text-accent neon-text mb-2">
                    WAITING FOR MATCH
                  </h2>
                  <p className="text-muted-foreground">
                    Phòng <span className="text-primary font-display">{roomCode}</span> đang chờ bắt đầu...
                  </p>
                  <p className="text-muted-foreground mt-2">
                    Grid size:{' '}
                    <span className="text-secondary">
                      {room.max_numbers} numbers
                    </span>
                  </p>
                </div>
                <div className="animate-pulse">
                  <div className="w-20 h-20 mx-auto rounded-full border-4 border-accent/50 flex items-center justify-center">
                    <Eye className="w-10 h-10 text-accent" />
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="w-full h-full flex flex-col min-h-0">
                <div className="flex justify-center mb-4 shrink-0">
                  <TargetIndicator
                    currentTarget={effectiveTarget}
                    maxNumbers={room.max_numbers}
                  />
                </div>
                <div className="flex-1 min-h-0 w-full">
                  <CanvasNumberGrid
                    maxNumbers={room.max_numbers}
                    gridSeed={room.grid_seed || room.room_code}
                    currentTarget={effectiveTarget}
                    claimedNumbers={claimedNumbers}
                    onNumberClick={() => {}}
                    disabled
                    readOnly
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-80 border-l border-border flex flex-col bg-card/50">
            <div className="p-4 border-b border-border">
              <PlayerList players={players} />
            </div>
            <div className="flex-1 min-h-0">
              <ChatBox
                messages={messages}
                players={players}
                onSendMessage={() => {}}
                currentPlayerName=""
                readOnly
              />
            </div>
          </aside>
        </div>
      </div>

      {showVictory && (
        <VictoryOverlay
          players={players.filter((p) => !p.is_spectator)}
          finalTime={finalTime}
          onPlayAgain={() => {}}
          onBackToLobby={() => navigate('/')}
          matchResults={matchResults}
          seriesFinished={room.series_status === 'finished'}
          currentMatch={room.current_match || 1}
          matchFormat={room.match_format || 1}
          isHost={false}
        />
      )}
    </div>
  );
}
