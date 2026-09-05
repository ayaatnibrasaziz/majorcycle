/**
 * Our own copy may describe. It may not advise.
 *
 * THE DEFECT THIS GUARDS (audit F-001, reported at step zero 2026-08-23, still live
 * on the paid page when the owner asked whether the audit was finished — 2026-08-31):
 *
 *   DrawdownOverlay  "If Current approaches Lower Bound, risk/reward is very favourable."
 *   VerdictCard      "Historically attractive buy band"
 *   VerdictCard      "a pullback to here would historically offer better risk/reward"
 *
 * The first is a recommendation to buy. The second says "buy" outright, which decision
 * #16 bans in our own outputs. All three breach non-negotiable #12 / decision #24 —
 * educational and informational only, never financial advice, ASIC-compliant.
 *
 * ⚠️ **WHY IT SURVIVED EIGHT DAYS AFTER BEING FOUND, which is the part worth keeping.**
 * All three live in a `title` attribute or a `tooltip` prop, so they appear only on
 * hover. No screenshot shows them. No accessibility scan reads them. The compliance
 * guard asserts the *disclaimer is present*, which it was — the page was compliant
 * everywhere except inside a tooltip nobody had ever measured. **There was no check
 * that could have gone red**, so nothing did, and the finding sat in the audit log
 * reading as a to-do rather than as a live breach.
 *
 * ⚠️ And it was nearly fixed in HALF. The owner reported the "waiting" tile; its
 * sibling — the same band, described the same wrong way, shown when the price is
 * inside the zone — was two dozen lines up and not mentioned. Scoping a fix to the
 * instance that was reported is CLAUDE.md 11c, and it is how the first copy of this
 * defect came to exist: PR #90 fixed the Results table tooltips and left the chart.
 *
 * ── What this guard does NOT cover, said plainly (11c-ix) ────────────────────
 * It scans the ANALYSIS surfaces only — `components/stocks/` and `components/results/`,
 * where our own judgement about a stock is rendered. It deliberately does not scan:
 *
 *   · `/learn` and `/articles`, which are educational and legitimately ASK the
 *     advice-shaped question ("Is a falling stock a good time to buy?") in order to
 *     answer it. Banning the phrase there would be banning the teaching.
 *   · the analyst-consensus map in `lib/ratings.ts`, which renders Buy / Hold / Sell
 *     verbatim by decision #17. That is third-party data, not our judgement.
 *
 * Neither needs an exemption entry, because no pattern below matches a bare consensus
 * label — every one is a multi-word phrase. **An exemption that has to exist is an
 * exemption that can rot** (11t); the cheapest one is the one you never have to write.
 */

import { expect, test } from '@playwright/test';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Directories whose copy is OUR judgement about a stock. */
const SURFACES = ['components/stocks', 'components/results'] as const;

/**
 * Phrases that tell a reader what to do, or judge a price as good or bad.
 *
 * Each carries the real string it was written from, and a test below asserts every
 * pattern still matches its own example. A regex with a typo matches nothing and
 * reports a clean sweep — which is exactly what a clean system reports (CLAUDE.md 14g).
 */
const BANNED: ReadonlyArray<{ pattern: RegExp; because: string; historical: string }> = [
  {
    pattern: /risk\s*\/\s*reward/i,
    because: 'judges the trade rather than stating the number',
    historical: 'If Current approaches Lower Bound, risk/reward is very favourable.',
  },
  {
    pattern: /attractive\s+buy/i,
    because: '"buy" is banned in our own outputs by decision #16',
    historical: 'Historically attractive buy band, derived from the typical drawdown',
  },
  {
    pattern: /\bbuy\s+(band|zone|range)\b/i,
    because: 'names a price range as a place to buy',
    historical: 'The historically attractive buy band. Current price is above this zone',
  },
  {
    pattern: /\bconsider\s+(buying|selling|adding|trimming|taking)\b/i,
    because: 'an instruction inside a softened wrapper',
    historical: 'Consider taking profits into strength.',
  },
  {
    pattern: /\btaking\s+profits\b/i,
    because: 'an instruction to sell',
    historical: 'Consider taking profits into strength.',
  },
  {
    pattern: /\bshould\s+(buy|sell|avoid|hold)\b/i,
    because: 'a direct recommendation',
    historical: 'you should buy this at the lower bound',
  },
  {
    pattern: /\b(we|our)\s+recommend/i,
    because: 'a direct recommendation',
    historical: 'we recommend waiting for the entry zone',
  },
  {
    pattern: /good\s+time\s+to\s+(buy|sell)/i,
    because: 'a timing judgement',
    historical: 'now is a good time to buy',
  },
  {
    // ⚠️ Audit 5A-118, added 2026-09-04 on the owner's ruling. Both live instances sat
    // INSIDE this file's swept directories the whole time — the phrase simply was not on
    // the list, which is why a guard's coverage is its patterns and not its scope.
    // Deliberately narrow: it matches the HEDGED valuation verdict, not the word
    // "undervalued" on its own, so a future factual use ("the P/B says undervalued; the
    // cash flow does not") is not banned by a rule written for a tooltip.
    pattern: /potentially\s+(under|over)\s?valued/i,
    because: 'calls a price cheap or dear — a valuation verdict, not a description',
    historical: 'Near the left edge (low) = potentially undervalued or beaten down.',
  },
];

/**
 * ⚠️ A NINTH PATTERN WAS WRITTEN AND THEN REMOVED, 2026-08-31 — recorded because the
 * removal is a decision, not an oversight.
 *
 * A bare `/favou?rable/` was in this list when the guard first ran. It found two hits,
 * and neither is the defect this file exists for:
 *
 *   KpiStrip        "...0-34 = Bearish. Higher is more favourable. Information only - not advice."
 *   ThesisInsights  "...the current setup looks favourable... Observations, not a recommendation to buy."
 *
 * Both describe what OUR SCORE means rather than telling anyone to act, and each already
 * carries its own disclaimer in the same breath. The F-001 string it was written for —
 * "risk/reward is very favourable" — is caught by the `risk/reward` pattern regardless,
 * so the bare word added no coverage and produced two false positives.
 *
 * ⚠️ Three reasons it came out rather than being exempted. **A guard that cries wolf is
 * a guard people learn to skip**, and this one has to stay credible to be worth having.
 * **An exemption list is a second copy of the rule** and rots the moment the copy is
 * reworded (11t) — the cheapest exemption is the one never written. And rewording a
 * PAID surface because my own regex disliked it would be exactly the overreach the owner
 * reversed once already (11l): a real finding never licenses widening your scope.
 *
 * ⚠️ **What is genuinely NOT covered as a result, said rather than hidden (11c-ix):** a
 * future "the entry looks favourable" would slip past every pattern above. A narrower
 * regex was drafted for it and dropped as too fragile to trust — it is precisely the
 * probe written five minutes ago that has never been observed failing (11p). Both live
 * strings were put to the owner as their call, unchanged.
 */

/**
 * Source with comments removed.
 *
 * ⚠️ Not optional here: this file, and the two components it guards, quote every banned
 * phrase in their own prose while explaining the fix. `public-chrome.spec.ts` failed on
 * exactly that — twice — on the very sentence documenting its own defect.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function surfaceFiles(): { path: string; body: string }[] {
  const out: { path: string; body: string }[] = [];
  for (const dir of SURFACES) {
    const abs = join(__dirname, '..', dir);
    for (const name of readdirSync(abs)) {
      if (!name.endsWith('.tsx') && !name.endsWith('.ts')) continue;
      out.push({
        path: `${dir}/${name}`,
        body: stripComments(readFileSync(join(abs, name), 'utf8')),
      });
    }
  }
  return out;
}

test.describe('our own copy describes, it never advises', () => {
  test('every banned pattern actually matches its own example', () => {
    /**
     * ⚠️ THE LOAD-BEARING CONTROL. A pattern that matches nothing — a stray escape, a
     * typo, a word boundary in the wrong place — makes this entire file pass having
     * tested nothing, and a sweep that finds nothing looks identical whether the code
     * is clean or the instrument is broken. Every regex is proven against the real
     * string it was written from BEFORE any of them is trusted against the tree.
     */
    for (const { pattern, historical } of BANNED) {
      expect(
        pattern.test(historical),
        `pattern ${pattern} no longer matches its own example: "${historical}"`,
      ).toBe(true);
    }
  });

  test('the sweep actually reads files', () => {
    // An empty walk passes every assertion below it. This repo has been bitten by
    // exactly that, so the floor is asserted rather than assumed.
    const files = surfaceFiles();
    expect(files.length).toBeGreaterThanOrEqual(30);
    expect(files.some((f) => f.path.endsWith('VerdictCard.tsx'))).toBe(true);
    expect(files.some((f) => f.path.endsWith('DrawdownOverlay.tsx'))).toBe(true);
    // ...and that comment-stripping did not eat the code along with the prose.
    const verdict = files.find((f) => f.path.endsWith('VerdictCard.tsx'));
    expect(verdict?.body).toContain('Target Entry Zone');
  });

  test('no analysis surface tells the reader what to do', () => {
    const hits: string[] = [];
    for (const { path, body } of surfaceFiles()) {
      for (const { pattern, because } of BANNED) {
        const m = body.match(pattern);
        if (m) hits.push(`${path}: "${m[0]}" — ${because}`);
      }
    }
    expect(
      hits,
      `advice-shaped copy on a paid surface (non-negotiable #12 / decision #24):\n${hits.join('\n')}`,
    ).toEqual([]);
  });
});
