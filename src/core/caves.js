// Hang động: hang tự sinh bằng nhiễu 3D trong vùng đã đánh dấu, hang đào tay (sàn + chiều cao) và cửa hang.
// Không phụ thuộc Node. Mặc định hang kín: chỉ thông lên mặt đất ở những ô đánh dấu "cửa hang".
import { MIN_Y } from './constants.js';

export const NO_CAVE = -32768;
export const CAVE_AUTO = 1, CAVE_OPEN = 2;          // các bit trong lớp caveMask
export const DEFAULT_CAVE = { seed: 12345, density: 5, size: 5 };
export const CAVE_ROOF = 6;                          // số khối đất đá tối thiểu giữa hang tự sinh và mặt đất
const STEP = 4;                                      // lấy mẫu nhiễu mỗi 4 khối rồi nội suy

function hash(x, y, z, s) {
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1) ^ s) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 2147483647.5 - 1;
}
const fade = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash(xi, yi, zi, s), hash(xi + 1, yi, zi, s), u), l(hash(xi, yi + 1, zi, s), hash(xi + 1, yi + 1, zi, s), u), v),
    l(l(hash(xi, yi, zi + 1, s), hash(xi + 1, yi, zi + 1, s), u), l(hash(xi, yi + 1, zi + 1, s), hash(xi + 1, yi + 1, zi + 1, s), u), v), w);
}
const fbm = (x, y, z, s) => (vnoise(x, y, z, s) + 0.5 * vnoise(x * 2.03, y * 2.03, z * 2.03, s + 77)) / 1.5;

/**
 * Tạo hàm đục hang cho từng chunk.
 * @param {object} t mô hình địa hình (cần size, caveMask, caveFloor, caveHeight, water, cave)
 * @param {(x:number,z:number)=>number} heightAt độ cao mặt đất (khối trên cùng)
 * @param {number} AIR chỉ số khối không khí trong bảng khối
 */
export function makeCarver(t, heightAt, AIR) {
  const { size, caveMask: mask, caveFloor: floor, caveHeight: tall, water } = t;
  const cfg = { ...DEFAULT_CAVE, ...(t.cave ?? {}) };
  const seed = cfg.seed | 0;
  const fT = (0.7 + 0.06 * cfg.density) / 30;       // tần số đường hầm: mật độ cao thì hầm dày hơn
  const rT = 0.055 + 0.011 * cfg.size, rT2 = rT * rT; // bán kính đường hầm (theo giá trị nhiễu)
  const fC = 1 / 46, thrC = 0.6 - 0.03 * cfg.density - 0.012 * cfg.size; // hang rộng ("phô mai")
  const yLo = MIN_Y + 6;
  const hasWater = (x, z) => { const w = water[z * size + x]; return w !== NO_CAVE && w > heightAt(x, z); };
  let used = false;
  for (let i = 0; i < mask.length && !used; i++) if (mask[i] || floor[i] !== NO_CAVE) used = true;

  /** Trần an toàn tại cột (x, z): thấp nhất trong vùng 5x5 quanh nó, để hang không thông ngang sang sông hồ hay sườn dốc. */
  function capAt(x, z) {
    let c = Infinity;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const xx = Math.min(size - 1, Math.max(0, x + dx)), zz = Math.min(size - 1, Math.max(0, z + dz));
      const h = heightAt(xx, zz); if (h < c) c = h;
    }
    return c;
  }

  let A = null, B = null, C = null, ny = 0, yTop = 0;
  function sampleLattice(cx, cz, maxH) {
    yTop = maxH; ny = Math.floor((yTop - yLo) / STEP) + 2;
    const n = 25 * ny;
    if (!A || A.length < n) { A = new Float32Array(n); B = new Float32Array(n); C = new Float32Array(n); }
    for (let j = 0; j < ny; j++) for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++) {
      const wx = cx * 16 + gx * STEP, wy = yLo + j * STEP, wz = cz * 16 + gz * STEP, k = (j * 5 + gz) * 5 + gx;
      A[k] = fbm(wx * fT, wy * fT * 2, wz * fT, seed);
      B[k] = fbm(wx * fT + 311.7, wy * fT * 2 + 97.3, wz * fT - 151.1, seed + 1013);
      C[k] = fbm(wx * fC, wy * fC * 2.2, wz * fC, seed + 4099);
    }
  }
  function field(F, lx, y, lz) {
    const fx = lx / STEP, fy = (y - yLo) / STEP, fz = lz / STEP;
    const x0 = fx | 0, y0 = fy | 0, z0 = fz | 0, u = fx - x0, v = fy - y0, w = fz - z0;
    const k = (y0 * 5 + z0) * 5 + x0;
    const a = F[k] + (F[k + 1] - F[k]) * u, b = F[k + 5] + (F[k + 6] - F[k + 5]) * u;
    const c = F[k + 25] + (F[k + 26] - F[k + 25]) * u, d = F[k + 30] + (F[k + 31] - F[k + 30]) * u;
    const lo = a + (b - a) * w, hi = c + (d - c) * w;
    return lo + (hi - lo) * v;
  }

  /** Đục hang trong một chunk. blocks: mảng khối của chunk; idx(x, y, z): vị trí trong mảng. */
  return function carve(cx, cz, blocks, idx) {
    if (!used) return;
    let any = false, auto = false, maxH = -Infinity;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = cx * 16 + x, wz = cz * 16 + z;
      if (wx < 0 || wz < 0 || wx >= size || wz >= size) continue;
      const i = wz * size + wx;
      if (mask[i] || floor[i] !== NO_CAVE) { any = true; if (mask[i] & CAVE_AUTO) auto = true; const h = heightAt(wx, wz); if (h > maxH) maxH = h; }
    }
    if (!any) return;
    if (auto) sampleLattice(cx, cz, maxH);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = cx * 16 + x, wz = cz * 16 + z;
      if (wx < 0 || wz < 0 || wx >= size || wz >= size) continue;
      const i = wz * size + wx, m = mask[i], fl = floor[i];
      if (!m && fl === NO_CAVE) continue;
      const h = heightAt(wx, wz);
      const open = (m & CAVE_OPEN) !== 0 && !hasWater(wx, wz);
      const cap = capAt(wx, wz);
      if (fl !== NO_CAVE) { // hang đào tay: từ trên sàn lên hết chiều cao, chừa 3 khối trần nếu không phải cửa hang
        const top = Math.min(fl + tall[i], open ? h : cap - 3);
        for (let y = Math.max(yLo, fl + 1); y <= top; y++) blocks[idx(x, y, z)] = AIR;
      }
      if (m & CAVE_AUTO) {
        const top = open ? h : cap - CAVE_ROOF;
        for (let y = yLo; y <= top; y++) {
          const a = field(A, x, y, z), b = field(B, x, y, z);
          if (a * a + b * b < rT2 || field(C, x, y, z) > thrC) blocks[idx(x, y, z)] = AIR;
        }
      }
      if (open) { // cửa hang: nếu bên dưới (trong 48 khối) có hang thì khoét thông từ mặt đất xuống tới đó
        for (let y = h; y >= Math.max(yLo, h - 48); y--) {
          if (blocks[idx(x, y, z)] !== AIR) continue;
          for (let yy = y; yy <= h + 1; yy++) blocks[idx(x, yy, z)] = AIR;
          break;
        }
      }
    }
  };
}
