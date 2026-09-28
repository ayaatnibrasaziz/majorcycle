# Findings E — Browse, search, /request, app shell. Returned as text; saved by main session.
Counts: 0 blocker · 7 major · 15 minor · 3 idea. Evidence shots/E-*.png

E-1 [major] Name search: plain substring, no fuzzy/accent/punctuation/aliases — Google, Facebook, Toronto Dominion, Estee Lauder, Johnson and Johnson, J&J, BRK.B, RBC, commbank, typos → 0; empty state says "We don't cover … request it" even for covered stocks or when a market filter hides it (US + "BHP"). Button doesn't carry query. StockBrowser.tsx filtered/EmptyState. Also /api/listings/search, /api/search.
E-2 [major] Browse capped at 120 rows (RENDER_LIMIT), no paging/sort; ASX 253 → only 120 reachable.
E-3 [minor] MQG.AX, SGH.AX, FISV, PDIDB.AX have null sector → never in any sector filter; no Unclassified.
E-4 [minor] Industry list ignores market filter (127 always) → dead ends; empty state doesn't mention Industry; no Clear filters.
E-5 [minor] "All" ranked by raw native-currency market cap (AMD.TO C$1.3T above AMD $1.0T). universe.server.ts.
E-6 [major] /request ranking: CBA shows CBAT, CBAN, CBA.V before Commonwealth Bank; NABL before NAB.AX; SHOP US before SHOP.TO; NYSE duplicates of covered TSX banks offer Request. ASX names uppercase with trailing "."; names truncated to ~13 chars at 375, ~9 at 320. search_listings ranking.
E-7 [major] /stocks/us/BK "no longer trades" — now BNY (covered); page also shows price above 52w range and above target. (dup of B-9)
E-8 [major] Header "Updated <date>" is stocks.updated_at, not last price bar (StockHeader.tsx:216): QUB.AX price 18 Aug shows Updated Sep 18; CVW.AX, ARX.TO, PDIDB.AX. PDIDB.AX is a temporary post-consolidation code (now PDI.AX) listed as live.
E-9 [minor] Recent requests: June chips, no dates/names, not clear it's everyone's; "Not supported" reason only in hover tooltip; no "how you'll know it's ready".
E-10 [major] Back from a stock loses Browse search/filters/scroll; filters not in URL (/stocks?q= ignored, not shareable).
E-11 [major] Browse Custom horizon fields: clearing writes 0, "-12" → "012"; invalid values silently open Medium while Custom shown. CustomField in StockBrowser.tsx; hrefFor. (same class as C-1)
E-12 [minor] Request error notice shows ✓ tick in success blue ("✓ Could not check coverage right now"). RequestTicker.tsx.
E-13 [minor] /run search: no "no matches" feedback or SR announcement. TickerSearchAdd.tsx.
E-14 [minor] `font-[var(--font-mono)]` compiles to font-weight → JetBrains Mono never applies (22 uses/10 files incl StockHeader price, WeekRangeGauge, Header, Sidebar, StockBrowser). Use font-[family-name:var(--font-mono)]. Decision #26.
E-15 [minor] Free 25/day cap invisible until hit; no remaining count; already-viewed not marked; "midnight UTC"; cap page lacks h1/stock name.
E-16 [minor] /stocks/au/BHP.AX → "Not in our coverage" for covered stock; same copy for unrequestable ZZZZZZ; no ticker named/prefilled. (dup B-15)
E-17 [minor] Sign-in redirect drops query (?preset=long); signed-out /nonsense → login not 404. (dup D-13)
E-18 [minor] 1920/2560 Browse rows stretch edge to edge (2298px).
E-19 [minor, likely] POST {"symbol":"OR 1=1 --"} → 503 "Could not check coverage" (WAF blocks, reported as DB error → Sentry error noise).
E-20 [idea] No global search outside Browse; Enter/arrows/Esc not supported in Browse search.
E-21 [idea] Paid users see no ratings in Browse.
E-22 [minor] Landscape 740×360 drawer "Results" row under licence card; on phones filters take first screen, search not sticky.

Env notes: firstlogin acknowledged by reviewer D; Firefox needs PLAYWRIGHT_BROWSERS_PATH; Speed Insights 403 locally ff/webkit; ~12 free views used.
Checked fine: counts 535+253+80=868 = universe-count.json; retired excluded; exact tickers/lowercase/suffixes/AE.V/dual listings/apostrophes/ampersands; garbage input safe; search ~300ms/30ms; /request instant; single h1s; titles; 404s; sidebar locks + licence badges per state; drawer focus/Esc/scroll lock in 3 engines; no sideways scroll 320→2560; signed-out redirects.
Not checked: real submission, sign-out, results, stock content, full visual ff/webkit.
