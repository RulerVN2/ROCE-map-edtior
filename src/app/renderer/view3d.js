// Chế độ xem 3D (WebGL): xoay camera tự do quanh map. Chỉ để xem: vẽ địa hình, công trình, cây và vật thể, mob từ cùng dữ liệu với khung 2D.
// Texture lấy từ jar của người dùng như khung 2D (không có thì vẽ bằng màu). Cảnh được dựng lại khi camera đi xa chỗ đã dựng.
import { DECO, materialAt, grassColorAt, MATERIALS, MAT, WATER_COLOR, NO_WATER, BLOCK_PALETTE } from '../../core/terrain.js';
import { propBlocks } from '../../core/props.js';
import { modelFor, buildFaces, armorOf, armorLayers, heldOf, horseArmorLayer } from '../../core/mobmodels.js';
import { blockColor, parseState, shapeOf } from '../../core/structure.js';

const R = 112;            // bán kính vùng dựng chi tiết (khối)
const FAR_STEP = 8;       // bước lưới của lớp địa hình xa
const MAX_QUADS = 1500000;
const hash = (x, y, z) => (Math.imul(x, 73856093) ^ Math.imul(y, 83492791) ^ Math.imul(z, 19349663)) >>> 0;

// ---------- Toán ma trận (cột trước) ----------
function perspective(fovy, asp, n, f) {
  const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
  m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f);
  return m;
}
function lookAt(e, c, u) {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) o[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
  return o;
}

// ---------- Bộ đệm đỉnh: x y z u v r g b ----------
class VB {
  constructor() { this.a = new Float32Array(1 << 16); this.n = 0; this.quads = 0; }
  push(x, y, z, u, v, r, g, b) {
    if (this.n + 8 > this.a.length) { const na = new Float32Array(this.a.length * 2); na.set(this.a); this.a = na; }
    const a = this.a, i = this.n; a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = u; a[i + 4] = v; a[i + 5] = r; a[i + 6] = g; a[i + 7] = b; this.n += 8;
  }
  /** Bốn góc p0..p3 (mỗi góc [x,y,z]) với toạ độ ảnh uv0..uv3 và màu nhân. */
  quad(p0, p1, p2, p3, t0, t1, t2, t3, r, g, b) {
    this.push(p0[0], p0[1], p0[2], t0[0], t0[1], r, g, b); this.push(p1[0], p1[1], p1[2], t1[0], t1[1], r, g, b);
    this.push(p2[0], p2[1], p2[2], t2[0], t2[1], r, g, b); this.push(p3[0], p3[1], p3[2], t3[0], t3[1], r, g, b);
    this.quads++;
  }
}

// ---------- Atlas texture khối (ô 16 x 16) ----------
class Atlas {
  constructor() {
    this.N = 32; this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = this.N * 16;
    this.g = this.cv.getContext('2d', { willReadFrequently: true }); this.map = new Map(); this.n = 0; this.dirty = true;
    this.white = this.flat(255, 255, 255);
  }
  add(key, draw) {
    let i = this.map.get(key); if (i !== undefined) return i;
    if (this.n >= this.N * this.N) return 0;
    i = this.n++; draw(this.g, (i % this.N) * 16, Math.floor(i / this.N) * 16); this.map.set(key, i); this.dirty = true; return i;
  }
  flat(r, g, b) { const c = `rgb(${r | 0},${g | 0},${b | 0})`; return this.add('c' + c, (cx, x, y) => { cx.fillStyle = c; cx.fillRect(x, y, 16, 16); }); }
  px(px) { return this.add(px, (cx, x, y) => cx.putImageData(new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset, 1024), 16, 16), x, y)); }
  /** Khung ảnh của ô i: [u0, v0, u1, v1] (co vào nửa điểm ảnh để không lẹm sang ô bên cạnh). */
  uv(i) { const e = 0.02 / 16, s = 1 / this.N, x = (i % this.N) * s, y = Math.floor(i / this.N) * s; return [x + e * s * 16, y + e * s * 16, x + s - e * s * 16, y + s - e * s * 16]; }
}

const VS = `#version 300 es
in vec3 a_p; in vec2 a_uv; in vec3 a_c; uniform mat4 u_vp; out vec2 v_uv; out vec3 v_c; out float v_d;
void main(){ gl_Position = u_vp * vec4(a_p, 1.0); v_uv = a_uv; v_c = a_c; v_d = gl_Position.w; }`;
const FS = `#version 300 es
precision mediump float; in vec2 v_uv; in vec3 v_c; in float v_d; uniform sampler2D u_t; uniform vec3 u_fog; uniform vec2 u_fr; uniform float u_a; out vec4 o;
void main(){ vec4 c = texture(u_t, v_uv); if (c.a < 0.5) discard; vec3 col = c.rgb * v_c; float f = clamp((v_d - u_fr.x) / (u_fr.y - u_fr.x), 0.0, 1.0); o = vec4(mix(col, u_fog, f), u_a); }`;

export class View3D {
  constructor(canvas, view) {
    this.canvas = canvas; this.view = view; this.active = false;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) throw new Error('Máy này không hỗ trợ WebGL, nên chưa xem 3D được.');
    this.gl = gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    this.pr = pr;
    this.loc = { vp: gl.getUniformLocation(pr, 'u_vp'), t: gl.getUniformLocation(pr, 'u_t'), fog: gl.getUniformLocation(pr, 'u_fog'), fr: gl.getUniformLocation(pr, 'u_fr'), a: gl.getUniformLocation(pr, 'u_a') };
    this.sky = [0.55, 0.74, 0.93];
    this.atlas = new Atlas(); this.atlasTex = gl.createTexture();
    this.meshes = []; this.entTex = new Map(); this.idxBuf = gl.createBuffer(); this.idxCap = 0;
    this.yaw = Math.PI / 4; this.pitch = 0.62; this.dist = 70; this.tgt = [0, 0, 0];
    this.keys = new Set(); this.center = null; this.txVer = -1; this.stats = {};
    this.bind();
  }
  groundAt(x, z) {
    const t = this.view.terrain, n = t.size, i = Math.min(n - 1, Math.max(0, Math.floor(z))) * n + Math.min(n - 1, Math.max(0, Math.floor(x)));
    let g = Math.round(t.heights[i]); const w = t.water[i]; if (w !== NO_WATER && w > g) g = w; return g;
  }
  bind() {
    const c = this.canvas; let drag = null;
    const loc = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      if (this.edit && this.pen && e.button === 0) { drag = { pen: true }; this.pen.down(loc(e), e); return; }
      drag = { x: e.clientX, y: e.clientY, b: e.button };
    });
    const up = () => { if (drag?.pen) this.pen.up(); drag = null; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { if (this.edit && this.pen && !drag) this.pen.leave(); });
    c.addEventListener('pointermove', (e) => {
      if (this.edit && this.pen) this.pen.move(loc(e), e);
      if (!drag || drag.pen) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      const orbit = this.edit ? drag.b === 2 : drag.b === 0;
      if (orbit) { this.yaw -= dx * 0.006; this.pitch = Math.max(0.05, Math.min(1.5, this.pitch + dy * 0.005)); }
      else this.pan(-dx * this.dist * 0.0016, -dy * this.dist * 0.0016);
    });
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.dist = Math.max(4, Math.min(700, this.dist * (e.deltaY > 0 ? 1.12 : 0.89))); }, { passive: false });
  }
  invalidate() { this.stale = true; }
  /** Ô đất dưới điểm (px, py) của màn hình (toạ độ CSS trong khung 3D), hoặc null nếu tia không chạm đất. */
  pick(px, py) {
    const c = this.canvas, W = c.clientWidth, H = c.clientHeight, n = this.view.terrain.size; if (!W || !H) return null;
    const e = this.eye(), t = this.tgt, nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const f = nrm([t[0] - e[0], t[1] - e[1], t[2] - e[2]]), r = nrm(cr(f, [0, 1, 0])), u = cr(r, f), th = Math.tan(0.45);
    const kx = (2 * px / W - 1) * th * (W / H), ky = (1 - 2 * py / H) * th;
    const d = nrm([f[0] + r[0] * kx + u[0] * ky, f[1] + r[1] * kx + u[1] * ky, f[2] + r[2] * kx + u[2] * ky]);
    const below = (s) => { const x = e[0] + d[0] * s, z = e[2] + d[2] * s; return x >= 0 && z >= 0 && x < n && z < n && e[1] + d[1] * s <= this.groundAt(x, z); };
    let s0 = 0.5, s1 = -1;
    for (let s = 0.5; s < 2400; s += s < 60 ? 0.5 : 2) { if (below(s)) { s1 = s; break; } s0 = s; }
    if (s1 < 0) return null;
    for (let i = 0; i < 8; i++) { const m = (s0 + s1) / 2; if (below(m)) s1 = m; else s0 = m; }
    const x = Math.floor(e[0] + d[0] * s1), z = Math.floor(e[2] + d[2] * s1);
    return { x: Math.max(0, Math.min(n - 1, x)), z: Math.max(0, Math.min(n - 1, z)) };
  }
  /** Vòng tròn cọ (hoặc ô đơn với công cụ bấm từng điểm) vẽ dán lên mặt đất tại this.cursor = { x, z, r }. */
  updateRing() {
    const c = this.edit ? this.cursor : null, key = c ? `${c.x},${c.z},${c.r},${this.stale ? 1 : 0}` : '';
    if (key === this._ringKey) return; this._ringKey = key;
    if (this.ringMesh) { this.gl.deleteBuffer(this.ringMesh.buf); this.ringMesh = null; }
    if (!c) return;
    const vb = new VB(), at = this.atlas, t = this.view.terrain, n = t.size, ti = at.flat(255, 225, 70), [u0, v0, u1, v1] = at.uv(ti), r = c.r;
    this.uploadAtlas();
    for (let z = Math.max(0, Math.floor(c.z - r - 1)); z <= Math.min(n - 1, Math.ceil(c.z + r + 1)); z++) for (let x = Math.max(0, Math.floor(c.x - r - 1)); x <= Math.min(n - 1, Math.ceil(c.x + r + 1)); x++) {
      const dd = Math.hypot(x - c.x, z - c.z);
      if (r > 0 && !(dd <= r + 0.5 && dd > r - 1)) continue;
      if (r <= 0 && (x !== c.x || z !== c.z)) continue;
      const y = this.groundAt(x, z) + 0.04;
      vb.quad([x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1], [u0, v0], [u1, v0], [u1, v1], [u0, v1], 1, 1, 1);
    }
    this.ringMesh = this.makeMesh(vb, null, false);
  }
  /** Dời điểm nhìn theo hướng màn hình (phải, tới) trên mặt phẳng ngang. */
  pan(right, fwd) {
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), n = this.view.terrain.size;
    this.tgt[0] = Math.max(0, Math.min(n, this.tgt[0] + right * cy - fwd * sy)); this.tgt[2] = Math.max(0, Math.min(n, this.tgt[2] - right * sy - fwd * cy));
  }
  key(e, down) {
    const k = e.code; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(k)) { down ? this.keys.add(k) : this.keys.delete(k); e.preventDefault?.(); return true; }
    return false;
  }
  open() {
    const v = this.view; this.active = true; this.canvas.style.display = 'block';
    this.tgt = [v.camX, 0, v.camZ]; this.tgt[1] = this.groundAt(this.tgt[0], this.tgt[2]);
    this.center = null; this.rebuild(); this.last = performance.now();
    const loop = (t) => { if (!this.active) return; try { this.frame(t); } catch (err) { this.lastError = String(err.stack || err); console.error(err); } this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  close() { this.active = false; this.edit = false; this.keys.clear(); cancelAnimationFrame(this.raf); this.canvas.style.display = 'none'; }

  // ---------- Dựng cảnh ----------
  need(names) { this.view.needTex?.(names); }
  rebuild() {
    const t0 = performance.now(), v = this.view, t = v.terrain, n = t.size, tx = v.tx, at = this.atlas;
    const cx = Math.floor(this.tgt[0]), cz = Math.floor(this.tgt[2]);
    this.center = [cx, cz]; this.txVer = tx ? tx.version : 0;
    const x0 = Math.max(0, cx - R), x1 = Math.min(n, cx + R), z0 = Math.max(0, cz - R), z1 = Math.min(n, cz + R);
    const useTx = !!(tx && tx.available);
    const rec = (name) => (useTx && name ? tx.block(name) : null);
    const tileTop = (r, base, k) => (r ? at.px(r.top.px) : at.flat(base[0] * k, base[1] * k, base[2] * k));
    const tileSide = (r, base, k) => (r ? at.px(r.side.px) : at.flat(base[0] * k, base[1] * k, base[2] * k));
    const vb = new VB(), wvb = new VB();
    const T = (i) => at.uv(i);
    const quadTile = (p0, p1, p2, p3, ti, k) => { const [u0, v0, u1, v1] = T(ti); vb.quad(p0, p1, p2, p3, [u0, v0], [u1, v0], [u1, v1], [u0, v1], k, k, k); };
    // Địa hình
    const wRec = rec('minecraft:water'), waterTile = wRec ? at.px(wRec.top.px) : at.flat(...WATER_COLOR);
    const shade = { px: 0.8, nx: 0.62, pz: 0.9, nz: 0.7 };
    const names = new Set(['minecraft:water']); MATERIALS.forEach((m) => { if (m) { names.add(BLOCK_PALETTE[m.top]?.Name); names.add(BLOCK_PALETTE[m.under]?.Name); } });
    for (const d of DECO) names.add(BLOCK_PALETTE[d.b].Name);
    this.need([...names].filter(Boolean));
    const decoTile = DECO.map((d) => { const r = rec(BLOCK_PALETTE[d.b].Name); return r ? at.px(r.top.px) : at.flat(...d.color); });
    for (let z = z0; z < z1; z++) {
      for (let x = x0; x < x1; x++) {
        const i = z * n + x, g = Math.round(t.heights[i]), wl = t.water[i], wet = wl !== NO_WATER && wl > g;
        const matId = materialAt(t, x, z), mat = MATERIALS[matId] ?? MATERIALS[MAT.GRASS];
        const base = matId === MAT.GRASS ? grassColorAt(t, x, z) : mat.color;
        const rt = rec(BLOCK_PALETTE[mat.top]?.Name), ru = rec(BLOCK_PALETTE[mat.under]?.Name);
        const kn = 1 + (((hash(x, 0, z) >>> 7) & 255) / 255 - 0.5) * 0.08;
        if (wet) {
          const [u0, v0, u1, v1] = T(waterTile);
          wvb.quad([x, wl, z], [x + 1, wl, z], [x + 1, wl, z + 1], [x, wl, z + 1], [u0, v0], [u1, v0], [u1, v1], [u0, v1], 0.95, 0.95, 0.95);
          quadTile([x, g, z], [x + 1, g, z], [x + 1, g, z + 1], [x, g, z + 1], tileTop(rt, base, 1), 0.75 * kn);
        } else quadTile([x, g, z], [x + 1, g, z], [x + 1, g, z + 1], [x, g, z + 1], tileTop(rt, base, 1), kn);
        const dk = wet ? 0 : t.deco[i];
        if (dk) { // cây nhỏ dạng hai tấm chéo nhau
          const D = DECO[dk - 1], ti = decoTile[dk - 1], hh = D.up !== undefined ? 1.9 : 0.85, y0 = g, y1 = g + hh;
          quadTile([x + 0.12, y1, z + 0.12], [x + 0.88, y1, z + 0.88], [x + 0.88, y0, z + 0.88], [x + 0.12, y0, z + 0.12], ti, 1.0);
          quadTile([x + 0.88, y1, z + 0.12], [x + 0.12, y1, z + 0.88], [x + 0.12, y0, z + 0.88], [x + 0.88, y0, z + 0.12], ti, 1.0);
        }
        if (wet) continue;
        const sides = [['px', x + 1, z, x + 1, z + 1, x + 1, z], ['nx', x, z + 1, x, z, x - 1, z], ['pz', x + 1, z + 1, x, z + 1, x, z + 1], ['nz', x, z, x + 1, z, x, z - 1]];
        for (const [nm, ax, az, bx, bz, nxx, nzz] of sides) {
          const ng = nxx < 0 || nzz < 0 || nxx >= n || nzz >= n ? Math.max(0, g - 24) : Math.round(t.heights[nzz * n + nxx]);
          if (ng >= g) continue;
          const k = shade[nm];
          for (let y = g, c = 0; y > ng && c < 64; y--, c++) {
            const tl = c === 0 ? tileSide(rt, base, 0.95) : ru ? at.px(ru.top.px) : at.flat(mat.side[0], mat.side[1], mat.side[2]);
            quadTile([ax, y, az], [bx, y, bz], [bx, y - 1, bz], [ax, y - 1, az], tl, k * (0.9 + (((hash(x, y, z) >>> 5) & 255) / 255) * 0.1));
          }
        }
      }
    }
    // Công trình và vật thể: thu khối đặc vào bảng để bỏ các mặt chôn kín
    const occ = new Set(), N1 = n + 2, key = (x, y, z) => (y + 2) * N1 * N1 + (z + 1) * N1 + (x + 1);
    const boxes = []; // { x, y, z, y0, y1, q, rec, col, full, tall }
    for (const it of v.items || []) {
      const m = it.map; if (it.x > x1 || it.x + m.w < x0 || it.z > z1 || it.z + m.l < z0) continue;
      const btx = useTx ? v.blockTextures(m) : null; this.need(m.pal);
      const plane = m.w * m.l;
      for (let ly = 0; ly < m.h; ly++) for (let lz = 0; lz < m.l; lz++) for (let lx = 0; lx < m.w; lx++) {
        const c = m.cols[ly * plane + lz * m.w + lx]; if (!c) continue;
        const shp = m.shapes[ly * plane + lz * m.w + lx], r = btx && m.ids ? btx[m.ids[ly * plane + lz * m.w + lx] - 1] : null;
        const bx = it.x + lx, by = it.y + ly - 1, bz = it.z + lz;
        boxes.push({ x: bx, y: by, z: bz, shp, rec: r, col: [((c - 1) >> 16) & 255, ((c - 1) >> 8) & 255, (c - 1) & 255], tall: false });
        if (shp === 0) occ.add(key(bx, by, bz));
      }
    }
    const pc = new Map();
    for (const p of v.props || []) {
      const gx = Math.floor(p.x), gz = Math.floor(p.z); if (gx < x0 || gx >= x1 || gz < z0 || gz >= z1) continue;
      const kk = p.k + '|' + (p.s | 0) + '|' + (p.sc || 1) + '|' + (p.v ?? '');
      let bl = pc.get(kk);
      if (!bl) {
        bl = propBlocks(p).filter((b) => !b[3].startsWith('minecraft:air')).map(([dx, dy, dz, st]) => { const nm = st.split('[')[0]; return { dx, dy, dz, name: nm, shp: shapeOf(parseState(st)), tall: /axis=[xz]/.test(st) }; });
        pc.set(kk, bl); this.need(bl.map((b) => b.name));
      }
      const y0 = Math.round(t.heights[gz * n + gx]) + 1;
      for (const b of bl) {
        let r = useTx ? tx.block(b.name) : null; if (r && b.tall) r = { top: r.side, side: r.side };
        const c = blockColor(b.name), bx = gx + b.dx, by = y0 + b.dy - 1, bz = gz + b.dz;
        boxes.push({ x: bx, y: by, z: bz, shp: b.shp, rec: r, col: c, tall: b.tall });
        if (b.shp === 0) occ.add(key(bx, by, bz));
      }
    }
    for (const b of boxes) {
      if (vb.quads > MAX_QUADS) break;
      let q = 1, ya = 0, yb = 1;
      if (b.shp === 1) yb = 0.5; else if (b.shp === 2) ya = 0.5; else if (b.shp === 3) q = 0.34; else if (b.shp === 4) yb = 0.15; else if (b.shp === 5) q = 0.5; else if (b.shp === 6) { q = 0.3; yb = 0.7; }
      const lo = (1 - q) / 2, X0 = b.x + lo, X1 = b.x + 1 - lo, Z0 = b.z + lo, Z1 = b.z + 1 - lo, Y0 = b.y + ya, Y1 = b.y + yb;
      const hk = 0.95 + (((hash(b.x, b.y, b.z) >>> 7) & 255) / 255) * 0.1;
      const tTop = tileTop(b.rec, b.col, hk), tSide = tileSide(b.rec, b.col, hk), full = b.shp === 0;
      const cl = (dx, dy, dz) => full && occ.has(key(b.x + dx, b.y + dy, b.z + dz));
      if (!cl(0, 1, 0)) quadTile([X0, Y1, Z0], [X1, Y1, Z0], [X1, Y1, Z1], [X0, Y1, Z1], tTop, 1.05);
      if (!cl(1, 0, 0)) quadTile([X1, Y1, Z0], [X1, Y1, Z1], [X1, Y0, Z1], [X1, Y0, Z0], tSide, shade.px);
      if (!cl(-1, 0, 0)) quadTile([X0, Y1, Z1], [X0, Y1, Z0], [X0, Y0, Z0], [X0, Y0, Z1], tSide, shade.nx);
      if (!cl(0, 0, 1)) quadTile([X1, Y1, Z1], [X0, Y1, Z1], [X0, Y0, Z1], [X1, Y0, Z1], tSide, shade.pz);
      if (!cl(0, 0, -1)) quadTile([X0, Y1, Z0], [X1, Y1, Z0], [X1, Y0, Z0], [X0, Y0, Z0], tSide, shade.nz);
    }
    this.stats.ms = Math.round(performance.now() - t0); this.stats.quads = vb.quads; this.stats.boxes = boxes.length;
    // Địa hình xa: lưới thô, một màu mỗi đỉnh (nằm lùi một chút phía sau lớp chi tiết)
    const fb = new VB(), fw = at.white, [fu, fv] = [T(fw)[0] + 0.01, T(fw)[1] + 0.01];
    const gridN = Math.ceil(n / FAR_STEP), H = new Float32Array((gridN + 1) * (gridN + 1)), C = new Float32Array((gridN + 1) * (gridN + 1) * 3);
    for (let j = 0; j <= gridN; j++) for (let i = 0; i <= gridN; i++) {
      const x = Math.min(n - 1, i * FAR_STEP), z = Math.min(n - 1, j * FAR_STEP), q = z * n + x, g = Math.round(t.heights[q]), wl = t.water[q], wet = wl !== NO_WATER && wl > g;
      const mat = MATERIALS[materialAt(t, x, z)] ?? MATERIALS[MAT.GRASS], col = wet ? WATER_COLOR : mat.color, o = j * (gridN + 1) + i;
      H[o] = (wet ? wl : g) - 3; C[o * 3] = col[0] / 255; C[o * 3 + 1] = col[1] / 255; C[o * 3 + 2] = col[2] / 255;
    }
    for (let j = 0; j < gridN; j++) for (let i = 0; i < gridN; i++) {
      const inside = i * FAR_STEP >= x0 && (i + 1) * FAR_STEP <= x1 && j * FAR_STEP >= z0 && (j + 1) * FAR_STEP <= z1;
      if (inside) continue; // đã có lớp chi tiết
      const o = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => b * (gridN + 1) + a);
      const P = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b], q) => [Math.min(n, a * FAR_STEP), H[o[q]], Math.min(n, b * FAR_STEP)]);
      const uv = [fu, fv];
      fb.push(...P[0], ...uv, C[o[0] * 3], C[o[0] * 3 + 1], C[o[0] * 3 + 2]); fb.push(...P[1], ...uv, C[o[1] * 3], C[o[1] * 3 + 1], C[o[1] * 3 + 2]);
      fb.push(...P[2], ...uv, C[o[2] * 3], C[o[2] * 3 + 1], C[o[2] * 3 + 2]); fb.push(...P[3], ...uv, C[o[3] * 3], C[o[3] * 3 + 1], C[o[3] * 3 + 2]); fb.quads++;
    }
    this.uploadAtlas();
    this.meshes = [this.makeMesh(fb, null, true), this.makeMesh(vb, null, false), ...this.buildMobs(x0, x1, z0, z1)];
    const wm = this.makeMesh(wvb, null, false); if (wm) { wm.water = true; this.meshes.push(wm); }
    this.meshes = this.meshes.filter(Boolean); this.stale = false; this.lastBuild = performance.now();
  }
  buildMobs(x0, x1, z0, z1) {
    const v = this.view, t = v.terrain, n = t.size, tx = v.tx, out = [];
    if (!tx || !tx.available) return out;
    const groups = new Map(); // khoá texture -> { tex, vb }
    const add = (tex, key) => { let g = groups.get(key); if (!g) { g = { tex, vb: new VB() }; groups.set(key, g); } return g.vb; };
    const faceCache = new Map();
    for (const m of v.mobs || []) {
      const mod = modelFor(m.id); if (!mod) continue;
      const gx = Math.floor(m.x), gz = Math.floor(m.z); if (gx < x0 - 8 || gx >= x1 + 8 || gz < z0 - 8 || gz >= z1 + 8 || gx < 0 || gz < 0 || gx >= n || gz >= n) continue;
      const want = [mod.tex, mod.fur].filter(Boolean);
      const am = mod.humanoid ? armorOf(m.snbt) : null; let layers = am ? armorLayers(mod, am) : [];
      const ha = horseArmorLayer(mod, m.snbt); if (ha) layers.push(ha);
      let held = mod.humanoid || mod.hand ? heldOf(m.snbt) : null; const heldTex = held ? `item/${held === 'crossbow' ? 'crossbow_standby' : held}` : null;
      const asks = [...want, ...layers.map((l) => l.tex), ...(heldTex ? [heldTex] : [])];
      const miss = asks.filter((q) => tx.entity.get(q) === undefined); if (miss.length) v.needEntity?.(miss);
      if (tx.entity.get(mod.tex) === undefined || !tx.entity.get(mod.tex)) continue;
      layers = layers.filter((l) => tx.entity.get(l.tex)); if (held && !tx.entity.get(heldTex)) held = null;
      const ck = mod.tex + '|' + layers.map((l) => l.tex).join('|') + '#' + (held ?? '');
      let faces = faceCache.get(ck); if (!faces) { faces = buildFaces(mod, layers, held); faceCache.set(ck, faces); }
      let feet = Math.round(t.heights[gz * n + gx]); const w = t.water[gz * n + gx]; if (w !== NO_WATER && w > feet) feet = w; if (v.structTop[gz * n + gx] > feet) feet = v.structTop[gz * n + gx]; feet += m.dy || 0;
      const a = ((m.yaw + (mod.yaw0 ?? 0)) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      const P = (q) => { const X = q[0] / 16, Y = (24 - q[1]) / 16, Z = -q[2] / 16; return [m.x + c * X - s * Z, feet + Y, m.z + s * X + c * Z]; };
      const D = (q) => { const X = q[0] / 16, Y = -q[1] / 16, Z = -q[2] / 16; return [c * X - s * Z, Y, s * X + c * Z]; };
      for (const f of faces) {
        const key = f.fur ? mod.fur : f.tex ?? mod.tex, te = tx.entity.get(key); if (!te) continue;
        const bw = f.bw ?? 64, kx = te.w / bw, o = P(f.o), U = D(f.U), V = D(f.V);
        const u0 = (f.r[0] * kx) / te.w, u1 = ((f.r[0] + f.r[2]) * kx) / te.w, v0 = (f.r[1] * kx) / te.h, v1 = ((f.r[1] + f.r[3]) * kx) / te.h;
        const ad = (A, B) => [A[0] + B[0], A[1] + B[1], A[2] + B[2]];
        const nw = D(f.n), sh = nw[1] > 0.5 ? 1.05 : 0.7 + 0.2 * Math.abs(nw[2]);
        add(te, key).quad(o, ad(o, U), ad(ad(o, U), V), ad(o, V), [u0, v0], [u1, v0], [u1, v1], [u0, v1], sh, sh, sh);
      }
    }
    for (const g of groups.values()) out.push(this.makeMesh(g.vb, g.tex, false));
    return out;
  }
  uploadAtlas() {
    const gl = this.gl; if (!this.atlas.dirty) return;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas.cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.atlas.dirty = false;
  }
  makeMesh(vb, tex, far) {
    if (!vb.quads) return null;
    const gl = this.gl, buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, vb.a.subarray(0, vb.n), gl.STATIC_DRAW);
    let glTex = null;
    if (tex) {
      glTex = this.entTex.get(tex);
      if (!glTex) {
        glTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, glTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tex.w, tex.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(tex.px.buffer, tex.px.byteOffset, tex.px.byteLength));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.entTex.set(tex, glTex);
      }
    }
    return { buf, quads: vb.quads, tex: glTex, far };
  }
  freeMeshes() { for (const m of this.meshes) this.gl.deleteBuffer(m.buf); this.meshes = []; }

  // ---------- Mỗi khung hình ----------
  frame(now) {
    this.frames = (this.frames || 0) + 1;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const sp = this.dist * 0.9 * dt * (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 3 : 1), K = this.keys;
    const f = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0), r = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    if (f || r) this.pan(r * sp, f * sp);
    if (K.has('KeyQ')) this.yaw += dt * 1.2; if (K.has('KeyE')) this.yaw -= dt * 1.2;
    this.tgt[1] += (this.groundAt(this.tgt[0], this.tgt[2]) + 1 - this.tgt[1]) * Math.min(1, dt * 8);
    const tx = this.view.tx;
    this.updateRing();
    if ((this.stale && now - (this.lastBuild || 0) > 150) || !this.center || Math.hypot(this.tgt[0] - this.center[0], this.tgt[2] - this.center[1]) > R / 3 || (tx && tx.version !== this.txVer && !this._pend)) {
      if (tx && tx.version !== this.txVer) { this._pend = true; setTimeout(() => { this._pend = false; }, 400); }
      this.freeMeshes(); this.rebuild();
    }
    this.render();
  }
  eye() {
    const cp = Math.cos(this.pitch), e = [this.tgt[0] + this.dist * cp * Math.sin(this.yaw), this.tgt[1] + this.dist * Math.sin(this.pitch), this.tgt[2] + this.dist * cp * Math.cos(this.yaw)];
    const g = this.groundAt(e[0], e[2]) + 2; if (e[1] < g) e[1] = g; return e;
  }
  render() {
    const gl = this.gl, c = this.canvas, dpr = window.devicePixelRatio || 1, w = Math.max(2, Math.floor(c.clientWidth * dpr)), h = Math.max(2, Math.floor(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(this.sky[0], this.sky[1], this.sky[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const vp = mul(perspective(0.9, w / h, 0.5, 2500), lookAt(this.eye(), this.tgt, [0, 1, 0]));
    gl.useProgram(this.pr); gl.uniformMatrix4fv(this.loc.vp, false, vp); gl.uniform3fv(this.loc.fog, this.sky); gl.uniform2f(this.loc.fr, 140, 480); gl.uniform1i(this.loc.t, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(this.loc.a, 1);
    for (const m of this.meshes) if (!m.water) this.draw(m);
    if (this.ringMesh) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2); this.draw(this.ringMesh, true); gl.disable(gl.POLYGON_OFFSET_FILL); }
    const wm = this.meshes.filter((m) => m.water);
    if (wm.length) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.uniform1f(this.loc.a, 0.62);
      for (const m of wm) this.draw(m);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.uniform1f(this.loc.a, 1);
    }
  }
  draw(m, keepOffset) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, m.tex ?? this.atlasTex);
    if (!keepOffset) { if (m.far) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(3, 3); } else gl.disable(gl.POLYGON_OFFSET_FILL); }
    gl.bindBuffer(gl.ARRAY_BUFFER, m.buf);
    for (const [name, size, off] of [['a_p', 3, 0], ['a_uv', 2, 12], ['a_c', 3, 20]]) {
      const l = gl.getAttribLocation(this.pr, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 32, off);
    }
    this.ensureIdx(m.quads);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.drawElements(gl.TRIANGLES, m.quads * 6, gl.UNSIGNED_INT, 0);
  }
  ensureIdx(q) {
    if (q <= this.idxCap) return; const gl = this.gl, a = new Uint32Array(q * 6);
    for (let i = 0; i < q; i++) { const o = i * 4; a.set([o, o + 1, o + 2, o, o + 2, o + 3], i * 6); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, a, gl.STATIC_DRAW); this.idxCap = q;
  }
  /** Dùng cho kiểm thử: vẽ một khung rồi đếm số màu khác nhau và tỉ lệ điểm không phải màu trời. */
  probe() {
    this.render(); const gl = this.gl, w = this.canvas.width, h = this.canvas.height, buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const sky = this.sky.map((x) => Math.round(x * 255)), set = new Set(); let non = 0;
    for (let i = 0; i < buf.length; i += 4) { set.add((buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2]); if (Math.abs(buf[i] - sky[0]) + Math.abs(buf[i + 1] - sky[1]) + Math.abs(buf[i + 2] - sky[2]) > 6) non++; }
    return { colors: set.size, nonSky: non / (w * h), quads: this.stats.quads, meshes: this.meshes.length, buildMs: this.stats.ms };
  }
}
