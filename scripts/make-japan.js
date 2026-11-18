// Sinh bộ công trình quân Đế quốc Nhật WW2 (23 mẫu) thành file .schem trong src/assets/the_chien_2, tiền tố "nhat_".
// Dựng theo bộ ảnh tham chiếu của người dùng (Cong_trinh_Nhat_WW2_23_mau_va_co.zip) và lưới cờ 12x8 kèm theo.
// Quy ước như các bộ khác: mặt trước / cửa chính quay về phía NAM (z lớn); xoay bằng R trong editor.
// Đây là bản dựng gần giống ảnh, không phải bản sao từng khối. Lá cây dùng làm ngụy trang (persistent nên không rụng).
import fs from 'node:fs';
import path from 'node:path';
import { Build, cfg, stairs, slab, log, ladder, hash } from './build-lib.js';

cfg.out = path.resolve(process.argv[2] ?? 'src/assets/the_chien_2');
fs.mkdirSync(cfg.out, { recursive: true });

const door = (wood, facing, half, hinge = 'left') => `${wood}_door[facing=${facing},half=${half},hinge=${hinge},open=false,powered=false]`;
const LEAF = 'jungle_leaves[distance=1,persistent=true]';
const OLEAF = 'oak_leaves[distance=1,persistent=true]';
const barrel = 'barrel[facing=up,open=false]';
const hay = (axis = 'x') => `hay_block[axis=${axis}]`;
const bamboo = 'bamboo[age=1,leaves=none,stage=0]';
const sandbag = (x, y, z) => (hash(x, y, z) % 3 ? 'smooth_sandstone' : 'sandstone');
const earth = (x, y, z) => { const r = hash(x, y, z) % 20; return r < 8 ? 'coarse_dirt' : r < 13 ? 'dirt' : r < 15 ? 'rooted_dirt' : r < 17 ? 'cobblestone' : 'moss_block'; };
const concrete = (x, y, z) => { const r = hash(x, y, z) % 12; return r < 7 ? 'stone' : r < 10 ? 'andesite' : 'cobblestone'; };
const canvas = (x, y, z) => (hash(x, y, z) % 9 === 0 ? 'moss_block' : 'green_wool');
const thatch = (x, y, z) => (hash(x, y, z) % 11 === 0 ? 'coarse_dirt' : hay('x'));
const dark = 'dark_oak_planks';

// Lưới cờ 12x8 (R = len đỏ, W = len trắng) lấy từ bộ ảnh cận cảnh của người dùng, hàng đầu là hàng trên.
const SUN = ['RWWRWWRRWWRW', 'WRWWRWRWRWWR', 'WWRWRRRRWWRW', 'RWWRRRRRRRWW', 'RWWRRRRRRRWW', 'WWRWRRRRWWRW', 'WRWWRWRWRWWR', 'RWWRWWRRWWRW'];
/** Thu nhỏ lưới cờ một nửa (bốn ô gộp một, đỏ nếu có từ hai ô đỏ) cho cờ nhỏ. */
const half = (g) => {
  const out = [];
  for (let r = 0; r < g.length; r += 2) {
    let row = '';
    for (let c = 0; c < g[0].length; c += 2) {
      const n = [g[r][c], g[r][c + 1], g[r + 1][c], g[r + 1][c + 1]].filter((v) => v === 'R').length;
      row += n >= 2 ? 'R' : 'W';
    }
    out.push(row);
  }
  return out;
};
const SUN_S = half(SUN);
/** Đặt cờ lên mặt phẳng z: cột trái ở x0, hàng trên cùng ở độ cao yTop. */
function flag(b, x0, yTop, z, grid) {
  grid.forEach((row, r) => [...row].forEach((c, i) => b.set(x0 + i, yTop - r, z, c === 'R' ? 'red_wool' : 'white_wool')));
}
/** Gò đất hình bán cầu: tâm (cx, cz), bán kính rx, rz, cao h, bắt đầu từ y0; trả về hàm chạy trên các khối đã đặt. */
function mound(b, cx, cz, rx, rz, h, y0 = 1) {
  const cells = [];
  for (let y = y0; y < y0 + h; y++) for (let z = 0; z < b.l; z++) for (let x = 0; x < b.w; x++) {
    const d = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 + ((y - y0 + 0.5) / h) ** 2;
    if (d <= 1) { b.set(x, y, z, earth(x, y, z)); cells.push([x, y, z]); }
  }
  return cells;
}
/** Phủ rêu và bụi lá lên mặt trên của gò. */
function camo(b, cells, leafP = 0.18) {
  for (const [x, y, z] of cells) {
    if (b.get(x, y + 1, z)) continue;
    if (b.get(x, y, z) && /dirt|moss|cobble/.test(b.get(x, y, z))) {
      const r = hash(x, y, z + 99) % 100;
      if (r < 55) b.set(x, y, z, 'moss_block');
      if (y + 1 < b.h && r > 100 - leafP * 100) b.set(x, y + 1, z, LEAF);
    }
  }
}
const uncarve = (b, x0, y0, z0, x1, y1, z1) => { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) b.clear(x, y, z); };

// ==================== CÔNG SỰ ====================

// 01. Lô cốt gỗ và đất (kiểu thân dừa) 7x6x4.
{
  const b = new Build(7, 6, 6);
  b.fill(0, 0, 0, 6, 0, 5, 'coarse_dirt');
  b.fill(0, 1, 0, 0, 3, 5, earth); b.fill(6, 1, 0, 6, 3, 5, earth); b.fill(0, 1, 0, 6, 3, 0, earth);
  b.fill(1, 1, 1, 5, 2, 1, 'dark_oak_planks');
  for (const [x, z] of [[1, 4], [5, 4], [1, 1], [5, 1]]) for (let y = 1; y <= 3; y++) b.set(x, y, z, log('spruce'));
  b.fill(2, 1, 4, 4, 1, 4, sandbag); b.fill(1, 1, 5, 5, 1, 5, sandbag);
  b.fill(2, 3, 4, 4, 3, 4, dark);
  b.fill(1, 3, 1, 5, 3, 3, dark); b.fill(1, 3, 4, 5, 3, 4, dark);
  b.fill(0, 4, 0, 6, 4, 5, (x, y, z) => (hash(x, y, z) % 4 ? 'moss_block' : 'coarse_dirt'));
  for (const x of [1, 5]) b.set(x, 3, 4, log('spruce', 'x'));
  b.set(1, 5, 1, LEAF); b.set(5, 5, 4, LEAF); b.set(4, 5, 2, LEAF);
  b.save('nhat_01_lo_cot_go_dat');
}

// 02. Lô cốt bê tông có bao cát 6x6x4.
{
  const b = new Build(7, 6, 6);
  b.fill(0, 0, 0, 5, 0, 5, sandbag);
  b.fill(1, 0, 1, 4, 0, 4, 'stone');
  b.walls(1, 1, 1, 4, 3, 4, concrete);
  b.fill(2, 2, 4, 3, 2, 4, 'air');
  b.fill(0, 1, 5, 5, 1, 5, sandbag); b.fill(0, 1, 4, 0, 1, 4, sandbag); b.fill(5, 1, 4, 5, 1, 4, sandbag);
  b.fill(1, 2, 5, 1, 2, 5, sandbag); b.fill(4, 2, 5, 4, 2, 5, sandbag);
  b.clear(2, 1, 1); b.clear(2, 2, 1);
  for (const [x, z] of [[0, 0], [5, 0]]) for (let y = 1; y <= 3; y++) b.set(x, y, z, log('spruce'));
  b.fill(0, 4, 0, 5, 4, 5, dark);
  b.set(0, 4, 0, log('spruce', 'z')); b.set(5, 4, 0, log('spruce', 'z'));
  for (let y = 1; y <= 3; y++) b.set(6, y, 2, ladder('east'));
  b.fill(6, 4, 2, 6, 4, 2, 'air');
  b.set(0, 5, 0, LEAF); b.set(4, 5, 3, LEAF); b.set(1, 5, 4, LEAF);
  b.save('nhat_02_lo_cot_be_tong');
}

// 03. Hầm chỉ huy nửa chìm 10x8x4: gò đất lớn, hành lang vào có khung gỗ.
{
  const b = new Build(10, 5, 8);
  b.fill(0, 0, 0, 9, 0, 7, 'coarse_dirt');
  const cells = mound(b, 4.5, 3.5, 4.9, 4.2, 4);
  for (let y = 1; y <= 3; y++) for (let z = 3; z <= 7; z++) for (const x of [4, 5]) if (y <= 2) b.clear(x, y, z);
  b.fill(3, 1, 7, 3, 3, 7, log('spruce')); b.fill(6, 1, 7, 6, 3, 7, log('spruce'));
  b.fill(3, 3, 7, 6, 3, 7, dark); b.fill(4, 3, 6, 5, 3, 6, dark);
  b.fill(3, 1, 6, 3, 2, 6, log('spruce')); b.fill(6, 1, 6, 6, 2, 6, log('spruce'));
  b.fill(4, 0, 3, 5, 0, 7, 'spruce_planks');
  for (const [x, z] of [[2, 7], [7, 7], [2, 6], [7, 6]]) b.set(x, 1, z, sandbag(x, 1, z));
  camo(b, cells);
  b.save('nhat_03_ham_chi_huy');
}

// 04. Ụ pháo bờ biển 9x9x4: mái che gỗ phía sau, khẩu pháo phía trước, vòng bao cát.
{
  const b = new Build(9, 6, 9);
  b.fill(0, 0, 0, 8, 0, 8, (x, y, z) => (hash(x, y, z) % 4 ? 'coarse_dirt' : 'rooted_dirt'));
  b.fill(1, 1, 0, 7, 3, 0, 'dark_oak_planks');
  for (const x of [1, 7]) for (const z of [1, 4]) for (let y = 1; y <= 3; y++) b.set(x, y, z, log('spruce'));
  b.fill(1, 1, 1, 1, 3, 3, 'dark_oak_planks'); b.fill(7, 1, 1, 7, 3, 3, 'dark_oak_planks');
  b.fill(0, 4, 0, 8, 4, 5, dark);
  b.fill(2, 5, 1, 6, 5, 4, (x, y, z) => (hash(x, y, z) % 3 ? 'sandstone' : 'smooth_sandstone'));
  for (let y = 1; y <= 3; y++) b.set(6, y, 1, ladder('south'));
  // khẩu pháo
  b.set(4, 1, 3, 'andesite'); b.set(3, 1, 3, 'andesite'); b.set(5, 1, 3, 'andesite');
  b.fill(4, 2, 3, 4, 2, 7, 'polished_andesite'); b.set(4, 2, 2, 'andesite');
  // vòng bao cát phía trước
  for (let x = 1; x <= 7; x++) b.set(x, 1, 8, sandbag(x, 1, 8));
  for (const x of [1, 2, 6, 7]) b.set(x, 2, 8, sandbag(x, 2, 8));
  for (let z = 5; z <= 7; z++) { b.set(0, 1, z, sandbag(0, 1, z)); b.set(8, 1, z, sandbag(8, 1, z)); }
  b.set(0, 2, 6, sandbag(0, 2, 6)); b.set(8, 2, 6, sandbag(8, 2, 6));
  b.set(2, 1, 1, barrel); b.set(3, 1, 1, 'oak_planks'); b.set(7, 1, 4, barrel);
  b.set(0, 5, 0, LEAF); b.set(8, 5, 0, LEAF); b.set(0, 1, 8, LEAF); b.set(8, 1, 8, LEAF);
  b.save('nhat_04_u_phao_bo_bien');
}

// 05. Hào cá nhân và hố bắn có bao cát 10x3x2: rãnh lát ván, nắp gỗ có chừa khe bắn.
{
  const b = new Build(10, 3, 3);
  b.fill(0, 0, 0, 9, 0, 2, 'coarse_dirt');
  b.fill(1, 0, 1, 8, 0, 1, 'spruce_planks');
  for (const x of [1, 2, 4, 5, 7, 8]) b.set(x, 1, 2, sandbag(x, 1, 2));
  for (const x of [0, 3, 6, 9]) { b.set(x, 1, 1, log('spruce')); b.set(x, 1, 0, log('spruce')); }
  b.fill(0, 2, 0, 9, 2, 1, dark);
  for (const x of [0, 9]) { b.set(x, 2, 0, log('spruce', 'z')); b.set(x, 2, 1, log('spruce', 'z')); }
  b.fill(1, 1, 0, 8, 1, 0, (x, y, z) => ((x % 3 === 0) ? log('spruce') : 'dark_oak_planks'));
  b.set(2, 2, 0, LEAF); b.set(6, 2, 1, LEAF); b.set(8, 2, 0, LEAF);
  b.save('nhat_05_hao_ca_nhan');
}

// 06. Cửa hầm hang có gia cố gỗ và đá 6x5x5.
{
  const b = new Build(6, 6, 5);
  b.fill(0, 0, 0, 5, 0, 4, 'coarse_dirt');
  const cells = mound(b, 2.5, 1.5, 3.0, 3.6, 5);
  for (const [x, y, z] of cells) if (hash(x, y, z) % 5 === 0) b.set(x, y, z, 'cobblestone');
  uncarve(b, 2, 1, 1, 3, 3, 4);
  for (const x of [1, 4]) for (let y = 1; y <= 3; y++) { b.set(x, y, 4, log('spruce')); b.set(x, y, 3, log('spruce')); }
  b.fill(1, 4, 3, 4, 4, 4, dark);
  b.fill(2, 4, 4, 3, 4, 4, dark); b.fill(2, 3, 4, 3, 3, 4, dark);
  b.fill(2, 3, 1, 3, 3, 3, dark);
  b.fill(2, 0, 1, 3, 0, 4, 'spruce_planks');
  b.fill(0, 1, 4, 0, 2, 4, sandbag); b.fill(5, 1, 4, 5, 2, 4, sandbag); b.set(0, 1, 3, sandbag(0, 1, 3)); b.set(5, 1, 3, sandbag(5, 1, 3));
  b.set(0, 3, 4, 'air'); b.set(5, 3, 4, 'air');
  camo(b, cells);
  b.save('nhat_06_cua_ham_hang');
}

// 07. Hàng rào dây thép gai và chông tre 6x1x2.
{
  const b = new Build(6, 5, 1);
  b.fill(0, 0, 0, 5, 0, 0, (x, y, z) => (hash(x, y, z) % 3 ? 'coarse_dirt' : 'dirt'));
  for (const x of [0, 5]) { for (let y = 1; y <= 4; y++) b.set(x, y, 0, log('dark_oak')); b.set(x, 2, 0, 'dark_oak_planks'); b.set(x, 3, 0, 'dark_oak_planks'); }
  b.set(0, 1, 0, LEAF); b.set(5, 1, 0, LEAF);
  for (let x = 1; x <= 4; x++) { for (let y = 1; y <= 4; y++) b.set(x, y, 0, bamboo); b.set(x, 5 - 1 + 0, 0, bamboo); }
  for (let x = 1; x <= 4; x++) { b.set(x, 2, 0, 'iron_bars'); b.set(x, 3, 0, 'iron_bars'); }
  b.save('nhat_07_rao_day_thep_gai');
}

// 08. Ổ bắn tỉa ngụy trang trên gốc cây 4x4x7: thân cây lớn phía sau, sàn gỗ, thang, mái lá.
{
  const b = new Build(4, 8, 4);
  b.fill(0, 0, 0, 3, 0, 3, (x, y, z) => (hash(x, y, z) % 3 ? 'coarse_dirt' : 'moss_block'));
  b.fill(1, 1, 0, 2, 7, 1, (x, y, z) => log('spruce'));
  b.fill(0, 3, 0, 3, 3, 3, (x, y, z) => ((x === 1 && z === 2) ? 'air' : dark));
  for (const [x, z] of [[0, 3], [3, 3], [0, 0], [3, 0]]) { b.set(x, 1, z, log('dark_oak')); b.set(x, 2, z, log('dark_oak')); }
  for (let y = 1; y <= 4; y++) b.set(1, y, 2, ladder('south'));
  for (let x = 0; x <= 3; x++) b.set(x, 4, 3, sandbag(x, 4, 3));
  b.set(0, 4, 2, 'cobblestone'); b.set(3, 4, 2, 'cobblestone');
  for (const x of [0, 3]) { b.set(x, 5, 3, 'dark_oak_fence'); b.set(x, 6, 3, 'dark_oak_fence'); }
  b.fill(0, 7, 2, 3, 7, 3, (x, y, z) => (hash(x, y, z) % 5 ? LEAF : OLEAF));
  b.set(0, 6, 2, LEAF); b.set(3, 6, 2, LEAF); b.set(0, 2, 2, LEAF); b.set(3, 1, 1, LEAF);
  b.save('nhat_08_o_ban_ta');
}

// ==================== THÁP CANH ====================

// 09. Tháp canh tre và gỗ, mái lá 5x5x12.
{
  const b = new Build(5, 13, 5);
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) {
    b.set(x, 0, z, log('dark_oak')); b.set(x, 1, z, log('dark_oak'));
    for (let y = 2; y <= 9; y++) b.set(x, y, z, bamboo);
  }
  for (const y of [3, 6]) {
    b.fill(0, y, 0, 4, y, 0, 'dark_oak_planks'); b.fill(0, y, 4, 4, y, 4, 'dark_oak_planks');
    b.fill(0, y, 0, 0, y, 4, 'dark_oak_planks'); b.fill(4, y, 0, 4, y, 4, 'dark_oak_planks');
  }
  for (const z of [0, 4]) { b.set(1, 4, z, bamboo); b.set(2, 5, z, bamboo); b.set(3, 4, z, bamboo); b.set(1, 5, z, bamboo); b.set(3, 5, z, bamboo); }
  b.fill(0, 7, 0, 4, 7, 4, (x, y, z) => ((x === 1 && z === 4) ? 'air' : dark));
  for (let y = 1; y <= 8; y++) b.set(1, y, 4, ladder('east'));
  b.fill(1, 8, 0, 3, 8, 0, 'bamboo_fence'); b.fill(0, 8, 1, 0, 8, 3, 'bamboo_fence'); b.fill(4, 8, 1, 4, 8, 3, 'bamboo_fence'); b.fill(2, 8, 4, 3, 8, 4, 'bamboo_fence');
  b.set(2, 8, 1, hay('x')); b.set(3, 8, 1, hay('x')); b.set(1, 8, 3, barrel);
  b.fill(0, 10, 0, 4, 10, 4, thatch); b.fill(1, 11, 1, 3, 11, 3, thatch); b.set(2, 12, 2, log('dark_oak'));
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) b.set(x, 10, z, thatch(x, 10, z));
  b.set(0, 0, 4, 'moss_block'); b.set(4, 0, 0, 'moss_block');
  b.save('nhat_09_thap_canh_tre');
}

// 10. Tháp canh gỗ hai tầng có đèn pha 6x6x12.
{
  const b = new Build(6, 12, 6);
  for (const [x, z] of [[0, 0], [5, 0], [0, 5], [5, 5]]) for (let y = 0; y <= 9; y++) b.set(x, y, z, log('dark_oak'));
  for (const y of [2, 6]) {
    b.fill(1, y, 0, 4, y, 0, dark); b.fill(1, y, 5, 4, y, 5, dark); b.fill(0, y, 1, 0, y, 4, dark); b.fill(5, y, 1, 5, y, 4, dark);
  }
  for (const z of [0, 5]) for (let i = 0; i < 4; i++) { b.set(1 + i, 3 + (i % 3 === 0 ? 0 : i === 1 ? 1 : i === 2 ? 1 : 0), z, dark); }
  for (const z of [0, 5]) { b.set(1, 3, z, dark); b.set(2, 4, z, dark); b.set(3, 4, z, dark); b.set(4, 3, z, dark); b.set(1, 5, z, dark); b.set(4, 5, z, dark); }
  b.fill(0, 7, 0, 5, 7, 5, (x, y, z) => ((x === 1 && z === 5) ? 'air' : dark));
  for (let y = 1; y <= 8; y++) b.set(1, y, 5 - 0, ladder('east'));
  for (let x = 1; x <= 4; x++) { b.set(x, 8, 5, sandbag(x, 8, 5)); b.set(x, 8, 0, sandbag(x, 8, 0)); }
  for (let z = 1; z <= 4; z++) { b.set(0, 8, z, sandbag(0, 8, z)); b.set(5, 8, z, sandbag(5, 8, z)); }
  b.set(1, 8, 5, 'air');
  b.set(2, 8, 2, 'andesite'); b.set(2, 9, 2, 'polished_andesite'); b.set(3, 9, 2, 'glowstone');
  b.fill(0, 10, 0, 5, 10, 5, thatch); b.fill(1, 11, 1, 4, 11, 4, thatch);
  b.set(0, 10, 5, LEAF); b.set(5, 9, 0, LEAF);
  b.set(1, 1, 1, 'oak_planks'); b.set(1, 2, 1, barrel); b.set(4, 1, 1, 'cobblestone'); b.set(3, 1, 1, 'spruce_planks');
  b.save('nhat_10_thap_den_pha');
}

// 11. Chòi quan sát trên nóc lô cốt 5x5x6.
{
  const b = new Build(6, 8, 5);
  b.fill(0, 0, 0, 4, 0, 4, 'stone');
  b.walls(0, 1, 0, 4, 3, 4, (x, y, z) => (hash(x, y, z) % 7 === 0 ? 'moss_block' : concrete(x, y, z)));
  b.clear(2, 1, 4); b.clear(2, 2, 4);
  b.fill(1, 4, 1, 3, 4, 3, 'dark_oak_planks');
  for (let x = 0; x <= 4; x++) { b.set(x, 4, 0, sandbag(x, 4, 0)); b.set(x, 4, 4, sandbag(x, 4, 4)); }
  for (let z = 1; z <= 3; z++) { b.set(0, 4, z, sandbag(0, 4, z)); b.set(4, 4, z, sandbag(4, 4, z)); }
  b.set(4, 4, 2, 'air');
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) { b.set(x, 5, z, log('spruce')); b.set(x, 6, z, log('spruce')); }
  b.fill(0, 7, 0, 4, 7, 4, thatch); b.set(2, 7, 2, dark);
  for (let y = 1; y <= 4; y++) b.set(5, y, 2, ladder('east'));
  b.set(1, 5, 1, barrel); b.set(3, 5, 1, 'oak_planks');
  b.set(0, 3, 0, LEAF);
  b.save('nhat_11_choi_tren_lo_cot');
}

// ==================== DOANH TRẠI VÀ LỀU TRẠI ====================

// 12. Doanh trại gỗ dài, sàn cao 16x7x6: chân cột, sàn nâng, mái rơm.
{
  const b = new Build(16, 10, 7);
  for (let x = 1; x <= 14; x += 3) for (const z of [1, 5]) { b.set(x, 0, z, 'cobblestone'); b.set(x, 1, z, log('spruce')); }
  b.fill(1, 2, 1, 14, 2, 5, dark);
  b.walls(1, 3, 1, 14, 5, 5, (x, y, z) => (hash(x, y, z) % 6 === 0 ? 'spruce_planks' : dark));
  for (const x of [1, 4, 7, 10, 13]) for (let y = 3; y <= 5; y++) { b.set(x, y, 1, log('spruce')); b.set(x, y, 5, log('spruce')); }
  for (const z of [1, 5]) for (const x of [14]) for (let y = 3; y <= 5; y++) b.set(x, y, z, log('spruce'));
  for (const x of [2, 5, 11, 14 - 2]) for (const z of [1, 5]) { b.set(x, 4, z, 'air'); b.set(x, 4, z, 'glass_pane'); }
  for (const z of [1, 5]) for (const x of [2, 5, 8, 11]) { b.set(x, 4, z, 'glass_pane'); b.set(x - 1 < 1 ? x : x - 1, 4, z, b.get(x - 1 < 1 ? x : x - 1, 4, z)); }
  b.set(7, 3, 5, door('spruce', 'south', 'lower')); b.set(7, 4, 5, door('spruce', 'south', 'upper'));
  b.fill(6, 6, 6, 8, 6, 6, 'sandstone');
  b.set(7, 1, 6, stairs('spruce', 'north')); b.set(7, 2, 6, stairs('spruce', 'north'));
  for (let k = 0; k < 4; k++) {
    const zn = k, zs = 6 - k;
    for (let x = 0; x <= 15; x++) {
      b.set(x, 6 + k, zn, thatch(x, 6 + k, zn)); if (zs !== zn) b.set(x, 6 + k, zs, thatch(x, 6 + k, zs));
    }
    if (k > 0) for (let z = zn + 1; z <= zs - 1; z++) { b.set(1, 6 + k, z, dark); b.set(14, 6 + k, z, dark); }
  }
  b.fill(1, 6, 1, 14, 6, 5, dark);
  b.fill(3, 1, 2, 4, 1, 3, 'oak_planks'); b.set(11, 1, 3, barrel); b.set(12, 1, 3, barrel); b.set(2, 1, 4, 'oak_planks');
  b.set(0, 7, 0, LEAF); b.set(15, 7, 0, LEAF);
  b.save('nhat_12_doanh_trai_go');
}

// 13. Nhà sĩ quan có hiên 10x8x6: sàn cao, hiên có lan can, mái rơm bốn mái, cờ trên mái.
{
  const b = new Build(10, 11, 8);
  for (const x of [1, 3, 5, 7]) for (const z of [1, 4]) { b.set(x, 0, z, 'cobblestone'); b.set(x, 1, z, log('spruce')); }
  b.fill(1, 2, 1, 8, 2, 7, dark);
  b.walls(1, 3, 1, 8, 5, 5, (x, y, z) => (hash(x, y, z) % 5 === 0 ? 'spruce_planks' : dark));
  for (const [x, z] of [[1, 1], [8, 1], [1, 5], [8, 5]]) for (let y = 3; y <= 5; y++) b.set(x, y, z, log('spruce'));
  for (const x of [2, 7]) { b.set(x, 4, 5, 'glass_pane'); b.set(x, 4, 1, 'glass_pane'); }
  b.set(4, 3, 5, door('spruce', 'south', 'lower')); b.set(4, 4, 5, door('spruce', 'south', 'upper'));
  for (let x = 1; x <= 8; x++) b.set(x, 3, 7, 'dark_oak_fence');
  b.set(4, 3, 7, 'air');
  for (const x of [1, 8]) for (let y = 3; y <= 5; y++) b.set(x, y, 7, log('spruce'));
  b.set(2, 3, 6, hay('x')); b.set(6, 3, 6, 'oak_planks'); b.set(7, 3, 6, barrel);
  b.set(4, 2, 7, stairs('spruce', 'north')); b.set(4, 1, 7, 'air');
  for (let k = 0; k < 4; k++) {
    for (let z = k; z <= 7 - k; z++) for (let x = k; x <= 9 - k; x++) {
      if (z === k || z === 7 - k || x === k || x === 9 - k || k === 3) b.set(x, 6 + k, z, thatch(x, 6 + k, z));
    }
  }
  b.fill(1, 6, 1, 8, 6, 5, dark);
  b.set(2, 6, 6, LEAF); b.set(7, 6, 6, LEAF); b.set(1, 6, 1, LEAF);
  // cờ trên mái
  b.set(7, 9, 3, 'dark_oak_fence'); b.set(7, 10, 3, 'dark_oak_fence');
  b.set(8, 10, 3, 'red_wool'); b.set(9, 10, 3, 'white_wool'); b.set(8, 9, 3, 'white_wool'); b.set(9, 9, 3, 'white_wool');
  b.save('nhat_13_nha_si_quan');
}

// 14. Lều vải có nền bao cát 6x5x4.
{
  const b = new Build(6, 6, 5);
  b.fill(0, 0, 0, 5, 0, 4, sandbag);
  b.fill(1, 0, 1, 4, 0, 3, 'spruce_planks');
  b.walls(0, 1, 0, 5, 2, 4, canvas);
  for (const [x, z] of [[0, 0], [5, 0], [0, 4], [5, 4], [2, 4], [3, 4]]) for (let y = 1; y <= 2; y++) b.set(x, y, z, log('spruce'));
  b.fill(2, 1, 4, 3, 1, 4, 'air'); b.fill(2, 2, 4, 3, 2, 4, 'air');
  b.fill(1, 1, 4, 1, 2, 4, canvas); b.fill(4, 1, 4, 4, 2, 4, canvas);
  b.fill(0, 3, 0, 5, 3, 4, canvas); b.fill(1, 4, 0, 4, 4, 4, canvas); b.fill(2, 5, 0, 3, 5, 4, canvas);
  b.set(2, 4, 4, 'white_wool'); b.set(3, 4, 4, 'white_wool'); b.set(2, 5, 4, 'red_wool'); b.set(3, 5, 4, 'white_wool');
  b.set(3, 1, 1, 'oak_planks'); b.set(4, 1, 2, barrel);
  b.set(1, 4, 0, LEAF); b.set(2, 3, 0, 'coarse_dirt');
  b.save('nhat_14_leu_vai');
}

// 15. Lều chỉ huy dã chiến có bàn bản đồ, ăng-ten 8x6x6.
{
  const b = new Build(8, 12, 6);
  b.fill(0, 0, 0, 7, 0, 5, (x, y, z) => (hash(x, y, z) % 3 ? 'coarse_dirt' : 'rooted_dirt'));
  b.walls(0, 1, 0, 7, 2, 5, canvas);
  b.fill(2, 1, 5, 5, 2, 5, 'air');
  for (const [x, z] of [[0, 5], [7, 5], [2, 5], [5, 5], [0, 0], [7, 0]]) for (let y = 1; y <= 2; y++) b.set(x, y, z, log('spruce'));
  b.fill(0, 3, 0, 7, 3, 5, canvas); b.fill(1, 4, 0, 6, 4, 5, canvas); b.fill(2, 5, 0, 5, 5, 5, canvas); b.fill(3, 6, 0, 4, 6, 5, canvas);
  for (const [x, y, z] of [[2, 4, 5], [5, 5, 5], [3, 6, 2], [6, 3, 5]]) b.set(x, y, z, 'sandstone');
  b.set(3, 1, 3, 'spruce_slab[type=top,waterlogged=false]'); b.set(4, 1, 3, 'spruce_slab[type=top,waterlogged=false]');
  b.set(3, 1, 2, 'spruce_slab[type=top,waterlogged=false]'); b.set(4, 1, 2, 'spruce_slab[type=top,waterlogged=false]');
  b.set(3, 1, 4, stairs('spruce', 'north')); b.set(4, 1, 4, stairs('spruce', 'north'));
  b.set(6, 1, 2, 'iron_block'); b.set(6, 2, 2, 'lever[face=floor,facing=north,powered=false]');
  b.set(1, 1, 3, barrel); b.set(1, 1, 2, 'oak_planks'); b.set(1, 2, 3, 'oak_planks');
  b.set(0, 1, 5, hay('x')); b.set(1, 1, 5, hay('x'));
  b.set(3, 7, 1, 'cobblestone'); for (let y = 8; y <= 10; y++) b.set(3, y, 1, 'dark_oak_fence');
  b.set(2, 9, 1, 'dark_oak_fence'); b.set(4, 9, 1, 'dark_oak_fence'); b.set(2, 10, 1, 'dark_oak_fence'); b.set(4, 10, 1, 'dark_oak_fence');
  b.set(1, 3, 5, LEAF); b.set(6, 4, 5, LEAF);
  b.save('nhat_15_leu_chi_huy');
}

// 16. Nhà ăn và bếp dã chiến 10x8x6: mái rơm trên cột, bàn dài, bếp đá có ống khói.
{
  const b = new Build(10, 10, 8);
  b.fill(0, 0, 0, 9, 0, 7, (x, y, z) => (hash(x, y, z) % 4 ? 'coarse_dirt' : 'moss_block'));
  for (const x of [0, 3, 6]) for (const z of [0, 7]) for (let y = 1; y <= 3; y++) b.set(x, y, z, log('spruce'));
  for (const z of [3]) for (const x of [0, 6]) for (let y = 1; y <= 3; y++) b.set(x, y, z, log('spruce'));
  for (let k = 0; k < 4; k++) {
    const xw = k, xe = 6 - k;
    for (let z = 0; z <= 7; z++) {
      b.set(xw, 4 + k, z, thatch(xw, 4 + k, z)); if (xe !== xw) b.set(xe, 4 + k, z, thatch(xe, 4 + k, z));
    }
  }
  b.fill(0, 4, 0, 6, 4, 0, dark); b.fill(0, 4, 7, 6, 4, 7, dark);
  for (const z of [0, 7]) for (let k = 1; k < 3; k++) for (let x = k + 1; x <= 5 - k; x++) b.set(x, 4 + k, z, (z === 0 || z === 7) ? 'hay_block[axis=x]' : 'air');
  // bàn dài và ghế
  for (const x of [1, 4]) {
    for (let z = 2; z <= 5; z++) b.set(x, 1, z, 'spruce_slab[type=top,waterlogged=false]');
    for (let z = 2; z <= 5; z++) { b.set(x - 1 < 0 ? x : x - 1 + 0, 1, z, b.get(x - 1, 1, z) ?? 'air'); }
  }
  for (const x of [2, 5]) for (let z = 2; z <= 5; z++) b.set(x, 1, z, stairs('spruce', x === 2 ? 'west' : 'east'));
  // bếp đá bên phải
  b.fill(7, 1, 1, 9, 3, 3, (x, y, z) => (hash(x, y, z) % 4 ? 'cobblestone' : 'mossy_cobblestone'));
  b.set(8, 1, 3, 'furnace[facing=south,lit=true]'); b.set(7, 1, 3, 'furnace[facing=south,lit=true]');
  b.fill(7, 4, 0, 9, 4, 4, dark); b.fill(7, 5, 0, 9, 5, 4, 'dark_oak_slab[type=bottom,waterlogged=false]');
  for (let y = 4; y <= 9; y++) b.set(8, y, 2, 'cobblestone');
  b.set(7, 1, 5, hay('x')); b.set(9, 1, 5, 'oak_planks'); b.set(9, 1, 6, barrel);
  b.set(0, 4, 3, LEAF);
  b.save('nhat_16_nha_an_bep');
}

// 17. Kho tiếp tế dưới lưới ngụy trang 8x6x5.
{
  const b = new Build(8, 8, 6);
  b.fill(0, 0, 0, 7, 0, 5, (x, y, z) => (hash(x, y, z) % 4 ? 'coarse_dirt' : 'moss_block'));
  for (const [x, z] of [[0, 0], [7, 0], [0, 5], [7, 5]]) for (let y = 1; y <= 6; y++) b.set(x, y, z, log('spruce'));
  b.fill(1, 1, 0, 6, 3, 0, 'dark_oak_planks'); b.fill(0, 1, 1, 0, 3, 2, 'dark_oak_planks'); b.fill(7, 1, 1, 7, 3, 2, 'dark_oak_planks');
  b.fill(3, 2, 0, 5, 4, 0, 'white_wool'); b.set(4, 3, 0, 'red_wool');
  for (const x of [0, 7]) for (let y = 4; y <= 5; y++) for (let z = 0; z <= 5; z += 5) b.set(x, y, z, log('spruce'));
  b.fill(0, 6, 0, 7, 6, 5, (x, y, z) => (hash(x, y, z) % 10 < 7 ? (hash(x, y, z + 3) % 3 ? LEAF : OLEAF) : 'air'));
  for (const [x, z] of [[0, 0], [7, 0], [0, 5], [7, 5]]) b.set(x, 6, z, log('spruce'));
  b.set(2, 7, 2, LEAF); b.set(5, 7, 3, LEAF);
  // hàng hóa
  b.fill(1, 1, 1, 2, 1, 2, 'hay_block[axis=y]'); b.set(1, 2, 1, hay('x')); b.set(2, 1, 3, 'oak_planks');
  b.fill(3, 1, 1, 4, 1, 2, 'oak_planks'); b.set(3, 2, 1, 'oak_planks'); b.set(4, 2, 1, barrel); b.set(5, 1, 2, 'spruce_planks');
  for (const z of [1, 2, 3]) b.set(6, 1, z, 'green_terracotta');
  b.set(6, 2, 2, 'green_terracotta');
  b.save('nhat_17_kho_tiep_te');
}

// 18. Trạm quân y dã chiến 8x6x5: lều len trắng, sàn ván, hai giường.
{
  const b = new Build(8, 8, 6);
  b.fill(0, 0, 0, 7, 0, 5, (x, y, z) => (hash(x, y, z) % 4 ? 'coarse_dirt' : 'rooted_dirt'));
  b.fill(1, 0, 1, 6, 0, 4, 'spruce_planks');
  const wool = (x, y, z) => (hash(x, y, z) % 12 === 0 ? 'sandstone' : 'white_wool');
  b.walls(0, 1, 0, 7, 3, 5, wool);
  b.fill(2, 1, 5, 5, 3, 5, 'air');
  for (const [x, z] of [[0, 5], [7, 5], [2, 5], [5, 5], [0, 0], [7, 0], [0, 2.5 | 0], [7, 2]]) for (let y = 1; y <= 3; y++) b.set(x, y, z, log('spruce'));
  for (const z of [3, 4]) { b.set(0, 2, z, 'glass_pane'); b.set(7, 2, z, 'glass_pane'); }
  for (let k = 0; k < 4; k++) {
    for (let z = 0; z <= 5; z++) for (const x of k === 3 ? [3, 4] : [k, 7 - k]) b.set(x, 4 + k, z, wool(x, 4 + k, z));
    if (k < 3) for (let x = k + 1; x <= 6 - k; x++) { if (k === 0) b.set(x, 4, 0, wool(x, 4, 0)); }
  }
  b.fill(0, 4, 0, 7, 4, 5, wool);
  b.set(3, 8 - 1, 0, 'white_wool');
  b.set(1, 1, 1, 'white_bed[facing=south,occupied=false,part=foot]'); b.set(1, 1, 2, 'white_bed[facing=south,occupied=false,part=head]');
  b.set(6, 1, 1, 'white_bed[facing=south,occupied=false,part=foot]'); b.set(6, 1, 2, 'white_bed[facing=south,occupied=false,part=head]');
  b.set(4, 1, 1, barrel); b.set(0, 1, 5, hay('x')); b.set(1, 1, 5, hay('x'));
  b.set(0, 4, 5, LEAF);
  b.save('nhat_18_tram_quan_y');
}

// 19. Cổng trại có chốt gác bao cát và cột cờ 7x3x7.
{
  const b = new Build(7, 14, 3);
  b.fill(0, 0, 0, 6, 0, 2, (x, y, z) => (hash(x, y, z) % 4 ? 'coarse_dirt' : 'moss_block'));
  for (let y = 1; y <= 3; y++) { b.set(0, y, 1, log('spruce')); if (y < 3) b.set(0, y, 0, log('spruce')); }
  b.set(0, 2, 2, log('spruce'));
  for (const x of [1, 4]) for (let y = 1; y <= 5; y++) b.set(x, y, 1, log('dark_oak'));
  b.fill(1, 5, 1, 4, 5, 1, dark); b.set(1, 6, 1, log('dark_oak', 'x')); b.fill(1, 6, 1, 4, 6, 1, log('dark_oak', 'x'));
  b.set(2, 4, 1, dark); b.set(3, 4, 1, dark); b.set(1, 4, 1, log('dark_oak')); b.set(4, 4, 1, log('dark_oak'));
  b.set(2, 4, 1, 'air'); b.set(3, 4, 1, 'air');
  b.fill(5, 1, 0, 6, 2, 2, sandbag); b.fill(5, 1, 1, 6, 1, 1, sandbag);
  for (const [x, z] of [[5, 0], [5, 2], [6, 0], [6, 2]]) for (let y = 3; y <= 4; y++) b.set(x, y, z, log('spruce'));
  b.fill(5, 5, 0, 6, 5, 2, thatch); b.fill(5, 6, 1, 6, 6, 1, thatch);
  for (let y = 1; y <= 13; y++) b.set(6, y, 1, y <= 5 ? b.get(6, y, 1) ?? 'air' : log('spruce'));
  for (let y = 7; y <= 13; y++) b.set(6, y, 1, log('spruce'));
  b.set(6, 6, 1, log('spruce'));
  b.set(6, 3, 1, 'air'); b.set(6, 4, 1, log('spruce'));
  flag(b, 0, 12, 1, SUN_S.length ? SUN_S : SUN);
  b.set(0, 1, 2, LEAF); b.set(4, 6, 0, LEAF);
  b.save('nhat_19_cong_trai');
}

// ==================== CỜ ====================

// 20. Cột cờ cao, cờ Mặt Trời mọc đang bay (lưới 12x8).
{
  const b = new Build(14, 15, 3);
  b.fill(0, 0, 0, 2, 0, 2, 'cobblestone'); b.set(1, 1, 1, 'stone_bricks'); b.fill(0, 1, 0, 2, 1, 2, 'air');
  b.set(1, 1, 1, 'stone_bricks');
  for (let y = 2; y <= 13; y++) b.set(1, y, 1, log('spruce'));
  b.set(1, 14, 1, 'cobblestone');
  flag(b, 2, 13, 1, SUN);
  for (const y of [6, 10]) b.set(1, y, 1, 'oak_planks');
  b.set(0, 1, 0, 'moss_block'); b.set(2, 1, 2, 'moss_block');
  b.save('nhat_20_cot_co_cao');
}

// 21. Cột cờ nhỏ cho trại dã chiến (lưới thu nhỏ 6x4).
{
  const b = new Build(8, 10, 1);
  b.fill(0, 0, 0, 2, 0, 0, 'cobblestone');
  for (let y = 1; y <= 8; y++) b.set(1, y, 0, log('spruce'));
  b.set(1, 9, 0, 'cobblestone');
  flag(b, 2, 8, 0, SUN_S);
  b.save('nhat_21_cot_co_nho');
}

// 22. Giá cờ hiệu đơn vị (đỏ trắng) trên khung gỗ.
{
  const b = new Build(8, 10, 1);
  for (const x of [0, 7]) { b.set(x, 0, 0, 'cobblestone'); for (let y = 1; y <= 8; y++) b.set(x, y, 0, log('spruce')); b.set(x, 9, 0, 'cobblestone'); }
  b.fill(1, 8, 0, 6, 8, 0, log('spruce', 'x'));
  for (const [row, mat] of [[7, 'red_wool'], [6, 'red_wool'], [5, 'white_wool'], [4, 'white_wool']]) for (let x = 1; x <= 6; x++) b.set(x, row, 0, mat);
  b.save('nhat_22_gia_co_hieu');
}

// 23. Cờ treo tường trước doanh trại.
{
  const b = new Build(8, 7, 2);
  b.fill(0, 0, 0, 7, 5, 0, (x, y, z) => (hash(x, y, z) % 5 === 0 ? 'spruce_planks' : dark));
  for (const x of [0, 7]) for (let y = 0; y <= 5; y++) b.set(x, y, 0, log('spruce'));
  b.fill(1, 5, 1, 6, 5, 1, log('spruce', 'x'));
  flag(b, 1, 4, 1, SUN_S);
  b.save('nhat_23_co_treo_tuong');
}
