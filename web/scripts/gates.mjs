#!/usr/bin/env node
/**
 * `pnpm gates` — run every automated check, in order, and say what it ran.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Audit finding **F-016**. Layer 2 of the Layer G audit reported a complete
 * sweep of "everything automated" and had silently skipped TWO whole gates:
 * `ruff` and the `_engine` drift check. Six lint errors then sat in the branch
 * for a day and CI failed on the first push.
 *
 * The cause was structural rather than careless. Every JavaScript gate had a
 * `pnpm` script, so that set was enumerable from `package.json`; the Python
 * gates and the drift check existed ONLY as steps inside
 * `.github/workflows/ci.yml`, so no local command could run them and no local
 * list could be complete. **A gate absent from the list is a gate nobody runs**,
 * and nothing goes red, because nothing looked.
 *
 * ── The part that matters: this list polices itself ────────────────────────
 * A hand-maintained list of gates would rot the same way, one CI step at a
 * time. So before running anything, this script reads `ci.yml` and asserts that
 * **every command CI runs is accounted for here** — either as a gate, or as an
 * explicit non-gate with a reason. Add a step to CI and forget this file, and
 * `pnpm gates` fails telling you so. That is the difference between a list and
 * a promise to remember (CLAUDE.md 11o).
 *
 * Three checks deliberately CANNOT run here: `check:page-weight`, `check:csp`
 * and `lighthouse` each need a production server on :3200 and a real session.
 * They are printed as NOT RUN, with the reason and the command — because the
 * whole lesson above is that a check omitted in silence is the dangerous kind.
 *
 * Usage:  pnpm gates            every gate, e2e included (slow — ~15 min)
 *         pnpm gates --no-e2e   skip the Playwright suite, and say so
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WEB = resolve(import.meta.dirname, '..');
const ROOT = resolve(WEB, '..');
const skipE2e = process.argv.includes('--no-e2e');

/* ── the gates ───────────────────────────────────────────────────────────── */

const PY = process.platform === 'win32' ? 'python' : 'python3';

/** Ordered cheapest-first, so a typo fails in seconds rather than after the
 *  build. `covers` lists the ci.yml commands this gate accounts for. */
const GATES = [
  { name: 'typecheck',            cmd: 'pnpm typecheck',                  cwd: WEB,  covers: ['pnpm typecheck'] },
  { name: 'lint',                 cmd: 'pnpm lint',                       cwd: WEB,  covers: ['pnpm lint'] },
  { name: 'ruff (analytics)',     cmd: `${PY} -m ruff check analytics/`,  cwd: ROOT, covers: ['python -m ruff check analytics/'] },
  { name: 'ruff (web python)',    cmd: `${PY} -m ruff check _engine/ api/`, cwd: WEB, covers: ['python -m ruff check _engine/ api/'] },
  { name: 'mypy (analytics)',     cmd: `${PY} -m mypy analytics/ --ignore-missing-imports --explicit-package-bases`, cwd: ROOT, covers: ['python -m mypy analytics/ --ignore-missing-imports --explicit-package-bases'] },
  { name: 'mypy (web python)',    cmd: `${PY} -m mypy _engine/ api/ --ignore-missing-imports --explicit-package-bases`, cwd: WEB, covers: ['python -m mypy _engine/ api/ --ignore-missing-imports --explicit-package-bases'] },
  { name: 'pytest',               cmd: `${PY} -m pytest analytics/ -q`,   cwd: ROOT, covers: ['python -m pytest analytics/ -v'] },
  { name: 'check:engine-drift',   cmd: 'pnpm check:engine-drift',         cwd: WEB,  covers: ['pnpm check:engine-drift'] },
  { name: 'check:report-sections',cmd: 'pnpm check:report-sections',      cwd: WEB,  covers: ['pnpm check:report-sections'] },
  { name: 'check:entitlement-gates', cmd: 'pnpm check:entitlement-gates', cwd: WEB,  covers: ['pnpm check:entitlement-gates'] },
  { name: 'check:data-integrity', cmd: 'pnpm check:data-integrity',       cwd: WEB,  covers: ['pnpm check:data-integrity'] },
  { name: 'check:seo',            cmd: 'pnpm check:seo',                  cwd: WEB,  covers: ['pnpm check:seo'] },
  { name: 'check:tier-palette',   cmd: 'pnpm check:tier-palette',         cwd: WEB,  covers: ['pnpm check:tier-palette'] },
  { name: 'build',                cmd: 'pnpm build',                      cwd: WEB,  covers: ['pnpm build', 'pnpm build:report-bundle'] },
  { name: 'check:render-modes',   cmd: 'pnpm check:render-modes',         cwd: WEB,  covers: ['pnpm check:render-modes'] },
  { name: 'e2e',                  cmd: 'pnpm e2e',                        cwd: WEB,  covers: ['pnpm e2e'], slow: true },
];

/** In ci.yml but not a gate — setup, not verification. Each needs a reason,
 *  so "not a gate" stays a judgement someone made rather than an oversight. */
const NOT_GATES = {
  'pnpm install --frozen-lockfile': 'installs dependencies',
  'pnpm exec playwright install chromium': 'installs the browser',
};

/** Real gates that cannot run from a bare checkout, named rather than omitted. */
const NEEDS_A_SERVER = [
  ['pnpm check:page-weight', 'needs a production server on :3200'],
  ['pnpm check:csp', 'needs a production server on :3200 and a real session'],
  ['pnpm lighthouse', 'needs a production server on :3200; median of 3, ~6 min'],
];

/* ── the self-check: is this list still complete? ─────────────────────────── */

function ciCommands() {
  const yml = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const found = new Set();
  for (let line of yml.split(/\r?\n/)) {
    line = line.trim();
    if (line.startsWith('#')) continue;
    line = line.replace(/^run:\s*/, '').replace(/^\(cd web && /, '').replace(/\)$/, '');
    const m = line.match(/^(pnpm [\w:.-]+(?: --frozen-lockfile| chromium)?|python -m .+)$/);
    if (m) found.add(m[1].trim());
  }
  return found;
}

const covered = new Set([...GATES.flatMap((g) => g.covers), ...Object.keys(NOT_GATES)]);
const missing = [...ciCommands()].filter((c) => !covered.has(c));
if (missing.length) {
  console.error('pnpm gates — this list is OUT OF DATE.\n');
  console.error('CI runs commands that are not accounted for here:');
  for (const m of missing) console.error(`   ${m}`);
  console.error(
    '\nAdd each to GATES (if it verifies something) or to NOT_GATES with a reason.\n' +
      'A gate absent from the list is a gate nobody runs — that is finding F-016.',
  );
  process.exit(1);
}

/* ── run ─────────────────────────────────────────────────────────────────── */

const planned = GATES.filter((g) => !(skipE2e && g.name === 'e2e'));
console.log(`pnpm gates — ${planned.length} gate(s), stopping at the first failure\n`);

const results = [];
let failedAt = null;

for (const gate of planned) {
  process.stdout.write(`  ${gate.name.padEnd(26)} `);
  const started = Date.now();
  // The whole command as ONE string with `shell: true`. Splitting it into
  // file + args under a shell is what Node deprecates in DEP0190 (the args are
  // concatenated, not escaped) — and it would mangle the flags these gates pass.
  const r = spawnSync(gate.cmd, {
    cwd: gate.cwd,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const ok = r.status === 0;
  results.push({ ...gate, ok, secs });
  console.log(ok ? `ok    ${secs}s` : `FAIL  ${secs}s`);
  if (!ok) {
    failedAt = gate;
    console.log(`\n───── ${gate.name} failed (exit ${r.status}) ─────`);
    console.log((r.stdout || '').trimEnd());
    console.error((r.stderr || '').trimEnd());
    break;
  }
}

/* ── report ──────────────────────────────────────────────────────────────── */

console.log('');
const ran = results.length;
const passed = results.filter((r) => r.ok).length;

if (skipE2e) console.log('  SKIPPED  e2e — you passed --no-e2e');
for (const [cmd, why] of NEEDS_A_SERVER) console.log(`  NOT RUN  ${cmd} — ${why}`);
if (failedAt) {
  for (const g of planned.slice(planned.indexOf(failedAt) + 1)) {
    console.log(`  NOT RUN  ${g.name} — stopped after ${failedAt.name} failed`);
  }
}

console.log('');
if (failedAt) {
  console.error(`pnpm gates — FAILED at ${failedAt.name} (${passed} of ${ran} ran clean)`);
  process.exit(1);
}
console.log(`pnpm gates — ${passed} of ${planned.length} gates passed`);
