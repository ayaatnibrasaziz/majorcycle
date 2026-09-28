import snapshot from '@/app/learn-snapshot.json';

import type { LandingSnapshot } from './landing';

/**
 * Apple's cycle figures for the `/learn` explainers — **live, rebuilt nightly**.
 *
 * Written by `analytics/cron/build_landing_snapshot.py` on every run and committed
 * by the US+CA workflow, exactly as the landing page's figures used to be.
 *
 * ── Why this is a separate file from `LANDING` ────────────────────────────────
 *
 * They hold the SAME SHAPE and are written from ONE computation. What differs is
 * their lifecycle, and that is a product decision rather than a technical one:
 *
 * - **`/learn` is an explainer.** It describes how the product behaves *today*, so
 *   its numbers stay current. Each article prints its own as-of date.
 * - **The landing page is a worked example.** It writes prose *about* its numbers
 *   and sits them beside the frozen Mag 7 table, so both must carry one date
 *   (finding 5A-013 — Apple once read −11.3% in the table and 8.0% in the prose
 *   three screens later, and CLAUDE.md 11k says two snapshots describing the same
 *   subject must agree).
 *
 * ⚠️ **Owner decision, 2026-09-01, and the reason it is worth naming:** freezing
 * the landing example would have frozen Learn too, because Learn read the same
 * file. The owner's instruction was *"keep the learn articles as is ... keep it
 * separate"* — so the fix is a third file rather than one behaviour imposed on two
 * different kinds of page. **The residual, stated rather than hidden:** a reader
 * moving from the landing to a Learn article can meet two different Apple
 * drawdowns. Both are labelled with their date, and they are on different pages —
 * which is what makes it acceptable where the same thing on ONE page was not.
 *
 * Type-shares `LandingSnapshot` deliberately: one generator writes both, so a field
 * added to one and not the other is a type error rather than a silent gap.
 */
export const LEARN_FIGURES: LandingSnapshot = snapshot;

/**
 * How today's fall compares with the typical one, in words that stay true whatever
 * the nightly figure is (beta review A-15, 2026-09-28).
 *
 * The worked example on `/learn/what-is-a-drawdown` used to call today's fall "a
 * meaningful drop", "unremarkable" and "under half" the typical one in fixed prose,
 * written when Apple was about 11% down. The figure is rebuilt nightly, and at 1.2%
 * the page called a 1.2% dip meaningful. The judgement now comes from the numbers,
 * compared as PRINTED (one decimal), so the words can never disagree with the
 * figures beside them.
 */
export function todayAgainstTypical(currentPct: number, typicalPct: number): {
  atHigh: boolean;
  comparison: string;
} {
  const today = Math.round(Math.abs(currentPct) * 10);
  const typical = Math.round(Math.abs(typicalPct) * 10);
  if (today === 0) return { atHigh: true, comparison: 'Today it has not fallen at all.' };
  if (today * 2 < typical) return { atHigh: false, comparison: 'Today’s fall is under half of that.' };
  if (today < typical) return { atHigh: false, comparison: 'Today’s fall is short of that.' };
  if (today === typical) return { atHigh: false, comparison: 'Today’s fall is the same size.' };
  return { atHigh: false, comparison: 'Today’s fall has gone further than that.' };
}
