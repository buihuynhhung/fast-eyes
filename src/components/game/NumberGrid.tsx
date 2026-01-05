import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { NumberCell } from './NumberCell';
import { seededRandom } from '@/lib/gameUtils';

interface NumberGridProps {
  maxNumbers: number;
  gridSeed: string;
  currentTarget: number;
  claimedNumbers: Map<number, { playerId: string; playerColor: string }>;
  onNumberClick: (number: number) => void;
  disabled: boolean;
}

interface NumberPosition {
  number: number;
  x: number;
  y: number;
  rotation: number;
}

export function NumberGrid({
  maxNumbers,
  gridSeed,
  currentTarget,
  claimedNumbers,
  onNumberClick,
  disabled
}: NumberGridProps) {
  // Generate scattered positions for each number
  const numberPositions = useMemo(() => {
    const random = seededRandom(gridSeed);
    const positions: NumberPosition[] = [];
    const cellSize = 12; // percentage of container
    const padding = 8;
    
    for (let i = 1; i <= maxNumbers; i++) {
      let attempts = 0;
      let x: number, y: number;
      
      // Try to find a non-overlapping position
      do {
        x = padding + random() * (100 - 2 * padding - cellSize);
        y = padding + random() * (100 - 2 * padding - cellSize);
        attempts++;
      } while (
        attempts < 50 &&
        positions.some(p => 
          Math.abs(p.x - x) < cellSize * 0.8 && 
          Math.abs(p.y - y) < cellSize * 0.8
        )
      );
      
      positions.push({
        number: i,
        x,
        y,
        rotation: (random() - 0.5) * 30 // -15 to +15 degrees
      });
    }
    
    return positions;
  }, [maxNumbers, gridSeed]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-4xl mx-auto p-4"
    >
      <div className="relative w-full aspect-square bg-background/50 rounded-xl border border-border/50">
        {numberPositions.map((pos, index) => {
          const claimed = claimedNumbers.get(pos.number);
          return (
            <motion.div
              key={pos.number}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.01, duration: 0.3 }}
            >
              <NumberCell
                number={pos.number}
                isClaimed={!!claimed}
                claimedColor={claimed?.playerColor}
                isTarget={pos.number === currentTarget}
                onClick={() => onNumberClick(pos.number)}
                disabled={disabled}
                rotation={pos.rotation}
                offsetX={pos.x}
                offsetY={pos.y}
              />
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
