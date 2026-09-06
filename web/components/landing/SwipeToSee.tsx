'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A horizontal scroller that says it is one — audit 5A-157.
 *
 * ⚠️ The landing's worked run is 1,055px wide inside a 341px box at 375px, so a
 * phone reader sees Ticker, Company and Overall and nothing else: Health,
 * Valuation and all four Major Cycle columns are off-screen, while the caption
 * below the table explains three of them by name. It has always scrolled. Nothing
 * said so — a mobile scrollbar is an overlay that appears once you are already
 * scrolling, which is no use to somebody who does not know there is more.
 *
 * ⚠️ The hint is measured, never assumed: `overflow` is read off the live element
 * and re-read on resize, so a screen wide enough to show the whole table gets no
 * hint and no fade. The alternative — showing it under a fixed breakpoint —
 * promises hidden content on a table that may have none, which is the same class
 * of lie in the other direction.
 *
 * ⚠️ It does NOT touch `.results-table-wrap`. That class is also the screener's,
 * and the screener is a paid surface a public-pages pass does not get to repaint
 * (CLAUDE.md 11l). The screener needs none of this anyway: it renders
 * `hidden md:block` and swaps to a card list on a phone.
 */
export function SwipeToSee({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 2px, not 0: sub-pixel layout leaves a fraction of overflow on tables that
    // fit perfectly, and a hint that fires on 0.5px is a hint nobody believes.
    setOverflows(el.scrollWidth - el.clientWidth > 2);
    setScrolled(el.scrollLeft > 4);
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [measure]);

  return (
    <>
      <div
        ref={ref}
        className={`results-table-wrap lp-swipe${overflows && !scrolled ? '' : ' is-complete'}`}
      >
        {children}
      </div>
      {overflows && !scrolled && (
        // aria-hidden: the table is already reachable by keyboard and by a screen
        // reader's own table navigation, so this sentence is advice to a reader
        // using a finger and noise to anyone else.
        <p className="lp-swipe-hint" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 7h10" />
            <path d="M8.5 3.5L12 7l-3.5 3.5" />
          </svg>
          {label}
        </p>
      )}
    </>
  );
}
