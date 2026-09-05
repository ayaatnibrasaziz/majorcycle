import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A space you can see in the source is not a space the compiler emits.
 *
 * ── Why this suite exists (CLAUDE.md 11ac, extended 2026-09-05) ──────────────
 * SWC drops the LEADING whitespace of a JSX text node when that node spans more
 * than one line AND contains an HTML entity. The paragraph renders, wraps and
 * measures normally; the only wrong thing is the boundary between an element and
 * the text beside it. A human found the first instance; nothing else could.
 *
 * The existing protection (`e2e/lib/proseSpacing.ts`) asserts the OUTCOME on the
 * rendered DOM, which is the stronger check — and it walks `/learn` and
 * `/articles` only. Every signed-in surface was outside it, and that is where the
 * second instance was: `OnboardingModal`'s Valuation bullet, on the first-login
 * compliance screen, rendering "Valuation Score— how far…" while its three
 * siblings kept their space. Confirmed in the BUILT chunk, not reasoned about:
 *   Cycle Position"}),"        — where the current price…   (space kept)
 *   Financial Health Score"}),"— a 5-pillar composite…      (space kept)
 *   Valuation Score"}),"— how far today's price…            (space GONE)
 *
 * ⚠️ This spec bans the SHAPE rather than checking the outcome, because the
 * surfaces it protects need a session and cannot be rendered here. That is the
 * weaker of the two checks and is stated as such: it cannot see a lost space that
 * arrives by some other mechanism, which is what `proseSpacing.ts` is for.
 *
 * ⚠️ Comments are STRIPPED before matching. This repo has been caught three times
 * by a guard failing on the paragraph documenting the very fix it enforces —
 * including the comment in `OnboardingModal.tsx` that points back here.
 *
 * Pure: no browser, no network, no credentials.
 */

const ROOTS = ['components', 'app'];
const SKIP = /node_modules|[.]next|report-bundle/;
const ENTITY = /&[a-z]{2,6};|&#\d+;/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Blank out comment bodies, keeping the line count so reports stay accurate. */
export function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

/**
 * A JSX text node that starts on the same line as a closing tag and runs onto
 * the next line. Returns the node text so the caller can look for an entity.
 */
export function multiLineTextNodes(src: string): { line: number; text: string }[] {
  const lines = stripComments(src).split('\n');
  const found: { line: number; text: string }[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const m = /<\/[A-Za-z][\w.]*>\s+\S/.exec(lines[i]!);
    if (!m) continue;
    const next = lines[i + 1]!.trim();
    if (!next || /^[<{}]/.test(next)) continue;
    found.push({ line: i + 1, text: lines[i]!.slice(m.index) + ' ' + next });
  }
  return found;
}

test.describe('no JSX text node can lose its leading space to SWC', () => {
  test('no multi-line text node after a closing tag contains an HTML entity', () => {
    const files = ROOTS.flatMap((r) => walk(r));
    // Control: if the walker finds nothing, every assertion below is vacuous.
    expect(files.length, 'no .tsx files found — the walker is broken').toBeGreaterThan(100);

    let scanned = 0;
    const offenders: string[] = [];
    for (const f of files) {
      const nodes = multiLineTextNodes(readFileSync(f, 'utf8'));
      scanned += nodes.length;
      for (const n of nodes) {
        if (ENTITY.test(n.text)) offenders.push(`${f}:${n.line}  ${n.text.slice(0, 120)}`);
      }
    }
    // Control: the shape this bans must actually occur in the codebase, or the
    // detector could be matching nothing at all and would still report clean.
    expect(scanned, 'found no multi-line text nodes at all — the detector is broken')
      .toBeGreaterThan(40);

    expect(
      offenders,
      'Use a literal character (’ – —) instead of an entity here, or put the text on one line. ' +
        'SWC drops the leading space of a multi-line JSX text node containing an entity.',
    ).toEqual([]);
  });

  test('the detector sees the shape, and comments cannot trigger it', () => {
    const bad = [
      '<li>',
      '  <strong>Valuation Score</strong> — how far today&apos;s price has',
      '  pulled back versus the cycle',
      '</li>',
    ].join('\n');
    const good = [
      '<li>',
      '  <strong>Cycle Position</strong> — where the current price sits relative to',
      '  typical pullbacks',
      '</li>',
    ].join('\n');
    const commented = [
      '{/* <strong>x</strong> — today&apos;s price has',
      '    pulled back */}',
      '<li>ok</li>',
    ].join('\n');

    expect(multiLineTextNodes(bad).some((n) => ENTITY.test(n.text))).toBe(true);
    expect(multiLineTextNodes(good).some((n) => ENTITY.test(n.text))).toBe(false);
    expect(multiLineTextNodes(commented).some((n) => ENTITY.test(n.text))).toBe(false);
  });
});
