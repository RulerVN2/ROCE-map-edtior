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
