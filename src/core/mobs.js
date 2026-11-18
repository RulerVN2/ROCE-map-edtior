// Mob (sinh vật) đặt trên map: danh sách mẫu có sẵn, xếp đội hình, kiểm tra dữ liệu và tạo entity khi xuất.
import * as nbt from './nbt-tags.js';
import { parseSnbt } from './snbt.js';
import { MOD_UNITS, COLORS, BUILDINGS, BUILDING_PREFIX, PLACEHOLDER_ID, isScenarioObject } from './scenario.js';

const item = (id) => `{id:"minecraft:${id}",Count:1b}`;
const gear = (boots, legs, chest, head, main, off) =>
  `ArmorItems:[${[boots, legs, chest, head].map((x) => (x ? item(x) : '{}')).join(',')}],HandItems:[${main ? item(main) : '{}'},${off ? item(off) : '{}'}]`;
const IRON = ['iron_boots', 'iron_leggings', 'iron_chestplate', 'iron_helmet'];
const GOLD = ['golden_boots', 'golden_leggings', 'golden_chestplate', 'golden_helmet'];
const DIAMOND = ['diamond_boots', 'diamond_leggings', 'diamond_chestplate', 'diamond_helmet'];
const LEATHER = ['leather_boots', 'leather_leggings', 'leather_chestplate', 'leather_helmet'];

export const MOB_GROUPS = ['Lính (có giáp)', 'Quái vật', 'Dân và vật nuôi', 'Khác', 'Đơn vị mod AoE2', 'Công trình và vật giữ chỗ (AoE2)'];

/** Mẫu mob có sẵn. snbt: các tag thêm vào entity. */
export const MOB_CATALOG = [
  { key: 'zombie_iron', group: 0, name: 'Zombie giáp sắt', id: 'minecraft:zombie', snbt: `{${gear(...IRON, 'iron_sword')}}`, tip: 'Có mũ sắt nên không cháy dưới nắng.' },
  { key: 'zombie_diamond', group: 0, name: 'Zombie giáp kim cương', id: 'minecraft:zombie', snbt: `{${gear(...DIAMOND, 'diamond_sword')}}`, tip: 'Có mũ nên không cháy dưới nắng.' },
  { key: 'skeleton_iron', group: 0, name: 'Skeleton giáp sắt, cung', id: 'minecraft:skeleton', snbt: `{${gear(...IRON, 'bow')}}`, tip: 'Có mũ sắt nên không cháy dưới nắng.' },
  { key: 'pillager', group: 0, name: 'Pillager (cung thủ nỏ)', id: 'minecraft:pillager', snbt: '', tip: 'Không cháy nắng, cầm nỏ sẵn.' },
  { key: 'vindicator', group: 0, name: 'Vindicator (lính rìu)', id: 'minecraft:vindicator', snbt: `{HandItems:[${item('iron_axe')},{}]}`, tip: 'Không cháy nắng.' },
  { key: 'evoker', group: 0, name: 'Evoker (pháp sư)', id: 'minecraft:evoker', snbt: '' },
  { key: 'ravager', group: 0, name: 'Ravager (quái húc)', id: 'minecraft:ravager', snbt: '' },
  { key: 'stand_iron', group: 0, name: 'Hình nhân giáp sắt, kiếm', id: 'minecraft:armor_stand', snbt: `{ShowArms:1b,${gear(...IRON, 'iron_sword')}}`, tip: 'Giá giáp đứng yên, tiện dùng làm lính đứng nền.' },
  { key: 'stand_gold', group: 0, name: 'Hình nhân giáp vàng, kiếm', id: 'minecraft:armor_stand', snbt: `{ShowArms:1b,${gear(...GOLD, 'golden_sword')}}` },
  { key: 'stand_leather', group: 0, name: 'Hình nhân giáp da, cung', id: 'minecraft:armor_stand', snbt: `{ShowArms:1b,${gear(...LEATHER, 'bow')}}` },

  { key: 'zombie', group: 1, name: 'Zombie', id: 'minecraft:zombie', snbt: '', tip: 'Cháy dưới nắng nếu không đội mũ.' },
  { key: 'skeleton', group: 1, name: 'Skeleton', id: 'minecraft:skeleton', snbt: '', tip: 'Cháy dưới nắng nếu không đội mũ.' },
  { key: 'creeper', group: 1, name: 'Creeper', id: 'minecraft:creeper', snbt: '' },
  { key: 'spider', group: 1, name: 'Nhện', id: 'minecraft:spider', snbt: '' },
  { key: 'witch', group: 1, name: 'Phù thuỷ', id: 'minecraft:witch', snbt: '' },
  { key: 'enderman', group: 1, name: 'Enderman', id: 'minecraft:enderman', snbt: '' },
  { key: 'iron_golem', group: 1, name: 'Golem sắt', id: 'minecraft:iron_golem', snbt: '' },

  { key: 'villager', group: 2, name: 'Dân làng', id: 'minecraft:villager', snbt: '' },
  { key: 'horse', group: 2, name: 'Ngựa có yên', id: 'minecraft:horse', snbt: `{Tame:1b,SaddleItem:${item('saddle')}}`, tip: 'Ngựa đã thuần và có yên, cưỡi được ngay.' },
  { key: 'horse_armor', group: 2, name: 'Ngựa giáp sắt', id: 'minecraft:horse', snbt: `{Tame:1b,SaddleItem:${item('saddle')},ArmorItem:${item('iron_horse_armor')}}` },
  { key: 'cow', group: 2, name: 'Bò', id: 'minecraft:cow', snbt: '' },
  { key: 'sheep', group: 2, name: 'Cừu', id: 'minecraft:sheep', snbt: '' },
  { key: 'pig', group: 2, name: 'Lợn', id: 'minecraft:pig', snbt: '' },
  { key: 'chicken', group: 2, name: 'Gà', id: 'minecraft:chicken', snbt: '' },
  { key: 'wolf', group: 2, name: 'Sói', id: 'minecraft:wolf', snbt: '' },

  { key: 'boat', group: 3, name: 'Thuyền gỗ sồi', id: 'minecraft:oak_boat', snbt: '' },
  { key: 'minecart', group: 3, name: 'Xe goòng', id: 'minecraft:minecart', snbt: '' },
  { key: 'stand', group: 3, name: 'Giá giáp trống', id: 'minecraft:armor_stand', snbt: '{ShowArms:1b}' },

  // Đơn vị của mod Rise of Cubic Empire (entity aoe2:<id>). Gán ô người chơi ở bảng [Người chơi] để chia phe.
  ...MOD_UNITS.map(([id, name]) => ({ key: 'aoe2_' + id, group: 4, name, id: 'aoe2:' + id, snbt: '', tip: `aoe2:${id}. Chọn "Ô người chơi" bên dưới để đơn vị thuộc về một phe.` })),
  // Chỉ có trong editor (không thành entity): mod dựng công trình xong sẵn khi ván bắt đầu, và vật giữ chỗ chống bị loại.
  ...BUILDINGS.map(([id, name]) => ({ key: 'aoeb_' + id, group: 5, name: name + ' (đặt sẵn)', id: BUILDING_PREFIX + id, snbt: '', tip: 'Công trình dựng xong sẵn khi ván bắt đầu. Bắt buộc chọn "Ô người chơi". Town Center đầu tiên của ô sẽ là nơi camera bắt đầu. R để xoay.' })),
  { key: 'aoep_placeholder', group: 5, name: 'Vật giữ chỗ (vô hình)', id: PLACEHOLDER_ID, snbt: '', tip: 'Vật vô hình như AoE2: ô có vật này sẽ không bị loại khi hết công trình quan trọng. Nếu ô không có gì khác, camera bắt đầu ở đây.' },
];

const ID_RE = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
// Các tag chương trình tự quyết định, bỏ qua nếu người dùng gõ vào.
const RESERVED = ['id', 'Pos', 'UUID', 'Motion', 'Rotation'];

/** Trả về null nếu hợp lệ, hoặc câu báo lỗi tiếng Việt. */
export function checkMobSpec(id, snbt) {
  if (!ID_RE.test(String(id ?? '').trim())) return 'ID mob phải dạng tênmod:tênmob, chữ thường, ví dụ minecraft:zombie hoặc recruits:recruit';
  try { parseSnbt(snbt); } catch (e) { return 'NBT không đọc được: ' + e.message; }
  return null;
}

/**
 * Vị trí các mob của một lần bấm. Trả về [{x, z}] theo toạ độ khối (có phần lẻ), tâm là (cx, cz).
 * formation: 'single' | 'line' | 'grid' | 'scatter'. yaw: độ, hướng mặt (0 = nam, 90 = tây, 180 = bắc, 270 = đông).
 */
export function formationPoints(count, formation, spacing, yaw, cx, cz, rng = Math.random) {
  const n = Math.max(1, Math.min(500, count | 0));
  const out = [];
  const a = (yaw * Math.PI) / 180;
  const fwd = [-Math.sin(a), Math.cos(a)];     // hướng mặt nhìn
  const side = [Math.cos(a), Math.sin(a)];     // hướng sang ngang
  const put = (along, back) => out.push({ x: cx + side[0] * along - fwd[0] * back, z: cz + side[1] * along - fwd[1] * back });
  if (formation === 'single' || n === 1) return [{ x: cx, z: cz }];
  if (formation === 'line') {
    for (let i = 0; i < n; i++) put((i - (n - 1) / 2) * spacing, 0);
  } else if (formation === 'grid') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 2)));
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = r === rows - 1 ? n - r * cols : cols; // hàng cuối thiếu thì căn giữa
      put((c - (inRow - 1) / 2) * spacing, (r - (rows - 1) / 2) * spacing);
    }
  } else {
    const R = Math.max(spacing, spacing * Math.sqrt(n) * 0.65);
    const pts = [];
    for (let i = 0; i < n; i++) {
      let best = null, bestD = -1;
      for (let k = 0; k < 12; k++) { // chọn điểm ngẫu nhiên xa các điểm đã có nhất, cho đều tay
        const r = R * Math.sqrt(rng()), th = rng() * Math.PI * 2;
        const p = { x: cx + r * Math.cos(th), z: cz + r * Math.sin(th) };
        let d = Infinity;
        for (const q of pts) d = Math.min(d, (p.x - q.x) ** 2 + (p.z - q.z) ** 2);
        if (d > bestD) { bestD = d; best = p; }
      }
      pts.push(best);
    }
    return pts;
  }
  // Khoảng cách nguyên thì đặt đúng giữa ô khối, mob không đứng trên góc giữa bốn khối.
  return Number.isInteger(spacing) ? out.map((p) => ({ x: Math.floor(p.x) + 0.5, z: Math.floor(p.z) + 0.5 })) : out;
}

/** Bản ghi mob lưu trong dự án. */
export function makeMob({ id, snbt = '', x, z, yaw = 0, noAI = false, persist = true, dy = 0, label = '', g = 0, cave = false, slot = 0 }) {
  return { id: id.trim(), snbt: snbt.trim(), x, z, yaw: ((yaw % 360) + 360) % 360, noAI: !!noAI, persist: !!persist, dy, label, g, cave: !!cave, slot: Math.min(8, Math.max(0, slot | 0)) };
}

/**
 * Đổi các bản ghi mob thành entity cho exportWorld.
 * @param {(m:object)=>number} groundY hàm cho biết độ cao chân đứng (toạ độ y của mob) tại vị trí mob
 */
export function mobsToEntities(mobs, groundY) {
  const out = [];
  for (const m of mobs) {
    if (isScenarioObject(m)) continue;                       // công trình đặt sẵn và vật giữ chỗ chỉ đi vào aoe2_scenario.json
    const extra = {};
    if (m.noAI) extra.NoAI = nbt.byte(1);
    if (m.persist) extra.PersistenceRequired = nbt.byte(1);
    if (m.slot > 0) extra.ScenarioSlot = nbt.int(m.slot);   // mod AoE2 đọc tag này để chia chủ sở hữu
    const user = parseSnbt(m.snbt);
    for (const k of RESERVED) delete user[k];
    out.push({ id: m.id, pos: [m.x, groundY(m) + (m.dy || 0), m.z], yaw: m.yaw, nbt: { ...extra, ...user } });
  }
  return out;
}

const hashHue = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h % 360; };
// Màu riêng cho từng mẫu có sẵn, chọn cho dễ phân biệt trên nền cỏ.
const CATALOG_COLORS = {
  zombie_iron: '#5fb36a', zombie_diamond: '#3fd0d8', skeleton_iron: '#e8e8e8', pillager: '#9aa3ad', vindicator: '#6c7a89', evoker: '#c9a227',
  ravager: '#7a5c4a', stand_iron: '#cfd4dc', stand_gold: '#f2c94c', stand_leather: '#b0703c',
  zombie: '#3f8f4f', skeleton: '#c8c8c8', creeper: '#39d353', spider: '#7b2d26', witch: '#8e44ad', enderman: '#b04ad6', iron_golem: '#e0d6c8',
  villager: '#c98a5a', horse: '#a0522d', horse_armor: '#d9d9d9', cow: '#5c4033', sheep: '#ffffff', pig: '#f4a3b4', chicken: '#fff1a8', wolf: '#bfc5cc',
  boat: '#b8935a', minecart: '#8d99a6', stand: '#d2b48c',
};
const SHAPES = ['shield', 'triangle', 'circle', 'diamond', 'star', 'diamond']; // theo nhóm trong MOB_GROUPS
const byLabel = new Map(MOB_CATALOG.map((m) => [m.name + '|' + m.id, m]));

/**
 * Cách vẽ một mob trên khung nhìn: màu và hình dạng.
 * Lính: khiên; quái: tam giác; dân và vật nuôi: tròn; khác: thoi; mob của mod hoặc tự nhập: sao.
 */
export function mobStyle(m) {
  const sl = m.slot | 0;
  const c = byLabel.get((m.label ?? '') + '|' + m.id);
  if (c) return { color: sl > 0 ? COLORS[sl - 1][2] : (CATALOG_COLORS[c.key] ?? '#ffffff'), shape: SHAPES[c.group] ?? 'star' };
  return { color: sl > 0 ? COLORS[sl - 1][2] : `hsl(${hashHue(m.id + (m.label ?? ''))} 85% 62%)`, shape: 'star' };
}
export const mobColor = (id, label = '') => mobStyle({ id, label }).color;

/** Gom mob thành nhóm (mỗi lần bấm đặt là một nhóm). Trả về [{ key, label, id, count, x, z, members }]. */
export function mobGroups(mobs) {
  const map = new Map();
  mobs.forEach((m, i) => {
    const key = m.g ? `g${m.g}|${m.label}|${m.id}` : `i${i}`;
    let g = map.get(key);
    if (!g) map.set(key, g = { key, label: m.label || m.id, id: m.id, count: 0, x: 0, z: 0, members: [] });
    g.count++; g.x += m.x; g.z += m.z; g.members.push(m);
  });
  const out = [...map.values()];
  for (const g of out) { g.x /= g.count; g.z /= g.count; }
  return out;
}
export const mobGroupKey = (m, i) => (m.g ? `g${m.g}|${m.label}|${m.id}` : `i${i}`);

// Ký hiệu hiển thị trong biểu tượng trên map: nhìn là biết loại quân / công trình (emoji; không khớp thì chữ cái đầu).
const GLYPHS = [
  [/placeholder/, '👻'], [/king|hero/, '👑'], [/villager/, '⛏'], [/militia|swordsman|champion|legionary/, '⚔'], [/spearman|pikeman|halberd/, '🔱'],
  [/skirmisher|elite_skirm/, '🎯'], [/crossbow|archer|bow/, '🏹'], [/scout|knight|cavalry|cavalier|paladin|camel|horse/, '🐎'], [/monk/, '✝'],
  [/ram|mangonel|onager|scorpion|catapult|trebuchet|siege/, '🪨'], [/galley|ship|boat|fishing/, '⛵'], [/trade_cart|cart/, '🛒'],
  [/town_center/, '🏛'], [/house/, '🏠'], [/barracks/, '⚔'], [/archery/, '🏹'], [/stable/, '🐎'], [/siege_workshop/, '🪨'], [/mill|farm/, '🌾'],
  [/lumber/, '🪵'], [/mining/, '⛏'], [/blacksmith/, '🔨'], [/market/, '💰'], [/castle/, '🏰'], [/tower|outpost/, '🗼'], [/monastery/, '⛪'],
  [/dock/, '⚓'], [/wall|gate/, '🧱'], [/university/, '🎓'], [/wonder/, '🗽'],
  [/zombie/, '🧟'], [/skeleton/, '💀'], [/creeper/, '💥'], [/spider/, '🕷'], [/witch/, '🧙'], [/enderman/, '👁'], [/golem/, '🤖'], [/pillager|vindicator|evoker/, '🪓'],
  [/cow/, '🐄'], [/pig/, '🐖'], [/sheep/, '🐑'], [/chicken/, '🐔'], [/wolf/, '🐺'], [/stand/, '🧍'], [/minecart/, '🛤'],
];
export function mobGlyph(id) {
  const k = String(id ?? '').replace(/^[a-z0-9_.-]*:/, '').toLowerCase();
  for (const [re, g] of GLYPHS) if (re.test(k)) return g;
  return k ? k[0].toUpperCase() : '?';
}
