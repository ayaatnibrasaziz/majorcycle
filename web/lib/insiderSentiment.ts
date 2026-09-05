import type { InsiderTransaction } from '@/lib/types';

/**
 * Which way the insiders leaned — or `null` when the filings do not say.
 *
 * ── AUDIT 5A-127 (2026-09-05). Two measured defects, both a label stating
 * something the arithmetic underneath it did not support. ────────────────────
 *
 * **(i) A bearish verdict from no evidence at all.** This used to end in a bare
 * `return NET SELLER (Bearish)`, so a company whose filings contain no purchases
 * and no sales — only share awards, or transfers typed "Other" — fell through to
 * it. Measured on the live universe: **45 of the 820 stocks that have insider
 * filings**, including Bunge (BG), both Brookfield lines (BN.TO, BAM.TO), ALK.AX
 * and CCL-B.TO, each with **50 filings and not one of them a Purchase or a Sale**.
 * The page told the reader those insiders were selling. They were not doing
 * anything of the kind. A missing signal must read as missing — the same family as
 * yfinance's `0.0` margins meaning *not reported* (CLAUDE.md 14b).
 *
 * **(ii) "NET BUYER" printed over a net seller.** The test was `buys > sells * 0.5`,
 * so a company whose insiders sold $1.0m and bought $0.6m was labelled **NET BUYER
 * (Bullish)** — false on the plain meaning of the words. **24 of 820** sat in that
 * band. ⚠️ The 0.5 may well have been a deliberate analytical view — insiders sell
 * routinely to cover vesting and tax, so buying even half as much as they sell is
 * genuinely notable — but the fix cannot be to keep a sentence that is not true.
 * The comparison now matches the words. **If the tolerance was intended, restore it
 * with wording that describes it**, not with "NET BUYER".
 *
 * ⚠️ Neither defect could have been seen by looking. A label reading NET SELLER on
 * a company whose insiders are quiet is a perfectly ordinary-looking label, and so
 * is NET BUYER on one selling slightly more than it buys. Both were found by
 * counting across the whole universe, which is the only thing that can tell a
 * plausible label from a true one.
 *
 * Lives in `lib/` rather than beside its one consumer so it can be driven by a
 * pure, credential-free spec — importing it from the chart component would drag in
 * `lightweight-charts` and a `'use client'` boundary.
 */
export interface InsiderSentiment {
  label: string;
  /** Ink for the `.smart-section-tag` text. */
  color: string;
  /** The 8-10% wash it sits on — the darkest ground the ink was solved against. */
  bg: string;
}

export const INSIDER_BUY: Omit<InsiderSentiment, 'color' | 'bg'> = {
  label: 'NET BUYER (Bullish)',
};
export const INSIDER_SELL: Omit<InsiderSentiment, 'color' | 'bg'> = {
  label: 'NET SELLER (Bearish)',
};

export function insiderSentiment(
  txs: InsiderTransaction[],
  ink: { up: string; down: string },
): InsiderSentiment | null {
  const buys = txs
    .filter((t) => t.type === 'Purchase')
    .reduce((sum, t) => sum + (t.value ?? 0), 0);
  const sells = txs
    .filter((t) => t.type === 'Sale')
    .reduce((sum, t) => sum + (t.value ?? 0), 0);

  // No buying and no selling on record: say nothing. The timeline still shows every
  // award and transfer, which is the honest version of "here is what happened".
  if (buys <= 0 && sells <= 0) return null;

  if (buys > sells) {
    return { ...INSIDER_BUY, color: ink.up, bg: 'rgba(34,139,34,.10)' };
  }
  if (sells > buys) {
    return { ...INSIDER_SELL, color: ink.down, bg: 'rgba(178,34,34,.08)' };
  }
  return null; // exactly balanced — neither word would be true
}
