'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Deterministic scroll-spy shared by the Stock Detail subnav and the report's
 * section-nav. The active section is the LAST one whose heading has scrolled up
 * to (or above) the offset line — i.e. the section currently sitting just beneath
 * the sticky nav.
 *
 * This replaces an IntersectionObserver + intersectionRatio approach that
 * activated the next section too early on unequal-height sections (a short
 * section would out-score the tall one actually filling the viewport) and could
 * leave the last/short section never highlighting.
 *
 * `getOffset()` returns the viewport-Y line below which a section counts as
 * active — pass the sticky nav's current bottom + a small gap so it auto-adapts
 * to wherever the nav sits (detail page header vs the offline report file).
 *
 * Returns `active`, plus `setActive`/`lock` for click handling: on a nav click,
 * set the target active and `lock()` so the in-flight smooth scroll doesn't
 * "walk" the highlight through every section it passes; the lock releases shortly
 * after scrolling settles (with an absolute safety timeout).
 */
export function useScrollSpy(
  ids: readonly string[],
  getOffset: () => number,
  opts: {
    /**
     * Hold an explicitly CLICKED section when the page is scrolled to its end,
     * instead of letting the bottom-of-page rule below overwrite it.
     *
     * ⚠️ Opt-in, and off for the Stock Detail subnav and the report, so their
     * behaviour is byte-identical to before. It exists because a SHORT document
     * puts several anchors inside the bottomed-out zone, where no amount of
     * scrolling can bring them to the offset line — and the bottom-of-page rule
     * then reports the last section no matter which one the reader asked for.
     *
     * Measured on /terms at 1280×900 after the legal pages were re-set at 13px
     * (which shortened the document to ~1.9 screens): clicking clauses 01–04
     * marked 01–04 correctly, and clicking **05, 06, 07 or 08 all marked 08**.
     * The reader clicks "Acceptable use" and the rail lights up "Contact".
     *
     * With this on, a click at the end of the page is simply believed: nothing
     * further will scroll, so there is nothing to re-sync to.
     */
    keepClickedAtPageEnd?: boolean;
  } = {},
): { active: string; setActive: (id: string) => void; lock: () => void } {
  const keepClicked = opts.keepClickedAtPageEnd ?? false;
  const [active, setActive] = useState<string>(ids[0]!);

  // Keep the latest getOffset in a ref (updated in an effect, not during render)
  // so the scroll handler always measures against the current nav position.
  const offsetRef = useRef(getOffset);
  useEffect(() => {
    offsetRef.current = getOffset;
  });

  const lockedRef = useRef(false);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function lock(): void {
    lockedRef.current = true;
    if (safetyRef.current) clearTimeout(safetyRef.current);
    safetyRef.current = setTimeout(() => {
      lockedRef.current = false;
    }, 1500);
  }

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const offset = offsetRef.current();
      let cur = ids[0]!;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= offset + 1) cur = id;
      }
      // Bottom of page: the last (often short) section may never reach the offset
      // line, so force it active once we're scrolled to the end.
      const se = document.scrollingElement || document.documentElement;
      if (se.scrollTop + window.innerHeight >= se.scrollHeight - 4) {
        cur = ids[ids.length - 1]!;
      }
      setActive(cur);
    };

    const onScroll = () => {
      if (lockedRef.current) {
        // Release shortly after a click-scroll settles, then re-sync.
        if (settleRef.current) clearTimeout(settleRef.current);
        settleRef.current = setTimeout(() => {
          lockedRef.current = false;
          // At the very end of the page a re-sync can only overwrite the
          // reader's own click with whatever the offset rule happens to pick,
          // and no further scrolling will ever correct it. See
          // `keepClickedAtPageEnd`.
          const se = document.scrollingElement || document.documentElement;
          const atEnd = se.scrollTop + window.innerHeight >= se.scrollHeight - 4;
          if (keepClicked && atEnd) return;
          compute();
        }, 160);
        return;
      }
      if (!raf) raf = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    // Detail-page sections stream in via Suspense (heights change with no scroll/
    // resize event) — recompute when the document size changes.
    const ro = new ResizeObserver(onScroll);
    ro.observe(document.body);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (settleRef.current) clearTimeout(settleRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
    };
  }, [ids, keepClicked]);

  return { active, setActive, lock };
}
