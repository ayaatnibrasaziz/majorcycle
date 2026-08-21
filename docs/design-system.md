# Design System

> **Purpose:** Defines every visual primitive — colours, fonts, spacing, components, chart standards, labels — used in `MajorCycle`. Read this before any UI task. Pair it with the visual parity rule from CLAUDE.md and the reference HTML.
>
> See also: `CLAUDE.md`, `/reference/original-design.html`.

---

## 1. The Visual Parity Rule (Repeat, Important)

Every UI section that has an equivalent in `/reference/original-design.html` MUST visually match it: same layout, same spacing, same hover behaviour, same tooltips, same colours. Before building any UI component:

1. Open `/reference/original-design.html`
2. Locate the equivalent section (search for distinctive text or class names)
3. Inspect its HTML structure, CSS values, and behaviour
4. Replicate in React + Tailwind

The new build's job is to **rebuild the same product on a modern foundation**, not to redesign it. Where reference exists, reference wins.

---

## 2. Brand Colours

```css
:root {
  /* Brand — primary identity */
  --brand-deep:    #1A3A6E;
  --brand-mid:     #1E5CB3;
  --brand-bright:  #2E7DE8;
  --brand-light:   #EBF3FF;
  --brand-light-border: #BFDBFE;  /* the border that PAIRS with --brand-light */

  /* Surfaces */
  --bg-page:       #F0F4F8;
  --bg-surface:    #FFFFFF;
  --bg-sidebar:    #FFFFFF;
  --bg-header:     #FFFFFF;
  --bg-hover:      #F5F8FF;
  --bg-stripe:     #F8FAFC;

  /* Text */
  --text-primary:   #0F1923;
  --text-secondary: #4A5568;
  --text-muted:     #8A97A8;
  /* NO `--text-white`. It was listed here until 2026-08-07 and has NEVER existed
     in globals.css — a documented nickname for a colour nothing defines. Removed
     because it is a landmine, not because anything was broken: `var(--text-white)`
     appears in zero files, and white text (buttons, badges, checkmarks) uses
     Tailwind's own `text-white` utility, which is unrelated and works.
     ⚠️ Why it matters — an UNDEFINED custom property does not fall back, it voids
     the whole declaration. `color: var(--text-white)` on a navy button yields
     inherited colour, i.e. plausibly navy-on-navy: invisible text that reads as a
     rendering glitch rather than a typo. Same mechanism cost an hour the same day,
     when the design gallery rendered entirely in Times New Roman while labelled
     Sora, because `--font-sans` sat in `@theme inline` rather than `:root`. */

  /* Borders */
  --border:        #E2E8F0;
  --border-strong: #CBD5E1;
  --border-faint:        rgba(26,58,110,.08);
  --border-faint-strong: rgba(26,58,110,.10);

  /* Rating tier semantic colours (the underlying hex values do not change,
     only the label text changes — see section 4 below) */
  --c-tier-1:      #006400;  /* High Conviction */
  --c-tier-2:      #228B22;  /* Constructive */
  --c-tier-3:      #D4A017;  /* Neutral */
  --c-tier-4:      #FF4500;  /* Cautious */
  --c-tier-5:      #B22222;  /* Bearish */

  /* Ink shades — for text on tinted backgrounds */
  --c-tier-2-ink:  #0D5C0D;
  --c-tier-5-ink:  #8B1414;
  --c-tier-3-ink:  #8A6710;

  /* Tint scale — 10/12% alpha for pills, cells, hover states */
  --tint-tier-2:        rgba(34,139,34,.10);
  --tint-tier-2-strong: rgba(34,139,34,.12);
  --tint-tier-5:        rgba(178,34,34,.10);
  --tint-tier-5-strong: rgba(178,34,34,.12);
  --tint-tier-3:        rgba(212,160,23,.10);
  --tint-tier-3-strong: rgba(212,160,23,.12);
  --tint-brand:         rgba(46,125,232,.10);
}
```

> **Notice panels use the pair `--brand-light` + `--brand-light-border`.** Never write the
> border as a bare `#bfdbfe`. It had been hand-written **13 times across 8 components and 3
> rules in `globals.css`** before the Layer F audit named it (F-A4) — the fill was tokenised and
> its companion border was not. The consequence is invisible until it isn't: retuning the brand
> palette moves every panel's background and leaves thirteen borders on the old blue. **If you
> introduce a colour that pairs with an existing token, tokenise it in the same commit.**

These are exposed as Tailwind v4 theme tokens in the **`@theme inline` block at the top of `web/app/globals.css`** — Tailwind v4 is CSS-first and this project has **no `tailwind.config.ts`** (the doc named one until 2026-08-22; nobody had gone looking for it):

```ts
theme: {
  colors: {
    'brand-deep': 'var(--brand-deep)',
    'brand-mid': 'var(--brand-mid)',
    'brand-bright': 'var(--brand-bright)',
    'tier-1': 'var(--c-tier-1)',
    // ...
  }
}
```

---

## 3. Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

| Use | Font | Weight | Size |
|---|---|---|---|
| All UI text (body, labels, buttons) | Sora | 400 / 500 / 600 / 700 | 11px – 16px |
| Numbers, prices, scores, percentages, code | JetBrains Mono | 400 / 500 / 600 | 11px – 26px |
| Hero values (KPI cards, headline metrics) | JetBrains Mono | 600 | 26px (`--font-hero`) |
| Card titles | Sora | 600 | 13px |
| Tooltips | Sora | 400 (title 600) | 11px |
| Body small | Sora | 400 | 12px |
| Body | Sora | 400 | 14px |

**Rule:** Every numeric value uses JetBrains Mono. Every word uses Sora. No exceptions.

### ⚠️ TWO scales, not one — the table above is the APP scale (added 2026-08-07)

The sizes above are correct for the signed-in terminal: it is **scanned**, density is a
feature, and 11–14px reads as professional in a data grid. They are wrong for a page that
is **read**, and they have leaked onto the public pages.

Measured on the live `/methodology` at 1440×900:

| | Measured | Reading norm |
|---|---|---|
| Body text | **13px** | 16–18px |
| Smallest text on the page | **8px** (×5 elements) | ≥12px |
| Distinct font sizes on one page | **9** (8 · 9 · 10.5 · 11 · 11.5 · 12 · 13 · 14 · 24) | ~5–6 steps |
| Diagrams explaining a visual idea | **0** | — |

`/login` renders 8 distinct sizes and `/pricing` 11 — inside cards a few hundred pixels
wide. ⚠️ **Sizes half a pixel apart do not read as hierarchy, they read as
inconsistency**, because the eye cannot resolve 10.5 vs 11 as intent. Collapse
near-duplicates rather than adding steps.

**The fix is NOT to enlarge the app.** The terminal stays as it is. Layer G adds a second,
generous **reading scale** used only by public/content pages — the same split Stripe and
Linear run between their docs and their dashboards. A component that appears in both
(buttons, badges) keeps one size per context, chosen by the frame it sits in, never by a
one-off override.

#### The reading scale — BUILT 2026-08-08 (G2 step 1)

Seven steps, defined once as tokens in `web/app/globals.css` and applied once through
`.reading`. **A page never types a px value**; it asks for an element or a class.

| Token | Size | Use |
|---|---|---|
| `--rd-micro` | 12px | Eyebrows and labels — uppercase, tracked, never a sentence |
| `--rd-small` | 14px | Captions, meta, footnotes |
| `--rd-body` | 17px | Body copy |
| `--rd-lead` | 20px | Lead paragraph and `h3` (separated by weight, not a fourth size) |
| `--rd-h2` | 26px | Section heading |
| `--rd-h1` | 36px | Page title |
| `--rd-display` | 48px | Landing hero only |

Line lengths are tokens too: `--measure-narrow` 440px (auth cards), `--measure-prose`
680px (~68 characters at `--rd-body`), `--measure-wide` 1120px (landing). A page picks
one via `<PageFrame width="narrow|prose|wide">`; the public layout owns the header and
footer so widening a page cannot fork the chrome (11c).

⚠️ **`--rd-micro` is a FLOOR.** Nothing on a reading page goes below 12px, and
`e2e/contrast.spec.ts` fails the build if one does. 8px uppercase is decoration wearing
the costume of information. ❌ **That test used to name `/methodology`, which no longer
exists** — it was folded into the landing as `#how-it-works` (2026-08-13). The floor check
moved to `/terms` and the five-tier legibility check moved to `/`, because those are where
those things now render. **When a page is deleted, its guards do not delete themselves;
they either move to the surface that inherited the job or they quietly stop checking.**

⚠️ **`.reading` lives in `@layer base`.** Unlayered, `.reading a { color }` (0,1,1) beat
Tailwind's `.text-white` (0,1,0) and painted a call-to-action brand-blue on a brand-blue
button — 1.0:1, invisible. Same mechanism as the note above the reset in `globals.css`.
Any new scoped-typography rule goes in the same layer or it will outrank the utilities
that are supposed to override it.

#### `--pub-*` — the signed-out site's own scale (added 2026-08-13)

`/disclaimer`, `/terms` and `/privacy` do **not** use the reading sizes: owner instruction
was that the legal pages match the rest of the public site rather than sit a step above it.
`AuthCard` — login, signup, contact, reset-password, deletion-requested, pricing — reads
the same tokens, so the two families cannot drift apart.

| Token | Size | What it is |
|---|---|---|
| `--pub-title` | 24px | Page title. `AuthCard` h1 from 640px up; the legal masthead, the Learn index and Learn articles always (via `.doc-scale`) |
| `--pub-title-sm` | 22px | `AuthCard`'s phone step-down. The legal masthead does **not** step |
| `--pub-h` | 17px | Legal clause heading (`= --rd-body`) |
| `--pub-body` | 13px | Body text on every public page |
| `--pub-label` | 12px | Labels and meta (`= --rd-micro`, the floor) |

**This is not a third scale.** Every value is a size that was already rendering on a live
public page; the tokens exist so the choice is made in one place instead of being typed
into each component. Heading-over-body on a legal page is 17/13 = **1.31**. (Round 1's
26/17 was 1.53, which is why the clauses read as headlines; 20/13 would have been 1.54.)

⚠️ **Named `--pub-*`, not `--doc-*`.** They were introduced for the legal documents, but a
token called "doc" that the sign-in card reads is precisely the misleading name this repo
keeps getting caught by. If a seventh public surface appears, it reads these too.

⚠️ **`--pub-title-sm` is not tidiness — it is the trap.** `AuthCard` rendered
`text-[22px] sm:text-[24px]`; swapping that for `--pub-title` in one step would have
**grown every form title on a phone by 2px**, invisibly, with nothing watching. Whenever a
hand-typed value is replaced by a token, check whether the value was *responsive* first.

⚠️ **Guarded by measurement, not by inspection.** `e2e/legal-doc.spec.ts` loads
`/contact` and `/terms` in a real browser at 1280 and 375 and fails if their title or body
sizes disagree. Asserting the CSS variable would prove nothing: a typo'd `var(--pub-bdy)`
resolves to nothing and silently inherits, leaving the token correct and the pixels wrong.

⚠️ **Specificity is load-bearing.** `.reading .doc-title` is (0,2,0) and beats
`.reading h1` (0,1,1) *including* the ≤640px block, because media queries add no
specificity. So the mobile step-down does not apply to a legal page and these sizes must
stand alone at 375px. They do: 24/17/13.

#### The landing page has its OWN sizes, in its own file — and that is deliberate

`/` is not a reading page and not a form; it is a **composition**, closer to a chart than
to an article. Its type lives in `web/app/(public)/landing.css`, every rule scoped under
`.lp`, running from 9px on a ruler tick to `clamp(30px, 4.6vw, 50px)` on the hero. It does
**not** read `--rd-*` or `--pub-*`.

The reason is that those two scales exist to make *running text* consistent, and almost
nothing here is running text: axis ticks, ruler labels, table cells, badge captions and a
display headline all answer to the composition around them rather than to a shared step.
Forcing them onto a seven-step scale would either coarsen the drawing or push a fourth set
of tokens into `globals.css` that only one page ever reads.

⚠️ **The bargain is that the scope must actually hold.** Everything is under `.lp`, so
nothing here can reach another page — which `e2e/contrast.spec.ts` checks from the other
direction by measuring `/` as a laid-out page in its own right. And the 12px floor does
**not** apply: this page draws chart furniture, where 9px tick labels are the convention
(§14 lists the equivalent app-side exemptions by name). Body copy on `/` is 15px.

⚠️ **The root font-size is 14px, so `rem` and Tailwind's spacing scale do not agree with
your intuition.** Tailwind `px-5` is `1.25rem` = **17.5px**, not 20. The landing's
full-bleed band is written `margin: -1.75rem -1.25rem -2.5rem` in **rem for exactly this
reason**; typed in px to match the numbers the layout "looked like" it used, the dark band
hung 2.5px proud of the viewport edge and produced a horizontal scrollbar at 375px.

---

## 4. Rating Tier Labels — THE Most Important Spec

The five composite rating tiers display as **neutral, advice-free language**. The colours and score bands stay identical to the original; only the label words change.

| Score Range | Label (use exactly this text) | Colour Token | Semantic |
|---|---|---|---|
| 80–100 | **High Conviction** | `--c-tier-1` (#006400) | Best-in-class opportunity |
| 65–79 | **Constructive** | `--c-tier-2` (#228B22) | Favourable setup |
| 50–64 | **Neutral** | `--c-tier-3` (#D4A017) | Mixed signal |
| 35–49 | **Cautious** | `--c-tier-4` (#FF4500) | Elevated risk |
| 0–34 | **Bearish** | `--c-tier-5` (#B22222) | Significant concerns |

**Forbidden everywhere in our scoring outputs:** Buy, Sell, Strong Buy, Hold, Avoid, Recommend, Outperform, Underperform, Overweight, Underweight.

**Allowed verbatim from yfinance for the Analyst Consensus field only:** "Strong Buy / Buy / Hold / Underperform / Sell" — these are reported as third-party data, with an "Analyst consensus from Yahoo Finance" attribution underneath.

**The attribution is visible and unconditional — never colour or a tooltip alone.** The analyst chip in `BadgeRow` renders a literal `Analysts:` prefix in every state. It once appeared only when our own badges were absent, on the reasoning that our label already framed the chip; that is backwards. In a row reading "Neutral · Stretched · **Buy**", the third chip looks like the third thing *we* concluded — the one reading rule 2 exists to prevent. A `title` attribute doesn't rescue it either: tooltips don't exist on touch. Six characters of prefix, no ambiguity.

### Valuation Zone Labels (a separate dimension)

The Major Cycle valuation_zone is also re-labelled:

| Old | New |
|---|---|
| STRONG BUY | DEEP VALUE |
| BUY | VALUE |
| WATCH | FAIR |
| HOLD | STRETCHED |

**Two distinct readings on the Results tab.** The `valuation_zone` (Deep Value →
Stretched) is derived purely from cycle position (current drawdown vs the stock's
typical pullback). The **Valuation** column does NOT use those words — it shows the
health-gated 0–100 `valuation_score` with its own ladder of labels, coloured by the
score tier (one colour per label, so a label never shows two colours):

| Score | Valuation label | Tier colour |
|---|---|---|
| 80–100 | Compelling | `#006400` |
| 65–79 | Attractive | `#228B22` |
| 50–64 | Reasonable | `#D4A017` |
| 35–49 | Elevated | `#FF4500` |
| 0–34 | Expensive | `#B22222` |

The **Cycle Position** column shows just the 0–100 reading (gauge + number, coloured
by `cyclePositionColor`). The zone words are *not* rendered in that cell — they're
described in its tooltip (75+ Deep Value · 50+ Value · 25+ Fair · below Stretched, as
a rough guide) and remain available as a hidden filter / CSV field ("Cycle Position
Zone"). A deeply-fallen but weak company therefore reads a low Valuation
("Elevated"/"Expensive") despite a high Cycle Position — the value-trap signal,
surfaced honestly. (The stock-detail page is unchanged: it still shows the zone badge
via `ZONE_TIER`/`ZONE_DISPLAY` and is the only place the Deep Value…Stretched words
appear with their zone-tier colour.)

The **Health** column has only THREE labels (Healthy ≥80 · Adequate ≥60 · At Risk
below 60), so it is coloured by `healthColor` — **one colour per tier**: green
`#006400` / gold `#D4A017` / red `#B22222` — applied to BOTH the number badge and
the label. It deliberately does NOT use the 5-tier `scoreColor` ladder (which would
paint "Adequate" and "At Risk" rows several different shades for the same word).
Valuation keeps the 5-tier ladder above because it genuinely has five labels.

---

## 5. Chart Colour Standards

Every chart MUST follow these. Hard rule.

| Direction / Meaning | Fill | Border |
|---|---|---|
| Positive / up / profit / good | `#228B22` | `#006400` |
| Negative / down / drawdown / bad | `#B22222` | `#8B0000` |
| Neutral / informational | `#1E5CB3` | `#1A3A6E` |
| Highlight / cursor / focus | `#2E7DE8` | `#1A3A6E` |
| Grid lines | `#E2E8F0` (10% alpha for major, 5% for minor) | — |
| Axis labels | `#8A97A8` | — |

### Candlestick colours (Lightweight Charts config)

```ts
{
  upColor: '#228B22',
  downColor: '#B22222',
  borderUpColor: '#006400',
  borderDownColor: '#8B0000',
  wickUpColor: '#006400',
  wickDownColor: '#8B0000',
}
```

### 50/200 DMA line colours

- 50 DMA: `#2E7DE8` (brand-bright), 1.5px solid
- 200 DMA: `#1A3A6E` (brand-deep), 1.5px dashed (`[6, 4]` dash pattern)

---

## 6. Spacing Scale

Tailwind defaults work but the reference uses these specific values for cards and content stacks:

| Token | Value | Use |
|---|---|---|
| `--space-stack-tight` | 8px | Header strip elements |
| `--space-stack-snug` | 14px | Paired/related cards |
| `--space-stack-base` | 18px | Distinct sections |
| Card padding (default) | 14–18px | Card body interior |
| Card padding (`--bleed`) | 0 | Full-width tables inside cards |
| Page outer padding | 20–24px | Main content area |
| Sidebar width | 220px | Fixed |
| Header height | 58px | Fixed |

---

## 7. Border Radius

| Token | Value | Use |
|---|---|---|
| `--radius` | 10px | Cards, modals, large surfaces |
| `--radius-sm` | 6px | Pills, buttons, badges, inputs |

---

## 8. Shadows

```css
--shadow-sm:   0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
--shadow-md:   0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04);
--shadow-lift: 0 10px 30px rgba(15,25,35,.08), 0 3px 10px rgba(15,25,35,.05);  /* Layer G */
--shadow-lg:   0 10px 30px rgba(0,0,0,.10), 0 4px 8px rgba(0,0,0,.06);
```

- `sm`: default for cards in a stack, sidebar
- `md`: hover state on cards, dropdowns
- **`lift`**: a card **floating alone on the page ground** — the sign-in card, the
  pricing card, the 404. Added in Layer G because there were three roles and only
  two names: this step had been hand-typed as a 60px ambient blur in four separate
  files (`AuthCard`, `LegalDoc`, `PricingPlans`, `/methodology`), which is why
  signing in read as a different product from the terminal you were signing into.
  Navy-tinted rather than neutral black, because it falls on `--bg-page`, which is
  blue-grey.
- `lg`: modals, popovers, tooltips

⚠️ A long-form DOCUMENT takes `--shadow-sm`, not `--shadow-lift`, even though it
also sits alone on the page: `/terms` is the page rather than an object on it, and
a heavy ambient blur under 2,000 words looks like it is about to slide off.

❌ **This rule was written down and the code did something else** — `LegalDoc`
carried **no shadow at all**, with a comment arguing that `--shadow-sm` "still
reads as" a floating object. So the auth card floated and the document was
perfectly flat, and one click between them read as two products rather than two
weights of one. Corrected 2026-08-15 on the owner's instruction, after the gap
was found by measuring both cards side by side rather than by reading either.
The original concern was reasonable and turned out not to apply: `--shadow-sm` is
1–3px, and at the document's real height (1,502px on `/terms`) the bottom edge
reads as resting, not sliding. **Note the shape — a doc and its code disagreeing,
with the doc right and no test in between.** Both card families' padding and
radius are now compared to each other in `e2e/public-chrome.spec.ts`; the shadows
are deliberately *not* compared, because differing is the point.

---

## 9. Component Vocabulary

These are the canonical components. Use them. Don't invent new variants without owner sign-off.

### Card

White surface, subtle border, slight shadow. Standard wrapper for any data section.

```
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.card-header {
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  display: flex; justify-content: space-between; align-items: center;
}
.card-title {
  font: 600 13px Sora; color: var(--text-primary);
}
.card-body { padding: 14px 18px; }
```

#### `.card-note` — the second line in a card header (added 2026-08-15)

A provenance or scope line sitting beside `.card-title`: *"Medium preset · as at 13 Aug"*.

```
.card-note {
  font-size: var(--rd-micro);      /* 12px — the floor */
  color: var(--text-secondary);    /* NOT --text-muted, which is 2.69:1 */
  font-weight: 400;
  text-transform: none;            /* it is a sentence, not a label */
  letter-spacing: normal;
}
```

⚠️ **This class was USED before it was DEFINED, and nothing anywhere went red.** The
landing page's markup asked for `.card-note` on every provenance line while `globals.css`
had no such rule, so each one inherited its parent's 15px full-strength ink and read as a
second title rather than a footnote. **An undefined class is not an error in CSS — it is
silence**, and it renders as a perfectly plausible page. There is no console warning, no
build failure and no visual "gap" to notice; the type is simply wrong. It was found by
diffing *computed* styles against the design-system artifact, not by reading either file.
`text-transform` and `letter-spacing` are reset explicitly for the same reason: the class
sits inside a header whose sibling is uppercase and tracked.

### Stat Pill

Small inline chip showing label + value, used in stat rows.

```
.stat-pill {
  background: var(--bg-stripe);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  text-align: center;
}
.stat-pill-label {
  font: 600 9px Sora; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted);
}
.stat-pill-val {
  font: 600 15px JetBrains Mono; color: var(--text-primary);
}
```

### Tier Badge / Pill

The headline rating badge. Coloured by tier.

```
.tier-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  font: 600 11px Sora; letter-spacing: 0.3px;
}
.tier-badge--tier-1 { background: rgba(0,100,0,0.12); color: var(--c-tier-1); }
.tier-badge--tier-2 { background: var(--tint-tier-2-strong); color: var(--c-tier-2-ink); }
.tier-badge--tier-3 { background: var(--tint-tier-3-strong); color: var(--c-tier-3-ink); }
.tier-badge--tier-4 { background: rgba(255,69,0,0.10); color: #B23A00; }
.tier-badge--tier-5 { background: var(--tint-tier-5-strong); color: var(--c-tier-5-ink); }
```

### Tooltip

**Canonical primitive: `InfoTip` (`web/components/ui/InfoTip.tsx`).** A visible **ⓘ** affordance (Lucide `Info`) that reveals a plain-English explanation. Use it for any jargon, score, or section a beginner might not recognise.

- Opens on **hover (desktop), tap (mobile/touch), and keyboard focus** — native `title=` never fires on touch, so it is not acceptable for beginner-facing jargon (design-system §10 requires tap-to-reveal on mobile).
- The bubble is **portalled to `<body>` with `position: fixed`**, so it is never clipped by a card / `chart-canvas-wrap` / scrollable table `overflow`, and it **clamps to the viewport** (flips above the trigger when low on space).
- Accessible: `role="tooltip"`, `aria-label` / `aria-expanded`, `:focus-visible` ring. Closes on Escape / outside-pointerdown / scroll / resize.
- Type spec per §3: title 600 / body 400, 11px Sora, `shadow-lg`. Styles live in the `.info-tip-*` block in `globals.css`.

```tsx
<InfoTip title="Typical Drawdown">
  The average dip this stock has fallen through in its past cycles…
</InfoTip>
```

Pass a short bold `title` plus the explanation as `children`. Safe to render inside Server Components (children are plain strings — no event-handler props cross the RSC boundary).

> The reference HTML's vanilla-JS `data-tip="TITLE|body"` / `has-tip` pattern does **nothing** in React — it is superseded by `InfoTip`. Plain native `title=` is still fine for low-stakes, desktop-only affordances (e.g. chart toggle buttons).

### Table (zebra striping)

**Canonical mechanism: CSS-automatic `tbody tr:nth-child(even) { background: var(--bg-stripe); }`** (+ a `:nth-child(even):hover { background: var(--bg-hover); }` variant), scoped per table class. This is what `.km-table` (Key Metrics) and `.ownership-table` (Top Institutional Holders) use, so all data tables stripe identically with the same `--bg-stripe` (#F8FAFC) shade.

> **Deprecated:** the reference HTML's `.stripe` class (manually tagging odd rows + a global `tbody tr.stripe` rule) was **not** ported to the Next app. Do **not** add a `stripe` className in components — it has no CSS rule and renders unshaded. Use `:nth-child(even)` on the table's own class instead.

### Smart Money chart (event-marker chart)

The Smart Money Activity chart is the one **non-candlestick chart built on Lightweight Charts** instead of Recharts — a deliberate exception to decision #2, chosen for native pan/zoom + a reliable crosshair tooltip. Don't migrate it back to Recharts.

- Price = an LWC **area series**; insider/analyst events = LWC **markers** (`series.setMarkers`): ▲ buy (belowBar, `#006400`), ▼ sell (aboveBar, `#B22222`), ● award/gift/other (inBar, dot colour), ▮ analyst (square, grade colour). Default range **1Y**; 1Y/3Y/All presets via `.range-btn`.
- **Two-tier event view** (a tooltip can't be scrolled, and dense days overflow):
  - **Hover = quick preview** (`.smart-chart-tip`) — created imperatively on `<body>` (`position: fixed`) so the chart edge never clips it; capped at 4 events + a "+N more — click to see all" line. *(It is created with `document.createElement`, NOT a `typeof document` portal — that branch differs server vs client and throws a hydration mismatch.)*
  - **Click / tap a day = pinned panel** (`.smart-day-panel`) — portalled, viewport-clamped, `max-height: 50vh; overflow-y: auto`, lists *every* event that day with a close button. Gated on a `dayPanel` state (null until a click), so it renders nothing at hydration. Closes on Esc / outside-click / page-scroll / resize.

### Scorecard radar (`SnowflakeRadar`)

The Stock Scorecard plots the five Financial-Health pillars (Recharts `RadarChart`) plus a right-hand bar list. Conventions (S9):

- **Pillar colours are score-based, by the rating tiers** — this **deliberately deviates from the reference**, which used fixed per-axis identity colours (so "Shareholder" rendered red even at 100, falsely reading as "bad"). Each bar fill, score number, and radar vertex dot is coloured by `tierColor(score)`: ≥80 `#006400` · ≥65 `#228B22` · ≥50 `#D4A017` · ≥35 `#FF4500` · <35 `#B22222`. Colour now *means* "strong → weak". The connecting polygon stroke/fill stays brand blue (`#1E5CB3` / `rgba(30,92,179,.15)`) as the neutral "shape".
- **Full 0–100 radius scale** (a maxed pillar reaches the outer grid ring). The **angle-axis labels sit in the margin *outside* the grid ring** — the custom `AngleAxisTick` anchors each label *outward* (right→`start`, left→`end`, top/bottom→`middle`) with a small radial nudge. `outerRadius` is ~52% and the radar column is widened (`.radar-grid` `340px 1fr`) so the long names ("Balance Sheet", "Shareholder") clear without clipping.
- **A11y:** the chart wrapper carries `role="img"` + a dynamic `aria-label` summarising the plotted pillars (reflects only the real pillars, so a withheld-pillar stock reads fewer).
- **Weighting is explained, not shown per-bar:** the Health Score is the *weighted* mean (Profitability 30 / Balance Sheet 25 / Growth 20 / Cash Flow 15 / Shareholder 10); the weights live in the card-title `InfoTip` only (a per-bar weight column was tried and removed as too busy). Subtitle is just `Health Score N/100`.
- **Insufficient-data state:** pillars with no data are omitted (not a 0-spike); `< 3` pillars → the radar shows "Not enough fundamental data" and FH is withheld (see methodology-audit P3).

### Numeric display — sanity caps & distress flags

Real yfinance values can be absurd (a near-zero denominator gives P/E 3,500×, ROE 8,457%, operating margin −546,607%, payout 18,210%). **Never render the raw figure as a confident headline.** The pattern (S8/S9):

- **`MetricDef.cap`** (Key Metrics, `MetricsTable.tsx`): a per-metric cap. Beyond `±cap` the cell shows `>+cap` / `<−cap`, and the **true value goes in the hover tooltip** ("Actual … — capped for display"). Current caps: P/E 150x · EV/EBITDA 150x · PEG 25 · FCF Yield 100% · Op/Net Margin 300% · ROE 300% · ROA 300% · D/E 25 · Current Ratio 25 · Revenue/Earnings Growth 300%.
- **Median hygiene:** the same bounds are mirrored in `medians.server.ts` `OUTLIER_BOUND` so capped outliers don't skew the peer median (bump the cache key when you change them).
- **Peer comparison columns:** Key Metrics shows three relative columns — **vs Industry**, **vs Sector**, **vs Market** — ordered most-specific → broadest (industry ⊂ sector ⊂ market). Each cell is coloured green/red/grey by whether the stock beats / trails / matches that peer group's median. `medians.server.ts` (`fetchMetricMedians`, cache key `metric-medians-v5`) groups the whole universe by industry, sector, and market in one daily-cached scan. **Industry peer floor:** industries are small (~126 across 719 stocks), so a group needs **≥ 5 stocks** (`INDUSTRY_PEER_FLOOR`) before its median is trusted; below that the industry is omitted and the cell falls back to "—" rather than showing a one- or two-peer median.
- **Distress flag (not a cap):** where a high number is *bad* (a trailing dividend yield > 20% almost always means a collapsed price / imminent cut), show the **real** value but recolour it amber (`#D4A017`, not reassuring green) + a ⚠ + a caution tooltip — capping it would read as "good".
- **`fmtCapped(value, cap, decimals)`** (`web/lib/format.ts`) is the shared helper for **prose** numbers — the same cap pattern for values interpolated into sentences rather than table cells. Used by the Thesis narrative (`VerdictCard` `bestStrength`/`topRisk`, `ThesisInsights` `buildAttractive`/`buildRisks`): ROE/margins/growth 300, FCF Yield 100, D/E & PEG 25. Beyond the cap it renders ">cap" inline (e.g. "an exceptional >300% return on equity").
- These are **display-only**: the cycle math and FH pillars already clamp their inputs, so ratings are untouched.

### Thesis narrative — quality-gated cheapness

The "Why Attractive" card (`ThesisInsights.buildAttractive`) must **not** list a deep dip as an attraction when the business is weak. Its *"trading at or below its historical average dip — historically attractive entry zone"* bullet is gated: **dropped when Financial Health is weak (`< 50`) or withheld (`null`)**. This mirrors the S3 valuation quality-gate (a value trap is cheap because the business is deteriorating, not because the market is wrong — see methodology-audit P1) and keeps the narrative consistent with the Verdict, which already calls such names "financial health is stressed". The raw cycle-position label (`DEEP VALUE`/Verdict sentence 1) is left as-is — it honestly states *where the price is*; the Verdict's financial-health + primary-risk sentences supply the counterweight.

### Statement engine — no contradictions (Thesis cards + Verdict)

"Why Attractive" / "Key Risks" (`ThesisInsights`) and the Verdict's three sentences (`VerdictCard` `sentence1`/`bestStrength`/`topRisk`) generate copy from threshold rules over the same cycle + fundamentals. **The two surfaces must never assert opposite things about one metric for one ticker.** Two rules guarantee this:

1. **Disjoint thresholds per metric.** The Attractive trigger and the Risk trigger for a metric must not overlap, and no fallback may bridge them. Current bands: revenue growth — *accelerating* `≥ 15` (Attractive) · *modest* `[0, 15)` (Risk) · *declining* `< 0` (Risk); D/E — fortress `< 0.5` vs elevated `≥ 1.5`; PEG — cheap `(0, 1.5)` vs stretched `> 3`; net margin — *strength* `≥ 10` (`bestStrength`) vs *thin* `< 5` (Risk); pullback events — `≥ 10` vs `< 8`. Cycle position: the "attractive entry zone" bullet requires `typicalDrawdown ≤ −5 && dd ≤ typicalDrawdown` (⇒ `dd ≤ −5`), so it is disjoint from the "near highs" risk (`dd > −5`).
2. **Fallbacks never assert a metric claim.** A fallback must be either *gated* to the range that makes it true, or a *tautological cycle caveat* that can't be wrong. The "Why Attractive" empty-state shows a factual cycle line ("Down X% from its N-day peak…"); the "Key Risks" empty-state shows the single caveat *"Cycle patterns are historical and may not repeat…"*; `topRisk`'s final fallback is *"the chief risk is the historical cycle pattern not repeating…"*. None is tagged Strong/Severe.

When you add or retune a rule, re-check the disjointness table and run the universe sweep (see `layer-c-audit.md` verification). FCF-yield-strong + thin-net-margin is an allowed *tension* (different quantities), not a contradiction.

### Verdict entry-zone band

The Verdict's three band tiles derive from the cycle stats + a back-solved peak (`peak = currentClose / (1 + currentDrawdown/100)`; `priceAt(dd) = peak·(1 + dd/100)`):

- **Entry Zone** = `priceAt(typicalDrawdown)` (top) → `priceAt(typicalDrawdown + 0.85·(lowerBound − typicalDrawdown))` (bottom) — i.e. from the typical-dip price down **85% of the distance** toward the worst-case low (not the full range).
- **Reload Level** = `priceAt(lowerBound)` (the worst historical drawdown — sits distinctly below the band).
- **Invalidation** = `reload × 0.95` (5% below reload).

### Price formatting (per-share $)

Use the shared helpers in `web/lib/format.ts` — **never** hand-roll `Intl`/`currencySymbol` in a component (that drifted into `C$` vs `CA$` and hardcoded `$`):

- **`fmtPrice(n, currency)`** — **uniform 2 dp for every price ≥ $1** (`$306.31`, `$120.00`, `$45.30`, `$1.50`); below $1 it adds decimals so a small price is never "$0" (`$0.135` · `$0.0135`). Used for **all per-share prices** — current quote, analyst targets, Verdict band levels, DMAs, 52W low/high. **One signature, no options.** *(This deliberately replaced an earlier magnitude-aware rule that used 0 dp ≥ $100 — it mixed precision within a group, e.g. a `$95.20` target next to a `$120` target. Uniform 2 dp is the finance-standard and never mixes. "Whole-dollar ≥ $1" was also rejected: it rounds low-priced stocks coarsely, e.g. a $4.30 DMA → "$4".)*
- **`fmtPerShare(n, currency)`** — always 2 dp, currency-aware. For **EPS / DPS** (conventionally 2 dp regardless of size).
- **`fmtCompact(value, currency?)`** — adaptive **K/M/B/T** for large **quantities** (market cap, balance-sheet/revenue totals, share counts). The mantissa is always ≥ 1, so a real small value **never collapses to "0.0M"/"0B"** (the bug: a small-cap's cash forced into billions → "$0B"). Pass `currency` for money; **omit it for counts** like shares. **Never** force a fixed unit (`/1e9 …'B'`) or pre-divide chart data by `1e9` — plot raw values and let the formatter drive the axis so the scale adapts to the company (M for small caps, B for large). Use this for **off-axis** spots (stat strips, tables, tooltips, Browse).
- **`makeCompactAxisFormatter(axisMax, currency?)`** — the **chart-axis** variant: same unit + same decimals on EVERY tick (per-value `fmtCompact` would mix "70.0M" beside "140M" on one axis, which looks wrong). 0 dp when the axis ticks are whole, a uniform 1 dp only when fractional. `axisMax` = the largest |value| *currently plotted* (react to legend toggles; account for stacked series). dp is decided from a **nice-rounded** step (recharts nices the top tick, so a raw `dataMax/4` is unreliable).
- **Never** hand-roll `Intl`/`currencySymbol`/hardcoded `$` in a component (that drifted into `C$` vs `CA$` and `$1.71` for AUD) — always use these helpers.

### Ticker display (no raw storage suffix)

Never show the raw `.AX`/`.TO` storage suffix to users. We label by **country**
(US / AU / CA), not exchange (ASX/TSX) — the Browse market filter, per-stock
badges, the detail tab title, and the Key Metrics "vs" column all read the same.
Helpers in `web/lib/ticker.ts`:
- **`tickerDisplay(stored)`** → `"SYMBOL · COUNTRY"` (`BHP.AX` → "BHP · AU", `SHOP.TO` → "SHOP · CA", `AAPL` → "AAPL · US"). Used for the **page `<title>`/metadata**.
- **`tickerToUrlParts(stored).symbol`** → the **bare symbol** ("BHP"). Used for **chart labels** (Price Chart heading, Relative-Performance legend) — cleaner there, and the country is already shown in the header.
- **`marketLabel(market)`** is the **single source of truth** for the country code — the StockHeader, Browse list, Run search, and MetricsTable "vs Market" column all call it (no per-component badge maps), so AU/CA can't drift.
- Country map is locked: `{ us: 'US', au: 'AU', ca: 'CA' }`.
- **Index proper-nouns stay** — the Run baskets ("ASX 200", "S&P/TSX 60") and the Relative-Performance benchmark legend ("ASX 200", "S&P/TSX") name a *specific index*, not a country, so they keep their familiar names.

### Stock Detail sub-nav (sticky scroll-spy)

`StockSubnav.tsx` is the sticky pill strip (Thesis / Scorecard / Cycle /
Fundamentals / Sentiment). An `IntersectionObserver` highlights the section
currently in the band just below the sticky chrome (`rootMargin: -120px 0 -60% 0`).
- **Click → smooth-scroll, no "walking" highlight.** Clicking a pill sets it
  active immediately and smooth-scrolls to the section. During that programmatic
  scroll the observer is **suppressed** (`scrollLockRef`) so it doesn't light up
  every pill the viewport passes through; the lock releases ~140ms after scrolling
  settles (with a 1.5s safety for the already-at-target case). Genuine *manual*
  scrolling still drives the highlight normally.
- Offsets match the sections' own `scroll-mt-[120px]` so a heading lands just
  below the strip, not behind it.

### Brand logo

The logo is `reference/logo.png` (navy rounded-square "M" mark) — see CLAUDE.md decision #27. Render in-app with **`next/image`** from `/logo.png` (never `<img>` — `@next/next/no-img-element` breaks the zero-warning gate). It appears in the Sidebar, the public/auth layout, and the OnboardingModal. The served copies are cropped tight to the icon so it fills its container (no transparent margin); the favicon is `web/app/icon.png` + `favicon.ico`.

### Range Buttons

For chart timeframe selectors (1Y / 3Y / Max).

```
.range-btn {
  padding: 4px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: transparent;
  font: 500 11px JetBrains Mono; color: var(--text-muted);
  cursor: pointer; transition: all 0.15s;
}
.range-btn:hover { border-color: var(--brand-mid); color: var(--brand-mid); }
.range-btn.active {
  background: var(--brand-mid); border-color: var(--brand-mid); color: white;
}
```

### Filter dropdowns — native `<select>`, styled (C-R8)

Plain value-filters (Results' Tier / Min-Rating; Browse's Sector / Industry) are **native
`<select>` elements**, not custom JS comboboxes. Native selects give arrow-key navigation,
type-to-jump, and the OS wheel-picker on mobile **for free**, can't desync, and are the most
accessible option. **Do not rebuild a plain filter as a `role=listbox` widget** — the only
custom dropdowns in the app are special-purpose (the live-search **combobox** `TickerSearchAdd`,
which hits a search API as you type, and the **action menu** `ExportMenu` with rich multi-line
items). Both `.filter-select` (Results) and `.browse-select` (Browse) are visually consistent;
`.browse-select` additionally sets `appearance:none` + a brand-mid (`#1E5CB3`) chevron data-URI
for a consistent caret across browsers. Each select carries a visible `<label>` (§14).

Browse's result list also shows an **`aria-hidden` column-header legend** ("Stock / Sector /
Market Cap") aligned to the row layout so the right-hand market-cap value is labelled; the live
**result count** is a `role="status" aria-live="polite"` region (mirrors the Results toolbar).

### Provenance Bar

The "Major Cycle engine" status strip at the top of Results.

> **Do not name the third-party data provider in user-facing copy (S9, owner decision).** We don't advertise where the raw data comes from. Earlier copy said "via Yahoo Finance"; that name was removed everywhere it was visible (header analyst badge, Analyst Targets, News, Onboarding) while keeping the compliance-relevant "third-party data — not our rating" framing for analyst figures (decision #17). Internal code/comments and the Python provider name may stay; only user-visible copy must be generic. *(The Latest-News article links still resolve to the source's URLs — those are the real article destinations, not a label.)*

### Briefing Card

The "Analyst Briefing" callout at the top of Results. **Avatar-left, content-right** layout. The avatar is a **score-ring** that mirrors the Stock Detail Verdict ring (faint track + brand-blue arc, `--brand-mid`): the arc fills to the share of the run rating Constructive or better, with the **count** of those stocks centred and an "OF {total}" caption beneath (the count font scales with its digit length so it stays clean from 1 to 1,000+ stocks). *(History: this replaced the original `TrendingUp` Lucide icon, which read as generic/"AI"; a percentage-in-ring and a "live" freshness dot were tried and removed — the owner wanted the meaningful count and the cleaner detail-page ring look, no dot.)* Copy is built from the live in-memory run in **compliant language only** — framed around our five tiers (Constructive or better / Cautious or Bearish), never the reference's "Buy Zone / STRONG BUY / AVOID". The standout/top-pick is chosen from **fully-scored** rows only (an FH-withheld, cycle-only name can't headline unless nothing in the run is fully scored — matches `RunComplete`). Carries the "Information only — not financial advice" line in-card so the disclaimer is visible without scrolling (#4/#12).

### Results table — view modes + columns (Layer E)

The Results screener reproduces the reference's **three view modes** (`Simple` / `Analyst` / `Full`, default Analyst) via the `VIEW_MODES` map in `web/components/results/columns.ts`:
- **Simple** — Identity + MajorCycle Verdict.
- **Analyst** — + Price & Analyst Targets + Major Cycle.
- **Full** — + Valuation Ratios + Profitability & Health + Growth & Sentiment (31 columns).

The cycle columns come from the run's `CycleAnalysis`; the Price & Analyst / Ratios / Profitability / Growth columns read the slim **`fundamentals`** subset now returned with each result (`/api/analyze` → `_screener_fundamentals`). Company & Sector are enriched from the cached light universe index (the `/results` server page builds a `ticker → {name, sector, market}` map).

**Compliance:** all of OUR scores use the five tiers (High Conviction…Bearish) + four zones (Deep Value…Stretched). The **Analyst** column is the only place Buy/Hold/Sell wording appears — that's the third-party Wall-Street consensus shown verbatim (#17), via `fmtAnalyst` (not bold). Metric cells (drawdown / ROE / FCF / D/E / PEG / upside) are colour-tinted on a green→red ladder (`metricTintColor`, mapped to `--c-tier-*`). The Overall cell shows the score + clickable tier badge (filters by tier) + a Health/Valuation/Cycle-Payoff composition micro-bar (`compositionRamp`). The advanced multi-rule AND builder and CSV export both extend automatically to the fundamentals columns. The table scrolls horizontally on desktop and collapses to cards below `md`.

**Sanity bounds — match the detail page.** The fundamentals columns apply the **same display caps + formatting as the Stock Detail `MetricsTable`** so the two never disagree: P/E ≤150 (shown as `x`), PEG ≤25, ROE/margins/growth ≤300%, FCF ≤100%, D/E & Current Ratio ≤25 — beyond shows `>+cap`/`<−cap`; percentages 1-decimal, ratios 2-decimal. Caps are **display-only** — sort/filter/CSV use the true raw value (`Field.get`). Implemented via `Field.cap` + `formatValue(value, fmt, cap)` in `columns.ts`. **Score/zone cells**: the Overall, Valuation and Health numbers AND their adjacent labels are all coloured by `scoreColor(score)` (the 80/65/50/35 ladder), so the number and its word always match (the Valuation word is still the zone — Deep Value…Stretched — just coloured by the score). The **Cycle Position** gauge track is a visible red→amber→green gradient. Column headers use the shared `InfoTip` explainer.

### Opportunity Map (Recharts)

Reproduces the reference quadrant bubble chart: X = Financial Health, Y = Valuation, bubble size = Overall Rating (`ZAxis range [18,200]` — small enough that a 100–200 stock run reads as density, not blobs; ~0.55 opacity so overlaps darken). Split at **65** on both axes with four tinted quadrants + labels — **Opportunity Zone** (top-right, green), **Healthy, fully priced** (bottom-right, gold), **Weak but cheap** (top-left, blue), **Weak & expensive** (bottom-left, red). Bubbles are grouped into one `<Scatter>` series per tier so the **legend lists the tiers and is click-to-toggle** (same `hidden`-Set pattern as `RelativePerformance.tsx`); the legend sits at the **top** (so it doesn't clash with the x-axis label). Clicking a bubble opens that stock's detail page (`Tooltip cursor={false}` + `Scatter activeShape={false}` so there's no stray highlight rectangle on click). Height via the `--chart-h-lg` token; dark tooltip + `#8A97A8` axis ticks match the other charts. *(Deferred: legend tier ordering pin, and a cluster-picker popover when multiple tickers share a grid point.)*

### Skipped tickers — compact strip

A single collapsible line (`⚠ N tickers couldn't be scored · show`), expanding to a compact split of "No data yet" (in coverage) vs "Outside coverage" (unknown). Stays one line even for many skips. With the run reconciliation pass it's usually absent.

### Empty State

Pattern: centered icon + bold heading + muted descriptive text + optional CTA link.

### Locked (premium) states — F3 Step 10

Three components in `web/components/stocks/PremiumLock.tsx`, the whole-page
`web/components/PremiumLockPage.tsx`, the shared `web/components/UpgradeDialog.tsx` and
`web/components/SupportDialog.tsx`, plus one page-local notice.
All of them are **honest placeholders, not redactions**: for an unentitled viewer the
underlying numbers are stripped server-side before serialisation, so there is nothing in
the DOM to blur, un-hide or read out. What renders *is* all that exists.

| Where | Component | Treatment |
|---|---|---|
| KPI strip cards 1–2 (Overall Rating, Health Score) | `PremiumLockKpi` | Keeps the exact `kpi-card` shape so the 4-up grid stays aligned. Muted `--text-muted` accent, lock icon + the word **Unlock**. The tile is a **button** that opens the upgrade dialog, `aria-label` "<label> — included with a subscription. See what's included." |
| Verdict, Scorecard | `PremiumLockCard` | Standard `card` + `card-header`/`card-body`, lock icon beside the title, one sentence naming what it unlocks, ending in a **See what's included** button. Takes an optional `id` so a locked section still answers the subnav's anchor. |
| Download Report | `StockSubnav` | Swaps the blue `.export-btn` for a neutral bordered button with a lock, opening the same dialog. It must **not** attempt the download: the gated route answers 402, which the generic catch could only report as "try again in a moment". |
| Run Analysis, Results (sidebar) | `Sidebar` | Locked rows render as buttons, not links, and open the dialog in place. |
| Rating + valuation-zone badges | — | **Absent**, not locked. A lock chip beside the company name would be noise, and the locked KPI tiles directly below already make the offer. |
| Analyst consensus chip | `BadgeRow` | When our badges are absent the chip gains a visible **"Analysts:"** prefix. Alone in that row a bare "Buy" reads as *our* call — CLAUDE.md #2. Attribution must be on screen, not only in a `title`. |
| Daily fence reached | page-local `FreeViewLimitNotice` | Full-width card: what happened, that it resets at midnight UTC, that already-seen stocks still open, then **See what's included** (a `PremiumLockInlineCta`, opening the dialog in place) + **Back to Browse**. Carries the standard not-advice line. |
| Prose that needs the offer mid-sentence | `PremiumLockInlineCta` | A text button styled like a link, opening `UpgradeDialog`. Used by the daily-fence notice and the "your access ended mid-run" alert in `RunAnalysis`. Exists so those places don't `<Link href="/pricing">` — that dropped a signed-in reader out of the app shell. A client island, so Server Components can use it. |
| A whole premium PAGE (`/run`, `/results`) | `PremiumLockPage` | Full card inside the normal app shell — sidebar, header and account menu all stay, and the route does **not** change. Lock icon + the feature name, an amber notice naming what happened when the reason isn't "no subscription yet", one sentence of blurb, then **See what's included**. When the account is on hold the CTA becomes **Contact support** (`SupportDialog`) instead, because checkout and the portal both refuse a held account. |

**Locks explain themselves in place; they never navigate.** Every lock opens
`UpgradeDialog` — same shell and blurred backdrop as the Methodology modal — so the reader
keeps the stock they were deciding about. The dialog names the feature, says in plain
language **what that feature is**, lists what else a subscription includes, and then hands
off to `StartTrialModal` (the same in-app checkout entry the Account page uses).

**That rule now covers whole pages too** (owner decision, 2026-07-29). `/run` and
`/results` used to `redirect()` an unentitled viewer to the public `/pricing` page, which
took the sidebar, header and account menu with it — losing access looked like being logged
out, and a dispute-held reader was then sent on to `/contact` to retype a name and email we
already hold. They now render `PremiumLockPage` in place. Nothing signed-in points at
`/pricing` any more: the mid-run alert, the daily-fence notice, the `UpgradeDialog` failure
fallback and Stripe's `cancel_url` were all repointed at the dialog or `/account`.

**Loading must never render the wrong claim.** `UpgradeDialog` tracks "still fetching"
separately from "fetch failed". While in flight the CTA is a **disabled** button reading
*Checking your plan…*; only a genuine failure offers the `/account` escape hatch. Both used
to be `ctx === null`, so for a beat the dialog showed the ordinary upsell to a
dispute-held reader — the wrong claim about their account, not merely a slow one. The
billing context is fetched once per page at mount and shared by every lock on it, so the
answer is normally ready before the first click.

**A dispute hold changes the whole dialog,** not just a line of it: no feature pitch, no
plan list, and **Contact support** in place of any buy button — because `/api/checkout` and
`/api/portal` both refuse a held account, so an upsell would be an offer we decline at the
till. Support opens as `SupportDialog` (the same form and server action as `/contact`,
prefilled), never as a page jump.

It deliberately **shows no price**. Currency, trial-vs-billed-today and the
already-used-trial case are resolved server-side on `/account` and in `/api/checkout`;
duplicating any of that here would be a second source of truth for the one thing that must
never be wrong. `/api/billing-context` supplies only enough to label the button
(`Start free trial` / `Subscribe` / `Manage your plan`), and if that fetch fails the CTA
falls back to `/account` — a failure must never become a wrong offer, and it must not
throw a signed-in reader onto the public shop-window either.

**The 2–2 split is the whole design idea.** `KpiStrip` locks cards 1–2 and leaves cards
3–4 (Current Drawdown, Typical Drawdown) fully working. Two locked tiles sitting beside two
live ones is the clearest possible statement of what a subscription adds — much better than
hiding the row. Never "helpfully" collapse the locked pair.

> **CI note:** premium components must stay **imported and rendered inside a conditional**,
> never deleted. `scripts/check-report-sections.mjs` is a static text scan and will fail if
> a section disappears from the page. `PremiumLockCard` and `PremiumLockInlineCta` are on
> its `PAGE_ONLY` list — the report is premium in its entirety, so a lock can never appear
> inside one.
>
> **The report has no page to lock.** "Download Report" builds the file client-side from
> the gated `/report` route plus the prebuilt offline bundle, so the subnav button is
> the only report surface a reader ever sees. An on-screen preview page existed until
> 2026-07-29 and was removed — nothing linked to it.

### App navigation (F3 Step 10)

Sidebar is grouped by intent, with the premium group carrying a lock affordance when the
viewer isn't entitled:

```
DISCOVER            ← free
  Browse Stocks
  Request a Ticker
SCREEN              ← premium
  Run Analysis      ← verb before noun
  Results
────────────
  Licence status
```

**Licence badge** (sidebar foot). Mono, 10px, brand-mid, **uppercase with
`tracking-[0.5px]`** — it reads as a status chip, not a sentence:

| `subscription_status` | Badge |
|---|---|
| `active` | ACTIVE |
| `trialing` | TRIAL ACTIVE |
| `past_due`, **inside** the grace window | PAYMENT DUE |
| `past_due`, **past** the grace window | **ACCESS PAUSED** |
| `canceled` | CANCELLED |
| `null` / unknown | NO PLAN |
| *any status, `billing_blocked = true`* | **ON HOLD** |

`null` reads "No plan" because **account creation is not trial start** — an earlier
fall-through showed "Free Trial" to `past_due` and `canceled` accounts.

`past_due` splits on **entitlement**, not status — the badge already had `entitled` in
hand (it draws the nav lock icons with it) but wasn't using it here, so a reader whose
grace had closed saw the same PAYMENT DUE as one who still had full access. The badge and
the locks beside it now agree.

`billing_blocked` **overrides the status entirely**, because it is an orthogonal flag
rather than a status value: a disputed account keeps whatever Stripe status it had (usually
`active`), so reading the status alone announced **ACTIVE** to someone locked out of every
paid surface. Entitlement had ranked the block above the status from the start; the badge,
the account card and the purchase path were the three places that hadn't caught up.

### `/account` — Subscription card states (F3)

`web/components/account/SubscriptionCard.tsx`. A pill (`flex-shrink-0 whitespace-nowrap`,
row `items-start` so a wrapped sentence beside it stays aligned on narrow screens), one
sentence of detail, and exactly one action.

| State | Pill (tone) | Detail | Action |
|---|---|---|---|
| `active` | Active (ok) | "You're on the Monthly/Annual plan." | Manage billing → `/api/portal` |
| `trialing` | Trial active (ok) | "Your free trial runs until \<date\>." | Manage billing |
| `past_due` **inside grace** | Payment due (warn) | "We couldn't take your last payment. Update your card to keep access." | Manage billing |
| `past_due` **past grace** | **Access paused (warn)** | "We couldn't take your last payment, so access is paused for now. Update your card and it comes straight back — nothing has been lost." | Manage billing |
| `canceled` | Cancelled (muted) | "Your subscription has been cancelled." | Start free trial / **Subscribe** |
| `null` | No plan (muted) | "You don't have an active subscription yet." | Start free trial / **Subscribe** |
| **`billing_blocked`** | **On hold (warn)** | "A payment on this account was disputed… Contact support and we'll sort it out with you." | **Contact support** (in-place dialog) |
| scheduled to cancel | *(status pill unchanged)* | "Your free trial ends / subscription is active until \<date\> and won't renew." | Manage billing |

- **Subscribe vs Start free trial** — the label flips to *Subscribe* once the Step-7 email
  tombstone says this address already used its free week, and the modal states billing
  starts today. Never a surprise charge.
- **`billing_blocked` overrides everything above it** and removes both money actions:
  checkout 403s a held account and the portal refuses it, so offering either would be an
  offer we decline at the till. The card previously said *"ACTIVE — You're on the Monthly
  plan"* to someone locked out — the single most support-generating sentence we could write.
- **`past_due` needs two dimensions, not one.** The status is identical on both sides of
  the 3-day grace window (decision #20) while the *access* is opposite, so the card takes
  `entitled` (from the shared `hasAccess`) and picks its copy from that. Reading the status
  alone told a reader whose grace had closed to "update your card to keep access" — the
  access was already gone. Exactly the `billing_blocked` mistake in a second place, which
  is why `/account` now selects `grace_until` at all.
- **Scheduled cancel** is derived from `cancel_at != null` (the legacy boolean stays
  `false` in API `2026-06-24.dahlia`), and is suppressed while blocked.
- **Dates render in the reader's device timezone** via `<LocalDate>` — see §16 of
  coding-standards; never `profiles.country`, which is currency only.
- Returning from Stripe: `?checkout=cancelled` → "You haven't been charged";
  `?billing=blocked|none|error` → the matching portal notice. **`?checkout=success` has two
  forms** and is chosen *after* reconciliation, never from the URL: a plan on the row (the
  reconciler provisioned it, or the webhook already had) → "Payment received — your plan is
  set up below"; nothing yet → "Payment received. We're still setting your plan up — refresh
  in a few seconds." Deriving it from the URL alone printed "your plan is set up below"
  directly above a card reading **No plan**, in precisely the slow-webhook case the
  reconciler exists for.

**One entry point per destination.** Account lives *only* in the header menu, and the
header's old "Run Analysis" button was removed — both duplicated a nav row. The header now
carries the page title and the account menu, nothing else.

**Sign out moved to a header account menu** (top-right, `UserMenu.tsx`) rather than the foot
of the sidebar. It stays **one click**, which matters most on a shared computer, while
clearing the nav rail. The old `SignOutButton` component was deleted after confirming no
remaining references. **Post-login home is `/stocks` (Browse), not `/results`** — Results is
the *output* of a screener run, so it is empty for a new or free account. The single choke
point is `POST_AUTH_HOME` in `web/lib/url.ts`; every auth email inherits it via
`safeNextPath()`, so no email template hard-codes a landing path.

### Public chrome — the header and footer every public page wears (Layer G)

Defined **once**, in `components/PublicHeader.tsx` and `components/PublicFooter.tsx`,
both reading one list from `lib/publicNav.ts`. Before Layer G the landing page had a
nav and the other twelve public pages had a logo and a "Markets · Live" pill — so a
reader on `/terms` could not reach pricing and could not sign in.

| Part | Spec |
|---|---|
| Header | `position: sticky; top: 0`, height `--header-h` (58px), `rgba(255,255,255,.9)` + `backdrop-blur(12px)`, 1px bottom border |
| Lockup | 34px logo (8px radius) + "MajorCycle" 13px bold `--brand-deep` + "FINANCIAL TERMINAL" 9px `--text-muted` (hidden < 520px) |
| Nav | `--rd-small`, `--text-secondary`; current page `--brand-mid` + 600 and `aria-current="page"`. Hidden < 900px — the footer carries the same links |
| Actions | `Button variant="outline"` (Sign in) + `variant="primary"` (Create free account), both `h-9` |
| Footer | `--bg-surface`, 1px top border, centred link row at `--rd-small`, then the disclaimer and the copyright |

**Three rules that are not cosmetic:**

1. **The header is SESSION-UNAWARE.** It renders identical links for everyone and
   never reads the session. A header that varies by viewer makes the whole page vary
   by viewer (rule 11a), and reading the session in the public layout would put an
   Auth round-trip on the sign-in path. The pages where "Sign in" would actually
   mislead a signed-in reader (`/`, `/login`, `/signup`, `/deletion-requested`,
   `/pricing`) all redirect them away in `proxy.ts` before the header renders.
2. **The call-to-action matching the current page is hidden** — but on `/signup`,
   where the primary is the hidden one, "Sign in" must NOT also collapse below
   520px, or a 375px header offers no action at all.
3. **Session-confined pages get the logo alone**, and the logo is not a link.
   `/account/update-password` (a recovery session) and `/reactivate` (deletion
   scheduled) are pinned there by `proxy.ts`, so every nav link and every footer
   link bounces straight back. This is derived from `PUBLIC_PAGES`
   (`showsFullChrome`), never listed again — the header and the footer must ask the
   same function, which `e2e/public-chrome.spec.ts` asserts.

**The disclaimer line is `--text-secondary`, never `--text-muted`** — see §14.

#### Why `outline` is a fifth Button variant and not a tweak to `secondary` (2026-08-15)

The two differ on **exactly one property, their ink**: `secondary` is
`--text-secondary`, `outline` is `--brand-mid`. Everything else — surface, border, hover
— is identical. The approved design system draws the public pages' second action in brand
blue, because there it is an *offer* sitting beside another offer; `secondary` is grey
because in the app it is the quieter of two things you might do.

⚠️ **Widening `secondary` would have been one character and would have repainted five
buttons nobody asked about**, `GoogleButton` among them — putting brand-blue ink beside
Google's own multicoloured mark on the sign-in page. **When a shared component is wrong
for a NEW caller, add a variant for that caller rather than re-tuning it for everyone**
(the same rule that governed the scroll-spy's opt-in option — coding-standards §14).
`secondary`'s four existing app call sites are byte-identical to before.

---

### Legal documents — `/disclaimer`, `/terms`, `/privacy` (Layer G, rebuilt 2026-08-13)

One component, `components/LegalDoc.tsx`. These are **documents, not pages with a lot
of text on them**, and the distinction is the whole design.

**Rebuilt twice in one day, and the second round is the one that stuck.** Round 1 fixed
the layout — it was a rounded, shadowed card **2,223px tall** using 53% of a viewport
whose header spans all of it, with 600px empty beside it, and `h2` at 26px introducing
clauses averaging 45 words so the page read as a stack of headlines. Round 2 fixed the
sizes, after the owner looked at the result and said it still ran larger than the rest of
the site.

| | `/contact` | Round 1 | **Now** |
|---|---|---|---|
| Title | 24px | 26px | **24px** |
| Clause heading | — | 20px | **17px** |
| Body | 13px | 17px | **13px** |
| Meta / labels | 11–13px | 12 / 14px | **12px** |
| Column | 440px | 680px | 680px |

**The measurement that reframed the request.** Asked to make the public pages
"consistent", I measured every one of them first. `/pricing` renders **nine** distinct
text sizes in `<main>` (9.5 · 11 · 11.5 · 12 · 12.5 · 13 · 14 · 24 · 38) and `/signup`
eight, with steps a quarter of a pixel apart — exactly what §3 warns reads as
inconsistency rather than hierarchy. The legal pages were already the most disciplined
pages on the site at five. **The inconsistency was never here.** The owner's instruction
stood regardless and was scoped explicitly to these three pages, so that is what changed.

**The spec:**

| Part | Spec |
|---|---|
| Frame | `PageFrame width="wide"` + `.legal-layout doc-scale`. ≥1024px: `grid-template-columns: 200px var(--measure-doc)`, 48px gap, centred as a pair (measured: `200px 560px`, total 1120 = `--measure-wide`). Below: block flow |
| Document | `--bg-surface`, 1px border, `--radius` 10px, **`--shadow-sm`**, capped at `--measure-doc` (560px), padding **30px 32px** desktop / **24px 20px** ≤640px |
| Type | **`.doc-scale`** — `--pub-title` 24 · `--pub-h` 17 · `--pub-body` 13 · `--pub-label` 12 (see §3). Since 2026-08-15 this is a class in its own right, not a rule welded to `.legal-layout`, so the Learn pages get the same scale without the contents-rail grid |
| Heading rhythm | **`.reading h2:not(:first-child) { margin-top: 1.75em }` + `margin-bottom: 0.5em`, shared by the legal documents and the Learn articles** (owner: they should be the same). Added 2026-08-17 — `.reading` had described the space between paragraphs, around lists and after a list, and **never around a heading**, because no `.reading` prose had ever contained one: LegalDoc marks its own headings up as `.doc-h` and positions them with the section's flex gap. An article body is authored as bare `<h2>`, so it was the first prose to need it, and it got **0px above and below** — less room than two ordinary paragraphs (14.3px). ⚠️ `:not(:first-child)` is what keeps this ONE rule: every LegalDoc section OPENS with its heading inside a `gap-8` flex column, and in a flex container a child's margin ADDS to the gap, so a blanket margin-top would silently double-space all three legal pages. The 0.5em below sits just under LegalDoc's own `mt-2.5` (8.5 vs 8.75px), so adjacent margins collapse to the larger and the legal pages keep the exact gap they had — **verified by measuring, and by a control at 3em proving the rule does reach them** |
| `.heading-flush` | The opt-out, for a heading that is a **label rather than prose** — today the Learn index's topic titles, which sit in a flex row beside a number and a pill that the ROW positions. ⚠️ Not hypothetical: applying the rule above without it pushed each band down 29.75px and threw the "01" **10.6px** off its heading's centre, because `items-center` centres the MARGIN box. Written `.reading h2.heading-flush` at (0,2,1) — the obvious `.reading .heading-flush` is (0,2,0) and **loses to `.reading h2:not(:first-child)`**, since `:not()` contributes its argument's specificity. The first attempt made the misalignment *worse* (10.6 → 14.9px) for exactly that reason. Guarded by `learn.spec.ts` |
| Masthead | Title + "Last updated …" + a hairline rule. No eyebrow, no date pill |
| Clause heading | `.doc-h` with a `.doc-num` numeral **in Sora, inheriting colour** |
| Contents | Sticky rail ≥1024px (`LegalContentsRail`), inline two-column list below |
| Notice | "Information only — not financial advice" at the top, `--bg-stripe` in a hairline box |

⚠️ **The clause numeral is Sora and sets no colour of its own.** It was JetBrains Mono in
`--brand-mid`, on the reasoning that §3 says every number uses the mono face. That rule is
about **values** — a price, a score, a percentage — where monospace aligns digits into a
column and signals "this is data". A clause ordinal is part of the heading's own sentence,
and two typefaces in one line reads as a mistake. Declaring no colour is what makes one
rule correct in two places: black beside a heading, body-coloured in the contents list.

⚠️ **The rail lists this document's clauses and nothing else.** It briefly carried an
"Other documents" group linking the other two policies — which duplicated the footer of
the same page, making a third copy of a list that exists once. **A rail is for where you
are, not for where else you could be.**

⚠️ **What makes the rail stick is the rail's own `max-height`, not `align-items: start`.**
A grid item stretches to the row height by default and a sticky element as tall as its
scroll range never moves. Measured (rail top at scrollY 700, 1280×900): `start` + clamp →
pinned at 82 · `stretch` + clamp → **still** pinned at 82 · `stretch`, no clamp → −765.
Either protection alone suffices; both are kept, because the clamp exists to stop a long
list overflowing the viewport and someone removing it as redundant must not silently
un-stick the rail. The first version of this note asserted the opposite.

⚠️ **Smaller type made the page shorter, which broke the rail — a second-order effect
worth expecting.** At 13px the whole of `/terms` is ~1.9 screens, so clauses 05–08 sit
where no scrolling can bring them to the offset line, and `useScrollSpy`'s bottom-of-page
rule reported the **last** clause whichever one was clicked. Click "Acceptable use", the
rail lights up "Contact". Fixed with an opt-in `keepClickedAtPageEnd` so the Stock Detail
subnav and the offline report keep byte-identical behaviour.

✅ **The column was narrowed to suit the smaller type (owner-approved, same day).** At 13px
the old 680px box ran **~91 characters per line** against the 45–75 band — the width had
been chosen for 17px body, and smaller letters simply mean more of them per line. A new
`--measure-doc` (**560px**) brings it to **67–74**, measured on all three pages.

⚠️ **It could not reuse `--measure-prose`.** That token is 680px *because* it holds ~68
characters at `--rd-body` — narrowing the shared token would have fixed one page by
breaking another. (The other page at the time was `/methodology`, retired 2026-08-13; the
token is now held for `/learn`, so the reasoning stands and its example has moved.)

⚠️ **The guard counts CHARACTERS, not pixels.** A column can be the right width and the
wrong measure; that is exactly what happened here, with no width having changed at all.
`legal-doc.spec.ts` walks a DOM Range along a real paragraph to find where it wraps, and
bounds it on **both** sides — an over-narrow column that breaks every few words is just as
unreadable and would satisfy a one-sided bound.

**Wording is presentation-only.** Four clauses that were single sentences carrying five and
six semicolon-separated items are lists (Terms "Acceptable use"; Privacy "Information we
collect", "How we use it", "Service providers"), with every item's wording unchanged. The
trial clause is four short sentences in one paragraph, down from one 60-word sentence
carrying six commitments. No obligation was added, removed or altered, and the disclaimer
notice is untouched. **All three remain `BASELINE CONTENT` pending a professional review.**

Guarded by `e2e/legal-doc.spec.ts` (**12** tests): the measure at six widths, one contents
list visible at a time, the notice above the fold at 375px, every rail entry resolving to a
real section, the rail staying pinned, and every clause click marking the clause it names.
All broken on purpose — see `coding-standards.md` §14 for the three traps that surfaced.

---

## 10. Responsive Breakpoints

Mobile-first. Tailwind defaults:

| Breakpoint | Width | Layout |
|---|---|---|
| Default (mobile) | < 768px | Single column, sidebar becomes drawer |
| `md` | ≥ 768px | Two-column where appropriate |
| `lg` | ≥ 1024px | Sidebar visible, full desktop layout |
| `xl` | ≥ 1280px | Wider content area, larger charts |

**Critical:** the existing reference HTML is desktop-only. Mobile layouts are NEW and must be designed during the build — see roadmap.md for which screens need mobile-specific treatment.

**Mobile patterns:**
- Sidebar nav becomes hamburger drawer
- Tables: horizontal scroll OR collapse to cards (case by case)
- Multi-column grids stack vertically
- Tooltips become tap-to-reveal popovers (not hover)

---

## 11. Loading & Empty States

### Loading

- **Page-level:** Skeleton shimmer matching the eventual content shape. Never a spinner blocking the whole viewport.
- **Chart-level:** Render an empty chart canvas with axis but no data, plus a small "Loading…" pill bottom-right.
- **Button-level:** Replace button text with spinner icon + disabled state.

### Empty (no data)

Pattern: icon (40px, muted stroke) + bold 14px title + muted 12px description + optional CTA.

Example from the reference:
> "No analysis run yet — Upload a CSV of tickers in the Run Analysis tab and your ranked results will appear here."

### Stock Detail null-render conventions (C-R2)

A systematic sweep (C-R2) fixed every Stock-Detail section's missing-data state to one
consistent, honest pattern. The rules:

- **Hide the whole card** when there is genuinely nothing to show: Analyst Targets,
  Short Interest, Earnings Performance (incl. when rows exist but carry **no actual
  EPS**), Company Overview.
- Otherwise show **one honest centred muted message** — never a half-empty card. News
  ("No recent news available."), Valuation ("P/E history is building…"), non-payer
  Dividend ("Does not pay a dividend…"), Quarterly Financials when the **selected metric**
  has no data (e.g. Gross Profit on a bank → "No Gross Profit data reported…"), Smart Money
  dual-empty (two graceful columns, chart skipped), Ownership partial ("No institutional
  holder data available.").
- **No lone "—" floating in an otherwise full card, and no all-dash grid.** A card whose
  every value would be "—" is replaced by a single message (e.g. Technical Levels with
  < 50 bars → "Not enough price history yet…").
- **Cycle unavailable for the chosen horizon** (the engine needs ~`lookback`+ bars; a
  short-history stock on the Long horizon can't compute one): show **one explanatory
  notice** ("Major Cycle — not available at this horizon…") in place of the rating
  badges / KPI / Verdict / Thesis, plus a matching note in the Scorecard section. This is
  **mirrored in the downloadable report** (`ReportDocument`) so the offline file behaves the
  same — the live page's notice lives in the detail `page.tsx`, the report's in
  `ReportDocument.tsx`.
- **Structurally N/A ratios are captioned, not just dashed.** Banks & REITs don't report
  Current Ratio / Debt-Equity / Interest Coverage → the dashed pills carry a caption
  ("…banks & REITs don't report them…"), mirroring the Scorecard's withheld-pillar note.
- Fixture-only edge states (0-bar / very-short history, single-analyst zero-range target,
  one-sided ownership, short-ratio-without-%) don't occur in the real universe (min history
  ~488 bars; every stock has fundamentals) but still degrade gracefully — eyeball them in
  the **local-only** `/dev-fixtures` gallery (git-ignored; see `web/.gitignore`).

### Error

Pattern: red-tint card + 16px title + body explanation + CTA to retry or contact support.

---

### The Learn library — BUILT 2026-08-15 (`/learn`, `/learn/[slug]`)

**Chosen from three directions drawn in the design artifact.** The owner rejected a plain
themed list and chose **theme bands**: one illustration per topic, alternating left and
right, with the article titles listed beside it. Heading is the owner's — *"Before you buy
anything"*.

⚠️ **Direction B — a picture per ARTICLE — is the better browsing experience and was
deliberately DEFERRED, not rejected.** A card grid needs roughly nine articles before it
stops reading as abandoned, and the library has one. Bands never look half-built: another
article makes a list one line longer. Revisit at ~12 articles; the data shape supports it.

| Part | Spec |
|---|---|
| Index frame | `PageFrame width="wide"` + `.doc-scale`. Prose held to `max-w-[720px]` — the frame is wide for the pictures, not for the words |
| Article frame | `PageFrame width="prose"` (680px) + `.doc-scale`, in the same card as a legal document (`--radius`, 1px border, `--shadow-sm`, 30/32 desktop · 24/20 phone) |
| Type | **Identical to the legal documents** — 24 / 17 / 13 / 12 |
| Band | 2-col grid ≥1024px (`minmax(0,1fr) minmax(0,1.05fr)`, 30px gap), alternating via `lg:order-first` on odd bands. Single column below, **picture always first**. ⚠️ The grid track is **conditional on `theme.image`** — see the warning below |
| Topic image | **1600 × 1000 (16:10)** PNG in `public/learn/`, cropped from a 4K generated master (§11 above; the masters are outside git and cannot be regenerated). `LEARN_THEMES[].image` is **optional**; a topic without one drops the second column and holds the header's 720px measure. ⚠️ `sizes` states **560px**, not 532 — the grid is `1fr / 1.05fr`, so the columns measure 531.7 and 558.3 and the bands alternate. `sizes` is a promise about the LARGEST box, so it takes the wider one; claiming 532 handed a 532px file to a 558px box (a ~5% upscale, soft on non-retina) |
| Figure labels | Every piece of text inside a figure's drawing is compared with every other, on every article, at six widths — `learn.spec.ts`, "no two labels overlap". ⚠️ It replaced three narrower checks (marker-vs-marker on the analyst figure, tick-vs-tick on two others) that were each blind to the defect actually shipping: "Lowest $82" sat on the "$80" **axis tick**, 12px of overlap at every width including 1280, for the life of the figure. A guard scoped to one KIND of label is as narrow as one scoped to one page. ⚠️ **It asserts a MARGIN of 2px, not the absence of overlap** (CLAUDE.md 11i-b): `> 1` passed anything that merely failed to touch, and this suite went green on Windows while CI failed by **2px**, because Linux gives the same font slightly wider glyphs. The library clears 2px everywhere by at least 3px, measured. ⚠️ Two lines of ONE label touch by design, so a wrapper carrying **`data-label-group`** tells the guard they are one thing — the analyst markers and the rating figure's pillar rows both need it. Without that, the margin rule flags correct behaviour, which is how a guard gets deleted |
| Plot gutter | Every drawing sits inside **`Plot`** (chartPrimitives): an outer box carrying **`AXIS_GUTTER_PX` = 44px** on the left for the axis labels and **`PLOT_RIGHT_PAD_PX` = 22px** on the right for half of a label centred on the final point, and an inner box that is the plot. `rx()` spans the whole inner box. ⚠️ Both pads were **viewBox units** until 2026-08-21 — a percentage of whatever the panel measured — which is right at 375px and wrong everywhere else: the left one held a 29px number in **172px** of margin at 1280px, so every chart began a sixth of the way in from its own card, and the right one was 10px on the dip/correction figure's half-width panels, where the "today" label duly hung 5px outside the drawing. **A gutter exists to fit a label, and a label does not get wider when the screen does.** ⚠️ **Two boxes, not one:** an absolutely-positioned child lays out against its ancestor's *padding* box, so padding alone leaves `inset-0` spanning the gutter. ⚠️ **Every overlay must be inside the same `Plot` as the drawing it annotates** — the dividend figure's shared time axis is a sibling of its two panels, so when they moved inside the gutter it stayed at the card edge and each year marker sat 44px from the data it labels, still rendering perfectly (11c-iv again). ⚠️ **A pad is also a height change**: narrowing the box shortens it through the aspect ratio, and the price panel's four axis labels closed to 2px apart as a result — a stack of labels is a pixel requirement that anything touching the box's WIDTH can break |
| Axis labels | Right-anchored to the axis, `AXIS_LABEL_GAP_PX` = 8px, in `AxisLabels` / `XTickRow`. ⚠️ They were `left: 0` until 2026-08-21, which pins a label's *start* and lets its end land wherever the text runs out — so the distance to the axis was a side effect of how many characters the number had: **57px on nine figures against 12px on two**. ⚠️ The offset is a **margin, never padding**: `getBoundingClientRect()` includes padding, so a padded gap reads to every measuring tool as a label flush against the plot. ⚠️ Tick marks are **HTML** (`stub` on `AxisLabels`), not a `<line>` at `PLOT_L - 2` — that x is off the viewBox now the plot starts at its own left edge, and would be clipped silently rather than drawn short |
| Labels on a plot | **Nothing is ever drawn behind a label, and no label leaves its plot.** A halo — the panel's ground painted behind the text — was built and rejected on sight: it interrupts the very curve the figure is about, and on `dip-correction-crash` it erased a length of the dashed rule the figure exists to explain. So does a rule computing which side of a point has free space: it worked, went stale-prone, and swapped one collision for another. **The fix belongs upstream** — shape the paths so troughs are separated (`indexGeometry.ts`), give a narrow screen more plot HEIGHT, and where a phrase will not fit at all, give it a **short form below `sm`** (`PinnedLabel`'s `short`, and the dividend figure's crossing label). If a label has nowhere to go, the figure is too busy; that is information, not a styling problem. Guarded by `learn.spec.ts` **"no chart label hangs outside its own plot"**, which bounds each side by its own allowance — **zero into the left gutter, `PLOT_RIGHT_PAD_PX` on the right, read off the element rather than hard-coded**. ⚠️ Its first version allowed 4px of slack so an end label could overhang, and 4px is exactly what let the real defect through: the dividend label escaped by **3px** and CI still failed. **A guard's slack is where its defects live** |
| Annotation rules vs prose | **A rule drawn across a figure may cross the drawing and never the words.** The limits figure's dashed "today" line ran the full height of the panel, so it struck through three row headings and three notes; the owner read it as a print defect (2026-08-22). The halo that would hide it is already rejected (row above), so the rule is drawn in **segments, one per bar track**, and the axis label carries the meaning at the bottom. ⚠️ **Segmenting creates a second way to be wrong that a single line could not have:** three dashes at three x positions read as noise while every other assertion still passes. `learn.spec.ts` therefore asserts both halves — every segment shares one x to within 0.5px, **and** no segment's x falls inside any text rectangle in the drawing. Both were broken on purpose and named the real defect |
| Two labels on one row | Where a figure puts two labels on the same row, **horizontal distance between their anchors is the only thing keeping them apart** — there is no second row to fall back on, so the clearance is measured at 360px, not assumed at 1280. The analyst figure's "Today" and "Average" were on two rows until the owner asked for one (2026-08-22). ⚠️ **The obvious lever is the wrong one.** Widening the gap by moving one endpoint — raising the consensus target from 124 to 136 — bought 12px and silently changed what the figure claimed: consensus upside went 24% → 36% against an unchanged 96% spread, so the picture argued 2.7× where the prose argues 4×, and the spread guard went red. **Take the room from the LABEL, not from the data**: "Average target" (91px) became "Average" (52px), which also made it the third one-word position name beside "Lowest" and "Highest" |
| Heading and its note | In a figure whose rows are labelled, the bold heading and the sentence explaining it sit **together, above the drawing** — never with the bar between them. Owner feedback, 2026-08-22: separated, they read as two unrelated pieces of furniture rather than a caption and its subject |
| Year markers | `yearTick()` in `chartPrimitives`, never a local template. Singular at one, and **never `3y`** — a digit butted against a letter is the shape of a lost JSX space and the run-on guard cannot tell one from an axis label. Three figures grew a year axis in one week and the second printed "1 yrs" |
| Figure lists | Any `<ul>`/`<ol>` inside a `<figure>` wears **`.figure-list`** (`.reading ul.figure-list`, specificity (0,2,1), the same shape as `.heading-flush`). ⚠️ Added 2026-08-20 after the limits figure was measured: `.reading ul` sets `padding-left: 1.35em`, so every bar inside the list started **17.55px** right of where its own percentage said, while the dashed "today" rule — a sibling outside the list — kept the full width. The one line that figure exists to draw sat 17px from the bar it marks. Nothing errored and the offset read as a deliberate gap; every other figure's list had the same inset and only got away with it because nothing was aligned to them. Guarded by `learn.spec.ts`, which asserts the computed padding is 0 **and** that both rows meet the rule |
| Article row | Title `--pub-body` semibold; reading time `--pub-label` in JetBrains Mono, `--text-secondary`. Title and blurb are the SAME size — weight and colour separate them, not a 1px step |
| "Coming soon" row | Same row shape, `--text-secondary` at **full strength and normal weight**, **no `<a>` anywhere in it**. Announced titles live in `LEARN_THEMES[].upcoming` as plain strings — see `data-contracts.md` §7b. ⚠️ It was `--text-secondary` at **70% opacity** until 2026-08-17, which rendered at **3.38:1** against a 4.5 floor — and the contrast guard scored it 6.81, because it could not see `opacity` at all (CLAUDE.md 11q). **Recede with weight and colour, never with transparency:** a token can be measured, an opacity could not |
| Topic number (`01`/`02`/`03`) | `--pub-h` — the **same size as the heading beside it** (owner, 2026-08-17). It was `--pub-label` against a 17px title and read as a superscript rather than as part of "01 Falls and recoveries". JetBrains Mono (it is a value), `--brand-mid` at full strength — **not black**, which would compete with the title. Carries `.heading-flush` on the `<h2>`; see the heading-rhythm note below |
| Topic pill | `--pub-label` **12px, which is a FLOOR and not a preference** — `contrast.spec.ts` enforces it and this element was already raised from 11px once. Asked to make it smaller (2026-08-17), the answer is that it cannot be; it was made *quieter* instead — semibold rather than bold, `px-[8px] py-[2px]` rather than 10/3 — and reads smaller anyway now the number beside it is 17px |
| Article answer block | Tinted panel: `--bg-stripe`, 1px border, `border-left: 3px var(--brand-mid)`, `--radius-sm`, 14/12 padding, text at **body size** in `--text-primary`. ⚠️ It was a bare 2px rule around `.lead` (17px) and the owner's note was that it "reads too big". The instinct to reach for a size between 17 and 13 must be refused — the public site has exactly FOUR sizes and inventing a fifth is how the stray scale appeared (11c-vi). **The emphasis moved off the type and onto the container.** Deliberately the same device the Methodology modal uses on Stock Detail, so a reader meets one pattern, not two |
| Count pill | `--pub-label`, `--brand-light` fill, `--brand-light-border`. States what is **readable** — "1 article", or "Coming soon" when nothing in the topic is written yet. Never counts promises |
| Article answer | `.lead` (17px) in a `border-l-2 --brand-mid` block, directly under the h1 and **above** the disclaimer |
| Disclaimer | `LegalNotice` — the same component the legal pages use, so the sentence exists once |

⚠️ **No placeholder boxes for a missing image, deliberately.** A dashed "1600 × 1000 goes
here" panel is exactly the kind of thing that reaches production because everyone assumed
somebody else would spot it — on the page whose job is to make a stranger trust us. The
band degrades to text instead.

⚠️ **And that degradation did not work for the first day it existed (fixed 2026-08-16).**
The two-column track was declared **unconditionally**, so a topic with no picture kept both
columns and its text landed in the first: measured at 1280px, **532px of content beside
588px of empty page**, on every band. `lib/learn.ts` had documented the opposite from the
day it was written. Nothing errored, typecheck was green, and below 1024px it looked
perfect because there is only ever one column there. **An absent grid child is not a fault
— it is a hole, and a hole renders.** Graceful degradation is a claim about rendered
output, so it is only ever established by rendering it. Guarded twice in `learn.spec.ts`:
one test measures every rendered band, and one asserts in the source that the track is
governed by `theme.image` — the second is not decoration, because no topic without a
picture is currently rendered, so it is the only half that can see a revert.

⚠️ **Two of the first values broke the 12px floor** (`--rd-micro` is a FLOOR on a reading
page, not a suggestion): the count pill and the reading time were 11px. `contrast.spec.ts`
enforces it, so these fail the build rather than merely looking small. A third value —
the topic blurb — had landed exactly ON the floor via `.small`, which under `.doc-scale`
maps to `--pub-label`. Right for a date stamp, wrong for a sentence somebody reads to
decide whether a topic is for them.

> #### The fourth type scale, and how it got there (2026-08-15)
>
> The owner said the Learn pages "looked inconsistent". Measured at 1280px on the built
> pages, they were right, and it was structural rather than cosmetic:
>
> | Page | h1 | h2 | lead | body |
> |---|---|---|---|---|
> | `/learn`, `/learn/[slug]` | **36** | **26** | **20** | — |
> | `/terms` | 24 | 17 | — | 13 |
> | `/contact`, `/pricing` | 24 | — | — | 13 |
> | `/` | 50 | 34 | 18 | 12.5 |
>
> Crossing from `/contact` into `/learn` was a **50% jump in heading size** for no reason a
> reader could perceive.
>
> **Cause: the scale was welded to `.legal-layout`**, the class that also builds the legal
> contents-rail grid. A document wanting the scale without the grid could not have it, so
> the Learn pages fell back to `.reading`'s own 36/26/20. Nobody wrote anything wrong —
> `.reading` is the correct default for a long page, and the legal pages had opted out
> through a class the new pages had no reason to wear. **CLAUDE.md 11c-iv: the rule existed
> and one of its consumers never received it.**
>
> Fixed by extracting **`.doc-scale`**. It uses element selectors as well as the `.doc-*`
> helpers, because an article body is authored as plain `<h2>` — prose in a content file
> should not have to know the design system's class names.
>
> ⚠️ **This reversed an earlier decision of mine**, which had argued an article is read top
> to bottom while a legal page is scanned, so it should keep 17px. Sound in the abstract;
> what it produced was the table above.
>
> ⚠️ **Open, and the owner's to decide: 13px is small for 900 words of newcomer prose.** The
> fix is to lift `--pub-*` one step, which moves the legal pages, the auth cards and the
> articles **together**. An article page does not get to opt out on its own — that is
> exactly how the fourth scale appeared.

### h3 in the document scale — FIXED 2026-08-19

The document scale is **24 / 17 / 13 / 12**, and until this date `.doc-scale` set **both**
h2 and h3 to `--pub-h` (17px). The base `.reading` scale never did that — there h2 takes
`--rd-h2` and h3 the smaller `--rd-lead` — so the document scale was the anomaly.

⚠️ **It went unnoticed because no `.doc-scale` page had ever used an h3.** All three legal
pages are h2-only (verified: zero `<h3>` in `terms`, `privacy`, `disclaimer`). The first
Learn article to need subsections became the first consumer of a rule written for documents
that never had any — CLAUDE.md 11c-iv again.

**The symptom was the invisible kind.** Eight h2s and four h3s rendered at the same size,
the same colour and the same 29.75px above, separated only by 700 vs 600 weight. Every size
was still on the scale, so the type-scale guard passed and an audit of *sizes* reported the
page clean. The owner read it and said the sizes looked wrong; only comparing headings
against each other showed why.

| | Was | Now |
|---|---|---|
| h2 | 17px / 700 / mt 29.75 | unchanged |
| h3 | **17px / 600 / mt 29.75** | **13px / 700 / mt 20.8** |

⚠️ **No fifth size** (11c-vi). h3 takes `--pub-body`, which the body already uses, and earns
its heading role from weight 700 and from being a block — `strong` is 600 and inline, so the
two cannot be confused. The step is 17 → 13, the same direction the base scale steps.

⚠️ **The margin steps too, and that is half the fix.** A subsection belongs to the section
above it and should sit nearer to it than a new section does. Spacing carries hierarchy at
least as much as size.

⚠️ **The legal pages are byte-identical after the change** — measured, not assumed: `/terms`
reports the same 24×1 / 17×20 / 13×37 / 12×25 before and after. Guarded by
`learn.spec.ts`, which asserts the *relationship* (h3 smaller than h2, and tucked closer)
rather than either number, so it survives a future retune of the scale. Broken on purpose:
reverting h3 to 17px fails with *"subsection headings render at 17px and section headings at
17px."*

### Figures inside an article — `components/Figure.tsx` (2026-08-19)

> ⚠️ **Owner redirection, same day, and it improved the work.** The first pass drew
> these as price-line schematics of my own invention. The owner's note was *"can't you
> draw a similar graph shown in the stock detail page for this? this will be more clear
> that way"* — and it is, for a reason worth keeping: **the article teaches a term the
> reader will next meet inside the product, so the picture that teaches it should be the
> picture they will see.** That is CLAUDE.md 11m applied to an explainer rather than to a
> marketing page. The two schematics are now drawn in `DrawdownOverlay.tsx`'s idiom — the
> fall hangs BELOW a 0% line, `#1E5CB3` curve, the same red tint, a gold `Avg` rule and a
> firebrick `Low` rule — and the rolling-peak maths is a port of that component's own
> `computeDrawdown`.
>
> ⚠️ **Ported, not imported, and the cost is named.** The real overlay is `'use client'`
> on `lightweight-charts` and eats `PriceBar[]`. Importing it would put a charting library
> and a hydration cost on a prerendered public page and leave a no-JS reader with nothing.
> So the formula is duplicated and `learn.spec.ts` pins the copy to the independently
> derived percentages, which is the 11c-iii discipline: where you must duplicate, make a
> test hold the two together.
>
> ⚠️ **It also fixed a real defect.** The owner's other note — *"negative should be down
> not up"* — was correct. The price line was oriented properly, but each percentage sat on
> a rule at the PEAK, so a negative number floated at the top of the chart while the fall
> ran downwards. In drawdown space the direction stops being something to remember: zero is
> the top of the box and a fall has nowhere to go but down. **Measured, not assumed:** all
> four drawn curves have zero points above their zero line, with a control confirming the
> probe catches a forced violation.
>
> ⚠️ **And the schematic's own history had to get richer.** The product overlays "Avg" and
> "Low", and those say nothing when a stock's falls are all the same depth — the first path
> gave Avg −31.0% against Low −32.0%, two rules a millimetre apart. The stretch before the
> zoom window now carries several falls of different depths (Avg −28.7%, Low −35.6%), while
> everything from the zoom boundary onwards is byte-identical so the prose example
> ($100 / $90 / $80) still matches the picture.

The drawdown article needed three diagrams, and the decision worth recording is that
they are **hand-authored SVG and HTML, not generated pictures**. Three reasons, each
learned here rather than assumed:

1. **Generated images cannot draw exact geometry.** §11 already records that four
   candidates came back *with no share price falling in any of them*. Every figure this
   article needs is precise — a specific path, specific peaks, measured distances.
2. **Generated attempts produced a compliance problem** — green/red arrows, embedded
   text and "PROFIT INCREASE" beside coins, on a not-financial-advice product (#24).
3. **A picture per ARTICLE is a deliberate deferral** ("revisit at ~12 articles"), and
   commissioning one now would reverse an owner-level decision by the back door.

Cost: **$0**, reproducible, editable in seconds, and testable — none of which is true of
an irreproducible 4K master.

| Rule | Why |
|---|---|
| `Figure` owns the shell — framed panel, optional legend, caption | `CycleDiagram` invented this shell and three more figures needed it. Four copies of "what a figure looks like" is 11c waiting: one gets improved, the others quietly do not, and every figure still renders |
| `caption` is a **required prop** | A diagram with no caption is the accessibility failure that looks perfect in review — sighted readers infer the point, everyone else gets nothing |
| Legend **below** the drawing, never inside | In-chart captions cleared the price line at one aspect ratio and collided at another; keeping them legible meant hand-tuning per breakpoint, i.e. a second copy of the layout |
| **Server components. No interactivity** | A toggle would ship JS and a hydration cost on a page whose speed was bought by prerendering, and a no-JS reader would lose the figure entirely. These are schematics — there is nothing to explore |
| Schematic, never a plausible chart | No ticks, no dates, no dollar axis (#24). A realistic line reads as a real security's history and implies a claim we do not make |
| Labels are **HTML**, never SVG `<text>` | SVG text scales with the viewBox: a 12px label in a 680-wide drawing is ~6px on a 375px phone. Same reason the "today" marker is an HTML dot — `preserveAspectRatio="none"` distorts shape, and `vector-effect` rescues stroke width only |
| On-chart labels **hide below `sm`**; the legend carries them | Measured: at 375px both schematics correctly show zero labels and the legend carries 2 and 3 percentages respectively. Progressive disclosure, not a second diagram |
| One `INSET` constant governs SVG geometry **and** the HTML overlay | Otherwise the marker sits a few pixels off the line it marks — which reads as a rendering glitch rather than a bug and survives review indefinitely |

⚠️ **The two schematics are ONE path, and the second is DERIVED from the first**
(`drawdownGeometry.ts`). The article shows the same imaginary stock zoomed in and pulled
back, and the argument depends on those being the same stock. Two hand-tuned paths would
make that a promise nobody checks — nudge one, the other stays put, both still render,
and the figures quietly describe different companies (11c-iii). **Every percentage is
computed from the path too**, so a label cannot contradict the line beside it.

⚠️ **The module hands components NAMED LANDMARKS, not an array to index into.** The first
version reached for `ZOOMED[3]` to find the last local top — correct until somebody adds
a vertex, then silently the wrong point, with no error and a plausible picture.
`recentView()` finds it by what it *is* (the highest price after the trough).

⚠️ **A colour that draws a LINE is not automatically a colour you can WRITE in.** WCAG
asks **3:1** of a graphical object and **4.5:1** of text, so `--brand-bright` is fine as a
1.5px dashed rule and fails as a 12px label — measured at **3.85:1** on `--bg-stripe`,
caught by `contrast.spec.ts` on the first full run, not by looking at it. Each horizon
therefore carries two colours: `color` strokes the line, `ink` writes the label one shade
darker. This is CLAUDE.md 11l from the other side — there, one function could not answer
both "what colour is this?" and "what can sit behind white text?"; here one colour has to
identify a line *and* be read as a word, and only one of those clears 4.5.

⚠️ **A figure drawing REAL data reads it, never types it.** Figure 3's three values come
from the nightly snapshot, and its bar widths derive from the same values as its labels —
measured at 375px, `fill/track` equals `pct/deepest` to three decimals on all three rows,
so the caption's "the bars share one scale" is verifiably true rather than merely
claimed.

### The shared chart furniture — `components/learn/chartPrimitives.tsx` (2026-08-19)

Extracted when the second article ("Dip, correction, crash") needed the same axis frame,
palette, zero line, dashed level rules and "today" dot. Copying them would have been the
cheapest thing to type and exactly the defect 11c names: two sets of chart furniture
drifting apart, so the pictures teaching a reader what our product looks like slowly stop
agreeing with each other, with every version still rendering perfectly.

⚠️ **`TodayDot` takes an optional `id`, and that is not decoration — it makes the dot
MEASURABLE.** A guard that measures the printed label instead is measuring something that
is `display:none` below `sm`, and a hidden element reports a zero-sized rect at the
document origin: a confident number about an element nobody can see (14g in miniature).

### Two panels, ONE scale — the comparison figure (2026-08-19)

`TwoRecordsFigure` shows two imaginary companies **at the identical depth** so their own
records can disagree about what that depth means. Three things make that claim true rather
than merely drawn:

1. **Today's fall is constructed, not tuned.** `endingAt()` solves the final vertex against
   the trailing-year peak, so both panels land on `TODAY_PCT` by arithmetic.
   ⚠️ Its first version took the peak from `peakYFrom` (which walks path *vertices*) while
   the curve is built by *sampling* — the high at x=68 fell between samples at 67.5 and
   68.33, so one panel drew **−23.5% under a label reading −25%** beside a panel at exactly
   −25%. A comparison figure whose halves are not comparable, and nothing errored. The
   target is now solved against the same function that draws the curve (11c-iii).
2. **One vertical scale across both panels.** Given its own axis each panel would fill its
   own box, the markers would land at different heights, and the argument would evaporate
   while both panels still looked beautiful. Guarded by measuring the two dots.
3. **Every other number is derived** — each company's average fall and deepest-before-today
   come from `seriesStats` over its own curve, and the article's prose renders those same
   values, so reshaping a path restates the sentence instead of contradicting the picture.

⚠️ **The markers show on phones here, unlike the drawdown article's** (`hidden sm:block`
there). The number *is* the argument in this figure, and hiding it left a phone reader with
two dots and no way to see they match. It shifts to the left of the dot below `sm`, because
centred it overhangs a 269px panel by ~6px.

### Candlesticks in a Learn figure — 52 weekly candles (2026-08-19)

`WeekHighFigure` is the only Learn schematic drawn as candlesticks, at the owner's
direction, and it is the better picture: a candle draws the article's whole distinction
by itself. The **body** is open-to-close, the **wick** is everything traded, and the
quoted 52-week high and low are the tips of two wicks that no close ever reached. A line
chart could only assert that in a caption.

**The palette is the product's**, lifted from `components/stocks/PriceChart.tsx` rather
than chosen here — `#228B22` up, `#B22222` down, `#006400` / `#8B0000` for wicks and
borders — because a reader who signs up meets that chart (11m).

⚠️ **Weekly, not daily, and the granularity IS the readability.** 260 daily candles in a
570px panel is ~2px each and ~1px on a phone: a smear. One candle per week gives exactly
52 of them, which is literally the window the article is about — measured at **11px per
candle at 1280px and 2.5px at 375px**, with wicks visible at both.

⚠️ **Two tuning faults, both found by measuring rather than looking.** (i) The first
version put the up-spike where an ordinary week already held the high, so both extremes
landed in the same week and the gap collapsed to **0.78%** — about two pixels, with the
markers overlapping. (ii) The down-wick was first placed mid-range, where an *ordinary*
week's wick still set the 52-week low: the figure was correct and demonstrated nothing.
**An extreme has to be made by an extreme**, which is now asserted rather than eyeballed.

⚠️ **Labels anchor to their RULE, not to their marker.** The two extremes fall at opposite
ends of the plot, so a label pinned to each marker puts one hard against the right edge at
narrow widths. Anchored to the rule, both stay inside the panel at every width and the
rule carries the eye across to the wick that set it.

### The Learn illustrations — REGENERATED 2026-08-16

Three topic pictures, one per band. **Generated on `google/gemini-3-pro-image` ("Nano Banana
Pro") at 4K via Vercel AI Gateway**, then cropped to the shipping size.

⚠️ **This replaced a hand-authored SVG set built earlier the same day.** The owner's brief
was a picture in the register of a reference image they had generated themselves —
populated, atmospheric, human — which is not what hand-drawn geometry produces. The SVG set
was accurate and lifeless; the section below used to describe it, and every value in it was
correct and is now historical.

| Rule | Value |
|---|---|
| Master | **5056 × 3392 lossless PNG** in `reference/learn-masters/` — gitignored, ~47 MB, **irreplaceable** |
| Shipped crop | **1600 × 1000 (16:10)**, identical on all three. Three bands stack down one page; one odd shape makes a different band height |
| Ground | Deep navy mass carrying **stepped horizontal strata** — flat contour bands, crisp straight edges, each a step lighter than the one below |
| Accent | `#0E7C8B` teal — **every share-price line, always** |
| Warmth | Gold, **lit windows only**. Never a teal window |
| Figure | A small navy-suited person **seen from behind**, in all three. The recurring human anchor |
| Words | **None.** Text in an image is unreadable at 335px, invisible to a screen reader, and stale the moment a heading is reworded |

**Two semantic rules hold the set together.** *Teal is always the share price; navy is
always the company.* And **no green, no red anywhere** — the product tints a **deeper**
price fall *green*, because deeper is more cyclically favourable, so a picture using the
conventional green-up/red-down would contradict the tool one click away. It is also the one
colour pair a colour-blind reader cannot separate. **No arrows**, either: an arrowhead is
the visual grammar of a forecast, and this product does not forecast.

⚠️ **THE MASTERS CANNOT BE RECREATED, and that governs every decision about them.** The same
prompt returns a *different* picture — different skyline, different valley shapes, a
differently posed figure. The prompts are stored beside the masters and document *intent*;
they are not a recipe for getting these images back. Two consequences that have already
bitten: **render at the maximum size you will ever need** (4K is the Gateway's ceiling — no
model there offers 8K), and **fix colour by correcting the file, never by re-rolling.**

⚠️ **FOUR PROMPT INSTRUCTIONS ARE LOAD-BEARING.** Each was learned from a roll that failed
without it, and each fails *silently* — the picture comes back plausible and wrong:

1. **"SOLID FILLED SHAPES … absolutely NOT line art, no thin stroke outlines."** Without it
   the model returns white boxes with teal outlines — a visibly different illustrator from
   the rest of the set.
2. **"PLAIN LINES with blunt flat ends — no arrowheads, no pointed tips, no triangles."**
   Saying *"no arrows"* is **not enough**; it drew arrowheads anyway. The prohibition needs
   a positive description of what the ending *is*.
3. **"at least three times taller than it is wide"** for towers. *"Tall office building"*
   yields squat six-storey blocks.
4. **"the ground surface is completely plain — no plazas, no steps, no trapezoids"**, stated
   **separately** from the strata. ⚠️ And do not then also say *"stepped bands"* in the same
   paragraph: image 2 shipped with a physical stepped plinth because the brief asked for
   both, and the model resolved the contradiction by building stairs.

⚠️ **Describe the SCENE, not the LAYOUT.** Image 3 kept coming back with a hard vertical
seam at exactly 50% because the brief said *"left side … right side"*. Told there are two
sides, the model draws the border between them. Rewritten as **one continuous landscape in
thickening fog**, never naming a region, the seam fell from Δ3.23 to Δ0.51 against a 0.25
baseline.

⚠️ **Match the pale areas to `--bg-page` `#F0F4F8`, and measure it.** Image 3 is the only one
with a large flat pale area meeting the page, and at RGB distance **16–21** it read as a
panel sitting *on* the background rather than part of it — where images 1 and 2 sit at 4–6
and 11–13. Corrected with a **lightness-weighted** shift of `(+16, +4, −3)`: full strength on
the background, zero below L=0.72, so the navy and teal came out byte-identical (asserted,
not assumed). Right edge now measures **1**.

⚠️ **A composition approved on the cheap model is not guaranteed by the expensive one.**
Drafts ran on `gemini-3.1-flash-image-lite` ($0.034, ~4s); finals on Pro ($0.24 at 4K).
Pro **reframed image 2** and ran both price lines off the top edge — two teal pipes hanging
from the sky, the fall invisible, the picture's whole argument gone. Always re-verify the
finals; the draft only settles the idea. *(And check the uncropped master before blaming
your own crop — that was the first thing ruled out.)*

⚠️ **Neither Canva nor an image generator could produce the ORIGINAL geometric set**, which
is why it was hand-drawn: Canva's generator arranges layouts and cannot be handed geometry,
and four candidates came back with no share price falling in any of them. The owner's own
generated attempt had the right *composition* — and doors and windows, which is what turns a
stack of slabs into a building — but shipped green/red arrows, embedded text, and "PROFIT
INCREASE" beside piles of coins: a compliance problem for a not-financial-advice product
(decision #24) rather than a matter of taste. **The composition was adopted; the execution
was rebuilt** — first as SVG, then, with the house style above pinning the palette and the
bans, as generated artwork that keeps the compliance posture intact.

## 12. Animations

Subtle, fast, purposeful. No bouncy easings.

| Transition | Duration | Easing |
|---|---|---|
| Hover state changes | 150ms | `ease-out` |
| Card fade-in on mount | 250ms | `ease-out` |
| Modal open/close | 200ms | `ease-in-out` |
| Tab switch | 0ms (instant) | — |
| Chart updates | 300ms | `ease-out` (built into chart libs) |

Use `prefers-reduced-motion` to disable on user request.

### The three Learn skies — and why image 3 is the UNTOUCHED original (2026-08-18)

All three illustrations share one sky family: a cool blue-white. The measurement is
the **blue cast**, `B − R` on the sky band, plus that sky's distance from
`--bg-page` (`#F0F4F8`):

| Image | Sky | Blue cast | Distance from page bg | Provenance |
|---|---|---|---|---|
| 1 · Falls and recoveries | `#ECF5F9` | +13 | 4 | untouched |
| 2 · Judging the business | `#E6F0F9` | +19 | 11 | untouched |
| 3 · Using MajorCycle | `#E2ECF6` | +20 | 16 | **untouched** |

**All three are now the raw generated images. No colour editing survives on any of
them, and that is the point.**

⚠️ **The history is worth keeping, because two edits were made and both were wrong.**
On 2026-08-16 image 3's background was shifted toward `--bg-page` because it read as
a visible panel on the page. That shift also **stripped its blue** — it went to
`#F1F0F3`, a cast of **+2** against its siblings' +13 and +19, i.e. grey. No guard
covers image colour, and each picture looks fine *on its own*; the owner found it only
by comparing the three. On 2026-08-18 it was re-tinted to image 1's exact sky, which
fixed the colour and cost a little fidelity (193 of 31,717 distinct colours, 0.6%) for
a defect that was mine to begin with.

**The owner's call, and it was the right one: put the original back.** The shipped
crop is recoverable from the master exactly — `extract({ left: 0, top: 116, width:
5056, height: 3160 })` then `resize(1600, 1000)`, established by scoring three
candidate crops against the shipped file on dark pixels only (centred **0.83** mean
absolute difference out of 255, against 23.5 top-aligned and 12.8 bottom-aligned). So
image 3 is now regenerated straight from `reference/learn-masters/`, never
colour-edited and never re-encoded from an edited file. At +20 it sits **closer to
image 2 (+19) than any edited version ever did.**

⚠️ **The residual, accepted knowingly:** image 3's sky is 16 from `--bg-page` against
image 2's 11, so it has slightly more edge against the page than its siblings. That is
the thing the 2026-08-16 edit set out to remove, and two attempts at removing it cost
more than it did. **Fidelity beat blending.**

⚠️ **If any of these is ever regenerated or re-edited, re-measure all three skies and
compare them TO EACH OTHER.** A single image that looks right in isolation is exactly
what this defect looked like for two days.

### Scroll-reveal on the landing page — BUILT 2026-08-15

Three moments, all on `/`, all specified by the approved storyboard: the **ruler fills**
grow from 0 to their real width, the **Opportunity Map bubbles** fade in, and the
**briefing ring** sweeps to its arc. `components/landing/LandingMotion.tsx` (client) runs
one `IntersectionObserver` at `rootMargin: '0px 0px -12% 0px'` and **only ever adds** the
`.in` class — it never removes one, so nothing can re-hide as you scroll back up.

⚠️ **The server renders the FINAL state; JavaScript arms the initial one.** `LandingMotion`
sets `data-motion="on"` on the `.lp` root, and every "hidden" rule is scoped behind it:

```css
.lp .ruler-fill                          { width: var(--w, 0); }   /* final */
.lp[data-motion] .ruler-fill:not(.in)    { width: 0; }             /* armed */
```

**Written the other way round — hide in CSS, reveal in JS — a hydration error or a stalled
bundle strands the whole page, with no error anywhere.** Reduced motion reveals everything
immediately rather than animating it fast.

⚠️ **Do not over-claim what this buys, because measuring it turned up something else.**
A reader with scripting fully **off** currently sees "Loading…" on `/` regardless, because
⚠️ **RESOLVED 2026-08-18 — `app/loading.tsx` was deleted; this paragraph is the history.**
It *used to* wrap every route in a Suspense boundary, and React defers any page whose
HTML overruns the first flush — `/` and the three legal documents all do. That is an open,
recorded finding (coding-standards §14 item 11), not something the motion design can fix.
What this pattern *does* protect against is the far likelier case: JavaScript that loads
and then fails — a hydration mismatch, a thrown effect, an observer that never fires. In
all of those the CSS never arms, and the page stands.

Guarded by `e2e/landing.spec.ts`: the server payload must contain every section and no
`data-motion`, and stripping the flag in-browser must leave every section at `opacity: 1;
transform: none`. ⚠️ `toBeVisible()` is **not** sufficient — Playwright counts an
`opacity: 0` element as visible, and eight such assertions stayed green through a
deliberate break.

⚠️ **Publish an animated value as a CUSTOM PROPERTY, never as an inline `style`.** The
fills first shipped as `style={{ width: '61%' }}`, which is (1,0,0,0) and out-specifies
*any* class rule — so the armed `width: 0` never applied and each bar animated from its
final value to its final value. It looked like the animation had simply not been wired
up. `--w` carries the number and the stylesheet owns the property, so the cascade works
normally. **A visibly absent animation is more often a specificity loss than a missing
listener.**

---

## 13. Iconography

Use **Lucide React** (`lucide-react`) exclusively. Stroke width 1.5 by default, 24px size for most uses, 16-18px inline with text.

Common icons used:
- `TrendingUp` / `TrendingDown` — direction
- `Info` — tooltips
- `ChevronDown` — dropdowns
- `Search` — search inputs
- `Upload` — file upload
- `RotateCw` — refresh
- `LogIn` / `LogOut` — auth
- `User` — account
- `Settings` — preferences

---

## 14. Accessibility Floor

Phase 1 minimums (not aspirations — requirements):

- All interactive elements have `:focus-visible` ring (2px brand-bright outline)
- Contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text

> ### ⚠️ MEASURED 2026-08-07 — the contrast floor above is currently BREACHED
>
> Read off the live `/methodology` at 1440×900 with the WCAG relative-luminance formula
> computed in-page (not estimated). **8 elements fail.** Two of them are material rather
> than cosmetic:
>
> | Element | Ratio | Needs | Status |
> |---|---|---|---|
> | **Rating tier badges** — white on `--c-tier-3` / `--c-tier-4` | **2.38 : 1** | 4.5 : 1 | ✅ **fixed 2026-08-08 — now 4.73 : 1 worst case** |
> | **"Full disclaimer" link** (`--text-muted` on `--bg-page`) | **2.69 : 1** | 4.5 : 1 | ✅ **fixed 2026-08-08 — now 6.8 : 1** |
> | "Financial Terminal" wordmark, 9px | 2.69 : 1 | 4.5 : 1 | ⏭️ Layer H (shared header) |

### The brand lockup is ONE component

`components/BrandLockup.tsx` — the mark, the wordmark and the "Financial Terminal"
subtitle. Rendered by **both** the public header and the signed-in sidebar.

It was two hand-maintained copies until 2026-08-18, and they had drifted on three
things nobody lists when comparing two files:

| | Sidebar | Public header |
|---|---|---|
| `leading-none` | on the **wordmark** | on the **wrapper** — inherited, so it crushed the subtitle's line box too |
| logo `flex-shrink-0` | yes | no |
| lockup gap | `gap-[10px]` | `gap-[10px]` when linked, **`gap-2.5` = 8.75px** on the two confinement pages |

⚠️ **None of those is a wrong line.** Each file is internally coherent and reads
correctly on its own; the defect existed only in the COMPARISON, which is why review
never caught it and the owner putting two screens side by side did. That is CLAUDE.md
11c — extracting the shared piece is the fix, and "I'll just make the second one match"
is how you get a third copy later.

The **gap lives inside the component**, not on the callers' containers: a shared
component whose spacing is still supplied by two different parents has only moved the
drift somewhere less visible.

> ⚠️ **Do not "fix" the 9px subtitle here.** It is the named `KNOWN_DEFERRED` exemption
> in `contrast.spec.ts`, assigned to the Layer H sweep so the whole site moves at once.
>
> ⚠️ The guard that asserts the 10px gap now measures the **rendered distance** between
> the mark and the wordmark, not `gap` on a named element. The old form went red on this
> refactor while nothing on screen had changed by a pixel — a guard that names an
> IMPLEMENTATION breaks on refactors and teaches you to loosen it (CLAUDE.md 11i-b).
>
> **How the tier badges were fixed, and why it is not a colour change.** `/methodology`
> painted white on the SOLID tier fill. The five `.tier-badge--N` classes the product
> actually uses are tint-plus-ink and already cleared 4.5:1 — so the page now renders the
> real component. It is both legible and pedagogically right: the reader learns the badge
> they will actually meet. **No locked tier colour was touched** (decision #25).
>
> **Measured after: 8 failures → 1**, the deferred wordmark. `e2e/contrast.spec.ts`
> measures every public page on every run, and the exemption is listed BY TEXT so it cannot
> quietly widen to cover a second element. *(The list read `/`, `/methodology`,
> `/disclaimer`, `/terms`, `/privacy` when this was written. `/methodology` retired, and
> the spec now covers the three legal pages as `READING_PAGES`, `/` as a `LAID_OUT_PAGES`
> entry with its own sentinel, and the four form pages as `FORM_PAGES` — together every
> entry in `PUBLIC_PAGES`.)*
>
> ⚠️ **A state that cannot be REACHED cannot be MEASURED — the auth error banner
> (2026-08-12).** The red `role="alert"` shared by all four auth forms and `/contact`
> (`--c-tier-5-ink` on `--tint-tier-5`) had never been contrast-checked by anything,
> because it does not exist in the DOM until something fails, and a page is only measured
> in the state it is loaded in. So the one element a reader is guaranteed to be squinting
> at, in the moment they are most stuck, was the one with no evidence. The dead-link notice
> gave it a URL that renders it **on load**, so `/login?error=auth_confirm_failed` is now in
> `FORM_PAGES` and the banner is measured every run. It passes; washing its text to
> `#c9c9c9` makes the guard name it at **1.4:1**, which is how we know it is genuinely being
> measured rather than silently absent. **Generalise this:** if a state can only be produced
> by an interaction, give it a URL, or accept that no page-level guard will ever see it.
>
> The first is **§4 of this document — "THE Most Important Spec"**. The five tier labels
> are the product's entire vocabulary and they are the hardest text on the page to read.
> The second is **compliance-adjacent** (CLAUDE.md #4/#12): a legally material link must
> not be the faintest thing on the page.
>
> **Scope, decided with the owner:** the Layer G plan puts accessibility fixes in Layer H,
> and that still holds for the signed-in app. **These two are fixed inside Layer G**,
> because they sit on pages G is redesigning anyway and "we rebuilt this page and left the
> illegible badge" is not defensible. The remaining six go to H with the rest of the sweep.
>
> ⚠️ **`--text-muted` (#8A97A8) is 2.69:1 on `--bg-page` and 2.97:1 on `--bg-surface`
> wherever it appears** — it is not a `/methodology` problem, it is a token problem.
> Before using it for anything a reader must actually read, check the pairing. It is
> fine for genuinely decorative text.
>
> ### Layer G, commit group 1 (2026-08-12) — the guard was extended and found six more
>
> The measurement had only ever run on the five READING pages. Extending it to the six
> form pages (`/login`, `/signup`, `/reset-password`, `/contact`, `/pricing`,
> `/deletion-requested`) found six failures that had been there since those pages were
> built, all `--text-muted` at **2.97:1**, all now `--text-secondary`:
>
> | Element | Where | Why it counts as material |
> |---|---|---|
> | Every form field label ("Email", "Password", "Name", "Message") | `ui/label.tsx` — one fix, ~20 labels app-wide | §14 lists "all form inputs have a visible label" as a Phase 1 floor; 2.97:1 is only nominally visible |
> | "or continue with" | `AuthDivider` | The only thing saying the Google button is an alternative, not an extra step |
> | "/month", "USD", "Billed monthly", "Already have an account?", "No refunds — cancel any time…" | `/pricing` | These are the TERMS OF THE DEAL on the page where somebody hands over a card |
> | "Our ratings… nothing is charged until day 7" | `/signup` | The sentence that stops "free account" being read as "free trial, card required" |
>
> Scope is unchanged: the muted sweep is still Layer H **except on pages Layer G is
> rebuilding**. These are on the sign-in and payment path, and every fix was a single
> colour token — no size, weight or spacing moved.
>
> **State today, measured on every public page at 1280px and 375px:**
> **zero failures at 375px**, and exactly **one at 1280px** — the 9px "Financial
> Terminal" wordmark, still deferred to Layer H and still named by its text in
> `KNOWN_DEFERRED` so the exemption cannot quietly widen.
>
> #### The second deferral — the product's score palette, on the landing page (2026-08-15)
>
> The landing's worked run draws the screener's `.score-num` chips with the screener's own
> colours: **white numerals on `scoreColor()`**. Three of the five tier fills are far too
> light to sit behind white — **Neutral measures 2.38:1**, the identical figure G2 fixed on
> the tier *badges*. This had never been caught because the contrast guard walks **public**
> routes and the screener is gated, so `/` was the first measured page ever to draw one.
>
> ⚠️ **It is deferred by owner decision, not by oversight.** The instruction was *"whatever
> is present on the live site, the color should exactly match that"* — a landing page that
> quietly repaints a paid surface is a scope breach, however real the defect. Fixing it is
> a **product-wide Layer H** job. The debt is carried in the open instead:
>
> - `[data-legacy-contrast]` marks the one subtree (`Mag7Table`'s wrapper).
> - Failures inside it are excluded from pass/fail but **counted**, bounded at **42** —
>   7 rows × 6 low-contrast elements, so a jump past it means new text was *added*, not
>   inherited.
> - The marker must sit on **exactly one** subtree, and at least one failure must still be
>   inside it. If it hits zero the exemption is excusing nothing and comes out (14g).
>
> **Record a defect you are not authorised to fix; do not fix it quietly and call it
> tidying.** An exemption with no ceiling and no floor is a blindfold, not a decision.
>
> ⚠️ **Two more measurement lessons from the same sweep.** (i) The Neutral badge scores
> 4.73:1 on white and **4.32:1** on `--bg-page` — the badge did not change, what sat behind
> it did. Composited colours must be measured where they actually sit. (ii) The dark
> honesty band reported *every* line failing at ~1.1:1, on a band that is obviously navy —
> the gradient-shorthand bug below, one level up.
>
> ⚠️ **A gradient button reports NO background colour.** `bg-gradient-to-br` paints via
> `background-image`, leaving the computed `background-color` transparent — so any tool
> asking the DOM what is behind a white label reads straight through to the page and
> scores ~1:1. `Button`'s `primary` variant therefore also declares
> `[background-color:var(--brand-mid)]`, the gradient's lighter stop, so the element
> reports its own worst case (6.7:1). Visually a no-op; both stops are opaque.
- All charts have a `aria-label` describing their data
- All form inputs have a visible `<label>`
- Keyboard navigable: Tab moves through everything in document order
- Screen-reader announces tier badges as "High Conviction rating" (via `aria-label`)

**Control patterns (C-R3 deep a11y pass).** Applied across every Stock-Detail control:

- **Mutually-exclusive view toggles** — chart range buttons (1Y / 3Y / All / Max on Price,
  Drawdown, Smart Money, Relative Performance), the Drawdown/Profit toggle, and the
  clickable legend chips — are `<button type="button">` with **`aria-pressed`** reflecting
  the active option, wrapped in a **`role="group"` with an `aria-label`** ("Price chart date
  range" etc.).
- **A button that opens a dialog** carries **`aria-haspopup="dialog"` + `aria-expanded`**
  (the subnav Methodology button).
- **Dialogs** trap focus, close on Esc, and restore focus: the MethodologyModal uses the
  Radix `Dialog` (handles all of this + `aria-modal`/labelledby/describedby); the Smart-Money
  day-panel (`role="dialog"`) moves focus to its Close button on open.
- **Data gauges** (the 52-week range) use **`role="img"` + a spoken `aria-label`** (position
  summary), not just a hover `title`. **Data tables** carry an `aria-label`.
- Charts already carry an `aria-label`; InfoTips are full (`role=tooltip`,
  `aria-label`/`aria-expanded`/`aria-describedby`, Esc, hover+focus+tap).

---

## 15. Disclaimers — Visual Treatment

Disclaimers are mandatory on any page showing a rating. Visual style:

- **Inline (under rating):** 11px italic muted text, brief: *"Information only — not financial advice."*
- **Footer (every page):** Full disclaimer block, 12px muted text, with link to `/disclaimer`.
- **First-login modal:** Modal with full methodology + disclaimer summary, "I understand and acknowledge" checkbox required to proceed.
- **Methodology modal (in-app):** The primary scoring explainer is a modal opened from the "Methodology" button in the Stock Detail subnav — visual parity with the reference methodology modal (`reference/original-design.html:794`), content corrected to the current engine, formula blocks included (it's behind sign-up). It carries its own footer disclaimer. See `web/components/stocks/MethodologyModal.tsx`.
- **Public methodology — now `/#how-it-works`, not a page (2026-08-13).** The
  **high-level, no-formula** explainer for first-time visitors lives in sections ⑤+⑥ of
  the landing page. The standing rule is unchanged: **do not expose the full formula
  detail publicly** — the formulas stay in the in-app modal, behind sign-up. ❌ This entry
  used to describe a separate `/methodology` page as "a later Layer F item"; that page was
  built, then folded into `/` and retired with a 308 carrying the fragment. The reason was
  that the two competed for the same search intent while neither was the page we most want
  to rank.

Wording must include: "Information only", "Not financial advice", "Past performance does not indicate future results", "Conduct your own research".

---

## 16. Where The Reference Diverges From This Doc

The reference HTML uses old labels (STRONG BUY etc.). The new build uses the labels defined in section 4. **Everything else** in the reference is canonical: layouts, sizes, colours, spacing, tooltips, hover behaviour.

If you find another conflict during build, surface it. Don't silently choose.

### Run Analysis tab — intentional layout deviation (Layer D, owner-approved)

The reference Run tab (two co-equal cards: a large **CSV upload** drop-zone + a
raw **Analysis Settings** card, plus a cosmetic clock-based progress bar) is a
power-user layout. It fails our **mass-retail beginner** audience: the blank-canvas
problem ("I have no tickers.csv and can't name 50 tickers"), over-promoted CSV,
and intimidating raw thresholds. Layer D **deviates from #1 visual parity for this
tab only**, keeping all brand tokens/typography, and reframes it as a single
**"Build your analysis"** flow (`web/components/run/`):

- **Choose what to analyse** — ready-made **baskets** lead (`BasketPicker`: index /
  top-by-cap / "By sector ▾" / **"By industry ▾"** (industries grouped under their
  sector via native `<optgroup>`, ~126 across 11 sectors) / Magnificent Seven). The
  three **index baskets** (S&P 500 / ASX 200 / S&P/TSX 60) resolve to the *actual
  index constituents we cover* — the intersection of the `index_membership` table
  (read at request time via `web/lib/index-membership.server.ts`, threaded into
  `BasketPicker` via `buildQuickBaskets`) with the universe — **not** "every equity
  in that market" (which would absorb Request-a-Ticker additions). Membership is
  refreshed **automatically every night** from official ETF holdings files
  (SPY/IOZ/XIU; `analytics/cron/refresh_index_membership.py`) — no hand-edited CSVs,
  no redeploy. A new constituent we don't yet cover is enqueued + fetched the same
  night, so the basket stays complete.
  **search-and-add** autocomplete (`TickerSearchAdd`), and **CSV demoted** to a small
  import (`CsvImport`, with a 15-ticker sample download — 5 US / 5 AU / 5 CA real
  symbols), all feeding a visible **selected-tickers chip list** with a live count
  (`SelectedTickers`).
- **Investing horizon** — Short/Medium/Long preset cards up front; **Custom + raw
  pullback/profit/lookback behind an "Advanced" disclosure** (`HorizonSettings`),
  with `InfoTip` explainers and §7 bounds validation. Validation is **live and
  per-field**: each input shows a red border + inline note *only* on the offending
  field, clearing the instant the value is valid (shared `boundError` helper in
  `presets.ts`, also used by Browse's Custom horizon inputs). When Advanced is
  collapsed, a single prompt surfaces if a hand-edited value is out of range.
- **Honest progress** — `RunProgress` shows *real* batches completed (not a fake
  clock), elapsed, ETA, scored/skipped counts, and a **Cancel** button. The
  fabricated per-stage pipeline log from the reference is intentionally dropped.
- **Run complete / Last Analysis** — `RunComplete` (top pick + "Constructive or
  better" count, computed client-side) and `LastAnalysisCard` (Re-run).

Styling **ports the reference run-tab classes into `globals.css`** (mapped to the
live tier/brand tokens: `.preset-btn`, `.set-field-*`, `.adv-toggle`, `.btn-run`,
`.lastrun-*`, `.rc-*`, `.progress-bar-*`, `.upload-zone`, `.basket-chip`,
`.tk-chip`, `.run-search-*`) so the page matches the reference's compact look and
blends with Browse + Stock Detail (JetBrains-mono numerals, brand-gradient
accents). The in-page `<h1>` is omitted — the app `Header` already renders the
page title.

---

## 17. Auth Email Design (Layer F0)

Thirteen Supabase emails are branded to one shell: the **six auth emails** (Confirm
signup, Magic Link, Invite, Change email, Reset password, Reauthentication) **plus the
seven "security" notification emails** (password / email-address / phone-number changed,
sign-in-method linked/removed, MFA method added/removed). Delivered via **Custom SMTP →
Resend** from `noreply@majorcycle.com`.

**Header — slim hybrid (~72px), NOT a full banner.** *(An earlier full-width banner
image was dropped after a design review: too tall — it pushed the CTA below the fold
on mobile — and it baked the wordmark + tagline into a JPEG, which fails image-blocking
and accessibility.)* The header row is:
- **Background:** `linear-gradient(120deg,#010F2C 0%,#04214F 58%,#063A80 100%)` — the
  brand banner's diagonal navy→blue — with a **solid `#04163E` fallback** set via
  `bgcolor` + `background-color` (Outlook ignores CSS gradients and gets the solid).
- **Accent:** `border-bottom: 3px solid #2E7DE8` (brand-bright).
- **Mark:** the **floating transparent icon** `https://www.majorcycle.com/email-icon.png`
  at `height:44px`. Source `reference/email-icon.png` (pristine, transparent); optimized
  web copy `web/public/email-icon.png` (107×128, ~17KB). Transparent so it floats on the
  gradient with no square/ghost — do **not** use the navy-square `logo.png` here (it
  blends into the navy).
- **Wordmark:** "MajorCycle" as **live HTML text in Sora** (never an image) — accessible,
  survives image-blocking, on-brand.

**Body.** White card (`#ffffff`, `border-radius:14px`, `overflow:hidden`), 32px pad:
heading (`#0f172a`, 20px/700), intro (`#475569`, 14.5px), a **`#1E5CB3` CTA button**,
a "paste this link" fallback (`#1E5CB3`, `word-break:break-all`), and a muted security
note (`#94a3b8`). Reauthentication swaps the button for the OTP `{{ .Token }}` in a
JetBrains-Mono code box (`letter-spacing:8px`, `#1A3A6E`).

**Footer.** `© MajorCycle — Information only, not financial advice.` (compliance #12).
Standardised across **all 13 templates** (6 auth + 7 security): a **grey footer cell**
`padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;` with the disclaimer
`<p>` at `#94a3b8`, 12px, Sora. (Earlier the 6 auth footers were white with a `#eef2f7`
top border and no fill; unified to the grey security-template style 2026-07-04.)

**Fonts.** Each template opens with `<style>@import url('…Sora…');</style>` and every text
element carries the Sora stack (`'Sora',-apple-system,BlinkMacSystemFont,'Segoe UI',
Roboto,Helvetica,Arial,sans-serif`). Sora renders where web fonts are allowed (Apple
Mail, iOS Mail); **Gmail/Outlook strip custom fonts** — a universal email limitation, not
a bug — and fall back to the system sans.

**Links.** Auth templates use the **token-hash** pattern → `https://www.majorcycle.com/auth/confirm?
token_hash=…&type=…&next=…` (never `supabase.co`). Verified by `web/app/auth/confirm/
route.ts`. Per-template `type`/`next` mapping and the Supabase-Monaco editing method are
recorded in project memory; see `architecture.md` §7 for the auth-branding overview.

**Security notification emails (the 7).** Same header + grey footer, **no CTA/link** (they
notify, not act): heading, a short plain-language message, and a **red "didn't do this?"
callout** (`#fff5f5` box, `#9b2c2c` text) pointing to `security@majorcycle.com`. They're
toggle-only in Supabase's Emails list — each has a real HTML editor only at its own
`/auth/templates/<slug>` URL, with **two independent saves** (Configuration = the enable
toggle; Content = subject + body). Available vars: `{{ .Email }}`, `{{ .Data }}`,
`{{ .SiteURL }}`. `security@majorcycle.com` is a real inbox (Cloudflare Email Routing →
owner Gmail; see `architecture.md` §7).

**Reply/signature templates (built).** Owner replies from `security@majorcycle.com` and
`support@majorcycle.com` go out from Gmail via Resend-SMTP "Send mail as" identities, each
with its own **branded HTML signature** (navy header mark + Sora + `#1E5CB3`/grey palette,
role line "Security Team" / "Support Team") so human replies match the transactional emails.
They live as per-identity Gmail signatures (`reference/email-signature.html` +
`web/public/signature-logo.png`), not Supabase templates. Both inboxes forward to owner Gmail
via Cloudflare Email Routing and are filed under `MajorCycle/Security` and `MajorCycle/Support`
labels. The `/contact` form's own inbound notification email is rendered through the shared
brand wrapper `web/lib/email/brandEmail.ts` (`renderBrandEmail()`) — the same gradient header
(`#010F2C→#063A80`, solid `#04163E` fallback) + floating `email-icon.png` + Sora wordmark + grey
`#f8fafc` disclaimer footer as the transactional/auth emails — with all user-supplied fields
HTML-escaped. It sends **from `support@majorcycle.com`** (via `CONTACT_FROM_EMAIL`, not `noreply@` —
these are messages the owner replies to) with **reply-to = the submitter**, delivered to the `support@`
inbox. That wrapper is the single source of chrome for any future app-sent HTML email.

---

**End of design-system.md.**
