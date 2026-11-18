import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseSchem } from '../src/core/schem.js';
import { forward } from '../src/core/structure.js';
import { wallKindOf, findWallSet, assembleWall } from '../src/core/wallset.js';

const dir = new URL('../src/assets/bo_tuong_da/', import.meta.url);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.schem')).sort();
const schems = new Map(files.map((f) => [f.replace('.schem', ''), parseSchem(fs.readFileSync(new URL(f, dir)))]));

const setFor = () => {
  const found = findWallSet([...schems.keys()]);
  const set = {};
  for (const [k, name] of Object.entries(found)) { const s = schems.get(name); set[k] = { name, w: s.w, l: s.l }; }
  return set;
};

/** Dán các mảnh vào lưới khối (x,y,z) -> tên khối; trả về lưới và số ô bị hai mảnh cùng chiếm. */
function paste(pieces) {
  const grid = new Map();
  let clash = 0;
  for (const p of pieces) {
    const s = schems.get(p.name);
    for (let y = 0; y < s.h; y++) for (let z = 0; z < s.l; z++) for (let x = 0; x < s.w; x++) {
      const b = s.palette[s.data[(y * s.l + z) * s.w + x]];
      if (b === 'minecraft:air') continue;
      const [fx, fz] = forward(x, z, s.w, s.l, p.rot, p.flip);
      const key = `${p.x + fx},${y},${p.z + fz}`;
      if (grid.has(key)) clash++;
      grid.set(key, b);
    }
  }
  return { grid, clash };
}
const colHeight = (grid, x, z) => { let h = 0; for (let y = 0; y < 8; y++) if (grid.has(`${x},${y},${z}`)) h = y + 1; return h; };

test('Nhận diện loại mô-đun tường theo tên file', () => {
  assert.equal(wallKindOf('wall_straight_8'), 'straight');
  assert.equal(wallKindOf('wall_embrasures_8'), 'embrasure');
  assert.equal(wallKindOf('wall_corner_90'), 'corner');
  assert.equal(wallKindOf('wall_bunker_projecting'), 'bunker');
  assert.equal(wallKindOf('wall_gate'), 'gate');
  assert.equal(wallKindOf('wall_breach_a'), 'breach');
  assert.equal(wallKindOf('wall_collapsed_b'), 'collapsed');
  assert.equal(wallKindOf('wall_end_cap'), 'end');
  assert.equal(wallKindOf('nhat_01_lo_cot_go_dat'), null);
  assert.equal(Object.keys(setFor()).length, 8);
  assert.equal(findWallSet(['nha_go', 'cong_thanh']), null);
});

test('Tuyến thẳng: các mảnh liền nhau, không chồng, lối đi giữa liên tục', () => {
  const set = setFor();
  const r = assembleWall([{ x: 20, z: 40 }, { x: 80, z: 40 }], set, { embEvery: 2 });
  assert.ok(r.pieces.length >= 8);
  assert.equal(r.pieces[0].kind, 'end');
  assert.equal(r.pieces[r.pieces.length - 1].kind, 'end');
  const { grid, clash } = paste(r.pieces);
  assert.equal(clash, 0);
  const xs = [...grid.keys()].map((k) => +k.split(',')[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  for (let x = x0; x <= x1; x++) assert.ok(colHeight(grid, x, 41) >= 2, `đứt lối đi ở x=${x}`);
});

test('Tuyến có góc: mọi hướng rẽ đều liền mạch và không chồng lên nhau', () => {
  const set = setFor();
  const paths = [
    [[20, 20], [80, 20], [80, 80]],                  // rẽ phải (xuống)
    [[80, 80], [20, 80], [20, 20]],                  // rẽ phải (xoay vòng)
    [[20, 80], [20, 20], [80, 20], [80, 80]],        // hai lần rẽ phải
    [[20, 20], [20, 80], [80, 80]],                  // rẽ trái
    [[20, 20], [80, 20], [80, 60], [50, 60], [50, 100]], // nhiều góc, cả hai phía
  ];
  for (const path of paths) {
    const pts = path.map(([x, z]) => ({ x, z }));
    for (const opts of [{}, { frontFlip: true }, { bunkerEvery: 3, gate: true, ruinPct: 30, embEvery: 2 }]) {
      const r = assembleWall(pts, set, opts);
      const { grid, clash } = paste(r.pieces);
      assert.equal(clash, 0, JSON.stringify(path) + JSON.stringify(opts));
      // Đi dọc đường tâm theo các đỉnh thực: mỗi ô phải có khối.
      const v = opts.ruinPct ? [] : r.vertices; // mảnh đổ nát cố ý có lỗ thủng
      for (let i = 1; i < v.length; i++) {
        const dx = Math.sign(v[i].x - v[i - 1].x), dz = Math.sign(v[i].z - v[i - 1].z);
        let x = v[i - 1].x, z = v[i - 1].z;
        while (x !== v[i].x || z !== v[i].z) {
          assert.ok(colHeight(grid, x, z) >= 1, `thủng tại ${x},${z} ${JSON.stringify(path)} ${JSON.stringify(opts)}`);
          x += dx; z += dz;
        }
      }
      assert.equal(r.corners, path.length - 2);
    }
  }
});

test('Đoạn gần nhau được gộp, quay ngược bị bỏ, điểm đơn lẻ không sinh gì', () => {
  const set = setFor();
  assert.equal(assembleWall([{ x: 5, z: 5 }], set).pieces.length, 0);
  const a = assembleWall([{ x: 20, z: 20 }, { x: 50, z: 20 }, { x: 80, z: 20 }], set);
  assert.equal(a.corners, 0);
  const b = assembleWall([{ x: 20, z: 20 }, { x: 80, z: 20 }, { x: 40, z: 20 }], set);
  assert.equal(b.corners, 0);
  const c = assembleWall([{ x: 20, z: 20 }, { x: 22, z: 20 }], set); // ngắn: vẫn có ít nhất một mảnh
  assert.ok(c.pieces.some((p) => p.kind !== 'end'));
});

test('Mẫu tự sinh: lô cốt, cổng, đổ nát, lỗ châu mai theo tuỳ chọn', () => {
  const set = setFor();
  const r = assembleWall([{ x: 10, z: 50 }, { x: 150, z: 50 }], set, { bunkerEvery: 4, gate: true, ruinPct: 25, embEvery: 2, seed: 7 });
  const kinds = new Set(r.pieces.map((p) => p.kind));
  for (const k of ['straight', 'embrasure', 'bunker', 'gate', 'end']) assert.ok(kinds.has(k), k);
  assert.equal(r.pieces.filter((p) => p.kind === 'gate').length, 1);
  const r2 = assembleWall([{ x: 10, z: 50 }, { x: 150, z: 50 }], set, { embEvery: 0, startCap: false, endCap: false });
  assert.ok(r2.pieces.every((p) => p.kind === 'straight'));
});
