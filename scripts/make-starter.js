// Sinh bộ công trình cơ bản (do chương trình tự thiết kế) thành file .schem trong src/assets/structures.
import fs from 'node:fs';
import path from 'node:path';
import { Build, cfg, stairs, slab, log, ladder, hash, oldStone } from './build-lib.js';

cfg.out = path.resolve(process.argv[2] ?? 'src/assets/structures');
const out = cfg.out;

fs.mkdirSync(out, { recursive: true });

// 1. Tháp canh gỗ: bốn cột, sàn có lan can, mái che, thang leo ở giữa.
{
  const b = new Build(7, 15, 7);
  for (const [x, z] of [[1, 1], [5, 1], [1, 5], [5, 5]]) b.fill(x, 0, z, x, 12, z, log('spruce'));
  b.fill(3, 0, 3, 3, 8, 3, log('spruce'));
  for (let y = 0; y <= 9; y++) b.set(3, y, 4, ladder('south'));
  for (const y of [3, 6]) { b.fill(2, y, 1, 4, y, 1, log('spruce', 'x')); b.fill(2, y, 5, 4, y, 5, log('spruce', 'x')); b.fill(1, y, 2, 1, y, 4, log('spruce', 'z')); b.fill(5, y, 2, 5, y, 4, log('spruce', 'z')); }
  b.fill(0, 9, 0, 6, 9, 6, 'spruce_planks'); b.set(3, 9, 4, ladder('south'));
  b.walls(0, 10, 0, 6, 10, 6, 'spruce_fence');
  b.fill(0, 13, 0, 6, 13, 6, slab('dark_oak'));
  b.fill(1, 13, 1, 5, 13, 5, 'dark_oak_planks'); b.fill(2, 14, 2, 4, 14, 4, slab('dark_oak'));
  b.set(3, 12, 3, 'lantern[hanging=true,waterlogged=false]'); 
  b.save('thap_canh_go');
}

// 2. Lều trại: khung chữ A bằng len trắng, hai cọc chống, bên trong có rương và đống rơm.
{
  const b = new Build(9, 6, 9);
  for (let z = 0; z <= 8; z++) for (let k = 0; k <= 4; k++) {
    const wool = z === 4 ? 'red_wool' : 'white_wool';
    b.set(k, k, z, wool); b.set(8 - k, k, z, wool);
    if (k < 4) { b.set(k, k + 1, z, wool); b.set(8 - k, k + 1, z, wool); }
  }
  for (const z of [0, 8]) b.fill(4, 0, z, 4, 3, z, 'spruce_fence');
  b.set(2, 0, 6, 'chest[facing=east,type=single,waterlogged=false]'); b.set(6, 0, 6, 'hay_block[axis=y]'); b.set(6, 0, 5, 'hay_block[axis=x]');
  b.set(6, 0, 2, 'barrel[facing=up,open=false]'); b.set(2, 0, 2, 'crafting_table');
  b.save('leu_trai');
}

// 3. Đoạn tường thành: dày 3, cao 7, có lối đi trên mặt tường và răng cưa phía ngoài (phía bắc).
{
  const b = new Build(11, 9, 3);
  b.fill(0, 0, 0, 10, 6, 2, oldStone);
  b.fill(0, 7, 0, 10, 7, 0, 'stone_bricks');
  for (let x = 0; x <= 10; x += 2) b.set(x, 8, 0, 'stone_bricks');
  for (let x = 1; x <= 9; x += 4) b.set(x, 7, 2, slab('stone_brick'));
  b.save('tuong_thanh_doan');
}

// 4. Tháp đá tròn: tường dày 1, cửa phía nam, thang leo bên trong, sàn trên cùng có răng cưa.
{
  const R = 4.6, b = new Build(11, 17, 11), c = 5;
  const ring = (x, z) => { const d = Math.hypot(x - c, z - c); return d <= R && d > R - 1.25; };
  const disc = (x, z) => Math.hypot(x - c, z - c) <= R;
  for (let z = 0; z < 11; z++) for (let x = 0; x < 11; x++) {
    if (ring(x, z)) { b.fill(x, 0, z, x, 13, z, oldStone); if ((x + z) % 2 === 0) b.set(x, 15, z, 'stone_bricks'); b.set(x, 14, z, 'stone_bricks'); }
    else if (disc(x, z)) { b.set(x, 0, z, 'cobblestone'); b.set(x, 13, z, 'spruce_planks'); b.set(x, 7, z, 'spruce_planks'); }
  }
  for (let y = 1; y <= 2; y++) b.clear(c, y, 9);                                   // cửa phía nam
  for (let y = 1; y <= 13; y++) b.set(c, y, 2, ladder('south'));                    // thang tựa tường bắc
  for (const [x, z, f] of [[c, 9, 0], [1, c, 1], [9, c, 1]]) for (const y of [5, 10]) b.clear(x, y, z); // lỗ châu mai
  b.set(c, 12, c, 'lantern[hanging=true,waterlogged=false]'); b.set(c, 6, c, 'lantern[hanging=true,waterlogged=false]');
  b.save('thap_da_tron');
}

// 5. Cổng thành: hai trụ tháp hai bên, vòm cổng rộng 5 cao 6, song sắt kéo lên một nửa.
{
  const b = new Build(15, 14, 5);
  b.fill(0, 0, 0, 14, 9, 4, oldStone);
  b.fill(5, 0, 0, 9, 5, 4, 'air');                                                   // lòng cổng
  for (let z = 0; z <= 4; z++) { b.set(5, 5, z, stairs('stone_brick', 'east', 'top')); b.set(9, 5, z, stairs('stone_brick', 'west', 'top')); }
  b.fill(5, 4, 2, 9, 5, 2, 'iron_bars');                                             // song sắt
  b.set(5, 5, 2, 'stone_bricks'); b.set(9, 5, 2, 'stone_bricks');
  b.fill(0, 10, 0, 14, 10, 0, 'stone_bricks'); b.fill(0, 10, 4, 14, 10, 4, 'stone_bricks');
  for (let x = 0; x <= 14; x += 2) { b.set(x, 11, 0, 'stone_bricks'); b.set(x, 11, 4, 'stone_bricks'); }
  for (const x0 of [0, 10]) {                                                        // hai trụ tháp cao hơn
    b.fill(x0, 10, 0, x0 + 4, 11, 4, oldStone);
    b.walls(x0, 12, 0, x0 + 4, 12, 4, 'stone_bricks');
    for (const [x, z] of [[x0, 0], [x0 + 2, 0], [x0 + 4, 0], [x0, 2], [x0 + 4, 2], [x0, 4], [x0 + 2, 4], [x0 + 4, 4]]) b.set(x, 13, z, 'stone_bricks');
  }
  b.save('cong_thanh');
}

// 6. Nhà gỗ: móng đá cuội, tường ván sồi, cột gỗ, cửa sổ kính, mái dốc hai bên.
{
  const b = new Build(9, 10, 11);
  b.fill(1, 0, 1, 7, 0, 9, 'cobblestone');
  b.walls(1, 1, 1, 7, 4, 9, 'oak_planks');
  for (const [x, z] of [[1, 1], [7, 1], [1, 9], [7, 9]]) b.fill(x, 1, z, x, 4, z, log('oak'));
  for (const z of [3, 5, 7]) { b.set(1, 2, z, 'glass_pane'); b.set(7, 2, z, 'glass_pane'); }
  b.set(3, 2, 1, 'glass_pane'); b.set(5, 2, 1, 'glass_pane');
  b.set(4, 1, 9, 'oak_door[facing=north,half=lower,hinge=left,open=false,powered=false]');
  b.set(4, 2, 9, 'oak_door[facing=north,half=upper,hinge=left,open=false,powered=false]');
  for (let k = 0; k <= 3; k++) {                                                    // mái
    b.fill(k, 5 + k, 0, k, 5 + k, 10, stairs('spruce', 'east')); b.fill(8 - k, 5 + k, 0, 8 - k, 5 + k, 10, stairs('spruce', 'west'));
    for (const z of [1, 9]) if (k + 1 <= 7 - k) b.fill(k + 1, 5 + k, z, 7 - k, 5 + k, z, 'oak_planks'); // đầu hồi
  }
  b.fill(4, 8, 0, 4, 8, 10, 'spruce_planks');
  b.set(2, 1, 2, 'crafting_table'); b.set(6, 1, 2, 'chest[facing=south,type=single,waterlogged=false]');
  b.set(2, 1, 8, 'barrel[facing=up,open=false]'); b.set(4, 4, 5, 'lantern[hanging=true,waterlogged=false]'); b.fill(3, 5, 5, 5, 5, 5, 'oak_planks');
  b.save('nha_go');
}

// 7. Ụ bao cát: tường chữ U thấp, mặt trước có khe bắn, hở phía sau (phía nam).
{
  const b = new Build(9, 3, 5);
  const bag = (x, y, z) => (hash(x, y, z) % 3 ? 'smooth_sandstone' : 'sandstone');
  b.fill(0, 0, 0, 8, 1, 0, bag); b.fill(0, 0, 1, 0, 1, 4, bag); b.fill(8, 0, 1, 8, 1, 4, bag);
  for (let x = 0; x <= 8; x += 2) b.set(x, 2, 0, slab('smooth_sandstone'));
  b.set(0, 2, 2, slab('smooth_sandstone')); b.set(8, 2, 2, slab('smooth_sandstone'));
  b.set(2, 0, 3, 'barrel[facing=up,open=false]'); b.set(6, 0, 3, 'chest[facing=north,type=single,waterlogged=false]');
  b.save('u_bao_cat');
}

// 8. Chướng ngại gỗ: hàng cọc rào xen thùng, rơm và khúc gỗ nằm.
{
  const b = new Build(11, 3, 3);
  for (let x = 0; x <= 10; x++) {
    if (x % 5 === 2) { b.set(x, 0, 1, 'hay_block[axis=z]'); b.set(x, 1, 1, 'hay_block[axis=x]'); }
    else if (x % 5 === 4) b.set(x, 0, 1, 'barrel[facing=up,open=false]');
    else { b.fill(x, 0, 1, x, 1, 1, 'spruce_fence'); if (x % 2 === 0) b.set(x, 2, 1, 'spruce_fence'); }
  }
  b.fill(0, 0, 0, 3, 0, 0, log('spruce', 'x')); b.fill(7, 0, 2, 10, 0, 2, log('spruce', 'x'));
  b.save('chuong_ngai_go');
}

// 9. Cầu gỗ: dài 17, rộng 5, mặt cầu cao 3 khối so với chân trụ (đặt với "Độ cao đặt" = -3 để mặt cầu ngang mặt đất).
{
  const b = new Build(17, 5, 5);
  b.fill(0, 3, 0, 16, 3, 4, (x, y, z) => (x % 4 === 0 ? 'spruce_planks' : 'oak_planks'));
  for (let x = 0; x <= 16; x += 4) for (const z of [0, 4]) { b.fill(x, 0, z, x, 3, z, log('spruce')); b.set(x, 4, z, 'spruce_fence'); }
  for (let x = 0; x <= 16; x++) for (const z of [0, 4]) if (x % 4) b.set(x, 4, z, 'spruce_fence');
  b.save('cau_go');
}

// 10. Giếng nước: thành đá cuội, bốn cọc và mái che.
{
  const b = new Build(5, 5, 5);
  b.walls(0, 0, 0, 4, 1, 4, (x, y, z) => (hash(x, y, z) % 4 ? 'cobblestone' : 'mossy_cobblestone'));
  b.fill(1, 0, 1, 3, 0, 3, 'water[level=0]');
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) b.fill(x, 2, z, x, 3, z, 'oak_fence');
  b.fill(0, 4, 0, 4, 4, 4, slab('spruce')); b.fill(1, 4, 1, 3, 4, 3, 'spruce_planks');
  b.save('gieng_nuoc');
}
