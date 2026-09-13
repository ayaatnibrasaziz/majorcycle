# Layer H — Pre-launch Hardening: the plan

**Status:** ✅ **CONFIRMED — all nine decisions taken, both designs approved, nothing open.**
No product code written yet; **H1 starts next session.**
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

### F 🟡 · One cross-engine difference around `/api/billing-context` — recorded, NOT diagnosed

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
| H1.2 | Build: `Sidebar` becomes a drawer below **768px**; `Header` and `main` drop the `ml-/left-[220px]` offset with it. At 768px and above **nothing changes at all**. |
| H1.3 | Re-measure all six routes, **entitled and free**, 320 → 1280 in 4px steps. |
| H1.4 | Widen `app-responsive.spec.ts`: floor 640 → 320, **add an entitled account**, sweep the range, assert **≥20px of spare room** rather than merely "no overflow". |
| H1.5 | Re-run the a11y and contrast suites at phone width, including the **open drawer** — a closed control is outside every scan we own (11ax). H5 falls out here. |

⚠️ Reuse the public header's `MenuButton` pattern (Escape returns focus to the toggle, the
panel closes on navigation, 40px rows) rather than writing a second one — 11c.

### H2 · Error monitoring 🔴 SECOND, and runs in parallel
No UI dependency. Second by **value**: a duplicate subscription is cancelled but **not
refunded**, and nobody is told. It must be watching **before** beta testers arrive, or the beta
is what discovers it.

Scope is the full install (owner's decision 2), with the six named log lines as the first
alerts, plus the `CYCLE_INTERNAL_SECRET` breadcrumb.

### H3 · `/learn` bands + row heights 🟡 THIRD
Cheap, public, isolated. **Design gate** — the band fix changes how `/learn` looks on a tablet.

### H4 · Cross-browser 🟡 FOURTH — must follow H1
Whole site, **Chromium + Firefox + WebKit** (all three now run — finding E), **local command
only**, printed as NOT RUN by `pnpm gates`. Includes closing finding F.

### H5 · Accessibility residue 🟢 — falls out of H1
Focus visibility at 375px; signed-in scans at phone width. Nearly free once H1 lands.

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
| H3a | Picture share ≤ **50%** of the band at every width 768–1023, measured `img.height / section.height` | The 1280px two-column layout must be **unchanged** — flattening the desktop also passes a picture-share bound |
| H3b | Every article link ≥ **44px** at 375px | Assert the **wrapping** titles by name — fixing only the single-line rows would read as a pass |
| H4 | Whole suite in Chromium + WebKit; the runner prints a **per-engine count** | Three totals, never one — an engine that failed to launch reports as "no failures" (and today Firefox would) |
| H5 | Focus indicator ≥ **3:1** against its own ground at 375px, **polled until the computed value stops changing** | 11ao: two sessions read this at t≈0 and got white. A control with its outline removed must be caught |
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

**End of layer-h-plan.md.**
