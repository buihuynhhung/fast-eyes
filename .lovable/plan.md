

# Sửa lag & "ưu tiên Player 1" trong khi tranh số

## Nguyên nhân gốc

Game đang dùng **mô hình "target tuần tự"**: ai click trúng `current_target` sẽ tăng nó lên 1. Để click "mượt" liên tục, mỗi client tự dự đoán target tiếp theo bằng `localTarget` (optimistic).

**Vấn đề:**
- **Player 1 click số 1** → tự đặt `localTarget = 2` ngay → có thể click số 2 ngay lập tức.
- **Player 2** chỉ biết target tăng lên khi nhận được realtime event từ server (50–300 ms tuỳ mạng).
- Trong khoảng thời gian đó, Player 2 click vào số đúng cũng bị **client tự chặn** ở dòng `if (number !== effectiveTarget) return;` (`GameRoom.tsx:395`).
- Player 1 lại tự "đi trước" mỗi lần click, nên Player 2 luôn tụt lại 1 nhịp → **có cảm giác bị "ưu tiên" cho Player 1**.

Ngoài ra: lệnh `SELECT ... FOR UPDATE` trong RPC `claim_number` tuần tự hoá toàn bộ click → click chồng nhau bị xếp hàng → **lag tăng theo số người chơi**.

## Giải pháp

### 1. Bỏ chặn ở client — để server quyết định
File `src/pages/GameRoom.tsx` (`handleNumberClick`):
- **Xoá** điều kiện `if (number !== effectiveTarget) return;`.
- Vẫn giữ `if (claimedNumbers.has(number)) return;` (đã claim rồi thì khỏi gửi).
- Gửi RPC ngay → server là trọng tài duy nhất. Nếu server từ chối (`success: false`), rollback optimistic.
- **Optimistic update có điều kiện**: chỉ apply optimistic UI khi `number === effectiveTarget` (để UX mượt cho người đi đầu); nếu `number > effectiveTarget` thì gửi RPC mà không optimistic, đợi server xác nhận.

### 2. Cập nhật `effectiveTarget` ngay khi thấy số bị claim
Khi nhận realtime event `INSERT claimed_numbers` (dòng 187–208), nếu số được claim **= effectiveTarget hiện tại**, tự tăng `localTarget` lên `claimed.number + 1` luôn → không cần đợi event `UPDATE game_rooms` riêng.

→ Player 2 thấy "số 1 vừa được claim" thì target hiển thị nhảy lên 2 ngay lập tức, có thể click số 2 mà không phải đợi.

### 3. Sửa thông báo lỗi gây hiểu lầm trong RPC
File migration mới — sửa `claim_number`:
- Khi `p_number != v_current_target`, hiện đang trả `'Number already claimed'` → đổi thành `'Wrong number'` hoặc tách 2 trường hợp riêng. Giúp debug & tránh hiểu nhầm.
- (Tuỳ chọn) Bỏ `FOR UPDATE` lock trên `game_rooms`, thay bằng **conditional UPDATE**:
  ```sql
  UPDATE game_rooms 
  SET current_target = current_target + 1 
  WHERE id = p_room_id AND current_target = p_number
  RETURNING current_target INTO v_new_target;
  IF NOT FOUND THEN -- ai khác đã claim
    RETURN jsonb_build_object('success', false, 'error', 'Wrong number');
  END IF;
  ```
  → atomic, không cần lock toàn bảng/row → các click song song không bị xếp hàng.

### 4. Fallback đồng bộ
Giữ `useEffect` hiện tại đồng bộ `localTarget` với `room.current_target` (đã có) — lúc realtime event `game_rooms` UPDATE tới sẽ "kéo" target về đúng nếu lệch.

## Files thay đổi

| File | Hành động |
|------|-----------|
| `src/pages/GameRoom.tsx` | Bỏ chặn target ở client; cập nhật `localTarget` từ event `claimed_numbers`; optimistic có điều kiện |
| Migration SQL mới | Viết lại `claim_number`: conditional UPDATE thay `FOR UPDATE`, sửa error messages |

## Kết quả

- **Player 2 không còn bị "tụt nhịp"**: click bất cứ lúc nào, nếu số đó đang là target → server cho phép, nếu sai → server từ chối ngay.
- **Hết "ưu tiên" Player 1**: cả hai có cơ hội ngang nhau ở mỗi số — ai click trước, server xử trước (atomic).
- **Bớt lag khi nhiều người tranh**: bỏ row-lock → throughput cao hơn.
- Optimistic UI vẫn giữ → người đang dẫn trước cảm giác mượt như cũ.

