import { cn } from '@/lib/utils';

interface NumberCellProps {
  number: number;
  isClaimed: boolean;
  claimedColor?: string;
  isTarget: boolean;
  onClick: () => void;
  disabled: boolean;
  rotation: number;
  offsetX: number;
  offsetY: number;
}

export function NumberCell({ 
  number, 
  isClaimed, 
  claimedColor, 
  onClick,
  disabled,
  rotation,
  offsetX,
  offsetY
}: NumberCellProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isClaimed}
      className={cn(
        "absolute flex items-center justify-center",
        "font-display text-lg md:text-xl lg:text-2xl font-bold",
        "w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14",
        "rounded-lg select-none",
        "border-2",
        isClaimed ? "cursor-default opacity-60" : "cursor-pointer hover:brightness-125 active:scale-95 transition-[filter,transform] duration-100"
      )}
      style={{
        left: `${offsetX}%`,
        top: `${offsetY}%`,
        transform: `rotate(${rotation}deg) translate(-50%, -50%)`,
        backgroundColor: isClaimed
          ? `${claimedColor}20` 
          : 'hsl(220, 25%, 12%)',
        borderColor: isClaimed 
          ? claimedColor 
          : 'hsl(220, 25%, 25%)',
        color: isClaimed 
          ? claimedColor 
          : 'hsl(220, 10%, 70%)',
        boxShadow: isClaimed 
          ? `0 0 15px ${claimedColor}40, inset 0 0 10px ${claimedColor}20`
          : 'none',
      }}
    >
      {isClaimed && (
        <div
          className="absolute inset-0 rounded-lg animate-scale-in"
          style={{
            background: `radial-gradient(circle, ${claimedColor}30 0%, transparent 70%)`,
          }}
        />
      )}
      <span className="relative z-10">{number}</span>
    </button>
  );
}
