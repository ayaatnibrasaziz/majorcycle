import { depth } from '@/lib/landing';
import { LEARN_FIGURES } from '@/lib/learn-figures';
import { Figure, LegendItem } from '@/components/Figure';
import {
  AVG_LINE,
  AxisFrame,
  AxisLabels,
  DD_FILL,
  DD_LINE,
  LOW_LINE,
  PLOT_L,
  Plot,
  Swatch,
  TimeNote,
  TodayDot,
  ddArea,
  rx,
} from './chartPrimitives';
import {
  FULL_PATH,
  WINDOW_SPAN,
  WINDOW_START,
  axisTicks,
  detailed,
  drawdownFromPeakY,
  drawdownSeries,
  peakYFrom,
  pointsAttr,
  priceAt,
  recentView,
  seriesStats,
} from './drawdownGeometry';

/**
 * The drawdown article's three figures.
 *
 * ⚠️ **These are drawn in the PRODUCT's idiom, not in one invented for the
 * article** (owner, 2026-08-19; CLAUDE.md 11m). A reader who signs up meets
 * `components/stocks/DrawdownOverlay.tsx`, so the picture that teaches them what
 * a drawdown is has to be the picture they will actually see: the fall hangs
 * BELOW a 0% line, the curve is `--brand-mid`, the fill is the same red tint,
 * the average is a gold dashed rule and the deepest is a firebrick one. The
 * rolling-peak maths is a port of that component's own `computeDrawdown`.
 *
 * ⚠️ **Ported rather than imported, and the cost is named.** The real overlay is
 * a `'use client'` component built on `lightweight-charts` and fed `PriceBar[]`.
 * Importing it would put a charting library and a hydration cost on a
 * prerendered public page, and a reader without JavaScript would get nothing at
 * all. So the formula is duplicated — and `learn.spec.ts` pins the copy to the
 * independently-derived percentages so the two cannot quietly disagree.
 *
 * ⚠️ **A fall is drawn DOWNWARD.** The first version put each percentage on a
 * horizontal rule at the peak, so a NEGATIVE number floated at the very top of
 * the chart while the fall it described ran downwards. The owner caught it on
 * sight. In drawdown space the direction is structural rather than something to
 * remember: zero is the top of the box and there is nowhere for a fall to go but
 * down.
 *
 * ⚠️ **Still schematics** (CLAUDE.md #24). Price and time axes make the shape
 * readable, but there are no dates and no gridlines, and both captions say in
 * words that the stock is imaginary. A dense, plausible chart would read as a
 * real security's history and imply a claim we do not make.
 */

// ─────────────────────────────────────────────────────────────────────────────
// FIGURE 1 — the same moment, as a price and as a drawdown
// ─────────────────────────────────────────────────────────────────────────────

const RECENT = recentView(WINDOW_START.medium);
const DD_YEAR = drawdownFromPeakY(peakYFrom(WINDOW_START.medium));
const DD_LAST_TOP = drawdownFromPeakY(56);

const PRICE_FLOOR = 92;
const PRICE_TICKS = axisTicks(15, 85, RECENT.priceOf).map((t) => ({ y: t.y, value: t.price }));

/**
 * The recent year as a drawdown.
 *
 * ⚠️ `RECENT.priceOf`, never `priceAt` — the zoomed path lives in its own
 * re-fitted coordinate space. See the note on `drawdownSeries`.
 */
const RECENT_DD = drawdownSeries(RECENT.path, 100, RECENT.priceOf);
const RECENT_DD_MIN = Math.min(...RECENT_DD.map((p) => p.pct));
/** Today's point ON the curve — the marker is placed from this, not derived twice. */
const RECENT_DD_TODAY = RECENT_DD[RECENT_DD.length - 1]?.pct ?? 0;
/** 0% sits at the top; the deepest point sits near the floor. */
const DD1_TOP = 12;
const DD1_FLOOR = 84;
const dd1Y = (pct: number): number =>
  DD1_TOP + (Math.abs(pct) / Math.abs(RECENT_DD_MIN)) * (DD1_FLOOR - DD1_TOP);
const DD1_TICKS = [0, RECENT_DD_MIN / 2, RECENT_DD_MIN].map((v) => ({
  y: dd1Y(v),
  value: Math.round(v),
}));

export function PeakChoiceFigure() {
  /**
   * ⚠️ Read OFF THE CURVE, never derived a second time. This marker sat at
   * `dd1Y(DD_YEAR)` — a correct number reached by an independent route — while
   * the curve beside it ended somewhere else entirely, so the dot floated
   * 11.8 points off its own line. Taking the value from the series it is
   * marking makes that impossible rather than unlikely.
   */
  const todayDdY = dd1Y(RECENT_DD_TODAY);
  return (
    <Figure
      legend={
        <>
          <LegendItem swatch={<Swatch color="var(--brand-bright)" />}>
            Its high for the past year
          </LegendItem>
          <LegendItem swatch={<Swatch color="var(--text-secondary)" />}>
            A smaller top it made along the way
          </LegendItem>
          <LegendItem swatch={<Swatch color={DD_LINE} dashed={false} />}>
            The same year as a drawdown
          </LegendItem>
        </>
      }
      caption={
        <>
          A schematic, not a real stock — but drawn the way MajorCycle draws it.
          The top panel is the share price; the bottom is the same year expressed
          as a drawdown, which is why it hangs below zero and never rises above
          it. Today the price is {Math.abs(DD_YEAR)}% under its high for the year.
          Measure instead from the smaller top it made in between and the same day
          is only {Math.abs(DD_LAST_TOP)}% down — one price, two correct answers.
        </>
      }
    >
      {/* ── price ─────────────────────────────────────────────────────────── */}
      <Plot box="aspect-[16/7] sm:aspect-[16/5]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            'Upper panel: a schematic share price over about a year, with a price scale ' +
            'up the left. It peaks near one hundred dollars, falls steeply to about ' +
            'seventy, recovers to a lower top near ninety, then drifts down to about ' +
            'eighty dollars today.'
          }
        >
          <AxisFrame floorY={PRICE_FLOOR} />

          {/* The two highs a reader is being asked to tell apart. */}
          <line
            x1={rx(RECENT.yearHighX)}
            y1={RECENT.yearHighY}
            x2={rx(100)}
            y2={RECENT.yearHighY}
            stroke="var(--brand-bright)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={rx(RECENT.lastTopX)}
            y1={RECENT.lastTopY}
            x2={rx(100)}
            y2={RECENT.lastTopY}
            stroke="var(--text-secondary)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />

          <polyline
            points={pointsAttr(detailed(RECENT.path).map(([x, y]) => [rx(x), y] as const))}
            fill="none"
            stroke="var(--brand-deep)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <AxisLabels ticks={PRICE_TICKS} format={(v) => `$${v}`} stub />
        <TodayDot y={RECENT.todayY} />
      </Plot>

      {/* ── the same year, as a drawdown ──────────────────────────────────── */}
      <Plot box="aspect-[16/6] sm:aspect-[16/4]" className="mt-2">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            'Lower panel: the same year drawn as a drawdown. Zero per cent is the top ' +
            'line and the curve hangs below it, never above, because a price cannot be ' +
            `higher than its own peak. It bottoms out near ${Math.abs(Math.round(RECENT_DD_MIN))} ` +
            `per cent and today sits ${Math.abs(Math.round(RECENT_DD_TODAY))} per cent below the high.`
          }
        >
          <AxisFrame floorY={DD1_FLOOR + 8} />

          {/* Zero: the line a drawdown is measured from, and can never cross. */}
          <line
            x1={PLOT_L}
            y1={dd1Y(0)}
            x2="100"
            y2={dd1Y(0)}
            stroke="var(--text-secondary)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          <polygon points={ddArea(RECENT_DD, dd1Y)} fill={DD_FILL} stroke="none" />
          <polyline
            points={RECENT_DD.map((p) => `${rx(p.x).toFixed(2)},${dd1Y(p.pct).toFixed(2)}`).join(' ')}
            fill="none"
            stroke={DD_LINE}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* ⚠️ There was a dashed rule here at −11%, meant to show what the same
              day looks like measured from the smaller top. It was removed: on a
              drawdown chart a horizontal rule reads as a THRESHOLD LEVEL, not as
              an alternative reading of one day, so it said something the figure
              did not mean. The alternative belongs in the price panel above,
              where the two highs are visible, and in the caption. */}
        </svg>
        <AxisLabels ticks={DD1_TICKS} format={(v) => `${v}%`} />

        {/* ⚠️ **BELOW the dot, not beside it.** Beside it, an 11px gap measured as
            "no overlap" and still looked wrong: the text ran into the marker and
            the curve passed straight through the digits. The empty area under the
            final point is the only place near the right edge that is reliably
            clear of both. Offset in px, never a percentage — a percentage is a
            different number of pixels at every width, the trap already documented
            on CycleDiagram's "Today" label. ⚠️ Bounding boxes not touching is a
            weaker claim than legibility; this one needed the picture. */}
        <span
          data-fall-marker
          className="hidden sm:block absolute -translate-x-1/2 translate-y-[11px] font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[var(--brand-mid)]"
          style={{ left: `${rx(100)}%`, top: `${todayDdY}%` }}
        >
          {Math.round(RECENT_DD_TODAY)}%
        </span>
        <TodayDot y={todayDdY} color={DD_LINE} />
      </Plot>
      <TimeNote>Time → (about a year)</TimeNote>
    </Figure>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIGURE 2 — one horizon, drawn the way the product draws it
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **ONE curve, not three** (owner, 2026-08-19). This drew all three horizons
 * at once, with the average and deepest rules taken from the one-year curve —
 * and the owner spotted the flaw in that: **those two levels are themselves
 * per-horizon.** Three curves plus two rules that silently belonged to only one
 * of them is a chart making a claim it cannot support, and it was busy on top.
 *
 * So the figure shows the default horizon only and the caption says, in words,
 * that all three of these move when you change it. The prose section beside the
 * figure is where the comparison belongs; a picture that needs a paragraph to
 * disclaim itself is the wrong picture.
 */
const MEDIUM_DD = drawdownSeries(FULL_PATH, WINDOW_SPAN.medium, priceAt);
const MEDIUM_TODAY = MEDIUM_DD[MEDIUM_DD.length - 1]?.pct ?? 0;

/** The engine's own Avg / Low, derived from this curve's troughs. */
const MEDIUM_STATS = seriesStats(MEDIUM_DD, -5);

const DD2_TOP = 12;
const DD2_FLOOR = 82;
const DD2_MIN = Math.min(...MEDIUM_DD.map((p) => p.pct), MEDIUM_STATS.lowest ?? 0);
const dd2Y = (pct: number): number =>
  DD2_TOP + (Math.abs(pct) / Math.abs(DD2_MIN)) * (DD2_FLOOR - DD2_TOP);
const DD2_TICKS = [0, DD2_MIN / 2, DD2_MIN].map((v) => ({ y: dd2Y(v), value: Math.round(v) }));

export function WindowChoiceFigure() {
  const todayY = dd2Y(MEDIUM_TODAY);
  return (
    <Figure
      legend={
        <>
          <LegendItem swatch={<Swatch color={DD_LINE} dashed={false} />}>
            How far below its high, day by day
          </LegendItem>
          {MEDIUM_STATS.typical !== null && (
            <LegendItem swatch={<Swatch color={AVG_LINE} />}>
              Its average fall ({Math.round(MEDIUM_STATS.typical)}%)
            </LegendItem>
          )}
          {MEDIUM_STATS.lowest !== null && (
            <LegendItem swatch={<Swatch color={LOW_LINE} />}>
              Its deepest ever ({Math.round(MEDIUM_STATS.lowest)}%)
            </LegendItem>
          )}
        </>
      }
      caption={
        <>
          The same imaginary stock over three years, on the one-year horizon — the
          chart MajorCycle draws for every company it covers. The curve is how far
          below its high the price sat on each day, so it hangs under zero and
          never rises above it. The two flat rules are what we add: this
          stock&rsquo;s average fall and the deepest it has ever gone, which is
          what tells you whether today&rsquo;s{' '}
          {Math.abs(Math.round(MEDIUM_TODAY))}% is ordinary or unusual.{' '}
          <strong>
            All three move when you change the horizon
          </strong>{' '}
          — a shorter window finds a nearer high, so the curve is shallower and
          the average and the deepest shrink with it.
        </>
      }
    >
      <Plot box="aspect-[16/10] sm:aspect-[16/6]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            'A drawdown chart over three years on the one-year horizon. Zero per cent is ' +
            'the top line and the curve hangs below it, never above. It reaches about ' +
            `${Math.abs(Math.round(DD2_MIN))} per cent at its worst and today sits ` +
            `${Math.abs(Math.round(MEDIUM_TODAY))} per cent below its high. Two flat dashed ` +
            `rules mark the stock's average fall of about ` +
            `${Math.abs(Math.round(MEDIUM_STATS.typical ?? 0))} per cent and its deepest ever of ` +
            `about ${Math.abs(Math.round(MEDIUM_STATS.lowest ?? 0))} per cent.`
          }
        >
          <AxisFrame floorY={DD2_FLOOR + 10} />

          {/* Zero: the line a drawdown is measured from, and can never cross. */}
          <line
            x1={PLOT_L}
            y1={dd2Y(0)}
            x2="100"
            y2={dd2Y(0)}
            stroke="var(--text-secondary)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          <polygon points={ddArea(MEDIUM_DD, dd2Y)} fill={DD_FILL} stroke="none" />

          {MEDIUM_STATS.typical !== null && (
            <line
              x1={PLOT_L}
              y1={dd2Y(MEDIUM_STATS.typical)}
              x2="100"
              y2={dd2Y(MEDIUM_STATS.typical)}
              stroke={AVG_LINE}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {MEDIUM_STATS.lowest !== null && (
            <line
              x1={PLOT_L}
              y1={dd2Y(MEDIUM_STATS.lowest)}
              x2="100"
              y2={dd2Y(MEDIUM_STATS.lowest)}
              stroke={LOW_LINE}
              strokeWidth="1.5"
              strokeDasharray="9 5"
              vectorEffect="non-scaling-stroke"
            />
          )}

          <polyline
            points={MEDIUM_DD.map((p) => `${rx(p.x).toFixed(2)},${dd2Y(p.pct).toFixed(2)}`).join(' ')}
            fill="none"
            stroke={DD_LINE}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <AxisLabels ticks={DD2_TICKS} format={(v) => `${v}%`} />

        {/* Today, read OFF the curve rather than derived a second time. */}
        <span
          data-fall-marker
          className="hidden sm:block absolute -translate-x-1/2 translate-y-[11px] font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[var(--brand-mid)]"
          style={{ left: `${rx(100)}%`, top: `${todayY}%` }}
        >
          {Math.round(MEDIUM_TODAY)}%
        </span>
        <TodayDot y={todayY} color={DD_LINE} />
      </Plot>
      <TimeNote>Time → (three years)</TimeNote>
    </Figure>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIGURE 3 — the real one
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **Every number here is READ, never written** (CLAUDE.md 11k). These are real
 * figures about a real company, and a hard-coded "11.3%" would stay fluent,
 * specific and wrong from the next nightly run, with nothing going red. The bar
 * widths derive from the same values as the labels, so a bar cannot disagree
 * with the number printed beside it.
 */
const RECORD_ROWS = [
  {
    id: 'today',
    label: 'Where it is today',
    pct: LEARN_FIGURES.currentDrawdownPct,
    color: 'var(--brand-bright)',
  },
  {
    id: 'average',
    label: 'Its average fall',
    pct: LEARN_FIGURES.typicalDrawdownPct,
    color: AVG_LINE,
  },
  {
    id: 'deepest',
    label: 'Its deepest ever',
    pct: LEARN_FIGURES.deepestDrawdownPct,
    color: LOW_LINE,
  },
] as const;

const WIDEST = Math.max(...RECORD_ROWS.map((r) => Math.abs(r.pct)));

export function OwnRecordFigure() {
  return (
    <Figure
      caption={
        <>
          {LEARN_FIGURES.name}, to{' '}
          {new Date(`${LEARN_FIGURES.asOf}T00:00:00Z`).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
          , on the one-year window — the real version of the two rules in the
          chart above. Each bar is a fall, drawn to one shared scale, so the gap
          between today and this company&rsquo;s own worst is the honest shape of
          the risk. These figures update nightly.
        </>
      }
    >
      {/* A grid, not three hand-positioned rows: the label column and the value
          column size themselves to their content and the track takes the rest,
          so a longer label or a three-digit percentage cannot push anything out
          of the panel at 375px. */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-[10px]">
        {RECORD_ROWS.map((r) => (
          <div key={r.id} className="contents">
            <span className="text-[12px] font-medium text-[var(--text-secondary)]">{r.label}</span>
            <span className="relative block h-[10px] rounded-full bg-[var(--bg-surface)] ring-1 ring-inset ring-[var(--border)]">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(Math.abs(r.pct) / WIDEST) * 100}%`, backgroundColor: r.color }}
              />
            </span>
            {/* `data-record-row` exists for the guard, in the same spirit as
                `data-article-body` on ArticleDoc: without a name for this cell a
                test can only search the whole page for "11.3%", which would pass
                on the prose above even if the figure printed nothing at all. */}
            <span
              data-record-row={r.id}
              className="font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[var(--text-primary)]"
            >
              {depth(r.pct)}
            </span>
          </div>
        ))}
      </div>
    </Figure>
  );
}
