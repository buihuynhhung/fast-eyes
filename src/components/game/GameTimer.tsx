import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { formatTime } from '@/lib/gameUtils';

interface GameTimerProps {
  startedAt: string | null;
  finishedAt: string | null;
  isPlaying: boolean;
}

export function GameTimer({ startedAt, finishedAt, isPlaying }: GameTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt || !isPlaying) return;

    const startTime = new Date(startedAt).getTime();
    
    if (finishedAt) {
      const endTime = new Date(finishedAt).getTime();
      setElapsed(endTime - startTime);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 10);

    return () => clearInterval(interval);
  }, [startedAt, finishedAt, isPlaying]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-6 py-3 rounded-lg neon-border bg-card"
    >
      <Timer className="w-6 h-6 text-primary" />
      <span className="font-display text-2xl md:text-3xl text-primary neon-text tracking-wider">
        {formatTime(elapsed)}
      </span>
    </motion.div>
  );
}
