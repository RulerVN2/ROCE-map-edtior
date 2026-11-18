// Texture khối của Minecraft, đọc từ file jar của game qua tiến trình chính. Không có jar thì chương trình vẫn vẽ bằng màu như cũ.
const TINTS = { grass: [121, 186, 78], foliage: [96, 168, 58], water: [63, 118, 228] };
const rgba = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

export class Textures {
  constructor() {
    this.available = false;   // đã đọc được jar
    this.version = 0;         // tăng mỗi khi có texture mới, để nơi vẽ biết mà làm mới bộ nhớ đệm
    this.blocks = new Map();  // tên khối -> { top, side } (mỗi mặt là bản texture hoặc null) | null (không có texture)
    this.tex = new Map();     // "texture|màu phủ" -> { px: Uint32Array(256), avg: [r,g,b], alpha: boolean }
    this.asked = new Set();
    this.entity = new Map();  // đường dẫn texture mob -> { w, h, px } | null
    this.entityAsked = new Set();
    this.jar = null; this.error = null;
  }
  /** Khối này đã có texture chưa: record, null (không có) hoặc undefined (chưa hỏi). */
  block(name) { return this.blocks.get(name); }
  /** Xin texture cho các khối chưa hỏi; trả về true nếu có thay đổi. */
  async ensure(names) {
    const todo = [...new Set(names)].filter((n) => n && !this.asked.has(n));
    if (!todo.length) return false;
    todo.forEach((n) => this.asked.add(n));
    const r = await window.mapBuilder.getTextures(todo);
    if (r.none) { this.available = false; todo.forEach((n) => this.asked.delete(n)); return false; }
    if (r.error) { this.error = r.error; return false; }
    this.available = true; this.jar = r.jar;
    for (const [name, ref] of Object.entries(r.refs)) {
      if (!ref) { this.blocks.set(name, null); continue; }
      const top = await this.decode(r.png[ref.top], ref.top, ref.tintTop), side = ref.side === ref.top && ref.tintSide === ref.tintTop ? top : await this.decode(r.png[ref.side], ref.side, ref.tintSide);
      this.blocks.set(name, top || side ? { top: top ?? side, side: side ?? top } : null);
    }
    this.version++;
    return true;
  }
  /** Xin texture ảnh đầy đủ (skin) của mob; true nếu có gì mới. */
  async ensureEntity(paths) {
    const todo = paths.filter((p) => !this.entityAsked.has(p));
    if (!todo.length) return false;
    todo.forEach((p) => this.entityAsked.add(p));
    // Đường dẫn "x@rrggbb": ảnh x nhuộm màu đó, rồi chồng ảnh x_overlay giữ nguyên (giáp da và khiên của mod).
    const tinted = (p) => /^(.+)@([0-9a-f]{6})$/.exec(p);
    const want = new Set();
    for (const p of todo) { const m = tinted(p); if (m) { want.add(m[1]); want.add(m[1] + '_overlay'); } else want.add(p); }
    const r = await window.mapBuilder.getEntityTextures([...want]);
    if (r.none || r.error) { todo.forEach((p) => this.entityAsked.delete(p)); return false; }
    const raw = async (bytes) => {
      if (!bytes) return null;
      try {
        const bm = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const cv = new OffscreenCanvas(bm.width, bm.height), g = cv.getContext('2d', { willReadFrequently: true });
        g.drawImage(bm, 0, 0);
        return { w: bm.width, h: bm.height, d: g.getImageData(0, 0, bm.width, bm.height).data };
      } catch { return null; }
    };
    for (const p of todo) {
      let rec = null;
      const m = tinted(p);
      try {
        if (m) {
          const base = await raw(r.png[m[1]]), ov = await raw(r.png[m[1] + '_overlay']);
          const ref = base ?? ov;
          if (ref) {
            const tr = parseInt(m[2].slice(0, 2), 16) / 255, tg = parseInt(m[2].slice(2, 4), 16) / 255, tb = parseInt(m[2].slice(4, 6), 16) / 255;
            const px = new Uint32Array(ref.w * ref.h);
            for (let i = 0; i < px.length; i++) {
              if (base && base.d[i * 4 + 3] >= 128) px[i] = rgba(base.d[i * 4] * tr, base.d[i * 4 + 1] * tg, base.d[i * 4 + 2] * tb);
              if (ov && ov.w === ref.w && ov.d[i * 4 + 3] >= 128) px[i] = rgba(ov.d[i * 4], ov.d[i * 4 + 1], ov.d[i * 4 + 2]);
            }
            rec = { w: ref.w, h: ref.h, px };
          }
        } else {
          const im = await raw(r.png[p]);
          if (im) {
            const px = new Uint32Array(im.w * im.h);
            for (let i = 0; i < px.length; i++) px[i] = im.d[i * 4 + 3] < 128 ? 0 : rgba(im.d[i * 4], im.d[i * 4 + 1], im.d[i * 4 + 2]);
            rec = { w: im.w, h: im.h, px };
          }
        }
      } catch { rec = null; }
      this.entity.set(p, rec);
    }
    this.version++;
    return true;
  }
  /** Quên hết (khi đổi file jar) rồi hỏi lại. */
  reset() { this.entity.clear(); this.entityAsked.clear(); this.blocks.clear(); this.tex.clear(); this.asked.clear(); this.version++; }
  async decode(bytes, name, tint) {
    if (!bytes) return null;
    const key = name + '|' + (tint ?? '');
    if (this.tex.has(key)) return this.tex.get(key);
    let rec = null;
    try {
      const bm = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const size = Math.min(bm.width, bm.height), cv = new OffscreenCanvas(size, size), g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(bm, 0, 0); // ảnh dài (nước, dung nham động) chỉ lấy khung đầu
      const d = g.getImageData(0, 0, size, size).data, px = new Uint32Array(256), t = tint ? TINTS[tint] : null;
      let sr = 0, sg = 0, sb = 0, n = 0, alpha = false;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const o = (Math.floor((y + 0.5) * size / 16) * size + Math.floor((x + 0.5) * size / 16)) * 4;
        let r = d[o], gg = d[o + 1], b = d[o + 2]; const a = d[o + 3];
        if (t) { r = r * t[0] / 255; gg = gg * t[1] / 255; b = b * t[2] / 255; }
        if (a < 128) { px[y * 16 + x] = 0; alpha = true; continue; }
        px[y * 16 + x] = rgba(r | 0, gg | 0, b | 0); sr += r; sg += gg; sb += b; n++;
      }
      rec = n ? { px, avg: [sr / n, sg / n, sb / n], alpha } : null;
    } catch { rec = null; }
    this.tex.set(key, rec);
    return rec;
  }
}
