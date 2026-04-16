

# Tối ưu tốc độ phản hồi khi click số

## Vấn đề
Khi người chơi click một số, ứng dụng gửi request tới server (`claim_number` RPC) và **chờ phản hồi** trước khi cập nhật giao diện. Mỗi lần click mất ~100-300ms round-trip, gây cảm giác chậm và lag.

## Giải pháp: Optimistic UI Update
Cập nhật giao diện **ngay lập tức** khi click, không chờ server trả về. Nếu server từ chối (số đã bị người khác claim), rollback lại.

## Thay đổi kỹ thuật

| File | Hành động |
|------|-----------|
| `src/pages/GameRoom.tsx` | Sửa `handleNumberClick` — thêm optimistic update |

### Chi tiết `handleNumberClick`:
1. **Trước khi gọi RPC**: Ngay lập tức cập nhật `claimedNumbers` map với số vừa click (màu của người chơi hiện tại), và tăng `room.current_target` lên 1 trong local state
2. **Gọi RPC** `claim_number` như cũ (không await blocking UI)
3. **Nếu thất bại**: Rollback — xóa số khỏi `claimedNumbers`, giảm `current_target` lại
4. **Bỏ check `number !== room.current_target`** từ state cũ, thay bằng tracking local target riêng để cho phép click liên tiếp nhanh

Kết quả: người chơi có thể click liên tục không cần chờ, UI phản hồi tức thì.

