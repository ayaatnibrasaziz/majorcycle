// Renders the film frame by frame to PNG. Usage: node export.mjs <outDir> [fps] [width]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(path.resolve('../../web/package.json'));
const { chromium } = require('@playwright/test');
const out = process.argv[2], fps = +(process.argv[3] || 30), width = +(process.argv[4] || 1920), height = width * 9 / 16, LENGTH = 35, N = Math.round(LENGTH * fps), WORKERS = 4;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:4310/render.html'); await page.evaluate(() => window.ready);
  const len = await page.evaluate(() => FILM_LENGTH); if (Math.abs(len - LENGTH) > 1e-6) throw new Error('film length is ' + len);
  for (let k = w; k < N; k += WORKERS) { await page.evaluate(t => window.show(t), k / fps); await page.screenshot({ path: path.join(out, `f${String(k).padStart(5, '0')}.png`) }); }
}));
await browser.close(); console.log('frames', N);
