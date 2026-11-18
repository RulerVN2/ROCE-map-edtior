// Khung nhìn nghiêng kiểu AoE2 (hình thoi 2:1), vẽ bằng phần mềm lên ImageData.
import { DECO, heightAt, materialAt, grassColorAt, MATERIALS, MAT, WATER_COLOR, NO_WATER, NO_CAVE, BLOCK_PALETTE } from '../../core/terrain.js';
import { PROP_BY_KEY, propBlocks } from '../../core/props.js';
import { modelFor, modelTextures, buildFaces, armorOf, armorLayers, heldOf, horseArmorLayer } from '../../core/mobmodels.js';
import { blockColor, parseState, shapeOf, SHAPE } from '../../core/structure.js';
import { mobStyle, mobGroups, mobGroupKey } from '../../core/mobs.js';
import { BUILDING_PREFIX, footprintRect, rotOf } from '../../core/scenario.js';

const ZOOMS = [0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24];
const REF_H = 64;
const rgba = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const BG = rgba(24, 27, 33);
const VOID_L = rgba(40, 34, 30), VOID_R = rgba(28, 24, 22); // lòng công trình nhìn qua cửa, cửa sổ
const groundTop = (t, wat, n, x, z) => { const g = heightAt(t, x, z), w = wat[Math.min(n - 1, z) * n + Math.min(n - 1, x)]; return w !== NO_WATER && w > g ? w : g; };
/** Ghi một điểm ảnh của công trình. Công trình sắp đặt (ghost) pha 78% lên nền, hơi ngả xanh, và không đụng vào pick. */
function put(px, pick, o, c, cell, ghost) {
  if (!ghost) { px[o] = c; if (cell !== -2) pick[o] = cell; return; } // cell = -2: chỉ vẽ, không đè bảng dò ô (cây, vật thể)
  const d = px[o], a = 0.78;
  const r = (d & 255) + (((c & 255) * 0.85 + 90 * 0.15) - (d & 255)) * a;
  const g = ((d >> 8) & 255) + ((((c >> 8) & 255) * 0.85 + 170 * 0.15) - ((d >> 8) & 255)) * a;
  const b = ((d >> 16) & 255) + ((((c >> 16) & 255) * 0.85 + 255 * 0.15) - ((d >> 16) & 255)) * a;
  px[o] = (255 << 24) | (b << 16) | (g << 8) | r;
}
const darker = (c) => (c & 0xff000000) | ((((c >> 16) & 255) * 0.8) << 16) | ((((c >> 8) & 255) * 0.8) << 8) | (((c & 255) * 0.8) | 0);

const NO_STRUCT = -32768;
const mulPx = (c, f) => { const r = (c & 255) * f, g = ((c >> 8) & 255) * f, b = ((c >> 16) & 255) * f; return rgba(r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0); };
const TEX_MIN_S = 5; // từ cỡ này (nửa bề rộng một ô, điểm ảnh) trở lên mới đủ chỗ để thấy hoa văn
function topAt(t, wat, sTop, n, x, z) {
  let g = heightAt(t, x, z);
  const i = Math.min(n - 1, z) * n + Math.min(n - 1, x);
  const w = wat[i];
  if (w !== NO_WATER && w > g) g = w;
  return sTop[i] > g ? sTop[i] : g;
}

export class IsoView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.zoomIdx = 5;
    this.camX = 0; this.camZ = 0; // ô map nằm giữa màn hình (ở độ cao tham chiếu)
    this.terrain = null;
    this.brush = null; // { x, z, radius }
    this.ghost = null; // { x0, z0, x1, z1, x, y, z, map }: công trình sắp đặt (vẽ mờ đúng hình dạng)
    this.border = null;     // { x0, z0, x1, z1 }: khung world border cần vẽ
    this.borderEdit = false; // true khi đang dùng công cụ World border (hiện thêm các tay nắm)
    this.line = null;  // { a, b, radius, erase }: đoạn đường thẳng sắp đặt
    this.hi = null;    // { x0, z0, x1, z1 }: khung công trình đang được chỉ vào (viền vàng)
    this.hiGroup = null; // khoá nhóm mob đang được chỉ vào
    this.showNames = true;
    this.showContours = true; // đường đồng mức mỗi 5 khối
    this.showGrid = true;     // viền từng khối khi phóng to
    this.showCaves = false;   // tô màu vùng hang: tím = hang tự sinh, cam = hang đào tay, vàng = cửa hang
    this.items = []; this.structIdx = new Uint16Array(0);
    this.mobScreen = [];
    this.spawn = null; // { x, z }: vẽ cờ điểm xuất hiện
    this.mobs = [];    // mob đã đặt (tham chiếu terrain.mobs)
    this.props = [];   // cây và vật thể đã đặt (tham chiếu terrain.props)
    this.propGhost = null; // { k, x, z, sc }: cây sắp đặt, vẽ mờ theo con trỏ
    this.mobGhost = null; // { points: [{x,z}], yaw }: mob sắp đặt, vẽ mờ theo con trỏ
    this.structTop = new Int16Array(0);
    this.showBorder = true;
    this.tx = null; this.useTex = false; this._matTex = null; // texture thật của Minecraft (xem textures.js)
    this.resize();
  }
  get scale() { return ZOOMS[this.zoomIdx]; }
  setTerrain(t) {
    this.terrain = t; this.camX = t.size / 2; this.camZ = t.size / 2;
    this.structTop = new Int16Array(t.size * t.size).fill(NO_STRUCT);
    this.structIdx = new Uint16Array(t.size * t.size);
    this.items = [];
  }
  /** Vẽ lại lớp xem trước công trình. items: [{ x, y, z, map: buildTopMap(), name }] theo thứ tự đặt. */
  setStructures(items) {
    const n = this.terrain.size, top = this.structTop, idx = this.structIdx;
    top.fill(NO_STRUCT); idx.fill(0);
    this.items = items;
    items.forEach(({ x, y, z, map }, k) => {
      for (let lz = 0; lz < map.l; lz++) {
        const wz = z + lz; if (wz < 0 || wz >= n) continue;
        for (let lx = 0; lx < map.w; lx++) {
          const wx = x + lx; if (wx < 0 || wx >= n) continue;
          const ty = map.tops[lz * map.w + lx];
          if (ty < 0) continue;
          top[wz * n + wx] = y + ty; idx[wz * n + wx] = k + 1;
        }
      }
    });
  }
  /** Chỉ số (trong items) của công trình phủ lên ô (x, z), hoặc -1. */
  structAt(x, z) {
    const n = this.terrain.size;
    return x < 0 || z < 0 || x >= n || z >= n ? -1 : this.structIdx[z * n + x] - 1;
  }
  /** Mob gần điểm ảnh (sx, sy) nhất trong tầm bấm, hoặc null. Dựa trên lần vẽ gần nhất. */
  mobAt(sx, sy) {
    let best = null, bd = Infinity;
    for (const q of this.mobScreen) {
      const d = Math.hypot(q.px - sx, q.py - sy);
      if (d < q.r + 5 && d < bd) { bd = d; best = q; }
    }
    return best;
  }
  resize() {
    const w = Math.max(64, this.canvas.clientWidth | 0), h = Math.max(64, this.canvas.clientHeight | 0);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.W = w; this.H = h;
    this.image = this.ctx.createImageData(w, h);
    this.px = new Uint32Array(this.image.data.buffer);
    this.pick = new Int32Array(w * h);
  }
  zoom(dir, sx, sy) {
    const before = this.screenToMapFlat(sx, sy);
    this.zoomIdx = Math.min(ZOOMS.length - 1, Math.max(0, this.zoomIdx + dir));
    const after = this.screenToMapFlat(sx, sy);
    this.camX += before.x - after.x; this.camZ += before.z - after.z; // giữ nguyên điểm dưới con trỏ
    this.clampCam();
  }
  panPixels(dx, dy) {
    const s = this.scale;
    const du = -dx / s, dv = -dy / (s * 0.5);
    this.camX += (dv + du) / 2; this.camZ += (dv - du) / 2;
    this.clampCam();
  }
  clampCam() {
    const n = this.terrain.size;
    this.camX = Math.min(n, Math.max(0, this.camX));
    this.camZ = Math.min(n, Math.max(0, this.camZ));
  }
  /** Màn hình -> toạ độ map, giả sử mặt đất ở độ cao tham chiếu (chỉ dùng cho zoom/pan). */
  screenToMapFlat(sx, sy) {
    const s = this.scale;
    const u = (sx - this.W / 2) / s, v = (sy - this.H / 2) / (s * 0.5);
    return { x: this.camX + (v + u) / 2, z: this.camZ + (v - u) / 2 };
  }
  /** Ô map nằm dưới điểm ảnh (đúng theo địa hình đã vẽ), hoặc null. */
  cellAt(sx, sy) {
    if (sx < 0 || sy < 0 || sx >= this.W || sy >= this.H) return null;
    const i = this.pick[(sy | 0) * this.W + (sx | 0)];
    if (i < 0) return null;
    const n = this.terrain.size;
    return { x: i % n, z: (i / n) | 0 };
  }

  /** Bản texture đang dùng được không (đã có jar, người dùng bật, và đang phóng đủ lớn). */
  texOn(S) { return !!(this.tx && this.tx.available && this.useTex && S >= TEX_MIN_S); }
  /** Texture của từng vật liệu mặt đất: { top, cap, under } (bản texture hoặc null). */
  matTextures() {
    if (this._matTex && this._matTex.ver === this.tx.version) return this._matTex.arr;
    const arr = MATERIALS.map((m) => {
      if (!m) return null;
      const top = this.tx.block(BLOCK_PALETTE[m.top]?.Name), under = this.tx.block(BLOCK_PALETTE[m.under]?.Name);
      return { top: top?.top ?? null, cap: top?.side ?? null, under: under?.side ?? null };
    });
    this._matTex = { ver: this.tx.version, arr };
    return arr;
  }
  /** Texture của từng khối trong bảng khối của một công trình (bộ nhớ đệm theo phiên bản texture). */
  blockTextures(map) {
    if (map._tx && map._tx.ver === this.tx.version) return map._tx.arr;
    const arr = map.pal.map((n) => this.tx.block(n) ?? null);
    map._tx = { ver: this.tx.version, arr };
    return arr;
  }

  render() {
    const t = this.terrain; if (!t) return;
    const { W, H, px, pick } = this;
    px.fill(BG); pick.fill(-1);
    const n = t.size, s = this.scale, hts = t.heights, wat = t.water, sTop = this.structTop, sIdx = this.structIdx, items = this.items;
    const gh = this.ghost, hi = this.hi;
    const step = s < 1 ? Math.round(1 / s) : 1;
    const S = s * step;          // nửa bề rộng một ô trên màn hình
    const halfH = S / 2;         // nửa chiều cao hình thoi
    const ox = W / 2 - (this.camX - this.camZ) * s;
    const oy = H / 2 - (this.camX + this.camZ) * s * 0.5 + REF_H * s;
    const br = this.brush;
    const grid = this.showGrid && s >= 8;
    let tall = gh && gh.map ? gh.map.h + 60 : 0; // công trình cao có thể ló lên từ ô nằm dưới mép màn hình
    for (const it of items) if (it.map.h > tall) tall = it.map.h;
    const caves = this.showCaves;
    const ln = this.line;
    const useTex = this.texOn(S), matTex = useTex ? this.matTextures() : null;
    const waterRec = useTex ? this.tx.block('minecraft:water') : null, waterTex = waterRec ? { top: waterRec.top, cap: null, under: null } : null;
    let lx0 = 0, lz0 = 0, ldx = 0, ldz = 0, lLen2 = 1, lR = 0;
    if (ln) { lx0 = ln.a.x; lz0 = ln.a.z; ldx = ln.b.x - lx0; ldz = ln.b.z - lz0; lLen2 = ldx * ldx + ldz * ldz || 1; lR = ln.radius; }
    this._ox = ox; this._oy = oy;

    // Phạm vi đường chéo (d = X+Z) và ngang (u = X-Z) cần vẽ, tính theo ô đã gộp `step`.
    const N = Math.ceil(n / step);
    const dMin = Math.max(0, Math.floor(((0 - oy) / (s * 0.5) + (-64) * 2) / step) - 2);
    const dMax = Math.min(2 * N - 2, Math.ceil(((H - oy) / (s * 0.5) + 320 * 2) / step) + 2);
    const uMin = Math.floor((0 - ox) / S) - 2, uMax = Math.ceil((W - ox) / S) + 2;

    for (let d = dMin; d <= dMax; d++) {
      let u0 = Math.max(uMin, -d, d - 2 * (N - 1));
      const u1 = Math.min(uMax, d, 2 * (N - 1) - d);
      if (((u0 + d) & 1) !== 0) u0++;
      for (let u = u0; u <= u1; u += 2) {
        const X = (d + u) >> 1, Z = (d - u) >> 1;
        const x = X * step, z = Z * step;
        const ground = heightAt(t, x, z);
        const wl = wat[z * n + x];
        const wet = wl !== NO_WATER && wl > ground;
        let h = wet ? wl : ground;                     // ô ngập nước vẽ ở độ cao mặt nước
        const sI = sIdx[z * n + x], item = sI ? items[sI - 1] : null; // công trình vẽ riêng từng khối, sau cột đất
        const onStruct = false;
        const cx = ox + u * S;                         // tâm hình thoi theo x
        const cy = oy + d * halfH - h * s;             // tâm hình thoi theo y
        if (cy - halfH > H + tall * s) continue;
        const hL = Z + 1 < N ? groundTop(t, wat, n, x, z + step) : h - 12; // ô phía trước bên trái
        const hR = X + 1 < N ? groundTop(t, wat, n, x + step, z) : h - 12; // ô phía trước bên phải
        const dropL = Math.max(0, h - hL) * s, dropR = Math.max(0, h - hR) * s;
        if (cy + halfH + Math.max(dropL, dropR) < 0) continue;

        const matId = materialAt(t, x, z);
        const mat = MATERIALS[matId];
        let base = matId === MAT.GRASS ? grassColorAt(t, x, z) : mat.color;
        let side = mat.side;
        if (onStruct) {
          const c = item.map.colors[(z - item.z) * item.map.w + (x - item.x)];
          base = [(c >> 16) & 255, (c >> 8) & 255, c & 255]; side = base;
        } else if (wet) { // nước: pha màu đáy, càng sâu càng đậm
          const a = Math.min(0.9, 0.55 + 0.08 * (wl - ground));
          base = [base[0] + (WATER_COLOR[0] - base[0]) * a, base[1] + (WATER_COLOR[1] - base[1]) * a, base[2] + (WATER_COLOR[2] - base[2]) * a];
        }
        // Đổ bóng theo độ dốc thật (chưa làm tròn) để đồi thoải cũng nhìn ra: sáng từ góc trên bên trái.
        const xa = x >= step ? x - step : x, xb = x + step < n ? x + step : x;
        const za = z >= step ? z - step : z, zb = z + step < n ? z + step : z;
        const gx = (hts[z * n + xb] - hts[z * n + xa]) / (xb - xa || 1);
        const gz = (hts[zb * n + x] - hts[za * n + x]) / (zb - za || 1);
        let kS = 1;
        if (onStruct) { // mái dốc sáng tối theo hướng, mép mái nổi lên
          const sx = (topAt(t, wat, sTop, n, xb, z) - topAt(t, wat, sTop, n, xa, z)) / (xb - xa || 1);
          const sz = (topAt(t, wat, sTop, n, x, zb) - topAt(t, wat, sTop, n, x, za)) / (zb - za || 1);
          kS = 1 + 0.16 * Math.tanh(0.7 * (0.9 * sx - 0.35 * sz));
        }
        const k = onStruct ? kS : wet ? 1 : 1 + 0.3 * Math.tanh(5 * (0.9 * gx - 0.35 * gz)) + Math.max(-0.2, Math.min(0.25, 0.004 * (h - REF_H)));
        let tr = base[0] * k, tg = base[1] * k, tb = base[2] * k;
        if (!onStruct) {
          // Vân bề mặt: mỗi khối sáng tối hơi khác nhau (đá, sỏi lốm đốm nhiều hơn cỏ) để mặt đất không thành mảng phẳng.
          const hsh = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) >>> 0;
          const amp = wet ? 0.025 : mat.noise ?? 0.045;
          let v = 1 + (((hsh >>> 7) & 255) / 255 - 0.5) * 2 * amp;
          if (mat.bricks && !wet && ((z & 1) === 0 ? (x & 3) === 0 : (x & 3) === 2)) v *= 0.8; // mạch gạch so le
          tr *= v; tg *= v; tb *= v;
          if (wet) { // mép nước sáng lên như bọt sóng, thấy rõ đường bờ
            const dry = (xx, zz) => { const w2 = wat[zz * n + xx]; return w2 === NO_WATER || w2 <= Math.round(hts[zz * n + xx]); };
            if (dry(xa, z) || dry(xb, z) || dry(x, za) || dry(x, zb)) { tr += (235 - tr) * 0.45; tg += (245 - tg) * 0.45; tb += (255 - tb) * 0.45; }
          } else if (this.showContours) {
            // Đường đồng mức: cứ mỗi 5 khối độ cao một nét sẫm, mỗi 25 khối một nét đậm hơn.
            const hR2 = Math.round(hts[z * n + xb]), hL2 = Math.round(hts[zb * n + x]);
            const lo = Math.min(hR2, hL2);
            if (lo < ground && ground - lo <= 3 * step) {
              const a5 = Math.floor(ground / 5), b5 = Math.floor(lo / 5);
              if (a5 !== b5) { const q = Math.floor(ground / 25) !== Math.floor(lo / 25) ? 0.62 : 0.8; tr *= q; tg *= q; tb *= q; }
            }
          }
        }
        if (br) {
          const ddx = x - br.x, ddz = z - br.z, dist = Math.sqrt(ddx * ddx + ddz * ddz);
          if (dist <= br.radius) {
            const ring = dist > br.radius - Math.max(1, step);
            const a = ring ? 0.6 : 0.14;
            tr += (90 - tr) * a; tg += (170 - tg) * a; tb += (255 - tb) * a;
          }
        }
        if (gh && x >= gh.x0 && x <= gh.x1 && z >= gh.z0 && z <= gh.z1) {
          const rim = x - gh.x0 < step || gh.x1 - x < step || z - gh.z0 < step || gh.z1 - z < step;
          const a = rim ? 0.75 : 0.2;
          tr += (90 - tr) * a; tg += (170 - tg) * a; tb += (255 - tb) * a;
        }
        if (caves) { // lớp hang: nhìn xuyên xuống lòng đất bằng màu
          const cm = t.caveMask[z * n + x], cf = t.caveFloor[z * n + x];
          if (cm || cf !== NO_CAVE) {
            if (cm & 1) { tr += (150 - tr) * 0.42; tg += (90 - tg) * 0.42; tb += (220 - tb) * 0.42; }
            if (cf !== NO_CAVE) { const a = 0.5 + Math.min(0.3, t.caveHeight[z * n + x] * 0.02); tr += (240 - tr) * a; tg += (140 - tg) * a; tb += (40 - tb) * a; }
            if (cm & 2) { tr += (255 - tr) * 0.7; tg += (235 - tg) * 0.7; tb += (60 - tb) * 0.7; }
          } else { const gy = (tr + tg + tb) / 3; tr += (gy - tr) * 0.55; tg += (gy - tg) * 0.55; tb += (gy - tb) * 0.55; tr *= 0.8; tg *= 0.8; tb *= 0.8; }
        }
        if (ln) { // đoạn đường thẳng sắp đặt: tô vệt theo bề rộng cọ
          const tt = Math.max(0, Math.min(1, ((x - lx0) * ldx + (z - lz0) * ldz) / lLen2));
          const ex = x - (lx0 + tt * ldx), ez = z - (lz0 + tt * ldz), dd = Math.sqrt(ex * ex + ez * ez);
          if (dd <= lR) {
            const a = dd > lR - Math.max(1, step) ? 0.7 : 0.4;
            if (ln.erase) { tr += (229 - tr) * a; tg += (72 - tg) * a; tb += (77 - tb) * a; } else { tr += (255 - tr) * a; tg += (214 - tg) * a; tb += (64 - tb) * a; }
          }
        }
        if (hi && x >= hi.x0 && x <= hi.x1 && z >= hi.z0 && z <= hi.z1) { // công trình đang được chỉ vào
          const rim = x - hi.x0 < step || hi.x1 - x < step || z - hi.z0 < step || hi.z1 - z < step;
          const a = rim ? 0.85 : 0.18;
          tr += (255 - tr) * a; tg += (214 - tg) * a; tb += (64 - tb) * a;
        }
        const edge = this.showBorder && (x === 0 || z === 0 || x >= n - step || z >= n - step);
        if (edge) { tr = tr * 0.4 + 226 * 0.6; tg = tg * 0.4 + 75 * 0.6; tb = tb * 0.4 + 74 * 0.6; }
        if (!wet && !onStruct) { const dk = t.deco[z * n + x]; if (dk) { const dc = DECO[dk - 1].color; tr += (dc[0] - tr) * 0.62; tg += (dc[1] - tg) * 0.62; tb += (dc[2] - tb) * 0.62; } }
        const cTop = rgba(clamp8(tr), clamp8(tg), clamp8(tb));
        const cGrid = rgba(clamp8(tr * 0.86), clamp8(tg * 0.86), clamp8(tb * 0.86));
        const cL = rgba(clamp8(side[0] * 0.82), clamp8(side[1] * 0.82), clamp8(side[2] * 0.82));
        const cR = rgba(clamp8(side[0] * 0.62), clamp8(side[1] * 0.62), clamp8(side[2] * 0.62));
        // Khối trên cùng của vách lấy màu mặt trên sẫm lại (như cạnh khối cỏ), bên dưới mới là đất/đá.
        const cLt = rgba(clamp8(base[0] * k * 0.8), clamp8(base[1] * k * 0.8), clamp8(base[2] * k * 0.8));
        const cRt = rgba(clamp8(base[0] * k * 0.64), clamp8(base[1] * k * 0.64), clamp8(base[2] * k * 0.64));
        const capPx = onStruct ? 1e9 : Math.max(1, Math.round(s)); // tường công trình giữ một màu
        const cell = z * n + x;
        const mt = matTex && !onStruct ? (wet ? waterTex : matTex[matId]) : null;
        const tTop = mt && mt.top, tCap = mt && mt.cap, tUnder = mt && mt.under;
        let fR = 1, fG = 1, fB = 1;
        if (tTop) { fR = Math.min(3, tr / Math.max(8, tTop.avg[0])); fG = Math.min(3, tg / Math.max(8, tTop.avg[1])); fB = Math.min(3, tb / Math.max(8, tTop.avg[2])); }
        const kSide = k < 0.8 ? 0.8 : k > 1.15 ? 1.15 : k;

        const pxa = Math.max(0, Math.ceil(cx - S)), pxb = Math.min(W - 1, Math.ceil(cx + S) - 1);
        for (let p = pxa; p <= pxb; p++) {
          const f = 1 - Math.abs(p + 0.5 - cx) / S;   // 0 ở mép, 1 ở giữa
          const hh = f * halfH;
          let ya = Math.round(cy - hh), yb = Math.round(cy + hh);
          if (yb <= ya) yb = ya + 1;
          const left = p + 0.5 < cx;
          const yc = yb + Math.round(left ? dropL : dropR);
          if (ya < 0) ya = 0;
          const ybC = yb > H ? H : yb, ycC = yc > H ? H : yc;
          let o = ya * W + p;
          if (tTop) {
            const dxn = (p + 0.5 - cx) / S;
            for (let y = ya; y < ybC; y++, o += W) {
              const dyn = (y + 0.5 - cy) / halfH;
              let tx = Math.floor(((dxn + dyn) * 0.5 + 0.5) * 16), ty = Math.floor(((dyn - dxn) * 0.5 + 0.5) * 16);
              tx = tx < 0 ? 0 : tx > 15 ? 15 : tx; ty = ty < 0 ? 0 : ty > 15 ? 15 : ty;
              const t0 = tTop.px[ty * 16 + tx];
              px[o] = t0 ? rgba(clamp8((t0 & 255) * fR), clamp8(((t0 >> 8) & 255) * fG), clamp8(((t0 >> 16) & 255) * fB)) : cTop; pick[o] = cell;
            }
          } else for (let y = ya; y < ybC; y++, o += W) { px[o] = cTop; pick[o] = cell; }
          if (grid && yb - 1 >= 0 && yb - 1 < H) px[(yb - 1) * W + p] = cGrid; // viền dưới của mặt khối
          const cS = left ? cL : cR, cSt = left ? cLt : cRt;
          const yCap = yb + capPx;
          o = Math.max(yb, 0) * W + p;
          if (tCap || tUnder) {
            const tt = left ? (p + 0.5 - (cx - S)) / S : (p + 0.5 - cx) / S, tx = Math.min(15, Math.max(0, Math.floor(tt * 16))), fac = (left ? 0.82 : 0.62) * kSide;
            for (let y = Math.max(yb, 0); y < ycC; y++, o += W) {
              const inCap = y < yCap, rec = inCap ? tCap : tUnder;
              if (!rec) { px[o] = inCap ? cSt : cS; pick[o] = cell; continue; }
              const fr = inCap ? (y - yb) / capPx : ((y - yCap) / s) % 1, ty = Math.min(15, Math.max(0, Math.floor(fr * 16)));
              const t0 = rec.px[ty * 16 + tx];
              px[o] = t0 ? mulPx(t0, fac) : (inCap ? cSt : cS); pick[o] = cell;
            }
          } else for (let y = Math.max(yb, 0); y < ycC; y++, o += W) { px[o] = y < yCap ? cSt : cS; pick[o] = cell; }
        }
        // Công trình trên ô này: vẽ từng khối một từ dưới lên, nên thấy được mái che, cột, khoảng trống.
        const baseY = oy + d * halfH;
        if (item) this.drawColumn(item, x, z, cx, baseY, S, s, cell, false);
        if (gh && gh.map && x >= gh.x0 && x <= gh.x1 && z >= gh.z0 && z <= gh.z1) this.drawColumn(gh, x, z, cx, baseY, S, s, -1, true);
      }
    }
    this.voxProps = useTex && !!this.props?.length;
    if (this.voxProps) this.drawPropVoxels();
    this._modeled = useTex && this.mobs?.length ? this.drawMobModels() : null;
    this.ctx.putImageData(this.image, 0, 0);
    this.drawBorder();
    this.drawZones();
    this.drawGhostPad();
    this.drawProps();
    this.drawMobs();
    if (this.spawn) this.drawFlag(this.spawn.x, this.spawn.z);
    this.drawLabels();
  }
  /**
   * Vẽ các khối của một công trình nằm trên ô (x, z), từ dưới lên: mỗi khối là một hộp có mặt trên và hai mặt bên.
   * ghost = công trình sắp đặt: pha mờ với nền và không ghi vào bảng dò ô (pick) để con trỏ vẫn chỉ đúng ô đất.
   */
  drawColumn(item, x, z, cx, baseY, S, s, cell, ghost) {
    const m = item.map, plane = m.w * m.l, col0 = (z - item.z) * m.w + (x - item.x);
    if (m.tops[col0] < 0) return;
    const { W, H, px, pick } = this, lines = s >= 4;
    const btx = this.texOn(S) ? this.blockTextures(m) : null;
    for (let ly = 0; ly <= m.tops[col0]; ly++) {
      const v = m.cols[ly * plane + col0];
      if (!v) continue;
      const shp = m.shapes[ly * plane + col0];
      let q = 1, y0 = 0, y1 = 1;
      if (shp === 1) y1 = 0.5; else if (shp === 2) y0 = 0.5; else if (shp === 3) q = 0.34;
      else if (shp === 4) y1 = 0.15; else if (shp === 5) q = 0.5; else if (shp === 6) { q = 0.3; y1 = 0.7; }
      const Sq = Math.max(0.75, S * q), sideH = Math.max(1, Math.round((y1 - y0) * s));
      const cyTop = baseY - (item.y + ly - 1 + y1) * s;
      if (cyTop - Sq / 2 > H || cyTop + Sq / 2 + sideH < 0) continue;
      const above = ly + 1 < m.h ? m.cols[(ly + 1) * plane + col0] : 0;
      const hideTop = shp === 0 && above && m.shapes[(ly + 1) * plane + col0] === 0; // bị khối đặc phía trên che
      const hsh = (Math.imul(x, 73856093) ^ Math.imul(ly + item.y, 83492791) ^ Math.imul(z, 19349663)) >>> 0;
      const k = (0.94 + 0.12 * (ly / Math.max(1, m.h - 1))) * (1 + (((hsh >>> 7) & 255) / 255 - 0.5) * 0.08);
      const r = ((v - 1) >> 16) & 255, g = ((v - 1) >> 8) & 255, b = (v - 1) & 255;
      const cT = rgba(clamp8(r * k * 1.05), clamp8(g * k * 1.05), clamp8(b * k * 1.05));
      const cL = rgba(clamp8(r * k * 0.76), clamp8(g * k * 0.76), clamp8(b * k * 0.76));
      const cR = rgba(clamp8(r * k * 0.56), clamp8(g * k * 0.56), clamp8(b * k * 0.56));
      const rec = btx && m.ids ? btx[m.ids[ly * plane + col0] - 1] : null;
      this.cubeAt(cx, cyTop, Sq, sideH, rec, cT, cL, cR, k < 0.9 ? 0.9 : k > 1.06 ? 1.06 : k, hideTop, cell, ghost, lines);
    }
  }
  /** Vẽ một khối: mặt trên hình thoi và hai mặt bên. rec = texture { top, side } hoặc null (khi đó dùng ba màu cT, cL, cR). */
  cubeAt(cx, cyTop, Sq, sideH, rec, cT, cL, cR, kk, hideTop, cell, ghost, lines) {
    const { W, H, px, pick } = this;
    const pa = Math.max(0, Math.ceil(cx - Sq)), pb = Math.min(W - 1, Math.ceil(cx + Sq) - 1);
    for (let p = pa; p <= pb; p++) {
      const f = 1 - Math.abs(p + 0.5 - cx) / Sq, hh = f * Sq / 2;
      let ya = Math.round(cyTop - hh), yb = Math.round(cyTop + hh);
      if (yb <= ya) yb = ya + 1;
      const left = p + 0.5 < cx, yc = Math.min(H, yb + sideH), cS = left ? cL : cR;
      if (rec) { // texture thật: mặt trên và hai mặt bên lấy mẫu từ ảnh 16 x 16 của khối
        const dxn = (p + 0.5 - cx) / Sq;
        if (!hideTop) {
          for (let y = Math.max(0, ya); y < Math.min(H, yb); y++) {
            const dyn = (y + 0.5 - cyTop) / (Sq / 2);
            let tx = Math.floor(((dxn + dyn) * 0.5 + 0.5) * 16), ty = Math.floor(((dyn - dxn) * 0.5 + 0.5) * 16);
            tx = tx < 0 ? 0 : tx > 15 ? 15 : tx; ty = ty < 0 ? 0 : ty > 15 ? 15 : ty;
            const t0 = rec.top.px[ty * 16 + tx];
            if (t0) put(px, pick, y * W + p, mulPx(t0, 1.05 * kk), cell, ghost);
          }
        }
        const tt = left ? (p + 0.5 - (cx - Sq)) / Sq : dxn, tx = Math.min(15, Math.max(0, Math.floor(tt * 16))), fac = (left ? 0.8 : 0.6) * kk;
        for (let y = Math.max(0, yb); y < yc; y++) {
          const ty = Math.min(15, Math.max(0, Math.floor(((y - yb) / sideH) * 16)));
          const t0 = rec.side.px[ty * 16 + tx];
          if (t0) put(px, pick, y * W + p, mulPx(t0, fac), cell, ghost);
        }
        continue;
      }
      if (!hideTop) {
        for (let y = Math.max(0, ya); y < Math.min(H, yb); y++) put(px, pick, y * W + p, lines && y === yb - 1 ? darker(cT) : cT, cell, ghost);
      }
      for (let y = Math.max(0, yb); y < yc; y++) put(px, pick, y * W + p, lines && y === yc - 1 && sideH > 2 ? darker(cS) : cS, cell, ghost);
    }
  }
  /**
   * Cây và vật thể bằng khối thật có texture (khi đã có texture và đang phóng đủ lớn): vẽ đúng các khối mà bản xuất world sẽ đặt.
   * Vẽ sau đất và công trình, từ xa tới gần; cây nằm sau đồi vẫn hiện (như ký hiệu cũ).
   */
  drawPropVoxels() {
    const list = this.props; if (!list?.length) return;
    if (this._pp !== list || this._pl !== list.length) { this._pp = list; this._pl = list.length; this._sorted = list.slice().sort((a, b) => (a.x + a.z) - (b.x + b.z)); }
    const t = this.terrain, n = t.size, s = this.scale, S = s, halfH = S / 2, { W, H } = this, ox = this._ox, oy = this._oy;
    const tx = this.tx, lines = s >= 4;
    if (!this._pbc || this._pbc.size > 3000) this._pbc = new Map();
    for (const p of this._sorted) {
      const d = PROP_BY_KEY[p.k]; if (!d) continue;
      const gx = Math.floor(p.x), gz = Math.floor(p.z);
      if (gx < 0 || gz < 0 || gx >= n || gz >= n) continue;
      const k = p.sc || 1, mR = (d.draw.r * k + 4) * s, mH = (d.draw.h * k + 6) * s;
      const sx = ox + (gx - gz) * S, sy = oy + (gx + gz) * halfH - (Math.round(t.heights[gz * n + gx]) + 1) * s;
      if (sx < -mR || sx > W + mR || sy < -mH * 0.2 || sy > H + mH) continue;
      const key = p.k + '|' + (p.s | 0) + '|' + k + '|' + (p.v ?? '');
      let bl = this._pbc.get(key);
      if (!bl) {
        bl = propBlocks(p).filter((b) => !b[3].startsWith('minecraft:air')).map(([dx, dy, dz, st]) => {
          const name = st.split('[')[0], ps = parseState(st);
          return { dx, dy, dz, name, shape: shapeOf(ps), tall: /axis=[xz]/.test(st) };
        }).sort((a, b) => (a.dx + a.dz) - (b.dx + b.dz) || a.dy - b.dy);
        this._pbc.set(key, bl);
        if (this.needTex) this.needTex(bl.map((b) => b.name));
      }
      const y0 = Math.round(t.heights[gz * n + gx]) + 1;
      for (const b of bl) {
        const bx = gx + b.dx, bz = gz + b.dz;
        let rec = tx.block(b.name);
        if (rec === undefined) continue; // chưa tải xong texture: lần vẽ sau sẽ có
        if (rec && b.tall) rec = { top: rec.side, side: rec.side };
        const col = blockColor(b.name), cT = rgba(clamp8(col[0] * 1.05), clamp8(col[1] * 1.05), clamp8(col[2] * 1.05)), cL = rgba(clamp8(col[0] * 0.76), clamp8(col[1] * 0.76), clamp8(col[2] * 0.76)), cR = rgba(clamp8(col[0] * 0.56), clamp8(col[1] * 0.56), clamp8(col[2] * 0.56));
        let q = 1, ya = 0, yb = 1; const shp = b.shape;
        if (shp === SHAPE.SLAB_BOTTOM) yb = 0.5; else if (shp === SHAPE.SLAB_TOP) ya = 0.5; else if (shp === SHAPE.POST) q = 0.34;
        else if (shp === SHAPE.FLAT) yb = 0.15; else if (shp === SHAPE.PANEL) q = 0.5; else if (shp === SHAPE.SHORT_POST) { q = 0.3; yb = 0.7; }
        const Sq = Math.max(0.75, S * q), sideH = Math.max(1, Math.round((yb - ya) * s));
        const cx = ox + (bx - bz) * S, cyTop = oy + (bx + bz) * halfH - (y0 + b.dy - 1 + yb) * s;
        if (cx + Sq < 0 || cx - Sq > W || cyTop - Sq / 2 > H || cyTop + Sq / 2 + sideH < 0) continue;
        this.cubeAt(cx, cyTop, Sq, sideH, rec, cT, cL, cR, 1, false, -2, false, lines);
      }
    }
  }
  /**
   * Mob thông dụng bằng mô hình hộp ghép có texture của game (xoay theo hướng mặt). Trả về tập các mob đã vẽ để khỏi vẽ ký hiệu đè lên.
   * Mặt nào chưa tải xong texture thì lần vẽ sau sẽ có.
   */
  drawMobModels() {
    const done = new Set(), t = this.terrain, n = t.size, s = this.scale, { W, H, px } = this, ox = this._ox, oy = this._oy, tx = this.tx;
    if (!this._facesCache) this._facesCache = new Map();
    const faces = [];
    for (const m of this.mobs) {
      const mod = modelFor(m.id); if (!mod) continue;
      const te = tx.entity.get(mod.tex);
      if (te === undefined) { this.needEntity?.(modelTextures(mod)); continue; }
      if (!te) continue;
      const gx = Math.floor(m.x), gz = Math.floor(m.z);
      if (gx < 0 || gz < 0 || gx >= n || gz >= n) continue;
      const fe = mod.fur ? tx.entity.get(mod.fur) : null;
      const feetY = topAt(t, t.water, this.structTop, n, gx, gz) + (m.dy || 0);
      const sx0 = ox + (m.x - m.z) * s, sy0 = oy + (m.x + m.z) * 0.5 * s - feetY * s;
      if (sx0 < -60 * s / 6 || sx0 > W + 60 * s / 6 || sy0 < -4 * s || sy0 > H + 60 * s / 6) continue;
      const am = mod.humanoid ? armorOf(m.snbt) : null;
      let layers = am ? armorLayers(mod, am) : [];
      if (layers.length) {
        const need = layers.map((l) => l.tex).filter((q) => tx.entity.get(q) === undefined);
        if (need.length) this.needEntity?.(need);
        layers = layers.filter((l) => tx.entity.get(l.tex));
      }
      let held = mod.humanoid || mod.hand ? heldOf(m.snbt) : null;
      if (held === 'crossbow') held = 'crossbow'; 
      if (held) { const q = `item/${held === 'crossbow' ? 'crossbow_standby' : held}`, e = tx.entity.get(q); if (e === undefined) this.needEntity?.([q]); if (!e) held = null; }
      const ha = horseArmorLayer(mod, m.snbt);
      if (ha) { const e = tx.entity.get(ha.tex); if (e === undefined) this.needEntity?.([ha.tex]); if (e) layers = [...layers, ha]; }
      const ck = layers.map((l) => l.tex).join('|') + (held ? '#' + held : '');
      let byMob = this._facesCache.get(mod); if (!byMob) { byMob = new Map(); this._facesCache.set(mod, byMob); }
      let fl = byMob.get(ck); if (!fl) { fl = buildFaces(mod, layers, held); byMob.set(ck, fl); }
      const a = ((m.yaw + (mod.yaw0 ?? 0)) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
      const pt = (v) => { const x = v[0] / 16, y = (24 - v[1]) / 16, z = -v[2] / 16; return [m.x + c * x - sn * z, feetY + y, m.z + sn * x + c * z]; };
      const vec = (v) => { const x = v[0] / 16, y = -v[1] / 16, z = -v[2] / 16; return [c * x - sn * z, y, sn * x + c * z]; };
      for (const f of fl) {
        if (f.fur && !fe) continue;
        const nw = vec(f.n);
        if (nw[0] + nw[1] + nw[2] <= 0.0001) continue;
        const o = pt(f.o), U = vec(f.U), V = vec(f.V);
        const ft = f.fur ? fe : f.tex ? tx.entity.get(f.tex) : te;
        if (!ft) continue;
        faces.push({ tex: ft, bw: f.bw ?? 64, r: f.r, o, U, V, nw, key: o[0] + o[2] + o[1] + (U[0] + U[1] + U[2] + V[0] + V[1] + V[2]) / 2 + (f.tex ? 0.08 : 0) });
      }
      done.add(m);
    }
    faces.sort((p, q) => p.key - q.key);
    for (const f of faces) {
      const { tex, r, o, U, V, nw } = f, k = tex.w / f.bw;
      const S0x = ox + (o[0] - o[2]) * s, S0y = oy + (o[0] + o[2]) * 0.5 * s - o[1] * s;
      const Ux = (U[0] - U[2]) * s, Uy = ((U[0] + U[2]) * 0.5 - U[1]) * s, Vx = (V[0] - V[2]) * s, Vy = ((V[0] + V[2]) * 0.5 - V[1]) * s;
      const det = Ux * Vy - Uy * Vx; if (Math.abs(det) < 1e-4) continue;
      const xa = Math.min(S0x, S0x + Ux, S0x + Vx, S0x + Ux + Vx), xb = Math.max(S0x, S0x + Ux, S0x + Vx, S0x + Ux + Vx);
      const ya = Math.min(S0y, S0y + Uy, S0y + Vy, S0y + Uy + Vy), yb = Math.max(S0y, S0y + Uy, S0y + Vy, S0y + Uy + Vy);
      const shade = nw[1] > 0.5 ? 1.05 : 0.6 + 0.22 * Math.max(0, nw[2]);
      const ru = r[0] * k, rv = r[1] * k, rw = r[2] * k, rh = r[3] * k;
      for (let y = Math.max(0, Math.floor(ya)); y <= Math.min(H - 1, Math.ceil(yb)); y++) {
        for (let x = Math.max(0, Math.floor(xa)); x <= Math.min(W - 1, Math.ceil(xb)); x++) {
          const dx = x + 0.5 - S0x, dy = y + 0.5 - S0y;
          const u = (dx * Vy - dy * Vx) / det, v = (Ux * dy - Uy * dx) / det;
          if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
          const c0 = tex.px[Math.min(tex.h - 1, Math.floor(rv + v * rh)) * tex.w + Math.min(tex.w - 1, Math.floor(ru + u * rw))];
          if (c0) px[y * W + x] = mulPx(c0, shade);
        }
      }
    }
    return done;
  }
  /** Toạ độ màn hình của điểm (x, y, z) trên map. */
  project(x, y, z) {
    const s = this.scale;
    return { px: this._ox + (x - z) * s, py: this._oy + (x + z) * s * 0.5 - y * s };
  }
  /** Khung sân quanh công trình sắp đặt (nét đứt vàng) khi chọn "San phẳng, sân quanh và móng". */
  drawGhostPad() {
    const g = this.ghost; if (!g || !g.pad) return;
    const m = g.pad.margin, y = g.pad.y, c = this.ctx;
    const pts = [[g.x0 - m, g.z0 - m], [g.x1 + 1 + m, g.z0 - m], [g.x1 + 1 + m, g.z1 + 1 + m], [g.x0 - m, g.z1 + 1 + m]].map(([x, z]) => this.project(x, y, z));
    c.save(); c.setLineDash([7, 5]); c.lineWidth = 2; c.strokeStyle = 'rgba(255,210,74,.95)'; c.fillStyle = 'rgba(255,210,74,.12)';
    c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.px, q.py) : c.moveTo(q.px, q.py))); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  /** Cây và vật thể: hình đơn giản theo loại (tán tròn, nón, cột...), vẽ từ xa tới gần để cây gần che cây xa. */
  drawProps() {
    const list = this.props, g = this.propGhost;
    if (!list?.length && !g) return;
    if (this._pp !== list || this._pl !== list.length) { this._pp = list; this._pl = list.length; this._sorted = list.slice().sort((a, b) => (a.x + a.z) - (b.x + b.z)); }
    const t = this.terrain, n = t.size, s = this.scale, c = this.ctx, W = this.W, H = this.H;
    c.lineJoin = 'round'; c.lineCap = 'round';
    const one = (p, alpha) => {
      const d = PROP_BY_KEY[p.k]; if (!d) return;
      const gx = Math.floor(p.x), gz = Math.floor(p.z);
      if (gx < 0 || gz < 0 || gx >= n || gz >= n) return;
      const { px, py } = this.project(gx + 0.5, Math.round(t.heights[gz * n + gx]) + 1, gz + 0.5);
      const dr = d.draw, k = p.sc || 1, R = Math.max(1.6, dr.r * k * s), Hh = Math.max(3, dr.h * k * s);
      if (px < -R - 8 || px > W + R + 8 || py < -Hh - 8 || py > H + R + 8) return;
      c.globalAlpha = alpha;
      const line = (x0, y0, x1, y1, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
      const ell = (cx, cy, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.stroke(); };
      const tw = Math.max(1.2, s * 0.8);
      switch (dr.shape) {
        case 'round':
          line(px, py, px, py - Hh * 0.62, dr.t, tw);
          ell(px, py - Hh * 0.72, R, R * 0.82, dr.c);
          break;
        case 'cone':
          line(px, py, px, py - Hh * 0.2, dr.t, tw);
          c.fillStyle = dr.c; c.beginPath(); c.moveTo(px, py - Hh); c.lineTo(px + R, py - Hh * 0.12); c.lineTo(px - R, py - Hh * 0.12); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.stroke();
          break;
        case 'palm':
          line(px, py, px + R * 0.3, py - Hh * 0.85, dr.t, tw);
          for (let a = 0; a < 6; a++) { const th = (a / 6) * Math.PI * 2; line(px + R * 0.3, py - Hh * 0.85, px + R * 0.3 + Math.cos(th) * R, py - Hh * 0.85 + Math.sin(th) * R * 0.5 + R * 0.25, dr.c, tw * 1.4); }
          break;
        case 'column': line(px, py, px, py - Hh, dr.t, Math.max(1.4, s * 1.1)); break;
        case 'post': line(px, py, px, py - Hh, dr.c, Math.max(1.6, s * Math.min(R * 0.5, 2.2))); if (R > 1.5) line(px - R * 0.6, py, px + R * 0.6, py - R * 0.15, dr.c, Math.max(1.5, s * 0.9)); break;
        case 'low': ell(px, py - R * 0.45, R, R * 0.7, dr.c); break;
        case 'dots': {
          let h = (p.s | 0) || 1;
          for (let q = 0; q < 6; q++) { h = (Math.imul(h, 1103515245) + 12345) | 0; const ax = (((h >>> 8) & 255) / 255 - 0.5) * 2 * R, ay = (((h >>> 16) & 255) / 255 - 0.5) * R; c.fillStyle = dr.c; c.fillRect(px + ax - 1, py + ay - 1 - (dr.h > 1 ? s : 0), Math.max(2, s * 0.7), Math.max(2, s * 0.7)); }
          break;
        }
        case 'rock': ell(px, py - R * 0.35, R, R * 0.68, dr.c); ell(px - R * 0.25, py - R * 0.55, R * 0.4, R * 0.25, 'rgba(255,255,255,.25)'); break;
        case 'block': { const q = Math.max(2, R * 0.9); c.fillStyle = dr.c; c.beginPath(); c.moveTo(px, py - q * 1.5); c.lineTo(px + q, py - q); c.lineTo(px, py - q * 0.5); c.lineTo(px - q, py - q); c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.moveTo(px - q, py - q); c.lineTo(px, py - q * 0.5); c.lineTo(px, py + q * 0.3); c.lineTo(px - q, py - q * 0.2); c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.moveTo(px + q, py - q); c.lineTo(px, py - q * 0.5); c.lineTo(px, py + q * 0.3); c.lineTo(px + q, py - q * 0.2); c.closePath(); c.fill(); break; }
        default: ell(px, py, R, R * 0.5, dr.c); if (p.k === 'crater') ell(px, py, R * 0.55, R * 0.28, 'rgba(0,0,0,.55)');
      }
      c.globalAlpha = 1;
    };
    if (!this.voxProps) for (const p of this._sorted) one(p, 1);
    if (g) one(g, 0.6);
  }
  /** Khung world border: đường vàng bám theo địa hình; khi chỉnh thì thêm tay nắm ở bốn góc và giữa bốn cạnh. */
  drawBorder() {
    const b = this.border; if (!b) return;
    const t = this.terrain, n = t.size, c = this.ctx;
    const hAt = (x, z) => t.heights[Math.min(n - 1, Math.max(0, Math.floor(z))) * n + Math.min(n - 1, Math.max(0, Math.floor(x)))] + 1;
    const at = (x, z) => this.project(x, hAt(x, z), z);
    const path = [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1], [b.x0, b.z0]];
    c.save(); c.lineJoin = 'round';
    for (const [w, col] of [[5, 'rgba(20,20,30,0.75)'], [2.5, '#ffd24a']]) {
      c.beginPath();
      path.forEach(([x, z], i) => {
        if (i === 0) { const p = at(x, z); c.moveTo(p.px, p.py); return; }
        const [px0, pz0] = path[i - 1], k = Math.max(1, Math.ceil(Math.max(Math.abs(x - px0), Math.abs(z - pz0)) / 4));
        for (let j = 1; j <= k; j++) { const p = at(px0 + (x - px0) * j / k, pz0 + (z - pz0) * j / k); c.lineTo(p.px, p.py); }
      });
      c.lineWidth = w; c.strokeStyle = col; c.stroke();
    }
    if (this.borderEdit) {
      const mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
      for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1], [mx, b.z0], [b.x1, mz], [mx, b.z1], [b.x0, mz]]) {
        const p = at(x, z);
        c.fillStyle = '#ffd24a'; c.strokeStyle = '#1b1b26'; c.lineWidth = 2;
        c.beginPath(); c.rect(p.px - 5, p.py - 5, 10, 10); c.fill(); c.stroke();
      }
      const p = at((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      c.font = '600 12px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const text = `${b.x1 - b.x0} x ${b.z1 - b.z0}`, w = c.measureText(text).width + 14;
      c.fillStyle = 'rgba(20,20,30,0.8)'; c.fillRect(p.px - w / 2, p.py - 10, w, 20);
      c.fillStyle = '#ffd24a'; c.fillText(text, p.px, p.py);
    }
    c.restore();
  }
  /** Vùng của kịch bản: hình chữ nhật xanh trong suốt bám theo địa hình, có tên ở giữa. */
  drawZones() {
    const zs = this.terrain.scenario?.zones; if (!zs?.length) return;
    const t = this.terrain, n = t.size, c = this.ctx;
    const hAt = (x, z) => t.heights[Math.min(n - 1, Math.max(0, Math.floor(z))) * n + Math.min(n - 1, Math.max(0, Math.floor(x)))] + 1;
    const at = (x, z) => this.project(x, hAt(x, z), z);
    c.save(); c.lineJoin = 'round';
    for (const z of zs) {
      const x0 = z.x0, z0 = z.z0, x1 = z.x1 + 1, z1 = z.z1 + 1;
      const path = [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];
      c.beginPath();
      path.forEach(([x, zz], i) => {
        if (i === 0) { const p = at(x, zz); c.moveTo(p.px, p.py); return; }
        const [ax, az] = path[i - 1], k = Math.max(1, Math.ceil(Math.max(Math.abs(x - ax), Math.abs(zz - az)) / 4));
        for (let j = 1; j <= k; j++) { const p = at(ax + (x - ax) * j / k, az + (zz - az) * j / k); c.lineTo(p.px, p.py); }
      });
      c.fillStyle = 'rgba(89,168,255,0.16)'; c.fill();
      c.lineWidth = 2; c.strokeStyle = '#59a8ff'; c.stroke();
      const p = at((x0 + x1) / 2, (z0 + z1) / 2);
      c.font = '600 12px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = c.measureText(z.name).width + 12;
      c.fillStyle = 'rgba(20,30,50,0.75)'; c.fillRect(p.px - w / 2, p.py - 9, w, 18);
      c.fillStyle = '#bfe0ff'; c.fillText(z.name, p.px, p.py);
    }
    c.restore();
  }
  drawMobs() {
    const t = this.terrain, n = t.size, s = this.scale;
    this.mobScreen = [];
    const r = Math.max(3.5, Math.min(11, s * 0.85));
    const one = (m, i, style, alpha, key) => {
      const gx = Math.floor(m.x), gz = Math.floor(m.z);
      if (gx < 0 || gz < 0 || gx >= n || gz >= n) return;
      const h = topAt(t, t.water, this.structTop, n, gx, gz);
      const { px, py } = this.project(m.x, h + 1, m.z);
      if (px < -20 || py < -20 || px > this.W + 20 || py > this.H + 20) return;
      const hot = key !== null && key === this.hiGroup;
      if (typeof m.id === 'string' && m.id.startsWith(BUILDING_PREFIX)) { this.drawBuildingMark(m, h, style, alpha, hot); if (i >= 0) this.mobScreen.push({ px, py, r, m, i, key }); return; }
      if (!(this._modeled && this._modeled.has(m)) || hot) this.drawMarker(px, py, r, m.yaw, style, alpha, hot);
      if (i >= 0) this.mobScreen.push({ px, py, r, m, i, key });
    };
    this.mobs.forEach((m, i) => one(m, i, mobStyle(m), 1, mobGroupKey(m, i)));
    const g = this.mobGhost;
    if (g) for (const p of g.points) one({ x: p.x, z: p.z, yaw: g.yaw, id: g.id }, -1, g.style, 0.6, null);
  }
  /** Công trình đặt sẵn: vẽ đúng hình chữ nhật nền (đã xoay) theo màu ô người chơi, có dấu cửa ở cạnh trước. */
  drawBuildingMark(m, h, style, alpha, hot) {
    const c = this.ctx, rot = rotOf(m.yaw), name = m.id.slice(BUILDING_PREFIX.length);
    const [x0, z0, x1, z1] = footprintRect(name, Math.floor(m.x), Math.floor(m.z), rot);
    const P = [this.project(x0, h + 1, z0), this.project(x1, h + 1, z0), this.project(x1, h + 1, z1), this.project(x0, h + 1, z1)];
    c.globalAlpha = alpha; c.lineJoin = 'round';
    c.beginPath(); P.forEach((q, k) => (k ? c.lineTo(q.px, q.py) : c.moveTo(q.px, q.py))); c.closePath();
    c.fillStyle = style.color; c.globalAlpha = 0.45 * alpha; c.fill(); c.globalAlpha = alpha;
    c.strokeStyle = 'rgba(0,0,0,.9)'; c.lineWidth = hot ? 4 : 3; c.stroke();
    c.strokeStyle = hot ? '#ffd640' : '#fff'; c.lineWidth = 1.5; c.stroke();
    const q = this.project(m.x, h + 1, m.z), a = (m.yaw * Math.PI) / 180, fx = -Math.sin(a), fz = Math.cos(a), len = Math.max(6, this.scale * 2.5);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(q.px, q.py); c.lineTo(q.px + (fx - fz) * len, q.py + (fx + fz) * len * 0.5); c.stroke();
    c.beginPath(); c.arc(q.px, q.py, 3, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
    c.globalAlpha = 1;
  }
  /** Một biểu tượng mob: hình theo loại, viền trắng, vạch chỉ hướng mặt (yaw Minecraft: 0 = nam, 90 = tây). */
  drawMarker(px, py, r, yaw, style, alpha, hot) {
    const c = this.ctx, a = (yaw * Math.PI) / 180;
    const fx = -Math.sin(a), fz = Math.cos(a), len = r * 1.9;
    c.globalAlpha = alpha; c.lineJoin = 'round';
    if (hot) { c.fillStyle = 'rgba(255,214,64,.45)'; c.beginPath(); c.arc(px, py, r + 5, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.85)'; c.lineWidth = Math.max(2, r * 0.5);
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + (fx - fz) * len, py + (fx + fz) * len * 0.5); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, r * 0.22);
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + (fx - fz) * len, py + (fx + fz) * len * 0.5); c.stroke();
    c.beginPath();
    switch (style.shape) {
      case 'triangle': c.moveTo(px, py - r * 1.15); c.lineTo(px + r * 1.1, py + r * 0.85); c.lineTo(px - r * 1.1, py + r * 0.85); c.closePath(); break;
      case 'diamond': c.moveTo(px, py - r * 1.2); c.lineTo(px + r * 1.2, py); c.lineTo(px, py + r * 1.2); c.lineTo(px - r * 1.2, py); c.closePath(); break;
      case 'shield': c.moveTo(px - r, py - r); c.lineTo(px + r, py - r); c.lineTo(px + r, py + r * 0.2); c.lineTo(px, py + r * 1.25); c.lineTo(px - r, py + r * 0.2); c.closePath(); break;
      case 'star':
        for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.6 : r * 1.35, th = -Math.PI / 2 + (k * Math.PI) / 5; c.lineTo(px + rr * Math.cos(th), py + rr * Math.sin(th)); }
        c.closePath(); break;
      default: c.arc(px, py, r, 0, Math.PI * 2);
    }
    c.fillStyle = style.color; c.fill();
    c.strokeStyle = 'rgba(0,0,0,.9)'; c.lineWidth = Math.max(1.5, r * 0.3); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1; c.stroke();
    c.globalAlpha = 1;
  }
  /** Nhãn tên công trình và nhóm mob. Nhãn nào đè lên nhãn đã vẽ thì bỏ qua (trừ nhãn đang được chỉ vào). */
  drawLabels() {
    const c = this.ctx, s = this.scale, hi = this.hi;
    const all = this.showNames && s >= 2;
    const used = [];
    c.font = '600 12px "Segoe UI", system-ui, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
    const put = (text, px, py, hot, dot) => {
      const w = c.measureText(text).width + 12 + (dot ? 12 : 0), h = 18;
      const x0 = Math.round(px - w / 2), y0 = Math.round(py - h);
      if (x0 + w < 0 || y0 + h < 0 || x0 > this.W || y0 > this.H) return;
      if (!hot && used.some((u) => x0 < u[0] + u[2] && x0 + w > u[0] && y0 < u[1] + u[3] && y0 + h > u[1])) return;
      used.push([x0, y0, w, h]);
      c.fillStyle = hot ? 'rgba(255,214,64,.96)' : 'rgba(18,20,25,.82)';
      c.beginPath(); c.roundRect(x0, y0, w, h, 5); c.fill();
      c.strokeStyle = hot ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.28)'; c.lineWidth = 1; c.stroke();
      if (dot) { c.fillStyle = dot; c.beginPath(); c.arc(x0 + 10, y0 + h / 2, 4, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,.7)'; c.stroke(); }
      c.fillStyle = hot ? '#14161a' : '#fff';
      c.fillText(text, x0 + w / 2 + (dot ? 6 : 0), y0 + h / 2 + 0.5);
    };
    const labels = [];
    for (const it of this.items) {
      const hot = !!hi && hi.x0 === it.x && hi.z0 === it.z && hi.x1 === it.x + it.map.w - 1 && hi.z1 === it.z + it.map.l - 1;
      if (!all && !hot) continue;
      const p = this.project(it.x + it.map.w / 2, it.y + it.map.h + 1, it.z + it.map.l / 2);
      labels.push({ text: it.label ?? '', px: p.px, py: p.py - 4, hot });
    }
    const t = this.terrain, n = t.size;
    for (const g of mobGroups(this.mobs)) {
      const hot = g.key === this.hiGroup;
      if (!all && !hot) continue;
      let top = Infinity, sx = 0; // nhãn nằm trên con mob cao nhất trên màn hình
      for (const m of g.members) {
        const gx = Math.min(n - 1, Math.max(0, Math.floor(m.x))), gz = Math.min(n - 1, Math.max(0, Math.floor(m.z)));
        const p = this.project(m.x, topAt(t, t.water, this.structTop, n, gx, gz) + 1, m.z);
        if (p.py < top) top = p.py; sx += p.px;
      }
      labels.push({ text: g.count > 1 ? `${g.label} ×${g.count}` : g.label, px: sx / g.count, py: top - Math.max(8, s * 1.6), hot, dot: mobStyle(g.members[0]).color });
    }
    labels.sort((a, b) => (b.hot - a.hot) || 0);
    for (const l of labels) put(l.text, l.px, l.py, l.hot, l.dot);
  }
  drawFlag(x, z) {
    const t = this.terrain, n = t.size, s = this.scale, c = this.ctx;
    if (x < 0 || z < 0 || x >= n || z >= n) return;
    const h = topAt(t, t.water, this.structTop, n, x, z);
    const px = Math.round(this._ox + (x - z) * s), py = Math.round(this._oy + (x + z) * s * 0.5 - h * s);
    c.fillStyle = '#ffffff'; c.fillRect(px - 1, py - 26, 2, 26);
    c.fillStyle = '#e5484d';
    c.beginPath(); c.moveTo(px + 1, py - 26); c.lineTo(px + 15, py - 20); c.lineTo(px + 1, py - 14); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1; c.stroke();
    c.strokeRect(px - 1.5, py - 26.5, 3, 27);
  }
}
