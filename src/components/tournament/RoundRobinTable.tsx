import { TournamentMatch, TournamentMatchPlayer, TournamentPlayer } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Swords, Trophy } from 'lucide-react';

interface RoundRobinTableProps {
  matches: TournamentMatch[];
  matchPlayers: TournamentMatchPlayer[];
  players: TournamentPlayer[];
  currentSessionId: string;
  gameRooms: Map<string, string>;
  isFinished: boolean;
}

export function RoundRobinTable({
  matches,
  matchPlayers,
  players,
  currentSessionId,
  gameRooms,
  isFinished,
}: RoundRobinTableProps) {
  const navigate = useNavigate();

  const sortedPlayers = [...players].sort((a, b) => b.total_score - a.total_score);
  const myTpId = players.find(p => p.session_id === currentSessionId)?.id;

  const getPlayerName = (tpId: string) => players.find(p => p.id === tpId)?.player_name || '???';
  const getPlayerColor = (tpId: string) => players.find(p => p.id === tpId)?.player_color || 'hsl(180,100%,50%)';

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div>
        <h3 className="font-display text-lg text-primary mb-3">LEADERBOARD</h3>
        <div className="space-y-1">
          {sortedPlayers.map((player, idx) => (
            <div
              key={player.id}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
                idx === 0 && isFinished ? 'bg-primary/10 border border-primary' : 'bg-muted/50'
              }`}
            >
              <span className="font-display text-lg w-8 text-muted-foreground">
                #{idx + 1}
              </span>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: player.player_color }}
              />
              <span className="flex-1 text-foreground">{player.player_name}</span>
              {idx === 0 && isFinished && <Trophy className="w-4 h-4 text-yellow-400" />}
              <span className="font-display text-primary">{player.total_score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Matches */}
      <div>
        <h3 className="font-display text-lg text-secondary mb-3">MATCHES</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {matches.map((match) => {
            const mps = matchPlayers.filter(mp => mp.match_id === match.id);
            const roomCode = match.room_id ? gameRooms.get(match.room_id) : null;
            const isMyMatch = mps.some(mp => mp.tournament_player_id === myTpId);

            return (
              <div
                key={match.id}
                className={`rounded-lg border p-3 ${
                  match.status === 'finished'
                    ? 'border-muted bg-card/30'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  {mps.map((mp, i) => (
                    <div key={mp.id} className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getPlayerColor(mp.tournament_player_id) }}
                      />
                      <span className="text-sm text-foreground">
                        {getPlayerName(mp.tournament_player_id)}
                      </span>
                      {match.status === 'finished' && (
                        <span className="text-xs text-muted-foreground ml-1">({mp.final_score})</span>
                      )}
                      {i === 0 && mps.length > 1 && (
                        <span className="text-xs text-muted-foreground mx-2">vs</span>
                      )}
                    </div>
                  ))}
                </div>
                {match.status !== 'finished' && isMyMatch && roomCode && (
                  <Button
                    size="sm"
                    className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-display text-xs"
                    onClick={() => navigate(`/room/${roomCode}?tournament=${match.tournament_id}`)}
                  >
                    <Swords className="w-3 h-3 mr-1" />
                    GO TO MATCH
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
