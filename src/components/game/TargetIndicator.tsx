import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

interface TargetIndicatorProps {
  currentTarget: number;
  maxNumbers: number;
}

export function TargetIndicator({ currentTarget, maxNumbers }: TargetIndicatorProps) {
  const progress = ((currentTarget - 1) / maxNumbers) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-2 px-6 py-3 rounded-lg neon-border-pink bg-card"
    >
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-secondary" />
        <span className="text-sm text-muted-foreground uppercase tracking-wider">
          Find Number
        </span>
      </div>
      <span className="font-display text-4xl md:text-5xl text-secondary neon-text font-bold">
        {currentTarget}
      </span>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary via-secondary to-accent"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {currentTarget - 1} / {maxNumbers}
      </span>
    </motion.div>
  );
}
