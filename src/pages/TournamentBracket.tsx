import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useGameSession } from '@/hooks/useGameSession';
import {
  Tournament,
  TournamentPlayer,
  TournamentRound,
  TournamentMatch,
  TournamentMatchPlayer,
} from '@/types/tournament';
import { KnockoutBracket } from '@/components/tournament/KnockoutBracket';
import { RoundRobinTable } from '@/components/tournament/RoundRobinTable';
import { TournamentPlayerList } from '@/components/tournament/TournamentPlayerList';

export default function TournamentBracket() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sessionId } = useGameSession();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [matchPlayers, setMatchPlayers] = useState<TournamentMatchPlayer[]>([]);
  const [gameRooms, setGameRooms] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = async (tournamentId: string) => {
    const [pRes, rRes, mRes] = await Promise.all([
      (supabase as any).from('tournament_players').select('*').eq('tournament_id', tournamentId),
      (supabase as any).from('tournament_rounds').select('*').eq('tournament_id', tournamentId),
      (supabase as any).from('tournament_matches').select('*').eq('tournament_id', tournamentId),
    ]);

    setPlayers((pRes.data || []) as TournamentPlayer[]);
    setRounds((rRes.data || []) as TournamentRound[]);
    const matchesData = (mRes.data || []) as TournamentMatch[];
    setMatches(matchesData);

    // Fetch match players
    const matchIds = matchesData.map(m => m.id);
    if (matchIds.length > 0) {
      const { data: mpData } = await (supabase as any)
        .from('tournament_match_players')
        .select('*')
        .in('match_id', matchIds);
      setMatchPlayers((mpData || []) as TournamentMatchPlayer[]);
    }

    // Fetch room codes
    const roomIds = matchesData.filter(m => m.room_id).map(m => m.room_id!);
    if (roomIds.length > 0) {
      const { data: rooms } = await supabase
        .from('game_rooms')
        .select('id, room_code')
        .in('id', roomIds);
      const map = new Map<string, string>();
      rooms?.forEach((r: any) => map.set(r.id, r.room_code));
      setGameRooms(map);
    }
  };

  useEffect(() => {
    if (!code) return;

    const init = async () => {
      const { data: t, error } = await (supabase as any)
        .from('tournaments')
        .select('*')
        .eq('tournament_code', code)
        .single();

      if (error || !t) {
        toast({ title: 'Tournament not found', variant: 'destructive' });
        navigate('/');
        return;
      }

      const tournament = t as unknown as Tournament;
      setTournament(tournament);

      if (tournament.status === 'registration') {
        navigate(`/tournament/${code}`);
        return;
      }

      await fetchAll(tournament.id);
      setIsLoading(false);
    };

    init();
  }, [code, navigate, toast]);

  // Realtime
  useEffect(() => {
    if (!tournament?.id) return;

    const channel = supabase
      .channel(`tournament-bracket-${tournament.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${tournament.id}` }, (payload) => {
        setTournament(payload.new as unknown as Tournament);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_players', filter: `tournament_id=eq.${tournament.id}` }, () => {
        fetchAll(tournament.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_rounds', filter: `tournament_id=eq.${tournament.id}` }, () => {
        fetchAll(tournament.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${tournament.id}` }, () => {
        fetchAll(tournament.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_match_players' }, () => {
        fetchAll(tournament.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournament?.id]);

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

  const champion = tournament.status === 'finished'
    ? (tournament.format === 'knockout'
        ? players.find(p => !p.is_eliminated)
        : [...players].sort((a, b) => b.total_score - a.total_score)[0])
    : null;

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
            <span className={tournament.status === 'finished' ? 'text-primary' : 'text-secondary'}>
              {tournament.status === 'finished' ? 'FINISHED' : 'IN PROGRESS'}
            </span>
          </div>
        </motion.div>

        {/* Champion banner */}
        {champion && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto mb-8 p-6 rounded-xl neon-border bg-card text-center"
          >
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
            <h2 className="font-display text-2xl text-primary neon-text mb-1">CHAMPION</h2>
            <p className="text-xl text-foreground" style={{ color: champion.player_color }}>
              {champion.player_name}
            </p>
            {tournament.format === 'round_robin' && (
              <p className="text-sm text-muted-foreground mt-1">Total score: {champion.total_score}</p>
            )}
          </motion.div>
        )}

        <div className="flex gap-8">
          {/* Bracket / Table */}
          <div className="flex-1 p-6 rounded-xl bg-card/50 border border-border">
            {tournament.format === 'knockout' ? (
              <KnockoutBracket
                rounds={rounds}
                matches={matches}
                matchPlayers={matchPlayers}
                players={players}
                currentSessionId={sessionId}
                gameRooms={gameRooms}
              />
            ) : (
              <RoundRobinTable
                matches={matches}
                matchPlayers={matchPlayers}
                players={players}
                currentSessionId={sessionId}
                gameRooms={gameRooms}
                isFinished={tournament.status === 'finished'}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="w-72 p-4 rounded-xl bg-card/50 border border-border">
            <TournamentPlayerList players={players} hostId={tournament.host_id} />
          </div>
        </div>
      </div>
    </div>
  );
}
