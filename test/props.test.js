import test from 'node:test';
import assert from 'node:assert/strict';
import { PROP_CATALOG, PROP_BY_KEY, PROP_MIXES, PROP_SIZES, makeProp, propBlocks, pickFromMix } from '../src/core/props.js';
import { createTerrain, applyBrush, terrainToWorld, packTerrain, unpackTerrain, heightAt, MAT, MATERIALS, BLOCK_PALETTE } from '../src/core/terrain.js';
import { MIN_Y } from '../src/core/constants.js';

const blockAt = (w, x, y, z) => {
  const c = w.getChunk(x >> 4, z >> 4);
  return w.blockPalette[c.blocks[((y - MIN_Y) * 16 + (z & 15)) * 16 + (x & 15)]];
};
const STATE = /^minecraft:[a-z_]+(\[[a-z_]+=[a-z0-9_]+(,[a-z_]+=[a-z0-9_]+)*\])?$/;

test('Mọi cây và vật thể sinh được khối hợp lệ, trong vùng hợp lý, cùng hạt giống ra cùng kết quả', () => {
  assert.ok(PROP_CATALOG.length >= 80);
  for (const d of PROP_CATALOG) {
    const variants = d.variants ? d.variants.map((_, i) => i) : [undefined];
    for (const v of variants) for (const sc of [0.65, 1, 1.6]) for (let s = 1; s <= 8; s++) {
      const p = { k: d.key, x: 0, z: 0, s, sc, v };
      const bl = propBlocks(p);
      assert.ok(bl.length > 0, `${d.key} rỗng`);
      for (const [x, y, z, st] of bl) {
        assert.ok(Math.abs(x) <= 14 && Math.abs(z) <= 14 && y >= -8 && y <= 40, `${d.key} ra ngoài vùng: ${x},${y},${z}`);
        assert.match(st, STATE, `${d.key}: trạng thái khối lạ ${st}`);
      }
      assert.deepEqual(propBlocks(p), bl);
    }
  }
  for (const m of PROP_MIXES) for (const [k] of m.items) assert.ok(PROP_BY_KEY[k], `hỗn hợp ${m.key} có khoá lạ ${k}`);
  assert.ok(PROP_MIXES.some((m) => pickFromMix(m, () => 0.99)));
});

test('makeProp: cỡ theo lựa chọn, có dạng mặc định cho khoáng sản', () => {
  const small = makeProp('oak', 5, 6, { size: 'small', seed: 1 }), big = makeProp('oak', 5, 6, { size: 'big', seed: 1 });
  assert.ok(small.sc < 0.9 && big.sc > 1.2);
  assert.equal(makeProp('ore_iron', 1, 1).v, 2);
  assert.equal(makeProp('ore_iron', 1, 1, { v: 0 }).v, 0);
  assert.throws(() => makeProp('khong_co', 1, 1));
  assert.ok(PROP_SIZES.length === 4);
});

function flat(size = 96, h = 64) { return createTerrain({ size, baseHeight: h }); }

test('Xuất world: cây có thân và lá, lá không mọc đè lên đất, cây trong nước bị bỏ', () => {
  const t = flat();
  t.props.push({ k: 'oak', x: 40, z: 40, s: 5, sc: 1 });
  for (let z = 70; z <= 76; z++) for (let x = 70; x <= 76; x++) t.water[z * t.size + x] = 66, t.heights[z * t.size + x] = 60;
  t.props.push({ k: 'oak', x: 73, z: 73, s: 6, sc: 1 });
  const w = terrainToWorld(t);
  assert.equal(blockAt(w, 40, 64, 40).Name, 'minecraft:grass_block');
  assert.equal(blockAt(w, 40, 65, 40).Name, 'minecraft:oak_log');
  let leaves = 0;
  for (let y = 66; y < 75; y++) for (let z = 36; z <= 44; z++) for (let x = 36; x <= 44; x++) if (blockAt(w, x, y, z).Name === 'minecraft:oak_leaves') leaves++;
  assert.ok(leaves > 15, 'ít lá: ' + leaves);
  assert.equal(blockAt(w, 73, 61, 73).Name !== 'minecraft:oak_log', true);
  const lv = blockAt(w, 40, 68, 40);
  assert.ok(!lv.Name.includes('leaves') || lv.Properties.persistent === 'true');
});

test('Xuất world: hố bom đào lõm mặt đất; cây khổng lồ trên sườn dốc có chân chạm đất', () => {
  const t = flat();
  t.props.push({ k: 'crater', x: 30, z: 30, s: 3, sc: 1.2 });
  const w = terrainToWorld(t);
  assert.equal(blockAt(w, 30, 64, 30).Name, 'minecraft:air');
  assert.ok(['minecraft:coarse_dirt', 'minecraft:blackstone', 'minecraft:gravel'].includes(blockAt(w, 30, 62, 30).Name) || blockAt(w, 30, 63, 30).Name !== 'minecraft:grass_block');
  const s = flat();
  for (let z = 0; z < s.size; z++) for (let x = 0; x < s.size; x++) s.heights[z * s.size + x] = 64 - (x > 50 ? 6 : 0); // vách cao 6
  s.props.push({ k: 'dark_oak', x: 50, z: 40, s: 2, sc: 1 }); // thân 2x2 vắt qua mép vách: x = 50 cao 64, x = 51 cao 58
  const w2 = terrainToWorld(s);
  assert.equal(blockAt(w2, 50, 65, 40).Name, 'minecraft:dark_oak_log');
  for (let y = 59; y <= 65; y++) assert.equal(blockAt(w2, 51, y, 40).Name, 'minecraft:dark_oak_log', 'chân thân cây phải chạm đất ở y=' + y);
});

test('Cây thấp, cỏ, hoa: hoa hai tầng đủ cả nửa dưới nửa trên; vật thể lớn bị công trình che thì bỏ', () => {
  const t = flat();
  t.props.push({ k: 'sunflowers', x: 20, z: 20, s: 9, sc: 1 });
  const w = terrainToWorld(t);
  let lower = 0, upper = 0;
  for (let z = 17; z <= 23; z++) for (let x = 17; x <= 23; x++) {
    const a = blockAt(w, x, 65, z), b = blockAt(w, x, 66, z);
    if (a.Name === 'minecraft:sunflower' && a.Properties.half === 'lower') { lower++; if (b.Name === 'minecraft:sunflower' && b.Properties.half === 'upper') upper++; }
  }
  assert.ok(lower > 0 && lower === upper);
});

test('Lưu và mở dự án giữ nguyên cây; dữ liệu lạ bị bỏ', () => {
  const t = flat(64);
  t.props.push(makeProp('birch', 10, 11, { seed: 7 }), makeProp('ore_gold', 12, 13, { v: 1, seed: 8 }));
  const meta = JSON.parse(JSON.stringify(packTerrain(t).meta));
  meta.props.push({ k: 'khong_co', x: 1, z: 1 }, { k: 'oak', x: 'a', z: 1 });
  const u = unpackTerrain({ meta, layers: packTerrain(t).layers });
  assert.equal(u.props.length, 2);
  assert.deepEqual(u.props[1], t.props[1]);
});

test('Ruộng, mương, hoa dại, cỏ dài: khối phủ đúng chỗ', () => {
  const t = flat();
  const wheat = MAT.WHEAT, flowers = MAT.FLOWERS;
  for (let z = 10; z < 40; z++) for (let x = 10; x < 40; x++) t.material[z * t.size + x] = wheat;
  for (let z = 50; z < 80; z++) for (let x = 50; x < 80; x++) t.material[z * t.size + x] = flowers;
  applyBrush(t, 60, 60, { tool: 'paint', radius: 6, strength: 1, dt: 1, material: MAT.CARROT, ditch: 'x' });
  const w = terrainToWorld(t);
  assert.equal(blockAt(w, 20, 64, 20).Name, 'minecraft:farmland');
  assert.equal(blockAt(w, 20, 64, 20).Properties.moisture, '7');
  assert.equal(blockAt(w, 20, 65, 20).Name, 'minecraft:wheat');
  assert.equal(blockAt(w, 20, 65, 20).Properties.age, '7');
  let ditches = 0, carrots = 0;
  for (let z = 55; z <= 65; z++) for (let x = 55; x <= 65; x++) {
    const i = z * t.size + x;
    if (t.material[i] === MAT.DITCH) { ditches++; assert.equal(((x % 9) + 9) % 9, 4); assert.equal(blockAt(w, x, 64, z).Name, 'minecraft:water'); }
    if (t.material[i] === MAT.CARROT && blockAt(w, x, 65, z).Name === 'minecraft:carrots') carrots++;
  }
  assert.ok(ditches > 3 && carrots > 20, `mương ${ditches}, cà rốt ${carrots}`);
  let flowerCells = 0, total = 0;
  for (let z = 50; z < 80; z++) for (let x = 50; x < 80; x++) {
    if (t.material[z * t.size + x] !== flowers || (x > 53 && x < 67 && z > 53 && z < 67)) continue;
    total++; if (blockAt(w, x, 65, z).Name !== 'minecraft:air') flowerCells++;
  }
  assert.ok(flowerCells > total * 0.2 && flowerCells < total * 0.5, `hoa ${flowerCells}/${total}`);
});

test('Bảng khối và vật liệu: mọi chỉ số tham chiếu đều có thật', () => {
  for (const m of MATERIALS) {
    if (!m) continue;
    for (const k of ['top', 'under', 'cover']) if (m[k] !== undefined) assert.ok(BLOCK_PALETTE[m[k]], `${m.name}.${k}`);
    for (const c of m.covers ?? []) assert.ok(BLOCK_PALETTE[c], `${m.name}.covers`);
  }
  assert.equal(heightAt(flat(), 1, 1), 64);
});
