/**
 * Geometry for "Why your company's own history beats the market's average".
 *
 * The article's claim is arithmetic, not opinion: **an index falls less than the
 * companies inside it, because they do not all fall at the same time.** So the
 * figure has to be built the way that actually happens — three imaginary
 * companies with their own price paths, an index that is genuinely their
 * average, and every drawdown measured from its own running peak.
 *
 * ⚠️ **The index is COMPUTED from the members, never drawn.** Hand-shaping a
 * shallower fourth curve would make the figure's entire argument a promise
 * nobody checks: it would look identical, and it would be an illustration of a
 * claim rather than an instance of it. `learn.spec.ts` asserts the index price
 * equals the mean of the three member prices at every sample, which is only a
 * meaningful assertion because the code does the same thing the sentence does
 * (CLAUDE.md 11c-iii).
 *
 * ⚠️ **Every number the prose and the caption state is derived here** — the
 * deepest member fall, the index's own deepest, and the gap between them. Reshape
 * a path and the sentences restate themselves instead of quietly becoming false
 * (CLAUDE.md 11k).
 */

export interface Sample {
  readonly x: number;
  readonly price: number;
}

export interface DdPoint {
  readonly x: number;
  readonly pct: number;
}

/** How many points each curve is sampled at. */
const N = 121;

/**
 * A price path from keyframes, linearly interpolated.
 *
 * Straight segments on purpose: this is a schematic of *when* companies fall
 * relative to each other, and adding plausible-looking noise would invite a
 * reader to read something into wiggles that carry no information.
 */
function path(keys: readonly (readonly [number, number])[]): readonly Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < N; i += 1) {
    const x = (i / (N - 1)) * 100;
    let k = 0;
    while (k < keys.length - 2 && x > keys[k + 1]![0]) k += 1;
    const [x0, p0] = keys[k]!;
    const [x1, p1] = keys[k + 1]!;
    const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
    out.push({ x, price: p0 + (p1 - p0) * t });
  }
  return out;
}

/** Drawdown from the running peak, in percent — the engine's definition. */
export function drawdown(series: readonly Sample[]): readonly DdPoint[] {
  let peak = -Infinity;
  return series.map((s) => {
    peak = Math.max(peak, s.price);
    return { x: s.x, pct: (s.price / peak - 1) * 100 };
  });
}

/** The deepest point of a drawdown curve, as a negative percentage. */
export const deepest = (dd: readonly DdPoint[]): number =>
  dd.reduce((lo, p) => (p.pct < lo ? p.pct : lo), 0);

export interface Member {
  readonly name: string;
  readonly prices: readonly Sample[];
  readonly dd: readonly DdPoint[];
  /** Deepest fall, negative. */
  readonly worst: number;
}

/**
 * Three companies that all end up roughly where they started, and get there in
 * completely different ways. The falls are deliberately at different moments —
 * that separation IS the mechanism the article is explaining.
 */
const PATHS: readonly (readonly [string, readonly (readonly [number, number])[]])[] = [
  ['Company A', [[0, 100], [10, 103], [22, 82], [40, 105], [70, 109], [100, 112]]],
  ['Company B', [[0, 100], [30, 118], [58, 59], [78, 74], [100, 88]]],
  ['Company C', [[0, 100], [20, 104], [45, 108], [70, 112], [88, 78], [100, 84]]],
];

export const MEMBERS: readonly Member[] = PATHS.map(([name, keys]) => {
  const prices = path(keys);
  const dd = drawdown(prices);
  return { name, prices, dd, worst: deepest(dd) };
});

/** The index: an equal-weighted average of the three, priced the same way. */
export const INDEX_PRICES: readonly Sample[] = MEMBERS[0]!.prices.map((_, i) => ({
  x: MEMBERS[0]!.prices[i]!.x,
  price: MEMBERS.reduce((sum, m) => sum + m.prices[i]!.price, 0) / MEMBERS.length,
}));

export const INDEX_DD: readonly DdPoint[] = drawdown(INDEX_PRICES);

/** The two numbers the article's argument rests on. */
export const INDEX_WORST = deepest(INDEX_DD);
export const DEEPEST_MEMBER = MEMBERS.reduce((a, b) => (a.worst < b.worst ? a : b));

/** How many times deeper the worst member's fall was than the index's. */
export const DEPTH_RATIO = DEEPEST_MEMBER.worst / INDEX_WORST;

/** Plot bounds, with headroom below the deepest line. */
export const DD_FLOOR = Math.floor((deepest([...MEMBERS.flatMap((m) => m.dd)]) - 4) / 5) * 5;

/** Drawdown percent → vertical position, 0–100 down the plot. */
export const yOf = (pct: number): number => (pct / DD_FLOOR) * 88;

export const DD_TICKS = [0, -20, -40] as const;
