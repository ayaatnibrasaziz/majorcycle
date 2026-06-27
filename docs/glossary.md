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

**Card** — The standard UI container: white surface, subtle border, slight shadow. See `design-system.md` §9.

**Cautious** — Rating tier 4 (score 35-49). Indicates elevated risk. Replaces the original "HOLD" label.

**Constructive** — Rating tier 2 (score 65-79). Indicates a favourable setup. Replaces the original "BUY" label.

**Current Drawdown** — How far the current price has fallen from the peak inside the lookback window. Always a negative number (or zero). E.g. "-18%" means the stock is 18% below its recent high.

**Current Profit** — How far the current price has recovered from the trough inside the lookback window. Always a positive number (or zero).

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

**DMA (Daily Moving Average)** — Rolling average of closing prices over N days. The app uses 50-day and 200-day DMAs overlaid on price charts.

**Drawdown** — A peak-to-trough decline expressed as a percentage. Negative number. See also Current Drawdown, Lower Bound, Typical Drawdown.

---

## E

**Earnings Calendar** — A planned Phase 2 UI feature showing upcoming earnings dates across the universe. The underlying data (`next_earnings_date` per ticker) is already collected in Phase 1 via `t.calendar` from yfinance and stored in `stocks.next_earnings_date`.

**Earnings Growth YoY** — Year-over-year change in net earnings per share. Sourced from yfinance.

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

**Fundamentals Snapshot** — The canonical fundamentals data shape returned by any DataProvider. Defined in `data-contracts.md` §2.

---

## G

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

**Neutral** — Rating tier 3 (score 50-64). Mixed signal. Same label as the original UI.

**News Item** — A single news article entry: title, URL, publish date, source. Stored in `stocks.news` JSONB column. Sourced from yfinance in Phase 1; quality is mediocre.

**next_earnings_date** — The next scheduled earnings report date for a ticker, sourced from `yfinance.Ticker.calendar`. Stored in `stocks.next_earnings_date` (DATE column). Used by the smart refresh pipeline to know when enriched data is stale. Also the data source for the future Earnings Calendar UI. Returns `None` for many ASX stocks where yfinance doesn't publish calendar data.

---

## O

**OHLCV** — Open, High, Low, Close, Volume. The five canonical fields of a daily price bar.

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

**Reward / Risk Ratio** — Typical Profit ÷ |Typical Drawdown|. Used in Cycle Payoff scoring. >1.5 = decent; 3.0 = max score.

**ROE (Return on Equity)** — Net Income ÷ Shareholder Equity × 100. How efficiently a company generates profit from its equity base.

**ROA (Return on Assets)** — Net Income ÷ Total Assets × 100. Similar to ROE but measured against total assets.

**Rover Verdict** — The headline composite (Overall Rating + Valuation Score + Health Score + Cycle Position gauge) shown on Results and Stock Detail. Original name from reference HTML — may be renamed when app name finalises.

---

## S

**Sanity Cap** — A **display-only** bound on absurd metric values (S8/S9). yfinance values with a near-zero denominator can be nonsensical (P/E 3,500×, ROE 8,457%, payout 18,210%). Beyond the cap the cell shows `>+cap` / `<−cap` with the true value in the tooltip; the same bound is mirrored in `medians.server.ts` `OUTLIER_BOUND` so it doesn't skew the peer median. Caps never touch the cycle math or FH pillars (those clamp their own inputs). Where a high value is *bad* (distress dividend yield > 20%) the real value is shown but flagged amber + ⚠ rather than capped. See `design-system.md` §9.

**Serverless Function** — A Python file in `web/api/` that becomes one Vercel Function on deploy. Uses `BaseHTTPRequestHandler`, imports cycle math from the vendored `_engine` package (see Vendored Engine), reads from Supabase, never calls yfinance. See `coding-standards.md` §4 and `architecture.md` §7. Phase 1's only serverless function is `web/api/cycle.py` (`/api/cycle` endpoint); Layer D adds `/api/analyze`. (Universe expansion is a cron-drained queue — the **Request a Ticker** flow — not a serverless function; see `architecture.md` §8 Tier 4.)

**Smart Refresh Pipeline** — The nightly cron logic in `analytics/cron/daily_refresh.py` (default mode: `smart`). Runs at 23:00 UTC daily. For every ticker it always refreshes price bars (5-day lookback for existing tickers, full history for new ones) and fundamentals. It only fetches Enriched Data when the staleness check returns true. Use `--mode full` to force enriched refresh for all tickers regardless. See `architecture.md` §8 for full specification.

**Staleness Check** — The `_should_fetch_enriched()` function in `daily_refresh.py`. Returns `True` (fetch enriched data) in three cases: (1) ticker is new — no `enriched_updated_at` in DB; (2) ticker has a `next_earnings_date` that has passed since the last enrich; (3) ticker has no earnings date — last enrich was ≥7 days ago. Returns `False` (skip enriched fetch) otherwise.

**S&P 500** — Standard & Poor's 500 Index — the 500 largest publicly traded US companies. One of three universes we cover in Phase 1.

**S&P/TSX 60** — The 60 largest companies on the Toronto Stock Exchange. One of three universes we cover in Phase 1.

**Serve tier** — Tier 2 of the architecture. Request-time rendering with Vercel edge caching. See `architecture.md` §2.

**Short % of Float** — Percentage of a stock's freely-tradeable shares that have been sold short. High = bearish positioning by traders.

**Short Ratio (Days to Cover)** — Short Interest ÷ Average Daily Volume. How many trading days it would take short sellers to cover their positions.

**Snowflake Radar** — The pentagonal radar chart on Stock Detail showing the five Financial Health sub-pillar scores. Visual at-a-glance summary.

**STRETCHED** — Valuation Zone label when current drawdown > -5% (stock is near recent highs). Replaces "HOLD" (the original valuation-zone HOLD, not the rating-tier HOLD).

---

## T

**Technical Levels Strip** — Compact row of computed support/resistance/MA values shown on Stock Detail. Derived client-side from price history.

**Tier Badge** — The visual pill displaying a rating tier with its semantic colour. See `design-system.md` §9.

**Ticker** — A stock's exchange symbol. We use yfinance native format internally (`AAPL`, `BHP.AX`, `SHOP.TO`).

**Trial** — 7-day free trial period at signup. Card required upfront, auto-converts to paid subscription.

**Typical Drawdown** — Mean of all historical pullback events that exceeded the pullback threshold. The "average dip" for this stock.

**Typical Profit** — Mean of all historical profit events that exceeded the profit threshold. The "average recovery" for this stock.

---

## U

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
