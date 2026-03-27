import { TournamentRound, TournamentMatch, TournamentMatchPlayer, TournamentPlayer } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Trophy, Swords, Clock } from 'lucide-react';

interface KnockoutBracketProps {
  rounds: TournamentRound[];
  matches: TournamentMatch[];
  matchPlayers: TournamentMatchPlayer[];
  players: TournamentPlayer[];
  currentSessionId: string;
  gameRooms: Map<string, string>; // room_id -> room_code
}

export function KnockoutBracket({
  rounds,
  matches,
  matchPlayers,
  players,
  currentSessionId,
  gameRooms,
}: KnockoutBracketProps) {
  const navigate = useNavigate();

  const getPlayerName = (tpId: string) => players.find(p => p.id === tpId)?.player_name || '???';
  const getPlayerColor = (tpId: string) => players.find(p => p.id === tpId)?.player_color || 'hsl(180,100%,50%)';

  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number);

  const isPlayerInMatch = (match: TournamentMatch) => {
    const mps = matchPlayers.filter(mp => mp.match_id === match.id);
    const myTpId = players.find(p => p.session_id === currentSessionId)?.id;
    return mps.some(mp => mp.tournament_player_id === myTpId);
  };

  const getRoundName = (roundNum: number, totalRounds: number) => {
    const fromEnd = totalRounds - roundNum;
    if (fromEnd === 0) return 'FINAL';
    if (fromEnd === 1) return 'SEMI-FINAL';
    if (fromEnd === 2) return 'QUARTER-FINAL';
    return `ROUND ${roundNum}`;
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {sortedRounds.map((round) => {
        const roundMatches = matches
          .filter(m => m.round_id === round.id)
          .sort((a, b) => a.match_number - b.match_number);

        return (
          <div key={round.id} className="flex-shrink-0 min-w-[250px]">
            <h3 className="font-display text-sm text-primary mb-3 text-center">
              {getRoundName(round.round_number, sortedRounds.length)}
            </h3>
            <div className="space-y-3 flex flex-col justify-around h-full">
              {roundMatches.map((match) => {
                const mps = matchPlayers.filter(mp => mp.match_id === match.id);
                const roomCode = match.room_id ? gameRooms.get(match.room_id) : null;

                return (
                  <div
                    key={match.id}
                    className={`rounded-lg border p-3 space-y-2 ${
                      match.status === 'finished'
                        ? 'border-muted bg-card/30'
                        : match.status === 'playing'
                        ? 'border-primary neon-border bg-card'
                        : 'border-border bg-card'
                    }`}
                  >
                    {match.is_bye ? (
                      <div className="text-center text-sm text-muted-foreground">
                        <span style={{ color: getPlayerColor(mps[0]?.tournament_player_id) }}>
                          {getPlayerName(mps[0]?.tournament_player_id)}
                        </span>{' '}
                        — BYE
                      </div>
                    ) : (
                      <>
                        {mps.map((mp) => (
                          <div
                            key={mp.id}
                            className={`flex items-center gap-2 px-2 py-1 rounded ${
                              match.winner_id === mp.tournament_player_id
                                ? 'bg-primary/10'
                                : ''
                            }`}
                          >
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getPlayerColor(mp.tournament_player_id) }}
                            />
                            <span className="flex-1 text-sm text-foreground">
                              {getPlayerName(mp.tournament_player_id)}
                            </span>
                            {match.status === 'finished' && (
                              <span className="text-xs text-muted-foreground">{mp.final_score}</span>
                            )}
                            {match.winner_id === mp.tournament_player_id && (
                              <Trophy className="w-3 h-3 text-yellow-400" />
                            )}
                          </div>
                        ))}
                        {match.status !== 'finished' && isPlayerInMatch(match) && roomCode && (
                          <Button
                            size="sm"
                            className="w-full mt-1 bg-primary hover:bg-primary/80 text-primary-foreground font-display text-xs"
                            onClick={() => navigate(`/room/${roomCode}?tournament=${match.tournament_id}`)}
                          >
                            <Swords className="w-3 h-3 mr-1" />
                            GO TO MATCH
                          </Button>
                        )}
                        {match.status === 'pending' && !isPlayerInMatch(match) && (
                          <div className="flex items-center justify-center text-xs text-muted-foreground gap-1">
                            <Clock className="w-3 h-3" />
                            Waiting
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
