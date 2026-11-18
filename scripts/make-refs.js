// Sinh bộ 24 công trình "Tham chiếu ChatGPT" thành file .schem trong src/assets/tham_chieu.
// Dựng lại bằng khối vanilla 1.20.1 theo bộ ảnh tham chiếu và bảng kích thước (Dai x Rong x Cao) của người dùng.
// Quy ước như các bộ khác: mặt trước / cửa chính quay về phía NAM (z lớn); xoay bằng R trong editor.
// Đây là bản dựng gần giống ảnh, không phải bản sao từng khối.
import fs from 'node:fs';
import path from 'node:path';
import { Build, cfg, stairs, slab, log, ladder, hash } from './build-lib.js';

cfg.out = path.resolve(process.argv[2] ?? 'src/assets/tham_chieu');
fs.mkdirSync(cfg.out, { recursive: true });

const door = (wood, facing, half, hinge = 'left') => `${wood}_door[facing=${facing},half=${half},hinge=${hinge},open=false,powered=false]`;
const lanternUp = 'lantern[hanging=false,waterlogged=false]';
const lanternHang = 'lantern[hanging=true,waterlogged=false]';
const barrel = 'barrel[facing=up,open=false]';
const hay = (axis) => `hay_block[axis=${axis}]`;
const trap = (wood, facing, half = 'bottom', open = true) => `${wood}_trapdoor[facing=${facing},half=${half},open=${open},powered=false,waterlogged=false]`;
const FULL = { stone_brick: 'stone_bricks', brick: 'bricks', deepslate_brick: 'deepslate_bricks', cobblestone: 'cobblestone', mossy_stone_brick: 'mossy_stone_bricks' };
const full = (m) => FULL[m] ?? `${m}_planks`;
const pickMat = (m, x, z, k) => (typeof m === 'function' ? m(x, z, k) : m);

/** Mái chữ A có sống mái chạy dọc trục X: dốc theo Z (z0 là mép bắc, z1 mép nam). Trả về số hàng. */
function roofX(b, x0, x1, z0, z1, y, mat) {
  let k = 0;
  for (; z0 + k <= z1 - k; k++) {
    const zn = z0 + k, zs = z1 - k;
    for (let x = x0; x <= x1; x++) {
      const m = pickMat(mat, x, 0, k);
      if (zn === zs) b.set(x, y + k, zn, full(m));
      else { b.set(x, y + k, zn, stairs(m, 'south')); b.set(x, y + k, zs, stairs(m, 'north')); }
    }
  }
  return k;
}
/** Mái chữ A có sống mái chạy dọc trục Z: dốc theo X. */
function roofZ(b, x0, x1, z0, z1, y, mat) {
  let k = 0;
  for (; x0 + k <= x1 - k; k++) {
    const xw = x0 + k, xe = x1 - k;
    for (let z = z0; z <= z1; z++) {
      const m = pickMat(mat, 0, z, k);
      if (xw === xe) b.set(xw, y + k, z, full(m));
      else { b.set(xw, y + k, z, stairs(m, 'east')); b.set(xe, y + k, z, stairs(m, 'west')); }
    }
  }
  return k;
}
/** Lấp tam giác đầu hồi tại mặt phẳng x (mái dốc theo Z, trải từ z0 tới z1, hàng đầu ở độ cao y). */
function endX(b, x, z0, z1, y, state) {
  for (let k = 0; z0 + k + 1 <= z1 - k - 1; k++) for (let z = z0 + k + 1; z <= z1 - k - 1; z++) b.set(x, y + k, z, typeof state === 'function' ? state(x, y + k, z) : state);
}
/** Lấp tam giác đầu hồi tại mặt phẳng z (mái dốc theo X). */
function endZ(b, z, x0, x1, y, state) {
  for (let k = 0; x0 + k + 1 <= x1 - k - 1; k++) for (let x = x0 + k + 1; x <= x1 - k - 1; x++) b.set(x, y + k, z, typeof state === 'function' ? state(x, y + k, z) : state);
}
const mix = (a, c, every = 5) => (x, y, z) => (hash(x, y, z) % every === 0 ? c : a);
const stoneMix = (x, y, z) => { const r = hash(x, y, z) % 12; return r < 6 ? 'cobblestone' : r < 9 ? 'mossy_cobblestone' : 'stone_bricks'; };
const wallStone = (x, y, z) => { const r = hash(x, y, z) % 14; return r < 8 ? 'cobblestone' : r < 11 ? 'mossy_cobblestone' : 'andesite'; };
const sandbag = (x, y, z) => (hash(x, y, z) % 3 ? 'smooth_sandstone' : 'sandstone');

// ==================== ĐỒ VẬT NHỎ ====================

// 01. Thùng nước 2x2x3: thân ván vân sam, đai sắt, miệng thùng đầy nước (vạc nước).
{
  const b = new Build(2, 3, 2);
  b.fill(0, 0, 0, 1, 0, 1, 'spruce_planks');
  b.fill(0, 1, 0, 1, 1, 1, 'iron_block');
  b.fill(0, 2, 0, 1, 2, 1, 'water_cauldron[level=3]');
  b.save('01_thung_nuoc');
}

// 02. Cột đèn đường 1x1x6.
{
  const b = new Build(1, 6, 1);
  b.set(0, 0, 0, 'stone_bricks'); b.set(0, 1, 0, log('spruce')); b.set(0, 2, 0, 'stone_bricks');
  b.set(0, 3, 0, log('spruce')); b.set(0, 4, 0, 'glowstone'); b.set(0, 5, 0, slab('stone_brick'));
  b.save('02_cot_den_duong');
}

// 03. Giá đèn gắn tường 1x2x2: tường đá, tay đòn gỗ, đèn lồng treo.
{
  const b = new Build(1, 3, 2);
  b.set(0, 0, 0, 'mossy_stone_bricks'); b.set(0, 1, 0, 'stone_bricks'); b.set(0, 2, 0, 'stone_bricks');
  b.set(0, 2, 1, 'spruce_planks'); b.set(0, 1, 1, lanternHang);
  b.save('03_gia_den_tuong');
}

// 04. Hộp thư 1x2x3: cột gỗ, hộp đỏ, khe thư.
{
  const b = new Build(1, 3, 2);
  b.set(0, 0, 0, 'oak_fence'); b.set(0, 1, 0, 'oak_fence');
  b.set(0, 2, 0, 'red_terracotta'); b.set(0, 2, 1, 'iron_block');
  b.set(0, 1, 1, 'air');
  b.save('04_hop_thu');
}

// 05. Chồng thùng tiếp tế phủ bạt 3x3x3.
{
  const b = new Build(3, 3, 3);
  for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) b.set(x, 0, z, (x + z) % 2 ? barrel : (x === 1 ? 'spruce_planks' : 'oak_planks'));
  b.fill(0, 1, 0, 2, 1, 1, 'green_wool');
  b.set(0, 1, 2, barrel); b.set(1, 1, 2, 'oak_planks');
  b.fill(1, 2, 0, 1, 2, 1, 'green_wool');
  b.set(0, 2, 0, 'green_wool'); b.set(2, 2, 0, 'green_wool');
  b.save('05_thung_tiep_te');
}

// 06. Giếng đá có mái 5x5x6.
{
  const b = new Build(5, 6, 5);
  b.fill(0, 0, 0, 4, 0, 4, (x, y, z) => (x % 4 === 0 || z % 4 === 0 ? (hash(x, y, z) % 4 ? 'stone_bricks' : 'mossy_stone_bricks') : 'cobblestone'));
  b.set(2, 0, 2, 'water');
  b.walls(0, 1, 0, 4, 1, 4, (x, y, z) => (hash(x, y, z) % 5 ? 'stone_bricks' : 'mossy_stone_bricks'));
  for (const [x, z] of [[1, 1], [3, 1], [1, 3], [3, 3]]) { b.set(x, 1, z, log('oak')); b.set(x, 2, z, log('oak')); }
  b.set(2, 2, 2, 'chain[axis=y]'); b.set(2, 1, 2, barrel);
  b.fill(0, 3, 0, 4, 3, 4, 'spruce_planks'); b.fill(1, 4, 1, 3, 4, 3, 'spruce_planks'); b.set(2, 5, 2, 'spruce_planks');
  b.set(2, 2, 2, 'chain[axis=y]');
  b.save('06_gieng_da');
}

// 07. Đống kiện rơm 3x3x3.
{
  const b = new Build(3, 3, 3);
  b.fill(0, 0, 0, 2, 0, 2, (x, y, z) => hay(hash(x, y, z) % 2 ? 'x' : 'z'));
  b.fill(0, 1, 1, 2, 1, 1, hay('x')); b.set(1, 1, 0, hay('z')); b.set(1, 1, 2, hay('z'));
  b.set(1, 2, 1, hay('y'));
  b.save('07_kien_rom');
}

// 08. Quầy chợ mái sọc 4x3x4.
{
  const b = new Build(4, 5, 3);
  for (const x of [0, 3]) for (const z of [0, 2]) { b.set(x, 0, z, 'stone_bricks'); b.set(x, 1, z, log('oak')); b.set(x, 2, z, log('oak')); }
  b.fill(1, 0, 0, 2, 1, 0, 'oak_planks');           // vách sau
  b.fill(1, 0, 2, 2, 0, 2, 'oak_planks');           // mặt quầy
  b.set(0, 0, 1, 'oak_planks'); b.set(3, 0, 1, 'oak_planks'); b.set(1, 1, 2, barrel); b.set(2, 1, 2, 'oak_planks');
  b.set(2, 2, 1, lanternHang);
  b.fill(0, 3, 0, 3, 3, 2, (x) => (x % 2 ? 'white_wool' : 'red_wool'));
  b.fill(1, 4, 1, 2, 4, 1, (x) => (x % 2 ? 'white_wool' : 'red_wool'));
  b.save('08_quay_cho');
}

// 09. Cổng gỗ có biển 5x1x3 (thực tế cao 5 để có xà ngang và biển).
{
  const b = new Build(5, 5, 1);
  for (const x of [0, 4]) { b.set(x, 0, 0, 'stone_bricks'); for (let y = 1; y <= 3; y++) b.set(x, y, 0, log('oak')); }
  b.fill(0, 4, 0, 4, 4, 0, 'spruce_planks');
  b.set(1, 0, 0, 'oak_fence'); b.set(1, 1, 0, 'oak_fence'); b.set(3, 0, 0, 'oak_fence'); b.set(3, 1, 0, 'oak_fence');
  b.set(2, 0, 0, 'oak_fence_gate[facing=south,in_wall=false,open=false,powered=false]');
  b.set(2, 3, 0, 'oak_planks');
  b.save('09_cong_go');
}

// 10. Kho củi nhỏ 3x2x2.
{
  const b = new Build(3, 3, 2);
  for (const x of [0, 2]) for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) b.set(x, y, z, log('spruce'));
  for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) b.set(1, y, z, log('oak', 'z'));
  b.fill(0, 2, 0, 2, 2, 1, 'spruce_planks');
  b.save('10_kho_cui');
}

// 11. Cụm thùng nhiên liệu 3x3x2.
{
  const b = new Build(3, 3, 3);
  const drum = (x, y, z, mat) => { b.set(x, y, z, mat); b.set(x, y + 1, z, 'stone_button[face=floor,facing=north,powered=false]'); };
  drum(0, 0, 2, 'green_terracotta'); drum(1, 0, 2, 'gray_concrete'); drum(2, 0, 2, 'green_terracotta');
  drum(0, 0, 1, 'yellow_concrete'); drum(2, 0, 1, 'black_concrete'); drum(1, 0, 0, 'green_terracotta');
  b.set(1, 0, 1, 'green_terracotta'); b.set(1, 1, 1, 'gray_concrete'); b.set(1, 2, 1, 'stone_button[face=floor,facing=north,powered=false]');
  b.set(0, 1, 1, 'air'); b.set(2, 1, 1, 'air');
  b.save('11_thung_nhien_lieu');
}

// 12. Rào chắn bao cát 4x2x2.
{
  const b = new Build(4, 2, 2);
  b.fill(0, 0, 0, 3, 0, 1, sandbag);
  b.fill(1, 1, 0, 2, 1, 1, (x, y, z) => (hash(x, y, z) % 2 ? 'sandstone' : 'smooth_sandstone'));
  b.save('12_rao_bao_cat');
}

// ==================== NHÀ CỬA VÀ CÔNG TRÌNH ====================

// 13. Nhà tranh nhỏ 8x7x6: mái rơm, đế cuội, tường trát, cột gỗ.
{
  const b = new Build(8, 8, 7);
  b.fill(1, 0, 1, 6, 0, 5, 'oak_planks');
  b.walls(1, 0, 1, 6, 0, 5, 'cobblestone');
  b.walls(1, 1, 1, 6, 1, 5, 'cobblestone');
  b.walls(1, 2, 1, 6, 2, 5, 'white_terracotta');
  for (const [x, z] of [[1, 1], [6, 1], [1, 5], [6, 5]]) for (let y = 1; y <= 2; y++) b.set(x, y, z, log('oak'));
  for (const x of [2, 5]) for (const z of [1, 5]) b.set(x, 2, z, 'glass_pane');
  b.clear(3, 1, 5); b.clear(3, 2, 5); b.set(3, 1, 5, door('oak', 'south', 'lower')); b.set(3, 2, 5, door('oak', 'south', 'upper'));
  b.set(3, 0, 6, slab('stone_brick'));
  // mái rơm bậc thang, rỗng bên trong
  for (let k = 0; k < 4; k++) {
    const zn = k, zs = 6 - k;
    for (let x = 0; x <= 7; x++) {
      if (zn === zs) b.set(x, 3 + k, zn, hay('x'));
      else { b.set(x, 3 + k, zn, hay('x')); b.set(x, 3 + k, zs, hay('x')); }
    }
    if (k > 0) for (let z = zn + 1; z <= zs - 1; z++) { b.set(1, 3 + k, z, 'white_terracotta'); b.set(6, 3 + k, z, 'white_terracotta'); }
  }
  b.fill(1, 3, 1, 6, 3, 5, 'hay_block[axis=x]');
  for (let y = 3; y <= 7; y++) b.set(6, y, 1, 'cobblestone');
  b.save('13_nha_tranh');
}

// 14. Nhà làng châu Âu hai tầng 10x8x9: khung gỗ lộ, tường trát, mái vân sam, ống khói.
{
  const b = new Build(10, 11, 8);
  const X0 = 1, X1 = 8, Z0 = 1, Z1 = 6;
  b.fill(X0, 0, Z0, X1, 0, Z1, 'oak_planks');
  b.walls(X0, 0, Z0, X1, 0, Z1, 'stone_bricks');
  for (const [y0, y1] of [[1, 2], [4, 5]]) b.walls(X0, y0, Z0, X1, y1, Z1, (x, y, z) => (hash(x, y, z) % 11 ? 'white_terracotta' : 'smooth_sandstone'));
  for (const y of [3, 6]) {
    b.fill(X0, y, Z0, X1, y, Z0, log('spruce', 'x')); b.fill(X0, y, Z1, X1, y, Z1, log('spruce', 'x'));
    b.fill(X0, y, Z0, X0, y, Z1, log('spruce', 'z')); b.fill(X1, y, Z0, X1, y, Z1, log('spruce', 'z'));
  }
  b.fill(X0 + 1, 3, Z0 + 1, X1 - 1, 3, Z1 - 1, 'oak_planks');
  for (const [y0, y1] of [[1, 2], [4, 5]]) {
    for (const x of [1, 3, 6, 8]) for (let y = y0; y <= y1; y++) { b.set(x, y, Z0, log('spruce')); b.set(x, y, Z1, log('spruce')); }
    for (const z of [1, 3, 6]) for (let y = y0; y <= y1; y++) { b.set(X0, y, z, log('spruce')); b.set(X1, y, z, log('spruce')); }
  }
  for (const x of [2, 7]) for (const y of [2, 5]) { b.set(x, y, Z1, 'glass_pane'); b.set(x, y, Z0, 'glass_pane'); }
  for (const z of [2, 5]) for (const y of [2, 5]) { b.set(X0, y, z, 'glass_pane'); b.set(X1, y, z, 'glass_pane'); }
  b.clear(4, 1, Z1); b.clear(4, 2, Z1); b.set(4, 1, Z1, door('spruce', 'south', 'lower')); b.set(4, 2, Z1, door('spruce', 'south', 'upper'));
  b.set(5, 1, Z1, 'white_terracotta'); b.set(5, 2, Z1, 'white_terracotta');
  b.set(4, 0, 7, slab('stone_brick'));
  b.set(4, 3, 7, 'spruce_planks'); b.set(5, 3, 7, 'spruce_planks');
  roofX(b, 0, 9, 0, 7, 7, 'spruce');
  endX(b, X0, 0, 7, 7, 'white_terracotta'); endX(b, X1, 0, 7, 7, 'white_terracotta');
  for (let y = 7; y <= 10; y++) b.set(7, y, 2, 'stone_bricks');
  b.save('14_nha_lang_2_tang');
}

// 15. Trang trại đá kèm kho 14x10x8: nhà mái vân sam chữ A, kho mái gạch dốc thoải, cổng đôi.
{
  const b = new Build(14, 9, 10);
  // nhà chính x0..7, đầu hồi quay ra phía nam (z = 8)
  b.fill(1, 0, 1, 6, 0, 8, 'oak_planks');
  b.walls(1, 0, 1, 6, 0, 8, 'stone_bricks');
  b.walls(1, 1, 1, 6, 3, 8, wallStone);
  for (const [x, z] of [[1, 1], [6, 1], [1, 8], [6, 8]]) for (let y = 1; y <= 3; y++) b.set(x, y, z, log('oak'));
  b.set(1, 0, 8, 'stone_bricks'); b.set(6, 0, 8, 'stone_bricks');
  roofZ(b, 0, 7, 0, 9, 4, 'spruce');
  endZ(b, 8, 0, 7, 4, wallStone); endZ(b, 1, 0, 7, 4, wallStone);
  for (const [x, y] of [[3, 2], [4, 2], [3, 5], [4, 5]]) b.set(x, y, 8, 'glass_pane');
  b.set(3, 5, 8, 'glass_pane'); b.set(4, 5, 8, 'glass_pane');
  for (const x of [2, 5]) { b.set(x, 5, 9 - 1, 'glass_pane'); }
  b.set(2, 2, 9, trap('spruce', 'south', 'bottom', true)); b.set(5, 2, 9, trap('spruce', 'south', 'bottom', true));
  b.clear(3, 1, 8); b.clear(3, 2, 8); b.set(3, 1, 8, door('spruce', 'south', 'lower')); b.set(3, 2, 8, door('spruce', 'south', 'upper'));
  b.set(3, 2, 8, door('spruce', 'south', 'upper'));
  b.set(3, 3, 9, 'oak_slab[type=bottom,waterlogged=false]'); b.set(4, 3, 9, 'oak_slab[type=bottom,waterlogged=false]');
  b.set(3, 2, 9, 'lantern[hanging=true,waterlogged=false]');
  for (let y = 4; y <= 8; y++) b.set(6, y, 2, 'stone_bricks');
  // kho x8..13, z2..8
  b.fill(8, 0, 2, 13, 0, 8, 'cobblestone');
  b.walls(8, 1, 2, 13, 2, 8, wallStone);
  for (const x of [8, 13]) for (const z of [2, 8]) for (let y = 1; y <= 2; y++) b.set(x, y, z, log('oak'));
  for (const x of [10, 11]) { b.clear(x, 1, 8); b.clear(x, 2, 8); }
  b.set(10, 1, 8, door('spruce', 'south', 'lower', 'left')); b.set(10, 2, 8, door('spruce', 'south', 'upper', 'left'));
  b.set(11, 1, 8, door('spruce', 'south', 'lower', 'right')); b.set(11, 2, 8, door('spruce', 'south', 'upper', 'right'));
  b.fill(8, 3, 2, 13, 3, 8, 'oak_planks');
  for (let z = 2; z <= 8; z++) {
    b.set(13, 3, z, stairs('brick', 'west')); b.set(12, 3, z, 'bricks');
    b.set(11, 4, z, stairs('brick', 'west')); b.set(10, 4, z, 'bricks');
    b.set(9, 5, z, stairs('brick', 'west')); b.set(8, 5, z, 'bricks');
  }
  b.fill(8, 3, 1, 8, 3, 1, 'air');
  b.save('15_trang_trai_da');
}

// 16. Tiệm bánh 9x8x8: đế đá, tường trát, mái vân sam, mái hiên sọc, biển treo, ống khói.
{
  const b = new Build(9, 10, 8);
  b.fill(1, 0, 1, 7, 0, 6, 'oak_planks');
  b.walls(1, 0, 1, 7, 0, 6, 'stone_bricks');
  b.walls(1, 1, 1, 7, 2, 6, wallStone);
  b.walls(1, 3, 1, 7, 3, 6, 'white_terracotta');
  for (const [x, z] of [[1, 1], [7, 1], [1, 6], [7, 6]]) for (let y = 1; y <= 3; y++) b.set(x, y, z, log('oak'));
  roofZ(b, 0, 8, 0, 7, 4, 'spruce');
  endZ(b, 6, 0, 8, 4, 'white_terracotta'); endZ(b, 1, 0, 8, 4, 'white_terracotta');
  for (const x of [2, 3]) for (const y of [1, 2]) b.set(x, y, 6, 'glass_pane');
  for (const x of [5, 6]) b.set(x, 4 - 1, 6, 'white_terracotta');
  b.clear(5, 1, 6); b.clear(5, 2, 6); b.set(5, 1, 6, door('spruce', 'south', 'lower')); b.set(5, 2, 6, door('spruce', 'south', 'upper'));
  b.fill(2, 3, 7, 4, 3, 7, (x) => (x % 2 ? 'white_wool' : 'red_wool'));
  b.set(5, 2, 7, lanternHang); b.set(5, 3, 7, 'oak_slab[type=top,waterlogged=false]');
  b.set(7, 3, 7, 'oak_slab[type=top,waterlogged=false]'); b.set(7, 2, 7, 'oak_planks');
  b.set(2, 1, 2, 'oak_planks'); b.set(3, 1, 2, 'barrel[facing=up,open=false]');
  for (let y = 4; y <= 9; y++) b.set(6, y, 2, 'stone_bricks');
  b.save('16_tiem_banh');
}

// 17. Lò rèn mở 10x8x7: mặt trước mở, lò nung, đe, mái vân sam.
{
  const b = new Build(10, 9, 8);
  b.fill(1, 0, 1, 8, 0, 6, (x, y, z) => (hash(x, y, z) % 3 ? 'stone_bricks' : 'cobblestone'));
  b.walls(1, 1, 1, 8, 3, 1, (x, y, z) => (hash(x, y, z) % 4 ? 'stone_bricks' : 'mossy_stone_bricks'));
  b.fill(1, 1, 1, 1, 3, 6, (x, y, z) => (y === 1 ? wallStone(x, y, z) : 'spruce_planks'));
  b.fill(8, 1, 1, 8, 3, 6, (x, y, z) => (y === 3 ? 'spruce_planks' : wallStone(x, y, z)));
  for (const x of [1, 4, 8]) for (let y = 1; y <= 3; y++) b.set(x, y, 6, log('spruce'));
  for (const z of [1, 6]) for (let y = 1; y <= 3; y++) { b.set(1, y, z, log('spruce')); b.set(8, y, z, log('spruce')); }
  b.fill(2, 1, 6, 3, 1, 6, 'cobblestone'); b.fill(2, 2, 6, 3, 2, 6, 'spruce_planks');
  b.set(2, 3, 6, 'spruce_planks'); b.set(3, 3, 6, 'spruce_planks');
  b.set(1, 2, 3, 'glass_pane'); b.set(1, 2, 4, 'glass_pane');
  b.fill(5, 3, 6, 7, 3, 6, log('spruce', 'x'));
  // lò nung ở vách sau, ống khói chạy lên mái
  b.fill(5, 1, 1, 7, 2, 2, 'stone_bricks');
  b.set(6, 1, 2, 'furnace[facing=south,lit=true]'); b.set(5, 1, 2, 'stone_bricks'); b.set(7, 1, 2, 'stone_bricks');
  b.set(6, 2, 2, 'stone_bricks');
  b.set(5, 1, 3, 'anvil[facing=east]');
  b.set(7, 1, 4, barrel); b.set(6, 1, 5, 'smooth_stone_slab[type=bottom,waterlogged=false]');
  b.set(7, 3, 5, lanternHang);
  roofX(b, 0, 9, 0, 7, 4, 'spruce');
  endX(b, 1, 0, 7, 4, 'stone_bricks'); endX(b, 8, 0, 7, 4, 'stone_bricks');
  for (let y = 3; y <= 8; y++) b.set(6, y, 1, 'stone_bricks');
  b.save('17_lo_ren');
}

// 18. Nhà đổ nát 10x8x7: nhà một tầng mái gạch bị phá một nửa phía đông, đống đổ nát.
{
  const b = new Build(10, 8, 8);
  b.fill(1, 0, 1, 8, 0, 6, (x, y, z) => (hash(x, y, z) % 3 ? 'cobblestone' : 'gravel'));
  b.walls(1, 0, 1, 8, 0, 6, 'stone_bricks');
  b.walls(1, 1, 1, 8, 1, 6, (x, y, z) => (hash(x, y, z) % 4 ? 'stone_bricks' : 'mossy_stone_bricks'));
  b.walls(1, 2, 1, 8, 3, 6, 'white_terracotta');
  for (const [x, z] of [[1, 1], [8, 1], [1, 6], [8, 6], [4, 1], [4, 6]]) for (let y = 1; y <= 3; y++) b.set(x, y, z, log('oak'));
  for (const x of [2, 3]) b.set(x, 2, 6, 'glass_pane');
  b.set(6, 1, 6, 'air'); b.set(6, 2, 6, 'air');
  b.fill(1, 3, 1, 8, 3, 1, log('spruce', 'x')); b.fill(1, 3, 6, 8, 3, 6, log('spruce', 'x'));
  roofX(b, 0, 9, 0, 7, 4, 'brick');
  endX(b, 1, 0, 7, 4, 'white_terracotta'); endX(b, 8, 0, 7, 4, 'white_terracotta');
  for (const [key] of [...b.cells]) {
    const [x, y, z] = key.split(',').map(Number);
    if (y === 0 && z > 0 && z < 7 && x > 0 && x < 9) continue;
    const p = y >= 4 ? (x - 3) * 15 + (hash(x, y, z) % 30) - 6 : (x - 4) * 16 + (y - 1) * 8 - 6;
    if (x >= 4 && hash(x * 3, y * 5, z * 7) % 100 < Math.max(0, p)) b.cells.delete(key);
  }
  for (let z = 2; z <= 5; z++) for (let x = 5; x <= 8; x++) {
    const r = hash(x, 9, z) % 7;
    if (r < 3) b.set(x, 1, z, r === 0 ? 'gravel' : r === 1 ? 'cobblestone' : 'mossy_cobblestone');
  }
  for (const [x, z] of [[9, 3], [9, 5], [8, 0]]) b.set(x, 0, z, 'cobblestone');
  b.set(8, 4, 1, log('spruce', 'x')); b.set(7, 5, 1, log('spruce', 'x'));
  b.save('18_nha_do_nat');
}

// 19. Chung cư hư hại ba tầng 12x10x12: ba tầng có sàn, cửa sổ, gạch lộ, bị phá nặng phía đông và trên mái.
{
  const b = new Build(12, 15, 10);
  const X0 = 1, X1 = 10, Z0 = 1, Z1 = 8;
  b.fill(X0, 0, Z0, X1, 0, Z1, 'cobblestone');
  const plaster = (x, y, z) => { const r = hash(x, y, z) % 16; return r < 11 ? 'white_terracotta' : r < 14 ? 'bricks' : 'smooth_sandstone'; };
  for (let s = 0; s < 3; s++) {
    const y0 = 1 + s * 4;
    b.walls(X0, y0, Z0, X1, y0 + 2, Z1, plaster);
    b.fill(X0, y0 + 3, Z0, X1, y0 + 3, Z1, (x, y, z) => ((x === X0 || x === X1 || z === Z0 || z === Z1) ? 'stone_bricks' : 'oak_planks'));
    for (const x of [X0, 4, 7, X1]) for (let y = y0; y <= y0 + 2; y++) { b.set(x, y, Z0, 'stone_bricks'); b.set(x, y, Z1, 'stone_bricks'); }
    for (const z of [Z0, 4, 5, Z1]) for (let y = y0; y <= y0 + 2; y++) { b.set(X0, y, z, 'stone_bricks'); b.set(X1, y, z, 'stone_bricks'); }
    for (const x of [2, 3, 5, 6, 8, 9]) for (const y of [y0 + 1, y0 + 2]) { if (x % 3 !== 1 || true) { b.set(x, y, Z1, 'glass_pane'); b.set(x, y, Z0, 'glass_pane'); } }
    for (const z of [2, 3, 6, 7]) for (const y of [y0 + 1, y0 + 2]) { b.set(X0, y, z, 'glass_pane'); b.set(X1, y, z, 'glass_pane'); }
    for (const x of [2, 3, 5, 6, 8, 9]) { if (s === 0) { b.set(x, y0, Z1, plaster(x, y0, Z1)); } }
  }
  b.clear(5, 1, Z1); b.clear(5, 2, Z1); b.clear(6, 1, Z1); b.clear(6, 2, Z1);
  b.fill(X0, 13, Z0, X1, 13, Z1, 'air');
  // đồ đạc trong nhà
  for (let s = 0; s < 3; s++) { b.set(3, 2 + s * 4, 3, barrel); b.set(4, 2 + s * 4, 3, 'oak_planks'); b.set(8, 2 + s * 4, 6, 'spruce_planks'); }
  // mái tàn tích
  for (let x = 2; x <= 9; x++) for (let z = 1; z <= 8; z++) if (hash(x, 77, z) % 100 < 55 - (x - 2) * 3) b.set(x, 13, z, hash(x, 3, z) % 3 ? 'spruce_planks' : 'dark_oak_planks');
  for (let x = 1; x <= 6; x++) b.set(x, 14, hash(x, 5, 5) % 2 ? Z0 : 4, hash(x, 5, 6) % 2 ? log('spruce', 'x') : 'spruce_planks');
  for (let y = 13; y <= 14; y++) b.set(2, y, 2, 'bricks');
  // phá hoại: phía đông và tầng trên
  for (const [key, st] of [...b.cells]) {
    const [x, y, z] = key.split(',').map(Number);
    if (y === 0 || y >= 13) continue;
    const isFloor = (y - 3) % 4 === 0 && y > 0;
    let p = (x - 5) * 14 + (y - 4) * 4;
    if (isFloor) p = (x - 6) * 18 + (y - 4) * 3;
    if (z <= 3 && x >= 5 && y >= 5) p += 30;
    if (x <= 3 && y >= 9) p += 10;
    if (hash(x * 13, y * 7, z * 11) % 100 < Math.max(0, p)) b.cells.delete(key);
  }
  for (const [x, z] of [[9, 3], [9, 5], [10, 4], [10, 6], [8, 2]]) { b.set(x, 1, z, 'cobblestone'); b.set(x, 1, z + 1 > 8 ? z : z + 1, 'gravel'); }
  for (let x = 6; x <= 11; x++) for (let z = 0; z <= 9; z++) if (hash(x, 31, z) % 5 === 0 && !b.get(x, 1, z)) b.set(x, 1, z, hash(x, 4, z) % 2 ? 'cobblestone' : 'gravel');
  b.save('19_chung_cu_hu_hai');
}

// 20. Nhà thờ nhỏ có tháp chuông 10x16x16.
{
  const b = new Build(10, 17, 16);
  const stone = (x, y, z) => (hash(x, y, z) % 8 === 0 ? 'mossy_stone_bricks' : 'stone_bricks');
  // gian chính x4..9, z0..15 ; tháp x0..3, z12..15
  b.fill(4, 0, 0, 9, 0, 15, 'oak_planks'); b.walls(4, 0, 0, 9, 0, 15, 'stone_bricks');
  b.walls(4, 1, 0, 9, 5, 15, 'white_terracotta');
  for (const z of [0, 3, 6, 9, 12, 15]) for (let y = 1; y <= 5; y++) { b.set(4, y, z, stone(4, y, z)); b.set(9, y, z, stone(9, y, z)); }
  for (const x of [4, 9]) for (let y = 1; y <= 5; y++) { b.set(x, y, 0, stone(x, y, 0)); b.set(x, y, 15, stone(x, y, 15)); }
  for (const z of [4, 7, 10]) for (const y of [3, 4]) { b.set(4, y, z + 1 - 1 + 0, 'glass_pane'); b.set(9, y, z, 'glass_pane'); }
  // mái nhà thờ: sống mái chạy dọc Z
  roofZ(b, 4, 9, 0, 15, 6, 'spruce');
  endZ(b, 15, 4, 9, 6, 'white_terracotta'); endZ(b, 0, 4, 9, 6, 'white_terracotta');
  // cửa chính và cửa sổ chữ thập ở mặt trước
  b.clear(6, 1, 15); b.clear(6, 2, 15); b.set(6, 1, 15, door('spruce', 'south', 'lower')); b.set(6, 2, 15, door('spruce', 'south', 'upper'));
  for (const [x, y] of [[6, 3], [6, 4], [6, 5], [5, 4], [7, 4]]) b.set(x, y, 15, 'glass_pane');
  for (const y of [2, 3]) { b.set(8, y, 15, 'glass_pane'); }
  b.set(5, 2, 15, 'glass_pane');
  // tháp chuông
  b.fill(0, 0, 12, 3, 0, 15, 'stone_bricks');
  b.walls(0, 1, 12, 3, 11, 15, stone);
  b.fill(0, 1, 12, 3, 4, 12, 'air'); b.fill(0, 1, 12, 3, 4, 12, (x, y, z) => stone(x, y, z));
  b.fill(1, 1, 13, 2, 11, 14, 'air');
  for (const [x, y, z] of [[1, 8, 12], [2, 8, 12], [1, 9, 12], [2, 9, 12], [1, 8, 15], [2, 8, 15], [1, 9, 15], [2, 9, 15], [0, 8, 13], [0, 8, 14], [0, 9, 13], [0, 9, 14], [3, 8, 13], [3, 8, 14], [3, 9, 13], [3, 9, 14]]) b.clear(x, y, z);
  b.fill(0, 10, 12, 3, 10, 15, 'stone_bricks');
  b.set(1, 9, 13, 'bell[attachment=ceiling,facing=north,powered=false]');
  b.set(1, 2, 15, 'glass_pane'); b.set(2, 5, 15, 'glass_pane');
  b.fill(0, 11, 12, 3, 11, 15, 'stone_bricks');
  // chóp tháp
  for (let x = 0; x <= 3; x++) for (let z = 12; z <= 15; z++) if (x === 0 || x === 3 || z === 12 || z === 15) {
    const f = x === 0 ? 'east' : x === 3 ? 'west' : z === 12 ? 'south' : 'north';
    b.set(x, 12, z, stairs('spruce', f));
  }
  b.fill(1, 12, 13, 2, 12, 14, 'spruce_planks'); b.fill(1, 13, 13, 2, 13, 14, 'spruce_planks');
  b.set(1, 14, 13, 'stone_bricks'); b.set(1, 15, 13, 'stone_bricks'); b.set(1, 16, 13, 'stone_bricks'); b.set(0, 15, 13, 'stone_bricks'); b.set(2, 15, 13, 'stone_bricks');
  b.save('20_nha_tho');
}

// 21. Tháp canh gỗ 5x12x5: bốn chân, sàn quan sát có lan can, thang, mái chóp.
{
  const b = new Build(5, 13, 5);
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) {
    b.set(x, 0, z, 'cobblestone');
    for (let y = 1; y <= 9; y++) b.set(x, y, z, log('oak'));
    b.set(x, 8, z, 'cobblestone');
  }
  for (const y of [2, 5]) {
    b.fill(1, y, 0, 3, y, 0, 'spruce_planks'); b.fill(1, y, 4, 3, y, 4, 'spruce_planks');
    b.fill(0, y, 1, 0, y, 3, 'spruce_planks'); b.fill(4, y, 1, 4, y, 3, 'spruce_planks');
  }
  b.fill(0, 7, 0, 4, 7, 4, 'oak_planks'); b.clear(1, 7, 4);
  for (const y of [8]) {
    b.fill(1, y, 0, 3, y, 0, 'oak_fence'); b.fill(1, y, 4, 3, y, 4, 'oak_fence');
    b.fill(0, y, 1, 0, y, 3, 'oak_fence'); b.fill(4, y, 1, 4, y, 3, 'oak_fence');
  }
  b.set(1, 8, 4, 'air');
  for (let y = 1; y <= 8; y++) b.set(1, y, 4, ladder('east'));
  b.set(1, 7, 4, ladder('east'));
  b.fill(0, 10, 0, 4, 10, 4, 'spruce_planks'); b.fill(1, 11, 1, 3, 11, 3, 'spruce_planks'); b.set(2, 12, 2, 'spruce_planks');
  b.fill(0, 10, 0, 4, 10, 0, 'spruce_planks');
  b.save('21_thap_canh_go');
}

// 22. Trạm nhiên liệu 14x10x6: mái che trụ đá, hai cột bơm đỏ, cửa hàng đá cuội bên phải.
{
  const b = new Build(14, 7, 10);
  b.fill(0, 0, 1, 9, 0, 8, 'smooth_stone');
  for (const [x, z] of [[1, 2], [8, 2], [1, 7], [8, 7]]) { for (let y = 1; y <= 3; y++) b.set(x, y, z, 'stone_bricks'); b.set(x, 0, z, 'stone_bricks'); }
  b.fill(0, 4, 1, 9, 4, 8, 'stone_bricks'); b.fill(1, 4, 2, 8, 4, 7, 'red_terracotta');
  b.fill(1, 5, 2, 8, 5, 7, 'red_terracotta'); b.fill(2, 6, 3, 7, 6, 6, 'stone_bricks');
  for (const x of [3, 6]) { b.set(x, 1, 4, 'red_terracotta'); b.set(x, 2, 4, 'white_terracotta'); b.set(x, 3, 4, 'air'); b.set(x, 1, 5, 'air'); b.set(x, 2, 5, 'stone_button[face=wall,facing=south,powered=false]'); }
  b.set(3, 3, 3, 'air');
  // cửa hàng x10..13, z1..8
  b.fill(10, 0, 1, 13, 0, 8, 'stone_bricks');
  b.walls(10, 1, 1, 13, 3, 8, wallStone);
  b.fill(10, 4, 1, 13, 4, 8, 'stone_bricks'); b.fill(11, 4, 2, 12, 4, 7, 'red_terracotta'); b.fill(10, 5, 1, 13, 5, 8, 'red_terracotta');
  b.fill(10, 5, 1, 13, 5, 1, 'stone_bricks'); b.fill(10, 5, 8, 13, 5, 8, 'stone_bricks');
  b.fill(10, 5, 1, 10, 5, 8, 'stone_bricks'); b.fill(13, 5, 1, 13, 5, 8, 'stone_bricks');
  for (const x of [10, 11]) b.set(x, 2, 8, 'glass_pane'), b.set(x, 1, 8, 'glass_pane');
  b.clear(13, 1, 8); b.clear(13, 2, 8); b.set(13, 1, 8, door('oak', 'south', 'lower')); b.set(13, 2, 8, door('oak', 'south', 'upper'));
  b.set(10, 3, 9 - 1, 'oak_planks'); b.set(11, 3, 8, 'oak_planks'); b.set(12, 3, 8, 'oak_planks');
  b.save('22_tram_nhien_lieu');
}

// 23. Nhà kho mái tôn 16x12x8: tường gạch đá, cột gỗ, đầu hồi ván, cửa trượt sắt, mái sọc.
{
  const b = new Build(12, 12, 16);
  const X0 = 1, X1 = 10, Z0 = 1, Z1 = 14;
  b.fill(X0, 0, Z0, X1, 0, Z1, 'stone_bricks');
  const body = (x, y, z) => (hash(x, y, z) % 9 === 0 ? 'cobblestone' : 'stone_bricks');
  b.walls(X0, 1, Z0, X1, 4, Z1, body);
  for (const z of [1, 5, 9, 14]) for (let y = 1; y <= 4; y++) { b.set(X0, y, z, log('oak')); b.set(X1, y, z, log('oak')); }
  for (const x of [1, 4, 7, 10]) for (let y = 1; y <= 4; y++) { b.set(x, y, Z1, log('oak')); b.set(x, y, Z0, log('oak')); }
  b.fill(X0, 4, Z0, X1, 4, Z0, log('spruce', 'x')); b.fill(X0, 4, Z1, X1, 4, Z1, log('spruce', 'x'));
  b.fill(X0, 4, Z0, X0, 4, Z1, log('spruce', 'z')); b.fill(X1, 4, Z0, X1, 4, Z1, log('spruce', 'z'));
  roofX(b, 0, 11, 0, 11, 5, (x, z, k) => 'stone_brick');
  // mái sọc: chồng thêm lớp thay màu theo cột z
  for (const [key, st] of [...b.cells]) {
    const [x, y, z] = key.split(',').map(Number);
    if (y >= 5 && /stone_brick_stairs/.test(st)) { if (z % 4 >= 2) b.cells.set(key, st.replace('stone_brick_stairs', 'deepslate_brick_stairs')); }
    if (y >= 5 && st === 'minecraft:stone_bricks' && z % 4 >= 2) b.cells.set(key, 'minecraft:deepslate_bricks');
  }
  endX(b, X0, 0, 11, 5, 'spruce_planks'); endX(b, X1, 0, 11, 5, 'spruce_planks');
  // cửa đầu hồi (mặt nam z = 14) và cửa sổ
  b.fill(0, 5, 15, 11, 5, 15, 'air');
  b.fill(4, 1, Z1, 7, 3, Z1, 'iron_block');
  b.set(5, 1, Z1, door('iron', 'south', 'lower', 'left')); b.set(5, 2, Z1, door('iron', 'south', 'upper', 'left'));
  b.set(6, 1, Z1, door('iron', 'south', 'lower', 'right')); b.set(6, 2, Z1, door('iron', 'south', 'upper', 'right'));
  b.fill(4, 4, Z1, 7, 4, Z1, 'iron_block');
  for (const x of [5, 6, 7]) b.set(x - 1 + 0, 6, Z1, 'glass_pane');
  for (const z of [3, 4, 11, 12]) for (const y of [3]) { b.set(X0, y, z, 'glass_pane'); b.set(X1, y, z, 'glass_pane'); }
  for (const x of [2, 3, 8, 9]) b.set(x, 3, Z1, 'glass_pane');
  b.save('23_nha_kho');
}

// 24. Lều chỉ huy có anten 8x6x6: lều len xanh, cột gỗ, bàn điện đài, cột ăng-ten.
{
  const b = new Build(8, 9, 6);
  b.fill(0, 0, 0, 7, 0, 5, 'oak_planks');
  b.walls(0, 1, 0, 7, 2, 5, 'green_wool');
  for (const x of [0, 3, 4, 7]) for (let y = 1; y <= 2; y++) { b.set(x, y, 5, log('oak')); b.set(x, y, 0, log('oak')); }
  for (const z of [0, 5]) for (let y = 1; y <= 2; y++) { b.set(0, y, z, log('oak')); b.set(7, y, z, log('oak')); }
  b.clear(1, 1, 5); b.clear(2, 1, 5); b.clear(1, 2, 5); b.clear(2, 2, 5);
  b.clear(5, 1, 5); b.clear(6, 1, 5); b.clear(5, 2, 5); b.set(5, 2, 5, 'glass_pane'); b.set(6, 2, 5, 'glass_pane');
  b.fill(0, 3, 0, 7, 3, 5, 'green_wool'); b.fill(0, 4, 1, 7, 4, 4, 'green_wool'); b.fill(1, 5, 2, 6, 5, 3, 'green_wool');
  b.set(2, 1, 2, 'stone_bricks'); b.set(3, 1, 2, 'stone_bricks'); b.set(2, 2, 2, 'lever[face=floor,facing=north,powered=false]');
  b.set(5, 1, 2, 'barrel[facing=up,open=false]'); b.set(6, 1, 2, 'oak_planks');
  b.set(3, 6, 2, 'stone_bricks'); b.set(3, 7, 2, 'lightning_rod[facing=up,powered=false,waterlogged=false]');
  b.set(3, 8, 2, 'lightning_rod[facing=up,powered=false,waterlogged=false]');
  b.set(2, 7, 2, 'iron_bars'); b.set(4, 7, 2, 'iron_bars');
  b.save('24_leu_chi_huy');
}
