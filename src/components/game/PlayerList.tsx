import { motion } from 'framer-motion';
import { Crown, User } from 'lucide-react';
import { Player } from '@/types/game';
import { cn } from '@/lib/utils';

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
}

export function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-2">
      <h3 className="font-display text-lg text-primary mb-3">PLAYERS</h3>
      {sortedPlayers.map((player, index) => (
        <motion.div
          key={player.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
            player.id === currentPlayerId ? "bg-primary/10" : "bg-card"
          )}
          style={{
            borderColor: player.player_color,
            boxShadow: `0 0 10px ${player.player_color}30`,
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${player.player_color}30` }}
          >
            {player.is_host ? (
              <Crown className="w-4 h-4" style={{ color: player.player_color }} />
            ) : (
              <User className="w-4 h-4" style={{ color: player.player_color }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="font-semibold truncate"
              style={{ color: player.player_color }}
            >
              {player.player_name}
              {player.id === currentPlayerId && (
                <span className="text-xs ml-2 opacity-60">(You)</span>
              )}
            </p>
          </div>
          <div
            className="font-display text-xl font-bold"
            style={{ color: player.player_color }}
          >
            {player.score}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
