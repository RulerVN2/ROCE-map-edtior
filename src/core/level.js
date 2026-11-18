// level.dat cho thế giới 1.20.1.
import * as nbt from './nbt.js';
import { DATA_VERSION, VERSION_NAME } from './constants.js';

/**
 * @param {object} o
 * @param {string} o.name
 * @param {[number,number,number]} o.spawn
 * @param {{centerX:number, centerZ:number, size:number}} o.border
 * @param {number} [o.gameType] 0 sinh tồn, 1 sáng tạo
 * @param {object} [o.gameRules] ví dụ { doMobSpawning: 'false' }
 */
export function buildLevelDat(o) {
  const C = nbt.compound, S = nbt.string, B = nbt.byte, I = nbt.int, L = nbt.long, D = nbt.double;
  const rules = {};
  for (const [k, v] of Object.entries(o.gameRules ?? {})) rules[k] = S(v);

  // Ngoài vùng map là khoảng trống (void): bộ sinh phẳng chỉ có một lớp không khí.
  const overworld = C({
    type: S('minecraft:overworld'),
    generator: C({
      type: S('minecraft:flat'),
      settings: C({
        biome: S(o.outsideBiome ?? 'minecraft:plains'),
        features: B(0),
        lakes: B(0),
        layers: nbt.list(nbt.TAG.COMPOUND, [{ block: S('minecraft:air'), height: I(1) }]),
        structure_overrides: nbt.list(nbt.TAG.STRING, []),
      }),
    }),
  });
  const nether = C({
    type: S('minecraft:the_nether'),
    generator: C({
      type: S('minecraft:noise'),
      settings: S('minecraft:nether'),
      biome_source: C({ type: S('minecraft:multi_noise'), preset: S('minecraft:nether') }),
    }),
  });
  const end = C({
    type: S('minecraft:the_end'),
    generator: C({
      type: S('minecraft:noise'),
      settings: S('minecraft:end'),
      biome_source: C({ type: S('minecraft:the_end') }),
    }),
  });

  const data = C({
    DataVersion: I(DATA_VERSION),
    version: I(19133),
    LevelName: S(o.name),
    LastPlayed: L(Date.now()),
    initialized: B(1),
    GameType: I(o.gameType ?? 1),
    Difficulty: B(2),
    DifficultyLocked: B(0),
    hardcore: B(0),
    allowCommands: B(1),
    WasModded: B(0),
    SpawnX: I(o.spawn[0]), SpawnY: I(o.spawn[1]), SpawnZ: I(o.spawn[2]),
    SpawnAngle: nbt.float(0),
    Time: L(0),
    DayTime: L(6000),
    raining: B(0), thundering: B(0),
    rainTime: I(0), thunderTime: I(0), clearWeatherTime: I(0),
    WanderingTraderSpawnChance: I(25),
    WanderingTraderSpawnDelay: I(24000),
    BorderCenterX: D(o.border.centerX),
    BorderCenterZ: D(o.border.centerZ),
    BorderSize: D(o.border.size),
    BorderSizeLerpTarget: D(o.border.size),
    BorderSizeLerpTime: L(0),
    BorderDamagePerBlock: D(0.2),
    BorderSafeZone: D(5),
    BorderWarningBlocks: D(5),
    BorderWarningTime: D(15),
    GameRules: C(rules),
    DataPacks: C({
      Enabled: nbt.list(nbt.TAG.STRING, ['vanilla']),
      Disabled: nbt.list(nbt.TAG.STRING, []),
    }),
    Version: C({ Id: I(DATA_VERSION), Name: S(VERSION_NAME), Series: S('main'), Snapshot: B(0) }),
    WorldGenSettings: C({
      seed: L(0),
      generate_features: B(0),
      bonus_chest: B(0),
      dimensions: C({
        'minecraft:overworld': overworld,
        'minecraft:the_nether': nether,
        'minecraft:the_end': end,
      }),
    }),
    ScheduledEvents: nbt.list(nbt.TAG.COMPOUND, []),
    CustomBossEvents: C({}),
    ServerBrands: nbt.list(nbt.TAG.STRING, ['vanilla']),
  });
  return nbt.compound({ Data: data });
}
