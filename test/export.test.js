import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import * as nbt from '../src/core/nbt.js';
import { packIndices, unpackIndices } from '../src/core/chunk.js';
import { readRegion } from '../src/core/region.js';
import { exportWorld } from '../src/core/world.js';
import { makeSampleWorld } from '../src/core/sample.js';
import { DATA_VERSION, MIN_Y, SECTION_COUNT } from '../src/core/constants.js';

test('NBT ghi rồi đọc lại giữ nguyên giá trị', () => {
  const root = nbt.compound({
    b: nbt.byte(-3), s: nbt.short(-300), i: nbt.int(-70000), l: nbt.long(-(2n ** 40n)),
    f: nbt.float(0.5), d: nbt.double(1.25), str: nbt.string('đồi núi'),
    ia: nbt.intArray([1, -2, 3]), la: nbt.longArray(Int32Array.from([0x12345678, -1, -1, 5])),
    lst: nbt.list(nbt.TAG.COMPOUND, [{ a: nbt.int(1) }, { a: nbt.int(2) }]),
    empty: nbt.list(nbt.TAG.STRING, []),
  });
  const o = nbt.decode(nbt.encode(root));
  assert.equal(o.b, -3); assert.equal(o.s, -300); assert.equal(o.i, -70000);
  assert.equal(o.l, -(2n ** 40n)); assert.equal(o.f, 0.5); assert.equal(o.d, 1.25);
  assert.equal(o.str, 'đồi núi');
  assert.deepEqual([...o.ia], [1, -2, 3]);
  assert.equal(BigInt.asUintN(64, o.la[0]), 0x12345678ffffffffn);
  assert.equal(BigInt.asUintN(64, o.la[1]), 0xffffffff00000005n);
  assert.deepEqual(o.lst, [{ a: 1 }, { a: 2 }]);
  assert.deepEqual(o.empty, []);
});

test('Đóng gói chỉ số: mọi độ rộng bit đều đọc lại đúng', () => {
  for (let bits = 1; bits <= 13; bits++) {
    const n = 4096, src = new Uint16Array(n);
    for (let i = 0; i < n; i++) src[i] = (i * 2654435761) % (1 << bits);
    const packed = packIndices(src, 0, n, bits);
    assert.equal(packed.length / 2, Math.ceil(n / Math.floor(64 / bits)));
    const longs = new BigInt64Array(packed.length / 2);
    for (let i = 0; i < longs.length; i++) {
      longs[i] = BigInt.asIntN(64, (BigInt(packed[2 * i] >>> 0) << 32n) | BigInt(packed[2 * i + 1] >>> 0));
    }
    assert.deepEqual(unpackIndices(longs, n, bits), src, `bits=${bits}`);
  }
});

test('Xuất thế giới mẫu rồi đọc lại: khối, biome, mob, level.dat đều khớp', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmb-'));
  const w = makeSampleWorld({ size: 128 });
  exportWorld(dir, w);

  const lvl = nbt.decode(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'level.dat')))).Data;
  assert.equal(lvl.DataVersion, DATA_VERSION);
  assert.equal(lvl.Version.Name, '1.20.1');
  assert.equal(lvl.BorderSize, 128);
  assert.equal(lvl.BorderCenterX, 64);
  assert.equal(lvl.WorldGenSettings.dimensions['minecraft:overworld'].generator.type, 'minecraft:flat');
  assert.deepEqual([lvl.SpawnX, lvl.SpawnY, lvl.SpawnZ], w.spawn);

  const region = readRegion(path.join(dir, 'region', 'r.0.0.mca'));
  assert.equal(region.size, 64);
  let checked = 0;
  for (const [i, raw] of region) {
    const c = nbt.decode(raw);
    const cx = i % 32, cz = (i / 32) | 0;
    assert.equal(c.xPos, cx); assert.equal(c.zPos, cz); assert.equal(c.yPos, -4);
    assert.equal(c.DataVersion, DATA_VERSION); assert.equal(c.Status, 'minecraft:full');
    assert.equal(c.sections.length, SECTION_COUNT);
    const src = w.getChunk(cx, cz);
    c.sections.forEach((s, si) => {
      assert.equal(s.Y, si - 4);
      const pal = s.block_states.palette;
      const bits = Math.max(4, Math.ceil(Math.log2(pal.length)));
      const ids = pal.length === 1 ? new Uint16Array(4096) : unpackIndices(s.block_states.data, 4096, bits);
      if (pal.length > 1) assert.equal(s.block_states.data.length, Math.ceil(4096 / Math.floor(64 / bits)));
      for (let k = 0; k < 4096; k++) {
        const want = w.blockPalette[src.blocks[si * 4096 + k]];
        const got = pal[ids[k]];
        if (got.Name !== want.Name || JSON.stringify(got.Properties ?? {}) !== JSON.stringify(want.Properties ?? {})) {
          assert.fail(`Sai khối tại chunk ${cx},${cz} section ${si} ô ${k}`);
        }
        checked++;
      }
      const bp = s.biomes.palette;
      const bids = bp.length === 1 ? new Uint16Array(64) : unpackIndices(s.biomes.data, 64, Math.ceil(Math.log2(bp.length)));
      for (let k = 0; k < 64; k++) assert.equal(bp[bids[k]], w.biomePalette[src.biomes[si * 64 + k]]);
    });
  }
  assert.equal(checked, 64 * 24 * 4096);

  // Cột đất phải có bedrock ở đáy và không khí ở trên cùng.
  const c0 = w.getChunk(0, 0);
  assert.equal(w.blockPalette[c0.blocks[0]].Name, 'minecraft:bedrock');
  assert.equal(w.blockPalette[c0.blocks[(319 - MIN_Y) * 256]].Name, 'minecraft:air');

  const ents = [];
  for (const f of fs.readdirSync(path.join(dir, 'entities'))) {
    for (const [i, raw] of readRegion(path.join(dir, 'entities', f))) {
      const e = nbt.decode(raw);
      assert.equal(e.DataVersion, DATA_VERSION);
      assert.deepEqual([...e.Position].map((v) => v & 31), [i % 32, (i / 32) | 0]);
      for (const m of e.Entities) {
        assert.equal(Math.floor(m.Pos[0] / 16), e.Position[0]);
        assert.equal(Math.floor(m.Pos[2] / 16), e.Position[1]);
        assert.equal(m.UUID.length, 4);
        ents.push(m.id);
      }
    }
  }
  assert.deepEqual(ents.sort(), w.entities.map((e) => e.id).sort());
  fs.rmSync(dir, { recursive: true, force: true });
});
