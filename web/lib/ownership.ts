import type { TopHolder } from '@/lib/types';

/**
 * Below this share of the company, no listed holder is a "top" holder worth a table.
 *
 * ⚠️ Beta review B-3 / F-9, 2026-09-28. For a company listed outside the US, the
 * provider's holder list comes from US fund filings of the small US-traded slice, so
 * BHP's "top holders" were Mengis Capital, Paradigm and Pacer Advisors at 0.00% each —
 * under a summary saying institutions hold 40%. Measured: every one of the 109
 * Australian stocks with a holder list, 25 of 77 Canadian and 1 of 535 US had no
 * holder at or above 1%. Owner: hide the table for those.
 */
export const MEANINGFUL_HOLDER_SHARE = 0.01;

/**
 * Whether the holder table says anything: at least one holder owns 1% or more.
 * A holder with an unknown share cannot establish that, so a list of unknowns is
 * treated like a list of tiny holders — there is nothing to rank.
 */
export function holdersWorthShowing(holders: readonly TopHolder[]): boolean {
  return holders.some((h) => h.pct_out != null && h.pct_out >= MEANINGFUL_HOLDER_SHARE);
}
