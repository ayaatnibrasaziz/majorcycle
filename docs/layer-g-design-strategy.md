# Layer G — Design Gap Analysis & Tool Strategy

> Written 2026-08-07 (G2), **from measurements taken on the live site**, not from
> impressions. Every number below was read off `www.majorcycle.com` in a browser at
> 1440×900. Awaiting the owner's approval of the tool stack before any design work.
>
> ⚠️ **This is a dated SURVEY, kept as the record of what Layer G was answering. Do not
> read it as current.** The page most of it measures, `/methodology`, was retired on
> 2026-08-13 and folded into `/#how-it-works`; the reading scale, `PageFrame` and the
> `--pub-*` tokens all landed in response to the findings below. For the state today see
> `design-system.md` §3 and §9. The measurements are left exactly as taken — rewriting a
> survey to match the fix destroys the evidence that the fix was needed.

---

## 1. Design gaps — what the measurements say

### The finding that explains most of the others

**The terminal's type scale has been applied to reading pages.** MajorCycle's app is a
dense financial terminal, and 13px body text with 8–11px labels is *correct* there —
users scan, density is a feature, it looks professional. `/methodology` inherited that
scale and is a completely different job: it is read, not scanned.

Measured on `/methodology`:

| | Measured | Long-form norm |
|---|---|---|
| Body text | **13px** | 16–18px |
| Smallest text on the page | **8px** (×5 elements) | ≥12px |
| Distinct font sizes on one page | **9** (8 · 9 · 10.5 · 11 · 11.5 · 12 · 13 · 14 · 24) | ~5–6 steps |
| Content column | **440px = 31% of screen** | 640–720px for prose |
| Images or diagrams | **0** | — |
| Elements failing WCAG AA contrast | **8** | 0 |

`/login` shows 8 distinct sizes and `/pricing` shows 11 — in cards a few hundred pixels
wide. Sizes like 10, 10.5, 11 and 11.5 sitting together do not read as hierarchy; they
read as inconsistency, because the eye cannot resolve a half-pixel difference as intent.

### Gap A — Contrast failures, including on the two things that matter most

Measured, not estimated (WCAG relative-luminance formula, computed in-page):

| Element | Ratio | Needs |
|---|---|---|
| **Rating tier badges** — white on `--c-tier-3` / `--c-tier-4` | **2.38 : 1** | 4.5 : 1 |
| **"Full disclaimer" link** | **2.69 : 1** | 4.5 : 1 |
| "Financial Terminal" wordmark (9px) | 2.69 : 1 | 4.5 : 1 |

> ✅ **All three closed, and the scope note below was overtaken.** The badges and the
> disclaimer link were fixed inside G as planned; the wordmark followed on 2026-08-22, when
> the owner authorised a whole-site sweep rather than deferring the rest to Layer H. That
> sweep found far more than this table: `--text-muted` at **2.97:1** (258 failing elements on
> Browse alone, including the mandatory disclaimer), the five score chips white-on-tier, and
> **57 pieces of direction-palette text** on a single stock page. Public and signed-in pages
> now both have zero contrast failures and zero deferrals. ⚠️ This table is the state on the
> day Layer G started — read it as a starting point, not as the current site.

Two of these are not cosmetic. The **rating tier badges are `design-system.md` §4, "THE
Most Important Spec"** — the five labels are the product's entire vocabulary, and they
are the hardest thing on the page to read. The **disclaimer link is compliance-adjacent**
(#4/#12): a legally material link should not be the faintest text on the page.

⚠️ Scope note: the Layer G plan says accessibility is *measured* in G and *fixed* in
Layer H. That holds for the app. But these two sit on pages G is redesigning anyway, and
"we redesigned this page and left the illegible badge" is not defensible. **Recommend
fixing these two inside G**, leaving the rest of the accessibility sweep to H.

### Gap B — There is no wide layout, at all

Every public page is locked to 440px — sign-in-card width — because that is the only
width the shared frame offers. Nothing is *broken*: at 440px the line length is ~58
characters, which is genuinely comfortable. The problem is a **ceiling**: a landing page
with product screenshots, an article with a table, a glossary, and a results-table demo
cannot exist in 440px.

### Gap C — The one idea worth explaining has no picture

`/methodology` explains a crash-and-recovery cycle using **zero diagrams**. This is the
most explainable concept in the product — a line that falls, bottoms and recovers, with
a marker showing where the stock sits today — and it is currently prose only.

This is the single highest-leverage addition in Layer G. It serves the landing page, the
methodology page, the articles and the share image from one asset.

### Gap D — No front door, no navigation, nothing to share

Known from G1 and unchanged: `/` bounces to login; five public pages have no inbound
links; there is no `og:image`, so every shared link renders as a bare grey card.

### Gap E — The best asset is invisible

The Results table and the verdict block are genuinely strong — a beginner reads
*Constructive · Healthy · Expensive* with no financial vocabulary, while the numbers
underneath satisfy someone who invests. **Nobody outside the paywall has ever seen
them.** Screenshots on the landing page fix this at zero product risk.

---

## 2. Real-world patterns worth adapting — and why each

Named because each solves a *measured* gap above, not because the site is admired.

| Pattern | Seen in | Fixes |
|---|---|---|
| **Two type scales in one product** — a dense scale for the app, a generous one for reading pages | Stripe (docs vs dashboard), Linear (app vs marketing) | The 13px-body finding. This is the correct fix: **not** enlarging the app, but stopping the app's scale from leaking into content pages |
| **Content-width tiers** — prose ~680px, media wider, hero full-bleed | Stripe, Vercel, most documentation sites | Gap B, without abandoning the 440px sign-in card that is already right |
| **Real numbers as the hero**, not a stock photograph | Wise, Monzo, Baremetrics | Gap E and the approved landing direction — the Apple demonstration |
| **Progressive disclosure** — one plain claim, depth appearing on scroll | Stripe | The "both audiences, layered not averaged" decision |
| **Annotated diagram as the explainer** | Every good documentation site | Gap C |
| **Answer-first article structure** — heading, then the answer immediately, no preamble | Stripe docs, MDN | The `/learn` brief; also what makes content quotable by AI search |
| **Restraint: one accent, generous space, no decoration** | Linear | Matches a locked navy palette better than a colourful marketing style would |

⚠️ **Not adapting:** dark-mode marketing pages (the product is light and consistency
matters more than fashion), animated gradients and scroll-jacking (costs the Lighthouse
90+ target in decision #33), and testimonial/logo walls (we have no customers yet, and
inventing them is out of the question).

---

## 3. Claude-side capabilities I would use

Stated honestly: these are **guidance and verification**, not automatic design.

| Capability | Used for | Honest value |
|---|---|---|
| **Browser measurement** (the tools used above) | Contrast, widths, computed fonts, rendered type scale on the real page | **The differentiator.** Design opinions are cheap; "8 elements fail at 2.38:1" is not an opinion |
| **`canvas-design` skill** | The share image, weekly-note header artwork | Real output — PNG/PDF in the brand palette |
| **`dataviz` skill** | The cycle diagram, and any chart colour work | Carries an accessible-palette formula and a validator — directly relevant given the contrast failures |
| **Claude Design** (`DesignSync`) | The persistent gallery — already holds the generated foundations | Where you review, and where the next session inherits from |
| **`shadcn` guidance** | Component patterns | You already own shadcn/ui in-repo; this keeps new components idiomatic |
| **Artifacts** | Publishing design options you can open and share | Better than screenshots for reviewing a layout |
| **Playwright** | Re-capturing product screenshots reproducibly; **contrast as a test** | Lets a design rule become a gate that fails CI, not a note someone forgets |

The last row is the important one. Everything this project has learned says a rule that
is written down but not asserted will drift. **A contrast check in the test suite is
worth more than any design tool on the list below.**

---

## 4. External tools — the honest field

⚠️ Filtered for a real constraint: the owner is on **Windows**, so Mac-only tools
(CleanShot X, Screen Studio, Sketch) are excluded regardless of merit.

### Free

| Tool | For | Verdict |
|---|---|---|
| **Excalidraw** | The cycle diagram (Gap C) | ✅ **Use.** Exports clean SVG, hand-drawn or precise, no account needed |
| **WebAIM Contrast Checker** | Verifying colour pairs | ✅ **Use** — though I compute this in-browser anyway |
| **axe DevTools** (extension) | Full accessibility sweep | ✅ **Use** in Layer H |
| **Lighthouse** (in Chrome) | Performance + SEO + a11y score | ✅ Already planned for G7 |
| **Squoosh** | Image weight | ✅ **Use** — your logo is 384 KB for a 34px render |
| **shadcn/ui** | Components | ✅ Already yours, in-repo |
| **Lucide** | Icons | ✅ Already installed |
| **Google Fonts** | Sora, JetBrains Mono | ✅ Already used, locked |
| **`next/og`** | Share images | ✅ Ships with Next — no dependency needed |
| **Realtime Colors** | Previewing a palette on a real layout | 🟡 Optional — your palette is locked, so limited use |
| **Land-book · Godly · SaaS Landing Page** | Inspiration galleries | ✅ **Use** — see recommendation |
| **Penpot** | Open-source Figma alternative | ❌ See below |
| **Figma** (free: 3 files) | Design files | ❌ See below |

### Paid

| Tool | Cost | Verdict |
|---|---|---|
| **Tailwind Plus** (was Tailwind UI) | **~US$299 once** | 🟡 **The only purchase worth considering.** Marketing-page components in *exactly* your stack — Tailwind + React. Not templates to paste, but proven layout patterns for hero, feature and pricing sections |
| **Mobbin** | ~US$15–30/mo | 🟡 A searchable library of real product UI. Genuinely useful reference, but a subscription for something free galleries mostly cover |
| **Figma Professional** | US$16/editor/mo | ❌ See below |
| **Framer / Webflow** | US$5–30/mo | ❌ Site builders. You have Next.js; these would replace it, not help it |
| **Stock photography** | varies | ❌ Not needed. Your product screenshots are the imagery |

---

## 5. Recommendation

### Do not buy a design tool. Specifically, do not use Figma.

This is the recommendation most likely to surprise, so here is the reasoning rather than
the conclusion.

A Figma file is **a second description of the design**, sitting beside the real one in
code. This project has been bitten by that exact shape **four times**: the pricing lists
in three places, the rounding rule in three places, the canonical origin in five files,
"signed-out only" in two lists. Your own CLAUDE.md rule 11c exists because of it. A
design file drifts from the built site the moment either changes, and the drift is
invisible until someone notices the site does not match the picture.

The second reason is practical: **you are not a designer.** A Figma licence buys a tool
you would not use, and a workflow where I hand you a picture of a page instead of the
page. You would still have to approve the real thing afterwards, so the picture is a
step that costs time and adds a source of truth.

**Instead: I build in code, you review the real page.** The site *is* the design file.
That is only viable because verification is strong here — real-browser measurement, a
preview deployment, and the test suite as a gate.

### The recommended stack

| Layer | Tool | Cost |
|---|---|---|
| Design source of truth | **The code itself** — shadcn/ui + Tailwind + your locked tokens | $0 (owned) |
| Review surface | **Claude Design gallery + Vercel preview** | $0 (owned) |
| The cycle diagram | **Excalidraw** → SVG, hand-tuned to the palette | $0 |
| Share image | **`next/og`** + `canvas-design` for the artwork | $0 |
| Image weight | **Squoosh** | $0 |
| Accessibility gate | **In-browser contrast measurement, promoted into a Playwright test** | $0 |
| Inspiration input | **Land-book / Godly**, plus any site you like the look of | $0 |
| *Optional* | **Tailwind Plus**, US$299 once | 🟡 your call |

**Total recommended spend: $0.**

### On Tailwind Plus — the one honest maybe

$299 once is small against your time, and it is the only paid item aimed at your actual
stack. It would buy proven marketing-page layout patterns rather than components you
paste blindly.

But I can write those layouts, and your palette, fonts and components are already locked,
so much of what it sells you cannot use as-is. **My recommendation is to skip it for
now** and revisit only if the landing page stalls on layout rather than on content. That
is a decision better made with a draft in front of you than in the abstract.

### What I need from you instead of money

**Two or three websites whose *look* you like** — any industry, they do not have to be
financial. That is worth more than every tool on this list, because it converts taste you
have into a target I can build against. Without it I am guessing at what "good" means to
you, and taste is the one thing I cannot measure.

---

## 6. Sequence, once approved

1. **Type scale + contrast** — a reading scale for content pages, fix the two material
   contrast failures (tier badges, disclaimer link). Foundational: everything else sits
   on it.
2. **Page frame** — narrow / prose / wide tiers, header and footer defined once (11c).
3. **The cycle diagram** — one asset serving landing, methodology, articles, share image.
4. **Share image** — you approve the artwork before it ships.
5. **Landing page layout** — the approved Apple demonstration, then the name, then proof.
6. **Then G3+** builds the remaining pages on the approved frame.

Steps 1–4 are foundations, and each is independently reviewable. Nothing here goes live:
PR #89 stays open until Layer G is complete.
