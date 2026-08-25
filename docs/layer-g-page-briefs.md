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
> **What is still owed: §6 — and it was RE-SCOPED on 2026-08-25.** It is no longer the
> "weekly market note" at `/notes` with a fixed five-part template. It is **`/articles`**:
> weekly, human-written pieces on **what actually happened that week**, each shaped by that
> week's story rather than poured into a form. The owner's reasoning is search visibility —
> *"the latest news that people would want to read"* — and that a rigid template makes every
> week look identical to a reader and to a crawler. §6 below is kept as the historical
> record of what was approved on 2026-08-07 and is **no longer the plan**; read it for the
> parts that survived, which are listed at the top of it.
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

## 6. Articles — `/articles` (archive) + one page per week

> ⚠️ **RE-SCOPED 2026-08-25. Everything below the line is the brief approved on 2026-08-07
> and is kept as history, not as the plan.** Read it for what survived, which is this:
>
> | Still true | Changed |
> |---|---|
> | **Weekly, human-written.** Not automated, not daily | The **name**: "weekly market note" → **articles** |
> | **Its own section**, separate from `/learn` | The **fixed five-part shape** is dropped — each piece is shaped by that week's story |
> | **One permanent page each**, never one page rewritten | The **framing**: from a structured column to *what actually happened this week* |
> | **Byline: MajorCycle**, no invented author | The **URL shape** is reopened — dated path vs topic slug, undecided |
> | **Never retro-edit a published piece's figures** | The **purpose** leans harder on search visibility |
>
> **Owner's reasoning:** *"I don't like the idea of having a consistent format. I think it
> will be better to post what has happened in the week so that it ranks better for SEO as it
> is saying the latest news that people would want to read."*
>
> **Decided 2026-08-26 — four answers, three settled and one deferred:**
>
> | | Decision |
> |---|---|
> | **Length** | **800–1,200 words.** Long enough to rank and to say something real; short enough to review every week without it becoming a burden |
> | **Naming stocks** | **Yes**, with the disclaimer already used across the site. Naming companies is most of the search value. We never say buy or sell — locked decision #2 and the ASIC posture (#24) apply here exactly as they do in the product |
> | **Workflow** | **I draft → I fact-check my own draft and hand over a SOURCE LIST WITH LINKS → the owner cross-checks → the owner publishes.** The source list is a deliverable, not a courtesy: it is what makes the owner's review a real check rather than a rubber stamp |
> | **Angle** | ⏸ **Deferred to the next session.** What an article is mostly *about* — this week's movers read through our data, straight market news, one company in depth, or genuinely whatever the week gives — is the decision the rest hangs on |
>
> ⚠️ **The source list has a wrinkle worth solving before the first draft, not during it.**
> Two kinds of claim go into one of these pieces and only one of them has a URL:
>
> - **Events** — why gold moved, what a company announced. These have real sources and get
>   real links.
> - **Our own figures** — prices, weekly moves, drawdowns, P/E, margins. These come from our
>   database. There is no external page to link to, and *"trust our database"* is exactly the
>   kind of unverifiable claim the owner asked to be able to cross-check.
>
> **Proposed and NOT yet agreed:** every figure from our own data is listed with the value,
> the date it is as at, and a **public cross-check link** (the exchange's or a quote site's
> page for that ticker) so the owner can confirm it independently in one click. That keeps
> the promise honest rather than circular. Confirm at the start of the next session.
>
> **Next step, agreed:** draft one article as a **markdown file** against a real week, settle
> the shape on that, and only then design the page. The storyboard published on 2026-08-25
> (`claude.ai/code/artifact/24903b9d`) drew the OLD template and is superseded.

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
| Weekly note *(now **articles**)* | **Own section**, one permanent page per week, with an archive. ⚠️ Re-scoped 2026-08-25: `/articles`, weekly and human-written but with **no fixed template**, framed as what happened that week. §6 has what survived and what changed |

**Still to approve: the layout stage.** These briefs fix *what each page is for*. What it
looks like comes next, and is a separate approval.
