import { LANDING, depth, type LandingSnapshot } from '@/lib/landing';

/**
 * Two rulers: how far this stock falls, and how far it recovers.
 *
 * The whole argument of the page in one picture. Each track runs from the stock's
 * last turning point out to the most extreme move in its record, with three marks
 * on it — where it is now, where its moves typically end, and the worst/best it
 * has ever done. A reader who understands nothing else should still be able to see
 * that today's fall is small against the typical one, and that the typical one is
 * small against the record.
 *
 * ⚠️ Every position is DERIVED from the snapshot as a share of the extreme. The
 * approved artifact printed them as literal percentages (`left:11.1%`), which was
 * correct on the day it was drawn and silently wrong the moment Apple moved — a
 * marker would sit at a position that no longer matched its own label, and nothing
 * would error. A number in a style attribute is still a number in prose.
 */

interface Mark {
  /** 0–100, where the mark sits along the track. */
  at: number;
  label: string;
  colour: string;
  /** Labels alternate above/below so "today" and "typical" never collide. */
  low?: boolean;
  end?: boolean;
}

function Ruler({
  heading,
  hint,
  side,
  fill,
  marks,
  tail,
  legend,
}: {
  heading: string;
  hint: string;
  side: string;
  fill: string;
  marks: Mark[];
  tail: { from: number; text: string };
  legend: { colour: string; text: string }[];
}) {
  return (
    <div className="ruler">
      <div className="ruler-head">
        <span>
          <b>{heading}</b> {hint}
        </span>
        <span>{side}</span>
      </div>
      <div className="ruler-track">
        {/* The final width rides on a custom property rather than `width` itself.
            An inline `width` would out-specify the armed rule in landing.css, so
            the fill could never start at zero and the animation would silently do
            nothing — visible only by watching, which is exactly how it was missed
            the first time. */}
        <div
          className="ruler-fill"
          data-fill
          style={{ ['--w' as string]: `${tail.from}%`, background: fill }}
        />
        <div className="tail" style={{ left: `${tail.from}%` }}>
          <span>{tail.text}</span>
        </div>
        {marks.map((m) => (
          <div
            key={m.label}
            // `near-start`: a centred label whose marker sits close to the left
            // edge hangs off the card. Only true on a phone — at 375px the track
            // is ~341px and half a label is ~16% of it, against ~5% at 1280 — so
            // the class is inert until the media query in landing.css picks it up.
            // Widening the behaviour for the caller that needs it, rather than
            // re-tuning the desktop layout the artifact was approved at.
            className={`mk${m.low ? ' low' : ''}${m.end ? ' end' : ''}${
              m.at < 16 ? ' near-start' : ''
            }`}
            style={{ left: `${m.at}%`, background: m.colour }}
            data-l={m.label}
          />
        ))}
      </div>
      <div className="ruler-legend">
        {legend.map((l) => (
          <span key={l.text}>
            <i style={{ background: l.colour }} />
            {l.text}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CycleRulers({ snapshot = LANDING }: { snapshot?: LandingSnapshot }) {
  const s = snapshot;

  // Each track is scaled to its own extreme, so the two are read independently:
  // a 470% recovery and an 81% fall do not belong on one axis.
  const down = (v: number) => (Math.abs(v) / Math.abs(s.deepestDrawdownPct)) * 100;
  const up = (v: number) => (Math.abs(v) / Math.abs(s.largestRecoveryPct)) * 100;

  const falls = s.pullbackEvents.toLocaleString('en-AU');
  const recoveries = s.recoveryEvents.toLocaleString('en-AU');

  return (
    <>
      <Ruler
        heading="How far it falls."
        hint="Left edge is its last high; the scale runs to the deepest fall in its history."
        side="Downside"
        fill="linear-gradient(90deg,rgba(178,34,34,.28),rgba(178,34,34,.09))"
        tail={{
          from: down(s.typicalDrawdownPct),
          text: `Deeper than average — reached only in the worst of its ${falls} falls`,
        }}
        marks={[
          {
            at: down(s.currentDrawdownPct),
            label: `Today −${depth(s.currentDrawdownPct)}`,
            colour: 'var(--brand-bright)',
            low: true,
          },
          {
            at: down(s.typicalDrawdownPct),
            label: `Typical −${depth(s.typicalDrawdownPct)}`,
            colour: 'var(--series-reference)',
          },
          {
            at: 100,
            label: `Worst ever −${depth(s.deepestDrawdownPct)}`,
            colour: 'var(--c-tier-5)',
            end: true,
          },
        ]}
        legend={[
          { colour: 'var(--brand-bright)', text: 'Where it is now' },
          { colour: 'var(--series-reference)', text: `Average of all ${falls} falls` },
          { colour: 'var(--c-tier-5)', text: 'Deepest single fall on record' },
        ]}
      />

      <Ruler
        heading="How far it recovers."
        hint="Left edge is its last low; the scale runs to the largest rally in its history."
        side="Upside"
        fill="linear-gradient(90deg,rgba(34,139,34,.09),rgba(34,139,34,.28))"
        tail={{
          from: up(s.typicalRecoveryPct),
          text: `Beyond where past recoveries usually stopped — one of ${recoveries} ran this far`,
        }}
        marks={[
          {
            at: up(s.currentProfitPct),
            label: `Today +${depth(s.currentProfitPct)}`,
            colour: 'var(--brand-bright)',
            low: true,
          },
          {
            at: up(s.typicalRecoveryPct),
            label: `Typical +${depth(s.typicalRecoveryPct)}`,
            colour: 'var(--c-tier-2)',
          },
          {
            at: 100,
            label: `Best ever +${depth(s.largestRecoveryPct)}`,
            colour: 'var(--c-tier-1)',
            end: true,
          },
        ]}
        legend={[
          { colour: 'var(--brand-bright)', text: 'Risen since its last low' },
          { colour: 'var(--c-tier-2)', text: `Average of all ${recoveries} recoveries` },
          { colour: 'var(--c-tier-1)', text: 'Largest single recovery on record' },
        ]}
      />

      <div className="readout">
        <div>
          <div className="k">Typical fall vs deepest ever</div>
          <div className="v" style={{ color: 'var(--series-reference-ink)' }}>
            −{depth(s.typicalDrawdownPct)}{' '}
            <span style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>vs</span>{' '}
            <span style={{ color: 'var(--c-tier-5-ink)' }}>−{depth(s.deepestDrawdownPct)}</span>
          </div>
          <div className="d">
            Two different questions: what usually happens, and what has actually happened at
            its worst. Decide which one you could sit through before you buy.
          </div>
        </div>
        <div>
          <div className="k">Typical recovery vs largest ever</div>
          <div className="v" style={{ color: 'var(--c-tier-2-ink)' }}>
            +{depth(s.typicalRecoveryPct)}{' '}
            <span style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>vs</span>{' '}
            <span style={{ color: 'var(--c-tier-1)' }}>+{depth(s.largestRecoveryPct)}</span>
          </div>
          <div className="d">
            The typical figure is where past recoveries have run out of steam — useful for
            setting an exit before you need one. The record is one event, not a target.
          </div>
        </div>
      </div>
    </>
  );
}
