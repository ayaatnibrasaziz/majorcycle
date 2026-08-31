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

/**
 * The gutter the y-axis labels live in, in PIXELS.
 *
 * ⚠️ **Pixels, because the labels are pixels.** It was 15 viewBox units — 15% of
 * whatever the panel happened to measure — which is the right amount of room at
 * 375px and a wasteland at 1280px: **172px of empty margin** to hold a 29px
 * number, so every chart on the site began a sixth of the way in from its own
 * card. A gutter exists to fit a label, and a label does not get wider when the
 * screen does. Sized from the widest one actually rendered anywhere in the
 * library (29px) plus the 8px gap, plus room for the wider glyphs Linux gives
 * the same font — which is not a theoretical worry: a 2px difference between
 * Windows and CI is what turned this guard red.
 */
export const AXIS_GUTTER_PX = 44;

/**
 * The plot area, in viewBox units — now the whole box, because the gutter is
 * outside it (see `Plot`). `PLOT_L` is 1 rather than 0 only so the axis rule is
 * not half-clipped by the viewBox edge.
 */
export const PLOT_L = 1;
export const PLOT_R = 100;
export const rx = (x: number): number => PLOT_L + (x / 100) * (PLOT_R - PLOT_L);

/**
 * Room on the RIGHT for half of a label centred on the last point.
 *
 * ⚠️ **This was 4 viewBox units of the plot's own width, and that is the same
 * mistake as the left gutter.** A "today" label centred at the final point needs
 * half its width — about 15px — and 4% is 23px on a full-width panel and **10px**
 * on one of the two half-width panels in the dip/correction figure, where the
 * label duly hung 5px outside the drawing. Half a label is a number of pixels; it
 * does not shrink when the panel does.
 */
export const PLOT_RIGHT_PAD_PX = 22;

/**
 * A plot and its axis gutter.
 *
 * Two boxes on purpose. The outer one carries the gutter as padding; the inner
 * one is the drawing, and every absolutely-positioned thing inside — the SVG,
 * the dots, the labels — measures against it. That is what lets `rx()` treat the
 * plot as the full 0–100 while the labels sit outside it in a fixed-width strip.
 *
 * ⚠️ One box will not do: an absolutely-positioned child is laid out against
 * its ancestor's PADDING box, so `inset-0` would span the gutter too and the
 * drawing would start at the card edge again.
 */
export function Plot({
  box,
  className = '',
  children,
}: {
  /**
   * Tailwind sizing for the drawing itself — usually an aspect ratio
   * (`aspect-[16/9]`), but a plain height for a bare axis row.
   */
  box: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative w-full ${className}`}
      style={{ paddingLeft: AXIS_GUTTER_PX, paddingRight: PLOT_RIGHT_PAD_PX }}
    >
      <div className={`relative w-full ${box}`}>{children}</div>
    </div>
  );
}

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

/**
 * The gap between an axis label and the axis it belongs to, in pixels. One
 * constant, so every figure on the site sits the same distance off its own axis.
 */
export const AXIS_LABEL_GAP_PX = 8;

/**
 * Axis numbers live in HTML so they stay 12px at every width.
 *
 * ⚠️ **Anchored to the AXIS, not to the left edge of the panel.** These were
 * `left: 0` until 2026-08-21, which pins the label's *start* and lets its end
 * land wherever the text happens to run out — so the distance to the axis was a
 * side effect of how many characters the number had. Measured across the
 * library: a **57px** gap on nine figures against **12px** on two, i.e. the
 * labels looked both too far away and inconsistently far away, and the same
 * figure would have shifted again the day a tick went from `-40%` to `-100%`.
 * Right-anchoring makes the gap the thing that is specified and the label width
 * the thing that varies, which is the way round a reader actually perceives it.
 */
export function AxisLabels({
  ticks,
  format,
  stub = false,
}: {
  ticks: readonly { y: number; value: number }[];
  format: (v: number) => string;
  /** Draw a short rule from each label to the axis. */
  stub?: boolean;
}) {
  return (
    <>
      {ticks.map((t) => (
        <span key={`${t.y}-${t.value}`}>
          <span
            data-axis-label=""
            className="absolute -translate-y-1/2 whitespace-nowrap font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]"
            style={{
              top: `${t.y}%`,
              right: '100%',
              // ⚠️ MARGIN, never padding. Padding keeps the gap inside the box, so
              // the element's own rect still ends flush against the axis — and every
              // instrument that asks the DOM where a label is (this repo's overlap
              // guards included) then reads a label touching the plot. It cost a
              // round of chasing a collision that was 8px of empty padding.
              marginRight: `${AXIS_LABEL_GAP_PX}px`,
            }}
          >
            {format(t.value)}
          </span>
          {stub && (
            /* The tick mark. HTML rather than a `<line>` at `PLOT_L - 2`, which
               is off the viewBox now the plot starts at its own left edge — and
               would have been silently clipped rather than drawn short. */
            <span
              aria-hidden="true"
              className="absolute h-px w-[5px] bg-[var(--border)]"
              style={{ top: `${t.y}%`, right: '100%' }}
            />
          )}
        </span>
      ))}
    </>
  );
}

/**
 * The row of markers under a time axis.
 *
 * ⚠️ **`top` is the floor line, not the bottom of the panel.** Two figures
 * hung this off `top-full` — the bottom of a 16:9 box whose axis line sits at 86–
 * 88% of it — which left the year markers floating **38–40px** below the axis
 * they label, measured. The offset has to come from where the line actually is,
 * so it is passed in from the same constant that draws the line.
 */
export function XTickRow({
  id,
  floorY,
  ticks,
}: {
  id: string;
  floorY: number;
  ticks: readonly { key: string | number; x: number; label: string; strong?: boolean }[];
}) {
  return (
    <div className="absolute inset-x-0" style={{ top: `${floorY}%` }}>
      {ticks.map((t) => (
        <span
          key={t.key}
          data-year-tick={id}
          className={`absolute -translate-x-1/2 whitespace-nowrap text-[12px] ${
            t.strong
              ? 'font-semibold text-[var(--text-primary)]'
              : 'font-[family-name:var(--font-mono)] text-[var(--text-secondary)]'
          }`}
          style={{ left: `${rx(t.x)}%`, marginTop: `${AXIS_LABEL_GAP_PX}px` }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

/**
 * A year marker's words. One spelling, used by every timed axis.
 *
 * ⚠️ **Never `3y`.** A digit butted against a letter is exactly the shape of a
 * swallowed JSX space around an interpolated number, and the run-on guard in
 * `learn.spec.ts` cannot tell a real one from an axis label — so a tick spelled
 * that way would force the guard to be loosened.
 *
 * ⚠️ And it is singular at one. Three figures grew a year axis within a week and
 * the second one printed "1 yrs"; the fix belongs here rather than in each
 * caller, or the fourth figure will print it again (CLAUDE.md 11c).
 */
export function yearTick(n: number, zero = 'start'): string {
  if (n === 0) return zero;
  return `${n} ${Math.abs(n) === 1 ? 'yr' : 'yrs'}`;
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

/**
 * A dot at an arbitrary point on the plot, not pinned to "today".
 *
 * Same HTML-not-SVG reasoning as `TodayDot`: under `preserveAspectRatio="none"`
 * an SVG circle is drawn as an ellipse, stretched by whatever the horizontal
 * scale factor happens to be at that width.
 */
export function PointDot({
  x,
  y,
  color,
  id,
}: {
  x: number;
  y: number;
  color: string;
  id?: string;
}) {
  return (
    <span
      data-point-dot={id}
      className="absolute block h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-[var(--bg-surface)]"
      style={{ left: `${rx(x)}%`, top: `${y}%`, borderColor: color }}
      aria-hidden="true"
    />
  );
}

/**
 * A short label pinned to a point on the plot.
 *
 * ⚠️ **The anchor is chosen from the position, never passed in.** A centred label
 * near the right-hand edge hangs off the panel, and a per-call-site `align` prop
 * is a decision that goes stale the moment the point it describes moves. Written
 * once here because two figures grew their own copy within a day (CLAUDE.md 11c).
 *
 * `dy` is the vertical offset in pixels — positive puts the label below the point.
 *
 * ⚠️ **A label never has anything behind it, and that is a constraint on the
 * DRAWING rather than on the label.** A halo — the panel's ground painted behind
 * the text — was tried and rejected by the owner on sight: it interrupts the very
 * curve the figure is about, so a chart with a label over a line looks broken
 * rather than crowded. The fix belongs upstream: shape the paths so the troughs
 * are separated, and put the words in space that is genuinely empty. If a label
 * has nowhere to go, the figure is too busy — that is information, not a styling
 * problem.
 */
export function PinnedLabel({
  x,
  y,
  text,
  short,
  dy = 6,
  strong = false,
  id,
}: {
  x: number;
  y: number;
  text: string;
  /**
   * A narrow-screen form, shown below `sm`.
   *
   * ⚠️ Not a nicety. "Company A −20%" is 106px however wide the screen is, and at
   * 375px the plot is 299px — so a third of the drawing is under one label and it
   * crosses whatever is there. Below `sm` the same label is 45px and clears
   * everything, measured. The caption names the companies in full directly
   * underneath, so the letter is never the only place the name appears.
   */
  short?: string;
  dy?: number;
  strong?: boolean;
  id: string;
}) {
  const anchorRight = x > 70;
  return (
    <span
      data-pinned-label={id}
      className={`absolute whitespace-nowrap font-[family-name:var(--font-mono)] text-[12px] ${
        strong ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
      }`}
      style={{
        left: `${rx(x)}%`,
        top: `${y}%`,
        transform: `translate(${anchorRight ? '-100%' : '-50%'}, ${dy}px)`,
      }}
    >
      {short ? (
        <>
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{text}</span>
        </>
      ) : (
        text
      )}
    </span>
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
