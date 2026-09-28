# Findings B — Stock Detail (paid vs free). Returned as text; saved by main session.
Counts: 1 blocker · 14 major · 20 minor · 3 idea. Evidence shots/B-*.png, work-B/out-*.txt

B-1 [BLOCKER] Enriched data (statements, earnings, insider, analyst changes, holders, P/E history) frozen for 771/868 active stocks; median age 54d. AAPL enriched 2026-07-30 00:05 with next_earnings_date 2026-07-30 (past); latest quarter Q1'26. daily_refresh.py _should_fetch_enriched: next_ed <= today and enrich_date < next_ed — enriched on/after earnings day never re-qualifies; Full Enriched Refresh workflow dispatch-only, last 2026-06-14.
B-2 [major] Verdict "Top $X · N% below current" uses premium formula ((close-bandUpper)/bandUpper) instead of /close: AAPL 31.1% vs 23.7%; Long 51.2% vs 33.9%; MRNA 81.6% vs 44.9%. VerdictCard.tsx ~272. Also in report.
B-3 [major] Top institutional holders for AU/CA list tiny US ADR holders (BHP: Pacer 0.04%…, unsorted; CBA two 0.00%); 109/172 AU, 23/77 CA tables have largest holder <0.5%.
B-4 [major] Negative margins described as "thin net margin… little buffer"; invalidation "expanding back to ≥8%" (LITE −230%, MRNA, GEM; 79 stocks). VerdictCard.tsx:116, ThesisInsights.tsx:144.
B-5 [major] Valuation History "Current P/E 172.7x" from stale history when trailing P/E null (LITE loss-making); 62 stocks. ValuationHistory.tsx:47.
B-6 [major] Smart Money legend says green=Upgrade/red=Downgrade/navy=Reiterate but markers coloured by resulting grade (Reiterate Buy green; gold not in legend). SmartMoneyActivity.tsx gradeColor vs legend ~686.
B-7 [major] Thesis contradictions: "elevated balance-sheet … risks" (Health<50) beside Balance Sheet 100 and "fortress balance sheet" ★★★ (ADD, MRNA, AE.V); "PEG … growing faster" beside revenue −99% (ADD, GEM).
B-8 [major] Verdict sentence 1 "historically rich entry zone" lacks fhWeak gate (GEM −89.5%, Health 44). VerdictCard.tsx:74.
B-9 [major] BK page "no longer trades" — renamed to BNY which we cover; suggest successor link.
B-10 [major, compliance] Advice-shaped Verdict tile labels/tooltips: "WAIT FOR ENTRY ZONE", "ENTRY ZONE · ACTIVE", "RELOAD LEVEL", "before adding", "deepest discount available", "historically attractive entry band/zone". VerdictCard ~230–275, ThesisInsights:68. Owner's call.
B-11 [major] TSM "LAST EPS NT$3.49" — earnings_history is USD per ADR, labelled with statement currency. Others unverified.
B-12 [major] Relative Performance Max: stock since 1980 vs index capped 20y (AAPL +347,496% vs S&P +479%). benchmarks.ts BENCHMARK_WINDOW_YEARS=20; clip stock.
B-13 [major] confidenceTier counts events only → "High confidence · 20 cycles" on 15 months history (GGP 95 High Conviction), AE.V 55 cycles. VerdictCard.tsx:54.
B-14 [major] Deep Value/Value/Fair/Stretched chips are drawdown positions but read as valuation (CBA "Deep Value" while 16.7% above target, PEG 3.5). Naming decision.
B-15 [major] Wrong-market/uppercase/suffixed URLs (/stocks/ca/AAPL, /stocks/US/AAPL, /stocks/au/BHP.AX, /stocks/ca/SHOP.TO, /stocks/us/BRK.B) → "Not in our coverage yet — request it"; no ticker named, no suggestion.
B-16 [minor] Quarterly bars coloured QoQ beside YoY stat; growth streak capped at 1 (5 quarters stored, code assumes 8).
B-17 [minor] Earnings Performance legend "Actual" black swatch, bars green.
B-18 [minor] Dividend History skips no-dividend years silently (AAPL 1995→2012); resumption counted as increase in streak.
B-19 [minor] Smart Money analyst stacks run off top of chart (1280, 375).
B-20 [minor] Drawdown chart 375: "Low −81.4%" chip covers −75 axis label; chips duplicate price-scale labels.
B-21 [minor] "NET BUYER (Bullish)" above list with zero purchases (ADD) — counts purchases older than 14 months not shown.
B-22 [minor] Key Metrics industry column all "—" (AAPL, single-member industry); at 375 Value column starts off-screen.
B-23 [minor] First two thesis bullets always ★★★; "Primary risk: the chief risk is…" redundant; Verdict line 3 repeats line 1 near highs.
B-24 [minor] "Does not pay a dividend — typical for high-growth businesses reinvesting cash" on pre-revenue explorers.
B-25 [minor] AE.V quarterly revenue empty chart CA$0–4 axis instead of "no revenue reported".
B-26 [minor] Band tile price precision inconsistent (A$0.008837 vs A$0.0294).
B-27 [minor] Delisted stocks: green "Updated" dot, "Wait for Entry Zone" and a rating.
B-28 [minor] Invalid custom horizon silently falls back to Medium; default horizon never named on page; Long horizon on short history also withholds Health.
B-29 [minor] 320px header: company name 4 lines; Value chip overlaps 52W row 3.9px (ADD).
B-30 [minor] Free limit "resets at midnight UTC"; no remaining-views indicator.
B-31 [minor] Lowercase URLs don't canonicalise; BRK.B 404, only BRK-B.
B-32 [minor] Alpha rounding 16.0 vs 16.1; odd axis ticks (+17%, +43%; $95B, $285B).
B-33 [minor, unsure] BHP insider values imply ~A$20/share vs A$60 price.
B-34 [minor, unsure] 84 US stocks share-count change exactly 0.0% — maybe placeholder.
B-35 [minor] Report download failure uses window.alert, same message for all causes.
B-36 [idea] Entry-zone band too wide (AAPL $93.69–$260.22).
B-37 [idea] Show/switch horizon on page.
B-38 [idea] News relevance filter (AAPL feed has Intuit/Oracle, Tesla/SpaceX).

Checked fine: ~23 tickers; splits APH/MNST; reporting-currency note + withheld P/E history (BHP, FBU, TSM, CSU); bank not-scored note; short-history notice; currency symbols; subnav at 1280/375; no sideways scroll 320/375/1280; price chart ranges/crosshair; paid AAPL report (pre-restart) complete, 21 canvases; free: no premium fields in DOM/HTML, locks render; garbage URLs 404 no injection; AE.V vs AE; dev load 5–12s; news 8,243 items no dup/missing links, noopener; info tooltips.
Not checked: report download after restart (/stocks/*/report → Next HTML 404 for signed-in — likely dev cache, RE-TEST); free daily-limit screen; 768 sweep.
