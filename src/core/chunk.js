// Dựng NBT của một chunk 1.20.1 từ dữ liệu khối thô.
import * as nbt from './nbt.js';
import { DATA_VERSION, MIN_SECTION, SECTION_COUNT } from './constants.js';

/**
 * Đóng gói các chỉ số vào mảng long kiểu Minecraft 1.16+ (không cho giá trị vắt qua hai long).
 * Trả về Int32Array các cặp (hi, lo).
 */
export function packIndices(indices, start, count, bits) {
  const perLong = Math.floor(64 / bits);
  const nLongs = Math.ceil(count / perLong);
  const out = new Int32Array(nLongs * 2);
  for (let i = 0; i < count; i++) {
    const li = (i / perLong) | 0;
    const off = (i - li * perLong) * bits;
    const v = indices[start + i];
    if (off < 32) {
      out[li * 2 + 1] |= v << off;
      if (off + bits > 32) out[li * 2] |= v >>> (32 - off);
    } else {
      out[li * 2] |= v << (off - 32);
    }
  }
  return out;
}

/** Ngược lại với packIndices; longs là BigInt64Array (từ nbt.decode). */
export function unpackIndices(longs, count, bits) {
  const perLong = Math.floor(64 / bits);
  const mask = (1n << BigInt(bits)) - 1n;
  const out = new Uint16Array(count);
  for (let i = 0; i < count; i++) {
    const li = (i / perLong) | 0;
    const off = BigInt((i - li * perLong) * bits);
    out[i] = Number((BigInt.asUintN(64, longs[li]) >> off) & mask);
  }
  return out;
}

const bitsFor = (n) => Math.max(1, Math.ceil(Math.log2(n)));

function stateTag(state) {
  const o = { Name: nbt.string(state.Name) };
  if (state.Properties && Object.keys(state.Properties).length) {
    const p = {};
    for (const [k, v] of Object.entries(state.Properties)) p[k] = nbt.string(v);
    o.Properties = nbt.compound(p);
  }
  return o;
}

/**
 * @param {object} c
 * @param {number} c.x, c.z  toạ độ chunk
 * @param {Uint16Array} c.blocks  16*16*384 chỉ số vào blockPalette, thứ tự ((y-MIN_Y)*16+z)*16+x
 * @param {Uint8Array} c.biomes   4*4*96 chỉ số vào biomePalette, thứ tự ((qy)*4+qz)*4+qx
 * @param {Array} blockPalette    [{Name, Properties?}]
 * @param {string[]} biomePalette
 * @param {Array} [c.blockEntities] danh sách compound đã bọc
 */
export function buildChunkNbt(c, blockPalette, biomePalette, scratch) {
  const lookup = scratch.lookup; // Int32Array(blockPalette.length), toàn -1
  const local = scratch.local;   // Uint16Array(4096)
  const sections = [];
  for (let s = 0; s < SECTION_COUNT; s++) {
    const base = s * 4096;
    const pal = [];
    const blocks = c.blocks;
    let uniform = true;
    const first = blocks[base];
    for (let i = 1; i < 4096; i++) if (blocks[base + i] !== first) { uniform = false; break; }
    const blockStates = {};
    if (uniform) {
      blockStates.palette = nbt.list(nbt.TAG.COMPOUND, [stateTag(blockPalette[first])]);
    } else {
      for (let i = 0; i < 4096; i++) {
        const g = blocks[base + i];
        let l = lookup[g];
        if (l < 0) { l = pal.length; lookup[g] = l; pal.push(g); }
        local[i] = l;
      }
      for (const g of pal) lookup[g] = -1;
      const bits = Math.max(4, bitsFor(pal.length));
      blockStates.palette = nbt.list(nbt.TAG.COMPOUND, pal.map((g) => stateTag(blockPalette[g])));
      blockStates.data = nbt.longArray(packIndices(local, 0, 4096, bits));
    }

    const bBase = s * 64;
    const bPal = [];
    const bLocal = scratch.bLocal;
    for (let i = 0; i < 64; i++) {
      const g = c.biomes[bBase + i];
      let l = bPal.indexOf(g);
      if (l < 0) { l = bPal.length; bPal.push(g); }
      bLocal[i] = l;
    }
    const biomes = { palette: nbt.list(nbt.TAG.STRING, bPal.map((g) => biomePalette[g])) };
    if (bPal.length > 1) biomes.data = nbt.longArray(packIndices(bLocal, 0, 64, bitsFor(bPal.length)));

    sections.push({
      Y: nbt.byte(MIN_SECTION + s),
      block_states: nbt.compound(blockStates),
      biomes: nbt.compound(biomes),
    });
  }

  return nbt.compound({
    DataVersion: nbt.int(DATA_VERSION),
    xPos: nbt.int(c.x),
    yPos: nbt.int(MIN_SECTION),
    zPos: nbt.int(c.z),
    Status: nbt.string('minecraft:full'),
    LastUpdate: nbt.long(0),
    InhabitedTime: nbt.long(0),
    // Để trống ánh sáng và heightmap: game tự tính lại khi nạp chunk.
    isLightOn: nbt.byte(0),
    Heightmaps: nbt.compound({}),
    sections: nbt.list(nbt.TAG.COMPOUND, sections),
    block_entities: nbt.list(nbt.TAG.COMPOUND, c.blockEntities ?? []),
    block_ticks: nbt.list(nbt.TAG.COMPOUND, []),
    fluid_ticks: nbt.list(nbt.TAG.COMPOUND, []),
    structures: nbt.compound({
      References: nbt.compound({}),
      starts: nbt.compound({}),
    }),
  });
}

export function makeScratch(blockPaletteSize) {
  return {
    lookup: new Int32Array(blockPaletteSize).fill(-1),
    local: new Uint16Array(4096),
    bLocal: new Uint16Array(64),
  };
}

/**
 * NBT của một chunk trong thư mục `entities` (từ 1.17 mob nằm riêng ở đây).
 * entities: [{ id, pos:[x,y,z], yaw?, pitch?, nbt?: object các tag đã bọc }]
 */
export function buildEntityChunkNbt(cx, cz, entities) {
  const items = entities.map((e) => ({
    id: nbt.string(e.id),
    Pos: nbt.list(nbt.TAG.DOUBLE, e.pos),
    Motion: nbt.list(nbt.TAG.DOUBLE, [0, 0, 0]),
    Rotation: nbt.list(nbt.TAG.FLOAT, [e.yaw ?? 0, e.pitch ?? 0]),
    UUID: nbt.intArray(e.uuid ?? randomUuid()),
    ...(e.nbt ?? {}),
  }));
  return nbt.compound({
    DataVersion: nbt.int(DATA_VERSION),
    Position: nbt.intArray([cx, cz]),
    Entities: nbt.list(nbt.TAG.COMPOUND, items),
  });
}

function randomUuid() {
  const a = new Int32Array(4);
  for (let i = 0; i < 4; i++) a[i] = (Math.random() * 0x100000000) | 0;
  return a;
}
