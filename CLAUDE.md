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
| Testing (TypeScript) | **Playwright — the ONLY TS test runner** (owner decision, 2026-08-06) | One runner, one count. The rule for judging CI here is *check the COUNT, not the colour*, and that only works while there is **one** number — a second runner means a suite can silently stop running behind the other's green. Unit-level tests are written as **pure, credential-free Playwright specs** in `web/e2e/` (`entitlement.spec.ts`, `export-parity.spec.ts`, `stock-read-errors.spec.ts` — the last drives the real DB readers with a stub client — and `auth-contracts.spec.ts`, which drives `safeNextPath` and `friendlyAuthError`): no browser, no network, so they run on a fork PR with no secrets and can never self-skip. **Do not add Vitest or Jest.** `coding-standards.md` required Vitest until 2026-08-06 and none was ever installed |
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
│   ├── scripts/                    ← build + guard scripts (check-*.mjs, build-*.mjs)
│   │                                 `build-design-system.mjs` GENERATES the Claude Design
│   │                                 gallery from globals.css → design-system-build/
│   │                                 (gitignored — a rendering, never a source of truth)
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

**(iii) A third instance, and this one is a NUMBER rather than a sentence — 2026-08-06.** One screener run offered two downloads, and Barrick's analyst target came out **CA$65.76** on the page, **65.76** in the `.xlsx` and **65.75** in the `.csv`. Three copies of "round to 2 decimals": `Intl` on screen, `toFixed(2)` in `ratings.ts`, `Math.round(v*100)/100` in `xlsx.ts`. `toFixed` and `Math.round` both round the **binary double**, which sits a hair below a half-cent, while `Intl` rounds the decimal the reader is shown — so the three parted company on ~4% of values, in *different* directions (65.755 splits the CSV off; 1.005 splits both exports off from the page). Note how invisible it was: every figure was plausible, all gates were green, and `ratings.ts` carried a comment promising the two files "always show identical figures". **Fixed by making one derive from the other** — `exportText` formats with the screen's `Intl`, and the workbook *parses its cell number back out of that string* rather than rounding again — so the workbook cannot drift from the CSV even in principle. ⚠️ **Extracting a shared constant is not enough when the rule is an ALGORITHM: two functions can share a spec and still disagree.** Make the second one consume the first's output. Guarded by `web/e2e/export-parity.spec.ts`, which imports both real functions rather than re-implementing either — a fourth copy inside the test would guard nothing.

**(iv) A fourth instance, and it is the cheapest one to repeat: I gave the rule to ONE of its two consumers — 2026-08-12.** Layer G's public chrome hides the nav on the two session-confined pages, because every link there bounces the reader straight back. `PublicHeader` asked the shared `showsFullChrome()`; `PublicFooter` was written ten minutes later and simply wasn't given it. Result: `/account/update-password` rendered a correctly collapsed header **above a footer still offering seven dead links** — on the page a reader mid-password-reset sees. Nothing errored, the constant existed and was correct, and code review would have read both files as fine. **Extracting the constant is only half the job; the other half is that every consumer actually consumes it.** Found by opening the page, not by reading it. Guarded by `e2e/public-chrome.spec.ts`, which asserts both components call the function *and* that neither holds a private path list — reading the source with comments STRIPPED, because the first version of that guard failed on the very sentence documenting the fix (twice now: see the `Markets · Live` note in the artifact build).

**(v) A fifth instance, and the second copy is written in ENGLISH — 2026-08-15.** Applying the legal audit put three live constants into published prose: the free tier's 25/day cap, the 30-day deletion window, the 3-day payment grace. Each now exists twice — once as a constant the product enforces, once as a sentence a customer relies on — and **the prose copy is invisible to every tool we own.** TypeScript cannot see it, no import links them, and the failure is silent in the worst way: tune `GRACE_DAYS` to 5 and the Terms do not error, do not look stale and do not stop rendering; they simply become a **false statement about what we do**, still fluent, still specific. ⚠️ Note this is the *reverse* of the defect that prompted the fix — the Terms had been **enforcing** a 25/day cap they never stated (11c's "one rule, one place", where one place was a nullity). Stating it fixed that and created this. **Where you write a number into copy, make the test build its assertion FROM the constant and check it against the RENDERED page** (14d: source-correct and screen-wrong is a real state), with an off-by-one control proving the match is value-sensitive rather than merely finding a digit. `e2e/legal-doc.spec.ts` does this for all three. **The general rule: a sentence that states a constant IS a copy of that constant, and prose is where copies go to drift unnoticed.**

**(vi) A sixth instance, in CSS, and the rule was reachable ONLY through an unrelated class — 2026-08-15.** The public site's document scale (24/17/13/12) lived as `.reading .legal-layout`, i.e. welded to the class that also builds the legal contents-rail **grid**. Correct while one kind of document existed. The Learn library made it two: those pages want the scale and *not* the grid, could not get it, and silently fell back to `.reading`'s own sizes — producing a **fourth type scale on the public site**, 36/26/20 against 24/17/13 everywhere else and 50/34 on the landing. Crossing from `/contact` into `/learn` was a **50% jump in heading size**. ⚠️ **Nobody wrote a wrong line.** `.reading` is the right default for a long page and the legal pages had opted out properly; the new pages simply had no reason to wear a class named after somebody else's layout. That is 11c-iv again — *the rule existed and one of its consumers never received it* — and the generalisation is: **if a decision is about documents, it is a class about documents.** A shared rule reachable only through an unrelated class is not shared. Fixed by extracting `.doc-scale`, with element selectors as well as helper classes, because article prose is authored as plain `<h2>` and content files should not need to know the design system's class names. ⚠️ **And it reversed a decision of mine that was defensible in isolation** — an article is read, a legal page is scanned, so it should keep the larger scale. Fine on its own terms; it created the fourth scale. **When a local choice is defensible, ask what it does to the SET**: never "is 17px right for an article?", always "how many scales does the site have after this?" Guarded by `legal-doc.spec.ts` + `learn.spec.ts`, which compare four surfaces **page-to-page** rather than against literals — plus a control asserting the real values, since four pages also agree perfectly when the stylesheet failed to load (14g).

11f. **A page that asserts something about ONE reader must be gated on evidence that they ARE that reader — "signed out" is not evidence.** `/deletion-requested` says *"your account is now scheduled for permanent deletion"*. It was reachable by anyone who typed the URL, for the life of the site. Three different questions have to be answered before such a page may render, and only two were being asked: *may a signed-out reader in?* (`PUBLIC_PATHS`), *should a signed-IN one see it?* (`SIGNED_OUT_ONLY_PATHS`, added after F-A4-c) — and the missing one, ***is this signed-out reader the right one?*** ⚠️ Note the shape: `lib/seo.ts` had **already written down** that the page "asserts something true of exactly one reader at one moment", as the reason it is `noindex`. The gap was named in a comment and never turned into a control. **A sentence in a doc is not a gate.** Fixed 2026-08-12 with an httpOnly, path-scoped, 30-minute marker set by the deletion action and enforced in `proxy.ts` — the same mechanism as `mc_pw_recovery`, so there is one pattern to learn rather than two. It carries **no user data** and unlocks nothing but static prose; a marker that grants a page must never be able to stand in for a session, which `auth.spec.ts` asserts as a control. ⚠️ **Gate and setter fail differently:** a broken gate shows a stranger the page; a broken *setter* bounces the person who really deleted their account, and no gate test would notice — so `e2e/deletion-notice.spec.ts` presses the real button on a throwaway account.

11g. **A rule that MATCHES ON A STRING SOMEBODY ELSE OWNS must be tested against that person's actual strings — not against the phrases it was written from.** `friendlyAuthError` turns Supabase's raw errors into copy a non-technical reader can act on, and it silently failed to match **two** of the messages Supabase really sends: `"A user with this email address has already BEEN registered"` does not contain the substring `"already registered"`, and the 60-second reset cooldown — *"For security purposes, you can only request this after 51 seconds"* — contains neither `"rate limit"` nor `"too many"`. Both fell through the map's deliberate passthrough, so the reader got raw GoTrue English on the sign-in and reset forms. The cooldown is the one a real person actually meets, by pressing "Send reset link" twice. ⚠️ **Note why nothing was red:** the passthrough is *correct* behaviour for a genuinely unknown message, so a miss is indistinguishable from a design decision — there is no error, no log, and the page still renders. The only thing that can tell them apart is a test holding the upstream wording verbatim, which is what `e2e/auth-contracts.spec.ts` now does (found 2026-08-12; the same file's table also asserts every mapped message is a full sentence, which is how the second miss surfaced). Applies to every `includes()`/regex over a provider's text, an HTTP reason phrase, or a webhook's `reason` field. **Where the string is not yours, the test is the only place your guess stops being a guess.**

11h. **A third party's WIDGET RENDERING is not a third party's APPROVAL — and an absent error is not a passing check.** The Google sign-in button draws from an `accounts.google.com` iframe, with `google.accounts.id` live and a completely clean console, **on an origin Google has never heard of**. `renderButton` validates nothing; Google checks the origin server-side, when the popup opens. So the only outcome that proves anything is a **completed click-through** — which on a Vercel preview answers `Error 400: origin_mismatch`, because Google's authorised JavaScript origins admit **no wildcards** and every preview deployment is its own origin. ⚠️ **I reported the opposite and was wrong**, on 2026-08-12, from exactly that evidence: button rendered + no console error ⇒ "the origin is authorised". The owner clicked it and Google said no. ⚠️ **The two-symptoms tell:** One Tap was silently failing at the same time, reporting `skipped / "unknown_reason"` (FedCM withholds the reason), and I wrote the two up as *unrelated tooling limits*. **When two things fail at once, look for one cause before documenting two.** This is 14g's lesson in a different runtime — *unmeasurable counted as clean* — and it is why this repo breaks a guard on purpose before trusting it. ⚠️ **And the answer was already in our own docs:** `layer-f-audit.md` had recorded on 2026-07-08 that a "skipped" One Tap moment was Google's post-dismissal cooldown, *confirmed via the GIS moment API*. **Grep the audit docs before re-deriving a diagnosis.**

11i-b. **Sometimes BOTH explanations are true at once (2026-08-15).** A break on the landing's ruler-label clamp stayed green twice. The stale-`.next-dev`-stylesheet cause from 11i below was real — a cold cache proved the broken CSS *was* being served — **and the guard was still weak underneath it.** Clearing the cache alone would have "confirmed" a working guard. What settled it was sweeping the widths and printing the number: without the clamp, 375px clears by **1.1px** (passes, proves nothing) while 360px overflows by 0.1px and 320px by 3.2px. Two lessons. **Run the guard where the defect actually appears** — our stated 375px floor was the one width that could not see it. **And assert a margin, not a boundary:** `>= 0` scores a 1.1px accident as a pass, so the bound is now 2px, which the design clears by 7px everywhere. ⚠️ Third: my original report of "8px overflow at 375px" was an artefact of my own approximate probe, which assumed every label was centred. **The measurement was wrong, not the code** — the same shape as 11i's `railTop` reading, one level up. Derive geometry from what `getComputedStyle` actually returns, never from what the rule was meant to say. ⚠️ Fourth, on guards: **a guard that names an IMPLEMENTATION fails on refactors and teaches you to loosen it.** `public-chrome.spec.ts` asserted the literal Tailwind class `scroll-mt-[calc(var(--header-h)…]` and went red when the identical rule moved into a co-located stylesheet as `scroll-margin-top` — nothing about the reader's experience had changed. It now looks for the offset in either form.

11i. **A deliberate break that stays GREEN has two explanations, and the boring one is usually right — re-run before you touch the test.** This repo's whole safety net rests on breaking a guard on purpose before trusting it, so the one failure mode that quietly defeats that habit deserves its own rule: on 2026-08-13, building the legal-page contents rail, I deleted the CSS rule I believed made it stick, re-ran the guard, and it **passed**. The tempting conclusion is "my guard is useless" — and the instinct that follows is to weaken or delete a test that was working perfectly. The truth was that `next dev` served the previous stylesheet from `.next/cache`, even though `reuseExistingServer: false` had booted a brand-new server process; the **second** run compiled the change and went red for exactly the right reason (`Expected <= 2, Received 500`). ⚠️ **Before editing the assertion, print what the browser actually computed** (`getComputedStyle` / `getBoundingClientRect`). Doing that here separated the stale cache from two genuine findings: (i) the rule I had documented as load-bearing **was not** — the rail's own `max-height` clamp is what holds it, and either protection alone suffices, so my comment asserted a mechanism I had never broken; and (ii) the assertion `expect(railTop).toBeLessThanOrEqual(90)` **passed at −317**, i.e. with the rail scrolled clean off the top of the viewport — **a bound on one side only tests the direction that was never the failure mode.** ⚠️ **And the third: a FLAKY test is a finding, not noise.** In the same work one rail test went flaky — passed on retry, the most ignorable result a suite can give. Driving all eight clause links and printing each outcome, instead of re-running, showed that clicking clauses **05, 06, 07 or 08 all highlighted "Contact"**: the type had just been re-set 17px → 13px, which made the document short enough that those clauses sit where no scrolling reaches the scroll-spy's offset line, so its bottom-of-page rule won. **Nothing about the spy changed — the page got shorter.** Two habits: a flaky result on a test *you wrote this session* is far likelier to be your defect than the harness's, and **a type-size change is a layout change** whose second-order effects surface in anything that measures the page, including shared code several files away. The fix was an **opt-in** option on the shared hook rather than a new default, so the Stock Detail subnav and the offline report — both paid surfaces — stayed byte-identical: when a shared utility is wrong for a NEW caller, widen it for that caller instead of re-tuning it for everyone. ⚠️ **And the fourth, which is why "CI is green" is not a report: RECONCILE THE COUNT.** The commit adding a character-count guard came back **success** — local said **277 passed**, CI said **275**. Two apart, on a green run, and I nearly reported it as clean. The reconciliation is `275 passed + 2 flaky = 277`: Playwright prints retried passes on their **own** line and I had read only the last line matching `passed`. **Read the whole summary block, and when local and CI disagree, diff the test TITLES** — that separates *skipped* (a title missing on CI) from *retried* (a title appearing twice with `(retry #1)`). ⚠️ My first attempt at that diff returned **zero rows**, which looks like "no differences" and was actually a broken query: CI prints `e2e/legal-doc.spec.ts` and Windows prints `e2e\legal-doc.spec.ts`. The flakiness itself was mine — the guard's precondition polled until the article computed 13px, which proves the *stylesheet* applied and nothing about the column having taken its width or the real webfont rendering, and **font metrics are exactly what a character count depends on**. Local (8 cores, warm cache) never hit the window; CI (2 cores, cold compile) hit it twice, reporting 430 characters — the whole paragraph on one line. **A precondition must cover everything the measurement depends on, not merely something that correlates with readiness.** Full account in `coding-standards.md` §14, items 4–8.

11j. **"Approved" names a specific ARTIFACT. Check that artifact — not the document that preceded it, and never the roadmap row claiming the work is done.** On 2026-08-13 the owner said the landing page "doesn't look like the one I approved." I checked, reported a measured gap of two missing sections, and was **wrong about the scale by an order of magnitude** — because I had checked `docs/layer-g-page-briefs.md`, which describes the page's *intent* in five prose layers. The approval was an **artifact**, a full visual storyboard, and against it the built page was missing **twelve** sections: the hero's actual headline, the worked screener run, the stats band, the three-step explainer, the ranked results table, both distribution bars, the Opportunity Map, and every honesty block. ⚠️ **Three documents said this was finished** — the roadmap's G2 table (*"5. Landing at `/` — real Apple figures, nightly snapshot ✅"*), its guard column, and the layer summary — and all three were true about what they measured and silent about what they didn't. **A "done" row is a claim about the last session's intent, not evidence about the page.** ⚠️ **And the guard could not have caught it**, which is the part that generalises: the landing's only test asserted SEO tags and that gated routes stay gated. **A missing section renders perfectly.** There is no error, no blank space, no failing assertion — the page simply stops earlier than it should, and looks deliberate. This is the same family as 11c-iv (the footer that never got its rule) and 14g (unmeasurable counted as clean): the defect is an *omission*, so only something that enumerates what SHOULD be present can see it. When a page is built from an approved design, the test must name its sections — which is why `e2e/how-it-works.spec.ts` asserts the folded-in headings **by name** rather than counting them. ⚠️ Practical rule: before reporting on any page with an approved design, `Artifact action:"list"` and read the artifact. Prose briefs record *why*; the artifact records *what*. When they disagree, the artifact is what the owner said yes to.

11k. **A number inside a DESIGN is data with a shelf life. Re-derive it, or the approved copy becomes a confident lie.** The landing storyboard was drawn from a real screener run and its prose stated *"5 rate Constructive or better"* and Tesla *"still comes sixth"*. Re-running that same run six days later made both **false** — four and seventh — because Nvidia slipped out of Constructive (65 → 62) and Amazon passed it. Nothing errored; the sentences stayed fluent, specific and about real companies. ⚠️ **The trap is that an approved artifact feels like a spec, and half of it is a spec (layout, wording, hierarchy) while the other half is a *measurement* taken on one day.** Copy the first, re-derive the second: every count, rank and superlative the landing states now comes from `mag7Facts()` and is asserted against the rows it describes. Positions in a stylesheet count too — the storyboard's ruler markers were literal `left:11.1%`, correct on the day and silently detached from their own labels afterwards. **And it extends past prose: layout tuned to one dataset expires with it.** The Opportunity Map's per-ticker label sides were chosen when Amazon's Valuation was 0.8; at 16.0 its label sat on Apple's — two short labels touching at a corner, invisible to review and to a screenshot. Regenerating such a snapshot is a **content change**, not a data refresh. ⚠️ Related: **two snapshots describing the same subject must carry the same date.** Apple appears in both landing files; the first run left them a day apart and the page printed −12.2% in one section and −11.3% in another, three screens apart. Both real, one current.

11l. **Where a colour is USED changes what it measures — and one function cannot answer both "what colour is this?" and "what can sit behind white text?"** Three findings from one contrast sweep, all invisible: (i) the screener's `.score-num` chips are white numerals on `scoreColor()`, and three of the five tier colours are far too light to be a background — Neutral gave **2.38:1**, the identical figure G2 fixed on the *badges*. It had never been caught because the contrast guard walks **public** routes and the screener is gated, so the landing page was the first measured page ever to draw one. ⚠️ **I "fixed" this and the owner reversed it, and the reversal is the more important lesson.** I introduced a `scoreChipColor()` returning darker ink for the middle tiers and applied it to the screener as well — changing a paid surface's appearance, unasked, inside a landing-page commit. The owner's instruction was *"whatever is present on the live site, the color should exactly match that."* **A real defect does not entitle you to widen your scope**; the accessibility finding was right and the unilateral repaint was not. Both surfaces are back on `scoreColor()`, and the debt is now carried honestly instead: a `[data-legacy-contrast]` marker on the subtree, excluded from the pass/fail set but **counted**, so it cannot silently grow and cannot quietly stop excusing anything. Fixing it is a product-wide Layer H job. **Record a defect you are not authorised to fix; do not fix it quietly and call it tidying.** (ii) The Neutral badge measured 4.73:1 on white and **4.32:1** on `--bg-page`; the badge did not change, what sat behind it did — composited colours must be measured where they actually sit. (iii) The dark honesty band reported **every** line as failing at ~1.1:1, on a band that is obviously navy, because `background: linear-gradient(…)` is a shorthand that resets `background-color` to transparent — so anything asking the DOM what is behind the text reads straight through to the page. That is the same bug already documented in `components/ui/button.tsx`; **write `background-color` + `background-image` separately whenever white text sits on a gradient.** ⚠️ The generalisation: a guard scoped to one class of route is silent, not clean, about the rest — see 14g.

11m. **A marketing page that SHOWS the product is a promise about the product — match the component, not the picture of it.** The landing's worked run advertises the screener, and every way it differed was a small lie a new customer meets on day one. Four, all found by reading `components/results/ResultsTable.tsx` rather than trusting the approved storyboard: **(i)** Overall and Rating Tier rendered as two columns; the product draws the score chip, the tier badge and the 40/35/25 composition bar in **one** cell, with "Rating Tier" a separate column the default view hides. **(ii)** Financial Health was coloured with `scoreColor` (five tiers) instead of `healthColor` (**three** — Healthy/Adequate/At Risk, at 80 and 60), so Tesla at 49.8 came out orange on the landing and red in the product. **(iii)** Both score cells carry their word (*Healthy*, *Reasonable*) and mine had dropped them. **(iv)** Current DD% is tinted `drawdown`, which runs **green for a deeper dip** because deeper is more cyclically favourable — I tinted it red, so the page's own illustration contradicted the page's argument. ⚠️ **The approved artifact is not a safe source for this.** It was hand-drawn in plain HTML from a screenshot, so it is only as accurate as whoever drew it; **the product's source is the sole authority on what the product looks like.** Reuse the real classes and the real helpers (`compositionRamp`, `healthColor`, `metricTintColor`) so the two cannot drift, and pull whatever extra field that needs into the snapshot rather than re-deriving it — the composition bar needed `cyclePayoffScore`, and computing it back out of the rounded total would have been a second implementation of the weighting (11c iii).

11n. **A fact can be written down CORRECTLY, twice, and still be missing — because it was filed under the wrong question.** The database region `us-east-1` was documented in `architecture.md` §2 and §5 before 2026-08-15, both times accurately, both times as a **latency** fact: it explains why the Vercel functions are pinned to `iad1` and why a DB round-trip is 10–20ms. Nobody had connected the identical fact to its second meaning — an Australian business storing personal information in the **United States** owes a cross-border disclosure under APP 8, and the published privacy policy said nothing about data leaving Australia. **No search for "region" would have surfaced this**, because the text was already there and already right. What surfaced it was auditing a *different artefact* (the legal pages) against the live system and asking a different question of the same fact. ⚠️ Two habits follow. **When a claim is about the real world, verify it against the running system, not the code's intent** — this audit used the Supabase, Stripe and Resend MCP servers live, and three of the seven findings (a non-user's email in `referrals`, a hash surviving deletion, a 25/day cap the Terms enforce but never state) came from reading the schema and the constants rather than the prose. **And when you record a fact, ask what ELSE it is evidence of.** Latency and jurisdiction are the same sentence read by two different readers. Full audit: `docs/legal-audit.md` (proposed, not applied); the facts it established: `architecture.md` §6.6.

11d. **A second BUILD of the same components is a second product — test the artifact, never the source it came from.** The offline report (`web/report-bundle/`) is compiled by **esbuild**, not Next, from the same `.tsx` files the site uses. So `pnpm typecheck`, `pnpm lint` and every source-reading guard can be green while the thing a customer downloads is a **blank page** — which it was, for every stock, from **2026-08-01 to 2026-08-05**. The file was flawless on inspection (correct title, 2.6 MB payload, 1.09 MB script) and threw `ReferenceError: process is not defined` on load. **The cause was not in the report code at all**: `KpiStrip` → `PremiumLock` → `UpgradeDialog` → `next/link` pulled Next's client router in, and its module scope reads `process.env.__NEXT_ROUTER_BASEPATH`. esbuild's `define` rewrites only the **exact** string given, so the existing `process.env.NODE_ENV` entry left 14 siblings intact. Note the shape: **an import three components away, in a file nobody editing the report would open.** Fixed with a `process` shim in the bundle banner — a shim, not more `define` entries, so the next stray import *degrades* rather than blanks. The real protection is **`web/e2e/report-download.spec.ts`**, which downloads the actual file and opens it over `file://`, asserting it mounts, throws nothing and draws its charts — the **outcome**, so it stays valid when the next breakage is some other import. ⚠️ **It must be `file://`**: a blob URL in an iframe inherits the site's CSP, which blocks the inline script and blanks the page for a completely unrelated reason — an hour lost to a false positive. And e2e had *always* covered the report **route** (which returns JSON and was fine); covering a URL is not covering an artifact.

11e. **"I could not read it" and "it does not exist" are different answers — never let one return value mean both.** `fetchStockDetail` funnelled all four of its read-failure paths into the same `return null` that means *not in our universe*, and every caller then did the only thing that value permits: `notFound()` on the page, `404 Not found` from the report route. So a Supabase timeout reached a **paying subscriber as "Stock not found"** — a permanent answer to a transient problem, nothing logged, nothing to retry, and the owner cannot debug it from the outside. Fixed 2026-08-07: read failures throw `StockReadError` (carrying the PostgREST error as `cause`, so it survives into the Vercel logs), `null` keeps exactly one meaning, the route answers **503 + `Retry-After`** and the page reaches the existing "Try again" boundary. ⚠️ **Catch it in route handlers rather than letting it throw** — an uncaught error yields a 500 whose headers we don't set, and every response there is per-viewer (11a). **The second cost is worse than the first: it blinds you.** An intermittent 404 on an *entitled* viewer's report was read as an entitlement fault for an entire session, because the true cause was being swallowed one layer below where anyone was looking — the same shape as `check_invariants()` reporting zero violations over a universe missing the field it reads (14g). **An unreadable answer reported as a clean one is the most expensive kind of lie a program can tell.** Guarded by `web/e2e/stock-read-errors.spec.ts`, which drives the real `readStockRow`/`loadPriceBars` with a stub client — pure, credential-free, and carrying **controls** proving a genuine absence is still `null`, since "throw on everything" would otherwise pass every test.

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

14d. **The share-price currency is not the reporting currency.** `info['financialCurrency']` governs revenue, EBITDA, debt, cash, EPS and every statement blob; `info['currency']` governs the price, market cap and analyst targets. **79 of 863 stocks differ** — a fifth of the ASX names and a **third** of the Canadian ones (BHP.AX prices AUD / reports USD; A2M.AX reports NZD). We read only the price currency until 2026-08-05, so those statements rendered `A$` in front of US dollars, and `fcf_yield_pct` divided a USD numerator by an AUD denominator into the Financial Health score. Ask `statementCurrency(fundamentals)`, never `fundamentals.currency`; withhold a cross-currency ratio rather than publish it wrong. **A symbol alone is not enough** — in `en-US` the US dollar is a bare `$`, so a corrected BHP balance sheet reads `$15.7B` under a share price of `A$60.52` with nothing saying they differ (a gap of ~A$8B on that figure); `reportingCurrencyNote()` states it in words on the statement cards, and only when the two disagree. ⚠️ **This fix shipped INERT and only a screenshot caught it**: the field was added everywhere but left `null` on all 863 rows, and the fallback-to-price-currency is *correct*, so code, tests and guards all reported success while every page still showed `A$`. **When a fix depends on a new field, it is not done until that field is populated — assert on the rendered figure, not on the function that produces it.**

14e-3. **A rule enforced in one runtime is not enforced.** `normalise_fundamentals()` runs on write (provider) and on read (`web/api/cycle.py`, `analyze.py`) — all **Python**. The Key Metrics table renders from `web/lib/stocks.ts`, which is **TypeScript**, so 73 rows kept a cross-currency `fcf_yield_pct` *on screen* after the fix was written, tested, guarded and pushed. **Do not port the rule into the second language** — that is 11c's drift trap. **Assert the invariant on the DATA**: `check_invariants()` in `check_field_units.py` fails nightly on a stored `0.0` margin or a cross-currency FCF yield, covering every reader at once including ones not written yet.

14e-2. **A ratio is only safe when its numerator and denominator share a currency.** The scores are fine by design — Financial Health is built from ratios of statement figures, so the units cancel — with exactly one exception, `fcf_yield_pct` (cash flow ÷ market cap), now withheld. **But `pe_history` mixed them and it was on screen**: `_compute_pe_history` divides exchange prices by an income-statement EPS row, so Barrick's Valuation History chart read **19.2x** while the Key Metrics table on the *same page* said **10.1x** (Yahoo's `trailingPE` is currency-corrected; ours was not). Withheld for all 79 cross-currency stocks, not converted — one FX rate can't fix it, since rates move 15–30% across the five years plotted and distort the *shape* too. Before adding any new ratio, ask which currency each side is in.

14g. **A fix applied to STORED DATA is undone by the next cron run until the code is merged.** `daily_refresh.py` writes `"fundamentals"` as a **whole-object replace** for every ticker every night, and a `schedule`-triggered `actions/checkout` takes the **default branch** — so a backfill sitting on an unmerged branch has a shelf life of hours. Measured 2026-08-05: the US+CA refresh (22:30 UTC) reverted **608 of 863 rows** fourteen hours after they were fixed, while the 250 AU rows survived only because their workflow runs at 08:00 UTC — the split falls exactly on the workflow boundary. Consequences: **don't backfill before merging** (the post-merge refresh repairs every row from the provider anyway), and **never cite a DB reading as proof a fix is live** without checking `updated_at` against the cron schedule. ⚠️ **The instrument went blind, which is the real lesson**: `check_invariants()` reported *zero* cross-currency violations over that broken universe, because the reverted rows had lost the `financial_currency` field the test reads — **unmeasurable counted as clean**. Any check that needs a field must also assert that field is *present*, or it reports success precisely when things are most broken. Now a third invariant: >5% missing `financial_currency` is itself a breach (a proportion, so genuine upstream gaps don't cry wolf), and the nightly log prints invariant **names**, never a count.

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
- Legal-page accuracy vs. what the system does → `docs/legal-audit.md` ✅ **all 7 applied 2026-08-15**
- The Learn library — registry, guards, article contract → `data-contracts.md` §7b + `architecture.md` (public routes)
- The public site's ONE type scale (`.doc-scale`, 24/17/13/12) → `design-system.md` §11
- Where personal data lives, and what survives account deletion → `architecture.md` §6.6

---

**End of CLAUDE.md. Now go read whichever `/docs/` file applies to your current task.**
