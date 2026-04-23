import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, Crown, Medal } from 'lucide-react';
import { Player, MatchResult } from '@/types/game';
import { formatTime } from '@/lib/gameUtils';
import { Button } from '@/components/ui/button';

interface VictoryOverlayProps {
  players: Player[];
  finalTime: number;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  matchResults?: MatchResult[];
  seriesFinished?: boolean;
  currentMatch?: number;
  matchFormat?: number;
  isHost?: boolean;
  onNextMatch?: () => void;
  onNewSeries?: () => void;
}

export function VictoryOverlay({
  players,
  finalTime,
  onPlayAgain,
  onBackToLobby,
  matchResults = [],
  seriesFinished = false,
  currentMatch = 1,
  matchFormat = 1,
  isHost = false,
  onNextMatch,
  onNewSeries,
}: VictoryOverlayProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Compute series wins per player for series champion
  const winCounts = useMemo(() => {
    const map = new Map<string, number>();
    matchResults.forEach((r) => {
      if (r.winner_player_id) {
        map.set(r.winner_player_id, (map.get(r.winner_player_id) || 0) + 1);
      }
    });
    return map;
  }, [matchResults]);

  const seriesChampion = useMemo(() => {
    if (!seriesFinished || winCounts.size === 0) return null;
    let topId: string | null = null;
    let topWins = -1;
    winCounts.forEach((wins, id) => {
      if (wins > topWins) {
        topWins = wins;
        topId = id;
      }
    });
    return players.find((p) => p.id === topId) || null;
  }, [seriesFinished, winCounts, players]);

  const isBoSeries = matchFormat > 1;

  useEffect(() => {
    const duration = seriesFinished ? 7000 : 3500;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
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
  }, [seriesFinished]);

  const getMedalIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-7 h-7" />;
    if (index === 1) return <Medal className="w-5 h-5" />;
    if (index === 2) return <Medal className="w-5 h-5" />;
    return null;
  };

  // Title text
  const title = seriesFinished
    ? seriesChampion
      ? `VÔ ĐỊCH: ${seriesChampion.player_name.toUpperCase()}`
      : 'KẾT THÚC LOẠT ĐẤU'
    : isBoSeries
      ? `VÁN ${currentMatch}/${matchFormat}`
      : 'GAME OVER!';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="max-w-lg w-full my-auto p-6 md:p-8 rounded-2xl neon-border bg-card text-center"
        style={
          seriesChampion
            ? { borderColor: seriesChampion.player_color, boxShadow: `0 0 30px ${seriesChampion.player_color}55` }
            : undefined
        }
      >
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.4, type: 'spring' }}
          className="mb-6"
        >
          <Crown
            className="w-14 h-14 mx-auto mb-3"
            style={{ color: seriesChampion?.player_color || 'hsl(50, 100%, 60%)' }}
          />
          <h1
            className="font-display text-3xl md:text-4xl neon-text glitch-text"
            style={{ color: seriesChampion?.player_color }}
          >
            {title}
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-5"
        >
          <p className="text-muted-foreground text-sm mb-1">Thời gian ván vừa rồi</p>
          <p className="font-display text-2xl text-secondary neon-text">{formatTime(finalTime)}</p>
        </motion.div>

        {/* Per-match ranking (current match) */}
        <div className="space-y-2 mb-5">
          <p className="text-xs text-muted-foreground font-display tracking-widest text-left">
            BẢNG XẾP HẠNG VÁN
          </p>
          {sortedPlayers.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.8 + index * 0.08 }}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{
                backgroundColor: index === 0 ? `${player.player_color}20` : 'transparent',
                border: index === 0 ? `2px solid ${player.player_color}` : '1px solid hsl(220 25% 20%)',
              }}
            >
              <span className="font-display text-lg" style={{ color: player.player_color }}>
                #{index + 1}
              </span>
              <div style={{ color: player.player_color }}>{getMedalIcon(index)}</div>
              <span className="flex-1 text-left font-semibold" style={{ color: player.player_color }}>
                {player.player_name}
              </span>
              <span className="font-display text-base font-bold" style={{ color: player.player_color }}>
                {player.score} pts
              </span>
            </motion.div>
          ))}
        </div>

        {/* BO series score & history */}
        {isBoSeries && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="mb-5 text-left"
          >
            <p className="text-xs text-muted-foreground font-display tracking-widest mb-2">
              TỈ SỐ LOẠT ĐẤU (BO{matchFormat})
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm"
                  style={{ borderColor: `${p.player_color}80`, color: p.player_color }}
                >
                  <span className="font-semibold">{p.player_name}</span>
                  <span className="font-display">{winCounts.get(p.id) || 0}</span>
                </div>
              ))}
            </div>

            {matchResults.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-2 py-1 text-muted-foreground font-display">Ván</th>
                      <th className="text-left px-2 py-1 text-muted-foreground font-display">Người thắng</th>
                      <th className="text-right px-2 py-1 text-muted-foreground font-display">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchResults
                      .slice()
                      .sort((a, b) => a.match_number - b.match_number)
                      .map((r) => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="px-2 py-1 font-display">#{r.match_number}</td>
                          <td className="px-2 py-1" style={{ color: r.winner_color || undefined }}>
                            {r.winner_name || '—'}
                          </td>
                          <td className="px-2 py-1 text-right font-mono">{formatTime(r.duration_ms)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          {/* Show "Next match" only if BO series in progress and host */}
          {isBoSeries && !seriesFinished && isHost && onNextMatch && (
            <Button
              onClick={onNextMatch}
              className="bg-primary hover:bg-primary/80 text-primary-foreground font-display"
            >
              VÁN TIẾP THEO
            </Button>
          )}

          {/* BO series: show "New series" button when finished, only for host */}
          {isBoSeries && seriesFinished && isHost && onNewSeries && (
            <Button
              onClick={onNewSeries}
              className="bg-primary hover:bg-primary/80 text-primary-foreground font-display"
            >
              TẠO LOẠT MỚI
            </Button>
          )}

          {/* BO1 (legacy): play again button — only host */}
          {!isBoSeries && isHost && (
            <Button
              onClick={onPlayAgain}
              className="bg-primary hover:bg-primary/80 text-primary-foreground font-display"
            >
              PLAY AGAIN
            </Button>
          )}

          <Button
            onClick={onBackToLobby}
            variant="outline"
            className="border-secondary text-secondary hover:bg-secondary/20 font-display"
          >
            BACK TO LOBBY
          </Button>
        </motion.div>

        {/* Hint when waiting for host */}
        {isBoSeries && !seriesFinished && !isHost && (
          <p className="text-xs text-muted-foreground mt-3">Đang chờ quản trò bắt đầu ván tiếp theo...</p>
        )}
      </motion.div>
    </motion.div>
  );
}
