/**
 * The shell every diagram on a reading page wears: framed panel, optional
 * legend, caption underneath.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * `CycleDiagram` invented this shell and it was correct; the Learn articles then
 * needed the same thing three more times. Four copies of "what a figure looks
 * like" is CLAUDE.md 11c waiting to happen — the failure is not that one copy
 * breaks, it is that one copy gets improved and the others quietly do not, and
 * nothing goes red because every figure still renders perfectly.
 *
 * ⚠️ **The caption is a REQUIRED prop, deliberately.** A diagram with no caption
 * is the accessibility and comprehension failure that looks completely fine in
 * review: sighted readers infer the point from the picture, and everyone else
 * gets nothing. Making it required means a figure cannot ship without one.
 *
 * ⚠️ **The legend goes BELOW the drawing, never inside it.** Learned on
 * CycleDiagram: in-chart captions cleared the price line at one aspect ratio and
 * collided with it at another, so keeping them legible meant hand-tuning
 * positions per breakpoint — a second copy of the layout, waiting to drift.
 */
export function Figure({
  children,
  legend,
  caption,
}: {
  children: React.ReactNode;
  /** Swatch/label pairs, rendered under a divider. Omit when the drawing needs none. */
  legend?: React.ReactNode;
  /** What the reader should take away. Required — see the note above. */
  caption: React.ReactNode;
}) {
  return (
    <figure className="mt-7 mb-2">
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-stripe)] px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
        {children}
        {legend && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--border)] pt-3">
            {legend}
          </div>
        )}
      </div>
      {/* `.small`, which under `.doc-scale` resolves to --pub-label (12px) — the
          floor for a reading page, not a preference. --text-secondary, never
          --text-muted, which measures 2.69:1 and would fail the contrast guard. */}
      <figcaption className="small mt-3 text-[var(--text-secondary)]">{caption}</figcaption>
    </figure>
  );
}

/**
 * One legend entry: a swatch and its words.
 *
 * The swatch is `aria-hidden` and the words carry the meaning, so a screen
 * reader hears "One-year high — 20% below" rather than "image, One-year high".
 */
export function LegendItem({
  swatch,
  children,
}: {
  swatch: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-secondary)]">
      <span className="flex-shrink-0" aria-hidden="true">
        {swatch}
      </span>
      {children}
    </span>
  );
}
