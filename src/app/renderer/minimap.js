// Bản đồ nhỏ: nhìn thẳng từ trên xuống toàn bộ map, có khung vùng đang xem, công trình, mob và điểm xuất hiện.
import { heightAt, materialAt, grassColorAt, MATERIALS, MAT, WATER_COLOR, NO_WATER } from '../../core/terrain.js';
import { mobStyle } from '../../core/mobs.js';

export class MiniMap {
  constructor(canvas, view, onJump) {
    this.canvas = canvas; this.view = view; this.ctx = canvas.getContext('2d');
    this.N = canvas.width;
    this.base = this.ctx.createImageData(this.N, this.N);
    this.lastBase = 0; this.stale = true;
    const jump = (e) => {
      const r = canvas.getBoundingClientRect(), n = view.terrain.size;
      onJump(((e.clientX - r.left) / r.width) * n, ((e.clientY - r.top) / r.height) * n);
    };
    let down = false;
    canvas.addEventListener('pointerdown', (e) => { down = true; canvas.setPointerCapture(e.pointerId); jump(e); e.stopPropagation(); });
    canvas.addEventListener('pointermove', (e) => { if (down) jump(e); });
    canvas.addEventListener('pointerup', () => { down = false; });
    canvas.addEventListener('pointercancel', () => { down = false; });
  }
  /** Báo địa hình hoặc công trình đã đổi; nền sẽ được vẽ lại (tối đa vài lần mỗi giây). */
  invalidate() { this.stale = true; }
  drawBase() {
    const v = this.view, t = v.terrain, n = t.size, N = this.N, px = new Uint32Array(this.base.data.buffer);
    const k = n / N, sTop = v.structTop, items = v.items, sIdx = v.structIdx;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = Math.min(n - 1, (i * k) | 0), z = Math.min(n - 1, (j * k) | 0), c = z * n + x;
        const h = heightAt(t, x, z), wl = t.water[c];
        let r, g, b;
        if (sTop[c] > h) {
          const it = items[sIdx[c] - 1], col = it.map.colors[(z - it.z) * it.map.w + (x - it.x)];
          r = (col >> 16) & 255; g = (col >> 8) & 255; b = col & 255;
        } else if (wl !== NO_WATER && wl > h) {
          const d = Math.min(1, (wl - h) / 8);
          r = WATER_COLOR[0] * (1 - 0.35 * d); g = WATER_COLOR[1] * (1 - 0.35 * d); b = WATER_COLOR[2] * (1 - 0.2 * d);
        } else {
          const m = materialAt(t, x, z), col = m === MAT.GRASS ? grassColorAt(t, x, z) : MATERIALS[m].color;
          const x2 = Math.min(n - 1, x + Math.max(1, k | 0)), z2 = Math.min(n - 1, z + Math.max(1, k | 0));
          const sh = 1 + 0.35 * Math.tanh(0.5 * ((heightAt(t, x2, z) - h) * 0.9 - (heightAt(t, x, z2) - h) * 0.35)) + Math.max(-0.2, Math.min(0.25, 0.004 * (h - 64)));
          r = col[0] * sh; g = col[1] * sh; b = col[2] * sh;
        }
        px[j * N + i] = (255 << 24) | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r);
      }
    }
    this.stale = false; this.lastBase = performance.now();
  }
  render() {
    const v = this.view, t = v.terrain; if (!t) return;
    if (this.stale && performance.now() - this.lastBase > 250) this.drawBase();
    const c = this.ctx, N = this.N, f = N / t.size;
    c.putImageData(this.base, 0, 0);
    for (const m of v.mobs) {
      c.fillStyle = mobStyle(m).color; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 1;
      c.beginPath(); c.arc(m.x * f, m.z * f, 2.2, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    if (v.border) { c.strokeStyle = '#ffd24a'; c.lineWidth = 1.5; c.strokeRect(v.border.x0 * f, v.border.z0 * f, (v.border.x1 - v.border.x0) * f, (v.border.z1 - v.border.z0) * f); }
    if (v.spawn) { c.fillStyle = '#e5484d'; c.strokeStyle = '#fff'; c.lineWidth = 1; c.fillRect(v.spawn.x * f - 2.5, v.spawn.z * f - 2.5, 5, 5); c.strokeRect(v.spawn.x * f - 2.5, v.spawn.z * f - 2.5, 5, 5); }
    // Vùng đang xem: bốn góc màn hình chiếu xuống map (thành hình thoi vì khung nhìn nghiêng).
    const pts = [[0, 0], [v.W, 0], [v.W, v.H], [0, v.H]].map(([sx, sy]) => v.screenToMapFlat(sx, sy));
    c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x * f, p.z * f) : c.moveTo(p.x * f, p.z * f))); c.closePath();
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fill();
    c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = '#ffd640'; c.lineWidth = 1.5; c.stroke();
  }
}
