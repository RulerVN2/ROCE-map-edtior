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
  ['villager', 'Dân làng'],
  ['militia', "Dân Binh"],
  ['man_at_arms', "Lính Giáp"],
  ['spearman', "Lính Giáo"],
  ['long_swordsman', "Kiếm Sĩ Trường"],
  ['pikeman', "Lính Thương Dài"],
  ['archer', "Cung Thủ"],
  ['longbowman', "Cung Thủ Cung Dài"],
  ['elite_longbowman', "Cung Thủ Cung Dài Tinh Nhuệ"],
  ['throwing_axeman', "Lính Ném Rìu"],
  ['elite_throwing_axeman', "Lính Ném Rìu Tinh Nhuệ"],
  ['chu_ko_nu', "Liên Nỏ Chu Ko Nu"],
  ['elite_chu_ko_nu', "Liên Nỏ Chu Ko Nu Tinh Nhuệ"],
  ['highlander', "Chiến Binh Highlander"],
  ['raider', "Chiến Binh Đột Kích"],
  ['axe_raider', "Chiến Binh Rìu"],
  ['bearded_axeman', "Chiến Binh Rìu Râu"],
  ['great_axeman', "Chiến Binh Rìu Lớn"],
  ['hirdman', "Thân Binh Hirdman"],
  ['norse_bowman', "Cung Thủ Bắc Âu"],
  ['hird_bowman', "Cung Thủ Hird"],
  ['marksman_of_the_hird', "Xạ Thủ Thân Binh Hird"],
  ['berserk', "Chiến Binh Berserk"],
  ['elite_berserk', "Berserk Tinh Nhuệ"],
  ['watchman', "Lính Gác"],
  ['elite_watchman', "Lính Gác Tinh Nhuệ"],
  ['varangian_guard', "Vệ Binh Varangian"],
  ['elite_varangian_guard', "Vệ Binh Varangian Tinh Nhuệ"],
  ['war_engineer', "Kỹ Sư Chiến Tranh"],
  ['woad_raider', "Chiến Binh Woad"],
  ['elite_woad_raider', "Chiến Binh Woad Tinh Nhuệ"],
  ['cataphract', "Kỵ Binh Cataphract"],
  ['elite_cataphract', "Kỵ Binh Cataphract Tinh Nhuệ"],
  ['mangudai', "Kỵ Cung Mangudai"],
  ['elite_mangudai', "Kỵ Cung Mangudai Tinh Nhuệ"],
  ['light_cavalry', "Kỵ Binh Nhẹ"],
  ['cavalier', "Kỵ Sĩ Cavalier"],
  ['smoke_bomber', "Lính Ném Bom Khói"],
  ['carnyx_player', "Người Thổi Carnyx"],
  ['oriflamme_bearer', "Người Cầm Cờ Oriflamme"],
  ['taiko_drummer', "Tay Trống Taiko"],
  ['royal_saiones', "Kỵ Binh Saiones Hoàng Gia"],
  ['scara', "Cận Vệ Kỵ Binh Scara"],
  ['monk', "Tu Sĩ"],
  ['skirmisher', "Lính Phóng Lao"],
  ['scout_cavalry', "Kỵ Binh Trinh Sát"],
  ['crossbowman', "Lính Nỏ"],
  ['elite_skirmisher', "Lính Phóng Lao Tinh Nhuệ"],
  ['cavalry_archer', "Kỵ Cung"],
  ['mounted_crossbowman', "Kỵ Nỏ"],
  ['knight', "Hiệp Sĩ"],
  ['camel_rider', "Kỵ Binh Lạc Đà"],
  ['steppe_lancer', "Kỵ Thương Thảo Nguyên"],
  ['two_handed_swordsman', "Kiếm Sĩ Hai Tay"],
  ['champion', "Dũng Sĩ"],
  ['halberdier', "Lính Kích"],
  ['huskarl', "Huskarl"],
  ['elite_huskarl', "Huskarl Tinh Nhuệ"],
  ['ninja', "Ninja"],
  ['elite_ninja', "Ninja Tinh Nhuệ"],
  ['samurai', "Samurai"],
  ['elite_samurai', "Samurai Tinh Nhuệ"],
  ['fire_lancer', "Hỏa Thương Binh"],
  ['elite_fire_lancer', "Hỏa Thương Binh Tinh Nhuệ"],
  ['arbalester', "Xạ Thủ Nỏ Nặng"],
  ['heavy_cavalry_archer', "Kỵ Cung Hạng Nặng"],
  ['hand_cannoneer', "Pháo Thủ Cầm Tay"],
  ['huo_hu_gunner', "Hỏa Hổ Thủ"],
  ['ashigaru', "Ashigaru"],
  ['paladin', "Thánh Kỵ Sĩ"],
  ['hussar', "Kỵ Binh Hussar"],
  ['heavy_camel_rider', "Kỵ Binh Lạc Đà Hạng Nặng"],
  ['elite_steppe_lancer', "Kỵ Thương Thảo Nguyên Tinh Nhuệ"],
  ['heavy_mounted_crossbowman', "Kỵ Nỏ Hạng Nặng"],
];

export function defaultScenario() {
  return {
    name: 'Kịch bản mới',
    fog: true,                       // sương mù chiến tranh: kịch bản mặc định bật
    players: Array.from({ length: MAX_PLAYERS }, (_, i) => ({
      active: i < 2, civ: CIVS[i % CIVS.length][0], color: COLORS[i][0], team: 0,
      food: 200, wood: 200, gold: 100, stone: 200, age: 0,
    })),
  };
}

const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };

/** Làm sạch dữ liệu đọc từ tệp dự án (tệp cũ không có, hoặc bị sửa tay). */
export function normalizeScenario(s) {
  const d = defaultScenario();
  if (!s || typeof s !== 'object') return d;
  d.name = typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 60) : d.name;
  d.fog = s.fog === undefined ? true : !!s.fog;
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
  return d;
}

/**
 * Nội dung aoe2_scenario.json. Ô người chơi đánh số 1..8 (0 là Gaia/trung lập) trùng với tag ScenarioSlot của entity.
 * Mod đọc tệp này khi bắt đầu ván: chia chủ sở hữu, phe, màu, tài nguyên, thời đại và sương mù theo ô.
 */
export function scenarioJson(sc, mobs = []) {
  const s = normalizeScenario(sc);
  const count = new Array(MAX_PLAYERS + 1).fill(0);
  for (const m of mobs) { const k = m.slot | 0; if (k >= 0 && k <= MAX_PLAYERS) count[k]++; }
  return {
    format: 'aoe2-scenario', version: 1, name: s.name, fog: s.fog,
    players: s.players.map((p, i) => ({
      slot: i + 1, active: p.active, civ: p.civ, color: p.color, team: p.team, age: p.age,
      resources: { food: p.food, wood: p.wood, gold: p.gold, stone: p.stone }, units: count[i + 1],
    })),
    gaiaUnits: count[0],
  };
}

/** Cảnh báo khi đơn vị gán cho ô không dùng, hoặc tệp bố trí thiếu người chơi. Trả về mảng câu tiếng Việt. */
export function scenarioWarnings(sc, mobs = []) {
  const s = normalizeScenario(sc), out = [];
  const n = s.players.filter((p) => p.active).length;
  if (n < 1) out.push('Chưa bật ô người chơi nào.');
  const orphan = new Set();
  for (const m of mobs) { const k = m.slot | 0; if (k > 0 && !s.players[k - 1]?.active) orphan.add(k); }
  for (const k of [...orphan].sort()) out.push(`Ô ${k} đang tắt nhưng vẫn có đơn vị gán cho nó.`);
  return out;
}
