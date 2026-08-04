// CI guard: the two data-correctness rules that no type checker can see.
//
// Both come out of the 2026-08-05 data audit (docs/data-audit.md), and both are
// the same shape as every silent bug this project has shipped — a line that is
// missing rather than wrong, on a page that still renders perfectly.
//
//   A. Reading a growing table without pagination.
//      PostgREST caps a response at 1000 rows and says nothing about it. Proven
//      on the live database: an unpaginated select on `price_bars` (6.5M rows)
//      returns 1000, and one on `listings` (8,964 rows) returns 1000. `stocks`
//      was at 867 and grows every time a reader requests a ticker, so this was a
//      bug scheduled to arrive by itself, with no commit to blame.
//
//   B. Labelling a financial-statement figure with the SHARE PRICE currency.
//      79 of 858 stocks report in a different currency from the one they trade
//      in — a third of the Canadian universe. Passing `fundamentals.currency` to
//      a statement component prints "A$" in front of US dollars.
//
// Static text scan on purpose: these are rules about code that must be present,
// so a runtime test can only ever check the paths it happens to exercise.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');

const failures = [];
let checks = 0;
const fail = (msg) => failures.push(msg);
const check = () => { checks += 1; };

// ── file walking ─────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'test-results', 'playwright-report']);

function walk(dir, exts, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

// Every root that must contribute files, with the floor each one has to clear.
// Checking only the TOTAL is not enough: when this guard was first broken on
// purpose by pointing `app/` at a directory that does not exist, `lib/` and
// `components/` between them still cleared a global floor and the scan reported
// OK while silently covering two thirds of the code. A scan that quietly stops
// looking is precisely the failure this section exists to catch, so each root is
// asserted on its own.
const TS_ROOTS = [
  [path.join(webRoot, 'app'), 40],
  [path.join(webRoot, 'lib'), 25],
  [path.join(webRoot, 'components'), 40],
];
const PY_ROOTS = [
  [path.join(repoRoot, 'analytics'), 20],
  [path.join(webRoot, 'api'), 2],
];

const tsFiles = [];
for (const [root, floor] of TS_ROOTS) {
  const found = walk(root, ['.ts', '.tsx']);
  check();
  if (found.length < floor) {
    fail(
      `${path.relative(repoRoot, root)} yielded only ${found.length} files ` +
      `(expected >= ${floor}) — the scan is broken, not clean`,
    );
  }
  tsFiles.push(...found);
}

const pyFiles = [];
for (const [root, floor] of PY_ROOTS) {
  const found = walk(root, ['.py']);
  check();
  if (found.length < floor) {
    fail(
      `${path.relative(repoRoot, root)} yielded only ${found.length} files ` +
      `(expected >= ${floor}) — the scan is broken, not clean`,
    );
  }
  pyFiles.push(...found);
}

// ── A. unpaginated reads of growing tables ───────────────────────────────────

// Tables whose row count grows without a code change. `stocks` and `universe_log`
// grow with the auto-expanding universe (locked decision #12); `price_bars` grows
// every trading day; `listings` is already 8,964 rows; `profiles`, `analysis_runs`,
// `ticker_requests`, `referrals` and `stripe_events` grow with usage.
const GROWING_TABLES = [
  'stocks', 'price_bars', 'listings', 'index_membership', 'universe_log',
  'analysis_runs', 'ticker_requests', 'profiles', 'referrals', 'stripe_events',
];

// A read is bounded when the query itself caps the rows it can return.
const BOUNDED = [
  /\.range\s*\(/,            // explicit page
  /\.limit\s*\(/,
  /\.maybe_?[Ss]ingle\s*\(/, // at most one row
  /\.single\s*\(/,
  /\.in_?\s*\(/,             // bounded by a caller-supplied list
  /head:\s*true/,            // count-only, no rows
  /count\s*=\s*["']exact["']/,
  /\.eq\s*\(\s*["']?(ticker|symbol|id|user_id|index_id)["']?\s*,/, // keyed lookup
];

/** Split a source file into statements, so `.range()` two lines down still counts. */
function statements(src, isPython) {
  // Chained query builders span lines; a statement ends at `;` (TS) or at
  // `.execute()` (Python supabase-py).
  return isPython ? src.split(/\.execute\(\)/) : src.split(';');
}

const readRe = new RegExp(
  `(?:from|table)\\s*\\(\\s*["'](${GROWING_TABLES.join('|')})["']\\s*\\)[\\s\\S]{0,400}?\\.select\\s*\\(`,
);

// A `.select()` chained onto a WRITE returns only the rows that write touched,
// so it is bounded by the payload rather than by the table — e.g. the Stripe
// webhook's `upsert(...).select('id')` idempotency claim, which returns one row
// or none.
const IS_WRITE = /\.(upsert|insert|update|delete)\s*\(/;

// `selectAll` / `_select_all` ARE the pagination helper — their own bodies and
// the call sites that use them are the fix, not the defect.
const PAGINATION_HELPERS = /select[_A]ll/;

for (const file of [...tsFiles, ...pyFiles]) {
  const isPython = file.endsWith('.py');
  const src = readFileSync(file, 'utf8');
  if (!GROWING_TABLES.some((t) => src.includes(`'${t}'`) || src.includes(`"${t}"`))) continue;
  for (const stmt of statements(src, isPython)) {
    if (!readRe.test(stmt) || IS_WRITE.test(stmt)) continue;
    check();
    if (BOUNDED.some((re) => re.test(stmt)) || PAGINATION_HELPERS.test(stmt)) continue;
    const table = stmt.match(readRe)[1];
    fail(
      `${path.relative(repoRoot, file)}: unpaginated read of the growing table ` +
      `'${table}'. PostgREST silently returns at most 1000 rows — add .range() ` +
      `(or selectAll / _select_all), or bound the query.`,
    );
  }
}

// ── B. statement figures labelled with the price currency ────────────────────

// Components whose numbers come off the income statement, balance sheet or
// cash-flow statement, and therefore use the REPORTING currency.
const STATEMENT_COMPONENTS = ['QuarterlyFinancials', 'EarningsHistory'];

for (const file of tsFiles) {
  const src = readFileSync(file, 'utf8');
  for (const name of STATEMENT_COMPONENTS) {
    const re = new RegExp(`<${name}[\\s\\S]{0,600}?/>`, 'g');
    for (const [usage] of src.matchAll(re)) {
      if (!/currency=/.test(usage)) continue;
      check();
      if (/statementCurrency\s*\(/.test(usage)) continue;
      fail(
        `${path.relative(repoRoot, file)}: <${name}> is given a currency that is ` +
        `not statementCurrency(). Statement figures are in the company's ` +
        `REPORTING currency — 79 of 858 stocks report in a different currency ` +
        `from the one they trade in.`,
      );
    }
  }
}

// BalanceSheet takes the whole fundamentals object and derives the currency
// itself, so assert it derives the right one.
const balanceSheet = readFileSync(
  path.join(webRoot, 'components', 'stocks', 'BalanceSheet.tsx'), 'utf8',
);
check();
if (!/const\s+currency\s*=\s*statementCurrency\s*\(/.test(balanceSheet)) {
  fail(
    'components/stocks/BalanceSheet.tsx: must derive its currency from ' +
    'statementCurrency(fundamentals), not fundamentals.currency.',
  );
}

// And that the helper itself still prefers the reporting currency.
const format = readFileSync(path.join(webRoot, 'lib', 'format.ts'), 'utf8');
check();
if (!/export function statementCurrency[\s\S]{0,300}?financialCurrency\s*\?\?\s*\w+\.currency/.test(format)) {
  fail('lib/format.ts: statementCurrency() must return financialCurrency ?? currency.');
}

// ── report ───────────────────────────────────────────────────────────────────

console.log(
  `check-data-integrity: ${checks} checks over ${tsFiles.length} TS and ` +
  `${pyFiles.length} Python files`,
);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('check-data-integrity: OK');
