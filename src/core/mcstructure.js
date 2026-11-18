// Chuyển file structure (.nbt) của chính Minecraft (ví dụ nhà dân làng trong file jar) sang dạng schem của chương trình.
import zlib from 'node:zlib';
import { decodeTyped } from './nbt.js';
import { readZip } from './zip.js';

const stateString = (st) => {
  const name = st.Name.v;
  const props = st.Properties ? Object.entries(st.Properties.v).map(([k, v]) => `${k}=${v.v}`).sort() : [];
  return props.length ? `${name}[${props.join(',')}]` : name;
};

/** @param {Buffer} file nội dung file .nbt (gzip) @returns schem { w, h, l, palette, data, blockEntities } */
export function structureToSchem(file) {
  const root = decodeTyped(file[0] === 0x1f && file[1] === 0x8b ? zlib.gunzipSync(file) : file).v;
  const [w, h, l] = root.size.v.items;
  const palSrc = root.palette ? root.palette.v.items : root.palettes.v.items[0].items;
  // Ô không được nhắc tới trong file nghĩa là "để nguyên" -> structure_void (chương trình bỏ qua khi dán).
  const palette = ['minecraft:structure_void'];
  const index = new Map([[palette[0], 0]]);
  const idOf = (str) => { let i = index.get(str); if (i === undefined) { i = palette.length; palette.push(str); index.set(str, i); } return i; };
  const data = new Uint16Array(w * h * l);
  const blockEntities = [];
  for (const b of root.blocks.v.items) {
    const [x, y, z] = b.pos.v.items;
    let str = stateString(palSrc[b.state.v]);
    let nbt = b.nbt?.v;
    if (str.startsWith('minecraft:jigsaw')) { // khối ghép nối của game: thay bằng khối cuối cùng nó sẽ biến thành
      str = nbt?.final_state?.v ?? 'minecraft:air';
      nbt = undefined;
    }
    data[(y * l + z) * w + x] = idOf(str);
    if (nbt?.id) {
      const tags = { ...nbt }; delete tags.id;
      blockEntities.push({ x, y, z, id: nbt.id.v, tags });
    }
  }
  return { w, h, l, palette, data, blockEntities };
}

const VILLAGE = /^data\/minecraft\/structures?\/village\/([a-z]+)\/(?:(houses|town_centers)\/)?([a-z0-9_]+)\.nbt$/;

/**
 * Tìm các công trình làng trên mặt đất trong file jar của Minecraft: nhà, trung tâm làng, đồ trang trí (đèn...).
 * Bỏ qua đường làng, bản làng zombie, dân làng và vật nuôi.
 * @returns {Array<{ biome: string, name: string, schem: object }>}
 */
export function villageStructuresFromJar(jar) {
  const out = [];
  for (const e of readZip(jar)) {
    const m = VILLAGE.exec(e.name);
    if (!m || m[1] === 'common' || m[1] === 'decays') continue;
    try { out.push({ biome: m[1], name: m[3], schem: structureToSchem(e.read()) }); } catch { /* bỏ qua file lạ */ }
  }
  return out;
}
