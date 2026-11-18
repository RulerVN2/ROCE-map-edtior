// Hệ tường: ghép các mô-đun tường (thẳng, lỗ châu mai, góc 90°, lô cốt, cổng, đổ nát, đầu tường) thành một tuyến liền
// dọc theo đường gấp khúc do người dùng bấm. Chỉ ghép theo trục (rẽ 90°). Không phụ thuộc giao diện nên kiểm thử được.
import { forward, dimsAfter } from './structure.js';

/** Quy ước mô-đun (tọa độ trong file gốc): x = dọc tuyến, z = bề dày, mặt trước hướng +z, cổng nối vào ở x=0, tâm tuyến ở z=1.
 *  Góc 90°: vào ở x=0, ra ở z=5 (cột x=3..5), mặt trước nằm phía trong góc. Đầu tường: chỉ có cổng ở x=0. */
export const WALL_KINDS = ['straight', 'embrasure', 'corner', 'bunker', 'gate', 'breach', 'collapsed', 'end'];
export const STRAIGHT_LEN = 8, CORNER_REACH = 4, END_LEN = 4;

/** Đoán loại mô-đun từ tên file (không phân biệt hoa thường). Trả về null nếu không phải mô-đun tường. */
export function wallKindOf(name) {
  const n = String(name).toLowerCase();
  if (!/wall|tuong/.test(n)) return null;
  if (/bunker|lo_cot/.test(n)) return 'bunker';
  if (/embras|chau_mai/.test(n)) return 'embrasure';
  if (/corner|goc/.test(n)) return 'corner';
  if (/gate|cong/.test(n)) return 'gate';
  if (/breach|thung/.test(n)) return 'breach';
  if (/collaps|ruin|do_nat/.test(n)) return 'collapsed';
  if (/end_?cap|(^|_)end(_|$)|dau_tuong/.test(n)) return 'end';
  if (/straight|thang/.test(n)) return 'straight';
  return null;
}

/** Từ danh sách tên công trình trong một nhóm, tìm bộ tường. Trả về { kind: name } hoặc null nếu thiếu đoạn thẳng hoặc góc. */
export function findWallSet(names) {
  const set = {};
  for (const nm of names) { const k = wallKindOf(nm); if (k && !set[k]) set[k] = nm; }
  return set.straight && set.corner ? set : null;
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const right = (d) => [-d[1], d[0]];
const left = (d) => [d[1], -d[0]];
const neg = (d) => [-d[0], -d[1]];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Tìm (rot, flip) sao cho trục x của mô-đun hướng theo ex và trục z hướng theo ez. */
export function orient(w, l, ex, ez) {
  for (const flip of [false, true]) {
    for (let rot = 0; rot < 4; rot++) {
      const o = forward(0, 0, w, l, rot, flip), x = forward(1, 0, w, l, rot, flip), z = forward(0, 1, w, l, rot, flip);
      if (x[0] - o[0] === ex[0] && x[1] - o[1] === ex[1] && z[0] - o[0] === ez[0] && z[1] - o[1] === ez[1]) return { rot, flip };
    }
  }
  throw new Error('Không tìm được hướng xoay');
}

/** Hướng trục của bước từ a tới b: trục chiếm ưu thế; khi hai trục bằng nhau (thường gặp trên màn hình xiên) thì rẽ vuông góc với hướng trước. */
function axisOf(dx, dz, prev) {
  const ax = Math.abs(dx), az = Math.abs(dz);
  const useX = ax > az || (ax === az && !(prev && prev[1] === 0));
  return useX ? { d: [Math.sign(dx), 0], len: ax } : { d: [0, Math.sign(dz)], len: az };
}
/** Gộp các điểm bấm thành các đoạn theo trục: bỏ đoạn quay ngược 180 độ, gộp đoạn cùng hướng. */
export function axisSegments(points) {
  const segs = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x, dz = points[i].z - points[i - 1].z;
    if (!dx && !dz) continue;
    const last = segs[segs.length - 1], { d, len } = axisOf(dx, dz, last && last.d);
    if (last && same(last.d, d)) last.len += len;
    else if (last && same(last.d, neg(d))) continue;
    else segs.push({ d, len });
  }
  return segs;
}
/** Điểm cuối của đoạn đang kéo sau khi ép về trục (dùng cho đường xem trước). */
export function snapToAxis(points, cell) {
  const a = points[points.length - 1], segs = axisSegments(points), last = segs[segs.length - 1];
  const { d, len } = axisOf(cell.x - a.x, cell.z - a.z, last && last.d);
  return len ? { x: a.x + d[0] * len, z: a.z + d[1] * len } : { x: a.x, z: a.z };
}

const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) % 100; };

/**
 * Ghép tuyến tường.
 * @param {{x:number,z:number}[]} points các điểm bấm (ô), tối thiểu 2
 * @param {Object<string,{name:string,w:number,l:number}>} set mô-đun theo loại (cần straight, corner; còn lại tuỳ chọn)
 * @param {{frontFlip?:boolean, embEvery?:number, bunkerEvery?:number, gate?:boolean, ruinPct?:number, startCap?:boolean, endCap?:boolean, seed?:number}} opts
 * @returns {{pieces:{kind:string,name:string,x:number,z:number,rot:number,flip:boolean,w:number,l:number}[], vertices:{x:number,z:number}[], mismatches:number, corners:number}}
 */
export function assembleWall(points, set, opts = {}) {
  const { frontFlip = false, embEvery = 2, bunkerEvery = 0, gate = false, ruinPct = 0, startCap = true, endCap = true, seed = 1 } = opts;
  const empty = { pieces: [], vertices: [], mismatches: 0, corners: 0 };
  if (!set || !set.straight || !set.corner || points.length < 2) return empty;
  // 1. Gộp các điểm thành các đoạn theo trục (xem axisSegments).
  const segs = axisSegments(points);
  if (!segs.length) return empty;
  const turnOf = (a, b) => (same(b, right(a)) ? 1 : -1); // +1 rẽ phải, -1 rẽ trái
  let front = segs.length > 1 ? turnOf(segs[0].d, segs[1].d) : 1; // mặt trước mặc định ở phía trong góc đầu tiên
  if (frontFlip) front = -front;
  const dim = (k) => set[k] ? set[k] : null;
  const cap = !!dim('end');
  const st = dim('straight');
  const m = segs.length;
  // 2. Đếm số đoạn thẳng của mỗi cạnh.
  const Q0 = { x: points[0].x, z: points[0].z };
  const info = [];
  for (let i = 0; i < m; i++) {
    const first = i === 0, last = i === m - 1;
    const startOff = first ? (startCap && cap ? END_LEN : 0) : CORNER_REACH + 1;
    const capLen = last && endCap && cap ? END_LEN : 0;
    const cells = last ? segs[i].len - startOff - capLen + 1 : segs[i].len - startOff - CORNER_REACH;
    info.push({ k: Math.max(0, Math.round(cells / STRAIGHT_LEN)) });
  }
  if (info.reduce((a, b) => a + b.k, 0) === 0) info[m - 1].k = 1;
  const total = info.reduce((a, b) => a + b.k, 0);
  const gateIdx = gate && dim('gate') ? Math.floor(total / 2) : -1;
  // 3. Phát sinh các mảnh.
  const pieces = [], vertices = [{ x: Q0.x, z: Q0.z }];
  let S = Q0, g = 0, mismatches = 0, corners = 0;
  const put = (kind, nm, A, ex, ez) => {
    const o = orient(nm.w, nm.l, ex, ez), [bw, bl] = dimsAfter(nm.w, nm.l, o.rot), p = forward(0, 1, nm.w, nm.l, o.rot, o.flip);
    pieces.push({ kind, name: nm.name, x: A.x - p[0], z: A.z - p[1], rot: o.rot, flip: o.flip, w: bw, l: bl });
  };
  for (let i = 0; i < m; i++) {
    const d = segs[i].d, first = i === 0, last = i === m - 1;
    const fv = front > 0 ? right(d) : left(d);
    const at = (s, n) => ({ x: s.x + d[0] * n, z: s.z + d[1] * n });
    let Ws;
    if (first) {
      if (startCap && cap) { put('end', set.end, at(S, END_LEN - 1), neg(d), fv); Ws = at(S, END_LEN); } else Ws = S;
    } else Ws = at(S, CORNER_REACH + 1);
    for (let j = 0; j < info[i].k; j++, g++) {
      let kind = 'straight';
      const r = hash(g, seed);
      if (g === gateIdx) kind = 'gate';
      else if (bunkerEvery > 0 && (g + 1) % bunkerEvery === 0 && dim('bunker')) kind = 'bunker';
      else if (ruinPct > 0 && r < ruinPct && (dim('breach') || dim('collapsed'))) kind = dim('breach') && (!dim('collapsed') || r % 2 === 0) ? 'breach' : 'collapsed';
      else if (embEvery > 0 && g % embEvery === embEvery - 1 && dim('embrasure')) kind = 'embrasure';
      put(kind, set[kind] || st, at(Ws, STRAIGHT_LEN * j), d, fv);
    }
    const c = at(Ws, STRAIGHT_LEN * info[i].k);
    if (last) {
      if (endCap && cap) { put('end', set.end, c, d, fv); vertices.push(at(c, END_LEN - 1)); } else vertices.push(at(c, -1));
    } else {
      const d2 = segs[i + 1].d, t = turnOf(d, d2);
      if (t !== front) mismatches++;
      put('corner', set.corner, c, d, d2);
      corners++;
      front = t;
      S = at(c, CORNER_REACH);
      vertices.push({ x: S.x, z: S.z });
    }
  }
  return { pieces, vertices, mismatches, corners };
}
