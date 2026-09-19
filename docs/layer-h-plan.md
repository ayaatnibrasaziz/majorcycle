# Layer H — Pre-launch Hardening: the plan

**Status:** ✅ **H1 COMPLETE** (2026-09-14/15, reviewed 2026-09-16) · ✅ **H2 COMPLETE AND LIVE IN
PRODUCTION** (built 2026-09-16, configured 2026-09-17 in Sentry's US region, merged in PR #101,
server side verified on Vercel 2026-09-18 — §12). All nine decisions taken, both designs approved.
· ✅ **H3 BUILT** (2026-09-18) — see the H3 section. · ✅ **H4 BUILT** (2026-09-19) — 876 tests clean
in Chromium, Firefox and WebKit, and one real defect fixed on seven forms; see the H4 section.
· ✅ **H3 and H4 MERGED** (PRs #106, #107, 2026-09-19). · ✅ **H5 BUILT** (2026-09-20) — three real
defects found and fixed (two at phone width, one at every width); see the H5 section. **H6 / H6a are next.**
**Three findings came out of building it** that the plan did not have — §3, findings I, J and K.
⚠️ Finding I changed a **paid** surface beyond the approved design; it was put to the owner, and
**my first fix for it was wrong** — it passed every automated check and the owner caught it from a
screenshot. The lesson is in CLAUDE.md **11bf**: *a layout that FITS is not a layout that WORKS*.
**Written:** 2026-09-13. Revised 2026-09-14 across nine owner decisions and two design gates.
**Against:** `main` at `b6742f7`.
**Reading order:** CLAUDE.md wins over this file. Where this file and `roadmap.md` § *Layer H*
disagree, this file states the reading and the roadmap row is corrected **at approval**.

---

## 0. Decisions taken — owner, 2026-09-14

These were asked and answered **before** this plan was written, not left open inside it.

| # | Question | Owner's answer |
|---|---|---|
| 1 | Where does the sidebar become a slide-out menu? | **Below 768px — phones only.** ⚠️ Was "below 1024px" until the owner asked *"for tablets, can't we keep it same as Desktop?"* and the measurement said yes — see §11 |
| 2 | Is error monitoring (Sentry) in Layer H? | **Yes, in Layer H**, full — not money-paths-only, not Phase 2 |
| 3 | May I measure the results table on production with a throwaway paid account? | **Yes** |
| 4 | How deep is cross-browser? | **The whole site, run locally on demand — NOT in CI**, so a push is not slowed |
| 5 | Surface the three hidden fundamentals? | **Yes, all three** — including `forwardPe` |
| 6 | Firefox will not start here | **"Check online and find ways to resolve this"** → ✅ **RESOLVED**, §3 finding E |
| 7 | Tablets lose the permanent sidebar | ❌ **REVERSED by the owner's question, and correctly** — tablets KEEP the desktop layout. §11 |
| 8 | Payout Ratio — moved, or in both places? | **Both.** Also: *"if there is anything more we can put into the shareholder group, do so"* |
| 9 | The other six invisible metrics, and Short Interest in the Risk group? | **"Add all six"** and **"yes, add short interest"** → the table becomes **13 rows → 25**, §10 |

Two standing instructions from the same message, now recorded in memory and binding on every
future session:

- **Show the design and get it approved BEFORE building any UI.** Never build first.
- **Never report something as "cannot be checked" before actually trying it.**

⚠️ **Decision 1 is this project's own written design, and settles a contradiction inside it.**
`design-system.md` §10 has said since Layer B that the sidebar *"becomes drawer"* below **768px**
— which is exactly where it now goes — while the row two lines below said *"`lg` ≥ 1024px —
Sidebar visible"*, implying no sidebar between 768 and 1023. **One table, two answers, never
built either way.** The measurement (§11) picks the 768 row; `design-system.md` §10 has been
rewritten so it no longer says both.

⚠️ **Decision 4 has a trap and it is handled.** A test suite that exists and runs in no
workflow is a gate nobody runs, and nothing goes red because nothing looked — that is audit
**F-016** exactly. So the cross-browser run gets its own command and `pnpm gates` prints it as
**NOT RUN, with the reason**, the same way `lighthouse` is handled. It is never silently
omitted.

---

## 1. What I had called "cannot be checked", and what happened when I tried

The owner's instruction was that a stated limitation is a claim like any other. Four of the
five came back.

| Previously "cannot check" | What actually happened |
|---|---|
| `/run`, `/results`, `/account` locally | ✅ **CHECKED.** `E2E_EMAIL` / `E2E_PASSWORD` exist, and `app-a11y.spec.ts` already has a house pattern for a *paid* session — create a throwaway user with the service key, grant entitlement, delete afterwards. I used it. Results in §3. |
| The **entitled** screener and ticker page | ✅ **CHECKED**, and it changed the plan. §3, finding A. |
| `/results` with real data | ✅ **CHECKED on production**, owner-authorised. **158px at 375px.** My local reading of `0` was an empty page. §3, finding B. |
| Cross-browser | ✅ **FULLY, in the end.** Firefox and WebKit installed. WebKit ran immediately; Firefox would not start at all, was diagnosed, and **now runs** — §3 finding E. All three engines clean on the eight public pages. |
| A real iPhone or Android | ❌ **Still genuinely cannot.** No device, and no emulator reproduces iOS Safari's zoom behaviour. This one stands. |

⚠️ **And the checking caught one of my own readings.** The local `/results` measured `0`
because the page was *empty* — no run history, nothing to be wide. A clean number from a page
with nothing on it is what a broken check also returns (14g). The production run therefore
**asserts 3 table rows before it measures anything**, and the real answer was 158px.

---

## 2. Honest inventory of the roadmap's Layer H section

### 2a. Already fixed — take these OFF

| Roadmap row | What is actually true |
|---|---|
| Public site has **no navigation** between 375px and 900px | **FIXED** (5A-156). `MenuButton` is `min-[900px]:hidden`, so the menu exists at *every* width below 900. The `600px` breakpoint governs only the two account buttons, which move **into** the panel. No width has no navigation. |
| `[data-legacy-contrast]` on the screener chips | **GONE.** The guards now assert the marker count is **zero** and fail with *"a marker is back"*. |
| Direction colours used as text (the remaining six) | **CLOSED** 2026-08-22 when the owner brought the contrast sweep forward. Zero violations, zero deferrals, public and signed-in. |
| Accessibility audit (axe-core) | **Substantially done** in G and 5a — public, signed-in, the *paid* account, the open menu panel, and the five rules axe skips as `experimental`. What remains is in H5 and is small. |
| CSP verification ("→ Layer H") | **DONE in G7**, enforcing since 2026-08-23, `check:csp` on every push. |
| 320px header overflow | **FIXED** (5A-154/159). Re-measured: all eight public pages give `scrollX = 0` at **both** 375px and 320px. |

### 2b. True, but the recorded number is wrong

| Item | Recorded | Measured |
|---|---|---|
| Signed-in 375px overflow | "~130px, the sidebar" | **34–188px, varying by page**, and the worst page is not the one named |
| `/learn` band rhythm | "~455px tall, ~45% picture, 768–1023px" | Worst case is **1023px**: the illustration **doubles** 291px → **616px** one pixel below the breakpoint, and the picture is **54–69%** of the band across the whole range |
| Learn index rows | "37px" | **36.8px** single-line, **55.7px** wrapped. **5 of 12** under 44px — and 44px is *guidance*; WCAG's actual minimum is 24px, which all twelve clear |
| The three fundamentals | "we store, **score with**, and never show" | Only **two** are scored (`fcfMarginPct` → Cash Flow 15%, `sharesChangeYoyPct` → Shareholder 10%). **`forwardPe` is scored by nothing** — and `roadmap.md` already says so 600 lines earlier, so the document contradicts itself (11av) |

### 2c. True as written

**Error monitoring** — not installed; all six named log lines verified present at the paths the
roadmap gives. **Disclaimer copy review**, **beta testers**, **fix P0/P1 from beta** — owner's.
**iOS 16px input zoom (5A-155)** — live on public *and* signed-in forms, folded into the open
13px decision, owner's.

### 2d. Delete

**"Final design review against reference HTML."** CLAUDE.md **#1** demoted that file from
contract to mock-up: *"the live site is decided with the owner, not derived from the file."* A
review *against* it is the exact activity that rule exists to stop. The owner's **5b** pass
already occupies the slot, and taste is what 5b is for.

---

## 3. New findings from this session — none of these were known

### A 🔴 · The signed-in responsive guard has never measured a page a paying customer sees

`e2e/app-responsive.spec.ts` signs in as the **shared account, which has no subscription**. On
that account the paid sections do not render, so the pages are narrower than the product.

Measured at 375px, production build, same probe, two accounts:

| Route | Free account | **Entitled account** |
|---|---|---|
| `/run` | 46px | **188px** |
| `/stocks/us/AAPL` | 180px | 180px |
| `/stocks` | 131px | 131px |
| `/account` | 55px | 48px |
| `/request` | 34px | 34px |

**`/run` is four times wider than recorded**, because 46px was the *upsell page*, not the
screener. And the width sweep (320 → 1280 in 20px steps, entitled) shows how far up it reaches:

| Route | First width with no sideways scroll |
|---|---|
| `/account` | 440px |
| `/stocks` | 520px |
| `/run` | 580px |
| `/stocks/us/AAPL` | **740px** |

⚠️ **The guard sweeps 640 / 768 / 900 / 1280 and passes.** At **640px and 720px the entitled
ticker page scrolls sideways** — inside the 640–900 band that spec was *written* to guard
(5A-116) — and it passes because the free account renders less. This is 14g again: a guard that
exists, runs, and is structurally incapable of the finding.

⚠️ **The control matters more than the finding.** The free column is what proves *entitlement*
is the variable rather than my method — without it this is just two different numbers.

### B 🔴 · The results table is 158px over at 375px, and was measured as 0

On production, with a real 3-stock run, owner-authorised:

| Width | Sideways scroll |
|---|---|
| 375 | **158px** |
| 414 | **119px** |
| 640 and above | 0 |

Locally it measured **0** — because `/results` with no run history is an empty page. The
production probe **asserts three table rows before measuring**; without that assertion the
clean number would have gone into the plan.

### C 🟡 · Even the free ticker page scrolls at a width nothing samples

Free account, `/stocks/us/AAPL`: **10px at 720px**, while 640, 768, 900 and 1280 all read 0.
720 is in nobody's list. This is 11i-b — *the defect lives at the width nobody picks* — and it
is why H1's guard **sweeps a range** instead of sampling.

### D 🟢 · Safari's engine renders the paid product correctly

Production, entitled account, `/stocks/us/AAPL`, Chromium as the control:

| | Chromium | WebKit |
|---|---|---|
| Canvases painted | 21/21 | **21/21** |
| Recharts SVGs | 18 | **18** |
| Page height | 8238px | **8241px** |
| Rating + Verdict present (control) | yes | **yes** |

And all eight public pages in WebKit: **200, zero console errors, zero page errors, no sideways
scroll at 375px, exactly one `h1`.** The cross-browser item is **smaller than feared.**

### E ✅ · Firefox could not start — CAUSE FOUND AND FIXED

`browserType.launch: spawn UNKNOWN`. Ruled out, in order: the sandbox (fails outside it), the
download (328 MB, complete, `mozglue.dll` present), a forced re-extract (same failure), the
path's spaces (the Windows event log shows the **short, space-free** path failing identically),
and the Visual C++ runtime (2022 x64 installed, all four DLLs present — **this was my first
guess and it was wrong**).

The event log names the real cause: *"Dependent Assembly **mozglue** … could not be found"* — a
Windows side-by-side loader failure binding Firefox's own private assembly.

✅ **RESOLVED 2026-09-14.** The web search gave only the generic *"delete `ms-playwright` and
reinstall"*, which I had already done. The answer came from this project's **own memory**:
the Claude desktop app runs in an MSIX sandbox with a **virtualised AppData**. Confirmed with
one reading —

```
C:\Users\...\AppData\Local\ms-playwright
  Target: C:\Users\...\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\ms-playwright
```

— the folder Playwright keeps its browsers in is **redirected into the app's private
container**. Chromium and WebKit tolerate that; Firefox's loader resolves a private
side-by-side assembly (`mozglue`) against the real path and the redirection breaks the bind.

**The fix is one environment variable**, pointing Playwright at a folder that is not
virtualised:

```
PLAYWRIGHT_BROWSERS_PATH=C:\Users\<user>\playwright-browsers
```

Installed all three there and **all three now launch**, including Firefox. Verified with a
full smoke of the eight public pages on production in **Chromium, Firefox and WebKit**: every
page 200, zero console errors, zero page errors, no sideways scroll at 375px, exactly one
`h1`. ⚠️ Setting that variable means **every** browser must live there — a half-moved install
fails with "Executable doesn't exist", which is how the first attempt failed.

⚠️ **My first diagnosis was wrong and the machine said so.** I blamed a missing Visual C++
runtime; it is installed, all four DLLs present. The Windows event log named the real
dependency. **Ask the machine before theorising** (11i).

### F ✅ · One cross-engine difference around `/api/billing-context` — CLOSED 2026-09-19 (H4)

**Resolved by timing it.** A probe logged every event around the request in both engines: WebKit
fails it at exactly one moment — **17.05s, the instant the test navigated AWAY** with the request
in flight (`Load request cancelled`). A reader who stays on the page gets **200** in both engines
(WebKit 25.55s, Chromium 18.25s), and `UpgradeDialog` already catches the cancelled one. Not a
defect: WebKit reports a navigation-cancelled fetch louder than Chromium does. ⚠️ Said plainly: the
exact *"access control checks"* wording was not reproduced on the re-run — the failure was, at
the navigation. The original record follows.


In WebKit the paid page throws *"Fetch API cannot load /api/billing-context due to access
control checks."* Chromium does not.

What I established, and where I stopped:

- A **direct** fetch of that endpoint from the same page in WebKit returns **`200, ok:true`** —
  the endpoint and the CSP are fine (`connect-src` includes `'self'`).
- Chromium shows the same request as `net::ERR_ABORTED`. **Both engines cancel it**; only
  WebKit surfaces it as a page error.
- `UpgradeDialog` already `.catch()`es it and deliberately does not cache the failure, so the
  next lock retries.

**So the likely reading is a cancelled in-flight request during hydration, which the code
already handles — but I have not proved that, and a plausible mechanism that is genuinely
present is the hardest kind of wrong explanation to catch (14f).** Recorded as a Layer H
investigation, not reported as a defect.

### I 🔴 · The ticker page scrolled sideways in a 26px band nobody had ever sampled

Found by H1's own sweep, on the entitled account, the first time this guard has run at 4px
resolution with a paying session. **768 → 793px, up to 26px of sideways scroll.**

| Window | 763 | 767 | 771 | 775 | 779 | 783 | 787 | 791 | 795 |
|---|---|---|---|---|---|---|---|---|---|
| Sideways scroll | 0 | 0 | **23** | **19** | **15** | **11** | **7** | **3** | 0 |

The overflow falls exactly 1px per pixel of width, which is the tell that a fixed-width thing is
demanding a constant: `.radar-grid` is `grid-template-columns: 340px 1fr` where the second track's
own min-content is ~170px (a 120px label + 10 + bar + 10 + a 28px score), so the scorecard demands
**534px** and will not go below it. Beside the 220px rail the card offers 471px at a 771px window.

⚠️ **Two independent reasons nobody had seen it, and both are this project's own recorded
lessons.** The collapse rule is `@media (max-width: 640px)` — **written against the window when
the constraint is the container**, which is audit 5A-116 verbatim. And the scorecard is
**premium**, so the responsive guard, signed in as the free account, *never rendered the element
at all* — 11bd, found by the first sweep that used a paying session. The old guard sampled 768 and
900; the tablet survey sampled 744, 768, 810. **The defect sat between every sample ever taken.**

⚠️ **This is a change to a paid surface beyond the approved design, so it was put to the owner
rather than folded in** — and that was the right call twice over, because **my first fix was
wrong and the owner caught it from a screenshot.**

Attempt 1 let the chart column shrink (`minmax(0, 340px)`). It removed the horizontal scroll and
**destroyed the section**: at a 780px window the bars track collapsed to a **1px sliver** — the one
thing those five rows exist to show — and the chart clipped its own axis label to *"Balance Shee"*.
⚠️ **Both states measure `scrollX === 0`.** The sweep passed. The entitled session passed. The 4px
steps passed. **A layout that FITS is not a layout that WORKS**, and no overflow guard can see the
difference; a person looking at a picture can, immediately.

The shipped fix keeps the honest `340px` chart and **stacks** the bars underneath — which is what
the grid already did on a phone — via a **container query on the card** rather than a media query
on the window: `@container (max-width: 680px)`. ⚠️ **680 is the bars' minimum, not a round number.**
The container leaves the bar `C − 568`, so the owner was shown the thinnest side-by-side each
candidate would ever allow (640 → 72px, 680 → 112px, 720 → 152px) and chose **680 / 112px**.
Guarded three ways: the sweep fails if the page scrolls, one assertion fails if the chart stops
being 340px at 1280px, and a third fails if a bar is ever thinner than 100px while side-by-side.

### J 🟡 · The local production build cannot measure the ticker page at all

`next start` does not serve the Vercel Python function at `/api/cycle`, so on `localhost:3200`
the ticker page renders **no cycle block**: measured `hasCycle: false`, `radarRows: 0`,
`verdictThesis: 0`, against a full render on the dev server. That is **11v**, and it means finding
A's Stock Detail figures — and the 375px column in `design-system.md` §10 — are floors rather than
measurements. It is also why finding I was invisible on `:3200` and obvious on `:3100`: the local
production build has no radar to overflow.

⚠️ **The two instruments disagreed and the disagreement was the finding.** `:3200` said the ticker
page was clean from 336px; `:3100` said it scrolled 23px at 771. The temptation is to trust the
production build because it is the production build. The right question was *which of them is
rendering the page a customer sees* — and the answer was neither fully, but only one of them was
rendering the paid half.

### K 🟡 · The page gutter is written twice, and narrowing one broke the other

The first draft of the shell set `<main>` to `p-4` below 768px to buy 14px of content width. The
Stock Detail sub-nav is `sticky … -mx-6 px-6`: it bleeds 21px each side to reach the edges of
`main`'s padding, so with a 14px gutter it hung **7px past both edges at every width from 320 to
760** — a constant, on every measurement. 21 − 14 = 7. The sub-nav holds a second copy of the page
gutter (11c-v). `<main>` keeps `p-6` at every width; recorded rather than refactored, because the
sub-nav is on a paid surface and `p-6` costs nothing measurable.

### L 🔴 · The visual pass found three more "fits but does not work" defects

The owner asked for the phone layout to be **looked at**, on the strength of the
scorecard. That was the right instinct: three more of the same class were there, and
every one of them measured **zero horizontal scroll**.

| What | Where | What a reader saw |
|---|---|---|
| The Verdict card printed **two texts on top of each other** | `.verdict-watermark` is pinned top-right; on a phone the eyebrow runs the full card width and slides under it | "MAJORCYCLE VERDICT · AAPL" with the brand watermark across it |
| A line containing **nothing but a dot** | `<span> · {sector}</span>` allows a break on BOTH sides of the separator | `Apple Inc.` / `·` / `Technology` — three lines |
| The Technical Levels pills **clipped**, then overflowed | `repeat(3, 1fr)` cannot go below min-content: 3 pills demand 295px | 360px: third pill cut by 15px. 320px: 55px, and the page scrolls |

⚠️ **The third one rewrites a "known and accepted" row.** Layer H recorded *"at 320px the
screener stays ~23px over"*. Measured, that 23px was **one native `<select>`** sized to its
longest option ("Diversified Telecommunication Services") at a fixed 303px with no
`max-width`. One clamp closed it. And the ticker page's remaining 15px was these pills.
**The signed-in product is now clean from 320px, not 355px** — so the sweep's floor
dropped to 320 and the margin at our 375px promise is **55px**, not the 20 we set out to buy.

⚠️ **Two mistakes of mine inside these fixes, both caught only by looking again.**
The watermark fix **did not work the first time**: I put the `@container` block ABOVE
`.verdict-watermark`, and that rule ends in `display: flex` — equal specificity, so source
order won and my `display: none` was silently overruled (11bc). And the *guard* for it was
wrong too, reading the eyebrow's BOX — a flex column spanning the whole card — rather than
its ink, which reported a phantom 95px overlap at 600px. It measures the text now and
carries a sabotage step that forces the watermark back on and asserts the probe sees the
collision.

⚠️ **And note where a container query was right and where a media query was.** The
scorecard needed a container query because its problem lives at **768–793px**, where the
220px rail breaks any relationship between window and card. The pills could take a media
query because their problem lives **below 768**, where there is no rail and the card is
exactly `window − 78`. Same lesson, opposite conclusion, because the band is different.

### M 🟡 · Two geometry probes said "zero offenders" while the page scrolled 15px

Finding L's third defect could not be located by inspection. An "which element overflows"
probe returned **zero**; widening it to unclipped *content* overflow also returned zero.
That is CLAUDE.md **11ab** exactly, and it is the second time this project has hit it
(audit 5A-116 was the first).

**What worked was the experiment**: hide each block under `<main>` in turn and watch
`scrollWidth` fall back to the viewport. It named the Technical Levels card in one run,
after two probes had agreed the page was clean. **When two measurements of a layout
disagree with what the page does, stop reading geometry and change one thing.**

### N ✅ · The five-question sweep — H1 review pass, 2026-09-16

The owner asked for the whole product to be checked "for each and every edge case so
that nothing gets overflown, looks squished etc". Finding L had already shown that an
overflow sweep answers one question and a page has more than one way to be wrong, so
this pass asked **five** at every width — does the document scroll, is text CLIPPED with
no way to reach it, do two pieces of INK sit on each other, is an element CRUSHED below
its own content, is a control too small to hit — in three viewer states (signed out,
free, paying), across 320 → 1280 — and a second pass to 2560 and into the states.

**Horizontal scroll: zero. Every route, every width, every state.** H1 holds.

The other four questions found **six** defects, every one of which measures `scrollX === 0`:

| # | Where | What a reader sees | Band | Status |
|---|---|---|---|---|
| N1 | `/articles` figure | the two axis captions read `wholeleargest 60` | ≤ 356px | ✅ fixed |
| N2 | Valuation History | `Avg 32.1x` and `Current 38.2x` printed on each other | **every width, incl. 1280** | ✅ fixed |
| N3 | Opportunity Map | the legend chip `Neutral` printed inside the plot | ≤ 340px (≤ ~490 with 5 tiers) | ✅ fixed |
| N3b | Opportunity Map | the four zone names stay in their quadrants while they FIT, and move to a legend below when they do not | narrow only | ✅ owner's design call |
| N4 | Opportunity Map | `Weak & expensiveHealthy, fully priced` | ≤ 340px | ✅ fixed |
| N5 | Analyst Target Track | `Consensus` printed over a Bear/Bull price | 320–800px, **1.8% of stocks** | ✅ fixed |
| N6 | Scorecard radar | `Balance S` / `areholder` — the axis labels cut off | ≤ ~385px | ✅ fixed (twice — see below) |

⚠️ **N2 and N5 are DATA defects wearing a layout, and that is why they survived.** The
valuation labels only collide when a stock's current P/E sits near its own average —
AAPL yes, T no — and the target-track labels only when the consensus target sits near an
end of the analyst range: **15 of 837 stocks (1.8%)** at 375px, **2 still at 1280px**.
Open the wrong stock and both cards are flawless. When a collision is possible, ask the
DATA how often it happens; the number is what decides whether it matters.

#### The states a page sweep cannot reach

Every sweep above measures a page AT REST, and a state nobody triggers reports exactly what
a healthy one reports. So a second pass drove the states themselves — **34 more
measurements, all clean**:

| State | Widths | Result |
|---|---|---|
| the navigation drawer, OPEN | 320 / 360 / 375 / 414 / 640 / 767 | clean |
| a LANDSCAPE phone (short, not narrow) | 667x375, 740x360, 896x414 | clean |
| wider than anything else has sampled | 1440 / 1920 / 2560 | clean |
| the paywall dialog, OPEN, on a free account | 320 / 375 / 768 | clean |
| the first-login gate, which renders ALONE | 320 / 375 / 768 / 1280 | clean |

⚠️ **Two of the probe's own controls were wrong here, in opposite directions, and both would
have produced a confident report.** (i) Measuring a page WITH a modal open compares the modal
against the page behind it, so a drawer that covers the page — which is its job — scored an
overlap for every row. The rule is to measure the **top layer** alone, and specifically NOT
"skip `aria-hidden`", which would also skip the Verdict watermark that was a real defect when
it printed over its own heading. (ii) The render floor discarded all four first-login rows as
"did not render" because that gate returns the modal and **nothing else** — 58 elements is
correct for it. A control that throws away real rows is as damaging as one that passes bad
ones; it just fails quietly. ⚠️ And the dialog count used `getByRole('dialog')`, which matches
a dialog that is **closing** — so it reported `dialogs=1` for a dialog nobody could see. **A
count used to establish a state has to establish that state.**

⚠️ **`/results` had never been tested at all.** It renders nothing until a screen
completes, so every sweep that has visited it measured an empty page and reported it
clean — the same false-clean as auditing a paid surface on a free account (11bd). N3 and
N4 were found only after driving a real Magnificent Seven run, and
`e2e/opportunity-map.spec.ts` now does that in the suite.

⚠️ **Two of the existing guards were SAMPLING.** `/articles`' own overlap test took 375,
768 and 1280; the caption gap closes at exactly 1px per pixel of width, so the failure
lives strictly below the lowest sample — and that sample is now 55px above this
product's floor. It sweeps 320 → 1280 in 8px steps now.

⚠️ **The probe needed seven corrections, each caught by a positive control before any
result was believed.** Both directions cost: a flat render floor counting only VISIBLE
elements discarded ten real rows on the free upsell page (the rail is `display:none`
there, 47 elements); unioning a wrapping inline's line boxes invented 24 overlaps on
`/articles`; blaming the nearest ancestor clipping in either axis pinned 66 scrollable
table cells on `<body>`; an 18%-of-area threshold **hid a real one**; and a `Range`
reports a clipped text node's full width, so every `text-overflow: ellipsis` read as an
overlap until the ink was intersected with its own clip box. Full account: CLAUDE.md
**11bh**.

#### N3b and N6 — the owner reviewed the chart fixes, twice, and was right both times

⚠️ **THIS IS THE SECOND AND THIRD TIME A SCORECARD-AREA FIX PASSED EVERY CHECK AND LOST TO A
SCREENSHOT** (11bf was the first). Both rounds are worth keeping, because the first round's
fixes were *defensible* and still wrong.

**Round one.** The Opportunity Map's zone labels were made to WRAP so they stopped colliding;
the radar's labels were allowed to spill into the card's padding. Measured, both "worked".
The owner's reply: the radar label was *"overflowing outside the container"* — which it was,
by 5px, because I had measured against the chart box and the reader sees the CARD.

**Round two — the owner specified the behaviour, not just the defect:**

> *"For the opportunity map, I don't want you to change the desktop version. Keep it as is.
> When the screen size becomes small and the text is overlapping / away from its own quadrant
> only at that time I want the legend. Also, you don't need to write what the zone means."*
>
> *"For the stock score card, I don't want you to move 'Sheet' into the new line for Balance
> Sheet. Maybe slightly reduce the size of the radar chart to fit it on the screen."*

Both are now measurements rather than breakpoints, and both use a **canvas** to measure the
real advance width of the real string in the real font (`lib/textWidth.ts`), because an
estimate of `chars x fontSize x coefficient` had already shipped **"hareholder"** on screen.

| | Wide | Narrow |
|---|---|---|
| Opportunity Map | names INSIDE their quadrants, no legend — desktop byte-identical to before | names move to a **centred** legend under the chart, swatch + name only, matching the tier legend above it |
| Scorecard radar | `outerRadius` unchanged at 52%, desktop untouched | the RING shrinks so every label stays on one line — **while that is still worth doing** |

⚠️ **AND THE THIRD REJECTION IS THE ONE THE FINAL SHAPE IS BUILT AROUND.** Shrinking the ring
until the words fit is arithmetically correct at every width and visually wrong below a point:
at 320px it produced a **65px ring beside 10.5px labels**, and the owner's read was that *"the
radar chart is very small compared to the text"*. So the ring shrinks only while it stays
worth labelling (`MIN_LABELLED_RADIUS_PX`), and below that the labels stand down and the ring
goes back to **full size** — a proper radar with the pillars named in the bars beneath beats a
miniature one with its own labels. Measured:

| width | ring | labels |
|---|---|---|
| 320 | 101px | bars name them |
| 340 | 111px | bars name them |
| 350 | 92px | all five |
| 360 | 102px | all five |
| 370+ | 111px | all five, desktop untouched |

⚠️ **The state to make impossible is the THIRD one** — a shrunken ring that is *also* labelled.
The guard is shaped around that rather than around "nothing is cut", because "nothing is cut"
was true of every rejected version.

⚠️ **The radar's floor had to come DOWN to make the margin real.** At `MIN_RADIUS_PX = 34` the
floor was binding at 320px — the ring stopped shrinking before the label fit, and the 2px of
clearance that resulted was an accident of the measurement being a shade generous. Rename a
pillar one character longer and it overflows again. At 28 the formula governs at every width
the product supports, so the clearance is constructed rather than lucky.

⚠️ **And a 4px edge pad is the difference between a bound and a boundary.** Sizing the ring so
the label ENDS at the box edge measured the ink 1px OUTSIDE it — and the wrap clips, so the
last stroke of "Balance Sheet" was being shaved. This repo has been caught by a guard passing
with 1.1px to spare before (11i-b).

⚠️ **Wrong turns, all found by measuring:** a negative margin computed as `-12px` and widened
nothing, because `.chart-canvas-wrap` sets `width: 100%`; giving the stacked radar the card's
padding then made `.radar-grid` overflow its own card by 12px at every width — the exact shape
another guard exists to catch, so it was reverted rather than have that guard loosened; the
fit decision was first computed from each tick's OWN room, so the top label stayed while the
sides vanished (**1 label at 320px, 3 at 360, 5 at 414**); and the first legend went INSIDE
`.opp-map-wrap`, a fixed-height box, collapsing the plot to a strip with every label perfectly
placed.

**The original N6 note stands, because three fixes were RENDERED and looked at before one was
chosen** (11bf: when a fix has a size in it, look at the picture rather than the number).
The radar's labels live outside its ring, in a margin that shrinks with the box while
"Balance Sheet" stays 77px; `.chart-canvas-wrap`'s `overflow: hidden` then cut the words.
`layer-c-audit.md` had recorded this at 375px and expected H1's extra width to close it —
H1 closed 360px and above and left the floor open.

| Candidate | Rendered at 320px | Verdict |
|---|---|---|
| shrink the ring to fit | visibly small AND **"Balance Shee" still cut** at 34% | rejected — it does not even work, and the owner reversed a shrink once already |
| drop the labels below the width they fit | full-size chart, an **unnamed five-sided shape** | rejected |
| let the labels use the card's own padding | full size, every word whole, widest label ends 5px past the card's inner edge, **`scrollWidth` 320 in a 320px viewport** | ✅ shipped |

Scoped to `.chart-h-radar` and unconditional: above ~390px the overhang is zero, so there is
nothing for `visible` to do and no breakpoint to get wrong. Every other chart keeps its
clipping. Guarded by *"every scorecard radar label is whole, at every phone width"*, which
reverts to naming all six cut labels and widths when the rule is removed.

### G 🟢 · Fixing the sidebar fixes something else for free

`layer-c-audit.md` records that the scorecard radar's outward labels are clipped at 375px
*"by the pre-existing 220px fixed sidebar … once Layer H gives the radar real width (~343px)
the labels fit."* H1 closes that with no extra work.

### H ⚠️ · The arithmetic says H1 works at 375px — with a thin margin, and NOT at 320px

Each page's content needs a minimum width; `scrollWidth − 220px sidebar` estimates it:

| Route | Content needs (est.) | Available at 375px once the sidebar is a drawer | Spare |
|---|---|---|---|
| `/account` | ~203px | 375px | 172px |
| `/stocks` | ~286px | 375px | 89px |
| `/results` | ~313px | 375px | 62px |
| `/stocks/us/AAPL` | ~335px | 375px | 40px |
| `/run` | ~343px | 375px | **32px** |

**An estimate, not a measurement** — tables reflow as width changes, so this is verified *after*
the fix, not trusted before it. Two things follow. The tightest page has **32px spare**, so the
guard asserts a **margin, not a boundary** (11i-b: `>= 0` scores a 1.1px accident as a pass).
And at **320px the screener would still be ~23px over** — below our stated 375px floor, so not
a broken promise, but it should be written down rather than discovered.

---

## 4. Order of work

The rule: **anything that changes the layout comes before anything that measures the layout.**

Every UI step has a **design gate** — I show the design, the owner approves, *then* I build.

### H1 · The signed-in shell below 768px 🔴 FIRST
The only item breaking a non-negotiable (#3), it touches every signed-in page, and every other
signed-in measurement is taken on top of it.

⚠️ **Scope narrowed on 2026-09-14 and is now smaller than first planned**: phones only, not
phones *and* tablets. Every iPad from the 9.7″ up keeps the layout it has today. §11.

| Step | What |
|---|---|
| H1.1 | ✅ **DESIGN GATE — APPROVED by the owner, 2026-09-14**: https://claude.ai/code/artifact/051c7763-0eaa-4d39-846e-b425e356ebdb — the shell at 1280 / 768 / 375 closed / 375 open, drawn to real proportions; what changes in `Sidebar`, `Header`, `UserMenu` and the brand lockup; the six drawer behaviours; the measured tablet answer (§11). Owner: *"1. Yes … 3. No changes required."* |
| H1.2 | ✅ **BUILT.** `components/AppShell.tsx` owns the shell; `Sidebar` splits into `SidebarBody` (one nav, two presentations) + the pinned rail; the drawer is a Radix dialog with a real `DialogTrigger`, so Escape returns focus to the button rather than to `<body>` (5A-112). `Header` and `<main>` drop the 220px offset below 768px. At 768 and above **nothing changes at all** — asserted, not assumed. |
| H1.3 | ✅ **RE-MEASURED**, and it found three things the plan did not have — §3 findings I, J, K. |
| H1.4 | ✅ **WIDENED.** `app-responsive.spec.ts` now sweeps **355 → 1280 in 4px steps** on a **throwaway entitled account** as well as the free one, 12 tests, one per account × route. The margin is expressed as a width rather than as arithmetic: a page that fits at **355px** has 20px spare at our 375px floor. `/results` is **seeded** and its row count asserted before anything is measured. Plus `app-shell-drawer.spec.ts` for the six approved drawer behaviours. |
| H1.5 | ✅ **DONE.** `app-a11y.spec.ts` gains a **375px** scan of `/stocks` — closed AND with the **drawer open**, because axe walks only what is rendered and a closed control is outside every scan we own (11ax). It carries a control asserting the drawer really opened, so a click that silently did nothing cannot report as coverage. Both scans clean. ⚠️ **Which half this covers, said rather than implied (14g):** the drawer reuses the rail's own rows and tokens, already measured at desktop by `app-contrast.spec.ts`, and axe's `color-contrast` runs here too — so the new surface is covered, but this is NOT a full contrast sweep at phone width. ⚠️ Two prerequisites were latent defects, both fixed: `contrastProbe.ts` AND `app-a11y.spec.ts` each held their own copy of the "is the stylesheet live?" sentinel, reading `main`'s LEFT margin — which H1 makes legitimately `0` on a phone. The first phone-width scan would have hung 30s and failed on a perfectly styled page. Two consumers, one rule, written twice (11c-iv). |

⚠️ Reuse the public header's `MenuButton` pattern (Escape returns focus to the toggle, the
panel closes on navigation, 40px rows) rather than writing a second one — 11c.

### H2 · Error monitoring ✅ BUILT 2026-09-16 — see §12
No UI dependency. Second by **value**: a duplicate subscription is cancelled but **not
refunded**, and nobody is told. It must be watching **before** beta testers arrive, or the beta
is what discovers it.

Scope was the full install (owner's decision 2), with the six named log lines as the first
alerts, plus the `CYCLE_INTERNAL_SECRET` breadcrumb. **Delivered wider than that** — every
operational failure in `app/` and `lib/` now reports, not six of them — because the alternative
was a guard that could only be a hand-written list of six, and a hand-written list is this
repo's most-cited blind spot. §12 has the account.

### H3 · `/learn` bands + row heights ✅ BUILT 2026-09-18
Cheap, public, isolated. **Design gate** — the band fix changes how `/learn` looks on a tablet.

**Re-measured before building, and both findings held exactly:** picture 53.5–68.8% of the band
across 768–1023 (448px → 607px tall), five rows at 36.8px at 375px. Two options were mocked up
on the live preview and measured; **the owner chose side by side** — the band goes two-column at
`md:` (768) instead of `lg:` (1024), the same line H1 drew for the shell — then lowered to 600px,
below. Result, swept: pictures
209–301px, bands 280–475px, zero sideways scroll, nothing clipped; the other option (a 420px
picture kept on top) met the 50% bound but left an empty half-row on wider tablets.

⚠️ **The plan's own measurement stopped making sense once the fix was chosen**, and is replaced
rather than bent: `img / band ≤ 50%` is only meaningful while the picture is ABOVE the text. Side
by side, a short topic's band IS the picture's height (75% at 768px) and nothing is wrong. The guard
now asserts the purpose — the heading starts level with its picture, the picture is ≤320px tall —
swept across the side-by-side range, with a control that below it the band still stacks picture-first
(the range moved from 768 to 600 the same day — see below).

Rows: `py-[13px] lg:py-[9px]` → 44.8px on touch widths, desktop density unchanged (control
asserts <40px at 1280, and 1280 was compared to production: equal within 0.2px). Asserted for a
one-line AND a wrapping title. Four deliberate breaks, four reds.

**Then moved from 768 to 600px (owner, same day).** A phone held sideways in 600–767 still
stacked, and on an iPhone SE (667 × 375) the picture was ~390px tall — taller than the screen.
Most phones held sideways are ≥768 and already switched, so a rotation already changes the layout
for most readers; the change makes every phone held sideways behave alike. No phone is 600px wide
upright, and 600 is the public header's existing breakpoint. Measured at 600px: picture 150px, text
column 254px (a 320px phone gets 245), zero scroll, nothing clipped, rows 45px. The guard sweeps
600 → 1023 and its control is 599px stacked; reverting to `md:` goes red at 600px.

**Audit, 2026-09-18 (before merge).** Swept `/learn` at **every pixel** from 320 to 1440: zero
sideways scroll, no clipped text, no picture over its heading, nothing escaping its band, text
column never under 241px, rows ≥ 44.8px below 1024 and 36.8px above. Screenshotted at 375 × 812,
667 × 375 (sideways), 600, 768 × 1024, 1024 × 768 and 1280 — all as intended. One gap closed: the
17px sweep stopped at 1008 and never measured **1023**, where the picture is tallest (305px of the
320 allowed), so 1023 is now asserted explicitly. Known and accepted: a **568 × 320** phone held
sideways (iPhone 5/SE 1st gen) is below 600 and still stacks, with a 307px picture. The line
*could* drop to 568 — no phone is that wide held upright — but every phone that narrow is about ten
years old, and 600 is the public header's existing breakpoint; not worth a second line for it. From 600 to ~800px a short picture beside a long article list leaves empty space under
the picture — the trade the owner accepted when choosing side by side.

### H4 · Cross-browser ✅ BUILT 2026-09-19
Whole site, **Chromium + Firefox + WebKit** (all three now run — finding E), **local command
only**, printed as NOT RUN by `pnpm gates`. Includes closing finding F — ✅ closed, §3.

**The command:** `pnpm e2e:browsers` (`web/scripts/e2e-browsers.mjs`). Each engine is its own
Playwright run with its own dev server, **sequentially** (three at once would put three writers
on the shared E2E account and make flake look like an engine difference). It prints one row per
engine and refuses "clean" unless every engine ran the **same number** of tests with no failures.
Proven: pointed at an empty browsers folder it reports `NOT CLEAN: firefox: 10 failed` and exits 1.
`playwright.config.ts` declares the two extra engines only when that command asks
(`MC_ALL_BROWSERS=1`), so CI's bare `playwright test` stays Chromium. ~1.5 h for all three.

| Run | Chromium | Firefox | WebKit |
|---|---|---|---|
| First (as found) | 866 passed · 3 flaky | 845 · **5 failed · 17 not run** | 798 · **32 failed** · 25 flaky |
| Final | green inside `pnpm gates` (16/16; count not printed there) · 873 · 0 flaky in the run before the last three tests were added | **876 passed · 0 flaky** | **876 · 0 failed** (1 flaky, fixed and re-proven) |

**ONE REAL DEFECT, and it was in every engine.** Every signed-in WebKit test failed at sign-in
because WebKit's dev server hydrates slowly enough that Playwright typed into the form before React
owned it. Measured on the live `/login`, that gap is **0.07s on wifi, ~0.5s on 4G, ~2.9s on slow
4G, ~6s on 3G**, and inside it a press **reloaded the page** (native submit) while early typing was
**replaced by React's empty state** — sign-in sent an empty email and cleared the boxes in front of
the reader. Reproduced in all three engines with the scripts delayed: WebKit had only landed in a
window everyone has. **Owner: fix all seven forms, one mechanism** (`lib/useHydrated.ts`): the
submit button is disabled until React owns the page, and each box's ref adopts whatever was typed
before that. Guarded by `e2e/auth-early-input.spec.ts` (sign-in, sign-up, forgot password, and
`/account`), which delays the scripts and intercepts the auth request rather than sending it;
**both halves broken on purpose, both red**. The set-new-password page carries the fix but is not
driven — it renders only inside a recovery session.

**Everything else was the TESTS, and each fix keeps its assertion:**
- *"Words run together"* on five `/learn` articles in WebKit — `innerText` joins a chart's
  absolutely positioned labels differently per engine ("-40%19 months"). The DOM was byte-identical
  and the prose clean. Prose is now read with figures set aside and each label read on its own, so a
  real "19months" is still caught in every engine (broken on purpose: red in Chromium and WebKit).
- **Safari does not focus a clicked button**, and the dialogs restore whatever was focused before
  they opened — so a Safari *mouse* user correctly gets the page back. The focus tests now open
  menus and dialogs the way a *keyboard* reader does (focus, Enter); red in both engines when the
  hand-back is removed.
- **This build of WebKit cannot Tab to a link at all** — not with Tab, not with Option+Tab, while
  `link.focus()` works. That is Safari's "Tab to links" preference, not our menu; there the phone
  menu test moves focus in directly and still asserts the Escape half.
- **Headless Firefox can withhold an animation frame forever**, which hung the ticker page's phone
  sweep past ten minutes on one width. A timed rotation of that page is 0.3–1.3s in Firefox against
  0.65–0.8s in Chromium, so readers are unaffected; frame waits are now capped (`e2e/lib/frames.ts`)
  and the sweep still catches a forced 700px-wide page at every width.
- Firefox and WebKit get longer limits for the long sweeps (~1.7× Chromium per resize here).

⚠️ **Watched, not explained away:** in one WebKit pass the `/report` route answered the dev
server's own HTML 404 twice (not the route's JSON refusal), and both tests pass alone. Consistent
with `.next-dev` losing one route under load (CLAUDE.md 11i-c). It did not recur in the final run.

**Audit, 2026-09-19 — two gaps in the seven-form fix, both in `ProfileForm`, both closed.**
(i) Its Save button kept `!dirty` as its only guard, on the reasoning that an untouched form is
never dirty. **A form with a suggested country is dirty in the server HTML** — and on the live
site that is every new reader, because Vercel's edge header is always set — so Save was pressable
before the page was ready: the exact defect H4 fixed on the other six. The browser test could not
see it because the E2E account has a saved country (11bd again: *who* the guard signs in as).
(ii) The fix itself introduced a regression. `profiles.country` can hold a code the dropdown has no
option for (checkout saves the edge country as-is; `XK` is not in `COUNTRIES`); the browser then
shows "Select your country…" and reads `''`, and adopting that blank would light Save on an
untouched page and **erase the saved country** on the next save. `adoptEarlyInput` now leaves a
dropdown alone when no option carries the state's value. Guarded in `auth-early-input.spec.ts` by a
**derived** source check — every component that submits in the browser must hold its button on
`useHydrated`, including the next one written — and a driven test of the dropdown rule with three
controls. **Both red when their fix is removed.** The other five forms on the site (contact,
reactivate, delete account, sign-out, billing portal) post to a server `action=` and work before
the page is ready by design.

### H5 · Accessibility residue ✅ BUILT 2026-09-20
Focus visibility at 375px; signed-in scans at phone width.

**What now runs, on every push (Chromium, inside `pnpm gates`):**
- **Every control a keyboard reaches shows its focus at 3:1** at 375px — all 29 public pages
  (derived from the registries), the open phone menu, all six signed-in pages, the open app drawer,
  and the three paid pages on a throwaway entitled account. `e2e/lib/focusRing.ts` Tabs through the
  page and reads each indicator **only once it has stopped animating** (11ao): an outline, a
  `box-shadow` ring, a border that changes on focus, or the same on the wrapper around it.
  Measured: the site's ring is `--brand-bright` at **3.99–4.03:1**; the pricing toggle 3.79.
- **axe at 375px on every signed-in page**, free and paid — until now only `/stocks` was.

**Two real defects, both invisible at desktop width, both fixed — and one blind spot in the probe:**
1. **The Top Institutional Holders table** scrolls sideways below ~380px and held nothing a keyboard
   could land on, so its Shares column was unreachable (axe `scrollable-region-focusable`). The
   wrapper is now a labelled, focusable region. An extra Tab stop at every width; nothing visible.
2. **Every phone result card on `/results`** (paid) was a button with the rating badge — a second
   button — inside it (`nested-interactive`, 6 nodes). Now a transparent "open" button covers the
   card and the badge is its raised sibling. **All six cards byte-identical** in before/after
   screenshots; the badge still filters and the card still opens.
3. *(Not a defect — my probe's.)* The search boxes on `/stocks` and `/request` scored "no
   indicator": their focus is the WRAPPER's border (`:focus-within` → brand blue, 4:1), and the probe
   only read the input. It now reads the two nearest ancestors for what CHANGED on focus — never a
   permanent border — and removing that `:focus-within` rule turns `/request` red.

**Audit, same day — a fourth defect, and it was at EVERY width.** A ring can pass on colour and
still be cut off: the site-wide ring sits 2px *outside* the element, and three containers are
`overflow: hidden` — the chart wrapper and the two segmented toggles. So on Stock Detail a keyboard
reader tabbing onto any of **six charts** (Recharts makes each a focusable `role="application"`;
arrow keys walk the data) saw the ring clipped on all four sides, and on **Drawdown/Profit** and
**Quarterly/Annual** on three: focus vanished. Nothing measured on colour could see it. The probe
now counts the sides of the ring band a clipping ancestor cuts and fails at three or more; the
ring is drawn *inside* the edge in those three containers, white on the one solid-blue button.
**Red on all ten controls with the CSS removed, green with it**; a 1280px walk of Stock Detail was
added because the defect was never a phone rule. The audit also made the walk **fail** if it runs
out of Tabs rather than return a partial page, and fail when focus lands on something with no size.
Focus walks are skipped in **WebKit only** (it cannot Tab to links — H4); its axe scans still run.

**Firefox, same day.** The new "never came back round" check failed every Firefox walk at once, and
it was right to: Next's dev-only error overlay sits last in `<body>`, and Firefox Tabs through the
parts inside it one by one, so a walk that returned what it had would have looked complete. The
overlay now counts as the end of the page, and "focus left the page" is accepted only when **no
tabbable control follows the last one read**. Two Firefox findings followed:
- **The Key Metrics scroller** is a Tab stop in Firefox (it makes every scrolling box one) and its
  ring was clipped on three sides by the card body — the same fix, drawn inside the edge.
- **"Continue with Google" reported focus on a zero-size element.** Google's widget focuses a 0×0
  overlay and draws its ring inside its own cross-origin iframe, which no script of ours can read.
  ⚠️ **I misread this first.** An early screenshot showed no ring, I called it a defect and added a
  ring of our own; re-checked with our CSS removed, Google's ring (`rgb(0,99,155)`) is there from
  100ms, so mine only doubled it and was **reverted**. The probe now exempts that one element **by
  Google's exact label**, so an invisible focus stop of ours still fails.

**Controls:** a header link with its ring removed is caught — exactly one failure, naming it; the
search-wrapper rule red when its CSS is removed; each walk must reach ≥3 controls, the menu and drawer
walks must reach their own links, and the paid walk must see the Verdict thesis first.
⚠️ The first control run failed with TWO failures, not one: the CSS selector matched two logos. The
probe was right and the control ambiguous; it now marks one element by hand.

### H6 · Owner items 🔵 — any time
The 13px/16px decision; disclaimer copy; beta.

### H6a · The twelve new Key Metrics rows 🟡 — fully specified, §10
All decisions taken. Independent of H1, but H1 first: the table is on a paid page and the
shell fix changes how that page lays out on a phone.

---

## 5. How each one is proven

Every check has a **control** — the thing that proves it can fail (11p).

| # | Measurement | Control |
|---|---|---|
| H1 | `scrollX` after `scrollTo(99999,0)` is **0** on all six routes, **entitled and free**, swept 320 → 1280 in 4px steps; and the tightest page keeps **≥ 20px spare**, not merely ≥ 0 | Restore the offset on one route → the sweep goes red **and names the width**. Plus: a 1280px check that the sidebar is still *there* — a layout that hides it everywhere passes every overflow assertion |
| H2 | Each of the six log paths **driven**, and the event **arrives in the Sentry inbox**. Billing paths via a **Stripe test clock** | A deliberate test error must arrive; and a run with the DSN removed must produce **nothing**, so "it arrived" is about our wiring, not someone's default |
| H3a | ~~Picture share ≤ 50% of the band~~ — **replaced when side-by-side was chosen** (the ratio only means something while the picture is above the text). Now: from **600px** the heading starts within 60px of its picture's top and the picture is ≤ **320px**, swept 600 → 1023 in 17px steps plus 1023 itself; separately swept at **1px** from 320 → 1440 during the audit, clean | Below 600px (599) the band must still **stack picture-first**, and 1280 must be **unchanged** — "side by side everywhere" passes the sweep and crushes a phone's text column |
| H3b | Every article link ≥ **44px** at 375px | Assert the **wrapping** titles by name — fixing only the single-line rows would read as a pass |
| H4 ✅ | Whole suite in Chromium + **Firefox** + WebKit; the runner prints a **per-engine count** | Three totals, never one — an engine that failed to launch reports as "no failures" (and today Firefox would) |
| H5 ✅ | Focus indicator ≥ **3:1** against its own ground at 375px, **polled until the computed value stops changing** | 11ao: two sessions read this at t≈0 and got white. A control with its outline removed must be caught |
| H6 | Owner's judgement | — |

---

## 6. What Layer H still cannot check — much shorter than before

| Cannot check | Why | Instead |
|---|---|---|
| **A real iPhone or Android** | No device; no emulator reproduces iOS Safari's zoom | Assert the computed font size, never the zoom. Say "spot check" |
| **That Sentry catches a real incident** | The only proof is an incident | Drive each path; test clock for billing. Say "the path is wired" |
| **Decision #33 / Lighthouse** | No trustworthy instrument; Speed Insights needs traffic | Out of scope. Leave the row red (11w) |
| **The paid analysis on my machine** | `/api/cycle` is a Python function `next start` does not serve | Production or deployed preview — which is now a proven route, not a theory |
| **Whether it feels right** | Not measurable | **5b, the owner's pass** |

---

## 7. Launch readiness — what is true once Layer H is done

The owner asked that this plan leave the product launch-ready. It does not, on its own, and
saying so is the point.

| Launch-gate row | After Layer H |
|---|---|
| Mobile responsive at 375px | ✅ **Closed by H1**, entitled and free, guarded against regression |
| Error monitoring | ✅ **Closed by H2** |
| Accessibility | ✅ Closed (G + 5a + H5) |
| Cross-browser | ✅ **Chromium + Firefox + WebKit**, all three working (finding E) |
| Lighthouse / #33 | 🔴 **Still red** — blocked on an instrument, not on effort |
| **Vercel Hobby → Pro** | 🔵 **OWNER, launch-day.** Hobby forbids commercial use. **This is the single thing between the product and taking money** |
| Stripe restricted-business question | 🔵 **OWNER**, with Stripe |
| Disclaimer / legal text review | 🔵 **OWNER** — still `BASELINE CONTENT` |
| **5b — the owner's judgement pass** | 🔵 **OWNER** |

**So: Layer H closes every engineering item. Four things remain and all four are the owner's.**

---

## 8. Questions — all answered, none left open

**Q1 · The three fundamentals — surface them?** ✅ **Yes, all three, `forwardPe` included**
(owner, 2026-09-14). Placement in §10; design published.

**Q2 · Firefox** ✅ **Resolved** — finding E. One environment variable.

**Q3 · Tablets losing the permanent sidebar** ✅ **Approved**, with compact-bar alternatives
to be shown at the H1.1 design gate rather than decided now.

**Q4 · Placement, Payout Ratio, report and exports** ✅ **All approved**, 2026-09-14. Payout
Ratio appears in both places; all nine rows go to the page, the report and the exports.

**Q5 · The other six invisible metrics** ✅ **"Add all six"**, 2026-09-14.

**Q6 · Short Interest in the Risk group** ✅ **Yes**, 2026-09-14.

**Nothing in this plan is undecided.** Two items are mine to get right rather than the owner's
to choose, and both are written into §10 so they cannot quietly not happen: the Risk rows carry
**no better/worse verdict**, and the two new category colours must pass `check:tier-palette`
before they ship.

**Next: the H1 sidebar design** — the phone and tablet behaviour of every signed-in page,
shown before anything is built.

---

## 9. Questions I asked myself, because "I reviewed it and it's fine" is not a check

**Could a later step invalidate an earlier one?** Yes — H1 changes the layout the a11y and
contrast suites measured in G. **→ H1.5 re-runs them, inside H1, not after it.**

**Is there an item whose fix could break a paid surface?** Yes, H1 — every signed-in page is
paid or adjacent. **→ design gate first, then the entitled *and* free sweeps, then `pnpm
gates`.**

**Am I about to build a second copy of something?** Nearly — a second menu component.
**→ H1 reuses `MenuButton`'s pattern** (11c).

**What would make H1 look done while it isn't?** A sweep that samples widths (finding C), a
sweep on a free account (finding A), an overflow probe that names elements rather than
scrolling (11ab), or a bound of `>= 0` on a page with 1px spare (finding H). **All four are
written into §5.**

**What is the worst thing that could still ship?** A customer charged twice with nobody told —
**H2**, which is why it is not last.

**Is anything here scope creep?** The three fundamentals are a product addition, not hardening.
**→ moved to a question, not a task.**

**What did I get wrong this session?** Three things, all caught by measuring: I diagnosed
Firefox as a missing Visual C++ runtime (it is installed); I recorded `/results` as 0px when I
had measured an empty page; and my first plan called four things uncheckable that were not.

---

## 10. H6a · The hidden metrics — what they are and where they go

**Design:** https://claude.ai/code/artifact/287083d9-2684-40ad-a982-6142b27ff053 — built with
Apple's real figures and peer medians read from the live database, because a number inside a
design is data with a shelf life (11k).

### It is not tidying — the page already promises two of them

The Health Score's own pillar tooltips, live today, name numbers that appear nowhere:

- **Cash Flow** — *"Factors in Free Cash Flow yield, **FCF margin** and operating cash conversion."*
- **Shareholder** — *"Factors in dividend yield, payout consistency, buybacks and **share-count changes**."*

A reader sent looking by our own copy finds nothing. That is 11c-v — **prose is a copy of a
constant, and this copy is the only place the number exists.**

### Placement

✅ **Placement approved by the owner, 2026-09-14**, with Payout Ratio added to the new group,
and yes to the report and the exports.

| Field | Home | Why |
|---|---|---|
| `forwardPe` | **Valuation**, directly under Trailing P/E | Its sibling. Apple 38.15 trailing / 34.70 forward *says something* adjacent and nothing apart |
| `fcfMarginPct` | **Profitability**, after Net Margin | Makes one progression — gross, operating, net, then cash. It is revenue-relative; FCF *Yield* is price-relative, so they are different questions and belong in different groups |
| `sharesChangeYoyPct` | **A new fifth category, "Shareholder"** | Not a valuation, margin, growth rate or debt measure. `globals.css` already says *"If a fifth category is ever wanted, add a `--cat-*` token and one line above"*, and it makes the table's five groups match the Health Score's five pillars — which is the whole point |
| `payoutRatioPct` | **Shareholder**, above Share Count | The other half of that pillar. Owner's call, 2026-09-14 |

### Payout Ratio appears in BOTH places — ✅ owner confirmed, 2026-09-14

- In **Dividend History** it is not a bare number. It is coloured by sustainability bands and
  deliberately drops to grey when the yield is distressed, because a comfortable-looking payout
  beside a collapsing dividend misleads. Removing it strips the dividend section of the one
  figure that says whether the dividend is affordable.
- In **Key Metrics** it gains the peer comparison Dividend History cannot give it — Apple 12%
  against a market median of 31%.

⚠️ **If it is shown twice it must be ONE cap constant** (`PAYOUT_DISPLAY_CAP = 300`, already in
`lib/dividends.ts`), or the two displays clip differently and we rebuild 11c-iii by hand.

### ❌ Dividend Yield was the obvious fourth row and is deliberately NOT added

`DividendHistory` does **not** render the stored `dividendYieldPct`. It computes its own
trailing yield — last complete year's dividend ÷ today's close — and falls back to the stored
value only when there is no price. So putting the stored figure in Key Metrics prints **two
different dividend yields on one page.**

Measured across 60 dividend payers with a complete year of history:

| | |
|---|---|
| disagree by > 0.25pp | **16 of 60 (27%)** |
| disagree by > 1.00pp | **5 of 60 (8%)** |
| worst | **HLI.AX — 6.08% stored vs 21.29% computed, a 15.21pp gap** |

That is 11c-iii — the Barrick CA$65.76 / 65.76 / 65.75 defect — at fifteen points instead of a
cent. Making them agree means computing the trailing yield for all 866 companies so the peer
median uses the same derivation, which is a pipeline change, not a table row. **Left out.**

### Coverage — measured before proposing, across 866 active companies

| Field | Present | vs a row already on the page |
|---|---|---|
| `shares_change_yoy_pct` | **99.4%** | Trailing P/E: 88.6% |
| `forward_pe` | **98.8%** | PEG: 85.2% |
| `fcf_margin_pct` | **92.3%** | Current Ratio: 95.4% |

**All three are better populated than rows already shipping**, so none arrives as a mostly-blank
row. The controls are what make that statement mean anything.

### ⚠️ Showing a number is also a test of it Share-count change runs −57% to +269% across the
universe — all plausible — **except EMR.AX at +100,384%**, which is not a real share issue. The
table's existing behaviour handles it honestly (`>+100%` with the true figure in the tooltip),
but it is the first time any of these three would be read by a customer.

### Found while working this out: the tooltips overstate the method

Checked against `analytics/scoring/financial_health.py`, the real inputs are Profitability =
ROE + gross/operating/net margin; Balance Sheet = D/E + current ratio + interest coverage;
Growth = revenue + earnings growth; Cash Flow = FCF yield + FCF margin; Shareholder = payout
ratio + share-count change.

So three tooltip claims name inputs that **do not exist**: "operating cash conversion"
(Cash Flow), "dividend yield" and "payout consistency" (Shareholder), "operating leverage"
(Profitability). Balance Sheet and Growth are accurate. **Correct them in the same pass** —
we describe our own method on a page that carries a rating (#12/#24).

⚠️ **And one thing I nearly reported and did not**: I thought Interest Coverage was a fourth
hidden input. It is shown — in the Balance Sheet section and the screener, just not in Key
Metrics. Checking is the only reason that is not in this document as a finding.

### 🔴 It was never three numbers — it is NINE

Answering the owner's *"anything else for the Shareholder group?"* meant sweeping **every**
field on `FundamentalsSnapshot` — read from the type, not hand-listed — against every surface
a customer can reach. The roadmap has said "three fundamentals" since 2026-08-20.

**15 fields are read by no shipped surface. Only 9 of them are numbers a customer cannot see:**

| | Fields | Count |
|---|---|---|
| **Invisible, already known** | `forwardPe`, `fcfMarginPct`, `sharesChangeYoyPct` | 3 |
| **Invisible, newly found** | `priceToBook` (98.6% covered), `priceToSales` (95.8%), `evToRevenue` (97.7%), `quickRatio` (95.4%), `beta` (98.6%), `ebitdaMargin` (91.1%) | 6 |
| Field unused — **concept already on the page** | `week52ChangePct`, `relStrengthVsSp500`, computed from price history instead | 2 |
| Field unused — **number already visible** | `totalRevenue`, `freeCashflow`, `operatingCashflow`, `ebitda`, shown from the statement tables | 4 |

⚠️ **This said ELEVEN until it was recounted on 2026-09-14**, by adding the first three rows to
the last four-but-one. The two "concept already on the page" fields are **not** customer gaps —
counting them as hidden numbers overstates the finding by two, in the direction that flatters
it. **9 is the number.** (11aj: a finding is a measurement with a date on it — including a
finding of mine from an hour earlier.)

**All six newly-found ones are better covered than the PEG ratio we already ship (85.2%)**, and
every one is a metric a retail investor would expect to find.

✅ **Owner: "add all six" and "add short interest to the risk group", 2026-09-14.** Payout Ratio
and Short Interest are *not* part of the 9 — both are already visible elsewhere and are being
added here for the **peer comparison** they cannot get in their own sections.

Final shape — **13 rows → 25, in six groups instead of four**:

| Group | Rows | New |
|---|---|---|
| **Valuation** | 4 → **8** | Forward P/E, Price/Book, Price/Sales, EV/Revenue |
| **Profitability** | 5 → **7** | EBITDA Margin (between Gross and Operating — the order the numbers descend in), FCF Margin |
| **Growth** | 2 | — |
| **Balance Sheet** | 2 → **3** | Quick Ratio, under Current Ratio (the same test with inventory removed) |
| **Shareholder** 🆕 | **2** | Payout Ratio, Share Count change |
| **Risk** 🆕 | **3** | Beta, Short % of Float, Days to Cover |

⚠️ I wrote "12 rows today" twice before counting: `METRICS` holds **13**.
`ShortInterest.tsx` reads the stored values directly, so unlike Dividend Yield there is no
second derivation to contradict.

### 🔴 The Risk rows must carry NO better/worse verdict — a real change to the table

`MetricDef.higherBetter` is a **required boolean**, and every comparison is coloured green or
red with a tooltip reading *"stronger than the typical peer"* / *"weaker than"*. That is right
for a margin and **false for all three Risk rows**:

- A **beta** above the sector median is not weaker — it is more volatile, which is worse for
  one investor and precisely what another wants.
- Our **own Short Interest tooltip** already says elevated short interest *"can also fuel a
  short-squeeze rally"*. Colouring it red would have the page contradict itself two sections
  apart.

So `higherBetter` becomes `boolean | null`, where `null` renders the gap in neutral ink with no
claim attached. Same principle as `e2e/direction-not-rating.spec.ts` (5A-135): **a market fact
is not a verdict.** Decided at design time rather than discovered in code.

### ⚠️ Short interest is a US number — Australia has none

| Field | US | Canada | Australia |
|---|---|---|---|
| `shortPctOfFloat` | **99%** (531/538) | 19% (15/80) | **0%** (0/248) |
| `shortRatio` | **99%** | **100%** | **0%** |
| `beta` | 99% | 100% | **98%** |

**Not a blocker**: `MetricsTable` builds rows with `flatMap` and returns `[]` for a null value,
so a row with no value is **omitted, not blanked**. An Australian stock shows Risk: Beta only;
a US stock shows all three. But the Risk group is three rows in the largest market and one row
in the **owner's home market**, and that is better said now than noticed on a BHP page.

⚠️ **And my first mock-up drew the table wrong** — grouped category header rows. The real table
has a **Category column with a pill on every row** (`km-cat-cell`), six columns: Metric,
Category, Value, vs Industry, vs Sector, vs Market. Rebuilt to match. **The product's source is
the only authority on what the product looks like** (11m).

### Caps for all twelve, derived from the live distribution — never invented

| Field | p99 | max | Cap |
|---|---|---|---|
| `forwardPe` | 90.12 | 400.57 | **150** (matches Trailing P/E) |
| `priceToBook` | 88.66 | 2021.13 | **100** |
| `priceToSales` | 36.92 | 286.24 | **50** |
| `evToRevenue` | 43.19 | 1025.67 | **50** |
| `quickRatio` | 26.07 | 97.25 | **25** (matches Current Ratio) |
| `beta` | 2.52 | 4.96 | **none needed** |
| `ebitdaMargin` | 79.29 | 93.98 | **300** (matches the other margins) |
| `fcfMarginPct` | 73.61 | 626.84 | **300** (as above) |
| `payoutRatioPct` | — | — | **300** — `PAYOUT_DISPLAY_CAP`, the existing shared constant |
| `sharesChangeYoyPct` | 66.92 | 100384.45 | **100** |
| `shortPctOfFloat` | 24.12 | 36.38 | **none needed** |
| `shortRatio` | 11.28 | 26.87 | **none needed** |

### ✅ The zero-sentinel trap was checked, not assumed

`ebitdaMargin` is `zero_means_na=True` — a stored `0.0` means *not reported* (banks), and
reading it as a real 0% once changed four customers' ratings (14b). That rule is enforced in
**Python**, while Key Metrics renders from **TypeScript** — which is exactly the split that
caused 14e-3.

Measured on the live database: **zero companies store an exact `0.0`** for `ebitdaMargin`,
`grossMargin`, `operatingMargin` or `netMargin`. The write-side normalisation is working and
`check_field_units.py`'s nightly invariant already fails if one appears. **Safe — and safe for
a reason that is checked rather than assumed.**

### ⚠️ Two new group colours must clear the palette guard

`--cat-shareholder` and `--cat-risk` are **new tokens**, and `check:tier-palette` asserts that
no two adjacent labels are confusable, in normal vision and two simulated colour blindnesses
(11t). The hexes in the design are placeholders; the real ones get measured against the four
existing category inks before they ship.

⚠️ **The sweep's first run reported "0 rendered nowhere"** — a clean bill of health — because
`app/dev-fixtures/page.tsx`, the local-only null-render gallery that is gitignored and never
shipped, names every field. **A contaminated sample producing a confident number is worse than
no number** (11p). Excluding it gave 15.

---

## 11. H1 · the breakpoint moved to 768px, because the owner asked and the answer was measurable

**Design:** https://claude.ai/code/artifact/051c7763-0eaa-4d39-846e-b425e356ebdb ✅ approved
2026-09-14 (shell, drawer contents, no changes wanted).

The owner asked: *"For tablets, can't we keep it same as Desktop?"* I had recommended a drawer
below 1024px. **The measurement says they were right.**

Measured on the production build, entitled account, **220px sidebar left in place**, every real
iPad portrait width — sideways scroll in pixels:

| Page | 744 | 768 | 810 | 820 | 834 | 1024 |
|---|---|---|---|---|---|---|
| Stock Detail | 0 | 0 | 0 | 0 | 0 | 0 |
| Run Analysis | 0 | 0 | 0 | 0 | 0 | 0 |
| Results | 0 | 0 | 0 | 0 | 0 | 0 |
| Browse · Account · Request | 0 | 0 | 0 | 0 | 0 | 0 |

Narrowing in **2px steps**, the first page to run out of room is Stock Detail at **730px**;
everything else survives to 620px. **The sidebar is not a tablet problem at all — only a phone
problem.**

**Breakpoint: 768px.** Tailwind's `md`, and the number `design-system.md` already names. It
leaves **38px** at the breakpoint rather than the 0px that picking 730 would give (11i-b:
assert a margin, not a boundary). The **iPad mini (744px)** falls below it and gets the drawer —
it measured clean by **14px**, and 14px is luck rather than a design.

⚠️ **Why my original recommendation was wrong, since that is the reusable part.** The 20px-step
sweep in §3 said Stock Detail was "clean from 740px", and I built a three-option tablet
comparison (drawer / icon rail / tabs) on top of it. **All three were answers to a problem
tablets do not have.** A sweep coarse enough to bracket a threshold is not fine enough to decide
a breakpoint — and I presented the options as a considered choice rather than saying the
underlying number was ±20px. The owner's question is what forced the finer measurement.

---

## 12. H2 · Error monitoring — what was built, 2026-09-16

**Status (2026-09-18): LIVE IN PRODUCTION.** The owner's three items below are done (account + DSN,
US region, privacy line), the four dashboard-side settings are recorded in `.env.example`, and the
paragraph at the end of this section records the server-side verification. What follows is the
account as written on 2026-09-16, when it was still inert.

**Status as built: code complete, guarded, green, and deliberately INERT.** With no
`NEXT_PUBLIC_SENTRY_DSN`, `Sentry.init` is a no-op, no network request is made and the CSP is
unchanged. Turning it on is one deliberate act, and it carries a privacy-policy line with it.

### What the owner still has to do — three things, and only the owner can

| # | Why it cannot be done here |
|---|---|
| 1 | **Create the Sentry account and give me the DSN.** Creating accounts is outside what I may do. The DSN is **public** by design — it is compiled into the browser bundle — so it goes in Vercel as `NEXT_PUBLIC_SENTRY_DSN` for Production **and** Preview. `SENTRY_AUTH_TOKEN` (source-map upload) is a **real** secret, server-only, and wants `project:releases` and nothing else. |
| 2 | **Choose a data region — US or EU.** It is fixed when the project is created and a project cannot be moved afterwards. Whichever is chosen is the country the privacy policy names. |
| 3 | **Approve the privacy-policy line.** Sentry becomes a recipient of personal information the moment the DSN is set (APP 6 / APP 8). The wording is written and is in the diff. |

⚠️ **Nothing can be reported as "monitoring is live" until 1 happens**, and the last step is a
human one: drive a deliberate error, see it in the inbox, then remove the DSN and confirm the same
run produces **nothing** — so "it arrived" is about our wiring rather than somebody's default.

### The design, and the one decision inside it worth arguing about

**`lib/observability.ts` is the only place a handled failure is announced.** It writes the
`console.error` the owner already reads **and** captures to Sentry — both, always, including when
the SDK is off. The console line is not belt-and-braces: it is the instrument that works when
Sentry is down, behind an ad blocker, and on a local run.

**The alert rule lives in the code, not in Sentry.** `reportIssue()` takes a level; `level: 'alert'`
sets the tag `mc.alert = yes`; **one** Sentry rule keys on that tag. The alternative — six rules
matching six log messages — is 11c-v with the second copy inside a third party's UI, where no type
checker, grep or gate can see it, and rewording a log line silently stops the alarm matching.

**Scope went wider than the six the plan named**, and that is the decision to review. Six paths
would have meant a guard that could only be a hand-written list of six. Every operational failure
in `app/` and `lib/` now reports, and the guard is an **invariant** instead: no bare `console.error`
outside the reporter and the three error boundaries. ⚠️ **Two paths beyond the six were also raised
to `alert` and are named here so they can be reversed**: `STRIPE_WEBHOOK_SECRET is not set` and
`stripe webhook: handler failed`. Both are strictly worse than the six — with no secret, *every*
webhook is rejected and nobody is provisioned, dunned or lapsed.

### What leaves this machine, and what never does

`lib/sentryOptions.ts` is the one answer for all three runtimes. **Stripped, explicitly:** the
request's cookies (our session lives there — a session inside an error report is
credential-equivalent), all headers (`authorization`, `x-mc-internal`, `cookie`), the query string,
any POST body, the IP address, the reader's email and username. **Kept:** the method, the path, the
opaque Supabase user id, our own tags and the stack. Every string in the event is then walked and
email addresses **and credentials** masked — a deep walk rather than a field list, because what
reaches Sentry is whatever somebody else's error message brought with it.

⚠️ **The credential half came from asking what the WORST value could be, not from anything going
red.** Every Supabase key is a JWT — the `anon` key, the `service_role` key and every signed-in
reader's session token all begin `eyJ` — and nothing masked one. `redactSecrets` now covers JWTs,
Stripe keys (`sk_`/`rk_`/`pk_`/`whsec_`) and `Bearer` values; `redactSensitive` runs it **before**
the email mask, because masking an address first leaves `eyJ…[email redacted]…`, which no longer
matches the token pattern and is still most of a credential. **The console line gets the same
treatment** — a Vercel log is not a safe place for a key either — and the thrown error now reaches
`console.error` as a redacted stack string rather than as the object.

**Tracing is OFF and there is no Session Replay.** A trace records every URL a reader visits, which
on this site is a record of which companies a named person looked at; replay records their screen.
Neither should arrive as a side effect of installing error monitoring.

⚠️ `sendDefaultPii` already defaults to `false`, so several of those strippers remove fields the SDK
was never going to attach. That is deliberate — 11a, for the seventh time: **state it and guard it**,
because an unasserted property is one upgrade from being gone and nothing goes red.

### What it cost — measured, not estimated

**+55 KB transferred on every page**, from a controlled A/B with the browser SDK swapped for a
no-op and the build cache cleared between arms (11i).

| page | without | with | budget | spare |
|---|---|---|---|---|
| `/` | 286 | 341 | 360 | 19 |
| `/articles` | 275 | 330 | 340 | **10** |
| `/privacy` | 275 | 330 | 340 | **10** |
| `/stocks` | 336 | 391 | 400 | **9** |
| `/run` | 312 | 367 | 380 | 13 |
| `/stocks/us/AAPL` | 1031 | 1087 | 1150 | 63 |

Every budget passes. ⚠️ **But five pages now sit within 13 KB of a ratchet that was tightened
1400 → 1250 → 1150 precisely so a real saving could not be handed back in silence (11w)** — so the
next ordinary addition trips CI on a public marketing page. Sentry's own documented tree-shaking
flags (`__SENTRY_TRACING__` / `__SENTRY_DEBUG__` via Next 16's `compiler.define`) were tried and
moved the number by **1 KB**; they were removed rather than left in, because an inert line that
reads as an optimisation is worse than none (11ak). **This is recorded as a cost, not fixed. If the
owner wants it back, the lever is to stop shipping the browser SDK to the public pages** — the six
money paths and every API route are server-side and would be unaffected.

### The guards, and what they cannot see

`e2e/observability.spec.ts` — pure, credential-free. It **cannot** prove an event arrives; that
needs a real project and a human looking at an inbox, and it is step 1 above. It proves everything
on our side of the wire: the scrubbing, the CSP origin, the client entry filename, the privacy link,
and that no failure path has gone back to shouting into a console.

**Eleven deliberate breaks, every one caught, and one of them changed the code:**

| Break | Result |
|---|---|
| `scrub` keeps the session cookie | caught |
| `scrub` returns an empty event | caught (the control) |
| a malformed DSN falls back to a wildcard | caught |
| the ingest origin never reaches `connect-src` | caught |
| `sentry.client.config.ts` comes back | caught |
| a failure path returns to `console.error` | caught |
| one of the six stops being an alert | caught |
| the redaction sweep matches only `console.*` | caught |
| **everything becomes an alert** | **NOT caught → the guard was fixed** |
| the privacy line loses its condition | caught |
| Sentry vanishes from the recipients | caught |

⚠️ **The ninth is the one worth reading.** The control asserted the distribution of `level: 'alert'`
across the SOURCE — "not none, not all" — and a reporter tagging **every** event `yes` left every
source count untouched and the file green. A guard watching a proxy for the thing. Fixed by
exporting the two-line mapping so a test can call it: a function can be driven, a count of literals
cannot.

⚠️ **And the sabotage harness itself reported EIGHT false negatives first.** Eight from eight is not
a finding about eight guards; it is a finding about the instrument. Playwright's `webServer` runs
`pnpm`, which is not on PATH inside the cmd.exe Python's `shell=True` creates, so no test ever ran —
and the verdict function, seeing no "failed", scored silence as a pass. It now refuses any run whose
output carries no test counts. **A verdict function must be able to say "I don't know."**

### Two things that did NOT change, and why

**No `tunnelRoute`.** Sentry offers one — events proxied through our own origin so an ad blocker
cannot stop them, and no new CSP origin. Declined: it is an open forwarder to a third party hidden
behind our own domain, a new route handler needing its own cache header and its own place in
`check:entitlement-gates`, and it hides the egress the CSP line exists to declare.

**The offline report stubs the SDK by CLASS.** No component reaches `@sentry/nextjs` today — that
is a fact about this week, and 11d is the record of what happens when it stops being one. The
esbuild build resolves `@sentry/*` to a no-op and `assertNoServerCode()` refuses an artifact
containing `ingest.sentry.io` or `sentry-trace`. Verified on the emitted file: zero matches.

### Verified on Vercel, 2026-09-18 — and what only the SERVER test could find

The browser half was verified on a preview on 2026-09-17. The server half — the one that carries
every money path — had not been, so a throwaway branch (`test/sentry-server-probe`, never merged)
added a route that raised one handled `alert` and one unhandled throw on a real Vercel preview.
**Both arrived**, tagged `preview`, with the release commit, a stack trace resolved to
`app/api/sentry-probe/route.ts:24`, no IP and no location. The alert carried `mc.alert = yes`.

⚠️ **Two defects that no local test and no browser test could have shown:**

1. **The query string leaked through a door `urlQueryParams: false` does not guard.**
   `captureRequestError` — the hook for every UNHANDLED server error — writes
   `contexts.nextjs.request_path` as the raw path WITH its query. On this site that can be
   `/auth/confirm?token_hash=…` or `/auth/callback?code=…` (one-time sign-in credentials) or a
   Stripe `session_id`. `scrub` now cuts at `?` in every context key ending `path`/`url`.
2. **The email mask blanked every third-party stack frame.** pnpm paths are shaped like
   addresses (`next@16.3.5_@babel+core@7.29.0/…/tracer.js`), so the deep walk replaced them with
   `[email redacted]`. Frame `filename`/`abs_path`/`module` are now exempt — code, never reader data.

3. **Reports were being LOST, and the SDK's own guard against that is off on Node.** Of six
   unhandled throws Vercel logged, Sentry received **three**, and none of the two sent to a fresh
   deployment. `@sentry/core`'s `vercelWaitUntil` returns immediately unless `EdgeRuntime` is set —
   on Node it waits for a SIGTERM that Vercel does not send; it FREEZES the instance after the
   response, and a send still in flight freezes with it. The handled money-path alerts use the
   same client, so this was never only about crashes. `flushBeforeFreeze()` (`lib/observability.ts`)
   hands `Sentry.flush()` to Vercel's own `waitUntil` — the hook `@vercel/functions` reads — from
   both `reportIssue` and `onRequestError`.

All three carry a test in `e2e/observability.spec.ts`, and each was broken on purpose and went red.
⚠️ **Instrument note, and it cuts both ways:** the first unhandled event took
several minutes to become searchable, and for those minutes it read as LOST. It was not — so I
nearly wrote the whole thing off as latency. **Counting against Vercel's own log** (every request
the platform saw, not just the ones I remembered sending) is what showed that three really were
missing. An absent event one minute after the request is latency; an absent event after ten, with
the request in the platform log, is a loss.

Also switched off the build plugin's own usage telemetry (`telemetry: false`), which the production
build log showed it sending on every build, with a test that fails if it comes back.

### The close-out sweep, 2026-09-18 — what else was checked, and what is accepted

- **The alert chain, end to end from a server.** A `level: 'alert'` report from a real Vercel
  function reached Sentry tagged `mc.alert = yes` and **the email arrived**. Together with the
  spec asserting each of the six money paths reports at `alert`, this is how the plan's "each
  path driven on a Stripe test clock" row was met — by a chain whose every link is checked,
  rather than six drives. What it does not prove is each path's own trigger; those have their
  own tests.
- **The DSN-removed control.** 30 days of local runs with no DSN: **zero** events.
- **Source maps.** The production build log shows the upload; server frames resolve to our
  own `.ts` lines.
- **Privacy on the server event.** No IP, no location, no headers, and (after fix 1) no query.
- **A fourth gap, found by asking what the Python functions report: nothing.** They carry no
  SDK. `lib/cycle.ts` treated every non-401 failure of `/api/cycle` as a breadcrumb, so a
  crashing engine — every paid page rendering without its analysis — reached Sentry as
  nothing. A 5xx is now a `warning` (listed, no email: one outage must not become an email per
  page view). `/api/analyze` fails in the browser and is shown to the reader as unscored
  tickers; visible to them, not recorded. Accepted.
- **Two email rules, deliberately.** Ours keys on `mc.alert`; Sentry's default "high priority
  issues" rule is the only one that emails on an UNHANDLED crash (no tag). Kept. If it proves
  noisy, tag unhandled errors in `beforeSend` and retire it — never delete it and go blind.
- **Deploy emails** ("Deployed … to vercel-preview", one per preview build) come from the
  build plugin recording each Vercel build as a Sentry deploy. The Next.js wrapper's types do
  not accept `deploy: false`, and a cast would be a line that reads as config and may not hold
  across upgrades (11ak), so this is an owner notification setting instead (Sentry → User
  Settings → Notifications → Deploys → Never).

---

**End of layer-h-plan.md.**
