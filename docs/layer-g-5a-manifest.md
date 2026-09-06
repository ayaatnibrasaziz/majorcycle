# Layer 5a · P0 — the expected-content manifest

> **What must be on each page, written down BEFORE looking at any of them.**
>
> This exists because of one fact that governs the whole sweep: **a missing section renders
> perfectly.** There is no error, no gap, no failing assertion — the page simply stops earlier
> than it should and looks deliberate. Nothing can find that by looking at the page and asking
> whether anything seems wrong; only a list of what *should* be there can (CLAUDE.md 11j).
>
> It bit this project once already. Three documents said the landing page was finished, all
> three were true about what they measured, and the page was missing **twelve** sections.

**Status: P0 complete, 2026-08-31 — REVISED the same day after self-review; see "P0 SELF-REVIEW" below.** Sources are named per page. Where an approved artifact
exists it wins over any prose brief — the brief records *why*, the artifact records *what the
owner said yes to* (11j).

---

## How to read this

Each row is checkable, not descriptive. Prefer, in order: a **section anchor** (`#sec-…`), a
`data-testid`, then **exact heading text**. "Looks right" is not an entry.

**The viewer states** every page is checked in (P1). ⚠️ **This list said NINE until the P0
self-review; it was wrong.** The eight Stripe statuses the billing layer actually maps are in
`lib/entitlement.ts`, and I had omitted four of them plus the dispute state entirely — while
`F-005` is *specifically* the finding that four thin states show a screen that does not describe
them. **A state I forget to list is a state nobody looks at.**

| # | State | Note |
|---|---|---|
| 1 | `signed-out` | |
| 2 | `free` (no subscription) | |
| 3 | `trialing` | |
| 4 | `active` | |
| 5 | `past_due` → within grace | still entitled |
| 6 | `past_due` → grace expired | hard lock |
| 7 | `unpaid` | **F-005** — falls through to "no subscription" |
| 8 | `paused` | **F-005** |
| 9 | `incomplete` | **F-005** |
| 10 | `incomplete_expired` | **F-005** |
| 11 | `canceled` | |
| 12 | `billing_blocked` (dispute) | omitted from my first list entirely |
| 13 | `deletion-scheduled` | confined to `/reactivate` |
| 14 | `password-recovery` | confined to `/account/update-password` |

**Fourteen**, which is also the size of the subscription matrix the Layer F audit drove on live —
a number already in the docs while I was writing nine.

⚠️ **A section being ABSENT is correct in some states and a defect in others.** The manifest
says which, because "the rating is missing" is right for a free viewer and wrong for a
subscriber — and both render perfectly.

---

## `/` — the landing

**Source: the approved artifact** *"MajorCycle — every public page, one design system"*
(`fd8cbcdc…`, updated 2026-08-28). ⚠️ **My first pass read only its rendered text and missed the design system in its script/style blocks — see the self-review below.** Nine sections.

| # | Section | Must contain |
|---|---|---|
| 1 | **Hero** | `<h1>` "{N} companies." + "Which ones are actually on sale?" · both CTAs ("Create a free account", "See how it works") · the "US · Australia · Canada" eyebrow · the **"Information only"** disclaimer block |
| 2 | **Analyst Briefing** | "Real output · Magnificent Seven · medium horizon · {date}" · the big "5 of 7" figure · the prose briefing naming the standout · three summary lines (Constructive-or-better / Top pick / Cautious-Bearish) · "Information only — not financial advice." |
| 3 | **Stats band** | four cells: {N} companies covered · 3 markets · 1 run · $0 to open an account |
| 4 | **How a scan works** | "Three decisions, then a ranked list." + **three** numbered steps: Pick a list · Pick a horizon · Read the ranking, each with its option chips |
| 5 | **Ranked results table** | the three column groups **Identity / MajorCycle Verdict / Major Cycle** · the legend explaining Overall's 40/35/25 weighting, Current DD%, Typical DD%, Lower Bound% · "Information only — not financial advice." |
| 6 | **The idea** | "Shares don't fall in a straight line…" · the Apple ruler figure, **both halves** (how far it falls / how far it recovers) · the two comparison figures (typical vs deepest, typical vs largest) · "So what does that tell you about Apple today?" |
| 7 | **The second question** | "A falling price is not the same as a bargain." · "What this particular run is telling you" · the **Opportunity Map** with its four quadrant labels · the three pillar cards (Financial Health 40% / Valuation 35% / Cycle Payoff 25%) · the **five tiers** with their thresholds |
| 8 | **What you get** | two columns — **Free account / No card** (5 bullets) and **Subscription / 7-day free trial** (5 bullets) · "Start the free trial" CTA |
| 9 | **Before you use it** | three honesty blocks: "These are algorithmic summaries." · "A ranking is where research starts, not where it ends." · "Information only — not financial advice." |

⚠️ **State rule.** `/` is in `SIGNED_OUT_ONLY_PATHS`: a signed-in viewer must be **redirected**,
not shown a variant. Landing on `/` while signed in is a defect.

### 🔬 The frozen claims on this page — P5 must re-derive every one

Both snapshots carry `asOf: 2026-08-13`, **18 days old**. ✅ They agree with each other, which is
the 11k trap already avoided — *"two snapshots describing the same subject must carry the same
date."* ✅ `universeCount: 866` matches the live database exactly (866 active / 871 rows / 5
retired), so the count is current.

**Everything below is a measurement with a shelf life, and 11k records this same run going false
in six days.** Each must be re-derived before launch:

`5 of 7 Constructive or better` · `top pick GOOGL, Health 90, High Conviction` ·
`0 Cautious/Bearish` · `Tesla fallen furthest at 34.1%` · `Tesla still comes sixth` ·
`Tesla Health 49.8 vs Alphabet 89.9` · `Tesla profitability 20/100` ·
`nothing has landed in the Opportunity Zone` · Apple: `price 313.33` · `9.1% below its high` ·
`typical fall 24.7%` · `deepest 81.4%` · `609 falls` · `630 recoveries` ·
`typical recovery +78.4%` · `largest +470.5%`

⚠️ **Layout is a claim too.** The Opportunity Map's per-ticker label sides were chosen for one
dataset; at different values two labels touched. Regenerating a snapshot is a **content change**,
not a data refresh.

---

## ⚠️ P0 SELF-REVIEW, 2026-08-31 — the first version of this manifest was wrong

The owner asked whether I was 100% happy with P0. I was not, and checking found two real errors.

**(1) I claimed to have read the approved artifact "in full". I had not.** I extracted its text
with a script that **stripped `<script>` and `<style>` blocks as noise** — and the design system,
which is the artifact's actual subject, lives inside them. The tool result had even told me the
head was not the whole artifact and to read all 1,932 lines. I skipped that and reported
completeness. **A probe that cannot see the thing returned a confident, tidy, incomplete answer**
— the same failure as the SMTP finding two hours earlier, in the same session, after I had
written it up as a lesson.

**(2) Consequently I used the artifact for ONE page and the source code for the other twelve.**
The artifact is not a landing storyboard. It is a **numbered deck of eight approved pages** —
Landing · Sign in · Sign up · Pricing · Terms (legal) · Contact · Learn · Articles — each with
its exact copy, fields and buttons, plus one shared chrome. Deriving those pages from the code
answers *"what does it do?"*, never *"what did the owner say yes to?"* — which is **11j**, the
rule I quoted at the top of this file while breaking it.

### The sourcing rule, corrected

| From the artifact | NOT from the artifact |
|---|---|
| Layout, section order, chrome | Any **number** |
| **UI copy** — headings, labels, button text, helper text | Any **list of live content** |
| Which fields a form has, and in what order | Any **date** |

⚠️ **Its sample data is sample data.** The Articles deck lists *"Do bank shares fall differently
to mining shares?"* dated **14 Sep 2026** — a date two weeks in the *future* — and shows two
published articles where five shipped. Treating that as a spec would have raised three false
findings. Same trap as the landing's figures (5A-007), now generalised: **copy the artifact's
structure and words; re-derive everything that is data.**

---

## The shared public chrome — one definition, worn by all 13 public pages

From the artifact's design-system layer, which the first version of this manifest omitted
entirely.

| Element | Must be |
|---|---|
| **Header** | ONE header on every page. The brand lockup. **No "Markets · Live" pill** — removed by owner decision, and its CSS with it |
| **Footer** | ONE definition. **Measured live 2026-09-01 (P1):** *Home · How it works · Articles · Learn · Pricing · Contact · Disclaimer · Terms · Privacy* — nine links. The artifact's seven are all present **in the artifact's order**; `Home` and `Articles` were added afterwards, and `/articles` did not exist when the artifact was drawn (5A-007, 5A-017). Recorded as the live truth; `Home` is pending owner confirmation |
| **Cards** | ONE language: **10px radius + 1px border**. ⚠️ Explicitly *not* the old 12px radius with a 60px ambient shadow — that is what made signing in feel like a different product from the thing you were signing into. Floating cards keep a lift; cards inside a page use the whisper |
| **Buttons** | ONE primary: the **navy gradient**, not a flat fill. ⚠️ `.topnav a` outranks `.btn-primary` on specificity, so without `:not(.btn)` the sign-up button renders grey-on-blue — **invisible, and silent** |
| **Disclaimer chip** | Required **above the fold** (#4 / #12) |
| **Anchors** | `scroll-margin-top` on the targets, so a jump does not land under the 58px sticky header |
| **Texture** | The public-page texture, on the landing too |
| **Theme** | Committed to **light in both themes**, deliberately — the product is a light terminal |

⚠️ **No `overflow-x` on the page shell.** `overflow-x:hidden` makes an element a scroll
container, and a sticky descendant then offsets from *it* rather than the viewport — the header
rendered 46px too low and content slid underneath. The clipping belongs on `<body>`.

---

## Public pages

| Route | Must contain | State rule |
|---|---|---|
| `/pricing` | The three prices from `PRICE_TABLE` · monthly↔annual **toggle** that changes both amount and period · "Save N%" badge on annual · the `PREMIUM_UNLOCKS` list · disclaimer | Signed-in → **redirect to `/account`** |
| `/contact` | Form (name, email, message) · success state · failure state | Public in all states |
| `/learn` | `<h1>` "Before you buy anything" · **12** article cards grouped under theme headings · "Coming soon" entries render as such, not as dead links | Public |
| `/learn/[slug]` ×12 | Title · reading-scale prose (`.doc-scale`) · every figure the article declares · prev/next · disclaimer | Public |
| `/articles` | `<h1>` "What's happening, and what it means" · **"Published"** section listing **5** articles · **"Coming next"** section · the featured card | Public |
| `/articles/[slug]` ×5 | Title · date · frozen figures · ranked tables with correct alignment · custom figures · disclaimer | Public |
| `/terms` `/privacy` `/disclaimer` | Contents rail · scroll-spy highlighting the right clause · `.doc-scale` type · **the three live constants stated correctly** (25/day free cap, 30-day deletion window, 3-day payment grace) | Public |
| `/login` `/signup` `/reset-password` | The real form **in the HTML with JavaScript disabled** · `role="alert"` error region · Google sign-in button · links between the three. **Approved copy below** | Signed-in → redirect to `/stocks`. `force-dynamic` |
| `/account/update-password` | Password form · **logo-only chrome** (no nav, no footer links) | Only in `password-recovery`. A stale marker with no session must **not** trap the visitor |
| `/deletion-requested` | The deletion notice | **Marker-gated.** A stranger typing the URL must not see it |
| `/reactivate` | Reactivate control · **logo-only chrome** | Only in `deletion-scheduled` |

---

## Signed-in pages

| Route | Must contain | State rule |
|---|---|---|
| `/stocks` (Browse) | Search · market filter · the table · the **mandatory disclaimer above the fold** (#4) | All signed-in states |
| `/run` | The screener form: list picker, horizon presets, custom | **Premium.** Free/locked → upsell at the same URL |
| `/results` | Ranked table · Opportunity Map · CSV + Excel exports · briefing card | **Premium** |
| `/request` | Ticker request form · the listings menu · status feedback | All signed-in |
| `/account` | Profile (display name saves) · billing panel · referrals · **delete account** danger zone | All; `deletion-scheduled` shows the reactivate path |

### `/stocks/[market]/[ticker]` — the paid surface

Five subnav anchors, **all five must be present and must scroll to their section**:

`#sec-thesis` · `#sec-scorecard` · `#sec-cycle` · `#sec-fundamentals` · `#sec-sentiment`

⚠️ **THE ANCHORS ARE NOT ENOUGH, and the first version of this manifest stopped at them.** They
are five containers holding **23 analytical sections**. Remove `DividendHistory` and
`#sec-fundamentals` still renders, still scrolls, still looks finished — which is precisely the
defect P0 exists to catch, left uncaught on the most valuable page we ship. The authority is
`scripts/check-report-sections.mjs`, which derives the list from the page's own imports and
asserts the report renders a superset; it reports **23 sections in sync**.

**All 23 must be present** (alphabetical, as the guard derives them):

`AnalystTargetTrack` · `BadgeRow` · `BalanceSheet` · `CompanyOverview` · `DelistedNotice` ·
`DividendHistory` · `DrawdownOverlay` · `EarningsHistory` · `KpiStrip` · `MetricsTable` ·
`NewsFeed` · `OwnershipStructure` · `PriceChart` · `QuarterlyFinancials` · `RelativePerformance` ·
`ShortInterest` · `SmartMoneyActivity` · `SnowflakeRadar` · `StockHeader` · `TechnicalLevels` ·
`ThesisInsights` · `ValuationHistory` · `VerdictCard`

Plus three **page-only** chrome components that must NOT appear in the report:
`StockSubnav` · `PremiumLockCard` · `PremiumLockInlineCta`

⚠️ `DelistedNotice` counts as a section but renders for **5 of 871** stocks. Its absence on
AAPL is correct; its absence on `BK` is a defect. **A conditional section needs a named case,
not a tick.**

**Free viewer must SEE** (the data is free): price chart · full price history · drawdown overlay
**with its cycle bands** · Current Drawdown · every fundamentals section · every sentiment
section · analyst targets and consensus verbatim · the disclaimer.

**Free viewer must NOT see, in the HTML as well as on screen** (11b — a hidden value is still
shipped): Overall Rating · Health Score · Verdict · scorecard/radar · rating badges · the
downloadable report.

**Subscriber must additionally see** every item in that second list. ⚠️ **Its absence is the
defect that renders perfectly** — a page with no rating looks exactly like a page whose rating
failed to load.

**Conditional, and each must degrade to a stated absence rather than a blank:** delisting banner
(retired tickers only) · "not available at this horizon" notice · cross-currency statement note ·
free-view limit notice.

---

## Boundaries

| Case | Must answer |
|---|---|
| Unknown ticker · unknown market | **404**, with the friendly "not in our coverage yet" page |
| Unknown `/learn` or `/articles` slug | **404** |
| Unknown public URL | **404**, auth-aware (the link differs signed-in vs signed-out) |
| A failed database read | **503 + `Retry-After`**, never 404 (11e) |
| Paid endpoint, unentitled | **402** |
| Any per-viewer response | `Cache-Control: private, no-store` (11a) |

---

## What P0 already surfaced

Building this list, before any page was opened:

| | Observation |
|---|---|
| ✅ | Both landing snapshots share one `asOf` — the 11k two-dates trap is avoided, and the fix held |
| ✅ | `universeCount` 866 matches the live database exactly |
| 🔬 | **16 frozen claims on the landing**, all 18 days old, all needing re-derivation (5A-005) |
| ⚠️ | The approved artifact states **7 Aug 2026** and the shipped snapshot **13 Aug 2026** — different runs. The artifact's own numbers are therefore *not* the check; the shipped snapshot is, and it must be re-derived against today's data |

⚠️ **That last row is the P0 lesson in miniature.** I nearly used the artifact's figures as the
expected values. They are the *design*, taken on a different day — copying them would have made
the page "wrong" against a spec that was never shipped, and made a real staleness problem
invisible behind a fake one. **Copy the artifact's layout and wording; re-derive its numbers**
(11k).

---

## The approved copy — verbatim from the deck

⚠️ These are **words**, so they are a spec. Any number or list inside them is sample data and is
re-derived (see the sourcing rule above).

### 2 · `/login` — "Sign in"
- Title **"Welcome back"**, subtitle **"Sign in to continue to your terminal."**
- Fields, in order: **Email** · **Password**
- **"Forgot password?"** link, right-aligned above the button
- Primary **"Sign in"** · divider **"or continue with"** · ghost **"Continue with Google"**
- Rule, then **"New to MajorCycle?"** → **"Create a free account"**

### 3 · `/signup` — "Sign up"
- Title **"Create your free account"**
- Subtitle: *"No card required. Charts, drawdown cycles and company financials are free — our
  ratings are the paid part."* ⚠️ This is the free/paid promise stated to a customer; it must
  agree with `PREMIUM_UNLOCKS` (11c — a sentence that states a rule is a copy of that rule)
- Fields: **Email** · **Password**
- Primary **"Create account"** · **"or continue with"** · **"Continue with Google"**
- Consent line: *"By creating an account you agree to our **Terms** and **Privacy Policy**."*
- Rule, then **"Already have an account?"** → **"Sign in"**

### 4 · `/pricing`
- Title **"Start your 7-day free trial"**
- Subtitle: *"Full access for 7 days. Your card is required upfront and isn't charged until the
  trial ends — cancel any time before then and you pay nothing."*
- **Monthly | Annual** toggle, **"SAVE 30%"** on annual
- Price + **"/month"**, then *"Billed monthly. Prices shown in your local currency at checkout."*
- Five bullets: Overall Rating and Health Score on every stock · the full Verdict, five-pillar
  scorecard and valuation zone · screen hundreds at once — rank, filter and export · download a
  complete report · cancel anytime, no charge until day 7
- CTA **"Start 7-day free trial"**, then the *"create a free account — no card needed"* escape
- Footnote: no refunds, plan runs to the end of the paid period, educational analysis only

### 6 · `/contact`
- Title **"Contact us"**, subtitle *"Questions, feedback, or an issue to report? Send us a
  message and we'll reply by email."*
- Fields: **Your email** · **Subject** · **Message** · button **"Send message"**
- Footnote: *"We reply from a monitored address, usually within two business days. We can't give
  personal financial advice."*

### 5 · `/terms` (and the legal doc shell)
- `legalDoc(title, effective-date, intro, clauses[])` — title, a **dated** effective line, an
  intro paragraph, then numbered clauses with the contents rail
- ⚠️ The artifact shows **5 July 2026**. That is sample data: check the **live** date is the real
  one, not that it equals the artifact's

### 7 · `/learn`
- **Three themes**, each a heading + one-line description + its articles with read times:
  **Falls and recoveries** (5) · **Judging the business** (4) · **Using MajorCycle** (3)
- Total **12**, and the page states the total — so the stated total must equal the rendered count

### 10 · `/articles`
- Two sections: **Published** and **Coming next**
- The featured card **reuses the landing's briefing component** (`.briefing / .bt / .btxt / .bp`)
  so it renders byte-identical rather than merely similar
- Its market series use **teal and two non-direction tones** — ⚠️ green and red mean up and down
  everywhere else on this site and must never be spent on series identity

---

## ⚠️ Pages with NO approved design — named, not silently derived

The deck covers eight. These are the public routes it does **not** cover, so their manifest
entries come from the code and the design system, and are therefore weaker evidence. Said out
loud rather than left to look equal (11c-ix):

`/reset-password` · `/deletion-requested` · `/reactivate` · `/account/update-password` ·
`/learn/[slug]` (the article template) · `/articles/[slug]` · `/privacy` · `/disclaimer`

⚠️ The last two inherit the **legal template** (deck §6), so they have a design; only their
*content* is uncovered. The first four are the confinement and recovery screens — **the pages a
distressed customer sees**, and the ones with no approved design at all. That is worth knowing
before 5b, not after.

---

## P0 second self-review — what the owner's re-ask found

Asked "are you happy with P0?" a second time, I checked instead of answering. Two more errors:

| | Was | Is |
|---|---|---|
| **Viewer states** | I listed **nine** | **Fourteen.** I had omitted `unpaid`, `paused`, `incomplete`, `incomplete_expired` — which are *exactly* F-005, the finding that says those four show a screen that does not describe them — and `billing_blocked` (dispute) entirely. The Layer F audit had already driven a **14-state** matrix on live; the number was in our own docs while I wrote nine |
| **Stock Detail** | I listed **5 anchors** | **23 analytical sections** inside them, plus 3 page-only chrome. Removing `DividendHistory` leaves `#sec-fundamentals` rendering, scrolling and looking finished |

⚠️ **Both errors have one shape: I recorded the container and called it the contents.** Five
anchors for 23 sections; nine buckets for 14 states. In each case the list I wrote would have
produced a confident green P1 across a page or a state that was never examined — **the container
is always present, which is what makes it useless as evidence.**

⚠️ And note how each was found: not by re-reading my manifest, which looked fine, but by asking
the **code** what the real set was — `check-report-sections.mjs` for the sections,
`lib/entitlement.ts` for the states. Both had the right answer the whole time. **When a manifest
states a set, derive that set from something executable, never from recollection.**

---

# Execution guide — how to actually run this sweep

⚠️ **Added 2026-08-31 after the owner asked whether anyone could pick this plan up and execute
it.** They could not have. Everything above said *what* to check and almost nothing about *how*:
no URLs, no credentials, no commands, and every data edge case named in the abstract ("a bank",
"a cross-currency stock") with no ticker attached. **A checklist whose steps cannot be performed
is a wish.** Everything below was verified against the live systems, not recalled.

## 1 · The three surfaces

| Surface | How to start it | Sign in | Limits |
|---|---|---|---|
| **Local** `:3200` | `cd web && pnpm start:fresh --port 3200` (**builds first** — `:3200` cannot serve stale code). ⚠️ **Without `--port 3200` it starts on `:3000`** — `start:fresh` is `pnpm build && next start` and carries no port of its own. Never `:3000` | `.env.local` holds `E2E_EMAIL` / `E2E_PASSWORD` | ⚠️ **`/api/cycle` does not run.** The whole cycle block is empty for everyone — no rating, no verdict, not even the free "Current Drawdown" |
| **Vercel preview** | Pushed branches auto-deploy. Get the URL from `list_deployments`; the preview is SSO-gated, so mint a share link with `get_access_to_vercel_url` | same credentials | Reflects the **last pushed** commit, not your working tree |
| **Live** `https://www.majorcycle.com` | Already deployed | a real account, in **Claude in Chrome** | Live Stripe. **You cannot induce a failed payment here** |

## 2 · Named test data — every edge case has a ticker now

Queried from the live database, 2026-08-31.

| Edge case | Use | Note |
|---|---|---|
| **Retired** (delisting banner) | `BK` `CTRA` `SATS` `AOF.AX` `IFL.AX` | Exactly 5 of 871. ⚠️ **Absent from Browse** (`is_active` filter) but their URLs still resolve — correct, and worth checking both halves |
| **Cross-currency** | `A2M.AX` (AUD price / **NZD** accounts) · `ABX.TO` (CAD/USD) · `360.AX` (AUD/USD) | **79 stocks**, matching the documented figure. `A2M.AX` is the odd one — NZD |
| **Bank** (zero-margin sentinel) | `AIG` `ACGL` `AFL` `AEF.AX` | Margins arrive as `0.0` meaning *not reported* |
| **No analyst coverage** | `ADD.AX` | 16 rows, 4 of which are indices |
| **TSX Venture** | any `.V` ticker | ⚠️ **Keeps its suffix in the URL** (`/stocks/ca/ABC.V`) — Canada has two suffixes, and stripping `.V` would collide `ABC.V` with `ABC.TO` |
| **Index rows** | `^GSPC` `^AXJO` `^GSPTSE` `^IXIC` | ⚠️ **A fourth market, `market='index'`.** Excluded from Browse and from peer medians by explicit `.neq('market','index')`. **Check `/stocks/index/^GSPC` and `/stocks/us/^GSPC` both refuse** — this was never on the plan |
| ~~No fundamentals~~ | — | **Does not exist**: 0 rows. Drop it from the plan rather than "checking" it |

## 3 · Reaching the 14 states — and the four you cannot

| States | How |
|---|---|
| `signed-out` · `free` | A fresh account; no card |
| `trialing` · `active` | Stripe **sandbox** checkout |
| `past_due` in grace · past grace · `canceled` | Stripe **test clocks** — the full lifecycle was driven this way in F3 Session 3 |
| `deletion-scheduled` | Press delete on a throwaway account |
| `password-recovery` | Request a reset; the marker is httpOnly, path-scoped, 30 minutes |
| **`unpaid` · `paused` · `incomplete` · `incomplete_expired`** | ⚠️ **Not reachable by ordinary use.** They arrive from Stripe-side conditions we cannot trigger on demand. **This is finding F-005** — those four fall through to a screen saying "no subscription", which is untrue. Check them by setting `subscription_status` directly in the database on a throwaway account, and say that is what was done |

⚠️ **None of the payment-failure states can be produced on the LIVE site**, because that needs a
real card to really fail. Live checks are limited to signed-out / free / trialing / active.
**Say which surface each state was checked on** — a matrix that hides this reads as full coverage.

## 4 · Commands

```
cd web && pnpm start:fresh --port 3200   # builds first. ⚠️ THE FLAG IS REQUIRED —
                                    # `start:fresh` is `pnpm build && next start`
                                    # with no port, so without it you get :3000,
                                    # the one port every measuring script refuses.
pnpm gates                          # all 16 (~15 min).  NEVER pipe it — see §40b
pnpm gates --no-e2e                 # 15, fast, for docs-only changes
pnpm check:page-weight              # needs :3200 running
pnpm check:csp                      # needs :3200 + a real session
pnpm lighthouse                     # needs :3200, median of 3, ~6 min
node scripts/check-report-sections.mjs   # prints the 23-section count
```

⚠️ **CI costs GitHub minutes** (owner, 2026-08-31): batch commits and run gates locally. Push
when something meaningful is finished, not per edit.

## 5 · What the connectors can answer

All four work; the startup notice claiming otherwise was wrong (verified 2026-08-31).

| Connector | Use it for |
|---|---|
| **Supabase** | `execute_sql` for edge-case tickers and state setup; `get_advisors` for security/performance (both currently INFO-only) |
| **Stripe** | live prices, the live webhook's API version and event list; sandbox for test clocks |
| **Vercel** | `list_deployments` for the preview URL; `get_access_to_vercel_url` for a share link past the SSO gate |
| **Resend** | domain `majorcycle.com` **verified, sending enabled, receiving disabled** — inbound is Cloudflare Email Routing, so a contact-form *reply* is not a Resend test |

⚠️ **Account configuration is not in the repo.** Supabase custom SMTP, the Stripe statement
descriptor and the dispute settings all live in dashboards — grepping the codebase for them
returns "not found" whether they exist or not. That mistake cost three false findings today.
**Ask the vendor's API, or grep our own docs.**
