// Vẽ hình xem trước (nhìn nghiêng) của một công trình schem lên canvas: từng khối có ba mặt sáng tối khác nhau,
// có viền khối, và các khối không đặc (phiến, bậc thang, hàng rào, cửa, kính, đuốc...) vẽ đúng dáng gần đúng.
import { blockColor, isAirName, isSkipName, parseState, transformState, dimsAfter, inverse } from '../../core/structure.js';

const POST = /fence(?!_gate)|_wall$|iron_bars|chain$|torch|lantern|end_rod|lightning_rod|candle|_sign$|banner|flower|sapling|^(short_|tall_)?grass$|fern|dead_bush|lever|bamboo|sugar_cane|scaffolding/;
const PANEL = /pane$|door$|fence_gate|ladder|vine/;
const FLAT = /carpet|pressure_plate|^snow$|rail$|trapdoor|redstone_wire|lily_pad|_button$/;
const GLASS = /glass|ice$/;

/** Các hộp con (theo phần của khối đơn vị) tạo nên một khối: [x0, y0, z0, x1, y1, z1]. */
function boxesOf(st) {
  const n = st.Name.replace('minecraft:', ''), p = st.Properties ?? {};
  if (/_slab$/.test(n)) return p.type === 'double' ? null : [p.type === 'top' ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1]];
  if (/_stairs$/.test(n)) {
    const top = p.half === 'top';
    const base = top ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
    const y0 = top ? 0 : 0.5, y1 = top ? 0.5 : 1;
    const step = { north: [0, y0, 0, 1, y1, 0.5], south: [0, y0, 0.5, 1, y1, 1], west: [0, y0, 0, 0.5, y1, 1], east: [0.5, y0, 0, 1, y1, 1] }[p.facing] ?? [0, y0, 0, 1, y1, 0.5];
    return top ? [step, base] : [base, step];
  }
  if (FLAT.test(n)) return [[0, 0, 0, 1, 0.12, 1]];
  if (PANEL.test(n)) {
    const f = p.facing, ns = f === 'north' || f === 'south' || (p.north === 'true' && p.east !== 'true') || (p.south === 'true' && p.west !== 'true');
    // Cửa quay mặt bắc/nam thì tấm cửa chạy theo trục x; tấm kính nối bắc-nam thì chạy theo trục z.
    const alongX = /door$|fence_gate|ladder/.test(n) ? ns : !ns;
    return [alongX ? [0, 0, 0.4, 1, 1, 0.6] : [0.4, 0, 0, 0.6, 1, 1]];
  }
  if (POST.test(n)) return [[0.36, 0, 0.36, 0.64, /torch|flower|grass|fern|candle|sapling|dead_bush/.test(n) ? 0.7 : 1, 0.64]];
  if (/^bed$|_bed$/.test(n)) return [[0, 0, 0, 1, 0.56, 1]];
  return null; // khối đặc đầy đủ
}

/**
 * @param {object} schem kết quả parseSchem
 * @param {HTMLCanvasElement} canvas
 * @param {{rot?:number, flip?:boolean}} [opt] xoay/lật giống lúc đặt
 */
export function renderThumb(schem, canvas, { rot = 0, flip = false } = {}) {
  const { h, palette, data } = schem;
  const [w, l] = dimsAfter(schem.w, schem.l, rot);
  const W = canvas.width, H = canvas.height, pad = Math.round(W * 0.04);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const s = Math.min(W / 9, (W - pad * 2) / (w + l), (H - pad * 2) / ((w + l) / 2 + h));
  const info = palette.map((str) => {
    const st = transformState(parseState(str), rot, flip), name = st.Name.replace('minecraft:', '');
    if (isAirName(st.Name) || isSkipName(st.Name)) return null;
    const boxes = boxesOf(st);
    return { color: blockColor(name), boxes, full: !boxes && !GLASS.test(name), glass: GLASS.test(name) };
  });
  const at = (x, y, z) => {
    if (x < 0 || z < 0 || y < 0 || x >= w || y >= h || z >= l) return null;
    const [sx, sz] = inverse(x, z, schem.w, schem.l, rot, flip);
    return info[data[(y * schem.l + sz) * schem.w + sx]];
  };
  const full = (x, y, z) => { const b = at(x, y, z); return !!b && b.full; };
  const drawnW = (w + l) * s, drawnH = (w + l) * s / 2 + h * s;
  const ox = (W - drawnW) / 2 + l * s, oy = (H - drawnH) / 2 + h * s;
  const P = (x, y, z) => [ox + (x - z) * s, oy + (x + z) * s / 2 - y * s];
  const css = (c, k) => `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
  const outline = s >= 5;
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.6, s / 22);
  const quad = (a, b, c, d, fill) => {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (outline) { ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.stroke(); }
  };

  // Nền: bóng hình thoi dưới chân công trình.
  { const a = P(0, 0, 0), b = P(w, 0, 0), c = P(w, 0, l), d = P(0, 0, l);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.stroke(); }

  // Vẽ từ xa tới gần, từ dưới lên trên.
  for (let d = 0; d <= w + l - 2; d++) {
    for (let x = Math.max(0, d - l + 1); x <= Math.min(w - 1, d); x++) {
      const z = d - x;
      for (let y = 0; y < h; y++) {
        const b = at(x, y, z);
        if (!b) continue;
        const hideT = full(x, y + 1, z), hideL = full(x, y, z + 1), hideR = full(x + 1, y, z);
        if (b.full && hideT && hideL && hideR) continue;
        const hsh = (Math.imul(x, 73856093) ^ Math.imul(y, 83492791) ^ Math.imul(z, 19349663)) >>> 0;
        const k = (0.9 + 0.2 * (y / Math.max(1, h - 1))) * (1 + (((hsh >>> 7) & 255) / 255 - 0.5) * 0.09);
        ctx.globalAlpha = b.glass ? 0.5 : 1;
        for (const [x0, y0, z0, x1, y1, z1] of b.boxes ?? [[0, 0, 0, 1, 1, 1]]) {
          const X0 = x + x0, X1 = x + x1, Y0 = y + y0, Y1 = y + y1, Z0 = z + z0, Z1 = z + z1;
          const whole = b.full;
          if (!(whole && hideL)) quad(P(X0, Y1, Z1), P(X1, Y1, Z1), P(X1, Y0, Z1), P(X0, Y0, Z1), css(b.color, k * 0.74)); // mặt trái (phía +z)
          if (!(whole && hideR)) quad(P(X1, Y1, Z0), P(X1, Y1, Z1), P(X1, Y0, Z1), P(X1, Y0, Z0), css(b.color, k * 0.56)); // mặt phải (phía +x)
          if (!(whole && hideT)) quad(P(X0, Y1, Z0), P(X1, Y1, Z0), P(X1, Y1, Z1), P(X0, Y1, Z1), css(b.color, k * 1.04));  // mặt trên
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}
