import type { ReactNode } from 'react';

import { WeekRangeGauge } from '@/components/stocks/WeekRangeGauge';
import { INK } from '@/lib/ink';
import { quoteMatchesHistory } from '@/lib/quoteBasis';
import { InfoTip } from '@/components/ui/InfoTip';
import type { StockDetail } from '@/lib/stocks';
import { fmtPrice, fmtPriceDelta } from '@/lib/format';
import { marketLabel, tickerToUrlParts } from '@/lib/ticker';
import type {
  AnalystRecommendation,
  OverallLabel,
  ValuationZone,
} from '@/lib/types';

// Match the Browse page: show the clean symbol + a country badge rather than the
// raw exchange-suffixed storage ticker (BHP.AX / SHOP.TO). Country code via the
// shared `marketLabel` so it stays consistent with Browse / Run / tab title.

interface Props {
  stock: StockDetail;
  /** Streamed-in rating badges (cycle-dependent). Rendered under the meta line
   *  so the header itself paints immediately without waiting on cycle data. */
  badgeSlot?: ReactNode;
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

interface DailyChange {
  abs: number;
  pct: number;
}

function dailyChange(latest: number, previous: number): DailyChange {
  const abs = latest - previous;
  return { abs, pct: (abs / previous) * 100 };
}

/**
 * The page's own heading — the company's name, in the place it already appeared.
 *
 * ⚠️ AUDIT 5A-114, second pass (owner, 2026-09-04). The h1 came from the shared
 * header and read **"Stock Detail" on every one of the 863 tickers**, so a screen
 * reader's page title said which KIND of page this is and never which one. The
 * name was already on screen one line below it, as a `div`.
 *
 * ⚠️ Nothing moves. `<h1 className="inline">` inherits its size, weight and colour
 * from the wrapper exactly as the text node did — Tailwind's preflight sets
 * `font-size: inherit`, `font-weight: inherit` and no margin on headings, and
 * `inline` restores the display the browser's own stylesheet would otherwise make
 * `block`. The sector stays OUTSIDE the h1: "Apple Inc." is the page's name,
 * "Apple Inc. · Technology" is a name with a category stuck on it.
 *
 * One component rather than a copy in each branch of `StockHeader` — the two
 * differ only in whether a price is available, which is no reason for the heading
 * to exist twice and drift (11c).
 */
function CompanyName({ stock }: { stock: StockDetail }) {
  return (
    <div className="text-[14px] text-[var(--text-secondary)] mt-[2px]">
      <h1 className="inline">{stock.name ?? stock.ticker}</h1>
      {stock.sector ? <span> · {stock.sector}</span> : null}
    </div>
  );
}

/**
 * The Stock Detail page's identity strip. Visual parity with `.detail-header` in
 * `/reference/original-design.html` (lines 356-381 for CSS, 2562-2618 for markup).
 *
 * Deferred to Section 2 (Verdict card): the 3-badge row under the meta line
 * (overall rating, valuation zone, analyst consensus) — all three need cycle
 * data that the Verdict card PR will introduce.
 */
export function StockHeader({ stock, badgeSlot }: Props) {
  const { fundamentals, priceBars } = stock;
  const currency = fundamentals.currency;

  const latestBar = priceBars[priceBars.length - 1];
  const previousBar = priceBars[priceBars.length - 2];

  // No price history at all: still show the identity block (ticker, name, badges)
  // with an honest "price unavailable" note, rather than returning null and
  // leaving the page with no header. (Doesn't occur in the real universe — every
  // stock has ≥488 bars — but keeps a freshly-listed ticker graceful.)
  if (!latestBar) {
    return (
      <div className="flex items-stretch gap-5 mb-5 fade-in">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="font-[var(--font-mono)] text-[var(--font-hero)] font-bold text-[var(--text-primary)] tracking-[-1px]">
              {tickerToUrlParts(stock.ticker).symbol}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--text-muted)] bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[4px] px-[7px] py-[2px] flex-shrink-0">
              {marketLabel(stock.market)}
            </span>
          </div>
          <CompanyName stock={stock} />
          {badgeSlot}
        </div>
        <div className="ml-auto text-right min-w-[240px] flex flex-col items-end justify-center">
          <div className="text-[13px] text-[var(--text-muted)]">Price data unavailable</div>
        </div>
      </div>
    );
  }

  const currentClose = latestBar.close;
  const change = previousBar ? dailyChange(currentClose, previousBar.close) : null;
  // ⚠️ AUDIT 5A-135. DIRECTION, not RATING. This read `--c-tier-2` / `--c-tier-5`
  // -- our Constructive and Bearish *judgement of the stock* -- to say that a
  // price ticked up or down today. Correct on screen and wrong in principle: the
  // day somebody retunes a rating tier, yesterday's close moves with it, and
  // nothing goes red (CLAUDE.md 11c). `lib/ink.ts` forbids exactly this in its own
  // header and already holds the pair every other direction figure on this page
  // uses -- EarningsHistory, DividendHistory, AnalystTargetTrack, BalanceSheet.
  // Measured before switching: up 5.31 -> 5.90 on white, down 9.51 -> 6.68, so
  // both clear the 4.5 floor and the red is the same firebrick the rest of the
  // page already draws. Guarded by e2e/direction-not-rating.spec.ts.
  const changeColor = change && change.pct >= 0 ? INK.up : INK.down;

  // ⚠️ AUDIT 5A-125. The 52-week range and the analyst target come from the
  // provider's QUOTE; `currentClose` comes from its price HISTORY. After a split
  // those two can sit on different bases for days, and every figure below divides
  // one by the other — AvalonBay printed "+196.0% upside to target" and "63.3% off
  // high" on a stock that was flat. Both are withheld together because they share
  // the one suspect input; the cycle analysis is untouched, because it reads the
  // bars alone and is internally consistent. See lib/quoteBasis.ts.
  const quoteUsable = quoteMatchesHistory(priceBars, fundamentals.week52High);

  // Upside-to-analyst-target (if target is available)
  const target = quoteUsable ? fundamentals.analystTargetPrice : null;
  const upsidePct = target ? ((target - currentClose) / currentClose) * 100 : null;
  const upsideColor = upsidePct === null
    ? null
    : upsidePct >= 0
      // Same defect as `changeColor` above, three lines apart, found by grepping the
      // file rather than fixing only the line the audit named (CLAUDE.md 11c x).
      // #1E7C1E -> #1B741B: imperceptible, and it takes the last rating token off a
      // figure that is a direction. The DOWN case stays `--analyst-downside` on
      // purpose -- a price above the analyst target is not bad news, so its grey is
      // a deliberate choice and not a colour I am entitled to repaint (11l).
      ? INK.up
      : 'var(--analyst-downside)';
  const upsideText = upsidePct === null
    ? null
    : upsidePct >= 0
      ? `+${upsidePct.toFixed(1)}% upside to target`
      : `${Math.abs(upsidePct).toFixed(1)}% above target`;

  return (
    <div className="flex items-stretch gap-5 mb-5 fade-in">
      {/* Left column: identity */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="font-[var(--font-mono)] text-[var(--font-hero)] font-bold text-[var(--text-primary)] tracking-[-1px]">
            {tickerToUrlParts(stock.ticker).symbol}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--text-muted)] bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[4px] px-[7px] py-[2px] flex-shrink-0">
            {marketLabel(stock.market)}
          </span>
        </div>
        <CompanyName stock={stock} />
        <div
          className="inline-flex items-center gap-[6px] font-[var(--font-mono)] text-[10px] text-[var(--text-muted)] mt-1 tracking-[0.2px] cursor-help self-start"
          title="Data Freshness — Stock prices and fundamentals refresh overnight, after each market has closed. This shows when we last refreshed this stock, not the date of the price itself: the latest close a provider has published can be a session older."
        >
          <span
            /* A "data is fresh" light, which is neither a rating nor a direction --
               it is the same "that worked" green as every Saved tick, so it takes
               `--status-success` (5A-134). The DOT is byte-identical -- the two
               tokens hold the same value, which is why nothing moves. (The hex is
               deliberately NOT written here: `check:tier-palette` scans source
               WITH comments, so spelling it out fails the build. That is the
               fifth time this repo has been caught by a guard reading its own
               documentation -- 11au. Left as a reword rather than teaching the
               guard to strip comments, because a naive stripper would cut at the
               `//` inside a URL and could hide a real literal after it.) The
               HALO is not, and saying so matters: it was a hand-typed rgba of the
               OLD pre-2026-08-22 green (34,139,34 at .15) -- a colour the palette
               stopped using a fortnight ago -- and is now the token's own tint at
               .10. On a 3px ring around a 6px dot that is imperceptible; the point
               is that it can no longer drift from the dot it surrounds. */
            className="w-[6px] h-[6px] rounded-full bg-[var(--status-success)] animate-[metaPulse_2.4s_ease-in-out_infinite]"
            style={{ boxShadow: '0 0 0 3px var(--status-success-tint)' }}
            aria-hidden="true"
          />
          <span>Updated {formatUpdatedAt(stock.updatedAt)}</span>
        </div>
        {badgeSlot}
      </div>

      {/* Right column: price + delta + upside + 52W gauge */}
      <div className="ml-auto text-right min-w-[240px] flex flex-col items-stretch justify-start">
        <div className="font-[var(--font-mono)] text-[var(--font-hero)] font-semibold text-[var(--text-primary)] leading-[1.1]">
          {fmtPrice(currentClose, currency)}
        </div>
        {change && (
          <div
            className="font-[var(--font-mono)] text-[13px] font-semibold mt-1 tracking-[-0.1px]"
            style={{ color: changeColor }}
          >
            <PriceArrow direction={change.pct >= 0 ? 'up' : 'down'} />
            {change.pct >= 0 ? '+' : '−'}
            {fmtPriceDelta(Math.abs(change.abs), currentClose, currency)}
            {' ('}
            {change.pct >= 0 ? '+' : '−'}
            {Math.abs(change.pct).toFixed(2)}%{')'}
          </div>
        )}
        {upsideText && (
          <div
            /* ⚠️ `opacity-90` here until 2026-08-22. It dimmed a tier colour that clears the
               floor on its own (4.80) down to 4.03 -- a real WCAG failure produced by
               nothing but a utility class, and invisible to anyone reading the token.
               Recede with a COLOUR, never with transparency (CLAUDE.md 11q): a token
               can be measured, an opacity could not be until the probe learned to
               composite it. */
            className="text-[11px] font-semibold mt-[3px] tracking-[0.3px] uppercase"
            style={{ color: upsideColor ?? 'var(--text-muted)' }}
          >
            {upsideText}
          </div>
        )}
        {quoteUsable && fundamentals.week52Low != null && fundamentals.week52High != null && (
          <WeekRangeGauge
            low={fundamentals.week52Low}
            high={fundamentals.week52High}
            current={currentClose}
            currency={currency}
          />
        )}
      </div>
    </div>
  );
}

// ── Badge row ────────────────────────────────────────────────────────────────

const LABEL_TIER: Record<OverallLabel, number> = {
  'High Conviction': 1, Constructive: 2, Neutral: 3, Cautious: 4, Bearish: 5,
};

const ZONE_TIER: Record<ValuationZone, number> = {
  'DEEP VALUE': 1, VALUE: 2, FAIR: 3, STRETCHED: 4,
};

const ZONE_DISPLAY: Record<ValuationZone, string> = {
  'DEEP VALUE': 'Deep Value', VALUE: 'Value', FAIR: 'Fair', STRETCHED: 'Stretched',
};

export function BadgeRow({
  overallLabel,
  valuationZone,
  analystRecommendation,
  numAnalysts,
}: {
  /** Omitted for an unentitled viewer — our rating is premium (F3 Step 10). */
  overallLabel?: OverallLabel;
  /** Omitted for an unentitled viewer — premium. */
  valuationZone?: ValuationZone;
  analystRecommendation: AnalystRecommendation | null;
  numAnalysts: number | null;
}) {
  return (
    <div className="flex flex-wrap gap-[6px] mt-[10px]">
      {overallLabel && (
        <span
          className={`tier-badge tier-badge--${LABEL_TIER[overallLabel]}`}
          title={`Overall rating: ${overallLabel}. Composite of Financial Health (40%) + Valuation Zone (35%) + Cycle Payoff (25%).`}
        >
          {overallLabel}
        </span>
      )}
      {valuationZone && (
        <span
          className={`tier-badge tier-badge--${ZONE_TIER[valuationZone]}`}
          title={`Valuation zone: ${ZONE_DISPLAY[valuationZone]}. Derived from the current drawdown vs the stock's typical historical pullback.`}
        >
          {ZONE_DISPLAY[valuationZone]}
        </span>
      )}
      {analystRecommendation && (
        <span
          className="tier-badge tier-badge--analyst"
          title={`Analyst consensus: ${analystRecommendation}${numAnalysts ? ` (${numAnalysts} analysts)` : ''}. Third-party analyst data — not our rating.`}
        >
          {/* Attribution is VISIBLE, not just a tooltip, and unconditional. It used to
              appear only when our own badges were absent, on the theory that our label
              framed this chip. That reads backwards: beside "Neutral" and "Stretched",
              a bare "Buy" looks like the third thing WE concluded, which is precisely
              what CLAUDE.md #2 forbids. Colour and a hover title are not enough — the
              tooltip is invisible on touch, and the entitled view is the one where the
              chip has our labels to be mistaken for. Six characters, no ambiguity. */}
          {/* ⚠️ `opacity-70` until 2026-08-22 -- took --text-secondary from 7.53 to 3.07. Same
              rule as the upside line above: dim with a token, not with transparency.
              --text-secondary, not --text-muted: this label sits on a GREY chip
              (#DCE1E7), where muted measures 4.10 and secondary 5.72. The right
              token depends on the ground, which is why it was measured there
              rather than picked by name. */}
          <span style={{ color: 'var(--text-secondary)' }}>Analysts:&nbsp;</span>
          {analystRecommendation}
        </span>
      )}
      <InfoTip title="Rating badges">
        {overallLabel ? (
          <>
            Three quick reads at a glance. The first is MajorCycle&apos;s overall label
            (High Conviction → Bearish). The second is the Valuation Zone — how the
            current dip compares with this stock&apos;s typical pullback (Deep Value →
            Stretched). The third, if shown, is the Wall Street analyst consensus —
            third-party data, not our rating.
          </>
        ) : (
          <>
            The badge shown is the Wall Street analyst consensus — third-party data,
            reproduced as published. It is <strong>not</strong> a MajorCycle rating.
            Our own overall label and Valuation Zone are included with a subscription.
          </>
        )}
      </InfoTip>
    </div>
  );
}

function PriceArrow({ direction }: { direction: 'up' | 'down' }) {
  // Inline SVG matching reference (lines 2587-2588).
  return (
    <svg
      className="inline-block align-[-1px] mr-[3px]"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
    >
      <path
        d={
          direction === 'up'
            ? 'M5 1.5 8.5 6 6.2 6 6.2 8.5 3.8 8.5 3.8 6 1.5 6Z'
            : 'M5 8.5 1.5 4 3.8 4 3.8 1.5 6.2 1.5 6.2 4 8.5 4Z'
        }
        fill="currentColor"
      />
    </svg>
  );
}
