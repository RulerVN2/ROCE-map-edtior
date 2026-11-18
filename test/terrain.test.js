import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTerrain, applyBrush, heightAt, materialAt, waterAt, terrainToWorld, packTerrain, unpackTerrain,
  MAT, NO_WATER, BIOMES,
} from '../src/core/terrain.js';
import { MIN_Y } from '../src/core/constants.js';

const blockAt = (w, x, y, z) => {
  const c = w.getChunk(x >> 4, z >> 4);
  return w.blockPalette[c.blocks[((y - MIN_Y) * 16 + (z & 15)) * 16 + (x & 15)]].Name;
};
const biomeAt = (w, x, z) => {
  const c = w.getChunk(x >> 4, z >> 4);
  return w.biomePalette[c.biomes[(10 * 4 + ((z & 15) >> 2)) * 4 + ((x & 15) >> 2)]];
};

test('Cọ nâng làm cao tâm nhiều hơn mép, cọ hạ thì ngược lại', () => {
  const t = createTerrain({ size: 64 });
  applyBrush(t, 32, 32, { tool: 'raise', radius: 8, strength: 1, dt: 0.5 });
  assert.ok(heightAt(t, 32, 32) > heightAt(t, 37, 32));
  assert.equal(heightAt(t, 45, 32), 64);
  const peak = t.heights[32 * 64 + 32];
  applyBrush(t, 32, 32, { tool: 'raise', radius: 8, strength: 1, dt: 0.5, invert: true });
  assert.ok(t.heights[32 * 64 + 32] < peak);
});

test('San phẳng kéo về độ cao đích, làm mịn giảm chênh lệch', () => {
  const t = createTerrain({ size: 64 });
  applyBrush(t, 32, 32, { tool: 'raise', radius: 10, strength: 1, dt: 1 });
  for (let i = 0; i < 60; i++) applyBrush(t, 32, 32, { tool: 'flatten', radius: 6, strength: 1, dt: 0.1, target: 70 });
  assert.equal(heightAt(t, 32, 32), 70);
  const t2 = createTerrain({ size: 64 });
  t2.heights[32 * 64 + 32] = 100;
  for (let i = 0; i < 30; i++) applyBrush(t2, 32, 32, { tool: 'smooth', radius: 6, strength: 1, dt: 0.1 });
  assert.ok(t2.heights[32 * 64 + 32] < 70);
});

test('Vách đá dựng khối vách đứng, mép là đá', () => {
  const t = createTerrain({ size: 64 });
  applyBrush(t, 32, 32, { tool: 'cliff', radius: 6, strength: 1, dt: 0.016, target: 76 });
  assert.equal(heightAt(t, 32, 32), 76);
  assert.equal(heightAt(t, 36, 32), 76);
  assert.equal(heightAt(t, 39, 32), 64);
  assert.equal(materialAt(t, 37, 32), MAT.STONE);
  assert.equal(materialAt(t, 32, 32), MAT.GRASS);
});

test('Sông hồ đào lòng và đổ nước; đắp đất lên thì hết nước; Shift xoá nước', () => {
  const t = createTerrain({ size: 64 });
  applyBrush(t, 32, 32, { tool: 'river', radius: 5, strength: 1, dt: 0.016, target: 63 });
  assert.equal(waterAt(t, 32, 32), 63);
  assert.equal(heightAt(t, 32, 32), 60);
  assert.ok(heightAt(t, 36, 32) < 63);
  assert.equal(waterAt(t, 40, 32), NO_WATER);
  const w = terrainToWorld(t);
  assert.equal(blockAt(w, 32, 63, 32), 'minecraft:water');
  assert.equal(blockAt(w, 32, 61, 32), 'minecraft:water');
  assert.equal(blockAt(w, 32, 60, 32), 'minecraft:sand');
  assert.equal(blockAt(w, 32, 64, 32), 'minecraft:air');
  for (let i = 0; i < 20; i++) applyBrush(t, 32, 32, { tool: 'raise', radius: 3, strength: 1, dt: 0.05 });
  assert.equal(waterAt(t, 32, 32), NO_WATER);
  applyBrush(t, 32, 32, { tool: 'river', radius: 8, strength: 1, dt: 0.016, target: 63, invert: true });
  assert.equal(waterAt(t, 36, 32), NO_WATER);
});

test('Tô vật liệu và biome đi đúng vào world xuất ra', () => {
  const t = createTerrain({ size: 64 });
  applyBrush(t, 10, 10, { tool: 'paint', radius: 3, material: MAT.COBBLE });
  applyBrush(t, 40, 40, { tool: 'paint', radius: 3, material: MAT.PATH });
  const snowy = BIOMES.findIndex((b) => b.id === 'minecraft:snowy_plains') + 1;
  const desert = BIOMES.findIndex((b) => b.id === 'minecraft:desert') + 1;
  applyBrush(t, 50, 12, { tool: 'biome', radius: 7, biome: snowy });
  applyBrush(t, 12, 50, { tool: 'biome', radius: 7, biome: desert });
  const w = terrainToWorld(t);
  assert.equal(blockAt(w, 10, 64, 10), 'minecraft:cobblestone');
  assert.equal(blockAt(w, 10, 63, 10), 'minecraft:stone');
  assert.equal(blockAt(w, 40, 64, 40), 'minecraft:dirt_path');
  assert.equal(blockAt(w, 50, 64, 12), 'minecraft:grass_block');
  assert.equal(blockAt(w, 50, 65, 12), 'minecraft:snow');
  assert.equal(biomeAt(w, 50, 12), 'minecraft:snowy_plains');
  assert.equal(blockAt(w, 12, 64, 50), 'minecraft:sand');
  assert.equal(blockAt(w, 12, 62, 50), 'minecraft:sandstone');
  assert.equal(biomeAt(w, 12, 50), 'minecraft:desert');
  assert.equal(biomeAt(w, 30, 30), 'minecraft:plains');
  applyBrush(t, 10, 10, { tool: 'paint', radius: 3, material: 0 });
  assert.equal(blockAt(terrainToWorld(t), 10, 64, 10), 'minecraft:grass_block');
});

test('Quy tắc tự động: dốc ra đá, cao ra tuyết, lớp đất chỉnh được', () => {
  const t = createTerrain({ size: 64 });
  for (let z = 0; z < 64; z++) for (let x = 40; x < 64; x++) t.heights[z * 64 + x] = 90;
  assert.equal(materialAt(t, 10, 10), MAT.GRASS);
  assert.equal(materialAt(t, 40, 10), MAT.STONE);
  t.rules.snowLine = 85;
  assert.equal(materialAt(t, 50, 10), MAT.SNOW);
  t.rules.dirtDepth = 5;
  const w = terrainToWorld(t, { name: 'x' });
  assert.equal(blockAt(w, 10, 59, 10), 'minecraft:dirt');
  assert.equal(blockAt(w, 10, 58, 10), 'minecraft:stone');
  assert.equal(blockAt(w, 10, -64, 10), 'minecraft:bedrock');
  assert.deepEqual(w.spawn, [32, 66, 32]);
});

test('Đóng gói rồi mở lại dự án giữ nguyên mọi lớp', () => {
  const t = createTerrain({ size: 32, baseBiome: 'minecraft:taiga' });
  applyBrush(t, 16, 16, { tool: 'raise', radius: 6, strength: 1, dt: 0.3 });
  applyBrush(t, 5, 5, { tool: 'river', radius: 3, strength: 1, dt: 0.016, target: 63 });
  applyBrush(t, 25, 25, { tool: 'paint', radius: 2, material: MAT.MUD });
  applyBrush(t, 25, 5, { tool: 'biome', radius: 2, biome: 3 });
  t.rules.snowLine = 123;
  const p = packTerrain(t);
  // Giả lập đường đi qua tệp: mỗi lớp thành mảng byte thô.
  const raw = {};
  for (const [k, v] of Object.entries(p.layers)) raw[k] = new Uint8Array(v.buffer.slice(0));
  const u = unpackTerrain({ meta: JSON.parse(JSON.stringify(p.meta)), layers: raw });
  assert.equal(u.baseBiome, 'minecraft:taiga'); assert.equal(u.rules.snowLine, 123);
  for (const k of ['heights', 'water', 'material', 'biome']) assert.deepEqual(u[k], t[k], k);
  assert.throws(() => unpackTerrain({ meta: { format: 'khac' }, layers: {} }));
});

import { applyBrush as applyB2, createTerrain as createT2 } from '../src/core/terrain.js';
test('cọ "Bậc độ cao": mặt phẳng đúng độ cao, sườn thoải, Shift hạ xuống', () => {
  const t = createT2({ size: 64, baseHeight: 60 });
  applyB2(t, 32, 32, { tool: 'elev', radius: 12, slope: 4, target: 64, dt: 0.016, strength: 1, base: t.heights.slice() });
  assert.equal(t.heights[32 * 64 + 32], 64);
  assert.equal(t.heights[32 * 64 + 38], 64);
  const mid = t.heights[32 * 64 + 42];
  assert.ok(mid > 60 && mid < 64, 'sườn ở giữa ' + mid);
  assert.equal(t.heights[32 * 64 + 50], 60);
  applyB2(t, 10, 10, { tool: 'elev', radius: 6, slope: 0, target: 52, dt: 0.016, strength: 1, base: t.heights.slice() });
  assert.equal(t.heights[10 * 64 + 10], 52);
  assert.equal(t.heights[10 * 64 + 20], 60);
});
