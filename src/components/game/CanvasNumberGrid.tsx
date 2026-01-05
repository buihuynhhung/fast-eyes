import { useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { seededRandom } from '@/lib/gameUtils';

interface CanvasNumberGridProps {
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

export function CanvasNumberGrid({
  maxNumbers,
  gridSeed,
  currentTarget,
  claimedNumbers,
  onNumberClick,
  disabled
}: CanvasNumberGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<NumberPosition[]>([]);
  const scaleRef = useRef(1);

  // Generate positions using grid-based placement
  const numberPositions = useMemo(() => {
    const random = seededRandom(gridSeed);
    const positions: NumberPosition[] = [];
    
    const gridSize = Math.ceil(Math.sqrt(maxNumbers));
    const cellWidth = 100 / gridSize;
    const cellHeight = 100 / gridSize;
    const jitterX = cellWidth * 0.25;
    const jitterY = cellHeight * 0.25;
    const padding = 6;
    
    const gridPositions: { row: number; col: number }[] = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        gridPositions.push({ row, col });
      }
    }
    
    for (let i = gridPositions.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [gridPositions[i], gridPositions[j]] = [gridPositions[j], gridPositions[i]];
    }
    
    for (let i = 1; i <= maxNumbers; i++) {
      const gridPos = gridPositions[i - 1];
      const baseX = (gridPos.col + 0.5) * cellWidth;
      const baseY = (gridPos.row + 0.5) * cellHeight;
      const x = Math.max(padding, Math.min(100 - padding, baseX + (random() - 0.5) * jitterX * 2));
      const y = Math.max(padding, Math.min(100 - padding, baseY + (random() - 0.5) * jitterY * 2));
      
      positions.push({
        number: i,
        x,
        y,
        rotation: (random() - 0.5) * 30
      });
    }
    
    positionsRef.current = positions;
    return positions;
  }, [maxNumbers, gridSeed]);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(rect.width, 800);
    
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    
    scaleRef.current = size / 100;
    
    ctx.scale(dpr, dpr);
    
    // Clear and draw background
    ctx.fillStyle = 'hsla(220, 25%, 8%, 0.5)';
    ctx.fillRect(0, 0, size, size);
    
    // Draw border
    ctx.strokeStyle = 'hsla(220, 25%, 20%, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    const cellSize = size * 0.055; // Size of number cell
    const fontSize = cellSize * 0.5;

    numberPositions.forEach((pos) => {
      const claimed = claimedNumbers.get(pos.number);
      const x = (pos.x / 100) * size;
      const y = (pos.y / 100) * size;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((pos.rotation * Math.PI) / 180);
      
      // Draw cell background
      const halfCell = cellSize / 2;
      ctx.beginPath();
      ctx.roundRect(-halfCell, -halfCell, cellSize, cellSize, 8);
      
      if (claimed) {
        // Claimed state - use player color
        ctx.fillStyle = `${claimed.playerColor}20`;
        ctx.fill();
        ctx.strokeStyle = claimed.playerColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Glow effect
        ctx.shadowColor = claimed.playerColor;
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Unclaimed state
        ctx.fillStyle = 'hsl(220, 25%, 12%)';
        ctx.fill();
        ctx.strokeStyle = 'hsl(220, 25%, 25%)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Draw number
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = claimed ? claimed.playerColor : 'hsl(220, 10%, 70%)';
      
      if (claimed) {
        ctx.globalAlpha = 0.6;
      }
      
      ctx.fillText(pos.number.toString(), 0, 0);
      ctx.globalAlpha = 1;
      
      ctx.restore();
    });
  }, [numberPositions, claimedNumbers]);

  // Handle resize
  useEffect(() => {
    drawCanvas();
    
    const handleResize = () => {
      drawCanvas();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  // Handle click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const cellSizePercent = 5.5;
    
    // Find clicked number
    for (const pos of positionsRef.current) {
      const claimed = claimedNumbers.get(pos.number);
      if (claimed) continue; // Skip claimed numbers
      
      // Calculate distance considering rotation
      const dx = x - pos.x;
      const dy = y - pos.y;
      
      // Simple bounding box check (rotation makes it slightly larger hit area)
      if (Math.abs(dx) < cellSizePercent && Math.abs(dy) < cellSizePercent) {
        onNumberClick(pos.number);
        return;
      }
    }
  }, [disabled, claimedNumbers, onNumberClick]);

  // Update cursor based on hover
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) {
      e.currentTarget.style.cursor = 'default';
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const cellSizePercent = 5.5;
    
    for (const pos of positionsRef.current) {
      const claimed = claimedNumbers.get(pos.number);
      if (claimed) continue;
      
      const dx = x - pos.x;
      const dy = y - pos.y;
      
      if (Math.abs(dx) < cellSizePercent && Math.abs(dy) < cellSizePercent) {
        e.currentTarget.style.cursor = 'pointer';
        return;
      }
    }
    
    e.currentTarget.style.cursor = 'default';
  }, [disabled, claimedNumbers]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-4xl mx-auto p-4"
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        className="rounded-xl mx-auto"
        style={{ touchAction: 'none' }}
      />
    </motion.div>
  );
}
