// Chạy thử chương trình thật dưới màn hình ảo: vẽ bằng chuột, chụp hình, xuất world.
import fs from 'node:fs';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = process.env.MMB_TEST_OUT ?? 'out/e2e';

export default async function run(win) {
  fs.mkdirSync(outDir, { recursive: true });
  const wc = win.webContents;
  if (wc.isLoading()) await new Promise((r) => wc.once('did-finish-load', r));
  wc.on('console-message', (_e, level, msg) => console.log('[renderer]', msg));
  await sleep(500);
  const js = (code) => wc.executeJavaScript(code);
  const shot = async (name) => fs.writeFileSync(path.join(outDir, name), (await wc.capturePage()).toPNG());

  // Lỗi "map tự trôi": bộ gõ tiếng Việt làm phím nhả ra khác phím nhấn (a -> â). Giữ A rồi nhả kiểu đó, map không được tiếp tục trôi.
  const camOf = () => js('__mmb.view.camX.toFixed(3)+","+__mmb.view.camZ.toFixed(3)');
  const cam0 = await js('[__mmb.view.camX,__mmb.view.camZ]');
  await js('window.dispatchEvent(new KeyboardEvent("keydown",{key:"a",code:"KeyA",bubbles:true}))'); await sleep(250);
  await js('window.dispatchEvent(new KeyboardEvent("keyup",{key:"â",code:"KeyA",bubbles:true}))'); await sleep(150);
  const cam1 = await camOf(); await sleep(500); const cam2 = await camOf();
  if (cam1 !== cam2) throw new Error('Map vẫn tự trôi sau khi nhả phím: ' + cam1 + ' -> ' + cam2);
  await js('window.dispatchEvent(new KeyboardEvent("keydown",{key:"w",code:"KeyW",bubbles:true}))'); await sleep(200);
  await js('window.dispatchEvent(new Event("blur"))'); await sleep(100);
  const cam3 = await camOf(); await sleep(400);
  if (cam3 !== await camOf()) throw new Error('Map trôi tiếp sau khi mất tiêu điểm cửa sổ');
  console.log('phím di chuyển ổn', cam3);
  await js(`(()=>{__mmb.view.camX=${cam0[0]};__mmb.view.camZ=${cam0[1]};__mmb.state.dirty=true})()`); await sleep(100);

  const size = await js('({w: __mmb.view.W, h: __mmb.view.H})');
  console.log('khung nhìn', size);
  const cx = Math.round(size.w / 2), cy = Math.round(size.h / 2) + 46; // +46: chiều cao thanh công cụ (ước lượng)
  const rect = await js('(()=>{const r=document.getElementById("view").getBoundingClientRect();return {x:r.left,y:r.top}})()');
  const at = (dx, dy) => ({ x: Math.round(rect.x + size.w / 2 + dx), y: Math.round(rect.y + size.h / 2 + dy) });

  // Công cụ World border: kéo trong khung để dời, kéo cạnh để đổi cỡ, Shift + bấm để trả về cả map, Ctrl+Z hoàn tác.
  await js('__mmb.setTool("border"); __mmb.setBorder(__mmb.terrain, 512, 512, 120); __mmb.state.dirty = true'); await sleep(250);
  const bd0 = JSON.parse(await js('JSON.stringify(__mmb.borderBox(__mmb.terrain))'));
  const rectB = await js('(()=>{const r=document.getElementById("view").getBoundingClientRect();return {x:r.left,y:r.top}})()');
  const scr = (x, z) => js(`(()=>{const t=__mmb.terrain,p=__mmb.view.project(${x},t.heights[${z}*t.size+${x}]+1,${z});return {x:Math.round(p.px),y:Math.round(p.py)}})()`).then((p) => ({ x: rectB.x + p.x, y: rectB.y + p.y }));
  const mouseDrag = async (a, b) => {
    wc.sendInputEvent({ type: 'mouseMove', ...a }); await sleep(60);
    wc.sendInputEvent({ type: 'mouseDown', ...a, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 8; i++) { wc.sendInputEvent({ type: 'mouseMove', x: Math.round(a.x + (b.x - a.x) * i / 8), y: Math.round(a.y + (b.y - a.y) * i / 8), modifiers: ['leftButtonDown'] }); await sleep(40); }
    wc.sendInputEvent({ type: 'mouseUp', ...b, button: 'left', clickCount: 1 }); await sleep(120);
  };
  const edgeA = await scr(bd0.x1, 512);                       // giữa cạnh phía x lớn
  const outP = await scr(bd0.x1 + 10, 512);
  await mouseDrag(edgeA, outP);
  const bd1 = JSON.parse(await js('JSON.stringify(__mmb.borderBox(__mmb.terrain))'));
  console.log('border sau khi kéo cạnh', JSON.stringify(bd1));
  if (!(bd1.size >= 132 && bd1.size <= 148)) throw new Error('Kéo cạnh không đổi cỡ border như mong đợi: ' + bd1.size);
  const inA = await scr(512, 512), inB = await scr(522, 518);
  await mouseDrag(inA, inB);
  const bd2 = JSON.parse(await js('JSON.stringify(__mmb.borderBox(__mmb.terrain))'));
  console.log('border sau khi dời', JSON.stringify(bd2));
  if (!(bd2.size === bd1.size && bd2.cx > bd1.cx + 6 && bd2.cz > bd1.cz + 3)) throw new Error('Kéo trong khung không dời border');
  await js('window.dispatchEvent(new KeyboardEvent("keydown",{key:"z",code:"KeyZ",ctrlKey:true,bubbles:true}))'); await sleep(150);
  const bd3 = JSON.parse(await js('JSON.stringify(__mmb.borderBox(__mmb.terrain))'));
  if (bd3.cx !== bd1.cx || bd3.size !== bd1.size) throw new Error('Hoàn tác không trả border về trước khi dời');
  await shot('0-border.png');
  const mid = await scr(512, 512);
  wc.sendInputEvent({ type: 'mouseMove', ...mid }); await sleep(60);
  wc.sendInputEvent({ type: 'mouseDown', ...mid, button: 'left', clickCount: 1, modifiers: ['shift'] });
  wc.sendInputEvent({ type: 'mouseUp', ...mid, button: 'left', clickCount: 1, modifiers: ['shift'] }); await sleep(150);
  if ((await js('__mmb.terrain.border')) !== null) throw new Error('Shift + bấm không trả border về cả map');
  await js('__mmb.setTool("raise")'); await sleep(100);
  await js('__mmb.state.undo.length = 0; __mmb.state.redo.length = 0'); console.log('border OK');

  const drag = async (from, to, ms, mods = []) => {
    wc.sendInputEvent({ type: 'mouseMove', ...from, modifiers: mods });
    await sleep(60);
    wc.sendInputEvent({ type: 'mouseDown', ...from, button: 'left', clickCount: 1, modifiers: mods });
    const steps = Math.max(2, Math.round(ms / 30));
    for (let i = 1; i <= steps; i++) {
      wc.sendInputEvent({ type: 'mouseMove', x: Math.round(from.x + (to.x - from.x) * i / steps), y: Math.round(from.y + (to.y - from.y) * i / steps), modifiers: [...mods, 'leftButtonDown'] });
      await sleep(30);
    }
    wc.sendInputEvent({ type: 'mouseUp', ...to, button: 'left', clickCount: 1, modifiers: mods });
    await sleep(80);
  };

  await shot('1-flat.png');
  // Nét nâng: kéo một dãy đồi.
  await drag(at(-250, -60), at(150, -120), 1800);
  // Cọ to hơn, nâng một quả núi.
  await js('(()=>{const e=document.getElementById("brush-size");e.value=30;e.dispatchEvent(new Event("input"));const s=document.getElementById("brush-strength");s.value=100;s.dispatchEvent(new Event("input"))})()');
  await drag(at(200, 120), at(210, 125), 2500);
  // Hạ một hố.
  await js('__mmb.setTool("lower")');
  await drag(at(-200, 150), at(-190, 150), 1500);
  await shot('2-painted.png');
  const stats = await js('(()=>{let mn=1e9,mx=-1e9;for(const h of __mmb.terrain.heights){if(h<mn)mn=h;if(h>mx)mx=h}return {mn,mx,undo:__mmb.state.undo.length}})()');
  console.log('độ cao sau khi vẽ', stats);
  if (!(stats.mx > 80 && stats.mn < 60 && stats.undo === 3)) throw new Error('Vẽ bằng chuột không tác động như mong đợi');

  // San phẳng đỉnh núi rồi thu nhỏ để xem toàn cảnh.
  await js('__mmb.setTool("flatten")');
  await drag(at(205, 40), at(230, 60), 1500);
  await shot('3-flatten.png');
  for (let i = 0; i < 4; i++) { wc.sendInputEvent({ type: 'mouseWheel', ...at(0, 0), deltaX: 0, deltaY: -120 }); await sleep(60); }
  await sleep(200);
  await shot('4-zoom-out.png');
  const zoom = await js('__mmb.view.scale');
  console.log('phóng', zoom);

  // Hoàn tác một nét.
  const before = await js('__mmb.state.undo.length');
  await js('document.getElementById("btn-undo").click()');
  const after = await js('__mmb.state.undo.length');
  if (after !== before - 1) throw new Error('Hoàn tác không chạy');

  // Bước 3: vách đá, sông hồ, tô vật liệu, biome — đều bằng chuột thật, trên vùng đất phẳng bên trái.
  for (let i = 0; i < 4; i++) { wc.sendInputEvent({ type: 'mouseWheel', ...at(0, 0), deltaX: 0, deltaY: 120 }); await sleep(60); }
  await js('(()=>{const e=document.getElementById("brush-size");e.value=10;e.dispatchEvent(new Event("input"))})()');
  await sleep(200);
  const cellAt = (p) => js(`__mmb.view.cellAt(${p.x - rect.x}, ${p.y - rect.y})`);
  const P = { cliff: at(-380, -200), river: at(-420, 60), paint: at(-150, 260), biome: at(330, -250) };
  const cells = {};
  for (const k of Object.keys(P)) cells[k] = await cellAt(P[k]);
  await js('__mmb.setTool("cliff")');
  await drag(P.cliff, { x: P.cliff.x + 70, y: P.cliff.y + 10 }, 500);
  await js('__mmb.setTool("river")');
  await drag(P.river, { x: P.river.x + 160, y: P.river.y + 60 }, 900);
  await js('__mmb.setTool("paint")');
  // Bảng màu vật liệu: hiện khi dùng cọ tô; bấm ô nào thì tô đúng loại đó.
  await js('document.querySelector(\'#mat-palette button[data-mat="4"]\').click()');
  await drag(at(60, 300), at(90, 300), 300);
  const sandCell = await cellAt(at(75, 300));
  const palChk = await js(`(()=>{const t=__mmb.terrain,c=${JSON.stringify(sandCell)};return {shown:!document.getElementById('mat-palette').hidden,mat:t.material[c.z*t.size+c.x],head:document.querySelector('#mat-palette h4').textContent}})()`);
  console.log('bảng vật liệu', palChk);
  if (!(palChk.shown && palChk.mat === 4 && palChk.head === 'Đang tô: Cát')) throw new Error('Bảng màu vật liệu sai');
  await js('document.querySelector(\'#mat-palette button[data-mat="8"]\').click()');
  await drag(P.paint, { x: P.paint.x + 120, y: P.paint.y - 30 }, 600);
  await js('__mmb.setTool("biome")');
  await js('(()=>{const e=document.getElementById("brush-size");e.value=40;e.dispatchEvent(new Event("input"))})()');
  await drag(P.biome, { x: P.biome.x + 60, y: P.biome.y + 20 }, 600);
  await sleep(150);
  await shot('5-step3.png');
  const visible = await js('[...document.querySelectorAll(".opt")].filter(e=>!e.hidden).map(e=>e.dataset.for)');
  if (visible.join() !== 'biome') throw new Error('Tuỳ chọn theo cọ hiển thị sai: ' + visible);
  const chk = await js(`(()=>{const t=__mmb.terrain,n=t.size,c=${JSON.stringify(cells)};const i=(k)=>c[k].z*n+c[k].x;
    return {cliff:Math.round(t.heights[i('cliff')]),water:t.water[i('river')],bed:Math.round(t.heights[i('river')]),mat:t.material[i('paint')],biome:t.biome[i('biome')]}})()`);
  console.log('bước 3', cells, chk);
  if (!(chk.cliff >= 70 && chk.water > 0 && chk.bed === chk.water - 3 && chk.mat === 8 && chk.biome === 5)) throw new Error('Cọ bước 3 không tác động đúng');

  // Bước 4: [Structure], [Road], điểm xuất hiện.
  const key = async (k) => { wc.sendInputEvent({ type: 'keyDown', keyCode: k }); wc.sendInputEvent({ type: 'char', keyCode: k }); wc.sendInputEvent({ type: 'keyUp', keyCode: k }); await sleep(80); };
  const click = async (p, mods = []) => {
    wc.sendInputEvent({ type: 'mouseMove', ...p, modifiers: mods }); await sleep(80);
    wc.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1, modifiers: mods });
    wc.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1, modifiers: mods }); await sleep(120);
  };
  const files = await js('[...document.getElementById("schem-list").children].map(b=>b.dataset.name)');
  const groups0 = await js('[...document.getElementById("schem-group").options].map(o=>o.value+":"+o.text)');
  console.log('nhóm', groups0);
  if (files.join() !== 'hut.schem' || groups0.join('|') !== ':Thư mục gốc (1)|bo_tuong_da:Hệ tường đá (có sẵn) (8)|co_ban:Cơ bản (có sẵn) (10)|okinawa_bo_sung:Okinawa bổ sung (có sẵn) (24)|san_bay:Sân bay (có sẵn) (12)|tau_my:Tàu thuyền Mỹ WW2 (có sẵn) (20)|tham_chieu:Đồ vật và nhà cửa (có sẵn) (24)|the_chien_2:Thế chiến 2 (có sẵn) (42)') throw new Error('Danh sách schem sai: ' + files + ' / ' + groups0);
  const card = await js('(()=>{const c=document.querySelector("#schem-list .card");const cv=c.querySelector("canvas");const d=cv.getContext("2d").getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return {name:c.querySelector(".name").textContent,dims:c.querySelector(".dims").textContent,painted:n}})()');
  console.log('ô công trình', card);
  if (!(card.name === 'hut' && card.dims.startsWith('5 x 4 x 7') && card.painted > 2000)) throw new Error('Ô xem trước công trình sai');
  await js('document.querySelector("#schem-list .card").click()'); await sleep(400);
  if ((await js('__mmb.state.tool')) !== 'structure') throw new Error('Chọn schem không chuyển sang công cụ Structure');
  const S = at(-150, -300), S2 = at(-330, 300);
  cells.struct = await cellAt(S); cells.struct2 = await cellAt(S2);
  await click(S);                       // căn nhà thứ nhất, không xoay
  await key('r');                       // xoay 90 độ
  await click(S2);                      // căn thứ hai
  await click(at(-450, -330));          // căn thứ ba, sẽ bị gỡ
  await shot('6-structures.png');
  // Texture thật (từ jar giả): bật thì mặt đất và công trình có nhiều màu điểm ảnh hơn hẳn so với vẽ bằng màu.
  await sleep(600);
  const uniq = () => js('(()=>{const c=document.getElementById("view"),g=c.getContext("2d"),d=g.getImageData(0,0,c.width,c.height).data,s=new Set();for(let i=0;i<d.length;i+=4)s.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);return s.size})()');
  const texAvail = await js('__mmb.textures.available');
  const withTex = await uniq();
  await js('(()=>{const e=document.getElementById("show-tex");e.checked=false;e.dispatchEvent(new Event("change"))})()'); await sleep(300);
  const noTex = await uniq();
  await js('(()=>{const e=document.getElementById("show-tex");e.checked=true;e.dispatchEvent(new Event("change"))})()'); await sleep(300);
  const tms = await js('(()=>{const t=(on)=>{__mmb.view.useTex=on;const a=performance.now();for(let i=0;i<5;i++)__mmb.view.render();return (performance.now()-a)/5};const r=[t(false),t(true)].map(v=>Math.round(v));return [r[1],r[0]]})()');
  console.log('texture', texAvail, withTex, noTex, 'ms/khung (có, không)', tms);
  if (!texAvail || !(withTex > noTex * 1.3)) throw new Error('Texture Minecraft không hiện: ' + [texAvail, withTex, noTex]);
  await shot('6-textures.png');
  // Mob thông dụng vẽ bằng mô hình hộp có texture (zombie, bò, cừu) thay vì ký hiệu.
  const mobOk = await js(`(async()=>{const T=__mmb.terrain,v=__mmb.view,c=${JSON.stringify(cells.struct)};const base=T.mobs.length;
    for(const [id,dx] of [['minecraft:zombie',6],['minecraft:cow',9],['minecraft:sheep',12],['minecraft:spider',17],['minecraft:wolf',19],['minecraft:iron_golem',22],['minecraft:horse',25],['minecraft:enderman',28],['minecraft:witch',31],['minecraft:minecart',34],['minecraft:oak_boat',37],['minecraft:armor_stand',40],['minecraft:ravager',44]]) T.mobs.push({id,snbt:'',x:c.x+dx+0.5,z:c.z+0.5,yaw:30,noAI:true,persist:true,dy:0,label:id,g:null,cave:false});
    v.mobs=T.mobs;v.render();await new Promise(r=>setTimeout(r,900));v.render();
    T.mobs.push({id:'minecraft:zombie',snbt:'{HandItems:[{id:"minecraft:iron_sword",Count:1b},{}],ArmorItems:[{id:"minecraft:iron_boots",Count:1b},{id:"minecraft:iron_leggings",Count:1b},{id:"minecraft:diamond_chestplate",Count:1b},{id:"minecraft:iron_helmet",Count:1b}]}',x:c.x+15.5,z:c.z+0.5,yaw:30,noAI:true,persist:true,dy:0,label:'a',g:null,cave:false});
    v.render();await new Promise(r=>setTimeout(r,900));v.render();
    const n=(v._modeled?v._modeled.size:-1)+(v.tx.entity.get('models/armor/iron_layer_1')&&v.tx.entity.get('models/armor/diamond_layer_1')&&v.tx.entity.get('models/armor/iron_layer_2')&&v.tx.entity.get('item/iron_sword')?100:0);window.__mobBase=base;return n})()`);
  console.log('mob dạng khối', mobOk);
  if (mobOk < 111) throw new Error('Mob không vẽ bằng mô hình có texture: ' + mobOk);
  await shot('6-mobs3d.png');
  // Xem 3D (WebGL): dựng cảnh, đếm màu và điểm không phải bầu trời, xoay camera rồi chụp.
  await js("__mmb.applyBrush(__mmb.terrain,522,522,{tool:'deco',radius:22,density:1,decoList:[1,5,17],dt:0.016,strength:1})");
  await js('__mmb.toggle3D(true)'); await sleep(1500);
  const p3 = await js('JSON.stringify(__mmb.v3.probe())');
  console.log('3D', p3);
  const q3 = JSON.parse(p3);
  if (!(q3.colors > 200 && q3.nonSky > 0.5 && q3.quads > 1000 && q3.meshes >= 3)) throw new Error('Cảnh 3D trống hoặc quá ít chi tiết: ' + p3);
  await shot('7-3d-a.png');
  await js('(()=>{const v=__mmb.v3;v.yaw+=2.2;v.pitch=0.3;v.dist=35})()'); await sleep(2500);
  await shot('7-3d-b.png');
  const p4 = JSON.parse(await js('JSON.stringify(__mmb.v3.probe())'));
  if (!(p4.nonSky > 0.3 && p4.colors > 100)) throw new Error('Cảnh 3D sau khi xoay trống: ' + JSON.stringify(p4));
  await js('(()=>{const v=__mmb.v3;v.pitch=1.45;v.dist=170;v.yaw=0.8})()'); await sleep(2500);
  await shot('7-3d-c.png');
  await js('__mmb.terrain.deco.fill(0)');
  // Sửa trong 3D: bật chế độ sửa, chọn cọ nâng, bấm giữa màn hình 3D bằng chuột thật rồi kiểm độ cao đổi và hoàn tác.
  await js('(()=>{const v=__mmb.v3;v.yaw=0.8;v.pitch=0.9;v.dist=60})()'); await sleep(800);
  const prevTool = await js('__mmb.state.tool');
  await js("document.getElementById('btn-edit3d').click()");
  await js("document.querySelector('#tools button[data-tool=raise]').click()");
  const pk = JSON.parse(await js("(()=>{const c=document.getElementById('view3d').getBoundingClientRect();const v=__mmb.v3;const cell=v.pick(c.width/2,c.height/2);return JSON.stringify({cell,h:__mmb.terrain.heights[cell.z*__mmb.terrain.size+cell.x],cx:c.left+c.width/2,cy:c.top+c.height/2})})()"));
  const pp = { x: Math.round(pk.cx), y: Math.round(pk.cy) }; wc.sendInputEvent({ type: 'mouseMove', ...pp }); await sleep(100); wc.sendInputEvent({ type: 'mouseDown', ...pp, button: 'left', clickCount: 1 }); await sleep(500); wc.sendInputEvent({ type: 'mouseUp', ...pp, button: 'left', clickCount: 1 }); await sleep(700);
  const h2 = await js('__mmb.terrain.heights[' + pk.cell.z + '*__mmb.terrain.size+' + pk.cell.x + ']');
  console.log('sửa 3D', JSON.stringify(pk.cell), pk.h, '->', h2);
  if (!(h2 > pk.h + 0.3)) throw new Error('Sửa trong 3D không đổi độ cao: ' + pk.h + ' -> ' + h2);
  await js('__mmb.v3.dist=40'); await sleep(2000);
  await shot('7-3d-edit.png');
  await js("document.getElementById('btn-undo').click()"); await sleep(300);
  const h3 = await js('__mmb.terrain.heights[' + pk.cell.z + '*__mmb.terrain.size+' + pk.cell.x + ']');
  await js(`__mmb.setTool(${JSON.stringify(prevTool)})`);
  if (Math.abs(h3 - pk.h) > 0.01) throw new Error('Hoàn tác sau khi sửa 3D không trả lại độ cao: ' + h3 + ' vs ' + pk.h);
  await js("__mmb.setTool('elev')"); await sleep(1200); await shot('7-elev.png');
  await js(`__mmb.setTool(${JSON.stringify(prevTool)})`);
  await js('__mmb.toggle3D(false)'); await sleep(200);
  if (await js('document.getElementById("view3d").style.display') !== 'none') throw new Error('Không thoát được chế độ 3D');
  await js('(()=>{__mmb.terrain.mobs.length=window.__mobBase;__mmb.view.render()})()');
  // Cọ trang trí: chọn hai loại hoa, kéo chuột thật, kiểm lớp trang trí có đúng hai loại, rồi hoàn tác.
  {
    const prev = await js('__mmb.state.tool'), before = await js('__mmb.state.undo.length');
    await js("__mmb.setTool('deco')"); await sleep(200);
    if (await js("document.getElementById('deco-palette').hidden")) throw new Error('Bảng trang trí không hiện');
    await js("(()=>{const dp=document.getElementById('deco-palette');dp.querySelector('button[data-deco=\"1\"]').click();dp.querySelector('button[data-deco=\"5\"]').click();})()");
    const sel = JSON.parse(await js('JSON.stringify([...__mmb.state.decoSel])'));
    await js("(()=>{const e=document.getElementById('deco-density');e.value=100;e.dispatchEvent(new Event('input'))})()");
    await mouseDrag(at(-40, 120), at(40, 120)); await sleep(200);
    const set = JSON.parse(await js('JSON.stringify([...new Set(__mmb.terrain.deco)].filter(Boolean))'));
    console.log('trang trí', JSON.stringify(sel), JSON.stringify(set), JSON.stringify(await cellAt(at(-40, 120))), await js('document.getElementById("msg")?.textContent'), await js('__mmb.terrain.deco.length+" "+__mmb.terrain.deco.reduce((a,b)=>a+(b?1:0),0)+" r="+__mmb.state.radius'), await js('__mmb.state.tool+" "+__mmb.state.decoDensity+" "+__mmb.state.undo.length'));
    if (!set.length || set.some((v) => !sel.includes(v))) throw new Error('Cọ trang trí không rải đúng loại đã chọn: ' + JSON.stringify([sel, set]));
    await shot('7-deco.png');
    await js("document.getElementById('btn-undo').click()"); await sleep(200);
    if (await js('__mmb.terrain.deco.some((v)=>v)')) throw new Error('Hoàn tác không xoá trang trí');
    await js(`__mmb.setTool(${JSON.stringify(prev)})`);
  }
  await click(at(-450, -330), ['shift']);
  const pls = await js('JSON.stringify(__mmb.terrain.placements)');
  console.log('công trình', pls, await js('document.getElementById("st-msg").textContent'));
  const pl = JSON.parse(pls);
  if (!(pl.length === 2 && pl[0].rot === 0 && pl[1].rot === 1 && pl[0].x === cells.struct.x - 2 && pl[1].x === cells.struct2.x - 3)) throw new Error('Đặt/gỡ công trình sai');

  // Nhóm "Cơ bản" đi kèm chương trình: đủ 10 ô, ô nào cũng vẽ được hình; đặt thử một tháp canh.
  await js('(()=>{const s=document.getElementById("schem-group");s.value="co_ban";s.dispatchEvent(new Event("change"))})()'); await sleep(1500);
  const starter = await js('[...document.querySelectorAll("#schem-list .card")].map(c=>{const cv=c.querySelector("canvas");const d=cv.getContext("2d").getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return c.querySelector(".name").textContent+":"+(c.classList.contains("failed")?"LỖI":n>500?"ok":"trống")})');
  console.log('cơ bản', starter.join(' '));
  if (starter.length !== 10 || starter.some((v) => !v.endsWith(':ok'))) throw new Error('Bộ công trình cơ bản hiển thị sai');
  await shot('6b-starter.png');
  // Bộ Thế chiến 2: đủ 42 ô, ô nào cũng vẽ được hình.
  await js('(()=>{const s=document.getElementById("schem-group");s.value="the_chien_2";s.dispatchEvent(new Event("change"))})()'); await sleep(2500);
  const ww2 = await js('[...document.querySelectorAll("#schem-list .card")].map(c=>{const cv=c.querySelector("canvas");const d=cv.getContext("2d").getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return c.querySelector(".name").textContent+":"+(c.classList.contains("failed")?"LỖI":n>300?"ok":"trống")})');
  console.log('thế chiến 2', ww2.join(' '));
  if (ww2.length !== 42 || ww2.some((v) => !v.endsWith(':ok'))) throw new Error('Bộ công trình Thế chiến 2 hiển thị sai');
  await shot('6c-ww2.png');
  await js('(()=>{const s=document.getElementById("schem-group");s.value="san_bay";s.dispatchEvent(new Event("change"))})()'); await sleep(2500);
  const air = await js('[...document.querySelectorAll("#schem-list .card")].map(c=>{const cv=c.querySelector("canvas");const d=cv.getContext("2d").getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return c.querySelector(".name").textContent+":"+(c.classList.contains("failed")?"LỖI":n>300?"ok":"trống")})');
  console.log('sân bay', air.join(' '));
  if (air.length !== 12 || air.some((v) => !v.endsWith(':ok'))) throw new Error('Bộ công trình sân bay hiển thị sai');
  await shot('6d-airfield.png');
  await js('(()=>{const s=document.getElementById("schem-group");s.value="co_ban";s.dispatchEvent(new Event("change"))})()'); await sleep(1500);
  await js('document.querySelector(\'#schem-list .card[data-name="co_ban/thap_canh_go.schem"]\').click()'); await sleep(200);
  const T = at(-440, -120); cells.tower = await cellAt(T);
  await click(T);
  // Nhập làng từ file jar (giả lập) rồi đặt một căn nhà làng.
  await js('document.getElementById("btn-import-village").click()'); await sleep(2500);
  const vg = await js('({groups:[...document.getElementById("schem-group").options].map(o=>o.text),sel:document.getElementById("schem-group").value,cards:[...document.querySelectorAll("#schem-list .card")].map(c=>c.dataset.name+"="+c.querySelector(".dims").textContent),msg:document.getElementById("st-msg").textContent})');
  console.log('nhập làng', vg);
  if (!(vg.sel === 'lang_desert' && vg.groups.includes('Làng đồng cỏ (3)') && vg.cards.join() === 'lang_desert/desert_small_house_1.schem=3 x 2 x 4' && vg.msg.startsWith('Đã nhập 4 '))) throw new Error('Nhập làng sai');
  await js('document.querySelector("#schem-list .card").click()'); await sleep(200);
  const V = at(-440, 40); cells.village = await cellAt(V);
  await click(V);
  if ((await js('__mmb.terrain.placements.length')) !== 4) throw new Error('Đặt tháp canh / nhà làng không thành');

  await js('document.querySelector(\'.tab[data-tab="road"]\').click()');
  await js('document.querySelectorAll("#road-list button")[3].click()');
  await js('(()=>{const c=document.getElementById("road-grade");c.checked=true;c.dispatchEvent(new Event("change"));const e=document.getElementById("brush-size");e.value=4;e.dispatchEvent(new Event("input"))})()');
  const R0 = at(40, 340), R1 = at(215, 60);
  cells.road = await cellAt(R0);
  await js('window.__matBefore = __mmb.terrain.material.slice()');
  await drag(R0, R1, 2500);
  const road = await js(`(()=>{const t=__mmb.terrain,n=t.size,c=${JSON.stringify(cells.road)},old=window.__matBefore;let cnt=0,steep=0,hi=0;
    const isRoad=(i)=>t.material[i]!==old[i];
    for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++){const i=z*n+x;if(!isRoad(i))continue;cnt++;const h=Math.round(t.heights[i]);hi=Math.max(hi,h);
      for(const j of [i+1,i+n]){if(isRoad(j)&&Math.abs(Math.round(t.heights[j])-h)>1)steep++}}
    return {start:t.material[c.z*n+c.x],cnt,steep,hi}})()`);
  console.log('đường', road);
  if (!(road.start === 8 && road.cnt > 200 && road.steep === 0 && road.hi > 70)) throw new Error('Đường có làm thoải không đạt');

  // Hang: đánh dấu vùng hang, đào một khoang, mở cửa hang — bằng chuột thật.
  await js('(()=>{const e=document.getElementById("brush-size");e.value=14;e.dispatchEvent(new Event("input"))})()');
  const CV = at(-470, 300), cvCell = await cellAt(CV);
  await js('__mmb.setTool("cavearea")'); await drag(CV, { x: CV.x + 30, y: CV.y }, 300);
  await js('__mmb.setTool("cavedig")'); await drag(CV, { x: CV.x + 10, y: CV.y }, 300);
  await js('(()=>{const e=document.getElementById("brush-size");e.value=2;e.dispatchEvent(new Event("input"))})()');
  await js('__mmb.setTool("caveopen")'); await drag(CV, { x: CV.x + 2, y: CV.y }, 200);
  await shot('7b-caves.png');
  const cave = await js(`(()=>{const t=__mmb.terrain,c=${JSON.stringify(cvCell)},i=c.z*t.size+c.x;return {x:c.x,z:c.z,h:Math.round(t.heights[i]),mask:t.caveMask[i],floor:t.caveFloor[i],tall:t.caveHeight[i],shown:__mmb.view.showCaves,opts:[...document.querySelectorAll(".opt")].filter(e=>!e.hidden).length}})()`);
  console.log('hang', cave);
  if (!(cave.mask === 3 && cave.floor === cave.h - 20 && cave.tall === 7 && cave.shown)) throw new Error('Công cụ hang sai');
  // Road chế độ "Đặt thẳng": bấm hai điểm, đường chạy thẳng giữa hai điểm; Esc kết thúc chuỗi.
  await js('document.querySelector(\'input[name="road-mode"][value="line"]\').click()');
  await js('(()=>{const e=document.getElementById("brush-size");e.value=3;e.dispatchEvent(new Event("input"));window.__matBefore=__mmb.terrain.material.slice()})()');
  const L0 = at(-440, -100), L1 = at(-300, -260);
  const lc0 = await cellAt(L0), lc1 = await cellAt(L1);
  await click(L0); await click(L1);
  wc.sendInputEvent({ type: 'mouseMove', ...at(-250, -200) }); await sleep(150);
  await shot('7a-road-line.png');
  await key('Escape');
  const lineRes = await js(`(()=>{const t=__mmb.terrain,n=t.size,a=${JSON.stringify(lc0)},b=${JSON.stringify(lc1)},old=window.__matBefore;let on=0,tot=0,cnt=0;
    for(let k=0;k<=20;k++){const x=Math.round(a.x+(b.x-a.x)*k/20),z=Math.round(a.z+(b.z-a.z)*k/20);tot++;if(t.material[z*n+x]!==old[z*n+x])on++}
    for(let i=0;i<old.length;i++)if(t.material[i]!==old[i])cnt++;
    return {on,tot,cnt,len:Math.hypot(b.x-a.x,b.z-a.z),start:__mmb.state.lineStart,undo:__mmb.state.undo.length}})()`);
  console.log('đường thẳng', lineRes);
  if (!(lineRes.on === lineRes.tot && lineRes.cnt > lineRes.len * 3 && lineRes.cnt < lineRes.len * 12 && lineRes.start === null)) throw new Error('Road đặt thẳng sai');
  await js('document.querySelector(\'input[name="road-mode"][value="brush"]\').click()');
  // Đường băng (dải có vạch kẻ) và hào đào: chọn trong danh sách Road, vẽ bằng chuột thật rồi hoàn tác.
  const undo0 = await js('__mmb.state.undo.length');
  await js('document.querySelector(\'.tab[data-tab="road"]\').click()');
  await js('document.querySelectorAll("#road-list button")[6].click()');
  const rsel = await js('({mode:__mmb.state.roadMode,r:__mmb.state.radius,g:document.getElementById("road-grade").checked,name:document.querySelector("#road-list button.active")?.textContent})');
  console.log('chọn đường băng', rsel);
  if (!(rsel.mode === 'line' && rsel.r === 7 && rsel.g && rsel.name === 'Đường băng')) throw new Error('Chọn Đường băng không tự chuyển sang Đặt thẳng / cỡ cọ / ép phẳng');
  const A0 = at(-300, 120), A1 = at(-120, 120);
  const ac0 = await cellAt(A0), ac1 = await cellAt(A1);
  await click(A0); await click(A1); await key('Escape');
  const rwy = await js(`(()=>{const t=__mmb.terrain,n=t.size,a=${JSON.stringify(ac0)},b=${JSON.stringify(ac1)};let w=0,asph=0,flat=true;const h0=Math.round(t.heights[a.z*n+a.x]);
    for(let z=Math.min(a.z,b.z)-8;z<=Math.max(a.z,b.z)+8;z++)for(let x=Math.min(a.x,b.x)-8;x<=Math.max(a.x,b.x)+8;x++){const m=t.material[z*n+x];if(m===15)w++;if(m===14){asph++;if(Math.round(t.heights[z*n+x])!==h0)flat=false}}
    return {w,asph,flat,len:Math.hypot(b.x-a.x,b.z-a.z)}})()`);
  console.log('đường băng', rwy);
  if (!(rwy.w > 20 && rwy.asph > rwy.len * 8 && rwy.flat)) throw new Error('Đường băng vẽ sai');
  await js('document.querySelector(\'input[name="road-mode"][value="brush"]\').click()');
  await js('document.querySelectorAll("#road-list button")[9].click()');
  const B0 = at(-300, 230), B1 = at(-200, 230);
  await drag(B0, B1, 600);
  const tr = await js(`(()=>{const t=__mmb.terrain;let p=0,l=0,deep=0;for(let i=0;i<t.material.length;i++){if(t.material[i]===17)p++;if(t.material[i]===18)l++}return {p,l}})()`);
  console.log('hào', tr);
  if (!(tr.p > 20 && tr.l > 20)) throw new Error('Hào đào vẽ sai');
  await shot('7c-airfield-trench.png');
  for (let k = 0; k < 2; k++) { await js('window.dispatchEvent(new KeyboardEvent("keydown",{key:"z",code:"KeyZ",ctrlKey:true,bubbles:true}))'); await sleep(150); }
  const back = await js('(()=>{const t=__mmb.terrain;let c=0;for(let i=0;i<t.material.length;i++)if(t.material[i]===14||t.material[i]===15||t.material[i]===17||t.material[i]===18)c++;return {c,undo:__mmb.state.undo.length}})()');
  if (back.c !== 0) throw new Error('Hoàn tác đường băng/hào không sạch: ' + JSON.stringify(back) + ' undo0=' + undo0);
  await js('document.querySelectorAll("#road-list button")[0].click()'); await sleep(100);
  await js('__mmb.setTool("spawn")');
  const SP = at(-480, 200); cells.spawn = await cellAt(SP);
  await click(SP);
  const spn = await js('JSON.stringify(__mmb.terrain.spawn)');
  if (spn !== JSON.stringify(cells.spawn)) throw new Error('Đặt điểm xuất hiện sai: ' + spn);
  await sleep(150);
  await shot('7-step4.png');

  // Mob: đặt đội hình bằng chuột thật, gỡ bằng Shift + bấm, hoàn tác, mob mod tuỳ chỉnh.
  await js(`(()=>{const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input'))};
    set('mob-count',6);set('mob-form','line');set('mob-space',3);const n=document.getElementById('mob-noai');n.checked=true;
    __mmb.selectMob({id:'minecraft:zombie',snbt:'{Tags:["e2e"],' + 'ArmorItems:[{},{},{},{id:"minecraft:iron_helmet",Count:1b}]}',name:'Zombie thử'})})()`);
  if ((await js('__mmb.state.tool')) !== 'mob') throw new Error('Chọn mob không chuyển sang công cụ Mob');
  const MP = at(-300, 150); cells.mob = await cellAt(MP);
  await click(MP);
  let mobs = await js('JSON.stringify(__mmb.terrain.mobs.map(m=>[m.id,m.x,m.z,m.yaw,m.noAI]))');
  mobs = JSON.parse(mobs);
  console.log('mob đã đặt', mobs.length);
  if (mobs.length !== 6 || !mobs.every((m) => m[0] === 'minecraft:zombie' && m[4] === true)) throw new Error('Đặt đội hình mob sai');
  if (new Set(mobs.map((m) => m[1].toFixed(2))).size !== 6 && new Set(mobs.map((m) => m[2].toFixed(2))).size !== 6) throw new Error('Các mob chồng lên nhau');
  await js('(()=>{const e=document.getElementById("brush-size");e.value=30;e.dispatchEvent(new Event("input"))})()');
  await click(MP, ['shift']);
  if ((await js('__mmb.terrain.mobs.length')) !== 0) throw new Error('Shift + bấm không gỡ được mob: ' + await js('document.getElementById("st-msg").textContent + " r=" + __mmb.state.radius + " n=" + __mmb.terrain.mobs.length + " tool=" + __mmb.state.tool'));
  await js('document.getElementById("btn-undo").click()');
  if ((await js('__mmb.terrain.mobs.length')) !== 6) throw new Error('Hoàn tác không trả lại mob');
  // Mob của mod: ID và NBT tuỳ ý, đặt một con, quay mặt về hướng khác bằng phím R.
  await js(`(()=>{const e=document.getElementById('mob-count');e.value=1;e.dispatchEvent(new Event('input'));
    __mmb.selectMob({id:'recruits:recruit',snbt:'{Tags:["doi1"],Health:30.0f}',name:'Lính thử'})})()`);
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'r' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'r' }); await sleep(100);
  const MP2 = at(-150, 200); cells.mob2 = await cellAt(MP2);
  await click(MP2);
  await sleep(150);
  await shot('8-mobs.png');
  // Rê chuột lên mob và công trình: hiện tên; bảng [Đã đặt]: bấm để nhảy tới, ✕ để gỡ rồi hoàn tác.
  const tipAt = async (p) => { wc.sendInputEvent({ type: 'mouseMove', x: p.x + 1, y: p.y }); await sleep(60); wc.sendInputEvent({ type: 'mouseMove', ...p }); await sleep(150); return js('document.getElementById("tip").hidden ? "" : document.getElementById("tip").textContent'); };
  const q = await js('(()=>{const m=__mmb.view.mobScreen[6];return {x:m.px,y:m.py}})()');
  await js('__mmb.setTool("raise")');
  const tipMob = await tipAt({ x: Math.round(rect.x + q.x), y: Math.round(rect.y + q.y) });
  const tipSt = await tipAt(S);
  await shot('9-hover.png');
  console.log('rê chuột', [tipMob, tipSt]);
  if (!tipMob.startsWith('Mob: Lính thử (recruits:recruit)') || !tipSt.startsWith('Công trình: hut')) throw new Error('Rê chuột không hiện đúng tên');
  await js('document.querySelector(\'.tab[data-tab="placed"]\').click()');
  const rows = await js('[...document.querySelectorAll("#placed-list .prow .go span")].map(e=>e.textContent)');
  console.log('đã đặt', rows);
  if (rows.length !== 4 + 2 || !rows.includes('Zombie thử ×6')) throw new Error('Bảng Đã đặt sai: ' + rows);
  await js('document.querySelectorAll("#placed-list .prow .go")[2].click()'); await sleep(200);
  const cam = await js('({x:__mmb.view.camX,z:__mmb.view.camZ,hi:__mmb.view.hi,p:__mmb.terrain.placements[2]})');
  if (!(cam.hi && cam.hi.x0 === cam.p.x && Math.abs(cam.x - cam.p.x) < 20)) throw new Error('Bấm dòng Đã đặt không nhảy tới công trình');
  await shot('10-placed.png');
  await js('document.querySelectorAll("#placed-list .prow .rm")[4].click()');
  if ((await js('__mmb.terrain.mobs.length')) !== 1) throw new Error('✕ không gỡ nhóm mob');
  await js('document.getElementById("btn-undo").click()');
  if ((await js('__mmb.terrain.mobs.length')) !== 7) throw new Error('Hoàn tác sau ✕ sai');
  // Bản đồ nhỏ: bấm vào góc trên trái thì khung nhìn nhảy về đó, rồi trả lại chỗ cũ.
  const camBefore = await js('({x:__mmb.view.camX,z:__mmb.view.camZ})');
  const mm = await js('(()=>{const r=document.getElementById("minimap").getBoundingClientRect();return {x:r.left,y:r.top,w:r.width}})()');
  await click({ x: Math.round(mm.x + mm.w * 0.25), y: Math.round(mm.y + mm.w * 0.25) });
  const camMini = await js('({x:__mmb.view.camX,z:__mmb.view.camZ,n:__mmb.terrain.mobs.length})');
  console.log('bản đồ nhỏ', camMini);
  if (Math.abs(camMini.x - 256) > 12 || Math.abs(camMini.z - 256) > 12 || camMini.n !== 7) throw new Error('Bấm bản đồ nhỏ không nhảy đúng chỗ');
  await shot('11-minimap.png');
  await js(`(()=>{__mmb.view.camX=${camBefore.x};__mmb.view.camZ=${camBefore.z};__mmb.state.dirty=true})()`); await sleep(150);
  const mobInfo = await js(`(()=>{const t=__mmb.terrain,n=t.size;return t.mobs.map(m=>{const x=Math.floor(m.x),z=Math.floor(m.z);
    const onStruct=t.placements.some(p=>{const s=__mmb.library.get(p.name);if(!s)return false;const [w,l]=(p.rot&1)?[s.l,s.w]:[s.w,s.l];return x>=p.x&&x<p.x+w&&z>=p.z&&z<p.z+l});
    return {id:m.id,x:m.x,z:m.z,yaw:m.yaw,noAI:m.noAI,snbt:m.snbt,y:Math.round(t.heights[z*n+x])+1,onStruct}})})()`);
  if (mobInfo.length !== 7 || mobInfo[6].id !== 'recruits:recruit' || mobInfo[6].yaw !== 45) throw new Error('Mob mod hoặc hướng mặt sai: ' + JSON.stringify(mobInfo[6]));

  // Cây và vật thể: đặt một cây bằng chuột, vẽ rừng hỗn hợp bằng cách kéo chuột, gỡ bằng Shift, hoàn tác; ruộng có mương.
  await js('document.querySelector(\'.tab[data-tab="prop"]\').click()');
  await js('(()=>{const e=document.getElementById("brush-size");e.value=3;e.dispatchEvent(new Event("input"))})()');
  await js('__mmb.selectProp("oak")');
  if ((await js('__mmb.state.tool')) !== 'prop') throw new Error('Chọn cây không chuyển sang công cụ Cây');
  const TP = at(-380, -40); cells.tree = await cellAt(TP);
  await click(TP);
  const one = JSON.parse(await js('JSON.stringify(__mmb.terrain.props)'));
  console.log('cây đặt từng cái', one);
  if (one.length !== 1 || one[0].k !== 'oak' || one[0].x !== cells.tree.x || one[0].z !== cells.tree.z) throw new Error('Đặt một cây bằng chuột sai');
  await js('document.querySelector(\'input[name="prop-mode"][value="brush"]\').click()');
  await js('(()=>{const e=document.getElementById("brush-size");e.value=18;e.dispatchEvent(new Event("input"));const m=document.getElementById("prop-mix");m.value="taiga";m.dispatchEvent(new Event("change"))})()');
  const F0 = at(-430, 260), F1 = at(-300, 300);
  await drag(F0, F1, 900);
  const forest = JSON.parse(await js('JSON.stringify(__mmb.terrain.props)'));
  const kinds = new Set(forest.map((p) => p.k));
  console.log('rừng', forest.length, [...kinds].join(','));
  if (forest.length < 25 || !kinds.has('spruce')) throw new Error('Vẽ rừng không ra đủ cây: ' + forest.length);
  let tooClose = 0;
  for (let i = 0; i < forest.length; i++) for (let j = i + 1; j < forest.length; j++) if (Math.hypot(forest[i].x - forest[j].x, forest[i].z - forest[j].z) < 1.5) tooClose++;
  if (tooClose) throw new Error('Có cây mọc chồng lên nhau: ' + tooClose);
  await shot('7d-props.png');
  await click(F0, ['shift']);
  const afterErase = await js('__mmb.terrain.props.length');
  if (!(afterErase < forest.length)) throw new Error('Shift + bấm không gỡ được cây');
  await js('document.getElementById("btn-undo").click()');
  if ((await js('__mmb.terrain.props.length')) !== forest.length) throw new Error('Hoàn tác việc gỡ cây không trả lại đủ');
  await js('document.getElementById("btn-undo").click()'); // hoàn tác cả nét vẽ rừng
  if ((await js('__mmb.terrain.props.length')) !== 1) throw new Error('Hoàn tác nét vẽ rừng sai: ' + await js('__mmb.terrain.props.length'));
  await js('__mmb.selectProp("ore_diamond")');
  if (await js('document.getElementById("prop-variant-row").hidden')) throw new Error('Khoáng sản phải có chọn dạng');
  await js('document.querySelector(\'input[name="prop-mode"][value="place"]\').click()');
  const OP = at(-250, -40); cells.ore = await cellAt(OP);
  await click(OP);
  if ((await js('__mmb.terrain.props.filter(p=>p.k==="ore_diamond").length')) !== 1) throw new Error('Đặt khoáng sản sai');
  // Ruộng lúa mì tô bằng chuột, tự chừa mương tưới.
  await js('(()=>{const e=document.getElementById("brush-size");e.value=12;e.dispatchEvent(new Event("input"))})()');
  await js('__mmb.setTool("paint")');
  await js('(()=>{const m=document.getElementById("paint-material");m.value="20";m.dispatchEvent(new Event("change"));const d=document.getElementById("paint-ditch");d.value="x";d.dispatchEvent(new Event("change"))})()');
  const FA = at(-120, -250), FB = at(-40, -250); cells.farm = await cellAt(FA);
  await drag(FA, FB, 700);
  const farm = await js('(()=>{const t=__mmb.terrain;let w=0,d=0;for(let i=0;i<t.material.length;i++){if(t.material[i]===20)w++;if(t.material[i]===24)d++}return {w,d}})()');
  console.log('ruộng', farm);
  if (!(farm.w > 80 && farm.d > 5)) throw new Error('Tô ruộng/mương sai');
  await shot('7e-farm.png');

  // Mẫu nền: tô bằng chuột thật, các vật liệu trong mẫu đều xuất hiện, Shift xoá về tự động.
  await js('(()=>{const e=document.getElementById("brush-size");e.value=14;e.dispatchEvent(new Event("input"))})()');
  await js('__mmb.setTool("pattern")');
  if (await js('document.getElementById("pat-palette").hidden')) throw new Error('Bảng mẫu nền không hiện');
  await js('document.querySelectorAll("#pat-palette button")[4].click()'); // Bãi sỏi đá
  const PA = at(40, -120), PB = at(120, -120); cells.pat = await cellAt(PA);
  await drag(PA, PB, 700);
  const pat = await js('(()=>{const t=__mmb.terrain;const c={};for(let i=0;i<t.material.length;i++){const m=t.material[i];if(m)c[m]=(c[m]||0)+1}return c})()');
  console.log('mẫu nền', JSON.stringify(pat));
  if (!(pat[7] > 30 && pat[8] > 20 && pat[2] > 20 && pat[30] > 5)) throw new Error('Mẫu nền vẽ sai: ' + JSON.stringify(pat));
  await shot('7f-pattern.png');
  // Nền công trình: đặt hut với "San phẳng, sân quanh và móng" trên chỗ dốc; hoàn tác trả lại như cũ.
  await js('(()=>{const s=document.getElementById("st-pad");s.value="site";s.dispatchEvent(new Event("change"));document.getElementById("st-yoffset").value=0;window.__hBefore=Array.from(__mmb.terrain.heights);window.__nPl=__mmb.terrain.placements.length})()');
  await js('__mmb.state.schem=[...__mmb.library.keys()].find(k=>k.endsWith("hut.schem")||k==="hut");__mmb.setTool("structure")');
  const HP = at(-380, 200); cells.pad = await cellAt(HP);
  await click(HP);
  const padRes = await js(`(()=>{const t=__mmb.terrain,n=t.size,c=${JSON.stringify(cells.pad)},p=t.placements[t.placements.length-1];const s=__mmb.library.get(p.name);const w=(p.rot&1)?s.l:s.w,l=(p.rot&1)?s.w:s.l;let flat=true,apron=0;const L=Math.round(t.heights[c.z*n+c.x]);
    for(let z=p.z;z<p.z+l;z++)for(let x=p.x;x<p.x+w;x++)if(Math.round(t.heights[z*n+x])!==L)flat=false;
    for(let z=p.z-2;z<=p.z+l+1;z++)for(let x=p.x-2;x<=p.x+w+1;x++){const m=t.material[z*n+x];if(m===8||m===7)apron++}
    return {n:t.placements.length,before:window.__nPl,found:p.found,flat,apron}})()`);
  console.log('nền công trình', padRes);
  if (!(padRes.n === padRes.before + 1 && padRes.found === 'minecraft:cobblestone' && padRes.flat && padRes.apron > 20)) throw new Error('Nền công trình sai: ' + JSON.stringify(padRes));
  await shot('7g-pad.png');
  await js('document.getElementById("btn-undo").click()');
  const same = await js('(()=>{const t=__mmb.terrain;if(t.placements.length!==window.__nPl)return false;for(let i=0;i<t.heights.length;i++)if(t.heights[i]!==window.__hBefore[i])return false;return true})()');
  if (!same) throw new Error('Hoàn tác nền công trình không trả lại địa hình cũ');
  await js('(()=>{const s=document.getElementById("st-pad");s.value="found";s.dispatchEvent(new Event("change"))})()');

  // Đặt lặp công trình dọc theo đường: hai lần bấm, nhiều bản liền nhau, một lần hoàn tác gỡ hết.
  await js('(()=>{const c=document.getElementById("st-line");c.checked=true;c.dispatchEvent(new Event("change"));const s=document.getElementById("st-pad");s.value="none";s.dispatchEvent(new Event("change"));window.__nPl2=__mmb.terrain.placements.length})()');
  await js('__mmb.state.schem=[...__mmb.library.keys()].find(k=>k.endsWith("hut.schem")||k==="hut");__mmb.setTool("structure")');
  await click(at(40, 120)); await click(at(200, 120));
  const nLine = await js('__mmb.terrain.placements.length');
  console.log('đặt lặp', nLine - await js('window.__nPl2'));
  if (nLine - await js('window.__nPl2') < 4) throw new Error('Đặt lặp theo đường quá ít công trình');
  await js('document.getElementById("btn-undo").click()');
  if ((await js('__mmb.terrain.placements.length')) !== await js('window.__nPl2')) throw new Error('Hoàn tác đặt lặp chưa gỡ hết');
  await js('(()=>{const c=document.getElementById("st-line");c.checked=false;c.dispatchEvent(new Event("change"));const s=document.getElementById("st-pad");s.value="found";s.dispatchEvent(new Event("change"))})()');
  // Dốc hang: bấm cửa, bấm hướng; sàn hạ dần; hoàn tác.
  await js('__mmb.setTool("cavestair")');
  await js('(()=>{const e=document.getElementById("brush-size");e.value=3;e.dispatchEvent(new Event("input"));const d=document.getElementById("cave-depth");d.value=12;d.dispatchEvent(new Event("input"))})()');
  const nCave0 = await js('(()=>{let n=0;for(const f of __mmb.terrain.caveFloor)if(f>-32768)n++;return n})()');
  await click(at(60, 220)); await click(at(200, 260));
  const rp = await js('(()=>{const t=__mmb.terrain;let n=0,lo=1e9,hi=-1e9;for(let i=0;i<t.caveFloor.length;i++){const f=t.caveFloor[i];if(f>-32768){n++;if(f<lo)lo=f;if(f>hi)hi=f}}return {n,lo,hi}})()');
  console.log('dốc hang', rp);
  if (!(rp.n - nCave0 > 60 && rp.hi - rp.lo >= 10)) throw new Error('Dốc hang đào sai: ' + JSON.stringify(rp));
  await js('document.getElementById("btn-undo").click()');
  if ((await js('(()=>{let n=0;for(const f of __mmb.terrain.caveFloor)if(f>-32768)n++;return n})()')) !== nCave0) throw new Error('Hoàn tác dốc hang chưa sạch');
  // Mob trong hang: ô đánh dấu lưu vào mob.
  await js('(()=>{const c=document.getElementById("mob-cave");c.checked=true})()');
  await js('__mmb.setTool("mob");__mmb.selectMob&&0');
  await js('(()=>{const b=document.querySelector("#mob-list button, #mob-list .card");if(b)b.click()})()');
  await click(at(100, 300));
  const mc = await js('(()=>{const m=__mmb.terrain.mobs;return m.length?m[m.length-1].cave:null})()');
  console.log('mob trong hang', mc);
  await js('document.getElementById("btn-undo").click()');
  await js('(()=>{const c=document.getElementById("mob-cave");c.checked=false})()');

  // Lưu dự án rồi mở lại qua đúng đường IPC, so từng lớp.
  const sum = () => js('(()=>{const t=__mmb.terrain;const s=(a)=>{let h=0;for(let i=0;i<a.length;i+=3)h=(h*31+Math.round(a[i]*8))|0;return h};return [s(t.heights),s(t.water),s(t.material),s(t.biome),t.rules.snowLine,JSON.stringify(t.placements),JSON.stringify(t.spawn),JSON.stringify(t.mobs),JSON.stringify(t.props)].join()})()');
  await js('(()=>{const e=document.getElementById("rule-snow");e.value=140;e.dispatchEvent(new Event("input"))})()');
  const s1 = await sum();
  await js('document.getElementById("btn-save").click()'); await sleep(1500);
  await js('__mmb.setTool("raise")');
  await drag(at(0, 0), at(20, 0), 400);
  if ((await sum()) === s1) throw new Error('Nét vẽ sau khi lưu không đổi gì');
  await js('document.getElementById("btn-open").click()'); await sleep(2000);
  const s2 = await sum();
  console.log('lưu/mở', s1 === s2 ? 'khớp' : 'LỆCH', await js('document.getElementById("st-msg").textContent'));
  if (s1 !== s2) throw new Error('Mở lại dự án không khớp bản đã lưu');
  if ((await js('document.getElementById("rule-snow").value')) !== '140') throw new Error('Thanh trượt quy tắc không theo dự án');
  if ((await js('__mmb.view.structTop.some(v=>v>0)')) !== true) throw new Error('Mở dự án xong không vẽ lại công trình');

  // Xuất world qua đúng đường IPC của chương trình.
  const res = await js(`(async()=>{
    return await window.mapBuilder.exportWorld({...__mmb.packProject(),options:{name:'E2E: thử/xuất?',borderSize:800,mobSpawning:false}});
  })()`);
  console.log('xuất', res);
  if (!res.dir || !fs.existsSync(path.join(res.dir, 'level.dat'))) throw new Error('Xuất world thất bại');
  const probe = await js(`(()=>{const t=__mmb.terrain,c=${JSON.stringify(cells)};const pts=[[512,512],[100,100],[c.cliff.x,c.cliff.z],[c.river.x,c.river.z],[c.paint.x,c.paint.z],[c.biome.x,c.biome.z]];
    return pts.map(([x,z])=>{const i=z*t.size+x;return {x,z,h:Math.round(t.heights[i]),water:t.water[i],mat:t.material[i],biome:t.biome[i]}})})()`);
  const pl2 = await js('__mmb.terrain.placements');
  const hs = await js(`(()=>{const t=__mmb.terrain,c=${JSON.stringify(cells.tree)};return t.heights[c.z*t.size+c.x]})()`);
  const probeH = () => hs;
  // Rương của hut.schem ở (3,1,3); bản xoay 90 độ: (7-1-3, 3) = (3,3) và quay mặt về bắc.
  const blocksExpect = [
    { x: pl2[0].x + 3, y: pl2[0].y + 1, z: pl2[0].z + 3, id: 'chest', facing: 'west', be: 'minecraft:arrow' },
    { x: pl2[1].x + 3, y: pl2[1].y + 1, z: pl2[1].z + 3, id: 'chest', facing: 'north', be: 'minecraft:arrow' },
    { x: pl2[1].x + 5, y: pl2[1].y + 1, z: pl2[1].z + 1, id: 'oak_stairs', facing: 'east' },
    { x: pl2[0].x, y: pl2[0].y, z: pl2[0].z, id: 'oak_planks' },
    // Tháp canh: thang ở (3,5,4) quay mặt nam; lan can cạnh tây (0,10,3) nối bắc-nam.
    { x: pl2[2].x + 3, y: pl2[2].y + 5, z: pl2[2].z + 4, id: 'ladder', facing: 'south' },
    { x: pl2[2].x, y: pl2[2].y + 10, z: pl2[2].z + 3, id: 'spruce_fence', north: 'true' },
    // Nhà làng (từ jar): rương ở (2,1,3) có bánh mì; khối ghép nối đã thành đá cuội.
    { x: pl2[3].x + 2, y: pl2[3].y + 1, z: pl2[3].z + 3, id: 'chest', facing: 'west', be: 'minecraft:bread' },
    { x: pl2[3].x + 1, y: pl2[3].y, z: pl2[3].z, id: 'cobblestone' },
    // Cây sồi đặt bằng chuột: thân ngay trên mặt đất; mỏ kim cương đặt trên mặt đất.
    { x: cells.tree.x, y: Math.round(probeH(cells.tree)) + 1, z: cells.tree.z, id: 'oak_log' },
  ];
  const sp = await js('__mmb.terrain.spawn');
  fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify({ dir: res.dir, probe, blocks: blocksExpect, spawn: sp, mobs: mobInfo, cave }));
}
