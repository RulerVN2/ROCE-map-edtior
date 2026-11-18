// Mô hình địa hình dùng chung cho Editor (trình duyệt) và bộ xuất (Node). Không phụ thuộc Node.
import { MIN_Y, MAX_Y, CHUNK_VOLUME, BIOME_CELLS } from './constants.js';
import { parseState, transformState, dimsAfter, forward, inverse, isAirName, isSkipName } from './structure.js';
import { mobsToEntities } from './mobs.js';
import { defaultScenario, normalizeScenario } from './scenario.js';
import { propBlocks, PROP_BY_KEY } from './props.js';
import { makeCarver, NO_CAVE, CAVE_AUTO, CAVE_OPEN, DEFAULT_CAVE } from './caves.js';
export { NO_CAVE, CAVE_AUTO, CAVE_OPEN, DEFAULT_CAVE };

export const BIOMES = [
  { id: 'minecraft:plains', grass: [104, 158, 74], name: 'Đồng cỏ (plains)' },
  { id: 'minecraft:forest', grass: [92, 150, 62], name: 'Rừng (forest)' },
  { id: 'minecraft:meadow', grass: [112, 172, 96], name: 'Đồng hoa núi (meadow)' },
  { id: 'minecraft:taiga', grass: [98, 140, 98], name: 'Rừng lá kim (taiga)' },
  { id: 'minecraft:snowy_plains', grass: [104, 158, 74], name: 'Đồng tuyết (snowy plains)' },
  { id: 'minecraft:snowy_taiga', grass: [98, 140, 98], name: 'Rừng tuyết (snowy taiga)' },
  { id: 'minecraft:desert', grass: [160, 160, 80], name: 'Sa mạc (desert)' },
  { id: 'minecraft:savanna', grass: [166, 162, 72], name: 'Xavan (savanna)' },
  { id: 'minecraft:swamp', grass: [98, 112, 62], name: 'Đầm lầy (swamp)' },
  { id: 'minecraft:windswept_hills', grass: [110, 150, 104], name: 'Đồi lộng gió (windswept hills)' },
];
const SNOWY = new Set(['minecraft:snowy_plains', 'minecraft:snowy_taiga']);
const SANDY = new Set(['minecraft:desert']);

export const MIN_HEIGHT = MIN_Y + 4;
export const MAX_HEIGHT = 300;
export const NO_WATER = -32768;

// Vật liệu bề mặt. Chỉ số 0 trong lớp `material` nghĩa là "tự động theo quy tắc".
// top/under: chỉ số vào BLOCK_PALETTE; cover: khối phủ thêm bên trên (lớp tuyết, cây trồng);
// covers + coverP: chọn ngẫu nhiên một trong các khối phủ ở một phần (coverP) số ô, ví dụ hoa dại rải trên cỏ. farm: vật liệu ruộng (có thể tự đào mương tưới).
export const MAT = { GRASS: 1, STONE: 2, SNOW: 3, SAND: 4, SNOWY_GRASS: 5, DIRT: 6, GRAVEL: 7, COBBLE: 8, COARSE: 9, MUD: 10, PATH: 11, BRICKS: 12, MOSSY: 13, ASPHALT: 14, WHITE: 15, YELLOW: 16, PLANK: 17, SANDBAG: 18,
  FARM: 19, WHEAT: 20, CARROT: 21, POTATO: 22, BEET: 23, DITCH: 24, TALLGRASS: 25, FLOWERS: 26, MOSS: 27, PODZOL: 28, SCORCH: 29,
  ANDESITE: 30, REDBRICK: 31, REDSAND: 32, SMOOTH: 33, DEEPBRICK: 34, MOSSBRICK: 35, CRACKED: 36 };
export const MATERIALS = [
  null,
  { name: 'Cỏ', top: 4, under: 3, color: [104, 158, 74], side: [121, 88, 60] },
  { name: 'Đá', top: 2, under: 2, color: [136, 136, 134], side: [112, 112, 110], noise: 0.04 },
  { name: 'Tuyết', top: 9, under: 9, color: [236, 240, 244], side: [205, 212, 220] },
  { name: 'Cát', top: 7, under: 8, color: [219, 205, 150], side: [196, 180, 128] },
  { name: 'Cỏ phủ tuyết', top: 5, under: 3, cover: 6, color: [226, 232, 238], side: [121, 88, 60], hidden: true },
  { name: 'Đất', top: 3, under: 3, color: [146, 104, 72], side: [121, 88, 60], noise: 0.05 },
  { name: 'Sỏi', top: 10, under: 3, color: [168, 158, 150], side: [121, 88, 60], noise: 0.2 },
  { name: 'Đá cuội', top: 11, under: 2, color: [96, 96, 98], side: [112, 112, 110], noise: 0.16 },
  { name: 'Đất thô', top: 12, under: 3, color: [104, 72, 48], side: [121, 88, 60], noise: 0.12 },
  { name: 'Bùn', top: 13, under: 3, color: [60, 57, 60], side: [121, 88, 60] },
  { name: 'Lối mòn', top: 14, under: 3, color: [176, 146, 78], side: [121, 88, 60], noise: 0.06 },
  { name: 'Gạch đá', top: 16, under: 2, color: [150, 150, 158], side: [112, 112, 110], noise: 0.03, bricks: true },
  { name: 'Đá cuội rêu', top: 17, under: 2, color: [84, 122, 80], side: [112, 112, 110], noise: 0.16 },
  { name: 'Nhựa đường (bê tông xám)', top: 19, under: 2, color: [78, 80, 86], side: [112, 112, 110], noise: 0.03 },
  { name: 'Vạch trắng', top: 20, under: 2, color: [238, 238, 238], side: [112, 112, 110] },
  { name: 'Vạch vàng', top: 21, under: 2, color: [232, 190, 40], side: [112, 112, 110] },
  { name: 'Ván gỗ', top: 22, under: 3, color: [162, 130, 78], side: [121, 88, 60], noise: 0.03 },
  { name: 'Bao cát', top: 23, under: 3, color: [216, 202, 152], side: [121, 88, 60], noise: 0.05 },
  { name: 'Ruộng cày (đất xới)', group: 'Ruộng, mương và thảm cây', top: 24, under: 3, color: [96, 66, 42], side: [121, 88, 60], noise: 0.05, farm: true },
  { name: 'Ruộng lúa mì', top: 24, under: 3, cover: 25, color: [196, 176, 70], side: [121, 88, 60], noise: 0.06, farm: true },
  { name: 'Ruộng cà rốt', top: 24, under: 3, cover: 26, color: [206, 136, 66], side: [121, 88, 60], noise: 0.06, farm: true },
  { name: 'Ruộng khoai tây', top: 24, under: 3, cover: 27, color: [150, 152, 62], side: [121, 88, 60], noise: 0.06, farm: true },
  { name: 'Ruộng củ dền', top: 24, under: 3, cover: 28, color: [140, 66, 80], side: [121, 88, 60], noise: 0.06, farm: true },
  { name: 'Mương tưới nước', top: 15, under: 3, color: [58, 110, 190], side: [121, 88, 60] },
  { name: 'Cỏ dài', top: 4, under: 3, covers: [29, 29, 29, 30], coverP: 0.6, color: [84, 150, 58], side: [121, 88, 60], noise: 0.05 },
  { name: 'Đồng hoa dại', top: 4, under: 3, covers: [31, 32, 33, 34, 35, 36, 37, 38], coverP: 0.35, color: [150, 168, 92], side: [121, 88, 60], noise: 0.06 },
  { name: 'Rêu', top: 39, under: 3, color: [88, 120, 40], side: [121, 88, 60], noise: 0.05 },
  { name: 'Đất podzol (rừng thông)', top: 40, under: 3, color: [96, 66, 34], side: [121, 88, 60], noise: 0.08 },
  { name: 'Đất cháy (chiến trường)', top: 41, under: 3, color: [46, 42, 46], side: [60, 52, 48], noise: 0.1 },
  { name: 'Đá andesite', group: 'Nền lát và đá trang trí', top: 42, under: 2, color: [136, 136, 136], side: [112, 112, 110], noise: 0.05 },
  { name: 'Gạch nung đỏ', top: 43, under: 2, color: [150, 84, 68], side: [112, 112, 110], noise: 0.04, bricks: true },
  { name: 'Cát đỏ', top: 44, under: 44, color: [190, 106, 48], side: [168, 92, 40] },
  { name: 'Đá nhẵn', top: 45, under: 2, color: [160, 160, 160], side: [112, 112, 110] },
  { name: 'Gạch đá tối (deepslate)', top: 46, under: 2, color: [58, 60, 64], side: [60, 60, 62], noise: 0.03, bricks: true },
  { name: 'Gạch đá rêu', top: 47, under: 2, color: [110, 128, 100], side: [112, 112, 110], noise: 0.05, bricks: true },
  { name: 'Gạch đá nứt', top: 48, under: 2, color: [140, 140, 146], side: [112, 112, 110], noise: 0.04, bricks: true },
];

// Mẫu đường cho mục [Road]: vật liệu giữa đường và hai bên mép.
export const ROADS = [
  { name: 'Lối mòn', center: MAT.PATH, edge: MAT.COARSE },
  { name: 'Đường đất', center: MAT.COARSE, edge: MAT.DIRT },
  { name: 'Đường sỏi', center: MAT.GRAVEL, edge: MAT.COARSE },
  { name: 'Đường đá cuội', center: MAT.COBBLE, edge: MAT.GRAVEL },
  { name: 'Đường gạch đá', center: MAT.BRICKS, edge: MAT.COBBLE },
  { name: 'Đường bùn', center: MAT.MUD, edge: MAT.COARSE },
  // Dải có vạch kẻ chạy theo chiều dài: chỉ vẽ ở chế độ "Đặt thẳng". `radius` là cỡ cọ gợi ý (bề rộng = 2 x cỡ cọ + 1).
  { name: 'Đường băng', strip: { base: MAT.ASPHALT, line: MAT.WHITE, center: 'dash', edge: true, radius: 7 } },
  { name: 'Đường lăn', strip: { base: MAT.ASPHALT, line: MAT.YELLOW, center: 'solid', edge: false, radius: 3 } },
  { name: 'Đường nhựa', strip: { base: MAT.ASPHALT, line: MAT.WHITE, center: 'dash', edge: false, radius: 3 } },
  // Hào đào: hạ địa hình, đáy lát ván, đất đào lên đắp thành bờ bao cát hai bên. Vẽ được cả bằng cọ lẫn đặt thẳng.
  { name: 'Hào chiến đấu', trench: { depth: 3, floor: MAT.PLANK, lip: MAT.SANDBAG, radius: 1 } },
];
export const WATER_COLOR = [58, 110, 190];

export const BLOCK_PALETTE = [
  { Name: 'minecraft:air' },                                         // 0
  { Name: 'minecraft:bedrock' },                                     // 1
  { Name: 'minecraft:stone' },                                       // 2
  { Name: 'minecraft:dirt' },                                        // 3
  { Name: 'minecraft:grass_block', Properties: { snowy: 'false' } }, // 4
  { Name: 'minecraft:grass_block', Properties: { snowy: 'true' } },  // 5
  { Name: 'minecraft:snow', Properties: { layers: '1' } },           // 6
  { Name: 'minecraft:sand' },                                        // 7
  { Name: 'minecraft:sandstone' },                                   // 8
  { Name: 'minecraft:snow_block' },                                  // 9
  { Name: 'minecraft:gravel' },                                      // 10
  { Name: 'minecraft:cobblestone' },                                 // 11
  { Name: 'minecraft:coarse_dirt' },                                 // 12
  { Name: 'minecraft:mud' },                                         // 13
  { Name: 'minecraft:dirt_path' },                                   // 14
  { Name: 'minecraft:water', Properties: { level: '0' } },           // 15
  { Name: 'minecraft:stone_bricks' },                                // 16
  { Name: 'minecraft:mossy_cobblestone' },                           // 17
  { Name: 'minecraft:deepslate', Properties: { axis: 'y' } },        // 18
  { Name: 'minecraft:gray_concrete' },                               // 19
  { Name: 'minecraft:white_concrete' },                              // 20
  { Name: 'minecraft:yellow_concrete' },                             // 21
  { Name: 'minecraft:oak_planks' },                                  // 22
  { Name: 'minecraft:smooth_sandstone' },                            // 23
  { Name: 'minecraft:farmland', Properties: { moisture: '7' } },     // 24
  { Name: 'minecraft:wheat', Properties: { age: '7' } },             // 25
  { Name: 'minecraft:carrots', Properties: { age: '7' } },           // 26
  { Name: 'minecraft:potatoes', Properties: { age: '7' } },          // 27
  { Name: 'minecraft:beetroots', Properties: { age: '3' } },         // 28
  { Name: 'minecraft:grass' },                                       // 29 (cỏ ngắn trong 1.20)
  { Name: 'minecraft:fern' },                                        // 30
  { Name: 'minecraft:dandelion' },                                   // 31
  { Name: 'minecraft:poppy' },                                       // 32
  { Name: 'minecraft:cornflower' },                                  // 33
  { Name: 'minecraft:azure_bluet' },                                 // 34
  { Name: 'minecraft:oxeye_daisy' },                                 // 35
  { Name: 'minecraft:allium' },                                      // 36
  { Name: 'minecraft:red_tulip' },                                   // 37
  { Name: 'minecraft:pink_tulip' },                                  // 38
  { Name: 'minecraft:moss_block' },                                  // 39
  { Name: 'minecraft:podzol', Properties: { snowy: 'false' } },      // 40
  { Name: 'minecraft:blackstone' },                                  // 41
  { Name: 'minecraft:andesite' },                                    // 42
  { Name: 'minecraft:bricks' },                                      // 43
  { Name: 'minecraft:red_sand' },                                    // 44
  { Name: 'minecraft:smooth_stone' },                                // 45
  { Name: 'minecraft:deepslate_bricks' },                            // 46
  { Name: 'minecraft:mossy_stone_bricks' },                          // 47
  { Name: 'minecraft:cracked_stone_bricks' },                        // 48
  { Name: 'minecraft:blue_orchid' },                                 // 49
  { Name: 'minecraft:orange_tulip' },                                // 50
  { Name: 'minecraft:white_tulip' },                                 // 51
  { Name: 'minecraft:lily_of_the_valley' },                          // 52
  { Name: 'minecraft:brown_mushroom' },                              // 53
  { Name: 'minecraft:red_mushroom' },                                // 54
  { Name: 'minecraft:dead_bush' },                                   // 55
  { Name: 'minecraft:sweet_berry_bush', Properties: { age: '3' } },  // 56
  { Name: 'minecraft:tall_grass', Properties: { half: 'lower' } },   // 57
  { Name: 'minecraft:tall_grass', Properties: { half: 'upper' } },   // 58
  { Name: 'minecraft:large_fern', Properties: { half: 'lower' } },   // 59
  { Name: 'minecraft:large_fern', Properties: { half: 'upper' } },   // 60
  { Name: 'minecraft:sunflower', Properties: { half: 'lower' } },    // 61
  { Name: 'minecraft:sunflower', Properties: { half: 'upper' } },    // 62
  { Name: 'minecraft:lilac', Properties: { half: 'lower' } },        // 63
  { Name: 'minecraft:lilac', Properties: { half: 'upper' } },        // 64
  { Name: 'minecraft:rose_bush', Properties: { half: 'lower' } },    // 65
  { Name: 'minecraft:rose_bush', Properties: { half: 'upper' } },    // 66
  { Name: 'minecraft:peony', Properties: { half: 'lower' } },        // 67
  { Name: 'minecraft:peony', Properties: { half: 'upper' } },        // 68
  { Name: 'minecraft:moss_carpet' },                                 // 69
  { Name: 'minecraft:cobweb' },                                      // 70
  { Name: 'minecraft:snow', Properties: { layers: '1' } },           // 71
];

/**
 * Khối trang trí rải trên mặt đất bằng cọ "Trang trí". b: chỉ số khối (và up: nửa trên của cây cao 2 khối);
 * on: 'soil' = cần đất cỏ/đất, 'sand' = đất hoặc cát, 'any' = đặt lên mặt đặc nào cũng được. color: màu chấm trong Editor.
 */
export const DECO = [
  { key: 'grass', name: 'Cỏ ngắn', b: 29, on: 'soil', color: [74, 140, 54], group: 'Cỏ và dương xỉ' },
  { key: 'fern', name: 'Dương xỉ', b: 30, on: 'soil', color: [58, 120, 50], group: 'Cỏ và dương xỉ' },
  { key: 'tall_grass', name: 'Cỏ cao', b: 57, up: 58, on: 'soil', color: [66, 150, 56], group: 'Cỏ và dương xỉ' },
  { key: 'large_fern', name: 'Dương xỉ lớn', b: 59, up: 60, on: 'soil', color: [48, 112, 48], group: 'Cỏ và dương xỉ' },
  { key: 'dandelion', name: 'Bồ công anh', b: 31, on: 'soil', color: [250, 224, 40], group: 'Hoa' },
  { key: 'poppy', name: 'Hoa anh túc', b: 32, on: 'soil', color: [214, 40, 40], group: 'Hoa' },
  { key: 'blue_orchid', name: 'Lan xanh', b: 49, on: 'soil', color: [60, 190, 232], group: 'Hoa' },
  { key: 'allium', name: 'Hành tím', b: 36, on: 'soil', color: [186, 100, 220], group: 'Hoa' },
  { key: 'azure_bluet', name: 'Cúc xanh nhạt', b: 34, on: 'soil', color: [214, 232, 240], group: 'Hoa' },
  { key: 'red_tulip', name: 'Tulip đỏ', b: 37, on: 'soil', color: [226, 60, 50], group: 'Hoa' },
  { key: 'orange_tulip', name: 'Tulip cam', b: 50, on: 'soil', color: [240, 140, 40], group: 'Hoa' },
  { key: 'white_tulip', name: 'Tulip trắng', b: 51, on: 'soil', color: [240, 240, 236], group: 'Hoa' },
  { key: 'pink_tulip', name: 'Tulip hồng', b: 38, on: 'soil', color: [240, 140, 176], group: 'Hoa' },
  { key: 'oxeye', name: 'Cúc trắng', b: 35, on: 'soil', color: [248, 248, 220], group: 'Hoa' },
  { key: 'cornflower', name: 'Cúc xanh lam', b: 33, on: 'soil', color: [80, 110, 232], group: 'Hoa' },
  { key: 'lily', name: 'Linh lan', b: 52, on: 'soil', color: [240, 246, 240], group: 'Hoa' },
  { key: 'sunflower', name: 'Hướng dương (cao)', b: 61, up: 62, on: 'soil', color: [248, 200, 30], group: 'Hoa cao' },
  { key: 'lilac', name: 'Tử đinh hương (cao)', b: 63, up: 64, on: 'soil', color: [190, 140, 220], group: 'Hoa cao' },
  { key: 'rose_bush', name: 'Bụi hồng (cao)', b: 65, up: 66, on: 'soil', color: [200, 40, 60], group: 'Hoa cao' },
  { key: 'peony', name: 'Mẫu đơn (cao)', b: 67, up: 68, on: 'soil', color: [240, 170, 200], group: 'Hoa cao' },
  { key: 'brown_mushroom', name: 'Nấm nâu', b: 53, on: 'soil', color: [150, 110, 80], group: 'Khác' },
  { key: 'red_mushroom', name: 'Nấm đỏ', b: 54, on: 'soil', color: [220, 50, 50], group: 'Khác' },
  { key: 'berry', name: 'Bụi dâu rừng', b: 56, on: 'soil', color: [90, 130, 70], group: 'Khác' },
  { key: 'dead_bush', name: 'Bụi chết (khô)', b: 55, on: 'sand', color: [140, 100, 50], group: 'Khác' },
  { key: 'moss_carpet', name: 'Thảm rêu', b: 69, on: 'any', color: [90, 130, 50], group: 'Khác' },
  { key: 'cobweb', name: 'Mạng nhện', b: 70, on: 'any', color: [230, 230, 230], group: 'Khác' },
  { key: 'snow_layer', name: 'Tuyết mỏng', b: 71, on: 'any', color: [245, 248, 252], group: 'Khác' },
];
const SOIL_TOPS = new Set([3, 4, 5, 12, 39, 40]);       // đất, cỏ, cỏ tuyết, đất thô, rêu, podzol
const SAND_TOPS = new Set([...SOIL_TOPS, 7, 44]);       // thêm cát và cát đỏ
const decoFits = (d, top) => d.on === 'any' || (d.on === 'sand' ? SAND_TOPS : SOIL_TOPS).has(top);
const B_AIR = 0, B_BEDROCK = 1, B_STONE = 2, B_WATER = 15, B_DEEPSLATE = 18;

export const DEFAULT_RULES = { slopeStone: 2, snowLine: 170, dirtDepth: 3 };

const hash2 = (x, z) => { let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1) ^ 0x5bd1e995) | 0; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

export function createTerrain({ size = 1024, baseHeight = 64, baseBiome = 'minecraft:plains' } = {}) {
  return {
    size,
    baseBiome,
    rules: { ...DEFAULT_RULES },
    heights: new Float32Array(size * size).fill(baseHeight),
    water: new Int16Array(size * size).fill(NO_WATER),   // độ cao mặt nước, NO_WATER = không có nước
    material: new Uint8Array(size * size),                // 0 = tự động
    biome: new Uint8Array(size * size),                   // 0 = biome nền, k = BIOMES[k-1]
    spawn: null,                                          // { x, z } hoặc null = giữa map
    border: null,                                         // world border { cx, cz, size } hoặc null = cả map
    placements: [],                                       // công trình đã đặt: { name, x, y, z, rot, flip, air }
    scenario: defaultScenario(),                          // 8 ô người chơi: xem scenario.js
    mobs: [],                                             // mob đã đặt: xem makeMob() trong mobs.js
    props: [],                                            // cây và vật thể nhỏ đã đặt: xem props.js
    caveMask: new Uint8Array(size * size),                // bit 1 = vùng hang tự sinh, bit 2 = cửa hang
    caveFloor: new Int16Array(size * size).fill(NO_CAVE), // hang đào tay: độ cao sàn, NO_CAVE = không có
    caveHeight: new Uint8Array(size * size),              // hang đào tay: số khối rỗng phía trên sàn
    deco: new Uint8Array(size * size),                    // trang trí rải trên mặt: 0 = không, k = DECO[k-1]
    cave: { ...DEFAULT_CAVE },                            // thông số hang tự sinh
  };
}
export const LAYERS = ['heights', 'water', 'material', 'biome', 'caveMask', 'caveFloor', 'caveHeight', 'deco'];

export function heightAt(t, x, z) {
  const s = t.size;
  if (x < 0) x = 0; else if (x >= s) x = s - 1;
  if (z < 0) z = 0; else if (z >= s) z = s - 1;
  return Math.round(t.heights[z * s + x]);
}
/** Độ cao mặt nước tại ô, hoặc NO_WATER nếu ô không ngập. */
export function waterAt(t, x, z) {
  const i = z * t.size + x;
  const w = t.water[i];
  return w !== NO_WATER && w > Math.round(t.heights[i]) ? w : NO_WATER;
}
/** Màu cỏ theo biome tại ô (để nhìn ra vùng đã tô biome trong Editor). */
export function grassColorAt(t, x, z) {
  const b = t.biome[z * t.size + x];
  return (b ? BIOMES[b - 1] : BIOMES.find((e) => e.id === t.baseBiome) ?? BIOMES[0]).grass;
}
export function biomeIdAt(t, x, z) {
  const b = t.biome[z * t.size + x];
  return b ? BIOMES[b - 1].id : t.baseBiome;
}

/** Vật liệu bề mặt tại ô: ưu tiên chỗ tô tay, sau đó tới quy tắc tự động. */
export function materialAt(t, x, z) {
  const i = z * t.size + x;
  const m = t.material[i];
  if (m) return m;
  const h = heightAt(t, x, z);
  const slope = Math.max(
    Math.abs(heightAt(t, x + 1, z) - heightAt(t, x - 1, z)),
    Math.abs(heightAt(t, x, z + 1) - heightAt(t, x, z - 1)),
  );
  if (slope >= t.rules.slopeStone * 2) return MAT.STONE;
  const w = t.water[i];
  if (w !== NO_WATER && w > h) return MAT.SAND; // đáy sông hồ
  if (h >= t.rules.snowLine) return MAT.SNOW;
  const biome = biomeIdAt(t, x, z);
  if (SANDY.has(biome)) return MAT.SAND;
  if (SNOWY.has(biome)) return MAT.SNOWY_GRASS;
  return MAT.GRASS;
}

// ---- Cọ ----
export const TOOLS = {
  raise: { group: 'Địa hình', name: 'Nâng', hint: 'Kéo chuột để đắp đất cao lên. Giữ Shift để hạ xuống.' },
  lower: { name: 'Hạ', hint: 'Kéo chuột để đào đất thấp xuống. Giữ Shift để nâng lên.' },
  smooth: { name: 'Làm mịn', hint: 'Kéo chuột để làm mềm các chỗ gồ ghề, lởm chởm.' },
  flatten: { name: 'San phẳng', hint: 'Bấm vào một chỗ rồi kéo: vùng kéo qua sẽ bằng với độ cao chỗ bấm đầu tiên. Dùng để làm nền công trình.' },
  elev: { name: 'Bậc độ cao', hint: 'Giống Scenario Editor: chọn "Bậc" (nâng bao nhiêu khối) rồi bấm hoặc kéo, vùng cọ thành mặt phẳng cao hơn chỗ bấm đầu tiên đúng bấy nhiêu khối, quanh mép là sườn thoải theo ô "Sườn" (0 = dựng đứng). Đổi "Cách" sang "Đặt đúng độ cao" để đặt thẳng độ cao Y. Giữ Shift để hạ thấp xuống.' },
  cliff: { name: 'Vách đá', hint: 'Bấm rồi kéo: dựng một khối đất có vách dựng đứng, cao hơn chỗ bấm đầu tiên đúng bằng "Cao vách". Giữ Shift để khoét xuống thành hố vách đứng.' },
  river: { name: 'Sông hồ', hint: 'Bấm rồi kéo: đào lòng sông và đổ nước. Mặt nước thấp hơn chỗ bấm đầu tiên 1 khối và giữ nguyên suốt nét kéo. Giữ Shift để xoá nước.' },
  paint: { group: 'Bề mặt', name: 'Tô vật liệu', hint: 'Kéo chuột để tô loại khối bề mặt đã chọn, đè lên quy tắc tự động. Chọn "Tự động" để xoá chỗ đã tô.' },
  deco: { name: 'Trang trí', panel: false, hint: 'Rải ngẫu nhiên khối trang trí (cỏ, dương xỉ, hoa, nấm, bụi...) lên mặt đất. Chọn MỘT hoặc NHIỀU loại ở bảng nổi trên khung nhìn (bấm để bật/tắt từng ô), chỉnh "Mật độ" rồi kéo chuột: mỗi ô được rải ngẫu nhiên một trong các loại đã chọn. Giữ Shift để xoá trang trí.' },
  pattern: { name: 'Mẫu nền', panel: false, hint: 'Tô một mẫu nền đã phối sẵn (cỏ loang đất, bãi sỏi đá, chiến trường cháy, sân lát gạch...) thay vì một màu. Mẫu bám theo toạ độ nên các nét vẽ liền nhau khớp khít, mép nét cọ mờ dần vào nền cũ. Chọn mẫu ở bảng nổi trên khung nhìn. Giữ Shift để xoá mẫu, trả về quy tắc tự động.' },
  biome: { name: 'Biome', hint: 'Kéo chuột để tô biome đã chọn. Biome quyết định màu cỏ, lá, nước và thời tiết trong game.' },
  cavearea: { group: 'Hang động', name: 'Vùng hang', hint: 'Kéo chuột để đánh dấu vùng sẽ có hang tự sinh dưới lòng đất (vùng tô tím). Hang nằm kín dưới đất, cách mặt đất ít nhất 6 khối. Chỉnh mật độ và cỡ hang ở mục "Hang tự sinh" bên phải. Giữ Shift để bỏ đánh dấu.' },
  cavedig: { name: 'Đào hang', hint: 'Bấm rồi kéo để tự đào một khoang hang (vùng tô cam): sàn hang phẳng, nằm dưới chỗ bấm đầu tiên đúng bằng "Sâu", trần cao nhất ở giữa nét cọ theo "Cao hang". Giữ Shift để lấp lại.' },
  cavestair: { name: 'Dốc hang', hint: 'Đào lối đi bộ xuống hang: bấm điểm cửa (trên mặt đất) rồi bấm một điểm để chỉ hướng. Lối dốc xuống dần (2 khối đi ngang thì xuống 1 khối) cho tới độ "Sâu" rồi có sân bằng ở cuối, trần cao theo "Cao hang", bề rộng theo "Cỡ cọ" (nên dùng 2 đến 4). Phần gần mặt đất là rãnh hở, đi sâu thì thành đường hầm. Nối sân cuối với hang bằng cọ "Đào hang" hoặc "Vùng hang". Giữ Shift rồi bấm để lấp cả lối vừa đào ở vùng đó.' },
  caveopen: { name: 'Cửa hang', hint: 'Kéo chuột để đánh dấu cửa hang (vùng tô vàng): tại đó hang được thông lên mặt đất, và nếu bên dưới (trong 48 khối) có hang thì khoét một giếng thẳng xuống tới hang. Không có tác dụng dưới sông hồ. Giữ Shift để bỏ.' },
  border: { group: 'Khác', name: 'World border', hint: 'Kéo mép khung vàng để phóng to hoặc thu nhỏ world border (quanh tâm), kéo vào bên trong khung để dời cả khung. Giữ Shift rồi bấm để trả về cả map. Người chơi không đi ra ngoài khung được; phần map ngoài khung vẫn nhìn thấy.' },
  spawn: { name: 'Điểm xuất hiện', hint: 'Bấm vào một ô để đặt chỗ người chơi xuất hiện khi vào world (lá cờ đỏ). Giữ Shift rồi bấm để trả về giữa map.' },
  road: { name: 'Road', panel: true, hint: 'Vẽ đường: thay lớp khối bề mặt bằng mẫu đường đã chọn, bề rộng theo "Cỡ cọ". Chế độ "Cọ vẽ": kéo chuột để vẽ tự do. Chế độ "Đặt thẳng": bấm điểm đầu rồi bấm điểm cuối, bấm tiếp để nối đoạn kế, Esc để kết thúc. Bật "Làm thoải nền đường" để đường tự đào bớt chỗ dốc. Giữ Shift để xoá đường.' },
  mob: { name: 'Mob', panel: true, hint: 'Chọn mob trong bảng [Mob] rồi bấm lên map để đặt (có thể đặt cả đội hình nhiều mob). R: xoay hướng mặt. Giữ Shift (hiện vòng tròn theo "Cỡ cọ") rồi bấm để gỡ các mob trong vòng tròn.' },
  prop: { name: 'Cây và vật thể', panel: true, hint: 'Chọn một loại trong bảng [Cây] rồi bấm lên map để đặt từng cái, hoặc chuyển sang "Vẽ rừng" để kéo chuột rải cả vạt (giữ chuột yên một chỗ sẽ rải dày dần). Giữ Shift để gỡ cây và vật thể trong vòng tròn "Cỡ cọ".' },
  structure: { name: 'Structure', panel: true, hint: 'Bấm để đặt công trình đã chọn (khung xanh là chỗ sẽ đặt). R: xoay, F: lật. Giữ Shift rồi bấm vào một công trình để gỡ.' },
};

/**
 * Áp cọ một lần tại (cx, cz).
 * @param {object} o { tool, radius, strength (0..1), dt (giây), invert, target, material, biome }
 *   target: độ cao đích (san phẳng, vách đá) hoặc độ cao mặt nước (sông hồ)
 * @returns {boolean} có thay đổi hay không
 */
export function applyBrush(t, cx, cz, o) {
  const { size, heights, water } = t;
  const r = o.radius;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(size - 1, Math.ceil(cx + r));
  const z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(size - 1, Math.ceil(cz + r));
  if (x0 > x1 || z0 > z1) return false;
  let tool = o.tool;
  if (o.invert && tool === 'raise') tool = 'lower';
  else if (o.invert && tool === 'lower') tool = 'raise';
  const rate = o.strength * o.dt;

  let src = heights;
  if (tool === 'smooth') src = heights.slice(); // đọc từ bản sao để kết quả không lệch hướng
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dz = z - cz;
      const d2 = (dx * dx + dz * dz) / (r * r);
      if (d2 >= 1) continue;
      const w = (1 - d2) * (1 - d2); // mạnh ở tâm, nhẹ dần ra mép
      const i = z * size + x;
      if (tool === 'paint') {
        let mm = o.material;
        if (o.ditch && MATERIALS[mm]?.farm) { const q = o.ditch === 'x' ? x : z; if (((q % 9) + 9) % 9 === 4) mm = MAT.DITCH; } // mương tưới cứ 9 ô một rãnh, nước thấm cho đất trong 4 ô
        t.material[i] = mm; continue;
      }
      if (tool === 'pattern') {
        if (d2 > 0.5 && hash2(x * 3 + 1, z * 5 + 2) < (d2 - 0.5) / 0.5) continue; // mép cọ thưa dần: hoà vào nền cũ
        t.material[i] = o.invert ? 0 : patternMat(o.pattern, x, z); continue;
      }
      if (tool === 'biome') { t.biome[i] = o.biome; continue; }
      if (tool === 'deco') {
        if (o.invert) { t.deco[i] = 0; continue; }
        const list = o.decoList; if (!list || !list.length) continue;
        const wl = water[i]; if (wl !== NO_WATER && wl > Math.round(heights[i])) continue; // không rải xuống nước
        const edge = d2 > 0.6 ? (1 - d2) / 0.4 : 1;
        if (hash2(x * 5 + 11, z * 3 + 7) < (o.density ?? 0.3) * edge) t.deco[i] = list[Math.floor(hash2(z * 7 + 3, x * 11 + 5) * list.length) % list.length];
        continue;
      }
      if (tool === 'cavearea') { if (o.invert) t.caveMask[i] &= ~CAVE_AUTO; else t.caveMask[i] |= CAVE_AUTO; continue; }
      if (tool === 'caveopen') { if (o.invert) t.caveMask[i] &= ~CAVE_OPEN; else t.caveMask[i] |= CAVE_OPEN; continue; }
      if (tool === 'cavedig') {
        if (o.invert) { t.caveFloor[i] = NO_CAVE; t.caveHeight[i] = 0; continue; }
        const hh = Math.max(2, Math.round((o.caveHeight ?? 6) * Math.sqrt(1 - d2))); // vòm: cao ở giữa, thấp dần ra mép
        if (t.caveFloor[i] !== o.target) { t.caveFloor[i] = o.target; t.caveHeight[i] = hh; }
        else if (hh > t.caveHeight[i]) t.caveHeight[i] = hh;
        continue;
      }
      if (tool === 'road') {
        if (o.invert) { t.material[i] = 0; continue; }
        // Mép đường không được đè lên phần giữa đường đã vẽ ở các bước trước của cùng nét kéo.
        if (d2 < 0.5) t.material[i] = o.road.center;
        else if (t.material[i] !== o.road.center) t.material[i] = o.road.edge;
        continue;
      }
      let h = heights[i];
      if (tool === 'raise') h += 40 * rate * w;
      else if (tool === 'lower') h -= 40 * rate * w;
      else if (tool === 'flatten') h += (o.target - h) * Math.min(1, 10 * rate * w);
      else if (tool === 'cliff') h = o.target;
      else if (tool === 'elev') {
        const sl = Math.max(0, Math.min(o.slope ?? 0, r - 1)), pr = r - sl, d = Math.sqrt(dx * dx + dz * dz);
        if (d <= pr + 0.5) h = o.target;
        else {
          const k = 1 - (d - pr - 0.5) / Math.max(0.001, sl), s = k * k * (3 - 2 * k), b = o.base ? o.base[i] : h, v = b + (o.target - b) * s;
          h = o.target >= b ? Math.max(h, v) : Math.min(h, v); // nhiều lần bấm trong một nét không làm sườn cũ thấp đi
        }
      }
      else if (tool === 'river') {
        if (o.invert) { water[i] = NO_WATER; continue; }
        const bed = o.target - 1 - 2 * w; // sâu nhất ở giữa dòng
        if (h > bed) h = bed;
        water[i] = o.target;
      } else if (tool === 'smooth') {
        let sum = 0, n = 0;
        for (let nz = z - 2; nz <= z + 2; nz++) {
          if (nz < 0 || nz >= size) continue;
          for (let nx = x - 2; nx <= x + 2; nx++) {
            if (nx < 0 || nx >= size) continue;
            sum += src[nz * size + nx]; n++;
          }
        }
        h += (sum / n - h) * Math.min(1, 12 * rate * w);
      }
      h = h < MIN_HEIGHT ? MIN_HEIGHT : h > MAX_HEIGHT ? MAX_HEIGHT : h;
      heights[i] = h;
      // Đất đã đắp cao hơn mặt nước thì chỗ đó không còn là sông hồ nữa.
      if (water[i] !== NO_WATER && Math.round(h) >= water[i]) water[i] = NO_WATER;
    }
  }
  if (tool === 'road' && o.grade && !o.invert) gradeDisc(t, cx, cz, r, x0, x1, z0, z1);
  return true;
}


/**
 * Đào lối dốc đi bộ xuống hang: từ cửa (ax, az) theo hướng (bx, bz), sàn hạ 1 khối mỗi 2 khối đi ngang cho tới `depth`,
 * rồi sân bằng dài 6 khối. Ghi vào lớp hang đào tay (caveFloor/caveHeight) nên lưu, hoàn tác và xuất như hang thường.
 * @returns {number} số ô đã đổi
 */
export function digRamp(t, ax, az, bx, bz, { depth = 20, width = 3, tall = 5, invert = false } = {}) {
  const { size } = t;
  let dx = bx - ax, dz = bz - az; const dl = Math.hypot(dx, dz);
  if (dl < 1) return 0;
  dx /= dl; dz /= dl;
  const hw = Math.max(1, Math.min(8, width)), d = Math.max(4, Math.min(100, depth));
  const rampLen = d * 2, total = rampLen + 6;
  const top = heightAt(t, ax, az);
  const yMin = Math.max(-56, top - d);
  let n = 0;
  for (let s = 0; s <= total; s++) {
    const floor = Math.max(yMin, top - Math.floor(s / 2)); // trên cửa (s nhỏ) thì sàn ngang mặt đất
    for (let u = -hw; u <= hw; u++) {
      const x = Math.round(ax + dx * s - dz * u), z = Math.round(az + dz * s + dx * u);
      if (x < 0 || z < 0 || x >= size || z >= size) continue;
      const i = z * size + x;
      if (invert) { if (t.caveFloor[i] !== NO_CAVE) { t.caveFloor[i] = NO_CAVE; t.caveHeight[i] = 0; t.caveMask[i] &= ~CAVE_OPEN; n++; } continue; }
      const h = Math.round(heightAt(t, x, z));
      const edge = Math.abs(u) === hw; const th = edge ? Math.max(3, tall - 2) : tall;
      if (t.caveFloor[i] === NO_CAVE || floor < t.caveFloor[i] || (floor === t.caveFloor[i] && th > t.caveHeight[i])) { t.caveFloor[i] = floor; t.caveHeight[i] = th; }
      if (h - floor <= tall + 3) t.caveMask[i] |= CAVE_OPEN; // chỗ đất còn mỏng thì mở hẳn lên trời, tránh trần thấp lấn xuống lối đi
      n++;
    }
  }
  return n;
}

// ---- Mẫu nền: các vật liệu phối sẵn theo toạ độ (nhiễu uốn cho vạt tự nhiên, hoặc lát đều) ----
const vnoise = (x, z) => {
  const xi = Math.floor(x), zi = Math.floor(z), u = x - xi, v = z - zi, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  const p = hash2(xi, zi), q = hash2(xi + 1, zi), r = hash2(xi, zi + 1), w = hash2(xi + 1, zi + 1);
  return p + (q - p) * a + (r - p + (w - r - q + p) * a) * b;
};
export const PATTERNS = [
  { name: 'Cỏ loang đất', scale: 5, mix: [[MAT.GRASS, 62], [MAT.COARSE, 14], [MAT.DIRT, 12], [MAT.PODZOL, 6], [MAT.MOSS, 6]] },
  { name: 'Đồng cỏ hoa dại', scale: 4, mix: [[MAT.GRASS, 40], [MAT.TALLGRASS, 28], [MAT.FLOWERS, 32]] },
  { name: 'Nền rừng thông', scale: 4, mix: [[MAT.PODZOL, 55], [MAT.COARSE, 15], [MAT.MOSS, 15], [MAT.GRASS, 15]] },
  { name: 'Đất loang sỏi', scale: 4, mix: [[MAT.DIRT, 38], [MAT.COARSE, 26], [MAT.GRAVEL, 26], [MAT.PATH, 10]] },
  { name: 'Bãi sỏi đá', scale: 3, mix: [[MAT.GRAVEL, 35], [MAT.COBBLE, 25], [MAT.STONE, 25], [MAT.ANDESITE, 15]] },
  { name: 'Bờ cát sỏi', scale: 5, mix: [[MAT.SAND, 56], [MAT.GRAVEL, 24], [MAT.COARSE, 10], [MAT.DIRT, 10]] },
  { name: 'Sa mạc đá', scale: 6, mix: [[MAT.SAND, 50], [MAT.REDSAND, 20], [MAT.COARSE, 15], [MAT.GRAVEL, 15]] },
  { name: 'Tuyết loang cỏ', scale: 5, mix: [[MAT.SNOW, 56], [MAT.SNOWY_GRASS, 20], [MAT.GRASS, 14], [MAT.STONE, 10]] },
  { name: 'Chiến trường cháy', scale: 3, mix: [[MAT.SCORCH, 34], [MAT.COARSE, 28], [MAT.GRAVEL, 16], [MAT.MUD, 12], [MAT.COBBLE, 10]] },
  { name: 'Sân gạch đá cũ', scale: 1.4, mix: [[MAT.BRICKS, 52], [MAT.MOSSBRICK, 16], [MAT.CRACKED, 16], [MAT.COBBLE, 16]] },
  { name: 'Sân bê tông nứt', scale: 2, mix: [[MAT.ASPHALT, 70], [MAT.STONE, 14], [MAT.GRAVEL, 16]] },
  { name: 'Lát caro gạch và đá cuội', kind: 'checker', size: 2, mix: [[MAT.BRICKS, 1], [MAT.COBBLE, 1]] },
  { name: 'Lát đá so le', kind: 'bond', main: MAT.BRICKS, seam: MAT.COBBLE },
  { name: 'Sân gạch nung', kind: 'bond', main: MAT.REDBRICK, seam: MAT.ANDESITE },
  { name: 'Sân đá tối lát ô', kind: 'checker', size: 3, mix: [[MAT.DEEPBRICK, 1], [MAT.SMOOTH, 1]] },
];
/** Vật liệu của mẫu nền pi tại ô (x, z): luôn cùng kết quả cho cùng toạ độ, nên các nét vẽ nối nhau không lộ đường ghép. */
export function patternMat(pi, x, z) {
  const P = PATTERNS[pi]; if (!P) return 0;
  if (P.kind === 'checker') return P.mix[(Math.floor(x / P.size) + Math.floor(z / P.size)) & 1][0];
  if (P.kind === 'bond') {
    const row = Math.floor(z / 3), off = (row & 1) * 3;
    return z - row * 3 === 0 || (((x + off) % 6) + 6) % 6 === 0 ? P.seam : P.main;
  }
  const sc = P.scale;
  let wx = x, wz = z;
  if (sc >= 2) { // uốn toạ độ để các vạt có mép cong
    wx += (vnoise(x / (sc * 1.3) + 11.1, z / (sc * 1.3) - 5.3) - 0.5) * sc * 1.8;
    wz += (vnoise(x / (sc * 1.3) - 7.7, z / (sc * 1.3) + 2.9) - 0.5) * sc * 1.8;
  }
  const total = P.mix.reduce((a, [, w]) => a + w, 0);
  let r = hash2(Math.floor(wx / sc) * 7 + pi * 131, Math.floor(wz / sc) * 13 + pi) * total;
  for (const [m, w] of P.mix) { r -= w; if (r <= 0) return m; }
  return P.mix[0][0];
}

// ---- Nền cho công trình: san phẳng, sân quanh chân, móng ----
export const PAD_STYLES = [
  { name: 'Đá cuội', mat: MAT.COBBLE, edge: MAT.GRAVEL, block: 'minecraft:cobblestone' },
  { name: 'Gạch đá', mat: MAT.BRICKS, edge: MAT.COBBLE, block: 'minecraft:stone_bricks' },
  { name: 'Gạch đá cũ rêu', mat: MAT.MOSSBRICK, edge: MAT.COBBLE, block: 'minecraft:mossy_stone_bricks' },
  { name: 'Bê tông xám', mat: MAT.ASPHALT, edge: MAT.GRAVEL, block: 'minecraft:gray_concrete' },
  { name: 'Đất nện', mat: MAT.PATH, edge: MAT.COARSE, block: 'minecraft:coarse_dirt' },
  { name: 'Ván gỗ', mat: MAT.PLANK, edge: MAT.PATH, block: 'minecraft:oak_planks' },
];
/**
 * Chuẩn bị mặt bằng quanh một công trình đã đặt (box = khung chân công trình): san phẳng về độ cao `level` cả khung và
 * dải rộng `margin` quanh khung, thoải dần ra địa hình cũ trong 5 khối; rồi tô sân (vật liệu của kiểu nền, mép loang sang vật liệu viền).
 */
export function prepareSite(t, box, level, { margin = 2, style = 0, flatten = true, apron = true } = {}) {
  const n = t.size, st = PAD_STYLES[style] ?? PAD_STYLES[0], B = 5, reach = margin + B + 1;
  const x0 = Math.max(0, box.x0 - reach), x1 = Math.min(n - 1, box.x1 + reach), z0 = Math.max(0, box.z0 - reach), z1 = Math.min(n - 1, box.z1 + reach);
  let changed = false;
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const dx = Math.max(box.x0 - x, 0, x - box.x1), dz = Math.max(box.z0 - z, 0, z - box.z1), d = Math.hypot(dx, dz), i = z * n + x;
      if (flatten) {
        const dd = d - margin; // dải `margin` quanh khung cũng bằng phẳng
        let h = t.heights[i];
        if (dd <= 0) h = level;
        else if (dd < B) { const u = dd / B; h = level + (h - level) * (u * u * (3 - 2 * u)); }
        if (h !== t.heights[i]) { t.heights[i] = h; changed = true; if (t.water[i] !== NO_WATER && Math.round(h) >= t.water[i]) t.water[i] = NO_WATER; }
      }
      if (apron) {
        const thr = margin + (hash2(x * 5 + 3, z * 11 + 1) - 0.5) * 0.9;
        if (d <= thr && waterAt(t, x, z) === NO_WATER) {
          const m = d > thr - 1.2 && hash2(x + 17, z - 9) < 0.5 ? st.edge : st.mat;
          if (t.material[i] !== m) { t.material[i] = m; changed = true; }
        }
      }
    }
  }
  return changed;
}

/**
 * Vẽ một đoạn "dải" từ ô a tới ô b (chạy thẳng), dùng cho đường băng, đường lăn và hào.
 * Dải có vạch kẻ (road.strip): ép phẳng nền theo độ cao ở điểm đầu (nếu o.level), hai bên thoải dần ra địa hình cũ trong 8 khối,
 * rồi tô vật liệu nền và vạch (nét đứt hoặc liền ở giữa, vạch hai mép). o.sOffset là quãng đường đã đi, để nét đứt liền mạch khi nối đoạn.
 * Hào (road.trench): hạ mặt đất `depth` khối dọc dải, lát ván dưới đáy, đắp bờ bao cát cao 1 khối ở hai mép.
 * Giữ Shift (o.invert): xoá vạch/bao cát, hào được lấp lại. Trả về true nếu có ô bị đổi.
 */
export function paintStrip(t, a, b, o) {
  const { size, heights, water, material } = t;
  const r = Math.max(1, Math.round(o.radius ?? 3));
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  const ux = L ? dx / L : 1, uz = L ? dz / L : 0;
  const strip = o.road.strip, trench = o.road.trench;
  const margin = strip && o.level && !o.invert ? 8 : trench ? 1 : 0;
  const level = Math.round(heightAt(t, a.x, a.z));
  const R = r + margin + 1;
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - R)), x1 = Math.min(size - 1, Math.ceil(Math.max(a.x, b.x) + R));
  const z0 = Math.max(0, Math.floor(Math.min(a.z, b.z) - R)), z1 = Math.min(size - 1, Math.ceil(Math.max(a.z, b.z) + R));
  let changed = false;
  const sOff = o.sOffset ?? 0;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const rx = x - a.x, rz = z - a.z;
    const s = rx * ux + rz * uz, u = -rx * uz + rz * ux;
    const along = s < -0.5 ? -0.5 - s : s > L + 0.5 ? s - L - 0.5 : 0;
    const e = Math.hypot(Math.max(0, Math.abs(u) - r), along);   // khoảng cách ra ngoài dải
    if (e > margin + 1e-6) continue;
    const i = z * size + x;
    if (strip) {
      if (o.invert) { if (e === 0 && material[i] >= MAT.ASPHALT && material[i] <= MAT.YELLOW) { material[i] = 0; changed = true; } continue; }
      if (e > 0) {                                                  // vành thoải dần ra địa hình cũ
        if (!o.level) continue;
        const k = 1 - e / margin, w = k * k * (3 - 2 * k);
        heights[i] += (level - heights[i]) * w; changed = true;
      } else {
        if (o.level) heights[i] = level;
        const au = Math.abs(u);
        let mat = strip.base;
        if (au < 0.7) { if (strip.center === 'solid' || ((s + sOff) % 16 + 16) % 16 < 10) mat = strip.line; }
        else if (strip.edge && r >= 4 && au > r - 2.5 && au <= r - 1.5) mat = strip.line;
        material[i] = mat; changed = true;
      }
      if (water[i] !== NO_WATER && Math.round(heights[i]) >= water[i]) water[i] = NO_WATER;
    } else {
      const d = trench.depth;
      if (water[i] !== NO_WATER) continue;
      if (o.invert) {                                                // lấp hào và dọn bờ
        if (e === 0 && material[i] === trench.floor) { heights[i] += d; material[i] = 0; changed = true; }
        else if (e > 0 && material[i] === trench.lip) { heights[i] -= 1; material[i] = 0; changed = true; }
        continue;
      }
      if (e === 0) {
        if (material[i] === trench.floor) continue;                  // đã đào rồi
        const base = material[i] === trench.lip ? heights[i] - 1 : heights[i];
        heights[i] = Math.max(MIN_HEIGHT, base - d); material[i] = trench.floor; changed = true;
      } else if (e <= 1.0001 && material[i] !== trench.floor && material[i] !== trench.lip) {
        heights[i] += 1; material[i] = trench.lip; changed = true;   // bờ đất đắp, mặt bao cát
      }
    }
  }
  return changed;
}

export const ROAD_SLOPE = 0.5; // nền đường lên tối đa 1 khối trên mỗi 2 khối đi ngang

/**
 * Làm thoải vùng dưới cọ: hạ các ô xuống sao cho không ô nào cao hơn ô kề bên quá ROAD_SLOPE.
 * Chỉ đào xuống (không đắp lên), neo theo chỗ thấp nhất trong vùng cọ.
 */
function gradeDisc(t, cx, cz, r, x0, x1, z0, z1) {
  const { size, heights, water } = t;
  const r2 = r * r;
  const inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && (x - cx) * (x - cx) + (z - cz) * (z - cz) < r2;
  const relax = (x, z) => {
    if (!inside(x, z)) return;
    const i = z * size + x;
    let m = Infinity;
    if (inside(x - 1, z)) m = Math.min(m, heights[i - 1]);
    if (inside(x + 1, z)) m = Math.min(m, heights[i + 1]);
    if (inside(x, z - 1)) m = Math.min(m, heights[i - size]);
    if (inside(x, z + 1)) m = Math.min(m, heights[i + size]);
    if (heights[i] > m + ROAD_SLOPE) heights[i] = m + ROAD_SLOPE;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) relax(x, z);
    for (let z = z1; z >= z0; z--) for (let x = x1; x >= x0; x--) relax(x, z);
  }
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const i = z * size + x;
    if (water[i] !== NO_WATER && Math.round(heights[i]) >= water[i]) water[i] = NO_WATER;
  }
}

// ---- Điểm xuất hiện ----
/** World border hiện tại (hình vuông): tâm, kích thước và hai góc. Mặc định là cả map. */
export function borderBox(t) {
  const b = t.border, n = t.size;
  const size = b ? b.size : n, cx = b ? b.cx : n / 2, cz = b ? b.cz : n / 2;
  return { cx, cz, size, x0: cx - size / 2, z0: cz - size / 2, x1: cx + size / 2, z1: cz + size / 2 };
}
/** Đặt world border: kích thước làm tròn bội của 4 (16 đến cả map), luôn nằm gọn trong map. Trả về true nếu có thay đổi. */
export function setBorder(t, cx, cz, size) {
  const n = t.size;
  size = Math.min(n, Math.max(16, Math.round(size / 4) * 4));
  cx = Math.min(n - size / 2, Math.max(size / 2, Math.round(cx)));
  cz = Math.min(n - size / 2, Math.max(size / 2, Math.round(cz)));
  const old = borderBox(t);
  const full = size === n;
  t.border = full ? null : { cx, cz, size };
  const nw = borderBox(t);
  return nw.cx !== old.cx || nw.cz !== old.cz || nw.size !== old.size;
}
export function spawnCell(t) {
  const mid = Math.floor(t.size / 2);
  const s = t.spawn;
  return s && s.x >= 0 && s.z >= 0 && s.x < t.size && s.z < t.size ? { x: s.x, z: s.z } : { x: mid, z: mid };
}

// ---- Công trình đã đặt ----
/** Tạo bản ghi đặt công trình: tâm đáy nằm ở ô (cx, cz), đáy cách mặt đất yOffset khối. */
export function makePlacement(t, schem, name, cx, cz, { rot = 0, flip = false, air = false, yOffset = 0 } = {}) {
  const [w, l] = dimsAfter(schem.w, schem.l, rot);
  return { name, x: cx - (w >> 1), y: heightAt(t, cx, cz) + 1 + yOffset, z: cz - (l >> 1), rot: rot & 3, flip: !!flip, air: !!air };
}
export function placementBox(p, schem) {
  const [w, l] = dimsAfter(schem.w, schem.l, p.rot);
  return { x0: p.x, z0: p.z, x1: p.x + w - 1, z1: p.z + l - 1, w, l };
}

// ---- Xuất ----
// Khối mob đi xuyên qua hoặc đứng lên được như không có (dùng để tìm chỗ đứng trong công trình).
const NON_SOLID = new RegExp('(torch|door|_gate$|ladder|vine|_button$|pressure_plate|_sign$|banner|rail$|redstone_wire|carpet|^minecraft:lever$|tripwire|lantern|candle|^minecraft:chain$'
  + '|^minecraft:(short_|tall_)?grass$|^minecraft:fern$|^minecraft:large_fern$|sapling|^minecraft:(dandelion|poppy|allium|azure_bluet|cornflower|oxeye_daisy|lily_of_the_valley|rose_bush|peony|lilac|sunflower)$|_tulip$|_orchid$|flower_pot|^minecraft:snow$)');
const isNonSolidName = (name) => isAirName(name) || isSkipName(name) || NON_SOLID.test(name);

/**
 * Tạo đối tượng world cho exportWorld() từ mô hình địa hình. Map nằm ở toạ độ khối 0..size-1.
 * @param {Map<string, object>} [library] các schem đã đọc (parseSchem), theo tên dùng trong t.placements
 */
export function terrainToWorld(t, opts = {}, library = new Map()) {
  const { size } = t;
  const blocks = new Uint16Array(CHUNK_VOLUME);
  const biomes = new Uint8Array(BIOME_CELLS);
  const idx = (x, y, z) => ((y - MIN_Y) * 16 + z) * 16 + x;
  const depth = Math.max(0, t.rules.dirtDepth);
  const layersY = BIOME_CELLS / 16;

  // Bảng khối chung: khối địa hình + mọi trạng thái khối của các công trình (đã xoay/lật).
  const blockPalette = BLOCK_PALETTE.slice();
  const paletteIndex = new Map();
  const stateKey = (st) => st.Name + (st.Properties ? JSON.stringify(Object.entries(st.Properties).sort()) : '');
  blockPalette.forEach((st, i) => paletteIndex.set(stateKey(st), i));
  const SKIP = 0xffff;
  const placed = [];
  const blockEntitiesByChunk = new Map();
  const missing = new Set();
  for (const p of t.placements ?? []) {
    const schem = library.get(p.name);
    if (!schem) { missing.add(p.name); continue; }
    const map = new Uint16Array(schem.palette.length);
    const solid = new Uint8Array(schem.palette.length);
    schem.palette.forEach((str, i) => {
      const st = transformState(parseState(str), p.rot, p.flip);
      solid[i] = isNonSolidName(st.Name) ? 0 : 1;
      if (isSkipName(st.Name) || (isAirName(st.Name) && !p.air)) { map[i] = SKIP; return; }
      if (isAirName(st.Name)) { map[i] = B_AIR; return; }
      const k = stateKey(st);
      let g = paletteIndex.get(k);
      if (g === undefined) { g = blockPalette.length; blockPalette.push(st); paletteIndex.set(k, g); }
      map[i] = g;
    });
    let found;
    if (p.found && /^minecraft:[a-z_]+$/.test(p.found)) {
      const st = { Name: p.found }, k = stateKey(st);
      found = paletteIndex.get(k);
      if (found === undefined) { found = blockPalette.length; blockPalette.push(st); paletteIndex.set(k, found); }
    }
    placed.push({ p, schem, map, solid, found, box: placementBox(p, schem) });
    for (const be of schem.blockEntities ?? []) {
      const [fx, fz] = forward(be.x, be.z, schem.w, schem.l, p.rot, p.flip);
      const x = p.x + fx, y = p.y + be.y, z = p.z + fz;
      if (x < 0 || z < 0 || x >= size || z >= size || y <= MIN_Y || y > MAX_Y) continue;
      const key = (x >> 4) + ',' + (z >> 4);
      if (!blockEntitiesByChunk.has(key)) blockEntitiesByChunk.set(key, []);
      blockEntitiesByChunk.get(key).push({
        ...be.tags,
        id: { t: 8, v: be.id }, x: { t: 3, v: x }, y: { t: 3, v: y }, z: { t: 3, v: z }, keepPacked: { t: 1, v: 0 },
      });
    }
  }
  // Cây và vật thể: sinh khối một lần, đăng ký trạng thái khối vào bảng chung, rồi chia theo chunk. Công trình đặt sau nên đè lên cây.
  const propChunks = new Map(); // "cx,cz" -> mảng phẳng [x, y, z, khối, mềm, ...]
  for (const pr of t.props ?? []) {
    if (!PROP_BY_KEY[pr.k]) continue;
    const px = Math.floor(pr.x), pz = Math.floor(pr.z);
    if (px < 0 || pz < 0 || px >= size || pz >= size || waterAt(t, px, pz) !== NO_WATER) continue;
    if (placed.some(({ box }) => px >= box.x0 && px <= box.x1 && pz >= box.z0 && pz <= box.z1)) continue;
    const y0 = heightAt(t, px, pz) + 1;
    const put = (wx, y, wz, g, soft) => {
      if (wx < 0 || wz < 0 || wx >= size || wz >= size || y <= MIN_Y || y > MAX_Y) return;
      const key = (wx >> 4) + ',' + (wz >> 4);
      let list = propChunks.get(key); if (!list) propChunks.set(key, list = []);
      list.push(wx, y, wz, g, soft);
    };
    for (const [dx, dy, dz, str, fl] of propBlocks(pr)) {
      const st = parseState(str);
      let g = B_AIR;
      if (!isAirName(st.Name)) {
        const k = stateKey(st);
        g = paletteIndex.get(k);
        if (g === undefined) { g = blockPalette.length; blockPalette.push(st); paletteIndex.set(k, g); }
      }
      const wx = px + dx, wz = pz + dz, y = y0 + dy;
      put(wx, y, wz, g, fl & 2 ? 1 : 0);
      if (fl & 1 && dy === 0 && wx >= 0 && wz >= 0 && wx < size && wz < size) { // chân thân cây trên sườn dốc: kéo xuống tới mặt đất của chính ô đó
        const gy = heightAt(t, wx, wz);
        for (let yy = y - 1; yy > gy && yy > y - 12; yy--) put(wx, yy, wz, g, 0);
      }
    }
  }
  // Thang cho hào chiến đấu: ô đáy hào (ván gỗ) sát bờ bao cát cao hơn từ 3 khối trở lên thì cứ mỗi 8 ô dọc hào dựng một thang leo lên bờ,
  // mỗi bên một thang cùng hàng nên trèo qua hào được từ hai phía. Thang gắn vào vách, quay ra phía lòng hào.
  {
    const LADDER = { '1,0': 'west', '-1,0': 'east', '0,1': 'north', '0,-1': 'south' };
    const ladderIds = {};
    for (const f of Object.values(LADDER)) {
      const st = { Name: 'minecraft:ladder', Properties: { facing: f, waterlogged: 'false' } }, k = stateKey(st);
      let g = paletteIndex.get(k);
      if (g === undefined) { g = blockPalette.length; blockPalette.push(st); paletteIndex.set(k, g); }
      ladderIds[f] = g;
    }
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      if (t.material[z * size + x] !== MAT.PLANK || t.water[z * size + x] !== NO_WATER) continue;
      const h = Math.round(t.heights[z * size + x]);
      for (const [d, f] of Object.entries(LADDER)) {
        const [dx, dz] = d.split(',').map(Number);
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= size || nz >= size || t.material[nz * size + nx] !== MAT.SANDBAG) continue;
        const nh = Math.round(t.heights[nz * size + nx]);
        if (nh - h < 3) continue;
        if ((dx !== 0 ? z : x) % 8 !== 4) continue;
        for (let y = h + 1; y <= nh && y <= MAX_Y; y++) {
          const key = (x >> 4) + ',' + (z >> 4);
          let list = propChunks.get(key); if (!list) propChunks.set(key, list = []);
          list.push(x, y, z, ladderIds[f], 0);
        }
        break;
      }
    }
  }
  if (blockPalette.length >= SKIP) throw new Error('Quá nhiều loại khối trong các công trình');

  /** Mob "trong hang": sàn hang trên cùng bên dưới mặt đất (quét cột khối đã đục hang), không có hang thì null. */
  function caveFloorY(x, z, h) {
    const cx = x >> 4, cz = z >> 4;
    const c = getChunk(cx, cz), lx = x - cx * 16, lz = z - cz * 16;
    for (let y = Math.min(MAX_Y - 2, h - 3); y > MIN_Y + 1; y--) {
      const here = c.blocks[idx(lx, y, lz)];
      if (here !== B_AIR) continue;
      if (c.blocks[idx(lx, y + 1, lz)] !== B_AIR) continue;
      const below = c.blocks[idx(lx, y - 1, lz)];
      if (below !== B_AIR && below !== B_WATER) return y;
    }
    return null;
  }

  /** Độ cao chân đứng của mob tại ô (x, z): mặt đất, hoặc sàn công trình nếu mob nằm trong/trên công trình. */
  function mobY(m) {
    const x = Math.min(size - 1, Math.max(0, Math.floor(m.x))), z = Math.min(size - 1, Math.max(0, Math.floor(m.z)));
    const h = heightAt(t, x, z);
    if (m.cave) { const cy = caveFloorY(x, z, h); if (cy !== null) return cy; }
    let over = null, top = h;
    for (const { p, schem, map, solid, box } of placed) {
      if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) continue;
      const [sx, sz] = inverse(x - p.x, z - p.z, schem.w, schem.l, p.rot, p.flip);
      for (let y = 0; y < schem.h; y++) {
        const idx0 = schem.data[(y * schem.l + sz) * schem.w + sx];
        if (map[idx0] === SKIP) continue;
        (over ??= new Map()).set(p.y + y, solid[idx0] === 1 && map[idx0] !== B_AIR);
        if (p.y + y > top) top = p.y + y;
      }
    }
    if (!over) return h + 1;
    const isSolid = (y) => (over.has(y) ? over.get(y) : y <= h);
    for (let y = h + 1; y <= top + 1; y++) if (isSolid(y - 1) && !isSolid(y) && !isSolid(y + 1)) return y;
    return top + 1;
  }

  // Viền ngoài map (ngoài world border): dãy núi hoặc biển bao quanh, để không thấy khoảng trống ở chân trời.
  const rim = opts.rim === 'mountain' || opts.rim === 'sea' ? opts.rim : null;
  const rimW = rim ? Math.max(16, Math.min(256, Math.round(opts.rimWidth ?? 96))) : 0;
  const rimChunks = Math.ceil(rimW / 16);
  const rimH = opts.rimHeight ?? 70, sea = opts.rimSea ?? 62;
  const h2 = (x, z) => { let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1) ^ 0x5bd1e995) | 0; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); return ((h ^ (h >>> 13)) >>> 0) / 4294967295; };
  const noise2 = (x, z) => { // nhiễu mượt 0..1
    const xi = Math.floor(x), zi = Math.floor(z), u = x - xi, v = z - zi, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
    const p = h2(xi, zi), q = h2(xi + 1, zi), r = h2(xi, zi + 1), w = h2(xi + 1, zi + 1);
    return p + (q - p) * a + (r - p + (w - r - q + p) * a) * b;
  };
  function rimHeight(wx, wz) {
    const dx = wx < 0 ? -wx : wx >= size ? wx - size + 1 : 0, dz = wz < 0 ? -wz : wz >= size ? wz - size + 1 : 0;
    const d = Math.hypot(dx, dz);
    if (d > rimW) return null;
    const e = heightAt(t, wx, wz); // heightAt tự kẹp toạ độ: đây là độ cao ô mép map gần nhất
    if (rim === 'sea') return Math.round(Math.max(sea - 14, Math.min(e - d * 1.5, sea + 40)));
    const u = Math.min(1, d / (rimW * 0.7)), ridge = (1 - Math.cos(Math.PI * u)) / 2;
    const out = d > rimW * 0.7 ? 1 - 0.5 * (d - rimW * 0.7) / (rimW * 0.3) : 1; // mặt ngoài thấp dần
    const hgt = e + ridge * out * rimH * (0.7 + 0.6 * noise2(wx / 41, wz / 41)) + Math.min(1, d / 8) * 7 * (noise2(wx / 9, wz / 9) - 0.5);
    return Math.round(Math.min(MAX_HEIGHT, hgt));
  }
  function rimColumn(x, z, wx, wz) {
    const h = rimHeight(wx, wz);
    if (h === null) return;
    let top = 4, under = 3; // cỏ trên đất
    if (rim === 'sea') { if (h <= sea + 1) { top = 7; under = 8; } }
    else {
      const slope = Math.max(Math.abs((rimHeight(wx + 1, wz) ?? h) - (rimHeight(wx - 1, wz) ?? h)), Math.abs((rimHeight(wx, wz + 1) ?? h) - (rimHeight(wx, wz - 1) ?? h)));
      if (h >= t.rules.snowLine) { top = 9; under = 9; } else if (slope >= t.rules.slopeStone * 2) { top = B_STONE; under = B_STONE; }
    }
    blocks[idx(x, MIN_Y, z)] = B_BEDROCK;
    for (let y = MIN_Y + 1; y <= h; y++) blocks[idx(x, y, z)] = y < 0 ? B_DEEPSLATE : B_STONE;
    for (let y = Math.max(MIN_Y + 1, h - 3); y < h; y++) blocks[idx(x, y, z)] = under;
    blocks[idx(x, h, z)] = top;
    if (rim === 'sea') for (let y = h + 1; y <= sea; y++) blocks[idx(x, y, z)] = B_WATER;
  }

  const carve = makeCarver(t, (x, z) => heightAt(t, x, z), B_AIR);

  function getChunk(cx, cz) {
    blocks.fill(B_AIR);
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const wx = cx * 16 + x, wz = cz * 16 + z;
        if (wx < 0 || wz < 0 || wx >= size || wz >= size) { if (rim) rimColumn(x, z, wx, wz); continue; }
        const h = heightAt(t, wx, wz);
        const m = MATERIALS[materialAt(t, wx, wz)];
        blocks[idx(x, MIN_Y, z)] = B_BEDROCK;
        for (let y = MIN_Y + 1; y <= h; y++) blocks[idx(x, y, z)] = y < 0 ? B_DEEPSLATE : B_STONE;
        if (m.under !== B_STONE) for (let y = Math.max(MIN_Y + 1, h - depth); y < h; y++) blocks[idx(x, y, z)] = m.under;
        blocks[idx(x, h, z)] = m.top;
        const wl = waterAt(t, wx, wz);
        if (wl !== NO_WATER) for (let y = h + 1; y <= wl; y++) blocks[idx(x, y, z)] = B_WATER;
        else if (m.cover) blocks[idx(x, h + 1, z)] = m.cover;
        else if (t.deco[wz * size + wx] && !m.covers) {
          const D = DECO[t.deco[wz * size + wx] - 1];
          if (D && decoFits(D, m.top)) { blocks[idx(x, h + 1, z)] = D.b; if (D.up !== undefined && h + 2 < MAX_Y) blocks[idx(x, h + 2, z)] = D.up; }
        }
        else if (m.covers && hash2(wx, wz) < (m.coverP ?? 1)) blocks[idx(x, h + 1, z)] = m.covers[Math.floor(hash2(wz + 7, wx - 3) * m.covers.length) % m.covers.length];
      }
    }
    carve(cx, cz, blocks, idx); // hang động: đục trước khi dán công trình
    const pl = propChunks.get(cx + ',' + cz);
    if (pl) {
      for (let k = 0; k < pl.length; k += 5) {
        const at = idx(pl[k] - cx * 16, pl[k + 1], pl[k + 2] - cz * 16);
        if (pl[k + 4] && blocks[at] !== B_AIR) continue; // lá, hoa, cỏ chỉ mọc vào chỗ trống
        blocks[at] = pl[k + 3];
      }
    }
    // Dán công trình (đặt sau thì đè lên đặt trước).
    const bx0 = cx * 16, bz0 = cz * 16;
    // Móng: dưới mỗi cột đặc ở tầng đáy của công trình, đắp khối móng từ mặt đất lên sát sàn (sườn dốc không còn công trình lơ lửng).
    for (const { p, schem, map, box, found } of placed) {
      if (found === undefined) continue;
      const xa = Math.max(bx0, box.x0, 0), xb = Math.min(bx0 + 15, box.x1, size - 1);
      const za = Math.max(bz0, box.z0, 0), zb = Math.min(bz0 + 15, box.z1, size - 1);
      for (let wz = za; wz <= zb; wz++) {
        for (let wx = xa; wx <= xb; wx++) {
          const [sx, sz] = inverse(wx - p.x, wz - p.z, schem.w, schem.l, p.rot, p.flip);
          const g0 = map[schem.data[sz * schem.w + sx]];
          if (g0 === SKIP || g0 === B_AIR) continue;
          for (let y = Math.max(MIN_Y + 1, heightAt(t, wx, wz)); y < p.y; y++) blocks[idx(wx - bx0, y, wz - bz0)] = found;
        }
      }
    }
    for (const { p, schem, map, box } of placed) {
      const xa = Math.max(bx0, box.x0, 0), xb = Math.min(bx0 + 15, box.x1, size - 1);
      const za = Math.max(bz0, box.z0, 0), zb = Math.min(bz0 + 15, box.z1, size - 1);
      if (xa > xb || za > zb) continue;
      const ya = Math.max(0, MIN_Y + 1 - p.y), yb = Math.min(schem.h - 1, MAX_Y - p.y);
      for (let wz = za; wz <= zb; wz++) {
        for (let wx = xa; wx <= xb; wx++) {
          const [sx, sz] = inverse(wx - p.x, wz - p.z, schem.w, schem.l, p.rot, p.flip);
          for (let y = ya; y <= yb; y++) {
            const g = map[schem.data[(y * schem.l + sz) * schem.w + sx]];
            if (g !== SKIP) blocks[idx(wx - bx0, p.y + y, wz - bz0)] = g;
          }
        }
      }
    }
    for (let qz = 0; qz < 4; qz++) {
      for (let qx = 0; qx < 4; qx++) {
        const wx = Math.max(0, Math.min(size - 1, cx * 16 + qx * 4 + 2)), wz = Math.max(0, Math.min(size - 1, cz * 16 + qz * 4 + 2));
        const b = t.biome[wz * size + wx];
        for (let qy = 0; qy < layersY; qy++) biomes[(qy * 4 + qz) * 4 + qx] = b;
      }
    }
    return { blocks, biomes, blockEntities: blockEntitiesByChunk.get(cx + ',' + cz) };
  }

  const sp = spawnCell(t);
  const nChunks = Math.ceil(size / 16);
  const wl = waterAt(t, sp.x, sp.z);
  return {
    name: opts.name ?? 'Map mới',
    blockPalette,
    biomePalette: [t.baseBiome, ...BIOMES.map((b) => b.id)],
    outsideBiome: t.baseBiome,
    chunkBounds: { minX: 0 - rimChunks, minZ: 0 - rimChunks, maxX: nChunks - 1 + rimChunks, maxZ: nChunks - 1 + rimChunks },
    getChunk,
    entities: mobsToEntities((t.mobs ?? []).filter((m) => m.x >= 0 && m.z >= 0 && m.x < size && m.z < size), mobY),
    spawn: [sp.x, Math.max(heightAt(t, sp.x, sp.z), wl) + 2, sp.z],
    border: { centerX: borderBox(t).cx, centerZ: borderBox(t).cz, size: opts.borderSize ?? borderBox(t).size },
    gameType: opts.gameType ?? 1,
    gameRules: opts.mobSpawning ? {} : { doMobSpawning: 'false' },
    missingStructures: [...missing],
  };
}

// ---- Lưu / mở dự án và chuyển dữ liệu giữa cửa sổ với tiến trình chính ----
export function packTerrain(t) {
  const layers = {};
  for (const k of LAYERS) layers[k] = t[k];
  return {
    meta: {
      format: 'minecraft-map-builder', version: 5, size: t.size, baseBiome: t.baseBiome, rules: t.rules,
      spawn: t.spawn, border: t.border, placements: t.placements, mobs: t.mobs, props: t.props, cave: t.cave, scenario: t.scenario,
    },
    layers,
  };
}
const LAYER_TYPES = { heights: Float32Array, water: Int16Array, material: Uint8Array, biome: Uint8Array, caveMask: Uint8Array, caveFloor: Int16Array, caveHeight: Uint8Array, deco: Uint8Array };
export function unpackTerrain({ meta, layers }) {
  if (!meta || meta.format !== 'minecraft-map-builder') throw new Error('Không phải tệp dự án Map Builder');
  const t = createTerrain({ size: meta.size, baseBiome: meta.baseBiome });
  t.rules = { ...DEFAULT_RULES, ...meta.rules };
  t.spawn = meta.spawn && Number.isInteger(meta.spawn.x) && Number.isInteger(meta.spawn.z) ? { x: meta.spawn.x, z: meta.spawn.z } : null;
  t.border = null;
  if (meta.border && [meta.border.cx, meta.border.cz, meta.border.size].every(Number.isFinite)) { setBorder(t, meta.border.cx, meta.border.cz, meta.border.size); }
  t.placements = Array.isArray(meta.placements) ? meta.placements.map((p) => ({ ...p })) : [];
  t.scenario = normalizeScenario(meta.scenario);
  t.mobs = Array.isArray(meta.mobs) ? meta.mobs.map((m) => ({ ...m })) : [];
  t.props = Array.isArray(meta.props) ? meta.props.filter((p) => p && PROP_BY_KEY[p.k] && Number.isFinite(p.x) && Number.isFinite(p.z)).map((p) => ({ ...p })) : [];
  t.cave = { ...DEFAULT_CAVE, ...(meta.cave ?? {}) };
  for (const k of LAYERS) {
    const src = layers?.[k];
    if (!src) { if (k === 'heights') throw new Error('Tệp dự án thiếu dữ liệu độ cao'); continue; }
    const arr = src instanceof LAYER_TYPES[k] ? src : new LAYER_TYPES[k](src.buffer ?? src, src.byteOffset ?? 0, (src.byteLength ?? src.length) / LAYER_TYPES[k].BYTES_PER_ELEMENT);
    if (arr.length !== meta.size * meta.size) throw new Error('Tệp dự án bị hỏng (sai kích thước)');
    t[k] = arr.slice();
  }
  return t;
}
