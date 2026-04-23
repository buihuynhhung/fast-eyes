export interface GameRoom {
  id: string;
  room_code: string;
  host_id: string;
  max_numbers: number;
  status: 'waiting' | 'playing' | 'finished';
  current_target: number;
  grid_seed: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  match_format: number;
  current_match: number;
  series_status: 'in_progress' | 'finished';
}

export interface MatchResult {
  id: string;
  room_id: string;
  match_number: number;
  winner_player_id: string | null;
  winner_name: string | null;
  winner_color: string | null;
  winner_score: number;
  duration_ms: number;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  player_name: string;
  player_color: string;
  score: number;
  is_host: boolean;
  is_spectator: boolean;
  session_id: string;
  created_at: string;
}

export interface ClaimedNumber {
  id: string;
  room_id: string;
  number: number;
  player_id: string;
  claimed_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  player_id: string | null;
  player_name: string;
  message: string;
  is_system: boolean;
  created_at: string;
}

export interface GameState {
  room: GameRoom | null;
  players: Player[];
  currentPlayer: Player | null;
  claimedNumbers: Map<number, { playerId: string; playerColor: string }>;
  messages: ChatMessage[];
}
