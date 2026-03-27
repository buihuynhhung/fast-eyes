import { TournamentPlayer } from '@/types/tournament';
import { Crown, Skull } from 'lucide-react';

interface TournamentPlayerListProps {
  players: TournamentPlayer[];
  hostId: string;
}

export function TournamentPlayerList({ players, hostId }: TournamentPlayerListProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-display text-lg text-primary">
        PLAYERS ({players.length})
      </h3>
      <div className="space-y-1">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: player.player_color }}
            />
            <span className="flex-1 text-foreground">{player.player_name}</span>
            {player.session_id === hostId && (
              <Crown className="w-4 h-4 text-yellow-400" />
            )}
            {player.is_eliminated && (
              <Skull className="w-4 h-4 text-destructive" />
            )}
            {player.total_score > 0 && (
              <span className="text-sm text-muted-foreground">
                {player.total_score} pts
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
