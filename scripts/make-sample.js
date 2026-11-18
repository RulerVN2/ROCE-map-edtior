import fs from 'node:fs';
import { exportWorld } from '../src/core/world.js';
import { makeSampleWorld } from '../src/core/sample.js';

const dir = process.argv[2] ?? 'out/MapBuilderTest';
const size = Number(process.argv[3] ?? 1024);
fs.rmSync(dir, { recursive: true, force: true });
const t = Date.now();
const w = makeSampleWorld({ size });
exportWorld(dir, w, (d, n) => { if (d === n || d % 1024 === 0) process.stdout.write(`\r${d}/${n} chunk`); });
console.log(`\nXong sau ${((Date.now() - t) / 1000).toFixed(1)} giây -> ${dir}; spawn ${w.spawn}`);
