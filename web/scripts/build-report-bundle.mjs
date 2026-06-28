// Builds the OFFLINE interactive report bundle:
//   public/report-bundle/report.js   — esbuild IIFE of report-bundle/entry.tsx
//                                       (React + the section components + charts)
//   public/report-bundle/report.css  — Tailwind utilities + globals + (best-effort)
//                                       base64-inlined Sora / JetBrains Mono fonts
//
// The "Download Report" button wraps these two files together with one stock's
// JSON data into a single self-contained .html (see web/lib/report-download.ts).
// This script runs in `prebuild`, so Vercel regenerates the bundle on every deploy
// and it can never drift from the components. Output is git-ignored — never
// committed as a multi-MB artifact.

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(webRoot, 'public', 'report-bundle');

async function buildJs() {
  await esbuild.build({
    absWorkingDir: webRoot,
    entryPoints: ['report-bundle/entry.tsx'],
    outfile: 'public/report-bundle/report.js',
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    tsconfig: 'tsconfig.json',
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'none',
    logLevel: 'error', // 'use client' directive notices are expected + harmless
  });
  const { size } = await fs.stat(path.join(outDir, 'report.js'));
  console.log(`  report.js  ${(size / 1024).toFixed(0)} KB`);
}

function buildCss() {
  // Tailwind v4 CLI auto-detects sources from the project (it scans the tracked
  // component files), so the output carries every utility the report sections
  // use, plus the globals (:root vars, .export-btn, .report-* classes).
  execFileSync(
    process.execPath,
    [
      path.join(webRoot, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'),
      '-i',
      'app/globals.css',
      '-o',
      'public/report-bundle/report.css',
      '--minify',
    ],
    { cwd: webRoot, stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

// Best-effort: inline Sora + JetBrains Mono as base64 @font-face so the offline
// file is pixel-identical to the live site. If the network is unavailable (e.g.
// an offline local build), we skip it and the file falls back to system fonts —
// layout is unchanged, only the typeface differs. Never throws.
async function inlineFonts() {
  const FONT_CSS_URL =
    'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap';
  try {
    const cssRes = await fetch(FONT_CSS_URL, {
      headers: {
        // A modern-browser UA makes Google return woff2 (smallest, best support).
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
    });
    if (!cssRes.ok) throw new Error(`font css ${cssRes.status}`);
    let css = await cssRes.text();

    const urls = [...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)].map((m) => m[1]);
    const unique = [...new Set(urls)];
    const map = new Map();
    await Promise.all(
      unique.map(async (u) => {
        const r = await fetch(u);
        if (!r.ok) return;
        const buf = Buffer.from(await r.arrayBuffer());
        map.set(u, `data:font/woff2;base64,${buf.toString('base64')}`);
      }),
    );
    for (const [u, dataUrl] of map) css = css.split(u).join(dataUrl);

    await fs.appendFile(path.join(outDir, 'report.css'), `\n${css}\n`, 'utf8');
    console.log(`  fonts      inlined ${map.size} woff2`);
  } catch (err) {
    console.warn(`  fonts      skipped (offline build → system-font fallback): ${err}`);
  }
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  console.log('Building offline report bundle…');
  await buildJs();
  buildCss();
  await inlineFonts();
  const { size } = await fs.stat(path.join(outDir, 'report.css'));
  console.log(`  report.css ${(size / 1024).toFixed(0)} KB`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
