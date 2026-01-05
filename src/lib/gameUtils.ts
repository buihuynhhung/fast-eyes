// Seeded random number generator for consistent grid across players
export function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return function() {
    hash = Math.sin(hash) * 10000;
    return hash - Math.floor(hash);
  };
}

export function shuffleArray<T>(array: T[], seed: string): T[] {
  const result = [...array];
  const random = seededRandom(seed);
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const PLAYER_COLORS = [
  { name: 'Cyan', class: 'player-1', hsl: 'hsl(180, 100%, 50%)' },
  { name: 'Pink', class: 'player-2', hsl: 'hsl(330, 100%, 60%)' },
  { name: 'Green', class: 'player-3', hsl: 'hsl(150, 100%, 50%)' },
  { name: 'Yellow', class: 'player-4', hsl: 'hsl(50, 100%, 55%)' },
];

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}

export function getGridDimensions(totalNumbers: number): { cols: number; rows: number } {
  if (totalNumbers <= 25) return { cols: 5, rows: 5 };
  if (totalNumbers <= 36) return { cols: 6, rows: 6 };
  if (totalNumbers <= 49) return { cols: 7, rows: 7 };
  if (totalNumbers <= 64) return { cols: 8, rows: 8 };
  if (totalNumbers <= 81) return { cols: 9, rows: 9 };
  return { cols: 10, rows: 10 };
}
