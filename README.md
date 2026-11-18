# Rise Of Cubic Empire Map Builder

Trình dựng map và scenario editor cho mod Rise Of Cubic Empire (Minecraft Java 1.20.1, Forge). Tách ra từ Minecraft Map Builder: có thêm tab [Người chơi] (8 ô như AoE2 Scenario Editor), gán đơn vị mod vào từng ô, và xuất aoe2_scenario.json cùng world.

Mở: `npm install` rồi `npm start`. Đóng gói .exe (Windows): `npm run package`.

---

# Bản gốc: Minecraft Map Builder

Ứng dụng Windows (.exe, Electron) để dựng map Minecraft Java 1.20.1 ngoài game, dễ dùng hơn WorldPainter, phục vụ quay phim chiến trận.

**Trạng thái:** đã build và đang dùng (dựng map Okinawa 1945). Chưa thử hết trong Minecraft thật, xem mục giới hạn trong tài liệu.

## Tính năng chính
- Vẽ địa hình bằng cọ (nâng, hạ, làm mịn, san phẳng, bậc độ cao, vách đá, sông hồ), tô vật liệu, biome, trang trí, mẫu nền.
- Công trình `.schem`: đặt, xoay, lật, đặt lặp, nền móng; hệ tường có chế độ "Nối vẽ" tự ghép; 140 công trình có sẵn (WW2, sân bay, tàu Mỹ, làng, Okinawa...).
- Đường (đường đất, đường băng, hào chiến đấu có thang), cây và vật thể (89 loại), mob (vanilla và mob mod bằng ID + NBT).
- Hang tự sinh và hang đào tay; xem 3D và sửa trong 3D; texture đọc từ jar Minecraft của người dùng.
- Lưu dự án `.mcmap`; xuất world 1.20.1 (có world border, núi hoặc biển bao quanh).

## Chạy và kiểm thử
- Mở chương trình: `npm start`
- Kiểm thử: `npm test`; chạy thử toàn bộ dưới màn hình ảo: `scripts/run-e2e.sh`
- Đóng gói .exe: `npm run package` (hoặc workflow GitHub Actions)

## Tài liệu
- Kế hoạch và nhật ký tính năng: [docs/map_builder_plan.md](docs/map_builder_plan.md)
