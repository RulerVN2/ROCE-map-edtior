// Sinh bộ công trình sân bay thành file .schem trong src/assets/san_bay.
// Quy ước: mũi máy bay và cửa chính quay về phía BẮC / NAM như ghi từng mục; xoay bằng R trong editor.
// Các mảnh mặt phẳng (đường băng, đường lăn, sân đỗ) chỉ dày 1 khối: đặt với "Độ cao đặt" = -1 để mặt đường ngang mặt đất.
import fs from 'node:fs';
import path from 'node:path';
import { Build, cfg, stairs, slab, log, ladder, hash } from './build-lib.js';

cfg.out = path.resolve(process.argv[2] ?? 'src/assets/san_bay');
fs.mkdirSync(cfg.out, { recursive: true });

const door = (wood, facing, half) => `${wood}_door[facing=${facing},half=${half},hinge=left,open=false,powered=false]`;
const lantern = 'lantern[hanging=true,waterlogged=false]';
const chest = (f) => `chest[facing=${f},type=single,waterlogged=false]`;
const barrel = 'barrel[facing=up,open=false]';
const rod = 'lightning_rod[facing=up,powered=false,waterlogged=false]';
const asphalt = (x, y, z) => (hash(x, y, z) % 14 === 0 ? 'light_gray_concrete' : 'gray_concrete');
const conc = (x, y, z) => (hash(x, y, z) % 9 ? 'light_gray_concrete' : 'stone');
const bag = (x, y, z) => (hash(x, y, z) % 3 ? 'smooth_sandstone' : 'sandstone');
const GLASS = 'light_blue_stained_glass';

// 1. Đường băng 11 x 32: vạch trắng hai mép và vạch giữa nét đứt. Nối nhiều đoạn theo chiều dài.
{
  const b = new Build(11, 1, 32);
  b.fill(0, 0, 0, 10, 0, 31, asphalt);
  for (let z = 0; z < 32; z++) { b.set(1, 0, z, 'white_concrete'); b.set(9, 0, z, 'white_concrete'); if (z % 8 < 5) b.set(5, 0, z, 'white_concrete'); }
  b.save('duong_bang_32');
}

// 2. Đầu đường băng 11 x 16: vạch "phím đàn" và vạch ngưỡng, nối với đoạn thân đường băng ở phía nam.
{
  const b = new Build(11, 1, 16);
  b.fill(0, 0, 0, 10, 0, 15, asphalt);
  for (let z = 0; z < 16; z++) { b.set(1, 0, z, 'white_concrete'); b.set(9, 0, z, 'white_concrete'); }
  for (let z = 2; z <= 7; z++) for (const x of [2, 4, 6, 8]) b.set(x, 0, z, 'white_concrete');
  for (let x = 1; x <= 9; x++) b.set(x, 0, 9, 'white_concrete');
  for (let z = 11; z < 16; z++) if (z !== 13) b.set(5, 0, z, 'white_concrete');
  b.save('duong_bang_dau');
}

// 3. Đường lăn 5 x 16: vạch vàng giữa, mép vàng.
{
  const b = new Build(5, 1, 16);
  b.fill(0, 0, 0, 4, 0, 15, asphalt);
  for (let z = 0; z < 16; z++) if (z % 4 < 3) b.set(2, 0, z, 'yellow_concrete');
  for (let z = 0; z < 16; z++) { b.set(0, 0, z, 'yellow_concrete'); b.set(4, 0, z, 'yellow_concrete'); }
  b.save('duong_lan_5');
}

// 4. Sân đỗ máy bay 21 x 21: viền vàng, chữ T chỉ chỗ đỗ, hai vị trí đỗ.
{
  const b = new Build(21, 1, 21);
  b.fill(0, 0, 0, 20, 0, 20, asphalt);
  for (let i = 0; i < 21; i++) { for (const [x, z] of [[i, 0], [i, 20], [0, i], [20, i]]) b.set(x, 0, z, 'yellow_concrete'); }
  for (const cx of [5, 15]) { for (let z = 3; z <= 16; z++) b.set(cx, 0, z, 'white_concrete'); for (let x = cx - 2; x <= cx + 2; x++) b.set(x, 0, 16, 'white_concrete'); }
  b.save('san_do_may_bay');
}

// 5. Nhà chứa máy bay: mái vòm lớn, hai cánh cửa trượt kéo sang hai bên ở đầu bắc, đầu nam kín. Đặt với cửa quay ra phía bắc.
{
  const R = 9.3, c = 9, b = new Build(19, 10, 23);
  for (let z = 0; z < 23; z++) for (let x = 0; x < 19; x++) for (let y = 0; y < 10; y++) {
    const d = Math.hypot(x - c, y);
    if (d <= R && d > R - 1.2) b.set(x, y, z, z % 4 === 0 ? 'gray_concrete' : 'light_gray_concrete');
    else if (d <= R - 1.2 && z === 22) b.set(x, y, z, 'light_gray_concrete');
    else if (y === 0 && d <= R) b.set(x, y, z, 'polished_andesite');
  }
  for (let y = 1; y <= 7; y++) for (let x = 0; x < 19; x++) {                              // cánh cửa trượt
    const d = Math.hypot(x - c, y);
    if (d <= R - 1.2 && ((x >= 1 && x <= 4) || (x >= 14 && x <= 17))) b.set(x, y, 0, 'gray_concrete');
  }
  for (const z of [4, 10, 16]) b.set(9, 7, z, lantern);
  for (const x of [3, 15]) { b.set(x, 1, 20, barrel); b.set(x + 1, 1, 20, chest('north')); }
  b.set(9, 1, 20, 'anvil[facing=east]'); b.set(8, 1, 20, 'smithing_table');
  b.set(5, 1, 21, 'hay_block[axis=x]'); b.set(14, 1, 21, barrel); b.set(13, 1, 21, barrel);
  b.save('nha_chua_may_bay');
}

// 6. Tháp kiểm soát không lưu: nhà nền, thân tháp có thang, buồng kính, anten radar. Cửa ở phía nam.
{
  const b = new Build(11, 24, 11);
  b.fill(0, 0, 0, 10, 0, 10, 'stone_bricks');
  b.walls(1, 1, 1, 9, 4, 9, conc); b.fill(1, 5, 1, 9, 5, 9, 'gray_concrete');
  for (const [x, z] of [[1, 1], [9, 1], [1, 9], [9, 9]]) b.fill(x, 1, z, x, 5, z, 'gray_concrete');
  for (const x of [3, 7]) { b.set(x, 2, 1, 'glass_pane'); b.set(x, 2, 9, 'glass_pane'); }
  for (const z of [3, 7]) { b.set(1, 2, z, 'glass_pane'); b.set(9, 2, z, 'glass_pane'); }
  b.set(5, 1, 9, door('iron', 'north', 'lower')); b.set(5, 2, 9, door('iron', 'north', 'upper'));
  b.walls(3, 1, 3, 7, 14, 7, conc);
  for (const [x, z] of [[3, 3], [7, 3], [3, 7], [7, 7]]) b.fill(x, 1, z, x, 14, z, 'gray_concrete');
  b.clear(5, 1, 7); b.clear(5, 2, 7); b.set(5, 1, 7, door('iron', 'north', 'lower')); b.set(5, 2, 7, door('iron', 'north', 'upper'));
  for (const y of [4, 9]) b.walls(3, y, 3, 7, y, 7, 'gray_concrete');
  b.set(3, 8, 5, 'iron_bars'); b.set(7, 8, 5, 'iron_bars'); b.set(5, 11, 3, 'iron_bars');
  for (let y = 1; y <= 16; y++) b.set(5, y, 4, ladder('south'));
  b.set(5, 15, 3, 'gray_concrete'); b.set(5, 16, 3, 'gray_concrete');
  b.fill(2, 15, 2, 8, 15, 8, 'gray_concrete'); b.set(5, 15, 4, ladder('south'));
  b.set(3, 2, 5, 'lectern[facing=east,has_book=false,powered=false]'); b.set(2, 1, 6, barrel); b.set(2, 1, 7, chest('east'));
  b.walls(2, 16, 2, 8, 17, 8, 'glass_pane');
  for (const [x, z] of [[2, 2], [8, 2], [2, 8], [8, 8]]) b.fill(x, 16, z, x, 18, z, 'gray_concrete');
  b.walls(2, 18, 2, 8, 18, 8, 'gray_concrete');
  b.fill(1, 19, 1, 9, 19, 9, 'gray_concrete'); b.walls(1, 20, 1, 9, 20, 9, slab('stone_brick'));
  b.set(4, 17, 5, 'lectern[facing=north,has_book=false,powered=false]'); b.set(6, 17, 5, 'cartography_table');
  b.set(5, 18, 5, lantern);
  b.fill(7, 20, 7, 7, 22, 7, 'iron_bars'); b.fill(5, 22, 7, 9, 22, 7, 'iron_bars'); b.fill(7, 22, 5, 7, 22, 9, 'iron_bars'); b.set(7, 23, 7, rod);
  b.save('thap_kiem_soat');
}

// 7. Nhà điều hành sân bay: nhà một tầng mái bằng, hành lang, phòng họp có bàn bản đồ. Cửa ở phía nam.
{
  const b = new Build(15, 7, 9);
  b.fill(0, 0, 0, 14, 0, 8, 'stone_bricks'); b.fill(1, 0, 1, 13, 0, 7, 'polished_andesite');
  b.walls(1, 1, 1, 13, 4, 7, conc);
  for (const [x, z] of [[1, 1], [13, 1], [1, 7], [13, 7], [7, 1], [7, 7]]) b.fill(x, 1, z, x, 4, z, 'gray_concrete');
  b.fill(0, 5, 0, 14, 5, 8, 'gray_concrete'); b.walls(0, 6, 0, 14, 6, 8, slab('stone_brick'));
  for (const x of [3, 5, 9, 11]) { b.set(x, 2, 1, 'glass_pane'); b.set(x, 2, 7, 'glass_pane'); }
  for (const z of [3, 5]) { b.set(1, 2, z, 'glass_pane'); b.set(13, 2, z, 'glass_pane'); }
  b.clear(7, 1, 7); b.clear(7, 2, 7); b.set(7, 1, 7, door('iron', 'north', 'lower')); b.set(7, 2, 7, door('iron', 'north', 'upper'));
  b.fill(7, 1, 2, 7, 4, 5, 'light_gray_concrete'); b.clear(7, 1, 3); b.clear(7, 2, 3);
  b.fill(9, 1, 3, 12, 1, 3, 'dark_oak_planks'); b.fill(9, 2, 3, 12, 2, 3, 'light_gray_carpet');
  for (const x of [9, 11]) { b.set(x, 1, 2, stairs('dark_oak', 'north')); b.set(x, 1, 4, stairs('dark_oak', 'south')); }
  b.set(2, 1, 2, chest('east')); b.set(2, 1, 3, barrel); b.set(3, 1, 6, 'crafting_table'); b.set(12, 1, 6, 'cartography_table');
  for (const [x, z] of [[4, 4], [10, 5]]) b.set(x, 4, z, lantern);
  for (const x of [5, 6, 8, 9]) { b.fill(x, 0, 8, x, 1, 8, bag); b.set(x, 2, 8, slab('smooth_sandstone')); }
  b.fill(13, 1, 8, 13, 6, 8, 'spruce_fence');
  b.save('nha_dieu_hanh_san_bay');
}

// 8. Kho xăng dầu: hai bồn trụ tròn có thang, ống nối, thùng phuy phía trước.
{
  const b = new Build(17, 8, 13);
  b.fill(0, 0, 0, 16, 0, 12, 'stone_bricks');
  for (const cx of [4, 12]) {
    for (let z = 0; z < 9; z++) for (let x = cx - 3; x <= cx + 3; x++) {
      const d = Math.hypot(x - cx, z - 4);
      if (d <= 3.4 && d > 2.2) b.fill(x, 1, z, x, 5, z, (xx, y) => (y % 2 ? 'light_gray_concrete' : 'white_concrete'));
      else if (d <= 2.2) b.set(x, 5, z, 'smooth_stone');
      if (d <= 3.4) b.set(x, 6, z, d > 2.6 ? slab('smooth_stone') : 'smooth_stone');
    }
    b.fill(cx, 1, 8, cx, 5, 8, ladder('south')); b.set(cx, 7, 4, 'iron_bars');
  }
  b.fill(8, 2, 4, 8, 2, 4, 'iron_bars'); for (let x = 7; x <= 9; x++) b.set(x, 2, 4, 'iron_bars');
  for (const x of [2, 3, 4, 12, 13]) { b.set(x, 1, 10, barrel); }
  b.set(3, 2, 10, barrel); b.set(13, 2, 10, barrel); b.set(8, 1, 11, chest('north'));
  b.save('kho_xang');
}

// Máy bay: dùng chung cho tiêm kích và ném bom. Mũi quay về phía BẮC (z nhỏ).
const GREEN = 'green_concrete', GREY = 'light_gray_concrete';
const roundel = (b, x, y, z) => { b.set(x, y, z, 'red_concrete'); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, y, z + dz, 'white_concrete'); };

// 9. Máy bay tiêm kích một cánh quạt đứng trên đất.
{
  const b = new Build(13, 5, 11);
  for (let z = 1; z <= 10; z++) { b.set(6, 1, z, GREY); b.set(6, 2, z, GREEN); }
  b.fill(5, 1, 1, 7, 3, 2, 'gray_concrete'); b.set(6, 4, 2, 'black_concrete');
  b.set(6, 3, 4, GLASS); b.set(6, 3, 5, GLASS); b.set(5, 2, 4, GREEN); b.set(7, 2, 4, GREEN); b.set(6, 3, 6, GREEN);
  b.set(6, 2, 0, 'gray_concrete'); b.set(6, 1, 0, 'iron_bars'); b.set(6, 3, 0, 'iron_bars'); b.set(5, 2, 0, 'iron_bars'); b.set(7, 2, 0, 'iron_bars');
  for (let x = 0; x <= 12; x++) if (x !== 6) for (const z of [4, 5, 6]) b.set(x, 2, z, (x < 5 || x > 7) ? (x % 2 ? GREEN : GREY) : GREEN);
  roundel(b, 2, 2, 5); roundel(b, 10, 2, 5);
  for (const x of [4, 5, 7, 8]) b.set(x, 2, 10, GREEN); b.set(6, 3, 10, GREEN); b.set(6, 4, 10, GREEN);
  for (const x of [3, 9]) { b.set(x, 1, 5, 'iron_bars'); b.set(x, 0, 5, 'black_concrete'); }
  b.set(6, 0, 9, 'black_concrete');
  b.save('may_bay_tiem_kich');
}

// 10. Máy bay ném bom hai động cơ: thân dài, kính mũi, cánh rộng, đuôi có hai tấm lái.
{
  const b = new Build(25, 7, 19);
  for (let z = 3; z <= 17; z++) { b.fill(11, 1, z, 13, 1, z, GREY); b.fill(11, 2, z, 13, 3, z, GREEN); }
  for (let z = 0; z <= 2; z++) { const w = z; b.fill(12 - w / 2 | 0, 1 + (z === 0 ? 1 : 0), z, 12 + w / 2 | 0, 3, z, GLASS); }
  b.fill(12, 1, 0, 12, 3, 0, GLASS); b.set(12, 4, 4, GREEN); b.set(12, 4, 5, GREEN);
  for (const z of [7, 8, 9]) { b.set(11, 3, z, GLASS); b.set(13, 3, z, GLASS); } b.fill(12, 4, 6, 12, 4, 10, 'black_concrete');
  for (let x = 0; x <= 24; x++) if (x < 11 || x > 13) for (const z of [7, 8, 9, 10]) b.set(x, 2, z, (x % 3 ? GREEN : GREY));
  for (const x of [5, 19]) {
    b.fill(x - 1, 1, 4, x, 3, 8, 'gray_concrete');                                  // vỏ động cơ
    b.set(x, 2, 3, 'iron_bars'); b.set(x - 1, 2, 3, 'iron_bars'); b.set(x - 1, 1, 3, 'iron_bars'); b.set(x, 3, 3, 'iron_bars');
    b.set(x - 1, 0, 6, 'black_concrete'); b.set(x, 0, 6, 'black_concrete');
  }
  roundel(b, 2, 2, 8); roundel(b, 22, 2, 8);
  for (let x = 7; x <= 17; x++) if (x < 11 || x > 13) b.set(x, 3, 16, GREEN);       // cánh đuôi ngang
  for (const x of [8, 16]) b.fill(x, 3, 17, x, 6, 17, GREEN);                         // hai tấm lái đứng
  b.fill(12, 3, 17, 12, 5, 17, GREEN); b.set(12, 0, 16, 'black_concrete');
  b.save('may_bay_nem_bom');
}

// 11. Ổ pháo phòng không: vòng bao cát, nòng chếch lên trời, thùng đạn.
{
  const b = new Build(9, 8, 9), c = 4;
  for (let z = 0; z < 9; z++) for (let x = 0; x < 9; x++) {
    const d = Math.hypot(x - c, z - c);
    if (d <= 3.9) b.set(x, 0, z, 'coarse_dirt');
    if (d > 3.0 && d <= 4.5) b.fill(x, 0, z, x, 2, z, bag);
  }
  b.fill(3, 1, 3, 5, 1, 5, 'gray_concrete'); b.set(4, 2, 4, 'iron_bars');
  const barrelLog = (x, y, z, ax) => b.set(x, y, z, `stripped_dark_oak_log[axis=${ax}]`);
  b.set(4, 3, 4, 'gray_concrete'); barrelLog(4, 4, 3, 'z'); barrelLog(4, 5, 3, 'y'); barrelLog(4, 5, 2, 'z'); barrelLog(4, 6, 2, 'y'); barrelLog(4, 7, 1, 'y');
  b.set(3, 3, 4, 'gray_concrete'); b.set(5, 3, 4, 'gray_concrete'); b.set(3, 2, 4, 'black_concrete'); b.set(5, 2, 4, 'black_concrete');
  b.set(2, 1, 6, barrel); b.set(3, 1, 7, barrel); b.set(6, 1, 6, chest('west')); b.set(6, 1, 7, 'hay_block[axis=y]');
  b.save('ho_phao_cao_xa');
}

// 12. Cột gió: cọc gỗ và túi gió đỏ trắng.
{
  const b = new Build(5, 9, 3);
  b.fill(0, 0, 0, 2, 0, 2, 'cobblestone'); b.fill(1, 1, 1, 1, 7, 1, 'spruce_fence'); b.set(1, 8, 1, 'lantern[hanging=false,waterlogged=false]');
  ['red_wool', 'white_wool', 'red_wool'].forEach((w, i) => b.set(2 + i, 7, 1, w));
  b.save('cot_gio');
}
