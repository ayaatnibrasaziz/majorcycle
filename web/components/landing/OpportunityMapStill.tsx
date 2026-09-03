import { OVERALL_LABELS, scoreColor } from '@/lib/ratings';
import { mag7Rows, type Mag7Snapshot } from '@/lib/mag7';

/**
 * The Opportunity Map, as a still.
 *
 * Financial Health across, Valuation up, bubble size = Overall Rating — the same
 * instrument as `components/results/OpportunityMap.tsx`, rebuilt for a public page
 * that has no run behind it. Every constant below is taken from that component
 * rather than eyeballed, so a bubble here is the same size and colour as the same
 * stock's bubble in the terminal.
 *
 * Positioned in HTML rather than SVG, so every label stays real text at a real
 * size and the whole thing reflows on a phone.
 *
 * ONE deliberate difference (owner decision): the terminal draws bare bubbles and
 * names them on hover. A landing page cannot rely on hover — there isn't one on a
 * phone — so each bubble carries its ticker beside it.
 */

/** The Constructive threshold: the quadrant divider, from OpportunityMap.tsx. */
const SPLIT = 65;

/**
 * Axis padding, the same idea as Recharts' `padding` prop.
 *
 * A stock at Valuation 0.6 (Nvidia today) plots ON the frame, jammed into the
 * corner a quadrant caption occupies. Padding the SCALE moves the point away from
 * the furniture; the alternative — nudging the point — would be moving data to
 * accommodate a label, which on a page about honest numbers is not a trade we get
 * to make.
 */
const PAD = 11;
const SPAN = 100 - PAD * 2;
const plot = (v: number): number => PAD + (v / 100) * SPAN;

/**
 * Recharts sizes a scatter point by AREA: `ZAxis range={[18, 200]}` in px² across
 * a 0–100 domain. Diameter is therefore 2·√(area/π) — about 12–15px, not the 32px
 * discs that "make the bubbles bigger" would produce.
 */
const diameter = (overall: number): number =>
  2 * Math.sqrt((18 + (200 - 18) * (overall / 100)) / Math.PI);

/**
 * Which side each ticker's label hangs off.
 *
 * Chosen per point rather than by a rule: six of the seven sit in the same
 * quadrant, so any single rule ("always right", "right if left of centre") puts at
 * least one label on top of a neighbour or through a quadrant caption.
 *
 * ⚠️ This is layout tuned to ONE set of coordinates, and it therefore expires when
 * the snapshot is regenerated. It already did: the artifact placed Amazon's label
 * above its bubble, which was clear when Amazon's Valuation was 0.8 and collided
 * with Apple's the moment it moved to 16.0. The collision is invisible in code
 * review and unremarkable in a screenshot — two short labels touching at the
 * corner — so `e2e/landing.spec.ts` walks every pair of labels and captions and
 * fails on any intersection. Re-run it after any `build_mag7_snapshot` run.
 *
 * ⚠️ **It expired a SECOND time on 2026-09-01, exactly as predicted**, which is
 * the argument for keeping the guard rather than trusting this note. Regenerating
 * the snapshot moved Nvidia's Valuation 0.6 → 14.1 and Apple's 29.6 → 18.2,
 * closing the gap between them from 29 points to 4; Nvidia's label hung left and
 * Apple's hung right, so the two pointed into the same shrinking corridor and
 * met. `NVDA` moved to the right — away from Apple, and it is the rightmost point
 * on the map, so nothing sits beyond it. The guard found it in 20 seconds; a
 * screenshot would not have, and neither did I when I predicted the collision but
 * guessed the wrong pair (I expected Apple ↔ Amazon).
 */
const SIDE: Record<string, 'l' | 'r' | 'u' | 'd'> = {
  GOOGL: 'r',
  META: 'l',
  MSFT: 'r',
  AAPL: 'r',
  NVDA: 'r',
  TSLA: 'r',
  AMZN: 'u',
};

/** Mid-point of each tier's band, purely to colour its legend swatch. */
const TIER_MIDS: Record<string, number> = {
  'High Conviction': 90,
  Constructive: 72,
  Neutral: 57,
  Cautious: 42,
  Bearish: 20,
};

const TICKS = [0, 25, 50, 65, 75, 100];

const QUADRANTS = [
  { cls: 'q-tr', label: 'Opportunity Zone', swatch: 'rgba(var(--zone-good-rgb), .18)', ink: 'var(--c-tier-1)' },
  {
    cls: 'q-br',
    label: 'Healthy, fully priced',
    swatch: 'rgba(var(--zone-priced-rgb), .20)',
    ink: 'var(--accent-warm-ink)',
  },
  { cls: 'q-tl', label: 'Weak but cheap', swatch: 'rgba(var(--zone-cheap-rgb), .14)', ink: 'var(--brand-mid)' },
  {
    cls: 'q-bl',
    label: 'Weak & expensive',
    swatch: 'rgba(var(--zone-worst-rgb), .16)',
    ink: 'var(--c-tier-5-ink)',
  },
] as const;

export function OpportunityMapStill({ snapshot }: { snapshot: Mag7Snapshot }) {
  const rows = mag7Rows(snapshot);
  const present = OVERALL_LABELS.filter((l) => rows.some((r) => r.overallLabel === l));

  return (
    <>
      <div className="map-legend">
        {present.map((label) => (
          <span key={label}>
            <i style={{ background: scoreColor(TIER_MIDS[label]!) }} />
            {label}
          </span>
        ))}
      </div>

      <div className="map-row">
        <div className="axis-y">Valuation →</div>
        <div>
          <div className="chart">
            <div className="gut-y">
              {TICKS.map((t) => (
                <span key={t} className="tk tk-y" style={{ bottom: `${plot(t)}%` }}>
                  {t}
                </span>
              ))}
            </div>
            {/* --split is published once and consumed by the tinted quadrants, the
                two dashed lines AND the plotted points, so they cannot disagree
                about where 65 is. */}
            <div
              className="map"
              style={{ '--split': `${plot(SPLIT).toFixed(2)}%` } as React.CSSProperties}
            >
              {QUADRANTS.map((q) => (
                <div key={q.cls} className={`quad ${q.cls}`}>
                  <span className="ql">{q.label}</span>
                </div>
              ))}
              <div className="split-v" />
              <div className="split-h" />

              {rows.map((r) => {
                const colour = scoreColor(r.overallRating);
                const size = diameter(r.overallRating);
                const x = plot(r.healthScore);
                const y = plot(r.valuationScore);
                const gap = size / 2 + 4;
                const side = SIDE[r.ticker] ?? 'r';

                const label: React.CSSProperties =
                  side === 'r'
                    ? { left: `calc(${x}% + ${gap}px)`, bottom: `calc(${y}% - 7px)` }
                    : side === 'l'
                      ? { right: `calc(${100 - x}% + ${gap}px)`, bottom: `calc(${y}% - 7px)` }
                      : {
                          left: `${x}%`,
                          bottom:
                            side === 'u'
                              ? `calc(${y}% + ${gap}px)`
                              : `calc(${y}% - ${gap + 12}px)`,
                          transform: 'translateX(-50%)',
                        };

                return (
                  <span key={r.ticker}>
                    <span
                      className="dot"
                      style={{
                        left: `${x}%`,
                        bottom: `${y}%`,
                        width: `${size}px`,
                        height: `${size}px`,
                        // 8c = 55% alpha, matching the terminal's fill opacity.
                        background: `color-mix(in srgb, ${colour} 55%, transparent)`,
                        borderColor: colour,
                      }}
                    />
                    <span className="dlab" style={label}>
                      {r.ticker}
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="gut-x">
              {TICKS.map((t) => (
                <span key={t} className="tk tk-x" style={{ left: `${plot(t)}%` }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="axis-x">Financial Health →</div>
        </div>
      </div>

      <p className="map-note">
        Each bubble is one of the seven, named in the results table above.
      </p>
      {/* Below 700px the captions come off the plot and land here, word for word
          unchanged and in their own colours — see landing.css. */}
      <div className="quad-key">
        {QUADRANTS.map((q) => (
          <span key={q.cls} style={{ color: q.ink }}>
            <i style={{ background: q.swatch }} />
            {q.label}
          </span>
        ))}
      </div>
    </>
  );
}
