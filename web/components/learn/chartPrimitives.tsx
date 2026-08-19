/**
 * The drawing pieces every Learn schematic shares.
 *
 * Extracted 2026-08-19 when the second article needed the same axis frame, the
 * same palette and the same "today" dot. Copying them would have been the
 * cheapest thing to type and the exact defect CLAUDE.md 11c names: two sets of
 * chart furniture drifting apart, so the pictures teaching a reader what our
 * product looks like slowly stop agreeing with each other — and every version
 * still renders perfectly.
 */

/** The plot area, in viewBox units. The gutters are where axis labels live. */
export const PLOT_L = 15;
export const PLOT_R = 96;
export const rx = (x: number): number => PLOT_L + (x / 100) * (PLOT_R - PLOT_L);

/** The product's own drawdown palette (`components/stocks/DrawdownOverlay.tsx`). */
export const DD_LINE = '#1E5CB3'; // --brand-mid
export const DD_FILL = 'rgba(178,34,34,.15)';
export const AVG_LINE = '#D4A017';
export const LOW_LINE = '#B22222';

/**
 * ⚠️ **`vectorEffect` sits on each LINE, never on a wrapping `<g>`.** It is not an
 * inherited SVG property, so a `<g>` carrying it does nothing for its children —
 * and under `preserveAspectRatio="none"` a 1-unit stroke is then scaled by the
 * axis it runs against. The vertical rule was stretched by the horizontal factor
 * (6.14× at this size) and rendered as a **~6px pale band** rather than a hairline,
 * while the horizontal one stayed thin. Two lines, one attribute, two completely
 * different weights — and it looked like a deliberate design element, which is why
 * only a zoomed crop caught it.
 */
export function AxisFrame({ floorY }: { floorY: number }) {
  return (
    <>
      <line
        x1={PLOT_L}
        y1="4"
        x2={PLOT_L}
        y2={floorY}
        stroke="var(--border)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={PLOT_L}
        y1={floorY}
        x2="100"
        y2={floorY}
        stroke="var(--border)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

/** Axis numbers live in HTML so they stay 12px at every width. */
export function AxisLabels({
  ticks,
  format,
}: {
  ticks: readonly { y: number; value: number }[];
  format: (v: number) => string;
}) {
  return (
    <>
      {ticks.map((t) => (
        <span
          key={`${t.y}-${t.value}`}
          className="absolute left-0 -translate-y-1/2 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]"
          style={{ top: `${t.y}%` }}
        >
          {format(t.value)}
        </span>
      ))}
    </>
  );
}

export function TimeNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-right text-[12px] text-[var(--text-secondary)]">{children}</p>;
}

/**
 * The "today" dot — HTML, so it stays circular under a distorting viewBox.
 *
 * ⚠️ `id` is not decoration: it makes the dot MEASURABLE. A guard that reads the
 * printed label instead is measuring something that is `display:none` on a
 * phone, which reports a zero-sized rect at the document origin — a confident
 * number about an element nobody can see.
 */
export function TodayDot({
  y,
  color = 'var(--brand-bright)',
  id,
}: {
  y: number;
  color?: string;
  id?: string;
}) {
  return (
    <span
      data-today-dot={id}
      className="absolute block h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-[var(--bg-surface)]"
      style={{ left: `${rx(100)}%`, top: `${y}%`, borderColor: color }}
      aria-hidden="true"
    />
  );
}

export function Swatch({ color, dashed = true }: { color: string; dashed?: boolean }) {
  return (
    <span
      className={`block h-0 w-6 border-t-[2px] ${dashed ? 'border-dashed' : ''}`}
      style={{ borderTopColor: color }}
    />
  );
}

/** Zero: the line a drawdown is measured from, and can never cross. */
export function ZeroLine({ y }: { y: number }) {
  return (
    <line
      x1={PLOT_L}
      y1={y}
      x2="100"
      y2={y}
      stroke="var(--text-secondary)"
      strokeWidth="1"
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** A flat dashed rule — the shape the product uses for Avg and Low. */
export function LevelRule({
  y,
  color,
  dash = '5 4',
}: {
  y: number;
  color: string;
  dash?: string;
}) {
  return (
    <line
      x1={PLOT_L}
      y1={y}
      x2="100"
      y2={y}
      stroke={color}
      strokeWidth="1.5"
      strokeDasharray={dash}
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** The filled area under a drawdown curve, closed along its zero line. */
export function ddArea(
  series: readonly { readonly x: number; readonly pct: number }[],
  toY: (pct: number) => number,
): string {
  const top = toY(0);
  const line = series.map((p) => `${rx(p.x).toFixed(2)},${toY(p.pct).toFixed(2)}`).join(' ');
  return `${rx(0).toFixed(2)},${top.toFixed(2)} ${line} ${rx(100).toFixed(2)},${top.toFixed(2)}`;
}

/** The drawdown curve itself. */
export function DdCurve({
  series,
  toY,
}: {
  series: readonly { readonly x: number; readonly pct: number }[];
  toY: (pct: number) => number;
}) {
  return (
    <polyline
      points={series.map((p) => `${rx(p.x).toFixed(2)},${toY(p.pct).toFixed(2)}`).join(' ')}
      fill="none"
      stroke={DD_LINE}
      strokeWidth="2.2"
      strokeLinejoin="round"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}
