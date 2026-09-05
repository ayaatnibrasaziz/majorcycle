/**
 * The axe configuration both accessibility suites share — the tag list, and the
 * five WCAG rules that tag list alone could never reach.
 *
 * ⚠️ **AUDIT 5A-152. Why this file exists.** `withTags(['wcag2a','wcag2aa',
 * 'wcag21a','wcag21aa'])` reads like "every WCAG A and AA rule axe has". It is
 * not. Five rules carry one of those tags **and** the tag `experimental`, and axe
 * ships experimental rules `enabled: false`, so a tag filter never reaches them:
 * they appear in **no bucket at all** — not violations, not passes, not even
 * inapplicable. A rule that never ran returns exactly what a passing rule returns
 * (CLAUDE.md 14g).
 *
 * That was not hypothetical. `label-content-name-mismatch` was silently absent
 * while the account button in the shared header failed it on all six signed-in
 * routes, for the life of the component (5A-151). Lighthouse ran the same audit
 * and **weights it 0**, so its accessibility category reported a clean 100 with
 * the failure inside it. Two instruments, one defect, no signal from either.
 *
 * ⚠️ **This is 11ap one layer deeper.** 11ap found that a checker's TAG LIST
 * decides what it may notice, and fixed it by asserting the `h1` separately.
 * Here the rule *matches* the tag list and is skipped for a second, independent
 * reason. So "is it in our tags?" is not the question — **"did it run?"** is, and
 * `assertRulesRan` below is what asks it.
 *
 * ⚠️ **Deliberately these five and not `enabled: true` for everything.** Turning
 * on every experimental rule would enable rules axe itself does not consider
 * settled, on surfaces nobody has looked at, and the first noisy failure would
 * teach someone to delete the option (CLAUDE.md 11t). These five are the ones
 * already inside the WCAG A/AA scope this project has committed to; all five were
 * measured across 18 routes on 2026-09-05 and exactly one fired.
 */
export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * WCAG A/AA rules axe marks `experimental`, listed with what each one catches so
 * the next person can tell a real failure from a rule that should be re-scoped.
 *
 * - `css-orientation-lock`      — content locked to one screen orientation (1.3.4)
 * - `label-content-name-mismatch` — visible text absent from the accessible name (2.5.3)
 * - `p-as-heading`              — a bold paragraph used where a heading belongs (1.3.1)
 * - `table-fake-caption`        — a caption row faked with cells (1.3.1)
 * - `td-has-header`             — a data cell in a large table with no header (1.3.1)
 */
export const EXPERIMENTAL_WCAG_RULES = [
  'css-orientation-lock',
  'label-content-name-mismatch',
  'p-as-heading',
  'table-fake-caption',
  'td-has-header',
] as const;

/** The `rules` option that turns them on. axe still applies the tag filter. */
export const RULE_OPTIONS = {
  rules: Object.fromEntries(EXPERIMENTAL_WCAG_RULES.map((id) => [id, { enabled: true }])),
};

type Bucketed = {
  violations: { id: string }[];
  passes: { id: string }[];
  incomplete: { id: string }[];
  inapplicable: { id: string }[];
};

/**
 * ⚠️ **The load-bearing control, and the reason this is not just an options
 * object.** Enabling a rule is a claim; a typo in an id, an axe upgrade that
 * renames one, or a future `disableRules` elsewhere would all silently return the
 * suite to the state this file was written to escape — green, and blind.
 *
 * So every scan asserts the five were actually EVALUATED. A rule that ran appears
 * in one of axe's four buckets; a rule that did not appears in none. `inapplicable`
 * is a real result (the page has no tables), so it counts as ran.
 */
export function rulesThatDidNotRun(results: Bucketed): string[] {
  const seen = new Set(
    [...results.violations, ...results.passes, ...results.incomplete, ...results.inapplicable].map(
      (r) => r.id,
    ),
  );
  return EXPERIMENTAL_WCAG_RULES.filter((id) => !seen.has(id));
}
