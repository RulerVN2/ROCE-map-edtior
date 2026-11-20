// Kịch bản (scenario) cho mod Rise of Cubic Empire: 8 ô người chơi như AoE2 Scenario Editor.
// Dữ liệu nằm trong dự án (terrain.scenario) và được xuất thành aoe2_scenario.json cạnh level.dat.

export const MAX_PLAYERS = 8;
export const CIVS = [
  ['britons', 'Britons'], ['mongols', 'Mongols'], ['franks', 'Franks'], ['byzantines', 'Byzantines'], ['celts', 'Celts'],
  ['chinese', 'Chinese'], ['goths', 'Goths'], ['japanese', 'Japanese'], ['vikings', 'Vikings'],
];
export const COLORS = [
  ['blue', 'Xanh dương', '#2F5FD0'], ['red', 'Đỏ', '#D03030'], ['green', 'Xanh lá', '#2FA02F'], ['yellow', 'Vàng', '#E8D030'],
  ['cyan', 'Lam nhạt', '#30C8D0'], ['purple', 'Tím', '#9040C0'], ['gray', 'Xám', '#909090'], ['orange', 'Cam', '#E88020'],
];
export const AGES = ['Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];

/** Đơn vị của mod: [id, tên]. Entity trong game là aoe2:<id>. */
export const MOD_UNITS = [
  ['villager', 'Villager'],
  ['militia', 'Militia'],
  ['man_at_arms', 'Man-at-Arms'],
  ['spearman', 'Spearman'],
  ['long_swordsman', 'Long Swordsman'],
  ['pikeman', 'Pikeman'],
  ['archer', 'Archer'],
  ['longbowman', 'Longbowman'],
  ['elite_longbowman', 'Elite Longbowman'],
  ['throwing_axeman', 'Throwing Axeman'],
  ['elite_throwing_axeman', 'Elite Throwing Axeman'],
  ['chu_ko_nu', 'Chu Ko Nu'],
  ['elite_chu_ko_nu', 'Elite Chu Ko Nu'],
  ['highlander', 'Highlander'],
  ['raider', 'Raider'],
  ['axe_raider', 'Axe Raider'],
  ['bearded_axeman', 'Bearded Axeman'],
  ['great_axeman', 'Great Axeman'],
  ['hirdman', 'Hirdman'],
  ['norse_bowman', 'Norse Bowman'],
  ['hird_bowman', 'Hird Bowman'],
  ['marksman_of_the_hird', 'Marksman of the Hird'],
  ['berserk', 'Berserk'],
  ['elite_berserk', 'Elite Berserk'],
  ['watchman', 'Watchman'],
  ['elite_watchman', 'Elite Watchman'],
  ['varangian_guard', 'Varangian Guard'],
  ['elite_varangian_guard', 'Elite Varangian Guard'],
  ['war_engineer', 'War Engineer'],
  ['woad_raider', 'Woad Raider'],
  ['elite_woad_raider', 'Elite Woad Raider'],
  ['cataphract', 'Cataphract'],
  ['elite_cataphract', 'Elite Cataphract'],
  ['mangudai', 'Mangudai'],
  ['elite_mangudai', 'Elite Mangudai'],
  ['light_cavalry', 'Light Cavalry'],
  ['cavalier', 'Cavalier'],
  ['smoke_bomber', 'Smoke Bomber'],
  ['carnyx_player', 'Carnyx Player'],
  ['oriflamme_bearer', 'Oriflamme Bearer'],
  ['taiko_drummer', 'Taiko Drummer'],
  ['royal_saiones', 'Royal Saiones'],
  ['scara', 'Scara'],
  ['monk', 'Monk'],
  ['skirmisher', 'Skirmisher'],
  ['scout_cavalry', 'Scout Cavalry'],
  ['crossbowman', 'Crossbowman'],
  ['elite_skirmisher', 'Elite Skirmisher'],
  ['cavalry_archer', 'Cavalry Archer'],
  ['mounted_crossbowman', 'Mounted Crossbowman'],
  ['knight', 'Knight'],
  ['camel_rider', 'Camel Rider'],
  ['steppe_lancer', 'Steppe Lancer'],
  ['two_handed_swordsman', 'Two-Handed Swordsman'],
  ['champion', 'Champion'],
  ['halberdier', 'Halberdier'],
  ['huskarl', 'Huskarl'],
  ['elite_huskarl', 'Elite Huskarl'],
  ['ninja', 'Ninja'],
  ['elite_ninja', 'Elite Ninja'],
  ['samurai', 'Samurai'],
  ['elite_samurai', 'Elite Samurai'],
  ['fire_lancer', 'Fire Lancer'],
  ['elite_fire_lancer', 'Elite Fire Lancer'],
  ['arbalester', 'Arbalester'],
  ['heavy_cavalry_archer', 'Heavy Cavalry Archer'],
  ['hand_cannoneer', 'Hand Cannoneer'],
  ['huo_hu_gunner', 'Tiger Gunner'],
  ['ashigaru', 'Ashigaru'],
  ['paladin', 'Paladin'],
  ['hussar', 'Hussar'],
  ['heavy_camel_rider', 'Heavy Camel Rider'],
  ['elite_steppe_lancer', 'Elite Steppe Lancer'],
  ['heavy_mounted_crossbowman', 'Heavy Mounted Crossbowman'],
];


export const BUILDINGS = [
  ['town_center', 'Town Center'], ['house', 'House'], ['lumber_camp', 'Lumber Camp'], ['mining_camp', 'Mining Camp'], ['mill', 'Mill'],
  ['barracks', 'Barracks'], ['archery_range', 'Archery Range'], ['stable', 'Stable'], ['siege_workshop', 'Siege Workshop'],
  ['blacksmith', 'Blacksmith'], ['market', 'Market'], ['monastery', 'Monastery'], ['university', 'University'], ['castle', 'Castle'],
  ['watch_tower', 'Watch Tower'], ['guard_tower', 'Guard Tower'], ['keep', 'Keep'], ['bombard_tower', 'Bombard Tower'], ['dock', 'Dock'],
  ['xenon_hospital', 'Xenon Hospital'], ['palisade_wall', 'Palisade Wall'], ['stone_wall', 'Stone Wall'], ['fortified_wall', 'Fortified Wall'],
  ['palisade_gate', 'Palisade Gate'], ['stone_gate', 'Stone Gate'],
];
/** Kích thước nền [rộng, sâu] của từng công trình (khối) khi chưa xoay; khớp với enum Building của mod. */
export const BUILDING_DIMS = {
  town_center: [11, 11], house: [4, 4], lumber_camp: [5, 5], mining_camp: [5, 5], mill: [5, 5], barracks: [9, 11], archery_range: [11, 9], stable: [9, 7],
  siege_workshop: [15, 13], blacksmith: [9, 11], market: [15, 11], monastery: [15, 13], university: [15, 13], castle: [19, 19], watch_tower: [7, 7],
  guard_tower: [7, 7], keep: [9, 9], bombard_tower: [7, 7], dock: [11, 13], xenon_hospital: [13, 13], palisade_wall: [2, 2], stone_wall: [2, 2],
  fortified_wall: [2, 2], palisade_gate: [8, 2], stone_gate: [8, 2],
};
/** Id đặc biệt của "mob" chỉ có ở editor: công trình đặt sẵn và vật giữ chỗ (không thành entity trong thế giới). */
export const BUILDING_PREFIX = 'aoe2b:';
export const PLACEHOLDER_ID = 'aoe2p:placeholder';
export const isPlacedBuilding = (m) => typeof m?.id === 'string' && m.id.startsWith(BUILDING_PREFIX);
export const isPlaceholder = (m) => m?.id === PLACEHOLDER_ID;
export const isScenarioObject = (m) => isPlacedBuilding(m) || isPlaceholder(m);
/** Xoay (0..3) từ góc yaw của mob. */
export const rotOf = (yaw) => ((Math.round((yaw || 0) / 90) % 4) + 4) % 4;

/** Hình chữ nhật nền [x0, z0, x1, z1] (cạnh khối, x1/z1 là cạnh ngoài) của công trình đặt ở ô gốc (ox, oz) với xoay rot 0..3; khớp BuildingPlacement.worldPos của mod. */
export function footprintRect(building, ox, oz, rot) {
  const [w, d] = BUILDING_DIMS[building] ?? [1, 1];
  const at = (lx, lz) => {
    const rx = lx - (w >> 1), rz = lz - (d >> 1);
    return rot === 1 ? [-rz, rx] : rot === 2 ? [-rx, -rz] : rot === 3 ? [rz, -rx] : [rx, rz];
  };
  const [ax, az] = at(0, 0), [cx, cz] = at(w - 1, d - 1);
  return [ox + Math.min(ax, cx), oz + Math.min(az, cz), ox + Math.max(ax, cx) + 1, oz + Math.max(az, cz) + 1];
}

export const RES = [['food', 'Thức ăn'], ['wood', 'Gỗ'], ['gold', 'Vàng'], ['stone', 'Đá']];
export const OPS = ['>=', '<=', '==', '>', '<', '!='];
export const DIFFICULTIES = ['Dễ', 'Thường', 'Khó'];

/**
 * Mô tả các điều kiện và hành động của trigger. Mỗi trường: [khoá, nhãn, kiểu, mặc định].
 * Kiểu: slot, slot0 (cho phép 0), zone, zone? (không bắt buộc), taskforce, unit, building, building*, res, op, int, text, bool, trigger,
 * team, order, stance, what, objstate, opset, trigop, result, objective, objis, age (0..3), sound, aistance, tech (mã công nghệ).
 */
export const COND_TYPES = {
  timer: { cat: 'Thời gian & biến', label: 'Đã qua số giây', fields: [['seconds', 'Giây', 'int', 60]] },
  unitCount: { cat: 'Quân & công trình', label: 'Số quân', fields: [['slot', 'Ô', 'slot', 1], ['unit', 'Loại', 'unit', 'any'], ['op', '', 'op', '>='], ['n', 'Số', 'int', 1]] },
  buildingCount: { cat: 'Quân & công trình', label: 'Số công trình', fields: [['slot', 'Ô', 'slot', 1], ['building', 'Loại', 'building*', 'any'], ['op', '', 'op', '>='], ['n', 'Số', 'int', 1]] },
  inZone: { cat: 'Quân & công trình', label: 'Quân ở trong vùng', fields: [['slot', 'Ô', 'slot', 1], ['zone', 'Vùng', 'zone', ''], ['op', '', 'op', '>='], ['n', 'Số', 'int', 1]] },
  detect: { cat: 'Quân & công trình', label: 'Phát hiện (tầm nhìn)', fields: [['viewer', 'Ô nhìn', 'slot', 1], ['target', 'Thấy ô', 'slot', 2], ['what', 'Thấy gì', 'what', 'any']] },
  resource: { cat: 'Kinh tế', label: 'Tài nguyên', fields: [['slot', 'Ô', 'slot', 1], ['res', 'Loại', 'res', 'gold'], ['op', '', 'op', '>='], ['n', 'Số', 'int', 500]] },
  flag: { cat: 'Thời gian & biến', label: 'Cờ / biến', fields: [['name', 'Tên cờ', 'text', 'co1'], ['op', '', 'op', '>='], ['n', 'Giá trị', 'int', 1]] },
  ageReached: { cat: 'Thời đại & tech', label: 'Đã lên thời đại', fields: [['slot', 'Ô', 'slot', 1], ['op', '', 'op', '>='], ['n', 'Thời đại', 'age', 1]] },
  techDone: { cat: 'Thời đại & tech', label: 'Đã nghiên cứu xong', fields: [['slot', 'Ô', 'slot', 1], ['tech', 'Mã công nghệ', 'tech', '']] },
  population: { cat: 'Quân & công trình', label: 'Dân số', fields: [['slot', 'Ô', 'slot', 1], ['op', '', 'op', '>='], ['n', 'Số', 'int', 50]] },
  kills: { cat: 'Quân & công trình', label: 'Số địch đã hạ', fields: [['slot', 'Ô', 'slot', 1], ['op', '', 'op', '>='], ['n', 'Số', 'int', 20]] },
  teamCount: { cat: 'Đội quân', label: 'Số quân còn sống của đội', fields: [['team', 'Tên đội', 'team', ''], ['op', '', 'op', '<='], ['n', 'Số', 'int', 3]] },
  objectiveIs: { cat: 'Mục tiêu', label: 'Trạng thái mục tiêu', fields: [['id', 'Mục tiêu', 'objective', ''], ['state', 'Đang ở', 'objis', 'done']] },
  teamDead: { cat: 'Đội quân', label: 'Đội bị diệt', fields: [['team', 'Tên đội', 'team', '']] },
};
export const ACT_TYPES = {
  createTeam: { cat: 'Đội quân', label: 'Lập đội quân', fields: [['slot', 'Ô', 'slot', 2], ['taskforce', 'Đội mẫu', 'taskforce', ''], ['zone', 'Tại vùng', 'zone?', ''], ['team', 'Tên đội', 'text', 'doi1']] },
  teamOrder: { cat: 'Đội quân', label: 'Ra lệnh cho đội', fields: [['team', 'Tên đội', 'team', ''], ['order', 'Lệnh', 'order', 'attack'], ['zone', 'Vùng', 'zone?', '']] },
  aiJobs: { cat: 'AI & kinh tế', label: 'Đặt tỉ lệ dân làm việc', fields: [['slot', 'Ô', 'slot', 2], ['food', 'Ăn', 'int', 25], ['wood', 'Gỗ', 'int', 40], ['gold', 'Vàng', 'int', 20], ['stone', 'Đá', 'int', 15]] },
  aiCheat: { cat: 'AI & kinh tế', label: 'Bật/tắt cheat tài nguyên', fields: [['slot', 'Ô', 'slot', 2], ['on', 'Bật', 'bool', true], ['rate', 'Mỗi loại/phút', 'int', 60]] },
  aiBuild: { cat: 'AI & kinh tế', label: 'AI đặt công trình', fields: [['slot', 'Ô', 'slot', 2], ['building', 'Loại', 'building', 'barracks'], ['zone', 'Trong vùng', 'zone', '']] },
  giveRes: { cat: 'AI & kinh tế', label: 'Cho / trừ tài nguyên', fields: [['slot', 'Ô', 'slot', 1], ['res', 'Loại', 'res', 'gold'], ['n', 'Số (âm = trừ)', 'int', 100]] },
  diplomacy: { cat: 'Thế giới', label: 'Đổi ngoại giao', fields: [['a', 'Ô A', 'slot', 1], ['b', 'Ô B', 'slot', 2], ['stance', 'Thành', 'stance', 'enemy']] },
  objective: { cat: 'Mục tiêu', label: 'Đổi trạng thái mục tiêu', fields: [['id', 'Mục tiêu', 'objective', ''], ['state', 'Làm gì', 'objstate', 'show']] },
  setAge: { cat: 'Thời đại & tech', label: 'Đặt thời đại', fields: [['slot', 'Ô', 'slot', 1], ['age', 'Thời đại', 'age', 1]] },
  research: { cat: 'Thời đại & tech', label: 'Cho công nghệ (miễn phí)', fields: [['slot', 'Ô', 'slot', 1], ['tech', 'Mã công nghệ', 'tech', '']] },
  killTeam: { cat: 'Đội quân', label: 'Diệt cả đội', fields: [['team', 'Tên đội', 'team', '']] },
  setStance: { cat: 'Đội quân', label: 'Đổi thế đánh của đội', fields: [['team', 'Tên đội', 'team', ''], ['stance', 'Thế', 'aistance', 'aggressive']] },
  sound: { cat: 'Thông báo', label: 'Phát âm thanh', fields: [['sound', 'Âm', 'sound', 'horn']] },
  result: { cat: 'Thông báo', label: 'Thắng / thua kịch bản', fields: [['value', 'Kết quả', 'result', 'win'], ['text', 'Lời nhắn', 'text', '']] },
  message: { cat: 'Thông báo', label: 'Hiện tin nhắn', fields: [['text', 'Nội dung', 'text', '']] },
  setFlag: { cat: 'Thời gian & biến', label: 'Đặt cờ / biến', fields: [['name', 'Tên cờ', 'text', 'co1'], ['op', '', 'opset', 'set'], ['n', 'Giá trị', 'int', 1]] },
  trigger: { cat: 'Thời gian & biến', label: 'Điều khiển trigger khác', fields: [['id', 'Trigger', 'trigger', ''], ['op', '', 'trigop', 'enable'], ['delay', 'Chờ (giây)', 'int', 0]] },
};
export const ORDERS = [['move', 'Đi tới vùng'], ['attack', 'Tấn công (đi tới vùng rồi đánh)'], ['guard', 'Canh gác tại chỗ'], ['hold', 'Đứng yên'], ['home', 'Về Town Center'], ['disband', 'Giải tán đội']];

export function defaultScenario() {
  return {
    name: 'Kịch bản mới',
    fog: true,                       // sương mù chiến tranh: kịch bản mặc định bật
    difficulty: 1,
    players: Array.from({ length: MAX_PLAYERS }, (_, i) => ({
      active: i < 2, civ: CIVS[i % CIVS.length][0], color: COLORS[i][0], team: 0,
      food: 200, wood: 200, gold: 100, stone: 200, age: 0,
    })),
    zones: [],                       // [{id, name, x0, z0, x1, z1}]
    taskforces: [],                  // [{id, name, units: [{unit, count}]}]
    ai: Array.from({ length: MAX_PLAYERS }, () => ({ enabled: false, cheat: false, cheatRate: 60, builders: 2, jobs: { food: 25, wood: 40, gold: 20, stone: 15 } })),
    objectives: [],                  // [{id, text, shown, goal, flag}] hiện ở HUD Mục tiêu; goal>0: tự hoàn thành khi cờ `flag` đạt goal
    triggers: [],                    // [{id, name, enabled, once, repeat, any, diff:[b,b,b], conditions:[{type,...}], actions:[{type,...}]}]
  };
}

const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };
const str = (v, d = '', max = 200) => (typeof v === 'string' ? v.slice(0, max) : d);
const idOk = (s) => /^[A-Za-z0-9_.-]{1,40}$/.test(s);

function cleanParams(src, schema) {
  const out = {};
  for (const [k, , kind, def] of schema.fields) {
    const v = src?.[k];
    if (kind === 'int' || kind === 'slot' || kind === 'slot0') out[k] = num(v, kind === 'int' ? -999999 : 0, kind === 'int' ? 999999 : MAX_PLAYERS, def);
    else if (kind === 'age') out[k] = num(v, 0, 3, def);
    else if (kind === 'bool') out[k] = v === undefined ? def : !!v;
    else out[k] = str(v, def, 200);
  }
  return out;
}

/** Làm sạch dữ liệu đọc từ tệp dự án (tệp cũ không có, hoặc bị sửa tay). */
export function normalizeScenario(s) {
  const d = defaultScenario();
  if (!s || typeof s !== 'object') return d;
  d.name = typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 60) : d.name;
  d.fog = s.fog === undefined ? true : !!s.fog;
  d.difficulty = num(s.difficulty, 0, 2, 1);
  const civs = new Set(CIVS.map((c) => c[0])), colors = new Set(COLORS.map((c) => c[0]));
  d.players = d.players.map((p, i) => {
    const q = Array.isArray(s.players) ? s.players[i] : null;
    if (!q) return p;
    return {
      active: !!q.active, civ: civs.has(q.civ) ? q.civ : p.civ, color: colors.has(q.color) ? q.color : p.color,
      team: num(q.team, 0, MAX_PLAYERS, 0),
      food: num(q.food, 0, 99999, p.food), wood: num(q.wood, 0, 99999, p.wood), gold: num(q.gold, 0, 99999, p.gold), stone: num(q.stone, 0, 99999, p.stone),
      age: num(q.age, 0, 3, 0),
    };
  });
  const seen = new Set();
  const uniq = (id) => { if (!idOk(id) || seen.has(id)) return null; seen.add(id); return id; };
  d.zones = (Array.isArray(s.zones) ? s.zones : []).map((z) => {
    const id = uniq(str(z?.id, '', 40)); if (!id) return null;
    const x0 = num(z.x0, 0, 99999, 0), x1 = num(z.x1, 0, 99999, 0), z0 = num(z.z0, 0, 99999, 0), z1 = num(z.z1, 0, 99999, 0);
    return { id, name: str(z.name, id, 40) || id, x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) };
  }).filter(Boolean);
  seen.clear();
  d.taskforces = (Array.isArray(s.taskforces) ? s.taskforces : []).map((tf) => {
    const id = uniq(str(tf?.id, '', 40)); if (!id) return null;
    const units = (Array.isArray(tf.units) ? tf.units : []).map((u) => ({ unit: str(u?.unit, '', 60), count: num(u?.count, 1, 200, 1) })).filter((u) => u.unit);
    return { id, name: str(tf.name, id, 40) || id, units };
  }).filter(Boolean);
  d.ai = d.ai.map((a, i) => {
    const q = Array.isArray(s.ai) ? s.ai[i] : null;
    if (!q) return a;
    const j = q.jobs ?? {};
    return {
      enabled: !!q.enabled, cheat: !!q.cheat, cheatRate: num(q.cheatRate, 0, 10000, 60), builders: num(q.builders, 1, 10, 2),
      jobs: { food: num(j.food, 0, 100, a.jobs.food), wood: num(j.wood, 0, 100, a.jobs.wood), gold: num(j.gold, 0, 100, a.jobs.gold), stone: num(j.stone, 0, 100, a.jobs.stone) },
    };
  });
  seen.clear();
  seen.clear();
  d.objectives = (Array.isArray(s.objectives) ? s.objectives : []).map((o) => {
    const id = uniq(str(o?.id, '', 40)); if (!id) return null;
    return { id, text: str(o.text, id, 160) || id, shown: o.shown !== false, goal: num(o.goal, 0, 999999, 0), flag: str(o.flag, '', 60) };
  }).filter(Boolean);
  // Tệp cũ: mục tiêu khai báo ngay trong hành động (text/goal/flag) thì chuyển thành mục tiêu khai báo.
  for (const t of Array.isArray(s.triggers) ? s.triggers : []) for (const a of Array.isArray(t?.actions) ? t.actions : []) {
    if (a?.type === 'objective' && typeof a.id === 'string' && a.text && !d.objectives.some((o) => o.id === a.id) && idOk(a.id)) {
      d.objectives.push({ id: a.id, text: str(a.text, a.id, 160), shown: false, goal: num(a.goal, 0, 999999, 0), flag: str(a.flag, '', 60) });
    }
    if (a?.type === 'objective' && a.state === 'add') a.state = 'show';
  }
  d.triggers = (Array.isArray(s.triggers) ? s.triggers : []).map((t) => {
    const id = uniq(str(t?.id, '', 40)); if (!id) return null;
    const diff = Array.isArray(t.diff) ? [0, 1, 2].map((k) => t.diff[k] !== false) : [true, true, true];
    const conds = (Array.isArray(t.conditions) ? t.conditions : []).filter((c) => COND_TYPES[c?.type]).map((c) => ({ type: c.type, ...cleanParams(c, COND_TYPES[c.type]) }));
    const acts = (Array.isArray(t.actions) ? t.actions : []).filter((a) => ACT_TYPES[a?.type]).map((a) => ({ type: a.type, ...cleanParams(a, ACT_TYPES[a.type]) }));
    return { id, name: str(t.name, id, 60) || id, enabled: t.enabled !== false, once: t.once !== false, repeat: num(t.repeat, 0, 86400, 0), any: !!t.any, diff, conditions: conds, actions: acts };
  }).filter(Boolean);
  return d;
}

/**
 * Nội dung aoe2_scenario.json. Ô người chơi đánh số 1..8 (0 là Gaia/trung lập) trùng với tag ScenarioSlot của entity.
 * Mod đọc tệp này khi bắt đầu ván: chia chủ sở hữu, phe, màu, tài nguyên, thời đại, sương mù theo ô, rồi chạy trigger và AI.
 */
export function scenarioJson(sc, mobs = []) {
  const s = normalizeScenario(sc);
  const count = new Array(MAX_PLAYERS + 1).fill(0);
  const buildings = [], placeholders = [], firstUnit = {}, firstBuilding = {}, firstTc = {}, firstPh = {};
  for (const m of mobs) {
    const k = m.slot | 0; if (k < 0 || k > MAX_PLAYERS) continue;
    const at = { x: Math.floor(m.x), z: Math.floor(m.z) };
    if (isPlacedBuilding(m)) {
      const b = { slot: k, building: m.id.slice(BUILDING_PREFIX.length), ...at, rot: rotOf(m.yaw) };
      buildings.push(b);
      if (k > 0) { firstBuilding[k] ??= at; if (b.building === 'town_center') firstTc[k] ??= at; }
    } else if (isPlaceholder(m)) {
      placeholders.push({ slot: k, ...at });
      if (k > 0) firstPh[k] ??= at;
    } else { count[k]++; if (k > 0) firstUnit[k] ??= at; }
  }
  const startOf = (k) => (firstTc[k] ? { ...firstTc[k], kind: 'town_center' } : firstBuilding[k] ? { ...firstBuilding[k], kind: 'building' }
    : firstUnit[k] ? { ...firstUnit[k], kind: 'unit' } : firstPh[k] ? { ...firstPh[k], kind: 'placeholder' } : null);
  return {
    format: 'aoe2-scenario', version: 3, name: s.name, fog: s.fog, difficulty: s.difficulty,
    players: s.players.map((p, i) => ({
      slot: i + 1, active: p.active, civ: p.civ, color: p.color, team: p.team, age: p.age,
      resources: { food: p.food, wood: p.wood, gold: p.gold, stone: p.stone }, units: count[i + 1], start: startOf(i + 1),
    })),
    gaiaUnits: count[0],
    buildings, placeholders,
    zones: s.zones,
    taskforces: s.taskforces,
    ai: s.ai.map((a, i) => ({ slot: i + 1, ...a })),
    objectives: s.objectives,
    triggers: s.triggers,
  };
}

/** Cảnh báo cho người làm kịch bản. Trả về mảng câu tiếng Việt. */
export function scenarioWarnings(sc, mobs = []) {
  const s = normalizeScenario(sc), out = [];
  const n = s.players.filter((p) => p.active).length;
  if (n < 1) out.push('Chưa bật ô người chơi nào.');
  const orphan = new Set();
  for (const m of mobs) { const k = m.slot | 0; if (k > 0 && !s.players[k - 1]?.active) orphan.add(k); }
  for (const k of [...orphan].sort()) out.push(`Ô ${k} đang tắt nhưng vẫn có đơn vị gán cho nó.`);
  const placed = mobs.filter(isPlacedBuilding);
  if (placed.some((m) => !(m.slot | 0))) out.push('Có công trình đặt sẵn chưa gán ô người chơi (Gaia không sở hữu công trình).');
  const rects = placed.filter((m) => (m.slot | 0) > 0).map((m) => ({ m, r: footprintRect(m.id.slice(BUILDING_PREFIX.length), Math.floor(m.x), Math.floor(m.z), rotOf(m.yaw)) }));
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i].r, b = rects[j].r;
    if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) out.push(`Hai công trình đặt sẵn đè lên nhau quanh (${Math.floor(rects[i].m.x)}, ${Math.floor(rects[i].m.z)}).`);
  }
  for (const m of mobs.filter(isPlaceholder)) if (!(m.slot | 0)) out.push('Có vật giữ chỗ chưa gán ô người chơi.');
  const zones = new Set(s.zones.map((z) => z.id)), tfs = new Set(s.taskforces.map((t) => t.id)), trs = new Set(s.triggers.map((t) => t.id));
  const objs = new Set(s.objectives.map((o) => o.id));
  const teams = new Set();
  for (const t of s.triggers) for (const a of t.actions) if (a.type === 'createTeam' && a.team) teams.add(a.team);
  for (const t of s.triggers) {
    const here = `Trigger "${t.name}": `;
    const items = [...t.conditions.map((c) => ({ ...c, _c: true })), ...t.actions];
    for (const it of items) {
      const schema = (it._c ? COND_TYPES : ACT_TYPES)[it.type];
      for (const [k, , kind] of schema.fields) {
        const v = it[k];
        if (kind === 'zone' && !zones.has(v)) out.push(here + 'chưa chọn vùng hợp lệ.');
        if (kind === 'taskforce' && !tfs.has(v)) out.push(here + 'chưa chọn đội mẫu hợp lệ.');
        if (kind === 'objective' && !objs.has(v)) out.push(here + 'chưa chọn mục tiêu (hoặc mục tiêu đã bị xoá).');
        if (kind === 'trigger' && !trs.has(v)) out.push(here + 'trigger được điều khiển không tồn tại.');
        if (kind === 'zone?' && v && !zones.has(v)) out.push(here + `vùng "${v}" không tồn tại.`);
        if (kind === 'team' && !teams.has(v)) out.push(here + `đội "${v}" chưa từng được lập ở trigger nào.`);
        if (kind === 'slot' && v >= 1 && !s.players[v - 1].active) out.push(here + `nhắc tới ô ${v} đang tắt.`);
        if (kind === 'slot' && it.type === 'createTeam' && v >= 1 && !s.ai[v - 1].enabled && !s.players[v - 1].active) out.push(here + `ô ${v} không hoạt động.`);
      }
      if (it.type === 'createTeam' && !it.zone) out.push(here + 'lập đội không chọn vùng: quân sẽ xuất hiện cạnh Town Center của ô đó (cần có sẵn).');
    }
    if (!t.actions.length) out.push(here + 'chưa có hành động nào.');
  }
  return [...new Set(out)];
}
