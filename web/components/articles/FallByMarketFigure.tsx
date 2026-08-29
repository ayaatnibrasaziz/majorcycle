/**
 * The featured article's figure: typical fall, whole index against largest sixty.
 *
 * ⚠️ **EVERY COORDINATE IS COMPUTED FROM THE NUMBERS.** The approved storyboard
 * drew this with literal `y="173.4"` values, correct on the day they were taken
 * and silently detached from the data afterwards — CLAUDE.md 11k, which this
 * repo has already paid for once on the landing page's ruler markers. Change a
 * figure in `SERIES` and the drawing, the labels and the accessible description
 * all move together, because there is only one source for them.
 *
 * ⚠️ **THE LABELS ARE HTML, NOT SVG TEXT, AND THAT IS THE WHOLE POINT.** This is
 * the pattern every Learn figure uses (`chartPrimitives.tsx`), and it exists for
 * exactly the reason that showed up here. Text inside a scaled `<svg>` scales
 * with it: the first build stated 12.5 user units against a 300-unit viewBox in
 * a 300px box, which is 12.5px on a desktop and — measured, not assumed —
 * **10.78px at 375px**, where the card's padding leaves the block only 258.6px.
 * A reading floor that holds on one screen and not on another is not a floor.
 * HTML labels are page text at every width, so the drawing may squeeze and the
 * words may not.
 *
 * The consequence is that the plot is scaled non-uniformly, so:
 *   · every stroke carries `vector-effect="non-scaling-stroke"`, or a diagonal
 *     line's width would vary along its own length; and
 *   · the end points are HTML dots rather than `<circle>`, which would render as
 *     ellipses under the same transform.
 *
 * ⚠️ **THE PLOT'S HEIGHT IS FIXED IN PIXELS**, which is what makes the vertical
 * clearance a constant instead of a function of the screen. The two closest
 * series are 0.6 of a percentage point apart out of a 5.9 point range — about a
 * tenth of the plot — so an aspect-ratio box would have put their labels 20px
 * apart on a desktop and 6px apart on a phone, and only one of those would ever
 * have been measured.
 *
 * ⚠️ **NO LEGEND — owner decision.** A legend makes the reader hold three
 * swatches in their head and match them back to three lines, which is work the
 * chart should be doing for them. Each series is named at the END of its own
 * line, at that line's own height, so there is nothing to match; and the two
 * figures sit at the two ends, so the measurement is IN the drawing rather than
 * in a caption beside it.
 *
 * ⚠️ **None of the three colours may be a DIRECTION colour.** Green and red mean
 * up and down everywhere else on this site and must not be spent on series
 * identity. Teal is the Learn illustrations' established price colour
 * (`design-system.md` §11), so it is already part of the house palette.
 */

/**
 * The gutters, in PIXELS, because the labels are pixels.
 *
 * Sized from the widest label actually rendered — "−21.7%" on the left, "ASX 200
 * −18.5%" on the right — plus the gap, plus room for the wider glyphs Linux
 * gives the same font. That allowance is not theoretical: a 2px difference
 * between Windows and CI is what turned the equivalent Learn guard red once.
 */
const LEFT_GUTTER_PX = 56;
const RIGHT_GUTTER_PX = 116;

/**
 * ⚠️ A MEASURED MINIMUM, not a taste. The two closest end labels are a tenth of
 * the plot apart, so this height is what decides whether they collide.
 * `articles.spec.ts` asserts 3px between every pair of labels at three widths,
 * so it cannot be trimmed in silence.
 */
const PLOT_H_PX = 220;

/** Room above, so a label centred on the topmost point cannot clip. */
const PLOT_PAD_TOP_PX = 14;

/**
 * Room below for the axis captions.
 *
 * ⚠️ It has to clear the DEEPEST left-hand label, not just the plot. That label
 * is centred on a point at the very bottom, so half of it hangs below the plot
 * box — and with the caption 9px under the plot the two cleared by 2.1px.
 * Measured, not reasoned: the overlap is invisible and the browser is the only
 * thing that can see it.
 */
const PLOT_PAD_BOTTOM_PX = 40;

interface Series {
  readonly id: string;
  readonly name: string;
  /** Depth as a negative percentage: whole index, then largest sixty. */
  readonly whole: number;
  readonly largest60: number;
  /** The LINE and the dot. A token or literal — never a direction colour. */
  readonly colour: string;
  /**
   * The same colour as WORDS, where one is needed.
   *
   * ⚠️ This is `lib/ink.ts`'s rule applied to a series palette: *"a colour that is
   * a line, a candle, a dot or a bar keeps the value it has always had; the same
   * colour used as words points at one of these instead."* A stroke has no
   * contrast requirement; a 12px label has a 4.5:1 one.
   *
   * Only the teal needed one. Measured on the rendered page, `#0E7C8B` — the Learn
   * illustrations' price colour — comes out at **4.45:1** against the briefing
   * card's ground, five hundredths under the floor, and the contrast guard caught
   * it the moment the page became measurable. ⚠️ It passes on WHITE (4.91), which
   * is the trap the signed-in palette work already paid for: **measure a colour
   * where it actually sits, and take a margin.** `#0C6E7B` clears 5.32:1 against
   * the worst of the three grounds this label can land on (white, `--brand-light`,
   * `--bg-page`), and is close enough that the line and its label still read as one
   * colour.
   */
  readonly ink?: string;
}

/**
 * As at 27 August 2026, from the same study the article reports.
 *
 * ⚠️ These are FROZEN, and deliberately not read from the database. The article
 * states the day its measurement was taken, so the picture must show that day —
 * a live query would leave the drawing disagreeing with the prose beside it the
 * first time a price moved. Re-taking the measurement is an edit to the article,
 * not a data refresh.
 *
 * ⚠️ And "frozen" now means a FILE rather than a promise:
 * `reference/how-far-do-asx-shares-fall-DATA.json` holds every input these
 * numbers were derived from, and the workbook rebuilds them from it with no
 * database at all. That file exists because one input was still live — market
 * cap, which decides which sixty companies are "the largest sixty". The ASX
 * figure here was −18.4% for four hours; a nightly refresh re-ranked the sixty
 * and the same code then said −18.5%. Neither was wrong, and nothing about
 * either looked odd, which is the whole problem (CLAUDE.md 11k).
 *
 * ⚠️ The TSX 60's two values are identical BY CONSTRUCTION — it holds sixty
 * companies, so its largest sixty are all of them. That makes it the figure's
 * own control: a chart in which every line moved would be much harder to trust.
 * ⚠️ It read −15.9% once, on a day when one Canadian company had lost its market
 * cap overnight and dropped out of the ranking of sixty. That was an artifact of
 * OUR data, not a fact about Canada — and it is the reason every figure in this
 * article now comes from one complete run rather than two partial ones.
 */
const SERIES: readonly Series[] = [
  { id: 'ca', name: 'TSX 60', whole: -15.7, largest60: -15.7, colour: '#0E7C8B', ink: '#0C6E7B' },
  { id: 'us', name: 'S&P 500', whole: -18.9, largest60: -19.2, colour: 'var(--text-muted)' },
  { id: 'au', name: 'ASX 200', whole: -21.7, largest60: -18.5, colour: 'var(--brand-mid)' },
];

const pct = (v: number) => `−${Math.abs(v).toFixed(1)}%`;

export function FallByMarketFigure() {
  const depths = SERIES.flatMap((s) => [Math.abs(s.whole), Math.abs(s.largest60)]);
  const shallowest = Math.min(...depths);
  const deepest = Math.max(...depths);
  /** Depth to a percentage down the plot. Deeper is lower. */
  const y = (v: number) => ((Math.abs(v) - shallowest) / (deepest - shallowest)) * 100;

  // Built from the same numbers the drawing uses, so a screen reader and a
  // sighted reader can never be told different things.
  const description =
    'Typical fall by market, whole index against largest sixty companies. ' +
    SERIES.map((s) =>
      s.whole === s.largest60
        ? `The ${s.name} stays at ${pct(s.whole)}, because it already holds only sixty companies.`
        : `The ${s.name} goes from ${pct(s.whole)} to ${pct(s.largest60)}.`,
    ).join(' ');

  return (
    <figure className="art-fig">
      {/* Two boxes on purpose. The outer carries the gutters as padding; the
          inner is the drawing, and everything positioned by percentage measures
          against it. One box will not do — an absolutely-positioned child lays
          out against its ancestor's PADDING box, so the plot would start back at
          the card edge. */}
      <div
        className="art-plotouter"
        style={{
          paddingLeft: LEFT_GUTTER_PX,
          paddingRight: RIGHT_GUTTER_PX,
          paddingTop: PLOT_PAD_TOP_PX,
          paddingBottom: PLOT_PAD_BOTTOM_PX,
        }}
      >
        <div className="art-plot" style={{ height: PLOT_H_PX }}>
          <svg
            className="art-plot-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={description}
          >
            {/* The two verticals the slopes run between. They overshoot the plot
                so the frame reads as an axis rather than as a clipped rule. */}
            <line className="art-ax" x1="0" y1="-8" x2="0" y2="108" vectorEffect="non-scaling-stroke" />
            <line className="art-ax" x1="100" y1="-8" x2="100" y2="108" vectorEffect="non-scaling-stroke" />
            {SERIES.map((s) => (
              <line
                key={s.id}
                className="art-ln"
                x1="0"
                y1={y(s.whole)}
                x2="100"
                y2={y(s.largest60)}
                stroke={s.colour}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {SERIES.map((s) => (
            <div key={s.id}>
              {/* Round dots as HTML — a `<circle>` under a non-uniform scale is
                  an ellipse, and it would flatten differently at every width. */}
              <span
                className="art-dot"
                style={{ left: '0%', top: `${y(s.whole)}%`, backgroundColor: s.colour }}
              />
              <span
                className="art-dot"
                style={{ left: '100%', top: `${y(s.largest60)}%`, backgroundColor: s.colour }}
              />

              {/* The left-hand figure appears only when the line actually moves.
                  On a flat series it would restate the label at the other end,
                  and two identical numbers on one row read as a mistake. */}
              {s.whole !== s.largest60 && (
                <span
                  className="art-lab art-lab-l art-sfg"
                  style={{ top: `${y(s.whole)}%`, color: s.ink ?? s.colour }}
                >
                  {pct(s.whole)}
                </span>
              )}

              <span
                className="art-lab art-lab-r"
                style={{ top: `${y(s.largest60)}%`, color: s.ink ?? s.colour }}
              >
                <span className="art-snm">{s.name}</span>
                <span className="art-sfg">{pct(s.largest60)}</span>
              </span>
            </div>
          ))}

          <span className="art-cap art-cap-l">whole index</span>
          <span className="art-cap art-cap-r">largest 60</span>
        </div>
      </div>
      {/* ⚠️ NO VISIBLE CAPTION (owner, 2026-08-29). It read "The TSX 60 does not
          move because it already holds only sixty companies — it is its own
          control", which is a note to a statistician rather than to a reader
          deciding whether to open the article, and it was the reason the figure
          column hung below the card's own call to action.

          ⚠️ The explanation is NOT lost, because it never lived here: the same
          sentence is generated into `description` above from the same numbers,
          and that is what the `aria-label` carries. A reader on a screen reader
          still hears "The TSX 60 stays at −15.7%, because it already holds only
          sixty companies." Deleting a visible caption that duplicates the
          accessible name costs nothing; deleting the accessible name would have
          broken #12, so the two are deliberately not the same string. */}
    </figure>
  );
}
