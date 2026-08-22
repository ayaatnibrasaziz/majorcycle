/**
 * The Major Cycle, drawn — the one idea the whole product rests on.
 *
 * `/methodology` explained a visual concept in six paragraphs and zero pictures.
 * A reader who has never met the term has to hold "falls, recovers, compared
 * with its own history" in their head; the picture hands it over in a second.
 * This is the "demonstrate before you name it" decision: the diagram shows the
 * shape, and the prose supplies the vocabulary afterwards.
 *
 * ── Choices worth keeping ────────────────────────────────────────────────────
 *
 * 1. **It is a schematic, and it must look like one.** The line is a rounded
 *    polyline with no ticks, no dates and no dollar axis. A smooth, plausible
 *    "chart" would read as a real security's history and imply a claim we are
 *    not making (CLAUDE.md #24). Illustrative shape, no data.
 *
 * 2. **The labels are HTML, not SVG text.** SVG text scales with the viewBox, so
 *    a 12px label inside a 680-wide drawing becomes ~6px on a 375px phone —
 *    exactly the leaked-app-scale problem Layer G exists to end. HTML labels sit
 *    on the reading scale at every width while the drawing stretches underneath
 *    (`preserveAspectRatio="none"`, with a non-scaling stroke).
 *
 * 3. **The key marker is HTML too, because `none` distorts geometry as well as
 *    strokes.** The first version drew "today" as an SVG <circle> and it rendered
 *    as a flat ellipse — `vector-effect` rescues stroke *width*, never shape.
 *    Anything that must stay round lives in the overlay.
 *
 * 4. **The legend sits below the drawing.** In-chart captions collided with the
 *    price line at one aspect ratio and cleared it at another, so keeping them
 *    legible meant hand-tuning positions per breakpoint — a second copy of the
 *    layout, waiting to drift. Only "Today" stays inside, in provably empty space.
 */

/** Schematic price path in a 0–100 box; y is inverted, so a small y is a high price. */
const PATH = [
  [0, 80], [10, 55], [20, 82], [30, 60], [38, 44],
  [44, 31], [52, 60], [60, 45], [68, 24], [73, 15],
  [80, 41], [88, 30], [96, 24],
] as const;

/** The three completed falls, each from a peak to the trough that followed it. */
const FALLS = [
  { x: 15, peakY: 55, troughY: 82, depth: '−27%' },
  { x: 48, peakY: 31, troughY: 60, depth: '−29%' },
  { x: 76.5, peakY: 15, troughY: 41, depth: '−26%' },
] as const;

const LAST_PEAK_Y = 15;
const TYPICAL_DEPTH = 27; // average of the three above, in the same 0–100 units
/** The level a fall of typical depth would reach from the most recent high. */
const USUAL_FLOOR = LAST_PEAK_Y + TYPICAL_DEPTH;
/** The zone is measured from the LAST high, so it only spans the recent stretch. */
const ZONE_FROM_X = 60;
const TODAY = { x: 96, y: 24 };

export function CycleDiagram() {
  return (
    <figure className="mt-7 mb-2">
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-stripe)] px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
        <div className="relative w-full aspect-[16/11] sm:aspect-[16/7]">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={
              'Schematic of a share price falling and recovering three times. Each fall from a ' +
              'high is roughly a quarter of the price. A shaded zone marks how far this stock ' +
              'has usually fallen before turning; the current price sits well above that zone, ' +
              'only slightly below its most recent high.'
            }
          >
            {/* Everything BELOW this line is as deep as this stock's falls have
                usually gone. The product's whole question is whether today is in
                there. It must read as a floor the price is currently above — the
                first draft shaded the region ABOVE it, and the picture then
                contradicted its own caption.

                It is drawn only over the recent stretch, and faded out to the
                left, because "27% below the high" is a level measured from the
                MOST RECENT high — not a fixed price that held for years. Running
                it the full width implied the latter, which is a different and
                wrong claim. */}
            <defs>
              {/* userSpaceOnUse, not the default objectBoundingBox: the dashed
                  line's bounding box is zero-height, which degenerates an
                  objectBoundingBox gradient — it rendered as nothing at all. */}
              <linearGradient
                id="cyc-zone-fade"
                gradientUnits="userSpaceOnUse"
                x1={ZONE_FROM_X}
                x2="100"
                y1="0"
                y2="0"
              >
                <stop offset="0" stopColor="var(--brand-bright)" stopOpacity="0" />
                <stop offset="0.45" stopColor="var(--brand-bright)" stopOpacity="0.13" />
                <stop offset="1" stopColor="var(--brand-bright)" stopOpacity="0.13" />
              </linearGradient>
              <linearGradient
                id="cyc-line-fade"
                gradientUnits="userSpaceOnUse"
                x1={ZONE_FROM_X}
                x2="100"
                y1="0"
                y2="0"
              >
                <stop offset="0" stopColor="var(--brand-bright)" stopOpacity="0" />
                <stop offset="0.45" stopColor="var(--brand-bright)" stopOpacity="1" />
                <stop offset="1" stopColor="var(--brand-bright)" stopOpacity="1" />
              </linearGradient>
            </defs>
            <rect
              x={ZONE_FROM_X}
              y={USUAL_FLOOR}
              width={100 - ZONE_FROM_X}
              height={100 - USUAL_FLOOR}
              fill="url(#cyc-zone-fade)"
            />
            <line
              x1={ZONE_FROM_X}
              y1={USUAL_FLOOR}
              x2="100"
              y2={USUAL_FLOOR}
              stroke="url(#cyc-line-fade)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />

            {/* Peak-to-trough drops */}
            {FALLS.map((f) => (
              <line
                key={f.x}
                x1={f.x}
                y1={f.peakY}
                x2={f.x}
                y2={f.troughY}
                stroke="var(--text-muted)"
                strokeWidth="1"
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <polyline
              points={PATH.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none"
              stroke="var(--brand-deep)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Depth labels — hidden on phones, where three of them collide and the
              only way to fit is below the 12px floor. The zone and "today" carry
              the idea alone; progressive disclosure, not a second diagram. */}
          {FALLS.map((f) => (
            <span
              key={f.x}
              className="hidden sm:block absolute -translate-x-1/2 -translate-y-1/2 rounded-[4px] bg-[var(--bg-surface)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-sm)]"
              style={{ left: `${f.x}%`, top: `${(f.peakY + f.troughY) / 2}%` }}
            >
              {f.depth}
            </span>
          ))}

          {/* "Today" — an HTML dot, so it stays circular under a distorting
              viewBox — plus its label, in the empty top-right corner. */}
          <span
            className="absolute block h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--brand-bright)] bg-[var(--bg-surface)]"
            style={{ left: `${TODAY.x}%`, top: `${TODAY.y}%` }}
            aria-hidden="true"
          />
          {/* Pinned a fixed 14px above the dot, not a fixed PERCENTAGE above it.
              A percentage offset is a different number of pixels in the 16/7
              desktop box and the 16/11 phone box, and at 375px the label landed
              on top of the marker. */}
          <span
            className="absolute right-0 text-right text-[12px] font-bold leading-tight text-[var(--text-primary)]"
            style={{ top: `${TODAY.y}%`, transform: 'translateY(calc(-100% - 14px))' }}
          >
            Today
            <span className="block font-[family-name:var(--font-mono)] font-semibold text-[var(--text-secondary)]">
              −9%
            </span>
          </span>
        </div>

        {/* Legend, below the drawing. In-chart captions cleared the price line at
            one aspect ratio and collided at the other. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--border)] pt-3">
          <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-secondary)]">
            <span
              className="h-0 w-6 flex-shrink-0 border-t-[2px] border-dashed border-[var(--brand-bright)]"
              aria-hidden="true"
            />
            How far this stock has usually fallen before turning
          </span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-secondary)]">
            <span
              className="h-[11px] w-[11px] flex-shrink-0 rounded-full border-[3px] border-[var(--brand-bright)] bg-[var(--bg-surface)]"
              aria-hidden="true"
            />
            Where it is right now
          </span>
        </div>
      </div>

      <figcaption className="small mt-3 text-[var(--text-secondary)]">
        A schematic, not a real stock. This one has fallen about a quarter from
        each high before turning. Today it is only a little below its last high —
        nowhere near that zone. MajorCycle asks exactly that question of every
        stock it covers, against that stock&apos;s own history rather than the
        market&apos;s.
      </figcaption>
    </figure>
  );
}
