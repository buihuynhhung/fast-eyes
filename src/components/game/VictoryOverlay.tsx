import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, Crown, Medal } from 'lucide-react';
import { Player } from '@/types/game';
import { formatTime } from '@/lib/gameUtils';
import { Button } from '@/components/ui/button';

interface VictoryOverlayProps {
  players: Player[];
  finalTime: number;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export function VictoryOverlay({ 
  players, 
  finalTime, 
  onPlayAgain, 
  onBackToLobby 
}: VictoryOverlayProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  useEffect(() => {
    // Fire confetti
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#00FFFF', '#FF00FF', '#8B5CF6', '#00FF88'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#00FFFF', '#FF00FF', '#8B5CF6', '#00FF88'],
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const getMedalIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-8 h-8" />;
    if (index === 1) return <Medal className="w-6 h-6" />;
    if (index === 2) return <Medal className="w-5 h-5" />;
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="max-w-lg w-full mx-4 p-8 rounded-2xl neon-border bg-card text-center"
      >
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.4, type: "spring" }}
          className="mb-6"
        >
          <Crown className="w-16 h-16 mx-auto text-neon-yellow mb-4" />
          <h1 className="font-display text-4xl md:text-5xl text-primary neon-text glitch-text">
            GAME OVER!
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <p className="text-muted-foreground mb-2">Final Time</p>
          <p className="font-display text-3xl text-secondary neon-text">
            {formatTime(finalTime)}
          </p>
        </motion.div>

        <div className="space-y-3 mb-8">
          {sortedPlayers.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.8 + index * 0.1 }}
              className="flex items-center gap-4 p-4 rounded-lg"
              style={{
                backgroundColor: index === 0 ? `${player.player_color}20` : 'transparent',
                border: index === 0 ? `2px solid ${player.player_color}` : '1px solid hsl(220 25% 20%)',
              }}
            >
              <span
                className="font-display text-2xl"
                style={{ color: player.player_color }}
              >
                #{index + 1}
              </span>
              <div style={{ color: player.player_color }}>
                {getMedalIcon(index)}
              </div>
              <span
                className="flex-1 text-left font-semibold"
                style={{ color: player.player_color }}
              >
                {player.player_name}
              </span>
              <span
                className="font-display text-xl font-bold"
                style={{ color: player.player_color }}
              >
                {player.score} pts
              </span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Button
            onClick={onPlayAgain}
            className="bg-primary hover:bg-primary/80 text-primary-foreground font-display"
          >
            PLAY AGAIN
          </Button>
          <Button
            onClick={onBackToLobby}
            variant="outline"
            className="border-secondary text-secondary hover:bg-secondary/20 font-display"
          >
            BACK TO LOBBY
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
