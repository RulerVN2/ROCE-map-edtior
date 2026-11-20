// Tab [Kịch bản]: vùng, đội quân (TaskForce), AI cho ô không người chơi, và trigger (điều kiện → hành động).
// Mọi dữ liệu nằm trong terrain.scenario (xem core/scenario.js); module này chỉ dựng giao diện và sửa trực tiếp dữ liệu đó.
import { ACT_TYPES, BUILDINGS, COND_TYPES, DIFFICULTIES, MAX_PLAYERS, MOD_UNITS, OPS, ORDERS, RES, scenarioWarnings } from '../../core/scenario.js';

export function initScriptUi({ $, getTerrain, changed, focusZone }) {
  const sc = () => getTerrain().scenario;
  const mk = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const opt = (list) => list.map((o) => (Array.isArray(o) ? o : [o, o]));
  const sel = (list, val, on, title) => {
    const s = mk('select', { title: title ?? '' });
    for (const [v, n] of opt(list)) s.add(new Option(n, String(v)));
    s.value = String(val);
    if (s.value !== String(val) && s.options.length) { /* giá trị cũ không còn trong danh sách: giữ nguyên dữ liệu, hiển thị ô đầu */ }
    s.addEventListener('change', () => on(s.value));
    return s;
  };
  const numIn = (val, on, min = -999999, max = 999999, w = 62, title = '') => {
    const n = mk('input', { type: 'number', value: val, min, max, title });
    n.style.width = w + 'px';
    n.addEventListener('change', () => { const v = Math.min(max, Math.max(min, Math.round(Number(n.value) || 0))); n.value = v; on(v); });
    return n;
  };
  const txt = (val, on, ph = '', w = 110, title = '') => {
    const t = mk('input', { type: 'text', value: val, placeholder: ph, title });
    t.style.width = w + 'px';
    t.addEventListener('change', () => on(t.value.trim()));
    return t;
  };
  const card = (...kids) => { const c = mk('div', { className: 'sc-card' }, kids); return c; };
  const slotList = (zero) => [...(zero ? [[0, 'Gaia']] : []), ...Array.from({ length: MAX_PLAYERS }, (_, i) => [i + 1, 'Ô ' + (i + 1)])];
  const unitList = () => [['any', 'Mọi quân'], ['villager', 'Villager'], ['military', 'Mọi lính'], ...MOD_UNITS.filter((u) => u[0] !== 'villager')];

  const teamLabels = () => {
    const out = new Set();
    for (const t of sc().triggers) for (const a of t.actions) if (a.type === 'createTeam' && a.team) out.add(a.team);
    return [...out];
  };

  function field(kind, val, on, label) {
    switch (kind) {
      case 'slot': return sel(slotList(false), val, (v) => on(Number(v)), label);
      case 'slot0': return sel(slotList(true), val, (v) => on(Number(v)), label);
      case 'zone': return sel([['', '(chọn vùng)'], ...sc().zones.map((z) => [z.id, z.name])], val, on, label);
      case 'zone?': return sel([['', '(không chọn)'], ...sc().zones.map((z) => [z.id, z.name])], val, on, label);
      case 'taskforce': return sel([['', '(chọn đội mẫu)'], ...sc().taskforces.map((t) => [t.id, t.name])], val, on, label);
      case 'unit': return sel(unitList(), val, on, label);
      case 'building*': return sel([['any', 'Mọi công trình'], ...BUILDINGS], val, on, label);
      case 'building': return sel(BUILDINGS, val, on, label);
      case 'res': return sel(RES, val, on, label);
      case 'op': return sel(OPS, val, on, label);
      case 'opset': return sel([['set', 'Đặt bằng'], ['add', 'Cộng thêm']], val, on, label);
      case 'trigop': return sel([['enable', 'Bật'], ['disable', 'Tắt'], ['run', 'Chạy hành động']], val, on, label);
      case 'stance': return sel([['enemy', 'Kẻ địch'], ['ally', 'Đồng minh'], ['neutral', 'Trung lập']], val, on, label);
      case 'order': return sel(ORDERS, val, on, label);
      case 'what': return sel([['any', 'Quân hoặc công trình'], ['unit', 'Quân'], ['building', 'Công trình']], val, on, label);
      case 'objstate': return sel([['show', 'Hiện lên'], ['done', 'Hoàn thành (gạch)'], ['fail', 'Thất bại'], ['hide', 'Ẩn (biến mất)']], val, on, label);
      case 'objis': return sel([['done', 'Đã hoàn thành'], ['active', 'Đang hiện (chưa xong)'], ['fail', 'Thất bại'], ['hidden', 'Đang ẩn']], val, on, label);
      case 'objective': return sel([['', '(chọn mục tiêu)'], ...sc().objectives.map((o) => [o.id, o.text])], val, on, label);
      case 'result': return sel([['win', 'Thắng'], ['lose', 'Thua']], val, on, label);
      case 'trigger': return sel([['', '(chọn trigger)'], ...sc().triggers.map((t) => [t.id, t.name])], val, on, label);
      case 'team': { const t = txt(val, on, 'tên đội', 90, label); t.setAttribute('list', 'sc-teams'); return t; }
      case 'age': return sel([[0, 'Dark Age'], [1, 'Feudal Age'], [2, 'Castle Age'], [3, 'Imperial Age']], val, (v) => on(Number(v)), label);
      case 'sound': return sel([['horn', 'Kèn hiệu (raid horn)'], ['bell', 'Chuông'], ['growl', 'Tiếng gầm']], val, on, label);
      case 'aistance': return sel([['aggressive', 'Hung hăng (tự đuổi đánh)'], ['defensive', 'Phòng thủ'], ['passive', 'Không đánh trả']], val, on, label);
      case 'tech': return txt(val, on, 'vd: feudal_age', 130, label);
      case 'bool': { const c = mk('input', { type: 'checkbox', checked: !!val, title: label }); c.addEventListener('change', () => on(c.checked)); return c; }
      case 'int': return numIn(val, on, -999999, 999999, 70, label);
      default: return txt(val, on, label, kind === 'text' && label === 'Nội dung' ? 220 : 110, label);
    }
  }

  const nextId = (prefix, list) => { let i = 1; while (list.some((x) => x.id === prefix + i)) i++; return prefix + i; };

  // ---- Mục tiêu (hiện ở HUD trong game, như AoE2) ----
  function renderObjectives() {
    const box = $('obj-list'); box.textContent = '';
    const list = sc().objectives;
    // Xem trước đúng kiểu HUD: chỉ mục tiêu "hiện từ đầu"; dòng thứ hai minh hoạ mục tiêu đã xong bị gạch.
    const pv = $('obj-preview'); pv.textContent = '';
    pv.appendChild(mk('div', { className: 'obj-title', textContent: 'Mục tiêu' }));
    const shown = list.filter((o) => o.shown);
    for (const o of shown) pv.appendChild(mk('div', { className: 'obj-line', textContent: '• ' + (o.text || o.id) + (o.goal > 0 ? ` (0/${o.goal})` : '') }));
    if (!shown.length) pv.appendChild(mk('div', { className: 'obj-line obj-dim', textContent: '(không có mục tiêu nào hiện từ đầu)' }));
    pv.appendChild(mk('div', { className: 'obj-legend', textContent: 'Xem trước HUD góc trên phải. Hoàn thành → chữ bị gạch ✔. Ẩn → biến mất. Mục tiêu không "hiện từ đầu" xuất hiện khi trigger bật.' }));
    list.forEach((o, i) => {
      const move = (d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; changed(); renderObjectives(); };
      box.appendChild(card(
        mk('div', { className: 'btnrow' }, [
          txt(o.text, (v) => { o.text = v || o.id; changed(); renderObjectives(); renderTriggers(); }, 'nội dung mục tiêu', 190, 'Chữ hiện trong game'),
          mk('button', { textContent: '↑', disabled: i === 0, onclick: () => move(-1) }), mk('button', { textContent: '↓', disabled: i === list.length - 1, onclick: () => move(1) }),
          mk('button', { textContent: '✕', title: 'Xoá mục tiêu (trigger đang dùng nó sẽ báo lỗi)', onclick: () => { list.splice(i, 1); changed(); render(); } }),
        ]),
        mk('div', { className: 'btnrow' }, [
          mk('label', { className: 'check', title: 'Bật: hiện ngay từ đầu ván. Tắt: ẩn cho tới khi trigger "Hiện mục tiêu".' }, [Object.assign(mk('input', { type: 'checkbox', checked: o.shown }), { onchange: (e) => { o.shown = e.target.checked; changed(); renderObjectives(); } }), document.createTextNode(' Hiện từ đầu')]),
          mk('small', { textContent: 'Đếm', style: 'align-self:center', title: 'Tuỳ chọn: tự hoàn thành khi cờ đạt đích, ví dụ kills_1 = số địch Ô 1 đã hạ' }),
          txt(o.flag, (v) => { o.flag = v; changed(); }, 'cờ vd kills_1', 90, 'Tên cờ đếm tiến độ'),
          numIn(o.goal, (v) => { o.goal = v; changed(); renderObjectives(); }, 0, 999999, 56, 'Đích (0 = không đếm)'),
        ]),
      ));
    });
    if (!list.length) box.appendChild(mk('p', { className: 'empty', textContent: 'Chưa có mục tiêu. Bấm "+ Thêm mục tiêu", rồi dùng trigger để hiện / hoàn thành / ẩn.' }));
  }

  // ---- Vùng ----
  function renderZones() {
    const box = $('zone-list'); box.textContent = '';
    for (const z of sc().zones) {
      box.appendChild(card(mk('div', { className: 'btnrow' }, [
        txt(z.name, (v) => { z.name = v || z.id; changed(); renderTriggers(); }, 'tên vùng', 120),
        mk('small', { textContent: `${z.x0},${z.z0} → ${z.x1},${z.z1}`, style: 'white-space:nowrap;align-self:center' }),
        mk('button', { textContent: '⌖', title: 'Nhảy tới vùng này trên map', onclick: () => focusZone?.(z) }),
        mk('button', { textContent: '✕', title: 'Xoá vùng (các trigger đang dùng vùng này sẽ báo lỗi)', onclick: () => { sc().zones.splice(sc().zones.indexOf(z), 1); changed(); render(); } }),
      ])));
    }
    if (!sc().zones.length) box.appendChild(mk('p', { className: 'empty', textContent: 'Chưa có vùng nào. Chọn công cụ [Vùng] bên trái rồi kéo chuột trên map.' }));
  }

  // ---- Đội quân ----
  function renderTfs() {
    const box = $('tf-list'); box.textContent = '';
    for (const tf of sc().taskforces) {
      const rows = tf.units.map((u, i) => mk('div', { className: 'btnrow' }, [
        sel(MOD_UNITS, u.unit, (v) => { u.unit = v; changed(); }, 'Loại quân'),
        numIn(u.count, (v) => { u.count = v; changed(); }, 1, 200, 56, 'Số lượng'),
        mk('button', { textContent: '✕', onclick: () => { tf.units.splice(i, 1); changed(); renderTfs(); } }),
      ]));
      box.appendChild(card(
        mk('div', { className: 'btnrow' }, [
          txt(tf.name, (v) => { tf.name = v || tf.id; changed(); renderTriggers(); }, 'tên đội', 130),
          mk('button', { textContent: '✕', title: 'Xoá đội mẫu này', onclick: () => { sc().taskforces.splice(sc().taskforces.indexOf(tf), 1); changed(); render(); } }),
        ]),
        ...rows,
        mk('button', { className: 'wide', textContent: '+ Thêm loại quân', onclick: () => { tf.units.push({ unit: 'militia', count: 5 }); changed(); renderTfs(); } }),
      ));
    }
    if (!sc().taskforces.length) box.appendChild(mk('p', { className: 'empty', textContent: 'Chưa có đội mẫu. Một đội mẫu là danh sách "loại quân × số lượng"; trigger sẽ lập đội này (tốn tài nguyên và dân số).' }));
  }

  // ---- AI cho từng ô ----
  function renderAi() {
    const box = $('ai-list'); box.textContent = '';
    const s = sc();
    s.players.forEach((p, i) => {
      const a = s.ai[i];
      const sum = a.jobs.food + a.jobs.wood + a.jobs.gold + a.jobs.stone;
      const en = mk('input', { type: 'checkbox', checked: a.enabled, title: 'AI điều khiển kinh tế của ô này khi không có người chơi ngồi vào.' });
      en.addEventListener('change', () => { a.enabled = en.checked; changed(); renderAi(); });
      const jobs = RES.map(([k, n]) => numIn(a.jobs[k], (v) => { a.jobs[k] = v; changed(); renderAi(); }, 0, 100, 48, `Tỉ trọng dân ${n.toLowerCase()}`));
      const cheat = mk('input', { type: 'checkbox', checked: a.cheat, title: 'Cheat: mỗi phút tự cộng thêm tài nguyên cho AI. Có thể bật/tắt giữa ván bằng trigger.' });
      cheat.addEventListener('change', () => { a.cheat = cheat.checked; changed(); });
      const c = card(
        mk('div', { className: 'btnrow' }, [en, mk('b', { textContent: 'Ô ' + (i + 1) + (p.active ? '' : ' (tắt)'), style: 'align-self:center' })]),
        ...(a.enabled ? [
          mk('div', { className: 'btnrow' }, [mk('small', { textContent: 'Dân làm việc ăn/gỗ/vàng/đá (tỉ trọng):', style: 'align-self:center' })]),
          mk('div', { className: 'btnrow' }, jobs),
          mk('small', { className: 'empty', textContent: sum > 0 ? `Tỉ lệ: ${RES.map(([k, n]) => `${n} ${Math.round(100 * a.jobs[k] / sum)}%`).join(' · ')}` : 'Tổng tỉ trọng đang là 0: dân sẽ đứng yên.' }),
          mk('div', { className: 'btnrow' }, [mk('label', { className: 'check' }, [cheat, document.createTextNode(' Cheat tài nguyên')]), numIn(a.cheatRate, (v) => { a.cheatRate = v; changed(); }, 0, 10000, 62, 'Mỗi loại tài nguyên mỗi phút'), mk('small', { textContent: '/loại/phút', style: 'align-self:center' })]),
          mk('div', { className: 'btnrow' }, [mk('small', { textContent: 'Thợ xây mỗi công trình:', style: 'align-self:center' }), numIn(a.builders, (v) => { a.builders = v; changed(); }, 1, 10, 52)]),
        ] : []),
      );
      box.appendChild(c);
    });
  }

  // ---- Trigger ----
  const CAT_COL = { 'Thời gian & biến': '#8f9bb3', 'Quân & công trình': '#d9a441', 'Kinh tế': '#e0b84f', 'Thời đại & tech': '#b07be0', 'Đội quân': '#4fae6b', 'AI & kinh tế': '#4a90d9', 'Thế giới': '#d9704a', 'Thông báo': '#d96a9a' };
  const AGES = ['Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];
  const nameOf = (list, v) => { const f = opt(list).find(([k]) => String(k) === String(v)); return f ? f[1] : String(v); };
  // Chữ hiển thị của một giá trị theo kiểu trường (dùng cho câu tóm tắt một dòng).
  function disp(kind, v) {
    switch (kind) {
      case 'slot': case 'slot0': return v ? 'Ô ' + v : 'Gaia';
      case 'zone': case 'zone?': return v ? (sc().zones.find((z) => z.id === v)?.name ?? '⚠ vùng không tồn tại') : (kind === 'zone' ? '⚠ chưa chọn vùng' : 'không chọn vùng');
      case 'taskforce': return v ? (sc().taskforces.find((x) => x.id === v)?.name ?? '⚠ đội mẫu không tồn tại') : '⚠ chưa chọn đội mẫu';
      case 'unit': return nameOf(unitList(), v);
      case 'building': case 'building*': return v === 'any' ? 'mọi công trình' : nameOf(BUILDINGS, v);
      case 'res': return nameOf(RES, v).toLowerCase();
      case 'objective': return v ? `“${sc().objectives.find((o) => o.id === v)?.text ?? '⚠ mục tiêu không tồn tại'}”` : '⚠ chưa chọn mục tiêu';
      case 'trigger': return v ? (sc().triggers.find((x) => x.id === v)?.name ?? '⚠ trigger không tồn tại') : '⚠ chưa chọn trigger';
      case 'team': return v ? `“${v}”` : '⚠ chưa đặt tên đội';
      case 'order': return nameOf(ORDERS, v).toLowerCase();
      case 'age': return AGES[v] ?? String(v);
      case 'what': return nameOf([['any', 'quân hoặc công trình'], ['unit', 'quân'], ['building', 'công trình']], v);
      case 'tech': return v ? `“${v}”` : '⚠ chưa nhập mã';
      default: return String(v);
    }
  }
  const SAY = {
    // điều kiện
    timer: (g, i) => `Đã qua ${i.seconds} giây (${Math.floor(i.seconds / 60)}:${String(i.seconds % 60).padStart(2, '0')})`,
    unitCount: (g, i) => `${g('slot')} có ${i.op} ${i.n} ${g('unit')}`,
    buildingCount: (g, i) => `${g('slot')} có ${i.op} ${i.n} ${g('building')}`,
    inZone: (g, i) => `${i.op} ${i.n} quân của ${g('slot')} đang ở ${g('zone')}`,
    detect: (g) => `${g('viewer')} nhìn thấy ${g('what')} của ${g('target')}`,
    resource: (g, i) => `${g('slot')} có ${i.op} ${i.n} ${g('res')}`,
    flag: (g, i) => `Cờ “${i.name}” ${i.op} ${i.n}`,
    ageReached: (g, i) => `${g('slot')} ${i.op} ${g('n')}`,
    techDone: (g) => `${g('slot')} đã nghiên cứu ${g('tech')}`,
    population: (g, i) => `Dân số ${g('slot')} ${i.op} ${i.n}`,
    kills: (g, i) => `${g('slot')} đã hạ ${i.op} ${i.n} địch`,
    teamCount: (g, i) => `Đội ${g('team')} còn ${i.op} ${i.n} quân`,
    teamDead: (g) => `Đội ${g('team')} bị diệt hết`,
    // hành động
    createTeam: (g) => `${g('slot')} lập ${g('taskforce')}, tên ${g('team')}, ${g('zone') === 'không chọn vùng' ? 'cạnh Town Center' : 'tại ' + g('zone')}`,
    teamOrder: (g) => `Đội ${g('team')}: ${g('order')}${g('zone') === 'không chọn vùng' ? '' : ' → ' + g('zone')}`,
    aiJobs: (g, i) => `${g('slot')} chia dân: ăn ${i.food} · gỗ ${i.wood} · vàng ${i.gold} · đá ${i.stone}`,
    aiCheat: (g, i) => `${g('slot')} ${i.on ? 'BẬT' : 'TẮT'} cheat tài nguyên${i.on ? ` (${i.rate}/loại/phút)` : ''}`,
    aiBuild: (g) => `${g('slot')} đặt ${g('building')} trong ${g('zone')}`,
    giveRes: (g, i) => `${i.n >= 0 ? 'Cho' : 'Trừ'} ${g('slot')} ${Math.abs(i.n)} ${g('res')}`,
    diplomacy: (g, i) => `${g('a')} và ${g('b')} thành ${nameOf([['enemy', 'kẻ địch'], ['ally', 'đồng minh'], ['neutral', 'trung lập']], i.stance)}`,
    objective: (g, i) => `${nameOf([['show', 'Hiện mục tiêu'], ['done', 'Hoàn thành mục tiêu (gạch)'], ['fail', 'Thất bại mục tiêu'], ['hide', 'Ẩn mục tiêu']], i.state)} ${g('id')}`,
    objectiveIs: (g, i) => `Mục tiêu ${g('id')} ${nameOf([['done', 'đã hoàn thành'], ['active', 'đang hiện'], ['fail', 'thất bại'], ['hidden', 'đang ẩn']], i.state)}`,
    result: (g, i) => `${i.value === 'win' ? '🏆 THẮNG' : '💀 THUA'} kịch bản${i.text ? ` — “${i.text}”` : ''}`,
    message: (g, i) => `Hiện tin nhắn: “${i.text}”`,
    setFlag: (g, i) => `Cờ “${i.name}” ${i.op === 'add' ? '+=' : '='} ${i.n}`,
    trigger: (g, i) => `${nameOf([['enable', 'Bật'], ['disable', 'Tắt'], ['run', 'Chạy hành động của']], i.op)} ${g('id')}${i.op === 'run' && i.delay > 0 ? `, sau ${i.delay}s` : ''}`,
    setAge: (g) => `${g('slot')} lên ${g('age')}`,
    research: (g) => `${g('slot')} nhận công nghệ ${g('tech')}`,
    killTeam: (g) => `Diệt cả đội ${g('team')}`,
    setStance: (g, i) => `Đội ${g('team')} đổi thế đánh: ${nameOf([['aggressive', 'hung hăng'], ['defensive', 'phòng thủ'], ['passive', 'không đánh trả']], i.stance)}`,
    sound: (g, i) => `Phát âm thanh: ${nameOf([['horn', 'kèn hiệu'], ['bell', 'chuông'], ['growl', 'tiếng gầm']], i.sound)}`,
  };
  function describe(item, schema) {
    const def = schema[item.type];
    const kinds = Object.fromEntries(def.fields.map(([k, , kind]) => [k, kind]));
    const g = (k) => disp(kinds[k], item[k]);
    try { return (SAY[item.type] ?? (() => def.label))(g, item); } catch { return def.label; }
  }
  const openItems = new WeakSet();     // dòng đang mở rộng (xem / sửa chi tiết)

  function typeSelect(schema, cur, on) {
    const s = mk('select', { title: 'Loại' });
    const groups = new Map();
    for (const [k, v] of Object.entries(schema)) { if (!groups.has(v.cat)) groups.set(v.cat, mk('optgroup', { label: v.cat })); groups.get(v.cat).appendChild(new Option(v.label, k)); }
    for (const g of groups.values()) s.appendChild(g);
    s.value = cur;
    s.addEventListener('change', () => on(s.value));
    return s;
  }
  const freshItem = (type, schema) => { const o = { type }; for (const [k, , , d] of schema[type].fields) o[k] = d; return o; };

  function itemRow(item, schema, list, idx, rerender) {
    const def = schema[item.type];
    const isOpen = openItems.has(item);
    const col = CAT_COL[def.cat] ?? '#888';
    const move = (d) => { const j = idx + d; if (j < 0 || j >= list.length) return; [list[idx], list[j]] = [list[j], list[idx]]; changed(); rerender(); };
    const head = mk('div', { className: 'it-head', onclick: () => { if (isOpen) openItems.delete(item); else openItems.add(item); rerender(); } }, [
      mk('span', { className: 'it-chev', textContent: isOpen ? '▾' : '▸' }),
      mk('span', { className: 'it-cat', textContent: def.cat, style: `background:${col}22;color:${col};border-color:${col}66` }),
      mk('span', { className: 'it-say', textContent: describe(item, schema), title: describe(item, schema) }),
      mk('span', { className: 'it-btns' }, [
        mk('button', { textContent: '↑', title: 'Đưa lên', disabled: idx === 0, onclick: (e) => { e.stopPropagation(); move(-1); } }),
        mk('button', { textContent: '↓', title: 'Đưa xuống', disabled: idx === list.length - 1, onclick: (e) => { e.stopPropagation(); move(1); } }),
        mk('button', { textContent: '✕', title: 'Xoá dòng này', onclick: (e) => { e.stopPropagation(); list.splice(idx, 1); changed(); rerender(); } }),
      ]),
    ]);
    const kids = [head];
    if (isOpen) {
      const fields = def.fields.map(([k, label, kind]) => {
        const f = field(kind, item[k], (v) => { item[k] = v; changed(); head.querySelector('.it-say').textContent = describe(item, schema); head.querySelector('.it-say').title = describe(item, schema); if (kind === 'text' || kind === 'team') renderTriggers(); }, label);
        return label ? mk('label', { className: 'sc-f' }, [mk('small', { textContent: label }), f]) : f;
      });
      kids.push(mk('div', { className: 'it-body' }, [
        mk('label', { className: 'sc-f' }, [mk('small', { textContent: 'Loại' }), typeSelect(schema, item.type, (v) => { list[idx] = freshItem(v, schema); openItems.add(list[idx]); changed(); rerender(); })]),
        ...fields,
      ]));
    }
    return mk('div', { className: 'sc-item' + (isOpen ? ' open' : ''), style: `border-left-color:${col}` }, kids);
  }

  /** Nút "+ Thêm …": chọn loại ngay trong danh sách phân nhóm rồi mới thêm (không mặc định một loại rồi phải đổi). */
  function addPicker(schema, text, onAdd) {
    const s = mk('select', { className: 'it-add' });
    s.add(new Option(text, ''));
    const groups = new Map();
    for (const [k, v] of Object.entries(schema)) { if (!groups.has(v.cat)) groups.set(v.cat, mk('optgroup', { label: v.cat })); groups.get(v.cat).appendChild(new Option(v.label, k)); }
    for (const g of groups.values()) s.appendChild(g);
    s.addEventListener('change', () => { if (s.value) { const it = freshItem(s.value, schema); openItems.add(it); onAdd(it); } s.value = ''; });
    return s;
  }

  // ---- Trigger: danh sách gọn ở thanh bên + cửa sổ soạn riêng (kiểu FA2sp) ----
  let selId = null, win = null;
  const curTrg = () => sc().triggers.find((t) => t.id === selId) ?? null;
  const trgLabel = (t) => (t.enabled ? '' : '⏸ ') + t.name;

  function renderTriggers() {
    const box = $('trg-list'); box.textContent = '';
    const dl = $('sc-teams'); dl.textContent = '';
    for (const t of teamLabels()) dl.appendChild(mk('option', { value: t }));
    const s = sc();
    for (const t of s.triggers) {
      box.appendChild(mk('button', { className: 'trg-chip' + (t.id === selId && win ? ' sel' : ''), textContent: trgLabel(t), title: 'Mở trong cửa sổ soạn Trigger', onclick: () => openTrigWin(t.id) }));
    }
    if (!s.triggers.length) box.appendChild(mk('p', { className: 'empty', textContent: 'Chưa có trigger nào.' }));
    renderTrigWin();
  }

  function openTrigWin(id) {
    if (id) selId = id;
    if (!curTrg()) selId = sc().triggers[0]?.id ?? null;
    if (!win) {
      win = mk('div', { className: 'trg-win' });
      document.body.appendChild(win);
      const w = Math.min(window.innerWidth - 40, 1240), h = Math.min(window.innerHeight - 90, 760);
      Object.assign(win.style, { width: w + 'px', height: h + 'px', left: Math.max(10, (window.innerWidth - w) / 2) + 'px', top: '50px' });
    }
    win.hidden = false;
    renderTriggers();
  }
  function closeTrigWin() { if (win) { win.remove(); win = null; renderTriggers(); } }

  function renderTrigWin() {
    if (!win) return;
    const s = sc();
    if (!curTrg() && s.triggers.length) selId = s.triggers[0].id;
    const t = curTrg();
    const keep = [...win.querySelectorAll('.trg-scroll')].map((e) => e.scrollTop);
    win.textContent = '';
    const rr = () => renderTriggers();
    const bar = mk('div', { className: 'trg-bar' }, [mk('b', { textContent: 'Trình soạn Trigger' }), mk('small', { textContent: `${s.triggers.length} trigger`, style: 'margin-left:8px;color:#8a93a1' }), mk('span', { style: 'flex:1' }),
      mk('button', { textContent: '✕', title: 'Đóng cửa sổ (dữ liệu đã tự lưu vào map)', onclick: closeTrigWin })]);
    let dx = 0, dy = 0, drag = false;
    bar.addEventListener('pointerdown', (e) => { if (e.target.tagName === 'BUTTON') return; drag = true; dx = e.clientX - win.offsetLeft; dy = e.clientY - win.offsetTop; bar.setPointerCapture(e.pointerId); });
    bar.addEventListener('pointermove', (e) => { if (drag) { win.style.left = Math.max(0, e.clientX - dx) + 'px'; win.style.top = Math.max(0, e.clientY - dy) + 'px'; } });
    bar.addEventListener('pointerup', () => { drag = false; });

    // cột trái: danh sách
    const list = mk('div', { className: 'trg-scroll trg-listcol' });
    s.triggers.forEach((x) => {
      const en = mk('input', { type: 'checkbox', checked: x.enabled, title: 'Bật sẵn' });
      en.addEventListener('click', (e) => e.stopPropagation());
      en.addEventListener('change', () => { x.enabled = en.checked; changed(); rr(); });
      const row = mk('div', { className: 'trg-row' + (x === t ? ' sel' : ''), onclick: () => { selId = x.id; rr(); } }, [en,
        mk('div', { className: 'trg-rowtxt' }, [mk('span', { textContent: x.name, className: x.enabled ? '' : 'off' }),
          mk('small', { textContent: `${x.conditions.length ? `${x.conditions.length} điều kiện` : 'chạy ngay'} → ${x.actions.length} hành động${x.once ? '' : ' · ⟳ lặp'}` })])]);
      row.dataset.name = x.name.toLowerCase();
      list.appendChild(row);
    });
    const mv = (d) => { if (!t) return; const i = s.triggers.indexOf(t), j = i + d; if (j < 0 || j >= s.triggers.length) return; [s.triggers[i], s.triggers[j]] = [s.triggers[j], s.triggers[i]]; changed(); rr(); };
    const tools = mk('div', { className: 'trg-tools' }, [
      mk('button', { textContent: '+ Mới', onclick: () => { const id = nextId('t', s.triggers); s.triggers.push({ id, name: 'Trigger ' + id.slice(1), enabled: true, once: true, repeat: 0, any: false, diff: [true, true, true], conditions: [{ type: 'timer', seconds: 60 }], actions: [{ type: 'message', text: '' }] }); selId = id; changed(); warn(); rr(); } }),
      mk('button', { textContent: 'Nhân bản', title: 'Sao chép trigger đang chọn', onclick: () => { if (!t) return; const c = JSON.parse(JSON.stringify(t)); c.id = nextId('t', s.triggers); c.name = t.name + ' (bản sao)'; s.triggers.splice(s.triggers.indexOf(t) + 1, 0, c); selId = c.id; changed(); rr(); } }),
      mk('button', { textContent: '↑', title: 'Đưa lên', onclick: () => mv(-1) }), mk('button', { textContent: '↓', title: 'Đưa xuống', onclick: () => mv(1) }),
      mk('button', { textContent: 'Xoá', title: 'Xoá trigger đang chọn', onclick: () => { if (!t) return; const i = s.triggers.indexOf(t); s.triggers.splice(i, 1); selId = s.triggers[Math.min(i, s.triggers.length - 1)]?.id ?? null; changed(); warn(); rr(); } }),
    ]);
    const find = mk('input', { type: 'search', className: 'trg-find', placeholder: 'Tìm trigger…' });
    find.addEventListener('input', () => { const q = find.value.trim().toLowerCase(); list.querySelectorAll('.trg-row').forEach((r) => { r.hidden = !!q && !r.dataset.name.includes(q); }); });
    const left = mk('div', { className: 'trg-left' }, [tools, find, list]);

    // cột phải: thuộc tính + điều kiện | hành động
    let right;
    if (!t) right = mk('div', { className: 'trg-right' }, [mk('p', { className: 'empty', textContent: 'Chưa chọn trigger. Bấm "+ Mới" để thêm.' })]);
    else {
      const flags = mk('div', { className: 'sc-flags' }, [
        txt(t.name, (v) => { t.name = v || t.id; changed(); rr(); }, 'tên trigger', 240),
        mk('label', { className: 'check', title: 'Tắt: trigger không chạy cho tới khi trigger khác bật nó.' }, [Object.assign(mk('input', { type: 'checkbox', checked: t.enabled }), { onchange: (e) => { t.enabled = e.target.checked; changed(); rr(); } }), document.createTextNode(' Bật sẵn')]),
        mk('label', { className: 'check', title: 'Bật: chạy đúng một lần. Tắt: chạy lặp lại.' }, [Object.assign(mk('input', { type: 'checkbox', checked: t.once }), { onchange: (e) => { t.once = e.target.checked; changed(); rr(); } }), document.createTextNode(' Chạy một lần')]),
        ...(t.once ? [] : [mk('label', { className: 'check', title: 'Khoảng cách tối thiểu giữa hai lần chạy (giây).' }, [document.createTextNode('mỗi '), numIn(t.repeat, (v) => { t.repeat = v; changed(); }, 0, 86400, 56), document.createTextNode(' giây')])]),
        ...DIFFICULTIES.map((n, k) => { const c = mk('input', { type: 'checkbox', checked: t.diff[k] }); c.addEventListener('change', () => { t.diff[k] = c.checked; changed(); }); return mk('label', { className: 'check', title: `Chạy ở độ khó ${n}` }, [c, document.createTextNode(' ' + n)]); }),
      ]);
      const cond = mk('div', { className: 'trg-col' }, [
        mk('div', { className: 'trg-colhead' }, [mk('b', { textContent: '⚑ KHI (điều kiện)', style: 'color:#d9a441' }), sel([['all', 'TẤT CẢ đúng'], ['any', 'MỘT TRONG đúng']], t.any ? 'any' : 'all', (v) => { t.any = v === 'any'; changed(); }, 'Cách kết hợp các điều kiện')]),
        mk('div', { className: 'trg-scroll trg-items' }, [
          ...t.conditions.map((c, i) => itemRow(c, COND_TYPES, t.conditions, i, rr)),
          ...(t.conditions.length ? [] : [mk('p', { className: 'empty', textContent: 'Không có điều kiện: trigger chạy ngay khi ván bắt đầu.' })])]),
        addPicker(COND_TYPES, '＋ Thêm điều kiện…', (it) => { t.conditions.push(it); changed(); rr(); }),
      ]);
      const act = mk('div', { className: 'trg-col' }, [
        mk('div', { className: 'trg-colhead' }, [mk('b', { textContent: '▶ THÌ (hành động)', style: 'color:#4fae6b' }), mk('small', { textContent: 'chạy lần lượt từ trên xuống', style: 'color:#8a93a1' })]),
        mk('div', { className: 'trg-scroll trg-items' }, t.actions.map((a, i) => itemRow(a, ACT_TYPES, t.actions, i, rr))),
        addPicker(ACT_TYPES, '＋ Thêm hành động…', (it) => { t.actions.push(it); changed(); rr(); }),
      ]);
      const sentence = `${t.conditions.length ? `Khi ${t.any ? 'MỘT TRONG' : 'TẤT CẢ'} ${t.conditions.length} điều kiện đúng` : 'Ngay khi ván bắt đầu'} → chạy ${t.actions.length} hành động · ${t.once ? 'một lần' : `lặp lại${t.repeat ? ` (mỗi ${t.repeat}s)` : ' mỗi giây'}`}${t.enabled ? '' : ' · ĐANG TẮT, chờ trigger khác bật'}`;
      right = mk('div', { className: 'trg-right' }, [flags, mk('div', { className: 'trg-sentence', textContent: sentence }), mk('div', { className: 'trg-cols' }, [cond, act])]);
    }
    win.append(bar, mk('div', { className: 'trg-body' }, [left, right]));
    win.querySelectorAll('.trg-scroll').forEach((e, i) => { if (keep[i] != null) e.scrollTop = keep[i]; });
  }

  function warn() {
    const t = getTerrain();
    const w = scenarioWarnings(t.scenario, t.mobs);
    $('script-warn').textContent = w.length ? '⚠ ' + w.join('\n⚠ ') : '';
  }

  function render() {
    $('sc-diff').value = String(sc().difficulty);
    renderObjectives(); renderZones(); renderTfs(); renderAi(); renderTriggers(); warn();
  }

  $('sc-diff').addEventListener('change', () => { sc().difficulty = Number($('sc-diff').value); changed(); });
  $('obj-add').addEventListener('click', () => { const s = sc(); const id = nextId('m', s.objectives); s.objectives.push({ id, text: 'Mục tiêu ' + id.slice(1), shown: true, goal: 0, flag: '' }); changed(); render(); });
  $('tf-add').addEventListener('click', () => { const s = sc(); const id = nextId('tf', s.taskforces); s.taskforces.push({ id, name: 'Đội ' + id.slice(2), units: [{ unit: 'militia', count: 5 }] }); changed(); render(); });
  $('trg-add').addEventListener('click', () => { const s = sc(); const id = nextId('t', s.triggers); s.triggers.push({ id, name: 'Trigger ' + id.slice(1), enabled: true, once: true, repeat: 0, any: false, diff: [true, true, true], conditions: [{ type: 'timer', seconds: 60 }], actions: [{ type: 'message', text: '' }] }); changed(); openTrigWin(id); warn(); });
  $('trg-open').addEventListener('click', () => openTrigWin());
  $('sc-diff').textContent = '';
  DIFFICULTIES.forEach((n, i) => $('sc-diff').add(new Option(n, String(i))));

  return { render, warn, nextId, closeTrigWin };
}
