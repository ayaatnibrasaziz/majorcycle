#!/usr/bin/env node
/**
 * Is the LIVE site wearing the stylesheet in this checkout? Run after a deploy:
 *
 *     node scripts/check-live-css.mjs                       # www.majorcycle.com
 *     node scripts/check-live-css.mjs https://preview-url…  # any deployment
 *
 * ⚠️ WHY — 2026-09-25. A merge went live with its new page text and its OLD
 * stylesheet (Vercel's restored build cache; next.config.ts has the account), and
 * nothing we run could see it: CI builds a clean checkout, and a page that renders
 * with last week's colours looks perfectly fine. The owner found it by eye.
 *
 * So: read every colour custom property declared in `app/globals.css`'s `:root`
 * blocks — the design tokens — and require each one, with ITS value, in the CSS the
 * live home page actually loads. A stale build fails on the first token it lacks.
 * CONTROL: it also fails if it found no stylesheet or too few tokens to mean
 * anything, because "0 of 0 missing" is not a pass.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const site = (process.argv[2] ?? 'https://www.majorcycle.com').replace(/\/$/, '');
const css = readFileSync(resolve(import.meta.dirname, '..', 'app', 'globals.css'), 'utf8');

// EVERY top-level `:root` block: the first one holds only the two font stacks, and
// reading just that one found zero colours (the control below caught it).
const roots = [...css.matchAll(/^:root\s*\{([\s\S]*?)\n\}/gm)].map((m) => m[1]);
if (roots.length === 0) {
  console.error('check-live-css: no :root block in globals.css');
  process.exit(1);
}
const body = roots.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
// Literal colour tokens only: a var() reference or a calc is compiled into many
// shapes, while a hex survives minification as the same hex, lowercased.
const tokens = [...body.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map(([, name, value]) => ({
  name,
  value: value.toLowerCase(),
}));
if (tokens.length < 20) {
  console.error(`check-live-css: only ${tokens.length} colour tokens read — the parser is broken, not the site`);
  process.exit(1);
}

const html = await (await fetch(`${site}/?live-css=${Date.now()}`)).text();
const sheets = [...new Set(html.match(/\/_next\/static\/[^"']+\.css/g) ?? [])];
if (sheets.length === 0) {
  console.error(`check-live-css: ${site} loaded no stylesheet`);
  process.exit(1);
}
const live = (await Promise.all(sheets.map(async (u) => (await fetch(site + u)).text()))).join('\n').toLowerCase();

// The minifier shortens `#ffffff` to `#fff` (first run: `--elev-high` read as missing).
const short = (hex) =>
  /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/.test(hex) ? `#${hex[1]}${hex[3]}${hex[5]}` : hex;
const missing = tokens.filter(
  (t) => !live.includes(`${t.name}:${t.value}`) && !live.includes(`${t.name}:${short(t.value)}`),
);
console.log(`${site}: ${tokens.length - missing.length} of ${tokens.length} colour tokens match this checkout`);
for (const t of missing) console.log(`  MISSING  ${t.name}: ${t.value}`);
process.exit(missing.length ? 1 : 0);
