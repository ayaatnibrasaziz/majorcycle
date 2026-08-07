# Layer G — Page Briefs

> **Status: DRAFT, awaiting the owner's corrections. Nothing is designed or built from
> these until they are approved.** This is deliberate — fixing a wrong *goal* in a
> paragraph costs minutes; fixing it after six pages are built costs the session.
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

## 6. Weekly market note

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

**Worked if:** a reader finishes it slightly better informed, and it never reads as a tip
sheet.

---

## What I need from the owner

Correct the **intent**, not the wording — the words come later.

1. **Landing:** does the demonstrate-then-name order feel right, or should the product
   itself lead?
2. **Landing:** fixed stock or rotating? *(Recommend fixed.)*
3. **About:** is the trust list enough, given no name appears?
4. **Learn:** confirmed that articles target the newcomer, not the buyer?
5. Anything above that is simply wrong about the business.
