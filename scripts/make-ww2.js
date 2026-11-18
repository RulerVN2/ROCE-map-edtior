// Sinh bộ công trình theme Thế chiến 2 thành file .schem trong src/assets/the_chien_2.
// Quy ước: cửa chính / mặt trước nằm ở phía NAM (z lớn), dùng nút xoay R trong editor để quay hướng.
import fs from 'node:fs';
import path from 'node:path';
import { Build, cfg, m, stairs, slab, log, ladder, hash } from './build-lib.js';

cfg.out = path.resolve(process.argv[2] ?? 'src/assets/the_chien_2');
fs.mkdirSync(cfg.out, { recursive: true });

const door = (wood, facing, half) => `${wood}_door[facing=${facing},half=${half},hinge=left,open=false,powered=false]`;
const lantern = 'lantern[hanging=true,waterlogged=false]';
const chest = (f) => `chest[facing=${f},type=single,waterlogged=false]`;
const barrel = 'barrel[facing=up,open=false]';
const bed = (color, facing, part) => `${color}_bed[facing=${facing},occupied=false,part=${part}]`;
const bag = (x, y, z) => (hash(x, y, z) % 3 ? 'smooth_sandstone' : 'sandstone');            // bao cát
const conc = (x, y, z) => (hash(x, y, z) % 9 ? 'light_gray_concrete' : 'stone');          // bê tông cũ
const brick = (x, y, z) => { const r = hash(x, y, z) % 24; return r < 19 ? 'bricks' : r < 22 ? 'stone_bricks' : 'cobblestone'; };
const banner = 'red_banner[rotation=0]';
const rod = 'lightning_rod[facing=up,powered=false,waterlogged=false]';

/** Mái chữ A dọc theo trục z: rộng w, bậc đầu ở độ cao y0, từ z0 đến z1. Có đầu hồi bằng gỗ. */
function gable(b, w, y0, z0, z1, mat, fillMat, gableMat = fillMat) {
  const half = (w - 1) >> 1, odd = w % 2 === 1;
  b.fill(1, y0, z0, 1, y0, z1, fillMat); b.fill(w - 2, y0, z0, w - 2, y0, z1, fillMat);   // bịt khe ở mép hiên
  for (let k = 0; k <= half; k++) {
    const last = k === half && odd;
    if (last) b.fill(k, y0 + k, z0, k, y0 + k, z1, fillMat);
    else { b.fill(k, y0 + k, z0, k, y0 + k, z1, stairs(mat, 'east')); b.fill(w - 1 - k, y0 + k, z0, w - 1 - k, y0 + k, z1, stairs(mat, 'west')); }
    if (k + 1 <= w - 2 - k) for (const z of [z0 + 1, z1 - 1]) b.fill(k + 1, y0 + k, z, w - 2 - k, y0 + k, z, gableMat);
  }
}
/** Cửa sổ kính tấm rải dọc một tường. */
const winsX = (b, xs, y, z) => xs.forEach((x) => b.set(x, y, z, 'glass_pane'));
const winsZ = (b, zs, y, x) => zs.forEach((z) => b.set(x, y, z, 'glass_pane'));

// 1. Trung tâm chỉ huy: nhà gạch một tầng, mái bằng, anten, phòng bản đồ, hai phòng ngăn bởi vách.
{
  const b = new Build(19, 12, 17);
  b.fill(0, 0, 0, 18, 0, 14, 'stone_bricks'); b.fill(1, 0, 1, 17, 0, 13, 'polished_andesite');
  b.walls(1, 1, 1, 17, 4, 13, brick);
  for (const [x, z] of [[1, 1], [17, 1], [1, 13], [17, 13], [9, 1], [9, 13]]) b.fill(x, 1, z, x, 4, z, 'stone_bricks');
  b.fill(0, 5, 0, 18, 5, 14, 'stone_bricks');
  b.walls(0, 6, 0, 18, 6, 14, slab('stone_brick'));
  winsX(b, [3, 5, 7, 11, 13, 15], 2, 1); winsX(b, [3, 5, 13, 15], 2, 13);
  winsZ(b, [4, 7, 11], 2, 1); winsZ(b, [4, 7, 11], 2, 17);
  b.fill(1, 1, 9, 17, 4, 9, brick);                                               // vách ngăn phòng
  b.clear(14, 1, 9); b.clear(14, 2, 9); b.set(14, 1, 9, door('spruce', 'north', 'lower')); b.set(14, 2, 9, door('spruce', 'north', 'upper'));
  b.clear(9, 1, 13); b.clear(9, 2, 13); b.set(9, 1, 13, door('spruce', 'north', 'lower')); b.set(9, 2, 13, door('spruce', 'north', 'upper'));
  b.fill(6, 1, 5, 12, 1, 5, 'dark_oak_planks');                                   // bàn bản đồ
  b.fill(6, 2, 5, 12, 2, 5, (x) => (x === 9 ? 'red_carpet' : 'light_gray_carpet'));
  b.set(7, 1, 7, 'lectern[facing=north,has_book=false,powered=false]'); b.set(11, 1, 7, 'cartography_table');
  for (const x of [6, 8, 10, 12]) { b.set(x, 1, 4, stairs('dark_oak', 'north')); b.set(x, 1, 6, stairs('dark_oak', 'south')); }
  b.set(15, 1, 2, 'jukebox[has_record=false]'); b.set(16, 1, 2, chest('west')); b.set(15, 1, 3, barrel);
  b.set(2, 1, 12, chest('north')); b.set(3, 1, 12, chest('north')); b.set(15, 1, 12, barrel); b.set(16, 1, 12, barrel);
  b.set(3, 1, 3, 'furnace[facing=south,lit=false]');
  for (const [x, z] of [[4, 7], [14, 7], [9, 3], [4, 11], [14, 11]]) b.set(x, 4, z, lantern);
  for (const x of [5, 6, 7, 11, 12, 13]) { b.fill(x, 0, 15, x, 1, 15, bag); b.set(x, 2, 15, slab('smooth_sandstone')); }  // bao cát che cửa
  b.fill(16, 1, 15, 16, 8, 15, 'spruce_fence'); b.set(16, 9, 15, banner);          // cột cờ
  b.fill(14, 7, 3, 14, 10, 3, 'iron_bars'); b.set(14, 11, 3, rod);                  // anten
  b.fill(3, 6, 3, 3, 8, 3, 'bricks'); b.set(3, 9, 3, slab('stone_brick'));         // ống khói
  b.save('trung_tam_chi_huy');
}

// 2. Công sự bê tông (lô cốt): tường dày 2, khe bắn hướng bắc, lớp đất phủ mái, bao cát phía trước.
{
  const b = new Build(13, 6, 11);
  b.fill(2, 0, 2, 10, 3, 8, conc); b.fill(4, 1, 4, 8, 2, 6, 'air');
  b.fill(2, 4, 2, 10, 4, 8, 'gray_concrete');
  for (let x = 5; x <= 7; x++) { b.clear(x, 2, 2); b.clear(x, 2, 3); }
  b.clear(6, 1, 7); b.clear(6, 2, 7); b.clear(6, 1, 8); b.clear(6, 2, 8);
  b.fill(3, 5, 3, 9, 5, 7, (x, y, z) => (hash(x, y, z) % 3 ? 'grass_block' : 'coarse_dirt'));
  b.set(5, 1, 5, barrel); b.set(7, 1, 5, chest('north'));
  for (let x = 3; x <= 9; x++) { b.fill(x, 0, 0, x, 1, 0, bag); }
  for (let x = 3; x <= 9; x += 2) b.set(x, 2, 0, slab('smooth_sandstone'));
  b.save('cong_su_be_tong');
}

// 3. Hào chiến đấu chữ Z: đặt với "Độ cao đặt" = -3 và bật "Cả khối không khí" để đào xuống đất.
{
  const b = new Build(15, 4, 9);
  const dug = new Set();
  const rect = (x0, z0, x1, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) dug.add(`${x},${z}`); };
  rect(0, 2, 8, 3); rect(7, 2, 8, 6); rect(7, 5, 14, 6);
  const inPath = (x, z) => dug.has(`${x},${z}`);
  for (let z = 0; z < 9; z++) for (let x = 0; x < 15; x++) {
    if (inPath(x, z)) { b.set(x, 0, z, 'oak_planks'); b.fill(x, 1, z, x, 3, z, 'air'); continue; }
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => inPath(x + dx, z + dz));
    b.set(x, 0, z, 'dirt');
    b.set(x, 1, z, near ? ((x + z) % 3 ? 'spruce_planks' : log('spruce')) : 'dirt');
    b.set(x, 2, z, near ? ((x + z) % 3 ? 'spruce_planks' : log('spruce')) : 'grass_block');
    b.set(x, 3, z, near ? bag(x, 3, z) : 'air');
  }
  b.save('hao_chien_dau');
}

// 4. Hố pháo bao cát: vòng bao cát tròn, khẩu pháo có tấm chắn, thùng đạn.
{
  const b = new Build(11, 4, 11), c = 5;
  for (let z = 0; z < 11; z++) for (let x = 0; x < 11; x++) {
    const d = Math.hypot(x - c, z - c);
    if (d <= 4.6) b.set(x, 0, z, 'coarse_dirt');
    if (d > 3.7 && d <= 5.1 && !(z >= 9 && x >= 4 && x <= 6)) { b.fill(x, 0, z, x, 2, z, bag); }
  }
  b.fill(5, 3, 0, 5, 3, 4, 'stripped_dark_oak_log[axis=z]');                        // nòng pháo
  b.fill(4, 2, 4, 6, 2, 4, 'gray_concrete'); b.set(4, 3, 4, 'gray_concrete'); b.set(6, 3, 4, 'gray_concrete');
  b.fill(5, 1, 4, 5, 1, 6, 'gray_concrete'); b.set(5, 2, 5, 'gray_concrete');
  for (const x of [3, 7]) b.fill(x, 1, 5, x, 2, 5, 'black_concrete');
  b.set(3, 1, 8, barrel); b.set(4, 1, 8, barrel); b.set(7, 1, 8, chest('west')); b.set(7, 1, 7, 'hay_block[axis=y]');
  b.save('ho_phao_cat');
}

// 5. Hàng rào kẽm gai: cọc gỗ, hai hàng song sắt.
{
  const b = new Build(11, 3, 3);
  for (let x = 0; x <= 10; x++) { b.set(x, 0, 0, 'iron_bars'); b.set(x, 1, 2, 'iron_bars'); b.set(x, 2, 0, 'iron_bars'); }
  for (const x of [0, 5, 10]) for (const z of [0, 2]) b.fill(x, 0, z, x, 2, z, 'spruce_fence');
  for (const x of [0, 5, 10]) b.set(x, 0, 1, 'spruce_fence');
  for (let x = 1; x <= 9; x++) if (x % 5) { b.set(x, 1, 0, 'iron_bars'); b.set(x, 0, 2, 'iron_bars'); }
  b.save('rao_kem_gai');
}

// 6. Nhím chống tăng (hedgehog): ba con xếp thành hàng.
{
  const b = new Build(11, 3, 3);
  for (const x0 of [0, 4, 8]) {
    b.set(x0 + 1, 1, 1, 'gray_concrete');
    for (const dx of [0, 2]) for (const dy of [0, 2]) for (const dz of [0, 2]) b.set(x0 + dx, dy, dz, (dx + dy + dz) % 4 ? 'gray_concrete' : 'light_gray_concrete');
  }
  b.save('nhim_chong_tang');
}

// 7. Rào gỗ nhọn: cọc gỗ vót nhọn xen kẽ độ cao, hai xà ngang.
{
  const b = new Build(11, 6, 2);
  for (let x = 0; x <= 10; x++) { const tall = x % 2 === 0; b.fill(x, 0, 0, x, tall ? 4 : 3, 0, log('spruce')); b.set(x, tall ? 5 : 4, 0, 'spruce_fence'); }
  for (const y of [1, 3]) b.fill(0, y, 1, 10, y, 1, log('dark_oak', 'x'));
  b.save('rao_go_nhon');
}

// 8. Nhà lính (doanh trại gỗ): dãy giường hai bên, lò sưởi, hai cửa đầu hồi.
{
  const b = new Build(9, 10, 17);
  b.fill(1, 0, 1, 7, 0, 15, 'cobblestone');
  b.walls(1, 1, 1, 7, 4, 15, 'spruce_planks');
  for (const [x, z] of [[1, 1], [7, 1], [1, 15], [7, 15], [1, 8], [7, 8]]) b.fill(x, 1, z, x, 4, z, log('spruce'));
  b.fill(2, 0, 2, 6, 0, 14, 'oak_planks');
  winsZ(b, [4, 6, 10, 12], 2, 1); winsZ(b, [4, 6, 10, 12], 2, 7);
  b.set(4, 1, 15, door('spruce', 'north', 'lower')); b.set(4, 2, 15, door('spruce', 'north', 'upper'));
  b.set(4, 1, 1, door('spruce', 'south', 'lower')); b.set(4, 2, 1, door('spruce', 'south', 'upper'));
  gable(b, 9, 5, 0, 16, 'spruce', 'spruce_planks', 'spruce_planks');
  for (const [zf, zh] of [[4, 3], [7, 6], [10, 9], [13, 12]]) for (const x of [2, 6]) {
    b.set(x, 1, zf, bed(x === 2 ? 'red' : 'blue', 'north', 'foot')); b.set(x, 1, zh, bed(x === 2 ? 'red' : 'blue', 'north', 'head'));
  }
  for (const z of [2, 5, 8, 11, 14]) { b.set(3, 1, z, z % 2 ? barrel : chest('east')); b.set(5, 1, z, z % 2 ? chest('west') : barrel); }
  b.set(4, 1, 8, 'furnace[facing=south,lit=false]');
  for (const z of [4, 12]) b.set(4, 8, z, lantern);
  b.save('nha_linh_go');
}

// 9 và 10. Nhà gạch hai tầng, và bản hư hỏng sau trận đánh (mái thủng, tường sập, gạch vỡ).
function brickHouse(name, ruined) {
  const b = new Build(9, 15, 11);
  b.fill(0, 0, 0, 8, 0, 10, 'stone_bricks'); b.fill(1, 0, 1, 7, 0, 9, 'oak_planks');
  b.walls(1, 1, 1, 7, 9, 9, brick);
  for (const [x, z] of [[1, 1], [7, 1], [1, 9], [7, 9]]) b.fill(x, 1, z, x, 9, z, 'stone_bricks');
  b.walls(1, 5, 1, 7, 5, 9, 'stone_bricks');
  b.fill(2, 5, 2, 6, 5, 8, 'spruce_planks');
  for (let z = 2; z <= 5; z++) b.clear(2, 5, z);                                    // lỗ cầu thang
  for (let i = 0; i < 4; i++) b.set(2, 1 + i, 2 + i, stairs('oak', 'south'));
  for (const y of [2, 7]) { winsX(b, [3, 5], y, 1); winsX(b, [3, 5], y, 9); winsZ(b, [3, 5, 7], y, 1); winsZ(b, [3, 5, 7], y, 7); }
  b.clear(4, 2, 9); b.clear(4, 1, 9); b.set(4, 1, 9, door('spruce', 'north', 'lower')); b.set(4, 2, 9, door('spruce', 'north', 'upper'));
  b.fill(3, 0, 10, 5, 0, 10, 'stone_bricks'); b.set(4, 0, 10, stairs('stone_brick', 'north'));
  gable(b, 9, 10, 0, 10, 'deepslate_brick', 'deepslate_bricks', 'bricks');
  b.fill(2, 10, 5, 2, 14, 5, 'bricks'); b.set(2, 15 - 1, 5, 'bricks');
  b.set(3, 1, 7, 'crafting_table'); b.set(5, 1, 7, 'furnace[facing=north,lit=false]'); b.set(6, 1, 8, chest('north'));
  b.set(6, 6, 7, bed('white', 'north', 'foot')); b.set(6, 6, 6, bed('white', 'north', 'head'));
  b.set(5, 4, 5, lantern); b.set(4, 9, 5, lantern);
  if (ruined) {
    for (const [key] of [...b.cells]) {
      const [x, y, z] = key.split(',').map(Number);
      const st = b.get(x, y, z);
      if (/air|oak_planks$|furnace|crafting|chest|bed|lantern/.test(st) && y < 6) continue;
      const north = z < 5 ? 1 : 0, hole = (hash(x, y, z) % 100);
      if (y >= 10 && (x + z) % 4 < 2 && hole < 70) b.clear(x, y, z);               // mái thủng
      else if (y >= 6 && z <= 4 && hole < 60) b.clear(x, y, z);                     // tầng trên sập nửa bắc
      else if (y >= 3 && x >= 5 && z >= 6 && hole < 45) b.clear(x, y, z);           // góc đông nam sập
      else if (y >= 1 && hole < 6 + north * 4 && /bricks|stairs/.test(st)) b.clear(x, y, z);
      else if (/^minecraft:(bricks|stone_bricks)$/.test(st) && hole < 28) b.set(x, y, z, hole < 14 ? 'cracked_stone_bricks' : 'cobblestone');
      else if (/glass_pane/.test(st) && hole < 70) b.clear(x, y, z);
    }
    for (let i = 0; i < 12; i++) { const x = hash(i, 1, 2) % 9, z = hash(i, 3, 4) % 11; if (!b.get(x, 0, z) || b.get(x, 1, z) === m('air')) b.set(x, 1, z, 'cobblestone'); }
  }
  b.save(name);
}
brickHouse('nha_gach_2_tang', false);
brickHouse('nha_gach_hu_hong', true);

// 11. Trạm gác: chốt kiểm soát có chòi gác nhỏ, cần chắn đỏ trắng, bao cát.
{
  const b = new Build(13, 5, 9);
  b.fill(0, 0, 1, 4, 0, 5, 'oak_planks');
  b.walls(0, 1, 1, 4, 3, 5, 'spruce_planks');
  for (const [x, z] of [[0, 1], [4, 1], [0, 5], [4, 5]]) b.fill(x, 1, z, x, 3, z, log('spruce'));
  for (const x of [1, 2, 3]) b.set(x, 2, 1, 'glass_pane'); winsZ(b, [2, 3, 4], 2, 4); winsZ(b, [3], 2, 0);
  b.set(2, 1, 5, door('spruce', 'north', 'lower')); b.set(2, 2, 5, door('spruce', 'north', 'upper'));
  b.fill(0, 4, 0, 4, 4, 6, slab('spruce')); b.fill(1, 4, 1, 3, 4, 5, 'spruce_planks');
  b.set(2, 3, 3, lantern); b.set(3, 1, 2, 'crafting_table'); b.set(1, 1, 2, barrel);
  b.fill(5, 0, 3, 5, 2, 3, 'gray_concrete');                                        // trụ cần chắn
  for (let x = 6; x <= 12; x++) b.set(x, 2, 3, (x % 2 ? 'white_concrete' : 'red_concrete'));
  b.set(6, 3, 3, 'gray_concrete'); b.fill(12, 0, 3, 12, 1, 3, 'spruce_fence');
  for (const x of [0, 1, 3, 4]) { b.fill(x, 0, 7, x, 1, 7, bag); } for (const x of [0, 4]) b.set(x, 2, 7, slab('smooth_sandstone'));
  for (const x of [8, 9, 10]) b.set(x, 0, 6, bag(x, 0, 6));
  b.save('tram_gac');
}

// 12. Tiền đồn: tường bao cát, hai lô cốt góc, nhà chỉ huy gạch, chòi gác gỗ, cổng phía nam.
{
  const b = new Build(19, 11, 19);
  for (let i = 0; i < 19; i++) for (const [x, z] of [[i, 0], [i, 18], [0, i], [18, i]]) {
    if (z === 18 && x >= 8 && x <= 10) continue;
    b.fill(x, 0, z, x, 2, z, bag); if (i % 2 === 0) b.set(x, 3, z, slab('smooth_sandstone'));
  }
  for (const [x0, z0] of [[0, 0], [16, 0], [0, 16], [16, 16]]) b.fill(x0, 0, z0, x0 + 2, 3, z0 + 2, bag);
  b.fill(6, 0, 5, 12, 0, 11, 'stone_bricks'); b.walls(6, 1, 5, 12, 4, 11, brick);
  for (const [x, z] of [[6, 5], [12, 5], [6, 11], [12, 11]]) b.fill(x, 1, z, x, 4, z, log('oak'));
  for (const x of [8, 10]) { b.set(x, 3, 5, 'iron_bars'); b.set(x, 3, 11, 'iron_bars'); } for (const z of [7, 9]) { b.set(6, 3, z, 'iron_bars'); b.set(12, 3, z, 'iron_bars'); }
  b.set(9, 1, 11, door('spruce', 'north', 'lower')); b.set(9, 2, 11, door('spruce', 'north', 'upper'));
  b.fill(5, 5, 4, 13, 5, 12, 'stone_bricks'); b.fill(6, 6, 5, 12, 6, 11, 'stone_brick_slab[type=bottom,waterlogged=false]');
  b.fill(7, 6, 6, 11, 6, 10, 'stone_bricks'); b.fill(8, 7, 7, 10, 7, 9, slab('stone_brick'));
  b.set(9, 4, 8, lantern); b.set(7, 1, 7, 'cartography_table'); b.set(11, 1, 7, chest('west')); b.set(8, 1, 10, barrel);
  for (const [x, z] of [[13, 2], [15, 2], [13, 4], [15, 4]]) b.fill(x, 0, z, x, 6, z, log('spruce'));   // chòi gác
  b.fill(14, 0, 3, 14, 6, 3, log('spruce'));
  b.fill(13, 7, 2, 15, 7, 4, 'spruce_planks'); b.clear(14, 7, 4);
  for (let y = 1; y <= 7; y++) b.set(14, y, 4, ladder('south'));
  b.walls(13, 8, 2, 15, 8, 4, 'spruce_fence'); b.clear(14, 8, 4);
  for (const [x, z] of [[13, 2], [15, 2], [13, 4], [15, 4]]) b.fill(x, 9, z, x, 9, z, 'spruce_fence');
  b.fill(12, 10, 1, 16, 10, 5, slab('dark_oak'));
  b.fill(9, 0, 15, 9, 8, 15, 'spruce_fence'); b.set(9, 9, 15, banner);
  b.set(4, 0, 8, 'campfire[facing=north,lit=true,signal_fire=false,waterlogged=false]');
  b.set(3, 0, 10, barrel); b.set(4, 0, 11, barrel); b.set(3, 1, 10, barrel); b.set(2, 0, 9, 'hay_block[axis=x]');
  for (const [x, z] of [[1, 5], [1, 12], [17, 8], [17, 12]]) b.set(x, 3, z, 'air');
  b.save('tien_don');
}

// 13. Tháp canh bê tông: thân 5 x 5 có thang trong, buồng quan sát có kính ở trên, anten.
{
  const b = new Build(7, 21, 7);
  b.fill(0, 0, 0, 6, 0, 6, 'stone_bricks');
  b.walls(1, 1, 1, 5, 11, 5, conc);
  for (const y of [4, 8]) b.walls(1, y, 1, 5, y, 5, 'gray_concrete');
  for (const [x, z] of [[1, 1], [5, 1], [1, 5], [5, 5]]) b.fill(x, 1, z, x, 11, z, 'gray_concrete');
  b.fill(2, 1, 2, 4, 11, 4, 'air');
  for (let y = 1; y <= 12; y++) b.set(3, y, 2, ladder('south'));
  b.set(3, 1, 5, door('iron', 'north', 'lower')); b.set(3, 2, 5, door('iron', 'north', 'upper'));
  b.set(1, 6, 3, 'iron_bars'); b.set(5, 6, 3, 'iron_bars'); b.set(3, 9, 5, 'iron_bars');
  b.fill(0, 12, 0, 6, 12, 6, 'gray_concrete'); b.clear(3, 12, 2); b.set(3, 12, 2, ladder('south'));
  b.walls(0, 13, 0, 6, 15, 6, conc);
  for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) b.fill(x, 13, z, x, 15, z, 'gray_concrete');
  for (let i = 1; i <= 5; i++) { b.set(i, 14, 0, 'glass_pane'); b.set(i, 14, 6, 'glass_pane'); b.set(0, 14, i, 'glass_pane'); b.set(6, 14, i, 'glass_pane'); }
  b.fill(0, 16, 0, 6, 16, 6, 'gray_concrete'); b.fill(1, 17, 1, 5, 17, 5, slab('stone_brick'));
  b.set(3, 15, 3, lantern);
  b.fill(3, 17, 3, 3, 19, 3, 'iron_bars'); b.set(3, 20, 3, rod);
  b.set(1, 18, 1, 'sea_lantern');
  b.save('thap_canh_be_tong');
}

// 14. Đoạn tường rào gạch: có trụ gia cố mỗi 5 khối, dây thép gai (song sắt) trên đỉnh.
{
  const b = new Build(11, 8, 3);
  b.fill(0, 0, 1, 10, 0, 1, 'stone_bricks'); b.fill(0, 1, 1, 10, 4, 1, brick); b.fill(0, 5, 1, 10, 5, 1, slab('stone_brick'));
  for (const x of [0, 5, 10]) { b.fill(x, 0, 0, x, 5, 2, 'stone_bricks'); b.set(x, 6, 1, slab('stone_brick')); }
  for (let x = 0; x <= 10; x++) if (x % 5) b.set(x, 6, 1, 'iron_bars');
  for (const x of [0, 5, 10]) b.set(x, 7, 1, 'iron_bars');
  b.save('tuong_rao_gach');
}

// 15. Tháp góc tường rào: tháp gạch có buồng canh và đèn pha, hai cánh tường nối ra phía đông và phía nam.
{
  const b = new Build(13, 14, 13);
  b.fill(0, 0, 0, 6, 0, 6, 'stone_bricks'); b.walls(0, 1, 0, 6, 8, 6, brick);
  for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) b.fill(x, 1, z, x, 12, z, 'stone_bricks');
  b.fill(1, 8, 1, 5, 8, 5, 'spruce_planks'); b.clear(1, 8, 3);
  for (let y = 1; y <= 9; y++) b.set(1, y, 3, ladder('east'));
  b.set(6, 1, 5, door('spruce', 'west', 'lower')); b.set(6, 2, 5, door('spruce', 'west', 'upper'));
  for (const y of [3, 5]) { b.set(0, y, 2, 'iron_bars'); b.set(3, y, 0, 'iron_bars'); b.set(2, y, 6, 'iron_bars'); }
  b.walls(0, 9, 0, 6, 11, 6, brick);
  for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) b.fill(x, 9, z, x, 11, z, 'stone_bricks');
  for (let i = 2; i <= 4; i++) { b.set(i, 10, 0, 'glass_pane'); b.set(i, 10, 6, 'glass_pane'); b.set(0, 10, i, 'glass_pane'); b.set(6, 10, i, 'glass_pane'); }
  b.fill(0, 12, 0, 6, 12, 6, slab('stone_brick')); b.fill(1, 12, 1, 5, 12, 5, 'stone_bricks');
  b.set(3, 13, 3, 'sea_lantern'); b.set(3, 10, 3, lantern);
  b.fill(7, 0, 3, 12, 0, 3, 'stone_bricks'); b.fill(7, 1, 3, 12, 4, 3, brick); b.fill(7, 5, 3, 12, 5, 3, slab('stone_brick'));
  b.fill(3, 0, 7, 3, 0, 12, 'stone_bricks'); b.fill(3, 1, 7, 3, 4, 12, brick); b.fill(3, 5, 7, 3, 5, 12, slab('stone_brick'));
  for (let i = 7; i <= 12; i++) { b.set(i, 6, 3, 'iron_bars'); b.set(3, 6, i, 'iron_bars'); }
  b.save('tuong_rao_goc_thap');
}

// 16. Cổng tường rào: hai trụ gạch, dầm cổng, hai cánh song sắt mở sẵn, bao cát hai bên.
{
  const b = new Build(15, 10, 5);
  for (const x0 of [0, 12]) {
    b.fill(x0, 0, 0, x0 + 2, 0, 4, 'stone_bricks'); b.fill(x0, 1, 0, x0 + 2, 6, 4, brick);
    b.fill(x0, 7, 0, x0 + 2, 7, 4, 'stone_bricks'); b.set(x0 + 1, 8, 2, 'stone_brick_slab[type=bottom,waterlogged=false]'); b.set(x0 + 1, 9, 2, 'iron_bars');
  }
  b.fill(3, 6, 1, 11, 7, 3, 'stone_bricks'); b.fill(3, 6, 2, 11, 6, 2, 'bricks');
  for (const [x0, x1] of [[3, 5], [9, 11]]) { b.fill(x0, 1, 2, x1, 5, 2, 'iron_bars'); }
  for (const x of [4, 10]) b.set(x, 5, 3, lantern);
  for (const x of [3, 4, 10, 11]) { b.fill(x, 0, 4, x, 1, 4, bag); }
  b.save('tuong_rao_cong');
}

// 17. Nhà tôn vòm (Nissen hut): kho hoặc trại lính bán nguyệt, sườn tôn xen kẽ, hai đầu kín.
{
  const b = new Build(9, 5, 13), R = 4.4, c = 4;
  for (let z = 0; z < 13; z++) for (let x = 0; x < 9; x++) for (let y = 0; y < 5; y++) {
    const d = Math.hypot(x - c, y);
    if (d <= R && d > R - 1.2) b.set(x, y, z, z % 3 === 0 ? 'gray_concrete' : 'light_gray_concrete');
    else if (d <= R - 1.2 && (z === 0 || z === 12)) b.set(x, y, z, 'smooth_stone');
    else if (y === 0 && d <= R) b.set(x, y, z, 'dirt_path');
  }
  b.fill(3, 1, 12, 5, 2, 12, 'air'); b.set(4, 1, 12, door('iron', 'north', 'lower')); b.set(4, 2, 12, door('iron', 'north', 'upper'));
  b.set(4, 2, 0, 'glass_pane'); b.set(4, 3, 0, 'glass_pane');
  for (const z of [2, 3, 5, 6, 8, 9]) { b.set(1, 1, z, barrel); b.set(7, 1, z, z % 2 ? chest('west') : barrel); }
  for (const z of [2, 6, 9]) b.set(4, 3, z, lantern);
  b.set(4, 1, 6, 'hay_block[axis=x]');
  b.save('nha_ton_vom');
}

// 18. Trạm điện đài: cột anten giàn thép, nhà radio nhỏ mái bằng, cọc neo dây.
{
  const b = new Build(9, 18, 9);
  b.fill(0, 0, 0, 4, 0, 4, 'stone_bricks'); b.walls(0, 1, 0, 4, 3, 4, 'spruce_planks');
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) b.fill(x, 1, z, x, 3, z, log('spruce'));
  b.fill(0, 4, 0, 4, 4, 4, slab('dark_oak')); b.fill(1, 4, 1, 3, 4, 3, 'dark_oak_planks');
  b.set(2, 1, 4, door('spruce', 'north', 'lower')); b.set(2, 2, 4, door('spruce', 'north', 'upper'));
  winsX(b, [2], 2, 0); winsZ(b, [2], 2, 0); winsZ(b, [2], 2, 4);
  b.set(1, 1, 1, 'jukebox[has_record=false]'); b.set(3, 1, 1, 'lectern[facing=south,has_book=false,powered=false]'); b.set(2, 3, 2, lantern);
  for (const [x, z] of [[6, 6]]) b.fill(x, 0, z, x, 15, z, 'iron_bars');
  for (const y of [5, 9, 13]) b.fill(4, y, 6, 8, y, 6, 'iron_bars'), b.fill(6, y, 4, 6, y, 8, 'iron_bars');
  b.set(6, 16, 6, 'iron_bars'); b.set(6, 17, 6, rod);
  for (const [x, z] of [[4, 8], [8, 8], [8, 4]]) { b.fill(x, 0, z, x, 1, z, 'spruce_fence'); }
  b.fill(4, 0, 8, 4, 0, 8, 'spruce_fence'); b.set(7, 0, 1, barrel); b.set(8, 0, 1, chest('west'));
  b.save('tram_dien_dai');
}

// 19. Lều quân y: lều len trắng chữ thập đỏ trên mái, giường hai bên, rương thuốc.
{
  const b = new Build(9, 6, 11);
  for (let z = 0; z <= 10; z++) for (let k = 0; k <= 4; k++) {
    b.set(k, k, z, 'white_wool'); b.set(8 - k, k, z, 'white_wool');
    if (k < 4) { b.set(k, k + 1, z, 'white_wool'); b.set(8 - k, k + 1, z, 'white_wool'); }
  }
  for (const z of [4, 5, 6]) { b.set(2, 3, z, 'red_wool'); b.set(6, 3, z, 'red_wool'); }   // chữ thập đỏ nằm ở lớp ngoài của mái
  for (const k of [1, 3]) { b.set(k, k + 1, 5, 'red_wool'); b.set(8 - k, k + 1, 5, 'red_wool'); }
  for (const z of [0, 10]) b.fill(4, 0, z, 4, 3, z, 'spruce_fence');
  for (const [zf, zh] of [[4, 3], [8, 7]]) for (const x of [2, 6]) { b.set(x, 0, zf, bed('white', 'north', 'foot')); b.set(x, 0, zh, bed('white', 'north', 'head')); }
  b.set(4, 0, 2, chest('south')); b.set(4, 0, 8, barrel); b.set(4, 3, 5, lantern);
  b.save('leu_quan_y');
}
