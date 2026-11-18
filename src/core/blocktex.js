// Tìm texture của từng khối trong file jar của Minecraft (blockstates -> model -> texture). Chạy ở Node; không đóng gói texture của game.
const NS = (s) => (s.startsWith('minecraft:') ? s.slice(10) : s);

/** Chỉ mục các tệp trong jar theo tên: Map<string, {read:()=>Buffer}>. */
export function indexEntries(entries) { return new Map(entries.map((e) => [e.name, e])); }

const readJson = (idx, name) => {
  const e = idx.get(name); if (!e) return null;
  try { return JSON.parse(e.read().toString('utf8')); } catch { return null; }
};

/** Gộp texture của model và các model cha (con ghi đè cha), rồi thay các tham chiếu "#tên". */
function modelTextures(idx, ref, cache) {
  const key = NS(ref);
  if (cache.has(key)) return cache.get(key);
  let out = {}, depth = 0, cur = key;
  const chain = [];
  while (cur && depth++ < 10) {
    const m = readJson(idx, `assets/minecraft/models/${cur}.json`);
    if (!m) break;
    chain.push(m.textures ?? {});
    cur = m.parent ? NS(m.parent) : null;
  }
  for (let i = chain.length - 1; i >= 0; i--) out = { ...out, ...chain[i] };
  for (const k of Object.keys(out)) { // "#all" -> giá trị của "all"
    let v = out[k], n = 0;
    while (typeof v === 'string' && v.startsWith('#') && n++ < 6) v = out[v.slice(1)];
    out[k] = typeof v === 'string' && !v.startsWith('#') ? NS(v) : null;
  }
  cache.set(key, out);
  return out;
}

const firstModel = (state) => {
  if (!state) return null;
  let v = null;
  if (state.variants) { v = Object.values(state.variants)[0]; }
  else if (Array.isArray(state.multipart)) { v = state.multipart[0]?.apply; }
  if (Array.isArray(v)) v = v[0];
  return v?.model ? NS(v.model) : null;
};

const TINT_GRASS = /(^|\/)(grass_block_top|short_grass|grass|tall_grass_top|tall_grass_bottom|fern|large_fern_top|large_fern_bottom|sugar_cane)$/;
const TINT_FOLIAGE = /leaves|vine$/;
const tintOf = (tex) => (!tex ? null : TINT_GRASS.test(tex) ? 'grass' : TINT_FOLIAGE.test(tex) ? 'foliage' : null);

/**
 * Với mỗi tên khối (không kèm thuộc tính) trả về { top, side, tintTop, tintSide }: tên texture (vd "block/stone") hoặc null.
 * @returns {Map<string, object|null>}
 */
export function resolveBlocks(idx, names) {
  const cache = new Map(), out = new Map();
  for (const full of names) {
    const name = NS(full);
    if (name === 'water') { out.set(full, { top: 'block/water_still', side: 'block/water_still', tintTop: 'water', tintSide: 'water' }); continue; }
    if (name === 'lava') { out.set(full, { top: 'block/lava_still', side: 'block/lava_still', tintTop: null, tintSide: null }); continue; }
    const ref = firstModel(readJson(idx, `assets/minecraft/blockstates/${name}.json`)) ?? `block/${name}`;
    const t = modelTextures(idx, ref, cache);
    const vals = Object.values(t).filter(Boolean);
    if (!vals.length) { out.set(full, null); continue; }
    const top = t.top ?? t.up ?? t.end ?? t.all ?? t.texture ?? t.particle ?? vals[0];
    const side = t.side ?? t.north ?? t.all ?? t.texture ?? t.particle ?? top;
    out.set(full, { top, side, tintTop: tintOf(top), tintSide: tintOf(side) });
  }
  return out;
}

/** Nội dung PNG của một texture ("block/stone") hoặc null. */
export function readTexture(idx, tex) {
  const e = idx.get(`assets/minecraft/textures/${tex}.png`);
  if (!e) return null;
  try { return e.read(); } catch { return null; }
}
