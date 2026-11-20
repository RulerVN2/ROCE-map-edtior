import fs from 'node:fs';
import path from 'node:path';
import { exportWorld } from '../src/core/world.js';
import { makeSampleWorld } from '../src/core/sample.js';
import { defaultScenario, scenarioJson } from '../src/core/scenario.js';
import { makeMob, mobsToEntities } from '../src/core/mobs.js';

const dir = process.argv[2] ?? 'out/MapBuilderTest';
const size = Number(process.argv[3] ?? 1024);
fs.rmSync(dir, { recursive: true, force: true });
const t = Date.now();
const w = makeSampleWorld({ size });

// ---- Kịch bản mẫu: Ô 1 (người chơi) đấu Ô 2 (AI), có mục tiêu kiểu AoE2 ----
const [sx, , sz] = w.spawn;
const hAt = (x, z) => w.heights[Math.min(size - 1, Math.max(0, Math.floor(z))) * size + Math.min(size - 1, Math.max(0, Math.floor(x)))];
const dry = (x, z) => { for (let d = 0; d < 80; d += 4) for (const dx of [d, -d]) if (hAt(x + dx, z) > 63) return [x + dx, z]; return [x, z]; };
const [ax, az] = dry(sx - 40, sz), [bx, bz] = dry(sx + 40, sz);
const sc = defaultScenario();
sc.name = 'Mẫu: Mục tiêu và trigger';
sc.players[0].active = true; sc.players[1].active = true; sc.players[1].civ = 'franks'; sc.players[1].color = 'red';
for (const p of sc.players.slice(0, 2)) { p.food = 600; p.wood = 600; p.gold = 400; p.stone = 300; }
sc.ai[1] = { enabled: true, cheat: false, cheatRate: 60, builders: 2, jobs: { food: 30, wood: 40, gold: 20, stone: 10 } };
sc.zones.push({ id: 'ta', name: 'Căn cứ ta', x0: ax - 12, x1: ax + 12, z0: az - 12, z1: az + 12 }, { id: 'dich', name: 'Căn cứ địch', x0: bx - 12, x1: bx + 12, z0: bz - 12, z1: bz + 12 });
sc.taskforces.push({ id: 'tf1', name: 'Đội kiếm sĩ', units: [{ unit: 'militia', count: 6 }] });
sc.objectives.push(
  { id: 'm1', text: 'Xây một Barracks', shown: true, goal: 0, flag: '' },
  { id: 'm2', text: 'Hạ 10 quân địch', shown: true, goal: 10, flag: 'kills_1' },
  { id: 'm3', text: 'Chặn đợt tấn công đầu tiên', shown: false, goal: 0, flag: '' },
);
const trig = (id, name, conditions, actions, extra = {}) => ({ id, name, enabled: true, once: true, repeat: 0, any: false, diff: [true, true, true], conditions, actions, ...extra });
sc.triggers.push(
  trig('t1', 'Xây xong Barracks', [{ type: 'buildingCount', slot: 1, building: 'barracks', op: '>=', n: 1 }], [{ type: 'objective', id: 'm1', state: 'done' }, { type: 'message', text: 'Barracks đã xong!' }]),
  trig('t2', 'Địch tấn công đợt 1 (sau 2 phút)', [{ type: 'timer', seconds: 120 }],
    [{ type: 'objective', id: 'm3', state: 'show' }, { type: 'sound', sound: 'horn' }, { type: 'createTeam', slot: 2, taskforce: 'tf1', zone: 'dich', team: 'dot1' }, { type: 'teamOrder', team: 'dot1', order: 'attack', zone: 'ta' }]),
  trig('t3', 'Đợt 1 bị diệt', [{ type: 'teamDead', team: 'dot1' }], [{ type: 'objective', id: 'm3', state: 'done' }, { type: 'sound', sound: 'bell' }, { type: 'trigger', id: 't4', op: 'run', delay: 20 }]),
  trig('t4', 'Ẩn mục tiêu đợt 1 sau 20 giây', [], [{ type: 'objective', id: 'm3', state: 'hide' }], { enabled: false }),
  trig('t5', 'Thắng khi xong cả hai mục tiêu', [{ type: 'objectiveIs', id: 'm1', state: 'done' }, { type: 'objectiveIs', id: 'm2', state: 'done' }], [{ type: 'result', value: 'win', text: 'Bạn đã hoàn thành mọi mục tiêu!' }]),
);
const mobs = [
  makeMob({ id: 'aoe2b:town_center', x: ax, z: az, slot: 1 }), makeMob({ id: 'aoe2b:town_center', x: bx, z: bz, slot: 2 }),
  ...[[-6, 8], [-4, 8], [-2, 8]].map(([dx, dz]) => makeMob({ id: 'aoe2:villager', x: ax + dx, z: az + dz, slot: 1 })),
  ...[[6, 8], [4, 8], [2, 8]].map(([dx, dz]) => makeMob({ id: 'aoe2:villager', x: bx + dx, z: bz + dz, slot: 2 })),
  makeMob({ id: 'aoe2:militia', x: ax + 8, z: az + 4, slot: 1 }), makeMob({ id: 'aoe2:militia', x: ax + 9, z: az + 5, slot: 1 }),
];
w.entities.push(...mobsToEntities(mobs, (m) => Math.max(hAt(m.x, m.z), 62) + 1));
const warnings = [];

exportWorld(dir, w, (d, n) => { if (d === n || d % 1024 === 0) process.stdout.write(`\r${d}/${n} chunk`); });
fs.writeFileSync(path.join(dir, 'aoe2_scenario.json'), JSON.stringify(scenarioJson(sc, mobs), null, 2));
console.log(`\nXong sau ${((Date.now() - t) / 1000).toFixed(1)} giây -> ${dir}; spawn ${w.spawn}; kịch bản mẫu có ${sc.objectives.length} mục tiêu, ${sc.triggers.length} trigger`);
