import { useSyncExternalStore } from 'react';

/**
 * A form must not lose what a reader typed before the page was ready.
 *
 * ⚠️ THE DEFECT (Layer H4, 2026-09-19). Every form here is visible long before it
 * works: measured on the live `/login`, the gap between the form appearing and React
 * taking it over is **0.07s on wifi, ~0.5s on 4G, ~2.9s on slow 4G and ~6s on 3G**.
 * Inside that gap two things went wrong, found by the cross-browser run (WebKit's dev
 * server is slow enough to land in the gap every time) and then reproduced in all
 * three engines with the scripts delayed:
 *
 *  - press the button before the scripts arrive → a native form submit, i.e. the page
 *    RELOADS and everything typed is gone;
 *  - type early, press after → the boxes held the text but React's state was still
 *    the initial value, so the form sent THAT (an empty email on sign-in) and the next
 *    re-render wrote it back over the boxes, in front of the reader.
 *
 * THE FIX, used by every form that takes typing (owner, 2026-09-19 — one mechanism,
 * not seven variations of one):
 *
 *  - `useHydrated()` — the submit button renders DISABLED until React owns the page,
 *    so an early press cannot reload it. A reader on a normal connection never sees
 *    the disabled state.
 *  - `adoptEarlyInput(value, set)` — a ref callback on each box. At hydration React
 *    leaves whatever the reader typed in the DOM, and refs attach after that; if the
 *    box disagrees with state, state takes the box's value. After hydration React has
 *    always written state into the box before refs attach, so the two agree and this
 *    does nothing.
 *
 * Guarded by `e2e/auth-early-input.spec.ts`, which delays the scripts and types early.
 */
const subscribe = () => () => {};

/** `false` in the server HTML and during hydration, `true` once React owns the page. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** Ref callback: adopt a value the reader typed before hydration (see above). */
export function adoptEarlyInput(
  value: string,
  set: (typed: string) => void,
): (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => void {
  return (el) => {
    if (el && el.value !== value) set(el.value);
  };
}
