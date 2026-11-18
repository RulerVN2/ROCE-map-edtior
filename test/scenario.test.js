import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultScenario, normalizeScenario, scenarioJson, scenarioWarnings, MOD_UNITS, MAX_PLAYERS } from '../src/core/scenario.js';
import { makeMob, mobsToEntities, MOB_CATALOG, checkMobSpec, mobStyle } from '../src/core/mobs.js';
import { createTerrain, packTerrain, unpackTerrain } from '../src/core/terrain.js';

test('kịch bản mặc định: 8 ô, 2 ô bật, sương mù bật', () => {
  const s = defaultScenario();
  assert.equal(s.players.length, MAX_PLAYERS);
  assert.equal(s.players.filter((p) => p.active).length, 2);
  assert.equal(s.fog, true);
});

test('normalizeScenario sửa dữ liệu hỏng', () => {
  const s = normalizeScenario({ fog: false, players: [{ active: true, civ: 'nope', color: 'red', team: 99, food: -5, wood: 'x', age: 9 }] });
  assert.equal(s.fog, false);
  assert.equal(s.players[0].civ, 'britons');
  assert.equal(s.players[0].color, 'red');
  assert.equal(s.players[0].team, 8);
  assert.equal(s.players[0].food, 0);
  assert.equal(s.players[0].wood, 200);
  assert.equal(s.players[0].age, 3);
  assert.equal(normalizeScenario(null).players.length, 8);
  assert.equal(normalizeScenario({}).fog, true);
});

test('aoe2_scenario.json: đếm đơn vị theo ô, cảnh báo ô tắt', () => {
  const mobs = [makeMob({ id: 'aoe2:militia', x: 1, z: 1, slot: 1 }), makeMob({ id: 'aoe2:militia', x: 2, z: 1, slot: 1 }), makeMob({ id: 'aoe2:archer', x: 3, z: 1, slot: 5 }), makeMob({ id: 'minecraft:cow', x: 4, z: 1 })];
  const j = scenarioJson(defaultScenario(), mobs);
  assert.equal(j.format, 'aoe2-scenario');
  assert.equal(j.players[0].units, 2);
  assert.equal(j.players[4].units, 1);
  assert.equal(j.gaiaUnits, 1);
  assert.deepEqual(j.players[1].resources, { food: 200, wood: 200, gold: 100, stone: 200 });
  assert.match(scenarioWarnings(defaultScenario(), mobs).join(' '), /Ô 5/);
});

test('mob có ô người chơi ghi tag ScenarioSlot khi xuất', () => {
  const ents = mobsToEntities([makeMob({ id: 'aoe2:militia', x: 1, z: 1, slot: 3 }), makeMob({ id: 'aoe2:militia', x: 1, z: 1 })], () => 64);
  assert.equal(ents[0].nbt.ScenarioSlot.v, 3);
  assert.equal(ents[1].nbt.ScenarioSlot, undefined);
  assert.equal(makeMob({ id: 'a:b', x: 0, z: 0, slot: 99 }).slot, 8);
});

test('danh mục đơn vị mod hợp lệ, màu theo ô', () => {
  const units = MOB_CATALOG.filter((m) => m.id.startsWith('aoe2:'));
  assert.equal(units.length, MOD_UNITS.length);
  for (const u of units) assert.equal(checkMobSpec(u.id, u.snbt), null);
  assert.equal(mobStyle({ id: 'aoe2:militia', label: units[1].name, slot: 2 }).color, '#D03030');
});

test('kịch bản lưu và mở lại trong dự án', () => {
  const t = createTerrain({ size: 64 });
  t.scenario.fog = false; t.scenario.players[2].active = true; t.scenario.players[2].team = 2;
  const back = unpackTerrain(packTerrain(t));
  assert.equal(back.scenario.fog, false);
  assert.equal(back.scenario.players[2].team, 2);
  const old = packTerrain(t); delete old.meta.scenario;
  assert.equal(unpackTerrain(old).scenario.fog, true);   // dự án cũ không có kịch bản
});

import { COND_TYPES, ACT_TYPES, ORDERS } from '../src/core/scenario.js';

test('v2: vùng, đội mẫu, AI, trigger được chuẩn hoá và xuất ra JSON', () => {
  const s = defaultScenario();
  s.zones.push({ id: 'z1', name: 'Cổng', x0: 50, z0: 40, x1: 10, z1: 20 }, { id: 'z1', name: 'trùng id', x0: 0, z0: 0, x1: 1, z1: 1 }, { id: 'bad id!', x0: 0, z0: 0, x1: 1, z1: 1 });
  s.taskforces.push({ id: 'tf1', name: 'Đội 1', units: [{ unit: 'militia', count: 6 }, { unit: '', count: 3 }, { unit: 'archer', count: 999 }] });
  s.ai[1] = { enabled: true, cheat: true, cheatRate: 99999, builders: 50, jobs: { food: 10, wood: 20, gold: -5, stone: 'x' } };
  s.triggers.push({
    id: 't1', name: 'Phản công', once: true, any: false, diff: [false, true, true],
    conditions: [{ type: 'inZone', slot: 1, zone: 'z1', op: '>=', n: 3 }, { type: 'khong_biet' }],
    actions: [{ type: 'createTeam', slot: 2, taskforce: 'tf1', zone: 'z1', team: 'doi1' }, { type: 'teamOrder', team: 'doi1', order: 'attack', zone: 'z1' }, { type: 'xyz' }],
  });
  const j = scenarioJson(s, []);
  assert.equal(j.version, 2);
  assert.deepEqual(j.zones, [{ id: 'z1', name: 'Cổng', x0: 10, x1: 50, z0: 20, z1: 40 }]);   // trùng id và id sai bị bỏ, toạ độ được sắp lại
  assert.deepEqual(j.taskforces[0].units, [{ unit: 'militia', count: 6 }, { unit: 'archer', count: 200 }]);
  assert.equal(j.ai[1].cheatRate, 10000);
  assert.equal(j.ai[1].builders, 10);
  assert.deepEqual(j.ai[1].jobs, { food: 10, wood: 20, gold: 0, stone: 15 });   // âm thành 0, 'x' rơi về mặc định
  assert.equal(j.triggers.length, 1);
  assert.equal(j.triggers[0].conditions.length, 1);
  assert.equal(j.triggers[0].actions.length, 2);
  assert.deepEqual(j.triggers[0].diff, [false, true, true]);
  assert.equal(j.triggers[0].actions[0].team, 'doi1');
});

test('v2: cảnh báo trigger thiếu vùng, đội mẫu, đội chưa lập', () => {
  const s = defaultScenario();
  s.triggers.push({ id: 't1', name: 'A', conditions: [{ type: 'teamDead', team: 'ma' }], actions: [{ type: 'aiBuild', slot: 2, building: 'barracks', zone: 'khong_co' }, { type: 'trigger', id: 'nope', op: 'run', delay: 0 }] });
  const w = scenarioWarnings(s, []).join('\n');
  assert.match(w, /chưa chọn vùng hợp lệ/);
  assert.match(w, /trigger được điều khiển không tồn tại/);
  assert.match(w, /đội "ma" chưa từng được lập/);
});

test('v2: mọi loại điều kiện/hành động có mặc định hợp lệ và qua được chuẩn hoá', () => {
  const s = defaultScenario();
  const mk = (schema) => Object.entries(schema).map(([type, def]) => { const o = { type }; for (const [k, , , d] of def.fields) o[k] = d; return o; });
  s.triggers.push({ id: 'all', name: 'all', conditions: mk(COND_TYPES), actions: mk(ACT_TYPES) });
  const t = scenarioJson(s).triggers[0];
  assert.equal(t.conditions.length, Object.keys(COND_TYPES).length);
  assert.equal(t.actions.length, Object.keys(ACT_TYPES).length);
  assert.ok(ORDERS.length >= 5);
});

test('v2: dự án lưu và mở lại giữ nguyên trigger', () => {
  const t = createTerrain({ size: 64 });
  t.scenario.zones.push({ id: 'z1', name: 'V', x0: 1, z0: 2, x1: 3, z1: 4 });
  t.scenario.triggers.push({ id: 't1', name: 'T', conditions: [{ type: 'timer', seconds: 90 }], actions: [{ type: 'message', text: 'xin chào' }] });
  const p = packTerrain(t); p.meta = JSON.parse(JSON.stringify(p.meta));    // meta đi qua JSON như khi lưu .mcmap
  const back = unpackTerrain(p).scenario;
  assert.equal(back.triggers[0].conditions[0].seconds, 90);
  assert.equal(back.triggers[0].actions[0].text, 'xin chào');
  assert.equal(back.zones[0].x1, 3);
});
