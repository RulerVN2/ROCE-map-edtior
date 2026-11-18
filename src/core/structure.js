// Công trình (schem) đã đặt lên map: xoay/lật toạ độ và thuộc tính khối, màu xem trước. Không phụ thuộc Node.

const AIR = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air']);
export const isAirName = (name) => AIR.has(name);
export const isSkipName = (name) => name === 'minecraft:structure_void';

/** "minecraft:oak_stairs[facing=north,half=bottom]" -> { Name, Properties? } */
export function parseState(str) {
  const i = str.indexOf('[');
  if (i < 0) return { Name: str };
  const Properties = {};
  for (const kv of str.slice(i + 1, str.lastIndexOf(']')).split(',')) {
    const e = kv.indexOf('=');
    if (e > 0) Properties[kv.slice(0, e).trim()] = kv.slice(e + 1).trim();
  }
  return { Name: str.slice(0, i), Properties };
}

/** Kích thước (rộng theo x, dài theo z) sau khi xoay rot*90 độ. */
export const dimsAfter = (w, l, rot) => (rot & 1 ? [l, w] : [w, l]);

/** Toạ độ trong schem gốc -> toạ độ sau khi lật (theo trục x) rồi xoay rot*90 độ theo chiều kim đồng hồ. */
export function forward(sx, sz, w, l, rot, flip) {
  if (flip) sx = w - 1 - sx;
  switch (rot & 3) {
    case 0: return [sx, sz];
    case 1: return [l - 1 - sz, sx];
    case 2: return [w - 1 - sx, l - 1 - sz];
    default: return [sz, w - 1 - sx];
  }
}
/** Ngược lại với forward(): toạ độ sau khi xoay/lật -> toạ độ trong schem gốc. */
export function inverse(x, z, w, l, rot, flip) {
  let sx, sz;
  switch (rot & 3) {
    case 0: sx = x; sz = z; break;
    case 1: sx = z; sz = l - 1 - x; break;
    case 2: sx = w - 1 - x; sz = l - 1 - z; break;
    default: sx = w - 1 - z; sz = x; break;
  }
  if (flip) sx = w - 1 - sx;
  return [sx, sz];
}

const CW = { north: 'east', east: 'south', south: 'west', west: 'north' };
const MIRROR = { east: 'west', west: 'east', north: 'north', south: 'south' };
function turnDir(d, rot, flip) {
  if (!(d in CW)) return d;
  if (flip) d = MIRROR[d];
  for (let i = 0; i < (rot & 3); i++) d = CW[d];
  return d;
}
const SWAP_LR = { left: 'right', right: 'left', inner_left: 'inner_right', inner_right: 'inner_left', outer_left: 'outer_right', outer_right: 'outer_left' };
const CORNERS = new Set(['south_east', 'south_west', 'north_west', 'north_east']);

/** Xoay/lật thuộc tính của một trạng thái khối cho khớp với công trình đã xoay/lật. */
export function transformState(state, rot, flip) {
  rot &= 3;
  if ((!rot && !flip) || !state.Properties) return state;
  const src = state.Properties, out = {};
  for (const [k, v] of Object.entries(src)) {
    if (k in CW) { out[turnDir(k, rot, flip)] = v; continue; } // hàng rào, tường, kính, dây leo...
    let nv = v;
    if (k === 'facing' || k === 'horizontal_facing') nv = turnDir(v, rot, flip);
    else if (k === 'axis') nv = (rot & 1) && v !== 'y' ? (v === 'x' ? 'z' : 'x') : v;
    else if (k === 'rotation' && /^\d+$/.test(v)) { // biển, cờ, đầu lâu: 16 hướng
      let r = Number(v); if (flip) r = (16 - r) % 16; nv = String((r + 4 * rot) % 16);
    } else if (k === 'shape') {
      if (v === 'north_south' || v === 'east_west') nv = rot & 1 ? (v === 'north_south' ? 'east_west' : 'north_south') : v;
      else if (v.startsWith('ascending_')) nv = 'ascending_' + turnDir(v.slice(10), rot, flip);
      else if (CORNERS.has(v)) { // ray cong
        const [a, b] = v.split('_').map((d) => turnDir(d, rot, flip));
        nv = a === 'north' || a === 'south' ? `${a}_${b}` : `${b}_${a}`;
      } else if (flip && v in SWAP_LR) nv = SWAP_LR[v]; // cầu thang góc
    } else if (flip && (k === 'hinge' || (k === 'type' && (v === 'left' || v === 'right')))) nv = SWAP_LR[v] ?? v;
    out[k] = nv;
  }
  return { Name: state.Name, Properties: out };
}

// ---- Màu xem trước trong Editor ----
const COLOR_RULES = [
  [/glass/, [170, 205, 220]], [/water/, [58, 110, 190]], [/lava/, [220, 110, 30]],
  [/torch|lantern|glowstone|campfire|shroomlight/, [245, 205, 90]],
  [/^(short_|tall_)?grass$|fern|sapling|bush|sugar_cane|bamboo|cactus|wheat|carrots|potatoes|beetroots|melon_stem|pumpkin_stem|lily_pad|seagrass|kelp/, [92, 148, 62]],
  [/dandelion|sunflower/, [236, 200, 50]], [/poppy|tulip|rose/, [200, 60, 50]], [/cornflower|orchid/, [80, 130, 220]],
  [/allium|lilac|peony/, [190, 120, 210]], [/bluet|daisy|lily_of_the_valley/, [225, 228, 225]],
  [/leaves|vine/, [62, 120, 48]], [/grass_block|moss(?!y)/, [104, 158, 74]], [/hay/, [196, 166, 38]],
  [/mossy/, [104, 128, 96]],
  [/stone_brick/, [134, 134, 138]], [/cobble/, [108, 108, 108]], [/smooth_stone|polished_andesite/, [160, 160, 160]],
  [/deepslate|blackstone|basalt|obsidian|coal/, [56, 56, 62]],
  [/snow|quartz|calcite|white_|bone/, [232, 234, 236]],
  [/sandstone|^sand$|end_stone/, [216, 203, 155]],
  [/birch_(log|wood)/, [214, 212, 204]], [/(dark_oak|spruce)_(log|wood)/, [58, 37, 16]], [/(log|wood)$/, [109, 85, 50]],
  [/birch/, [196, 179, 123]], [/dark_oak/, [70, 46, 22]], [/spruce/, [114, 84, 48]], [/jungle/, [160, 115, 80]],
  [/acacia/, [168, 90, 50]], [/mangrove|crimson/, [117, 54, 48]], [/cherry/, [226, 178, 172]],
  [/oak|planks|crafting|ladder|chest|barrel|bookshelf|lectern|composter|loom|fence|door|sign/, [162, 130, 78]],
  [/^bricks?$|^brick_/, [150, 97, 83]], [/terracotta/, [152, 94, 67]],
  [/light_gray_/, [142, 142, 134]], [/light_blue_/, [58, 175, 217]],
  [/red_|nether_wart/, [160, 39, 34]], [/orange_|pumpkin/, [240, 118, 19]], [/yellow_/, [248, 197, 39]], [/lime_/, [112, 185, 25]],
  [/green_/, [84, 109, 27]], [/cyan_/, [21, 137, 145]], [/blue_/, [53, 57, 157]], [/purple_/, [121, 42, 172]],
  [/magenta_/, [189, 68, 179]], [/pink_/, [237, 141, 172]], [/brown_/, [114, 71, 40]], [/black_/, [24, 25, 30]], [/gray_/, [62, 68, 71]],
  [/gold/, [246, 208, 61]], [/iron|anvil|chain|cauldron|hopper/, [200, 200, 200]], [/copper/, [192, 107, 79]],
  [/emerald/, [42, 176, 82]], [/lapis/, [38, 67, 137]], [/prismarine/, [99, 156, 151]],
  [/dirt|mud|path|farmland|podzol|soul/, [128, 94, 66]], [/gravel/, [131, 127, 126]],
  [/wool|concrete|carpet|banner/, [222, 222, 222]],
  [/stone|andesite|tuff|furnace|brick|smoker|dispenser|grindstone/, [124, 124, 124]],
];
export function blockColor(name) {
  const n = name.replace('minecraft:', '');
  for (const [re, c] of COLOR_RULES) if (re.test(n)) return c;
  let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0;
  return [110 + (h & 63), 100 + ((h >> 6) & 63), 96 + ((h >> 12) & 63)];
}

/** Dáng gần đúng của khối khi vẽ trong Editor. */
export const SHAPE = { FULL: 0, SLAB_BOTTOM: 1, SLAB_TOP: 2, POST: 3, FLAT: 4, PANEL: 5, SHORT_POST: 6 };
const RE_POST = /fence(?!_gate)|_wall$|iron_bars|chain$|lantern|end_rod|lightning_rod|_sign$|banner|bamboo|sugar_cane|scaffolding/;
const RE_SHORT = /torch|candle|flower|sapling|^(short_|tall_)?grass$|fern|dead_bush|lever|dandelion|poppy|tulip|orchid|allium|bluet|daisy|cornflower|lily_of|wheat|carrots|potatoes|beetroots/;
const RE_PANEL = /pane$|door$|fence_gate|ladder|vine/;
const RE_FLAT = /carpet|pressure_plate|^snow$|rail$|trapdoor|redstone_wire|lily_pad|_button$/;
export function shapeOf(st) {
  const n = st.Name.replace('minecraft:', ''), p = st.Properties ?? {};
  if (/_slab$/.test(n)) return p.type === 'double' ? SHAPE.FULL : p.type === 'top' ? SHAPE.SLAB_TOP : SHAPE.SLAB_BOTTOM;
  if (/_bed$/.test(n)) return SHAPE.SLAB_BOTTOM;
  if (RE_FLAT.test(n)) return SHAPE.FLAT;
  if (RE_PANEL.test(n)) return SHAPE.PANEL;
  if (RE_SHORT.test(n)) return SHAPE.SHORT_POST;
  if (RE_POST.test(n)) return SHAPE.POST;
  return SHAPE.FULL;
}

/**
 * Dữ liệu vẽ xem trước của một schem sau khi xoay/lật:
 * tops[z*w+x] = y cục bộ của khối đặc cao nhất (-1 nếu cột rỗng), colors = màu 0xRRGGBB của khối đó,
 * cols[(y*l+z)*w+x] = màu + 1 của từng khối (0 = rỗng), shapes = dáng khối (xem SHAPE) để vẽ đúng từng khối.
 */
export function buildTopMap(schem, rot, flip) {
  const [w, l] = dimsAfter(schem.w, schem.l, rot);
  const h = schem.h;
  const tops = new Int16Array(w * l).fill(-1);
  const colors = new Uint32Array(w * l);
  const cols = new Uint32Array(w * l * h);
  const shapes = new Uint8Array(w * l * h);
  const ids = new Uint16Array(w * l * h);       // chỉ số khối trong bảng `pal` (+1), để tra texture
  const pal = schem.palette.map((s) => s.split('[')[0]);
  const palShape = schem.palette.map((s) => shapeOf(transformState(parseState(s), rot, flip)));
  const solid = schem.palette.map((s) => { const n = s.split('[')[0]; return !isAirName(n) && !isSkipName(n); });
  const palColor = schem.palette.map((s) => { const c = blockColor(s.split('[')[0]); return (c[0] << 16) | (c[1] << 8) | c[2]; });
  for (let z = 0; z < l; z++) {
    for (let x = 0; x < w; x++) {
      const [sx, sz] = inverse(x, z, schem.w, schem.l, rot, flip);
      for (let y = 0; y < h; y++) {
        const p = schem.data[(y * schem.l + sz) * schem.w + sx];
        if (!solid[p]) continue;
        cols[(y * l + z) * w + x] = palColor[p] + 1;
        shapes[(y * l + z) * w + x] = palShape[p]; ids[(y * l + z) * w + x] = p + 1;
        tops[z * w + x] = y; colors[z * w + x] = palColor[p];
      }
    }
  }
  return { w, l, h, tops, colors, cols, shapes, ids, pal };
}
