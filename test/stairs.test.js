import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, digRamp, terrainToWorld, NO_CAVE } from '../src/core/terrain.js';
import { makeMob } from '../src/core/mobs.js';

const flat = () => { const t = createTerrain({ size: 128 }); t.heights.fill(70); return t; };

test('dốc hang: sàn hạ dần 1 khối mỗi 2 khối, có sân bằng cuối', () => {
  const t = flat();
  const n = digRamp(t, 20, 64, 60, 64, { depth: 10, width: 2, tall: 5 });
  assert.ok(n > 0);
  const fl = (x) => t.caveFloor[64 * 128 + x];
  assert.equal(fl(20), 70);
  assert.equal(fl(24), 68);
  assert.equal(fl(40), 60);
  assert.equal(fl(45), 60); // sân bằng
  for (let x = 21; x < 45; x++) assert.ok(fl(x - 1) - fl(x) <= 1 && fl(x - 1) >= fl(x));
  assert.equal(t.caveFloor[(64 + 3) * 128 + 30], NO_CAVE); // ngoài bề rộng
});

test('dốc hang: Shift lấp lại', () => {
  const t = flat();
  digRamp(t, 20, 64, 60, 64, { depth: 10, width: 2 });
  digRamp(t, 20, 64, 60, 64, { depth: 10, width: 2, invert: true });
  assert.ok(t.caveFloor.every((v) => v === NO_CAVE));
});

test('xuất world: lối dốc thông ra mặt đất và mob trong hang đứng trên sàn hang', () => {
  const t = flat();
  digRamp(t, 20, 64, 60, 64, { depth: 12, width: 2, tall: 5 });
  t.mobs.push(makeMob({ id: 'minecraft:zombie', x: 50.5, z: 64.5, cave: true }));
  t.mobs.push(makeMob({ id: 'minecraft:zombie', x: 100.5, z: 100.5, cave: true })); // không có hang: đứng mặt đất
  const w = terrainToWorld(t, {});
  const y0 = w.entities[0].pos[1], y1 = w.entities[1].pos[1];
  assert.ok(y0 < 64, 'mob trong hang phải thấp hơn mặt đất, được ' + y0);
  assert.equal(y1, 71);
});

test('xuất world: sàn đặc, khoảng trên sàn là không khí, đi suốt từ cửa tới sân cuối', () => {
  const t = flat();
  digRamp(t, 20, 64, 60, 64, { depth: 12, width: 2, tall: 5 });
  const w = terrainToWorld(t, {});
  const air = new Set(); // chỉ số khối không khí = 0 trong bảng khối
  const col = (x, z) => { const c = w.getChunk(x >> 4, z >> 4); return (y) => c.blocks[((y + 64) * 16 + (z & 15)) * 16 + (x & 15)]; };
  // lần lượt đi dọc trục: mỗi cột phải có chỗ đứng cách chỗ đứng cột trước tối đa 1 khối
  let prev = 70;
  for (let x = 20; x <= 50; x++) {
    const at = col(x, 64);
    let stand = null;
    for (let y = prev + 1; y > 40; y--) if (at(y) === 0 && at(y + 1) === 0 && at(y - 1) !== 0) { stand = y; break; }
    assert.notEqual(stand, null, 'không có chỗ đứng ở x=' + x);
    assert.ok(Math.abs(stand - prev) <= 1, `bước nhảy quá cao ở x=${x}: ${prev} -> ${stand}`);
    prev = stand;
  }
  assert.ok(prev <= 60);
});
