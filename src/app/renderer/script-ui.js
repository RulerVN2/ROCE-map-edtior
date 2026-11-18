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
      case 'objstate': return sel([['add', 'Thêm mới'], ['done', 'Hoàn thành'], ['fail', 'Thất bại']], val, on, label);
      case 'result': return sel([['win', 'Thắng'], ['lose', 'Thua']], val, on, label);
      case 'trigger': return sel([['', '(chọn trigger)'], ...sc().triggers.map((t) => [t.id, t.name])], val, on, label);
      case 'team': { const t = txt(val, on, 'tên đội', 90, label); t.setAttribute('list', 'sc-teams'); return t; }
      case 'bool': { const c = mk('input', { type: 'checkbox', checked: !!val, title: label }); c.addEventListener('change', () => on(c.checked)); return c; }
      case 'int': return numIn(val, on, -999999, 999999, 70, label);
      default: return txt(val, on, label, kind === 'text' && label === 'Nội dung' ? 220 : 110, label);
    }
  }

  const nextId = (prefix, list) => { let i = 1; while (list.some((x) => x.id === prefix + i)) i++; return prefix + i; };

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
  function itemRow(item, schema, list, idx, rerender) {
    const typeSel = sel(Object.entries(schema).map(([k, v]) => [k, v.label]), item.type, (v) => {
      const def = { type: v };
      for (const [k, , , d] of schema[v].fields) def[k] = d;
      list[idx] = def; changed(); rerender();
    }, 'Loại');
    const fields = schema[item.type].fields.map(([k, label, kind]) => {
      const f = field(kind, item[k], (v) => { item[k] = v; changed(); if (kind === 'text' || kind === 'team') renderTriggers(); }, label);
      return label ? mk('label', { className: 'sc-f' }, [mk('small', { textContent: label }), f]) : f;
    });
    const del = mk('button', { textContent: '✕', title: 'Xoá dòng này', onclick: () => { list.splice(idx, 1); changed(); rerender(); } });
    return mk('div', { className: 'sc-item' }, [mk('div', { className: 'btnrow' }, [typeSel, del]), mk('div', { className: 'sc-fields' }, fields)]);
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
      const w = Math.min(window.innerWidth - 40, 1100), h = Math.min(window.innerHeight - 90, 640);
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
      list.appendChild(mk('div', { className: 'trg-row' + (x === t ? ' sel' : ''), onclick: () => { selId = x.id; rr(); } }, [en, mk('span', { textContent: x.name, className: x.enabled ? '' : 'off' }),
        mk('small', { textContent: `${x.conditions.length}đk · ${x.actions.length}hđ` })]));
    });
    const mv = (d) => { if (!t) return; const i = s.triggers.indexOf(t), j = i + d; if (j < 0 || j >= s.triggers.length) return; [s.triggers[i], s.triggers[j]] = [s.triggers[j], s.triggers[i]]; changed(); rr(); };
    const tools = mk('div', { className: 'trg-tools' }, [
      mk('button', { textContent: '+ Mới', onclick: () => { const id = nextId('t', s.triggers); s.triggers.push({ id, name: 'Trigger ' + id.slice(1), enabled: true, once: true, repeat: 0, any: false, diff: [true, true, true], conditions: [{ type: 'timer', seconds: 60 }], actions: [{ type: 'message', text: '' }] }); selId = id; changed(); warn(); rr(); } }),
      mk('button', { textContent: 'Nhân bản', title: 'Sao chép trigger đang chọn', onclick: () => { if (!t) return; const c = JSON.parse(JSON.stringify(t)); c.id = nextId('t', s.triggers); c.name = t.name + ' (bản sao)'; s.triggers.splice(s.triggers.indexOf(t) + 1, 0, c); selId = c.id; changed(); rr(); } }),
      mk('button', { textContent: '↑', title: 'Đưa lên', onclick: () => mv(-1) }), mk('button', { textContent: '↓', title: 'Đưa xuống', onclick: () => mv(1) }),
      mk('button', { textContent: 'Xoá', title: 'Xoá trigger đang chọn', onclick: () => { if (!t) return; const i = s.triggers.indexOf(t); s.triggers.splice(i, 1); selId = s.triggers[Math.min(i, s.triggers.length - 1)]?.id ?? null; changed(); warn(); rr(); } }),
    ]);
    const left = mk('div', { className: 'trg-left' }, [tools, list]);

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
        mk('div', { className: 'trg-colhead' }, [mk('b', { textContent: 'Điều kiện' }), sel([['all', 'TẤT CẢ đúng'], ['any', 'MỘT TRONG đúng']], t.any ? 'any' : 'all', (v) => { t.any = v === 'any'; changed(); }, 'Cách kết hợp các điều kiện')]),
        mk('div', { className: 'trg-scroll trg-items' }, [
          ...t.conditions.map((c, i) => itemRow(c, COND_TYPES, t.conditions, i, rr)),
          ...(t.conditions.length ? [] : [mk('p', { className: 'empty', textContent: 'Không có điều kiện: trigger chạy ngay khi ván bắt đầu.' })])]),
        mk('button', { className: 'wide', textContent: '+ Điều kiện', onclick: () => { t.conditions.push({ type: 'timer', seconds: 60 }); changed(); rr(); } }),
      ]);
      const act = mk('div', { className: 'trg-col' }, [
        mk('div', { className: 'trg-colhead' }, [mk('b', { textContent: 'Hành động' })]),
        mk('div', { className: 'trg-scroll trg-items' }, t.actions.map((a, i) => itemRow(a, ACT_TYPES, t.actions, i, rr))),
        mk('button', { className: 'wide', textContent: '+ Hành động', onclick: () => { t.actions.push({ type: 'message', text: '' }); changed(); rr(); } }),
      ]);
      right = mk('div', { className: 'trg-right' }, [flags, mk('div', { className: 'trg-cols' }, [cond, act])]);
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
    renderZones(); renderTfs(); renderAi(); renderTriggers(); warn();
  }

  $('sc-diff').addEventListener('change', () => { sc().difficulty = Number($('sc-diff').value); changed(); });
  $('tf-add').addEventListener('click', () => { const s = sc(); const id = nextId('tf', s.taskforces); s.taskforces.push({ id, name: 'Đội ' + id.slice(2), units: [{ unit: 'militia', count: 5 }] }); changed(); render(); });
  $('trg-add').addEventListener('click', () => { const s = sc(); const id = nextId('t', s.triggers); s.triggers.push({ id, name: 'Trigger ' + id.slice(1), enabled: true, once: true, repeat: 0, any: false, diff: [true, true, true], conditions: [{ type: 'timer', seconds: 60 }], actions: [{ type: 'message', text: '' }] }); changed(); openTrigWin(id); warn(); });
  $('trg-open').addEventListener('click', () => openTrigWin());
  $('sc-diff').textContent = '';
  DIFFICULTIES.forEach((n, i) => $('sc-diff').add(new Option(n, String(i))));

  return { render, warn, nextId, closeTrigWin };
}
