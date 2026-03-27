

# Tính năng Giải đấu (Tournament)

## Tổng quan
Thêm hệ thống tạo và quản lý giải đấu cho game Fast Eyes, hỗ trợ cả knockout và round-robin, số lượng người chơi tùy chỉnh.

## Database - Bảng mới

### `tournaments`
- `id`, `tournament_code` (6 ký tự), `name`, `host_id` (session_id)
- `format`: enum `knockout` | `round_robin`
- `max_players`, `grid_size` (số trên lưới mỗi ván)
- `status`: `registration` → `in_progress` → `finished`
- `created_at`

### `tournament_players`
- `id`, `tournament_id`, `player_name`, `session_id`, `total_score`, `is_eliminated`, `created_at`

### `tournament_rounds`
- `id`, `tournament_id`, `round_number`, `status` (`pending`/`playing`/`finished`)

### `tournament_matches`
- `id`, `round_id`, `tournament_id`, `room_id` (FK → game_rooms)
- `match_number`, `status`
- Liên kết mỗi match với một game_room thực tế

### `tournament_match_players`
- `id`, `match_id`, `tournament_player_id`, `final_score`

## Database Functions (RPC)

1. **`create_tournament`** - Tạo giải, trả về tournament_code
2. **`join_tournament`** - Đăng ký tham gia
3. **`start_tournament`** - Host bắt đầu giải, tự động:
   - Knockout: chia cặp ngẫu nhiên, tạo round 1 + matches + game_rooms
   - Round-robin: tạo tất cả các cặp đấu, chia thành rounds
4. **`advance_tournament`** - Khi một match kết thúc, kiểm tra round xong chưa → tạo round tiếp (knockout) hoặc tính tổng điểm (round-robin)

## Frontend - Trang mới

### 1. Trang chủ (`Index.tsx`)
- Thêm nút "CREATE TOURNAMENT" và "JOIN TOURNAMENT" bên cạnh create/join room hiện tại

### 2. Trang Tournament Lobby (`/tournament/:code`)
- Hiển thị danh sách người chơi đã đăng ký
- Host thấy nút "START TOURNAMENT"
- Hiển thị format (knockout/round-robin) và cài đặt

### 3. Trang Tournament Bracket (`/tournament/:code/bracket`)
- **Knockout**: Hiển thị bracket dạng cây (quarter → semi → final)
- **Round-robin**: Bảng xếp hạng với điểm tích lũy
- Hiển thị trận đang diễn ra, kết quả đã xong
- Nút "GO TO MATCH" để vào game_room của trận mình

### 4. Tích hợp GameRoom
- Khi game kết thúc trong tournament match, gọi `advance_tournament` để cập nhật bracket
- Nút "Back to Tournament" thay vì "Back to Lobby"

## Flow chính

```text
Host tạo tournament → Chia sẻ code → Players join
      ↓
Host start → Hệ thống tạo rounds + matches + rooms
      ↓
Players vào room đấu → Chơi game bình thường
      ↓
Game xong → advance_tournament → Tạo round tiếp (knockout)
                                  hoặc match tiếp (round-robin)
      ↓
Tất cả rounds xong → Hiển thị champion
```

## Chi tiết kỹ thuật

- Realtime cho `tournaments`, `tournament_players`, `tournament_rounds`, `tournament_matches` để cập nhật bracket live
- RLS: public insert/select (giống các bảng hiện tại, không cần auth)
- Knockout: mỗi match 2 người, người thắng (score cao hơn) đi tiếp
- Round-robin: mỗi người đấu với tất cả, tổng score xếp hạng
- Nếu số người lẻ (knockout): một người được bye (tự động thắng)
- Trang bracket sử dụng component riêng cho từng format

## Các file cần tạo/sửa

| File | Hành động |
|------|-----------|
| DB migration | Tạo 5 bảng + 4 RPC functions + realtime |
| `src/types/tournament.ts` | Types mới |
| `src/pages/TournamentLobby.tsx` | Trang lobby giải đấu |
| `src/pages/TournamentBracket.tsx` | Trang bracket/bảng xếp hạng |
| `src/components/tournament/KnockoutBracket.tsx` | Component bracket knockout |
| `src/components/tournament/RoundRobinTable.tsx` | Component bảng round-robin |
| `src/components/tournament/TournamentPlayerList.tsx` | Danh sách người chơi |
| `src/pages/Index.tsx` | Thêm section tournament |
| `src/pages/GameRoom.tsx` | Thêm logic tournament match |
| `src/App.tsx` | Thêm routes mới |

