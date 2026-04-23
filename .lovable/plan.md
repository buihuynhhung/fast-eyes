

# Best-of (BO1/BO3/BO5) cho Quick Play

## Tổng quan
Khi tạo phòng, quản trò chọn định dạng **BO1 / BO3 / BO5**. Phòng tự động chạy nhiều ván liên tiếp, lưu kết quả từng ván, người thắng nhiều ván nhất là vô địch.

## Luồng người dùng

```text
Tạo phòng:
  Dialog hiện thêm: [BO1] [BO3] [BO5]  ← chọn 1
  
Trong phòng:
  Header hiển thị: "Ván 1/3 — Tỉ số: An 0 - Bình 0"
  
  Ván kết thúc (overlay):
    • Bảng xếp hạng ván vừa rồi (như cũ)
    • Bảng tỉ số tổng (số ván thắng / mỗi player)
    • Nút [Ván tiếp theo]  ← chỉ host bấm
    
  Sau ván cuối:
    • Overlay đổi thành "VÔ ĐỊCH: <tên>"
    • Hiển thị tổng kết tất cả ván (đơn giản: ván # | người thắng | thời gian)
    • Nút [Tạo loạt mới] (reset toàn bộ) / [Về sảnh]

Khi 1 player đạt đủ ván thắng để chốt sớm (vd BO3 ai đó thắng 2-0):
  Loạt kết thúc luôn, không chơi nốt ván thừa.
```

## Thay đổi

### 1. Database (migration)

**Bảng `game_rooms`** — thêm 3 cột:
- `match_format` INT DEFAULT 1 — số ván tối đa (1, 3, 5)
- `current_match` INT DEFAULT 1 — ván hiện tại
- `series_status` TEXT DEFAULT 'in_progress' — `in_progress` | `finished`

**Bảng mới `match_results`** — lưu kết quả từng ván:
- `id` uuid PK
- `room_id` uuid → game_rooms
- `match_number` int
- `winner_player_id` uuid → players (null nếu hòa)
- `duration_ms` int
- `created_at` timestamptz
- RLS: anyone can SELECT/INSERT (cùng pattern với các bảng hiện tại)
- REPLICA IDENTITY FULL + add to realtime publication

**RPC `claim_number`** — khi ván kết thúc:
- Insert row vào `match_results` (winner = player có score cao nhất trong ván, duration = `now() - started_at`)
- Tính tỉ số: nếu có player thắng > `match_format / 2` ván → set `series_status = 'finished'`, giữ `status = 'finished'`
- Ngược lại: giữ `status = 'finished'` (chờ host bấm "Ván tiếp theo")

**RPC mới `next_match`** (host-only):
- Validate host + `series_status = 'in_progress'` + `status = 'finished'`
- Tăng `current_match`, reset `current_target = 1`, `started_at = NULL`, `finished_at = NULL`, `status = 'waiting'`
- Đổi `grid_seed` mới (random)
- Reset `score` của tất cả players về 0
- Xóa `claimed_numbers` của room
- (Không xóa `match_results` — giữ lịch sử)

**RPC `reset_game`** (cập nhật):
- Đổi tên/mục đích: dùng cho **bắt đầu loạt mới** sau khi series kết thúc
- Reset `current_match = 1`, `series_status = 'in_progress'`, xóa `match_results` của room

### 2. Frontend

**`src/pages/Index.tsx`** — Dialog tạo phòng:
- Thêm 3 nút radio: BO1 / BO3 / BO5 (default BO1 = giữ hành vi cũ)
- Truyền `match_format` vào insert `game_rooms`

**`src/types/game.ts`** — thêm:
- `match_format`, `current_match`, `series_status` vào `GameRoom`
- Type mới `MatchResult`

**`src/pages/GameRoom.tsx`**:
- Subscribe thêm bảng `match_results` cho room
- Header: hiển thị "Ván X/Y — Tỉ số: [tên: số ván thắng]" khi `match_format > 1`
- Khi ván kết thúc:
  - Nếu `series_status === 'in_progress'`: VictoryOverlay hiện nút **"Ván tiếp theo"** (chỉ host) thay cho "Play Again"
  - Nếu `series_status === 'finished'`: hiện overlay vô địch + bảng tổng kết các ván + nút "Tạo loạt mới"
- Nút "Ván tiếp theo" gọi RPC `next_match`

**`src/components/game/VictoryOverlay.tsx`** — props mới:
- `matchResults?: MatchResult[]` (tổng kết các ván đã đấu)
- `seriesFinished?: boolean` (đổi tiêu đề + nút)
- `currentMatch?: number`, `matchFormat?: number`
- `players` (đã có): dùng để map winner_id → tên + màu
- Nếu `matchResults` có dữ liệu: render bảng nhỏ "Ván # | Người thắng | Thời gian"

**`src/pages/SpectatorView.tsx`**:
- Hiển thị header "Ván X/Y — Tỉ số: ..."
- Khi series kết thúc: hiện bảng tổng kết các ván (read-only)

## Files ảnh hưởng

| File | Hành động |
|------|-----------|
| Migration SQL | Thêm cột vào `game_rooms`, tạo bảng `match_results`, sửa `claim_number` & `reset_game`, tạo RPC `next_match` |
| `src/types/game.ts` | Thêm fields + type `MatchResult` |
| `src/pages/Index.tsx` | Radio BO1/BO3/BO5 trong dialog |
| `src/pages/GameRoom.tsx` | Header tỉ số, fetch/subscribe `match_results`, gọi `next_match`, đổi logic overlay |
| `src/pages/SpectatorView.tsx` | Header tỉ số + bảng tổng kết |
| `src/components/game/VictoryOverlay.tsx` | Hiện bảng các ván + nút "Ván tiếp theo" / "Tạo loạt mới" |

## Kết quả
- Tạo phòng BO3 → chơi 2-3 ván liên tiếp, kết quả từng ván được lưu.
- Ai thắng đa số ván trước = vô địch (chốt sớm khi có thể).
- Bảng tổng kết hiển thị từng ván: ai thắng + thời gian.
- BO1 (mặc định) hành xử y như hiện tại — không ảnh hưởng người dùng cũ.

