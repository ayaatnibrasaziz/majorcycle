/**
 * Geometry for "What a P/E ratio does and doesn't tell you".
 *
 * The figure has one job: show the ratio sitting calmly in bargain territory for
 * five years while the business underneath it falls apart. So the three series
 * must be genuinely consistent with each other — **price is COMPUTED as earnings
 * × ratio**, never a third hand-drawn line (CLAUDE.md 11c-iii). Draw them
 * independently and the picture can quietly assert arithmetic that does not hold,
 * while looking entirely plausible.
 *
 * Everything the article states about this company — how far earnings fell, how
 * far the price fell, how long the ratio stayed cheap — is derived below and
 * rendered from these constants, never typed into the prose (11k).
 */

/** Five years, one point per quarter. */
export const QUARTERS = 20;

/** Earnings per share at the start and end. A business in real decline. */
const EPS_START = 5.0;
const EPS_END = 2.2;

/**
 * The band a reader would call "cheap" for an ordinary company.
 *
 * ⚠️ A band, not a line, and deliberately generous at both ends: the article's
 * whole argument is that no single number is "good", so the figure must not
 * quietly install one. It is drawn as shading behind the ratio, labelled as what
 * it is — what this *looks* like, not what it *is*.
 */
export const CHEAP_LOW = 8;
export const CHEAP_HIGH = 14;

export interface PePoint {
  readonly x: number;
  readonly quarter: number;
  readonly eps: number;
  readonly pe: number;
  readonly price: number;
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Earnings decline steadily; the ratio re-rates downward early and then hovers.
 *
 * That shape is the point. The market marks the company down once, to a level
 * that looks like a bargain, and then the ratio stops moving — because the price
 * keeps falling at roughly the same rate as the earnings do. The reader watching
 * the ratio sees nothing happen for five years.
 */
function build(): readonly PePoint[] {
  const rnd = lcg(20260821);
  const out: PePoint[] = [];
  for (let i = 0; i < QUARTERS; i += 1) {
    const t = i / (QUARTERS - 1);
    const eps = EPS_START + (EPS_END - EPS_START) * t + (rnd() - 0.5) * 0.09;
    // 20× at the start, settling into the "cheap" band by the fourth quarter and
    // drifting gently inside it thereafter.
    const settled = 12.4 - 1.1 * t + Math.sin(t * 7.1) * 0.85;
    const pe = t < 0.16 ? 20 - (20 - 12.6) * (t / 0.16) : settled + (rnd() - 0.5) * 0.5;
    out.push({ x: t * 100, quarter: i, eps, pe, price: eps * pe });
  }
  return out;
}

export const SERIES: readonly PePoint[] = build();

const first = SERIES[0]!;
const last = SERIES[SERIES.length - 1]!;

/** How far earnings fell across the five years, in percent (negative). */
export const EPS_FALL_PCT = (last.eps / first.eps - 1) * 100;

/** How far the share price fell — a consequence of the two series, not a choice. */
export const PRICE_FALL_PCT = (last.price / first.price - 1) * 100;

/** The starting and closing ratio, for the caption. */
export const PE_START = first.pe;
export const PE_END = last.pe;

/** Quarters whose ratio sits inside the "looks cheap" band. */
export const CHEAP_QUARTERS = SERIES.filter(
  (p) => p.pe >= CHEAP_LOW && p.pe <= CHEAP_HIGH,
).length;

export const CHEAP_SHARE_PCT = (CHEAP_QUARTERS / QUARTERS) * 100;

// ── Plot bounds ──────────────────────────────────────────────────────────────

export const PE_TOP = 22;
export const PE_BOTTOM = 6;
export const EPS_TOP = 5.6;
export const EPS_BOTTOM = 1.6;
export const PLOT_FLOOR_Y = 84;

const scale = (v: number, top: number, bottom: number): number =>
  4 + ((top - v) / (top - bottom)) * (PLOT_FLOOR_Y - 4);

export const peY = (pe: number): number => scale(pe, PE_TOP, PE_BOTTOM);
export const epsY = (eps: number): number => scale(eps, EPS_TOP, EPS_BOTTOM);

export const PE_TICKS = [20, 14, 8].map((value) => ({ value, y: peY(value) }));
export const EPS_TICKS = [5, 3.5, 2].map((value) => ({ value, y: epsY(value) }));
