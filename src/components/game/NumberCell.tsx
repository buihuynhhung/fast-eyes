import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NumberCellProps {
  number: number;
  isClaimed: boolean;
  claimedColor?: string;
  isTarget: boolean;
  onClick: () => void;
  disabled: boolean;
}

export function NumberCell({ 
  number, 
  isClaimed, 
  claimedColor, 
  isTarget,
  onClick,
  disabled 
}: NumberCellProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || isClaimed}
      whileHover={!isClaimed && !disabled ? { scale: 1.05 } : {}}
      whileTap={!isClaimed && !disabled ? { scale: 0.95 } : {}}
      className={cn(
        "relative aspect-square flex items-center justify-center",
        "font-display text-lg md:text-xl lg:text-2xl font-bold",
        "rounded-lg transition-all duration-200 select-none",
        "border-2",
        isClaimed ? "cursor-default" : "cursor-pointer",
        !isClaimed && !disabled && "hover:brightness-125",
        isTarget && !isClaimed && "animate-pulse-neon"
      )}
      style={{
        backgroundColor: isClaimed 
          ? `${claimedColor}20` 
          : 'hsl(220, 25%, 10%)',
        borderColor: isClaimed 
          ? claimedColor 
          : isTarget 
            ? 'hsl(180, 100%, 50%)' 
            : 'hsl(220, 25%, 20%)',
        color: isClaimed 
          ? claimedColor 
          : isTarget 
            ? 'hsl(180, 100%, 50%)' 
            : 'hsl(220, 10%, 60%)',
        boxShadow: isClaimed 
          ? `0 0 15px ${claimedColor}40, inset 0 0 10px ${claimedColor}20`
          : isTarget
            ? '0 0 20px hsl(180 100% 50% / 0.4), 0 0 40px hsl(180 100% 50% / 0.2)'
            : 'none',
      }}
    >
      {isClaimed && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute inset-0 rounded-lg"
          style={{
            background: `radial-gradient(circle, ${claimedColor}30 0%, transparent 70%)`,
          }}
        />
      )}
      <span className="relative z-10">{number}</span>
    </motion.button>
  );
}
