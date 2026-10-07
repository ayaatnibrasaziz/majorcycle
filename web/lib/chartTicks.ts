import type { IChartApi, Time, TickMarkFormatter } from 'lightweight-charts';

/**
 * A Lightweight-Charts time stamp as seconds since 1970, whichever of its three shapes
 * it arrives in ('2026-10-05', a business-day object, or a UTC timestamp).
 */
export function timeToSeconds(t: Time): number | null {
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    const ms = Date.parse(`${t}T00:00:00Z`);
    return Number.isNaN(ms) ? null : ms / 1000;
  }
  if (t && typeof t === 'object' && 'year' in t) return Date.UTC(t.year, t.month - 1, t.day) / 1000;
  return null;
}

/** How close to the right edge, as a share of the visible span, a date label is dropped. */
export const EDGE_LABEL_SHARE = 0.025;

/**
 * Date labels on the time axis, except one sitting right at the chart's right edge.
 *
 * With `fixRightEdge` the newest bar touches the price scale, so a date label centred on
 * it is cut in half by that scale: the 1-year price chart ended its axis with a lone "5"
 * (visual audit, 2026-10-07). Lightweight Charts has no option to keep a label inside the
 * plot, so a label within the last {@link EDGE_LABEL_SHARE} of the visible range is left
 * blank and every other label keeps the library's own formatting (`null`).
 */
export function edgeSafeTickFormatter(chart: () => IChartApi | null): TickMarkFormatter {
  return (time) => {
    const range = chart()?.timeScale().getVisibleRange();
    if (!range) return null;
    const t = timeToSeconds(time);
    const from = timeToSeconds(range.from);
    const to = timeToSeconds(range.to);
    if (t == null || from == null || to == null || to <= from) return null;
    return to - t < (to - from) * EDGE_LABEL_SHARE ? '' : null;
  };
}
