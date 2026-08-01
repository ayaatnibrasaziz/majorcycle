// CI guard: the paywall (F3 Step 10) must not silently regress.
//
// WHY A STATIC SCRIPT AND NOT JUST TESTS. The behavioural suites that cover this
// (e2e/entitlement.spec.ts, analytics/tests/test_cycle_handler.py) are the real
// proof — but the Playwright half SELF-SKIPS when its Supabase/Stripe credentials
// are absent, which is exactly the situation in which a misconfigured repo would
// most like to go quiet. This script needs no credentials, no database and no
// server, so it can never skip: if someone reopens the paywall, CI goes red.
//
// It is a text scan, deliberately. It cannot prove the gate WORKS — that's the
// tests' job — only that the specific mistakes we already made, or nearly made,
// cannot be made again unnoticed. Each check below names the failure it prevents.
//
// Run: pnpm check:entitlement-gates   (wired into the CI `frontend` job)

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(path.join(webRoot, ...p), 'utf8');

const failures = [];
const fail = (check, detail) => failures.push({ check, detail });

// The scoring keys, in the snake_case the Python function emits. Kept in step with
// PREMIUM_KEYS in web/api/cycle.py and CycleAnalysis in web/lib/types.ts.
const PREMIUM_KEYS = [
  'financial_health_score',
  'fh_subscores',
  'valuation_score',
  'valuation_score_raw',
  'quality_factor',
  'valuation_zone',
  'cycle_payoff_score',
  'overall_rating',
  'overall_label',
];

// ── 1. /api/cycle must not be blanket-public ─────────────────────────────────
// It was, once: the whole analysis engine was a free, unauthenticated, unthrottled
// API. Re-adding it to PUBLIC_PATHS would restore that in one line.
{
  const proxy = read('proxy.ts');
  const publicBlockMatch = proxy.match(/const PUBLIC_PATHS = \[([\s\S]*?)\n\];/);
  const publicBlock = publicBlockMatch ? publicBlockMatch[1] : '';
  // A commented mention is fine (there's an explanatory note); an actual entry isn't.
  const hasEntry = publicBlock
    .split('\n')
    .some((line) => !line.trim().startsWith('//') && /['"]\/api\/cycle['"]/.test(line));
  if (hasEntry) {
    fail(
      '/api/cycle is back in PUBLIC_PATHS',
      'That makes the entire analysis engine a free public API. It must stay on the\n' +
        '  secret-gated branch instead (see CYCLE_PATH in proxy.ts).',
    );
  }
  if (!/CYCLE_PATH/.test(proxy) || !/hasInternalSecret/.test(proxy)) {
    fail(
      'the /api/cycle secret branch is missing from proxy.ts',
      'Without it the endpoint is either wide open or (if merely removed from\n' +
        '  PUBLIC_PATHS) redirected to /login, which blanks every Stock Detail page.',
    );
  }
  if (!/PREMIUM_API_PATHS/.test(proxy) || !/402/.test(proxy)) {
    fail(
      'the premium API gate is missing from proxy.ts',
      '/api/analyze must answer 402 for an unentitled caller.',
    );
  }
}

// ── 2. /api/cycle must never advertise a shared cache ────────────────────────
// The bug that would have defeated the whole paywall: `public, s-maxage=3600` let
// a CDN store a fully-scored response keyed on URL alone, so any later request —
// no secret, no session — would have been served the paid analysis before the
// function ran. (Audit finding B1.)
{
  const cycle = read('api', 'cycle.py');
  const code = cycle
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');
  for (const bad of ['s-maxage', 'stale-while-revalidate']) {
    if (code.includes(bad)) {
      fail(
        `api/cycle.py sends a shared-cache directive (${bad})`,
        'This response varies by entitlement and a shared cache keys on the URL\n' +
          '  alone. It must send `private, no-store`; Next\'s Data Cache does the caching.',
      );
    }
  }
  if (!/private, no-store/.test(code)) {
    fail(
      'api/cycle.py no longer sends `private, no-store`',
      'Required so no shared cache can retain a scored payload.',
    );
  }
  if (!/hmac\.compare_digest/.test(code) || !/INTERNAL_HEADER/.test(code)) {
    fail(
      'api/cycle.py lost its internal-secret check',
      'It is the authoritative half of the gate — the proxy check alone is not enough.',
    );
  }

  // The same rule for the refusals the middleware issues itself. Both vary by
  // viewer — the 401 by whether the caller holds the internal secret, the 402 by
  // the caller's own billing columns (its body names their denial reason) — and
  // `NextResponse.json` defaults to `public, max-age=0, must-revalidate`. Harmless
  // only because of the modifiers; this keeps `private, no-store` explicit so the
  // safety never rests on someone not deleting `max-age=0`. (Live check, 2026-07-28.)
  {
    const proxy = read('proxy.ts');
    if (!/'Cache-Control':\s*'private, no-store'/.test(proxy)) {
      fail(
        'proxy.ts no longer declares a `private, no-store` header constant',
        'Its 401 (/api/cycle) and 402 (/api/analyze) both vary by viewer and must not\n' +
          '  carry a shared-cache directive. See CLAUDE.md rule 11a.',
      );
    }
    for (const status of ['401', '402']) {
      const re = new RegExp(`status:\\s*${status},\\s*headers:\\s*NO_STORE`);
      if (!re.test(proxy)) {
        fail(
          `proxy.ts's ${status} no longer sends the no-store header`,
          'A viewer-dependent refusal must never be shared-cacheable.',
        );
      }
    }
  }
  for (const key of PREMIUM_KEYS) {
    if (!cycle.includes(key)) {
      fail(
        `api/cycle.py PREMIUM_KEYS no longer lists ${key}`,
        'Every scored field must be stripped for an unentitled viewer.',
      );
    }
  }
}

// ── 3. /api/analyze must require the injected secret ─────────────────────────
{
  const analyze = read('api', 'analyze.py');
  if (!/hmac\.compare_digest/.test(analyze) || !/INTERNAL_HEADER/.test(analyze)) {
    fail(
      'api/analyze.py lost its internal-secret check',
      'The proxy injects the secret only after verifying entitlement, so without\n' +
        '  this check the screener could be reached without passing the gate.',
    );
  }
  // Added 2026-07-30 (live-check Session 2, finding A). This was the ONE premium
  // surface with no header assertion, while its three siblings — api/cycle.py,
  // proxy.ts and the report route — were all guarded. It sent bare `no-store`,
  // which Vercel does honour, so nothing was exposed; the gap was that a future
  // edit could delete the line and no check would notice. On the route that
  // returns a whole basket's paid analysis, that is the CLAUDE.md 11a trap
  // exactly: safe because of someone else's default, not because we said so.
  const analyzeCode = analyze
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');
  if (!/"Cache-Control", "private, no-store"/.test(analyzeCode)) {
    fail(
      'api/analyze.py no longer sends `private, no-store`',
      'Every branch is per-caller — the 200 is the paid analysis, the 401 is that\n' +
        '  caller\'s own refusal. Nothing here may ever reach a shared cache.',
    );
  }
  for (const bad of ['s-maxage', 'stale-while-revalidate']) {
    if (analyzeCode.includes(bad)) {
      fail(
        `api/analyze.py sends a shared-cache directive (${bad})`,
        'That is the trigger that makes Vercel\'s edge cache a response, keyed on\n' +
          '  the URL alone — one subscriber\'s screener run served to everyone.',
      );
    }
  }
}

// ── 4. entitlement must ride in the URL, not a header ────────────────────────
// Next's Data Cache keys on the URL, so a header-borne flag would let the free and
// paid variants of a ticker collide on one cache entry. (Audit finding B3.)
{
  const cycleTs = read('lib', 'cycle.ts');
  if (!/entitled: entitled \? '1' : '0'/.test(cycleTs)) {
    fail(
      'lib/cycle.ts no longer puts `entitled` in the /api/cycle query string',
      'A header would not be part of the cache key, so a free response and a paid\n' +
        '  one could be served to the wrong viewer.',
    );
  }
  if (!/INTERNAL_HEADER\]: process\.env\.CYCLE_INTERNAL_SECRET/.test(cycleTs)) {
    fail('lib/cycle.ts no longer sends the internal secret', 'Every call would 401.');
  }
}

// ── 5. premium routes must still call the gate ───────────────────────────────
{
  // The report has no PAGE of its own: "Download Report" builds the file client-side
  // from the gated /report route, so the only surface to protect is that route
  // (checked below). An on-screen preview page existed until 2026-07-29 and was
  // unreachable — nothing ever linked to it. Its removal is also why the route lost
  // its `/data` suffix on 2026-07-30: the segment only existed to sit beside that page.
  const premiumPages = [
    ['app', '(app)', 'run', 'page.tsx'],
    ['app', '(app)', 'results', 'page.tsx'],
  ];
  for (const parts of premiumPages) {
    const src = read(...parts);
    if (!/requirePremiumPage\(\)/.test(src)) {
      fail(
        `${parts.join('/')} no longer calls requirePremiumPage()`,
        'This page exposes scored output and must consult the gate before building it.',
      );
    }
    // The gate no longer redirects an unentitled viewer (it used to bounce them to the
    // public /pricing page, which threw a signed-in reader out of the app). It now just
    // REPORTS, so a page that calls it and ignores `entitled` renders the premium thing
    // to everyone. The early return is the enforcement.
    if (!/if \(!viewer\.entitled\)/.test(src) || !/PremiumLockPage/.test(src)) {
      fail(
        `${parts.join('/')} does not return <PremiumLockPage> when unentitled`,
        'requirePremiumPage() reports entitlement rather than redirecting on it, so\n' +
          '  without this early return the page renders its premium content for everyone.',
      );
    }
  }
  const reportData = read('app', '(app)', 'stocks', '[market]', '[ticker]', 'report', 'route.ts');
  if (!/getViewerEntitlement/.test(reportData) || !/402/.test(reportData)) {
    fail(
      'the report data route no longer checks entitlement',
      'Route handlers are not wrapped by the (app) layout, so it must gate itself —\n' +
        '  its payload contains the full scorecard. It is also the report\'s ONLY\n' +
        '  surface: the on-screen preview page was removed on 2026-07-29.',
    );
  }
  // Every response from it varies by viewer (the 200 is the scorecard; the 402 names
  // the caller's denial reason), and a shared cache keys on the URL alone. It sent no
  // Cache-Control at all until 2026-07-29 — caught by e2e, not by reading the code.
  if (!/'Cache-Control':\s*'private, no-store'/.test(reportData)) {
    fail(
      'the report data route no longer declares `private, no-store`',
      'Its payload is per-viewer and must never be shared-cacheable (CLAUDE.md 11a).',
    );
  }
  for (const bad of ['s-maxage', 'stale-while-revalidate']) {
    if (reportData.includes(bad)) {
      fail(
        `the report data route sends a shared-cache directive (${bad})`,
        'That would let the edge serve one subscriber\'s report to everyone else.',
      );
    }
  }
}

// ── 6. the entitlement rule must stay fail-closed ────────────────────────────
{
  const ent = read('lib', 'entitlement.ts');
  if (!/billing_blocked === true\) return false/.test(ent)) {
    fail(
      'lib/entitlement.ts no longer denies on billing_blocked first',
      'A dispute lock must outrank an otherwise-active subscription.',
    );
  }
  if (!/if \(!profile\) return false/.test(ent)) {
    fail('lib/entitlement.ts no longer fails closed on a missing profile', '');
  }
}

// ── 7. the free-tier counter must never be user-writable ─────────────────────
// profiles RLS lets a user UPDATE their own row, so a counter they can write is a
// counter they can reset. (Audit finding B4.)
{
  const migrationDir = path.join(webRoot, '..', 'supabase', 'migrations');
  let counterMigration = '';
  try {
    counterMigration = readFileSync(
      path.join(migrationDir, '20260726010000_free_tier_view_counter.sql'),
      'utf8',
    );
  } catch {
    fail('the free-tier counter migration is missing', 'Expected 20260726010000_free_tier_view_counter.sql');
  }
  if (counterMigration && !/revoke all \(free_views_date, free_views_tickers\)/.test(counterMigration)) {
    fail(
      'the counter columns are no longer revoked from the browser-facing roles',
      'profiles RLS lets a user update their own row, so a grant here would let\n' +
        '  anyone reset their own quota from the browser.',
    );
  }
  // Match only a real GRANT *statement*, not the word "granted" inside a comment
  // (the migration's own prose explains that these columns are never granted, and
  // a looser regex flagged that as a violation).
  const statements = counterMigration
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';');
  const grantsCounter = statements.some(
    (st) => /^\s*grant\b/i.test(st) && /free_views/.test(st),
  );
  if (grantsCounter) {
    fail('a GRANT on the free-tier counter columns was found', 'These are service-role only.');
  }
}

// ── 8. the counter must stay atomic and out of the browser's reach ───────────
// Two separate hazards, both found by inspecting the LIVE database rather than the
// code, and neither visible from the migration text alone.
{
  const migrationDir = path.join(webRoot, '..', 'supabase', 'migrations');
  let migrations = [];
  try {
    migrations = readdirSync(migrationDir).filter((f) => f.endsWith('.sql'));
  } catch {
    fail('the migrations directory could not be read', migrationDir);
  }

  // (a) A TABLE-level UPDATE grant to `authenticated` would make the counter
  // user-resettable — and the column-level REVOKEs in the counter migration would
  // NOT prevent it, because Postgres cannot subtract a column from a table grant.
  // What protects the counter today is that `authenticated`'s UPDATE is granted per
  // column (display_name, country, acknowledged_disclaimer_at). Keep it that way.
  for (const file of migrations) {
    const sql = readFileSync(path.join(migrationDir, file), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    // A column list in parentheses before ON is the safe form; its absence is not.
    if (/grant[^;(]*\bupdate\b[^;(]*\bon\b\s+(public\.)?profiles\b[^;]*\bto\b[^;]*\bauthenticated\b/i.test(sql)) {
      fail(
        `${file} grants table-level UPDATE on profiles to authenticated`,
        'That silently overrides the free-tier counter\'s column REVOKEs (Postgres\n' +
          '  cannot subtract a column from a table-level grant), letting any user reset\n' +
          '  their own quota. Grant UPDATE per column instead.',
      );
    }
  }

  // (b) The counting must happen inside the database function, which row-locks the
  // profile. Doing it as a read-then-write in TypeScript loses count under exactly
  // the concurrent traffic the fence exists to stop.
  const fnMigration = migrations.find((f) => f.includes('record_free_view'));
  if (!fnMigration) {
    fail(
      'the record_free_view migration is missing',
      'The counter must be applied atomically in Postgres, not read-modify-written\n' +
        '  from the app, or parallel requests overwrite each other and the cap is free.',
    );
  } else {
    const sql = readFileSync(path.join(migrationDir, fnMigration), 'utf8');
    if (!/for update/i.test(sql)) {
      fail(
        'record_free_view no longer takes a row lock (`for update`)',
        'Without it, concurrent views read the same stale array and clobber each\n' +
          '  other\'s writes — a scraper gets N pages for one recorded view.',
      );
    }
    if (/grant\s+execute[^;]*\b(anon|authenticated)\b/i.test(sql)) {
      fail(
        'record_free_view is executable by a browser-facing role',
        'Only service_role may call it — otherwise a user can drive their own counter.',
      );
    }
  }

  // (c) The fence has to actually be called, or it is decorative.
  const detail = read('app', '(app)', 'stocks', '[market]', '[ticker]', 'page.tsx');
  if (!/recordFreeView\(/.test(detail)) {
    fail(
      'the Stock Detail page no longer calls recordFreeView()',
      'The free-tier daily cap is enforced there and nowhere else.',
    );
  }
  const browser = read('components', 'stocks', 'StockBrowser.tsx');
  if (!/prefetch=\{false\}/.test(browser)) {
    fail(
      'StockBrowser stock links lost prefetch={false}',
      'next/link would prefetch the detail route on hover, running the server\n' +
        '  component and burning free-tier views the reader never opened.',
    );
  }
}

// ── 9. the billing endpoints must declare a private cache posture ────────────
// /api/portal and /api/checkout were the LAST two per-viewer surfaces saying nothing
// at all about caching (live-check Session 3). Next attaches no Cache-Control to route
// handlers — unlike pages, which get `no-cache, must-revalidate` — so "no header" was
// literal, and the portal's 303 `Location` is the most sensitive payload this app
// emits: a live Customer Portal session granting one customer's card, invoices and
// cancel button. Nothing leaked, because Vercel's CDN caches only on `s-maxage` and
// these are POSTs carrying none — which is exactly the objection. That is "safe by
// someone else's default", the failure CLAUDE.md 11a records THREE times, and the rule
// it now states is "say it AND guard it". This is the guard.
{
  for (const [label, file] of [
    ['app/api/portal/route.ts', ['app', 'api', 'portal', 'route.ts']],
    ['app/api/checkout/route.ts', ['app', 'api', 'checkout', 'route.ts']],
  ]) {
    const src = read(...file);
    // Strip comments so the prose above (which quotes the directives) can't satisfy
    // — or trip — the scan. Same technique as the api/cycle.py and analyze.py checks.
    const code = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
      .join('\n');

    if (!/'Cache-Control':\s*'private, no-store'/.test(code)) {
      fail(
        `${label} no longer declares a \`private, no-store\` header constant`,
        'Its success AND its refusals are per-caller answers — the 200/303 carries a\n' +
          '  single-customer Stripe URL, and each refusal names that caller\'s own reason.\n' +
          '  See CLAUDE.md rule 11a.',
      );
    }
    for (const bad of ['s-maxage', 'stale-while-revalidate', 'public,']) {
      if (code.includes(bad)) {
        fail(
          `${label} sends a shared-cache directive (${bad})`,
          'A shared cache keys on the URL alone, so the first caller\'s Stripe session\n' +
            '  URL would be handed to everyone else at that path.',
        );
      }
    }
    // Every return must carry it — a single unguarded branch is the whole hole, and
    // the refusals are exactly the branches people forget.
    const returns = code.match(/return NextResponse\.(json|redirect)\(/g) ?? [];
    const guarded = code.match(/headers:\s*NO_STORE/g) ?? [];
    if (returns.length === 0) {
      fail(`${label} has no NextResponse returns to check`, 'The scan below cannot be trusted; update this guard.');
    } else if (guarded.length < returns.length) {
      fail(
        `${label} has ${returns.length} responses but only ${guarded.length} carry NO_STORE`,
        'Every branch, including the 4xx/5xx refusals, must send `private, no-store`.',
      );
    }
  }
}

// ── 10. deletion confinement must reach the route handlers, not just the pages ─
// Live-check Session 3: every PAGE correctly streamed NEXT_REDIRECT to /reactivate for
// a deletion-scheduled account, while `/report` returned the full 3.2 MB paid report,
// `/api/analyze*` returned the full premium payload, and `/api/portal` 303'd into a live
// Customer Portal session — on an account the app had just signed out globally and told
// was deactivated. `/api/checkout` had no check either; it only 409'd in testing because
// that account happened to also have a subscription.
//
// The asymmetry is the bug: `requirePremiumPage()` evaluates deletion BEFORE
// entitlement, so the pages were never in doubt. These four surfaces each gate
// themselves and simply never asked. Same class as the duplicate-subscription finding —
// a guard present on one path and absent on its twin.
{
  const checks = [
    ['proxy.ts', ['proxy.ts'], /deletion_scheduled_at/],
    [
      'app/(app)/stocks/[market]/[ticker]/report/route.ts',
      ['app', '(app)', 'stocks', '[market]', '[ticker]', 'report', 'route.ts'],
      /viewer\.deletionScheduled/,
    ],
    ['app/api/portal/route.ts', ['app', 'api', 'portal', 'route.ts'], /deletion_scheduled_at/],
    ['app/api/checkout/route.ts', ['app', 'api', 'checkout', 'route.ts'], /deletion_scheduled_at/],
  ];
  for (const [label, file, re] of checks) {
    const code = read(...file)
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
    if (!re.test(code)) {
      fail(
        `${label} no longer checks whether the account is scheduled for deletion`,
        'A soft-deleted account is signed out everywhere and told it is deactivated;\n' +
          '  these endpoints must not keep serving it. Deletion outranks billing —\n' +
          '  evaluate it BEFORE entitlement, as requirePremiumPage() does.',
      );
    }
  }
  // The proxy must read the column as well as mention it, and must gate the premium
  // API paths on it — a select without a branch would satisfy a naive grep.
  const proxy = read('proxy.ts');
  if (!/select\([^)]*deletion_scheduled_at/.test(proxy)) {
    fail(
      'proxy.ts stopped SELECTING deletion_scheduled_at on the premium API gate',
      'Without the column the check below it can only ever see undefined, i.e. fail open.',
    );
  }
  if (!/account_deleting/.test(proxy)) {
    fail(
      'proxy.ts no longer returns the account_deleting reason',
      'The refusal must name deletion, not a billing state — 402 would invite someone\n' +
        '  whose account is being deleted to pay again.',
    );
  }
}

// ── 11. the dev harness's admin key must never reach shipped code ────────────
// The app's STRIPE_SECRET_KEY is a RESTRICTED key scoped exactly like the live one
// (Subscriptions/Checkout Sessions/Customer Portal write, Prices/Charges read,
// Customers NONE), so local dev cannot do anything production cannot. That property
// is what makes a local sandbox walk a truthful rehearsal — the whole point of
// Sessions 1–3. STRIPE_TEST_ADMIN_KEY is the escape hatch it needs a hole for: a
// full sk_test the scratchpad harness and `stripe:listen` use for test clocks,
// disputes and fake customers.
//
// The hole is only safe while it stays outside the app. One `process.env
// .STRIPE_TEST_ADMIN_KEY` in a route handler would silently restore full access on
// that path and undo the split — and, being a fallback, would most likely be added
// to "fix" precisely the permissions error the restriction is supposed to cause.
// It would also be a live-mode landmine: the variable does not exist in production,
// so the code would work locally and throw in front of a customer.
{
  const walk = (dir) => {
    const out = [];
    for (const e of readdirSync(path.join(webRoot, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) out.push(...walk(rel));
      else if (/\.(ts|tsx|mjs|js|py)$/.test(e.name)) out.push(rel);
    }
    return out;
  };

  // Everything that SHIPS. scripts/ and e2e/ are dev-only and may use the admin key;
  // api/ is the Python function bundle, which has no business holding it either.
  const shipped = [...walk('app'), ...walk('lib'), ...walk('api'), ...walk('components'), 'proxy.ts'];

  // A scan over an empty list passes for the wrong reason. If a rename or a walk bug
  // ever empties this, the check must go red rather than quietly stop protecting.
  if (shipped.length < 100) {
    fail(
      `the shipped-code scan found only ${shipped.length} files`,
      'It should see the whole app (hundreds). A near-empty list means the walk broke,\n' +
        '  and a scan over nothing reports success — fix the walk, do not lower this floor.',
    );
  }

  const offenders = shipped.filter((f) => read(f).includes('STRIPE_TEST_ADMIN_KEY'));
  if (offenders.length > 0) {
    fail(
      `shipped code reads STRIPE_TEST_ADMIN_KEY (${offenders.join(', ')})`,
      'That variable is the dev harness\'s FULL-access sk_test. Reading it from shipped\n' +
        '  code re-widens the app beyond its live scope on that path, and the variable does\n' +
        '  not exist in production — so the code would pass locally and throw for a real\n' +
        '  customer. The app gets STRIPE_SECRET_KEY only.',
    );
  }
}

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('\nPAYWALL GUARD FAILED — the entitlement gate has regressed:\n');
  for (const { check, detail } of failures) {
    console.error(`  ✗ ${check}`);
    if (detail) console.error(`    ${detail}`);
    console.error('');
  }
  console.error(
    'These checks encode bugs that were already found once (see the Step 10 plan).\n' +
      'If a change here is intentional, update this script in the same commit and say why.\n',
  );
  process.exit(1);
}

// Count the numbered sections in THIS file rather than hard-coding a total. The literal
// had drifted to "14" against 11 actual sections, because it was bumped by hand whenever a
// check was added and nothing tied it to reality — the same failure `pnpm
// check:report-sections` was taught to avoid in 736ce06. A number nobody can verify is
// worse than no number: it invites "13 checks passed" to be quoted in docs as a fact.
const sectionCount = (readFileSync(fileURLToPath(import.meta.url), 'utf8').match(/^\/\/ ── \d+\. /gm) ?? []).length;
console.log(`paywall guard: entitlement gates intact (${sectionCount} checks passed)`);
