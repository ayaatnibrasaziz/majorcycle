'use client';

import { useEffect } from 'react';

/**
 * The landing page's three moments of motion, as approved in the storyboard:
 *
 *  1. The briefing ring draws round to its fill.
 *  2. The Opportunity Map's bubbles land in ranked order, each name with it.
 *  3. Everything else fades up as it enters — plus the two rulers filling to the
 *     marker they are about to explain.
 *
 * ⚠️ **Progressive enhancement, not the artifact's approach.** The artifact puts
 * the hidden state in the stylesheet (`.rise { opacity:0 }`) and relies on its
 * script to reveal it. On a real marketing page that is a blank screen for anyone
 * whose JavaScript fails, and the front door is the one page that must never do
 * that. So the server renders every element in its FINAL state; this component
 * marks the root `data-motion` on mount, which is what arms the initial state in
 * CSS, then plays the sequence. No JS → no class → the page simply renders.
 *
 * ⚠️ IntersectionObserver, never a scroll listener: a scroll handler reflows
 * continuously and costs phone frame rates for an effect nobody asked for.
 *
 * `prefers-reduced-motion` is honoured twice over — the CSS neutralises the
 * transitions, and the effect below skips straight to the end state rather than
 * running timers whose result is invisible.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.lp');
    if (!root) return;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = (el: Element) => el.classList.add('in');

    // Arm the initial state only now that JS is definitely running.
    root.dataset['motion'] = 'on';

    // Everything below only ever ADDS `.in`. The armed (pre-animation) state
    // lives entirely in landing.css behind `[data-motion]`, so JS never fights
    // specificity with an inline style — the first attempt set the ruler width
    // inline, which out-specified the armed rule and made the fills animate from
    // their final value to their final value, i.e. not at all.
    if (still) {
      root.querySelectorAll('[data-rise], [data-fill], [data-ring], .dot, .dlab').forEach(reveal);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          reveal(e.target);
          io.unobserve(e.target);

          // Moment 1 — the ring draws round to the share of the run rating
          // Constructive or better.
          e.target.querySelectorAll('[data-ring]').forEach(reveal);

          // The rulers fill to the marker they explain, a beat later, so the
          // section has settled before something inside it moves.
          const fills = e.target.querySelectorAll('[data-fill]');
          if (fills.length) window.setTimeout(() => fills.forEach(reveal), 180);

          // Moment 2 — the bubbles land in ranked order, each label arriving with
          // its bubble. 90ms apart, so seven reads as a sequence, not a pop.
          const dots = [...e.target.querySelectorAll('.dot')];
          const labels = [...e.target.querySelectorAll('.dlab')];
          dots.forEach((d, i) =>
            window.setTimeout(() => {
              reveal(d);
              const l = labels[i];
              if (l) reveal(l);
            }, 90 * i),
          );
        }
      },
      // Fire a little before the element is fully in view, so the movement is
      // finishing as the reader arrives rather than starting.
      { rootMargin: '0px 0px -12% 0px' },
    );

    root.querySelectorAll('[data-rise]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
