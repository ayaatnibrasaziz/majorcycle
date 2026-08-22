import { Figure, LegendItem } from '@/components/Figure';
import {
  AxisFrame,
  AxisLabels,
  PLOT_L,
  Plot,
  Swatch,
  TimeNote,
  rx,
} from './chartPrimitives';
import {
  CHEAP_HIGH,
  CHEAP_LOW,
  CHEAP_SHARE_PCT,
  EPS_FALL_PCT,
  EPS_TICKS,
  PE_END,
  PE_START,
  PE_TICKS,
  PLOT_FLOOR_Y,
  PRICE_FALL_PCT,
  SERIES,
  epsY,
  peY,
} from './peGeometry';

/**
 * The one figure for "What a P/E ratio does and doesn't tell you".
 *
 * Two panels sharing one timeline. The **ratio** on top, because that is the
 * number the reader is watching; the **earnings** below, because that is what is
 * actually happening. The ratio spends the whole period looking like a bargain
 * while the earnings halve — which is the article's argument, drawn.
 *
 * ⚠️ **The shaded band is labelled as an appearance, never as a rule.** The
 * article's central claim is that no single P/E is "good", so a figure that
 * quietly drew a good-value zone would contradict its own page. The legend and
 * caption both call it "what a reader would call cheap".
 *
 * ⚠️ Every number in the caption is derived in `peGeometry.ts` from the series
 * being drawn — including the price fall, which is earnings × ratio and so
 * cannot disagree with the two lines above it.
 */

const PE_LINE = '#1E5CB3'; // --brand-mid
const EPS_LINE = '#0E7C8B'; // the teal the Learn illustrations use for a price line
const BAND = 'rgba(30, 92, 179, 0.10)';

function Panel({
  points,
  color,
  ticks,
  format,
  band,
  label,
}: {
  points: string;
  color: string;
  ticks: readonly { y: number; value: number }[];
  format: (v: number) => string;
  band?: { top: number; bottom: number };
  label: string;
}) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{label}</p>
      <Plot box="aspect-[16/7]" className="mt-1.5">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {band && (
            <rect
              x={PLOT_L}
              y={band.top}
              width={100 - PLOT_L}
              height={band.bottom - band.top}
              fill={BAND}
            />
          )}
          <AxisFrame floorY={PLOT_FLOOR_Y} />
          <polyline
            points={points}
            data-pe-path={label}
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <AxisLabels ticks={ticks} format={format} />
      </Plot>
    </div>
  );
}

export function PeFigure() {
  const pepoints = SERIES.map((p) => `${rx(p.x).toFixed(2)},${peY(p.pe).toFixed(2)}`).join(' ');
  const epoints = SERIES.map((p) => `${rx(p.x).toFixed(2)},${epsY(p.eps).toFixed(2)}`).join(' ');

  return (
    <Figure
      legend={
        <>
          <LegendItem swatch={<Swatch color={PE_LINE} dashed={false} />}>
            The P/E ratio
          </LegendItem>
          <LegendItem swatch={<Swatch color={EPS_LINE} dashed={false} />}>
            Earnings per share
          </LegendItem>
          <LegendItem
            swatch={
              <span
                className="block h-3 w-6 rounded-[2px]"
                style={{ backgroundColor: 'rgba(30, 92, 179, 0.18)' }}
              />
            }
          >
            The range a reader would call cheap — an impression, not a rule
          </LegendItem>
        </>
      }
      caption={
        <>
          One imaginary company over five years. The market marks it down once,
          early, and the ratio then settles at around {PE_END.toFixed(0)}× — inside
          bargain territory for{' '}
          <strong>{CHEAP_SHARE_PCT.toFixed(0)}% of the period</strong>, having started
          at {PE_START.toFixed(0)}×. Underneath, earnings per share fall{' '}
          {Math.abs(EPS_FALL_PCT).toFixed(0)}% and the share price falls{' '}
          {Math.abs(PRICE_FALL_PCT).toFixed(0)}%.{' '}
          <strong>The ratio never leaves the cheap range, because price and earnings
          are falling together.</strong>{' '}
          Watching it alone, nothing appears to happen for five years.
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Panel
          label="What you watch: the P/E ratio"
          points={pepoints}
          color={PE_LINE}
          ticks={PE_TICKS}
          format={(v) => `${v}×`}
          band={{ top: peY(CHEAP_HIGH), bottom: peY(CHEAP_LOW) }}
        />
        <Panel
          label="What is happening: earnings per share"
          points={epoints}
          color={EPS_LINE}
          ticks={EPS_TICKS}
          format={(v) => `$${v}`}
        />
      </div>
      <TimeNote>Five years →</TimeNote>
    </Figure>
  );
}
