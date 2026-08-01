import 'server-only';

import { createAdminClient } from '@/lib/supabase/server';

/**
 * Free-tier daily view fence (F3 Step 10).
 *
 * A signed-in FREE user may open a limited number of DISTINCT stocks per UTC day.
 * Subscribers are never counted — locked decision #18 promises no usage limits, so
 * an entitled viewer must never reach this module at all.
 *
 * WHAT THIS IS FOR. It is an anti-scraping fence, not a revenue lever. The paywall
 * proper is `lib/entitlement.ts` + the key-stripping in `api/cycle.py`: a free
 * viewer never receives a scored field regardless of this counter. What remains
 * worth protecting is the *bulk* — someone walking all ~866 tickers to rebuild our
 * price/fundamentals corpus. Capping distinct stocks per day makes that slow and
 * visible without touching an ordinary reader, who opens a handful.
 *
 * FAILS OPEN, deliberately — the opposite of the entitlement gate. If the database
 * call errors, a genuine reader is let through rather than shown a limit they have
 * not hit. The asymmetry is the same reasoning as `lib/trialGuard.ts`: leaking
 * premium content costs revenue and must fail closed, whereas over-throttling a
 * free browse costs goodwill for no security gain, because the premium fields were
 * already stripped upstream.
 *
 * The counting itself lives in the `record_free_view` Postgres function (migration
 * 20260726020000), NOT here — a read-modify-write across two round-trips would lose
 * count under exactly the concurrent traffic this fence exists to stop. See that
 * migration's header.
 */

/**
 * Distinct stocks a free account may open per UTC day.
 *
 * Sized to be invisible to a real reader and painful to a scraper: browsing a dozen
 * names in an evening is normal, walking the ~866-ticker universe at this rate takes
 * over a month. Raise it freely — it is not a paywall, and the premium analysis is
 * withheld at every one of these views anyway.
 */
export const FREE_VIEW_DAILY_LIMIT = 25;

export interface FreeViewResult {
  /** False only when a free viewer opened a NEW stock while already at the cap. */
  allowed: boolean;
  /** Distinct stocks recorded for the current UTC day, after this view. */
  used: number;
  limit: number;
}

/** What we return whenever we decline to judge — see the fail-open note above. */
const ALLOW: FreeViewResult = {
  allowed: true,
  used: 0,
  limit: FREE_VIEW_DAILY_LIMIT,
};

/**
 * Record one free-tier stock view and report whether it may proceed.
 *
 * Re-opening a stock already seen today is free and does not write, so a refresh,
 * a back-navigation or a `next/link` prefetch can never burn quota (stock links
 * also pass `prefetch={false}` — audit finding B5).
 *
 * Call ONLY for an unentitled viewer. Uses the service-role client because the
 * counter columns are deliberately not writable by the user's own role: a counter
 * the browser can write is a counter the browser can reset (audit finding B4).
 */
export async function recordFreeView(
  userId: string,
  ticker: string,
): Promise<FreeViewResult> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('record_free_view', {
      p_user_id: userId,
      p_ticker: ticker,
      p_limit: FREE_VIEW_DAILY_LIMIT,
    });
    if (error) throw error;

    // `returns table (...)` arrives as a one-row array.
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: boolean; used?: number }
      | null
      | undefined;
    if (!row) return ALLOW;

    return {
      // Anything other than an explicit `false` allows — a shape change in the
      // function must not silently start locking real readers out.
      allowed: row.allowed !== false,
      used: typeof row.used === 'number' ? row.used : 0,
      limit: FREE_VIEW_DAILY_LIMIT,
    };
  } catch (err) {
    // Logged, not swallowed silently: the owner cannot debug from a blank screen,
    // and a fence that has quietly stopped counting should be visible in the
    // Vercel function logs rather than inferred from a scraping bill.
    console.error('[freeViews] record_free_view failed — allowing the view', err);
    return ALLOW;
  }
}
