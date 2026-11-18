// Tệp vùng Anvil (.mca): 32 x 32 chunk mỗi tệp.
import fs from 'node:fs';
import zlib from 'node:zlib';

const SECTOR = 4096;

/** Gom các chunk đã nén zlib của một vùng rồi ghi ra tệp. */
export class RegionWriter {
  constructor() { this.chunks = new Map(); }
  /** localX, localZ: 0..31; data: Buffer đã nén zlib. */
  set(localX, localZ, data) { this.chunks.set(localX + localZ * 32, data); }
  get size() { return this.chunks.size; }
  toBuffer(timestamp = Math.floor(Date.now() / 1000)) {
    const header = Buffer.alloc(SECTOR * 2);
    const parts = [header];
    let sector = 2;
    for (const [idx, data] of [...this.chunks].sort((a, b) => a[0] - b[0])) {
      const len = data.length + 1; // +1 byte kiểu nén
      const sectors = Math.ceil((len + 4) / SECTOR);
      if (sectors > 255) throw new Error('Chunk quá lớn cho định dạng vùng');
      const block = Buffer.alloc(sectors * SECTOR);
      block.writeUInt32BE(len, 0);
      block[4] = 2; // zlib
      data.copy(block, 5);
      parts.push(block);
      header.writeUInt32BE(((sector << 8) | sectors) >>> 0, idx * 4);
      header.writeUInt32BE(timestamp, SECTOR + idx * 4);
      sector += sectors;
    }
    return Buffer.concat(parts);
  }
  write(file) { fs.writeFileSync(file, this.toBuffer()); }
}

/** Đọc lại tệp vùng: trả về Map(index -> Buffer NBT chưa nén). Dùng cho kiểm tra. */
export function readRegion(file) {
  const buf = fs.readFileSync(file);
  if (buf.length % SECTOR !== 0) throw new Error('Kích thước tệp vùng không chia hết cho 4096');
  const out = new Map();
  for (let i = 0; i < 1024; i++) {
    const loc = buf.readUInt32BE(i * 4);
    if (loc === 0) continue;
    const off = (loc >>> 8) * SECTOR, sectors = loc & 0xff;
    const len = buf.readUInt32BE(off);
    if (len + 4 > sectors * SECTOR) throw new Error('Chunk vượt quá số sector khai báo');
    if (buf[off + 4] !== 2) throw new Error('Kiểu nén không phải zlib');
    out.set(i, zlib.inflateSync(buf.subarray(off + 5, off + 4 + len)));
  }
  return out;
}
