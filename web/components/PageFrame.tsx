/**
 * The one place a public page decides how wide it is.
 *
 * Before Layer G every public page rendered inside a hard-coded
 * `max-w-[440px]` in the public layout — the width of the sign-in card. That
 * is right for a form and wrong for anything that is read: `/methodology` ran
 * long-form prose down a 440px column at 13px, using 31% of a 1440px screen.
 *
 * The layout now owns the chrome (header, background, footer) and the page
 * owns its frame, so header and footer are still defined exactly once
 * (CLAUDE.md 11c) while the column can differ per page.
 *
 * Widths are tokens, not numbers — `--measure-*` in globals.css. A page that
 * wants a different column asks for a different variant; it never types a
 * pixel value, because a second copy of a measurement is a measurement that
 * will drift.
 */

export type FrameWidth = 'narrow' | 'prose' | 'wide';

const MEASURE: Record<FrameWidth, string> = {
  narrow: 'var(--measure-narrow)',
  prose: 'var(--measure-prose)',
  wide: 'var(--measure-wide)',
};

interface PageFrameProps {
  /**
   * `narrow` — auth cards and short forms. Vertically centred, as before.
   * `prose`  — anything read top to bottom. ~68 characters per line.
   * `wide`   — landing and other laid-out pages.
   */
  width?: FrameWidth;
  /**
   * Apply the reading type scale (`.reading` in globals.css). Defaults to on
   * for `prose`/`wide` and off for `narrow`: a frame built for reading IS a
   * reading context, and leaving that to each page is how the two drift apart.
   */
  reading?: boolean;
  children: React.ReactNode;
}

export function PageFrame({ width = 'narrow', reading, children }: PageFrameProps) {
  const isReading = reading ?? width !== 'narrow';

  return (
    <div
      // `my-auto` centres a short card in the leftover space, exactly as the
      // old layout did. A long page overflows that space, at which point
      // `auto` margins collapse to zero and it simply starts at the top —
      // one rule covering both cases without a conditional.
      className={`w-full mx-auto my-auto${isReading ? ' reading' : ''}`}
      style={{ maxWidth: MEASURE[width] }}
    >
      {children}
    </div>
  );
}
