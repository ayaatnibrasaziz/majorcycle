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

**Status: P0 complete, 2026-08-31.** Sources are named per page. Where an approved artifact
exists it wins over any prose brief — the brief records *why*, the artifact records *what the
owner said yes to* (11j).

---

## How to read this

Each row is checkable, not descriptive. Prefer, in order: a **section anchor** (`#sec-…`), a
`data-testid`, then **exact heading text**. "Looks right" is not an entry.

**The nine viewer states** every page is checked in (P1):

`signed-out` · `free` · `trialing` · `active` · `past_due` · `grace` · `locked` ·
`deletion-scheduled` · `password-recovery`

⚠️ **A section being ABSENT is correct in some states and a defect in others.** The manifest
says which, because "the rating is missing" is right for a free viewer and wrong for a
subscriber — and both render perfectly.

---

## `/` — the landing

**Source: the approved artifact** *"MajorCycle — every public page, one design system"*
(`fd8cbcdc…`, updated 2026-08-28), read in full for this manifest. Nine sections.

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
| `/login` `/signup` `/reset-password` | The real form **in the HTML with JavaScript disabled** · `role="alert"` error region · Google sign-in button · links between the three | Signed-in → redirect to `/stocks`. `force-dynamic` |
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
