import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import * as nbt from '../src/core/nbt.js';
import { parseSchem } from '../src/core/schem.js';
import { forward, inverse, transformState, parseState, buildTopMap, dimsAfter } from '../src/core/structure.js';
import {
  createTerrain, applyBrush, makePlacement, terrainToWorld, packTerrain, unpackTerrain, heightAt, materialAt, spawnCell, ROADS, MAT,
} from '../src/core/terrain.js';
import { exportWorld } from '../src/core/world.js';
import { readRegion } from '../src/core/region.js';
import { unpackIndices } from '../src/core/chunk.js';
import { MIN_Y } from '../src/core/constants.js';

const hut = parseSchem(fs.readFileSync(new URL('./fixtures/hut.schem', import.meta.url)));
const blockAt = (w, x, y, z) => {
  const c = w.getChunk(x >> 4, z >> 4);
  return w.blockPalette[c.blocks[((y - MIN_Y) * 16 + (z & 15)) * 16 + (x & 15)]];
};

test('Đọc file .schem bản 2 do thư viện khác tạo ra', () => {
  assert.deepEqual([hut.w, hut.h, hut.l], [5, 4, 7]);
  const at = (x, y, z) => hut.palette[hut.data[(y * hut.l + z) * hut.w + x]];
  assert.equal(at(0, 0, 0), 'minecraft:oak_planks');
  assert.equal(at(0, 1, 0), 'minecraft:cobblestone');
  assert.equal(at(2, 1, 0), 'minecraft:air');
  assert.equal(at(2, 3, 3), 'minecraft:spruce_planks');
  assert.ok(at(1, 1, 1).startsWith('minecraft:oak_stairs[facing=north'));
  assert.equal(hut.blockEntities.length, 1);
  assert.deepEqual([hut.blockEntities[0].x, hut.blockEntities[0].y, hut.blockEntities[0].z], [3, 1, 3]);
  assert.equal(hut.blockEntities[0].id, 'minecraft:chest');
});

test('Đọc file .schem bản 3 và báo lỗi rõ với file không hợp lệ', () => {
  const data = Int8Array.from([0, 1, 1, 0, 1, 0, 0, 1]); // 2x2x2
  const root = nbt.compound({ Schematic: nbt.compound({
    Version: nbt.int(3), DataVersion: nbt.int(3465), Width: nbt.short(2), Height: nbt.short(2), Length: nbt.short(2),
    Blocks: nbt.compound({
      Palette: nbt.compound({ 'minecraft:air': nbt.int(0), 'minecraft:barrel[facing=up,open=false]': nbt.int(1) }),
      Data: nbt.byteArray(data),
      BlockEntities: nbt.list(nbt.TAG.COMPOUND, [{ Pos: nbt.intArray([1, 0, 0]), Id: nbt.string('minecraft:barrel'), Data: nbt.compound({ CustomName: nbt.string('"x"') }) }]),
    }),
  }) });
  const s = parseSchem(nbt.encodeGzip(root));
  assert.deepEqual([s.w, s.h, s.l], [2, 2, 2]);
  assert.deepEqual([...s.data], [0, 1, 1, 0, 1, 0, 0, 1]);
  assert.equal(s.blockEntities[0].tags.CustomName.v, '"x"');
  assert.throws(() => parseSchem(Buffer.from('không phải schem')), /schem/);
  assert.throws(() => parseSchem(zlib.gzipSync(nbt.encode(nbt.compound({ Width: nbt.short(1), Height: nbt.short(1), Length: nbt.short(1) })))), /Palette/);
});

test('Xoay/lật toạ độ: forward và inverse ngược nhau, phủ kín khung', () => {
  for (const flip of [false, true]) for (let rot = 0; rot < 4; rot++) {
    const [w, l] = dimsAfter(5, 7, rot);
    const seen = new Set();
    for (let sz = 0; sz < 7; sz++) for (let sx = 0; sx < 5; sx++) {
      const [x, z] = forward(sx, sz, 5, 7, rot, flip);
      assert.ok(x >= 0 && x < w && z >= 0 && z < l);
      assert.deepEqual(inverse(x, z, 5, 7, rot, flip), [sx, sz]);
      seen.add(x + ',' + z);
    }
    assert.equal(seen.size, 35);
  }
  // Xoay 1 nấc theo chiều kim đồng hồ: góc tây bắc sang góc đông bắc.
  assert.deepEqual(forward(0, 0, 5, 7, 1, false), [6, 0]);
});

test('Xoay/lật thuộc tính khối', () => {
  const T = (s, rot, flip) => transformState(parseState(s), rot, flip).Properties;
  assert.equal(T('a[facing=north]', 1, false).facing, 'east');
  assert.equal(T('a[facing=north]', 2, false).facing, 'south');
  assert.equal(T('a[facing=east]', 0, true).facing, 'west');
  assert.equal(T('a[facing=up]', 3, true).facing, 'up');
  assert.equal(T('a[axis=x]', 1, false).axis, 'z');
  assert.equal(T('a[axis=y]', 1, false).axis, 'y');
  assert.equal(T('a[rotation=4]', 1, false).rotation, '8');
  assert.equal(T('a[rotation=4]', 0, true).rotation, '12');
  assert.deepEqual(T('f[east=true,north=false,south=false,west=false]', 1, false), { south: 'true', east: 'false', west: 'false', north: 'false' });
  assert.equal(T('r[shape=south_east]', 1, false).shape, 'south_west');
  assert.equal(T('r[shape=north_south]', 1, false).shape, 'east_west');
  assert.equal(T('r[shape=ascending_north]', 3, false).shape, 'ascending_west');
  assert.equal(T('s[facing=north,shape=inner_left]', 0, true).shape, 'inner_right');
  assert.equal(T('d[hinge=left]', 0, true).hinge, 'right');
  assert.deepEqual(parseState('minecraft:stone'), { Name: 'minecraft:stone' });
});

test('Đặt công trình rồi xuất world: khối, hướng xoay và rương đều đúng chỗ', () => {
  const t = createTerrain({ size: 64 });
  const lib = new Map([['hut.schem', hut]]);
  t.placements.push(makePlacement(t, hut, 'hut.schem', 20, 20));                    // không xoay
  t.placements.push(makePlacement(t, hut, 'hut.schem', 44, 40, { rot: 1 }));       // xoay 90 độ
  t.placements.push({ name: 'mat.schem', x: 0, y: 65, z: 0, rot: 0, flip: false, air: false });
  const p0 = t.placements[0], p1 = t.placements[1];
  assert.deepEqual([p0.x, p0.y, p0.z], [18, 65, 17]);
  assert.deepEqual([p1.x, p1.y, p1.z], [41, 65, 38]); // khung sau xoay: 7 x 5
  const w = terrainToWorld(t, {}, lib);
  assert.deepEqual(w.missingStructures, ['mat.schem']);
  assert.equal(blockAt(w, 18, 65, 17).Name, 'minecraft:oak_planks');
  assert.equal(blockAt(w, 18, 66, 17).Name, 'minecraft:cobblestone');
  assert.equal(blockAt(w, 20, 66, 17).Name, 'minecraft:air');                       // cửa
  assert.equal(blockAt(w, 19, 66, 18).Properties.facing, 'north');
  assert.equal(blockAt(w, 20, 67, 20).Name, 'minecraft:air');                       // bên trong: không khí bị bỏ qua, nền vẫn là không khí
  assert.equal(blockAt(w, 23, 65, 20).Name, 'minecraft:air');                       // ngoài khung
  // Bản xoay: cầu thang (1,1,1) -> (7-1-1, 1) = (5,1); hướng bắc -> đông.
  const st = blockAt(w, 41 + 5, 66, 38 + 1);
  assert.equal(st.Name, 'minecraft:oak_stairs'); assert.equal(st.Properties.facing, 'east');
  assert.equal(blockAt(w, 41 + 5, 66, 38 + 3).Properties.axis, 'z');                // khúc gỗ
  assert.equal(blockAt(w, 41 + 6, 66, 38 + 2).Name, 'minecraft:air');               // cửa sang mặt đông
  // Rương (3,1,3) -> (3,3) sau xoay; hướng tây -> bắc.
  const chest = blockAt(w, 41 + 3, 66, 38 + 3);
  assert.equal(chest.Name, 'minecraft:chest'); assert.equal(chest.Properties.facing, 'north');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmb-s-'));
  exportWorld(dir, w);
  const region = readRegion(path.join(dir, 'region', 'r.0.0.mca'));
  const c = nbt.decode(region.get((44 >> 4) + (41 >> 4) * 32));
  const be = c.block_entities.find((e) => e.id === 'minecraft:chest');
  assert.deepEqual([be.x, be.y, be.z], [44, 66, 41]);
  assert.equal(be.Items[0].id, 'minecraft:arrow'); assert.equal(be.Items[0].Count, 16);
  const sec = c.sections.find((s) => s.Y === 4);
  const pal = sec.block_states.palette;
  const ids = unpackIndices(sec.block_states.data, 4096, Math.max(4, Math.ceil(Math.log2(pal.length))));
  const got = pal[ids[((66 - 64) * 16 + (41 & 15)) * 16 + (44 & 15)]];
  assert.equal(got.Name, 'minecraft:chest'); assert.equal(got.Properties.facing, 'north');
  fs.rmSync(dir, { recursive: true, force: true });

  // Dán cả không khí thì dọn được đất bên trong.
  const t2 = createTerrain({ size: 64, baseHeight: 67 });
  const p = makePlacement(t2, hut, 'hut.schem', 20, 20, { air: true, yOffset: -3 });
  t2.placements.push(p);
  assert.equal(p.y, 65);
  assert.equal(blockAt(terrainToWorld(t2, {}, lib), 20, 66, 20).Name, 'minecraft:air');
  t2.placements[0].air = false;
  assert.equal(blockAt(terrainToWorld(t2, {}, lib), 20, 66, 20).Name, 'minecraft:dirt');
});

test('Bản đồ đỉnh xem trước của công trình', () => {
  const m = buildTopMap(hut, 1, false);
  assert.deepEqual([m.w, m.l], [7, 5]);
  assert.ok(m.tops.every((v) => v === 3)); // mái kín
});

test('[Road]: thay lớp mặt; bật làm thoải thì đào dốc gắt thành dốc đi được', () => {
  const t = createTerrain({ size: 64 });
  applyBrush(t, 32, 32, { tool: 'raise', radius: 12, strength: 1, dt: 0.5 });
  const before = heightAt(t, 32, 32);
  applyBrush(t, 32, 32, { tool: 'road', radius: 4, road: ROADS[3], grade: false });
  assert.equal(heightAt(t, 32, 32), before);
  assert.equal(materialAt(t, 32, 32), MAT.COBBLE);
  assert.equal(materialAt(t, 35, 32), MAT.GRAVEL);
  assert.equal(t.material[32 * 64 + 40], 0);
  // Nét thứ hai đi ngang qua: mép của nó không được đè lên giữa đường cũ.
  applyBrush(t, 35, 32, { tool: 'road', radius: 4, road: ROADS[3], grade: false });
  assert.equal(materialAt(t, 32, 32), MAT.COBBLE);
  applyBrush(t, 32, 32, { tool: 'road', radius: 4, road: ROADS[3], invert: true });
  assert.equal(t.material[32 * 64 + 32], 0);

  // Vách đứng cao 20 khối tại x >= 30; vẽ đường có làm thoải từ chân vách đi lên.
  const g = createTerrain({ size: 64 });
  for (let z = 0; z < 64; z++) for (let x = 30; x < 64; x++) g.heights[z * 64 + x] = 84;
  for (let x = 22; x <= 60; x += 2) applyBrush(g, x, 32, { tool: 'road', radius: 4, road: ROADS[0], grade: true });
  let worst = 0;
  for (let x = 20; x < 60; x++) worst = Math.max(worst, Math.abs(heightAt(g, x + 1, 32) - heightAt(g, x, 32)));
  assert.ok(worst <= 1, 'bước cao nhất dọc tim đường: ' + worst);
  assert.equal(heightAt(g, 22, 32), 64);            // chân dốc giữ nguyên
  assert.ok(heightAt(g, 60, 32) > 75);              // vẫn leo lên được gần tới đỉnh
  assert.ok(heightAt(g, 40, 32) < 84);              // đoạn giữa đã bị đào thành dốc
  assert.equal(heightAt(g, 40, 10), 84);            // ngoài đường không đổi
  for (let i = 0; i < g.heights.length; i++) assert.ok(g.heights[i] <= (i % 64 >= 30 ? 84 : 64)); // chỉ đào, không đắp
});

test('Điểm xuất hiện tuỳ chọn và lưu/mở giữ công trình, spawn', () => {
  const t = createTerrain({ size: 64 });
  assert.deepEqual(spawnCell(t), { x: 32, z: 32 });
  t.spawn = { x: 10, z: 50 };
  t.heights[50 * 64 + 10] = 80;
  assert.deepEqual(terrainToWorld(t).spawn, [10, 82, 50]);
  t.placements.push(makePlacement(t, hut, 'hut.schem', 20, 20, { rot: 3, flip: true }));
  const p = packTerrain(t);
  const u = unpackTerrain({ meta: JSON.parse(JSON.stringify(p.meta)), layers: p.layers });
  assert.deepEqual(u.spawn, { x: 10, z: 50 });
  assert.deepEqual(u.placements, t.placements);
  t.spawn = { x: 999, z: 0 };
  assert.deepEqual(spawnCell(t), { x: 32, z: 32 });
});

test('Dải đường băng: ép phẳng nền, vạch đứt giữa, vạch hai mép, thoải dần ra ngoài, xoá được', async () => {
  const { paintStrip } = await import('../src/core/terrain.js');
  const t = createTerrain({ size: 160, baseHeight: 64 });
  for (let z = 0; z < 160; z++) for (let x = 0; x < 160; x++) t.heights[z * 160 + x] = 60 + x * 0.12 + Math.sin(z / 9) * 2; // dốc và gợn
  const lvl = Math.round(heightAt(t, 20, 80)), rw = ROADS.find((r) => r.name === 'Đường băng');
  assert.ok(paintStrip(t, { x: 20, z: 80 }, { x: 120, z: 80 }, { road: rw, radius: 7, level: true }));
  for (const [x, z] of [[20, 80], [70, 73], [70, 87], [119, 80], [40, 82]]) assert.equal(heightAt(t, x, z), lvl, `phẳng tại ${x},${z}`);
  assert.equal(materialAt(t, 23, 80), MAT.WHITE);       // đầu nét đứt
  assert.equal(materialAt(t, 33, 80), MAT.ASPHALT);     // khoảng trống giữa hai nét
  assert.equal(materialAt(t, 36, 80), MAT.WHITE);       // nét kế tiếp
  assert.equal(materialAt(t, 60, 75), MAT.WHITE);       // vạch mép (cách tim 5 khối)
  assert.equal(materialAt(t, 60, 85), MAT.WHITE);
  assert.equal(materialAt(t, 60, 73), MAT.ASPHALT);     // lề
  assert.equal(t.material[70 * 160 + 60], 0);           // ngoài dải: chưa tô
  const orig = 60 + 60 * 0.12 + Math.sin(60 / 9) * 2;
  assert.notEqual(heightAt(t, 60, 64), Math.round(orig)); // vành thoải đã bị kéo về nền đường
  const far = heightAt(t, 60, 40); assert.equal(far, Math.round(60 + 60 * 0.12 + Math.sin(40 / 9) * 2)); // xa hơn 8 khối: giữ nguyên
  // Nét đứt liền mạch khi nối đoạn kế (sOffset)
  const t2 = createTerrain({ size: 64 });
  paintStrip(t2, { x: 5, z: 30 }, { x: 25, z: 30 }, { road: rw, radius: 7, level: true, sOffset: 0 });
  paintStrip(t2, { x: 25, z: 30 }, { x: 45, z: 30 }, { road: rw, radius: 7, level: true, sOffset: 20 });
  const pat = []; for (let x = 5; x < 45; x++) pat.push(materialAt(t2, x, 30) === MAT.WHITE ? 1 : 0);
  assert.equal(pat.join('').slice(0, 32), '1111111111000000111111111100000011'.slice(0, 32)); // chu kỳ 16: 10 nét, 6 trống, xuyên qua chỗ nối
  // Xoá
  paintStrip(t, { x: 20, z: 80 }, { x: 120, z: 80 }, { road: rw, radius: 7, invert: true });
  assert.equal(t.material[80 * 160 + 23], 0);
  assert.equal(heightAt(t, 70, 80), lvl);               // địa hình đã ép phẳng thì giữ (xoá chỉ gỡ vạch)
});

test('Hào đào: hạ đất, lát ván, đắp bờ bao cát, không đào hai lần, lấp lại được, xuất đúng khối', async () => {
  const { paintStrip } = await import('../src/core/terrain.js');
  const t = createTerrain({ size: 64, baseHeight: 64 });
  const tr = ROADS.find((r) => r.name === 'Hào chiến đấu');
  const o = { road: tr, radius: 1 };
  assert.ok(paintStrip(t, { x: 10, z: 32 }, { x: 50, z: 32 }, o));
  assert.equal(heightAt(t, 30, 32), 61); assert.equal(materialAt(t, 30, 32), MAT.PLANK);
  assert.equal(heightAt(t, 30, 31), 61); assert.equal(heightAt(t, 30, 33), 61);   // rộng 3 khối
  assert.equal(heightAt(t, 30, 30), 65); assert.equal(materialAt(t, 30, 30), MAT.SANDBAG); // bờ cao thêm 1
  assert.equal(heightAt(t, 30, 29), 64);
  paintStrip(t, { x: 10, z: 32 }, { x: 50, z: 32 }, o);            // vẽ lại cùng chỗ: không đào sâu thêm
  assert.equal(heightAt(t, 30, 32), 61); assert.equal(heightAt(t, 30, 30), 65);
  paintStrip(t, { x: 30, z: 32 }, { x: 30, z: 50 }, o);            // nhánh rẽ cắt qua bờ cũ
  assert.equal(heightAt(t, 30, 40), 61); assert.equal(heightAt(t, 30, 33), 61);
  assert.equal(heightAt(t, 29, 32), 61);                           // chỗ giao không bị đào sâu hơn
  const w = terrainToWorld(t, { name: 'x' }, new Map());
  assert.equal(blockAt(w, 20, 61, 32).Name, 'minecraft:oak_planks');
  assert.equal(blockAt(w, 20, 62, 32).Name, 'minecraft:air');
  assert.equal(blockAt(w, 20, 65, 30).Name, 'minecraft:smooth_sandstone');
  for (const [z, f] of [[31, 'south'], [33, 'north']]) {          // thang ở hai bên hào, cứ 8 ô một cái, gắn vách quay ra lòng hào
    for (let y = 62; y <= 65; y++) { const b = blockAt(w, 20, y, z); assert.equal(b.Name, 'minecraft:ladder'); assert.equal(b.Properties.facing, f); }
    assert.notEqual(blockAt(w, 20, 66, z).Name, 'minecraft:ladder');
    assert.notEqual(blockAt(w, 21, 62, z).Name, 'minecraft:ladder');
  }
  paintStrip(t, { x: 10, z: 32 }, { x: 50, z: 32 }, { ...o, invert: true });
  assert.equal(heightAt(t, 20, 32), 64); assert.equal(t.material[32 * 64 + 20], 0); assert.equal(heightAt(t, 20, 30), 64);
});
