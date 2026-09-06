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

/**
 * Keep SERVER code out of the file a customer downloads.
 *
 * ── Why (audit 5A-138, 2026-09-05) ─────────────────────────────────────────
 * `ReportDocument` -> `KpiStrip` -> `PremiumLock` -> `UpgradeDialog` ->
 * `SupportDialog` -> `ContactForm` -> `app/(public)/contact/actions.ts`. That last
 * file is a `'use server'` action, and esbuild compiled the whole of it into
 * `report.js`: the Resend endpoint, the from/to addresses, and a live
 * `process.env.RESEND_API_KEY` read, inside a 1 MB document every subscriber can
 * download and open.
 *
 * ⚠️ **Nothing was ever exposed.** esbuild left the read as a runtime lookup and
 * the `process` shim below makes it `undefined`. That is exactly the problem: the
 * safety was somebody else's default, which is CLAUDE.md 11a for the sixth time.
 * One `define` entry — the obvious way to silence a `process.env` warning — would
 * have baked the live API key into a public artifact.
 *
 * ⚠️ And it is DEAD CODE. `check-report-sections.mjs` says so in its own comment:
 * the report refuses an unentitled viewer before any data is built, so a lock can
 * never render inside one. The whole chain was weight and risk for no output.
 *
 * ── Why a stub rather than an exclusion list ───────────────────────────────
 * Same argument as the `process` shim: fix the CLASS. Any file whose first
 * statement is `'use server'` becomes throwing stubs, so the NEXT server action
 * that arrives three components away is neutered on the day it arrives rather
 * than on the day somebody notices. It also fails LOUDLY if one is ever really
 * called from the report, instead of silently doing nothing.
 *
 * The build prints what it stubbed, and `assertNoServerCode()` re-reads the
 * emitted file — the artifact, never the source (CLAUDE.md 11d).
 */
const serverActionStub = {
  name: 'stub-server-actions',
  setup(build) {
    build.onLoad({ filter: /[.][cm]?[jt]sx?$/ }, async (args) => {
      if (args.path.includes('node_modules')) return null;
      const src = await fs.readFile(args.path, 'utf8');
      // The directive must be the FIRST statement to mark the whole module; the
      // same words in a comment or a nested function mean something else.
      if (!/^\s*(['"])use server\1\s*;?/.test(src)) return null;

      const rel = path.relative(webRoot, args.path).split(path.sep).join('/');
      stubbedServerModules.push(rel);

      // One stub per exported binding, so the import still resolves and the
      // bundle still builds. Types are erased by the time esbuild links, so
      // `export type` / `export interface` are skipped.
      const names = new Set();
      for (const m of src.matchAll(
        /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm,
      )) names.add(m[1]);

      const fail =
        `() => { throw new Error(` +
        `'${rel} is server-only and is not part of the offline report.'` +
        `); }`;
      const body = [...names].map((n) => `export const ${n} = ${fail};`).join(String.fromCharCode(10));
      return { contents: body || 'export {};', loader: 'js' };
    });
  },
};

/** Every server module the plugin replaced this build. Printed, never silent. */
const stubbedServerModules = [];

/**
 * Read the EMITTED file and refuse to ship server code or a stray secret read.
 *
 * The allow-list is Next's own client-router internals, which arrive through
 * `next/link` and are already handled by the `process` shim. Anything else is a
 * module that has no business in a document opened from `file://`.
 */
async function assertNoServerCode() {
  const js = await fs.readFile(path.join(outDir, 'report.js'), 'utf8');

  const envReads = [...new Set([...js.matchAll(/process\.env\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))];
  const strays = envReads.filter((k) => !k.startsWith('__NEXT_') && k !== 'NODE_ENV');
  if (strays.length > 0) {
    throw new Error(
      `report.js reads ${strays.join(', ')} from the environment. A downloaded report ` +
        `runs on a customer's machine from file:// — nothing in it may reference a ` +
        `server variable, and one \`define\` entry away that value is baked in. ` +
        `See the serverActionStub plugin above (audit 5A-138).`,
    );
  }

  for (const needle of ['api.resend.com', 'supabase.co/auth', 'api.stripe.com']) {
    if (js.includes(needle)) {
      throw new Error(`report.js contains ${needle} — a server endpoint reached the offline artifact.`);
    }
  }

  // THE CONTROL, and it earned its place immediately: "no server code" is
  // satisfied perfectly by an empty bundle, and my first two needles
  // ('MAJOR CYCLE ANALYSIS REPORT', 'OVERALL RATING') are in the HTML WRAPPER
  // rather than in report.js, so they matched nothing and the check would have
  // been vacuous in both directions. These three are read out of the built file.
  for (const needle of ['Financial Health', 'Key Risks', 'not financial advice']) {
    if (!js.includes(needle)) {
      throw new Error(`report.js is missing ${needle} — the bundle is broken, not merely clean.`);
    }
  }
  console.log(
    `  server modules stubbed: ${stubbedServerModules.length ? stubbedServerModules.join(', ') : 'none'}`,
  );
  console.log(`  no server env reads · ${envReads.length} Next internals allowed`);
}

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
    plugins: [serverActionStub],
    define: { 'process.env.NODE_ENV': '"production"' },
    // The downloaded .html runs from file:// with no bundler, no server and no
    // Node — so a single bare `process` reference is a blank page, not a
    // degraded one. `define` only rewrites the EXACT string it is given, so
    // `process.env.NODE_ENV` above leaves every other `process.env.*` intact.
    //
    // That is not hypothetical. `KpiStrip` imports `PremiumLock` -> `UpgradeDialog`
    // -> `next/link`, which drags Next's client router into this bundle, and its
    // module scope evaluates `process.env.__NEXT_ROUTER_BASEPATH` at load. The
    // report download produced a 4 MB file that rendered NOTHING from
    // 2026-08-01 (when the paywall lock shipped) until 2026-08-05.
    //
    // A shim rather than more `define` entries on purpose: it fixes the whole
    // class, so the next accidental Next/Node import degrades instead of
    // blanking. `report-download.spec.ts` is what actually proves the file
    // still mounts — this line only makes it possible.
    banner: { js: 'globalThis.process=globalThis.process||{env:{}};' },
    legalComments: 'none',
    logLevel: 'error', // 'use client' directive notices are expected + harmless
  });
  const { size } = await fs.stat(path.join(outDir, 'report.js'));
  console.log(`  report.js  ${(size / 1024).toFixed(0)} KB`);
  await assertNoServerCode();
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
