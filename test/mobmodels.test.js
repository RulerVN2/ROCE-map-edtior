import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOB_MODELS, modelFor, buildFaces } from '../src/core/mobmodels.js';

test('mô hình có cho các mob thông dụng, mob lạ thì null', () => {
  for (const k of ['zombie', 'skeleton', 'creeper', 'pig', 'cow', 'sheep', 'chicken', 'villager', 'pillager']) assert.ok(modelFor('minecraft:' + k), k);
  assert.equal(modelFor('recruits:recruit'), null);
});
test('mỗi hộp có 5 mặt nằm trong ảnh', () => {
  for (const [k, m] of Object.entries(MOB_MODELS)) {
    const faces = buildFaces(m);
    assert.equal(faces.length % 5, 0, k);
    for (const f of faces) { assert.ok(f.r[0] >= 0 && f.r[1] >= 0 && f.r[0] + f.r[2] <= (m.texW ?? 64) + 4 && f.r[1] + f.r[3] <= (m.texH ?? m.texW ?? 64) + 4, k + ' ' + f.r); }
  }
});
test('zombie: mặt trước đầu quay về -z mô hình, tay giơ ra phía trước', () => {
  const faces = buildFaces(MOB_MODELS.zombie);
  const head = faces[0];
  assert.deepEqual(head.n, [0, 0, -1]); assert.deepEqual(head.r, [8, 8, 8, 8]); // mặt trước đầu nằm ở (8,8) trong ảnh skin
  // tay phải (bộ phận thứ 3) sau khi xoay -90 độ: cạnh dọc V hướng về -z (phía trước)
  const arm = faces[10];
  assert.ok(arm.V[2] < -10 && Math.abs(arm.V[1]) < 1e-6, JSON.stringify(arm.V));
});
test('lợn: thân xoay nằm dọc, dài 16 theo trục z', () => {
  const faces = buildFaces(MOB_MODELS.pig), body = faces[10]; // đầu 2 hộp = 10 mặt, rồi tới thân
  const zs = faces.slice(10, 15).flatMap((f) => [f.o[2], f.o[2] + f.U[2], f.o[2] + f.V[2]]);
  assert.ok(Math.max(...zs) - Math.min(...zs) > 15.9);
  assert.ok(body);
});

import { armorOf, armorLayers, buildFaces as bf, modelFor as mf } from '../src/core/mobmodels.js';
test('giáp: đọc từ NBT và dựng thêm mặt', () => {
  const am = armorOf('{ArmorItems:[{id:"minecraft:iron_boots",Count:1b},{id:"minecraft:iron_leggings",Count:1b},{id:"minecraft:diamond_chestplate",Count:1b},{id:"minecraft:iron_helmet",Count:1b}],HandItems:[{id:"minecraft:iron_sword",Count:1b},{}]}');
  assert.deepEqual(am, { feet: 'iron', legs: 'iron', chest: 'diamond', head: 'iron' });
  assert.equal(armorOf('{HandItems:[{}]}'), null);
  const z = mf('minecraft:zombie'), layers = armorLayers(z, am);
  assert.equal(layers.length, 4);
  assert.ok(bf(z, layers).length > bf(z).length);
  assert.equal(armorLayers(mf('minecraft:cow'), am).length, 0);
});

import { heldOf } from '../src/core/mobmodels.js';
test('mob mới và đồ cầm tay', () => {
  for (const id of ['spider', 'wolf', 'iron_golem', 'horse', 'armor_stand', 'ravager']) {
    const m = modelFor('minecraft:' + id);
    assert.ok(m, id);
    const fl = buildFaces(m);
    assert.ok(fl.length > 10);
    for (const f of fl) assert.equal(f.bw, m.texW ?? 64);
  }
  assert.equal(heldOf('{HandItems:[{id:"minecraft:iron_sword",Count:1b},{}]}'), 'iron_sword');
  assert.equal(heldOf('{HandItems:[{},{}]}'), null);
  const z = modelFor('minecraft:zombie');
  assert.equal(buildFaces(z, [], 'iron_sword').length, buildFaces(z).length + 2);
});

import { horseArmorLayer } from '../src/core/mobmodels.js';
test('mob thêm: enderman, witch, minecart, boat, xoay chân nhện, giáp ngựa, đồ cầm của illager', () => {
  for (const id of ['enderman', 'witch', 'minecart', 'oak_boat']) assert.ok(buildFaces(modelFor('minecraft:' + id)).length > 10, id);
  const sp = buildFaces(modelFor('minecraft:spider'));
  assert.ok(sp.some((f) => Math.abs(f.U[2]) > 1 && Math.abs(f.U[1]) > 1), 'chân nhện phải xoè nghiêng');
  const h = modelFor('minecraft:horse');
  assert.ok(horseArmorLayer(h, '{ArmorItem:{id:"minecraft:iron_horse_armor",Count:1b}}'));
  assert.equal(horseArmorLayer(h, '{}'), null);
  const v = modelFor('minecraft:vindicator');
  assert.equal(buildFaces(v, [], 'iron_axe').length, buildFaces(v).length + 2);
});
