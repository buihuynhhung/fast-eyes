export interface Tournament {
  id: string;
  tournament_code: string;
  name: string;
  host_id: string;
  format: 'knockout' | 'round_robin';
  max_players: number;
  grid_size: number;
  status: 'registration' | 'in_progress' | 'finished';
  created_at: string;
}

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  player_name: string;
  session_id: string;
  player_color: string;
  total_score: number;
  is_eliminated: boolean;
  created_at: string;
}

export interface TournamentRound {
  id: string;
  tournament_id: string;
  round_number: number;
  status: 'pending' | 'playing' | 'finished';
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round_id: string;
  room_id: string | null;
  match_number: number;
  status: 'pending' | 'playing' | 'finished';
  winner_id: string | null;
  is_bye: boolean;
  created_at: string;
}

export interface TournamentMatchPlayer {
  id: string;
  match_id: string;
  tournament_player_id: string;
  final_score: number;
  created_at: string;
}
