# Findings F — customer journeys (Sarah/iPhone AU, Raj/desktop trial, Mike/Firefox CA). Saved by main session.
Counts: 1 blocker · 12 major · 10 minor · 7 idea

F-1 [BLOCKER/compliance] Trade-plan language: Verdict "ENTRY ZONE · ACTIVE", "WAIT FOR ENTRY ZONE", "RELOAD LEVEL", "INVALIDATION BELOW — Cycle thesis breaks", "historically rich entry zone", "more downside historically available"; FREE tooltips "better entry zones", "historically attractive zone"; "WHY ATTRACTIVE" card. Guard no-advice-copy.spec.ts misses. VerdictCard.tsx:74,233,257,282; KpiStrip.tsx:158,167; DrawdownOverlay.tsx:331,365,374; ThesisInsights.tsx:68,99,206. (with B-10)
F-2 [major] "Top pick" (landing "Top pick: GOOGL", RunComplete, BriefingCard "Top pick: CBA… standout") + landing "worth owning", "setting an exit". page.tsx:188, BriefingCard.tsx:63, RunComplete.tsx:91. (with C-9)
F-3 [major] Overall not reconcilable; Cycle Payoff ~90–100 for 13/13 stocks (event count capped at 20 → always 100; recovery/fall ratio capped at 3 near cap) → flat +22–25 pts. overall.py:40-47. On-screen "Cycle Position" column not in rating.
F-4 [major] Contradictory valuation labels: CBA chip "Deep Value", Valuation 52 "Reasonable", Cycle Position 33 (tooltip "Fair"), P/E Above Average, PEG stretched, Analysts Sell; MQG chip "Value" vs Valuation 32 "Expensive". valuation.py:87-95 vs glossary.md:84 (docs/code disagree). (with B-14, C-2)
F-5 [major] "610 falls"/"273 confirmed cycles" count 5-day local lows inside falls (major_cycle.py:167-172); AAPL crosses −5% only 304 times; sold as "High confidence"/"well-calibrated signal"; feeds 50% of Cycle Payoff. (with B-13)
F-6 [major] First-login gate/paywall/landing define the rating differently; gate omits Cycle Payoff/weights; paywall "payoff from buying at this point" buy-framed. (with D-15)
F-7 [major] Browse ranks native-currency caps (AMD.TO CA$1.3T top); CA filter headed by AMD CDR, not marked CDR/CDI; NEM.AX above NEM. (with E-5, C-28)
F-8 [major] CBA "NET SELLER (Bearish)" above list of only buys; label covers unseen 2-year window. (with B-21)
F-9 [major] Top holders meaningless for AU (97/172 all <0.1%), CA 17/77. (with B-3)
F-10 [major] Results in sessionStorage only — new tab/next day "No analysis run yet" while /run shows Last Analysis. lib/analysis.tsx:311. (with C-13)
F-11 [major, likely] InfoTip doesn't open on Android tap (hover/focus opens then click toggles closed); WebKit fine. components/ui/InfoTip.tsx.
F-12 [major] Landing Apple bars captions "Deeper than average — reached only in the worst of its 610 falls" / "one of 631 ran this far" contradict Apple −8.0%/+40.7% and prose "nowhere near".
F-13 [major, legal] Sign-up has no "you agree to Terms/Privacy" line.
F-14 [minor] Verdict filler ("Primary risk: the chief risk is the historical cycle pattern not repeating"), "found support", "more downside historically available", "High confidence · 55 cycles" on Health 32 miner.
F-15 [minor] C$ (pricing) vs CA$ (stocks); "US$15 /month USD" duplicated.
F-16 [minor] Account/sidebar: no price/renewal; trial no follow-on price; "LICENCE STATUS · TRIAL ACTIVE" no days left; "licence" odd. (with D-7, D-8)
F-17 [minor] Relative Performance draws all 4 benchmarks for every stock; "Central Wall Street view" on AU/CA; long overview before analysis on phone.
F-18 [minor] Landing Opportunity Map unlabelled bubbles on phone; GOOGL straddles green while copy says nothing landed there.
F-19 [minor] Key Metrics value column cut on phone ("56.") (with B-22).
F-20 [minor] RY insider "BUY" by Royal Bank of Canada itself drives NET BUYER; top holder is RBC.
F-21 [minor, possibly known] 52-week gauge green low/red high = direction-as-colour.
F-22 [minor] /run chips no market badge. (with C-3)
F-23 [env] report 404 locally after restart; no failure message after click.
Ideas: I-1 promise trial reminder email; I-2 link tooltips to Learn + Learn in sidebar; I-3 "why this rating" breakdown; I-4 as-of dates per data block; I-5 Canada thin (80 vs 535; AMD biggest "Canadian"; TSXV undiscoverable); I-6 pricing lacks free-vs-paid comparison, paid sample, business identity; I-7 free "Why Attractive" weak.
Top-10 improvements: 1 remove trade-plan language + extend guard; 2 fix/explain Cycle Payoff + show breakdown; 3 one valuation vocabulary; 4 count real falls; 5 one rating definition; 6 persist results / re-run on empty; 7 clean data panels; 8 touch tooltips + Learn links; 9 trust at payment; 10 Canada/currency polish.
Checked fine: pricing per country + annual maths; Stripe test checkout text; paywall→trial modal on iPhone; gate scrolls; no sideways scroll; disclaimer above fold; bank pillar disclosure; A$/CA$ on stock pages; .V routing; S&P/TSX benchmark; screener search; signed-in /pricing redirect; Learn index.
