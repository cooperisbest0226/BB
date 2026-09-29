// 批次輸出靜態幀供檢查：node scripts/stills.mjs Video1 ../work/video1/preview 60 200 330 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const [id, outDir, ...frames] = process.argv.slice(2);
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
const composition = await selectComposition({serveUrl, id, browserExecutable});
for (const fr of frames.map(Number)) {
  const output = path.join(outDir, `f${String(fr).padStart(4, '0')}.png`);
  await renderStill({composition, serveUrl, frame: fr, output, browserExecutable});
  console.log(output);
}
