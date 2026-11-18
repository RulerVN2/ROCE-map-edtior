// Thế giới mẫu để thử bộ xuất: đồi, hồ nước, ba biome, vài con mob.
import { MIN_Y, CHUNK_VOLUME, BIOME_CELLS } from './constants.js';
import * as nbt from './nbt.js';

function hash(x, z, seed) {
  let h = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, z, seed) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = x - x0, fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(x0, z0, seed), b = hash(x0 + 1, z0, seed);
  const c = hash(x0, z0 + 1, seed), d = hash(x0 + 1, z0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z, seed) {
  let v = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < 5; o++) { v += valueNoise(x * freq, z * freq, seed + o) * amp; norm += amp; amp *= 0.5; freq *= 2; }
  return v / norm;
}

export function makeSampleWorld({ size = 1024, seed = 7 } = {}) {
  const P = [
    { Name: 'minecraft:air' },                                             // 0
    { Name: 'minecraft:bedrock' },                                         // 1
    { Name: 'minecraft:stone' },                                           // 2
    { Name: 'minecraft:dirt' },                                            // 3
    { Name: 'minecraft:grass_block', Properties: { snowy: 'false' } },     // 4
    { Name: 'minecraft:grass_block', Properties: { snowy: 'true' } },      // 5
    { Name: 'minecraft:snow', Properties: { layers: '1' } },               // 6
    { Name: 'minecraft:sand' },                                            // 7
    { Name: 'minecraft:sandstone' },                                       // 8
    { Name: 'minecraft:water', Properties: { level: '0' } },               // 9
    { Name: 'minecraft:snow_block' },                                      // 10
    { Name: 'minecraft:gravel' },                                          // 11
  ];
  const AIR = 0, BEDROCK = 1, STONE = 2, DIRT = 3, GRASS = 4, GRASS_SNOWY = 5, SNOW = 6,
    SAND = 7, SANDSTONE = 8, WATER = 9, SNOW_BLOCK = 10, GRAVEL = 11;
  const biomePalette = ['minecraft:plains', 'minecraft:snowy_plains', 'minecraft:desert'];
  const SEA = 62;

  const heights = new Int16Array(size * size);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 140, z / 140, seed);
      heights[z * size + x] = Math.round(52 + n * n * 110);
    }
  }
  const hAt = (x, z) => heights[Math.min(size - 1, Math.max(0, z)) * size + Math.min(size - 1, Math.max(0, x))];
  const biomeAt = (x, z) => (x < size / 2 && z < size / 2 ? 1 : x >= size / 2 && z >= size / 2 ? 2 : 0);

  const blocks = new Uint16Array(CHUNK_VOLUME);
  const biomes = new Uint8Array(BIOME_CELLS);
  const idx = (x, y, z) => ((y - MIN_Y) * 16 + z) * 16 + x;

  function getChunk(cx, cz) {
    blocks.fill(AIR);
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const wx = cx * 16 + x, wz = cz * 16 + z;
        const h = hAt(wx, wz);
        const slope = Math.max(
          Math.abs(hAt(wx + 1, wz) - hAt(wx - 1, wz)),
          Math.abs(hAt(wx, wz + 1) - hAt(wx, wz - 1)),
        );
        const biome = biomeAt(wx, wz);
        blocks[idx(x, MIN_Y, z)] = BEDROCK;
        for (let y = MIN_Y + 1; y <= h; y++) blocks[idx(x, y, z)] = STONE;
        if (slope < 4) { // dốc thoải: phủ đất; dốc gắt: để lộ đá
          const under = h < SEA ? GRAVEL : biome === 2 ? SANDSTONE : DIRT;
          for (let y = h - 3; y < h; y++) blocks[idx(x, y, z)] = under;
          let top = GRASS;
          if (h < SEA) top = GRAVEL;
          else if (biome === 2) top = SAND;
          else if (biome === 1) top = GRASS_SNOWY;
          else if (h > 118) top = SNOW_BLOCK;
          blocks[idx(x, h, z)] = top;
          if (top === GRASS_SNOWY) blocks[idx(x, h + 1, z)] = SNOW;
        }
        for (let y = h + 1; y <= SEA; y++) blocks[idx(x, y, z)] = WATER;
      }
    }
    for (let qz = 0; qz < 4; qz++) {
      for (let qx = 0; qx < 4; qx++) {
        const b = biomeAt(cx * 16 + qx * 4, cz * 16 + qz * 4);
        for (let qy = 0; qy < BIOME_CELLS / 16; qy++) biomes[(qy * 4 + qz) * 4 + qx] = b;
      }
    }
    return { blocks, biomes };
  }

  const mid = size / 2;
  // Tìm chỗ khô gần tâm để đặt điểm xuất hiện.
  let sx = mid, sz = mid;
  search: for (let r = 0; r < 200; r += 4) {
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      if (hAt(mid + dx, mid + dz) > SEA) { sx = mid + dx; sz = mid + dz; break search; }
    }
  }
  const ground = (x, z) => Math.max(hAt(x, z), SEA) + 1;
  const mob = (id, dx, dz, extra) => {
    const x = sx + dx, z = sz + dz;
    return { id, pos: [x + 0.5, ground(x, z) + (biomeAt(x, z) === 1 ? 0.125 : 0), z + 0.5], yaw: 180, nbt: extra };
  };
  const still = { NoAI: nbt.byte(1), PersistenceRequired: nbt.byte(1) };
  const entities = [
    mob('minecraft:cow', 4, 4), mob('minecraft:cow', 6, 5), mob('minecraft:sheep', -5, 4),
    mob('minecraft:villager', 0, 6, { PersistenceRequired: nbt.byte(1) }),
    mob('minecraft:armor_stand', 3, -4),
    mob('minecraft:zombie', -4, -5, still),
    mob('minecraft:skeleton', -6, -5, still),
    mob('minecraft:iron_golem', 8, -6, { PersistenceRequired: nbt.byte(1) }),
  ];

  const nChunks = size / 16;
  return {
    name: 'Rise Of Cubic Empire - thử xuất',
    blockPalette: P,
    biomePalette,
    chunkBounds: { minX: 0, minZ: 0, maxX: nChunks - 1, maxZ: nChunks - 1 },
    getChunk,
    entities,
    spawn: [sx, ground(sx, sz), sz],
    border: { centerX: mid, centerZ: mid, size },
    gameRules: { doMobSpawning: 'false' },
    heights, size,
  };
}
