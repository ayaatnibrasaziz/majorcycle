# Glossary

> **Purpose:** Every domain term used in `MajorCycle` is defined here exactly once. When you encounter an unfamiliar term in code, copy, or conversation, this is where you look it up. When you add a new term, add its definition here in the same commit.
>
> See also: `data-contracts.md` (for type definitions of these concepts).

---

## A

**Analyst Consensus** — The aggregate recommendation from all covering Wall Street analysts, sourced from Yahoo Finance via yfinance. Values: `Strong Buy`, `Buy`, `Hold`, `Sell`, `Strong Sell`. **Displayed verbatim** in the UI — this is third-party data, not our judgment, so it's exempt from the neutral-label rule.

**Analyst Target Price** — The mean 12-month price target set by Wall Street analysts. Used to compute Implied Upside.

**ASIC** — Australian Securities and Investments Commission. Regulator we are NOT licensed by. All copy must respect the line between "general information / education" and "personal financial advice".

**ASX 200** — The 200 largest publicly listed companies on the Australian Securities Exchange. One of three universes we cover in Phase 1.

---

## B

**Batch tier** — Tier 1 of the architecture. Scheduled GitHub Actions cron job that pre-fetches yfinance data nightly. See `architecture.md` §2.

**Bearish** — The lowest of the five rating tiers (score 0-34). Indicates significant concerns. Replaces the original "AVOID" label.

**Beta** — Statistical measure of a stock's volatility relative to the broader market. Beta > 1 = more volatile than market, Beta < 1 = less volatile. Sourced from yfinance.

---

## C

**Canonical URL** — The one address we declare to be a page's *real* address, so search engines don't treat `majorcycle.com/pricing` and `www.majorcycle.com/pricing` as two competing pages and split the credit between them. Ours is always `https://www.majorcycle.com/…`, absolute (Google warns relative ones "cause problems in the long run"), self-referencing on every public page, and generated from the single `SITE_ORIGIN` constant in `web/lib/url.ts`. ⚠️ A canonical is a *statement*, not an instruction — the server must agree with it. As of 2026-08-07 the bare domain still 307s (**temporarily**) to `www`, which tells Google the opposite; see `roadmap.md` Layer G. See `architecture.md` §11.

**Card** — The standard UI container: white surface, subtle border, slight shadow. See `design-system.md` §9.

**Contrast ratio** — How far apart two colours are in lightness, expressed as a ratio. Text needs **4.5:1** against its background to be readable by most people (**3:1** if it is large). ⚠️ Measured on the live site 2026-08-07: **8 elements fail**, including the **rating tier badges at 2.38:1** — the five labels that are the product's whole vocabulary — and the **"Full disclaimer" link at 2.69:1**, which is compliance-adjacent copy. Those two are fixed inside Layer G; the rest go to Layer H. See `design-system.md` §14.

**Crawler** — An automated program that reads web pages, e.g. Googlebot. Three kinds matter to us and we treat them differently in `robots.txt`: **search** crawlers (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`) that cite us and send readers — allowed; **user-triggered** fetchers (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) that load a page because a real person asked an assistant about it — allowed, since that person is a potential customer; and **training** crawlers (`GPTBot`, `ClaudeBot`, `Google-Extended`) that copy content into models — blocked. ⚠️ Crawler groups **do not inherit**: a crawler matching a named group ignores the `*` group entirely, so any bot we want covered must be named. Blocking `Google-Extended` has **no** effect on Google Search ranking.

**Cautious** — Rating tier 4 (score 35-49). Indicates elevated risk. Replaces the original "HOLD" label.

**Cohort Tripwire** — `analytics/cron/check_field_units.py`, run nightly after the refresh. It compares each fundamentals field's **median across the whole universe** against the band declared beside its unit in `field_spec.py`, and emails the owner on a breach. It exists because a units change is invisible per value and obvious across 863: `0.024` is a fine dividend yield for one stock and impossible as the median. ⚠️ **It is deliberately blind to a single wrong stock** — a 35% yield is real and rejecting outliers would discard true data. Catching one bad stock needs a per-stock cross-check against the provider's own derived figure, which is **not built** and is **owner-deferred to after the remaining layers** — its full design is in `data-audit.md` § *Deferred — the per-stock number check*. It also carries three per-row **invariants**, whose *names* it prints rather than a count.

**Constructive** — Rating tier 2 (score 65-79). Indicates a favourable setup. Replaces the original "BUY" label.

**Current Drawdown** — How far the current price has fallen from the peak inside the lookback window. Always a negative number (or zero). E.g. "-18%" means the stock is 18% below its recent high.

**Current Profit** — How far the current price has recovered from the trough inside the lookback window. Always a positive number (or zero).

**Custom SMTP** — Supabase Auth's setting to send auth emails through an external SMTP provider instead of Supabase's shared sender. MajorCycle points it at **Resend** (`smtp.resend.com:465`, user `resend`, password = a Resend API key) so auth mail is sent from `noreply@majorcycle.com`. Free on the Supabase free tier; part of the Layer F0 de-Supabase-ification. See `architecture.md` §7.

**Cycle** — In Major Cycle terminology, one complete drawdown-and-recovery loop: peak → trough → next peak.

**Cycle Analysis** — The full output of `major_cycle.py` for a given ticker + params. See `CycleAnalysis` dataclass in `data-contracts.md`.

**Cycle Endpoint** — `/api/cycle?ticker=X&preset=medium` — the Vercel Python serverless function at `web/api/cycle.py` that computes one ticker's Major Cycle on demand. Reads from Supabase (never yfinance), runs the cycle math via the vendored `web/_engine/` package, returns `CycleAnalysis` JSON. Called by every Stock Detail page render.

**Cycle Horizon** — The user-facing name for the **Preset** as chosen on the Browse page (`/stocks`): **Short** (≈3 months), **Medium** (≈1 year, the default), **Long** (≈3 years). Picked *before* opening a stock; carried into the Stock Detail page via a `?preset=` query param, which sets the lookback window the Major Cycle (and the Drawdown/Profit curve) is computed over. There is no horizon control on the Stock Detail page itself — only a read-only indicator when a non-default horizon is active. `Custom` is deferred to Layer D.

**Cycle Params** — The three values that govern a Major Cycle run: pullback threshold, profit threshold, lookback bars. Set by user via presets or custom input.

**Cycle Payoff Score** — A 0-100 sub-score for the Overall Rating (25% weight): 50% from the count of historical pivot events (calibration confidence) and 50% from the reward/risk ratio (typical profit ÷ |typical drawdown|). **Formerly called "Momentum Score"** — renamed in S3 because it contains no price-trend/momentum signal. Computed in `analytics/scoring/overall.py` (field `cycle_payoff_score`).

---

## D

**Data Provider** — Abstract interface in `analytics/providers/base.py` that defines the contract for any data source. Phase 1 implements `YFinanceProvider`. Phase 2 adds `FMPProvider`. No code outside `analytics/providers/` may bypass this.

**DataFrame** — A pandas DataFrame. Used internally in Python for OHLCV time series. Never crosses an API boundary — always serialised to plain JSON first.

**DEEP VALUE** — Valuation Zone label when current drawdown ≤ lower bound (at or beyond worst-ever pullback). Replaces "STRONG BUY".

**Deletion confinement** — The rule that an account with `deletion_scheduled_at` set may use exactly one surface, `/reactivate`, and nothing else. Requesting deletion signs the user out on **every** device and deactivates the account for the whole 30-day grace window; confinement is what makes that true for anyone who signs back in. It is evaluated **before** the **Entitlement gate** everywhere, because offering to sell a plan to someone whose account is being deleted answers the wrong question — and they may already have paid. Pages redirect to `/reactivate`; the self-gating route handlers answer **403 `account_deleting`** (`/report`, `/api/analyze*`, `/api/checkout`) or **303 `/reactivate`** (`/api/portal`). Never 402. The route-handler half was missing until live-check Session 3 (2026-08-01), when a deletion-scheduled *subscriber* was found still able to pull the full paid report, the full screener payload, and a live Stripe Customer Portal session — the last of which could have charged them and un-cancelled the subscription the delete flow had just stopped. See `architecture.md` §7.1.

**Dead-link notice** — The single sentence `/login` shows when someone arrives from an expired, already-used or invalid auth link: *“That link has expired or has already been used. Enter your email to get a new one.”* `/auth/callback` and `/auth/confirm` had always emitted `?error=…` on failure and `LoginForm` had never read it, so the app worked out the diagnosis and discarded it — the reader got a blank sign-in form. Driven by an **allow-list** of four codes (ours in the query string, Supabase's `otp_expired`/`access_denied` in the URL hash); the provider's own wording is never rendered, because anyone can put text in a URL and a stranger's sentence in our error styling reads as ours. The hash is read with `useSyncExternalStore`, since a fragment is never transmitted to the server and only a client component can see it. Added Layer G, 2026-08-12. See `architecture.md` §12(i).

**Deletion notice marker** (`mc_deletion_notice`) — The httpOnly cookie that lets `/deletion-requested` tell the person who just deleted their account from a stranger who typed the URL. Set by `requestAccountDeletion` immediately before it redirects, enforced in `proxy.ts`. Necessary because the deletion action's last act is a **global** sign-out, so the confirmation page has no session to read — "signed out" is the only thing it could otherwise know, and that is true of everyone. Carries **no user data**, is path-scoped to that one page, lasts 30 minutes, and is deliberately **not** consumed on first read (a one-shot marker would bounce anyone who refreshed). Distinct from the **Recovery marker**: this one *permits* a page to a reader with no session; that one *restricts* where a live session may go. Added Layer G, 2026-08-12. See `architecture.md` §6.5 and CLAUDE.md 11f.

**Dispute (chargeback)** — When a cardholder asks their bank to reverse a charge. Stripe sends `charge.dispute.*` webhooks; a *real* chargeback (funds withdrawn, not a mere inquiry) sets `billing_blocked = true` on the account. An **inquiry** is the pre-dispute stage some networks use (Amex, Discover) where no money has moved; in the API its `status` is prefixed `warning_` (`warning_needs_response`, `warning_under_review`, `warning_closed`), and our handler deliberately does **not** lock on it — locking would revoke a paying customer's access over a question. If we lose (`closed`, status not `won`) we keep access revoked and cancel the subscription; if we win, access is restored. See `docs/data-contracts.md` §10.

**Dunning** — The process of chasing a failed subscription payment: a first renewal failure sets the account `past_due`, starts the 3-day grace clock (`grace_until`), and sends the branded "payment failed / update your card" email. Covers both a decline (`invoice.payment_failed`) and a needed 3-D Secure authentication (`invoice.payment_action_required`). See Grace period, Smart Retries.

**DMA (Daily Moving Average)** — Rolling average of closing prices over N days. The app uses 50-day and 200-day DMAs overlaid on price charts.

**Drawdown** — A peak-to-trough decline expressed as a percentage. Negative number. See also Current Drawdown, Lower Bound, Typical Drawdown.

---

## E

**Earnings Calendar** — A planned Phase 2 UI feature showing upcoming earnings dates across the universe. The underlying data (`next_earnings_date` per ticker) is already collected in Phase 1 via `t.calendar` from yfinance and stored in `stocks.next_earnings_date`.

**Email Routing (Cloudflare)** — Free Cloudflare feature that **receives** mail for a domain and forwards it to a verified destination (no mailbox hosting). MajorCycle uses it for `security@majorcycle.com` → owner Gmail (root `majorcycle.com` MX → `route1/2/3.mx.cloudflare.net`). It cannot **send** — receiving-only — so it coexists with Resend (which sends on the `send.` subdomain). Owner replies go out via a Gmail **"Send mail as"** identity relaying through Resend SMTP. See `architecture.md` §7.

**Earnings Growth YoY** — Year-over-year change in net earnings per share. Sourced from yfinance.

**Entitlement gate** — The single rule deciding whether a viewer may see premium content, in `web/lib/entitlement.ts` (F3 Step 10). `billing_blocked` denies outright (a dispute lock outranks everything); `active`/`trialing` allow; `past_due` allows only inside `grace_until`; `canceled`, `null` and anything unrecognised deny. **Fails closed** — a missing profile or an unreadable row denies. Deliberately the opposite posture to the trial guard and the free-view fence, which fail *open*: giving premium away costs revenue, whereas a wrongly-denied view is visible and recoverable. Enforced at three layers — pages (`requirePremiumPage()`, whose caller returns the in-app **locked panel** in place; from 2026-07-29 a signed-in reader is never redirected to the public `/pricing` page), APIs (`proxy.ts` → **402**), and the Python functions (authoritative: they strip the premium keys). Two further locks were added on 2026-07-28: `fetchCycleAnalysis` **re-strips** the same keys on the way in when unentitled (because a value passed to a client component is serialised into the page source even when it is never rendered), and every premium surface now requires the viewer's entitlement **and** the data's presence, so no single control failing open exposes the product. See `architecture.md` §7.1 and CLAUDE.md rules 11a/11b.

**Enriched Data** — The extended dataset fetched per ticker beyond price bars and fundamentals: income statements (annual + quarterly), balance sheets, cashflow statements, earnings history, top institutional holders, insider transactions, analyst upgrades/downgrades, PE history, and company overview. Stored as JSONB columns in the `stocks` table. Fetched selectively by the smart refresh pipeline — only when the staleness check fires. See `EnrichedData` dataclass in `data-contracts.md` §2.

**EBITDA** — Earnings Before Interest, Taxes, Depreciation, and Amortisation. A measure of operating profitability.

**EBITDA Margin** — EBITDA ÷ Revenue × 100. Higher = more profitable operations.

**EV/EBITDA** — Enterprise Value ÷ EBITDA. Valuation multiple. Lower = cheaper relative to operating profitability.

---

## F

**FAIR** — Valuation Zone label when current drawdown sits between 0.5×typical and -5% (mild pullback, not yet attractive). Replaces "WATCH".

**FCF Yield** — Free Cash Flow ÷ Market Cap × 100. A measure of how much cash a company generates relative to its market price. Higher = better.

**Financial Health Score (FH)** — Composite 0-100 score = the **weighted average** of five sub-pillars: **Profitability 30% · Balance Sheet 25% · Growth 20% · Cash Flow 15% · Shareholder 10%**. Each pillar is itself the plain mean of its metric sub-scores (each a banded step function — see `analytics/scoring/financial_health.py`). Weighted at 40% in the Overall Rating. **(S3)** A pillar with no usable inputs is omitted (not fabricated as 50) and the remaining pillar weights are renormalised; if fewer than 3 pillars have data the score is **withheld** (`null`, shown as insufficient data) — common for banks/REITs whose balance-sheet and cash-flow fields are absent. **(S9)** The Scorecard surfaces the weighting (card tooltip) and colours each pillar by its score tier; the weights are *not* a plain average, so the headline can differ from eyeballing the five bars equally.

**FMP (Financial Modeling Prep)** — Paid data provider planned for Phase 2 migration. Drop-in replacement for yfinance via the DataProvider interface.

**Free Cashflow** — Operating cashflow minus capital expenditures. The cash a business generates after maintaining its operations.

**Upgrade dialog** — `web/components/UpgradeDialog.tsx` (F3 Step 10). The modal every lock opens instead of navigating to `/pricing`, so the reader keeps the stock they were deciding about. Names the feature, explains **what it is** in plain language, lists what else a subscription includes, then hands off to the **Start-free-trial modal**. Shows **no price**: currency, trial-vs-billed-today and the already-used-trial case stay resolved server-side, so there is one source of truth for the thing that must never be wrong. `/api/billing-context` supplies only the CTA label; if it fails the button falls back to `/account` (never the public `/pricing` page — a signed-in reader must not be dropped somewhere that reads as signed-out).

**Locked panel** — `web/components/PremiumLockPage.tsx` (F3 Step 10, 2026-07-29). What a whole premium page (`/run`, `/results`) shows an unentitled viewer *instead of redirecting them away*. The route, the sidebar, the header and the account menu all stay, so hitting the paywall never resembles being logged out; the explanation opens in the same **Upgrade dialog** every other lock uses. Its copy names what actually happened (trial ended / payment failed / account on hold), and on a dispute hold the CTA becomes **Contact support** rather than a buy button, because `/api/checkout` and `/api/portal` both refuse a held account. Because `requirePremiumPage()` only *reports* entitlement, the page's early `return <PremiumLockPage…>` is the actual enforcement — and it must precede any premium fetch. See `architecture.md` §7.1.

**Checkout reconciler** — `reconcileCheckoutSession()` in `web/lib/billing/reconcileCheckout.ts` (F3 Step 10, 2026-07-29). Runs on `/account?checkout=success&session_id=…` and provisions the subscription immediately, instead of waiting for the webhook. It exists because Stripe holds the post-payment redirect for our webhook's 2xx **only 10 seconds** — after that a paying customer would land on a page saying "No plan". Not a second source of truth: it re-retrieves the subscription from Stripe and runs the *same* `syncSubscription()` the webhook runs (hence `web/lib/billing/sync.ts`). `session_id` comes from the URL bar so it is never trusted — the session is fetched and refused unless its own `client_reference_id` matches the caller. The webhook remains the guarantee; this only removes the wait.

**Free tier** — A signed-in account with no live subscription (F3 Step 10). Keeps Browse + search, the price chart, technical levels, the drawdown overlay **including the cycle bands**, the company overview, and **every** fundamentals/sentiment section (those read the `stocks` table, not the cycle engine — "the data is free; our analysis is paid"). Does **not** get the Overall Rating, Health Score, Verdict, scorecard/radar, rating badges, the downloadable report, or the screener (`/run`, `/results`) at all. Subject to the **Free-view fence**.

**Free-view fence** — The anti-scraping cap on the free tier: **25 distinct tickers per UTC day** (`FREE_VIEW_DAILY_LIMIT`). Counts a *set of tickers*, not page loads, so a refresh, a back-navigation or a `next/link` prefetch never costs quota; re-opening a stock seen earlier the same day is always free. Applied by the `record_free_view` Postgres function under a row lock (a read-then-write in app code would lose count under exactly the concurrent traffic a scraper generates). **Fails open** — it is a fence, not the paywall, and premium fields are already stripped from every response a free user gets. Subscribers are never counted (locked decision #18). See `data-contracts.md` §10.

**Export Parity** — The `.csv` and the `.xlsx` offered from one Results run must show the **same figure**, and the same figure the screen shows. Enforced by having one rounding rule rather than three: `exportText` (`lib/ratings.ts`) formats with the screen's `Intl.NumberFormat`, and `cellValue` (`lib/xlsx.ts`) *parses its numeric cell back out of that string* instead of rounding again — so the workbook cannot drift from the CSV even in principle. They disagreed by a cent on ~4% of values until 2026-08-06, because `toFixed` and `Math.round` round the **binary double** (a hair below a half-cent) while `Intl` rounds the decimal the reader sees. Guarded by `e2e/export-parity.spec.ts`, which imports both real functions. See CLAUDE.md 11c (iii).

**Fundamentals Snapshot** — The canonical fundamentals data shape returned by any DataProvider. Defined in `data-contracts.md` §2.

---

## G

**Grace period (billing)** — The 3-day window (`grace_until` = now + 3 days) after a subscription payment first fails, during which the member keeps access while they update their card. Set once on the first failure and cleared on recovery (or on cancellation). Distinct from the 30-day account-deletion grace. After it lapses, a still-`past_due` account is hard-locked by the **Entitlement gate**.

**Gross Margin** — Gross Profit ÷ Revenue × 100. The fundamental profitability of a product/service before operating costs.

---

## H

**High Conviction** — The highest of the five rating tiers (score 80-100). Replaces the original "STRONG BUY" label.

---

## I

**Implied Upside** — `(analyst target price - current price) / current price × 100`. Positive = analysts see room to rise; negative = stock trades above target.

**Insider Ownership %** — Percentage of shares held by company insiders (executives, directors). Sourced from yfinance.

**Insufficient Data** — The explicit state used (S3) when a score can't be honestly computed: a Financial Health pillar with no inputs is omitted; FH is withheld (`null`) when fewer than 3 of 5 pillars have data; no fundamentals at all → cycle-only Overall Rating. Replaces the old behaviour of fabricating a "neutral 50". Surfaced in the UI (e.g. the Scorecard radar shows a "not scored" caption and "—" pillars instead of a misleading zero).

**Institutional Ownership %** — Percentage of shares held by institutional investors (mutual funds, pension funds, ETFs). Sourced from yfinance.

**Interest Coverage** — EBIT ÷ Interest Expense. Measures how easily a company can pay interest on its debt. Higher = safer.

---

## L

**Lookback Bars** — The number of daily price bars used to compute "current" drawdown and profit. One of the three Cycle Params. 63 = ~3 months, 252 = ~1 year, 756 = ~3 years.

**Lower Bound** — The deepest **confirmed** pullback event in the stock's history (`min` of the pivot-low drawdowns, computed over the *full* history — see the warmup note under Pivot). It is the deepest dip we've *confirmed*, not necessarily the deepest price ever touched: a sharp one-day spike that never satisfied the pivot confirmation, or the **current still-forming dip** (no right-side bars yet), can run *below* this line. That's why the live drawdown curve can pierce below the Lower Bound — intended behaviour. Feeds scoring only via Valuation's "drawdown ≤ Lower Bound → score 100" rule; it does **not** feed Cycle Payoff.

---

## M

**Major Cycle** — Our proprietary methodology: detect pullback and profit events across a stock's price history via pivot detection, compute typical and extreme dip/recovery magnitudes, score current state against those historical norms. The "engine" of the product.

**Market** — One of `us`, `au`, `ca`. Determines exchange, currency, and URL prefix.

**Market Cap** — Market Capitalization. Share price × shares outstanding.

**Momentum Score** — Former name for the **Cycle Payoff Score** (see C). Renamed in S3 — the component never measured price momentum (no trend/rate-of-change input). Do not reintroduce the term in user-facing copy.

---

## N

**Net Margin** — Net Income ÷ Revenue × 100. The "bottom line" — how many cents of profit are kept from each dollar of sales.

**noindex** — A tag telling search engines "you may read this page, but do not list it in results". Used on `/login`, `/signup`, `/reset-password` and `/deletion-requested` — pages that work fine but would be meaningless in a search result. ⚠️ **Never combine `noindex` with a `robots.txt` block on the same page.** Blocking stops the page being fetched at all, so the `noindex` is never read, and the address can still be listed from a link found elsewhere. They are alternatives, not reinforcements. `robots.ts` fails the build if the two lists ever contradict.

**Neutral** — Rating tier 3 (score 50-64). Mixed signal. Same label as the original UI.

**News Item** — A single news article entry: title, URL, publish date, source. Stored in `stocks.news` JSONB column. Sourced from yfinance in Phase 1; quality is mediocre.

**Not-Reported Sentinel** — A provider value that *looks* like data but means "this doesn't apply". yfinance returns `grossMargins`/`ebitdaMargins` as exactly **`0.0`** for every bank and pre-revenue explorer. Scoring read those as a real, terrible 0% and marked **71 stocks** down — 36 changed rating and **4 changed the label a customer reads**. Declared via `zero_means_na` in `analytics/providers/field_spec.py` and applied on write *and* read. ⚠️ Deliberately narrow — only the four margins. A zero payout ratio, zero short interest and a debt-free balance sheet are all genuinely zero, and 198 stocks really do pay no dividend.

**next_earnings_date** — The next scheduled earnings report date for a ticker, sourced from `yfinance.Ticker.calendar`. Stored in `stocks.next_earnings_date` (DATE column). Used by the smart refresh pipeline to know when enriched data is stale. Also the data source for the future Earnings Calendar UI. Returns `None` for many ASX stocks where yfinance doesn't publish calendar data.

---

## O

**OHLCV** — Open, High, Low, Close, Volume. The five canonical fields of a daily price bar.

**Open Graph** — The tags that decide what a link looks like when it's pasted into WhatsApp, LinkedIn, Slack or a message: title, description, address, and an image. Set on all 10 public pages by `pageMetadata()` in `web/lib/seo.ts`. ⚠️ **We ship no `og:image` yet**, so a shared MajorCycle link currently renders as a bare card — open, and scheduled for the design session. `twitter:card` is deliberately `summary` (not `summary_large_image`) until an image exists, because claiming an image we don't have renders broken.

**Offline Report Bundle** — `web/report-bundle/`, compiled by **esbuild** (not Next) in `prebuild` into `public/report-bundle/report.js` + `.css`. "Download Report" wraps those with one stock's JSON into a single self-contained `.html` that runs from `file://` with no network. **It is a second build of the same components, and therefore a second product**: source-reading checks (typecheck, lint, the paywall and report-section guards) can all be green while the downloaded file is blank — which it was, for every stock, from 2026-08-01 to 2026-08-05. Guarded by `e2e/report-download.spec.ts`, which downloads the real file and opens it over `file://`. See CLAUDE.md 11d.

**On-Demand tier** — Tier 3 of the architecture. User-triggered analyses via `/api/analyze` endpoint. See `architecture.md` §2.

**Operating Cashflow** — Cash generated from a company's normal business operations. Distinct from net income (which includes non-cash items).

**Overall Label** — One of: High Conviction, Constructive, Neutral, Cautious, Bearish. Derived from Overall Rating.

**Overall Rating** — Composite 0-100 score combining Financial Health (40%), Valuation Zone score (35%), and Cycle Payoff (25%). When Financial Health is withheld (insufficient data), the rating is computed on the price cycle alone (valuation + cycle payoff, renormalised) rather than assuming a fabricated 50.

---

## P

**Payout Ratio** — Dividends Paid ÷ Net Income × 100. How much of earnings is returned to shareholders as dividends. >100% means the company is paying out more than it earns (unsustainable).

**P/E (Price-to-Earnings)** — Share price ÷ earnings per share. Trailing P/E uses last 12 months earnings; Forward P/E uses analyst estimates.

**PEG (P/E to Growth)** — P/E ÷ earnings growth rate. < 1 generally considered attractive (growth justifies the P/E).

**Pivot High / Pivot Low** — A local maximum or minimum in the drawdown/profit series, **confirmed** by `PIVOT_BARS` (default 5) bars on *each* side being strictly less extreme (the trough/peak is flanked by 5 shallower days before and 5 after). This is how a dip/rally becomes a *counted* cycle event (feeding Typical, Bound, and the event count). Two consequences: (1) a one-day spike that immediately reverses won't confirm; (2) the **current, still-forming** move can't confirm until the price reverses and holds for ~5 bars (there are no right-side bars yet), so it's drawn on the chart but not yet counted. A counted event must also cross the horizon's threshold (−3% short / −5% medium / −8% long). **Warmup note:** `ta_highest`/`ta_lowest` use `min_periods=1` (since C-R6), so a stock's first lookback window is measured too (matching Pine `ta.highest` and the client drawdown curve) — earlier the first ~252/756 bars were blanked and their dips never evaluated.

**Preset** — One of the three Run Analysis presets — `short`, `medium`, `long` — each specifying a pullback threshold, profit threshold, and lookback. Plus `custom` for user-defined values. See `data-contracts.md` §7.

**Price Bar** — One row of OHLCV data for a single date. Stored in the `price_bars` table.

**Pullback Event** — A confirmed peak-to-trough decline that exceeded the pullback threshold. Used to compute typical drawdown and lower bound.

**Profit Event** — A confirmed trough-to-peak rally that exceeded the profit threshold. Used to compute typical profit and upper bound.

---

## Q

**Quality Factor** — The 0.30–1.0 multiplier applied to the raw Valuation Score, derived from Financial Health: `FLOOR + (1−FLOOR)·(FH/100)^GAMMA` (FLOOR 0.30, GAMMA 1.5). Tunable, no hard cliffs. A healthy stock keeps ~full valuation credit; a weak one is heavily discounted (the value-trap guard). Stored as `quality_factor` on `CycleAnalysis`. See `analytics/scoring/valuation.py`.

**Quick Ratio** — (Current Assets - Inventory) ÷ Current Liabilities. Stricter than current ratio — measures ability to cover short-term obligations without selling inventory.

---

## R

**Rating Tier** — One of the five composite tiers: High Conviction, Constructive, Neutral, Cautious, Bearish. See `design-system.md` §4.

**Reading scale** — The larger type scale used by **public/content** pages (landing, About, Learn, glossary, notes), as distinct from the **app scale** used by the signed-in terminal. Added in Layer G because the app's scale had leaked onto reading pages: the since-retired `/methodology` rendered **13px body and 8px labels across 9 distinct sizes**. Dense type is right for a terminal that is *scanned* and wrong for a page that is *read*. ⚠️ The fix is never to enlarge the app — it is to stop the app's scale being inherited by content. See `design-system.md` §3.

⚠️ **The visible boundary this entry used to flag has been closed** (2026-08-13). It read: *"walking from `/contact` to `/terms` jumps the heading 24 → 36px, the body 13 → 17px and the column 440 → 680px … reconciling the two is the first item of the next Layer G session."* It was, and the owner's decision was that the legal pages should **match the rest of the public site** rather than sit a step above it — so they moved onto the `--pub-*` tokens (24 / 17 / 13 / 12px), which `AuthCard` also reads. See **`--pub-*`** below.

⚠️ **Consequence worth knowing: no shipped page renders the 17px reading body today.** `/methodology` is gone, the legal pages are on `--pub-*`, and the landing carries its own scale in `landing.css`. The reading scale is held for `/learn` — so changing `--rd-body` right now moves nothing a reader can see.

**Public chrome** — The one header and one footer every public page wears, defined in `components/PublicHeader.tsx` and `components/PublicFooter.tsx` and driven by a single list in `lib/publicNav.ts`. Both are **session-unaware** on purpose: a header that varies by viewer makes the page vary by viewer (CLAUDE.md 11a), and reading the session in the public layout would put an Auth round-trip on the sign-in path. The two **session-confined** pages (`/account/update-password`, `/reactivate`) get the logo alone and no links at all, because every link there bounces the reader straight back — decided by `showsFullChrome()`, which both components must call (CLAUDE.md 11c-iv). See `design-system.md` §9.

**Public scale (`--pub-*`)** — The type sizes the **signed-out site** uses: `--pub-title` 24px, `--pub-title-sm` 22px (`AuthCard`'s phone step-down only), `--pub-h` 17px, `--pub-body` 13px, `--pub-label` 12px. Read by `AuthCard` (login, signup, contact, reset-password, deletion-requested, pricing) **and** by `LegalDoc` (disclaimer, terms, privacy), so the two families cannot drift apart. **Not a third scale** — every value was already rendering on a live public page; the tokens exist so the choice is made once. ⚠️ Named `--pub-*` rather than `--doc-*` on purpose: a token called "doc" that the sign-in card reads is exactly the misleading name this repo keeps getting caught by. See **Reading scale** above and `design-system.md` §3.

**Mag 7 snapshot** — `web/app/mag7-snapshot.json`: a **frozen, dated** screener run over seven allow-listed US stocks, committed to the repo and statically imported by the landing page. It is the **one place paid output appears on a public page** — an owner-approved, bounded exception (thirteen allow-listed keys, seven tickers, no route to widen either, no call to the entitlement-gated APIs). Frozen rather than nightly because the page writes *sentences about* the run, and a sentence true on Thursday is a lie on Friday. ⚠️ **Regenerating it is a content change, not a data refresh**: re-read the copy and re-run `e2e/landing.spec.ts`. See `data-contracts.md` §7a and CLAUDE.md 11k.

**Landing snapshot** — `web/app/landing-snapshot.json`: one stock (Apple), rebuilt nightly by the US+CA cron and committed back with `[skip ci]`. Every field is cycle **geometry** — the generator calls `calculate_cycle_metrics`, which has no rating or score to return, so there is no code path from here to a premium field. ⚠️ It shares Apple with the **Mag 7 snapshot** and the two must carry the same `asOf`, or the page prints two different drawdowns for one company three screens apart. Guarded. See `data-contracts.md` §7a.

**robots.txt** — A plain-text file at the site root telling crawlers which paths they may fetch. Generated by `web/app/robots.ts` from the `PUBLIC_PAGES` registry. It is **advice, not enforcement** — it is not a security control, and our paywall never depends on it; the gate is `proxy.ts` plus per-route checks. ⚠️ Two traps, both learned the hard way: creating the file is not enough (it matched the middleware and answered **307 → /login** until added to `PUBLIC_ENDPOINTS`), and rules use **plain path prefixes**, never the `$` end-anchor — a crawler that hasn't implemented `$` treats it literally, matches nothing, and the paywall opens. Over-blocking is the safe direction to be wrong in. See `architecture.md` §11.

**Reactivation** — When a member who scheduled account deletion signs back in and cancels it (`reactivateAccount` in `web/app/(app)/account/actions.ts`): clears `deletion_scheduled_at` and un-cancels a still-live subscription. Edge case handled: if they reactivate inside the last 3 days of a trial, it also sends the trial-ending reminder (Stripe's one-time signal already passed) so they aren't charged without warning.

**Reporting Currency** — The currency a company keeps its books in (`info['financialCurrency']`), governing revenue, EBITDA, debt, cash, EPS and every statement blob. **Not the same as the Share-Price Currency** (`info['currency']`), which governs the price, market cap and analyst targets: **79 of 863** stocks differ — BHP.AX prices in AUD and reports in USD; A2M.AX reports NZD; a third of the Canadian universe differs. Ask `statementCurrency(fundamentals)`, never `fundamentals.currency`. Any ratio mixing the two is withheld rather than published wrong (see `fcf_yield_pct` and the P/E-history chart). `reportingCurrencyNote()` states the difference in words on statement cards, because in `en-US` the US dollar is a bare `$` and "$15.7B" under "A$60.52" is unreadable. **Seven reporting currencies exist in the universe — USD, AUD, CAD, NZD, EUR, TWD, SGD** (all eleven price/report combinations are tabulated in `data-contracts.md`), and all seven were walked on the live site on 2026-08-06. Note that `Intl` gives SGD no short symbol in `en-US`, so Tuas reads `SGD 477M` rather than `S$477M` — correct, not a defect. See `data-contracts.md` and CLAUDE.md 14d.

**Reward / Risk Ratio** — Typical Profit ÷ |Typical Drawdown|. Used in Cycle Payoff scoring. >1.5 = decent; 3.0 = max score.

**ROE (Return on Equity)** — Net Income ÷ Shareholder Equity × 100. How efficiently a company generates profit from its equity base.

**ROA (Return on Assets)** — Net Income ÷ Total Assets × 100. Similar to ROE but measured against total assets.

**Rover Verdict** — The headline composite (Overall Rating + Valuation Score + Health Score + Cycle Position gauge) shown on Results and Stock Detail. Original name from reference HTML — may be renamed when app name finalises.

---

## S

**Sanity Cap** — A **display-only** bound on absurd metric values (S8/S9). yfinance values with a near-zero denominator can be nonsensical (P/E 3,500×, ROE 8,457%, payout 18,210%). Beyond the cap the cell shows `>+cap` / `<−cap` with the true value in the tooltip; the same bound is mirrored in `medians.server.ts` `OUTLIER_BOUND` so it doesn't skew the peer median. Caps never touch the cycle math or FH pillars (those clamp their own inputs). Where a high value is *bad* (distress dividend yield > 20%) the real value is shown but flagged amber + ⚠ rather than capped. See `design-system.md` §9.

**Serverless Function** — A Python file in `web/api/` that becomes one Vercel Function on deploy. Uses `BaseHTTPRequestHandler`, imports cycle math from the vendored `_engine` package (see Vendored Engine), reads from Supabase, never calls yfinance. See `coding-standards.md` §4 and `architecture.md` §7. Phase 1's only serverless function is `web/api/cycle.py` (`/api/cycle` endpoint); Layer D adds `/api/analyze`. (Universe expansion is a cron-drained queue — the **Request a Ticker** flow — not a serverless function; see `architecture.md` §8 Tier 4.)

**StockReadError** — Thrown by `web/lib/stocks.ts` when a Supabase read *fails*, to keep that permanently distinct from "this ticker isn't in our universe" (which returns `null`). Until 2026-08-07 both were `null`, so a database timeout was rendered to a paying subscriber as **"Stock not found"** — a permanent answer to a temporary problem, with nothing logged. Now the page shows "Something went wrong · Try again" and `/report` answers **503 + `Retry-After`**. The originating database error rides along as `cause` so it reaches the Vercel logs. See CLAUDE.md 11e.

**Sitemap** — The machine-readable list of pages we want indexed, at `/sitemap.xml`, generated by `web/app/sitemap.ts` from `PUBLIC_PAGES`. Six entries today. It deliberately carries **no** `lastmod`, `priority` or `changefreq`: Google **ignores** the last two outright, and only trusts `lastmod` when it is verifiably accurate — a build-time date on unchanged content teaches Google to distrust the field, so omitting it is stronger than faking it. Only canonical, indexable pages appear; the four `noindex` pages are excluded. Referenced from `robots.txt`. ⚠️ **Submit it in Search Console only at merge** — it 404s on production until Layer G is live, and submitting a 404 teaches Google to distrust it. Google retired the "ping on deploy" endpoint in 2023.

**Smart Refresh Pipeline** — The nightly cron logic in `analytics/cron/daily_refresh.py` (default mode: `smart`). Runs **twice** daily — AU at 08:00 UTC, US+CA at 22:30 UTC, each scoped with `--markets` so every market is fetched after its own close (no single time can be; see `architecture.md` §8). For every ticker it always refreshes price bars (5-day lookback for existing tickers, full history for new ones) and fundamentals. It only fetches Enriched Data when the staleness check returns true. Use `--mode full` to force enriched refresh for all tickers regardless. See `architecture.md` §8 for full specification.

**Smart Retries (billing)** — Stripe's automatic re-attempts of a failed subscription payment (recommended default: 8 tries over 2 weeks). While it's on, our dunning email says "we'll automatically retry"; the constant `SMART_RETRIES_ENABLED` in `billingEmails.ts` gates that line so we never over-promise. Confirmed on in the Stripe dashboard (Part C).

**Staleness Check** — The `_should_fetch_enriched()` function in `daily_refresh.py`. Returns `True` (fetch enriched data) in three cases: (1) ticker is new — no `enriched_updated_at` in DB; (2) ticker has a `next_earnings_date` that has passed since the last enrich; (3) ticker has no earnings date — last enrich was ≥7 days ago. Returns `False` (skip enriched fetch) otherwise.

**S&P 500** — Standard & Poor's 500 Index — the 500 largest publicly traded US companies. One of three universes we cover in Phase 1.

**S&P/TSX 60** — The 60 largest companies on the Toronto Stock Exchange. One of three universes we cover in Phase 1.

**Serve tier** — Tier 2 of the architecture. Request-time rendering with Vercel edge caching. See `architecture.md` §2.

**Short % of Float** — Percentage of a stock's freely-tradeable shares that have been sold short. High = bearish positioning by traders.

**Short Ratio (Days to Cover)** — Short Interest ÷ Average Daily Volume. How many trading days it would take short sellers to cover their positions.

**Snowflake Radar** — The pentagonal radar chart on Stock Detail showing the five Financial Health sub-pillar scores. Visual at-a-glance summary.

**Strong Customer Authentication (SCA) / 3-D Secure (3DS)** — A bank-required identity check on a card payment (a one-time code, fingerprint, or banking-app tap), mandatory mainly in the EU/UK. On an automatic renewal the customer isn't present to complete it, so Stripe fires `invoice.payment_action_required`; we treat that like a failed payment (dunning path — see Dunning). Uncommon for our AU/US/CA markets, handled defensively.

**STRETCHED** — Valuation Zone label when current drawdown > -5% (stock is near recent highs). Replaces "HOLD" (the original valuation-zone HOLD, not the rating-tier HOLD).

---

## T

**Technical Levels Strip** — Compact row of computed support/resistance/MA values shown on Stock Detail. Derived client-side from price history.

**Tier Badge** — The visual pill displaying a rating tier with its semantic colour. See `design-system.md` §9.

**Ticker** — A stock's exchange symbol. We use yfinance native format internally (`AAPL`, `BHP.AX`, `SHOP.TO`, `ABC.V`). The symbol→market rule lives in exactly one table, `MARKET_SUFFIXES` in `web/lib/ticker.ts` — see CLAUDE.md #14 for why `.V` keeps its suffix in the URL while `.AX`/`.TO` don't.

**Trading date** — The date a price bar belongs to: **the exchange's own calendar date**, not a UTC date and not an instant. A daily bar labels a whole session, so "31 July" means 31 July *in Sydney* for an ASX stock and *in New York* for a US one — different instants, same label, which is what lets Relative Performance line them up by date. Stored as a Postgres `DATE`. Defined once in `data-contracts.md` (`PriceBar.date`); getting it from UTC instead is the defect that stored every ASX bar a day early until 2026-08-04.

**Token-Hash Email Flow** — The branded auth-email link pattern that keeps every link on `majorcycle.com`. Templates use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…&next=…`; the route `web/app/auth/confirm/route.ts` calls `supabase.auth.verifyOtp({ type, token_hash })` and redirects to `next`. Replaces the default `{{ .ConfirmationURL }}` (a `supabase.co/auth/v1/verify` link). See `architecture.md` §7, `design-system.md` §17.

**Trial** — 7-day free trial. Card required upfront, auto-converts to a paid subscription (locked decision #19). **It does not start at signup** — signing up creates a FREE account with no card; the trial begins when the user clicks "Start free trial" and completes Stripe Checkout (F3 Step 10). Signing up never did start a trial; the earlier copy that implied it did was corrected. A repeat email that has already consumed a trial subscribes with **no** free week — see **Trial tombstone**.

**Typical Drawdown** — Mean of all historical pullback events that exceeded the pullback threshold. The "average dip" for this stock.

**Typical Profit** — Mean of all historical profit events that exceeded the profit threshold. The "average recovery" for this stock.

---

## U

**Data residency** — Where personal information physically sits. All of it is in the **United States**: Supabase `us-east-1`, Vercel functions `iad1`, Resend `us-east-1`, Stripe US. None is stored in Australia. ⚠️ This was documented for **years as a latency fact** (`architecture.md` §2 and §5 explain the co-location in milliseconds) before anyone connected it to its second meaning — an Australian business disclosing personal information overseas has obligations under **APP 8**. *A fact can be recorded correctly and still be missing, because it was filed under the wrong question.* See `architecture.md` §6.6 and `docs/legal-audit.md` finding 2.

**Referral (Refer-a-Friend)** — `/account` lets a member send an invitation to a friend's email address, with an optional message; both are stored in the `referrals` table and the friend is emailed once. ⚠️ **The only place we hold personal information about a non-user** — someone who never visited the site and agreed to nothing. That makes it the one feature where **APP 5** (notice when collecting from a third party) applies. See `data-contracts.md` §10 and `docs/legal-audit.md` finding 1.

**Universe** — The set of tickers we have data for. Pre-seeded with S&P 500, ASX 200, S&P/TSX 60. Auto-expands when users upload new tickers.

**Upper Bound** — The strongest **confirmed** profit-recovery event in the stock's history (`max` of the pivot-high profits, over the full history). The mirror of Lower Bound: a still-forming rally can sit *above* it until it confirms. **Display-only** — it feeds no score (not even Cycle Payoff).

---

## V

**VALUE** — Valuation Zone label when current drawdown is between 0.5×typical and typical (in the "discount zone" but not at the worst). Replaces "BUY".

**Valuation Score** — A 0-100 score derived from how today's drawdown compares to typical and lower bound, then **quality-gated** by Financial Health (S3): `score = raw × (FLOOR + (1−FLOOR)·(FH/100)^GAMMA)`, FLOOR 0.30 / GAMMA 1.5, so a cheap-but-financially-weak "value trap" can't score as a bargain. The raw (un-gated) score and the Valuation Zone label still reflect the pure cycle position. Weighted at 35% in the Overall Rating. See `quality_factor` / `valuation_score_raw` in `data-contracts.md`.

**Valuation Zone** — Categorical label: DEEP VALUE, VALUE, FAIR, or STRETCHED. Derived from Valuation Score.

---

## W

**Week52 Change %** — Percentage change in price over the last 52 weeks.

**Week52 High / Low** — Highest and lowest closing price in the past 52 weeks.

---

## Y

**Vendored Engine** — The `web/_engine/` package — a snapshot of the cycle math + scoring files from `analytics/` (with imports rewritten from `from analytics.` to `from _engine.`). Exists so the Vercel Python function at `web/api/cycle.py` can import the algorithm; Vercel's auto-install can't reliably bundle Python from outside `web/`. CI runs a drift check on every PR that fails if `web/_engine/<file>.py` diverges from `analytics/<file>.py`. **Edit `analytics/` first**, then mirror into `web/_engine/` in the same commit.

**yfinance** — Python library that scrapes Yahoo Finance for free. Our Phase 1 data provider. Wrapped behind the DataProvider interface so it can be swapped for FMP in Phase 2.

---

**End of glossary.md.**
