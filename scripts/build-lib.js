// Thư viện dựng công trình .schem bằng code (dùng chung cho make-starter.js và make-ww2.js).
import fs from 'node:fs';
import path from 'node:path';
import { writeSchem } from '../src/core/schem.js';

export const cfg = { out: '' };
export const m = (n) => 'minecraft:' + n;

export class Build {
  constructor(w, h, l) { this.w = w; this.h = h; this.l = l; this.cells = new Map(); }
  set(x, y, z, state) {
    if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.h || z >= this.l) throw new Error(`Ngoài khung: ${x},${y},${z}`);
    this.cells.set(`${x},${y},${z}`, state.startsWith('minecraft:') ? state : m(state));
  }
  get(x, y, z) { return this.cells.get(`${x},${y},${z}`); }
  clear(x, y, z) { this.cells.set(`${x},${y},${z}`, m('air')); }
  fill(x0, y0, z0, x1, y1, z1, state) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      this.set(x, y, z, typeof state === 'function' ? state(x, y, z) : state);
    }
  }
  /** Bốn bức tường của một hộp (không có sàn, trần). */
  walls(x0, y0, z0, x1, y1, z1, state) {
    this.fill(x0, y0, z0, x1, y1, z0, state); this.fill(x0, y0, z1, x1, y1, z1, state);
    this.fill(x0, y0, z0, x0, y1, z1, state); this.fill(x1, y0, z0, x1, y1, z1, state);
  }
  /** Hàng rào, song sắt, kính tấm phải khai báo sẵn hướng nối vì game không tự nối khi nạp chunk. */
  connect() {
    const thin = /fence|_bars|glass_pane/, notFull = /fence|_bars|pane|slab|stairs|ladder|torch|lantern|door|carpet|water|chest|air$|leaves|barrel$/;
    const dirs = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
    for (const [key, st] of [...this.cells]) {
      const name = st.split('[')[0];
      if (!thin.test(name)) continue;
      const [x, y, z] = key.split(',').map(Number);
      const props = [];
      for (const [d, [dx, dz]] of Object.entries(dirs)) {
        const nb = this.get(x + dx, y, z + dz)?.split('[')[0];
        const link = nb !== undefined && (nb === name || (thin.test(nb) && /fence/.test(nb) === /fence/.test(name)) || !notFull.test(nb));
        props.push(`${d}=${link}`);
      }
      this.cells.set(key, `${name}[${props.sort().join(',')},waterlogged=false]`);
    }
  }
  save(file) {
    this.connect();
    const palette = [m('air')], index = new Map([[palette[0], 0]]);
    const data = new Uint16Array(this.w * this.h * this.l);
    for (const [key, st] of this.cells) {
      const [x, y, z] = key.split(',').map(Number);
      let i = index.get(st);
      if (i === undefined) { i = palette.length; palette.push(st); index.set(st, i); }
      data[(y * this.l + z) * this.w + x] = i;
    }
    fs.writeFileSync(path.join(cfg.out, file + '.schem'), writeSchem({ w: this.w, h: this.h, l: this.l, palette, data, blockEntities: [] }));
    console.log(`${file}: ${this.w} x ${this.h} x ${this.l}, ${palette.length} loại khối`);
  }
}

export const stairs = (wood, facing, half = 'bottom') => `${wood}_stairs[facing=${facing},half=${half},shape=straight,waterlogged=false]`;
export const slab = (mat, type = 'bottom') => `${mat}_slab[type=${type},waterlogged=false]`;
export const log = (wood, axis = 'y') => `${wood}_log[axis=${axis}]`;
export const ladder = (facing) => `ladder[facing=${facing},waterlogged=false]`;
export const hash = (x, y, z) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
/** Tường đá cũ: phần lớn gạch đá, lẫn ít gạch nứt, gạch rêu, đá cuội. */
export const oldStone = (x, y, z) => { const r = hash(x, y, z) % 20; return r < 13 ? 'stone_bricks' : r < 15 ? 'cracked_stone_bricks' : r < 17 ? 'mossy_stone_bricks' : 'cobblestone'; };

