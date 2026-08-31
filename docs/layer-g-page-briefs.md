# Layer G — Page Briefs

> ## ⚠️ THIS FILE IS INTENT, NOT LAYOUT. The approved design is an ARTIFACT.
>
> Every brief below says what a page is *for*, who reads it, and how we would know it
> worked. **None of them describes what is on the page** — that was deliberate (see the
> note under the table) and it has since caused a real error.
>
> **The approved landing page is the storyboard artifact**, not brief §1. On 2026-08-13 I
> assessed the built landing against §1, found two missing layers, and reported that. The
> storyboard shows **twelve** missing sections. §1's five prose "layers" and the
> storyboard's sixteen sections are not the same document and were never meant to be.
>
> **Before reporting on any page here, run `Artifact action:"list"` and read the artifact.**
> Prose records *why*; the artifact records *what the owner said yes to*. When they
> disagree, the artifact wins. Recorded as CLAUDE.md **11j**.

> **Status: intent APPROVED by the owner 2026-08-07.** Four answers, now locked:
> **(1) demonstrate the method first, name it second · (2) the landing page shows a
> FIXED stock — Apple, not a rotating one · (3) the About trust list is sufficient
> without a name · (4) Learn articles target the newcomer, not the paying buyer.**
> **(5) The weekly note gets its OWN section, one permanent page per week**, with an *(⚠️ re-scoped 2026-08-25 — now `/articles`, no fixed template; see §6)*
> archive index — `/notes` + `/notes/2026-08-07`. Not one page rewritten weekly, and
> not mixed into `/learn`. Rationale: each week is original content that can rank and
> be linked to, so the writing compounds instead of being destroyed; and an explainer
> (true for years) and a note (stale in days) do not belong in one list.
>
> Nothing is designed or built beyond this until the layout stage is approved too.
> Fixing a wrong *goal* in a paragraph costs minutes; fixing it after six pages are
> built costs the session.


> ## ⛔ SCOPE CHANGE, 2026-08-22 — two of the six page types are cancelled
>
> The owner cut the list. **`/about` is dropped** (may return later, not now) and
> **`/glossary` is dropped permanently.** Briefs §2 and §5 below are kept as a record of
> what was intended, not as work to do — do not build from them.
>
> `llms.txt` was dropped the same day.
>
> **What actually shipped from this file:** §1 the landing page (rebuilt to the storyboard
> artifact, not to §1's prose), §3 the Learn index, §4 the Learn article template — twelve
> articles, all read through and approved by the owner on 2026-08-21 and 2026-08-22.
>
> **What is still owed: §6, `/articles` — SETTLED 2026-08-26, not yet built.** It began as
> the "weekly market note" at `/notes` with a fixed five-part template; the name and the
> template went on 2026-08-25, and on **2026-08-26 the weekly cadence went too** (owner:
> *"the articles doesn't need to be per week"*). It is now **`/articles`** — measurements,
> market commentary and how-to pieces, human-written and **never automated**, published when
> there is something worth publishing. The first article is written, fact-checked and
> owner-approved; the index design is chosen. **What remains is building the pages.** The
> settled brief is at the top of §6; everything below its horizontal rule is kept as the
> historical record of 2026-08-07 and is **no longer the plan**.
>
> It is still the last page type in Layer G.

---

## How many pages is this, actually?

Worth stating plainly, because "six briefs" does not mean six pages. Three of these are
**one-off pages**; two are **templates** — a single design that many pages are poured
into; one is **recurring**.

| Brief | Kind | Pages at launch | Grows to |
|---|---|---|---|
| Landing `/` | one-off | 1 | 1 |
| About `/about` | one-off | 1 | 1 |
| Learn index `/learn` | one-off | 1 | 1 |
| **Learn article** `/learn/…` | **template** | 4 *(staged)* | ~12 |
| **Glossary** `/glossary` | one page, many entries | 1 | 1 *(entries grow inside it)* |
| Articles archive `/articles` | one-off | 1 | 1 |
| **Article** `/articles/…` | **recurring** | 1 | +1 every week |

So: **six designs to approve**, about **nine pages** at launch, and one of them adds a
new page every week forever.

**"Template" means one design, many pages.** `/learn/what-a-drawdown-is` and
`/learn/reading-a-pe-honestly` are two pages sharing one layout — approve it once and
every future article inherits it. ⚠️ **`/articles` is the exception** — since 2026-08-25 it
deliberately has no fixed template, so each piece is shaped by its own content. What gets
approved there is the page's *furniture* (header, date, byline, disclaimer, archive row),
not the body. This is why the count of *designs* is small while the count of *pages* keeps
growing.
>
> Written 2026-08-07 (G2). Each brief states what the page is *for*, who is reading it,
> and how we would know it worked. It does **not** describe layout — that comes after
> these are right.

---

## The two decisions everything here rests on

**1. Both audiences — layered, not averaged.** The owner's call: a newcomer should get
value and someone experienced should get value. The failure mode is writing for the
average of the two, which serves neither. So every page is **layered**: the top works
with zero vocabulary, and each scroll adds substance for a reader who already invests.
Nobody is patronised; nobody is lost.

⚠️ This corrected an error in the Layer G plan, which said the audience was "a complete
beginner". That contradicted the product — a $15/month terminal with a screener, a
scorecard radar and Excel export is not bought by someone who has never held a share.

**2. Show the method, never open with its name.** The owner likes leading with the
crash-and-recovery idea but is right to fear complexity. The idea is not complicated —
anyone who has heard of a crash understands that stocks fall and recover. The
*vocabulary* is what loses people: "Major Cycle", "drawdown", "lookback", "percentile".

So: demonstrate first, name second.

> Apple is 9% below its high.
> It usually falls 25% before it turns.

Two sentences, no vocabulary, and something no competitor's homepage can say. "Major
Cycle" is then introduced as *the name for what you just saw*, which is a far easier
sell than opening with it.

---

## Non-negotiables — every page, no exceptions

| | |
|---|---|
| Palette | Locked (#25). `--brand-deep` `#1A3A6E`, `--brand-mid` `#1E5CB3`, `--brand-bright` `#2E7DE8` |
| Fonts | Locked (#26). **Every word Sora. Every number JetBrains Mono.** |
| Disclaimer | "Information only — not financial advice" **visible without scrolling** on any page showing a rating, score or signal (#4/#12) |
| Rating words | Only **High Conviction / Constructive / Neutral / Cautious / Bearish**. Never Buy/Sell/Avoid (#2/#16) |
| Phone | Correct at **375px**. No horizontal scroll |
| Paid data | Nothing premium on a public page — see the free/paid line below |
| Provider | Never name the data provider in customer-facing copy |

### The free/paid line on public pages — the hard rule

A public page is readable by everyone *and* cacheable, so anything on it is effectively
published. Only these may appear:

✅ price · current drawdown · typical drawdown · typical recovery time · company name,
sector, exchange
❌ Overall Rating · Health Score · the Verdict · scorecard/radar · rating badges · any
screener output

This is not a guess — it was verified on a live free account: a signed-out-equivalent
viewer already sees *Current Drawdown −9.3%* and *Typical Drawdown −24.7%* on Apple.

⚠️ **Withhold at the data layer, never in the layout** (CLAUDE.md 11b). A value hidden
by a conditional is still shipped inside the page source. The landing page must be built
from a **nightly snapshot file containing only the free fields**, so it is structurally
incapable of leaking a score — not merely careful not to.

---

## 1. Landing — `/`

**Today:** redirects to the login form. Every brand search, every logo click, every link
anyone shares is a dead end. This is the single most valuable page in Layer G.

**Purpose.** Convince a stranger, in about ten seconds, that MajorCycle answers a
question they already have — then get them to a free account.

**Reader.** Arrives from a Google search for the brand, a shared link, or word of mouth.
Knows nothing about us. May or may not already own shares.

**The layers.**

1. **The demonstration** — one real, well-known stock with live figures: price, how far
   below its high, what it typically falls, how long recovery typically takes. Updated
   nightly. *This is the whole product argument, made with data rather than adjectives.*
2. **The name** — "that's a Major Cycle" — introduced only after it has been shown.
3. **The proof** — real screenshots of the product: the verdict block, the scorecard,
   the ranked results table. Captured from the live app so marketing cannot drift from
   reality.
4. **The breadth** — 863 stocks across US, Australia and Canada; health, valuation,
   analyst data in one place. This is the layer that speaks to the experienced buyer.
5. **The ask** — free account, no card. The trial starts at checkout, not at signup.

**Tone.** Plain, confident, specific. Numbers rather than adjectives. No hype, no
urgency, nothing that reads as a tip.

**Worked if:** a stranger can say what MajorCycle does after ten seconds, and someone
who already invests sees something they cannot get free elsewhere.

⚠️ **Open question for the owner — which stock?** A fixed well-known name (Apple) is
predictable and safe. A rotating one feels alive but can surface an awkward figure on
your front page with nobody watching. *Recommendation: fixed, and revisit later.*

---

## 2. About — `/about`

**Purpose.** Earn trust for a money-adjacent product whose author is not named.

**Constraint (owner, locked).** Role and location only. **No name, no photo.**

**The honest problem.** In finance, anonymity costs credibility. So this page must lean
hard on everything that does *not* require a name:

- **How the analysis is produced** — the same maths on every stock, no manual overrides,
  no paid placements, no relationships with any company covered
- **Where the data comes from** and how often it updates
- **A stated editorial policy** — what we will and will not publish
- **What we are not** — not licensed, not advice, not a tip service
- **Dated content**, so nothing looks abandoned
- Links to the legal pages, which are real and specific

**Tone.** Direct and unembellished. Under-claiming is more credible than over-claiming
here.

**Worked if:** a sceptical reader finishes it believing the analysis is honest and
mechanical, without ever wondering who wrote it.

---

## 3. Learn index — `/learn`

**Purpose.** Win search traffic for the questions our buyer already types, and give a
newcomer a path up to the product.

⚠️ **This is where the two audiences genuinely split.** Articles are written for the
newcomer — they exist to be *found*. The paying buyer mostly won't read them. That is
correct and should not be "fixed" by making them more advanced.

**Reader.** Arrived from Google with a specific question. Has never heard of us.

**The page.** A plain, scannable list — title plus one honest sentence on what each
answers. Grouped by theme rather than dated, because these do not expire. A quiet
invitation to the product at the end, never a wall.

**Worked if:** someone lands from search, gets a real answer, and leaves thinking the
site knows what it's talking about — whether or not they sign up that day.

---

## 4. Learn article — `/learn/[slug]`

**Purpose.** Answer one question completely and better than the results above us.

**Structure — the shape that gets quoted.** Clear heading, then **a direct answer
immediately underneath** rather than a preamble. Short paragraphs. Concrete named facts
and real numbers. A worked example using a real stock. No throat-clearing.

**Tone.** Explain the term the first time it's used, then use it normally. Never
condescend, never assume.

**Non-negotiables.** Disclaimer visible without scrolling. Analyst wording verbatim if
quoted. Never imply a recommendation. Dated, with a stated review date.

**Worked if:** a reader gets their answer without needing a second source.

---

## 5. Glossary — `/glossary`

**Purpose.** Define every term the product uses, once, in plain words — so no page has
to stop and explain itself, and so search finds us on definitional queries.

**Source.** Drawn from the 115 terms already in `docs/glossary.md`, so the site and the
internal docs cannot drift into two vocabularies. Customer-facing entries are rewritten
for a newcomer; the internal doc keeps the engineering detail.

**Each entry.** The term, one plain-English sentence, then optionally a concrete example
with a real number. Cross-linked. Individually linkable, so any page can point at one.

**Worked if:** a reader who hits an unfamiliar word on any page can resolve it in one
click and return.

---

## 6. Articles — `/articles` index + one permanent page per article

> ✅ **THE FIRST FIVE ARE PUBLISHED — the last four wired up 2026-08-30.** The
> section now carries the opening measurement plus a recovery study and one ranked
> piece per market, all five sharing a single as-at date of 27 August 2026 and one
> frozen input file (`reference/drawdown-recovery-2026-08-27-DATA.json.gz`). "Coming
> next" is down to one row, and the two promises it lost were both kept.
>
> ⚠️ **The lead is now DECLARED rather than dated** — `FEATURED_SLUG`, owner
> instruction: *"keep the featured article as is."* See `design-system.md` for why
> that is the right shape and not a workaround.
>
> ⚠️ **Wiring the four exposed a defect in the SHIPPED article.** A bare `td`
> selector in `globals.css` — the signed-in terminal's table styling — was setting
> every article data cell to 11.5px mono, under the public site's 12px reading
> floor, from the day the section was built. Invisible because the first piece has
> no text columns for the inherited `nowrap` to break. Fixed and documented in
> `design-system.md`.
>
> ⚠️ **AND THE NUMBER AUDIT FOUND SOMETHING BIGGER THAN THE ARTICLES.** Asked to
> confirm every figure, the third audit layer — re-fetching the named companies from
> outside our own database — disagreed on four of 76, all Australian, all high-yield,
> all in the same direction. That was not an article problem: **our stored prices had
> never been re-adjusted for dividends**, so every drawdown on the whole site read up
> to two points too deep (`architecture.md` §4a, CLAUDE.md 11ae). The owner chose to
> fix it rather than disclose it. Cause fixed, all 871 companies re-pulled, verified
> on 24 random companies across three markets (253,000 prices, zero still drifting),
> and the study re-derived: **81 of the 464 asserted figures moved.** The articles
> were rewritten from that list before review, and the "our prices lag" row was
> deleted from all four fact-check sheets.
>
> ⚠️ **Two things worth carrying forward.** The assertion suite became the WORKLIST —
> it named every figure that had changed, so nothing was corrected by eye. And two of
> the audit scripts were themselves wrong, each having restated a number it existed to
> check, so both would have failed on a correct system (CLAUDE.md 11c).
>
> ✅ **BUILT 2026-08-29.** `/articles` renders the approved direction A — featured
> card, "Coming next", published rows — and `/articles/[slug]` reuses `ArticleDoc`.
> The first article is live on the branch. Guarded by `e2e/articles.spec.ts` (15
> tests), and covered by the existing SEO, render-mode, contrast and auth guards,
> each of which had to be told the new routes exist.
>
> ⚠️ **The first article's mining claim was WRONG and the owner caught it.** The
> draft said mining is *"a quarter of the ASX 200, fifty companies out of two
> hundred"*, and the owner asked the right question: is every Basic Materials
> company a mining company? **No.** Six of the fifty make steel, recycle metal, make
> fibre cement, make building products or make explosives — the last two sell *to*
> miners. Meanwhile six real miners (three thermal coal, three uranium) sit under
> **Energy**. The count of fifty survived by coincidence; the reasoning did not.
>
> ⚠️ **And the same check found a larger defect the owner had not asked about.** The
> sector table compares Basic Materials across three markets, and the three columns
> do not hold the same kind of company: the S&P 500's Basic Materials sector is
> **20 companies of which 2 are miners**, the rest chemicals, fertiliser, paint,
> cement and packaging. So the article's *"Australian miners fall roughly half as far
> again as American ones"* was comparing Australian miners with American chemical
> companies. Rewritten as a composition argument — a quarter of the Australian index
> is mining against four in a thousand of the American one — which is both true and a
> **stronger** version of the point the article was already making.
>
> **The rule for every future piece: a provider's SECTOR label is a classification,
> not a description.** A claim about what companies *do* cannot be read off one.
> Where an article characterises a group ("miners", "banks", "tech"), name the
> exclusions and let the reader check them — which is what sheet 9 of the workbook
> now does.
>
> ⚠️ **No italics in a body** (owner, 2026-08-29): long runs of italic prose read as
> machine-written. Emphasis is `<strong>` and sentence construction, asserted on the
> COMPUTED `font-style` because `<em>` is only one way to arrive at italics.

> ⚠️ **SETTLED 2026-08-26. Everything below the horizontal rule is the brief approved on
> 2026-08-07 and the re-scope of 2026-08-25; both are kept as history, not as the plan.**
>
> ### What an article IS (owner, 2026-08-26)
>
> Not one genre. The section carries **three** kinds of piece, and the design has to hold
> all of them:
>
> | Kind | Example |
> |---|---|
> | **Measurement** — we run our own numbers and report what came back | *How far do ASX shares actually fall?* |
> | **Market commentary** — what happened and what it means | a results season, a rate decision |
> | **How-to** — doing a specific thing | reading a cash-flow statement |
>
> Owner's wording: *"this is the article sections where we sometimes do calculations or just
> talk about what's happening in the market or just talk about how to do certain stuffs."*
>
> ⚠️ **CADENCE IS NO LONGER WEEKLY, and that reverses a decision previously marked LOCKED.**
> Owner, 2026-08-26: *"I think the articles doesn't need to be per week."* Publish when
> there is something worth publishing. **Nothing here becomes automated** — that part of the
> old decision stands, and it is what keeps us outside Google's scaled-content policy.
>
> ### Decisions
>
> | | Decision |
> |---|---|
> | **Length** | 800–1,200 words |
> | **Naming stocks** | Yes, with the site's existing disclaimer. Never buy/sell (#2, #24) |
> | **Market** | **Australia leads every piece; the US and Canada appear inside it as the comparison.** Owner: *"prioritise AU but also include US and CA."* One clear topical identity, three markets of substance |
> | **URL** | `/articles/<topic-slug>` — **no date in the path**. Article 3 is refreshed quarterly and a dated URL makes an updated page look stale |
> | **Volume** | 4 articles in the first 30 days. The limit is the owner's review time, not drafting |
> | **Workflow** | I draft → I fact-check my own draft → I hand over a **source list plus 8–10 spot-checks with public links** → owner cross-checks → owner publishes |
> | **Go-live** | Owner, 2026-08-26: *"we will merge it after we are done with auditing layer G."* Nothing is indexed before then |
>
> ⚠️ **THE SOURCE-LIST WRINKLE IS SOLVED.** Two kinds of claim go into a piece and only one
> has a URL. Events get real links. **Our own figures cannot** — *"trust our database"* is
> exactly the unverifiable claim the owner asked to be able to check. The answer is not to
> link every number: it is to publish the method, then hand over **8–10 spot-checks the
> owner can confirm on a public site in a few minutes**. Nobody can verify two hundred
> figures; ten is a real audit, and if ten are right the method is right.
>
> ### Why the site being DARK changes the running order
>
> `majorcycle.com` still serves the login page, so nothing written now can be indexed. An
> event piece written while the site is dark is **wasted** — *"what the September Fed
> decision meant"* is worthless in November — while an evergreen piece is just as good then.
> **So: evergreen first, event-driven once we are live.** The owner's instinct that events
> drive search is right; it is the month-two engine, not the month-one one.
>
> ⚠️ And the *obvious* event article is the most crowded thing on the internet. Motley Fool
> AU publishes dozens of "reporting season winners and losers". The winnable version is the
> second-order question only we can answer cheaply — *which ASX 200 stocks are still 20%
> below their own highs after reporting season?* Same hook, different competitive field.
>
> ### The first four
>
> | # | Article | Status |
> |---|---|---|
> | 1 | **How far do ASX shares actually fall?** | ✅ **Written, fact-checked, owner-approved 2026-08-26.** 1,200 words |
> | 2 | How long does an ASX share take to recover? | Planned |
> | 3 | Which ASX 200 shares sit furthest below their own highs | Planned — refreshed quarterly |
> | 4 | Do bank shares fall differently to mining shares? | Planned |
>
> **The anti-cannibalisation rule:** `/learn` answers *"what does this mean?"* — timeless,
> no stock names. `/articles` answers *"what does the data say?"* — named companies, real
> figures, dated. Two pages competing for one keyword is a real own-goal, and this is the
> line that prevents it.
>
> ### What the competitors do, and why we do not copy it
>
> Checked directly, 2026-08-26. **Simply Wall St** (`/news`): flat vertical list, 22 a page,
> thumbnail + ticker + category + date + summary, **no featured item**. **Motley Fool AU**:
> the same shape, 40+ a page, no summary. Two blocked automated fetching.
>
> They converge completely — and **it is the wrong pattern for us.** They publish dozens a
> day, so the reader's job is scanning volume. We publish about four a month, and that same
> layout at n=4 reads as abandoned. `/learn` already paid for this lesson: *"a card grid
> needs roughly nine articles before it stops looking abandoned."*
>
> ⚠️ **And no thumbnails.** Every competitor leads with a picture. We have none, each would
> be a real cost we can never re-roll (`design-system.md` §11), and it creates a permanent
> per-article obligation. **Numbers do the work images do elsewhere** — every article here
> is a measurement, so the finding is the art. Free, repeatable, and the one thing on the
> page a competitor cannot copy.
>
> ### The index page — settled 2026-08-26
>
> Structure, owner-approved: **featured article · coming next · published list.** Direction
> A of three drawn in `claude.ai/code/artifact/fd8cbcdc`; B and C deleted.
>
> - **The featured block IS the landing page's analyst briefing**, reused — the shared
>   `.briefing` / `.bt` / `.btxt` / `.bp` components, not a copy. Owner: *"the same vibe like
>   the analyst briefing in the landing page … that will look consistent."* Verified in the
>   browser: all 11 card properties and the title, text and pill type identical. The 56px
>   score ring's slot carries the article's figure instead.
> - **The figure is OPTIONAL.** Owner: *"the article may or may not have any figures."* It is
>   a flex **child**, so an article without one omits the element and the body takes the full
>   width — no declared track holding an empty column open, which is the `/learn` bug.
> - **Unwritten pieces recede by WEIGHT and COLOUR, never `opacity`** — the rule `/learn`'s
>   upcoming rows learned when `opacity:.7` rendered at 3.38:1 while the guard read 6.81.
> - **Rows, not cards**, so the page never has a hole in it. Each row leads with its
>   **finding**, not a summary.
> - Heading: *"What's happening, and what it means"*, over a lead naming all three kinds of
>   piece and reusing Learn's *"nothing you need an account to read."*
>
> **The article page itself needs no design** — owner, 2026-08-26: the live Learn article
> pages already show it. `/articles/[slug]` reuses `ArticleDoc` and `LegalNotice`.
>
> ### Next session
>
> Owner reviews the approved article and the index design, gives feedback, **then we build.**
> The storyboard at `claude.ai/code/artifact/24903b9d` drew the OLD weekly-note template and
> is superseded — it carries a banner saying so.
---

**Purpose.** Give the site a reason to be visited again, and a reason to earn an email
address.

**Cadence (owner, locked).** Weekly, human-edited. **Not** automated daily. Google's spam
policy names scaled feed-driven pages as abuse, and it would put us in competition with
Reuters and the AFR — who are faster and far more authoritative.

**Byline.** MajorCycle. No invented author.

**Shape.** Fixed format so each week is a fill-in rather than a blank page: what moved,
what the cycle data says about it, one stock worth a closer look, one thing to be
sceptical about. A standing line explaining how it is produced.

**Flow.** I draft → **the owner edits and approves** → publish. In a money topic that
review is what makes it legitimate, so it is a step in the process, not a formality.

**Home (owner, locked).** Its own section: `/notes` is the archive list, each week is a
permanent page at `/notes/[date]`. Deliberately **not** `/learn` — an explainer stays
true for years and a note is stale in days, so one list would bury the evergreen work
under dated work. And deliberately **not** one page rewritten weekly, which would
destroy 51 weeks of writing a year and leave Google a single page to find.

⚠️ **Each note is dated and stays dated.** Never quietly refresh an old note's figures to
make it look current — that is the "everything changed today" signal that teaches Google
to distrust the whole site, and on a money topic it is also just dishonest.

**Worked if:** a reader finishes it slightly better informed, and it never reads as a tip
sheet.

---

## Intent — settled 2026-08-07

| | Decision |
|---|---|
| Landing order | **Demonstrate the method first**, name it second |
| Landing stock | **Fixed — Apple.** Not rotating: alive is not worth an unwatched awkward figure on the front page |
| About | Trust list is **sufficient** without a name |
| Learn articles | Target the **newcomer**, not the paying buyer |
| Weekly note *(now **articles**)* | **Own section**, one permanent page each, with an index. ⚠️ Re-scoped twice — 2026-08-25 dropped the name and the fixed template; **2026-08-26 dropped the weekly cadence** and widened it from one genre to three (measurements, market commentary, how-to). Human-written and never automated still stands. §6 has the settled brief |

**Still to approve: the layout stage.** These briefs fix *what each page is for*. What it
looks like comes next, and is a separate approval.
