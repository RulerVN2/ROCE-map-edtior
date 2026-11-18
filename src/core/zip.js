// Đọc tệp zip/jar tối giản (đủ cho file .jar của Minecraft). Chạy ở Node.
import zlib from 'node:zlib';

/** @returns {Array<{name:string, read:()=>Buffer}>} */
export function readZip(buf) {
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  }
  if (e < 0) throw new Error('Không phải tệp zip/jar hợp lệ');
  const count = buf.readUInt16LE(e + 10);
  let pos = buf.readUInt32LE(e + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('Mục lục zip bị hỏng');
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28), extraLen = buf.readUInt16LE(pos + 30), commentLen = buf.readUInt16LE(pos + 32);
    const local = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    out.push({ name, read() {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const raw = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(raw);
      if (method === 8) return zlib.inflateRawSync(raw);
      throw new Error('Kiểu nén zip chưa hỗ trợ: ' + method);
    } });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
