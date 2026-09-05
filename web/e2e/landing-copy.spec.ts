import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { expect, test } from '@playwright/test';

import LANDING from '../app/landing-snapshot.json';
import LEARN from '../app/learn-snapshot.json';
import MAG7_SNAP from '../app/mag7-snapshot.json';
import { type Mag7Snapshot, mag7Facts, pct1 } from '../lib/mag7';

/**
 * The landing page's two worked examples, and the PREMISE its copy rests on.
 *
 * Pure and credential-free — no browser, no network — so it runs on a fork PR with
 * no secrets and can never self-skip (the Playwright-only rule in CLAUDE.md).
 *
 * ── Why this file exists ──────────────────────────────────────────────────────
 *
 * Two findings from 2026-09-01, and the second is the one that generalises.
 *
 * **5A-013 — the dates drifted.** `landing-snapshot.json` was rebuilt nightly by
 * the cron while `mag7-snapshot.json` stayed frozen. Apple is in BOTH, so the live
 * page printed Apple at −11.3% in the ranked table and "8.0% below its high" three
 * screens later. Both correct for their own date; together, indistinguishable from
 * a mistake. CLAUDE.md 11k: *two snapshots describing the same subject must carry
 * the same date.*
 *
 * **5A-014 — computing the numbers was not enough.** Every figure in the callout
 * is derived from the snapshot by `mag7Facts()`, which is exactly why the count
 * and the rank self-corrected when the data moved. But the SENTENCE asserted a
 * *relationship* — that the deepest faller was also the weakest business — and
 * nothing preserves a relationship. On the new data the deepest faller is Meta,
 * the second-highest-rated company on the list, and the auto-substituted prose
 * would have called it "the weakest business on it" in fluent, specific English.
 *
 * **So the rule this file enforces: where copy states a relationship between rows,
 * assert the relationship, not the rows.** A regeneration that breaks the premise
 * now goes red instead of shipping a confident lie.
 */

const facts = mag7Facts();

test.describe('the two worked examples describe the same day', () => {
  test('landing-snapshot and mag7-snapshot carry the same asOf', () => {
    // The whole of 5A-013 in one line. These are regenerated together by hand
    // (`build_landing_snapshot.py --worked-example` + `build_mag7_snapshot.py`);
    // if a cron is ever pointed at one of them again, this is what says so.
    expect(MAG7_SNAP.asOf).toBe(LANDING.asOf);
  });

  test('Apple reads the same in the table and in the prose', () => {
    // The reader-visible assertion, not the raw one: both surfaces format through
    // `pct1`, and what matters is that a reader scrolling between them meets one
    // number. Comparing the underlying floats would pass on 8.0000 vs 8.0499 and
    // fail on a difference nobody can see.
    const appleInTable = MAG7_SNAP.rows.find((r) => r.ticker === LANDING.ticker);
    expect(appleInTable, `${LANDING.ticker} must appear in both snapshots`).toBeDefined();
    expect(pct1(appleInTable!.currentDrawdownPct)).toBe(pct1(LANDING.currentDrawdownPct));
  });
});

test.describe('/learn reads the LIVE figures, not the frozen ones', () => {
  /**
   * ⚠️ **Written after this exact regression happened, in this session.** A
   * `git checkout --` meant to undo a deliberate sabotage also reverted the import
   * in `DrawdownFigures.tsx` from `learn-figures` back to `landing` — silently
   * putting the Learn explainers back on the FROZEN snapshot, which is the one
   * thing the owner ruled against (*"keep the learn articles as is … keep it
   * separate"*). **All 151 tests in the affected specs still passed.**
   *
   * They passed because the guard next door asks *"is this number read off an
   * object rather than typed?"* — and it was. It cannot see WHICH object, so a
   * wrong-but-plausible source is invisible to it. The rendered figures are also
   * identical the day both files are written, so nothing on screen differs either;
   * the two only diverge as the frozen one ages, by which time nobody is looking.
   *
   * So the lifecycle has to be asserted at the IMPORT, which is the only place the
   * difference exists on the day the mistake is made.
   */
  const learnSources = [
    ['components/learn/DrawdownFigures.tsx', join(__dirname, '..', 'components', 'learn', 'DrawdownFigures.tsx')],
    ['app/(public)/learn/content.tsx', join(__dirname, '..', 'app', '(public)', 'learn', 'content.tsx')],
  ] as const;

  for (const [label, path] of learnSources) {
    test(`${label} imports the live snapshot, never the frozen one`, () => {
      const src = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');

      // It must take its FIGURES from learn-figures…
      expect(src, 'does not import LEARN_FIGURES').toContain('LEARN_FIGURES');
      // …and must not pull the frozen worked example in under any name. `depth`
      // is a formatter and is deliberately still shared, so this checks the
      // imported BINDINGS rather than the module path.
      const landingImports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/lib\/landing'/g)]
        .flatMap((m) => (m[1] ?? '').split(',').map((x) => x.trim().split(/\s+as\s+/)[0]!.trim()))
        .filter(Boolean);
      expect(
        landingImports.filter((n) => n !== 'depth' && n !== 'price'),
        'a /learn file imports the FROZEN landing snapshot — it must read learn-snapshot.json',
      ).toEqual([]);
    });
  }

  /**
   * The same rule, derived rather than listed — audit 5A-131.
   *
   * ⚠️ The two entries above are a HAND-WRITTEN list, and `e2e/learn.spec.ts` was
   * not on it. That spec read `landing-snapshot.json` from the day the two files
   * were split and passed for four days, because both files were written from one
   * run and stayed byte-identical: **two files that agree cannot tell you which one
   * you read.** The first nightly rebuild made them differ and it failed instantly
   * — the page said 5.6%, the frozen file said 8.0%.
   *
   * So this walks every file whose PATH says "learn" and asserts none of them names
   * the frozen file at all. A list cannot go stale if nothing maintains it.
   */
  test('no file about /learn names the frozen landing snapshot', () => {
    const roots = [
      join(__dirname, '..', 'components', 'learn'),
      join(__dirname, '..', 'app', '(public)', 'learn'),
      __dirname,
    ];
    const offenders: string[] = [];
    let checked = 0;

    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== 'node_modules') walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(e.name)) continue;
        const rel = relative(join(__dirname, '..'), full).split(sep).join('/');
        if (!/learn/i.test(rel)) continue;
        checked += 1;
        // ⚠️ COMMENTS STRIPPED, and this repo has now been caught by that three
        // times. The first run of this guard failed on `e2e/learn.spec.ts` — not
        // because it reads the frozen file, but because the paragraph explaining
        // that it USED to reads better with the filename in it. A rule stated in
        // prose must not satisfy, or violate, a check for the rule (11c-iv).
        const src = readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        if (src.includes('landing-snapshot.json')) offenders.push(rel);
      }
    };
    for (const r of roots) walk(r);

    // The control: a renamed directory, or a typo in the path filter, makes this
    // pass having looked at nothing — which is what a clean repo also reports (14g).
    expect(checked, 'no /learn files were examined at all').toBeGreaterThanOrEqual(3);
    expect(
      offenders,
      'these are about /learn and reference the FROZEN landing snapshot: ' +
        offenders.join(', ') +
        '. ' +
        'Read app/learn-snapshot.json — the /learn figures are nightly, the landing worked example is frozen.',
    ).toEqual([]);
  });

  test('the two Apple files agree the day they are written', () => {
    // Both come from ONE computation in build_landing_snapshot.py, so on the day
    // the frozen one is regenerated they must match exactly. Divergence afterwards
    // is expected and is the whole point; divergence AT BIRTH would mean the
    // generator wrote them from two different reads.
    expect(LEARN.ticker).toBe(LANDING.ticker);
    if (LEARN.asOf === LANDING.asOf) {
      expect(LEARN.currentDrawdownPct).toBe(LANDING.currentDrawdownPct);
      expect(LEARN.pullbackEvents).toBe(LANDING.pullbackEvents);
    }
  });
});

test.describe("the callout's premise still holds", () => {
  test('the deepest faller and the weakest business are different companies', () => {
    // If these collapse to one row the copy names the same company twice —
    // "Tesla and Tesla have fallen almost exactly the same distance".
    expect(facts.deepestFall.ticker).not.toBe(facts.weakest.ticker);
  });

  test('their falls really are "almost exactly the same distance"', () => {
    const gap = Math.abs(
      facts.deepestFall.currentDrawdownPct - facts.weakest.currentDrawdownPct,
    );
    // 1.2 points apart on the 2026-08-31 data. Five is the outer edge of what the
    // phrase can honestly carry; past that the sentence is simply false.
    expect(gap).toBeLessThanOrEqual(5);
  });

  test('their verdicts really are opposite', () => {
    // "The same discount, opposite verdicts" needs BOTH halves to be visibly true:
    // far apart in the ranking the reader can see, and far apart on the score the
    // sentence quotes. Either alone would let a pair that differs trivially pass.
    const ranked = [...MAG7_SNAP.rows].sort((a, b) => b.overallRating - a.overallRating);
    const rankGap = Math.abs(
      ranked.findIndex((r) => r.ticker === facts.weakest.ticker) -
        ranked.findIndex((r) => r.ticker === facts.deepestFall.ticker),
    );
    const healthGap = facts.deepestFall.healthScore - facts.weakest.healthScore;

    expect(rankGap, 'places apart in the ranking').toBeGreaterThanOrEqual(3);
    expect(healthGap, 'Financial Health points apart').toBeGreaterThanOrEqual(15);
  });

  test('the health score the copy quotes belongs to the company it names', () => {
    // The bug this replaced: the sentence said "{deepestFall} … ITS Financial
    // Health is {weakest.healthScore}", which was only ever right because the two
    // rows happened to be the same company. Asserting the values are DIFFERENT is
    // what makes the mix-up detectable at all.
    expect(facts.deepestFall.healthScore).not.toBe(facts.weakest.healthScore);
  });
});

/**
 * The controls.
 *
 * A probe written five minutes ago has never been observed failing, so a pass from
 * it carries no information (CLAUDE.md 11p). Each of these feeds `mag7Facts` a
 * snapshot whose answer is known in advance and asserts the guard above would have
 * caught it — the same real function, never a re-implementation.
 */
test.describe('controls — the guard can actually fail', () => {
  const row = (over: Partial<(typeof MAG7_SNAP.rows)[number]>) => ({
    ...MAG7_SNAP.rows[0]!,
    ...over,
  });

  test('a snapshot where the deepest faller IS the weakest is caught', () => {
    // This is the OLD (2026-08-13) shape — the one the previous copy relied on.
    const snap = {
      ...MAG7_SNAP,
      rows: [
        row({ ticker: 'AAA', overallRating: 80, healthScore: 90, currentDrawdownPct: -5 }),
        row({ ticker: 'BBB', overallRating: 50, healthScore: 40, currentDrawdownPct: -40 }),
      ],
    } as Mag7Snapshot;
    const f = mag7Facts(snap);
    expect(f.deepestFall.ticker).toBe('BBB');
    expect(f.weakest.ticker).toBe('BBB');
    // …which is exactly what the first assertion in this file forbids.
    expect(f.deepestFall.ticker === f.weakest.ticker).toBe(true);
  });

  test('a snapshot whose two falls are far apart is caught', () => {
    const snap = {
      ...MAG7_SNAP,
      rows: [
        row({ ticker: 'AAA', overallRating: 80, healthScore: 90, currentDrawdownPct: -40 }),
        row({ ticker: 'BBB', overallRating: 50, healthScore: 40, currentDrawdownPct: -2 }),
      ],
    } as Mag7Snapshot;
    const f = mag7Facts(snap);
    const gap = Math.abs(f.deepestFall.currentDrawdownPct - f.weakest.currentDrawdownPct);
    expect(gap).toBeGreaterThan(5);
  });

  test('a mismatched asOf is caught', () => {
    expect({ ...MAG7_SNAP, asOf: '2026-01-01' }.asOf).not.toBe(LANDING.asOf);
  });
});
