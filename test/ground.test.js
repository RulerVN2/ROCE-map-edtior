import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseSchem } from '../src/core/schem.js';
import {
  createTerrain, applyBrush, makePlacement, placementBox, terrainToWorld, packTerrain, unpackTerrain, heightAt,
  MAT, MATERIALS, BLOCK_PALETTE, PATTERNS, patternMat, PAD_STYLES, prepareSite, NO_WATER,
} from '../src/core/terrain.js';
import { MIN_Y } from '../src/core/constants.js';

const hut = parseSchem(fs.readFileSync(new URL('./fixtures/hut.schem', import.meta.url)));
const blockAt = (w, x, y, z) => {
  const c = w.getChunk(x >> 4, z >> 4);
  return w.blockPalette[c.blocks[((y - MIN_Y) * 16 + (z & 15)) * 16 + (x & 15)]];
};

test('Mẫu nền: vật liệu hợp lệ, cố định theo toạ độ, tỉ lệ gần với trọng số', () => {
  assert.ok(PATTERNS.length >= 15);
  for (let pi = 0; pi < PATTERNS.length; pi++) {
    const P = PATTERNS[pi], count = new Map();
    for (let z = 0; z < 160; z++) for (let x = 0; x < 160; x++) {
      const m = patternMat(pi, x, z);
      assert.ok(MATERIALS[m], `${P.name}: vật liệu ${m} không có`);
      assert.equal(patternMat(pi, x, z), m);
      count.set(m, (count.get(m) ?? 0) + 1);
    }
    for (const [m] of P.mix ?? [[P.main], [P.seam]]) assert.ok(count.get(m) > 160 * 160 * 0.02, `${P.name}: thiếu ${MATERIALS[m].name}`);
    if (P.mix && !P.kind) {
      const tot = P.mix.reduce((a, [, w]) => a + w, 0), top = P.mix[0];
      const share = count.get(top[0]) / (160 * 160);
      assert.ok(Math.abs(share - top[1] / tot) < 0.22, `${P.name}: tỉ lệ ${share.toFixed(2)} lệch xa ${(top[1] / tot).toFixed(2)}`);
    }
  }
});

test('Cọ mẫu nền: mép mờ dần, hai nét kề nhau khớp nhau, Shift xoá', () => {
  const t = createTerrain({ size: 128 });
  const o = { tool: 'pattern', radius: 14, strength: 1, dt: 1, pattern: 0 };
  applyBrush(t, 40, 40, o);
  const at = (x, z) => t.material[z * 128 + x];
  assert.ok(at(40, 40) > 0 && at(44, 40) > 0);
  let painted = 0, ring = 0;
  for (let z = 26; z <= 54; z++) for (let x = 26; x <= 54; x++) {
    const d = Math.hypot(x - 40, z - 40);
    if (d > 11 && d < 14) { ring++; if (at(x, z)) painted++; }
  }
  assert.ok(painted > 0 && painted < ring * 0.7, `mép ${painted}/${ring}`);
  applyBrush(t, 52, 40, o);
  for (let z = 30; z <= 50; z++) for (let x = 40; x <= 50; x++) if (at(x, z)) assert.equal(at(x, z), patternMat(0, x, z));
  applyBrush(t, 40, 40, { ...o, invert: true });
  assert.equal(at(40, 40), 0);
});

test('prepareSite: san phẳng khung và dải quanh, thoải dần ra ngoài, tô sân, xoá nước bị đắp', () => {
  const t = createTerrain({ size: 96, baseHeight: 60 });
  for (let z = 0; z < 96; z++) for (let x = 0; x < 96; x++) t.heights[z * 96 + x] = 60 + x * 0.3 + (z % 7) * 0.4; // dốc và gồ ghề
  t.water[40 * 96 + 36] = 70; t.heights[40 * 96 + 36] = 66;
  const box = { x0: 30, z0: 30, x1: 36, z1: 40 }, level = 70;
  assert.ok(prepareSite(t, box, level, { margin: 2, style: 0 }));
  for (let z = 30; z <= 40; z++) for (let x = 28; x <= 38; x++) assert.equal(t.heights[z * 96 + x], level, `${x},${z}`);
  for (let z = 28; z <= 42; z++) for (let x = 30; x <= 36; x++) assert.equal(t.heights[z * 96 + x], level, `${x},${z}`);
  assert.equal(t.water[40 * 96 + 36], NO_WATER);
  assert.ok(t.heights[35 * 96 + 41] !== 70 && Math.abs(t.heights[35 * 96 + 41] - 70) < Math.abs(60 + 41 * 0.3 + (35 % 7) * 0.4 - 70) + 0.001);
  assert.equal(t.heights[35 * 96 + 70], 60 + 70 * 0.3 + (35 % 7) * 0.4); // xa thì giữ nguyên
  const apron = new Set([MAT.COBBLE, MAT.GRAVEL]);
  assert.ok(apron.has(t.material[35 * 96 + 33]) && apron.has(t.material[29 * 96 + 33]));
  assert.equal(t.material[35 * 96 + 60], 0);
  let ring = 0; for (let x = 20; x < 28; x++) if (t.material[35 * 96 + x]) ring++;
  assert.equal(ring, 0);
});

test('Móng: công trình trên sườn dốc có móng từ mặt đất lên sát sàn; không móng thì để nguyên', () => {
  const t = createTerrain({ size: 64, baseHeight: 60 });
  for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) t.heights[z * 64 + x] = 60 - 2 * Math.max(0, x - 20); // x > 20 thấp dần
  const lib = new Map([['hut', hut]]);
  const a = makePlacement(t, hut, 'hut', 22, 30, { rot: 0 });
  const b = makePlacement(t, hut, 'hut', 22, 50, { rot: 0 }); b.y = a.y; // cùng độ cao sàn
  a.found = 'minecraft:cobblestone';
  t.placements.push(a, b);
  assert.ok(PAD_STYLES.every((s) => /^minecraft:[a-z_]+$/.test(s.block)));
  const w = terrainToWorld(t, {}, lib);
  const ba = placementBox(a, hut), bb = placementBox(b, hut);
  const gA = heightAt(t, ba.x1, ba.z0);
  assert.ok(a.y - 1 > gA + 2);
  for (let y = gA; y < a.y; y++) assert.equal(blockAt(w, ba.x1, y, ba.z0).Name, 'minecraft:cobblestone', `móng thiếu y=${y}`);
  assert.equal(blockAt(w, ba.x1, a.y, ba.z0).Name, 'minecraft:oak_planks'); // sàn công trình nằm trên móng
  const gB = heightAt(t, bb.x1, bb.z0);
  assert.notEqual(blockAt(w, bb.x1, gB + 1, bb.z0).Name, 'minecraft:cobblestone'); // không bật móng: giữ nguyên
  // lưu và mở lại giữ trường móng
  const u = unpackTerrain({ meta: JSON.parse(JSON.stringify(packTerrain(t).meta)), layers: packTerrain(t).layers });
  assert.equal(u.placements[0].found, 'minecraft:cobblestone');
});

test('Bảng vật liệu mới tham chiếu đúng bảng khối', () => {
  for (const m of MATERIALS) if (m) for (const k of ['top', 'under']) assert.ok(BLOCK_PALETTE[m[k]], `${m.name}.${k}`);
  assert.equal(BLOCK_PALETTE[MATERIALS[MAT.REDBRICK].top].Name, 'minecraft:bricks');
});
