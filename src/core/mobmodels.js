// Mô hình hộp ghép của các mob thông dụng, theo đúng cách game dựng (toạ độ mô hình của Minecraft: y hướng xuống, mặt trước ở -z, đơn vị 1/16 khối).
// Texture lấy từ file jar của game; chương trình không chứa texture.
// Một bộ phận: { p: [x,y,z] điểm xoay, rx: góc xoay quanh trục x (độ), b: [ { uv: [u,v], o: [x,y,z], s: [w,h,d], g: độ phồng } ] }.
const H = (arms, legs, left64) => { // người: zombie, skeleton
  const [aw, lw] = [arms, legs];
  const aoff = aw === 2 ? -1 : -3, loff = lw === 2 ? -1 : -2;
  return [
    { p: [0, 0, 0], b: [{ uv: [0, 0], o: [-4, -8, -4], s: [8, 8, 8] }] },
    { p: [0, 0, 0], b: [{ uv: [16, 16], o: [-4, 0, -2], s: [8, 12, 4] }] },
    { p: [-5, 2, 0], rx: 0, b: [{ uv: [40, 16], o: [aoff, -2, aw === 2 ? -1 : -2], s: [aw, 12, aw] }], arm: true },
    { p: [5, 2, 0], rx: 0, b: [{ uv: left64 ? [32, 48] : [40, 16], o: [aw === 2 ? -1 : -1, -2, aw === 2 ? -1 : -2], s: [aw, 12, aw] }], arm: true },
    { p: [lw === 2 ? -2 : -1.9, 12, 0], b: [{ uv: [0, 16], o: [loff, 0, loff], s: [lw, 12, lw] }] },
    { p: [lw === 2 ? 2 : 1.9, 12, 0], b: [{ uv: left64 ? [16, 48] : [0, 16], o: [loff, 0, loff], s: [lw, 12, lw] }] },
  ];
};
const zombieParts = () => H(4, 4, true).map((q) => (q.arm ? { ...q, rx: -90 } : q));
const leg = (px, py, pz, uv = [0, 16], h = 12) => ({ p: [px, py, pz], b: [{ uv, o: [-2, 0, -2], s: [4, h, 4] }] });
const quad = (legH, legY, hz, bz) => [leg(-3, legY, hz, [0, 16], legH), leg(3, legY, hz, [0, 16], legH), leg(-3, legY, bz, [0, 16], legH), leg(3, legY, bz, [0, 16], legH)];

export const MOB_MODELS = {
  zombie: { tex: 'entity/zombie/zombie', parts: zombieParts(), humanoid: true, armRx: -90 },
  skeleton: { tex: 'entity/skeleton/skeleton', parts: H(2, 2, false), humanoid: true, armRx: 0 },
  creeper: {
    tex: 'entity/creeper/creeper',
    parts: [
      { p: [0, 6, 0], b: [{ uv: [0, 0], o: [-4, -8, -4], s: [8, 8, 8] }] },
      { p: [0, 6, 0], b: [{ uv: [16, 16], o: [-4, 0, -2], s: [8, 12, 4] }] },
      leg(-2, 18, 4, [0, 16], 6), leg(2, 18, 4, [0, 16], 6), leg(-2, 18, -4, [0, 16], 6), leg(2, 18, -4, [0, 16], 6),
    ],
  },
  pig: {
    tex: 'entity/pig/pig',
    parts: [
      { p: [0, 12, -6], b: [{ uv: [0, 0], o: [-4, -4, -8], s: [8, 8, 8] }, { uv: [16, 16], o: [-2, 0, -9], s: [4, 3, 1] }] },
      { p: [0, 11, 2], rx: 90, b: [{ uv: [28, 8], o: [-5, -10, -7], s: [10, 16, 8] }] },
      { ...leg(-3, 18, 7, [0, 16], 6) }, { ...leg(3, 18, 7, [0, 16], 6) }, { ...leg(-3, 18, -5, [0, 16], 6) }, { ...leg(3, 18, -5, [0, 16], 6) },
    ],
  },
  cow: {
    tex: 'entity/cow/cow',
    parts: [
      { p: [0, 4, -8], b: [{ uv: [0, 0], o: [-4, -4, -6], s: [8, 8, 6] }, { uv: [22, 0], o: [-5, -5, -4], s: [1, 3, 1] }, { uv: [22, 0], o: [4, -5, -4], s: [1, 3, 1] }] },
      { p: [0, 5, 2], rx: 90, b: [{ uv: [18, 4], o: [-6, -10, -7], s: [12, 18, 10] }] },
      leg(-4, 12, 7), leg(4, 12, 7), leg(-4, 12, -6), leg(4, 12, -6),
    ],
  },
  sheep: {
    tex: 'entity/sheep/sheep', fur: 'entity/sheep/sheep_fur',
    parts: [
      { p: [0, 6, -8], b: [{ uv: [0, 0], o: [-3, -4, -6], s: [6, 6, 8] }] },
      { p: [0, 5, 2], rx: 90, b: [{ uv: [28, 8], o: [-4, -10, -7], s: [8, 16, 6] }] },
      leg(-3, 12, 7), leg(3, 12, 7), leg(-3, 12, -5), leg(3, 12, -5),
    ],
    furParts: [
      { p: [0, 6, -8], b: [{ uv: [0, 0], o: [-3, -4, -4], s: [6, 6, 6], g: 0.6 }] },
      { p: [0, 5, 2], rx: 90, b: [{ uv: [28, 8], o: [-4, -10, -7], s: [8, 16, 6], g: 1.75 }] },
      ...[[-3, 7], [3, 7], [-3, -5], [3, -5]].map(([x, z]) => ({ p: [x, 12, z], b: [{ uv: [0, 16], o: [-2, 0, -2], s: [4, 6, 4], g: 0.5 }] })),
    ],
  },
  chicken: {
    tex: 'entity/chicken',
    parts: [
      { p: [0, 15, -4], b: [{ uv: [0, 0], o: [-2, -6, -2], s: [4, 6, 3] }, { uv: [14, 0], o: [-2, -4, -4], s: [4, 2, 2] }, { uv: [14, 4], o: [-1, -2, -3], s: [2, 2, 2] }] },
      { p: [0, 16, 0], rx: 90, b: [{ uv: [0, 9], o: [-3, -4, -3], s: [6, 8, 6] }] },
      { p: [-2, 19, 1], b: [{ uv: [26, 0], o: [-1, 0, -3], s: [3, 5, 3] }] }, { p: [1, 19, 1], b: [{ uv: [26, 0], o: [-1, 0, -3], s: [3, 5, 3] }] },
      { p: [-4, 13, 0], b: [{ uv: [24, 13], o: [0, 0, -3], s: [1, 4, 6] }] }, { p: [4, 13, 0], b: [{ uv: [24, 13], o: [-1, 0, -3], s: [1, 4, 6] }] },
    ],
  },
};
const VILLAGER = (tex) => ({
  tex,
  parts: [
    { p: [0, 0, 0], b: [{ uv: [0, 0], o: [-4, -10, -4], s: [8, 10, 8] }] },
    { p: [0, -2, 0], b: [{ uv: [24, 0], o: [-1, -1, -6], s: [2, 4, 2] }] },
    { p: [0, 0, 0], b: [{ uv: [16, 20], o: [-4, 0, -3], s: [8, 12, 6] }] },
    { p: [0, 3, -1], rx: -43, b: [{ uv: [44, 22], o: [-8, -2, -2], s: [4, 8, 4] }, { uv: [44, 22], o: [4, -2, -2], s: [4, 8, 4] }, { uv: [40, 38], o: [-4, 2, -2], s: [8, 4, 4] }] },
    { p: [-2, 12, 0], b: [{ uv: [0, 22], o: [-2, 0, -2], s: [4, 12, 4] }] }, { p: [2, 12, 0], b: [{ uv: [0, 22], o: [-2, 0, -2], s: [4, 12, 4] }] },
  ],
});
MOB_MODELS.villager = VILLAGER('entity/villager/villager');
MOB_MODELS.pillager = VILLAGER('entity/illager/pillager');
MOB_MODELS.vindicator = VILLAGER('entity/illager/vindicator');
MOB_MODELS.evoker = VILLAGER('entity/illager/evoker');
const legSpider = (x, z, left, ry, rz) => ({ p: [x, 15, z], ry, rz, b: [{ uv: [18, 0], o: left ? [-1, -1, -1] : [-15, -1, -1], s: [16, 2, 2] }] });
MOB_MODELS.spider = {
  tex: 'entity/spider/spider',
  parts: [
    { p: [0, 15, -3], b: [{ uv: [32, 4], o: [-4, -4, -8], s: [8, 8, 8] }] },
    { p: [0, 15, 0], b: [{ uv: [0, 0], o: [-3, -3, -3], s: [6, 6, 6] }] },
    { p: [0, 15, 9], b: [{ uv: [0, 12], o: [-5, -4, -6], s: [10, 8, 12] }] },
    ...[[2, 45, 45], [1, 22.5, 33], [0, -22.5, 33], [-1, -45, 45]].flatMap(([z, yy, zz]) => [legSpider(-4, z, false, yy, -zz), legSpider(4, z, true, -yy, zz)]),
  ],
};
MOB_MODELS.wolf = {
  tex: 'entity/wolf/wolf',
  parts: [
    { p: [0, 13.5, -7], b: [{ uv: [0, 0], o: [-3, -3, -2], s: [6, 6, 4] }, { uv: [16, 14], o: [-3, -5, 0], s: [2, 2, 1] }, { uv: [16, 14], o: [1, -5, 0], s: [2, 2, 1] }, { uv: [0, 10], o: [-1.5, 0, -5], s: [3, 3, 4] }] },
    { p: [0, 14, 2], rx: 90, b: [{ uv: [18, 14], o: [-3, -2, -3], s: [6, 9, 6] }] },
    { p: [0, 14, -3], rx: 90, b: [{ uv: [21, 13], o: [-4, -3, -3], s: [8, 6, 7] }] },
    ...[[-2.5, 8], [2.5, 8], [-2.5, -4], [2.5, -4]].map(([x, z]) => ({ p: [x, 16, z], b: [{ uv: [0, 18], o: [-1, 0, -1], s: [2, 8, 2] }] })),
    { p: [0, 12, 8], b: [{ uv: [9, 18], o: [-1, 0, -1], s: [2, 8, 2] }] },
  ],
};
MOB_MODELS.iron_golem = {
  tex: 'entity/iron_golem/iron_golem', texW: 128,
  parts: [
    { p: [0, -7, -2], b: [{ uv: [0, 0], o: [-4, -12, -5.5], s: [8, 10, 8] }, { uv: [24, 0], o: [-1, -5, -7.5], s: [2, 4, 2] }] },
    { p: [0, -7, 0], b: [{ uv: [0, 40], o: [-9, -2, -6], s: [18, 12, 11] }, { uv: [0, 70], o: [-4.5, 10, -3], s: [9, 5, 6], g: 0.5 }] },
    { p: [0, -7, 0], b: [{ uv: [60, 21], o: [-13, -2.5, -3], s: [4, 30, 6] }] },
    { p: [0, -7, 0], b: [{ uv: [60, 58], o: [9, -2.5, -3], s: [4, 30, 6] }] },
    { p: [-4, 11, 0], b: [{ uv: [37, 0], o: [-3.5, -3, -3], s: [6, 16, 5] }] },
    { p: [5, 11, 0], b: [{ uv: [60, 0], o: [-3.5, -3, -3], s: [6, 16, 5] }] },
  ],
};
MOB_MODELS.horse = {
  tex: 'entity/horse/horse_brown',
  parts: [
    { p: [0, 11, 9], b: [{ uv: [0, 32], o: [-5, -8, -19], s: [10, 10, 24] }] },
    { p: [0, 3, 14], b: [{ uv: [42, 36], o: [-1.5, 0, 0], s: [3, 14, 4] }] },
    { p: [0, 4, -10], rx: 30, b: [{ uv: [0, 0], o: [-3, -11, -2], s: [6, 5, 7] }, { uv: [0, 25], o: [-2, -11, -7], s: [4, 5, 5] }, { uv: [0, 12], o: [-2, -10, -3], s: [4, 14, 8] }, { uv: [19, 16], o: [0.55, -13, 4], s: [2, 3, 1] }, { uv: [19, 16], o: [-2.55, -13, 4], s: [2, 3, 1] }, { uv: [56, 36], o: [-1, -11, 5], s: [2, 16, 2] }] },
    ...[[-4, 11], [4, 11], [-4, -9], [4, -9]].map(([x, z]) => ({ p: [x, 14, z], b: [{ uv: [48, 21], o: [-2, 0, -2], s: [4, 10, 4] }] })),
  ],
};

MOB_MODELS.enderman = {
  tex: 'entity/enderman/enderman',
  parts: [
    { p: [0, -26, 0], b: [{ uv: [0, 0], o: [-4, 0, -4], s: [8, 8, 8] }] },
    { p: [0, -18, 0], b: [{ uv: [32, 16], o: [-4, 0, -2], s: [8, 12, 4] }] },
    { p: [-5, -17, 0], b: [{ uv: [56, 0], o: [-1, 0, -1], s: [2, 30, 2] }] },
    { p: [5, -17, 0], b: [{ uv: [56, 0], o: [-1, 0, -1], s: [2, 30, 2] }] },
    { p: [-2, -6, 0], b: [{ uv: [56, 0], o: [-1, 0, -1], s: [2, 30, 2] }] },
    { p: [2, -6, 0], b: [{ uv: [56, 0], o: [-1, 0, -1], s: [2, 30, 2] }] },
  ],
};
MOB_MODELS.witch = {
  texH: 128,
  ...VILLAGER('entity/witch'),
};
MOB_MODELS.witch.parts = [...MOB_MODELS.witch.parts, { p: [0, 0, 0], b: [
  { uv: [0, 64], o: [-5, -12, -5], s: [10, 2, 10] }, { uv: [0, 76], o: [-3.5, -16, -3.5], s: [7, 4, 7] }, { uv: [0, 87], o: [-2, -21, -2], s: [4, 5, 4] }] }];
MOB_MODELS.minecart = {
  tex: 'entity/minecart',
  parts: [
    { p: [0, 22, 0], rx: 90, b: [{ uv: [0, 10], o: [-10, -8, -1], s: [20, 16, 2] }] },
    { p: [0, 22, -8], ry: 0, b: [{ uv: [0, 0], o: [-8, -8, -1], s: [16, 8, 2] }] },
    { p: [0, 22, 8], ry: 180, b: [{ uv: [0, 0], o: [-8, -8, -1], s: [16, 8, 2] }] },
    { p: [-9, 22, 0], ry: 90, b: [{ uv: [0, 0], o: [-8, -8, -1], s: [16, 8, 2] }] },
    { p: [9, 22, 0], ry: -90, b: [{ uv: [0, 0], o: [-8, -8, -1], s: [16, 8, 2] }] },
  ],
};
MOB_MODELS.oak_boat = {
  tex: 'entity/boat/oak', texW: 128, texH: 64, yaw0: 90,
  parts: [
    { p: [0, 22.5, 0], rx: 90, b: [{ uv: [0, 0], o: [-14, -9, -3], s: [28, 16, 3] }] },
    { p: [-15, 21, 0], ry: 270, b: [{ uv: [0, 19], o: [-8, -6, -1], s: [18, 6, 2] }] },
    { p: [15, 21, 0], ry: 90, b: [{ uv: [0, 27], o: [-8, -6, -1], s: [16, 6, 2] }] },
    { p: [0, 21, -8], b: [{ uv: [0, 35], o: [-14, -6, -1], s: [28, 6, 2] }] },
    { p: [0, 21, 8], ry: 180, b: [{ uv: [0, 43], o: [-14, -6, -1], s: [28, 6, 2] }] },
  ],
};
// Phù thuỷ không mặc giáp. Illager cầm đồ ở trước ngực.
for (const k of ['pillager', 'vindicator', 'evoker']) MOB_MODELS[k].hand = [-5, 14, -5];

MOB_MODELS.armor_stand = {
  tex: 'entity/armorstand/wood', humanoid: true, armRx: 0,
  parts: [
    { p: [0, 1, 0], b: [{ uv: [0, 0], o: [-1, -7, -1], s: [2, 7, 2] }] },
    { p: [0, 0, 0], b: [{ uv: [0, 26], o: [-6, 0, -1.5], s: [12, 3, 3] }, { uv: [16, 0], o: [-3, 3, -1], s: [2, 7, 2] }, { uv: [48, 16], o: [1, 3, -1], s: [2, 7, 2] }, { uv: [0, 48], o: [-4, 10, -1], s: [8, 2, 2] }] },
    { p: [-5, 2, 0], b: [{ uv: [24, 0], o: [-2, -2, -1], s: [2, 12, 2] }] },
    { p: [5, 2, 0], b: [{ uv: [32, 16], o: [0, -2, -1], s: [2, 12, 2] }] },
    { p: [-1.9, 12, 0], b: [{ uv: [8, 0], o: [-1, 0, -1], s: [2, 11, 2] }] },
    { p: [1.9, 12, 0], b: [{ uv: [40, 16], o: [-1, 0, -1], s: [2, 11, 2] }] },
    { p: [0, 12, 0], b: [{ uv: [0, 32], o: [-6, 11, -6], s: [12, 1, 12] }] },
  ],
};
MOB_MODELS.ravager = {
  tex: 'entity/illager/ravager', texW: 128, texH: 128,
  parts: [
    { p: [0, -7, 5.5], b: [{ uv: [68, 73], o: [-5, -1, -18], s: [10, 10, 18] }] },
    { p: [0, 16, -17], b: [{ uv: [0, 0], o: [-8, -20, -14], s: [16, 20, 16] }, { uv: [0, 0], o: [-2, -6, -18], s: [4, 8, 4] }] },
    { p: [0, 14, -15], b: [{ uv: [0, 36], o: [-8, 0, -16], s: [16, 3, 16] }] },
    { p: [-10, 2, -25], rx: 63, b: [{ uv: [74, 55], o: [0, -14, -2], s: [2, 14, 4] }] },
    { p: [8, 2, -25], rx: 63, b: [{ uv: [74, 55], o: [0, -14, -2], s: [2, 14, 4] }] },
    { p: [0, 1, 2], rx: 90, b: [{ uv: [0, 55], o: [-7, -10, -7], s: [14, 16, 20] }, { uv: [0, 91], o: [-6, 6, -7], s: [12, 13, 18] }] },
    ...[[-8, 18], [8, 18], [-8, -5], [8, -5]].map(([x, z]) => ({ p: [x, -13, z], b: [{ uv: z > 0 ? [96, 0] : [64, 0], o: [-4, 0, -4], s: [8, 37, 8] }] })),
  ],
};
MOB_MODELS.husk = { ...MOB_MODELS.zombie, tex: 'entity/zombie/husk' };

/** Mô hình của một mob theo id ('minecraft:zombie'), hoặc null nếu chưa có (khi đó vẽ ký hiệu). */
export function modelFor(id) {
  const s = String(id);
  if (s.startsWith('aoe2:')) return aoeModel(s.slice(5));
  return MOB_MODELS[s.replace('minecraft:', '')] ?? null;
}
/** Lính và dân của mod dùng mô hình người (như zombie nhưng tay thả xuống) với skin riêng, nằm trong assets/aoe2 của chương trình. */
const AOE_UNIT_SKINS = new Set(["arbalester", "archer", "ashigaru", "axe_raider", "bearded_axeman", "berserk", "camel_rider", "carnyx_player", "cataphract", "cavalier", "cavalry_archer", "champion", "chu_ko_nu", "crossbowman", "elite_berserk", "elite_cataphract", "elite_chu_ko_nu", "elite_fire_lancer", "elite_huskarl", "elite_longbowman", "elite_mangudai", "elite_ninja", "elite_samurai", "elite_skirmisher", "elite_steppe_lancer", "elite_throwing_axeman", "elite_varangian_guard", "elite_watchman", "elite_woad_raider", "fire_lancer", "great_axeman", "halberdier", "hand_cannoneer", "heavy_camel_rider", "heavy_cavalry_archer", "heavy_mounted_crossbowman", "highlander", "hird_bowman", "hirdman", "huo_hu_gunner", "huskarl", "hussar", "knight", "light_cavalry", "long_swordsman", "longbowman", "man_at_arms", "mangudai", "marksman_of_the_hird", "militia", "monk", "mounted_crossbowman", "ninja", "norse_bowman", "oriflamme_bearer", "paladin", "pikeman", "raider", "royal_saiones", "samurai", "scara", "scout_cavalry", "skirmisher", "smoke_bomber", "spearman", "steppe_lancer", "taiko_drummer", "throwing_axeman", "two_handed_swordsman", "varangian_guard", "war_engineer", "watchman", "woad_raider"]);
const AOE_CACHE = new Map();
function aoeModel(name) {
  const tex = name === 'villager' ? 'aoe2/villager' : AOE_UNIT_SKINS.has(name) ? 'aoe2/unit/' + name : null;
  if (!tex) return null;
  if (!AOE_CACHE.has(tex)) AOE_CACHE.set(tex, { tex, parts: H(4, 4, true), humanoid: false, armRx: 0 });
  return AOE_CACHE.get(tex);
}
/** Các đường dẫn texture entity cần tải cho một mô hình. */
export const modelTextures = (m) => [m.tex, m.fur].filter(Boolean);

const rad = (d) => (d * Math.PI) / 180;
/** Phép xoay quanh trục x trong toạ độ mô hình (y hướng xuống): (y, z) -> (y cos - z sin, y sin + z cos). */
const rotX = (v, c, s) => [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];

/** Xoay bộ phận như game: trước quanh x, rồi quanh y, rồi quanh z (độ; part.rx, part.ry, part.rz). */
function partRot(part) {
  const ax = rad(part.rx ?? 0), ay = rad(part.ry ?? 0), az = rad(part.rz ?? 0);
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
  return (v) => {
    let [x, y, z] = [v[0], v[1] * cx - v[2] * sx, v[1] * sx + v[2] * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    return [x, y, z];
  };
}

/**
 * Dựng sẵn các mặt (chỉ các mặt có thể nhìn thấy từ trên: trước, sau, hai bên, trên) của một mô hình, trong toạ độ mô hình đã xoay bộ phận.
 * Mỗi mặt: { o: gốc, U, V: hai cạnh (u chạy theo U, v chạy theo V), n: pháp tuyến ngoài, r: [u, v, rộng, cao] trong ảnh, fur }.
 */
export function buildFaces(model, armor = [], held = null) {
  const out = [];
  const add = (parts, fur, tex) => {
    const bw = tex ? 64 : model.texW ?? 64;
    for (const part of parts) {
      const P = part.p, rot = partRot(part);
      const place = (v) => { const q = rot(v); return [P[0] + q[0], P[1] + q[1], P[2] + q[2]]; };
      for (const b of part.b) {
        const g = b.g ?? 0, [u, v] = b.uv, [w, h, d] = b.s;
        const x = b.o[0] - g, y = b.o[1] - g, z = b.o[2] - g, W = w + 2 * g, Hh = h + 2 * g, D = d + 2 * g;
        const f = (o, U, V, n, r) => out.push({ o: place(o), U: rot(U), V: rot(V), n: rot(n), r, fur, tex, bw });
        f([x, y, z], [W, 0, 0], [0, Hh, 0], [0, 0, -1], [u + d, v + d, w, h]);                 // trước (z nhỏ)
        f([x + W, y, z + D], [-W, 0, 0], [0, Hh, 0], [0, 0, 1], [u + 2 * d + w, v + d, w, h]); // sau
        f([x, y, z + D], [0, 0, -D], [0, Hh, 0], [-1, 0, 0], [u, v + d, d, h]);                // bên phải của mob (x nhỏ)
        f([x + W, y, z], [0, 0, D], [0, Hh, 0], [1, 0, 0], [u + d + w, v + d, d, h]);          // bên trái (x lớn)
        f([x, y, z + D], [W, 0, 0], [0, 0, -D], [0, -1, 0], [u + d, v, w, d]);                 // mặt trên (y nhỏ)
      }
    }
  };
  add(model.parts, false);
  if (model.furParts) add(model.furParts, true);
  for (const a of armor) add(a.parts, false, a.tex);
  if (held && (model.humanoid || model.hand)) out.push(...heldFaces(model, held));
  return out;
}

const ARMOR_SLOTS = { helmet: 'head', chestplate: 'chest', leggings: 'legs', boots: 'feet' };
export const ARMOR_MATERIALS = ['chainmail', 'iron', 'gold', 'diamond', 'netherite'];
/** Lấy giáp đang mặc từ NBT của mob: { head, chest, legs, feet } = tên vật liệu (iron, diamond...). */
export function armorOf(snbt) {
  const out = {};
  for (const m of String(snbt ?? '').matchAll(/minecraft:([a-z]+)_(helmet|chestplate|leggings|boots)/g)) {
    if (ARMOR_MATERIALS.includes(m[1])) out[ARMOR_SLOTS[m[2]]] = m[1];
  }
  return Object.keys(out).length ? out : null;
}
/**
 * Các lớp giáp (hộp phồng hơn người) của mob dạng người: [{ tex, parts }]. Texture giáp bố cục như người chuẩn 64 x 32.
 * Lớp 1: mũ, áo giáp (thân + tay), giày; lớp 2: quần.
 */
export function armorLayers(model, armor) {
  if (!model.humanoid || !armor) return [];
  const rx = model.armRx ?? 0;
  const box = (uv, o, s, g) => [{ uv, o, s, g }];
  const part = {
    head: (g) => ({ p: [0, 0, 0], b: box([0, 0], [-4, -8, -4], [8, 8, 8], g) }),
    body: (g) => ({ p: [0, 0, 0], b: box([16, 16], [-4, 0, -2], [8, 12, 4], g) }),
    rarm: (g) => ({ p: [-5, 2, 0], rx, b: box([40, 16], [-3, -2, -2], [4, 12, 4], g) }),
    larm: (g) => ({ p: [5, 2, 0], rx, b: box([40, 16], [-1, -2, -2], [4, 12, 4], g) }),
    rleg: (g) => ({ p: [-1.9, 12, 0], b: box([0, 16], [-2, 0, -2], [4, 12, 4], g) }),
    lleg: (g) => ({ p: [1.9, 12, 0], b: box([0, 16], [-2, 0, -2], [4, 12, 4], g) }),
  };
  const out = [];
  const tex = (mat, n) => `models/armor/${mat}_layer_${n}`;
  if (armor.head) out.push({ tex: tex(armor.head, 1), parts: [part.head(1)] });
  if (armor.chest) out.push({ tex: tex(armor.chest, 1), parts: [part.body(1), part.rarm(1), part.larm(1)] });
  if (armor.feet) out.push({ tex: tex(armor.feet, 1), parts: [part.rleg(1), part.lleg(1)] });
  if (armor.legs) out.push({ tex: tex(armor.legs, 2), parts: [part.body(0.5), part.rleg(0.5), part.lleg(0.5)] });
  return out;
}

/** Tên đồ cầm tay chính (tay phải) từ NBT, ví dụ "iron_sword", hoặc null. */
export function heldOf(snbt) {
  const m = /HandItems:\[\{id:"minecraft:([a-z_]+)"/.exec(String(snbt ?? ''));
  return m ? m[1] : null;
}
/** Đồ cầm tay vẽ như một tấm phẳng (texture item 16 x 16) tại bàn tay phải, hai mặt (một mặt lật gương) để nhìn từ hướng nào cũng thấy. */
function heldFaces(model, item) {
  const rx = model.armRx ?? 0, a = rad(rx), c = Math.cos(a), s = Math.sin(a);
  const hp = rotX([0, 12, 0], c, s);
  const [cx, cy, cz] = model.hand ?? [-5, 2 + hp[1], hp[2]], S = 12;
  const tex = `item/${item === 'crossbow' ? 'crossbow_standby' : item}`, r = [0, 0, 16, 16];
  const top = cy - S * 0.65, back = cz + S * 0.35;
  return [
    { o: [cx + 0.6, top, back], U: [0, 0, -S], V: [0, S, 0], n: [1, 0, 0], r, tex, bw: 16 },
    { o: [cx - 0.6, top, back], U: [0, 0, -S], V: [0, S, 0], n: [-1, 0, 0], r, tex, bw: 16 },
  ];
}

/** Giáp ngựa (lớp phủ cùng mô hình, phồng nhẹ) từ NBT `ArmorItem`; chất liệu: iron, golden, diamond, leather. */
export function horseArmorLayer(model, snbt) {
  const m = /ArmorItem:\{id:"minecraft:([a-z]+)_horse_armor"/.exec(String(snbt ?? ''));
  if (!m || model !== MOB_MODELS.horse) return null;
  return { tex: `entity/horse/armor/horse_armor_${m[1]}`, parts: model.parts.map((p) => ({ ...p, b: p.b.map((b) => ({ ...b, g: (b.g ?? 0) + 0.5 })) })) };
}
