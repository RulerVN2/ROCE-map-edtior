import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, terrainToWorld, packTerrain, unpackTerrain, applyBrush, NO_CAVE, CAVE_AUTO, CAVE_OPEN } from '../src/core/terrain.js';
import { MIN_Y } from '../src/core/constants.js';

const idx = (x, y, z) => ((y - MIN_Y) * 16 + z) * 16 + x;
const AIR = 0;
function columns(t) { // gom mọi cột của map: cols[z*size+x] = Uint16Array các khối từ MIN_Y tới 120
  const w = terrainToWorld(t), n = t.size, out = new Array(n * n);
  for (let cz = 0; cz < n / 16; cz++) for (let cx = 0; cx < n / 16; cx++) {
    const { blocks } = w.getChunk(cx, cz);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const col = new Uint16Array(120 - MIN_Y);
      for (let y = MIN_Y; y < 120; y++) col[y - MIN_Y] = blocks[idx(x, y, z)];
      out[(cz * 16 + z) * n + cx * 16 + x] = col;
    }
  }
  return out;
}

test('hang tự sinh: có hang, kín dưới mặt đất, giữ đá nền, cùng seed cho cùng kết quả', () => {
  const t = createTerrain({ size: 64, baseHeight: 80 });
  t.caveMask.fill(CAVE_AUTO);
  const cols = columns(t);
  let air = 0, total = 0;
  for (const c of cols) {
    assert.equal(c[0], 1);                                         // bedrock
    for (let y = 75; y <= 80; y++) assert.notEqual(c[y - MIN_Y], AIR); // 6 khối sát mặt đất còn nguyên
    for (let y = MIN_Y + 1; y < 75; y++) { total++; if (c[y - MIN_Y] === AIR) air++; }
  }
  const ratio = air / total;
  assert.ok(ratio > 0.02 && ratio < 0.4, 'tỉ lệ rỗng ' + ratio);
  const again = columns(t);
  assert.deepEqual(again[1000], cols[1000]);
  t.cave.seed = 999;
  assert.notDeepEqual(columns(t).map((c) => c.join()).join(), cols.map((c) => c.join()).join());
  // Không đánh dấu thì không có hang.
  const plain = createTerrain({ size: 16, baseHeight: 80 });
  assert.ok(columns(plain).every((c) => { for (let y = MIN_Y + 1; y <= 80; y++) if (c[y - MIN_Y] === AIR) return false; return true; }));
});

test('cửa hang: khoét thông từ mặt đất xuống hang bên dưới', () => {
  const t = createTerrain({ size: 64, baseHeight: 80 });
  t.caveMask.fill(CAVE_AUTO);
  const cols = columns(t);
  let pick = -1, topAir = 0;
  for (let i = 0; i < cols.length && pick < 0; i++) for (let y = 74; y >= 50; y--) if (cols[i][y - MIN_Y] === AIR) { pick = i; topAir = y; break; }
  assert.ok(pick >= 0);
  t.caveMask[pick] |= CAVE_OPEN;
  const c = columns(t)[pick];
  for (let y = topAir; y <= 81; y++) assert.equal(c[y - MIN_Y], AIR, 'y=' + y);
});

test('đào hang bằng cọ: sàn phẳng, trần vòm, chừa trần; lưu và mở giữ các lớp hang', () => {
  const t = createTerrain({ size: 32, baseHeight: 70 });
  assert.ok(applyBrush(t, 16, 16, { tool: 'cavedig', radius: 6, strength: 1, dt: 0.016, target: 50, caveHeight: 8 }));
  const i = 16 * 32 + 16;
  assert.equal(t.caveFloor[i], 50); assert.equal(t.caveHeight[i], 8);
  assert.ok(t.caveHeight[16 * 32 + 21] < 8);
  assert.equal(t.caveFloor[0], NO_CAVE);
  const t2 = unpackTerrain(packTerrain(t));
  assert.equal(t2.caveFloor[i], 50); assert.equal(t2.cave.density, 5);
  const c = columns(t2)[i];
  assert.notEqual(c[50 - MIN_Y], AIR);
  for (let y = 51; y <= 58; y++) assert.equal(c[y - MIN_Y], AIR);
  assert.notEqual(c[59 - MIN_Y], AIR);
  // Hang quá sát mặt đất bị chặn lại, chừa 3 khối trần.
  applyBrush(t, 16, 16, { tool: 'cavedig', radius: 3, strength: 1, dt: 0.016, target: 64, caveHeight: 20 });
  const c2 = columns(t)[i];
  assert.equal(c2[67 - MIN_Y], AIR); assert.notEqual(c2[68 - MIN_Y], AIR); assert.notEqual(c2[70 - MIN_Y], AIR);
  // Shift: lấp lại.
  applyBrush(t, 16, 16, { tool: 'cavedig', radius: 8, strength: 1, dt: 0.016, invert: true });
  assert.equal(t.caveFloor[i], NO_CAVE);
});

test('viền ngoài map: núi cao hơn mép, biển có nước; không viền thì ngoài map trống', () => {
  const t = createTerrain({ size: 32, baseHeight: 70 });
  const top = (w, cx, cz, x, z) => { const { blocks } = w.getChunk(cx, cz); for (let y = 310; y >= MIN_Y; y--) if (blocks[idx(x, y, z)] !== AIR) return [y, blocks[idx(x, y, z)]]; return null; };
  const m = terrainToWorld(t, { rim: 'mountain', rimWidth: 48 });
  assert.deepEqual(m.chunkBounds, { minX: -3, minZ: -3, maxX: 4, maxZ: 4 });
  const near = top(m, -1, 0, 15, 5), far = top(m, -2, 0, 4, 5);       // cách mép 1 khối và 28 khối
  assert.ok(Math.abs(near[0] - 70) <= 4, 'sát mép gần bằng mép: ' + near[0]);
  assert.ok(far[0] > 90, 'núi cao: ' + far[0]);
  assert.equal(top(m, -4, -4, 0, 0), null);                              // ngoài bề rộng viền: trống
  const s = terrainToWorld(t, { rim: 'sea', rimWidth: 48 });
  const sea = top(s, 3, 0, 8, 5);                                        // cách mép 25 khối
  assert.deepEqual(sea, [62, 15]);                                       // mặt nước ở y=62
  const none = terrainToWorld(t, {});
  assert.deepEqual(none.chunkBounds, { minX: 0, minZ: 0, maxX: 1, maxZ: 1 });
  // Trong map không đổi dù có viền.
  assert.deepEqual(top(m, 0, 0, 3, 3), top(none, 0, 0, 3, 3));
});
