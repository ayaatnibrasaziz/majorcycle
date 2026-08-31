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
import { readFileSync, writeFileSync } from 'node:fs';
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
let failureLog = null;
let artifactHint = null;

/* ── keeping a failure diagnosable ───────────────────────────────────────────
 *
 * ⚠️ **A FAILING GATE ONCE BECAME UNDIAGNOSABLE, and it is the reason this code
 * exists (2026-08-31).** A `pnpm gates` run failed at `e2e`; two later runs and CI
 * were green; and the failing test could never be named, because the evidence had
 * been thrown away at the moment it was produced. Three separate things went wrong
 * and ANY ONE of them alone loses the diagnosis:
 *
 *   1. Nothing was written to disk. The only copy of the output was in a terminal.
 *   2. The order was `stdout` then `stderr`. For Playwright, the failure summary is
 *      at the END of stdout and stderr is a wall of dev-server noise — so the one
 *      thing you need was buried hundreds of lines above the last thing printed.
 *   3. The reader had piped the command through `tail`, which kept the noise and
 *      discarded the summary. (It also returned `tail`'s exit status, so a FAILED
 *      run reported success — a separate lesson, CLAUDE.md 11z's footnote.)
 *
 * So: **the full output always goes to a file**, and the excerpt printed to the
 * terminal is the part that names the failure, printed LAST. A gate that fails
 * without saying what failed is a gate you cannot act on — and the one thing worse
 * than a red run is a red run you have to reproduce before you can read it.
 */
const FAILURE_LOG = resolve(WEB, 'gates-failure.log');

/** Everything the gate emitted, verbatim, so nothing depends on scrollback. */
function writeFailureLog(gate, r) {
  const parts = [
    `# pnpm gates — ${gate.name} FAILED (exit ${r.status})`,
    `# command: ${gate.cmd}`,
    `# cwd:     ${gate.cwd}`,
    `# when:    ${new Date().toISOString()}`,
    '',
    '───── stdout ─────',
    r.stdout || '(empty)',
    '',
    '───── stderr ─────',
    r.stderr || '(empty)',
  ];
  try {
    writeFileSync(FAILURE_LOG, parts.join('\n'), 'utf8');
    return FAILURE_LOG;
  } catch {
    // Never let a logging problem mask the failure being logged.
    return null;
  }
}

/**
 * Is this failure the BUILD ARTIFACT rather than the code?
 *
 * ⚠️ **This is a real defect that cost a whole diagnosis on 2026-08-31**, and it is
 * invisible unless you know it exists. `pnpm gates` failed at `typecheck` with:
 *
 *     .next-dev/dev/types/routes.d.ts(118,1): error TS1160: Unterminated template literal.
 *
 * Nobody wrote that file. Next generates it, and `next-env.d.ts` — also generated, also
 * gitignored — pulls it in with a bare `import "./.next-dev/dev/types/routes.d.ts"`. **An
 * import bypasses `exclude` entirely**, which is why `tsconfig.json` lists `.next-dev`
 * under `exclude` and that entry does nothing at all.
 *
 * How it gets corrupted: the e2e gate boots `next dev`, which writes that file and is then
 * killed abruptly by Playwright. `reuseExistingServer` is deliberately **false**, so every
 * Playwright run starts a fresh server — and on Windows a previous one can still be exiting.
 * Two servers writing one file interleave: the recovered copy had the same interface block
 * **twice** with a stray `({ id })` between them. Not truncation — concurrent writes.
 *
 * The result is a gate failing on a path that looks like it should be ignorable, in code no
 * human touched, with a green CI (which never has a `.next-dev` at all). **Proven by a clean
 * A/B: corrupt file present → 3 errors; moved aside → exit 0, same command, nothing else
 * changed.**
 *
 * So: when EVERY error names a generated dist directory, say so and give the one-line fix.
 * Deliberately does NOT delete anything by itself — the owner's standing rule is to ask
 * before deleting, and a tool that silently removes build output to make itself pass is the
 * wrong instinct anyway.
 *
 * ⚠️ **Only fires when ALL error lines are generated paths.** One real source error alongside
 * them means it is a code problem that happens to also touch generated types, and this notice
 * would send you the wrong way — the failure mode of a helpful hint is confident misdirection.
 */
const GENERATED_DIRS = ['.next-dev/', '.next-dev\\', '.next/', '.next\\'];

function generatedArtifactDiagnosis(r) {
  const body = `${r.stdout || ''}\n${r.stderr || ''}`;
  const errorLines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /error\s+TS\d+|error[: ]/i.test(l) && !/^\[ELIFECYCLE\]/.test(l));
  if (errorLines.length === 0) return null;
  const generated = errorLines.filter((l) => GENERATED_DIRS.some((d) => l.includes(d)));
  if (generated.length !== errorLines.length) return null;
  const dirs = [...new Set(generated.map((l) => (l.includes('.next-dev') ? '.next-dev' : '.next')))];
  return [
    '',
    '  ⚠️  EVERY error above is in a GENERATED file, not in your code.',
    `      Next writes ${dirs.join(' and ')} itself; \`next-env.d.ts\` imports the route types from`,
    '      there, and an import bypasses tsconfig\'s `exclude`. Two overlapping `next dev`',
    '      servers (the e2e gate starts one) can interleave their writes and leave it invalid.',
    '',
    `      Fix — it regenerates on the next dev/build, so removing it is safe:`,
    ...dirs.map((d) => `          rm -rf web/${d}/dev/types web/${d}/types`),
    '',
    '      Then re-run. If it comes back, two Next processes are running at once.',
  ].join('\n');
}

/**
 * The part a human needs, and nothing else.
 *
 * Prefers the tail of stdout, where every runner here puts its summary. stderr is
 * shown only when stdout is empty — a gate that crashed before printing anything —
 * because otherwise dev-server noise drowns the answer. The full text is in the log
 * file either way, so this is allowed to be lossy; what it must not do is be lossy
 * about the SUMMARY.
 */
function excerpt(r, lines = 40) {
  const out = (r.stdout || '').trimEnd();
  const err = (r.stderr || '').trimEnd();
  const body = out || err;
  if (!body) return '(the gate produced no output at all)';
  const all = body.split('\n');
  const tail = all.slice(-lines).join('\n');
  return all.length > lines ? `… ${all.length - lines} earlier lines are in the log file\n${tail}` : tail;
}

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
    failureLog = writeFailureLog(gate, r);
    console.log(`\n───── ${gate.name} failed (exit ${r.status}) ─────`);
    console.log(excerpt(r));
    artifactHint = generatedArtifactDiagnosis(r);
    if (artifactHint) console.log(artifactHint);
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
  // The log path goes on the VERDICT line, not somewhere above it. The whole
  // failure mode this guards against is a reader who only ever sees the last line.
  console.error(
    `pnpm gates — FAILED at ${failedAt.name} (${passed} of ${ran} ran clean)` +
      (failureLog ? ` — full output: ${failureLog}` : ''),
  );
  // Repeated on the verdict line too: a reader who sees only the last lines must still
  // learn that the failure was a build artifact rather than their own code.
  if (artifactHint) console.error('  ⚠️  …and every error was in a GENERATED file — see the note above.');
  console.error('  ⚠️  do not pipe this command through `head`/`tail`: $? is the pipe’s last stage,');
  console.error('      so a FAILED run reports success. Redirect instead:  pnpm gates > gates.log 2>&1');
  process.exit(1);
}
console.log(`pnpm gates — ${passed} of ${planned.length} gates passed`);
