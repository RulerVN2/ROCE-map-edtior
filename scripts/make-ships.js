// Sinh bộ tàu và xuồng đổ bộ Mỹ WW2 (20 mẫu) thành file .schem trong src/assets/tau_my.
// Dựng theo bộ ảnh tham chiếu của người dùng (Tau_do_bo_va_tau_san_bay_My_WW2_Mo_cua_21_anh.zip).
// Quy ước: chiều dài tàu chạy theo trục X, MŨI TÀU quay về phía ĐÔNG (x lớn); xoay bằng R trong editor.
// Phần thân dưới mực nước (màu đen) cao D khối: đặt công trình sao cho lớp thứ D (đáy lớp xám) ngang mặt nước, tức "Độ cao đặt" âm khoảng -D.
// Thân tàu đặc, ramp và cửa mở thò ra ngoài hai đầu.
import fs from 'node:fs';
import path from 'node:path';
import { Build, cfg, stairs, hash } from './build-lib.js';

cfg.out = path.resolve(process.argv[2] ?? 'src/assets/tau_my');
fs.mkdirSync(cfg.out, { recursive: true });

const GRAY = 'light_gray_concrete', DGRAY = 'gray_concrete', BLACK = 'black_concrete', WHITE = 'white_concrete';
const OLIVE = 'green_terracotta', DECK = 'dark_oak_planks', DECK2 = 'spruce_planks';
const deckMat = (x, y, z) => (hash(x, y, z) % 9 === 0 ? DECK2 : DECK);

/** Một con tàu: toạ độ cục bộ x = dọc thân (0 = đuôi), z = ngang, y = từ đáy; ox, oz là độ lệch khung. */
class Ship {
  constructor(o) {
    Object.assign(this, { bow: 'pointed', wl: 0.88, bul: 0, rail: false, sternExt: 0, bowExt: 0, tail: 0.8, minBow: 0.1, hullMat: null, deckFn: deckMat, portholes: 0, rake: 1.4 }, o);
    this.ox = this.sternExt;
    this.deckY = this.D + this.F;
    this.b = new Build(this.sternExt + this.L + this.bowExt, this.H, this.W);
    this.cz = (this.W - 1) / 2;
  }
  set(x, y, z, st) { const X = x + this.ox; if (X < 0 || y < 0 || z < 0 || X >= this.b.w || y >= this.b.h || z >= this.b.l) return; this.b.set(X, y, z, st); }
  get(x, y, z) { return this.b.get(x + this.ox, y, z); }
  fill(x0, y0, z0, x1, y1, z1, st) { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, typeof st === 'function' ? st(x, y, z) : st); }
  /** Hộp căn giữa theo trục z: nửa rộng hw (số khối mỗi bên của dải giữa), dz lệch tâm. */
  boxc(x0, x1, hw, y0, y1, st, dz = 0) { const a = Math.round(this.cz + dz - hw), c = Math.round(this.cz + dz + hw); this.fill(x0, y0, a, x1, y1, c, st); }
  profile(t) {
    const L = this.L;
    let p = 1;
    if (this.bow === 'pointed') { if (t > 0.62) p = 1 - Math.pow((t - 0.62) / 0.38, 1.7) * (1 - this.minBow); }
    else if (this.bow === 'carrier') { if (t > 0.86) p = 1 - Math.pow((t - 0.86) / 0.14, 1.6) * 0.55; }
    else if (this.bow === 'blunt') { if (t > 0.92) p = 1 - (t - 0.92) / 0.08 * (1 - this.minBow); }
    if (t < 0.07) p *= this.tail + (1 - this.tail) * (t / 0.07);
    return p;
  }
  factor(y) {
    const { D, deckY, wl } = this;
    if (y < D) return 0.5 + (wl - 0.5) * ((y + 1) / (D + 1));
    return wl + (1 - wl) * Math.min(1, (y - D) / Math.max(1, deckY - D));
  }
  halfW(x, y) { return (this.W / 2) * this.profile(x / (this.L - 1)) * this.factor(y); }
  inHull(x, y, z) { return x >= 0 && x < this.L && Math.abs(z - this.cz) < this.halfW(x, y) + 0.001; }
  build() {
    const { L, W, D, deckY } = this;
    for (let y = 0; y <= deckY; y++) for (let x = 0; x < L; x++) for (let z = 0; z < W; z++) {
      if (!this.inHull(x, y, z)) continue;
      if (y < this.D && this.rake && x / (L - 1) > 0.82 && y < this.D * 1.0 * ((x / (L - 1) - 0.82) / 0.18) * this.rake) continue;   // mũi vát từ đáy lên
      let st;
      if (y < D) st = BLACK;
      else if (y === deckY) st = this.deckFn(x, y, z);
      else if (this.hullMat) st = this.hullMat(x, y, z);
      else st = GRAY;
      if (y >= D && y < deckY && this.portholes && y === deckY - 1 && x % this.portholes === 2 && !this.inHull(x, y, z + 1 + (z > this.cz ? 0 : -2)) === false) { /* giữ nguyên */ }
      this.set(x, y, z, st);
    }
    if (this.portholes) {
      const y = deckY - 1;
      for (let x = 2; x < L - 3; x += this.portholes) for (let z = 0; z < W; z++) {
        if (!this.inHull(x, y, z)) continue;
        const edge = !this.inHull(x, y, z - 1) || !this.inHull(x, y, z + 1);
        if (edge) this.set(x, y, z, DGRAY);
      }
    }
    // thành mạn / lan can
    if (this.bul || this.rail) {
      for (let x = 0; x < L; x++) for (let z = 0; z < W; z++) {
        if (!this.inHull(x, deckY, z)) continue;
        const edge = !this.inHull(x + 1, deckY, z) || !this.inHull(x - 1, deckY, z) || !this.inHull(x, deckY, z + 1) || !this.inHull(x, deckY, z - 1);
        if (!edge) continue;
        if (this.bul) for (let k = 1; k <= this.bul; k++) this.set(x, deckY + k, z, (k === this.bul && x % 4 === 0) ? 'stone_bricks' : GRAY);
        else this.set(x, deckY + 1, z, 'iron_bars');
      }
    }
    return this;
  }
  // ---- thành phần ----
  cabin(x0, x1, hw, y0, y1, dz = 0, roof = 'smooth_stone') {
    this.boxc(x0, x1, hw, y0, y1, GRAY, dz);
    const a = Math.round(this.cz + dz - hw), c = Math.round(this.cz + dz + hw);
    const wy = y1 - 1;
    if (wy >= y0) for (let x = x0; x <= x1; x++) for (const z of [a, c]) if ((x - x0) % 2 === 1) this.set(x, wy, z, BLACK);
    if (wy >= y0) for (let z = a; z <= c; z++) for (const x of [x0, x1]) if ((z - a) % 2 === 1) this.set(x, wy, z, BLACK);
    this.boxc(x0, x1, hw, y1 + 1, y1 + 1, roof, dz);
  }
  funnel(x0, x1, hw, y0, y1, dz = 0, cap = 2, col = DGRAY) {
    this.boxc(x0, x1, hw, y0, y1 - cap, col, dz);
    this.boxc(x0, x1, hw, y1 - cap + 1, y1, BLACK, dz);
  }
  mast(x, y0, h, dz = 0, cross = 2) {
    const z = Math.round(this.cz + dz);
    for (let y = y0; y < y0 + h; y++) this.set(x, y, z, 'iron_bars');
    for (let k = -cross; k <= cross; k++) if (k) this.set(x, y0 + h - 2, z + k, 'iron_bars');
    this.set(x, y0 + h, z, 'lightning_rod[facing=up,powered=false,waterlogged=false]');
  }
  gun(x, y, z) { this.set(x, y, z, 'smooth_stone'); this.set(x, y + 1, z, 'blackstone'); this.set(x + 1, y + 1, z, 'iron_bars'); }
  tank(x, y, z) { // 3 dài x 3 rộng, cao 2
    this.fill(x, y, z, x + 2, y, z + 2, OLIVE); this.set(x + 1, y + 1, z + 1, OLIVE); this.set(x + 2, y + 1, z + 1, 'iron_bars');
    this.set(x, y + 1, z, 'black_concrete'); this.set(x, y + 1, z + 2, 'black_concrete');
  }
  truck(x, y, z) { this.fill(x, y, z, x + 3, y, z + 1, OLIVE); this.fill(x, y + 1, z, x + 2, y + 1, z + 1, 'smooth_sandstone'); this.set(x + 3, y + 1, z, 'light_blue_stained_glass'); this.set(x + 3, y + 1, z + 1, 'light_blue_stained_glass'); }
  boat(x, y, z) { this.fill(x, y, z, x + 3, y, z, OLIVE); this.set(x + 4, y, z, 'green_terracotta'); this.set(x + 1, y + 1, z, 'green_terracotta'); this.set(x + 2, y + 1, z, 'green_terracotta'); }
  plane(x, y, z) { // mũi quay về +x
    this.fill(x, y, z, x + 3, y, z, 'blue_concrete'); this.fill(x + 1, y, z - 2, x + 1, y, z + 2, 'blue_concrete');
    this.set(x, y + 1, z, 'blue_concrete'); this.set(x + 4, y, z, BLACK); this.set(x + 1, y + 1, z, 'light_blue_stained_glass');
  }
  flag(x, y, z) { // cờ Mỹ 4x3 trong mặt phẳng x-y
    const rows = [['blue_wool', 'blue_wool', 'white_wool', 'red_wool'], ['red_wool', 'white_wool', 'red_wool', 'white_wool'], ['red_wool', 'white_wool', 'red_wool', 'white_wool']];
    rows.forEach((r, i) => r.forEach((c, j) => this.set(x + j, y - i, z, c)));
  }
  /** Ramp thả xuống nước ở mũi (dir +1) hoặc đuôi (dir -1), rộng quanh tâm. */
  ramp(x0, dir, hw, topY, len, mat = 'stone_brick', dz = 0) {
    const a = Math.round(this.cz + dz - hw), c = Math.round(this.cz + dz + hw);
    for (let i = 0; i < len; i++) {
      const y = topY - i; if (y < 0) break;
      const x = x0 + dir * i;
      for (let z = a; z <= c; z++) this.set(x, y, z, stairs(mat, dir > 0 ? 'west' : 'east'));
      for (let yy = y - 1; yy >= Math.max(0, y - 1); yy--) for (let z = a; z <= c; z++) this.set(x, yy, z, 'stone_bricks');
    }
    for (let i = 0; i < len; i++) { const y = topY - i + 1; if (y >= 1) { this.set(x0 + dir * i, y, a, 'iron_bars'); this.set(x0 + dir * i, y, c, 'iron_bars'); } }
  }
  /** Cửa mũi mở: hai cánh phẳng dựng nghiêng ra hai bên. */
  doors(x0, y0, y1, zA, zB, len) {
    for (let i = 0; i < len; i++) for (let y = y0; y <= y1; y++) { this.set(x0 + i, y, zA - i, GRAY); this.set(x0 + i, y, zB + i, GRAY); }
  }
  /** Miệng hầm hàng có thành bao, đáy tối. */
  hatch(x0, x1, hw, dz = 0) {
    const y = this.deckY;
    this.boxc(x0, x1, hw, y + 1, y + 1, GRAY, dz);
    this.boxc(x0 + 1, x1 - 1, hw - 1, y, y + 1, BLACK, dz);
    this.boxc(x0 + 1, x1 - 1, hw - 1, y + 1, y + 1, 'air', dz);
  }
  crane(x, dz, h, sign = 1, reach = 5) { // cần cẩu: trụ và cần chéo
    const z = Math.round(this.cz + dz), y0 = this.deckY + 1;
    for (let y = y0; y < y0 + h; y++) this.set(x, y, z, GRAY);
    for (let i = 0; i <= reach; i++) this.set(x + sign * i, y0 + h - 1 - Math.floor(i / 2) + 0, z, 'iron_bars');
    this.set(x + sign * reach, y0 + h - 3 - Math.floor(reach / 2), z, 'oak_planks');
  }
  davitBoats(x0, x1, step, y) { for (let x = x0; x <= x1; x += step) { this.boat(x, y, 1); this.boat(x, y, this.W - 2); } }
  save(name) { this.b.save(name); }
}

// 01. LCVP (xuồng Higgins) 12x5: thành cao hai khối, cabin chỉ huy bên mạn phải, hai ổ súng, ramp mũi hạ.
{
  const s = new Ship({ L: 12, W: 5, D: 1, F: 2, H: 7, bow: 'blunt', minBow: 0.8, wl: 0.9, bul: 2, bowExt: 4 }).build();
  s.fill(11, 4, 0, 11, 5, 4, 'air'); s.fill(11, 3, 1, 11, 3, 3, 'air');
  s.fill(11, 3, 1, 11, 3, 3, DECK);
  s.cabin(1, 3, 0, 4, 5, 1, 'smooth_stone');
  s.set(6, 4, 1, 'stone_bricks'); s.set(6, 5, 1, 'blackstone'); s.set(7, 5, 1, 'iron_bars');
  s.set(6, 4, 3, 'stone_bricks'); s.set(6, 5, 3, 'blackstone'); s.set(7, 5, 3, 'iron_bars');
  s.ramp(12, 1, 1, 3, 4);
  s.set(5, 4, 0, 'red_concrete'); s.set(5, 4, 4, 'red_concrete');
  s.save('us_01_lcvp_higgins');
}

// 02. LCM-3 (xuồng Mike) 15x5: giếng hàng mở, cabin phía sau bên phải.
{
  const s = new Ship({ L: 15, W: 5, D: 1, F: 2, H: 7, bow: 'blunt', minBow: 0.8, wl: 0.9, bul: 2, bowExt: 4 }).build();
  s.fill(14, 4, 0, 14, 5, 4, 'air'); s.fill(14, 3, 1, 14, 3, 3, DECK);
  s.cabin(1, 3, 0, 4, 6, 1, 'smooth_stone');
  s.set(8, 4, 1, 'stone_bricks'); s.set(8, 5, 1, 'blackstone'); s.set(9, 5, 1, 'iron_bars');
  s.ramp(15, 1, 1, 3, 4);
  s.set(8, 4, 3, 'red_concrete'); s.set(11, 4, 3, 'red_concrete');
  s.save('us_02_lcm3_mike');
}

// 03. LCT Mk 6 36x10: boong phẳng chở xe tăng, ramp mũi rộng, nhà lái bên mạn phải phía sau.
{
  const s = new Ship({ L: 36, W: 10, D: 2, F: 2, H: 12, bow: 'blunt', minBow: 0.8, wl: 0.9, bul: 1, bowExt: 6 }).build();
  s.fill(35, 5, 0, 35, 5, 9, 'air');
  s.ramp(36, 1, 3, 4, 5);
  s.cabin(1, 6, 1, 5, 8, 3, 'smooth_stone');
  s.mast(3, 10, 2, 3, 1);
  s.tank(12, 5, 2); s.tank(17, 5, 2); s.tank(22, 5, 2); s.tank(14, 5, 6); s.tank(19, 5, 6);
  s.gun(8, 5, 8); s.gun(30, 5, 1);
  s.save('us_03_lct_mk6');
}

// 04. LCI(L) 48x8: thân mũi nhọn thấp, cầu nhỏ giữa, hai ramp lên xuống hai bên mũi, ổ súng.
{
  const s = new Ship({ L: 48, W: 8, D: 2, F: 3, H: 14, bow: 'pointed', minBow: 0.55, wl: 0.9, bul: 1, bowExt: 6 }).build();
  s.cabin(16, 22, 1, 6, 9, 0, 'smooth_stone');
  s.boxc(22, 24, 1, 6, 6, GRAY, 0);
  s.funnel(10, 12, 1, 6, 9);
  s.mast(19, 11, 3, 0, 2);
  s.gun(8, 6, 1); s.gun(8, 6, 6); s.gun(34, 6, 3); s.gun(40, 6, 4);
  s.ramp(46, 1, 0, 5, 4, 'spruce', -2); s.ramp(46, 1, 0, 5, 4, 'spruce', 2);
  s.set(30, 5, 2, 'barrel[facing=up,open=false]'); s.set(30, 5, 5, 'barrel[facing=up,open=false]');
  s.save('us_04_lci_l');
}

// 05. LCS(L)(3) / LCI(R) 48x8: thân LCI, tháp pháo và giàn rocket.
{
  const s = new Ship({ L: 48, W: 8, D: 2, F: 3, H: 14, bow: 'pointed', minBow: 0.5, wl: 0.9, bul: 1 }).build();
  s.cabin(16, 22, 1, 6, 9, 0, 'smooth_stone');
  s.funnel(10, 12, 1, 6, 9);
  s.mast(19, 11, 3, 0, 2);
  for (const [x, z] of [[8, 3], [36, 3], [43, 3]]) { s.fill(x, 6, z, x + 1, 6, z + 1, DGRAY); s.fill(x, 7, z, x + 1, 7, z + 1, 'smooth_stone'); s.set(x + 2, 7, z, 'iron_bars'); s.set(x + 2, 7, z + 1, 'iron_bars'); }
  for (const x of [26, 29, 32]) for (const z of [1, 5]) { s.fill(x, 6, z, x + 1, 6, z + 1, DGRAY); s.fill(x, 7, z, x + 1, 7, z + 1, 'iron_bars'); s.fill(x, 8, z, x + 1, 8, z + 1, 'iron_bars'); }
  s.save('us_05_lcs_rocket');
}

// 06. LSM 60x10: boong xe rộng, hai cánh cửa mũi mở, ramp, nhà lái cuối tàu.
{
  const s = new Ship({ L: 60, W: 10, D: 2, F: 3, H: 14, bow: 'blunt', minBow: 0.75, wl: 0.9, bul: 1, bowExt: 7 }).build();
  s.fill(59, 6, 0, 59, 6, 9, 'air');
  s.doors(60, 5, 7, 1, 8, 3);
  s.ramp(60, 1, 2, 5, 5);
  s.cabin(1, 12, 3, 6, 9, 0, 'smooth_stone');
  s.cabin(4, 9, 1, 11, 12, 0, 'smooth_stone');
  s.funnel(2, 4, 1, 14, 14, 0, 1);
  s.mast(7, 14, 3, 0, 2);
  s.gun(16, 6, 1); s.gun(16, 6, 8); s.gun(48, 6, 1); s.gun(48, 6, 8);
  s.truck(24, 6, 3); s.truck(30, 6, 3); s.tank(26, 6, 6); s.tank(34, 6, 5);
  s.save('us_06_lsm');
}

// 07. LST-1 80x14: thân hộp dài, hai cánh cửa mũi mở và ramp lớn, nhà lái và ống khói ở đuôi, xe tăng và xe tải trên boong.
{
  const s = new Ship({ L: 80, W: 14, D: 3, F: 4, H: 22, bow: 'blunt', minBow: 0.8, wl: 0.92, bul: 1, bowExt: 9 }).build();
  s.fill(79, 8, 0, 79, 8, 13, 'air'); s.fill(79, 7, 3, 79, 7, 10, DECK);
  s.doors(80, 8, 10, 2, 11, 4);
  s.ramp(80, 1, 3, 7, 6);
  s.cabin(2, 18, 4, 8, 11, 0, 'smooth_stone');
  s.cabin(5, 12, 2, 13, 15, 0, 'smooth_stone');
  s.funnel(14, 17, 1, 16, 18, 0, 2);
  s.mast(8, 16, 5, 0, 3);
  s.flag(9, 20, 6);
  for (const [x, z] of [[24, 1], [24, 12], [52, 1], [52, 12], [70, 1], [70, 12]]) { s.fill(x - 1, 8, z - 1, x + 1, 8, z + 1, GRAY); s.gun(x, 9, z); }
  s.tank(28, 8, 4); s.tank(33, 8, 4); s.tank(38, 8, 4); s.tank(30, 8, 8); s.tank(36, 8, 8);
  s.truck(45, 8, 4); s.truck(50, 8, 4); s.truck(56, 8, 8); s.truck(61, 8, 8); s.truck(46, 8, 8);
  s.save('us_07_lst');
}

// 08. LSD lớp Ashland 100x16: mũi nhọn, giếng ụ phía sau có cửa đuôi hạ làm ramp, cần cẩu, ống khói, xe lội nước trên boong.
{
  const s = new Ship({ L: 100, W: 16, D: 3, F: 5, H: 24, bow: 'pointed', minBow: 0.35, wl: 0.92, bul: 0, rail: true, sternExt: 10, tail: 0.95, portholes: 4 }).build();
  s.fill(0, 4, 3, 13, 7, 12, 'air');                       // giếng ụ sau cùng
  s.fill(0, 4, 3, 13, 4, 12, DECK);
  s.fill(0, 5, 2, 13, 8, 2, GRAY); s.fill(0, 5, 13, 13, 8, 13, GRAY);
  s.fill(0, 5, 3, 0, 5, 3, 'sea_lantern');
  s.ramp(-1, -1, 4, 4, 5, 'spruce');
  s.cabin(34, 56, 5, 9, 13, 0, 'smooth_stone');
  s.cabin(38, 50, 3, 15, 17, 0, 'smooth_stone');
  s.funnel(44, 49, 2, 18, 22, 0, 2);
  s.mast(40, 19, 6, 0, 3); s.flag(41, 24, 7);
  s.crane(22, 5, 9, -1, 6); s.crane(22, -5, 9, -1, 6); s.crane(72, 5, 9, 1, 6); s.crane(72, -5, 9, 1, 6);
  s.gun(8, 9, 2); s.gun(8, 9, 13); s.gun(88, 9, 7); s.gun(88, 9, 8);
  for (const x of [60, 66]) for (const z of [4, 10]) { s.fill(x, 9, z, x + 3, 9, z + 1, OLIVE); s.fill(x, 10, z, x + 3, 10, z + 1, 'smooth_sandstone'); }
  s.save('us_08_lsd_ashland');
}

// 09. DUKW 10x3: xe lội nước 6 bánh, thân hình thuyền, thùng hàng hở.
{
  const b = new Build(10, 5, 3);
  b.fill(0, 1, 0, 9, 2, 2, OLIVE); b.fill(0, 2, 1, 5, 2, 1, 'air'); b.fill(1, 1, 1, 5, 1, 1, DECK2);
  for (const x of [1, 4, 7]) { b.set(x, 0, 0, BLACK); b.set(x, 0, 2, BLACK); b.set(x, 1, 0, BLACK); b.set(x, 1, 2, BLACK); }
  b.fill(6, 3, 0, 8, 3, 2, OLIVE); b.fill(6, 3, 1, 8, 3, 1, 'light_blue_stained_glass');
  b.fill(9, 2, 0, 9, 2, 2, OLIVE); b.set(9, 1, 1, 'air');
  b.set(0, 3, 1, 'iron_bars'); b.set(2, 3, 1, 'iron_bars');
  b.save('us_09_dukw');
}

// 10. LVT-2 9x5: xe bò sát lội nước, bánh xích hai bên, khoang bộ binh hở, vòng súng.
{
  const b = new Build(9, 5, 5);
  b.fill(0, 0, 0, 8, 1, 0, BLACK); b.fill(0, 0, 4, 8, 1, 4, BLACK);
  b.fill(1, 1, 1, 8, 2, 3, OLIVE); b.fill(2, 2, 2, 6, 2, 2, 'air'); b.fill(2, 1, 2, 6, 1, 2, DECK2);
  b.set(0, 1, 1, OLIVE); b.set(0, 1, 2, OLIVE); b.set(0, 1, 3, OLIVE);
  b.fill(7, 3, 1, 8, 3, 3, OLIVE); b.set(8, 3, 2, 'light_blue_stained_glass');
  b.set(4, 3, 1, 'blackstone'); b.set(5, 3, 1, 'iron_bars'); b.set(4, 3, 3, 'blackstone'); b.set(5, 3, 3, 'iron_bars');
  b.save('us_10_lvt2');
}

// 11. APA lớp Bayfield 90x13: ống khói giữa, bốn cột cẩu, hai cửa hầm hàng, xuồng đổ bộ treo hai bên.
function transport(name, o) {
  const s = new Ship({ L: o.L ?? 90, W: 13, D: 4, F: 5, H: o.H ?? 28, bow: 'pointed', minBow: 0.2, wl: 0.9, rail: true, portholes: 4, tail: 0.85 }).build();
  const cx = o.cx ?? 45, y0 = s.deckY + 1;
  s.cabin(cx - 8, cx + 8, 3, y0, y0 + 3, 0, 'smooth_stone');
  s.cabin(cx - 5, cx + 5, 2, y0 + 5, y0 + 7, 0, 'smooth_stone');
  s.funnel(cx + 1, cx + 5, 1, y0 + 9, y0 + 14, 0, 2);
  s.mast(cx - 2, y0 + 9, 8, 0, 3);
  s.flag(cx - 1, y0 + 16, 1);
  for (const x of o.masts) { s.mast(x, y0, o.mh ?? 12, 0, 2); s.crane(x, 0, 0 + (o.mh ?? 12) - 1, 1, 5); s.crane(x, 0, 0 + (o.mh ?? 12) - 1, -1, 5); }
  for (const [a, b2] of o.hatches) s.hatch(a, b2, 2, 0);
  s.davitBoats(o.boats[0], o.boats[1], 6, y0);
  s.gun(5, y0, 6); s.gun(5, y0, 7); s.gun(82, y0, 6); s.gun(8, y0, 6);
  s.save(name);
}
transport('us_11_apa_bayfield', { masts: [22, 36, 56, 72], hatches: [[26, 33], [60, 67]], boats: [38, 56] });
transport('us_12_aka_andromeda', { masts: [20, 33, 58, 74], hatches: [[24, 31], [36, 42], [62, 69]], boats: [44, 56], mh: 14 });

// 13. APD 60x7: khu trục cải tạo, hai ống khói, xuồng treo hai bên.
{
  const s = new Ship({ L: 60, W: 7, D: 2, F: 3, H: 18, bow: 'pointed', minBow: 0.15, wl: 0.9, rail: true, tail: 0.8 }).build();
  const y0 = s.deckY + 1;
  s.cabin(34, 41, 1, y0, y0 + 2, 0, 'smooth_stone');
  s.funnel(22, 24, 1, y0, y0 + 5, 0, 2); s.funnel(28, 30, 1, y0, y0 + 5, 0, 2);
  s.mast(37, y0 + 4, 7, 0, 2); s.flag(38, y0 + 9, 0);
  s.boat(12, y0, 1); s.boat(12, y0, 5); s.boat(17, y0, 1); s.boat(17, y0, 5);
  s.gun(46, y0, 3); s.gun(6, y0, 3); s.gun(52, y0, 3);
  s.save('us_13_apd');
}

// 14. AGC lớp Mount McKinley 90x13: tàu chỉ huy, thượng tầng lớn nhiều ăng-ten.
{
  const s = new Ship({ L: 90, W: 13, D: 4, F: 5, H: 32, bow: 'pointed', minBow: 0.2, wl: 0.9, rail: true, portholes: 4, tail: 0.85 }).build();
  const y0 = s.deckY + 1, cx = 40;
  s.cabin(cx - 14, cx + 14, 4, y0, y0 + 3, 0, 'smooth_stone');
  s.cabin(cx - 10, cx + 10, 3, y0 + 5, y0 + 7, 0, 'smooth_stone');
  s.cabin(cx - 6, cx + 4, 2, y0 + 9, y0 + 11, 0, 'smooth_stone');
  s.funnel(cx + 6, cx + 10, 1, y0 + 9, y0 + 15, 0, 2);
  s.mast(cx - 3, y0 + 13, 9, 0, 4); s.mast(cx + 14, y0 + 6, 8, 3, 2); s.mast(cx + 14, y0 + 6, 8, -3, 2); s.mast(cx - 12, y0 + 6, 8, 0, 3);
  s.flag(cx - 2, y0 + 20, 1);
  s.boat(20, y0, 1); s.boat(26, y0, 1); s.boat(20, y0, 11); s.boat(26, y0, 11); s.boat(62, y0, 1); s.boat(62, y0, 11);
  s.gun(8, y0, 5); s.gun(8, y0, 7); s.gun(76, y0, 6); s.gun(14, y0, 6);
  s.save('us_14_agc_mckinley');
}

// 15. Tàu bệnh viện lớp Comfort 90x14: thân trắng vạch xanh, chữ thập đỏ lớn, ống khói trắng.
{
  const hull = (x, y, z) => ((y === 8 && false) ? GRAY : WHITE);
  const s = new Ship({ L: 90, W: 14, D: 4, F: 5, H: 28, bow: 'pointed', minBow: 0.2, wl: 0.9, rail: true, tail: 0.85, hullMat: (x, y) => (y === 6 ? 'lime_concrete' : WHITE), deckFn: (x, y, z) => (hash(x, y, z) % 9 === 0 ? DECK2 : DECK) }).build();
  const y0 = s.deckY + 1, cx = 44;
  for (const cc of [20, 62]) for (const z of [0, 1, 12, 13]) { /* chừa thành mạn */ }
  const cross = (x, side) => {                               // chữ thập đỏ dán lên mặt ngoài thân tàu
    let z = side < 0 ? 0 : s.W - 1; while (!s.inHull(x, 7, z)) z += side < 0 ? 1 : -1;
    for (let i = -2; i <= 2; i++) s.set(x + i, 7, z, 'red_concrete');
    for (const j of [-2, -1, 1, 2]) s.set(x, 7 + j, z, 'red_concrete');
  };
  for (const side of [-1, 1]) { cross(24, side); cross(60, side); }
  for (const [a, c] of [[cx - 12, cx + 12]]) { s.boxc(a, c, 4, y0, y0 + 3, WHITE, 0); }
  const win = (x0, x1, y, hw) => { for (let x = x0; x <= x1; x += 2) { s.set(x, y, Math.round(s.cz - hw), BLACK); s.set(x, y, Math.round(s.cz + hw), BLACK); } };
  win(cx - 11, cx + 11, y0 + 1, 4);
  s.boxc(cx - 8, cx + 8, 3, y0 + 4, y0 + 6, WHITE, 0); win(cx - 7, cx + 7, y0 + 5, 3);
  s.boxc(cx - 4, cx + 4, 2, y0 + 7, y0 + 9, WHITE, 0); win(cx - 3, cx + 3, y0 + 8, 2);
  s.boxc(cx - 4, cx - 3, 2, y0 + 10, y0 + 10, 'smooth_stone', 0);
  s.boxc(cx + 3, cx + 7, 1, y0 + 7, y0 + 12, WHITE, 0); s.boxc(cx + 3, cx + 7, 1, y0 + 12, y0 + 12, 'lime_concrete', 0); s.boxc(cx + 3, cx + 7, 1, y0 + 13, y0 + 13, BLACK, 0);
  for (const y of [y0 + 8, y0 + 9]) for (const z of [Math.round(s.cz) - 2, Math.round(s.cz), Math.round(s.cz) + 2]) s.set(cx, y, z, 'red_concrete');
  s.mast(cx - 1, y0 + 10, 8, 0, 3); s.flag(cx, y0 + 16, 1);
  for (const x of [14, 22, 66, 74]) { s.boat(x, y0, 1); s.boat(x, y0, 12); }
  s.save('us_15_tau_benh_vien');
}

// 16. Tàu Liberty 80x12: boong chứa hàng, nhà trung tâm, ống khói, cột cẩu.
{
  const s = new Ship({ L: 80, W: 12, D: 4, F: 4, H: 26, bow: 'pointed', minBow: 0.25, wl: 0.9, rail: true, portholes: 4, tail: 0.8, hullMat: (x, y, z) => (y === 7 ? 'black_concrete' : GRAY) }).build();
  const y0 = s.deckY + 1, cx = 40;
  s.cabin(cx - 5, cx + 5, 3, y0, y0 + 3, 0, 'smooth_stone');
  s.cabin(cx - 3, cx + 3, 2, y0 + 5, y0 + 7, 0, 'smooth_stone');
  s.funnel(cx + 5, cx + 8, 1, y0, y0 + 9, 0, 2);
  s.mast(cx - 1, y0 + 9, 6, 0, 3);
  for (const [x0, x1] of [[10, 17], [20, 26], [54, 61], [65, 71]]) s.hatch(x0, x1, 2, 0);
  for (const x of [8, 28, 52, 72]) { s.mast(x, y0, 9, 0, 2); s.crane(x, 0, 8, 1, 4); s.crane(x, 0, 8, -1, 4); }
  s.gun(4, y0, 5); s.gun(4, y0, 6); s.gun(70, y0, 5);
  s.save('us_16_liberty');
}

// 17-20. Tàu sân bay: boong cất hạ cánh phủ ván, vạch giữa, thang máy, đảo bên mạn phải, ổ pháo phòng không hai bên, máy bay đậu.
function carrier(name, o) {
  const s = new Ship({ L: o.L, W: o.W, D: o.D, F: o.F, H: o.H, bow: 'carrier', wl: 0.72, tail: 0.75, portholes: 5 }).build();
  const y = s.deckY, c = Math.round(s.cz);
  // vạch giữa nét đứt, thang máy
  for (let x = 4; x < o.L - 4; x++) if (x % 8 < 5) s.set(x, y, c, 'white_concrete');
  for (const x of o.elev) s.fill(x, y, c - 3, x + 4, y, c + 3, 'gray_concrete');
  for (const x of o.elev) s.fill(x + 1, y, c - 2, x + 3, y, c + 2, 'smooth_stone');
  // đảo chỉ huy bên mạn phải
  const iz = o.W - 1 - Math.round(o.island.w / 2) - 1, dz = iz - s.cz;
  s.boxc(o.island.x, o.island.x + o.island.l, Math.floor(o.island.w / 2), y + 1, y + 4, GRAY, dz);
  s.boxc(o.island.x + 2, o.island.x + o.island.l - 2, Math.floor(o.island.w / 2) - 0, y + 5, y + 7, GRAY, dz);
  s.boxc(o.island.x + 4, o.island.x + o.island.l - 4, Math.max(1, Math.floor(o.island.w / 2) - 1), y + 8, y + 9, GRAY, dz);
  for (let x = o.island.x + 2; x <= o.island.x + o.island.l - 2; x += 2) for (const yy of [y + 3, y + 6, y + 9]) { s.set(x, yy, Math.round(s.cz + dz - Math.floor(o.island.w / 2)), BLACK); s.set(x, yy, Math.round(s.cz + dz + Math.floor(o.island.w / 2)), BLACK); }
  if (o.funnel) s.funnel(o.island.x + 4, o.island.x + 4 + o.funnel, 1, y + 5, y + 12, dz, 2);
  s.mast(o.island.x + Math.floor(o.island.l / 2), y + 10, o.mast, dz, 3);
  s.flag(o.island.x + Math.floor(o.island.l / 2) + 1, y + 10 + o.mast - 2, Math.round(s.cz + dz));
  // ổ pháo phòng không dưới mép boong hai bên
  for (let x = 12; x < o.L - 12; x += 11) for (const side of [-1, 1]) {
    const z = Math.round(s.cz + side * (o.W / 2 - 1));
    const zz = side < 0 ? 0 : o.W - 1;
    s.set(x, y - 1, zz, DGRAY); s.set(x + 1, y - 1, zz, DGRAY); s.set(x, y, zz, BLACK); s.set(x + 1, y, zz, 'iron_bars');
  }
  // máy bay đậu
  for (const [x, z] of o.planes) s.plane(x, y + 1, Math.round(s.cz) + z);
  // hai ổ súng đuôi và mũi
  s.gun(3, y + 1, 2); s.gun(3, y + 1, o.W - 3);
  s.save(name);
}
carrier('us_17_cv_essex', { L: 140, W: 22, D: 4, F: 7, H: 30, elev: [34, 96], island: { x: 66, l: 14, w: 5 }, funnel: 5, mast: 12, planes: [[16, 4], [26, -4], [44, 5], [52, -5], [108, 5], [118, -4], [126, 3]] });
carrier('us_18_cv_yorktown', { L: 130, W: 22, D: 4, F: 7, H: 30, elev: [30, 90], island: { x: 60, l: 12, w: 5 }, funnel: 6, mast: 12, planes: [[14, 4], [24, -4], [40, 5], [100, 4], [110, -4], [118, 3]] });
carrier('us_19_cvl_independence', { L: 100, W: 17, D: 3, F: 6, H: 26, elev: [26, 66], island: { x: 46, l: 9, w: 3 }, funnel: 0, mast: 9, planes: [[12, 3], [20, -3], [76, 3], [84, -3]] });
carrier('us_20_cve_casablanca', { L: 90, W: 17, D: 3, F: 5, H: 24, elev: [24, 58], island: { x: 40, l: 8, w: 3 }, funnel: 0, mast: 8, planes: [[10, 3], [18, -3], [66, 3]] });
