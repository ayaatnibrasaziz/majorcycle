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
