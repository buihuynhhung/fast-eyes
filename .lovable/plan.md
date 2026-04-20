

# Tự động thu nhỏ grid để vừa màn hình

## Vấn đề
Khi grid size lớn (vd 81-100 số), canvas có chiều rộng cố định `min(rect.width, 800)` và luôn vuông (aspect-ratio 1:1). Nếu màn hình thấp hơn rộng (laptop ngang), canvas bị tràn xuống dưới → phải scroll.

## Giải pháp
Thay đổi cách tính kích thước canvas trong `CanvasNumberGrid.tsx`: tính toán dựa trên **không gian khả dụng (cả width và height)** của viewport, không chỉ width của container.

### Thay đổi chính trong `src/components/game/CanvasNumberGrid.tsx`

1. **Tính kích thước available height**:
   - Đo vị trí top của container so với viewport
   - Available height = `window.innerHeight - container.top - paddingBottom`
   
2. **Canvas size = min(available width, available height, 800)**:
   - Đảm bảo canvas vuông và vừa hoàn toàn trong khung nhìn
   - Không bao giờ tràn ra ngoài viewport

3. **Cell size tự động co giãn**:
   - `cellSize = size * 0.055` đã tỉ lệ theo canvas size, nên khi canvas nhỏ lại thì số cũng nhỏ theo tự nhiên
   - Với grid lớn (100 số), tăng tỉ lệ cell một chút (vd 0.05) để vẫn dễ click nhưng không chồng chéo

4. **Layout container**:
   - Bỏ `max-w-4xl` cố định trên motion.div, dùng flex center để canvas tự căn giữa
   - GameRoom layout cần đảm bảo phần grid có flex-1 để chiếm không gian còn lại

### File ảnh hưởng
| File | Hành động |
|------|-----------|
| `src/components/game/CanvasNumberGrid.tsx` | Sửa logic tính `size` dựa trên cả width và height viewport |
| `src/pages/GameRoom.tsx` | Kiểm tra & điều chỉnh layout để grid container có chiều cao linh hoạt (nếu cần) |

### Kết quả
- Grid luôn vừa 1 màn hình, không cần scroll
- Trên màn hình nhỏ/grid lớn: số tự động nhỏ lại
- Trên màn hình lớn/grid nhỏ: vẫn giữ kích thước thoải mái (cap 800px)
- Resize window → canvas tự cập nhật

