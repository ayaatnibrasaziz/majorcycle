#!/usr/bin/env node
/**
 * `web/_engine/` is a vendored snapshot of `analytics/` (CLAUDE.md, "Repository
 * Structure"). Every file in it must match `analytics/<same path>`, modulo the
 * `from analytics.` → `from _engine.` import rewrite. Edit one without the
 * other and this fails.
 *
 * ── Why this is a script and not the shell block it used to be ──────────────
 * It lived inline in `.github/workflows/ci.yml` and therefore ran NOWHERE else.
 * That is exactly the defect audit finding **F-016** describes: CI runs gates
 * that no local command can run, so no local list of gates can be complete, and
 * a check absent from the list is a check nobody runs. Pulling it out gives the
 * rule ONE implementation that both CI and `pnpm gates` call — rather than a
 * second copy in JavaScript, which is the drift this repo keeps paying for
 * (CLAUDE.md 11c).
 *
 * ⚠️ The file list is DERIVED from what `web/_engine/` actually contains, never
 * hardcoded. A hardcoded list has the same defect one level up: vendor a new
 * file, forget to list it, and it is silently unguarded with nothing red. The
 * floor below is the other half of that — a walk that finds nothing must fail
 * rather than report a clean scan of an empty set (CLAUDE.md 14g).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const WEB = resolve(import.meta.dirname, '..');
const ROOT = resolve(WEB, '..');
const ENGINE = join(WEB, '_engine');
const ANALYTICS = join(ROOT, 'analytics');

/** Vendored files, discovered. `__init__.py` is the vendoring scaffolding
 *  itself and has no `analytics/` counterpart. */
function pythonFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pythonFiles(full));
    else if (entry.endsWith('.py') && entry !== '__init__.py') out.push(full);
  }
  return out.sort();
}

const files = pythonFiles(ENGINE).map((f) => relative(ENGINE, f).split('\\').join('/'));

const FLOOR = 6;
if (files.length < FLOOR) {
  console.error(
    `check:engine-drift — only ${files.length} vendored file(s) found in web/_engine/ ` +
      `(expected at least ${FLOOR}). The scan is broken, not clean.`,
  );
  process.exit(1);
}
console.log(`comparing ${files.length} vendored file(s) against analytics/`);

/** The rewrite that makes the two copies legitimately differ, and the ONLY one. */
const rewrite = (src) => src.replace(/from analytics\./g, 'from _engine.');

let failed = 0;
for (const rel of files) {
  const canonical = join(ANALYTICS, rel);
  let expected;
  try {
    expected = rewrite(readFileSync(canonical, 'utf8'));
  } catch {
    console.error(`DRIFT: web/_engine/${rel} has no counterpart at analytics/${rel}`);
    failed++;
    continue;
  }
  const actual = readFileSync(join(ENGINE, rel), 'utf8');
  // Compared with line endings normalised: a checkout on Windows can hand back
  // CRLF for one copy and LF for the other, which is a property of the working
  // tree rather than a difference between the two files.
  if (expected.replace(/\r\n/g, '\n') !== actual.replace(/\r\n/g, '\n')) {
    console.error(
      `DRIFT: web/_engine/${rel} differs from analytics/${rel} ` +
        `(beyond the from analytics. → from _engine. rewrite)`,
    );
    failed++;
  }
}

if (failed) {
  console.error(
    `\ncheck:engine-drift — ${failed} file(s) out of sync. Edit analytics/<file>.py first, ` +
      `then mirror it into web/_engine/<file>.py in the SAME commit.`,
  );
  process.exit(1);
}
console.log(`✓ check:engine-drift — all ${files.length} vendored files match analytics/`);
