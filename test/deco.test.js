import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, terrainToWorld, packTerrain, unpackTerrain, applyBrush, DECO, BLOCK_PALETTE, MAT } from '../src/core/terrain.js';
import { MIN_Y } from '../src/core/constants.js';

const idx = (x, y, z) => ((y - MIN_Y) * 16 + z) * 16 + x;

test('danh mục trang trí hợp lệ', () => {
  const keys = new Set();
  for (const d of DECO) {
    assert.ok(BLOCK_PALETTE[d.b], d.key); assert.ok(d.up === undefined || BLOCK_PALETTE[d.up], d.key);
    assert.ok(!keys.has(d.key)); keys.add(d.key);
  }
  assert.ok(DECO.length < 255);
});

test('cọ trang trí: rải ngẫu nhiên đúng loại đã chọn, Shift xoá, lưu/mở giữ nguyên', () => {
  const t = createTerrain({ size: 64, baseHeight: 60 });
  const poppy = DECO.findIndex((d) => d.key === 'poppy') + 1, grass = DECO.findIndex((d) => d.key === 'grass') + 1;
  applyBrush(t, 32, 32, { tool: 'deco', radius: 10, density: 1, decoList: [poppy, grass], dt: 0.016, strength: 1 });
  const got = new Set(); let n = 0;
  for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) { const v = t.deco[z * 64 + x]; if (v) { got.add(v); n++; } }
  assert.deepEqual([...got].sort(), [grass, poppy].sort());
  assert.ok(n > 150, 'số ô rải ' + n);
  assert.equal(t.deco[0], 0);
  const back = unpackTerrain(packTerrain(t));
  assert.deepEqual(back.deco, t.deco);
  applyBrush(t, 32, 32, { tool: 'deco', radius: 12, invert: true, dt: 0.016, strength: 1 });
  assert.ok(t.deco.every((v) => v === 0));
});

test('xuất world: hoa trên cỏ, cây cao hai khối, không mọc trên đá hay dưới nước', () => {
  const t = createTerrain({ size: 32, baseHeight: 70 });
  const sun = DECO.findIndex((d) => d.key === 'sunflower') + 1, poppy = DECO.findIndex((d) => d.key === 'poppy') + 1;
  t.deco[5 * 32 + 5] = poppy; t.deco[5 * 32 + 6] = sun;
  t.deco[5 * 32 + 7] = poppy; t.material[5 * 32 + 7] = MAT.STONE;        // đá: không đặt
  t.deco[5 * 32 + 8] = poppy; t.water[5 * 32 + 8] = 75;                  // dưới nước: không đặt
  const { blocks } = terrainToWorld(t).getChunk(0, 0);
  assert.equal(blocks[idx(5, 71, 5)], DECO[poppy - 1].b);
  assert.equal(blocks[idx(6, 71, 5)], DECO[sun - 1].b);
  assert.equal(blocks[idx(6, 72, 5)], DECO[sun - 1].up);
  assert.equal(blocks[idx(7, 71, 5)], 0);
  assert.notEqual(blocks[idx(8, 71, 5)], DECO[poppy - 1].b);
});
