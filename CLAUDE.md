# CLAUDE.md

> **READ THIS FIRST. Every session. Before any code.**
> If anything in this codebase conflicts with this file, **this file wins.**

This is the master brief for **MajorCycle** (`majorcycle.com`). Any AI assistant working on this project must read this top-to-bottom, then read the relevant doc in `/docs/` for the task at hand.

---

## 🎯 Mission

**MajorCycle** is a premium financial terminal that runs a proprietary **Major Cycle** analysis on US, Australian, and Canadian equities. Users discover where stocks sit relative to their historical drawdown/recovery cycles, alongside fundamental health scores, valuation positioning, and analyst data.

The product launches as a **web app** with a **signed-in free tier** and a **7-day free trial** that converts to a monthly or annual subscription.

**Free vs premium (F3 Step 10 — owner-agreed).** Signing up is free and takes **no card**: a free account keeps Browse, the price chart, the drawdown overlay *with its cycle bands*, and every fundamentals/sentiment section — *the data is free; our analysis is paid*. **Premium is our judgement**: Overall Rating, Health Score, the Verdict, the scorecard/radar, rating badges, the downloadable report, and the entire screener (`/run`, `/results`). The trial starts at Stripe Checkout, not at signup. The rule lives in `web/lib/entitlement.ts` and is described in `docs/architecture.md` §7.1 — read it before touching anything that renders a score.

**This is not a financial advice product.** It is an educational/informational analysis tool. All copy, labels, and disclaimers reflect this.

---

## 👤 Project Owner Profile (Important)

- **Solopreneur, non-coder**, based in Australia
- Builds entirely via Claude Code + MCP-controlled deployments
- **Cannot debug code manually** — every output must self-verify before being reported complete
- Time is the binding constraint, not money (though cost stays minimal)

When in doubt about any decision: **ask, don't guess.**

---

## 🛠 Tech Stack (Locked — Do Not Suggest Changes)

| Layer | Tech | Why |
|---|---|---|
| Frontend framework | Next.js **16** (App Router) + TypeScript | SEO via SSR, MCP-controlled via Vercel, best Claude Code support. *Scaffolded on 15; the installed version is **16.2.6** with React 19.2.4 — check `web/package.json` before relying on any version-specific API.* |
| Styling | Tailwind v4 + shadcn/ui | Standard pairing, components owned in-repo |
| Charts | Lightweight Charts (candlesticks) + Recharts (everything else) | TradingView-grade rendering, free |
| Backend (batch) | Python via GitHub Actions cron | Free, no always-on cost |
| Backend (on-demand) | Python via Vercel Serverless Functions | Free Hobby tier, 10s timeout |
| Data provider (P1) | yfinance | Free; abstracted behind `DataProvider` interface |
| Data provider (P2) | Financial Modeling Prep (FMP) API | Drop-in via the same interface |
| Database & Auth | Supabase (Postgres + Auth) | Free tier, MCP-controlled |
| Hosting | Vercel Hobby | $0, edge CDN, Python runtime |
| Email | Resend | 3,000/mo free, MCP-controlled |
| Payments | Stripe (subscription, 7-day trial) | Standard SaaS, MCP-controlled |
| Source | GitHub | Required for Actions + Vercel + Claude Code |
| Domain/DNS | Cloudflare | At-cost registrar, MCP-controlled |
| Error tracking (P2) | Sentry | Free tier sufficient |

---

## 📐 Repository Structure

```
/
├── CLAUDE.md                       ← THIS FILE — read first
├── README.md                       ← brief project intro for GitHub
├── reference/
│   └── original-design.html        ← VISUAL SOURCE OF TRUTH for UI tasks
├── docs/
│   ├── architecture.md             ← system diagrams, data flow, hosting
│   ├── design-system.md            ← colours, fonts, components, visual rules
│   ├── data-contracts.md           ← TS types, Python dataclasses, DB schema
│   ├── coding-standards.md         ← conventions, anti-patterns, file rules
│   ├── glossary.md                 ← every domain term defined once
│   └── roadmap.md                  ← Phase 1 / Phase 2 scope and build order
├── web/                            ← Next.js app (frontend + Vercel Python functions)
│   ├── app/                        ← App Router routes
│   │   └── api/                    ← Next.js TS route handlers (auth, light reads)
│   ├── api/                        ← Vercel Python serverless functions (api/cycle.py → /api/cycle)
│   ├── _engine/                    ← Vendored snapshot of analytics/ for the Python function
│   │   ├── major_cycle.py          ← (kept in sync with analytics/ via CI drift check)
│   │   ├── presets.py
│   │   ├── providers/base.py
│   │   └── scoring/{financial_health,valuation,overall}.py
│   ├── components/                 ← React components
│   ├── lib/                        ← utilities, DB client, types
│   ├── public/                     ← static assets, favicons, OG images
│   ├── requirements.txt            ← Python deps for the Vercel function bundle
│   └── vercel.json                 ← functions config (includeFiles, memory, maxDuration)
├── analytics/                      ← Python analysis (cron-runnable; canonical cycle math)
│   ├── major_cycle.py              ← cycle math (canonical — web/_engine/ mirrors this)
│   ├── providers/                  ← DataProvider abstraction
│   │   ├── base.py                 ← abstract interface — DO NOT BYPASS
│   │   ├── yfinance_provider.py    ← Phase 1 implementation
│   │   └── fmp_provider.py         ← Phase 2 stub
│   ├── scoring/                    ← health / valuation / overall rating
│   ├── cron/                       ← GitHub Actions runner scripts
│   ├── listings/                   ← free exchange symbol-directory fetchers (Request-a-Ticker menu)
│   ├── index_membership/           ← ETF-holdings fetchers (SPY/IOZ/XIU → index_membership table)
│   └── tests/
├── supabase/
│   └── migrations/                 ← versioned DB schema history (mirrors Supabase migration log)
├── .github/
│   └── workflows/                  ← daily cron + Vercel deploys + CI (includes _engine drift check)
└── .env.example                    ← documents every required env var
```

**Cycle math lives in two places by design.** `analytics/` is the canonical
home (cron runs it). `web/_engine/` is a vendored snapshot so the Vercel
Python function at `web/api/cycle.py` can import it locally (Vercel's
auto-install doesn't cleanly bundle code from outside the project root).
The two copies are kept in sync by a CI drift check that fails if they
diverge. **Edit `analytics/<file>.py` first**, then update the matching
`web/_engine/<file>.py` (with `from analytics.` rewritten to `from _engine.`),
in the same commit.

---

## ⚠️ Non-Negotiables

These rules cannot be bent. If a task seems to require breaking one, **stop and ask**.

### Visual & UX

1. **Visual parity rule.** Any UI section with an equivalent in `/reference/original-design.html` MUST visually match it: brand palette, fonts, spacing, layout, hover states, tooltips — all preserved. Open the reference before building UI. Match it.

2. **Rating labels.** The five tiers are **High Conviction / Constructive / Neutral / Cautious / Bearish**. Never use "Buy", "Sell", "Strong Buy", "Avoid" in our scoring outputs. (Wall Street analyst recommendations from yfinance display verbatim — that's third-party data, not our judgment.)

3. **Mobile first.** Every page must be responsive down to 375px. No horizontal scroll on phones.

4. **Disclaimer presence.** Any page that displays a rating, score, or signal must have an "Information only — not financial advice" disclaimer visible without scrolling.

### Code

5. **All chart instances declared once** in master state — never redeclare with a standalone `let`/`const`.

6. **Never use `Math.max(...arr)` / `Math.min(...arr)`** on large arrays (>10k items). Use `reduce()`.

7. **Never put HTML comments (`<!-- -->`) inside JavaScript template literals.** Browser parser breaks.

8. **CrosshairPlugin must guard against radar/doughnut/pie chart types** in `afterDraw` and `afterEvent` callbacks.

9. **DataProvider interface is sacred.** No code outside `analytics/providers/` may import `yfinance` directly. Phase 2 FMP migration must be a one-file change.

10. **Edit existing files with targeted edits only** — never rewrite a whole file unless explicitly asked.

11. **No `console.log`, no `print()`, no commented-out code** in committed files.

11a. **Never share-cache a response whose content varies by viewer.** `Cache-Control: public` / `s-maxage` is a **shared**-cache directive and Vercel's edge keys on the **URL alone** — so the first viewer's response is served to everyone else at that URL, *before your function runs*. That is an authorisation bypass, not a caching bug, and no in-function check can catch it. `/api/cycle` shipped exactly this while returning the full paid analysis (F3 Step 10, finding B1); it now sends `private, no-store`, and entitlement rides in the **query string** so the free and paid variants can never collide on one cache entry. If a response varies by viewer: put the varying dimension in the URL *and* keep the cache private, or use Next's server-side Data Cache. `pnpm check:entitlement-gates` fails CI if this regresses.

**It happened twice.** On 2026-07-29 the report-download route (`/stocks/[market]/[ticker]/report`) turned out to send **no `Cache-Control` at all** — on a response carrying the full scorecard — so its safety rested on Vercel happening not to cache it. Sending nothing is not the safe default; it is an unstated assumption about someone else's cache. **Every per-viewer response must say `private, no-store` explicitly**, including the refusals (our 402 names the caller's own denial reason). Note how it was found: an e2e assertion on the response header, written when the route became the report's only surface. Reading the code had not caught it, because the bug is a line that *isn't there*.

**And a third time, differently.** On 2026-07-30 `api/analyze.py` — the route returning a whole basket's paid analysis — turned out to send bare `no-store` rather than `private, no-store`. Vercel honours `no-store`, so nothing was ever exposed; the defect was that it was the **one** premium surface `pnpm check:entitlement-gates` did not assert, while it guarded the other three. Same root cause as the first two: **safe because of someone else's default, not because we said so.** The lesson has shifted from "say `private, no-store`" to "**say it AND guard it** — an unasserted header is one careless edit from being gone, and nothing will go red." The guard lives in the **`/api/analyze` section** of `scripts/check-entitlement-gates.mjs`, and it was verified to actually fail (weakened header → red; `s-maxage` injected → red) before being trusted. *(Cite guard sections by name, never by number: this sentence said "check 10" until 2026-08-01, when it turned out to mean the running total at the time of writing, which had since moved. The script now derives and prints its own count.)*

**A fourth time, and this one names the mechanism.** On 2026-08-01 `/api/portal` and `/api/checkout` turned out to send **no `Cache-Control` at all** — not a weak one, none — on payloads that are credential-equivalent and scoped to one customer: the portal's 303 `Location` is a live Customer Portal session granting that person's card, invoices and cancel button. Again nothing was exposed (Vercel caches only on `s-maxage`; both are POSTs), and again the safety was someone else's. **The mechanism to remember: Next attaches NO `Cache-Control` to route handlers.** Pages get `no-cache, must-revalidate` for free, so a habit formed on pages does not transfer, and "I didn't see a bad header" is not the same as "the header is right" — only **3 of 15** route handlers said anything. Read the wire, not the source. The guard is the **billing-endpoints section** of `scripts/check-entitlement-gates.mjs`, and it asserts the count of `headers: NO_STORE` **equals** the count of `NextResponse` returns, because one unguarded branch is the whole hole; it was proven to fail three ways before being trusted.

11b. **Withhold paid data at the data layer, not in the JSX — a hidden value is still shipped.** React serialises the props of client components into the RSC payload embedded in the HTML, so `{entitled && <Score value={cycle.overallRating} />}` hides the number on screen while the whole `cycle` object remains readable in View Source. Seen live on 2026-07-28: the page rendered `🔒 Unlock` while the source carried `"overallRating":60,"financialHealthScore":81`. **Strip restricted fields from the object before it can reach a client component** (`stripPremium()` in `web/lib/cycle.ts`), and treat the conditional render as presentation only. Every paid surface must require **two** things — the viewer's entitlement *and* the data's presence — so no single control failing open can expose the product. This bug class survives visual review precisely because the UI looks right: assert against the raw HTML, never against what's on screen.

11c. **One rule, one place. A rule written in two places drifts, and a third surface opts out of it by simply not being in either list.** Two instances, both found on the **live site** during the Layer F audit (2026-08-02) and both invisible to code review, because the defect is an omission rather than a wrong line. (i) `/pricing`, `UpgradeDialog` and `StartTrialModal` each kept a private list of "what a subscription includes"; when `/pricing`'s was corrected, the trial modal — **the last screen a reader sees before paying** — still sold three things a free account already had, while the dialog one click earlier listed the right four. Now one exported `PREMIUM_UNLOCKS` in `web/lib/pricing.ts`, and every line must name a field in `PREMIUM_FIELDS` or the screener. (ii) "Signed-out readers only" lived in `proxy.ts` (for `/login`, `/signup`) and again in `pricing/page.tsx`, so `/deletion-requested` — in neither — told **any** signed-in reader their account was scheduled for permanent deletion. Now one `SIGNED_OUT_ONLY_PATHS` list. **Being in `PUBLIC_PATHS` answers "may a signed-out reader in?", never "should a signed-in one see this?"** When you fix a claim on one surface, grep for every other surface making the same claim — and prefer extracting the constant over editing the words, or you have fixed the symptom and left the mechanism.

### Data & Compliance

12. **All scores, labels, and ratings shown to users MUST be accompanied by disclaimers** on the page. Educational/informational only. Not financial advice. ASIC-compliant.

13. **Currency display:** Stock prices always shown in the stock's home currency (USD/AUD/CAD). Subscription pricing shown in user's local currency.

14. **Ticker storage format:** Use yfinance native format internally (`AAPL`, `BHP.AX`, `SHOP.TO`, `ABC.V`). URL routing maps `/stocks/au/BHP` ↔ `BHP.AX`.

    **One rule, one table — `MARKET_SUFFIXES` in `web/lib/ticker.ts`.** This rule lived in *four* places until 2026-08-04 and two of them knew only `.AX`/`.TO`, so TSX Venture (`.V`) silently classified as **US**. Nothing errored; the stock just claimed to be American. The Python side (`_infer_market`, twice) is cross-checked against itself by `analytics/tests/test_market_inference.py`.

    ⚠️ **Canada has TWO suffixes, so `.V` KEEPS its suffix in the URL** (`/stocks/ca/ABC.V`). `.AX`/`.TO` are stripped because one market has exactly one suffix; strip `.V` the same way and `ABC.V` and `ABC.TO` collide on `/stocks/ca/ABC` and one resolves to **the other company's data**.

14a. **A daily bar's `date` is the exchange's OWN calendar date — never UTC.** yfinance stamps each bar at midnight in the exchange's timezone, so `tz_localize(None)` (drop the zone, keep local time) is correct and `tz_convert(None)` (to UTC first) is not. The difference is invisible for every exchange **west** of Greenwich and wrong for everything east: it stored **every ASX bar one day early, from inception to 2026-08-04** — 1,413,737 rows with **0 Fridays and 273,700 Sundays**, while US and Canadian data looked flawless. Even London (+1 under BST) was wrong. Guarded by `analytics/tests/test_no_utc_date_conversion.py`; the reasoning is in `data-contracts.md` (`PriceBar.date`).

14b. **A field's UNIT is declared once, in `analytics/providers/field_spec.py` — never in a comment beside a call site.** A mis-scaled number is still a plausible number, so neither review nor the type checker can see it. Three units were already learned the hard way and lived only as scattered comments: `dividendYield` arrives **already a percent** (×100 would make AAPL yield 35%), `debtToEquity` arrives **×100**, `payoutRatio` arrives as a **fraction**. Adding a `FundamentalsSnapshot` field without declaring its unit fails CI.

    ⚠️ **`0.0` from a provider is not always zero.** yfinance sends `grossMargins: 0.0` / `ebitdaMargins: 0.0` for every bank — meaning *not reported*. Scoring read that as a real 0%, the worst bucket, and marked **71 stocks** down for a metric that doesn't apply to them: 36 changed rating and **4 changed the label a customer reads** (C, WFC, SYF Neutral→Constructive; EQB.TO Cautious→Neutral). It also dragged the Financial Services peer median from 47.34% to 35.81%. `zero_means_na` covers **only the four margins** — a zero payout ratio, zero short interest and a debt-free balance sheet are all real, and 198 stocks genuinely pay no dividend. Applied on **write and on read**, so one bad row can't reach the scorer.

14c. **PostgREST returns at most 1000 rows and says nothing about it.** No error, no warning, no truncation flag — proven on the live DB, where an unpaginated read of `price_bars` (6.5M rows) returns 1000 and `listings` (8,964) is *already* silently truncated. This is a bug that arrives **with growth rather than with a commit**: the universe auto-expands on every reader's ticker request (#16), and `stocks` sat 133 rows from the cliff on 2026-08-05 with five unbounded reads — including the nightly refresh, which would simply have stopped enriching the overflow. Use `selectAll()` (`web/lib/supabase/paginate.ts`) or `_select_all()` (`daily_refresh.py`); `pnpm check:data-integrity` fails the build otherwise. Note where the fix had to come from: `daily_refresh.py` line 84 paginates *with a comment explaining the cap*, and line 489 in the same file on the same table did not. **The rule was written down; it just wasn't anywhere the second function could inherit it.**

14d. **The share-price currency is not the reporting currency.** `info['financialCurrency']` governs revenue, EBITDA, debt, cash, EPS and every statement blob; `info['currency']` governs the price, market cap and analyst targets. **79 of 858 stocks differ** — a fifth of the ASX names and a **third** of the Canadian ones (BHP.AX prices AUD / reports USD; A2M.AX reports NZD). We read only the price currency until 2026-08-05, so those statements rendered `A$` in front of US dollars, and `fcf_yield_pct` divided a USD numerator by an AUD denominator into the Financial Health score. Ask `statementCurrency(fundamentals)`, never `fundamentals.currency`; withhold a cross-currency ratio rather than publish it wrong. **A symbol alone is not enough** — in `en-US` the US dollar is a bare `$`, so a corrected BHP balance sheet reads `$15.7B` under a share price of `A$60.52` with nothing saying they differ (a gap of ~A$8B on that figure); `reportingCurrencyNote()` states it in words on the statement cards, and only when the two disagree. ⚠️ **This fix shipped INERT and only a screenshot caught it**: the field was added everywhere but left `null` on all 863 rows, and the fallback-to-price-currency is *correct*, so code, tests and guards all reported success while every page still showed `A$`. **When a fix depends on a new field, it is not done until that field is populated — assert on the rendered figure, not on the function that produces it.**

14f. **Don't "fix" the 52-week high.** It comes from Yahoo as a real traded price, and `WeekRangeGauge` compares it with today's real price — same basis, correct. Only the *historical chart line* is dividend-adjusted (deliberately: it makes returns comparable), which is why the drawn peak can sit ~2% under the printed high. **Owner decided 2026-08-05 to leave both alone** rather than invent our own figure and disagree with every broker a reader might cross-check.

14e. **The data pipeline is PINNED (`analytics/requirements-cron.txt`), and upgrading it is a PR.** `pip install "yfinance>=0.2.40"` in a nightly cron is an unreviewed deploy every night: an upstream release can change what a number *means* with no commit and nothing red. yfinance has already done it once (the `dividendYield` change above) — landing on a Tuesday, every yield on the site would have been 100× wrong by Wednesday. It was also drifting from dev unrecorded: the cron ran **1.5.2** while this machine had **1.3.0**. Because a pin only helps if you notice what the upgrade did, `analytics/cron/check_field_units.py` runs nightly and emails the owner when a field's **cohort median** leaves its declared band — the only instrument that sees a unit change, since every individual value still looks ordinary.

15. **Pre-computation policy:** Store raw price history + fundamentals only. Cycle math runs on demand. Never store rating outputs in the DB — they're always derived.

16. **Universe model:** Pre-seeded + auto-expanding. If a user uploads a ticker not in our universe, fetch it live, cache it forever, return results.

### Workflow

17. **Self-verification before "done".** Run the appropriate command (`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pytest`) and show passing output before reporting complete.

18. **Zero tolerance on errors.** Zero TypeScript errors. Zero ESLint errors. Zero Python type errors. No warnings ignored.

19. **Never commit secrets.** All sensitive values live in `.env.local` (dev) or Vercel/GitHub Secrets (prod). Document required vars in `.env.example`.

---

## ✅ Before You Start ANY Task — Mandatory Checklist

- [ ] Read this file (CLAUDE.md)
- [ ] Read `docs/architecture.md` if the task touches system structure or data flow
- [ ] Read `docs/design-system.md` if the task touches UI
- [ ] Read `docs/data-contracts.md` if the task involves data shapes or types
- [ ] Read `docs/coding-standards.md` if writing new files or refactoring
- [ ] Check `docs/glossary.md` if you hit an unfamiliar domain term
- [ ] Open `/reference/original-design.html` if implementing UI that exists there
- [ ] Confirm the task is in current Phase scope per `docs/roadmap.md`

---

## 🤝 How To Work With This Project Owner

- The owner is **non-technical**. Explain trade-offs in plain language. Avoid jargon, or define it inline.
- The owner **cannot debug**. If something might break in production, build a safety net (try/catch, fallback UI, logging).
- The owner uses **MCP-controlled deployments**. When suggesting changes, prefer MCP-friendly approaches.
- The owner **owns the strategy**. Don't suggest scope creep. Don't add features. Stay in the lane defined by `docs/roadmap.md`.
- The owner **expects evidence**. Don't say "fixed it" — show the before/after, the passing test, the screenshot.
- When in doubt, **ask one clear question**. Don't bombard with options.

---

## 📊 The 34 Locked Decisions (The Contract)

These were agreed during planning. Do not relitigate.

| # | Decision | Value |
|---|---|---|
| 1 | Frontend framework | Next.js App Router + TypeScript + Tailwind v4 + shadcn/ui (scaffolded on 15, now on **16.2.6**) |
| 2 | Charts | Lightweight Charts (candlesticks), Recharts (rest) |
| 3 | Backend | Hybrid — Vercel Python serverless + GitHub Actions cron |
| 4 | Database & Auth | Supabase free tier |
| 5 | Hosting | Vercel Hobby ($0) |
| 6 | Domain registrar | Cloudflare (name TBD post-MCP setup) |
| 7 | Source control | GitHub |
| 8 | Transactional email | Resend (3,000/mo free) |
| 9 | Payments | Stripe (subscription with `trial_period_days=7`) |
| 10 | Data provider | yfinance Phase 1 via DataProvider interface → FMP Phase 2 |
| 11 | Geography | US + AU + CA equities (S&P 500, ASX 200, S&P/TSX 60) |
| 12 | Universe model | Pre-seeded + auto-expanding |
| 13 | URL structure | `/stocks/[market]/[ticker]` e.g. `/stocks/us/AAPL` |
| 14 | Pre-computation policy | Store raw price history + fundamentals only |
| 15 | Run Analysis presets | Short (-3/+3/63), Medium (-5/+5/252), Long (-8/+8/756), Custom |
| 16 | Rating labels | High Conviction / Constructive / Neutral / Cautious / Bearish |
| 17 | Analyst recommendations | Keep verbatim (third-party data) |
| 18 | Pricing | US$15/mo, AU$19/mo, CA$20/mo. Annual ~30% off. No usage limits. |
| 19 | Trial | 7 days, card required upfront, auto-converts |
| 20 | Trial-end UX | 3-day grace period on payment failure, then hard lock |
| 21 | Refunds | None — standard SaaS |
| 22 | Auth methods | Email/password + Google OAuth |
| 23 | First-login flow | Methodology + disclaimer acknowledgement modal |
| 24 | Compliance posture | Educational/informational only; disclaimers appropriate but not heavy |
| 25 | Brand colours | Deep #1A3A6E / Mid #1E5CB3 / Bright #2E7DE8 |
| 26 | Fonts | Sora (UI), JetBrains Mono (numbers/code) |
| 27 | App name & logo | **MajorCycle** · domain `majorcycle.com` · logo = `reference/logo.png` (navy rounded-square "M" mark). Served as `web/public/logo.png` (in-app, via `next/image`) + favicon `web/app/icon.png` / `favicon.ico`. The asset copies are cropped tight to the icon; `reference/logo.png` is the pristine source — don't overwrite it. |
| 28 | Mobile | Mobile-first responsive |
| 29 | Phase 1 launch scope | All 14 Stock Detail sections from current HTML + 3 existing tabs + Methodology/Contact/Disclaimer/Terms + Auth |
| 30 | Phase 2 | Smart Money Activity, watchlists, alerts, sector heatmaps, FMP migration |
| 31 | Repo structure | Monorepo: `/web` + `/analytics` + `/docs` + `/reference` |
| 32 | Cron schedule | **Two daily runs — AU 08:00 UTC, US+CA 22:30 UTC.** This cell read "Daily 23:00 UTC (after all three markets close)" until 2026-08-04; the parenthetical was never achievable. The ASX starts taking next-day orders at 07:00 Sydney (20:00–21:00 UTC) and New York closes at 20:00–21:00 UTC, so **no single time is after every close** — the one run landed inside the ASX pre-open and stored partial bars. Owner-approved split; don't re-merge them |
| 33 | Performance target | Lighthouse 90+ on per-ticker pages |
| 34 | Methodology content | Generated post-build from Python logic, owner refines |

---

## 🚨 What To Do If Something Goes Wrong

1. **Type/lint/build error:** Fix it before reporting complete. Never report a task done with a red CI.
2. **Logic uncertainty:** Ask the owner with one specific question. Don't guess.
3. **Spec conflict between docs:** This file (CLAUDE.md) wins → then `docs/roadmap.md` → then everything else.
4. **Reference HTML missing for a screen:** It's a new screen — design from `docs/design-system.md`.
5. **yfinance rate-limited / down:** Use the Stooq fallback already in `analytics/providers/yfinance_provider.py`. Don't switch to a paid API. Log and surface.
6. **Schema change needed:** Update `docs/data-contracts.md` first. Then code.
7. **You disagree with a decision:** Say so explicitly. The owner welcomes pushback with reasoning.

---

## 📞 Pointers

- Mission, decisions, non-negotiables → **this file**
- Phased scope and build order → `docs/roadmap.md`
- Visual specifications → `docs/design-system.md`
- Data shapes and provider interface → `docs/data-contracts.md`
- File-naming, anti-patterns, conventions → `docs/coding-standards.md`
- Domain vocabulary → `docs/glossary.md`
- System diagrams and infrastructure → `docs/architecture.md`
- Original UI source of truth → `/reference/original-design.html`

---

**End of CLAUDE.md. Now go read whichever `/docs/` file applies to your current task.**
