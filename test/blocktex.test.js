import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexEntries, resolveBlocks, readTexture } from '../src/core/blocktex.js';

const file = (name, obj) => ({ name, read: () => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)) });
const jar = indexEntries([
  file('assets/minecraft/blockstates/stone.json', { variants: { '': { model: 'minecraft:block/stone' } } }),
  file('assets/minecraft/models/block/stone.json', { parent: 'minecraft:block/cube_all', textures: { all: 'minecraft:block/stone' } }),
  file('assets/minecraft/models/block/cube_all.json', { parent: 'block/cube', textures: { particle: '#all', down: '#all', up: '#all', north: '#all', east: '#all', south: '#all', west: '#all' } }),
  file('assets/minecraft/models/block/cube.json', { textures: { particle: '#north' } }),
  file('assets/minecraft/blockstates/oak_log.json', { variants: { 'axis=y': { model: 'minecraft:block/oak_log' }, 'axis=x': { model: 'minecraft:block/oak_log_horizontal' } } }),
  file('assets/minecraft/models/block/oak_log.json', { parent: 'minecraft:block/cube_column', textures: { end: 'minecraft:block/oak_log_top', side: 'minecraft:block/oak_log' } }),
  file('assets/minecraft/blockstates/oak_stairs.json', { variants: { 'facing=east,half=bottom,shape=straight': [{ model: 'minecraft:block/oak_stairs' }] } }),
  file('assets/minecraft/models/block/oak_stairs.json', { parent: 'minecraft:block/stairs', textures: { bottom: 'minecraft:block/oak_planks', top: 'minecraft:block/oak_planks', side: 'minecraft:block/oak_planks' } }),
  file('assets/minecraft/blockstates/grass_block.json', { variants: { 'snowy=false': { model: 'minecraft:block/grass_block' } } }),
  file('assets/minecraft/models/block/grass_block.json', { textures: { bottom: 'minecraft:block/dirt', top: 'minecraft:block/grass_block_top', side: 'minecraft:block/grass_block_side', particle: 'minecraft:block/dirt' } }),
  file('assets/minecraft/blockstates/glass_pane.json', { multipart: [{ apply: { model: 'minecraft:block/glass_pane_post' } }] }),
  file('assets/minecraft/models/block/glass_pane_post.json', { textures: { pane: 'minecraft:block/glass', edge: 'minecraft:block/glass_pane_top', particle: '#pane' } }),
  file('assets/minecraft/textures/block/stone.png', 'PNG'),
]);

test('khối đặc: một texture cho mọi mặt', () => {
  const r = resolveBlocks(jar, ['minecraft:stone']).get('minecraft:stone');
  assert.deepEqual([r.top, r.side], ['block/stone', 'block/stone']);
});
test('thân gỗ: mặt trên khác mặt bên', () => {
  const r = resolveBlocks(jar, ['minecraft:oak_log']).get('minecraft:oak_log');
  assert.deepEqual([r.top, r.side], ['block/oak_log_top', 'block/oak_log']);
});
test('bậc thang (variants là mảng) và multipart', () => {
  const m = resolveBlocks(jar, ['minecraft:oak_stairs', 'minecraft:glass_pane']);
  assert.equal(m.get('minecraft:oak_stairs').top, 'block/oak_planks');
  assert.ok(m.get('minecraft:glass_pane').side);
});
test('khối cỏ: mặt trên phủ màu cỏ, mặt bên không', () => {
  const r = resolveBlocks(jar, ['minecraft:grass_block']).get('minecraft:grass_block');
  assert.equal(r.top, 'block/grass_block_top'); assert.equal(r.tintTop, 'grass'); assert.equal(r.tintSide, null);
});
test('khối không có dữ liệu: null; đọc texture', () => {
  assert.equal(resolveBlocks(jar, ['minecraft:nonexistent']).get('minecraft:nonexistent'), null);
  assert.equal(readTexture(jar, 'block/stone').toString(), 'PNG');
  assert.equal(readTexture(jar, 'block/none'), null);
});
