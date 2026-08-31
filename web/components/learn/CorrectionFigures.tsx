import { Figure, LegendItem } from '@/components/Figure';
import {
  AVG_LINE,
  AxisFrame,
  AxisLabels,
  DD_FILL,
  DD_LINE,
  DdCurve,
  LOW_LINE,
  LevelRule,
  Plot,
  Swatch,
  TimeNote,
  TodayDot,
  ZeroLine,
  ddArea,
  rx,
} from './chartPrimitives';
import { MARKET_DD, MARKET_LEVELS, QUIET, ROUTINE, type Company } from './correctionGeometry';

/**
 * "Dip, correction, crash" — its two figures.
 *
 * ⚠️ **Drawn in the PRODUCT's idiom** (CLAUDE.md 11m), through the same shared
 * primitives as the drawdown article: the fall hangs BELOW a zero line, the
 * curve is `--brand-mid`, the average is a gold dashed rule and the deepest a
 * firebrick one. A reader who signs up should recognise these.
 *
 * ⚠️ **Both schematics** (CLAUDE.md #24) — no dates, no gridlines, and both
 * captions say in words that the companies are imaginary.
 */

const pct = (v: number): string => `${Math.round(v)}%`;
const mag = (v: number): string => `${Math.abs(Math.round(v))}%`;

// ─────────────────────────────────────────────────────────────────────────────
// FIGURE 1 — where the three words land, on the market
// ─────────────────────────────────────────────────────────────────────────────

const MKT_TOP = 10;
const MKT_FLOOR = 80;
const MKT_MIN = -28;
const mktY = (v: number): number => MKT_TOP + (Math.abs(v) / Math.abs(MKT_MIN)) * (MKT_FLOOR - MKT_TOP);

/** The ticks ARE the thresholds — the axis does the explaining. */
const MKT_TICKS = [0, ...MARKET_LEVELS.map((l) => l.pct)].map((v) => ({ y: mktY(v), value: v }));

export function MarketWordsFigure() {
  return (
    <Figure
      legend={
        <>
          <LegendItem swatch={<Swatch color={DD_LINE} dashed={false} />}>
            How far the whole market is below its high
          </LegendItem>
          <LegendItem swatch={<Swatch color="var(--text-secondary)" />}>
            The two conventional lines, at 10% and 20%
          </LegendItem>
        </>
      }
      caption={
        <>
          <strong>An index, not a company</strong> — a schematic of a whole market
          sliding through all three zones. Above the first line the falls are
          called dips; between the lines, a correction; below the second, a crash
          or a bear market, depending on how fast it happened. The two lines are{' '}
          <strong>convention rather than measurement</strong>: nobody set them,
          they are simply round numbers that stuck. That is workable for an index
          of hundreds of companies averaged together, and it is the reason the
          same lines say so little about any one of them.
        </>
      }
    >
      {/* ⚠️ Taller on a phone. The two zone labels sit just above the rules they
          name, and at 16/10 the plot is 214px — short enough that the curve's
          first dip runs through the word "Correction". The label cannot shrink
          (12px is the reading floor) and cannot move sideways (it names a
          horizontal rule), so the plot has to give. Same fix as the index
          figure. */}
      <Plot box="aspect-[16/13] sm:aspect-[16/6]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            'A drawdown chart for a whole market. Zero per cent is the top line and the ' +
            'curve hangs below it, falling further over time until it reaches about 24 ' +
            'per cent below its high. Two flat dashed lines cross the chart at 10 per ' +
            'cent and 20 per cent, marking where a dip becomes a correction and a ' +
            'correction becomes a crash or bear market.'
          }
        >
          <AxisFrame floorY={MKT_FLOOR + 10} />
          <ZeroLine y={mktY(0)} />
          <polygon points={ddArea(MARKET_DD, mktY)} fill={DD_FILL} stroke="none" />
          {MARKET_LEVELS.map((l) => (
            <LevelRule key={l.pct} y={mktY(l.pct)} color="var(--text-secondary)" dash="4 4" />
          ))}
          <DdCurve series={MARKET_DD} toY={mktY} />
        </svg>

        <AxisLabels ticks={MKT_TICKS} format={(v) => `${v}%`} />

        {/* ⚠️ The three words the article is ABOUT, on the lines that separate
            them. Until 2026-08-20 the figure drew two unlabelled dashed rules and
            left the reader to map them onto the caption — on the one page whose
            entire subject is which word goes where. The names come from
            `MARKET_LEVELS`, so the picture cannot disagree with the prose that
            reads the same list.

            ⚠️ **Below its rule, inside the band it names** — which is both the
            correct reading (a correction is the zone BETWEEN the two lines, not
            the line itself) and the only placement with room. Above the rule the
            words sat in the dip zone, where the curve still is over the first
            third of the plot; at 375px the panel is short enough that the curve
            ran through "Correction". Painting the panel's ground behind the text
            hid a length of the dashed rule instead, which is worse: the figure is
            about those two lines. */}
        {MARKET_LEVELS.map((l) => (
          <span
            key={l.pct}
            data-zone-label={l.label}
            className="absolute whitespace-nowrap text-[12px] font-semibold text-[var(--text-primary)]"
            style={{ left: `${rx(3)}%`, top: `${mktY(l.pct)}%`, transform: 'translate(0, 7px)' }}
          >
            {l.label}
          </span>
        ))}
      </Plot>
      <TimeNote>Time →</TimeNote>
    </Figure>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIGURE 2 — the same number, two records
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **ONE vertical scale across BOTH panels, and it is the whole figure.**
 * Given its own axis each panel would fill its own box, today's marker would sit
 * at a different height in each, and the reader would see two unrelated charts —
 * destroying the only thing the figure exists to show, that these are the *same
 * depth*. Sharing the scale is what puts the two dots on one line and lets each
 * company's own rules fall where they may.
 */
const PANEL_TOP = 12;
const PANEL_FLOOR = 84;
const PANEL_MIN = Math.min(
  ...[ROUTINE, QUIET].flatMap((c) => [
    ...c.dd.map((p) => p.pct),
    c.stats.lowest ?? 0,
  ]),
);
const panelY = (v: number): number =>
  PANEL_TOP + (Math.abs(v) / Math.abs(PANEL_MIN)) * (PANEL_FLOOR - PANEL_TOP);

const PANEL_TICKS = [0, PANEL_MIN / 2, PANEL_MIN].map((v) => ({
  y: panelY(v),
  value: Math.round(v),
}));

function RecordPanel({ company, title, id }: { company: Company; title: string; id: string }) {
  const todayY = panelY(company.today);
  return (
    <div data-record-panel={id}>
      <p className="mb-1.5 text-[13px] font-bold text-[var(--text-primary)]">{title}</p>
      <Plot box="aspect-[16/11]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            `${title}. A drawdown chart where zero per cent is the top line and the curve ` +
            `hangs below it. Today the price is ${mag(company.today)} below its high. ` +
            `A gold dashed rule marks this company's average fall of ${mag(company.stats.typical ?? 0)} ` +
            `and a red dashed rule its deepest fall before today, ${mag(company.stats.lowest ?? 0)}.`
          }
        >
          <AxisFrame floorY={PANEL_FLOOR + 8} />
          <ZeroLine y={panelY(0)} />
          <polygon points={ddArea(company.dd, panelY)} fill={DD_FILL} stroke="none" />
          {company.stats.typical !== null && (
            <LevelRule y={panelY(company.stats.typical)} color={AVG_LINE} />
          )}
          {company.stats.lowest !== null && (
            <LevelRule y={panelY(company.stats.lowest)} color={LOW_LINE} dash="9 5" />
          )}
          <DdCurve series={company.dd} toY={panelY} />
        </svg>

        <AxisLabels ticks={PANEL_TICKS} format={(v) => `${v}%`} />

        {/*
          Today, read OFF the curve rather than derived a second time.

          ⚠️ **Shown on phones too, unlike the drawdown article's markers.** Those
          are `hidden sm:block` because the number is a detail there. Here the
          number IS the argument — two panels at the identical depth — and hiding
          it left a phone reader with two dots and no way to see they match. It
          moves to the LEFT of the dot below `sm` instead of being centred on it,
          because centred it overhangs a 269px panel by ~6px.
        */}
        <span
          data-fall-marker
          data-panel-today={id}
          className="absolute -translate-x-full sm:-translate-x-1/2 translate-y-[11px] pr-1 sm:pr-0 font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[var(--brand-mid)]"
          style={{ left: `${rx(100)}%`, top: `${todayY}%` }}
        >
          {pct(company.today)}
        </span>
        <TodayDot y={todayY} color={DD_LINE} id={id} />
      </Plot>
    </div>
  );
}

export function TwoRecordsFigure() {
  return (
    <Figure
      legend={
        <>
          <LegendItem swatch={<Swatch color={DD_LINE} dashed={false} />}>
            How far below its high, day by day
          </LegendItem>
          <LegendItem swatch={<Swatch color={AVG_LINE} />}>Its average fall</LegendItem>
          <LegendItem swatch={<Swatch color={LOW_LINE} />}>Its deepest before today</LegendItem>
        </>
      }
      caption={
        <>
          Two imaginary companies, both {mag(ROUTINE.today)} below their high today
          — the marker sits at the same depth in each, on one shared scale. For the
          company on the left that is a{' '}
          <strong>shallower fall than it usually has</strong>: its average is{' '}
          {mag(ROUTINE.stats.typical ?? 0)} and it has been as deep as{' '}
          {mag(ROUTINE.stats.lowest ?? 0)}. For the one on the right it is{' '}
          <strong>deeper than anything in its record</strong>: it normally falls{' '}
          {mag(QUIET.stats.typical ?? 0)}, and its worst before today was{' '}
          {mag(QUIET.stats.lowest ?? 0)}. Same number, opposite meanings — and
          &ldquo;correction&rdquo; is the word for both.
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
        <RecordPanel company={ROUTINE} id="routine" title="A company that often falls a long way" />
        <RecordPanel company={QUIET} id="quiet" title="A company that rarely falls far" />
      </div>
      <TimeNote>Time → (three years each)</TimeNote>
    </Figure>
  );
}
