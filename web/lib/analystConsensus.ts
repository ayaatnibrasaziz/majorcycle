/**
 * Analyst ratings on Smart Money Activity — which group a firm's grade belongs to, the
 * consensus chip, and the line under it that says what the chip was built from. Pure,
 * so it can be tested without rendering the chart (the component is `'use client'`).
 *
 * ⚠️ One classifier for the dot colours, the chip AND the line (2026-09-28). Until then
 * the dots and the chip each kept their own list of grade words, and they disagreed:
 * "Action List Buy" was counted as a HOLD by the chip, and "Perform", "Sector Weight"
 * and "Sector Performer" drew a navy dot while counting as Hold. Once the line prints
 * the counts, those disagreements would sit side by side on the page (CLAUDE.md 11c).
 *
 * Grades are the analysts' own words (third-party data, displayed verbatim —
 * non-negotiable #2). The groups are only a count of them: Buy also covers Outperform,
 * Overweight and Strong Buy; Sell covers Underperform and Underweight; everything else
 * a firm can say is Hold. An EMPTY grade is not a view at all and is never counted.
 */

import type { AnalystUpgrade } from '@/lib/types';

export type GradeGroup = 'buy' | 'hold' | 'sell';

const SELL = /\b(strong sell|sell|underperform|underweight|reduce|negative|avoid)\b/;
const BUY = /\b(buy|outperform|outperformer|overweight|accumulate|add|positive)\b/;

/** The group a grade belongs to, or null when there is no grade to classify. */
export function gradeGroup(grade: string | null | undefined): GradeGroup | null {
  const g = (grade ?? '').toLowerCase().replace(/-/g, ' ').trim();
  if (!g) return null;
  if (SELL.test(g)) return 'sell';
  if (BUY.test(g)) return 'buy';
  return 'hold';
}

export interface AnalystTally {
  /** Firms counted — each once, by its most recent graded event. */
  firms: number;
  buy: number;
  hold: number;
  sell: number;
  /** Oldest and newest event on record (ISO dates), like the insider line. */
  from: string;
  to: string;
}

/**
 * Where each firm stands now: its most recent graded event, over every stored event
 * (the provider keeps the latest 50 per stock), not only the ten listed on the card.
 */
export function analystTally(events: AnalystUpgrade[]): AnalystTally | null {
  const dated = events.filter((e) => e.date);
  if (!dated.length) return null;
  const latest = new Map<string, AnalystUpgrade>();
  for (const e of dated) {
    if (gradeGroup(e.to_grade) == null) continue;
    const prev = latest.get(e.firm);
    if (!prev || e.date > prev.date) latest.set(e.firm, e);
  }
  if (!latest.size) return null;
  const t: AnalystTally = { firms: latest.size, buy: 0, hold: 0, sell: 0, from: dated[0]!.date, to: dated[0]!.date };
  for (const e of latest.values()) t[gradeGroup(e.to_grade)!]++;
  for (const e of dated) {
    if (e.date < t.from) t.from = e.date;
    if (e.date > t.to) t.to = e.date;
  }
  return t;
}

/** The chip over the list — the plurality of the tally, ties going to the milder word. */
export function consensusFromTally(t: AnalystTally): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (t.buy >= t.sell && t.buy > t.hold) return 'BULLISH';
  if (t.sell > t.buy && t.sell > t.hold) return 'BEARISH';
  return 'NEUTRAL';
}
