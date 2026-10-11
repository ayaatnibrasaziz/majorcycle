# Pre-launch beta review — 2026-09-27/28

Six AI reviewers drove the LOCAL site (`next dev`, test-mode Stripe, throwaway `@example.com`
accounts in ten billing states) and looked at every screen: A public site · B Stock Detail ·
C screener · D accounts/billing · E browse/search/request · F three customer journeys.
Raw reports: `raw-A.md` … `raw-F.md` (each finding keeps its reviewer ID, e.g. `B-2`).
All test accounts were deleted and the database checked clean afterwards (rule #20).

**Raw totals:** 3 blockers · 59 major · 97 minor · 21 ideas. Merged below into
**~30 fix groups** — many findings are the same defect seen from two or three reviewers.

Verified by the main session, not just reported: A-6 (the real `safeNextPath` passes
`/%09/evil.com` → `https://evil.com/`), B-1 (771 of 872 active stocks stuck, median 54 days),
B-2 (`VerdictCard.tsx:278` divides by `bandUpper`), F-3 (`overall.py` event score saturates at
20 events). Not a defect: the report download 404 (a broken `.next-dev` cache; 200 after clearing).

---

## 🔴 Blockers — fix before any beta tester or launch

> ✅ **#1 and #2 FIXED AND LIVE 2026-09-28 (PR #124).** The redirect fix was confirmed in the
> chunk the live `/login` ships. The full enrichment ran once (44 min): 866 of 872 active rows
> re-enriched — the other six are the four indices (never enriched) and QUB.AX / CVW.AX (no
> provider prices since August; already on the staleness sweep). AAPL now carries the June
> quarter, insiders to 22 Sep, analyst changes to 23 Sep.
>
> ✅ **#3 CLOSED — no change, owner ruling 2026-09-28.** The Entry Zone / Reload / Invalidation
> tiles, the entry/exit tooltips and "Top pick" stay: the owner already ruled on 2026-08-23 that
> the entry/exit language is the house voice (`layer-g-audit.md` F-001), and declined the three
> newly-found phrases too. **Do not re-propose.** The one change made: the Results briefing no
> longer calls every standout under Health 80 "fundamentally sound" — it names the Health tier
> (`lib/ratings.ts`, guarded by `e2e/briefing-health.spec.ts`).

| # | What | Findings |
|---|---|---|
| 1 | **Open redirect after sign-in.** `?next=/%09/evil.com` (tab, newline or CR) passes `safeNextPath` (`lib/url.ts`) and the browser resolves it to `evil.com` — a phishing link can land a reader on a fake page straight after a real sign-in. Fix: parse with `new URL(next, origin)`, require same origin; add the cases to `auth-contracts.spec.ts`. | A-6 |
| 2 | **Company data frozen for 771 of 872 stocks** (earnings, statements, P/E history, insider trades, analyst changes, holders). `_should_fetch_enriched` never re-fetches a stock enriched on or after its earnings date; median age 54 days, oldest 14 June. Fix the rule, then run a full enrichment once. | B-1 |
| 3 | **Advice / trade-plan wording** (#12, #24, ASIC general advice). Verdict tiles "ENTRY ZONE · ACTIVE", "WAIT FOR ENTRY ZONE", "RELOAD LEVEL", "INVALIDATION BELOW"; "before adding"; FREE tooltips "better entry zones", "historically attractive zone"; "Top pick", "standout", "worth owning", "setting an exit", "before you buy", "patience may beat forcing an entry", "keep on the radar". `no-advice-copy.spec.ts` scans neither `lib/` nor `app/(public)` and has no pattern for these. **Needs owner-approved replacement wording.** | F-1, B-10, A-1, C-9, F-2, F-14 |

## 🟠 Major — wrong or misleading numbers

> ✅ **Owner's picks, 2026-09-28 — FIXED:** Verdict "% below current" (B-2); losses no longer
> "thin", no stale "Current P/E" on a loss-maker (B-4, B-5); the health sentence names only
> areas the scorecard itself scores below 50, and no strength is quoted from a weak area
> (B-7 — owner: *"make it in a way it can't contradict"*); results table + both exports use
> the Stock Detail price format and home currency (C-3 prices, C-7, C-8); every score label
> is read from the rounded number shown — screen, colours, `.csv` and `.xlsx` (C-14, A-2);
> Relative Performance starts every line on the LATEST first date among the stock and the
> indices (B-12); the insider label states its period and totals over all stored filings
> (F-8); the holder table is hidden when no holder owns ≥1% (B-3, F-9). Guarded by
> `e2e/beta-wrong-numbers.spec.ts`. **Declined by the owner — do not re-propose:** TSM's EPS
> currency (B-11) and the Smart Money legend (B-6).

| # | What | Findings |
|---|---|---|
| 4 | Verdict "Top $X · N% below current" uses the premium formula — AAPL says 31.1%, truth 23.7%. | B-2 |
| 5 | **Overall Rating's Cycle Payoff (25%) is ~90–100 for every stock** — the event-count half saturates at 20 events, so it adds a near-flat +22–25 points. Ratings bunch upward and can't be reconciled from the columns shown. **Methodology decision.** | F-3 |
| 6 | **Zone labels contradict themselves**: "Deep Value/Value/Fair/Stretched" come from typical-fall rules while the tooltip describes Cycle Position bands (disagree on 80–87% of rows); CBA reads "Deep Value" while P/E is above average and it trades above every analyst target; glossary and code disagree. **Naming decision.** | C-2, B-14, F-4 |
| 7 | "610 falls" / "273 confirmed cycles" / "High confidence" count 5-day lows *inside* falls (AAPL crosses −5% only 304 times); confidence tier is event-count only, so a 15-month-old listing is "High confidence". **Methodology/wording decision.** | F-5, B-13, A-33 |
| 8 | Thesis text contradicts the page: losses called a "thin net margin"; stale historical P/E shown as "Current P/E" on loss-makers (62 stocks); "elevated balance-sheet risk" beside Balance Sheet 100 "fortress"; "rich entry zone" on a stressed company; PEG "growing faster" beside revenue −99%. | B-4, B-5, B-7, B-8 |
| 9 | Currency/market ambiguity: results table prints bare `$` on prices and targets, strips suffixes (NEM and NEM.AX look identical), no market column/filter; market caps ranked across currencies with no FX (AMD.TO C$1.3T tops Browse and "Top 50 largest"); CDRs not labelled; TSM EPS labelled NT$ when it is US$. | C-3, C-10, C-28, E-5, F-7, B-11, F-22 |
| 10 | Rounding: screen vs export differ (0.365 → $0.36 on screen, 0.37 in exports — breaks 11c-iii); penny stocks lose precision ($0.041 → $0.04, target $1.08 → "$1"); label from raw score beside a rounded number ("80 Adequate"). | C-7, C-8, C-14, A-2 |
| 11 | Data panels that look broken: AU/CA "Top institutional holders" are tiny US ADR holders (0.00%); insider label contradicts the visible list and counts a hidden 2-year window (and RBC as its own insider); Smart Money legend describes a colour scheme the markers don't use; Relative Performance "Max" compares 46 years of the stock with 20 of the index (+347,017% alpha). | B-3, F-9, F-8, B-21, F-20, B-6, B-12 |
| 12 | Wrong status: BK says "no longer trades" (renamed BNY, which we cover); header "Updated <date>" is the row date, not the price date (QUB.AX price from 18 Aug says "Updated Sep 18"); PDIDB.AX is a temporary ASX code listed as live; retired stocks get a rating in CSV-imported screens. | B-9, E-7, E-8, C-4, B-27 |
| 13 | Published content errors: recovery article's "doubles / quadruples the wait" contradicts its own table; a nightly figure (Apple 1.2%) makes fixed Learn prose nonsense; landing Apple captions say the opposite of Apple's position; article caption/count/definition slips. | A-10, A-15, F-12, A-11, A-13, A-14, A-9 |

## 🟠 Major — can't find it / can't use it

| # | What | Findings |
|---|---|---|
| 14 | Search has no name tolerance ("Google", "Estee Lauder", "Toronto Dominion", "BRK.B", typos → 0) and then says **"We don't cover it — request it"** for stocks we cover, including when a filter hides them and on `/stocks/au/BHP.AX`-style URLs. `/request` ranks the intended stock 4th and offers US duplicates of covered TSX banks. | E-1, B-15, E-16, E-6 |
| 15 | Browse shows at most 120 of 868 (ASX 253 → 120), no sort, no paging; Back loses search/filters/scroll; filters not in the URL. | E-2, E-10 |
| 16 | Custom horizon fields can't be typed (clearing snaps to 0; "-8" → "08"); invalid values silently fall back to Medium. On `/run` and Browse. | C-1, E-11, B-28 |
| 17 | CSV import fails on ordinary files — quoted values, Excel commas, semicolons, one-line lists, "Symbol" header, `ASX:BHP`, and ASX codes without `.AX` (BHP/CBA/CSL told "not covered — request them"). | C-5 |
| 18 | Screener state: results live in `sessionStorage` only (new tab / reload / tomorrow → "No analysis run yet"); mid-run `/results` says "Your run finished — none could be scored"; Opportunity Map ignores filters; phones have no sort and the view mode does nothing. | F-10, C-13, C-6, C-12, C-11 |
| 19 | Phones: 14 of 22 article tables cut mid-number with no scroll hint or keyboard access; ⓘ tooltips don't open on an Android tap (likely); Key Metrics value column cut. | A-18, F-11, B-22, F-19 |
| 20 | `/contact` wipes everything typed when the server rejects the email. | A-21 |
| 21 | WebKit draws every Sora heading at regular weight since the variable-font change — **check on a real iPhone/Mac before acting**. ⚠️ **Measured 2026-10-04, and it is the TEST BROWSER, not the site:** Playwright's Windows WebKit (26.5) lays Sora out at the right weight (text widths identical to Chrome at 300–700) but draws every weight thin — including `font-variation-settings: 'wght' 800`, which no `@font-face` change can affect, while a static bold (Arial) draws bold. Re-registering Sora as one range face (`font-weight: 100 800`) changed **0 pixels** in WebKit on four pages, so it was reverted rather than shipped as a fix for something it does not fix. Real Safari draws with Apple's own text engine, which this build does not have. **Still owner-held: one look at a heading on a real iPhone or Mac.** | A-28 |

## 🟠 Major — billing, trust and legal

| # | What | Findings |
|---|---|---|
| 22 | A customer whose card failed sees no warning in the app (only a sidebar chip, and no deadline); lapsed/cancelled readers get the new-customer pitch with no "your payment failed / your plan ended"; **no email at all when access stops**. ✅ **2026-10-03:** failed-payment banner + held banner; *access paused* and *subscription ended* emails; recovery email no longer says "uninterrupted" after a lockout; every billing email quotes Stripe's amount. | D-1, D-4, D-5, D-6 |
| 23 | After a free-trial checkout `/account` says **"Payment received"** (amber alert), also for cancelled/lapsed/no-plan. | D-2 |
| 24 | Delete-account copy promises the subscription "stays valid until the end of the period you've paid for" — false: the reader is locked to `/reactivate` and the day-30 purge cancels Stripe, so an annual payer loses ~6 months (no refunds). **Owner policy decision.** ✅ **Wording fixed 2026-10-04** (`lib/deletionSubscription.ts`: six cases, each true — an annual plan is now told the unused time is not refunded) and reactivating no longer renews a plan the customer had cancelled. ✅ **Policy decided by the owner 2026-10-07:** deletion on day 30 is final — paid time after it is lost, no refund, no Terms change. Deleting with a FAILED payment now cancels at once so the unpaid bill is never retried; `/reactivate` reads `billing_blocked` (open dispute → returns on hold; lost → free + contact support). | D-3 |
| 25 | Sign-up never shows or links the Terms / Privacy Policy (the Terms bind "by creating an account"; APP 8 disclosure relies on it). ✅ **2026-10-03** — sign-up, sign-in and the first-login screen. | A-22, F-13 |
| 26 | The free 25-new-stocks-a-day cap appears only in the Terms; landing/sign-up/Learn say "browse all / any company"; no "views left" counter; "resets at midnight UTC" (10–11am in Sydney). | A-16, D-18, E-15, B-30 |
| 27 | The rating is defined three different ways (first-login gate, paywall dialog, landing); `/pricing` keeps its own feature list (11c-i); Stripe product text says premium includes "analyst data" (free). ✅ **2026-10-03** — one definition (`lib/ratingDefinition.ts`), `/pricing` reads the shared list. ✅ Stripe product text replaced on the live product 2026-10-07. | D-15, F-6, D-14 |

## 🟡 Minor (grouped — see raw files for each)

- **Billing copy:** no renewal date/price on the account card; trial never states date + amount together; cancelling not told it can be undone; "Licence status"; C$ vs CA$; "US$15 /month USD". (D-7…9, F-15, F-16, A-5)
- **Auth flow:** query string dropped on sign-in redirects (breaks post-checkout reconciliation); signed-in `/login?next=` ignored; first-login gate has no exit or Terms links and pages behind it still render and count free views; a made-up ticker uses a free view; unknown URLs send signed-out visitors to `/login`; no show-password; no-JS buttons silently disabled; `/account/update-password` "Cancel" signs you out. (D-10…13, A-7, A-23, A-25, A-27, A-34, E-17)
- **Screener polish:** progress bar and "Processed" wrong; est. remaining climbs; selection lost mid-run; cancelled results not marked partial; Last Analysis "View" never shown and "Re-run" without confirm; export filename/BOM/currency/horizon; "None" analyst; raw zone codes; drawdown filters need negatives with no hint; garbage CSV scrolls the page 32,000px; header not sticky. (C-15…27)
- **Stock page polish:** quarterly colours vs YoY; earnings legend swatch; dividend gap years; analyst stacks off the chart; drawdown chips over axis labels; boiler-plate ★★★ and "the chief risk is…"; dividend line on pre-revenue explorers; empty revenue chart; band price precision; 320px header wrap; odd axis ticks; `window.alert` on download failure; four benchmark lines on every stock; "Central Wall Street view" on AU/CA. (B-16…35, F-17)
- **Browse/search polish:** four stocks with no sector (incl. Macquarie); industry list ignores market; wide screens stretch rows; request error shown with a success tick; `/run` search silent on no match; `font-[var(--font-mono)]` compiles to a font-weight so JetBrains Mono never applies (decision #26, 22 uses); SQL-looking input → 503 + Sentry noise. (E-3, E-4, E-9, E-12…14, E-18, E-19, E-22)
- **Public polish:** "five hundred" vs 868; trial CTA drops Monthly/Annual; no skip link; High Conviction "rare" vs example; 404 page has no menu; signed-in readers can't reach the explainer; pricing toggle lost before hydration; lazy hero image; `#how-it-works` anchor; title case; long article title. (A-3, A-4, A-8, A-17, A-19, A-20, A-24, A-26, A-29…32, A-35)
- **Unsure — verify before acting:** BHP insider values (B-33), 84 US stocks at exactly 0.0% share change (B-34), 52-week gauge colours as direction (F-21), refer-a-friend phishing surface (D-17).

## 💡 Ideas worth the owner's time

Promise the trial-reminder email at checkout (F I-1) · link ⓘ tooltips to Learn and put Learn in
the signed-in sidebar (F I-2) · a "why this rating" breakdown in points (F I-3) · as-of dates per data
block (F I-4) · ratings in Browse for subscribers (E-21) · global search (E-20) · whole-universe
screen (C-34) · suggest `.AX`/`.TO` for unknown CSV codes (C-31) · name the horizon on the stock
page (B-37) · news relevance filter (B-38) · a free-vs-paid comparison and business identity on
`/pricing` (F I-6) · make Canada feel first-class (F I-5).

## What was checked and held

Paywall at the API and in the HTML for every non-entitled state (402 + `private, no-store`, no
premium keys) with positive controls; checkout guards; every upgrade entry point → one dialog with
the right price; Stripe test checkout text; 60 public links + sitemap all 200; robots; no sideways
scroll anywhere 320 → 2560 (except the garbage-CSV case); disclaimer above the fold on every rating
page; split handling; reporting-currency notices; the downloaded report; exports agree with each
other exactly; drawer focus in three engines; single `h1`s; 404s.

## Not covered

Real phones and real Safari; actual email delivery; the Stripe portal and resume flow; the
`billing_blocked` state; production speed (dev server); screen readers beyond the basics.

## 2026-10-07 — owner decisions, Stripe dispute audit, and the pre-merge audit

- **Deferred by the owner** until the rest is merged: the rating method (#5) and the "610 falls"
  wording/confidence (#7) — a full plan with real before/after runs across every preset,
  Custom included, comes first.
- **"Strong ★★★" / "Severe ★★★" tags removed** (B-23): they marked the first two lines by
  position, not by any measurement.
- **Stripe dispute audit** (owner: "doesn't trigger any disputes"). Code: deleting with a failed
  payment cancels at once; Checkout sessions expire after 30 min (double-subscription window);
  `/reactivate` honest under a dispute. Live Stripe settings (owner-approved): upcoming
  renewal events 30 days + the webhook listens to `invoice.upcoming`; shortened descriptor
  `MAJORCYCLE` + "trial over" statement text; portal downgrades wait for the period end;
  refund emails on. New email: **annual renewal reminder** (30 days ahead, annual plans only).
- **Pre-merge audit of this whole batch** found three defects, all fixed with tests:
  1. a portal downgrade now waits for the year end, so an annual customer's NEXT charge can
     be monthly — the account card said "A$19.00/year" and the renewal email would have said
     the annual plan renews for A$19 (`profiles.next_charge_plan`, read off the invoice);
  2. the dispute hold was per dispute, not per account — winning the first of a stolen card's
     several disputes unblocked the account and billed the card again (`billing_disputes`);
  3. the delete card told a failed-payment account its plan "ends now" before it had confirmed.
