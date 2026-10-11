/**
 * Keep a keyboard reader's focus in sight inside a box that scrolls sideways.
 *
 * ⚠️ Chromium does NOT scroll a scroll box to reveal a focused control if any sliver
 * of it is already showing — measured 2026-10-11: a 16px button with 0.9px inside the
 * clip edge stays at 0.9px after Tab, while one exactly at the edge is revealed in
 * full. `scroll-margin` does not change that decision. On CI's Linux fonts the
 * screener's "Current DD%" ⓘ landed at exactly that sliver at 768px (box ends at
 * x=747, the button starts at 746), so the reader's focus sat in an invisible control
 * (WCAG 2.4.11). Which control lands there depends on font metrics and column widths,
 * so the fix is a rule about the CLASS — any sideways box, any focused control — not a
 * nudge to one column.
 *
 * Keyboard focus only (`:focus-visible`): a mouse click on a half-hidden header must not
 * jerk the table sideways under the pointer.
 */
export function revealFocused(target: EventTarget | null): void {
  if (!(target instanceof HTMLElement)) return;
  if (!target.matches(':focus-visible')) return;
  const r = target.getBoundingClientRect();
  for (let box = target.parentElement; box && box !== document.body; box = box.parentElement) {
    if (box.scrollWidth <= box.clientWidth) continue;
    const overflowX = getComputedStyle(box).overflowX;
    if (overflowX !== 'auto' && overflowX !== 'scroll') continue;
    const left = box.getBoundingClientRect().left + box.clientLeft;
    const right = left + box.clientWidth;
    if (r.left < left || r.right > right) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    return;
  }
}
