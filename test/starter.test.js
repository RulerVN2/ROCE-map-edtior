import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseSchem, writeSchem } from '../src/core/schem.js';
import { structureToSchem, villageStructuresFromJar } from '../src/core/mcstructure.js';
import { readZip } from '../src/core/zip.js';
import { createTerrain, makePlacement, terrainToWorld } from '../src/core/terrain.js';
import { MIN_Y } from '../src/core/constants.js';

const dir = new URL('../src/assets/structures/', import.meta.url);
const jar = fs.readFileSync(new URL('./fixtures/fake-mc.jar', import.meta.url));
const at = (s, x, y, z) => s.palette[s.data[(y * s.l + z) * s.w + x]];

test('Bộ công trình cơ bản: đủ 10 file, đọc lại được, hàng rào và song sắt đã nối sẵn', () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.schem')).sort();
  assert.equal(files.length, 10);
  for (const f of files) {
    const s = parseSchem(fs.readFileSync(new URL(f, dir)));
    assert.ok(s.w > 0 && s.h > 0 && s.l > 0 && s.w <= 32 && s.l <= 32, f);
    assert.ok(s.data.some((v) => v !== 0), f + ' không được rỗng');
    for (const p of s.palette) assert.match(p, /^minecraft:[a-z_]+(\[[a-z_]+=[a-z0-9_]+(,[a-z_]+=[a-z0-9_]+)*\])?$/, f);
    for (const p of s.palette) if (/fence|_bars|glass_pane/.test(p)) assert.match(p, /east=.*north=.*south=.*west=/, f + ': ' + p);
  }
  const tower = parseSchem(fs.readFileSync(new URL('thap_canh_go.schem', dir)));
  assert.match(at(tower, 0, 10, 3), /spruce_fence\[east=false,north=true,south=true,west=false/); // lan can cạnh tây chạy bắc-nam
  assert.match(at(tower, 3, 5, 4), /^minecraft:ladder\[facing=south/);
  const gate = parseSchem(fs.readFileSync(new URL('cong_thanh.schem', dir)));
  assert.match(at(gate, 7, 4, 2), /iron_bars\[east=true,north=false,south=false,west=true/);
  assert.equal(at(gate, 7, 2, 2), 'minecraft:air');
  const house = parseSchem(fs.readFileSync(new URL('nha_go.schem', dir)));
  assert.match(at(house, 0, 5, 5), /spruce_stairs\[facing=east/);
  assert.match(at(house, 4, 1, 9), /oak_door\[.*half=lower/);
});

test('Ghi schem rồi đọc lại giữ nguyên khối và block entity', () => {
  const src = parseSchem(fs.readFileSync(new URL('./fixtures/hut.schem', import.meta.url)));
  const back = parseSchem(writeSchem(src));
  assert.deepEqual([back.w, back.h, back.l], [src.w, src.h, src.l]);
  assert.deepEqual(back.palette, src.palette);
  assert.deepEqual(back.data, src.data);
  assert.equal(back.blockEntities[0].id, 'minecraft:chest');
  assert.equal(back.blockEntities[0].tags.Items.v.items[0].id.v, 'minecraft:arrow');
  const big = { w: 2, h: 1, l: 1, palette: Array.from({ length: 300 }, (_, i) => `minecraft:b${i}`), data: Uint16Array.from([299, 130]), blockEntities: [] };
  assert.deepEqual([...parseSchem(writeSchem(big)).data], [299, 130]); // chỉ số lớn hơn 127 cần 2 byte
});

test('Đọc jar: chỉ lấy nhà, trung tâm làng và đồ trang trí; bỏ đường, bản zombie, vật nuôi', () => {
  assert.ok(readZip(jar).some((e) => e.name === 'version.json' && e.read().toString() === '{"id":"1.20.1"}'));
  const got = villageStructuresFromJar(jar).map((v) => `${v.biome}/${v.name}`).sort();
  assert.deepEqual(got, ['desert/desert_small_house_1', 'plains/plains_lamp_1', 'plains/plains_meeting_point_1', 'plains/plains_small_house_1']);
  assert.throws(() => readZip(Buffer.from('không phải zip, chỉ là chữ thôi nhé')), /zip/);
});

test('Chuyển structure của game sang schem: ô trống, khối ghép nối, rương', () => {
  const s = villageStructuresFromJar(jar).find((v) => v.name === 'plains_small_house_1').schem;
  assert.deepEqual([s.w, s.h, s.l], [3, 2, 4]);
  assert.equal(at(s, 0, 0, 0), 'minecraft:oak_planks');
  assert.equal(at(s, 1, 0, 0), 'minecraft:cobblestone');           // khối ghép nối -> khối cuối cùng
  assert.equal(at(s, 1, 1, 1), 'minecraft:structure_void');        // không nhắc tới -> để nguyên
  assert.equal(at(s, 2, 1, 2), 'minecraft:air');
  assert.match(at(s, 0, 1, 0), /^minecraft:oak_stairs\[facing=north,half=bottom/);
  assert.equal(s.blockEntities.length, 1);                          // rương có, khối ghép nối thì không
  assert.equal(s.blockEntities[0].tags.Items.v.items[0].id.v, 'minecraft:bread');

  // Qua file .schem rồi dán vào world: ô trống không đụng tới đất, không khí bị bỏ qua.
  const viaFile = parseSchem(writeSchem(s));
  const t = createTerrain({ size: 32, baseHeight: 66 });
  t.placements.push(makePlacement(t, viaFile, 'x', 10, 10, { yOffset: -2 }));
  const w = terrainToWorld(t, {}, new Map([['x', viaFile]]));
  const c = w.getChunk(0, 0);
  const blk = (x, y, z) => w.blockPalette[c.blocks[((y - MIN_Y) * 16 + z) * 16 + x]].Name;
  const p = t.placements[0];
  assert.equal(blk(p.x, p.y, p.z), 'minecraft:oak_planks');
  assert.equal(blk(p.x + 1, p.y + 1, p.z + 1), 'minecraft:grass_block');  // structure_void: đất giữ nguyên
  assert.equal(blk(p.x + 2, p.y + 1, p.z + 2), 'minecraft:grass_block');  // không khí: bỏ qua khi không bật dọn đất
  assert.equal(blk(p.x + 2, p.y + 1, p.z + 3), 'minecraft:chest');
  assert.equal(c.blockEntities.length, 1);
});

test('Bộ công trình Thế chiến 2: đủ 42 file, đọc lại được, có cả bản hư hỏng và hào đào', () => {
  const d = new URL('../src/assets/the_chien_2/', import.meta.url);
  const files = fs.readdirSync(d).filter((f) => f.endsWith('.schem')).sort();
  assert.equal(files.length, 42);
  for (const f of ['trung_tam_chi_huy', 'cong_su_be_tong', 'hao_chien_dau', 'nha_linh_go', 'nha_gach_2_tang', 'nha_gach_hu_hong', 'tram_gac', 'tien_don', 'tuong_rao_gach', 'tuong_rao_goc_thap', 'tuong_rao_cong']) {
    assert.ok(files.includes(f + '.schem'), f);
  }
  const count = (s) => s.data.reduce((n, v) => n + (s.palette[v] === 'minecraft:air' ? 0 : 1), 0);
  for (const f of files) {
    const s = parseSchem(fs.readFileSync(new URL(f, d)));
    assert.ok(s.w > 0 && s.h > 0 && s.l > 0 && s.w <= 32 && s.l <= 32 && s.h <= 32, f);
    assert.ok(count(s) > 20, f + ' quá ít khối');
    for (const p of s.palette) assert.match(p, /^minecraft:[a-z_]+(\[[a-z_]+=[a-z0-9_]+(,[a-z_]+=[a-z0-9_]+)*\])?$/, f);
    for (const p of s.palette) if (/fence|_bars|glass_pane/.test(p)) assert.match(p, /east=.*north=.*south=.*west=/, f + ': ' + p);
  }
  const whole = parseSchem(fs.readFileSync(new URL('nha_gach_2_tang.schem', d)));
  const ruin = parseSchem(fs.readFileSync(new URL('nha_gach_hu_hong.schem', d)));
  assert.ok(count(ruin) < count(whole) * 0.85, 'bản hư hỏng phải ít khối hơn hẳn');
  const trench = parseSchem(fs.readFileSync(new URL('hao_chien_dau.schem', d)));
  assert.equal(at(trench, 1, 1, 2), 'minecraft:air'); // lòng hào là không khí, cần bật "Cả khối không khí" khi đặt
});

test('Bộ sân bay: đủ 12 file, đọc lại được, đường băng phẳng, nhà chứa và máy bay có khối', () => {
  const d = new URL('../src/assets/san_bay/', import.meta.url);
  const files = fs.readdirSync(d).filter((f) => f.endsWith('.schem')).sort();
  assert.equal(files.length, 12);
  for (const f of files) {
    const s = parseSchem(fs.readFileSync(new URL(f, d)));
    assert.ok(s.w > 0 && s.h > 0 && s.l > 0 && s.w <= 32 && s.l <= 32 && s.h <= 32, f);
    assert.ok(s.data.some((v) => v !== 0), f);
    for (const p of s.palette) assert.match(p, /^minecraft:[a-z_]+(\[[a-z_]+=[a-z0-9_]+(,[a-z_]+=[a-z0-9_]+)*\])?$/, f);
    for (const p of s.palette) if (/fence|_bars|glass_pane/.test(p)) assert.match(p, /east=.*north=.*south=.*west=/, f + ': ' + p);
  }
  const rw = parseSchem(fs.readFileSync(new URL('duong_bang_32.schem', d)));
  assert.equal(rw.h, 1);
  assert.match(at(rw, 5, 0, 0), /white_concrete/); // vạch giữa bắt đầu bằng nét trắng
  assert.match(at(rw, 5, 0, 6), /concrete/);
});

test('Bộ đồ vật và nhà cửa (tham chiếu ChatGPT): đủ 24 file, đọc lại được, có nhà đổ nát và khối đúng định dạng', () => {
  const d = new URL('../src/assets/tham_chieu/', import.meta.url);
  const files = fs.readdirSync(d).filter((f) => f.endsWith('.schem')).sort();
  assert.equal(files.length, 24);
  for (const f of files) {
    const s = parseSchem(fs.readFileSync(new URL(f, d)));
    assert.ok(s.w > 0 && s.h > 0 && s.l > 0 && s.w <= 32 && s.l <= 32 && s.h <= 32, f);
    assert.ok(s.data.filter((v) => v !== 0).length >= 3, f + ' quá ít khối');
    for (const p of s.palette) assert.match(p, /^minecraft:[a-z_]+(\[[a-z_]+=[a-z0-9_]+(,[a-z_]+=[a-z0-9_]+)*\])?$/, f);
    for (const p of s.palette) if (/fence|_bars|glass_pane/.test(p)) assert.match(p, /east=.*north=.*south=.*west=/, f + ': ' + p);
  }
  const count = (n) => { const s = parseSchem(fs.readFileSync(new URL(n, d))); return s.data.filter((v) => v !== 0).length; };
  assert.ok(count('18_nha_do_nat.schem') > 100 && count('13_nha_tranh.schem') > 100);
  const well = parseSchem(fs.readFileSync(new URL('06_gieng_da.schem', d)));
  assert.equal(at(well, 2, 0, 2), 'minecraft:water');
});

test('Bộ tàu và xuồng đổ bộ Mỹ WW2: đủ 20 file, đọc lại được, khối đúng định dạng, có nước-ngầm đen và boong', () => {
  const d = new URL('../src/assets/tau_my/', import.meta.url);
  const files = fs.readdirSync(d).filter((f) => f.endsWith('.schem')).sort();
  assert.equal(files.length, 20);
  for (const f of files) {
    const s = parseSchem(fs.readFileSync(new URL(f, d)));
    assert.ok(s.w >= 9 && s.w <= 160 && s.h <= 40 && s.l <= 40, f);
    assert.ok(s.data.filter((v) => v !== 0).length >= 40, f + ' quá ít khối');
    for (const p of s.palette) assert.match(p, /^minecraft:[a-z_]+(\[[a-z_]+=[a-z0-9_]+(,[a-z_]+=[a-z0-9_]+)*\])?$/, f);
    for (const p of s.palette) if (/fence|_bars|glass_pane/.test(p)) assert.match(p, /east=.*north=.*south=.*west=/, f + ': ' + p);
  }
  const big = parseSchem(fs.readFileSync(new URL('us_17_cv_essex.schem', d)));
  assert.ok(big.w >= 140);
  assert.ok(big.palette.some((p) => /black_concrete/.test(p)) && big.palette.some((p) => /dark_oak_planks/.test(p)));
  assert.equal(at(big, 70, 0, 11), 'minecraft:black_concrete');   // đáy thân tàu sơn đen
});

test('World border: mặc định cả map, setBorder làm tròn, giữ trong map, lưu/mở dự án và xuất đúng tâm', async () => {
  const { createTerrain, borderBox, setBorder, packTerrain, unpackTerrain, terrainToWorld } = await import('../src/core/terrain.js');
  const t = createTerrain({ size: 256 });
  assert.deepEqual([borderBox(t).cx, borderBox(t).size], [128, 256]);
  assert.equal(setBorder(t, 128, 128, 100), true);
  assert.equal(borderBox(t).size, 100);
  setBorder(t, 5, 5, 100);                                  // tâm bị kéo vào để khung nằm gọn trong map
  assert.deepEqual([borderBox(t).x0, borderBox(t).z0], [0, 0]);
  setBorder(t, 300, 300, 120);
  assert.equal(borderBox(t).x1, 256);
  setBorder(t, 128, 128, 3);                                // nhỏ nhất 16
  assert.equal(borderBox(t).size, 16);
  setBorder(t, 100, 90, 160);
  const back = unpackTerrain(packTerrain(t));
  assert.deepEqual(back.border, t.border);
  const w = terrainToWorld(back, { name: 'x' }, new Map());
  assert.deepEqual([w.border.centerX, w.border.centerZ, w.border.size], [t.border.cx, t.border.cz, 160]);
  assert.equal(setBorder(t, 128, 128, 256), true);          // về cả map thì không còn bản ghi border
  assert.equal(t.border, null);
});

test('Okinawa bổ sung: đủ 24 file okn_01..24, đọc lại được, trạng thái khối đầy đủ', () => {
  const d = new URL('../src/assets/okinawa_bo_sung/', import.meta.url);
  const files = fs.readdirSync(d).filter((f) => f.endsWith('.schem')).sort();
  assert.equal(files.length, 24);
  files.forEach((f, i) => assert.ok(f.startsWith('okn_' + String(i + 1).padStart(2, '0') + '_'), f));
  for (const f of files) {
    const s = parseSchem(fs.readFileSync(new URL(f, d)));
    assert.ok(s.w > 0 && s.h > 0 && s.l > 0 && s.w <= 32 && s.l <= 32, f);
    assert.ok(s.data.some((v) => v !== 0), f + ' không được rỗng');
    for (const p of s.palette) assert.match(p, /^minecraft:[a-z_0-9]+(\[[a-z_]+=[a-z0-9_]+(,[a-z_]+=[a-z0-9_]+)*\])?$/, f + ': ' + p);
    for (const p of s.palette) if (/fence|_bars|glass_pane/.test(p)) assert.match(p, /east=.*north=.*south=.*west=/, f + ': ' + p);
  }
});
