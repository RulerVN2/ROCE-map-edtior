// Đọc file .schem (Sponge Schematic bản 2 và 3). Chạy ở Node (tiến trình chính).
import zlib from 'node:zlib';
import { decodeTyped, encode, TAG } from './nbt.js';

const num = (tag, what) => { if (!tag) throw new Error(`File schem thiếu ${what}`); return Number(tag.v); };

/**
 * @param {Buffer|Uint8Array} file nội dung file .schem (gzip)
 * @returns {{ w, h, l, palette: string[], data: Uint16Array, blockEntities: Array<{x,y,z,id,tags}> }}
 *   data theo thứ tự (y*l + z)*w + x; tags: các tag NBT đã bọc của block entity (không gồm vị trí và id).
 */
export function parseSchem(file) {
  let raw;
  try { raw = zlib.gunzipSync(Buffer.from(file.buffer ?? file, file.byteOffset ?? 0, file.byteLength ?? file.length)); }
  catch { throw new Error('Không giải nén được. Đây có phải file .schem (Sponge) không?'); }
  let root = decodeTyped(raw).v;
  if (root.Schematic) root = root.Schematic.v; // bản 3 bọc thêm một lớp
  const version = root.Version ? Number(root.Version.v) : 0;
  if (root.Blocks && !root.Palette && root.Blocks.t !== TAG.COMPOUND) {
    throw new Error('Đây là file .schematic kiểu cũ (MCEdit), chưa hỗ trợ. Hãy lưu lại bằng WorldEdit bản mới để có file .schem.');
  }
  const w = num(root.Width, 'Width') & 0xffff, h = num(root.Height, 'Height') & 0xffff, l = num(root.Length, 'Length') & 0xffff;
  const blocks = version >= 3 ? root.Blocks?.v : root;
  if (!blocks?.Palette) throw new Error('File schem thiếu bảng khối (Palette)');
  const bytes = (blocks.Data ?? blocks.BlockData)?.v;
  if (!bytes) throw new Error('File schem thiếu dữ liệu khối');

  const entries = Object.entries(blocks.Palette.v);
  const palette = new Array(entries.length);
  for (const [name, tag] of entries) palette[Number(tag.v)] = name;
  for (let i = 0; i < palette.length; i++) if (palette[i] === undefined) palette[i] = 'minecraft:air';
  if (palette.length > 65535) throw new Error('Công trình có quá nhiều loại khối');

  const data = new Uint16Array(w * h * l);
  let pos = 0;
  for (let i = 0; i < data.length; i++) { // varint
    let v = 0, shift = 0, b;
    do {
      if (pos >= bytes.length) throw new Error('Dữ liệu khối trong file schem bị thiếu');
      b = bytes[pos++] & 0xff; v |= (b & 0x7f) << shift; shift += 7;
    } while (b & 0x80);
    if (v >= palette.length) throw new Error('Dữ liệu khối trong file schem không khớp bảng khối');
    data[i] = v;
  }

  const blockEntities = [];
  for (const be of blocks.BlockEntities?.v.items ?? []) {
    const p = be.Pos?.v; const id = be.Id?.v ?? be.id?.v;
    if (!p || !id) continue;
    let tags;
    if (version >= 3) tags = be.Data?.v ?? {};
    else { tags = { ...be }; delete tags.Pos; delete tags.Id; }
    tags = { ...tags }; for (const k of ['x', 'y', 'z', 'id', 'keepPacked']) delete tags[k];
    blockEntities.push({ x: p[0], y: p[1], z: p[2], id, tags });
  }
  return { w, h, l, palette, data, blockEntities };
}

/** Phần gọn gửi cho cửa sổ Editor (không kèm block entity). */
export const schemSummary = (s) => ({ w: s.w, h: s.h, l: s.l, palette: s.palette, data: s.data });

/** Ghi công trình thành file .schem (Sponge bản 2, đọc được bằng WorldEdit). Trả về Buffer đã gzip. */
export function writeSchem(s) {
  const bytes = [];
  for (let i = 0; i < s.data.length; i++) {
    let v = s.data[i];
    while (v >= 0x80) { bytes.push((v & 0x7f) | 0x80); v >>>= 7; }
    bytes.push(v);
  }
  const palette = {};
  s.palette.forEach((name, i) => { palette[name] = { t: TAG.INT, v: i }; });
  const root = { t: TAG.COMPOUND, v: {
    Version: { t: TAG.INT, v: 2 },
    DataVersion: { t: TAG.INT, v: 3465 },
    Width: { t: TAG.SHORT, v: s.w }, Height: { t: TAG.SHORT, v: s.h }, Length: { t: TAG.SHORT, v: s.l },
    Offset: { t: TAG.INT_ARRAY, v: Int32Array.from([0, 0, 0]) },
    PaletteMax: { t: TAG.INT, v: s.palette.length },
    Palette: { t: TAG.COMPOUND, v: palette },
    BlockData: { t: TAG.BYTE_ARRAY, v: Int8Array.from(bytes) },
    BlockEntities: { t: TAG.LIST, v: { elemType: TAG.COMPOUND, items: (s.blockEntities ?? []).map((be) => ({
      ...be.tags,
      Pos: { t: TAG.INT_ARRAY, v: Int32Array.from([be.x, be.y, be.z]) },
      Id: { t: TAG.STRING, v: be.id },
    })) } },
  } };
  return zlib.gzipSync(encode(root));
}
