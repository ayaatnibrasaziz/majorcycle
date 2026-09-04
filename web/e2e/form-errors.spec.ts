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
});
