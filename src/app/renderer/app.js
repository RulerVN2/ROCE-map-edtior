import { IsoView } from './view.js';
import {
  createTerrain, DECO, applyBrush, paintStrip, heightAt, waterAt, NO_WATER, TOOLS, BIOMES, MATERIALS, ROADS, LAYERS,
  packTerrain, unpackTerrain, makePlacement, BLOCK_PALETTE, PATTERNS, PAD_STYLES, prepareSite, digRamp, placementBox, spawnCell, borderBox, setBorder, NO_CAVE,
} from '../../core/terrain.js';
import { buildTopMap, dimsAfter } from '../../core/structure.js';
import { findWallSet, assembleWall, snapToAxis } from '../../core/wallset.js';
import { renderThumb } from './thumb.js';
import { Textures } from './textures.js';
import { MiniMap } from './minimap.js';
import { PROP_GROUPS, PROP_CATALOG, PROP_BY_KEY, PROP_MIXES, PROP_SIZES, makeProp, pickFromMix } from '../../core/props.js';
import { initScriptUi } from './script-ui.js';
import { AGES, CIVS, COLORS, MAX_PLAYERS, normalizeScenario, scenarioWarnings } from '../../core/scenario.js';
import { MOB_CATALOG, MOB_GROUPS, checkMobSpec, formationPoints, makeMob, mobColor, mobStyle, mobGroups } from '../../core/mobs.js';

const $ = (id) => document.getElementById(id);
const api = window.mapBuilder ?? null; // chỉ có khi chạy trong chương trình .exe

const canvas = $('view');
const view = new IsoView(canvas);
import { View3D } from './view3d.js';
let v3 = null;
function toggle3D(on) {
  if (on === undefined) on = !(v3 && v3.active);
  if (!on) { v3?.close(); $('btn-edit3d').hidden = true; $('btn-edit3d').classList.remove('active'); $('hint3d').hidden = true; $('hint').style.visibility = ''; $('btn-3d').classList.remove('active'); state.dirty = true; return; }
  if (!terrain) return;
  try { v3 ??= new View3D($('view3d'), view); } catch (err) { message(err.message); return; }
  v3.pen = { down: (p, e) => penDown(p, e), move: (p, e) => penMove(p, e), up: () => { endStroke(); touch3D(); }, leave: () => { if (!state.painting) { state.mouse = { x: -1, y: -1 }; state.dirty = true; } } };
  view.needEntity?.([]); v3.open(); $('btn-edit3d').hidden = false; $('hint3d').hidden = false; $('hint').style.visibility = 'hidden'; $('btn-3d').classList.add('active');
}
$('btn-3d').addEventListener('click', () => toggle3D());
const touch3D = () => { if (v3?.active) v3.invalidate(); };
const editing3D = () => !!(v3?.active && v3.edit);
const cellAt = (x, y) => (editing3D() ? v3.pick(x, y) : view.cellAt(x, y));
function setEdit3D(on) {
  if (!v3?.active) { message('Hãy bật Xem 3D (V) trước'); return; }
  v3.edit = on; $('btn-edit3d').classList.toggle('active', on); state.mouse = { x: -1, y: -1 }; state.dirty = true;
  message(on ? 'Sửa trong 3D: chuột trái dùng công cụ đang chọn, chuột phải kéo để xoay, chuột giữa để dời' : 'Xem 3D: chuột trái xoay');
}
$('btn-edit3d').addEventListener('click', () => setEdit3D(!(v3?.edit)));
const textures = new Textures();
view.tx = textures; view.useTex = true; view.needTex = (names) => needTextures(names);
view.needEntity = (paths) => textures.ensureEntity(paths).then((ch) => { if (ch) state.dirty = true; });
let terrain = createTerrain({ size: 1024 });
view.setTerrain(terrain);

// Công trình đã nạp: tên file -> { raw, w, h, l, palette, data, maps: Map }
const library = new Map();

const state = {
  tool: 'raise', radius: 12, strength: 0.4,
  painting: false, panning: false, shift: false,
  mouse: { x: -1, y: -1 }, last: { x: 0, y: 0 },
  target: 64, strokeChanged: false, cliffHeight: 8, material: 0, biome: 0, caveDepth: 20, caveHeight: 7,
  road: 0, roadS: 0, roadGrade: false, roadLast: null, roadMode: 'brush', lineStart: null, stairStart: null, stLine: null, wall: null,
  schem: null, rot: 0, flip: false,
  mobSel: null, mobYaw: 0, mobMine: -1,
  pattern: 0, propSel: null, propMode: 'place', propMix: '', propSize: 'rand', propVariant: 0, propSpace: 4, ditch: '',
  undo: [], redo: [],
  keys: new Map(),
  dirty: true, lastTime: performance.now(),
};
const MAX_UNDO = 15;
let mini = null; // bản đồ nhỏ, tạo sau khi giao diện sẵn sàng

// ---- Thanh công cụ ----
for (const [id, t] of Object.entries(TOOLS)) {
  if (t.panel) continue; // Structure và Road chọn ở bảng bên phải
  if (t.group) { const h = document.createElement('h4'); h.textContent = t.group; $('tools').appendChild(h); }
  const b = document.createElement('button');
  b.textContent = t.name; b.dataset.tool = id; b.title = t.hint;
  b.addEventListener('click', () => setTool(id));
  $('tools').appendChild(b);
}
function setTool(id) {
  state.tool = id;
  for (const b of $('tools').children) b.classList.toggle('active', b.dataset.tool === id);
  $('hint').innerHTML = `<b>${TOOLS[id].name}:</b> ${TOOLS[id].hint}`;
  $('tool-name').textContent = TOOLS[id].name;
  for (const el of document.querySelectorAll('.opt')) el.hidden = !el.dataset.for.split(' ').includes(id);
  $('strength-row').hidden = id === 'elev'; if (id === 'elev') { $('elev-y-row').hidden = state.elevMode !== 'abs'; $('elev-n').parentElement.hidden = state.elevMode === 'abs'; }
  for (const b of $('road-list').children) b.classList.toggle('active', id === 'road' && Number(b.dataset.road) === state.road);
  for (const b of $('schem-list').children) b.classList.toggle('active', id === 'structure' && b.dataset.name === state.schem);
  if (id !== 'structure') view.ghost = null;
  if (id !== 'mob') view.mobGhost = null;
  if (id !== 'prop') view.propGhost = null;
  $('mat-palette').hidden = id !== 'paint';
  $('pat-palette').hidden = id !== 'pattern';
  $('deco-palette').hidden = id !== 'deco';
  if (id.startsWith('cave') && !view.showCaves) setCaveView(true);
  state.lineStart = null; state.stairStart = null; state.stLine = null;
  if (id === 'mob') showTab('mob');
  if (id === 'zone') showTab('script');
  if (id === 'prop') showTab('prop');
  state.dirty = true;
}

function bindSlider(id, apply) {
  const el = $(id), out = $(id + '-out');
  const f = () => { out.textContent = el.value; apply(Number(el.value)); state.dirty = true; mini?.invalidate(); };
  el.addEventListener('input', f); f();
}
bindSlider('brush-size', (v) => { state.radius = v; });
bindSlider('brush-strength', (v) => { state.strength = v / 100; });
bindSlider('deco-density', (v) => { state.decoDensity = v / 100; });
bindSlider('cliff-height', (v) => { state.cliffHeight = v; });
for (const n of [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40]) $('elev-n').add(new Option(`${n} khối`, String(n)));
$('elev-n').value = '4'; state.elevN = 4; state.elevMode = 'rel';
$('elev-n').addEventListener('change', (e) => { state.elevN = Number(e.target.value); });
$('elev-mode').addEventListener('change', (e) => { state.elevMode = e.target.value; $('elev-y-row').hidden = e.target.value !== 'abs'; $('elev-n').parentElement.hidden = e.target.value === 'abs'; });
bindSlider('elev-y', (v) => { state.elevY = v; });
bindSlider('elev-slope', (v) => { state.elevSlope = v; });
bindSlider('cave-depth', (v) => { state.caveDepth = v; });
bindSlider('cave-height', (v) => { state.caveHeight = v; });
bindSlider('cave-density', (v) => { terrain.cave.density = v; });
bindSlider('cave-size', (v) => { terrain.cave.size = v; });
bindSlider('rule-slope', (v) => { terrain.rules.slopeStone = v; });
bindSlider('rule-snow', (v) => { terrain.rules.snowLine = v; });
bindSlider('rule-dirt', (v) => { terrain.rules.dirtDepth = v; });
function syncRuleSliders() {
  for (const [id, key] of [['rule-slope', 'slopeStone'], ['rule-snow', 'snowLine'], ['rule-dirt', 'dirtDepth']]) {
    $(id).value = terrain.rules[key]; $(id + '-out').textContent = $(id).value;
  }
  for (const [id, key] of [['cave-density', 'density'], ['cave-size', 'size']]) { $(id).value = terrain.cave[key]; $(id + '-out').textContent = $(id).value; }
}
{
  const sel = $('paint-material');
  sel.add(new Option('Tự động (xoá tô)', '0'));
  MATERIALS.forEach((m, i) => { if (m && !m.hidden) sel.add(new Option(m.name, String(i))); });
  // Bảng màu vật liệu nổi trên khung nhìn khi dùng cọ "Tô vật liệu": thấy ngay đang tô loại nào.
  const pal = $('mat-palette');
  const head = document.createElement('h4'); pal.appendChild(head);
  const pick = (i) => {
    state.material = i; sel.value = String(i);
    for (const b of pal.querySelectorAll('button')) b.classList.toggle('active', Number(b.dataset.mat) === i);
    head.textContent = 'Đang tô: ' + (i ? MATERIALS[i].name : 'Tự động (xoá tô)');
  };
  const swatch = (i, name, css, title) => {
    const b = document.createElement('button'); b.dataset.mat = i; b.title = title;
    const sw = document.createElement('i'); sw.style.background = css;
    b.append(sw, name); b.addEventListener('click', () => { pick(i); message('Đang tô: ' + name); });
    pal.appendChild(b);
  };
  MATERIALS.forEach((m, i) => {
    if (!m || m.hidden) return;
    if (m.group) { const h = document.createElement('h4'); h.className = 'sub'; h.textContent = m.group; pal.appendChild(h); }
    swatch(i, m.name, `rgb(${m.color.join(',')})`, m.farm ? `Tô ${m.name}. Có thể đào mương tưới tự động (ô "Mương" trên thanh trên).` : `Tô ${m.name} lên bề mặt.`);
  });
  swatch(0, 'Tự động (xoá tô)', 'repeating-linear-gradient(45deg,#68a04a 0 5px,#888 5px 10px)', 'Xoá chỗ đã tô, trả mặt đất về quy tắc tự động (cỏ, đá ở sườn dốc, tuyết trên cao).');
  pick(6);
  sel.addEventListener('change', () => pick(Number(sel.value)));
  $('paint-ditch').addEventListener('change', (e) => { state.ditch = e.target.value; });
  // Bảng mẫu nền: mỗi ô là dải màu theo tỉ lệ các vật liệu trong mẫu.
  const pp = $('pat-palette'), ph = document.createElement('h4'); pp.appendChild(ph);
  const pickPat = (i) => {
    state.pattern = i;
    for (const b of pp.querySelectorAll('button')) b.classList.toggle('active', Number(b.dataset.pat) === i);
    ph.textContent = 'Đang tô mẫu: ' + PATTERNS[i].name;
  };
  PATTERNS.forEach((P, i) => {
    const mix = P.mix ?? [[P.main, 3], [P.seam, 1]], tot = mix.reduce((a, [, w]) => a + w, 0);
    let acc = 0; const stops = mix.map(([m, w]) => { const a = acc / tot * 100; acc += w; return `rgb(${MATERIALS[m].color.join(',')}) ${a.toFixed(0)}% ${(acc / tot * 100).toFixed(0)}%`; });
    const b = document.createElement('button'); b.dataset.pat = i;
    b.title = `${P.name}: ` + mix.map(([m]) => MATERIALS[m].name).join(', ');
    const sw = document.createElement('i'); sw.style.background = `linear-gradient(90deg, ${stops.join(',')})`;
    b.append(sw, P.name); b.addEventListener('click', () => { pickPat(i); message('Đang tô mẫu: ' + P.name); });
    pp.appendChild(b);
  });
  pickPat(0);
  // Bảng trang trí: bấm bật/tắt từng loại (chọn nhiều được); hàng nút trên cùng là các bộ phối sẵn.
  const dp = $('deco-palette'), dh = document.createElement('h4'); dp.appendChild(dh);
  state.decoSel = new Set([1, 5, 6]);
  const refreshDeco = () => {
    for (const b of dp.querySelectorAll('button[data-deco]')) b.classList.toggle('active', state.decoSel.has(Number(b.dataset.deco)));
    dh.textContent = state.decoSel.size ? `Đang rải: ${state.decoSel.size} loại (ngẫu nhiên)` : 'Chưa chọn loại nào';
  };
  const setSel = (keys, msg) => { state.decoSel = new Set(keys.map((k) => DECO.findIndex((d) => d.key === k) + 1).filter(Boolean)); refreshDeco(); if (msg) message(msg); };
  const presets = [
    ['Đồng cỏ', ['grass', 'grass', 'tall_grass', 'fern', 'dandelion']],
    ['Đồng hoa', ['dandelion', 'poppy', 'cornflower', 'oxeye', 'azure_bluet', 'allium', 'red_tulip', 'pink_tulip', 'grass']],
    ['Rừng ẩm', ['fern', 'large_fern', 'brown_mushroom', 'red_mushroom', 'grass', 'lily']],
    ['Hoang khô', ['dead_bush', 'grass', 'cobweb']],
    ['Vườn hoa cao', ['sunflower', 'lilac', 'rose_bush', 'peony', 'grass']],
  ];
  const ph2 = document.createElement('h4'); ph2.className = 'sub'; ph2.textContent = 'Bộ phối sẵn'; dp.appendChild(ph2);
  for (const [name, keys] of presets) {
    const b = document.createElement('button'); b.textContent = name; b.title = 'Chọn nhanh bộ: ' + [...new Set(keys)].map((k) => DECO.find((d) => d.key === k).name).join(', ');
    b.addEventListener('click', () => setSel([...new Set(keys)], 'Đã chọn bộ "' + name + '"')); dp.appendChild(b);
  }
  const bAll = document.createElement('button'); bAll.textContent = 'Chọn hết'; bAll.addEventListener('click', () => { state.decoSel = new Set(DECO.map((_, i) => i + 1)); refreshDeco(); });
  const bNone = document.createElement('button'); bNone.textContent = 'Bỏ hết'; bNone.addEventListener('click', () => { state.decoSel = new Set(); refreshDeco(); });
  dp.append(bAll, bNone);
  let lastG = '';
  DECO.forEach((d, i) => {
    if (d.group !== lastG) { lastG = d.group; const gh = document.createElement('h4'); gh.className = 'sub'; gh.textContent = d.group; dp.appendChild(gh); }
    const b = document.createElement('button'); b.dataset.deco = i + 1; b.title = d.name;
    const sw = document.createElement('i'); sw.style.background = `rgb(${d.color.join(',')})`;
    b.append(sw, d.name);
    b.addEventListener('click', () => { const k = i + 1; if (state.decoSel.has(k)) state.decoSel.delete(k); else state.decoSel.add(k); refreshDeco(); });
    dp.appendChild(b);
  });
  refreshDeco();
  const bs = $('paint-biome');
  bs.add(new Option('Biome nền (xoá tô)', '0'));
  BIOMES.forEach((b, i) => bs.add(new Option(b.name, String(i + 1))));
  bs.value = '5'; state.biome = 5;
  bs.addEventListener('change', () => { state.biome = Number(bs.value); });
}
for (const sel of [$('new-biome'), $('exp-biome')]) {
  for (const b of BIOMES) { const o = document.createElement('option'); o.value = b.id; o.textContent = b.name; sel.appendChild(o); }
}

{
  PAD_STYLES.forEach((st, i) => $('st-pad-style').add(new Option(st.name, String(i))));
  const sync = () => { const v = $('st-pad').value; $('st-pad-style-row').hidden = v === 'none'; $('st-pad-margin-row').hidden = v !== 'site'; state.dirty = true; };
  $('st-line').addEventListener('change', () => { $('st-gap-row').hidden = !$('st-line').checked; state.stLine = null; state.dirty = true; });
  $('st-pad').addEventListener('change', sync); $('st-pad-margin').addEventListener('input', () => { state.dirty = true; }); sync();
}
const padMargin = () => Math.min(8, Math.max(1, Math.round(Number($('st-pad-margin').value) || 2)));

function message(text, isError = false) {
  const el = $('st-msg'); el.textContent = text; el.classList.toggle('error', isError);
}
function refreshStatus() {
  $('st-map').textContent = `Map: ${terrain.size} x ${terrain.size}` + (terrain.border ? ` · border ${terrain.border.size}` : '');
  $('st-zoom').textContent = `Phóng: ${view.scale}x`;
}

// ---- Bảng bên phải: [Structure], [Road], [Mob] ----
function showTab(id) {
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === id);
  for (const name of ['structure', 'road', 'mob', 'placed', 'prop', 'players', 'script']) $('tab-' + name).hidden = name !== id;
}
for (const tab of document.querySelectorAll('.tab')) tab.addEventListener('click', () => showTab(tab.dataset.tab));
ROADS.forEach((r, i) => {
  const b = document.createElement('button');
  b.textContent = r.name; b.dataset.road = i;
  b.title = r.strip ? `Dải có vạch kẻ: nền ${MATERIALS[r.strip.base].name}, vạch ${MATERIALS[r.strip.line].name}. Chỉ vẽ được ở chế độ "Đặt thẳng". Cỡ cọ gợi ý ${r.strip.radius} (rộng ${2 * r.strip.radius + 1} khối).`
    : r.trench ? `Hào đào sâu ${r.trench.depth} khối, đáy lát ván, đất đắp thành bờ bao cát hai bên. Vẽ bằng cọ hoặc đặt thẳng. Giữ Shift để lấp lại.`
    : `Giữa đường: ${MATERIALS[r.center].name}. Hai bên mép: ${MATERIALS[r.edge].name}.`;
  b.addEventListener('click', () => { state.road = i; setTool('road'); roadChosen(r); });
  $('road-list').appendChild(b);
});
$('road-grade').addEventListener('change', (e) => { state.roadGrade = e.target.checked; });
/** Chọn mẫu đường: dải có vạch kẻ tự chuyển sang "Đặt thẳng", đặt cỡ cọ gợi ý và bật ép phẳng nền. */
function roadChosen(r) {
  const special = r.strip || r.trench;
  $('road-grade').parentElement.style.display = r.trench ? 'none' : '';
  $('road-grade-text').textContent = r.strip ? 'Ép phẳng nền theo độ cao điểm đầu' : 'Làm thoải nền đường';
  if (!special) return;
  const sz = $('brush-size'); sz.value = (r.strip ?? r.trench).radius; sz.dispatchEvent(new Event('input'));
  if (r.strip) {
    $('road-grade').checked = state.roadGrade = true;
    if (state.roadMode !== 'line') { document.querySelector('input[name="road-mode"][value="line"]').click(); }
    message(`${r.name}: bấm điểm đầu rồi điểm cuối (bấm tiếp để nối đoạn, Esc để kết thúc). Nền được ép phẳng theo độ cao điểm đầu.`);
  } else message(`${r.name}: kéo chuột hoặc đặt thẳng để đào hào. Giữ Shift để lấp lại.`);
}
for (const r of document.querySelectorAll('input[name="road-mode"]')) {
  r.addEventListener('change', () => {
    state.roadMode = r.value; state.lineStart = null; state.dirty = true;
    if (state.tool !== 'road') setTool('road');
    message(r.value === 'line' ? 'Đặt thẳng: bấm điểm đầu của đường' : 'Cọ vẽ: kéo chuột để vẽ đường');
  });
}
/** Rải cọ đường từng bước ngắn từ ô `from` tới ô `to` để đường liền mạch. */
function roadStroke(from, to, o) {
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(dist / Math.max(1, state.radius / 2)));
  let changed = false;
  for (let k = 0; k <= steps; k++) {
    const x = Math.round(from.x + (to.x - from.x) * k / steps), z = Math.round(from.z + (to.z - from.z) * k / steps);
    changed = applyBrush(terrain, x, z, o) || changed;
  }
  return changed;
}
function clickRoadLine(cell, shift) {
  if (!state.lineStart) { state.lineStart = cell; state.roadS = 0; state.dirty = true; return message(`Điểm đầu: ${cell.x}, ${cell.z}. Bấm điểm cuối (Esc để bỏ).`); }
  pushUndo();
  const o = { tool: 'road', radius: state.radius, strength: state.strength, dt: 0.016, invert: shift, road: ROADS[state.road], grade: state.roadGrade };
  const from = state.lineStart, len = Math.round(Math.hypot(cell.x - from.x, cell.z - from.z));
  const rd = ROADS[state.road];
  const changed = rd.strip || rd.trench
    ? paintStrip(terrain, from, cell, { road: rd, radius: state.radius, level: state.roadGrade, invert: shift, sOffset: state.roadS })
    : roadStroke(from, cell, o);
  state.roadS += len;
  if (!changed) state.undo.pop();
  state.lineStart = cell; state.dirty = true; mini?.invalidate();
  message(`${shift ? 'Đã xoá' : 'Đã đặt'} đoạn đường thẳng dài ${len} khối. Bấm tiếp để nối đoạn kế, Esc để kết thúc.`);
}

// Tên hiển thị của các nhóm (thư mục con) quen thuộc.
const GROUP_NAMES = {
  '': 'Thư mục gốc', co_ban: 'Cơ bản (có sẵn)', the_chien_2: 'Thế chiến 2 (có sẵn)', san_bay: 'Sân bay (có sẵn)', tham_chieu: 'Đồ vật và nhà cửa (có sẵn)', tau_my: 'Tàu thuyền Mỹ WW2 (có sẵn)', bo_tuong_da: 'Hệ tường đá (có sẵn)', okinawa_bo_sung: 'Okinawa bổ sung (có sẵn)', lang_plains: 'Làng đồng cỏ', lang_desert: 'Làng sa mạc',
  lang_savanna: 'Làng xavan', lang_snowy: 'Làng tuyết', lang_taiga: 'Làng rừng lá kim',
};
const groupOf = (name) => (name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : '');
let folderFiles = [], folderLoad = 0, currentWallNames = null; // currentWallNames: các file của nhóm nếu nhóm là hệ tường
const baseName = (n) => n.slice(n.lastIndexOf('/') + 1);
function showSchemFolder(r) {
  if (r.error) return message(r.error, true);
  if (!r.folder) return;
  folderFiles = r.files;
  $('schem-folder').textContent = r.files.length
    ? r.folder
    : `${r.folder} — chưa có file .schem nào. Bấm "Mở thư mục", chép file vào rồi bấm "Tải lại".`;
  const sel = $('schem-group'), before = sel.value;
  const groups = [...new Set(r.files.map(groupOf))].sort((x, y) => x.localeCompare(y, 'vi', { numeric: true })); // thư mục gốc ('') đứng đầu
  sel.textContent = '';
  for (const g of groups) sel.add(new Option(`${GROUP_NAMES[g] ?? g} (${r.files.filter((f) => groupOf(f) === g).length})`, g));
  if (groups.includes(before)) sel.value = before;
  return showGroup();
}
/** Hiện các ô công trình của nhóm đang chọn; đọc lần lượt từng file rồi vẽ hình xem trước. */
async function showGroup() {
  const load = ++folderLoad;
  const group = $('schem-group').value;
  const list = $('schem-list'); list.textContent = '';
  currentWallNames = findWallSet(folderFiles.filter((f) => groupOf(f) === group).map(baseName)) ? folderFiles.filter((f) => groupOf(f) === group) : null;
  state.wall = null; $('wall-panel').hidden = !currentWallNames; syncWallMode();
  const cards = folderFiles.filter((f) => groupOf(f) === group).map((name) => {
    const b = document.createElement('button');
    b.className = 'card'; b.dataset.name = name; b.title = name;
    const cv = document.createElement('canvas'); cv.width = 440; cv.height = 320;
    const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = name.slice(name.lastIndexOf('/') + 1).replace(/\.schem$/i, '');
    const dm = document.createElement('span'); dm.className = 'dims'; dm.textContent = 'Đang đọc...';
    b.append(cv, nm, dm);
    b.classList.toggle('active', state.tool === 'structure' && state.schem === name);
    b.addEventListener('click', () => selectSchem(name));
    b.addEventListener('pointerenter', () => showBig(name, 0, false));
    b.addEventListener('pointerleave', () => showBig());
    list.appendChild(b);
    return { name, b, cv, dm };
  });
  for (const c of cards) {
    if (load !== folderLoad) return; // người dùng đã đổi nhóm, tải lại hoặc đổi thư mục
    const res = await api.loadSchem(c.name);
    if (res.error) { c.b.classList.add('failed'); c.dm.textContent = res.error; continue; }
    addToLibrary(c.name, res.raw, res.schem);
    c.dm.textContent = `${res.schem.w} x ${res.schem.h} x ${res.schem.l}`;
    c.b.title = `${c.name}: rộng ${res.schem.w}, cao ${res.schem.h}, dài ${res.schem.l} khối`;
    renderThumb(res.schem, c.cv);
    await new Promise((ok) => setTimeout(ok)); // nhường cho giao diện vẽ
  }
}
$('schem-group').addEventListener('change', showGroup);
$('btn-import-village').addEventListener('click', async () => {
  if (!api) return message('Chỉ dùng được trong chương trình .exe', true);
  message('Đang đọc file của Minecraft...');
  const r = await api.importVillage();
  if (r.error) return message(r.error, true);
  if (!r.count) return message('Đã huỷ nhập');
  await showSchemFolder(await api.schemFolder(false));
  const first = Object.keys(r.groups).sort()[0];
  $('schem-group').value = first; await showGroup();
  message(`Đã nhập ${r.count} công trình làng từ ${r.jar}`);
});
$('btn-schem-folder').addEventListener('click', async () => {
  if (!api) return message('Chỉ dùng được trong chương trình .exe', true);
  showSchemFolder(await api.schemFolder(true));
});
$('btn-schem-reload').addEventListener('click', async () => {
  if (!api) return message('Chỉ dùng được trong chương trình .exe', true);
  await showSchemFolder(await api.schemFolder(false)); message('Đã tải lại danh sách công trình');
});
$('btn-schem-open').addEventListener('click', () => { if (api) api.openSchemFolder(); });
function addToLibrary(name, raw, schem) {
  const old = library.get(name);
  library.set(name, { raw, ...schem, maps: new Map() });
  bigShown = '';
  if (old && terrain.placements.some((p) => p.name === name)) refreshStructures(); // file đã đổi nội dung
}
let bigShown = '';
/** Hình xem trước lớn: công trình đang rê chuột lên, nếu không thì công trình đang chọn (theo hướng xoay/lật hiện tại). */
function showBig(name, rot, flip) {
  if (!name || !library.has(name)) { name = state.schem; rot = state.rot; flip = state.flip; }
  const s = name && library.get(name);
  // Ô xem trước luôn chiếm chỗ cố định: nếu ẩn/hiện theo con trỏ thì danh sách bên dưới bị xô lên xuống và nhấp nháy.
  $('schem-big-name').classList.toggle('none', !s);
  if (!s) {
    const cv = $('schem-big-cv'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    $('schem-big-name').textContent = 'Rê chuột lên một công trình để xem trước, bấm để chọn.';
    bigShown = '';
    return;
  }
  if (bigShown === name + '|' + rot + '|' + flip) return; // đang hiện đúng hình này rồi, khỏi vẽ lại
  bigShown = name + '|' + rot + '|' + flip;
  renderThumb(s, $('schem-big-cv'), { rot, flip });
  const [w, l] = dimsAfter(s.w, s.l, rot);
  $('schem-big-name').textContent = `${niceName(name)} · ${w} x ${s.h} x ${l}` + (rot ? ` · xoay ${rot * 90}°` : '') + (flip ? ' · lật' : '');
}
$('schem-rot').addEventListener('click', () => { if (!state.schem) return; state.rot = (state.rot + 1) & 3; setTool('structure'); showBig(); });
$('schem-flip').addEventListener('click', () => { if (!state.schem) return; state.flip = !state.flip; setTool('structure'); showBig(); });
function selectSchem(name) {
  const s = library.get(name);
  if (!s) return message('Công trình này chưa đọc xong hoặc bị lỗi', true);
  state.schem = name; state.rot = 0; state.flip = false;
  setTool('structure'); showBig();
  message(`${name}: rộng ${s.w}, cao ${s.h}, dài ${s.l} khối`);
}
// ---- Texture thật của Minecraft (đọc từ jar của game; không có thì vẽ bằng màu) ----
let texPending = new Set(), texTimer = 0;
function needTextures(names) {
  for (const n of names) if (!textures.asked.has(n)) texPending.add(n);
  if (!texPending.size || texTimer) return;
  texTimer = setTimeout(async () => { // gom nhiều công trình vừa nạp thành một lần hỏi
    texTimer = 0; const list = [...texPending]; texPending = new Set();
    if (await textures.ensure(list)) { state.dirty = true; mini?.invalidate(); }
    showTexStatus();
  }, 60);
}
function showTexStatus() {
  const el = $('tex-status'); if (!el) return;
  el.textContent = textures.available ? 'Đang dùng texture từ ' + String(textures.jar).split(/[\\/]/).pop() : textures.error ?? 'Chưa tìm thấy Minecraft: đang vẽ bằng màu. Bấm nút bên dưới để chọn file jar.';
}
needTextures(['minecraft:water', ...MATERIALS.flatMap((m) => (m ? [BLOCK_PALETTE[m.top]?.Name, BLOCK_PALETTE[m.under]?.Name] : []))].filter(Boolean));
function topMap(name, rot, flip) {
  const s = library.get(name);
  const key = rot + (flip ? 'f' : '');
  if (!s.maps.has(key)) { const mp = buildTopMap(s, rot, flip); s.maps.set(key, mp); needTextures(mp.pal); }
  return s.maps.get(key);
}
function refreshStructures() {
  touch3D();
  view.setStructures(terrain.placements.filter((p) => library.has(p.name))
    .map((p) => ({ x: p.x, y: p.y, z: p.z, map: topMap(p.name, p.rot, p.flip), label: niceName(p.name), p })));
  state.dirty = true;
  mini?.invalidate();
  refreshPlaced();
}
const niceName = (name) => name.slice(name.lastIndexOf('/') + 1).replace(/\.schem$/i, '');

// ---- Bảng [Đã đặt]: mọi thứ đang có trên map; bấm để nhảy tới, ✕ để gỡ ----
let focus = null, focusTimer = 0; // { hi } hoặc { group }: thứ vừa được chọn trong danh sách, làm nổi vài giây
function focusOn(x, z, what) {
  view.camX = x; view.camZ = z; view.clampCam();
  focus = what; clearTimeout(focusTimer);
  focusTimer = setTimeout(() => { focus = null; state.dirty = true; }, 3000);
  state.dirty = true;
}
function refreshPlaced() {
  const box = $('placed-list'); if (!box) return;
  box.textContent = '';
  const head = (text) => { const h = document.createElement('h4'); h.textContent = text; box.appendChild(h); };
  const row = (swatch, text, sub, title, onGo, onRemove) => {
    const r = document.createElement('div'); r.className = 'prow'; r.title = title;
    const go = document.createElement('button'); go.className = 'go';
    const sw = document.createElement('i'); sw.style.background = swatch;
    const nm = document.createElement('span'); nm.textContent = text;
    const sb = document.createElement('small'); sb.textContent = sub;
    go.append(sw, nm, sb); go.addEventListener('click', onGo);
    const rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '✕'; rm.title = 'Gỡ khỏi map (Ctrl+Z để hoàn tác)';
    rm.addEventListener('click', onRemove);
    r.append(go, rm); box.appendChild(r);
  };
  head(`Công trình (${terrain.placements.length})`);
  terrain.placements.forEach((p, i) => {
    const s = library.get(p.name);
    const b = s ? placementBox(p, s) : { x0: p.x, z0: p.z, x1: p.x, z1: p.z, w: 1, l: 1 };
    row('#b58a4a', niceName(p.name), `${p.x}, ${p.z}`, `${p.name} tại x=${p.x}, y=${p.y}, z=${p.z}. Bấm để nhảy tới.` + (s ? '' : ' (chưa đọc được file công trình này)'),
      () => focusOn(b.x0 + b.w / 2, b.z0 + b.l / 2, { hi: { x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 } }),
      () => { pushUndo(); terrain.placements.splice(i, 1); refreshStructures(); message('Đã gỡ ' + p.name); });
  });
  if (!terrain.placements.length) { const e = document.createElement('p'); e.className = 'empty'; e.textContent = 'Chưa đặt công trình nào.'; box.appendChild(e); }
  head(`Mob (${terrain.mobs.length})`);
  for (const g of mobGroups(terrain.mobs)) {
    row(mobStyle(g.members[0]).color, g.count > 1 ? `${g.label} ×${g.count}` : g.label, `${Math.round(g.x)}, ${Math.round(g.z)}`,
      `${g.id}, ${g.count} con quanh x=${Math.round(g.x)}, z=${Math.round(g.z)}. Bấm để nhảy tới.`,
      () => focusOn(g.x, g.z, { group: g.key }),
      () => { pushUndo(); const gone = new Set(g.members); terrain.mobs = terrain.mobs.filter((m) => !gone.has(m)); refreshMobTotal(); message(`Đã gỡ ${g.count} mob`); });
  }
  if (!terrain.mobs.length) { const e = document.createElement('p'); e.className = 'empty'; e.textContent = 'Chưa đặt mob nào.'; box.appendChild(e); }
  head(`Cây và vật thể (${terrain.props.length})`);
  const byKey = new Map();
  for (const p of terrain.props) { const g = byKey.get(p.k); if (g) g.n++; else byKey.set(p.k, { n: 1, first: p }); }
  for (const [k, g] of [...byKey].sort((a, b) => b[1].n - a[1].n)) {
    const d = PROP_BY_KEY[k]; if (!d) continue;
    row(d.draw.c === '#000' ? d.draw.t : d.draw.c, `${d.name} ×${g.n}`, `${g.first.x}, ${g.first.z}`, `${g.n} cái. Bấm để nhảy tới cái đầu tiên.`,
      () => focusOn(g.first.x + 0.5, g.first.z + 0.5, {}),
      () => { pushUndo(); terrain.props = terrain.props.filter((p) => p.k !== k); propGrid = null; refreshPropTotal(); refreshPlaced(); message(`Đã gỡ ${g.n} ${d.name.toLowerCase()}`); });
  }
  if (!terrain.props.length) { const e = document.createElement('p'); e.className = 'empty'; e.textContent = 'Chưa đặt cây hay vật thể nào.'; box.appendChild(e); }
}
function setShowNames(on) {
  view.showNames = on; $('show-names').checked = on; state.dirty = true;
  try { localStorage.setItem('mmb.showNames', on ? '1' : '0'); } catch { /* không lưu được thì thôi */ }
}
$('show-names').addEventListener('change', (e) => setShowNames(e.target.checked));
try { if (localStorage.getItem('mmb.showNames') === '0') setShowNames(false); } catch { /* bỏ qua */ }
$('show-contours').addEventListener('change', (e) => { view.showContours = e.target.checked; state.dirty = true; });
function setCaveView(on) {
  view.showCaves = !!on; $('show-caves').checked = !!on; $('btn-caves').classList.toggle('active', !!on); state.dirty = true;
}
$('show-caves').addEventListener('change', (e) => setCaveView(e.target.checked));
$('btn-caves').addEventListener('click', () => setCaveView(!view.showCaves));
$('cave-seed').addEventListener('click', () => { terrain.cave.seed = (Math.random() * 0x7fffffff) | 0; message('Đã đổi kiểu hang ngẫu nhiên (thấy trong game sau khi xuất world)'); });
$('show-tex').addEventListener('change', (e) => { view.useTex = e.target.checked; state.dirty = true; });
$('tex-jar').addEventListener('click', async () => {
  const r = await window.mapBuilder.chooseTextureJar();
  if (r.error) return message(r.error, true);
  if (!r.jar) return;
  textures.reset(); texPending = new Set();
  const names = new Set(MATERIALS.flatMap((m) => (m ? [BLOCK_PALETTE[m.top]?.Name, BLOCK_PALETTE[m.under]?.Name] : [])).filter(Boolean));
  for (const s of library.values()) for (const mp of s.maps.values()) mp.pal.forEach((n) => names.add(n));
  needTextures([...names]); message('Đã chọn file jar, đang nạp texture...');
});
$('show-grid').addEventListener('change', (e) => { view.showGrid = e.target.checked; state.dirty = true; });
$('show-mini').addEventListener('change', (e) => { $('minimap').hidden = !e.target.checked; state.dirty = true; });
mini = new MiniMap($('minimap'), view, (x, z) => { view.camX = x; view.camZ = z; view.clampCam(); state.dirty = true; });

// ---- Hoàn tác ----
const snapshot = () => ({
  layers: LAYERS.map((k) => terrain[k].slice()),
  placements: terrain.placements.map((p) => ({ ...p })),
  mobs: terrain.mobs.map((m) => ({ ...m })),
  props: terrain.props.slice(), // mỗi prop là đối tượng bất biến (không bao giờ sửa tại chỗ) nên chỉ cần chép danh sách
  spawn: terrain.spawn && { ...terrain.spawn },
  border: terrain.border && { ...terrain.border },
  scenario: JSON.parse(JSON.stringify(terrain.scenario)),
});
function restore(snap) {
  LAYERS.forEach((k, i) => terrain[k].set(snap.layers[i]));
  terrain.placements = snap.placements.map((p) => ({ ...p }));
  state.wall = null;
  terrain.mobs = snap.mobs.map((m) => ({ ...m }));
  terrain.props = snap.props.slice(); propGrid = null;
  refreshMobTotal(); refreshPropTotal();
  terrain.spawn = snap.spawn && { ...snap.spawn };
  terrain.border = snap.border && { ...snap.border };
  terrain.scenario = JSON.parse(JSON.stringify(snap.scenario));
  window.__refreshScenario?.();
  refreshStructures();
}
function pushUndo() {
  state.undo.push(snapshot());
  if (state.undo.length > MAX_UNDO) state.undo.shift();
  state.redo.length = 0;
}
function undo() {
  if (!state.undo.length) return message('Không còn gì để hoàn tác');
  state.redo.push(snapshot());
  restore(state.undo.pop()); message('Đã hoàn tác');
}
function redo() {
  if (!state.redo.length) return message('Không còn gì để làm lại');
  state.undo.push(snapshot());
  restore(state.redo.pop()); message('Đã làm lại');
}
$('btn-undo').addEventListener('click', undo);
$('btn-redo').addEventListener('click', redo);

// ---- Thao tác một lần bấm: đặt/gỡ công trình, đặt điểm xuất hiện ----
function clickStructure(cell, shift) {
  if (shift) {
    for (let i = terrain.placements.length - 1; i >= 0; i--) {
      const p = terrain.placements[i], s = library.get(p.name);
      if (!s) continue;
      const b = placementBox(p, s);
      if (cell.x >= b.x0 && cell.x <= b.x1 && cell.z >= b.z0 && cell.z <= b.z1) {
        pushUndo(); terrain.placements.splice(i, 1); refreshStructures();
        return message('Đã gỡ ' + p.name);
      }
    }
    return message('Không có công trình nào ở ô này');
  }
  if (wallDrawOn()) return clickWall(cell);
  if (!state.schem) return message('Hãy chọn một công trình trong bảng [Structure] trước', true);
  if ($('st-line').checked) return clickStructureLine(cell);
  pushUndo();
  placeStructure(cell, state.rot);
  refreshStructures();
  message(`Đã đặt ${state.schem} (tổng cộng ${terrain.placements.length} công trình)`);
}
/** Đặt một công trình đang chọn tại ô, theo các tuỳ chọn hiện tại (nền, độ cao, dọn đất). */
function placeStructure(cell, rot) {
  const level = heightAt(terrain, cell.x, cell.z), padMode = $('st-pad').value, padStyle = Number($('st-pad-style').value) || 0;
  const pl = makePlacement(terrain, library.get(state.schem), state.schem, cell.x, cell.z, {
    rot, flip: state.flip, air: $('st-air').checked,
    yOffset: Math.min(60, Math.max(-30, Math.round(Number($('st-yoffset').value) || 0))),
  });
  if (padMode !== 'none') pl.found = PAD_STYLES[padStyle].block;
  if (padMode === 'site') { prepareSite(terrain, placementBox(pl, library.get(state.schem)), level, { margin: padMargin(), style: padStyle }); mini?.invalidate(); }
  terrain.placements.push(pl);
  return pl;
}
// ---- Hệ tường: chế độ Nối vẽ ----
const wallDrawOn = () => !!currentWallNames && !$('wall-panel').hidden && $('wall-mode-draw').checked;
function syncWallMode() { $('wall-opts').hidden = !$('wall-mode-draw').checked; state.wall = null; state.dirty = true; }
for (const id of ['wall-mode-draw', 'wall-mode-place']) $(id).addEventListener('change', syncWallMode);
const wallNum = (id, lo, hi, d) => Math.min(hi, Math.max(lo, Math.round(Number($(id).value) || d)));
function wallSet() {
  const kinds = findWallSet(currentWallNames.map(baseName)), set = {};
  for (const [k, b] of Object.entries(kinds)) {
    const full = currentWallNames.find((n) => baseName(n) === b), s = library.get(full);
    if (!s) return null; // chưa đọc xong
    set[k] = { name: full, w: s.w, l: s.l };
  }
  return set;
}
function wallOptions() {
  return { embEvery: wallNum('wall-emb', 0, 8, 0), bunkerEvery: wallNum('wall-bunker', 0, 20, 0), ruinPct: wallNum('wall-ruin', 0, 100, 0),
    gate: $('wall-gate').checked, startCap: $('wall-caps').checked, endCap: $('wall-caps').checked, frontFlip: $('wall-flip').checked, seed: state.wall.seed };
}
function finishWall() {
  if (!state.wall) return false;
  state.wall = null; state.dirty = true; message('Đã kết thúc tuyến tường'); return true;
}
/** Mỗi lần bấm: thêm điểm vào tuyến rồi dựng lại cả tuyến (thay các mảnh của lần bấm trước) để đầu tường luôn ở đúng cuối tuyến. */
function clickWall(cell) {
  const set = wallSet();
  if (!set) return message('Đang đọc các mảnh tường, chờ giây lát rồi bấm lại', true);
  const alive = state.wall && terrain.placements.length === state.wall.base + state.wall.n;
  if (!state.wall || (state.wall.n && !alive)) {
    state.wall = { pts: [{ x: cell.x, z: cell.z }], base: terrain.placements.length, n: 0, seed: 1 + Math.floor(Math.random() * 1000) };
    state.dirty = true; return message(`Điểm đầu tuyến: ${cell.x}, ${cell.z}. Bấm điểm kế tiếp để kéo tường (Enter/Esc để kết thúc).`);
  }
  const w = state.wall, pts = [...w.pts, { x: cell.x, z: cell.z }];
  const res = assembleWall(pts, set, wallOptions());
  if (!res.pieces.length) return message('Điểm này trùng hoặc quay ngược lại, hãy bấm điểm khác', true);
  if (w.base + res.pieces.length > 4000) return message('Quá nhiều công trình trên map', true);
  const inside = res.pieces.every((p) => p.x >= 0 && p.z >= 0 && p.x + p.w <= terrain.size && p.z + p.l <= terrain.size);
  if (!inside) return message('Tuyến tường vượt ra ngoài map, hãy chọn điểm gần hơn', true);
  pushUndo();
  terrain.placements.length = w.base;
  const padMode = $('st-pad').value, padStyle = Number($('st-pad-style').value) || 0, flat = $('wall-flat').checked;
  const yOffset = Math.min(60, Math.max(-30, Math.round(Number($('st-yoffset').value) || 0)));
  const level = heightAt(terrain, pts[0].x, pts[0].z);
  for (const p of res.pieces) {
    const sch = library.get(p.name), cx = p.x + (p.w >> 1), cz = p.z + (p.l >> 1);
    const pl = makePlacement(terrain, sch, p.name, cx, cz, { rot: p.rot, flip: p.flip, air: p.kind === 'breach' || p.kind === 'collapsed', yOffset });
    if (flat) pl.y = level + 1 + yOffset;
    if (flat || padMode !== 'none') pl.found = PAD_STYLES[padStyle].block;
    if (padMode === 'site') prepareSite(terrain, placementBox(pl, sch), flat ? level : heightAt(terrain, cx, cz), { margin: padMargin(), style: padStyle });
    terrain.placements.push(pl);
  }
  if (padMode === 'site') mini?.invalidate();
  w.pts = pts; w.n = res.pieces.length;
  refreshStructures(); state.dirty = true;
  const warn = res.mismatches ? ` Lưu ý: ${res.mismatches} chỗ rẽ về phía mặt sau nên mép tường lệch bậc; bật "Đảo mặt trước" hoặc rẽ về một phía để liền hơn.` : '';
  message(`Tuyến tường: ${res.pieces.length} mảnh, ${res.corners} góc. Bấm tiếp để kéo dài, Enter/Esc để kết thúc.${warn}`);
}
/** Đặt lặp công trình dọc theo đoạn từ điểm trước tới điểm vừa bấm; công trình tự xoay theo hướng đoạn. */
function clickStructureLine(cell) {
  if (!state.stLine) { state.stLine = cell; state.dirty = true; return message(`Điểm đầu: ${cell.x}, ${cell.z}. Bấm điểm cuối (Esc để bỏ).`); }
  const from = state.stLine, s = library.get(state.schem);
  const dx = cell.x - from.x, dz = cell.z - from.z, len = Math.hypot(dx, dz);
  if (len < 1) return;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  // Bản gốc dài theo trục x (w); xoay 1/3 thì trục dài quay sang z.
  const rot = alongX ? ((state.rot & 1) ? (state.rot + 1) & 3 : state.rot) : ((state.rot & 1) ? state.rot : (state.rot + 1) & 3);
  const step = Math.max(1, (alongX ? (rot & 1 ? s.l : s.w) : (rot & 1 ? s.w : s.l)) + Math.max(0, Math.min(20, Math.round(Number($('st-gap').value) || 0))));
  const n = Math.floor(len / step) + 1;
  if (terrain.placements.length + n > 4000) return message('Quá nhiều công trình trên map', true);
  pushUndo();
  for (let i = 0; i < n; i++) {
    const x = Math.round(from.x + dx / len * i * step), z = Math.round(from.z + dz / len * i * step);
    if (x < 0 || z < 0 || x >= terrain.size || z >= terrain.size) break;
    placeStructure({ x, z }, rot);
  }
  state.stLine = cell; refreshStructures(); state.dirty = true;
  message(`Đã đặt ${n} x ${state.schem} dọc theo đường dài ${Math.round(len)} khối. Bấm tiếp để nối đoạn kế, Esc để kết thúc.`);
}
// ---- Dốc đi bộ xuống hang ----
function stairPreview(cell) {
  const a = state.stairStart, dx = cell.x - a.x, dz = cell.z - a.z, l = Math.hypot(dx, dz) || 1, len = state.caveDepth * 2 + 6;
  return { a, b: { x: Math.round(a.x + dx / l * len), z: Math.round(a.z + dz / l * len) }, radius: Math.min(8, state.radius), erase: state.shift };
}
function clickStair(cell, shift) {
  if (!state.stairStart) { state.stairStart = cell; state.dirty = true; return message(`Cửa hang: ${cell.x}, ${cell.z}. Bấm một điểm để chỉ hướng đi xuống (Shift + bấm để lấp lối đã đào, Esc để bỏ).`); }
  const a = state.stairStart;
  pushUndo();
  const n = digRamp(terrain, a.x, a.z, cell.x, cell.z, { depth: state.caveDepth, width: Math.min(8, state.radius), tall: Math.max(4, state.caveHeight), invert: shift });
  if (!n) { state.undo.pop(); return message('Hai điểm trùng nhau, hãy chọn điểm chỉ hướng khác', true); }
  state.stairStart = null; state.dirty = true; mini?.invalidate();
  message(shift ? 'Đã lấp lối dốc' : `Đã đào lối dốc xuống sâu ${state.caveDepth} khối. Nối sân cuối với hang bằng "Đào hang" hoặc "Vùng hang".`);
}
// ---- World border: kéo cạnh để đổi cỡ, kéo bên trong để dời ----
function startBorder(cell, shift) {
  if (shift) {
    pushUndo();
    if (!setBorder(terrain, terrain.size / 2, terrain.size / 2, terrain.size)) state.undo.pop();
    state.dirty = true; message(`World border trở về cả map (${terrain.size} x ${terrain.size})`); return;
  }
  const b = borderBox(terrain), d = Math.max(Math.abs(cell.x + 0.5 - b.cx), Math.abs(cell.z + 0.5 - b.cz));
  const tol = Math.max(3, 16 / view.scale);
  pushUndo(); state.painting = true; state.strokeChanged = false;
  state.bd = d < b.size / 2 - tol ? { mode: 'move', ox: b.cx - cell.x, oz: b.cz - cell.z } : { mode: 'resize' };
}
function dragBorder(cell) {
  const b = borderBox(terrain), bd = state.bd; if (!bd) return false;
  const ch = bd.mode === 'move'
    ? setBorder(terrain, cell.x + bd.ox, cell.z + bd.oz, b.size)
    : setBorder(terrain, b.cx, b.cz, 2 * Math.max(Math.abs(cell.x + 0.5 - b.cx), Math.abs(cell.z + 0.5 - b.cz)));
  const nb = borderBox(terrain);
  message(`World border: ${nb.size} x ${nb.size}, tâm ${nb.cx}, ${nb.cz} (từ ${nb.x0},${nb.z0} đến ${nb.x1},${nb.z1})`);
  return ch;
}
// ---- Vùng của kịch bản: kéo chuột để vẽ hình chữ nhật, Shift + bấm để gỡ ----
function startZone(cell, shift) {
  const zs = terrain.scenario.zones;
  if (shift) {
    const i = zs.findLastIndex((z) => cell.x >= z.x0 && cell.x <= z.x1 && cell.z >= z.z0 && cell.z <= z.z1);
    if (i < 0) return message('Không có vùng nào ở ô này');
    pushUndo(); const [gone] = zs.splice(i, 1); window.__refreshScenario(); state.dirty = true; return message(`Đã gỡ vùng "${gone.name}"`);
  }
  pushUndo(); state.painting = true; state.strokeChanged = true;
  const id = script.nextId('z', zs);
  state.zn = { id, ox: cell.x, oz: cell.z };
  zs.push({ id, name: 'Vùng ' + id.slice(1), x0: cell.x, z0: cell.z, x1: cell.x, z1: cell.z });
  window.__refreshScenario();
}
function dragZone(cell) {
  const zn = state.zn; if (!zn) return false;
  const z = terrain.scenario.zones.find((q) => q.id === zn.id); if (!z) return false;
  const x0 = Math.min(zn.ox, cell.x), x1 = Math.max(zn.ox, cell.x), z0 = Math.min(zn.oz, cell.z), z1 = Math.max(zn.oz, cell.z);
  if (z.x0 === x0 && z.x1 === x1 && z.z0 === z0 && z.z1 === z1) return false;
  z.x0 = x0; z.x1 = x1; z.z0 = z0; z.z1 = z1;
  message(`Vùng "${z.name}": ${x1 - x0 + 1} x ${z1 - z0 + 1} khối`);
  return true;
}
function clickSpawn(cell, shift) {
  pushUndo();
  terrain.spawn = shift ? null : { x: cell.x, z: cell.z };
  state.dirty = true;
  message(shift ? 'Điểm xuất hiện trở về giữa map' : `Điểm xuất hiện: ${cell.x}, ${cell.z}`);
}

// ---- Mob ----
const DIRS = ['Nam', 'Tây Nam', 'Tây', 'Tây Bắc', 'Bắc', 'Đông Bắc', 'Đông', 'Đông Nam'];
let myMobs = []; // mẫu mob người dùng tự lưu: { name, id, snbt }
function refreshMobTotal() {
  touch3D();
  $('mob-total').textContent = terrain.mobs.length ? `Đã đặt ${terrain.mobs.length} mob trên map.` : 'Chưa đặt mob nào.';
  window.__refreshScenarioWarn?.();
  state.dirty = true;
  refreshPlaced();
}
function describeMobSel() {
  const el = $('mob-current'), m = state.mobSel;
  el.textContent = '';
  if (!m) { el.textContent = 'Chưa chọn mob.'; return; }
  const b = document.createElement('b'); b.textContent = m.name;
  el.append('Đang chọn: ', b, ` — hướng mặt ${DIRS[(state.mobYaw / 45) | 0]}`);
}
function selectMob(spec, mine = -1) {
  const err = checkMobSpec(spec.id, spec.snbt);
  if (err) return message(err, true);
  state.mobSel = { id: spec.id.trim(), snbt: (spec.snbt ?? '').trim(), name: spec.name || spec.id.trim() };
  state.mobMine = mine;
  setTool('mob'); describeMobSel();
  for (const b of $('mob-list').children) b.classList.toggle('active', b.dataset.key === (mine >= 0 ? 'mine' + mine : spec.key));
  message(spec.tip ? `${state.mobSel.name}: ${spec.tip}` : `Đã chọn ${state.mobSel.name}. Bấm lên map để đặt.`);
}
function showMobGroup() {
  const g = Number($('mob-group').value), list = $('mob-list'); list.textContent = '';
  const add = (spec, key, mine) => {
    const b = document.createElement('button');
    b.textContent = spec.name; b.dataset.key = key; b.title = spec.tip ?? `${spec.id}${spec.snbt ? ' ' + spec.snbt : ''}`;
    b.style.borderLeft = `4px solid ${mobColor(spec.id, spec.name)}`;
    b.classList.toggle('active', state.tool === 'mob' && state.mobSel && state.mobSel.name === spec.name && state.mobSel.id === spec.id);
    b.addEventListener('click', () => { if (mine >= 0) { $('mob-id').value = spec.id; $('mob-nbt').value = spec.snbt; $('mob-name').value = spec.name; } selectMob(spec, mine); });
    list.appendChild(b);
  };
  if (g < MOB_GROUPS.length) MOB_CATALOG.filter((m) => m.group === g).forEach((m) => add(m, m.key, -1));
  else {
    if (!myMobs.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'Chưa có mẫu nào. Mở "Mob tuỳ chỉnh", nhập ID mob rồi bấm "Lưu mẫu".'; list.appendChild(p); }
    myMobs.forEach((m, i) => add(m, 'mine' + i, i));
  }
}
function fillMobGroups(keep) {
  const sel = $('mob-group'); sel.textContent = '';
  MOB_GROUPS.forEach((n, i) => sel.add(new Option(n, String(i))));
  sel.add(new Option(`Của tôi (${myMobs.length})`, String(MOB_GROUPS.length)));
  sel.value = keep ?? '0';
  showMobGroup();
}
async function saveMyMobs() { if (api?.setMobPresets) await api.setMobPresets(myMobs); }
$('mob-group').addEventListener('change', showMobGroup);
$('mob-use').addEventListener('click', () => selectMob({ id: $('mob-id').value, snbt: $('mob-nbt').value, name: $('mob-name').value.trim() }));
$('mob-save').addEventListener('click', async () => {
  const spec = { id: $('mob-id').value.trim(), snbt: $('mob-nbt').value.trim(), name: $('mob-name').value.trim() || $('mob-id').value.trim() };
  const err = checkMobSpec(spec.id, spec.snbt);
  if (err) return message(err, true);
  const i = myMobs.findIndex((m) => m.name === spec.name);
  if (i >= 0) myMobs[i] = spec; else myMobs.push(spec);
  await saveMyMobs(); fillMobGroups(String(MOB_GROUPS.length));
  selectMob(spec, i >= 0 ? i : myMobs.length - 1);
  message(`Đã lưu mẫu "${spec.name}" vào nhóm Của tôi`);
});
$('mob-del').addEventListener('click', async () => {
  if (state.mobMine < 0 || !myMobs[state.mobMine]) return message('Hãy chọn một mẫu trong nhóm "Của tôi" trước', true);
  const [gone] = myMobs.splice(state.mobMine, 1);
  state.mobMine = -1; state.mobSel = null; describeMobSel();
  await saveMyMobs(); fillMobGroups(String(MOB_GROUPS.length));
  message(`Đã xoá mẫu "${gone.name}"`);
});
$('mob-clear').addEventListener('click', () => {
  if (!terrain.mobs.length) return message('Chưa có mob nào để gỡ');
  pushUndo(); const n = terrain.mobs.length; terrain.mobs = []; refreshMobTotal(); message(`Đã gỡ ${n} mob (Ctrl+Z để hoàn tác)`);
});
const mobParams = () => ({
  count: Math.min(200, Math.max(1, Math.round(Number($('mob-count').value) || 1))),
  formation: $('mob-form').value,
  spacing: Math.min(10, Math.max(1, Number($('mob-space').value) || 2)),
  dy: Math.min(60, Math.max(-20, Math.round(Number($('mob-dy').value) || 0))),
});
const mobPoints = (cell) => {
  const q = mobParams();
  return formationPoints(q.count, q.formation, q.spacing, state.mobYaw, cell.x + 0.5, cell.z + 0.5)
    .map((p) => ({ x: Math.min(terrain.size - 0.5, Math.max(0.5, p.x)), z: Math.min(terrain.size - 0.5, Math.max(0.5, p.z)) }));
};
function clickMob(cell, shift) {
  if (shift) {
    const cx = cell.x + 0.5, cz = cell.z + 0.5, keep = terrain.mobs.filter((m) => Math.hypot(m.x - cx, m.z - cz) > state.radius);
    const n = terrain.mobs.length - keep.length;
    if (!n) return message('Không có mob nào quanh ô này');
    pushUndo(); terrain.mobs = keep; refreshMobTotal(); return message(`Đã gỡ ${n} mob`);
  }
  if (!state.mobSel) return message('Hãy chọn một mob trong bảng [Mob] trước', true);
  const err = checkMobSpec(state.mobSel.id, state.mobSel.snbt);
  if (err) return message(err, true);
  const q = mobParams();
  pushUndo();
  const g = terrain.mobs.reduce((a, m) => Math.max(a, m.g || 0), 0) + 1; // mỗi lần bấm là một nhóm
  for (const p of mobPoints(cell)) {
    terrain.mobs.push(makeMob({ id: state.mobSel.id, snbt: state.mobSel.snbt, x: p.x, z: p.z, yaw: state.mobYaw, noAI: $('mob-noai').checked, persist: $('mob-persist').checked, dy: q.dy, label: state.mobSel.name, g, cave: $('mob-cave').checked, slot: Number($('mob-slot').value) || 0 }));
  }
  refreshMobTotal();
  message(`Đã đặt ${q.count} x ${state.mobSel.name} (tổng cộng ${terrain.mobs.length} mob)`);
}

// ---- Cây và vật thể ----
const PROP_CAP = 60000; // quá nhiều thì xuất world rất lâu
let propGrid = null;    // lưới băm để kiểm tra khoảng cách khi rải rừng: { arr, n, cells: Map }
const propColor = (d) => (d.draw.c === '#000' ? d.draw.t : d.draw.c);
function gridKey(x, z) { return (x >> 3) + ',' + (z >> 3); }
function gridOf() {
  if (propGrid && propGrid.arr === terrain.props && propGrid.n === terrain.props.length) return propGrid;
  const cells = new Map();
  for (const p of terrain.props) { const k = gridKey(p.x, p.z); const l = cells.get(k); if (l) l.push(p); else cells.set(k, [p]); }
  return (propGrid = { arr: terrain.props, n: terrain.props.length, cells });
}
function gridAdd(p) {
  const g = gridOf(), k = gridKey(p.x, p.z), l = g.cells.get(k);
  if (l) l.push(p); else g.cells.set(k, [p]);
  terrain.props.push(p); g.n = terrain.props.length;
}
function propTooClose(x, z, minD) {
  const g = gridOf(), r = Math.ceil(minD / 8);
  for (let gz = (z >> 3) - r; gz <= (z >> 3) + r; gz++) for (let gx = (x >> 3) - r; gx <= (x >> 3) + r; gx++) {
    const l = g.cells.get(gx + ',' + gz); if (!l) continue;
    for (const p of l) if (Math.hypot(p.x - x, p.z - z) < minD) return true;
  }
  return false;
}
function refreshPropTotal() {
  touch3D();
  const n = terrain.props.length;
  $('prop-total').textContent = n ? `Đã đặt ${n} cây và vật thể trên map.` : 'Chưa đặt cây hay vật thể nào.';
  state.dirty = true;
}
function describePropSel() {
  const d = PROP_BY_KEY[state.propSel], el = $('prop-current');
  $('prop-variant-row').hidden = !d?.variants;
  if (!d) { el.textContent = 'Chưa chọn loại nào.'; return; }
  if (d.variants) {
    const sel = $('prop-variant'); sel.textContent = '';
    d.variants.forEach((n, i) => sel.add(new Option(n, String(i)))); sel.value = String(state.propVariant);
  }
  el.textContent = ''; const b = document.createElement('b'); b.textContent = d.name;
  el.append('Đang chọn: ', b, state.propMode === 'brush' && state.propMix ? ' (khi vẽ rừng sẽ dùng "Hỗn hợp" thay cho loại này)' : '');
}
function selectProp(key) {
  const d = PROP_BY_KEY[key]; if (!d) return;
  state.propSel = key; state.propVariant = d.defV ?? 0;
  setTool('prop'); describePropSel(); showPropGroup();
  message(`${d.name}: ${state.propMode === 'place' ? 'bấm lên map để đặt' : 'kéo chuột lên map để vẽ'}. Giữ Shift để gỡ.`);
}
function showPropGroup() {
  const g = Number($('prop-group').value), list = $('prop-list'); list.textContent = '';
  for (const d of PROP_CATALOG.filter((e) => e.group === g)) {
    const b = document.createElement('button');
    b.textContent = d.name; b.dataset.key = d.key; b.style.borderLeft = `4px solid ${propColor(d)}`;
    b.title = d.name + (d.variants ? ` (${d.variants.length} dạng)` : '');
    b.classList.toggle('active', state.tool === 'prop' && state.propSel === d.key);
    b.addEventListener('click', () => selectProp(d.key));
    list.appendChild(b);
  }
}
{
  PROP_GROUPS.forEach((n, i) => $('prop-group').add(new Option(n, String(i))));
  $('prop-group').addEventListener('change', showPropGroup);
  PROP_SIZES.forEach((z) => $('prop-size').add(new Option(z.name, z.key)));
  $('prop-mix').add(new Option('Chỉ loại đang chọn', ''));
  PROP_MIXES.forEach((m) => $('prop-mix').add(new Option(m.name, m.key)));
  $('prop-size').addEventListener('change', (e) => { state.propSize = e.target.value; });
  $('prop-mix').addEventListener('change', (e) => { state.propMix = e.target.value; describePropSel(); });
  $('prop-variant').addEventListener('change', (e) => { state.propVariant = Number(e.target.value); });
  $('prop-space').addEventListener('input', (e) => { state.propSpace = Math.min(10, Math.max(1, Number(e.target.value) || 4)); });
  for (const r of document.querySelectorAll('input[name="prop-mode"]')) {
    r.addEventListener('change', () => {
      state.propMode = r.value; describePropSel(); state.dirty = true;
      if (state.tool !== 'prop') setTool('prop');
      message(r.value === 'place' ? 'Đặt từng cái: bấm lên map' : 'Vẽ rừng: kéo chuột (cỡ vạt theo "Cỡ cọ"), giữ chuột yên để vạt dày dần');
    });
  }
  $('prop-clear').addEventListener('click', () => {
    if (!terrain.props.length) return message('Chưa có cây hay vật thể nào để gỡ');
    pushUndo(); const n = terrain.props.length; terrain.props = []; propGrid = null; refreshPropTotal(); refreshPlaced();
    message(`Đã gỡ ${n} cây và vật thể (Ctrl+Z để hoàn tác)`);
  });
  showPropGroup(); refreshPropTotal();
}
const propOk = (x, z) => x >= 0 && z >= 0 && x < terrain.size && z < terrain.size && waterAt(terrain, x, z) === NO_WATER;
function eraseProps(cx, cz, r) {
  const keep = terrain.props.filter((p) => Math.hypot(p.x - cx, p.z - cz) > r);
  if (keep.length === terrain.props.length) return false;
  terrain.props = keep; propGrid = null; return true;
}
function clickProp(cell, shift) {
  if (shift) {
    const n = terrain.props.length;
    pushUndo();
    if (!eraseProps(cell.x + 0.5, cell.z + 0.5, state.radius)) { state.undo.pop(); return message('Không có cây hay vật thể nào quanh ô này'); }
    refreshPropTotal(); refreshPlaced(); return message(`Đã gỡ ${n - terrain.props.length} cây và vật thể`);
  }
  const d = PROP_BY_KEY[state.propSel];
  if (!d) return message('Hãy chọn một loại trong bảng [Cây] trước', true);
  if (!propOk(cell.x, cell.z)) return message('Không đặt được dưới nước', true);
  if (terrain.props.length >= PROP_CAP) return message(`Đã đạt mức tối đa ${PROP_CAP} cây và vật thể`, true);
  pushUndo(); gridAdd(makeProp(d.key, cell.x, cell.z, { size: state.propSize, v: d.variants ? state.propVariant : undefined }));
  refreshPropTotal(); refreshPlaced();
  message(`Đã đặt ${d.name} (tổng cộng ${terrain.props.length})`);
}
/** Vẽ rừng: mỗi khung hình thử rải vài điểm ngẫu nhiên trong vòng tròn cọ, điểm nào còn đủ chỗ thì mọc một cây. */
function propStroke(cell, dt) {
  if (state.propMode === 'place') return false;
  if (state.shift) return eraseProps(cell.x + 0.5, cell.z + 0.5, state.radius);
  const mix = PROP_MIXES.find((m) => m.key === state.propMix);
  if (!mix && !PROP_BY_KEY[state.propSel]) { if (!state.warned) { message('Hãy chọn một loại trong bảng [Cây] hoặc một "Hỗn hợp" trước', true); state.warned = true; } return false; }
  state.warned = false;
  const tries = Math.max(2, Math.round(state.radius * 0.6 + 6 * dt * 60 * 0.1));
  let changed = false;
  for (let k = 0; k < tries && terrain.props.length < PROP_CAP; k++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * state.radius;
    const x = Math.floor(cell.x + 0.5 + Math.cos(a) * r), z = Math.floor(cell.z + 0.5 + Math.sin(a) * r);
    if (!propOk(x, z)) continue;
    const key = mix ? pickFromMix(mix) : state.propSel, d = PROP_BY_KEY[key];
    if (!d) continue;
    const minD = Math.max(1.5, d.draw.r * 0.9 * (state.propSpace / 4));
    if (propTooClose(x, z, minD)) continue;
    gridAdd(makeProp(key, x, z, { size: state.propSize, v: d.variants ? (mix ? undefined : state.propVariant) : undefined }));
    changed = true;
  }
  if (changed) { refreshPropTotal(); message(`Đã có ${terrain.props.length} cây và vật thể`); }
  return changed;
}

// ---- Chuột ----
const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); penDown(local(e), e); });
function penDown(p, e) {
  state.mouse = p; state.last = p;
  if (e.button === 0) {
    const cell = cellAt(p.x, p.y);
    if (!cell) return;
    penDown0(cell, e); touch3D();
  } else if (e.button === 2 || e.button === 1) {
    state.panning = true;
  }
}
function penDown0(cell, e) {
  {
    if (state.tool === 'structure') return clickStructure(cell, e.shiftKey);
    if (state.tool === 'spawn') return clickSpawn(cell, e.shiftKey);
    if (state.tool === 'cavestair') return clickStair(cell, e.shiftKey);
    if (state.tool === 'border') return startBorder(cell, e.shiftKey);
    if (state.tool === 'mob') return clickMob(cell, e.shiftKey);
    if (state.tool === 'zone') return startZone(cell, e.shiftKey);
    if (state.tool === 'prop' && state.propMode === 'place') return clickProp(cell, e.shiftKey);
    if (state.tool === 'road' && state.roadMode === 'line') return clickRoadLine(cell, e.shiftKey);
    pushUndo(); state.painting = true; state.strokeChanged = false;
    const h0 = heightAt(terrain, cell.x, cell.z);
    if (state.tool === 'cliff') state.target = h0 + (e.shiftKey ? -state.cliffHeight : state.cliffHeight);
    else if (state.tool === 'elev') {
      state.target = state.elevMode === 'abs' ? state.elevY : Math.round(h0) + (e.shiftKey ? -state.elevN : state.elevN);
      state.elevBase = terrain.heights.slice();
      message(`Bậc độ cao: đặt vùng cọ ở độ cao Y = ${state.target}`);
    }
    else if (state.tool === 'cavedig') state.target = Math.max(-56, h0 - state.caveDepth);
    else if (state.tool === 'river') { const w = waterAt(terrain, cell.x, cell.z); state.target = w !== NO_WATER ? w : h0 - 1; }
    else state.target = h0;
    if (state.tool === 'road') {
      state.roadLast = cell;
    }
    if (state.tool === 'prop') { // một cú bấm nhanh cũng phải rải (hoặc gỡ) được, không chờ khung hình kế
      state.shift = e.shiftKey;
      if (propStroke(cell, 0.016)) { state.strokeChanged = true; state.dirty = true; }
    }
  }
}
canvas.addEventListener('pointermove', (e) => penMove(local(e), e));
function penMove(p, e) {
  if (e.buttons === 0 && (state.painting || state.panning)) endStroke(); // nhả chuột ngoài cửa sổ thì không còn kéo/vẽ mãi
  if (state.panning) { view.panPixels(p.x - state.last.x, p.y - state.last.y); }
  state.last = p; state.mouse = p; state.shift = e.shiftKey; state.dirty = true;
}
const endStroke = () => {
  if (state.zn) { state.zn = null; window.__refreshScenario?.(); }
  if (state.painting && !state.strokeChanged) state.undo.pop();
  if (state.painting && state.tool === 'prop') { refreshPropTotal(); refreshPlaced(); }
  state.painting = false; state.panning = false; touch3D();
};
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('pointerleave', () => { if (!state.painting && !state.panning) { state.mouse = { x: -1, y: -1 }; state.dirty = true; } });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = local(e);
  view.zoom(e.deltaY < 0 ? 1 : -1, p.x, p.y);
  refreshStatus(); state.dirty = true;
}, { passive: false });

// ---- Bàn phím ----
window.addEventListener('keydown', (e) => {
  if (v3?.active && !e.ctrlKey) { if (e.code === 'KeyV' || e.key === 'Escape') { toggle3D(false); e.preventDefault(); return; } if (v3.key(e, true)) return; }
  else if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { toggle3D(true); e.preventDefault(); return; }
  const el = e.target;
  if ((el instanceof HTMLInputElement && el.type !== 'range' && el.type !== 'checkbox') || el instanceof HTMLSelectElement) return;
  if (document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey && k === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey && k === 's') { e.preventDefault(); saveProject(); return; }
  if ((k === 'escape' || k === 'enter') && state.wall && finishWall()) return;
  if (k === 'escape' && (state.stairStart || state.stLine)) { state.stairStart = null; state.stLine = null; state.dirty = true; message('Đã bỏ điểm đầu'); return; }
  if (k === 'escape' && state.lineStart) { state.lineStart = null; state.dirty = true; message('Đã kết thúc đường thẳng'); return; }
  if (k === 'n' && !e.ctrlKey && !e.altKey) { setShowNames(!view.showNames); message(view.showNames ? 'Đã bật tên công trình (bấm N để tắt)' : 'Đã tắt tên công trình (bấm N để bật lại; rê chuột lên công trình vẫn hiện tên)'); return; }
  if (k === 'h' && !e.ctrlKey && !e.altKey) { setCaveView(!view.showCaves); message(view.showCaves ? 'Đang xem hang (bấm H để tắt): tím = hang tự sinh, cam = hang đào tay, vàng = cửa hang.' : 'Đã tắt xem hang'); return; }
  if (k === '[' || k === ']') {
    const s = $('brush-size'); s.value = Number(s.value) + (k === ']' ? 2 : -2); s.dispatchEvent(new Event('input')); return;
  }
  if (state.tool === 'mob' && !e.ctrlKey && k === 'r') { state.mobYaw = (state.mobYaw + 45) % 360; describeMobSel(); state.dirty = true; return; }
  if (state.tool === 'structure' && !e.ctrlKey) {
    if (k === 'r') { state.rot = (state.rot + 1) & 3; state.dirty = true; showBig(); return; }
    if (k === 'f') { state.flip = !state.flip; state.dirty = true; showBig(); return; }
  }
  if (k === 'shift') state.shift = true;
  // Phím di chuyển nhận theo vị trí vật lý (e.code): bộ gõ tiếng Việt làm e.key lúc nhả khác lúc nhấn nên phím bị kẹt và map tự trôi.
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const mk = moveKey(e); if (mk) { state.keys.set(mk, performance.now()); e.preventDefault(); }
});
const MOVE_CODES = { KeyA: 'a', KeyD: 'd', KeyW: 'w', KeyS: 's', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', ArrowUp: 'arrowup', ArrowDown: 'arrowdown' };
function moveKey(e) { return MOVE_CODES[e.code] || null; }
const releaseKeys = () => { state.keys.clear(); state.shift = false; };
window.addEventListener('keyup', (e) => { v3?.key(e, false); const mk = moveKey(e); if (mk) state.keys.delete(mk); if (e.key === 'Shift') state.shift = false; if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'Process') releaseKeys(); });
window.addEventListener('blur', releaseKeys);
document.addEventListener('visibilitychange', releaseKeys);
window.addEventListener('resize', () => { view.resize(); state.dirty = true; });

// ---- Vòng lặp ----
function paint(cell, dt) {
  if (state.tool === 'border') return dragBorder(cell);
  if (state.tool === 'zone') return dragZone(cell);
  if (state.tool === 'prop') return propStroke(cell, dt);
  const o = {
    tool: state.tool, radius: state.radius, strength: state.strength, dt,
    invert: state.shift, target: state.target, material: state.material, biome: state.biome, caveHeight: state.caveHeight, decoList: [...(state.decoSel ?? [])], density: state.decoDensity ?? 0.3, slope: state.elevSlope, base: state.elevBase, ditch: state.ditch, pattern: state.pattern,
  };
  if (state.tool === 'road') {
    // Đi từng bước ngắn từ điểm trước tới điểm hiện tại để đường liền mạch dù kéo chuột nhanh.
    o.road = ROADS[state.road]; o.grade = state.roadGrade;
    if (o.road.trench) {
      const ch = paintStrip(terrain, state.roadLast, cell, { road: o.road, radius: state.radius, invert: state.shift });
      state.roadLast = cell; return ch;
    }
    if (o.road.strip) return false;
    const changed = roadStroke(state.roadLast, cell, o);
    state.roadLast = cell;
    return changed;
  }
  return applyBrush(terrain, cell.x, cell.z, o);
}
function frame(now) {
  const dt = Math.min(0.05, (now - state.lastTime) / 1000); state.lastTime = now;
  const sp = 900 * dt;
  // Phòng hờ: phím không còn tín hiệu lặp quá 3 giây thì coi như đã nhả.
  for (const [k, t] of state.keys) if (now - t > 3000) state.keys.delete(k);
  let dx = 0, dy = 0;
  if (state.keys.has('a') || state.keys.has('arrowleft')) dx += sp;
  if (state.keys.has('d') || state.keys.has('arrowright')) dx -= sp;
  if (state.keys.has('w') || state.keys.has('arrowup')) dy += sp;
  if (state.keys.has('s') || state.keys.has('arrowdown')) dy -= sp;
  if (dx || dy) { view.panPixels(dx, dy); state.dirty = true; }

  const cell = cellAt(state.mouse.x, state.mouse.y);
  if (state.painting && cell && paint(cell, dt)) { state.strokeChanged = true; state.dirty = true; mini.invalidate(); touch3D(); }
  if (mini.stale && !$('minimap').hidden) state.dirty = true; // nền bản đồ nhỏ còn chờ vẽ lại
  if (state.dirty) {
    const pointTool = state.tool === 'structure' || state.tool === 'spawn' || state.tool === 'border' || state.tool === 'zone' || (state.tool === 'mob' && !state.shift) || (state.tool === 'prop' && state.propMode === 'place' && !state.shift);
    if (editing3D()) v3.cursor = cell ? { x: cell.x, z: cell.z, r: pointTool ? 0 : state.radius } : null;
    view.brush = cell && !pointTool ? { x: cell.x, z: cell.z, radius: state.radius } : null;
    view.ghost = null;
    if (cell && state.tool === 'structure' && state.schem) {
      const s = library.get(state.schem);
      const [w, l] = dimsAfter(s.w, s.l, state.rot);
      const x0 = cell.x - (w >> 1), z0 = cell.z - (l >> 1);
      const yOff = Math.min(60, Math.max(-30, Math.round(Number($('st-yoffset').value) || 0)));
      view.ghost = { x0, z0, x1: x0 + w - 1, z1: z0 + l - 1, x: x0, z: z0, y: heightAt(terrain, cell.x, cell.z) + 1 + yOff, map: topMap(state.schem, state.rot, state.flip),
        pad: $('st-pad').value === 'site' ? { margin: padMargin(), y: heightAt(terrain, cell.x, cell.z) } : null };
    }
    view.line = cell && state.tool === 'structure' && state.wall && wallDrawOn() ? { a: state.wall.pts[state.wall.pts.length - 1], b: snapToAxis(state.wall.pts, cell), radius: 1, erase: false } : cell && state.tool === 'cavestair' && state.stairStart ? stairPreview(cell) : cell && state.tool === 'structure' && state.stLine && $('st-line').checked ? { a: state.stLine, b: cell, radius: 1, erase: false } : cell && state.tool === 'road' && state.roadMode === 'line' && state.lineStart ? { a: state.lineStart, b: cell, radius: state.radius, erase: state.shift } : null;
    view.spawn = spawnCell(terrain);
    view.border = terrain.border || state.tool === 'border' ? borderBox(terrain) : null; view.borderEdit = state.tool === 'border';
    view.mobs = terrain.mobs;
    view.props = terrain.props;
    view.propGhost = cell && state.tool === 'prop' && state.propMode === 'place' && !state.shift && state.propSel ? { k: state.propSel, x: cell.x, z: cell.z, sc: 1, s: 1 } : null;
    view.mobGhost = cell && state.tool === 'mob' && !state.shift && state.mobSel ? { points: mobPoints(cell), yaw: state.mobYaw, style: mobStyle({ id: state.mobSel.id, label: state.mobSel.name }) } : null;
    // Thứ đang nằm dưới con trỏ: làm nổi và hiện tên.
    let tipText = '';
    view.hi = focus?.hi ?? null; view.hiGroup = focus?.group ?? null;
    if (!focus && !state.painting && !state.panning && state.mouse.x >= 0) {
      const hm = editing3D() ? null : view.mobAt(state.mouse.x, state.mouse.y);
      const si = cell && !(view.ghost && !state.shift) ? view.structAt(cell.x, cell.z) : -1;
      if (hm && !view.mobGhost) {
        const grp = terrain.mobs.filter((m, i) => (m.g ? `g${m.g}|${m.label}|${m.id}` : `i${i}`) === hm.key).length;
        view.hiGroup = hm.key;
        tipText = `Mob: ${hm.m.label || hm.m.id}` + (hm.m.label && hm.m.label !== hm.m.id ? ` (${hm.m.id})` : '') + (grp > 1 ? ` · nhóm ${grp} con` : '') + (hm.m.noAI ? ' · đứng yên' : '');
      } else if (si >= 0) {
        const it = view.items[si];
        view.hi = { x0: it.x, z0: it.z, x1: it.x + it.map.w - 1, z1: it.z + it.map.l - 1 };
        tipText = `Công trình: ${it.label} · ${it.map.w} x ${it.map.h} x ${it.map.l}` + (it.p.rot ? ` · xoay ${it.p.rot * 90}°` : '') + (it.p.flip ? ' · lật' : '');
      }
    }
    const tip = $('tip');
    tip.hidden = !tipText;
    if (tipText) { tip.textContent = tipText; tip.style.left = Math.min(view.W - 260, state.mouse.x + 16) + 'px'; tip.style.top = Math.max(4, state.mouse.y - 30) + 'px'; }
    view.render();
    if (!$('minimap').hidden) mini.render();
    state.dirty = false;
    let posText = cell ? `Toạ độ: ${cell.x}, ${heightAt(terrain, cell.x, cell.z)}, ${cell.z}` : 'Toạ độ: -';
    if (cell && view.showCaves) {
      const ci = cell.z * terrain.size + cell.x, cf = terrain.caveFloor[ci], cm = terrain.caveMask[ci];
      if (cf !== NO_CAVE) posText += ` · hang đào: sàn y=${cf}, cao ${terrain.caveHeight[ci]}`;
      if (cm & 1) posText += ' · vùng hang tự sinh';
      if (cm & 2) posText += ' · cửa hang';
    }
    $('st-pos').textContent = posText;
    refreshStatus();
  }
  requestAnimationFrame(frame);
}

// ---- Map mới ----
$('btn-new').addEventListener('click', () => { $('new-biome').value = terrain.baseBiome; $('dlg-new').showModal(); });
$('dlg-new').addEventListener('close', () => {
  if ($('dlg-new').returnValue !== 'ok') return;
  const h = Math.min(250, Math.max(-50, Number($('new-height').value) || 64));
  setTerrain(createTerrain({ size: Number($('new-size').value), baseHeight: h, baseBiome: $('new-biome').value }));
  message('Đã tạo map mới');
});
function setTerrain(t) {
  terrain = t; view.setTerrain(t);
  state.undo.length = 0; state.redo.length = 0;
  propGrid = null; window.__refreshScenario?.(); syncRuleSliders(); refreshStructures(); refreshStatus(); refreshMobTotal(); refreshPropTotal();
}

// ---- Lưu / mở ----
/** Dữ liệu dự án kèm nội dung các file schem đang dùng, để dự án tự đủ. */
function packProject() {
  const p = packTerrain(terrain);
  const schems = {};
  for (const pl of terrain.placements) if (library.has(pl.name)) schems[pl.name] = library.get(pl.name).raw;
  return { ...p, schems };
}
async function saveProject() {
  if (!api) return message('Chỉ lưu được trong chương trình .exe', true);
  const { meta, layers, schems } = packProject();
  for (const [name, raw] of Object.entries(schems)) layers['schem:' + name] = raw;
  const r = await api.saveProject({ meta, layers });
  if (r.error) message(r.error, true); else if (r.file) message('Đã lưu: ' + r.file);
}
$('btn-save').addEventListener('click', saveProject);
$('btn-open').addEventListener('click', async () => {
  if (!api) return message('Chỉ mở được trong chương trình .exe', true);
  const r = await api.openProject();
  if (r.error) return message(r.error, true);
  if (!r.meta) return;
  try {
    const t = unpackTerrain(r);
    for (const [name, s] of Object.entries(r.schems ?? {})) addToLibrary(name, s.raw, s.schem);
    setTerrain(t); message('Đã mở: ' + r.file);
  } catch (err) { message(err.message, true); }
});

// ---- Kịch bản: 8 ô người chơi ----
const script = initScriptUi({ $, getTerrain: () => terrain, changed: () => { state.dirty = true; }, focusZone: (z) => focusOn((z.x0 + z.x1 + 1) / 2, (z.z0 + z.z1 + 1) / 2) });
(() => {
  const slotSel = $('mob-slot');
  slotSel.add(new Option('Gaia (trung lập)', '0'));
  for (let i = 1; i <= MAX_PLAYERS; i++) slotSel.add(new Option('Người chơi ' + i, String(i)));
  const box = $('sc-players');
  const mk = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const sel = (opts, val, on) => { const s = mk('select'); for (const [v, n] of opts) s.add(new Option(n, v)); s.value = val; s.addEventListener('change', () => on(s.value)); return s; };
  const touch = () => { state.dirty = true; refreshScenarioWarn(); };
  window.__refreshScenario = () => {
    script.render();
    const sc = terrain.scenario; $('sc-name').value = sc.name; $('sc-fog').checked = sc.fog; box.textContent = '';
    sc.players.forEach((p, i) => {
      const act = mk('input', { type: 'checkbox', checked: p.active, title: 'Bật ô này để người chơi hoặc máy dùng nó.' });
      act.addEventListener('change', () => { p.active = act.checked; card.classList.toggle('off', !p.active); touch(); });
      const dot = mk('i'); dot.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:50%;background:${COLORS.find((c) => c[0] === p.color)[2]}`;
      const col = sel(COLORS.map((c) => [c[0], c[1]]), p.color, (v) => { p.color = v; dot.style.background = COLORS.find((c) => c[0] === v)[2]; touch(); });
      const civ = sel(CIVS, p.civ, (v) => { p.civ = v; touch(); });
      const team = sel([['0', 'Không phe'], ...Array.from({ length: MAX_PLAYERS }, (_, k) => [String(k + 1), 'Phe ' + (k + 1)])], String(p.team), (v) => { p.team = Number(v); touch(); });
      const age = sel(AGES.map((n, k) => [String(k), n]), String(p.age), (v) => { p.age = Number(v); touch(); });
      const res = ['food', 'wood', 'gold', 'stone'].map((k) => {
        const n = mk('input', { type: 'number', min: 0, max: 99999, value: p[k], title: { food: 'Thức ăn', wood: 'Gỗ', gold: 'Vàng', stone: 'Đá' }[k] + ' lúc bắt đầu', style: 'width:54px' });
        n.addEventListener('change', () => { p[k] = Math.min(99999, Math.max(0, Math.round(Number(n.value) || 0))); n.value = p[k]; touch(); });
        return n;
      });
      const card = mk('div', { className: 'pcard' + (p.active ? '' : ' off') }, [
        mk('div', { className: 'btnrow' }, [act, dot, mk('b', { textContent: 'Người chơi ' + (i + 1) }), col]),
        mk('div', { className: 'btnrow' }, [civ, team]),
        mk('div', { className: 'btnrow' }, [age, ...res]),
      ]);
      card.style.cssText = 'border:1px solid #444;border-radius:6px;padding:4px;margin:4px 0';
      box.appendChild(card);
    });
    refreshScenarioWarn();
  };
  const refreshScenarioWarn = () => { $('sc-warn').textContent = scenarioWarnings(terrain.scenario, terrain.mobs).join(' '); };
  $('sc-name').addEventListener('change', () => { terrain.scenario.name = $('sc-name').value.trim() || 'Kịch bản mới'; state.dirty = true; });
  $('sc-fog').addEventListener('change', () => { terrain.scenario.fog = $('sc-fog').checked; state.dirty = true; });
  window.__refreshScenarioWarn = refreshScenarioWarn;
})();

// ---- Xuất world ----
$('btn-export').addEventListener('click', () => {
  $('exp-border').value = borderBox(terrain).size; $('exp-biome').value = terrain.baseBiome;
  $('dlg-export').showModal();
});
$('dlg-export').addEventListener('close', async () => {
  if ($('dlg-export').returnValue !== 'ok') return;
  if (!api) return message('Chỉ xuất được trong chương trình .exe', true);
  const name = $('exp-name').value.trim() || 'Map mới';
  terrain.baseBiome = $('exp-biome').value; state.dirty = true;
  message('Đang xuất world...');
  const r = await api.exportWorld({
    ...packProject(),
    options: { name, borderSize: Number($('exp-border').value) || terrain.size, mobSpawning: $('exp-mobs').checked, rim: $('exp-rim').value, rimWidth: Number($('exp-rim-width').value) || 96 },
  });
  if (r.error) message(r.error, true);
  else if (r.dir) message(`Đã xuất world sau ${r.seconds} giây: ${r.dir}` + (r.missing?.length ? ` (thiếu công trình: ${r.missing.join(', ')})` : ''), !!r.missing?.length);
  else message('Đã huỷ xuất');
});

// Cho script kiểm thử gọi vào.
window.__mmb = { toggle3D, get v3() { return v3; }, textures, digRamp, PROP_BY_KEY, selectProp, state, view, library, setBorder, borderBox, get terrain() { return terrain; }, setTool, applyBrush, packProject, selectMob };

setTool('raise');
refreshStatus();
showBig();
if (api) api.schemFolder(false).then(showSchemFolder);
window.__refreshScenario(); fillMobGroups(); describeMobSel(); refreshMobTotal();
if (api?.getMobPresets) api.getMobPresets().then((list) => { myMobs = Array.isArray(list) ? list : []; fillMobGroups($('mob-group').value); });
requestAnimationFrame(frame);
