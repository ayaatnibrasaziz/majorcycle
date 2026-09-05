import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * An invalid field must SAY what is wrong, to everyone.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * `aria-invalid` tells a screen reader the field is wrong. It does not say what
 * is wrong with it, and on this product the messages are deliberately terse —
 * the screener's custom horizon answers "Min 21." — so the message is the ONLY
 * place a valid value is named. Without `aria-describedby` the reader hears
 * "invalid" and has to go looking.
 *
 * ⚠️ AUDIT 5A-101. The rule already existed, as a comment in the sibling that
 * does the same job: `StockBrowser`'s numeric filter says *"Link the inline
 * error to the input so a screen reader announces the reason (not just
 * `aria-invalid`)"* and wires it. `HorizonSettings`, one directory away and
 * doing the identical thing, was written separately and never received it.
 * That is 11c-iv — the consumer that never got the rule — and **a comment in
 * another file is not a gate** (11f), which is what this file is for.
 *
 * ⚠️ It was found by DRIVING the control, not by reading it. Nothing renders
 * differently: the field turns red, `aria-invalid` is set, the message appears
 * beside it and the Run button correctly disables. Every visual check passes.
 * The only observable difference is what a screen reader is handed, which is
 * why no screenshot, no contrast probe and no axe scan had an opinion — axe
 * cannot know that a nearby paragraph was meant to describe the field.
 *
 * Pure and credential-free: it reads source, so it runs on a fork PR with no
 * secrets and can never self-skip.
 */

const WEB = join(__dirname, '..');
const SKIP = new Set([
  'node_modules', '.next', '.next-dev', '.git', 'test-results', 'playwright-report',
  'lighthouse-report', 'design-system-build', 'public', 'dev-fixtures',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Comments stripped: a rule stated in prose must not satisfy a check for the rule.
 *  This repo has been caught twice by a guard passing on the sentence describing
 *  the fix rather than on the fix. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

test.describe('an invalid field says what is wrong', () => {
  const files = walk(join(WEB, 'components')).concat(walk(join(WEB, 'app')));

  test('every input that sets aria-invalid also points at its message', () => {
    const offenders: string[] = [];
    let checked = 0;

    for (const file of files) {
      const src = stripComments(readFileSync(file, 'utf8'));
      if (!src.includes('aria-invalid')) continue;
      checked++;
      if (!src.includes('aria-describedby')) {
        offenders.push(relative(WEB, file).split(sep).join('/'));
      }
    }

    // ⚠️ The control. Without it this passes on a codebase that has stopped using
    // aria-invalid entirely — zero files checked, zero offenders, green. That is
    // the "unmeasurable reads as clean" failure (CLAUDE.md 14g), and it is exactly
    // how a guard survives the deletion of the thing it guards.
    expect(
      checked,
      'no component sets aria-invalid any more — this guard is now measuring nothing',
    ).toBeGreaterThanOrEqual(2);

    expect(
      offenders,
      `these flag a field invalid without naming the reason:\n  ${offenders.join('\n  ')}\n` +
        'Give the message an id and point aria-describedby at it when the error is showing.',
    ).toEqual([]);
  });

  /**
   * AUDIT 5A-108 - the same defect one control over, found the same way: by
   * asking what a screen reader is handed rather than by looking at the page.
   *
   * An upload surface reports its outcome in text that belongs to no form field,
   * so `aria-describedby` alone cannot carry it - the message appears AFTER the
   * action, while focus is still on the control. `CsvImport`'s preview strip is
   * the ONLY feedback the import has: it names the file, the count, the
   * duplicates, the tickers outside our coverage, and all three hard failures
   * ("is not a .csv file", "is empty", "No tickers found in ..."). It rendered
   * into a plain <div>, so a screen-reader user who dropped the wrong file was
   * told nothing at all and had no way to know the import had not happened.
   *
   * The pattern was already in the codebase and this consumer never received it
   * (11c-iv): `RunProgress` has `aria-live="polite"`, `ResultsToolbar` has
   * `role="status"`. Nothing was red, because an unannounced message looks
   * identical on screen to an announced one.
   *
   * WHICH HALF THIS COVERS: it asserts the region EXISTS on every upload surface.
   * It cannot assert the region is always MOUNTED - so that a change of contents
   * is what gets announced, rather than the node arriving alongside its own text.
   * That is the part `CsvImport` gets right and only a real screen reader could
   * confirm. Said out loud, because an unstated blind spot reads as coverage (14g).
   */
  test('an upload surface announces its result', () => {
    const offenders: string[] = [];
    const checked: string[] = [];

    for (const file of files) {
      const src = stripComments(readFileSync(file, 'utf8'));
      // An upload surface: something a file can be dropped on, or a file picker.
      if (!/onDrop=/.test(src) && !/type="file"/.test(src)) continue;
      checked.push(relative(WEB, file).split(sep).join('/'));
      if (!/aria-live=|role="status"|role="alert"/.test(src)) {
        offenders.push(relative(WEB, file).split(sep).join('/'));
      }
    }

    // The control, for the same reason as the one above: with no upload surface
    // left in the codebase this would pass having looked at nothing (14g).
    expect(
      checked.length,
      'no component accepts a file any more - this guard is now measuring nothing',
    ).toBeGreaterThanOrEqual(1);

    expect(
      offenders,
      'these report an upload result to nobody: ' +
        offenders.join(', ') +
        ' - put the message in a live region (role="status" aria-live="polite") ' +
        'that is mounted before the message arrives.',
    ).toEqual([]);
  });

  /**
   * EVERY card title on a stock surface is a heading, INCLUDING the paid ones.
   *
   * ⚠️ AUDIT 5A-114. Its browser guard (`app-a11y.spec.ts`, "a full heading tree")
   * signs in with the shared account, which holds **no subscription** — so the cards
   * only an entitled viewer sees (`SnowflakeRadar`, `VerdictCard`, `ThesisInsights`,
   * `KpiStrip`) are replaced by locks and never render there at all.
   *
   * ⚠️ **This is not a guess about that scope; it is what a deliberate break proved.**
   * Demoting `SnowflakeRadar`'s title from `h3` to `h5` — a skipped level, exactly the
   * defect the browser test claims to catch — left it **passing**, because the page
   * under test rendered the lock instead. The same break in `CompanyOverview`, which
   * does render, failed correctly: *"The Verdict" (h3) → "Company Overview" (h5)*.
   * A guard's scope is a claim about what it can see (14g), and the only reason this
   * one's limit is written down is that the sabotage refused to break.
   *
   * So the browser test proves the TREE on the free render, and this one proves every
   * card title in the directory is a heading whatever the viewer's plan. Neither
   * covers the other.
   */
  test('every stock card title is a heading', () => {
    const offenders: string[] = [];
    let titles = 0;

    for (const file of files) {
      const rel = relative(WEB, file).split(sep).join('/');
      if (!rel.startsWith('components/stocks/')) continue;
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(/<(\w+)(\s+className="card-title[^"]*")/g)) {
        titles += 1;
        const tag = m[1]!;
        if (!/^h[1-6]$/.test(tag)) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${rel}:${line} <${tag}>`);
        }
      }
    }

    // The control: a typo in the regex, or a rename of `.card-title`, makes this
    // pass having found nothing — which is what a fixed codebase also looks like.
    // 29 existed when this was written.
    expect(
      titles,
      'no card titles found at all — this guard is measuring nothing',
    ).toBeGreaterThanOrEqual(25);

    expect(
      offenders,
      'these card titles are not headings:\n  ' +
        offenders.join('\n  ') +
        '\nUse <h3 className="card-title"> — the class sets its own size and weight, ' +
        'so the tag change is invisible on screen.',
    ).toEqual([]);
  });

  /**
   * A GRAPHIC THAT CARRIES A LABEL MUST CARRY A ROLE.
   *
   * ⚠️ AUDIT 5A-119. The sidebar padlock had `aria-label="Requires a subscription"`
   * on a bare icon and the short-interest gauge had one on a bare `<svg>`. Chrome
   * exposes both; an `aria-label` on an element with no role is not reliably
   * announced elsewhere, because the label has nothing to label. And note the
   * detail that decides it: lucide injects `aria-hidden` only when NO a11y prop is
   * passed, so passing a label already opts the icon INTO the accessibility tree.
   * The role decides whether it arrives there as anything at all.
   *
   * ⚠️ MY FIRST SWEEP FOR THIS WAS BLIND TO ONE OF THE TWO. It matched literal
   * `<svg` tags and reported 12 clean, 1 offender - and the padlock, the instance
   * the finding was WRITTEN from, is `<Lock />`, an icon component that renders an
   * svg and forwards its props. A probe scoped to the syntax I happened to picture
   * missed the case in front of me (11am). So this reads each file's lucide-react
   * import list and checks those names too.
   *
   * WHICH HALF THIS COVERS: graphics only - `<svg>` and lucide icons. It says
   * nothing about `aria-label` on a `<div>` or a custom wrapper, where whether a
   * role is needed depends on what that component renders and a source scan cannot
   * know. Naming the boundary rather than implying it covers everything (14g).
   */
  test('a labelled graphic has a role', () => {
    const offenders: string[] = [];
    let labelled = 0;

    for (const file of files) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const rel = relative(WEB, file).split(sep).join('/');

      // Every icon this file pulls from lucide-react - each renders an <svg> and
      // forwards the props it is given, so `<Lock aria-label=…>` IS a bare svg.
      const icons = new Set<string>();
      for (const imp of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g)) {
        for (const raw of imp[1]!.split(',')) {
          const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
          if (name) icons.add(name);
        }
      }

      // No `s` flag: `[^>]` already spans newlines, and dotAll is above our TS target
      // (TS1501). Playwright transpiled it happily and `pnpm typecheck` did not — the
      // spec passing is not the same as the repo compiling.
      for (const tag of src.matchAll(/<(svg|[A-Z][A-Za-z0-9]*)\b[^>]*?>/g)) {
        const [whole, name] = tag as unknown as [string, string];
        if (name !== 'svg' && !icons.has(name)) continue;
        if (!/\baria-label[=\s]/.test(whole)) continue;
        labelled += 1;
        if (!/\brole=/.test(whole)) {
          const line = src.slice(0, tag.index).split('\n').length;
          offenders.push(`${rel}:${line} <${name}>`);
        }
      }
    }

    // The control. A typo in either regex, or a day when no graphic carries a
    // label, makes this pass having examined nothing - which is what a clean
    // system also reports (14g). 12 were correct when this was written.
    expect(
      labelled,
      'no labelled graphic was found at all - this guard is measuring nothing',
    ).toBeGreaterThanOrEqual(10);

    expect(
      offenders,
      'these carry aria-label with no role, so the label has nothing to label:\n  ' +
        offenders.join('\n  ') +
        '\nAdd role="img" beside the label (or drop the label and mark it ' +
        'aria-hidden if the graphic is decorative).',
    ).toEqual([]);
  });
});
