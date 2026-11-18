// Cây và vật thể nhỏ (prop) đặt lên map: danh mục, bộ sinh khối theo hạt giống ngẫu nhiên, hỗn hợp rừng.
// Mỗi prop trên map chỉ là { k: khoá, x, z, s: hạt giống, sc: cỡ, v: dạng }; khối thật chỉ được sinh khi xuất world.
// Một khối sinh ra có dạng [dx, dy, dz, trạng thái, cờ]: dy = 0 là khối ngay trên mặt đất, dy = -1 là chính khối mặt đất.
// Cờ: 1 = chân (kéo dài xuống tới mặt đất khi nền dốc), 2 = mềm (chỉ đặt vào chỗ đang trống, như lá, hoa, cỏ).

export const PROP_GROUPS = ['Cây', 'Bụi, cỏ và hoa', 'Khoáng sản', 'Vật dụng và chiến trường'];

function rng(seed) {
  let a = (seed | 0) ^ 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Blocks {
  constructor() { this.m = new Map(); }
  key(x, y, z) { return x + ',' + y + ',' + z; }
  has(x, y, z) { return this.m.has(this.key(x, y, z)); }
  set(x, y, z, s, foot = false) { this.m.set(this.key(x, y, z), [x, y, z, s, foot ? 1 : 0]); }
  soft(x, y, z, s) { const k = this.key(x, y, z); if (!this.m.has(k)) this.m.set(k, [x, y, z, s, 2]); }
  out() { return [...this.m.values()]; }
}

const LOG = (t, axis = 'y') => `minecraft:${t}[axis=${axis}]`;
const LEAF = (t) => `minecraft:${t}[distance=1,persistent=true]`;
const AIR = 'minecraft:air';

/** Khối elip đặc làm tán lá: tâm (cx,cy,cz), bán kính rx,ry,rz; vài ô rìa bị khuyết cho tự nhiên. */
function blob(b, R, cx, cy, cz, rx, ry, rz, state, hole = 0.14, minY = -99) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    if (y < minY) continue;
    for (let z = Math.floor(cz - rz - 1); z <= Math.ceil(cz + rz + 1); z++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
        if (d <= 1 && !(d > 0.72 && R() < hole)) b.soft(x, y, z, state);
      }
    }
  }
}
const DIRS4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const pick = (R, arr) => arr[Math.floor(R() * arr.length) % arr.length];

// ---- Cây ----
function oak(b, R, sc) {
  const h = Math.max(3, Math.round((4 + R() * 3) * sc)), rx = Math.max(2, 2.5 * sc + R() * 0.6);
  blob(b, R, 0, h - 0.5, 0, rx, 2.1 * Math.max(0.8, sc), rx, LEAF('oak_leaves'));
  for (let y = 0; y < h; y++) b.set(0, y, 0, LOG('oak_log'), y === 0);
}
function fancyOak(b, R, sc) {
  const h = Math.max(7, Math.round((9 + R() * 4) * sc));
  blob(b, R, 0, h, 0, 3.8 * Math.max(0.8, sc), 3 * Math.max(0.8, sc), 3.8 * Math.max(0.8, sc), LEAF('oak_leaves'));
  const n = 3 + (R() < 0.5 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const [dx, dz] = DIRS4[(k + Math.floor(R() * 4)) % 4], y0 = Math.round(h * (0.45 + R() * 0.3)), len = 3 + Math.floor(R() * 2);
    let x = 0, z = 0, y = y0;
    for (let i = 0; i < len; i++) { x += dx; z += dz; if (i % 2) y++; b.set(x, y, z, LOG('oak_log', dx ? 'x' : 'z')); }
    blob(b, R, x, y + 0.5, z, 2.4, 1.8, 2.4, LEAF('oak_leaves'));
  }
  for (let y = 0; y < h; y++) b.set(0, y, 0, LOG('oak_log'), y === 0);
}
function birch(b, R, sc, tall) {
  const h = Math.max(4, Math.round((tall ? 9 + R() * 4 : 5 + R() * 3) * sc));
  blob(b, R, 0, h - 1, 0, 2.2 * Math.max(0.8, sc), (tall ? 3.2 : 2.4) * Math.max(0.8, sc), 2.2 * Math.max(0.8, sc), LEAF('birch_leaves'));
  for (let y = 0; y < h; y++) b.set(0, y, 0, LOG('birch_log'), y === 0);
}
function spruce(b, R, sc, o = {}) {
  const maxR = o.maxR ?? 3, step = o.step ?? 2;
  const h = Math.max(6, Math.round((o.h0 ?? 7) * sc + R() * (o.hv ?? 5) * sc));
  const leaf = LEAF('spruce_leaves');
  for (let i = 0, y = h + 1; y >= 2; i++, y--) {
    const base = Math.ceil(i / step), rad = Math.min(maxR, i > 0 && i % 2 === 0 ? Math.max(1, base - 1) : base);
    for (let z = -rad; z <= rad; z++) {
      for (let x = -rad; x <= rad; x++) if (x * x + z * z <= rad * rad + rad * 0.8) b.soft(x, y, z, leaf);
    }
  }
  for (let y = 0; y < h; y++) b.set(0, y, 0, LOG('spruce_log'), y === 0);
  if (o.snow) for (const [x, y, z, s] of b.out()) if (s === leaf && !b.has(x, y + 1, z)) b.soft(x, y + 1, z, 'minecraft:snow[layers=1]');
}
function darkOak(b, R, sc) {
  const h = Math.max(5, Math.round((5 + R() * 4) * sc));
  const c = 4.2 * Math.max(0.8, sc);
  blob(b, R, 0.5, h, 0.5, c, 2.3, c, LEAF('dark_oak_leaves'), 0.1);
  for (let y = 0; y < h; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) b.set(dx, y, dz, LOG('dark_oak_log'), y === 0);
}
function jungle(b, R, sc, mega) {
  if (!mega) {
    const h = Math.max(5, Math.round((5 + R() * 5) * sc));
    blob(b, R, 0, h - 0.5, 0, 2.8 * Math.max(0.8, sc), 2.3, 2.8 * Math.max(0.8, sc), LEAF('jungle_leaves'));
    for (let y = 0; y < h; y++) b.set(0, y, 0, LOG('jungle_log'), y === 0);
    for (const [dx, dz, f] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north'], [0, -1, 'south']]) {
      if (R() < 0.5) for (let y = h - 4; y < h - 1; y++) b.soft(dx, y, dz, `minecraft:vine[east=${f === 'east'},north=${f === 'north'},south=${f === 'south'},up=false,west=${f === 'west'}]`);
    }
    return;
  }
  const h = Math.max(14, Math.round((14 + R() * 10) * sc));
  blob(b, R, 0.5, h, 0.5, 5.2, 3, 5.2, LEAF('jungle_leaves'), 0.1);
  for (const [dx, dz] of [[3, 1], [-3, 0], [0, -3]]) blob(b, R, 0.5 + dx, h * 0.62, 0.5 + dz, 3, 2, 3, LEAF('jungle_leaves'));
  for (let y = 0; y < h; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) b.set(dx, y, dz, LOG('jungle_log'), y === 0);
}
function acacia(b, R, sc) {
  const [dx, dz] = pick(R, DIRS4), h1 = Math.max(3, Math.round((3 + R() * 2) * sc));
  let x = 0, y = 0, z = 0;
  for (; y < h1; y++) b.set(0, y, 0, LOG('acacia_log'), y === 0);
  const n = 2 + Math.floor(R() * 2);
  for (let i = 0; i < n; i++, y++) { x += dx; z += dz; b.set(x, y, z, LOG('acacia_log')); }
  blob(b, R, x, y, z, 3.4 * Math.max(0.8, sc), 1.1, 3.4 * Math.max(0.8, sc), LEAF('acacia_leaves'), 0.1);
  if (R() < 0.6) { // cành thứ hai ngược hướng
    let x2 = 0, z2 = 0, y2 = h1 - 1;
    for (let i = 0; i < 2; i++, y2++) { x2 -= dx; z2 -= dz; b.set(x2, y2, z2, LOG('acacia_log')); }
    blob(b, R, x2, y2, z2, 2.6, 1, 2.6, LEAF('acacia_leaves'));
  }
}
function cherry(b, R, sc) {
  const h = Math.max(5, Math.round((5 + R() * 3) * sc)), [dx, dz] = pick(R, DIRS4);
  let x = 0, z = 0;
  for (let y = 0; y < h; y++) { if (y === Math.floor(h / 2)) { x += dx; z += dz; } b.set(x, y, z, LOG('cherry_log'), y === 0); }
  blob(b, R, x, h, z, 4.2 * Math.max(0.8, sc), 2.6, 4.2 * Math.max(0.8, sc), LEAF('cherry_leaves'), 0.18);
}
function mangrove(b, R, sc) {
  const h = Math.max(5, Math.round((5 + R() * 3) * sc));
  blob(b, R, 0, h, 0, 3.4 * Math.max(0.8, sc), 2.2, 3.4 * Math.max(0.8, sc), LEAF('mangrove_leaves'));
  for (let y = 1; y < h; y++) b.set(0, y, 0, LOG('mangrove_log'));
  b.set(0, 0, 0, LOG('mangrove_log'), true);
  for (const [dx, dz] of DIRS4) if (R() < 0.75) { b.set(dx, 0, dz, 'minecraft:mangrove_roots[waterlogged=false]', true); if (R() < 0.6) b.set(dx, 1, dz, 'minecraft:mangrove_roots[waterlogged=false]'); }
}
function azalea(b, R, sc) {
  const h = Math.max(3, Math.round((3 + R()) * sc));
  b.set(0, -1, 0, 'minecraft:rooted_dirt');
  for (let y = 0; y < h; y++) b.set(0, y, 0, LOG('oak_log'));
  const a = 2.4 * Math.max(0.8, sc);
  blob(b, R, 0, h, 0, a, 1.8, a, LEAF('azalea_leaves'));
  for (const [x, y, z, s] of b.out()) if (s.includes('azalea_leaves') && R() < 0.35) b.set(x, y, z, LEAF('flowering_azalea_leaves'));
}
function deadTree(b, R, sc) {
  const h = Math.max(4, Math.round((4 + R() * 5) * sc));
  for (let y = 0; y < h; y++) b.set(0, y, 0, LOG('oak_log'), y === 0);
  const n = 2 + Math.floor(R() * 2);
  for (let k = 0; k < n; k++) {
    const [dx, dz] = pick(R, DIRS4);
    let x = 0, z = 0, y = Math.max(2, Math.floor(h * (0.4 + R() * 0.5)));
    for (let i = 0, len = 2 + Math.floor(R() * 2); i < len; i++) { x += dx; z += dz; if (i === 1) y++; b.set(x, y, z, LOG('oak_log', dx ? 'x' : 'z')); }
  }
}
function burnt(b, R, sc) {
  const h = Math.max(3, Math.round((3 + R() * 4) * sc));
  for (let y = 0; y < h; y++) b.set(0, y, 0, y > 0 && R() < 0.25 ? 'minecraft:coal_block' : LOG('dark_oak_log'), y === 0);
  if (R() < 0.7) { const [dx, dz] = pick(R, DIRS4); b.set(dx, Math.max(1, h - 2), dz, LOG('dark_oak_log', dx ? 'x' : 'z')); }
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (R() < 0.85) b.set(dx, -1, dz, R() < 0.5 ? 'minecraft:coarse_dirt' : 'minecraft:blackstone');
}
function palm(b, R, sc) {
  const h = Math.max(6, Math.round((7 + R() * 3) * sc)), [dx, dz] = pick(R, DIRS4), lean = 1 + Math.floor(R() * 2);
  let x = 0, z = 0;
  for (let y = 0; y < h; y++) {
    const off = Math.round((lean * y) / h);
    x = dx * off; z = dz * off;
    b.set(x, y, z, LOG('jungle_log'), y === 0);
  }
  const leaf = LEAF('jungle_leaves');
  b.soft(x, h, z, leaf);
  for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    for (let k = 1; k <= 3; k++) b.soft(x + fx * k, h - (k >= 3 ? 1 : 0), z + fz * k, leaf);
    b.soft(x + fx * 2, h + 1 - (R() < 0.5 ? 1 : 0), z + fz * 2, leaf);
  }
}
function cactus(b, R, sc) {
  b.set(0, -1, 0, 'minecraft:sand');
  for (let y = 0, h = Math.max(1, Math.round((1 + R() * 3) * sc)); y < h; y++) b.set(0, y, 0, 'minecraft:cactus[age=0]');
  if (R() < 0.4) b.soft(1, 0, 0, 'minecraft:dead_bush');
}
function bamboo(b, R, sc) {
  const n = 3 + Math.floor(R() * 4);
  for (let i = 0; i < n; i++) {
    const x = Math.round((R() - 0.5) * 3), z = Math.round((R() - 0.5) * 3), h = Math.max(5, Math.round((6 + R() * 6) * sc));
    for (let y = 0; y < h; y++) b.set(x, y, z, `minecraft:bamboo[age=${y >= h - 2 ? 1 : 0},leaves=${y >= h - 2 ? 'large' : y === h - 3 ? 'small' : 'none'},stage=0]`);
  }
}
function mushroomTree(b, R, sc, red) {
  const h = Math.max(3, Math.round((3 + R() * 2) * sc)), cap = red ? 'minecraft:red_mushroom_block' : 'minecraft:brown_mushroom_block';
  for (let y = 0; y < h; y++) b.set(0, y, 0, 'minecraft:mushroom_stem');
  const r = (red ? 3 : 4) * Math.max(0.8, sc);
  for (let y = h - 1; y <= h + 2; y++) {
    for (let z = -5; z <= 5; z++) for (let x = -5; x <= 5; x++) {
      const d = (x / r) ** 2 + ((y - (red ? h - 1 : h)) / (red ? 2.4 : 1.2)) ** 2 + (z / r) ** 2;
      if (d <= 1 && (y >= h || x * x + z * z > 1)) b.soft(x, y, z, cap);
    }
  }
}

// ---- Bụi, cỏ, hoa ----
const TALL = new Set(['sunflower', 'lilac', 'rose_bush', 'peony', 'tall_grass', 'large_fern']);
function plant(b, name, x, y, z) {
  if (TALL.has(name)) { b.soft(x, y, z, `minecraft:${name}[half=lower]`); b.soft(x, y + 1, z, `minecraft:${name}[half=upper]`); }
  else b.soft(x, y, z, name === 'sweet_berry_bush' ? 'minecraft:sweet_berry_bush[age=3]' : `minecraft:${name}`);
}
function scatter(b, R, n, rad, list) {
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * rad;
    plant(b, pick(R, list), Math.round(Math.cos(a) * d), 0, Math.round(Math.sin(a) * d));
  }
}
function bush(b, R, sc, leaf) {
  blob(b, R, 0, 0.7, 0, 1.7 * Math.max(0.8, sc), 1.4, 1.7 * Math.max(0.8, sc), LEAF(leaf), 0.1, 0);
  if (R() < 0.5) b.set(0, 0, 0, LOG('oak_log'));
}
const FLOWERS = ['dandelion', 'poppy', 'azure_bluet', 'oxeye_daisy', 'cornflower', 'allium', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'lily_of_the_valley'];

// ---- Khoáng sản ----
const ORE_COLORS = { coal: '#3b3b3b', iron: '#c9a98c', copper: '#c97b4e', gold: '#f2d24a', redstone: '#d6261c', lapis: '#2c4fb8', diamond: '#4fe0d6', emerald: '#2ec65a' };
function ore(b, R, sc, name, v) {
  const deep = v === 3, ore = `minecraft:${deep ? 'deepslate_' : ''}${name}_ore`, rock = deep ? 'minecraft:deepslate' : 'minecraft:stone';
  if (v === 0) { b.set(0, 0, 0, ore); return; }
  if (v === 1) { // cụm quặng nhỏ trên mặt đất
    for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 1, 0], [1, 0, 1]]) if (R() < 0.8) b.set(x, y, z, R() < 0.78 ? ore : rock);
    b.set(0, 0, 0, ore);
    return;
  }
  const r = Math.max(2, Math.round((2.4 + R() * 1.4) * sc)), hgt = Math.max(2, Math.round((2.2 + R() * 1.8) * sc));
  for (let y = 0; y < hgt; y++) {
    const rr = r * (1 - y / (hgt + 0.6));
    for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
      if (x * x + z * z <= rr * rr + 0.4 && R() > 0.07) b.set(x, y, z, R() < 0.3 ? ore : (R() < 0.12 ? (deep ? 'minecraft:tuff' : 'minecraft:andesite') : rock), y === 0);
    }
  }
  b.set(0, hgt - 1, 0, ore);
  if (r > 0) b.set(1, 0, 0, ore);
}
function metal(b, R, sc, name, v) {
  const s = `minecraft:${name}`;
  if (v === 0) { b.set(0, 0, 0, s); return; }
  if (v === 1) { b.set(0, 0, 0, s); b.set(0, 1, 0, s); return; }
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) b.set(x, 0, z, s);
  b.set(0, 1, 0, s); if (R() < 0.6) b.set(1, 1, 0, s);
}

// ---- Vật dụng và chiến trường ----
function boulder(b, R, sc, mix) {
  const rx = (1.6 + R() * 1.4) * Math.max(0.7, sc), ry = (0.9 + R() * 1.2) * Math.max(0.7, sc), rz = rx * (0.7 + R() * 0.5);
  for (let y = -1; y <= Math.ceil(ry); y++) for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
    const d = (x / rx) ** 2 + (Math.max(0, y) / ry) ** 2 + (z / rz) ** 2;
    if (d <= 1 && !(d > 0.8 && R() < 0.2)) b.set(x, y, z, pick(R, mix));
  }
}
function craterCell(b, R, rad, x, z, d) {
  const depth = Math.max(1, Math.round((1 - d * d) * (rad * 0.6)));
  for (let y = -depth; y <= -1; y++) b.set(x, y, z, AIR);
  b.set(x, -depth - 1, z, R() < 0.55 ? 'minecraft:coarse_dirt' : R() < 0.5 ? 'minecraft:blackstone' : 'minecraft:gravel');
}
function crater(b, R, sc) {
  const rad = Math.max(2.5, (3 + R() * 2) * sc);
  for (let z = -7; z <= 7; z++) for (let x = -7; x <= 7; x++) {
    const d = Math.hypot(x, z) / rad;
    if (d <= 1) craterCell(b, R, rad, x, z, d);
    else if (d <= 1.35 && R() < 0.8) b.set(x, -1, z, R() < 0.5 ? 'minecraft:coarse_dirt' : 'minecraft:blackstone');
    if (d > 0.82 && d <= 1.15 && R() < 0.6) b.set(x, 0, z, 'minecraft:coarse_dirt');
  }
}
function wellProp(b) {
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
    if (x || z) { b.set(x, 0, z, 'minecraft:stone_bricks'); b.set(x, -1, z, 'minecraft:stone_bricks'); }
    else { b.set(0, -1, 0, 'minecraft:water[level=0]'); b.set(0, -2, 0, 'minecraft:water[level=0]'); b.set(0, 0, 0, 'minecraft:water[level=0]'); }
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { b.set(x, 1, z, 'minecraft:oak_fence'); b.set(x, 2, z, 'minecraft:oak_fence'); }
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) b.set(x, 3, z, 'minecraft:oak_slab[type=bottom]');
}
function lamp(b, R, sc, hang) {
  for (let y = 0; y < 4; y++) b.set(0, y, 0, y === 0 ? 'minecraft:cobblestone_wall' : 'minecraft:oak_fence', y === 0);
  if (hang) { b.set(1, 3, 0, 'minecraft:oak_fence'); b.set(1, 2, 0, 'minecraft:lantern[hanging=true]'); } else b.set(0, 4, 0, 'minecraft:lantern[hanging=false]');
}
function flag(b, R, sc, v) {
  const col = ['red', 'blue', 'white', 'black', 'yellow', 'green'][v] ?? 'red';
  b.set(0, 0, 0, 'minecraft:cobblestone', true);
  for (let y = 1; y <= 7; y++) b.set(0, y, 0, 'minecraft:oak_fence');
  for (let k = 1; k <= 3; k++) { b.set(k, 7, 0, `minecraft:${col}_wool`); b.set(k, 6, 0, `minecraft:${col}_wool`); }
  b.set(1, 5, 0, `minecraft:${col}_wool`);
}
function scarecrow(b) {
  b.set(0, 0, 0, 'minecraft:oak_fence', true); b.set(0, 1, 0, 'minecraft:oak_fence'); b.set(0, 2, 0, 'minecraft:hay_block[axis=y]');
  b.set(0, 3, 0, 'minecraft:carved_pumpkin[facing=south]'); b.set(1, 2, 0, 'minecraft:oak_fence[east=false,north=false,south=false,west=true]'); b.set(-1, 2, 0, 'minecraft:oak_fence[east=true,north=false,south=false,west=false]');
}
function grave(b, R, sc, v) {
  const spots = v === 1 ? [[-2, 0], [0, 0], [2, 0]] : [[0, 0]];
  for (const [x, z] of spots) {
    b.set(x, -1, z, 'minecraft:coarse_dirt'); b.set(x, 0, z, 'minecraft:stone_brick_slab[type=bottom]'); b.set(x, 1, z, 'minecraft:polished_andesite');
    if (R() < 0.7) b.set(x, 2, z, 'minecraft:stone_brick_slab[type=bottom]');
    b.soft(x, 0, z + 1, R() < 0.5 ? 'minecraft:dead_bush' : 'minecraft:poppy');
  }
}
function wire(b, R, sc, v) {
  const len = Math.max(5, Math.round((5 + R() * 4) * sc)), alongX = v !== 1;
  for (let i = 0; i < len; i++) {
    const x = alongX ? i : 0, z = alongX ? 0 : i;
    if (i % 3 === 0) { b.set(x, 0, z, 'minecraft:oak_fence', true); b.set(x, 1, z, 'minecraft:oak_fence'); } else { b.soft(x, 0, z, 'minecraft:cobweb'); b.soft(x, 1, z, 'minecraft:cobweb'); }
  }
}
function sandbags(b, R, sc) {
  const n = Math.max(3, Math.round((3 + R() * 2) * sc));
  for (let i = 0; i < n; i++) b.set(i, 0, 0, 'minecraft:smooth_sandstone', true);
  for (let i = 1; i < n - 1; i++) b.set(i, 1, 0, 'minecraft:smooth_sandstone');
  if (n > 3) b.set(Math.floor(n / 2), 2, 0, 'minecraft:sandstone_slab[type=bottom]');
}
function dragonTeeth(b, R, sc) {
  const n = Math.max(2, Math.round(3 * sc));
  for (let i = 0; i < n; i++) {
    const x = i * 3;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) b.set(x + dx, 0, dz, 'minecraft:cobblestone', true);
    for (let dz = 0; dz <= 0; dz++) for (let dx = -0; dx <= 0; dx++) { b.set(x + dx, 1, dz, 'minecraft:cobblestone'); b.set(x + dx, 2, dz, 'minecraft:cobblestone_wall'); }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, 1, dz, 'minecraft:cobblestone');
  }
}
function hedgehog(b) {
  b.set(0, 1, 0, 'minecraft:iron_block');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.set(sx, 0, sz, 'minecraft:iron_bars', true); b.set(sx, 2, sz, 'minecraft:iron_bars'); }
  b.set(0, 0, 0, 'minecraft:iron_bars', true); b.set(0, 2, 0, 'minecraft:iron_bars');
  for (const [dx, dz] of DIRS4) b.set(dx, 1, dz, 'minecraft:iron_bars');
}
function spikes(b, R, sc) {
  const n = Math.max(3, Math.round(5 * sc));
  for (let i = 0; i < n; i++) {
    const x = Math.round((R() - 0.5) * 5), z = Math.round((R() - 0.5) * 5);
    b.set(x, 0, z, 'minecraft:dark_oak_fence', true); b.set(x, 1, z, 'minecraft:dark_oak_fence'); b.set(x, 2, z, 'minecraft:pointed_dripstone[thickness=tip,vertical_direction=up,waterlogged=false]');
  }
}
function tent(b, R, sc, v) {
  const col = ['white', 'red', 'green', 'brown', 'gray'][v] ?? 'white', len = Math.max(4, Math.round(4 * sc));
  for (let z = 0; z < len; z++) { b.set(-1, 0, z, `minecraft:${col}_wool`, true); b.set(1, 0, z, `minecraft:${col}_wool`, true); b.set(0, 1, z, `minecraft:${col}_wool`); }
  for (const x of [-1, 0, 1]) { b.set(x, 0, 0, `minecraft:${col}_wool`, true); b.set(x, 0, len - 1, `minecraft:${col}_wool`, true); }
  b.set(0, 0, 0, AIR); b.set(0, 0, 1, 'minecraft:white_carpet');
}
function logPile(b, R, sc, v) {
  const ax = v === 1 ? 'z' : 'x';
  for (const [y, n] of [[0, 4], [1, 3], [2, 2]]) for (let i = 0; i < n; i++) { const o = y * 0.5 + i; b.set(ax === 'x' ? Math.round(o) : 0, y, ax === 'z' ? Math.round(o) : 0, LOG(y % 2 ? 'spruce_log' : 'oak_log', ax), y === 0); }
}
function stump(b, R, sc) {
  b.set(0, 0, 0, LOG('oak_log'), true); if (R() < 0.5) b.set(0, 1, 0, LOG('oak_log'));
  b.soft(1, 0, 0, 'minecraft:brown_mushroom');
}
function fallenLog(b, R, sc) {
  const len = Math.max(3, Math.round((4 + R() * 3) * sc)), ax = R() < 0.5 ? 'x' : 'z';
  for (let i = 0; i < len; i++) b.set(ax === 'x' ? i : 0, 0, ax === 'z' ? i : 0, LOG('oak_log', ax), true);
  b.soft(ax === 'x' ? 1 : 0, 1, ax === 'z' ? 1 : 0, 'minecraft:brown_mushroom');
}
function hayRoll(b, R) {
  b.set(0, 0, 0, `minecraft:hay_block[axis=${pick(R, ['x', 'z', 'y'])}]`, true);
  if (R() < 0.5) b.set(0, 1, 0, 'minecraft:hay_block[axis=y]');
  if (R() < 0.5) b.set(1, 0, 0, 'minecraft:hay_block[axis=x]');
}
function hayPile(b) {
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) b.set(x, 0, z, 'minecraft:hay_block[axis=y]', true);
  b.set(0, 1, 0, 'minecraft:hay_block[axis=y]'); b.set(1, 1, 0, 'minecraft:hay_block[axis=x]');
}
function barrels(b, R, sc, pile) {
  if (!pile) { b.set(0, 0, 0, 'minecraft:barrel[facing=up,open=false]', true); if (R() < 0.5) b.set(0, 1, 0, 'minecraft:barrel[facing=up,open=false]'); return; }
  for (const [x, z] of [[0, 0], [1, 0], [0, 1], [1, 1]]) b.set(x, 0, z, 'minecraft:barrel[facing=up,open=false]', true);
  b.set(0, 1, 0, 'minecraft:barrel[facing=up,open=false]'); b.set(1, 1, 1, 'minecraft:barrel[facing=north,open=false]');
}
function campfire(b) {
  for (const [x, z] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) b.set(x, 0, z, 'minecraft:cobblestone', true);
  b.set(0, -1, 0, 'minecraft:coarse_dirt'); b.set(0, 0, 0, 'minecraft:campfire[facing=north,lit=true,signal_fire=false,waterlogged=false]');
}
const FIRE = 'minecraft:fire[age=0,east=false,north=false,south=false,up=false,west=false]';
function burning(b, R, sc, v) {
  b.set(0, -1, 0, 'minecraft:netherrack'); b.set(0, 0, 0, FIRE);
  if (v === 1) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
    const d = Math.hypot(x, z);
    if (d > 0 && d <= 2.3 && R() < 0.75) { b.set(x, 0, z, pick(R, ['minecraft:cracked_stone_bricks', 'minecraft:cobblestone', 'minecraft:blackstone', 'minecraft:gravel', 'minecraft:stone_brick_slab[type=bottom]']), true); if (R() < 0.3) b.set(x, -1, z, 'minecraft:netherrack'), b.soft(x, 0, z, FIRE); }
  }
}
function rubble(b, R, sc) {
  const r = Math.max(2, Math.round((2 + R() * 1.4) * sc));
  for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, z) / (r + 0.3);
    if (d > 1 || R() < 0.25) continue;
    const h = Math.round((1 - d) * 2 * R()) + 1;
    for (let y = 0; y < h; y++) b.set(x, y, z, pick(R, ['minecraft:stone_bricks', 'minecraft:cracked_stone_bricks', 'minecraft:cobblestone', 'minecraft:bricks', 'minecraft:gravel', 'minecraft:mossy_stone_bricks', 'minecraft:andesite']), y === 0);
  }
}
function brokenWall(b, R, sc) {
  const len = Math.max(4, Math.round((5 + R() * 4) * sc));
  for (let i = 0; i < len; i++) {
    const h = Math.max(0, Math.round(3 * Math.sin((i / (len - 1)) * Math.PI) * (0.5 + R() * 0.8)));
    for (let y = 0; y <= h; y++) b.set(i, y, 0, pick(R, ['minecraft:stone_bricks', 'minecraft:stone_bricks', 'minecraft:cracked_stone_bricks', 'minecraft:mossy_stone_bricks']), y === 0);
    if (R() < 0.35) b.soft(i, 0, 1, 'minecraft:cobblestone_slab[type=bottom]');
  }
}
function bench(b) { for (let x = -1; x <= 1; x++) b.set(x, 0, 0, 'minecraft:oak_stairs[facing=north,half=bottom,shape=straight]', true); }
function signpost(b, R) { b.set(0, 0, 0, 'minecraft:oak_fence', true); b.set(0, 1, 0, 'minecraft:oak_fence'); b.set(0, 2, 0, `minecraft:oak_sign[rotation=${Math.floor(R() * 16)},waterlogged=false]`); }
function snowMound(b, R, sc) {
  const r = Math.max(2, Math.round((2 + R() * 1.5) * sc));
  for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, z) / (r + 0.4);
    if (d > 1) continue;
    const h = Math.max(1, Math.round((1 - d * d) * 3));
    for (let y = 0; y < h - 1; y++) b.set(x, y, z, 'minecraft:snow_block', y === 0);
    b.set(x, h - 1, z, `minecraft:snow[layers=${Math.max(1, Math.round((1 - d) * 7))}]`);
  }
}

// ---- Danh mục ----
// draw: hình vẽ trong Editor. shape: round (tán tròn), cone (tán nón), palm, column, low (bụi thấp), dots (hoa), rock, block, flat (phẳng trên mặt đất), post.
export const PROP_CATALOG = [];
const add = (group, key, name, draw, gen, extra = {}) => PROP_CATALOG.push({ key, group, name, draw, gen, ...extra });
const D = (shape, c, t, h, r) => ({ shape, c, t, h, r });
const TRUNK = '#6b4a2a';

add(0, 'oak', 'Sồi', D('round', '#4c9a3c', TRUNK, 6, 3), (b, R, sc) => oak(b, R, sc));
add(0, 'fancy_oak', 'Sồi lớn', D('round', '#3f8a35', TRUNK, 11, 4.5), (b, R, sc) => fancyOak(b, R, sc));
add(0, 'birch', 'Bạch dương', D('round', '#78b05a', '#e6e0d0', 7, 2.4), (b, R, sc) => birch(b, R, sc, false));
add(0, 'tall_birch', 'Bạch dương cao', D('round', '#78b05a', '#e6e0d0', 12, 2.6), (b, R, sc) => birch(b, R, sc, true));
add(0, 'spruce', 'Vân sam', D('cone', '#2f6a47', '#5a3d22', 11, 3.4), (b, R, sc) => spruce(b, R, sc));
add(0, 'pine', 'Thông cao', D('cone', '#285c3c', '#5a3d22', 17, 3.2), (b, R, sc) => spruce(b, R, sc, { h0: 13, hv: 8, step: 3, maxR: 3 }));
add(0, 'spruce_snow', 'Vân sam phủ tuyết', D('cone', '#d8e4ee', '#5a3d22', 11, 3.4), (b, R, sc) => spruce(b, R, sc, { snow: true }));
add(0, 'dark_oak', 'Sồi đen', D('round', '#2d6a2c', '#3e2c1a', 8, 4.5), (b, R, sc) => darkOak(b, R, sc));
add(0, 'jungle', 'Cây rừng nhiệt đới', D('round', '#3aa02c', '#7a5a34', 9, 3), (b, R, sc) => jungle(b, R, sc, false));
add(0, 'mega_jungle', 'Cây rừng khổng lồ', D('round', '#2f9226', '#7a5a34', 22, 6), (b, R, sc) => jungle(b, R, sc, true));
add(0, 'acacia', 'Keo (xavan)', D('round', '#8a9a30', '#8a7a68', 7, 3.6), (b, R, sc) => acacia(b, R, sc));
add(0, 'cherry', 'Anh đào', D('round', '#f3b5cf', '#5a3a3a', 8, 4.4), (b, R, sc) => cherry(b, R, sc));
add(0, 'mangrove', 'Đước (ngập mặn)', D('round', '#5a8a3a', '#6a3a30', 8, 3.4), (b, R, sc) => mangrove(b, R, sc));
add(0, 'azalea_tree', 'Cây đỗ quyên', D('round', '#7ab34a', TRUNK, 4, 2.6), (b, R, sc) => azalea(b, R, sc));
add(0, 'palm', 'Cọ dừa', D('palm', '#3aa02c', '#8a6a3a', 10, 3.4), (b, R, sc) => palm(b, R, sc));
add(0, 'dead_tree', 'Cây chết (trụi lá)', D('column', '#000', '#7a6850', 8, 2), (b, R, sc) => deadTree(b, R, sc));
add(0, 'burnt_tree', 'Cây cháy (chiến trường)', D('column', '#000', '#2a2420', 6, 1), (b, R, sc) => burnt(b, R, sc));
add(0, 'cactus', 'Xương rồng', D('column', '#000', '#3e8a3a', 4, 1), (b, R, sc) => cactus(b, R, sc));
add(0, 'bamboo', 'Khóm tre trúc', D('column', '#000', '#6fae3a', 10, 2), (b, R, sc) => bamboo(b, R, sc));
add(0, 'red_mushroom', 'Nấm khổng lồ đỏ', D('round', '#c0332c', '#e8e0d0', 6, 3), (b, R, sc) => mushroomTree(b, R, sc, true));
add(0, 'brown_mushroom_tree', 'Nấm khổng lồ nâu', D('round', '#8a6a48', '#e8e0d0', 5, 4), (b, R, sc) => mushroomTree(b, R, sc, false));

add(1, 'bush', 'Bụi cây', D('low', '#4c9a3c', TRUNK, 2, 1.6), (b, R, sc) => bush(b, R, sc, 'oak_leaves'));
add(1, 'bush_spruce', 'Bụi thông', D('low', '#2f6a47', TRUNK, 2, 1.6), (b, R, sc) => bush(b, R, sc, 'spruce_leaves'));
add(1, 'bush_azalea', 'Bụi hoa đỗ quyên', D('low', '#c06fb0', TRUNK, 2, 1.6), (b, R, sc) => bush(b, R, sc, 'flowering_azalea_leaves'));
add(1, 'berry', 'Bụi dâu rừng', D('low', '#6aa050', TRUNK, 1, 1.2), (b, R) => scatter(b, R, 3, 1, ['sweet_berry_bush']));
add(1, 'dead_bush', 'Bụi chết', D('dots', '#8a6a3a', TRUNK, 1, 1), (b, R) => scatter(b, R, 3, 1, ['dead_bush']));
add(1, 'tall_grass', 'Cỏ cao', D('dots', '#6aa84a', TRUNK, 2, 2), (b, R) => scatter(b, R, 8, 2, ['grass', 'tall_grass', 'grass', 'fern']));
add(1, 'fern', 'Dương xỉ', D('dots', '#4c8a3a', TRUNK, 1, 2), (b, R) => scatter(b, R, 5, 2, ['fern', 'large_fern', 'fern']));
add(1, 'wildflowers', 'Cụm hoa dại', D('dots', '#e87aa0', TRUNK, 1, 2), (b, R) => scatter(b, R, 9, 2, FLOWERS));
add(1, 'tulips', 'Cụm tulip', D('dots', '#e8503a', TRUNK, 1, 2), (b, R) => scatter(b, R, 8, 2, ['red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip']));
add(1, 'sunflowers', 'Hoa hướng dương', D('dots', '#f2c82a', TRUNK, 2, 2), (b, R) => scatter(b, R, 6, 2, ['sunflower']));
add(1, 'lilac', 'Tử đinh hương', D('dots', '#b88ad6', TRUNK, 2, 1.6), (b, R) => scatter(b, R, 4, 1, ['lilac', 'peony', 'rose_bush']));
add(1, 'roses', 'Hoa hồng bụi', D('dots', '#c03030', TRUNK, 2, 1.6), (b, R) => scatter(b, R, 4, 1, ['rose_bush']));
add(1, 'mushrooms', 'Nấm nhỏ', D('dots', '#c0392b', TRUNK, 1, 1), (b, R) => scatter(b, R, 4, 1, ['red_mushroom', 'brown_mushroom']));
add(1, 'pumpkins', 'Bãi bí ngô', D('dots', '#e08a2a', TRUNK, 1, 2), (b, R) => { for (let i = 0; i < 5; i++) b.soft(Math.round((R() - 0.5) * 5), 0, Math.round((R() - 0.5) * 5), R() < 0.8 ? 'minecraft:pumpkin' : `minecraft:carved_pumpkin[facing=${pick(R, ['north', 'south', 'east', 'west'])}]`); });
add(1, 'melons', 'Bãi dưa hấu', D('dots', '#4aa04a', TRUNK, 1, 2), (b, R) => { for (let i = 0; i < 5; i++) b.soft(Math.round((R() - 0.5) * 5), 0, Math.round((R() - 0.5) * 5), 'minecraft:melon'); });

for (const [id, name] of [['coal', 'than'], ['iron', 'sắt'], ['copper', 'đồng'], ['gold', 'vàng'], ['redstone', 'redstone'], ['lapis', 'lapis'], ['diamond', 'kim cương'], ['emerald', 'ngọc lục bảo']]) {
  add(2, 'ore_' + id, `Quặng ${name}`, D('rock', ORE_COLORS[id], '#777', 3, 2), (b, R, sc, v) => ore(b, R, sc, id, v ?? 2), { variants: ['1 khối', 'Cụm nhỏ', 'Mỏm đá lớn', 'Mỏm đá sâu (deepslate)'], defV: 2 });
}
for (const [id, name, col] of [['iron_block', 'sắt', '#d8d8d8'], ['gold_block', 'vàng', '#f6d84a'], ['diamond_block', 'kim cương', '#58e6d8'], ['emerald_block', 'ngọc lục bảo', '#2ec65a'], ['lapis_block', 'lapis', '#2a4ab0'], ['redstone_block', 'redstone', '#c8201a'], ['coal_block', 'than', '#222'], ['copper_block', 'đồng', '#c87a4e'], ['netherite_block', 'netherite', '#3a3436'], ['raw_iron_block', 'sắt thô', '#c8a888'], ['raw_gold_block', 'vàng thô', '#e0b840'], ['raw_copper_block', 'đồng thô', '#b86a44'], ['amethyst_block', 'thạch anh tím', '#9a6ad0']]) {
  add(2, 'blk_' + id, `Khối ${name}`, D('block', col, '#777', 2, 1), (b, R, sc, v) => metal(b, R, sc, id, v ?? 0), { variants: ['1 khối', 'Chồng 2', 'Đống nhỏ'], defV: 0 });
}

add(3, 'boulder', 'Tảng đá', D('rock', '#8a8a88', '#777', 2, 2), (b, R, sc) => boulder(b, R, sc, ['minecraft:stone', 'minecraft:stone', 'minecraft:andesite', 'minecraft:cobblestone']));
add(3, 'boulder_moss', 'Tảng đá phủ rêu', D('rock', '#6c8a5c', '#777', 2, 2), (b, R, sc) => boulder(b, R, sc, ['minecraft:mossy_cobblestone', 'minecraft:cobblestone', 'minecraft:moss_block', 'minecraft:stone']));
add(3, 'boulder_sand', 'Tảng đá sa mạc', D('rock', '#d8c690', '#777', 2, 2), (b, R, sc) => boulder(b, R, sc, ['minecraft:sandstone', 'minecraft:sandstone', 'minecraft:smooth_sandstone', 'minecraft:red_sandstone']));
add(3, 'boulder_dark', 'Tảng đá đen', D('rock', '#3c3a40', '#777', 2, 2), (b, R, sc) => boulder(b, R, sc, ['minecraft:blackstone', 'minecraft:deepslate', 'minecraft:basalt', 'minecraft:tuff']));
add(3, 'boulder_ice', 'Tảng băng', D('rock', '#a8d0f0', '#777', 2, 2), (b, R, sc) => boulder(b, R, sc, ['minecraft:packed_ice', 'minecraft:packed_ice', 'minecraft:blue_ice', 'minecraft:snow_block']));
add(3, 'snow_mound', 'Đống tuyết', D('flat', '#eef3f8', '#777', 2, 3), (b, R, sc) => snowMound(b, R, sc));
add(3, 'crater', 'Hố bom (pháo kích)', D('flat', '#3a2e26', '#777', 1, 4), (b, R, sc) => crater(b, R, sc));
add(3, 'fire', 'Lửa cháy / đống đổ nát cháy', D('flat', '#f06a1a', '#777', 2, 2), (b, R, sc, v) => burning(b, R, sc, v ?? 0), { variants: ['Ngọn lửa đơn', 'Đống đổ nát đang cháy'], defV: 1 });
add(3, 'rubble', 'Đống gạch vụn', D('flat', '#8a7a70', '#777', 2, 3), (b, R, sc) => rubble(b, R, sc));
add(3, 'broken_wall', 'Mảng tường đổ nát', D('post', '#8a8a82', '#777', 3, 3), (b, R, sc) => brokenWall(b, R, sc));
add(3, 'sandbags', 'Cụm bao cát', D('post', '#d8ca98', '#777', 2, 2), (b, R, sc) => sandbags(b, R, sc));
add(3, 'wire', 'Hàng rào dây thép gai', D('post', '#b0b0b0', '#6b4a2a', 2, 3), (b, R, sc, v) => wire(b, R, sc, v ?? 0), { variants: ['Chạy ngang (hướng x)', 'Chạy dọc (hướng z)'], defV: 0 });
add(3, 'dragon_teeth', 'Răng rồng chống tăng', D('post', '#7a7a7a', '#777', 3, 3), (b, R, sc) => dragonTeeth(b, R, sc));
add(3, 'hedgehog', 'Nhím thép chống tăng', D('post', '#9aa0a8', '#777', 3, 1.5), (b) => hedgehog(b));
add(3, 'spikes', 'Bãi chông gỗ', D('post', '#5a3a22', '#777', 3, 2), (b, R, sc) => spikes(b, R, sc));
add(3, 'tent', 'Lều vải', D('post', '#e8e8e8', '#777', 2, 2), (b, R, sc, v) => tent(b, R, sc, v ?? 0), { variants: ['Trắng', 'Đỏ', 'Xanh lá', 'Nâu', 'Xám'], defV: 0 });
add(3, 'campfire', 'Lửa trại', D('flat', '#e0782a', '#777', 2, 1.5), (b) => campfire(b));
add(3, 'well', 'Giếng nước', D('post', '#8a8a88', '#6b4a2a', 4, 1.6), (b) => wellProp(b));
add(3, 'lamp', 'Cột đèn', D('post', '#f2d060', '#6b4a2a', 5, 0.6), (b, R, sc) => lamp(b, R, sc, false));
add(3, 'lamp_hang', 'Cột đèn treo', D('post', '#f2d060', '#6b4a2a', 4, 1), (b, R, sc) => lamp(b, R, sc, true));
add(3, 'flagpole', 'Cột cờ', D('post', '#c0302c', '#6b4a2a', 8, 2), (b, R, sc, v) => flag(b, R, sc, v ?? 0), { variants: ['Đỏ', 'Xanh dương', 'Trắng', 'Đen', 'Vàng', 'Xanh lá'], defV: 0 });
add(3, 'signpost', 'Biển chỉ đường', D('post', '#b08a50', '#6b4a2a', 3, 0.8), (b, R) => signpost(b, R));
add(3, 'scarecrow', 'Bù nhìn', D('post', '#e0a030', '#6b4a2a', 4, 1), (b) => scarecrow(b));
add(3, 'bench', 'Ghế dài', D('post', '#a07a44', '#6b4a2a', 1, 1.6), (b) => bench(b));
add(3, 'grave', 'Mộ chí', D('post', '#9a9a98', '#777', 2, 1), (b, R, sc, v) => grave(b, R, sc, v ?? 0), { variants: ['1 mộ', 'Cụm 3 mộ'], defV: 0 });
add(3, 'hay_roll', 'Cuộn rơm', D('block', '#d8b840', '#777', 2, 1), (b, R) => hayRoll(b, R));
add(3, 'hay_pile', 'Đống rơm', D('block', '#d8b840', '#777', 2, 2), (b) => hayPile(b));
add(3, 'barrel', 'Thùng gỗ', D('block', '#8a6a3a', '#777', 2, 1), (b, R, sc) => barrels(b, R, sc, false));
add(3, 'barrels', 'Chồng thùng gỗ', D('block', '#8a6a3a', '#777', 2, 2), (b, R, sc) => barrels(b, R, sc, true));
add(3, 'log_pile', 'Đống gỗ', D('block', '#7a5a34', '#777', 3, 2), (b, R, sc, v) => logPile(b, R, sc, v ?? 0), { variants: ['Nằm ngang (x)', 'Nằm dọc (z)'], defV: 0 });
add(3, 'stump', 'Gốc cây', D('block', '#7a5a34', '#777', 1, 1), (b, R, sc) => stump(b, R, sc));
add(3, 'fallen_log', 'Thân cây đổ', D('post', '#7a5a34', '#777', 1, 3), (b, R, sc) => fallenLog(b, R, sc));

export const PROP_BY_KEY = Object.fromEntries(PROP_CATALOG.map((d) => [d.key, d]));

/** Hỗn hợp để vẽ rừng: [khoá, trọng số]. */
export const PROP_MIXES = [
  { key: 'forest', name: 'Rừng sồi + bạch dương', items: [['oak', 5], ['birch', 3], ['fancy_oak', 1], ['bush', 2], ['tall_grass', 2], ['wildflowers', 1]] },
  { key: 'taiga', name: 'Rừng thông (taiga)', items: [['spruce', 6], ['pine', 2], ['bush_spruce', 1], ['fern', 2], ['boulder_moss', 0.3]] },
  { key: 'snow', name: 'Rừng thông tuyết', items: [['spruce_snow', 6], ['spruce', 1], ['snow_mound', 1], ['boulder_ice', 0.3]] },
  { key: 'jungle', name: 'Rừng nhiệt đới', items: [['jungle', 5], ['mega_jungle', 1], ['bamboo', 1.5], ['fern', 2], ['bush', 2]] },
  { key: 'savanna', name: 'Xavan', items: [['acacia', 3], ['tall_grass', 6], ['dead_bush', 1], ['boulder_sand', 0.3]] },
  { key: 'dark', name: 'Rừng sồi đen', items: [['dark_oak', 6], ['red_mushroom', 0.5], ['brown_mushroom_tree', 0.5], ['mushrooms', 1.5], ['fern', 1]] },
  { key: 'cherry', name: 'Rừng anh đào', items: [['cherry', 5], ['wildflowers', 2], ['tulips', 1], ['bush_azalea', 1]] },
  { key: 'desert', name: 'Sa mạc', items: [['cactus', 4], ['dead_bush', 3], ['boulder_sand', 0.7], ['palm', 0.4]] },
  { key: 'swamp', name: 'Đầm lầy', items: [['mangrove', 3], ['oak', 2], ['fern', 2], ['mushrooms', 1], ['tall_grass', 2]] },
  { key: 'dead', name: 'Rừng chết / bị đốt cháy', items: [['burnt_tree', 5], ['dead_tree', 3], ['dead_bush', 1], ['rubble', 0.2], ['crater', 0.15], ['fire', 0.1]] },
  { key: 'meadow', name: 'Đồng cỏ hoa', items: [['wildflowers', 5], ['tall_grass', 5], ['tulips', 1], ['sunflowers', 1], ['bush', 0.5], ['oak', 0.3], ['birch', 0.3]] },
  { key: 'battlefield', name: 'Chiến trường (hố bom, vụn, rào)', items: [['crater', 3], ['rubble', 1.5], ['burnt_tree', 2], ['sandbags', 1], ['wire', 1], ['dragon_teeth', 0.5], ['fire', 0.3], ['boulder', 0.5]] },
];

export const PROP_SIZES = [
  { key: 'rand', name: 'Ngẫu nhiên' },
  { key: 'small', name: 'Nhỏ', lo: 0.65, hi: 0.85 },
  { key: 'mid', name: 'Vừa', lo: 0.95, hi: 1.1 },
  { key: 'big', name: 'Lớn', lo: 1.25, hi: 1.6 },
];

/** Tạo một prop. size: khoá trong PROP_SIZES. */
export function makeProp(key, x, z, { size = 'rand', v, seed } = {}) {
  const d = PROP_BY_KEY[key];
  if (!d) throw new Error('Không có loại cây/vật thể: ' + key);
  const s = seed ?? ((Math.random() * 0x7fffffff) | 0);
  const R = rng(s ^ 0x51ed);
  const z0 = PROP_SIZES.find((e) => e.key === size);
  const sc = z0 && z0.lo ? z0.lo + R() * (z0.hi - z0.lo) : 0.7 + R() * 0.7;
  const p = { k: key, x, z, s, sc: Math.round(sc * 100) / 100 };
  if (d.variants) p.v = v ?? d.defV ?? 0;
  return p;
}

/** Sinh danh sách khối của prop: [dx, dy, dz, trạng thái, cờ]. */
export function propBlocks(p) {
  const d = PROP_BY_KEY[p.k];
  if (!d) return [];
  const R = rng(p.s | 0), b = new Blocks();
  d.gen(b, R, p.sc ?? 1, p.v);
  return b.out();
}

/** Chọn ngẫu nhiên một khoá theo trọng số trong một hỗn hợp. */
export function pickFromMix(mix, rand = Math.random) {
  const total = mix.items.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [k, w] of mix.items) { r -= w; if (r <= 0) return k; }
  return mix.items[0][0];
}
