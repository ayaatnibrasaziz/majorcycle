import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * An error is not a verdict about a stock, and neither is a Saved tick.
 *
 * ── Why this suite exists (audit 5A-102, owner-approved 2026-09-05) ─────────
 * P2 built `--status-warning` and stopped there, so every error on the product —
 * the eight form banners, the CSV import, both error pages, the onboarding gate's
 * alert line, Delete account, the screener's two numeric fields — was painted in
 * `--c-tier-5`, **our Bearish rating colour**. Nothing looked wrong, because red
 * is the right answer for an error. The defect was that errors had no name of
 * their own, so the day somebody retunes *Bearish* for a rating reason, every
 * error message on the site moves with it and nothing goes red (5A-050, 5A-070).
 *
 * ⚠️ **The two token sets hold IDENTICAL values today**, so the migration changed
 * nothing on screen — and while they are identical, no screenshot, no contrast
 * probe and no human review can tell a right choice from a wrong one (5A-057).
 * A guard is the only instrument that can. That is this file.
 *
 * ⚠️ Scoped to elements carrying `role="alert"`, which is what an error IS. That
 * derivation is deliberate and it needs **no exception list** — the repo's own
 * standing warning about hand-written lists (11c-iv). Two things fall outside it
 * for the right reason rather than by being named: `DelistedNotice` is
 * `role="note"` and reuses the rating tokens by the owner's explicit ruling
 * (F-035), and `OnboardingModal` draws all five rating swatches as a legend,
 * which is a rating surface that happens to live in the same file as an alert.
 *
 * ⚠️ **BOTH HALVES NOW, and the second one is why this comment exists.** Closing the
 * danger half surfaced its mirror: six of these same files painted their "Saved ✓" in
 * `--c-tier-2`, the Constructive rating green, and `CsvImport`'s tone map stated the
 * whole thing in three lines — `warn` moved in P2, `error` moved with 5A-102, `ok` was
 * still a judgement about a stock. `--status-success` was built the same day
 * (5A-134, owner-approved), so the rule below covers `role="status"` as well.
 *
 * ⚠️ **And say what it still cannot see.** Three of the nine success sites are whole
 * confirmation panels with no `role="status"` on the coloured element
 * (`ContactForm`, `UpdatePasswordForm`, `SignupForm`), and `CsvImport`'s is a tone map
 * in TypeScript. Those four are migrated and **unguarded**. Widening the match to any
 * element mentioning a rating token would flag the rating surfaces themselves, which
 * is how a guard gets loosened rather than obeyed (11t). A guard's scope is a claim
 * about what it can see (14g).
 *
 * Pure: no browser, no network, no credentials.
 */

const ROOTS = ['components', 'app'];
const SKIP = /node_modules|[.]next|report-bundle/;
const RATING_TOKEN = /--(?:c-tier-[1-5]|tint-tier-[1-5])/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * The opening tags of every element carrying `role="alert"`. An element's
 * attributes routinely span several lines, so this walks back to the `<` that
 * opens the tag and forward to the `>` that closes it.
 */
export function alertOpeningTags(src: string): string[] {
  const tags: string[] = [];
  for (const m of src.matchAll(/role=(?:"(?:alert|status)"|\{'(?:alert|status)'\}|\{"(?:alert|status)"\})/g)) {
    const open = src.lastIndexOf('<', m.index);
    if (open < 0) continue;
    // The first '>' that is not inside a {…} expression or a quoted string.
    let depth = 0;
    let quote = '';
    let end = -1;
    for (let i = open; i < src.length; i++) {
      const c = src[i]!;
      if (quote) {
        if (c === quote) quote = '';
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) {
        end = i;
        break;
      }
    }
    tags.push(src.slice(open, end < 0 ? src.length : end + 1));
  }
  return tags;
}

test.describe('errors and confirmations use the status palette, never the rating one', () => {
  const files = ROOTS.flatMap((r) => walk(r));
  const tags = files.flatMap((f) =>
    alertOpeningTags(readFileSync(f, 'utf8')).map((t) => ({ f, t })),
  );

  test('no role="alert" or role="status" element reaches for a rating token', () => {
    // Controls. A parser that finds nothing reports exactly what a clean
    // codebase reports, and so does a walker that finds no files.
    expect(files.length, 'no .tsx files — the walker is broken').toBeGreaterThan(100);
    expect(tags.length, 'no alert/status elements found — the tag parser is broken')
      .toBeGreaterThanOrEqual(8);
    expect(
      tags.filter(({ t }) => /--status-(?:danger|success)/.test(t)).length,
      'no alert/status element uses the status palette — the migration is gone, not merely unguarded',
    ).toBeGreaterThanOrEqual(8);

    const offenders = tags
      .filter(({ t }) => RATING_TOKEN.test(t))
      .map(({ f, t }) => `${f}  ${t.replace(/\s+/g, ' ').slice(0, 140)}`);

    expect(
      offenders,
      'Use --status-danger or --status-success (+ -ink, -tint, -tint-strong). A rating token ' +
        'here ties every error and every confirmation on the product to our five-tier judgement ' +
        'of a stock (audit 5A-102, 5A-134).',
    ).toEqual([]);
  });

  /**
   * The surfaces the role-based rule cannot reach, named one by one.
   *
   * ⚠️ THIS EXISTS BECAUSE THE ROLE RULE MISSED FOUR THINGS AND NOBODY KNEW. A
   * colour review on 2026-09-12 found the Delete-account confirmation panel still
   * washed in `--tint-tier-5`, the two Request/Results availability pills still
   * painted in `--c-tier-1` and `--c-tier-5`, and the upgrade dialog's unlock ticks
   * in `--c-tier-2`. Every one had been migrated at the INK and left on a rating
   * token for its SURFACE, or missed entirely — and the rule above is blind to all
   * of them, because none carries `role="alert"`. A guard's scope is a claim about
   * what it can see (14g), and that claim had been read as coverage.
   *
   * ⚠️ A LIST IS THE WRONG SHAPE FOR A RULE and the right shape for a KNOWN SET.
   * The rule above needs no exception list and must keep none (11c-iv). This is the
   * other thing: four specific surfaces, each asserted by name, so the list cannot
   * quietly stop matching. Every entry carries a control — the string it must NOT
   * contain — so a rule deleted outright fails here rather than passing vacuously.
   */
  test('the four surfaces outside the role rule use the status palette', () => {
    const cases: Array<{ file: string; must: string; mustNot: string; what: string }> = [
      { file: join('app', 'globals.css'), must: 'var(--status-success) 14%', mustNot: 'var(--c-tier-1) 14%',
        what: 'the Request / Results "Available now" pill' },
      { file: join('app', 'globals.css'), must: 'var(--status-danger) 12%', mustNot: 'var(--c-tier-5) 12%',
        what: 'the Request / Results "Not supported" pill' },
      { file: join('components', 'account', 'DeleteAccountCard.tsx'), must: 'bg-[var(--status-danger-tint)]',
        mustNot: 'bg-[var(--tint-tier-5)]', what: 'the delete-account confirmation panel' },
      { file: join('components', 'UpgradeDialog.tsx'), must: 'bg-[var(--status-success)]',
        mustNot: 'bg-[var(--c-tier-2)]', what: "the upgrade dialog's unlock ticks" },
    ];
    for (const c of cases) {
      const src = readFileSync(c.file, 'utf8');
      expect(src, `${c.what}: ${c.must} is gone from ${c.file}`).toContain(c.must);
      expect(src, `${c.what} is back on a rating token (${c.mustNot})`).not.toContain(c.mustNot);
    }
  });

  /**
   * ⚠️ The naive migration made one of these LESS legible, which is why the ink is
   * asserted and not just the token name. `--status-success` on its own 14% wash
   * measures 3.98:1 — under this project's 4.80 floor, and worse than the 6.16 of
   * the rating tier it replaced. `--status-success-ink` clears it at 6.17. A pill
   * that swapped the solid green in would have passed the check above and failed
   * the reader.
   */
  test('the availability pills carry the INK, not the solid status colour', () => {
    const css = readFileSync(join('app', 'globals.css'), 'utf8');
    // ⚠️ Sliced, not matched by a built regex. The first version of this line
    // assembled one from a string and the backslashes collapsed, so `\.` became a
    // wildcard dot and `\s` became a literal "s" — it matched nothing and reported
    // "the rule is gone" about a rule sitting right there. Indexing has no escaping.
    for (const rule of ['.req-pill--ok', '.skipped-pill--ok']) {
      const at = css.indexOf(rule + ' ');
      expect(at, `${rule} is gone from globals.css`).toBeGreaterThan(-1);
      const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
      expect(body, `${rule} must use --status-success-ink as its text`).toContain('color: var(--status-success-ink)');
    }
  });

  test('both status halves exist and the rating ramp survived the migration', () => {
    const css = readFileSync(join('app', 'globals.css'), 'utf8');
    for (const t of [
      '--status-danger:',
      '--status-danger-ink:',
      '--status-danger-tint:',
      '--status-danger-tint-strong:',
    ]) {
      expect(css, `${t} is not defined`).toContain(t);
    }
    for (const t of ['--status-success:', '--status-success-ink:', '--status-success-tint:',
      '--status-success-tint-strong:']) {
      expect(css, `${t} is not defined`).toContain(t);
    }
    // The reverse control: over-migrating would strip the rating ramp itself.
    expect(css, 'the rating tier is gone — the migration went too far').toContain('--c-tier-5:');
    expect(css).toContain('--c-tier-2:');
    expect(css).toContain('.tier-badge--5');
  });

  test('the tag parser sees a multi-line alert, and ignores role="note"', () => {
    const multiline = [
      '<div',
      '  role="alert"',
      '  className="text-[var(--c-tier-5-ink)] bg-[var(--tint-tier-5)]"',
      '>',
      '  {error}',
      '</div>',
    ].join('\n');
    const note = '<div role="note" className="text-[var(--c-tier-5-ink)]">x</div>';
    const status = '<span role="status" className="text-[var(--c-tier-2)]">Saved</span>';

    const found = alertOpeningTags(multiline);
    expect(found).toHaveLength(1);
    expect(RATING_TOKEN.test(found[0]!)).toBe(true);
    expect(alertOpeningTags(note)).toHaveLength(0);
    // role="status" is in scope too — that is the 5A-134 half.
    expect(alertOpeningTags(status)).toHaveLength(1);
    expect(RATING_TOKEN.test(alertOpeningTags(status)[0]!)).toBe(true);
  });
});
