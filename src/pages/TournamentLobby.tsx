import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Play, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useGameSession } from '@/hooks/useGameSession';
import { Tournament, TournamentPlayer } from '@/types/tournament';
import { TournamentPlayerList } from '@/components/tournament/TournamentPlayerList';

export default function TournamentLobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sessionId } = useGameSession();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!code || !sessionId) return;

    const fetchData = async () => {
      const { data: t, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('tournament_code', code)
        .single();

      if (error || !t) {
        toast({ title: 'Tournament not found', variant: 'destructive' });
        navigate('/');
        return;
      }

      setTournament(t as unknown as Tournament);

      if (t.status !== 'registration') {
        navigate(`/tournament/${code}/bracket`);
        return;
      }

      const { data: ps } = await supabase
        .from('tournament_players')
        .select('*')
        .eq('tournament_id', t.id);

      setPlayers((ps || []) as unknown as TournamentPlayer[]);
      setIsLoading(false);
    };

    fetchData();
  }, [code, sessionId, navigate, toast]);

  // Realtime
  useEffect(() => {
    if (!tournament?.id) return;

    const channel = supabase
      .channel(`tournament-lobby-${tournament.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_players',
        filter: `tournament_id=eq.${tournament.id}`,
      }, async () => {
        const { data } = await supabase
          .from('tournament_players')
          .select('*')
          .eq('tournament_id', tournament.id);
        setPlayers((data || []) as unknown as TournamentPlayer[]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournament.id}`,
      }, (payload) => {
        const updated = payload.new as unknown as Tournament;
        setTournament(updated);
        if (updated.status !== 'registration') {
          navigate(`/tournament/${code}/bracket`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournament?.id, code, navigate]);

  const isHost = tournament?.host_id === sessionId;

  const startTournament = async () => {
    if (!tournament || !sessionId) return;
    setIsStarting(true);
    try {
      const { data, error } = await supabase.rpc('start_tournament', {
        p_tournament_code: tournament.tournament_code,
        p_session_id: sessionId,
      });

      if (error) throw error;
      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) {
        toast({ title: result.error || 'Cannot start', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error starting tournament', variant: 'destructive' });
    } finally {
      setIsStarting(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code || '');
    toast({ title: 'Copied!' });
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

  if (!tournament) return null;

  return (
    <div className="min-h-screen bg-background cyber-grid relative overflow-hidden">
      <div className="fixed inset-0 scanline pointer-events-none z-10" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2" />

      <div className="relative z-20 container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-secondary" />
            <h1 className="font-display text-3xl md:text-4xl text-primary neon-text">
              {tournament.name}
            </h1>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="uppercase font-display text-secondary">
              {tournament.format === 'knockout' ? 'Knockout' : 'Round Robin'}
            </span>
            <span>•</span>
            <span>Grid: {tournament.grid_size}</span>
            <span>•</span>
            <span>Max: {tournament.max_players} players</span>
          </div>
        </motion.div>

        <div className="max-w-md mx-auto space-y-6">
          {/* Code */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <p className="text-sm text-muted-foreground mb-2">Share this code to invite players:</p>
            <div
              className="inline-flex items-center gap-3 px-6 py-3 rounded-lg neon-border cursor-pointer hover:bg-primary/10"
              onClick={copyCode}
            >
              <span className="font-display text-3xl text-primary tracking-widest">{code}</span>
              <Copy className="w-5 h-5 text-primary" />
            </div>
          </motion.div>

          {/* Players */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-xl neon-border-pink bg-card"
          >
            <TournamentPlayerList players={players} hostId={tournament.host_id} />
          </motion.div>

          {/* Start button */}
          {isHost && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Button
                onClick={startTournament}
                disabled={players.length < 2 || isStarting}
                className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-display text-xl h-14"
              >
                <Play className="w-6 h-6 mr-2" />
                {isStarting ? 'STARTING...' : 'START TOURNAMENT'}
              </Button>
            </motion.div>
          )}

          {!isHost && (
            <div className="text-center">
              <div className="animate-pulse flex items-center justify-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <p className="text-muted-foreground">Waiting for host to start...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
