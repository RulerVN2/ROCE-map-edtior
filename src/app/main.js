import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { exportWorld } from '../core/world.js';
import { scenarioJson } from '../core/scenario.js';
import { unpackTerrain, terrainToWorld } from '../core/terrain.js';
import { parseSchem, schemSummary, writeSchem } from '../core/schem.js';
import { villageStructuresFromJar } from '../core/mcstructure.js';
import { readZip } from '../core/zip.js';
import { indexEntries, resolveBlocks, readTexture } from '../core/blocktex.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let win = null;

const configFile = () => path.join(app.getPath('userData'), 'config.json');
function readConfig() { try { return JSON.parse(fs.readFileSync(configFile(), 'utf8')); } catch { return {}; } }
function writeConfig(patch) {
  try { fs.writeFileSync(configFile(), JSON.stringify({ ...readConfig(), ...patch })); } catch { /* không quan trọng */ }
}

function defaultSavesDir() {
  const cfg = readConfig();
  if (cfg.savesDir && fs.existsSync(cfg.savesDir)) return cfg.savesDir;
  const guess = path.join(app.getPath('appData'), '.minecraft', 'saves');
  return fs.existsSync(guess) ? guess : app.getPath('documents');
}

// Tên thư mục an toàn trên Windows.
function safeFolderName(name) {
  const s = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim();
  return s || 'RiseOfCubicEmpireMap';
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 880, minWidth: 900, minHeight: 600,
    backgroundColor: '#181b21', title: 'Rise Of Cubic Empire Map Builder', icon: path.join(here, '..', '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(here, 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });
}

// Mẫu mob người dùng tự lưu (mob của mod...), giữ trong config của chương trình.
ipcMain.handle('get-mob-presets', async () => (Array.isArray(readConfig().mobPresets) ? readConfig().mobPresets : []));
ipcMain.handle('set-mob-presets', async (_e, list) => {
  const clean = (Array.isArray(list) ? list : []).slice(0, 200)
    .map((m) => ({ name: String(m.name ?? '').slice(0, 80), id: String(m.id ?? '').slice(0, 120), snbt: String(m.snbt ?? '').slice(0, 20000) }))
    .filter((m) => m.id);
  writeConfig({ mobPresets: clean });
  return true;
});

ipcMain.handle('export-world', async (_e, { meta, layers, schems, options }) => {
  try {
    let saves = process.env.MMB_TEST_EXPORT_DIR;
    if (!saves) {
      const pick = await dialog.showOpenDialog(win, {
        title: 'Chọn thư mục saves của Minecraft',
        defaultPath: defaultSavesDir(),
        properties: ['openDirectory', 'createDirectory'],
      });
      if (pick.canceled || !pick.filePaths[0]) return {};
      saves = pick.filePaths[0];
      writeConfig({ savesDir: saves });
    }
    const dir = path.join(saves, safeFolderName(options.name));
    if (fs.existsSync(dir)) {
      if (!fs.existsSync(path.join(dir, 'level.dat')) && fs.readdirSync(dir).length) {
        return { error: `Thư mục "${dir}" đã có sẵn và không phải world Minecraft. Hãy đổi tên thế giới.` };
      }
      if (!process.env.MMB_TEST_EXPORT_DIR) {
        const ans = await dialog.showMessageBox(win, {
          type: 'warning', buttons: ['Ghi đè', 'Huỷ'], defaultId: 1, cancelId: 1,
          message: `World "${options.name}" đã có trong thư mục này.`,
          detail: 'Ghi đè sẽ xoá world cũ cùng tên (kể cả những gì bạn đã xây trong game).',
        });
        if (ans.response !== 0) return {};
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
    const t0 = Date.now();
    const terrain = unpackTerrain({ meta, layers });
    const library = new Map();
    for (const [name, raw] of Object.entries(schems ?? {})) library.set(name, parseSchem(raw));
    const world = terrainToWorld(terrain, options, library);
    exportWorld(dir, world);
    fs.writeFileSync(path.join(dir, 'aoe2_scenario.json'), JSON.stringify(scenarioJson(terrain.scenario, terrain.mobs), null, 2));
    return { dir, seconds: ((Date.now() - t0) / 1000).toFixed(1), missing: world.missingStructures };
  } catch (err) {
    return { error: 'Không xuất được world: ' + err.message };
  }
});

// Tệp dự án .mcmap: gzip của [độ dài đầu mục][JSON đầu mục][dữ liệu thô từng lớp].
const asBytes = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
export function encodeProject({ meta, layers }) {
  const names = Object.keys(layers);
  const head = Buffer.from(JSON.stringify({ meta, layers: names.map((n) => ({ name: n, bytes: layers[n].byteLength })) }), 'utf8');
  const len = Buffer.alloc(4); len.writeUInt32LE(head.length);
  return zlib.gzipSync(Buffer.concat([len, head, ...names.map((n) => asBytes(layers[n]))]));
}
export function decodeProject(file) {
  const body = zlib.gunzipSync(file);
  const n = body.readUInt32LE(0);
  const head = JSON.parse(body.toString('utf8', 4, 4 + n));
  let pos = 4 + n;
  const copy = (bytes) => { const u = new Uint8Array(bytes); u.set(body.subarray(pos, pos + bytes)); pos += bytes; return u; };
  if (head.format) return { meta: head, layers: { heights: copy(body.length - pos) } }; // tệp bản đầu: chỉ có độ cao
  const layers = {};
  for (const l of head.layers) layers[l.name] = copy(l.bytes);
  return { meta: head.meta, layers };
}

ipcMain.handle('save-project', async (_e, project) => {
  try {
    let file = process.env.MMB_TEST_PROJECT;
    if (!file) {
      const pick = await dialog.showSaveDialog(win, {
        title: 'Lưu dự án', defaultPath: readConfig().projectFile ?? path.join(app.getPath('documents'), 'map.mcmap'),
        filters: [{ name: 'Dự án Rise Of Cubic Empire', extensions: ['mcmap'] }],
      });
      if (pick.canceled || !pick.filePath) return {};
      file = pick.filePath;
    }
    fs.writeFileSync(file, encodeProject(project));
    writeConfig({ projectFile: file });
    return { file };
  } catch (err) {
    return { error: 'Không lưu được: ' + err.message };
  }
});

ipcMain.handle('open-project', async () => {
  try {
    let file = process.env.MMB_TEST_PROJECT;
    if (!file) {
      const pick = await dialog.showOpenDialog(win, {
        title: 'Mở dự án', defaultPath: readConfig().projectFile,
        filters: [{ name: 'Dự án Rise Of Cubic Empire', extensions: ['mcmap'] }], properties: ['openFile'],
      });
      if (pick.canceled || !pick.filePaths[0]) return {};
      file = pick.filePaths[0];
    }
    const project = decodeProject(fs.readFileSync(file));
    const layers = {}, schems = {};
    for (const [k, v] of Object.entries(project.layers)) {
      if (!k.startsWith('schem:')) { layers[k] = v; continue; }
      schems[k.slice(6)] = { raw: v, schem: schemSummary(parseSchem(v)) }; // công trình lưu kèm trong dự án
    }
    writeConfig({ projectFile: file });
    return { meta: project.meta, layers, schems, file };
  } catch (err) {
    return { error: 'Không mở được tệp dự án: ' + err.message };
  }
});

// ---- Thư mục công trình .schem ----
// Mặc định là thư mục "structures" nằm cạnh RiseOfCubicEmpireMapBuilder.exe; người dùng có thể đổi sang thư mục khác.
const defaultSchemDir = () => path.join(app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath(), 'structures');
function schemDir() {
  if (process.env.MMB_TEST_SCHEM_DIR) return process.env.MMB_TEST_SCHEM_DIR;
  const chosen = readConfig().schemDir;
  if (chosen && fs.existsSync(chosen)) return chosen;
  const dir = defaultSchemDir();
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* thư mục chương trình không ghi được */ }
  return dir;
}
/** Liệt kê file .schem trong thư mục và các thư mục con (tối đa 2 cấp); tên trả về dùng dấu "/". */
function listSchems(dir, prefix = '', depth = 0) {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isFile() && /\.schem$/i.test(e.name)) out.push(rel);
    else if (e.isDirectory() && depth < 2) out.push(...listSchems(dir, rel, depth + 1));
  }
  return out.sort((x, y) => x.localeCompare(y, 'vi', { numeric: true }));
}
/** Đường dẫn thật của một công trình, hoặc null nếu tên không hợp lệ hay trỏ ra ngoài thư mục công trình. */
function schemPath(dir, name) {
  if (!dir || typeof name !== 'string' || !/\.schem$/i.test(name) || name.includes('\\')) return null;
  const parts = name.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) return null;
  const full = path.resolve(dir, ...parts);
  return full.startsWith(path.resolve(dir) + path.sep) ? full : null;
}
/** Các bộ công trình đi kèm chương trình: [thư mục con trong "structures" của người dùng, thư mục nguồn trong assets]. */
const STARTER_SETS = [['co_ban', 'structures'], ['the_chien_2', 'the_chien_2'], ['san_bay', 'san_bay'], ['tham_chieu', 'tham_chieu'], ['tau_my', 'tau_my'], ['bo_tuong_da', 'bo_tuong_da'], ['okinawa_bo_sung', 'okinawa_bo_sung']];
/** Chép từng bộ vào thư mục con tương ứng. Thư mục đã có thì chỉ bổ sung file mới của bộ (chưa từng chép, theo file .da_chep.json), không ghi đè hay chép lại file người dùng đã xóa. */
function installStarter(dir) {
  for (const [sub, from] of STARTER_SETS) {
    const dest = path.join(dir, sub);
    try {
      const src = path.join(here, '..', 'assets', from);
      const mark = path.join(dest, '.da_chep.json');
      let done = [];
      try { done = JSON.parse(fs.readFileSync(mark, 'utf8')); } catch { /* chưa có */ }
      fs.mkdirSync(dest, { recursive: true });
      for (const f of fs.readdirSync(src)) {
        if (!f.endsWith('.schem') || done.includes(f)) continue;
        done.push(f);
        if (!fs.existsSync(path.join(dest, f))) fs.writeFileSync(path.join(dest, f), fs.readFileSync(path.join(src, f)));
      }
      fs.writeFileSync(mark, JSON.stringify(done));
    } catch { /* không chép được thì thôi, không ảnh hưởng phần còn lại */ }
  }
}
ipcMain.handle('schem-folder', async (_e, choose) => {
  try {
    let dir = schemDir();
    if (choose && !process.env.MMB_TEST_SCHEM_DIR) {
      const pick = await dialog.showOpenDialog(win, {
        title: 'Chọn thư mục chứa file .schem', defaultPath: dir, properties: ['openDirectory'],
      });
      if (pick.canceled || !pick.filePaths[0]) return {};
      dir = pick.filePaths[0];
      writeConfig({ schemDir: dir });
    }
    if (!dir || !fs.existsSync(dir)) return { error: 'Không tạo được thư mục công trình. Hãy bấm "Đổi thư mục" để chọn một thư mục khác.' };
    installStarter(dir);
    return { folder: dir, files: listSchems(dir) };
  } catch (err) {
    return { error: 'Không đọc được thư mục: ' + err.message };
  }
});
ipcMain.handle('open-schem-folder', async () => {
  const dir = schemDir();
  if (dir && fs.existsSync(dir)) await shell.openPath(dir);
});
ipcMain.handle('load-schem', async (_e, name) => {
  try {
    const file = schemPath(schemDir(), name);
    if (!file) return { error: 'Tên file không hợp lệ' };
    const raw = fs.readFileSync(file);
    return { name, raw: new Uint8Array(raw), schem: schemSummary(parseSchem(raw)) };
  } catch (err) {
    return { error: `Không đọc được ${name}: ${err.message}` };
  }
});

// ---- Nhập công trình làng từ chính bản Minecraft đã cài trên máy ----
function findMinecraftJar() {
  const versions = path.join(app.getPath('appData'), '.minecraft', 'versions');
  const exact = path.join(versions, '1.20.1', '1.20.1.jar');
  if (fs.existsSync(exact)) return exact;
  try { // bản vanilla khác gần nhất (thư mục tên dạng 1.x hoặc 1.x.y)
    const cands = fs.readdirSync(versions).filter((v) => /^1\.\d+(\.\d+)?$/.test(v) && fs.existsSync(path.join(versions, v, v + '.jar')))
      .sort((x, y) => y.localeCompare(x, 'en', { numeric: true }));
    if (cands.length) return path.join(versions, cands[0], cands[0] + '.jar');
  } catch { /* không có thư mục .minecraft */ }
  return null;
}
ipcMain.handle('import-village', async () => {
  try {
    let jar = process.env.MMB_TEST_JAR ?? findMinecraftJar();
    if (!jar) {
      const pick = await dialog.showOpenDialog(win, {
        title: 'Chọn file .jar của Minecraft (ví dụ versions\\1.20.1\\1.20.1.jar)',
        filters: [{ name: 'File jar của Minecraft', extensions: ['jar'] }], properties: ['openFile'],
      });
      if (pick.canceled || !pick.filePaths[0]) return {};
      jar = pick.filePaths[0];
    }
    const list = villageStructuresFromJar(fs.readFileSync(jar));
    if (!list.length) return { error: `Không tìm thấy công trình làng nào trong ${jar}. Hãy chọn file jar của bản Minecraft gốc (không phải file của mod).` };
    const dir = schemDir();
    const groups = {};
    for (const v of list) {
      const folder = path.join(dir, 'lang_' + v.biome);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, v.name + '.schem'), writeSchem(v.schem));
      groups['lang_' + v.biome] = (groups['lang_' + v.biome] ?? 0) + 1;
    }
    return { count: list.length, groups, jar };
  } catch (err) {
    return { error: 'Không nhập được: ' + err.message };
  }
});


// ---- Texture thật của Minecraft: đọc thẳng từ file jar của game trên máy người dùng, không đóng gói kèm chương trình ----
let texIdx = null, texJar = null;
function texJarPath() {
  const saved = readConfig().texJar;
  if (process.env.MMB_TEST_JAR) return process.env.MMB_TEST_JAR;
  if (saved && fs.existsSync(saved)) return saved;
  return findMinecraftJar();
}
function openTexJar() {
  const jar = texJarPath();
  if (!jar) return null;
  if (texIdx && texJar === jar) return texIdx;
  texIdx = indexEntries(readZip(fs.readFileSync(jar))); texJar = jar;
  return texIdx;
}
ipcMain.handle('get-textures', async (_e, names) => {
  try {
    const idx = openTexJar();
    if (!idx) return { none: true };
    const refs = resolveBlocks(idx, names), png = {}, out = {};
    for (const [n, r] of refs) {
      out[n] = r;
      if (!r) continue;
      for (const t of [r.top, r.side]) if (!(t in png)) { const b = readTexture(idx, t); if (b) png[t] = new Uint8Array(b); }
    }
    return { refs: out, png, jar: texJar };
  } catch (err) {
    return { error: 'Không đọc được texture: ' + err.message };
  }
});
ipcMain.handle('get-entity-textures', async (_e, paths) => {
  try {
    const idx = openTexJar();
    if (!idx) return { none: true };
    const png = {};
    for (const t of paths) { const b = readTexture(idx, t); if (b) png[t] = new Uint8Array(b); }
    return { png };
  } catch (err) { return { error: 'Không đọc được texture mob: ' + err.message }; }
});
ipcMain.handle('choose-texture-jar', async () => {
  const pick = await dialog.showOpenDialog(win, {
    title: 'Chọn file .jar của Minecraft để lấy texture (ví dụ versions\\1.20.1\\1.20.1.jar)',
    filters: [{ name: 'File jar của Minecraft', extensions: ['jar'] }], properties: ['openFile'],
  });
  if (pick.canceled || !pick.filePaths[0]) return {};
  try {
    const idx = indexEntries(readZip(fs.readFileSync(pick.filePaths[0])));
    if (!idx.has('assets/minecraft/textures/block/stone.png')) return { error: 'File này không có texture của Minecraft. Hãy chọn file jar của bản Minecraft gốc (ví dụ 1.20.1.jar).' };
    writeConfig({ texJar: pick.filePaths[0] }); texIdx = idx; texJar = pick.filePaths[0];
    return { jar: texJar };
  } catch (err) { return { error: 'Không mở được file: ' + err.message }; }
});

app.whenReady().then(async () => {
  createWindow();
  if (process.env.MMB_TEST_SCRIPT) {
    const { default: run } = await import(path.resolve(process.env.MMB_TEST_SCRIPT));
    try { await run(win); app.exit(0); } catch (err) { console.error(err); app.exit(1); }
  }
});
app.on('window-all-closed', () => app.quit());
