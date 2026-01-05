import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { NumberCell } from './NumberCell';
import { shuffleArray, getGridDimensions } from '@/lib/gameUtils';

interface NumberGridProps {
  maxNumbers: number;
  gridSeed: string;
  currentTarget: number;
  claimedNumbers: Map<number, { playerId: string; playerColor: string }>;
  onNumberClick: (number: number) => void;
  disabled: boolean;
}

export function NumberGrid({
  maxNumbers,
  gridSeed,
  currentTarget,
  claimedNumbers,
  onNumberClick,
  disabled
}: NumberGridProps) {
  const shuffledNumbers = useMemo(() => {
    const numbers = Array.from({ length: maxNumbers }, (_, i) => i + 1);
    return shuffleArray(numbers, gridSeed);
  }, [maxNumbers, gridSeed]);

  const { cols } = getGridDimensions(maxNumbers);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-4xl mx-auto p-4"
    >
      <div
        className="grid gap-2 md:gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {shuffledNumbers.map((number, index) => {
          const claimed = claimedNumbers.get(number);
          return (
            <motion.div
              key={number}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.01, duration: 0.3 }}
            >
              <NumberCell
                number={number}
                isClaimed={!!claimed}
                claimedColor={claimed?.playerColor}
                isTarget={number === currentTarget}
                onClick={() => onNumberClick(number)}
                disabled={disabled}
              />
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
