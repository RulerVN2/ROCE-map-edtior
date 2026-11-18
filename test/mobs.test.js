import test from 'node:test';
import assert from 'node:assert/strict';
import * as nbt from '../src/core/nbt.js';
import { parseSnbt } from '../src/core/snbt.js';
import { checkMobSpec, formationPoints, makeMob, MOB_CATALOG } from '../src/core/mobs.js';
import { createTerrain, terrainToWorld, makePlacement, packTerrain, unpackTerrain } from '../src/core/terrain.js';

test('SNBT: kiểu dữ liệu, danh sách, mảng, chuỗi', () => {
  const t = parseSnbt('{NoAI:1b, Health:20.5f, Age:-3, Big:5l, S:7s, D:1.5, E:2d, T:true, Name:"A \\"b\\"", Tags:["x","y"], Pos2:[1.0d,2.0d], Arr:[I;1,2,3], B:[B;1b,2b], L:[L;1l,-2l], C:{k:\'v\'}, Items:[{id:"minecraft:stone",Count:1b},{}], Emp:[]}');
  assert.equal(t.NoAI.t, nbt.TAG.BYTE); assert.equal(t.NoAI.v, 1);
  assert.equal(t.Health.t, nbt.TAG.FLOAT); assert.equal(t.Health.v, 20.5);
  assert.equal(t.Age.t, nbt.TAG.INT); assert.equal(t.Age.v, -3);
  assert.equal(t.Big.t, nbt.TAG.LONG); assert.equal(t.Big.v, 5n);
  assert.equal(t.S.t, nbt.TAG.SHORT);
  assert.equal(t.D.t, nbt.TAG.DOUBLE); assert.equal(t.E.t, nbt.TAG.DOUBLE);
  assert.equal(t.T.v, 1);
  assert.equal(t.Name.v, 'A "b"');
  assert.deepEqual(t.Tags.v.items, ['x', 'y']);
  assert.equal(t.Pos2.v.elemType, nbt.TAG.DOUBLE);
  assert.deepEqual([...t.Arr.v], [1, 2, 3]);
  assert.equal(t.C.v.k.v, 'v');
  assert.equal(t.Items.v.items.length, 2);
  assert.equal(t.Emp.v.items.length, 0);
  // Ghi ra NBT thật rồi đọc lại bằng bộ đọc độc lập trong nbt.js.
  const back = nbt.decode(nbt.encode(nbt.compound(t)));
  assert.equal(back.Name, 'A "b"');
  assert.deepEqual(back.Tags, ['x', 'y']);
  assert.equal(back.Items[0].id, 'minecraft:stone');
  assert.deepEqual(parseSnbt(''), {});
  assert.deepEqual(parseSnbt('{}'), {});
});

test('SNBT: báo lỗi rõ ràng', () => {
  assert.throws(() => parseSnbt('{a:1'), /Thiếu/);
  assert.throws(() => parseSnbt('{a:[1,2.0d]}'), /cùng kiểu/);
  assert.throws(() => parseSnbt('hello'), /bắt đầu/);
  assert.throws(() => parseSnbt('{a:1} x'), /thừa/);
});

test('mẫu mob có sẵn đều hợp lệ', () => {
  for (const m of MOB_CATALOG) assert.equal(checkMobSpec(m.id, m.snbt), null, m.key);
  assert.match(checkMobSpec('Zombie', ''), /ID mob/);
  assert.match(checkMobSpec('minecraft:zombie', '{x'), /NBT/);
  assert.equal(checkMobSpec('recruits:recruit', '{Tags:["a"]}'), null);
});

test('đội hình: đủ số lượng, tâm đúng, hàng ngang vuông góc hướng mặt', () => {
  for (const f of ['line', 'grid', 'scatter']) {
    const pts = formationPoints(20, f, 2, 0, 100, 100);
    assert.equal(pts.length, 20, f);
    const cx = pts.reduce((a, p) => a + p.x, 0) / 20, cz = pts.reduce((a, p) => a + p.z, 0) / 20;
    assert.ok(Math.hypot(cx - 100, cz - 100) < (f === 'scatter' ? 4 : 0.8), f);
  }
  const line = formationPoints(5, 'line', 2, 0, 50, 50); // hướng nam (+z): hàng chạy theo x
  assert.ok(line.every((p) => Math.abs(p.z - 50.5) < 1e-9 && p.x % 1 === 0.5)); // nằm giữa ô khối
  assert.equal(new Set(line.map((p) => p.x.toFixed(3))).size, 5);
  const line90 = formationPoints(5, 'line', 2, 90, 50, 50); // hướng tây: hàng chạy theo z
  assert.ok(line90.every((p) => Math.abs(p.x - 50.5) < 1e-9));
  assert.equal(formationPoints(1, 'grid', 2, 0, 7, 8)[0].x, 7);
});

function hut() { // 3x4x3: sàn y=0, tường y=1..2 quanh rìa, mái y=3
  const w = 3, h = 4, l = 3, data = new Array(w * h * l).fill(0);
  for (let y = 0; y < h; y++) for (let z = 0; z < l; z++) for (let x = 0; x < w; x++) {
    const edge = x === 0 || z === 0 || x === w - 1 || z === l - 1;
    if (y === 0 || y === 3 || ((y === 1 || y === 2) && edge)) data[(y * l + z) * w + x] = 1;
  }
  return { w, h, l, palette: ['minecraft:air', 'minecraft:oak_planks'], data, blockEntities: [] };
}

test('xuất mob: đúng độ cao trên đất, trong nhà, trên tường; lưu và mở dự án giữ mob', () => {
  const t = createTerrain({ size: 64, baseHeight: 64 });
  const lib = new Map([['hut.schem', hut()]]);
  t.placements.push(makePlacement(t, lib.get('hut.schem'), 'hut.schem', 20, 20, {}));
  const mk = (x, z, extra = {}) => makeMob({ id: 'minecraft:zombie', x, z, ...extra });
  t.mobs.push(mk(5.5, 5.5), mk(20.5, 20.5), mk(19.5, 20.5), mk(5.5, 5.5, { dy: 2, noAI: true, snbt: '{Tags:["linh"],NoAI:0b}' }));
  const t2 = unpackTerrain(packTerrain(t));
  assert.equal(t2.mobs.length, 4);
  const w = terrainToWorld(t2, {}, lib);
  assert.equal(w.entities.length, 4);
  const [a, inside, wall, c] = w.entities;
  assert.equal(a.pos[1], 65);                   // mặt đất cao 64, chân đứng ở 65
  assert.equal(inside.pos[1], 66);              // sàn nhà nằm ở y=65, chân đứng ngay trên sàn
  assert.equal(wall.pos[1], 69);                // ô tường: đứng trên mái (mái ở y=68)
  assert.ok(wall.pos[1] > inside.pos[1]);       // ô tường: đứng trên mái
  assert.equal(c.pos[1], 67);                   // dy=2 cộng thêm
  assert.equal(c.nbt.NoAI.v, 0);                // NBT người dùng gõ thắng cờ NoAI
  assert.deepEqual(c.nbt.Tags.v.items, ['linh']);
  assert.equal(a.nbt.PersistenceRequired.v, 1);
});
