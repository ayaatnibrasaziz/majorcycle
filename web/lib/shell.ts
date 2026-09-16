/**
 * The signed-in shell's one breakpoint.
 *
 * At **768px and above** the product is exactly what it has always been: a
 * permanent 220px sidebar with the header and page offset beside it. Below it the
 * sidebar becomes a drawer and the page takes the full width (Layer H · H1).
 *
 * ⚠️ **Written as `min-[768px]:`, not `md:` — and NOT for the reason you would guess.**
 * `globals.css` sets `html { font-size: 14px }`, which makes every Tailwind SPACING
 * utility 0.875× its nominal value (`p-6` is 21px, not 24) — the trap `PublicHeader`
 * documents. The obvious inference is that `md` (`48rem`) is therefore 672px here.
 * **It is not.** Relative units inside a *media query* resolve against the initial
 * font size, never the root element's declared one, so `48rem` is 768px whatever
 * `html` says. Measured on the production build rather than reasoned: at a 700px
 * viewport with a 14px root, `matchMedia('(min-width: 48rem)')` is **false** — which
 * it could not be if the query were reading 672px.
 *
 * So `md:` would in fact be correct, and the explicit form is a readability choice
 * rather than a correctness one: every other breakpoint in this codebase is an
 * arbitrary variant (`min-[600px]:`, `min-[900px]:`), and a file where one line says
 * `md` and the next says `min-[900px]` invites exactly the wrong inference about
 * which of them the 14px root is bending. The number is visible in the class.
 *
 * ⚠️ The false version of this note was written first and nearly shipped. A wrong
 * reason is worse than none (14f): anyone acting on "md is 672 here" would go hunting
 * for a 96px discrepancy that does not exist.
 *
 * ⚠️ **Tailwind cannot read this constant** — its scanner needs the class present in
 * the source, so `min-[${SHELL_DESKTOP_MIN_PX}px]:` compiles to nothing. The literals
 * stay literal and the agreement is *asserted* instead: `e2e/app-responsive.spec.ts`
 * imports this value, sweeps every width either side of it, and fails if the layout
 * changes anywhere else. That is the same trade `public-responsive.spec.ts` makes,
 * and it is why three literals moving in a refactor cannot go unnoticed.
 *
 * Why 768 and not the measured 730: the first page to run out of room beside the
 * sidebar is Stock Detail, at **730px** (measured in 2px steps on a paying account,
 * 2026-09-14). A breakpoint on the boundary leaves zero margin, and this project has
 * been caught by a guard passing with 1.1px to spare (11i-b). 768 leaves 38px, and it
 * is the number `design-system.md` §10 already named.
 */
export const SHELL_DESKTOP_MIN_PX = 768;

/**
 * Where the Stock Detail scorecard stops being two columns and stacks.
 *
 * Measured against the card's CONTENT BOX, not the window — the whole defect this
 * replaced was a collapse rule written against the window while the constraint was the
 * space left beside the 220px rail (audit 5A-116, again).
 *
 * ⚠️ **The number is the BARS' minimum.** The grid is `340px` of chart + a 24px gap +
 * the bars, and a bar row spends 168px of its track on the label, the gaps and the
 * score before any bar is drawn. So a container of C leaves a visible bar of
 * `C - 36 - 340 - 24 - 168` = **C - 568**. At 680 that is a 112px bar.
 *
 * ⚠️ It is 680 because a smaller number ships a layout that FITS and does not WORK: the
 * first attempt let the chart shrink instead, which cleared the horizontal scroll and
 * left the bars as a **1px sliver** with the chart's own axis label clipped to "Balance
 * Shee". The owner caught that from a screenshot, and no overflow guard could have —
 * both states measure zero scroll. `app-responsive.spec.ts` therefore asserts the bar
 * is a real bar, on both sides of this threshold.
 */
export const SCORECARD_STACK_PX = 680;

/** What a bar row spends before drawing any bar: label + two gaps + the score. */
export const SCORECARD_BAR_CHROME_PX = 168;
