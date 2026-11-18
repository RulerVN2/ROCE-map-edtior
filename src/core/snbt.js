// Đọc NBT dạng chữ (SNBT), kiểu lệnh /data get entity của Minecraft, thành các tag đã bọc {t,v} của nbt.js.
// Ví dụ: {NoAI:1b,Tags:["linh"],ArmorItems:[{},{},{},{id:"minecraft:iron_helmet",Count:1b}]}
import { TAG } from './nbt-tags.js';

const NUM = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[bBsSlLfFdD]?$/;
const BARE = /[0-9A-Za-z_.+\-]/;

class Parser {
  constructor(src) { this.s = src; this.i = 0; }
  fail(msg) {
    const near = this.s.slice(Math.max(0, this.i - 12), this.i + 12).replace(/\s+/g, ' ');
    throw new Error(`${msg} (gần vị trí ${this.i}: "${near}")`);
  }
  ws() { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++; }
  peek() { this.ws(); return this.s[this.i]; }
  eat(ch) { if (this.peek() !== ch) this.fail(`Thiếu "${ch}"`); this.i++; }
  quoted() {
    const q = this.s[this.i++]; let out = '';
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === '\\') {
        const n = this.s[this.i++];
        if (n === undefined) break;
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
      } else if (c === q) return out;
      else out += c;
    }
    return this.fail('Chuỗi chưa đóng ngoặc kép');
  }
  bare() {
    const st = this.i;
    while (this.i < this.s.length && BARE.test(this.s[this.i])) this.i++;
    if (this.i === st) this.fail('Không đọc được giá trị');
    return this.s.slice(st, this.i);
  }
  value() {
    const c = this.peek();
    if (c === '{') return this.compound();
    if (c === '[') return this.listOrArray();
    if (c === '"' || c === "'") return { t: TAG.STRING, v: this.quoted() };
    const w = this.bare();
    if (w === 'true') return { t: TAG.BYTE, v: 1 };
    if (w === 'false') return { t: TAG.BYTE, v: 0 };
    if (NUM.test(w)) return number(w);
    return { t: TAG.STRING, v: w };
  }
  key() {
    const c = this.peek();
    return c === '"' || c === "'" ? this.quoted() : this.bare();
  }
  compound() {
    this.eat('{');
    const out = {};
    if (this.peek() === '}') { this.i++; return { t: TAG.COMPOUND, v: out }; }
    for (;;) {
      const k = this.key(); this.eat(':');
      out[k] = this.value();
      const c = this.peek();
      if (c === ',') { this.i++; if (this.peek() === '}') { this.i++; break; } continue; }
      if (c === '}') { this.i++; break; }
      this.fail('Thiếu "," hoặc "}"');
    }
    return { t: TAG.COMPOUND, v: out };
  }
  listOrArray() {
    this.eat('[');
    this.ws();
    const m = /^([BIL]);/.exec(this.s.slice(this.i, this.i + 2));
    if (m) { this.i += 2; return this.typedArray(m[1]); }
    const tags = [];
    if (this.peek() === ']') { this.i++; return { t: TAG.LIST, v: { elemType: TAG.END, items: [] } }; }
    for (;;) {
      tags.push(this.value());
      const c = this.peek();
      if (c === ',') { this.i++; if (this.peek() === ']') { this.i++; break; } continue; }
      if (c === ']') { this.i++; break; }
      this.fail('Thiếu "," hoặc "]"');
    }
    const elemType = tags[0].t;
    if (tags.some((x) => x.t !== elemType)) this.fail('Trong một danh sách [..] mọi phần tử phải cùng kiểu (ví dụ cùng là 1b hoặc cùng là 1.0d)');
    return { t: TAG.LIST, v: { elemType, items: tags.map((x) => x.v) } };
  }
  typedArray(kind) {
    const vals = [];
    if (this.peek() === ']') this.i++;
    else {
      for (;;) {
        const w = this.bare();
        if (!NUM.test(w)) this.fail('Giá trị trong mảng phải là số');
        vals.push(number(w));
        const c = this.peek();
        if (c === ',') { this.i++; continue; }
        if (c === ']') { this.i++; break; }
        this.fail('Thiếu "," hoặc "]"');
      }
    }
    if (kind === 'B') return { t: TAG.BYTE_ARRAY, v: Int8Array.from(vals.map((x) => Number(x.v))) };
    if (kind === 'I') return { t: TAG.INT_ARRAY, v: Int32Array.from(vals.map((x) => Number(x.v))) };
    const out = new Int32Array(vals.length * 2);
    vals.forEach((x, k) => { const b = BigInt.asIntN(64, BigInt(x.v)); out[2 * k] = Number(b >> 32n); out[2 * k + 1] = Number(b & 0xffffffffn) | 0; });
    return { t: TAG.LONG_ARRAY, v: out };
  }
}

function number(w) {
  const suf = /[bBsSlLfFdD]$/.test(w) ? w.slice(-1).toLowerCase() : '';
  const body = suf ? w.slice(0, -1) : w;
  switch (suf) {
    case 'b': return { t: TAG.BYTE, v: Number(body) << 24 >> 24 };
    case 's': return { t: TAG.SHORT, v: Number(body) << 16 >> 16 };
    case 'l': return { t: TAG.LONG, v: BigInt(body) };
    case 'f': return { t: TAG.FLOAT, v: Number(body) };
    case 'd': return { t: TAG.DOUBLE, v: Number(body) };
    default:
      return /^[+-]?\d+$/.test(body) ? { t: TAG.INT, v: Number(body) | 0 } : { t: TAG.DOUBLE, v: Number(body) };
  }
}

/** Đọc một chuỗi SNBT gốc (phải là { ... }) thành object các tag đã bọc. Chuỗi rỗng cho {}. */
export function parseSnbt(text) {
  const src = String(text ?? '').trim();
  if (!src) return {};
  const p = new Parser(src);
  if (p.peek() !== '{') p.fail('NBT phải bắt đầu bằng "{"');
  const root = p.compound();
  p.ws();
  if (p.i < src.length) p.fail('Còn ký tự thừa phía sau dấu "}"');
  return root.v;
}
