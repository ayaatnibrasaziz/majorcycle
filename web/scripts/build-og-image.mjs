/**
 * Build the ONE sitewide share card -> app/opengraph-image.png (1200x630).
 *
 * Run on demand: `pnpm build:og-image`. Not in CI — the output is committed,
 * because it is what the site actually serves.
 *
 * ── Why a committed PNG and not next/og at request time ──────────────────────
 *
 * `ImageResponse` would render this per request in a serverless function, which
 * means a font fetch, a satori parse and a cold start sitting between a social
 * crawler and a card. When that goes wrong it goes wrong *silently* — the card
 * degrades or 500s somewhere nobody is looking, and the owner cannot debug a
 * serverless font failure from the outside. A static file has no runtime at all,
 * and Next's file convention still emits the url/type/width/height meta tags
 * from it automatically.
 *
 * It is also the reason this is a script rather than a hand-made asset: the card
 * is drawn from the real design tokens below, so re-running it after a palette
 * change reproduces it exactly.
 *
 * ── Why the browser and not satori ───────────────────────────────────────────
 *
 * Sora ships as a VARIABLE font. satori's handling of variable weights is
 * unreliable, and the wordmark rendering in the wrong weight on the most-shared
 * surface we have is precisely the kind of defect that survives for months. A
 * real browser rasterises the real font at the real weights.
 *
 * ⚠️ NEVER make a per-stock version of this. A share card is fetched by
 * anonymous crawlers and cached publicly, so a card carrying a rating would put
 * paid output (CLAUDE.md 11a/11b) on a public CDN. One card, no parameters.
 */

import { chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const OUT = join(WEB, 'app', 'opengraph-image.png');
const LOGO = join(WEB, 'public', 'logo.png');

// Google Fonts, SIL Open Font License — embedding is permitted.
const SORA_URL = 'https://github.com/google/fonts/raw/main/ofl/sora/Sora%5Bwght%5D.ttf';

/** Tokens, copied deliberately: this renders OUTSIDE Next, where globals.css and
 *  its `var()` chain do not exist. Kept to the three locked brand colours
 *  (decision #25) so there is nothing here to drift out of step with. */
const BRAND_DEEP = '#1A3A6E';
const BRAND_BRIGHT = '#2E7DE8';

async function fetchFont() {
  const res = await fetch(SORA_URL);
  if (!res.ok) throw new Error(`Sora download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // A truncated or error-page download would still "succeed" and then render in
  // Times New Roman while labelled Sora — which has already happened once in
  // this repo, to the design-system gallery. Check it is really a font.
  const tag = buf.subarray(0, 4).toString('hex');
  if (!['00010000', '74727565', '4f54544f'].includes(tag)) {
    throw new Error(`Sora download is not a TrueType/OpenType file (magic ${tag})`);
  }
  return buf;
}

const card = (fontDataUri, logoDataUri) => `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Sora';
    src: url('${fontDataUri}') format('truetype');
    font-weight: 100 800;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    font-family: 'Sora', sans-serif;
    background: ${BRAND_DEEP};
    color: #fff;
    position: relative;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 70% 90% at 88% 12%, rgba(46,125,232,.55) 0%, transparent 62%),
      radial-gradient(ellipse 60% 70% at 6% 100%, rgba(30,92,179,.45) 0%, transparent 60%);
  }
  .grid {
    position: absolute; inset: 0; opacity: .18;
    background-image:
      linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 40%, #000 20%, transparent 78%);
    -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 40%, #000 20%, transparent 78%);
  }
  .wrap { position: relative; height: 100%; padding: 62px 70px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand img { width: 56px; height: 56px; border-radius: 13px; display: block; }
  .name { font-size: 30px; font-weight: 700; letter-spacing: -.6px; }
  .kicker {
    font-size: 15px; font-weight: 600; letter-spacing: 2.6px; text-transform: uppercase;
    color: rgba(255,255,255,.62); margin-top: 5px;
  }
  h1 {
    margin-top: auto;
    font-size: 60px; font-weight: 700; line-height: 1.1; letter-spacing: -1.8px;
    /* Held clear of the graphic in the upper right. The first render let the
       headline run under the price line and the two fought each other. */
    max-width: 13.5ch;
  }
  h1 em { font-style: normal; color: #8FC0FF; }
  .foot { margin-top: 26px; display: flex; align-items: center; gap: 16px; }
  .sub { font-size: 22px; font-weight: 400; color: rgba(255,255,255,.76); letter-spacing: -.2px; }
  .dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,.34); }
  .note { font-size: 19px; font-weight: 500; color: rgba(255,255,255,.55); }

  /* The cycle shape, echoing the diagram on /methodology so the card and the
     page teach the same picture. */
  svg.cycle { position: absolute; right: 56px; top: 128px; width: 500px; height: 222px; opacity: .95; }
</style>
<div class="glow"></div>
<div class="grid"></div>
<svg class="cycle" viewBox="0 0 520 230" fill="none">
  <rect x="280" y="116" width="240" height="114" fill="url(#zone)" mask="url(#vfade)"/>
  <line x1="280" y1="116" x2="520" y2="116" stroke="url(#zoneline)" stroke-width="3" stroke-dasharray="10 8"/>
  <polyline points="0,190 52,128 104,196 156,143 198,103 229,72 271,143 313,106 355,56 380,34 416,99 458,70 494,56"
    stroke="#fff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" opacity=".92"/>
  <circle cx="494" cy="56" r="11" fill="${BRAND_DEEP}" stroke="#8FC0FF" stroke-width="6"/>
  <defs>
    <!-- The zone has no natural bottom, so a hard edge mid-card reads as a
         floating rectangle rather than "everything below this level". -->
    <mask id="vfade">
      <rect x="280" y="116" width="240" height="114" fill="url(#vgrad)"/>
    </mask>
    <linearGradient id="vgrad" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="116" y2="230">
      <stop offset="0" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="zone" gradientUnits="userSpaceOnUse" x1="280" x2="520" y1="0" y2="0">
      <stop offset="0" stop-color="${BRAND_BRIGHT}" stop-opacity="0"/>
      <stop offset=".5" stop-color="${BRAND_BRIGHT}" stop-opacity=".38"/>
      <stop offset="1" stop-color="${BRAND_BRIGHT}" stop-opacity=".38"/>
    </linearGradient>
    <linearGradient id="zoneline" gradientUnits="userSpaceOnUse" x1="280" x2="520" y1="0" y2="0">
      <stop offset="0" stop-color="#8FC0FF" stop-opacity="0"/>
      <stop offset=".5" stop-color="#8FC0FF" stop-opacity="1"/>
      <stop offset="1" stop-color="#8FC0FF" stop-opacity="1"/>
    </linearGradient>
  </defs>
</svg>
<div class="wrap">
  <div>
    <div class="brand">
      <img src="${logoDataUri}" alt="">
      <div>
        <div class="name">MajorCycle</div>
        <div class="kicker">Financial Terminal</div>
      </div>
    </div>
  </div>
  <h1>Every stock falls. <em>Some are further down than usual.</em></h1>
  <div class="foot">
    <span class="sub">US · Australia · Canada</span>
    <span class="dot"></span>
    <span class="note">Educational analysis — not financial advice</span>
  </div>
</div>
`;

const font = await fetchFont();
if (!existsSync(LOGO)) throw new Error(`Missing ${LOGO}`);
const html = card(
  `data:font/ttf;base64,${font.toString('base64')}`,
  `data:image/png;base64,${readFileSync(LOGO).toString('base64')}`,
);

const dir = mkdtempSync(join(tmpdir(), 'mc-og-'));
const page = join(dir, 'card.html');
writeFileSync(page, html);

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.goto(`file://${page.replace(/\\/g, '/')}`, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);

// Prove Sora is the font that actually rendered before writing the file. The
// gallery once shipped entirely in Times New Roman while labelled Sora, and
// looked completely fine — only document.fonts.check() exposed it.
const ok = await p.evaluate(() => document.fonts.check('700 62px Sora'));
if (!ok) throw new Error('Sora did not load — refusing to write a card in a fallback face');

await p.screenshot({ path: OUT });
await browser.close();

// Read the DIMENSIONS BACK OUT of the file rather than printing the ones we
// asked for. This line used to say "1200x630" as literal text, and cheerfully
// said it while writing an 800x418 card during a deliberate break — a success
// message that reports its own intent instead of its own result is not evidence.
const png = readFileSync(OUT);
if (png.length < 20_000) throw new Error(`Card looks empty (${png.length} bytes)`);
const w = png.readUInt32BE(16);
const h = png.readUInt32BE(20);
if (w !== 1200 || h !== 630) {
  throw new Error(`Card is ${w}x${h}; every platform crops anything but 1200x630`);
}
console.log(`opengraph-image.png  ${w}x${h}  ${(png.length / 1024).toFixed(0)} KB  (Sora verified)`);
