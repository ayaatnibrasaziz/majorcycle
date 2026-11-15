// Renders the three Learn pictures to PNG. Usage: node learn-export.mjs <outDir> [width]
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(path.resolve('../../web/package.json'));
const { chromium } = require('@playwright/test');
const out = process.argv[2], width = +(process.argv[3] || 1600);
const names = ['falls-and-recoveries', 'judging-the-business', 'using-majorcycle'];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width, height: width * 10 / 16 }, deviceScaleFactor: 1 });
await p.goto(pathToFileURL(path.resolve('learn-render.html')).href); await p.evaluate(() => window.ready);
names.push('article-how-far-do-asx-shares-fall');
for (let n = 1; n <= 4; n++) { if (n === 4) await p.setViewportSize({ width: 1200, height: 760 }); await p.evaluate(k => window.show(k), n); await p.screenshot({ path: path.join(out, names[n - 1] + '.png') }); }
await b.close(); console.log('done');
