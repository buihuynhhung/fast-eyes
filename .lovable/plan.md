

# Quản trò + Khán giả cho Quick Play (cập nhật)

## Tổng quan
Khi người dùng bấm **"Tạo phòng"** ở trang chủ, hiện dialog hỏi:
- **"Tôi sẽ chơi"** → host vừa chơi vừa quản lý (giữ nguyên logic cũ)
- **"Chỉ làm quản trò"** → host không chơi, có quyền điều khiển + chia sẻ link khán giả

Thêm route `/watch/:roomCode` cho khán giả xem read-only.

## Luồng người dùng

```text
Trang chủ → "Tạo phòng" → Dialog chọn vai trò:
  ├─ "Tôi sẽ chơi"      → /room/CODE (host = player)
  └─ "Chỉ làm quản trò" → /room/CODE (host = spectator)
                          • Không click số được
                          • 2 nút: Copy mã / Copy link khán giả
                          • Start/Reset

Đấu thủ: nhập mã → /room/CODE → chơi bình thường
Khán giả: mở /watch/CODE → xem grid + điểm + chat (read-only)
```

## Thay đổi

### 1. Database (migration)
- Thêm cột `is_spectator BOOLEAN DEFAULT false` vào bảng `players`.
- Cập nhật RPC `start_game`: đếm chỉ players có `is_spectator = false` (cần ≥2).
- Cập nhật RPC `claim_number`: từ chối nếu `is_spectator = true`.

### 2. Trang chủ (`src/pages/Index.tsx`)
- Thêm dialog chọn vai trò khi bấm "Tạo phòng".
- Truyền cờ `asSpectator: boolean` vào `createRoom`.
- Khi insert host vào `players`: set `is_spectator = asSpectator`.
- Check số đấu thủ tối đa (4): chỉ đếm `is_spectator = false`.

### 3. Phòng chơi (`src/pages/GameRoom.tsx`)
- Nếu `currentPlayer.is_spectator === true`:
  - Truyền `readOnly` vào `CanvasNumberGrid` (không click được).
  - Hiện 2 nút: "Copy mã phòng" và "Copy link khán giả" (`${origin}/watch/${roomCode}`).
- Lọc đấu thủ trong UI (PlayerList): bỏ qua spectator hoặc đánh dấu badge "QUẢN TRÒ".
- Check "phòng đầy" khi join: chỉ đếm non-spectator.

### 4. Trang khán giả mới (`src/pages/SpectatorView.tsx`)
- Route `/watch/:roomCode` trong `App.tsx`.
- Fetch + subscribe realtime: room, players, claimed_numbers, chat_messages.
- Hiển thị: grid (read-only), danh sách đấu thủ + điểm, chat (chỉ xem), timer, header "👁️ ĐANG XEM".
- Không insert gì vào DB.

### 5. Components
- `CanvasNumberGrid.tsx`: thêm prop `readOnly?: boolean` → vô hiệu click + cursor default.
- `ChatBox.tsx`: thêm prop `readOnly?: boolean` → ẩn input + nút send.
- `PlayerList.tsx`: lọc/đánh dấu spectator với badge "QUẢN TRÒ".
- `src/types/game.ts`: thêm `is_spectator: boolean` vào `Player`.

## Files ảnh hưởng

| File | Hành động |
|------|-----------|
| Migration SQL | Thêm cột `is_spectator`, sửa 2 RPC |
| `src/pages/Index.tsx` | Dialog chọn vai trò + truyền cờ |
| `src/pages/GameRoom.tsx` | UI quản trò (2 nút copy, disable click) |
| `src/pages/SpectatorView.tsx` | **Mới** — trang khán giả |
| `src/App.tsx` | Route `/watch/:roomCode` |
| `src/components/game/CanvasNumberGrid.tsx` | Prop `readOnly` |
| `src/components/game/ChatBox.tsx` | Prop `readOnly` |
| `src/components/game/PlayerList.tsx` | Badge "QUẢN TRÒ" |
| `src/types/game.ts` | Thêm `is_spectator` |

## Kết quả
- Người chơi tự do: chọn "Tôi sẽ chơi" → trải nghiệm như cũ.
- Tổ chức trận đấu: chọn "Chỉ làm quản trò" → có màn hình điều khiển + link khán giả.
- Khán giả: xem qua link `/watch/CODE` không can thiệp được.

