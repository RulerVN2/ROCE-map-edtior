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
  const unitList = () => [['any', 'Mọi quân'], ['villager', 'Dân làng'], ['military', 'Mọi lính'], ...MOD_UNITS.filter((u) => u[0] !== 'villager')];

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

  function renderTriggers() {
    const box = $('trg-list'); box.textContent = '';
    const dl = $('sc-teams'); dl.textContent = '';
    for (const t of teamLabels()) dl.appendChild(mk('option', { value: t }));
    const s = sc();
    for (const t of s.triggers) {
      const rr = () => renderTriggers();
      const head = mk('summary', {}, [mk('span', { textContent: (t.enabled ? '' : '⏸ ') + t.name })]);
      const body = mk('div', { className: 'sc-body' }, [
        mk('div', { className: 'btnrow' }, [
          txt(t.name, (v) => { t.name = v || t.id; changed(); head.firstChild.textContent = (t.enabled ? '' : '⏸ ') + t.name; }, 'tên trigger', 150),
          mk('button', { textContent: '✕', title: 'Xoá trigger', onclick: () => { s.triggers.splice(s.triggers.indexOf(t), 1); changed(); renderTriggers(); } }),
        ]),
        mk('div', { className: 'sc-flags' }, [
          mk('label', { className: 'check', title: 'Tắt: trigger không chạy cho tới khi trigger khác bật nó.' }, [Object.assign(mk('input', { type: 'checkbox', checked: t.enabled }), { onchange: (e) => { t.enabled = e.target.checked; changed(); rr(); } }), document.createTextNode(' Bật sẵn')]),
          mk('label', { className: 'check', title: 'Bật: chạy đúng một lần. Tắt: chạy lặp lại.' }, [Object.assign(mk('input', { type: 'checkbox', checked: t.once }), { onchange: (e) => { t.once = e.target.checked; changed(); rr(); } }), document.createTextNode(' Chạy một lần')]),
          ...(t.once ? [] : [mk('label', { className: 'check', title: 'Khoảng cách tối thiểu giữa hai lần chạy (giây).' }, [document.createTextNode('mỗi '), numIn(t.repeat, (v) => { t.repeat = v; changed(); }, 0, 86400, 56), document.createTextNode(' giây')])]),
        ]),
        mk('div', { className: 'btnrow' }, DIFFICULTIES.map((n, k) => {
          const c = mk('input', { type: 'checkbox', checked: t.diff[k] });
          c.addEventListener('change', () => { t.diff[k] = c.checked; changed(); });
          return mk('label', { className: 'check', title: `Trigger có chạy ở độ khó ${n} không.` }, [c, document.createTextNode(' ' + n)]);
        })),
        mk('h5', { textContent: 'Điều kiện' }),
        mk('label', { className: 'check', title: 'Tất cả: mọi điều kiện đều đúng. Một trong: chỉ cần một điều kiện đúng.' }, [
          sel([['all', 'Khi TẤT CẢ đúng'], ['any', 'Khi MỘT TRONG đúng']], t.any ? 'any' : 'all', (v) => { t.any = v === 'any'; changed(); })]),
        ...t.conditions.map((c, i) => itemRow(c, COND_TYPES, t.conditions, i, rr)),
        mk('button', { className: 'wide', textContent: '+ Điều kiện', onclick: () => { t.conditions.push({ type: 'timer', seconds: 60 }); changed(); rr(); } }),
        ...(t.conditions.length ? [] : [mk('p', { className: 'empty', textContent: 'Không có điều kiện: trigger chạy ngay khi ván bắt đầu.' })]),
        mk('h5', { textContent: 'Hành động' }),
        ...t.actions.map((a, i) => itemRow(a, ACT_TYPES, t.actions, i, rr)),
        mk('button', { className: 'wide', textContent: '+ Hành động', onclick: () => { t.actions.push({ type: 'message', text: '' }); changed(); rr(); } }),
      ]);
      const det = mk('details', { className: 'sc-trg' }, [head, body]);
      det.open = !!t._open;
      det.addEventListener('toggle', () => { t._open = det.open; });
      box.appendChild(det);
    }
    if (!s.triggers.length) box.appendChild(mk('p', { className: 'empty', textContent: 'Chưa có trigger nào.' }));
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
  $('trg-add').addEventListener('click', () => { const s = sc(); const id = nextId('t', s.triggers); s.triggers.push({ id, name: 'Trigger ' + id.slice(1), enabled: true, once: true, repeat: 0, any: false, diff: [true, true, true], conditions: [{ type: 'timer', seconds: 60 }], actions: [{ type: 'message', text: '' }], _open: true }); changed(); renderTriggers(); warn(); });
  $('sc-diff').textContent = '';
  DIFFICULTIES.forEach((n, i) => $('sc-diff').add(new Option(n, String(i))));

  return { render, warn, nextId };
}
