# Layer 5a — the pre-launch sweep

> **Status: IN PROGRESS.** Started 2026-08-31, after Layer G merged as `f1b6d4d` and every
> earlier audit layer closed. Expected to run across 2–4 sessions by owner agreement.
>
> **This file is the worklist and the findings ledger.** It exists because the sweep is
> longer than one session's context, and because the Layer G audit has already been bitten
> twice by the opposite arrangement: a finding recorded once, fixed under a different
> number, and left reading as open for over a week (F-002, F-007). **A sweep whose state
> lives only in a conversation has no state.**

---

## What the owner asked for

> *"I want a full complete sweep of everything is correct or not. Ensure you check everything
> for every edge cases. This is the final check we are doing before launching. So, I want this
> to be very thorough."*

> *"I want you to visually see each and every page and confirm if everything is rendering the
> way it should be rendered. I want you to do special attentions to colors for each and every
> state and edge cases. I have already noticed things that are wrong in terms of coloring. But
> you do your own sweep and we can go from there."*

⚠️ **The owner has already spotted colour defects and has deliberately NOT said which.** This
sweep is therefore run *blind* on purpose, so the two readings are independent. Being told
what to look for would turn a search into a confirmation — and a confirmation finds exactly
one thing. **Do not ask which ones until this sweep's colour pass is finished and written
down.**

---

## Scope decisions — owner, 2026-08-31

| Decision | Consequence for this sweep |
|---|---|
| **375px on PUBLIC pages → FIX** | Mobile defects on the public site are in scope and get fixed here |
| **375px on SIGNED-IN pages → note and move on** | Layer H owns it. The `(app)` shell has a known ~130px overflow, already triaged and measured there. Record anything new, fix nothing |
| **Vercel Hobby → Pro** | Deferred by the owner. Still the launch blocker; not this sweep's job |
| **`KpiStrip` / `ThesisInsights` "favourable"** | Ruled 2026-08-31: **leave as they are.** Do not re-raise |

---

## ⚠️ Method — the things that make this sweep worth running

Written down first because every one of them is a lesson this project has already paid for,
and because a sweep that ignores them produces a clean report about nothing (CLAUDE.md 14g).

**1 · Measure colour, never eyeball it.** Read what the browser computed (`getComputedStyle`)
and compare against the token the element is supposed to use. A stale copy of the palette
renders *perfectly* — that is precisely how `compositionRamp()` painted the pre-August colours
under every Overall score for a month (11c-viii). A screenshot cannot see it, and neither can
a person. ⚠️ And **derive the finding from a number, not a picture of a picture**: a
downscaled screenshot once had me report a generated image as broken when the bytes were
fine (11o).

**2 · Judge a colour where it SITS.** A badge measured 4.73:1 on white and 4.32:1 on the page
ground; the badge did not change, what was behind it did (11l). Also: `background:` shorthand
resets `background-color` to transparent, so anything asking the DOM what is behind white text
on a gradient reads straight through to the page and reports ~1.1:1.

**3 · Ask what a local fix does to the SET.** Never *"is this colour legible?"*, always *"how
far is it from its neighbours after this?"* Fixing three tiers in isolation put Cautious and
Bearish 10.7 apart and the owner caught it by looking (11t).

**4 · The paid analysis CANNOT be measured on this machine.** `/api/cycle` is a Vercel Python
function and `next start` does not serve it, so on a local production build the whole cycle
block renders nothing — no rating, no verdict, not even the free "Current Drawdown". A sweep
run there comes back clean **having looked at nothing** (11v). Anything touching scores, the
verdict, the scorecard or the report is checked on a **deployed preview**.

**5 · `:3200`, never `:3000`.** The dev server's CSS lies. `:3200` runs `start:fresh`
(`pnpm build && next start`) so it cannot serve a stale build — but `preview_start` will
REUSE a running `:3200` without rebuilding, so the guarantee is on a fresh start only (11o).

**6 · A missing thing renders perfectly.** A section that simply is not there looks
deliberate; there is no error and no gap. So enumerate what SHOULD be present and check for
it by name, rather than looking at the page and asking whether anything is wrong (11j).

**7 · A guard/probe written five minutes ago has never been observed failing**, so a pass
from it carries no information. Give it the case that must fail first (11p).

**8 · When the owner's reading and mine disagree, THAT is the finding.** ⚠️ Added on review.
The owner has already seen colour defects and has not said which. If my measured pass misses
something they spotted by looking, the conclusion is not "one more colour to fix" — it is that
**the method has a blind spot**, and the blind spot will be hiding other things too. The
contrast probe has been wrong in exactly this way twice: once compositing a colour's own alpha
but never `opacity` (text seen at 3.38:1 scored 6.81), and once measuring 47 elements on a page
carrying 291 and calling it clean (11q). So the comparison with the owner is a **test of the
instrument**, and it is written into the plan rather than left as a courtesy.

**9 · Fix nothing on a paid surface without a ruling** (11l). A real defect does not license
widening scope — that is the mistake the owner reversed once already, when a genuine contrast
finding turned into an unasked repaint of the screener.

---

## Route inventory — derived from the filesystem, not from memory

22 route files, three error boundaries. Dynamic routes expand as shown.

### Public (13 + 17 dynamic)
| Route | Notes |
|---|---|
| `/` | landing, 8 sections, real Mag 7 figures |
| `/pricing` | monthly↔annual toggle; signed-in redirects to `/account` |
| `/contact` | server action → Resend |
| `/learn` | index |
| `/learn/[slug]` | **×12 articles**, 3 illustrations |
| `/articles` | index |
| `/articles/[slug]` | **×5 articles**, frozen figures, ranked tables, custom figures |
| `/terms` `/privacy` `/disclaimer` | contents rail + scroll-spy |
| `/login` `/signup` `/reset-password` | `force-dynamic`, must work with **no JS** |
| `/account/update-password` | recovery-confined, **logo-only chrome** |
| `/deletion-requested` | marker-gated, signed-out only |
| `/reactivate` | deletion-confined, **logo-only chrome** |

### Signed in (6 + universe)
| Route | Notes |
|---|---|
| `/stocks` | Browse |
| `/stocks/[market]/[ticker]` | **34 components**; 3 markets; the paid surface |
| `/run` `/results` | the screener — entirely premium |
| `/request` | ticker request |
| `/account` | profile, billing, delete, referrals |

### Boundaries
`app/not-found.tsx` (auth-aware) · `app/error.tsx` · `app/(app)/error.tsx`

---

## The nine passes — P0 to P8

Each pass produces findings in the ledger below. Nothing on a paid surface is changed
without the owner ruling on it first (11l).

- [ ] **P0 · Build the expected-content manifest, BEFORE looking at anything.** One line per
      route naming the sections that must be present. Method note 6 is not optional: a missing
      section renders perfectly, so "look at the page and see if anything is wrong" cannot find
      one. **This has to be written first or P1 is just browsing.**
- [ ] **P1 · Renders, in every state — and is COMPLIANT in each.** 9 viewer states × every
      route, checked against the P0 manifest. ⚠️ **Non-negotiable #4 is checked here, not
      assumed:** every page showing a rating, score or signal must carry the disclaimer
      *visible without scrolling*. That is a legal requirement, it is per-STATE (a locked-out
      viewer sees a different page from a subscriber), and no existing guard asserts the
      "without scrolling" half.
- [ ] **P2 · Colour, measured.** Tier palette across all 4 surfaces; 3-tier health ramp; the
      drawdown tint that runs green for a deeper fall; direction-as-text; the legacy-contrast
      subtree; the new red delisting banner.
- [ ] **P3 · It works when used.** Every form, every control, keyboard-only, the screener end
      to end, sign-up → sign-out. Plus the **first-login disclaimer gate** (#23) on a genuinely
      new account — it is the one screen with a button that WRITES a compliance record, and it
      has already destroyed one (F-031).
- [ ] **P4 · Data edge cases.** No cycle at horizon · cross-currency · a bank · no dividend ·
      no analyst coverage · no insider activity · retired ticker · unknown ticker/market/slug ·
      empty results · a brand-new account with no history. Plus a **sanity check on the
      analysis itself** for one stock per market: does the drawdown the page states match the
      chart it draws, and the price history behind it? Every guard we own checks that numbers
      are *present and consistent*; none checks that they are *right*.
- [ ] **P5 · Content, claims and copy.** ⚠️ **ADDED on review, and it is the gap I am least
      comfortable had been missing.**
      · **Re-derive every published number.** The landing states counts, ranks and superlatives
        from a snapshot frozen at **2026-08-13** — 18 days old at the time of writing. CLAUDE.md
        **11k** records that re-running that same snapshot **six days** later made two of its
        sentences false (*"5 rate Constructive or better"* → four; Tesla *"still comes sixth"* →
        seventh). Nothing errors, nothing looks stale: the sentences stay fluent, specific and
        wrong. Launching on an 18-day-old claim is the single most likely way this site ships a
        confident lie.
      · The five long articles' frozen figures, against their verification workbook.
      · **Proofread.** 12 Learn articles, 5 long articles, the landing, the legal pages and the
        UI strings. The owner found a missing space that every test agreed was present (11ac) —
        prose defects are found by reading, and by nothing else.
      · **Every link, internal and external.** Cheap to check, embarrassing on launch day.
- [ ] **P6 · Not-the-screen.** The downloadable report (a separate esbuild build — it shipped
      blank for four days once, 11d) · every transactional email, rendered · metadata + share
      cards · robots/sitemap/canonicals · security headers **in production, not preview**.
- [ ] **P7 · The three gates that never run automatically.** ⚠️ **ADDED on review.**
      `check:page-weight`, `check:csp` and `lighthouse` each need a production server on
      `:3200`, so `pnpm gates` prints them as NOT RUN — every single time. **A gate nobody runs
      is a gate nobody runs** (F-016, the reason `pnpm gates` exists at all). This is the sweep
      that runs them.
- [ ] **P8 · 375px.** Public = fix. Signed-in = note only.

---

## ⚠️ What this sweep CANNOT check — stated before it starts, not after

Added on review. **A sweep that does not name its blind spots reports the same thing as a
complete one** (14g), and a "clean" verdict is worth nothing until you know what it covered.

| Cannot check | Why | What is done instead |
|---|---|---|
| Some billing states on production | `past_due`, `unpaid`, `paused`, `incomplete` cannot be induced on a live Stripe account without a real failed payment | Drive them on **Stripe test clocks** in the sandbox, and say which surface was checked where. The four thin states are also F-005, already the owner's to rule on |
| The paid analysis, locally | `/api/cycle` is a Python function `next start` does not serve — locally the whole cycle block renders nothing **for everyone** | Deployed preview only (11v) |
| Live-mode Stripe price edits | CI holds only the restricted test key; test and live are separate objects sharing a `lookup_key` | Read the live prices by hand via MCP, as on 2026-08-31 |
| Real-user performance | Decision #33's target has no trustworthy instrument — three consecutive preview runs gave 370 / 540 / 990 ms of blocking time, and no external lab tool can reach a page behind sign-in (F-021) | Report byte counts, which are exact, and leave the row honestly red |
| Anything but Chromium | The suite runs Chromium only | Spot-check the public pages in a second engine and **say it is a spot check**, not coverage |
| Whether a person understands it | Comprehension is not a measurable property | That is Layer 5b, the owner's pass — and it is the reason 5b exists |

---

## Launch readiness — NOT sweep items, but they belong on this page

⚠️ **Added on review.** These are not "is the page correct?" questions, so no pass above would
ever surface them — and each is the kind of thing that is only noticed once it is needed.

- **If the site breaks on launch day, how does the owner find out?** Cron failures reach GitHub's
  failed-workflow email. **Nothing watches the web app.** Sentry is a Phase 2 decision and is not
  installed. A 500 on the ticker page would be discovered by a customer, not by us.
- **Is the data current on the day?** Both crons must have run successfully the night before, and
  the market-cap invariant must be clean. Worth a one-command check on the morning.
- **What is the rollback?** Vercel keeps prior deployments and can promote one; that path has
  never been exercised. Knowing it works is cheaper than discovering it does not.
- **Vercel Hobby → Pro**, deferred by the owner, still the one thing between the product and
  taking money.

---

## Findings ledger

*Nothing recorded yet — the sweep has not started. Findings are numbered `5A-nnn` and each
carries: what was measured, what it should be, and whether it is mine to fix or the owner's
to rule on.*

| # | Pass | Severity | Where | Finding | Status |
|---|---|---|---|---|---|
| — | — | — | — | *(none yet)* | — |

---

## Session log

| Session | Date | Passes covered | Findings |
|---|---|---|---|
| 1 | 2026-08-31 | Setup + tooling. F-001 fixed and guarded; F-002/F-004/F-007 records closed; merge-day items done. **The local `pnpm gates` was found to be genuinely broken and was fixed** (below). Sweep passes P1-P6 not yet started | 2 tooling defects, both fixed |

### Session 1 - why the sweep did not start

The owner asked for the gates to be made to work properly before the sweep began, and they were
right to: **a run had failed and could not be diagnosed.** Two separate defects, both now closed
and both recorded in `coding-standards.md` (SS 40b and 43).

**(a) A failing gate destroyed its own evidence.** The output had been piped through `tail`, which
returned *tail's* exit status (so a FAILED run reported success) **and** discarded the part naming
the failing test, keeping only dev-server noise. By the time anyone looked, two later runs and CI
were green and there was nothing left to reproduce. `gates.mjs` now always writes the failing
gate's full output to a file, prints that path on the verdict line, shows the tail of **stdout**
(where every runner here puts its summary) rather than stderr, and warns against piping.

**(b) The actual cause: a corrupt file that Next generates.**
`.next-dev/dev/types/routes.d.ts` had the same interface block written into it **twice** - two
`next dev` servers interleaving writes, which happens because the e2e gate starts a fresh server
every run and on Windows the previous one may still be exiting. `typecheck` reads it because
`next-env.d.ts` **imports** it, and an import bypasses `tsconfig`'s `exclude`. CI never sees this;
a fresh checkout has no `.next-dev`. `gates.mjs` now recognises the case and prints the one-line
fix, and stays silent on genuine source errors - proven both ways.

⚠️ **Neither defect was in the product.** Both were in the instrument used to check the product,
which is why they had to be fixed before a six-pass sweep leaned on it. **A sweep is only as
honest as the tool that reports it** (14g).
