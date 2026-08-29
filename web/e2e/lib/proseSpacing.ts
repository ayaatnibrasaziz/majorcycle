import { expect, type Page } from '@playwright/test';

/**
 * A word must not run into a bold one.
 *
 * ── The defect this exists for, which nothing else could have caught ─────────
 *
 * The owner read the first article and said the space after two bold phrases was
 * missing. The source had the space in both places. So did every review, every
 * type check and all 649 tests.
 *
 * The cause is in the COMPILER. SWC drops the leading whitespace of a JSX text
 * node when that node spans more than one line AND contains an HTML entity.
 * Measured directly against `next/dist/build/swc`, holding everything else
 * equal:
 *
 *     <p>It <strong>x.</strong> Aussie sixty
 *       biggest here.</p>            ->  " Aussie sixty biggest here."   space kept
 *
 *     <p>It <strong>x.</strong> Aussie&rsquo;s sixty
 *       biggest here.</p>            ->  "Aussie’s sixty biggest here."  space GONE
 *
 *     <p>It <strong>x.</strong> Aussie&rsquo;s sixty biggest here.</p>
 *                                    ->  " Aussie’s sixty biggest here." space kept
 *
 * One line is safe. No entity is safe. Both together lose the space, silently,
 * on a page that still renders perfectly — the reader simply sees `reverses.`
 * welded to the next word. Trailing whitespace is unaffected, and a literal
 * `’` in place of `&rsquo;` is unaffected, which is why the article bodies now
 * carry the real characters instead of entities.
 *
 * ⚠️ **The fix is not the protection.** Removing the entities from one file
 * fixes one file; `learn/content.tsx` alone holds 151 of them, every one a
 * latent instance waiting for somebody to put a bold phrase in front of it. So
 * this guard asserts the OUTCOME on the rendered page — a word never butts
 * against an inline element — and stays true whatever the next cause turns out
 * to be (CLAUDE.md 11d: guard the artifact, not the source it came from).
 *
 * ⚠️ It reads the DOM rather than the visible string, because the two look
 * identical: `getComputedStyle` and `innerText` both report a perfectly ordinary
 * paragraph. Only the boundary between an element and the text beside it shows
 * the gap.
 */

/**
 * Characters that may legally follow a closing inline tag with no space.
 * Punctuation that closes or continues a clause; everything else — a letter, a
 * digit, an em dash (this site spaces its dashes), an opening quote or bracket —
 * means a space went missing.
 */
const OK_AFTER = /^[\s.,;:!?%)\]}’”…&/]/u;

/**
 * Characters that may legally precede an opening inline tag with no space.
 * SWC only drops LEADING whitespace, so this side has never failed here; it is
 * asserted anyway, because a guard that only looks the way the last bug came
 * from is a guard aimed at history (CLAUDE.md 11i-b: a bound on one side only
 * tests the direction that was never the failure mode).
 */
const OK_BEFORE = /[\s([{‘“—–/]$/u;

/** The tags article and Learn prose actually uses for inline emphasis. */
const INLINE = 'strong, em, b, a, code, abbr';

export interface SpacingDefect {
  tag: string;
  text: string;
  side: 'before' | 'after';
  neighbour: string;
}

/**
 * Assert that no inline element inside `selector` has lost the space beside it.
 *
 * @param page     a Playwright page already navigated to the article
 * @param selector the prose container, e.g. `[data-article-body]`
 * @param label    what to name in the failure message
 */
export async function expectNoLostSpaces(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  const found = await page.evaluate(
    ({ sel, inline, okAfterSrc, okBeforeSrc }) => {
      const okAfter = new RegExp(okAfterSrc, 'u');
      const okBefore = new RegExp(okBeforeSrc, 'u');
      const root = document.querySelector(sel);
      if (!root) return null;

      /**
       * The first character of real text after `el`, skipping React's `<!-- -->`
       * separators — which sit between adjacent text children and would
       * otherwise be read as "nothing follows".
       */
      const charAfter = (el: Element): string => {
        let n: ChildNode | null = el.nextSibling;
        while (n) {
          if (n.nodeType !== Node.COMMENT_NODE) {
            const t = n.nodeType === Node.TEXT_NODE ? (n as Text).data : (n.textContent ?? '');
            if (t.length) return t[0]!;
          }
          n = n.nextSibling;
        }
        return '';
      };
      const charBefore = (el: Element): string => {
        let n: ChildNode | null = el.previousSibling;
        while (n) {
          if (n.nodeType !== Node.COMMENT_NODE) {
            const t = n.nodeType === Node.TEXT_NODE ? (n as Text).data : (n.textContent ?? '');
            if (t.length) return t[t.length - 1]!;
          }
          n = n.previousSibling;
        }
        return '';
      };

      /**
       * ⚠️ A FLEX OR GRID PARENT IS NOT PROSE, and skipping it is the difference
       * between a guard and a nuisance. Inside such a container the space
       * between two children is `gap`, not a character, so "no whitespace in the
       * DOM" is the correct and intended state — the closing CTA's button and
       * its "Free, and it takes no card." sit exactly like that, and the first
       * version of this check reported them. The same shape produced 56 false
       * positives when the whole build output was swept: every Learn legend is a
       * swatch `<span>` beside its label.
       *
       * The narrowing costs nothing real: an article's prose is `<p>`, `<li>`
       * and table cells, all of them normal flow.
       */
      const isLaidOut = (el: Element): boolean => {
        const parent = el.parentElement;
        if (!parent) return false;
        const d = getComputedStyle(parent).display;
        return d.includes('flex') || d.includes('grid');
      };

      const out: {
        tag: string;
        text: string;
        side: 'before' | 'after';
        neighbour: string;
      }[] = [];
      const els = [...root.querySelectorAll(inline)].filter((el) => !isLaidOut(el));
      for (const el of els) {
        const own = el.textContent ?? '';
        if (!own) continue;
        const after = charAfter(el);
        // An empty neighbour means the element ends the block — nothing to
        // butt against.
        if (after && !okAfter.test(after) && /[\w%’”.,)]$/u.test(own)) {
          out.push({ tag: el.tagName.toLowerCase(), text: own.slice(-32), side: 'after', neighbour: after });
        }
        const before = charBefore(el);
        if (before && !okBefore.test(before) && /^[\w“‘(]/u.test(own)) {
          out.push({ tag: el.tagName.toLowerCase(), text: own.slice(0, 32), side: 'before', neighbour: before });
        }
      }
      return { count: els.length, out };
    },
    { sel: selector, inline: INLINE, okAfterSrc: OK_AFTER.source, okBeforeSrc: OK_BEFORE.source },
  );

  expect(found, `${label}: "${selector}" is not on the page`).not.toBeNull();
  // ⚠️ The positive control. A container that holds no inline elements passes
  // every assertion below having examined nothing — the same way a contrast
  // sweep of an empty page comes back perfect (CLAUDE.md 11q). Article prose
  // always carries bold phrases; if it stops, this guard has stopped working.
  expect(
    found!.count,
    `${label}: no inline elements found — the guard looked at nothing`,
  ).toBeGreaterThan(3);

  const lines = found!.out.map(
    (d) => `  ${d.side === 'after' ? `<${d.tag}>…${d.text}</${d.tag}>` : `${d.text}…`} ` +
      `runs straight into "${d.neighbour}"`,
  );
  expect(found!.out, `${label}: a space is missing beside an inline element:\n${lines.join('\n')}`)
    .toEqual([]);
}
