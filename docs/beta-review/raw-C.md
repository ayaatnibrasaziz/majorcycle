# Findings C — screener (/run, /results). Returned as text by reviewer C; saved by main session.
Counts: 0 blocker · 13 major · 16 minor · 5 idea

C-1 [major] Custom horizon fields untypeable: clearing snaps to 0, "-" swallowed ("-8"→"08"). HorizonSettings.tsx Field onChange Number(''). Evidence C-horizon-typing.png
C-2 [major] Cycle Position tooltip (75+ Deep Value…) contradicts Cycle Position Zone values (valuation.py calculate_valuation_zone uses typical fall): 159/200 ASX, 435/500 S&P rows disagree; CSV shows Position 33 + Zone Deep Value.
C-3 [major] Results rows ambiguous: suffix stripped, no market column, bare $ on Close/Target (CBA, SHOP), duplicates NEM/NEM.AX, AMD/AMD.TO; Top pick "K"=K.TO; /run chips "BHP BHP"; Top 50 largest ranks native-currency caps (AMD.TO C$1,337bn #11). columns.ts formatValue, tickerToUrlParts().symbol.
C-4 [major] Retired stocks (EA, AVB, AOF.AX) from CSV import are rated (AOF 70 Constructive) with Company/Sector "—", no retired warning; preview said "not in our coverage".
C-5 [major] CSV import: quoted values, Excel commas-in-names, semicolons, single-line comma lists (silently keeps first), "Symbol" header, tab/space separated, exchange prefixes (ASX:BHP), ASX codes without .AX (BHP/CBA/CSL → "not in coverage, request them"). CsvImport.tsx naive split(',').
C-6 [major] /results mid-run says "Your run finished — No stocks could be scored", then partial "25 results" with no running indicator; briefing/map/export use partial set. C-results-midrun*.png
C-7 [major] Page vs export rounding: AOF 0.365 → $0.36 screen / 0.37 exports; PAR 0.245 → $0.24 / 0.25. columns.ts formatValue uses toFixed (breaks 11c-iii).
C-8 [major] Penny stocks lose precision: ADD 0.041 → $0.04; PAR target 1.08 → "$1" with Upside +340.8%; Target uses money0.
C-9 [major] Analyst Briefing advice-style wording ("patience may beat forcing an entry", "keep on the radar", "limited margin of safety", "Top pick", "standout"); healthWord "fundamentally sound" for health <80 incl. At Risk. lib/ratings.ts buildBriefing; no-advice-copy.spec.ts scans components/ only.
C-10 [major] No market filter in the screener; sector/industry baskets add all 3 markets; no whole-universe basket despite upsell "entire universe at once".
C-11 [major] Phone: no sort control; Simple/Analyst/Full has no effect on cards.
C-12 [major] Opportunity Map ignores filters (Results.tsx rows prop). C-filter-empty2.png
C-13 [major] Reload mid-run loses run silently; Last Analysis shows previous run; /results "No analysis run yet".
C-14 [minor] Health/Valuation label from raw score vs rounded number (CSC 79.6 "80 Adequate"; CYL 64.5 "65 Reasonable" next to RMD "65 Attractive"); 16 cases S&P.
C-15 [minor] Progress 0% until done on ≤25-stock runs.
C-16 [minor] "Processed" wrong when batches finish out of order (50/53 with 28 scored).
C-17 [minor] Est. remaining climbs 141s→329s; shows 0.0s for 6+s while double-checking skipped.
C-18 [minor] Leaving /run mid-run and returning: selection list empty while run continues.
C-19 [minor] Cancelled run results not marked partial.
C-20 [minor] Last Analysis: View never shown (canView={false}), relative time only, lowercase preset, no ticker list, Re-run 100+ stocks with no confirm.
C-21 [minor] Exports: fixed filename, no date/horizon in file, CSV no BOM (Excel mojibake "EstÃ©e"), no currency column, 0-row export silently headers-only, "Raw results" label while filtered.
C-22 [minor] Analyst column shows "None" verbatim.
C-23 [minor] Zone filter options raw uppercase codes, alphabetical.
C-24 [minor] Drawdown filters need negatives, no hint ("Current DD% ≥ 20" → 0 results).
C-25 [minor] Garbage CSV: 5,000-char line → one chip, page scrolls sideways 32,006px; binary accepted; 1,000 unknown tickers uncapped.
C-26 [minor] Opportunity Map "Healthy, fully priced" label under bubbles; 768px axis ticks 65/75 crowd.
C-27 [minor] 1280 Analyst view shows only Identity+Verdict, rest needs unhinted sideways scroll; header not sticky on 200 rows.
C-28 [minor] Top N largest ranks native-currency caps without FX.
C-29 [minor, likely/untested] Sign-out may not clear sessionStorage results → next user in same tab sees prior results.
C-30 [idea] "Investing horizon ~3 months" reads as holding period; it's look-back.
C-31 [idea] Suggest .AX/.TO match for unknown CSV codes.
C-32 [idea] Mobile cards: Valuation word only, Health number only.
C-33 [idea] Market/currency in map tooltip and Top pick.
C-34 [idea] Whole-universe basket.

Checked fine: gating free/lapsed/canceled/anon; disclaimer above fold; preset copy + custom bound errors; CSV lowercase/dupes/blank/BOM/UTF-16/empty/header-only; run times local (17→19s, 53→47s, 107→79s, ASX200→87s, S&P500→148s); cancel honest; soft nav keeps run; 5 spot-checks vs Stock Detail match; no dominated ranking; thresholds; one as-of; filters incl. between/blank/categorical; empty state; sorting nulls last; map legend/tooltips; CSV==XLSX exactly; no sideways scroll at 320/375/768/1280 except garbage CSV.
Not checked: prod timings, sign-out, Firefox/WebKit, Request press, screen reader.
