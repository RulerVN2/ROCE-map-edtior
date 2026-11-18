// Xuất một thế giới 1.20.1 hoàn chỉnh ra thư mục (chép vào `saves` là mở được).
import fs from 'node:fs';
import path from 'node:path';
import * as nbt from './nbt.js';
import { RegionWriter } from './region.js';
import { buildChunkNbt, buildEntityChunkNbt, makeScratch } from './chunk.js';
import { buildLevelDat } from './level.js';

/**
 * @param {string} dir thư mục đích (sẽ được tạo)
 * @param {object} w
 * @param {string} w.name
 * @param {Array} w.blockPalette, @param {string[]} w.biomePalette
 * @param {{minX:number,minZ:number,maxX:number,maxZ:number}} w.chunkBounds  bao gồm cả hai đầu
 * @param {(cx:number,cz:number)=>({blocks:Uint16Array,biomes:Uint8Array,blockEntities?:Array}|null)} w.getChunk
 * @param {Array} [w.entities] [{id,pos,yaw,pitch,nbt}]
 * @param {[number,number,number]} w.spawn
 * @param {{centerX:number,centerZ:number,size:number}} w.border
 * @param {(done:number,total:number)=>void} [onProgress]
 */
export function exportWorld(dir, w, onProgress) {
  fs.mkdirSync(path.join(dir, 'region'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'entities'), { recursive: true });

  fs.writeFileSync(path.join(dir, 'level.dat'), nbt.encodeGzip(buildLevelDat(w)));

  const { minX, minZ, maxX, maxZ } = w.chunkBounds;
  const total = (maxX - minX + 1) * (maxZ - minZ + 1);
  let done = 0;
  const scratch = makeScratch(w.blockPalette.length);

  for (let rz = minZ >> 5; rz <= maxZ >> 5; rz++) {
    for (let rx = minX >> 5; rx <= maxX >> 5; rx++) {
      const region = new RegionWriter();
      for (let cz = Math.max(minZ, rz << 5); cz <= Math.min(maxZ, (rz << 5) + 31); cz++) {
        for (let cx = Math.max(minX, rx << 5); cx <= Math.min(maxX, (rx << 5) + 31); cx++) {
          const c = w.getChunk(cx, cz);
          if (c) {
            const tag = buildChunkNbt({ x: cx, z: cz, ...c }, w.blockPalette, w.biomePalette, scratch);
            region.set(cx & 31, cz & 31, nbt.encodeZlib(tag));
          }
          done++;
        }
        onProgress?.(done, total);
      }
      if (region.size) region.write(path.join(dir, 'region', `r.${rx}.${rz}.mca`));
    }
  }

  // Mob: gom theo chunk rồi theo vùng.
  const byRegion = new Map();
  for (const e of w.entities ?? []) {
    const cx = Math.floor(e.pos[0] / 16), cz = Math.floor(e.pos[2] / 16);
    const rk = `${cx >> 5}.${cz >> 5}`;
    if (!byRegion.has(rk)) byRegion.set(rk, new Map());
    const chunks = byRegion.get(rk);
    const ck = `${cx},${cz}`;
    if (!chunks.has(ck)) chunks.set(ck, { cx, cz, list: [] });
    chunks.get(ck).list.push(e);
  }
  for (const [rk, chunks] of byRegion) {
    const region = new RegionWriter();
    for (const { cx, cz, list } of chunks.values()) {
      region.set(cx & 31, cz & 31, nbt.encodeZlib(buildEntityChunkNbt(cx, cz, list)));
    }
    region.write(path.join(dir, 'entities', `r.${rk}.mca`));
  }
}
