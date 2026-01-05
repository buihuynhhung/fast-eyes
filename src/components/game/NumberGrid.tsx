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
  // Generate scattered positions for each number using grid-based placement
  const numberPositions = useMemo(() => {
    const random = seededRandom(gridSeed);
    const positions: NumberPosition[] = [];
    
    // Calculate grid size based on number count
    const gridSize = Math.ceil(Math.sqrt(maxNumbers));
    const cellWidth = 100 / gridSize;
    const cellHeight = 100 / gridSize;
    const jitterX = cellWidth * 0.25; // Random offset within cell
    const jitterY = cellHeight * 0.25;
    const padding = 6; // Padding from edges
    
    // Create all grid positions
    const gridPositions: { row: number; col: number }[] = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        gridPositions.push({ row, col });
      }
    }
    
    // Shuffle grid positions for randomness
    for (let i = gridPositions.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [gridPositions[i], gridPositions[j]] = [gridPositions[j], gridPositions[i]];
    }
    
    for (let i = 1; i <= maxNumbers; i++) {
      const gridPos = gridPositions[i - 1];
      
      // Base position at center of grid cell
      const baseX = (gridPos.col + 0.5) * cellWidth;
      const baseY = (gridPos.row + 0.5) * cellHeight;
      
      // Add jitter but keep within bounds
      const x = Math.max(padding, Math.min(100 - padding, baseX + (random() - 0.5) * jitterX * 2));
      const y = Math.max(padding, Math.min(100 - padding, baseY + (random() - 0.5) * jitterY * 2));
      
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
