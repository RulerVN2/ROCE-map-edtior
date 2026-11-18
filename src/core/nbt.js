// NBT (Java Edition, big-endian): ghi và đọc.
// Giá trị được bọc dạng { t: <mã tag>, v: <giá trị> } để giữ đúng kiểu.
import zlib from 'node:zlib';

import { TAG } from './nbt-tags.js';
export * from './nbt-tags.js';

class Writer {
  constructor() { this.buf = Buffer.allocUnsafe(1 << 16); this.pos = 0; }
  ensure(n) {
    if (this.pos + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.pos + n) cap *= 2;
    const nb = Buffer.allocUnsafe(cap);
    this.buf.copy(nb, 0, 0, this.pos);
    this.buf = nb;
  }
  u8(v) { this.ensure(1); this.buf[this.pos++] = v & 0xff; }
  i16(v) { this.ensure(2); this.buf.writeInt16BE(v, this.pos); this.pos += 2; }
  i32(v) { this.ensure(4); this.buf.writeInt32BE(v | 0, this.pos); this.pos += 4; }
  i64(v) { this.ensure(8); this.buf.writeBigInt64BE(BigInt.asIntN(64, v), this.pos); this.pos += 8; }
  f32(v) { this.ensure(4); this.buf.writeFloatBE(v, this.pos); this.pos += 4; }
  f64(v) { this.ensure(8); this.buf.writeDoubleBE(v, this.pos); this.pos += 8; }
  str(s) {
    const b = Buffer.from(s, 'utf8'); // id và tên block đều ASCII nên trùng với Modified UTF-8
    if (b.length > 65535) throw new Error('Chuỗi NBT quá dài');
    this.ensure(2 + b.length);
    this.buf.writeUInt16BE(b.length, this.pos); this.pos += 2;
    b.copy(this.buf, this.pos); this.pos += b.length;
  }
  payload(t, v) {
    switch (t) {
      case TAG.BYTE: this.u8(v); break;
      case TAG.SHORT: this.i16(v); break;
      case TAG.INT: this.i32(v); break;
      case TAG.LONG: this.i64(BigInt(v)); break;
      case TAG.FLOAT: this.f32(v); break;
      case TAG.DOUBLE: this.f64(v); break;
      case TAG.STRING: this.str(v); break;
      case TAG.BYTE_ARRAY:
        this.i32(v.length); this.ensure(v.length);
        Buffer.from(v.buffer, v.byteOffset, v.length).copy(this.buf, this.pos); this.pos += v.length; break;
      case TAG.INT_ARRAY:
        this.i32(v.length); this.ensure(v.length * 4);
        for (let i = 0; i < v.length; i++) { this.buf.writeInt32BE(v[i], this.pos); this.pos += 4; }
        break;
      case TAG.LONG_ARRAY: {
        const n = v.length >> 1;
        this.i32(n); this.ensure(n * 8);
        for (let i = 0; i < v.length; i++) { this.buf.writeInt32BE(v[i], this.pos); this.pos += 4; }
        break;
      }
      case TAG.LIST: {
        const { elemType, items } = v;
        this.u8(items.length === 0 ? TAG.END : elemType);
        this.i32(items.length);
        for (const it of items) this.payload(elemType, it);
        break;
      }
      case TAG.COMPOUND:
        for (const key of Object.keys(v)) {
          const tag = v[key];
          if (tag === undefined || tag === null) continue;
          this.u8(tag.t); this.str(key); this.payload(tag.t, tag.v);
        }
        this.u8(TAG.END);
        break;
      default: throw new Error('Tag NBT không hợp lệ: ' + t);
    }
  }
}

/** Ghi một compound gốc (tên rỗng) thành Buffer chưa nén. */
export function encode(rootCompound) {
  const w = new Writer();
  w.u8(TAG.COMPOUND); w.str('');
  w.payload(TAG.COMPOUND, rootCompound.v);
  return Buffer.from(w.buf.subarray(0, w.pos));
}
export const encodeGzip = (root) => zlib.gzipSync(encode(root));
export const encodeZlib = (root) => zlib.deflateSync(encode(root));

/** Đọc NBT chưa nén thành object JS thường (mất thông tin kiểu, dùng cho kiểm tra). */
export function decode(buf) {
  let pos = 0;
  const str = () => { const n = buf.readUInt16BE(pos); pos += 2; const s = buf.toString('utf8', pos, pos + n); pos += n; return s; };
  const payload = (t) => {
    switch (t) {
      case TAG.BYTE: return buf.readInt8(pos++);
      case TAG.SHORT: { const v = buf.readInt16BE(pos); pos += 2; return v; }
      case TAG.INT: { const v = buf.readInt32BE(pos); pos += 4; return v; }
      case TAG.LONG: { const v = buf.readBigInt64BE(pos); pos += 8; return v; }
      case TAG.FLOAT: { const v = buf.readFloatBE(pos); pos += 4; return v; }
      case TAG.DOUBLE: { const v = buf.readDoubleBE(pos); pos += 8; return v; }
      case TAG.STRING: return str();
      case TAG.BYTE_ARRAY: { const n = buf.readInt32BE(pos); pos += 4; const v = Int8Array.from(buf.subarray(pos, pos + n)); pos += n; return v; }
      case TAG.INT_ARRAY: { const n = buf.readInt32BE(pos); pos += 4; const v = new Int32Array(n); for (let i = 0; i < n; i++) { v[i] = buf.readInt32BE(pos); pos += 4; } return v; }
      case TAG.LONG_ARRAY: { const n = buf.readInt32BE(pos); pos += 4; const v = new BigInt64Array(n); for (let i = 0; i < n; i++) { v[i] = buf.readBigInt64BE(pos); pos += 8; } return v; }
      case TAG.LIST: { const et = buf[pos++]; const n = buf.readInt32BE(pos); pos += 4; const a = []; for (let i = 0; i < n; i++) a.push(payload(et)); return a; }
      case TAG.COMPOUND: { const o = {}; for (;;) { const tt = buf[pos++]; if (tt === TAG.END) return o; const k = str(); o[k] = payload(tt); } }
      default: throw new Error('Tag NBT lạ: ' + t + ' tại ' + pos);
    }
  };
  if (buf[pos++] !== TAG.COMPOUND) throw new Error('Gốc NBT phải là compound');
  str();
  const out = payload(TAG.COMPOUND);
  if (pos !== buf.length) throw new Error('Thừa dữ liệu sau NBT');
  return out;
}

/**
 * Đọc NBT chưa nén nhưng GIỮ kiểu: trả về compound gốc dạng đã bọc ({t, v}), ghi lại được bằng encode().
 * Dùng khi cần chép nguyên dữ liệu (ví dụ block entity trong file .schem).
 */
export function decodeTyped(buf) {
  let pos = 0;
  const str = () => { const n = buf.readUInt16BE(pos); pos += 2; const s = buf.toString('utf8', pos, pos + n); pos += n; return s; };
  const payload = (t) => {
    switch (t) {
      case TAG.BYTE: return buf.readInt8(pos++);
      case TAG.SHORT: { const v = buf.readInt16BE(pos); pos += 2; return v; }
      case TAG.INT: { const v = buf.readInt32BE(pos); pos += 4; return v; }
      case TAG.LONG: { const v = buf.readBigInt64BE(pos); pos += 8; return v; }
      case TAG.FLOAT: { const v = buf.readFloatBE(pos); pos += 4; return v; }
      case TAG.DOUBLE: { const v = buf.readDoubleBE(pos); pos += 8; return v; }
      case TAG.STRING: return str();
      case TAG.BYTE_ARRAY: { const n = buf.readInt32BE(pos); pos += 4; const v = Int8Array.from(buf.subarray(pos, pos + n)); pos += n; return v; }
      case TAG.INT_ARRAY: { const n = buf.readInt32BE(pos); pos += 4; const v = new Int32Array(n); for (let i = 0; i < n; i++) { v[i] = buf.readInt32BE(pos); pos += 4; } return v; }
      case TAG.LONG_ARRAY: { const n = buf.readInt32BE(pos); pos += 4; const v = new Int32Array(n * 2); for (let i = 0; i < n * 2; i++) { v[i] = buf.readInt32BE(pos); pos += 4; } return v; }
      case TAG.LIST: { const elemType = buf[pos++]; const n = buf.readInt32BE(pos); pos += 4; const items = []; for (let i = 0; i < n; i++) items.push(payload(elemType)); return { elemType, items }; }
      case TAG.COMPOUND: { const o = {}; for (;;) { const tt = buf[pos++]; if (tt === TAG.END) return o; const k = str(); o[k] = { t: tt, v: payload(tt) }; } }
      default: throw new Error('Tag NBT lạ: ' + t + ' tại ' + pos);
    }
  };
  if (buf[pos++] !== TAG.COMPOUND) throw new Error('Gốc NBT phải là compound');
  str();
  return { t: TAG.COMPOUND, v: payload(TAG.COMPOUND) };
}
