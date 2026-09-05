import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A number that went up is not a stock we like.
 *
 * ── Why this suite exists (audit 5A-135, owner-approved 2026-09-05) ─────────
 * `StockHeader` painted the daily price change `--c-tier-2` when up and
 * `--c-tier-5` when down: our **Constructive** and **Bearish** judgement of the
 * company, used to say that yesterday's close was a few cents higher. Correct on
 * screen — green really is the right colour for "up" — and wrong in principle,
 * because the two ideas are now welded together. Retune a rating tier for a
 * rating reason and every price delta in the product moves with it, on a paid
 * surface, with nothing red (CLAUDE.md 11c).
 *
 * `lib/ink.ts` has forbidden this in its own header since 2026-08-22 (*"These are
 * DIRECTION colours, not RATING colours… separate on purpose"*) and every other
 * direction figure on the same page already obeyed it — EarningsHistory,
 * DividendHistory, BalanceSheet, QuarterlyFinancials, AnalystTargetTrack. The
 * header was the consumer that never received the rule (11c-iv).
 *
 * ── What it matches, and why that shape ────────────────────────────────────
 * **A test against zero IS a direction question.** `x >= 0 ? a : b` asks which way
 * a number went and nothing else; there is no reading of it under which the
 * answer is a five-tier verdict on a company. So the rule is derived from the
 * code's own shape rather than from a list of files somebody remembered to write
 * down — this repo's standing warning about hand-written lists (11c-iv, 14g).
 *
 * ⚠️ **It needs NO exception list, and that is load-bearing.** When this guard was
 * written the sweep found exactly two offenders, both in `StockHeader`, three
 * lines apart: the price change the audit named, and the upside-to-target it did
 * not. Had the second been left, this file would have opened with an allow-list,
 * and an allow-list is how a guard stops being obeyed and starts being edited
 * (11t). Fixing it instead cost one imperceptible hex step (#1E7C1E → #1B741B).
 *
 * ⚠️ **Say what it cannot see** (14g). It reads a fixed window after each sign
 * test, so a colour chosen many lines away — assigned to a variable, or looked up
 * in a map keyed on a boolean — is outside it. It also has no opinion on CSS
 * classes that encode direction, only on tokens named in TS/TSX. It catches the
 * shape that actually occurred, twice, and claims nothing more.
 *
 * Pure: no browser, no network, no credentials.
 */

const ROOTS = ['components', 'app', 'lib'];
const SKIP = /node_modules|[.]next|report-bundle/;
const RATING_TOKEN = /--(?:c-tier-[1-5]|tint-tier-[1-5])/;
/** `>= 0 ?`, `> 0 ?`, `< 0 ?`, `<= 0 ?` — possibly wrapped across lines. */
const SIGN_TEST = /[<>]=?\s*0\s*\)?\s*\n?\s*\?/g;
const WINDOW = 260;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Strip comments, so the guard cannot fail on the paragraph documenting it —
 *  this repo has been caught by exactly that four times (CLAUDE.md 11au). */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** The branches of every ternary whose condition is a test against zero. */
export function signTestBranches(src: string): string[] {
  const clean = stripComments(src);
  const out: string[] = [];
  for (const m of clean.matchAll(SIGN_TEST)) {
    out.push(clean.slice(m.index, m.index + WINDOW).split(';')[0]!);
  }
  return out;
}

test.describe('direction is coloured with the direction palette, never the rating one', () => {
  const files = ROOTS.flatMap((r) => walk(r));

  test('no test-against-zero picks a rating token for its branches', () => {
    const branches = files.flatMap((f) =>
      signTestBranches(readFileSync(f, 'utf8')).map((b) => ({ f, b })),
    );

    // Controls. A walker that finds no files, or a matcher that finds no sign
    // tests, reports exactly what a clean codebase reports (14g).
    expect(files.length, 'no source files — the walker is broken').toBeGreaterThan(150);
    expect(branches.length, 'no sign tests found — the matcher is broken')
      .toBeGreaterThanOrEqual(20);
    // And the reverse control: the direction palette must still be REACHED by
    // them, or "no rating tokens" would also be satisfied by colouring nothing.
    expect(
      branches.filter(({ b }) => /INK\.(?:up|down)|--c-(?:up|down)-ink/.test(b)).length,
      'no sign test uses the direction palette — the migration is gone, not merely unguarded',
    ).toBeGreaterThanOrEqual(5);

    const offenders = branches
      .filter(({ b }) => RATING_TOKEN.test(b))
      .map(({ f, b }) => `${f}  ${b.replace(/\s+/g, ' ').slice(0, 150)}`);

    expect(
      offenders,
      'A test against zero asks which way a number moved. Use INK.up / INK.down (or ' +
        '--c-up-ink / --c-down-ink in CSS). A rating token here ties every price delta ' +
        'on a paid surface to our five-tier verdict on the company (audit 5A-135).',
    ).toEqual([]);
  });

  test('the matcher sees the defect, and ignores it inside a comment', () => {
    const bad = "const c = pct >= 0 ? 'var(--c-tier-2)' : 'var(--c-tier-5)';";
    const good = 'const c = pct >= 0 ? INK.up : INK.down;';
    const commented = "// const c = pct >= 0 ? 'var(--c-tier-2)' : 'var(--c-tier-5)';";
    const block = "/* pct >= 0 ? 'var(--c-tier-2)' : x */";

    expect(signTestBranches(bad)).toHaveLength(1);
    expect(RATING_TOKEN.test(signTestBranches(bad)[0]!)).toBe(true);
    expect(RATING_TOKEN.test(signTestBranches(good)[0]!)).toBe(false);
    expect(signTestBranches(commented)).toHaveLength(0);
    expect(signTestBranches(block)).toHaveLength(0);
  });

  test('the two StockHeader figures the audit named are on the direction palette', () => {
    // A named check as well as the mechanical one: the sweep above stays true if
    // somebody deletes both figures, and a deleted price delta is not a pass.
    const src = stripComments(readFileSync(join('components', 'stocks', 'StockHeader.tsx'), 'utf8'));
    expect(src, 'the daily price change lost its direction colours')
      .toMatch(/changeColor\s*=[\s\S]{0,120}INK\.up[\s\S]{0,40}INK\.down/);
    expect(src, 'upside-to-target lost its direction colour').toContain('? INK.up');
    expect(src, 'a rating token is back in StockHeader').not.toMatch(RATING_TOKEN);
  });
});
