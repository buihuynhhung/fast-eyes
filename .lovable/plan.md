

# Tạo PDF Luật chơi Fast Eyes

## Tổng quan
Tạo file PDF chuyên nghiệp chứa luật chơi đầy đủ của game Fast Eyes Quick Hands, bao gồm Quick Play và Tournament.

## Nội dung PDF

1. **Trang bìa** — Tên game "FAST EYES QUICK HANDS", tagline
2. **Giới thiệu** — Game đua tốc độ tìm số, 1-4 người chơi
3. **Quick Play**
   - Tạo phòng: chọn grid size (9-100), chia sẻ mã phòng 6 ký tự
   - Tham gia: nhập mã phòng, tối đa 4 người
   - Cách chơi: click số theo thứ tự 1→2→3..., mỗi số = 1 điểm, ai nhiều nhất thắng
4. **Tournament**
   - Knockout: chia cặp, thua = loại, số lẻ có bye
   - Round Robin: đấu vòng tròn, tổng điểm xếp hạng
   - Tùy chỉnh 2-32 người, grid size tùy ý
5. **Mẹo chơi**

## Kỹ thuật
- Dùng `reportlab` để tạo PDF với design đẹp (màu tối, neon accent matching game theme)
- Output: `/mnt/documents/fast_eyes_rules.pdf`
- QA bằng `pdftoppm` để kiểm tra visual

