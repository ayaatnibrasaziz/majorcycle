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

**10 · EVERY PAGE IS SEEN ON THREE SURFACES, AND THE LIVE SITE IS ONE OF THEM.** ⚠️ Owner
instruction, 2026-08-31: *"check in Claude browser, Vercel preview and the live website using
Claude in Chrome and ensure you are 100% happy with each and every page — accuracy, correctness,
visually correct, aesthetically pleasing. Basically launch ready."*

| Surface | Driven with | What only IT can show |
|---|---|---|
| **Local production build** (`:3200`) | Claude browser | The fast loop. Lets a fix be tried and re-measured in seconds. **Cannot serve `/api/cycle`**, so the paid analysis is invisible here (11v) |
| **Vercel preview** | Claude browser (via a share link) | The Python function runs, so the paid analysis exists. Real edge, real headers, real CSP. **The first surface where a Stock Detail page is a whole page** |
| **The LIVE site** | **Claude in Chrome** | Production data, production env vars, the real domain, the real cache, a real signed-in session in a real browser profile. **The only surface a customer will ever see** |

⚠️ **Why all three and not just the last.** They disagree, and each disagreement is a finding:
a defect on preview but not live means the branch is about to break something; live but not
preview means an environment variable or a cache, not the code. The three of them together are
what makes a difference *diagnosable* rather than merely visible. And the local loop is what
makes fixing cheap — without it every iteration costs a deploy.

⚠️ **"Aesthetically pleasing" is a judgement, and I will not pretend it is a measurement.**
Alignment, spacing, contrast, rhythm and overflow can be measured, and will be. Whether a page
*looks good* is the owner's call, which is what Layer 5b is for. My job in 5a is to make sure
nothing reaches 5b that is measurably wrong — and to say plainly which of my remarks are numbers
and which are opinions.

**11 · Fix nothing on a paid surface without a ruling** (11l). A real defect does not license
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

## The ten passes — P0 to P9

Each pass produces findings in the ledger below. Nothing on a paid surface is changed
without the owner ruling on it first (11l).

⚠️ **Every pass that looks at a page runs on all three surfaces — local `:3200`, the Vercel
preview, and the LIVE site in Claude in Chrome** (method note 10). A pass is not finished when
it is clean locally.

- [x] **P0 ✅ DONE 2026-08-31 — `docs/layer-g-5a-manifest.md`.** Built from the approved artifact (read in full) plus the route sources; every entry is checkable by anchor, testid or exact heading, and says which viewer states require each section. Surfaced two ✅ and two ⚠️ before a single page was opened — see the manifest's closing section. **Build the expected-content manifest, BEFORE looking at anything.** One line per
      route naming the sections that must be present. Method note 6 is not optional: a missing
      section renders perfectly, so "look at the page and see if anything is wrong" cannot find
      one. **This has to be written first or P1 is just browsing.**
- [x] **P1 ✅ DONE 2026-09-02 · Renders, in every state — and is COMPLIANT in each.** **14** viewer states × every
      route — ~77 checks, all run; findings 5A-017…5A-037. ⚠️ **The count was 9 in this line until 2026-09-02**, corrected by 5A-009 in the manifest and left
      stale here — the same rule stated in two places, one of which drifted (11c). Checked against the P0 manifest. ⚠️ **Non-negotiable #4 is checked here, not
      assumed:** every page showing a rating, score or signal must carry the disclaimer
      *visible without scrolling*. That is a legal requirement, it is per-STATE (a locked-out
      viewer sees a different page from a subscriber), and no existing guard asserts the
      "without scrolling" half.
- [x] **P2 ✅ DONE 2026-09-03 · Colour, measured.** All six items closed and each verified
      rather than assumed on the final re-read: the tier palette on **all four surfaces** (the
      app, the offline report’s separate esbuild artifact, the `.xlsx` fills, the public pages
      — enumerated in the closure section, since this line never named them); the 3-tier health
      ramp; the drawdown tint that ran green for a deeper fall (now uncoloured — owner: never
      colour a raw market number); direction-as-text (the ink layer, plus the fifth ink that
      was missing); the legacy-contrast subtree (**removed in August, and there is now a guard
      that fails if it returns** — an exemption bounded on both sides, 11t); and the delisting
      banner (8.06 on a card, 7.32 on the page). Findings 5A-041…5A-100.
- [~] **P3 · It works when used — STARTED 2026-09-03, not finished.** Every form, every control, keyboard-only, the screener end
      to end, sign-up → sign-out. Plus the **first-login disclaimer gate** (#23) on a genuinely
      new account — it is the one screen with a button that WRITES a compliance record, and it
      has already destroyed one (F-031).
- [ ] **P3b · THE COLOUR WALKTHROUGH — the owner’s pass, added 2026-09-03 at their request.**
      Every component rendered in every state it can take a colour in, side by side, for the
      owner to look at and sign off. ⚠️ **This slot did not exist**, and the omission is the
      shape this sweep keeps finding: P2 measures colour, P1 checks a page renders, and
      **nothing in the ten passes was the owner LOOKING at the palette in one sitting.** Every
      colour decision so far has reached them one screenshot at a time, in the middle of a
      change — which is how a repaint of a paid surface got past both of us once (11l).
      **Placed after P3, deliberately, and this is the whole reason for the position:** P3 is
      the last pass that can still MOVE a colour, because hover, focus, disabled, selected and
      pressed are all colours (P2 already changed one — the screener’s disabled primary sat at
      1.48:1). P4–P8 audit data, copy, weight and width; none of them repaints anything. So
      after P3 one sitting covers everything and nothing signed off gets re-opened; before P3
      it would have to be done twice.
      **Built as a local-only gallery** (`app/dev-fixtures/`, gitignored, reached with
      `DEV_BYPASS_AUTH`) rather than a tour of the live app, because the live app cannot show
      five rating tiers side by side and cannot easily reach `past_due`, a delisted ticker, or
      a stock with no analyst coverage.
      ⚠️ **The state list will be INCOMPLETE until P4 has run.** Enumerating cases from memory
      has under-counted before — the guided walkthrough found **7 reporting currencies, 4 of
      which had never been checked**, because the data was never asked how many cases exist.
      P4 asks the data. Anything it turns up is ADDED to the gallery, which is a top-up rather
      than a re-review.
- [x] **P4 · Data edge cases.** ✅ **COMPLETE 2026-09-05** — see the P4 section below. No cycle at horizon · cross-currency · a bank · no dividend ·
      no analyst coverage · no insider activity · retired ticker · unknown ticker/market/slug ·
      empty results · a brand-new account with no history. Plus a **sanity check on the
      analysis itself** for one stock per market: does the drawdown the page states match the
      chart it draws, and the price history behind it? Every guard we own checks that numbers
      are *present and consistent*; none checks that they are *right*.
- [x] **P5 · Content, claims and copy.** ✅ **NUMBERS + LINKS DONE 2026-09-05**; the human read-through is the owner's. See the P5 section below. ⚠️ **ADDED on review, and it is the gap I am least
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
- [x] **P6 · Not-the-screen.** ✅ **COMPLETE 2026-09-05** — see the P6 section below.
      **Nine findings, eight fixed, one an owner decision to leave.** The report (a server
      action was being compiled into the file customers download — 11d's exact chain, one
      link further) · all seven transactional emails, rendered for the first time (a welcome
      email sending new subscribers to an empty page; a run-on footer in every message; markup
      injectable into a message from our own domain; no length limit on the contact form) ·
      metadata + share cards (a publisher named on 17 pages that existed on none of them;
      `og:type: website` on every article) · sitemap dates its own comment claimed it already
      sent · production headers read on the wire. ⚠️ **Seven of the nine had no test of any
      kind**, and the two that did were covered by guards structurally unable to see them.
      ⚠️ The 13 **Supabase auth** templates are NOT in this repo and no connector can read
      them — owner-side check, and said so rather than implied (14g).
- [ ] **P7 · The three gates that never run automatically.** ⚠️ **ADDED on review.**
      `check:page-weight`, `check:csp` and `lighthouse` each need a production server on
      `:3200`, so `pnpm gates` prints them as NOT RUN — every single time. **A gate nobody runs
      is a gate nobody runs** (F-016, the reason `pnpm gates` exists at all). This is the sweep
      that runs them.
- [ ] **P8 · 375px.** Public = fix. Signed-in = note only.
- [ ] **P9 · The three platforms' own go-live checklists.** ⚠️ **ADDED 2026-08-31 after reading
      Stripe's, Supabase's and Vercel's current docs via their MCP servers.** Every pass above
      asks *"is our code right?"*. None asked *"is the ACCOUNT configured for production?"* —
      and the three vendors each publish a checklist of things that are invisible from inside
      the repo. Detail in the section below; **two are launch-affecting and one closes a
      finding the audit had recorded as blocked.**

---

## P9 · What the platforms' own checklists say — checked, 2026-08-31

Read from the live docs (Stripe *Go-live* + *Account* checklists, Supabase *Production
Checklist*, Vercel observability/rollback docs) rather than from memory. Items marked ✅ were
verified against the real accounts in this session; ⬜ are open; ⚠️ are the ones that matter.

### Stripe

| | Item | State |
|---|---|---|
| ✅ | Live webhook registered, one endpoint, `status: enabled`, correct `www` host | `we_1TzaT1K8OQZXQEmi…`, 13 events, livemode |
| ✅ | **API version pinned and aligned** | Endpoint `2026-06-24.dahlia` matches the SDK's `stripe-version`. Stripe's checklist opens with this because webhook payloads are shaped by the account version unless the endpoint sets one — ours sets one |
| ✅ | Keys rotated before go-live | Live `rk_live_` rolled 2026-08-02 |
| ✅ | Live prices exist and match the sticker | All six, both intervals, 2026-08-31 |
| ⚠️ | **Two-factor auth on the Stripe account** | The owner stated on 2026-08-31 it is **not set up**. Stripe's account checklist puts this first, and it guards live keys, payouts and customer data |
| ✅ | **Statement descriptor** | **Already set** — `WWW.MAJORCYCLE.COM` / `MAJORCYCLE`, support phone hidden from receipts. Done during business setup |
| ✅ | Email notifications for successful charges and disputes | "Successful payments" already on. Disputes are handled **in code** (`charge.dispute.*` → `billing_blocked` + cancel-on-lost), live-verified against a real chargeback |
| ✅ | Webhook handles **delayed**, **duplicate** and **out-of-order** delivery | All three, deliberately. Duplicates: the `stripe_events` idempotency ledger. Out-of-order: documented **order-safety guards** — failure/recovery act only on the sub currently on file, and `subscription.deleted` lapses only on a matching sub id, so a late event cannot dun, recover or cancel a newer subscription |
| ⬜ | Logs contain no card data or PII | Stripe's checklist asks for this explicitly; we have never audited our log lines for it |
| ⬜ | Restricted-business check | We publish financial *analysis*, not advice — almost certainly fine, and cheap to confirm rather than assume |

### Supabase

| | Item | State |
|---|---|---|
| ✅ | RLS enabled on every table | 13/13, verified |
| ✅ | Security Advisor | **INFO only** — the ten deny-all notices, each now carrying a comment saying it is deliberate (F-004) |
| ✅ | Performance Advisor | **INFO only** — unused indexes on low-traffic tables, and a connection-strategy note that matters only when scaling the instance |
| ✅ | **Custom SMTP for auth emails** | **Configured since Layer F0** — Supabase Custom SMTP → Resend, `noreply@majorcycle.com`, 13 branded templates, token-hash links on `majorcycle.com`. My "finding" was wrong; see the correction below |
| ⚠️ | MFA on the Supabase account | Same gap as Stripe. This account is the database |
| ⬜ | SSL enforcement · network restrictions | Both recommended, neither confirmed |
| ⬜ | Email confirmations on; OTP expiry ≤ 1 hour | Not confirmed |
| ⬜ | Free-plan projects can be **paused** for inactivity | Worth knowing before launch day, not after |

### ❌ THE CORRECTION: three of my six P9 findings were wrong, and the cause matters

**Withdrawn 2026-08-31**, after the owner said *"read what we have done previously before
suggesting these checks because I believe few of these are already done."* They were right.

| I claimed | The truth | Where it was already written |
|---|---|---|
| Auth emails use Supabase's default SMTP | **Custom SMTP → Resend since Layer F0**, `noreply@majorcycle.com`, 13 branded templates, token-hash links on our own domain | `architecture.md` §Auth branding; `design-system.md` §17; a Resend key literally named **`supabase-smtp`** |
| No statement descriptor | **`WWW.MAJORCYCLE.COM` / `MAJORCYCLE`**, phone hidden from receipts | `project_business_setup` memory |
| No dispute notification | Disputes handled **in code**, live-verified against a real chargeback | `architecture.md` §`/api/stripe/webhook` |
| Out-of-order webhooks untested | **Order-safety guards** designed in and documented | same line of `architecture.md` |

⚠️ **THE CAUSE, and it is the exact failure this whole sweep is built to avoid.** I checked for
SMTP by grepping the **repository**. Supabase Custom SMTP is configured in the Supabase
**dashboard** — there is no `config.toml` for a hosted project — so my search could not have
found it whether it existed or not. **A probe that cannot see the thing returned "not found", and
I reported that as "not done"** (14g). Method note 7 says a probe you just wrote has never been
observed failing; I wrote one and trusted it immediately.

⚠️ **And note WHERE it happened: in the pass I had just added specifically because "the vendors'
checklists ask questions the repo cannot answer about itself."** I wrote that sentence and then
answered one of those questions with a grep of the repo. The lesson is not "read the docs first"
— it is that **the search has to run where the answer lives**, and for account configuration that
is the vendor's own API or dashboard, never the codebase.

⚠️ **The habit that would have caught it costs 30 seconds:** this project keeps a written record
of everything it has built, and `architecture.md` had the answer in one line. **Grep the docs
before reporting an absence** — already recorded as CLAUDE.md 11h ("grep the audit docs before
re-deriving a diagnosis") and now demonstrated a second time.

**What survives of P9:** the four verified-good rows above, `5A-003` (2FA, downgraded to *confirm*
rather than asserted — the audit log shows the owner typing a 2FA code for Stripe, so something
exists), `5A-005` (the landing's 18-day-old figures) and `5A-006` (Speed Insights). **Two real
items out of six.** Recorded in full rather than quietly deleted, because a withdrawn finding is
evidence about the method, and this one says my method had a hole in it.

### Vercel

| | Item | State |
|---|---|---|
| ⬜ | Post-deploy verification | `vercel logs --environment production --level error --since 5m` after any production deploy |
| ⬜ | **Rollback path exercised once** | `vercel promote <deployment-url>` restores a previous deployment. Knowing it works is cheaper than discovering it does not |
| ⬜ | Firewall / bot protection reviewed | Available on the platform; never looked at |
| 🟢 | **Speed Insights answers F-021** | See below |

### 🟢 Vercel Speed Insights is the missing instrument for decision #33

The audit recorded F-021 as **blocked, not unfinished**: the ticker page's Lighthouse target had
no trustworthy measurement — three consecutive preview runs gave 370 / 540 / 990 ms of blocking
time, and no external lab tool can reach a page behind sign-in. The row was left red with
*"owner decision pending on real-user monitoring."*

**Vercel Speed Insights is exactly that**, and it is a platform feature rather than a new
dependency: real-user p75 LCP / INP / CLS, **grouped by route**, readable from the CLI. It solves
the two problems that made the local number worthless — it measures **real visitors on real
devices**, so a single unlucky run cannot dominate, and it reaches **signed-in pages**, which no
lab tool can.

⚠️ It reports on traffic, so it produces nothing until there are visitors. That is an argument for
turning it on **before** launch rather than after: this project's own history is that a number
nobody can measure gets optimised against anyway (11w).

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

## P3 · session 1 — the controls nothing drives

⚠️ **P3 IS NOT FINISHED.** What was done and what was not is named at the end. Recording a
partial pass as partial, because "P1 COMPLETE" was written here once when about half of it was
done (5A-028).

### The starting question, and the instrument for it

The suite has 716 tests at the time of writing (717 once this pass added its guard), so P3's value is not re-running them. The coverage map already named
its own blind spot: *"a test that visits a page and checks it returns 200 counts the same here
as one that drives a form."* So the pass opens by **enumerating every interactive control from
the source** and asking which are actually driven.

⚠️ **The first version of that inventory was worthless and said so loudly enough to catch.** It
asked *"does any spec mention this COMPONENT NAME?"* and reported `ProfileForm`, `SignupForm`
and `LoginForm` as undriven — all three are driven, through `#displayName` and `/signup`.
Playwright targets a control by **what the user sees**, never by what the file is called. v2
matches on the handles a component really exposes (ids, testids, aria-labels, placeholders,
names, button text) and **carries those three files as controls that must come out DRIVEN** or
the run aborts and prints that its numbers mean nothing.

**Result: 51 files carry an interactive control; 16 are driven by nothing.** Nineteen of the
undriven controls are the screener's entire input side — `HorizonSettings`, `BasketPicker`,
`CsvImport`, `TickerSearchAdd`, `SelectedTickers`, `RunAnalysis`.

⚠️ **And the reason is structural, not an oversight.** Every spec that visits `/run` — a11y,
contrast, auth, entitlement, recovery, landing, seo — uses the shared E2E account, **which has
no subscription**. `/run` correctly renders the upsell for it, so the screener's controls have
**never once rendered inside a test**. `run-history.spec.ts` is the single exception and it
creates its own entitled throwaway to get around exactly this.

### Findings

| | Finding | Status |
|---|---|---|
| **5A-101** | `HorizonSettings` sets `aria-invalid` and never points at the message saying what a valid value is. Its sibling `StockBrowser` does the same job and wires `aria-describedby` — **with a comment stating the rule** the other file never received (11c-iv), and a comment in another file is not a gate (11f) | ✅ **Fixed + guarded** |
| **5A-102** | **There is no `--status-danger` token.** P2 built `--status-warning` and stopped, so form validation, CSV upload errors, the onboarding gate's error line, both error pages and two screener fields all paint errors in **`--c-tier-5` — the Bearish rating colour**, in 8 places. This is 5A-050's exact shape (a billing warning went grey when the rating palette moved) still live for errors | **FIXED 2026-09-05, owner-approved.** `--status-danger` / `-ink` / `-tint` / `-tint-strong`, and **26 references migrated** across 20 files — the eight form error banners, both error pages, the CSV import's error tone, the onboarding gate's alert line, Delete account, the destructive button, the screener's two numeric fields and the remove / cancel controls. ⚠️ **Values identical to the rating's, so nothing moved on screen** — the defect was never the colour, it was that errors had no name of their own. Guarded by `e2e/status-danger.spec.ts` (no `role="alert"` element may name a rating token), **proven red by sabotage**, and needing **no exception list**: `DelistedNotice` is `role="note"` and keeps the rating tokens by the owner's F-035 ruling, falling outside the rule rather than being named in it. ⚠️ **The count was 26, not the 8 this row claimed** (11aj) |
| **5A-103** | *"Error sending confirmation email"* reaches the reader as raw Supabase English — it falls through `friendlyAuthError`'s passthrough. **CLAUDE.md 11g, third instance**, and found the same way as the first two: by actually hitting it. It offers no advice, and the account is *not* created, so "try again" is the correct thing to say and nothing says it | **Open** |

### Verified, with no defect found

- **Focus.** Every stop on `/signup` shows a real indicator. The two text inputs replace the
  outline with a brand-blue border plus a 3px ring: **4.03:1** against the field, **3.64:1** for
  the link/button ring on the page ground, both over the 3.0 floor.
- **The screener's custom horizon.** Every bound enforced, each with its own message, Run
  disabled in every case: pullback −30…−1, profit ≥1, lookback 21…5040.
- **The write-once acknowledgement**, driven as the app's own role **with a JWT claim set**,
  because F-034 records that without one the UPDATE matches zero rows and a missing trigger
  looks identical to a working one. Re-stamping an existing acknowledgement → **REFUSED
  [23514]**. **Control:** a first acknowledgement → **ALLOWED, 1 row**. Both directions, so
  F-031 is genuinely closed and no new customer is locked out.
- **Signup rolls back cleanly when the confirmation email fails** — no account is left in limbo.

### ⚠️ Three of my own readings were wrong, and measuring caught all three

Worth recording because each would have been a confident false finding:

1. **"No focus ring anywhere."** A scripted `el.focus()` does not put an element into
   `:focus-visible`, so every element reported `outline-style: none`. A real Tab key gives
   `focusVisible: true` and a 1.6px solid brand-bright ring. **Drive the keyboard with the
   keyboard.**
2. **"The focus border is a pale grey-blue and the ring is 0.29px."** Sampled mid-flight
   through a `transition-all duration-150`. Two seconds later it is `rgb(46,125,232)` and 3px.
   **A settled measurement, or none.**
3. **"18 duplicate POSTs on a paid endpoint from one click."** Real count, wrong conclusion:
   `/api/analyze` is a Vercel **Python** function that `next start` does not serve, so every
   request 404s, and 404-everything is the worst case of a deliberate resilience strategy —
   a pre-warm chunk, a worker pool, per-chunk retry and a **warm retry pass**. On a working
   deployment this is 1–2 requests. **An implausible number under an artificial condition is
   evidence about the environment** (11i).

I also nearly reported *"no error message when a value is invalid"* — there is one, "Min 21.",
which my regex missed by looking for the words *must be / invalid / at least / between*.

### P3 · session 2 — the Vercel preview, where the engine actually runs

Deployment `dpl_5Us2…` for `678272e`, READY, `lambdaRuntimeStats {"nodejs":3,"python":2}` — both
Python functions live, which is the whole reason this surface exists (method note 4).

⚠️ **Both the Supabase and Vercel connectors worked on the first call**, having been listed as
needing authorisation at session start. That is the third time a startup banner has been wrong
about a tool that simply works (11af). **Try it before building around it.**

**The screener, driven end to end for the first time by anything.** Magnificent Seven →
Medium-Term → Run: **one POST, status 200**, a "View Full Results" button, a run snapshot in
`sessionStorage`, and `/results` drawing 7 rows with real scores and correct labels — GOOGL 83
High Conviction, AAPL 62 Neutral, TSLA 58 Neutral.

⚠️ **That single request settles session 1's loudest reading.** Locally the same click produced
**18** POSTs. It was never a defect: `next start` does not serve the Python function, every
request 404s, and 404-everything is the worst case of a deliberate strategy — pre-warm chunk,
worker pool, per-chunk retry, warm retry pass. On a working deployment it is one. **An
implausible number under an artificial condition is evidence about the environment** (11i).

**The results controls, none of which any spec drives.** View modes change the table:
**Simple 9 columns → Analyst 23 → Full 38**. Search TSLA → 1 row. A row's tier badge filters
7 → 2 (the two Neutrals) **and syncs the tier `select`** — one state, two controls, agreeing.

**Stock Detail** (`/stocks/us/AAPL`) renders whole for the first time on a measurable surface:
Overall Rating, Verdict, Current Drawdown, Financial Health, 4 KPI cards, 21 charts, 19 cards.

**P2's colour work, confirmed where it could not previously be measured.** On the paid pages,
not on a fixture: score chips are white on `rgb(156,91,1)` = the new gold; the Neutral badge is
`#895001` ink on its own tint — both exactly what `check:tier-palette` check 7 predicted from
the stylesheet. And the KPI strip carries the owner's decision literally:

| KPI card | accent |
|---|---|
| Overall Rating 62 | `#9C5B01` — gold, our judgement |
| Health Score 83 | `#065F46` — green, our judgement |
| **Current Drawdown −5.6%** | **none at all** — a raw market number, uncoloured |
| Typical Drawdown −24.6% | `#4A5568` — a neutral reference |

**Sign-out** returns to `/login`, and `/results` afterwards re-gates rather than serving a
stale shell.

**No new defects found in this session.**

⚠️ **Console errors on the preview are Vercel's own and do not exist in production.** Every one
is `vercel.live/_next-live/feedback/feedback.js` refused by our CSP — the feedback widget
Vercel injects into previews only. Reading them the other way round is the useful part: the
policy is genuinely **enforcing**, the nonce is genuinely **per-request** (a different one in
every message), and the prerendered pages fall back to `'unsafe-inline'` exactly as designed.

⚠️ **Two more of my first readings were wrong, both the same mistake in different clothes.**
Clicking Simple / Analyst / Full in one tick and measuring in the same tick reported "23
columns, unchanged" — **a React click and a measurement in the same tick measure the previous
render**; with waits between them it is 9 / 23 / 38. And clicking a control captioned "Neutral"
filtered nothing, which looked like a broken filter and was me clicking the **Opportunity Map's
legend** (`opp-legend-item`) instead of a row badge. That is now six wrong first readings across
the two P3 sessions, every one caught by measuring again rather than by reporting.

**Still outstanding for P3:** `/account`'s four cards · `/request` · advanced filters and the
CSV import · the Stock Detail subnav and chart range buttons · the signed-in keyboard pass ·
and the whole pass on the **live site** in Claude in Chrome (method note 10).

### P3 · session 3 — `/account`, `/request`, Stock Detail, and the keyboard

| | Finding | Status |
|---|---|---|
| ~~**5A-104**~~ | ❌ **WITHDRAWN — my error, twice.** Reported as *"the ACTIVE sub-nav pill has an invisible focus ring"*: the pill carrying `aria-current="true"` measured `outline-color: rgb(255,255,255)` — white on a white sticky bar, ~1.0:1. **Both readings were taken at t≈0 of a 150 ms `transition-property: all`**, so what was measured was `currentColor` (the white label text) at the start of the animation. Sampled to settle it is `rgb(46,125,232)` from 151 ms, **4.03:1**, and plainly visible. See the retraction in *P3 · session 5* | **Withdrawn 2026-09-04** |
| **5A-105** | 🟡 Three range selectors on one page, two words for one idea: Price Chart and Relative Performance say **Max**, Smart Money says **All**. Defensible (events vs a price series) and probably accidental. Paid surface, so it is a copy decision rather than mine | **FIXED 2026-09-05** — owner: *"make it Max please to keep it consistent."* Label only; the internal key stays `all`, because it names a filter over events rather than a chart's time domain |
| **5A-106** | 🟡 **Carried to P4, not chased here.** `AMD.TO` is stored as *"Advanced Micro Devices, Inc."* in the **ca** market — its own 1,031-bar series at **CAD 82.64** against the US line's **USD 459.61**, so it is a real separately-priced security (the shape of a depositary receipt), not duplicated data. But a reader searching AMD meets two identical names 5.6× apart with nothing distinguishing them. ⚠️ **Ten name collisions exist and most are entirely legitimate** — real dual listings (News Corp, Amcor, Newmont, ResMed, Block, NexGen) and share classes (GOOG/GOOGL, FOX/FOXA). Only `AMD.TO` looks like a different KIND of instrument wearing the parent's name | **Open — P4** |

⚠️ **5A-104's "unresolved mechanism" WAS the finding, and that should have been the tell.** This paragraph used to say the cascade explanation was missing — the compiled stylesheet holds exactly one `outline-color` declaration, `var(--brand-bright)`, so the white was not coming from our CSS and Tailwind's preflight does not reset it — and then recommended giving the active state its own focus colour anyway. **A measurement no mechanism can explain is evidence against the measurement** (11i: an implausible mechanism is a reason to suspect the instrument, not a discovery). The value was mid-transition. Retracted 2026-09-04; the pill was correct all along.

### Verified, with no defect found

- **`/account`, all four cards.** Display name editable; email and country correctly **locked**
  (country because the subscription is active); password and referral forms present, the
  referral form carrying a `website` honeypot. The destructive and validating paths here are
  already covered by `account.spec.ts`, so they were not re-driven.
- **"Manage billing" refuses gracefully, in English.** The account's `subscription_status` is
  `active` with **no Stripe customer** (I set the status by SQL), and the button answers
  *"There's no billing to manage on your account yet."* in a `role="alert"` rather than erroring
  or sending the reader to a broken Stripe page. ⚠️ Worth noting as a *positive*: status-without-
  customer is exactly the shape a production data inconsistency would take, and it is handled.
- **`/request` search.** `QUB` → *QUBE HOLDINGS LIMITED · ASX · **Covered***; `QUBT` → *Quantum
  Computing Inc. · NASDAQ · **Request***. The recent-requests strip shows real statuses
  including *Not supported*. This is the path that was silently broken for a month (11z).
- **Chart range buttons** move the active state correctly (1Y → 3Y), alongside the 50D/200D
  moving-average toggles.
- **Focus rings** on every other stop measured: `:focus-visible` matches and the ring is
  `--brand-bright`, 2px at 2px offset.

### ⚠️ Two more instrument failures — nine across the three sessions

7. **"Keyboard focus is trapped on the signed-in pages."** Seven consecutive Tabs all reported
   the same element. `document.activeElement` was **`BODY` the whole time** — the synthetic Tab
   keys were never reaching the page, and what I was reading was `body.textContent` truncated,
   which happens to start with the brand lockup. Clicking into the page first fixed it and Tab
   advanced normally. **Had I reported this it would have been a serious false alarm.**
8. **The first "white ring" reading was of the wrong element.** Between measuring and
   re-measuring, the scroll-spy moved `aria-current` to a different pill, so a follow-up read
   showed a correct brand-blue ring and appeared to contradict the finding. Selecting the pill
   **by its active state** rather than by name reproduced it exactly. The finding survived; the
   first attempt to confirm it did not.

**Still outstanding for P3:** the advanced filters and CSV import on the screener · the
Opportunity Map's own controls · and the whole pass on the **live site** in Claude in Chrome
(method note 10).

### P3 · session 4 — the screener's own controls, read rather than clicked

Four defects, all in code that no test drives and no screenshot can see. **Every one is an
omission**, which is why P1 and P2 walked past them: the page renders, the control responds, and
the wrong outcome is a plausible outcome (11j).

| | Finding | Status |
|---|---|---|
| **5A-107** | 🔴 **A blank advanced-filter rule silently deletes rows.** `rulePasses()` tested the ROW's value for null *before* it tested whether the reader had typed anything, so a numeric rule with an empty box — which is what `+ Add filter` creates, and what exists for as long as it takes to pick a field — removed every stock with no value for that field. Half the field list is nullable (Health, Target, Upside%, P/E, PEG, ROE%, FCF Yld%, D/E…) and **the first row to vanish is always the cycle-only stock whose Financial Health we deliberately withheld**: a paid screen quietly dropped a company because *we* lack data on it, at a moment the reader had asked for nothing | ✅ **Fixed + guarded** |
| **5A-108** | 🔴 **The CSV import reports its outcome to nobody.** The preview strip is the import's ONLY feedback — file name, ticker count, duplicates removed, tickers outside our coverage, and all three hard failures (*"is not a .csv file"*, *"is empty"*, *"No tickers found in …"*) — and it rendered into a plain `<div>`. Drop the wrong file with a screen reader and you are told **nothing**, with no way to know the import did not happen | ✅ **Fixed + guarded** |
| **5A-109** | 🟡 **The Opportunity Map's legend toggles announced a contradiction.** `aria-pressed={!off}` (a state) sat beside `aria-label={off ? 'Show' : 'Hide'}` (an action), so a screen reader said *"Hide Bearish, toggle button, **pressed**"*. The ARIA practice for a toggle is explicit that the label must not change with the state | ✅ **Fixed** |
| **5A-110** | 🔴 **`/results`' Request button swallowed every failure.** `if (res.ok)` and an empty `catch {}`, under a comment reasoning that a non-OK answer "leaves the ticker as-is — its smart chip already conveys that it can't be requested". True of the 404 and of nothing else: the route answers 400, 404, 409, 500 and — **since the 11e fix of 2026-08-23** — *503 with `Retry-After`* on a transient read failure. A reader pressed Request, watched the button flip back, and was told nothing while nothing had been queued | ✅ **Fixed** |

⚠️ **5A-110 is 11e read from the other end, and that is the part worth keeping.** August's work
taught `/api/request-ticker` to distinguish *"I could not read"* from *"it is not there"*, because
collapsing the two had told a paying customer their real stock did not exist. The endpoint learned
the distinction; **one of its two callers never did.** `components/request/RequestTicker.tsx` —
same endpoint, same POST, written by the same hand — has always surfaced the server's own message.
So the fix landed at the layer it was diagnosed at and stopped there (11c-iv). **When you teach a
server to say two things, grep for everyone who listens.**

⚠️ **And 5A-107 was hidden by a comment that was RIGHT about two thirds of its subject.** The line
above the bug read *"no value yet = no constraint (matches between/categorical/text)"* — and
categorical and text really do behave that way, so the sentence reads as a description of all
three branches rather than an aspiration for one. Measured against the real function: a blank
`health ≥` kept **1 of 2** rows where a blank `sector is any of` kept **2 of 2**. **A stated parity
is a claim; two of the three arms happening to satisfy it is not evidence about the third.**

⚠️ **Why the default path hid it, which is why it survived every earlier pass.** `+ Add filter`
picks `sector` first (categorical, never null) and `Overall` second (numeric, always present), so
clicking the button five times removes nothing and looks perfect. The defect needs one more action
— *changing the field* — and changing a field is not stating a criterion, which is exactly the
reader's mental model and exactly what the code disagreed with.

### How these were found, and what it says about the instrument

Sessions 1–3 drove controls in a browser. This one **read the source and then drove the real
functions**, which turned out to be the right instrument for this class: all four defects are
things that do not happen — a message not announced, a failure not reported, a row removed for a
reason nobody stated. There is nothing on screen to photograph.

`advRulesPass` was driven directly by bundling the real module with esbuild and feeding it two
rows: one fully scored, one in the **withheld** state the product genuinely produces. That is the
same posture as `export-parity.spec.ts` — import the real function, never restate it — and it is
now a permanent guard rather than a one-off probe.

**The guards, and which half each covers:**

- **`e2e/screener-filters.spec.ts`** (new, pure, credential-free — 4 tests). Proven red on the
  unfixed code first: **2 failed, 2 passed**, and *which* two passed is itself the finding — the
  control and the default `+ Add filter` path, precisely the two cases that could never see the
  bug. ⚠️ **Its load-bearing assertion is the CONTROL, not the blank case.** A `rulePasses()` that
  returned `true` unconditionally sails through "a blank rule removes nothing" and destroys the
  feature; so the file also asserts that `P/E ≤ 999` **still** excludes a stock with no P/E, and
  that `health ≥ 90` still excludes the 83.
- **`e2e/form-errors.spec.ts`** gains a second test: an upload surface must announce its result.
  Broken on purpose — remove the live region and it names the file. It asserts the region
  **exists**; it cannot assert the region is always **mounted** (so that a change of contents is
  what gets announced, rather than the node arriving alongside its own text), which is the part
  only a real screen reader could confirm. Said out loud, because an unstated blind spot reads as
  coverage (14g).

⚠️ **A guard's scope is a claim about what it can see.** `form-errors.spec.ts` was written last
session around `aria-invalid`, and 5A-108 sat one directory away the whole time, completely outside
it: `CsvImport` sets no `aria-invalid`, so the guard was not silent about it by accident — it was
**structurally incapable** of an opinion. That is 14g again, and it is why the new test matches on
*being an upload surface* rather than on the attribute the last defect happened to use.

### Verified, with no defect found

- **The cluster picker** (a click on stacked bubbles) closes on **Escape, outside-click, scroll
  and resize**, with all four listeners torn down. This is the one control I expected to find
  wanting, and it is the best-built thing in the file.
- **`TickerSearchAdd`** implements the full combobox pattern — `role="combobox"`, `aria-expanded`,
  `aria-controls`, `aria-autocomplete`, a `role="listbox"` with `aria-activedescendant` and
  arrow-key navigation, and already-selected hits disabled.
- **CSV parsing**, read end to end: header detected case-insensitively, a headerless file treated
  as a single column, values upper-cased and trimmed, duplicates counted rather than dropped
  silently, and unknown tickers **added** rather than discarded so they can be requested after the
  run.
- **`filters.ts` sorting** de-ranks Financial-Health-incomplete rows on the Overall sort in both
  directions, and nulls sort last regardless of direction — both deliberate, both correct.

**Still outstanding for P3:** the whole pass on the **live site** in Claude in Chrome (method note
10). Every other P3 surface is now covered.

### What P3 still has to cover

The screener's **execution** cannot be judged locally at all — `/api/analyze` is not served by
`next start`, so the run, the results, and what a reader is told when a run fails all have to
be driven on the **Vercel preview** (method note 4). Also outstanding: `/results` and its
toolbar, advanced filters and Opportunity Map controls · `/account`'s four cards ·
`/request` · the Stock Detail subnav and chart range buttons · the keyboard pass on the
signed-in pages · sign-out · and the whole pass on the **live site** in Claude in Chrome
(method note 10).

⚠️ **Test data note.** This pass set a known password on the throwaway
`p2run2-…@example.com` and cleared, then re-set, the acknowledgement on
`p1-finish-…@example.com`, both by direct SQL — the documented approach for states not
reachable by ordinary use. Neither is the owner's account.

---

## P3 · session 5 — the LIVE site, free then entitled

**Surface: `www.majorcycle.com`, driven by hand in Claude in Chrome.** The first pass of this
audit against production. Ten findings, six fixed the same day, **two retractions of things
already in this ledger** — and the retractions are the more useful half.

⚠️ **Method, stated because it changes what the findings are worth.** The pass ran twice. First
on the owner's own account, which holds **no plan**, so every paid surface was an upsell panel
and the entire product went unchecked. The owner then asked for a subscription to be granted
directly, and the second pass covered the real screener, real results and a real report. The
grant was bounded and reversible — `subscription_status` / `subscription_plan` /
`subscription_currency` / `current_period_end` only, with **`stripe_customer_id` and
`stripe_subscription_id` left null so nothing reached Stripe and no money moved**. Every field
was read and recorded before the write and restored to its exact prior value afterwards,
verified by reading the row back. `acknowledged_disclaimer_at` — the June compliance record —
was never touched. **No card number was entered anywhere.**

⚠️ **I should have offered this in the first pass rather than working around NO PLAN.** The
owner had to ask. Recording that, because half a product measured and reported as a pass is the
14g failure with a person in the loop.

### RETRACTIONS — both were in the ledger, both were wrong

**5A-104 — "the active sub-nav pill has an invisible focus ring" — NOT A DEFECT.** The pill
carries `transition-property: all; transition-duration: .15s`, so `outline-color` **animates**
from its unfocused value — `currentColor`, the white label text — to `--brand-bright`. Sampled
over time after a real Tab: `rgb(255,255,255)` at 0 ms, `rgb(109,164,239)` at 74 ms,
**`rgb(46,125,232)` settled from 151 ms**. The settled ring measures **4.03:1** against the
sticky bar (floor 3.0) and is plainly visible in a screenshot.

⚠️ **Both readings that produced the finding were taken at t≈0**, and the second was mine, on
live, an hour before catching it. The entry sat open in this ledger and in the roadmap for two
sessions and **was reported to the owner as fact.** ⚠️ Session 1 had already written this trap
down as instrument failure #2 — *"a settled measurement, or none"*. Writing a lesson down did
not stop it recurring in the same audit, on a different property, four sessions later. The
durable form is not another sentence: **a probe reading a computed style must sample until the
value stops changing.**

**5A-113 — "no dialog sets `aria-modal`" — NOT A DEFECT.** Radix omits it deliberately and marks
every sibling of the content `aria-hidden="true"` instead, which is the stronger of the two
mechanisms; verified on the live page, where the app root carries it while the dialog is open. I
came within one commit of "fixing" correct code. Said out loud in `dialog-focus.spec.ts` so
nobody does it later.

### New findings — six of them fixed 2026-09-04

| # | Finding |
|---|---|
| **5A-111** | 🟡 **A price CHANGE is printed to a fifth of a cent.** `StockHeader` passed the daily move through `fmtPrice`, which picks decimals from **the value's own magnitude**. Right for a penny stock's *price*, wrong for a *change*, whose precision belongs to the price it came from. On BHP **exactly one** of twenty money figures carried 3 decimals — `+A$0.522` — under `A$63.78`. Fires for any stock over $1 moving less than $1 in a day. ⚠️ `fmtPrice`'s own docblock says it exists *"so a group of related prices never mixes precision"*, and it produced that mixing: **a rule applied to the wrong subject.** Fixed with `fmtPriceDelta(delta, referencePrice, currency)`; guarded by `e2e/price-delta.spec.ts`, whose CONTROL is that a genuinely small-priced stock still gets its extra places — without it a hard-coded 2dp would pass and destroy what `fmtPrice` was built for |
| **5A-112** | 🔴 **No dialog returns focus to what opened it.** Escape or "Not now" both leave `document.activeElement` as `BODY` (measured at a 1.5 s settle, so not a transition artefact). Radix restores to `context.triggerRef.current`, set by `<DialogTrigger>` — and **not one of the eight consumers uses one**; they all drive it with external `open`/`onOpenChange` state. So the ref is null everywhere and there is nothing to focus. A keyboard user is dropped at the top of the document, on the **paywall-conversion surface**. `grep` for `previousFocus`/`restoreFocus`/`returnFocus` across `components/`: **zero hits**. One fix in `ui/dialog.tsx`, eight surfaces |
| **5A-113** | ❌ **WITHDRAWN — my error.** See the retraction above |
| **5A-114** | 🔴 **The signed-in app had no headings at all.** `querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')` returned **0** on Stock Detail, Browse and `/run`. Every visible heading is a `div` styled bold, so a screen-reader user gets no heading list and the flagship page is one flat run of text. ⚠️ **Why no guard saw it:** `app-a11y.spec.ts` runs axe with `TAGS = ['wcag2a','wcag2aa','wcag21a','wcag21aa']`, and axe's heading rules — `page-has-heading-one`, `empty-heading`, `heading-order` — are tagged **`best-practice`**, not WCAG. The scan was green and had never had an opinion. **A guard's scope is a claim about what it can see** (14g), written in four strings nobody re-reads. Fixed at the shared `Header`, so every signed-in page gets one `h1`; the two pages that already had a correct `sr-only` one had it removed rather than duplicated. ⚠️ **The card titles were left as `div`s deliberately** — a real change to a paid surface, and the owner's call (11l). **They chose option B on 2026-09-04**: `sr-only` h2 per group + h3 per card, 1 → 26 headings, measured pixel-identical. See session 6 |
| **5A-115** | 🟡 **Two rendered sections shared `id="sec-cycle"`** (1610 px and 132 px tall, same column — not a hidden responsive twin). `TechnicalLevels` declared it from when it *was* the whole Cycle section; the page later wrapped it in `<section id="sec-cycle">` and nobody removed the inner one, so the id existed twice, nested inside itself, on every stock page. Duplicate ids are invalid HTML and `href="#sec-cycle"` can only ever reach the first |
| **5A-116** | 🔴 **Stock Detail scrolled SIDEWAYS from ~601 px to ~900 px**, breaking non-negotiable #3. Measured by actually scrolling: **263 px at 644, 135 px at 772, 0 at 921**. **772 px covers iPad portrait**, so this is a real device band. Cause pinned exactly: `.ownership-grid` computes `grid-template-columns: 200px 423.5px` in a **344 px** container — a grid item defaults to `min-width: auto`, so the `1fr` track takes the holders table's min-content width and refuses to shrink; `200 + 24 + 423.5` against 344 is the 263 px measured, to the pixel. ⚠️ **The fix already existed and was scoped too narrowly** — the three correct rules sat inside `@media (max-width: 600px)` under a comment naming this exact failure, while the layout needs ~900 px beside the 220 px sidebar. ⚠️ **The contrast with `.km-scroll` is the lesson**: Key Metrics solves this unconditionally at every width. One rule, two places, one of them conditional (11c). Shrink protection is now unconditional; the media query keeps only the genuine layout choice. Also confirmed **155 px at 752 px on the ENTITLED page** — the Ownership grid is free content, so it was never entitlement-dependent |
| **5A-117** | ⚪ **Observation, not a diagnosis.** At 644 px `html` computes `overflow-x: visible` and `body` computes `overflow-x: hidden`, and the page still scrolled to `scrollX = 263.2`. The overflow itself is 5A-116 and fixing that is the real answer — but a rule that is present, looks protective and demonstrably is not should not be left unexamined (14f) |
| **5A-118** | ✅ **CLOSED 2026-09-04 — owner approved the rewording.** *"potentially undervalued"* in two tooltips: `WeekRangeGauge.tsx:62` and the PEG column in `columns.ts:171`. Both are hedged and explain a metric rather than telling anyone what to do, and both sit **inside** `no-advice-copy.spec.ts`'s swept directories — the phrase simply is not on its banned list. Raised because #12/#24 make this the owner's judgement, not mine. Before/after presented 2026-09-04; **approved 2026-09-04; both tooltips reworded and the phrase is now the ninth pattern in the guard — see session 6.** ⚠️ Checked and clean: no tooltip or `title` text lives outside the two swept directories, so the guard has no scope gap here |
| **5A-119** | ✅ **CLOSED 2026-09-04.** The sidebar padlocks carry `aria-label="Requires a subscription"` on a bare `<svg>` with **no `role="img"`**. Chrome exposes it; an `aria-label` on a roleless element is not reliably announced across screen readers. ⚠️ Recorded as a **nuance rather than a confirmed break** — I have not driven a real screen reader, and saying which is which matters more than the finding. ⚠️ And as much a positive as a defect: the padlock IS labelled, the decorative icons beside it ARE `aria-hidden`, and the licence chip reads "No plan". Somebody thought about this surface |
| **5A-120** | 🟡 **Four card headers put their title and hint 0 px apart** at 752 px — Opportunity Map, Valuation History, Smart Money Activity, Stock Scorecard. `.card-header` was `flex; nowrap` with **no `gap`**. ⚠️ **I first reported this as "overlapping text" from a screenshot and that was wrong.** Measured, `xOverlap = 0` — the edges are the same x. They touch; they do not overlap. The difference matters: "overlap" points at a stacking bug, "0 px gap" points at a missing `gap` on one shared class. **A downscaled screenshot is not a measurement** (11o) |
| **5A-121** | ✅ **FIXED 2026-09-04, owner-raised.** The `h1` read **"Stock Detail" on all 863 tickers** — it named which KIND of page this is and never which one, so a screen reader's page title was identical across the whole product. The company's name was already on screen one line below, as a `div`. Now the h1, `inline`, visually byte-identical (`scrollHeight` 7700 unchanged). ⚠️ Fixing it exposed **two pages that already had their own h1** and were silently serving two — `NotInCoverage` (invisible to the guard: no unknown ticker is in `APP_PATHS`) and the downloaded report. **The mirror of 11c-iv** — a shared fix reaching a consumer that had already solved it locally |

⚠️ **Informational, so the next person measuring duplicate ids does not mistake them for ours:**
`tv-attr-logo` ×2 (Lightweight Charts, one per instance) and `id="a"` ×3 (Recharts `<clipPath>`).
Third-party, generated.

### Verified on production, no defect

**Free state.** The paywall holds **at the wire**: `POST /api/analyze` → **402** `no_subscription`,
`GET /stocks/au/BHP/report` → **402**, `GET /api/cycle` → **401**, every one carrying
`private, no-store`; `/api/portal` 303s to `/account?billing=none` without minting a Stripe
session for an account with no customer. **No premium field name appears in the page HTML** —
`overallRating`, `financialHealthScore`, `valuationScore`, `cyclePayoffScore`, `overallLabel`,
`qualityFactor`, `fhSubscores`, `valuationScoreRaw`: 0 occurrences each, plain **and**
backslash-escaped — ⚠️ with a **positive control**, since the free cycle fields
(`currentDrawdownPct`, `typicalDrawdown`, `lowerBound`) are each present, so the search was
demonstrably capable of finding cycle data in that document (11v). Browse filters reconcile
exactly (US 535 + AU 249 + CA 80 = **864** unfiltered). Search works by ticker and by company
name, and its no-match state names the term and offers Request a Ticker. The upgrade dialog
lists exactly the four `PREMIUM_UNLOCKS`. **Console completely clean** on a full stock-page load.
The sub-nav scroll-spy followed `aria-current` through all five links. Chart range and MA
controls all carry correct `aria-pressed`. **`/request` works end to end on production** — the
path that was silently dead for a month (11z). `/learn` and `/articles` are correct. **The
sideways-scroll band is Stock Detail only** — `/stocks`, `/results`, `/account`, `/articles` all
measured 0 at 772 px.

**Entitled state.** The screener runs end to end on the real site: a 7-ticker Magnificent Seven
basket at the medium horizon, **7 scored, runtime 22.3 s**, top pick GOOGL 83/100. `/results` is
**structurally sound at narrow widths** — a 2,538 px table inside `.results-table-wrap` at
`overflow-x: auto`, with a separate layout below the breakpoint and **0 px** of page-level
scroll at 752 px; this is the pattern the Ownership grid should have had. The downloadable
report is healthy **as an artifact** — captured in memory, 4.24 MB, valid doctype, every section
present, disclaimer ×6 — and it carries **14 `process.env` references**, the exact shape of the
bug that shipped a blank report for four days (11d), with the shim present. ⚠️ **What this did
NOT do is render it**, deliberately: 11d records an hour lost to a blob URL in an iframe
inheriting the site's CSP. The rendering half stays with `report-download.spec.ts` over
`file://`. Saying which half was measured (14g).

⚠️ **A live confirmation fell out of the grant for free:** `free_views_tickers` stayed at **2**
across a whole entitled session of stock-page views. A subscriber really is not counted against
the free cap, on production — which until now only a test had asserted.

⚠️ **The signed-out public header on `/learn` while signed in is DELIBERATE**, not a finding:
the public header is session-unaware by design so the public pages stay prerendered (11s). Noted
so the next pass does not re-report it.

### Instrument failures 10–13

10. **"Search is broken — 0 results for BHP."** My probe set `input.value` through the native
    setter and dispatched `input`. Real keystrokes returned the right row immediately. **A
    synthetic event is not a keystroke** — the same family as a scripted `.focus()` not being
    `:focus-visible` (session 1).
11. **The 5A-104 retraction** — reading a transitioning property at t=0.
12. **"The Opportunity Map header text is overlapping."** Read off a 0.6-scale screenshot.
    Measured: 0 px gap, no overlap. See 5A-120.
13. **"The report has no `process` shim."** My regex tested `var process` / `window.process` /
    `process = {`. The real shim is `globalThis.process=globalThis.process||{env:{}}`, which
    none of those match — so a **present** protection read as absent, on the one defect class
    this artifact is known to have. **A needle that does not match is indistinguishable from the
    thing not being there** (11v).

### The four guards, two proven red by sabotage first

| Spec | Proof |
|---|---|
| `app-responsive.spec.ts` | Sabotaged → *"/stocks/us/AAPL at 640px scrolled 223px"*, *"at 768px scrolled 95px"*. Restored → 4 passed. ⚠️ It asserts a real **scroll**, not `scrollWidth`: on the broken page `scrollWidth` was 907 against a 644 client width while an "which element overflows" probe returned **zero offenders**, because every offender sat inside a clip container |
| `dialog-focus.spec.ts` | Sabotaged → *"focus did not return to the opener after Escape"*. Its CONTROL asserts the dialog took focus **first**, or a dialog that never opened would "return" focus trivially and pass |
| `price-delta.spec.ts` | Pure and credential-free; imports the real formatters rather than restating them. CONTROL: a penny stock keeps its extra places |
| `app-a11y.spec.ts` | Extended with one `h1` per page across six routes — the class axe's tag list could not see |

### Session 6 — the three held items, closed 2026-09-04

**The owner ruled on all three of the items session 5 left with them, and the third turned into
a second pass at 5A-114.** No new surface was audited; this is the tail of P3.

**5A-118 · APPROVED, reworded.** Both *"potentially undervalued"* tooltips are gone. The
52-week gauge now describes the position and stops (*"near the left edge means it is trading
close to its 52-week low"*); the PEG hint says *"the price is low relative to the growth rate"*
rather than naming the price cheap. ⚠️ The phrase is now the **ninth** pattern in
`no-advice-copy.spec.ts`, and the entry records that it was an owner ruling and is deliberately
narrow — `/potentially\s+(under|over)\s?valued/i` — so the next reader does not widen it into
banning the word "valuation".

**5A-119 · FIXED, and my first sweep for it was blind to the instance the finding was written
from.** The padlock and the short-interest gauge both carry `role="img"` beside their label.
⚠️ The sweep matched literal `<svg` tags and reported *12 clean, 1 offender* — and the padlock
is `<Lock />`, a lucide component that renders an svg and forwards its props. **A probe scoped
to the syntax I happened to picture missed the case in front of me** (11am). The guard in
`form-errors.spec.ts` now reads each file's `lucide-react` import list as well, and says out
loud that it covers graphics only.

**5A-114 · SECOND PASS — the headings, option B, owner-approved.** Session 5 fixed the h1 and
deliberately left Stock Detail's card titles as `div`s, because giving a paid surface section
headings is the owner's call (11l). They chose **B**: one `sr-only` `h2` per sub-nav group and
an `h3` per card. 29 card titles across 21 components, five group headings, one shared
`lib/stockSections.ts` replacing **two identical unlinked copies** of the section list (11c).
Headings on the page: **1 → 26**.

⚠️ **Measured, not assumed, on two clean production builds with the cache cleared between the
arms** (11i: a stash does not swap what Turbopack has already compiled): 20 cards and 20 title
boxes compared, **zero** geometry or typography differences, `document.scrollHeight` **7700** in
both. The tag change is inert because `.card-title` sets its own size and weight and Tailwind's
preflight zeroes heading margins and makes `font-size` inherit.

⚠️ **The `space-y` trap that was NOT sprung, worth recording because it nearly was.** An
`sr-only` first child is absolutely positioned. Under Tailwind v3's `space-y` — `* + * {
margin-top }` — it would have taken no margin and pushed the next card down 18 px. **This
project compiles v4**, which emits `> :not(:last-child) { margin-block-end }`, so the invisible
heading takes the margin itself and nothing moves. The answer came from reading the compiled
CSS, not from knowing the utility.

⚠️ **And the sabotage refused to break, which produced a second guard.** Demoting
`SnowflakeRadar`'s title `h3 → h5` — a skipped level, exactly what the browser test claims to
catch — left it **passing**: the E2E account holds no subscription, so that card renders as a
lock and never appears. The same break in `CompanyOverview`, which does render, failed
correctly. **A guard's scope is a claim about what it can see** (14g), and the only reason this
one's limit is written down is that a deliberate break declined to break. So there are two:
`app-a11y.spec.ts` proves the TREE on the free render, and a source-reading test in
`form-errors.spec.ts` proves every card title in the directory is a heading whatever the
viewer's plan. Neither covers the other.

**5A-121 · the h1 said which KIND of page this is, on all 863 of them.** Raised by the owner
after reading session 5's fix: *"For the H1 to be Stock Detail every time for all tickers is a
bit weird."* The shared `Header` supplied it, so every ticker page announced the same six words
and a screen reader's page title was identical everywhere in the product. The company's name was
already on screen one line below, as a `div`.

Fixed with the strict constraint the owner set — **visually nothing changes.** The name line
becomes `<h1 className="inline">`; `Header` renders a plain `<div>` on any `/stocks/*` path via
an `ownsHeading` flag. Measured on the live page: `display: inline`, `14px`, weight `400`,
margin `0`, the same colour, the line still *"Apple Inc. · Technology"* at the same 21 px, and
`document.scrollHeight` **7700** — the identical figure from the option-B comparison above.
⚠️ The sector stays **outside** the heading: *"Apple Inc."* is the page's name, *"Apple Inc. ·
Technology"* is a name with a category stuck on it.

⚠️ **The fix at the shared layer had put an h1 on two pages that already had one** — the mirror
of 11c-iv, and neither was visible until the demotion forced the question. `NotInCoverage`
carries its own h1, so **an unknown ticker had been serving two**, in a state no test could see
because no unknown ticker is in `APP_PATHS`. And `ReportDocument` had been given an h1 that same
afternoon (*"MajorCycle"*), which became the second h1 in the downloaded file the moment the
page got a real one — so the masthead is a `div` again and the report is titled after the
company, which is what a report about Apple should be called anyway. **When you fix something at
a shared layer, grep for the surfaces that had already solved it locally.**

⚠️ One ordering consequence, in both the page and the report: the identity strip now comes
**before** the invisible group heading inside `sec-thesis`, because an `h1` may not follow an
`h2`. Only the `sr-only` node moved — the strip, the section boundary and the "Thesis" anchor
target are exactly where they were, so nothing on screen and nothing the sub-nav scrolls to
changed.

⚠️ **Proven red first.** Setting the heading back to a constant label failed with *"the h1 is
'Stock Detail' — it must name the company, not the route"*. The assertion matches `/Apple/i`
rather than merely "not empty", because a constant label satisfies a length check perfectly
(14g).

**Instrument failure 14 — and it was mine, twice in one session.** I reported the work complete
before the gates finished, and `pnpm typecheck` then failed on `TS1501`: the regex `s`/dotAll
flag in the new guard is above this project's TS target. **Playwright's transpiler accepted it
and the spec passed.** A spec passing is not the same as the repo compiling. Separately, ~80
tests failed and all 12 Learn slugs 404'd on a run where the build output was demonstrably
correct — the `.next-dev` cache, corrupted by two `git stash`/`pop` cycles (11i). Deleting it
(2,100 files, verified **gone** rather than merely emptied) restored 12 passed with no source or
assertion change.

**Gates after all of it: 16 of 16, e2e 713 s.** Suite **734 → 737** in 44 files, reconciled by
`--list` rather than by reading a summary line (11i).


## P4 · data edge cases — 2026-09-05

**The pass that asks whether the numbers are RIGHT, not merely present.** Every other guard we
own checks that a figure exists and is consistent with its neighbours. This one compared our
stored prices against the provider for **all 864 active tickers**, re-derived the cycle
analysis independently, and drove the sixteen data shapes the manifest names.

**Two real defects, one of them a wrong rating on a US mega-cap.** Also three retractions, and
the retractions are again the more useful half.

### 5A-122 🔴 · Monster Beverage rated **High Conviction** on data that was 2x wrong — FIXED

MNST split 2:1 on 2026-08-11. Measured against a fresh provider pull, **478 of our 501 stored
bars were exactly `2.000000x` too high**, from 2024-09-04 to 2026-08-07.

| | before | after the re-pull |
|---|---|---|
| current drawdown | **-55.73%** | **-12.38%** |
| valuation zone | DEEP VALUE | VALUE |
| overall | **High Conviction 88** | Constructive 73 |
| bars differing from the provider | 478 of 501 | **0** (median 0.0000%) |

A huge false fall reads as a huge cyclical opportunity, so our **top** rating label landed on a
company that had not fallen — and it would have surfaced at the top of any screener run.

⚠️ **The verifier was never the weak part**, which is the finding. Driven against our real
stored series `_verify_split_resolved` returns `(False, '2026-08-07', 1.9193)` on the first
try. It simply never saw that series: it runs **once**, on the frame the provider just handed
us, at detection time, and nothing compared its verdict with the rows that actually landed.
`split_events` said `resolved`, `cliff_date` NULL, and nobody looked again for three weeks.

⚠️ **I built the wrong fix first, and a deliberate break is what caught it.** I added sawtooth
detection to the verifier, then broke it on purpose — and **every test stayed green**, because
the existing logic already handles that shape (11i/11u: a break that fails to break is a
finding about your model, not a verdict on the test). Reverted. The real fix is
`_reverify_stored_splits`, which closes the loop between what we fetch and what we store.

⚠️ **And the obvious version of that fix would have CORRUPTED a healthy stock.** "Compare with
a fresh pull, re-pull on a mismatch", run on 2026-09-04, would have rewritten **APH**: it split
2:1 the day before, *our* series was the correct post-split one, and the *provider's* history
was mid-adjustment — 163.34 on 2026-08-03 against an 09-04 close of 83.06, NaN on the split
day. **The provider is not always the one that is right.** So the sweep asks our own data
whether it agrees with itself. Four tests, two proven red by sabotage; the load-bearing one is
the control that a healthy split is left alone.

### 5A-125 🔴 · AvalonBay printed **"+196.0% upside to target"** — WITHHELD

AVB split 2.793-for-1 on 2026-08-17. The provider re-based its price *history* and left its
*quote* alone, so on 2026-09-04 it was simultaneously reporting a price of **$184.06** with a
52-week high of **$185.62** and a target of **$201.71**, while serving a price series whose
last bar was **$68.14**. Every figure the page builds from both went wrong at once:
*"+196.0% upside to target"* and *"Near low · 63.3% off high"*, on a stock that was flat.

⚠️ **Not ours to correct, and the owner's rule decided the shape of the fix.** Set the same day
on the VMRK naming defect: where the provider is wrong we do not hand-patch, because the next
nightly write overwrites the patch — and once the provider fixes itself the patch stops being
overwritten and *our* wrong value lives forever. So `lib/quoteBasis.ts` **withholds** the
derived figures rather than inventing corrected ones, the same rule as the cross-currency
ratios. The cycle analysis is untouched: it reads the bars alone and is internally consistent.

Applied to the header's upside line, the 52-week gauge and `AnalystTargetTrack` — the last of
which surfaced only by grepping the consumers (11c-iv), and its `priceBars` prop is **required
rather than defaulted** so the next caller cannot reintroduce the defect in silence. Guarded by
`e2e/quote-basis.spec.ts`, broken two ways: too loose (2 red) and withhold-everything (3 red).

### 5A-124 🟡 · US prices a session behind — the cron moved, and it is a TEST not a fix

On 2026-09-04 the US+CA run stored Wednesday's bar for **all 80** Canadian tickers and for
`^GSPC`/`^IXIC`, and **not** for **529 of 535** US equities. Both markets were fetched in the
same interleaved window (US 00:23-00:55, CA 00:24-00:54), so it is not the run order; the
writer stores whatever the provider returns, so it is not ours.

⚠️ **The cost is larger than a stale price.** The ex-dividend bar arrives a day late too, so
the full-history re-adjustment it triggers is also a day late — five US stocks (HD, QCOM, BF-B,
BR, PFG) were measured carrying **0.54-0.85%** drift across their whole history for exactly
that reason. That is 11ae in miniature, recurring nightly.

Owner-approved: the run moved **22:30 → 01:30 UTC**. ⚠️ **Stated as an experiment, in the
workflow itself**: if the lag survives the move the timing theory is wrong, and the next step is
a targeted re-fetch of tickers behind their market — *not* pushing the time later again.

⚠️ **A one-line schedule edit was not a one-line change.** `lib/benchmarks.ts` keys the
benchmark cache to those exact times and its own comment warned that forgetting is silent
(11c-v). `e2e/benchmarks-cache.spec.ts` now **derives** its expected keys from that constant
instead of restating them, so the next move cannot leave the two quietly disagreeing.

### RETRACTIONS — three, all mine

**"The friendly 404 never renders" — NOT A DEFECT.** I measured `/stocks/us/ZZZZ` showing the
generic *"Page not found"* five times out of five and was about to fix it. On the **production
build** all three unknown-ticker URLs render *"Not in our coverage yet"* correctly. The dev
server resolves not-found boundaries differently and I measured the wrong one. ⚠️ The real
finding underneath: **no test asserts which 404 page renders**, the component's docblock claims
the e2e suite caught this once (no longer true — 11f), and the suite *structurally cannot* see
it because it runs on `next dev`.

**"BGA.AX and BGL.AX return nothing from the provider" — instrument blip.** Re-checked
immediately: both return 508 bars through 2026-09-04. A probe result confirmed once is not
evidence (11p).

**"APH's history is wrong" — it is the PROVIDER's that is wrong.** Our series is correct. See
5A-122 above; this is the case that reversed the design of the fix.

### Verified — the parts that came back clean

- **850 of 864** stored histories are byte-identical to a fresh provider pull (0.0000% median).
- **The analysis maths, re-derived independently.** AAPL **-5.6098**, BHP.AX **-7.4895**,
  SHOP.TO **-20.6006** — SQL over the raw stored bars against the Python engine, **exact to
  four decimals** in all three markets. ⚠️ My first probe disagreed (-4.36 for AAPL) because I
  guessed the definition instead of reading it: the peak is the highest **intraday high** over
  the window, not the highest close.
- **The chart agrees with the page.** `DrawdownOverlay.computeDrawdown` is a *second*
  implementation of the drawdown, in TypeScript (11c-iii). Re-implemented a third time and
  compared: AAPL -5.61, BHP.AX -7.49, SHOP.TO -20.6, MNST -12.38 — all matching the engine to
  the chart's own 2-decimal rounding.
- **Sixteen data shapes render, all 200, no console errors, no `NaN`/`undefined`/`null` on
  screen, currencies correct** (A$ / CA$ / NZ$): banks (CBA.AX, AIG — the `0.0` margin
  sentinel), cross-currency (A2M.AX in NZD), no dividend, no analyst target (ADD.AX), no
  analyst recommendation *at all* plus NULL sector (MQG.AX), no insider activity, 305-bar and
  390-bar histories, both retired tickers, TSX Venture (`AE.V`).
- **Cards collapse rather than render empty.** MQG.AX shows 17 of AAPL's 20 with the missing
  ones absent; AU stocks correctly swap Quarterly for Annual Financial Trends.
- **"Not available at this horizon" is correct.** GGP.AX (305 bars) returns a clean
  `insufficient_history` on Long and computes normally on Short and Medium.
- **A missing Financial Health score does not fabricate one.** MQG.AX has near-empty
  fundamentals; `financial_health_score` is `None` and the overall rating renormalises across
  the remaining two pillars — documented behaviour, not a defect.
- **`ta_highest`'s `min_periods=1`** (a young stock's early window is expanding, not blank) is
  deliberate and documented as C-R6. Checked rather than reported.
- **Ten bad URLs all refuse**, including the fourth market (`/stocks/index/^GSPC`), a
  fully-qualified ticker under the wrong market (5A-034), and a `.V` ticker without its suffix.
- **The three EMPTY states are three different sentences, and each is the right one.**
  `Results.tsx` branches on `rows.length === 0` and then on `ran = runMeta != null ||
  results.length > 0`: *"No analysis run yet"* (a new account), *"No stocks could be scored"*
  (a run where nothing produced a reading — the skipped list renders above it), and, when rows
  exist but the filters remove them all, *"No stocks match your filters"* with a **clear all
  filters** button. Traced rather than assumed: `setRunMeta(finalMeta)` fires unconditionally at
  the end of a run and is persisted into the session snapshot, so `ran` stays true across a
  reload even when the run yielded nothing — the case where the wrong sentence would appear.
  `clearFilters` resets the whole `FilterState`, so it clears the advanced rules and the tier
  filter too, not just the query. ⚠️ **Checked by reading and tracing, NOT by driving — and
  none of the three has a test.** Recorded as a gap rather than left to look like coverage
  (14g).
- **The staleness sweep works.** It names all 5 frozen tickers (EA, EQR, AVB, QUB.AX, CVW.AX)
  and correctly refuses to retire them — "STALE BUT ALIVE", three-source test.

### The follow-ups, all settled 2026-09-05

| # | |
|---|---|
| **5A-106** | ✅ **CLOSED — owner ruled no action.** `AMD.TO` and `AMD` share a name, but both rows already carry a US/CA badge and the currency differs, so they are distinguishable on screen. *"US and CA is showing that the currency is different. It is distinguishable."* ⚠️ My write-up had said the reader "can't tell them apart" — that was wrong, and the badge was there all along |
| **5A-126** | ✅ **FIXED.** The screener's **Target** and **Upside%** now use the same `quoteBasisAgrees` rule as the Stock Detail page, on screen **and in both exports** — a figure we will not show is not one we hand over in a spreadsheet. A results row carries no price bars, so `api/analyze.py` ships `week52_high` and `history_high` (our own highest high over 252 bars) and the **threshold stays in TypeScript**: shipping a verdict instead would put an algorithm in two languages, which is the drift 11c-iii records |
| **5A-127** | ✅ **FIXED — found by checking Smart Money Activity at the owner's request.** Two labels that stated more than the filings supported. See below |
| **VMRK** | ✅ **CLOSED — owner ruled no action.** Yahoo's `longName` for Vivmark Residential is *"AvalonBay Communities, Inc."*. *"If it is manually changed then when we repull it might change it again with the same issue. When yahoo fixes, it should automatically fix."* That reasoning is now rule 11as |

### 5A-127 🔴 · Smart Money Activity told 45 companies' readers the insiders were selling

The owner asked what was happening in this section. Two defects, both a label saying
something the arithmetic underneath it did not support, and neither visible by looking.

**(i) A bearish verdict from no evidence at all.** `insiderSentiment` ended in a bare
`return NET SELLER (Bearish)`, so a company whose filings contain no purchases and no sales —
only share awards, or transfers typed "Other" — fell through to it. Measured across the live
universe: **45 of the 820 stocks that have insider filings**, including **Bunge (BG)**, both
**Brookfield** lines (BN.TO, BAM.TO), **ALK.AX** and **CCL-B.TO** — each with **50 filings and
not one of them a Purchase or a Sale**. The page told the reader those insiders were selling.
Now it says nothing, and the timeline still shows every award and transfer.

**(ii) "NET BUYER" printed over a net seller.** The test was `buys > sells * 0.5`, so insiders
who sold $1.0m and bought $0.6m were labelled **NET BUYER (Bullish)** — false on the plain
meaning of the words. **24 of 820** sat in that band. ⚠️ The 0.5 may have been a deliberate
analytical view (insiders sell routinely to cover vesting and tax), but the fix cannot be to
keep a sentence that is not true. The comparison now matches the words. **If the tolerance was
intended, restore it with wording that describes it** — that is written into the function.

Extracted to `lib/insiderSentiment.ts` so it can be driven by a pure spec rather than through a
`'use client'` chart component. Guarded by `e2e/insider-sentiment.spec.ts`, **broken both ways**:
restoring the fall-through went 3 red, restoring the 0.5 went 2 red. Its load-bearing assertion
is the control — a real signal is still reported — because "return null when the filings are
silent" is satisfied perfectly by a function that returns null for all 820.

⚠️ **Checked and NOT a defect:** the section already skips the label entirely when a stock has
no filings at all (`txs.length > 0 ?`), so the 44 stocks with an empty array were never affected.
⚠️ **Noted, not changed:** `analystConsensus` breaks a tie toward BULLISH (`bull >= bear`), so an
even split of analysts reads bullish. Recorded for the owner rather than altered.

### Where the 5A-125 rule ended up — every surface, checked by grep

| Surface | |
|---|---|
| Stock Detail header | upside-to-target line + the 52-week gauge |
| `AnalystTargetTrack` | the whole card — every figure on it is a distance between the quote and the history |
| `ThesisInsights` | the *"mean target"* bullet only; the rest are built from the cycle and the statements, which are internally consistent |
| Screener | **Target**, **Upside%**, and the same two columns in the `.csv` and `.xlsx` |
| Offline report | inherits all three components, and its `AnalystTargetTrack`/`ThesisInsights` were caught by the required-prop type error |

**Measured blast radius: exactly 2 of 864 stocks** — `AVB` (ratio 2.610) and `NEC.AX` (1.423,
an adjustment rather than a split). Verified on real pages: both show no upside line, no 52-week
gauge and no analyst-target card, while **AAPL** keeps all three (*"Near high · 5.7% off high"*)
and **MNST** — repulled — keeps them too (*"Upper range · 12.4% off high"*, matching its
corrected −12.38% drawdown).


### Instrument failures 15-18

15. **The first probe hung for 11 minutes with nothing to show**, because its output was piped
    through `tail` — which buffers to the end, so the log was empty the whole time. The rule
    against piping `pnpm gates` applies to anything you need to watch. Rewritten to append each
    result and each step to a file as it goes.
16. **Stopping the probe did not stop its dev server.** Port 3100 stayed held by an orphan,
    which is precisely how a later run answers from stale code.
17. **The drawdown probe was wrong before the code was** — I guessed the peak was the highest
    close. Reading `calculate_cycle_metrics` gave the real definition and the two then agreed to
    four decimals. Derive the probe from the source, not from what the rule sounds like.
18. **A "404" is not one page.** My URL sweep asserted status codes and read the heading as an
    afterthought; the headings were being served by a different not-found boundary than
    production uses. A control expecting **200** on a good URL is what exposed that the whole
    run was untrustworthy — without it, ten green refusals looked like a clean sweep, and a
    system where *every* URL 404s produces exactly the same ten green refusals.


## P5 · content, claims and copy — 2026-09-05

**Every published number re-derived, every link followed, the prose swept mechanically.**
Four defects, three of them in things built to prevent exactly this.

### 5A-129 🔴 · An article contradicted itself about its own headline figure

Article 01 states its never-recovered rate three times — the bold sentence, the
three-market table, and the survivorship caveat at the end. Two said **12.4%**. The third
said **12.8%**.

12.4% is right: `assert_all.py` asserts it and an independent count of the frozen study
confirms it (156 of 1,260 falls). **12.8% is the value from before the 2026-08-30 dividend
re-derivation**, which moved 81 of the 464 asserted figures. That sentence was in no
assertion, so it never moved with them.

⚠️ **`consistency.py` exists for this exact rule** — its docstring cites 11c, *"a number
stated twice is a copy of that number"* — and it had only ever applied it **across** files.
A figure restated three times inside one article was invisible to it. Now guarded, and
**broken on purpose**: putting 12.8% back fails with *"the article states ['12.4', '12.8']
where every one should be 12.4%"*.

⚠️ **The first version of that guard passed the sabotage**, because the markdown wraps at
80 columns and *"worse than"* sat on a different line from the figure it introduces. A
regex over prose must not assume a sentence is one line.

### 5A-130 🟡 · "Browse all N companies" promised five more than Browse lists

The landing's headline count came from `stocks` where `market <> 'index'` — **including the
5 retired companies**, which Browse filters out (`.eq('is_active', true)`). So the page
said 869 and Browse listed 864. Fixed at source and regenerated: **864, matching Browse
exactly.**

⚠️ Both numbers were plausible and neither errored. The only way to see it is to count both
sides — which is what P5 is for.

### 5A-131 🔴 · A /learn guard was reading the frozen file, and passed for four days

`landing-snapshot.json` (frozen worked example) and `learn-snapshot.json` (nightly figures)
were split on 2026-09-01 precisely because they have different lifecycles — CLAUDE.md
**11ai**. They were written from one run and stayed **byte-identical**, so nothing could
tell which one anything read. `e2e/learn.spec.ts` was pointed at the frozen one, and its own
comment said it reached the page *"through `lib/landing.ts`"* — the wrong module for a Learn
page.

Regenerating the nightly file made them differ for the first time and it failed instantly:
**the page said 5.6%, the frozen file said 8.0%.** ⚠️ **Two files that agree cannot tell you
which one you read.** A guard aimed at the wrong one looks exactly like a guard aimed at the
right one until the day the data moves.

⚠️ `landing-copy.spec.ts` already had a guard for this — over a **hand-written list of two
source files**, which could not see a spec. It is now derived: every file whose path says
"learn" must not name the frozen snapshot, **with comments stripped**, because the first run
failed on the paragraph documenting the fix. That is the third time this repo has been caught
by a guard reading its own explanation.

### 5A-132 🟠 · Three of the seven article-verification scripts have never been able to run

`audit_external.py`, `audit_independent.py` and `divfreeze.py` all `import engine` — a module
that **is not in the repository and has no git history**. Whoever ran them had it in the
working directory; the results were written into the README and the runs cannot be
reproduced. Two of the three are the ones that check our figures against an **external**
source, which is the question that found a year of dividend drift (11ae).

⚠️ 11f, in the subject matter of a verification suite: **a record saying a check exists is
not the check.** Recorded rather than reconstructed — rebuilding a module from three callers'
usage is guesswork, and guesswork wearing the name of an independent audit is worse than an
obvious gap. **Owner's call.** The README now states which four run and which three do not.

### 5A-133 🔴 · The first-login compliance modal lost a space, on one bullet of four

`OnboardingModal` lists the four signals. Three render *"Cycle Position — where…"*.
The fourth rendered **"Valuation Score— how far today's price…"**, with no space.

The cause is CLAUDE.md **11ac**: SWC drops the **leading whitespace** of a JSX text node
that spans more than one line **and** contains an HTML entity. The Valuation bullet is the
only one of the four written with `&apos;`; its three siblings use literal em-dashes and no
entity, so they keep their space. Read out of the **built chunk**, not reasoned about:

```
Cycle Position"}),"        — where the current price…   space kept
Financial Health Score"}),"— a 5-pillar composite…      space kept
Valuation Score"}),"— how far today's price…            space GONE
```

⚠️ **The rendered guard for this defect could not reach it.** `e2e/lib/proseSpacing.ts`
asserts the outcome on the DOM — the stronger check — and walks `/learn` and `/articles`
only, because every other prose surface needs a session. So the whole signed-in product,
including the one screen a new customer must read and acknowledge, was outside it. **A
guard's scope is a claim about what it can see** (14g).

⚠️ **And it was found by a source sweep the pass had not planned.** P5's scope named "the
UI strings"; the rendered proofread covered the 25 public pages, so the signed-in strings
were swept from source instead — 121 files, 445 sentences, **2 flags, both false
positives**. Neither was this. The defect surfaced only when the entity in one of those
false positives prompted a second, targeted scan for the 11ac *shape*: **1 instance in the
whole app**, out of 85 multi-line text nodes after a closing tag.

**Fixed** with literal apostrophes and confirmed in a fresh build:
`Valuation Score"})," — how far today’s price has pu`. Guarded by
`e2e/jsx-entity-space.spec.ts`, which bans the shape across `components/` and `app/`,
**broken on purpose first** (restoring one `&apos;` fails it and names the file and line).
It carries two controls — the file walker must find files, and the detector must find the
shape somewhere — because a broken detector reports exactly what a clean codebase reports.
Comments are stripped, including the one in `OnboardingModal.tsx` pointing back at the
spec: the fourth time this repo has had to do that.

### Verified — what came back clean

- **464 article figures re-asserted: 0 failed.** `consistency.py`: ALL PASS.
- **The 8 claims `audit_coverage.py` reports as unasserted, re-derived by hand** against the
  frozen study. Every one holds: GPT Group fell **93.15%** and is **18.5%** below its 2007
  peak nineteen years later; Lendlease **−83.22%**; Nike **−50.33% / −76.72%**; Oracle
  **−55.55%**, Intuit **−50.09%**, Intel **−35.31%**; Nvidia **−3.51%**, Microsoft
  **−8.04%**, Apple **−8.62%**, Amazon **−10.77%**, Meta **−27.55%**, Tesla **−28.87%**,
  Broadcom **−24.82%**; Vistra up **162.0%** then **−36.13%**; and *"fourteen of the fifty
  largest more than 20% below"* measures **exactly 14**.
  ⚠️ My first pass disagreed on two of them because I compared against the highest **close**;
  the articles' second column is the highest **intraday high** since 2000. Read the
  definition out of `assert_all.py`, don't infer it from the column heading.
- **Every link on the public site: 31 distinct, all 200.** 12 Learn slugs, 5 articles, 8
  chrome routes, and the two `?next=` variants. ⚠️ **There are ZERO external links** — the
  only outbound URLs anywhere in public content are `accounts.google.com` and the Resend API
  endpoint, both infrastructure. Sourcing is handled by the owner's spot-check list rather
  than on the page, which is a decision worth being aware of rather than a defect.
- **A mechanical proofing sweep over the RENDERED prose of all 25 public pages** — double
  spaces, repeated words, missing spaces after punctuation, stray entities, unbalanced
  brackets, doubled punctuation. **No defects.** ⚠️ Its two hits were both instrument
  failures: *"864 companies.Which ones"* is an `<h1>` with a `<br/>` that `textContent` drops,
  and every "US spelling" flag was the word **licensed**, which is correct Australian usage.
- **Apostrophes are split by surface, and it is coherent**: the reading pages use curly
  (`&rsquo;` ×103, plus literals), the UI chrome uses straight (`&apos;` ×52). Measured and
  left alone — a house-style question, not a defect.
- **The signed-in UI strings, swept from SOURCE** — 121 files, 445 candidate sentences,
  checked for double spaces, repeated words, missing spaces after punctuation, doubled
  punctuation, stray entities and US spellings. **2 flags, both false positives** (a CSS
  `rootMargin` and a correctly-rendering `&amp;` in a JSX text node). ⚠️ **This is the
  weaker check and is recorded as such**: reading source cannot see a space the compiler
  drops, which is exactly the defect 5A-133 turned out to be. The signed-in product cannot
  be rendered without an entitled session, so the rendered sweep stops at the public pages.
- **The three legal constants** (25/day, 30-day deletion, 3-day grace) still match their
  code, via `legal-doc.spec.ts`.

### What P5 did NOT do — said plainly

**Nobody has read the 25 pages word by word.** The mechanical layer is clean and every number
is re-derived, but CLAUDE.md is explicit that prose defects are found by reading and by
nothing else — the owner found a missing space that every test agreed was present (11ac).
**That read-through is the owner's step, and this pass does not stand in for it.**


---

## P5 · the follow-ups the owner ruled on — 2026-09-05

### 5A-134 🟠 · The SUCCESS half of 5A-102 — ✅ FIXED the same day

Closing the danger half surfaced its mirror. **Six** of the same screens paint their
confirmation state — the *"Saved"* tick on `ProfileForm`, `PasswordForm`,
`UpdatePasswordForm`, `SignupForm`, `ContactForm` and `ReferAFriendCard` — in
`--c-tier-2`, the **Constructive** rating green. `CsvImport`'s tone map is the clearest
statement of it: `warn` moved to `--status-warning` in P2, `error` moved to
`--status-danger` today, and `ok` still reads `var(--c-tier-2)`.

Identical defect, one hue over: retune *Constructive* for a rating reason and every
"Saved" tick on the product moves with it.

**✅ FIXED 2026-09-05 — owner-approved once it was put to them as its own question.**
`--status-success` + `-ink` / `-tint` / `-tint-strong`, values identical to the rating’s,
nothing moved on screen. **Nine sites**, and two of them are the interesting ones:
`.upload-zone.upload-valid`, whose *warning* and *error* siblings were already on the
status palette, and the run’s **Scored** chip, sitting beside a **Skipped** chip that
moved in P2. **A migration that leaves one member of a pair behind makes the set less
legible, not more** (11c-iv) — neither was on the original list, and both were found by
asking what each migrated token sits next to.

**Deliberately NOT migrated:** the green ticks in `UpgradeDialog` and `SignupForm`’s plan
list. Those are marketing marks, not a report on something the reader just did.

⚠️ **Note how the finding arose: closing the first half is what made the second visible.**
Nothing in the audit had named it, and no guard could have — the two halves look identical
on screen and the wrong one is invisible while the values agree (5A-057).

⚠️ **The guard covers 5 of the 9 and says so.** `e2e/status-danger.spec.ts` matches
`role="alert"` and `role="status"`; three success sites are whole confirmation panels
carrying neither, and `CsvImport`’s is a TypeScript tone map. Widening it to *any* element
naming a rating token would flag the rating surfaces themselves, which is how a guard gets
loosened rather than obeyed (11t). Both halves proven red by sabotage.

### 5A-135 🟡 · A price change painted in a rating colour — ✅ FIXED 2026-09-05

`StockHeader` colours the daily price change `--c-tier-2` when up and `--c-tier-5` when
down. Those are **rating** tokens used as **direction** — exactly what `lib/ink.ts`
forbids in its own header (*"DIRECTION colours, not RATING colours… separate on
purpose"*), and `INK.up` / `INK.down` and `--c-down-ink` (5A-058) already exist for it.
Same family as 5A-079.

**✅ FIXED 2026-09-05, owner-approved.** `INK.up` / `INK.down`, the pair every other
direction figure on the page already used — EarningsHistory, DividendHistory,
BalanceSheet, QuarterlyFinancials, AnalystTargetTrack. The header was the consumer that
never received the rule (11c-iv). Measured before switching: up 5.31 → 5.90 on white,
down 9.51 → 6.68, both clear of the 4.5 floor.

⚠️ **Grepping the file found two more of the same class, three lines apart** — the
rule that one instance in a file means you sweep the file before leaving it (11c-x).
Upside-to-target also picked a rating token for its UP case (its DOWN case stays
`--analyst-downside`, a deliberate grey: a price above the analyst target is not bad
news, and repainting it was not mine to do — 11l). And the "data is fresh" pulse dot wore
`--c-tier-2` while its halo was a hand-typed rgba of the **pre-2026-08-22** green, a
colour the palette stopped using a fortnight ago; both now derive from
`--status-success`.

⚠️ Guarded by `e2e/direction-not-rating.spec.ts`, and the guard's shape is the point:
**a test against zero IS a direction question** — there is no reading of `x >= 0 ? a : b`
under which the answer is a five-tier verdict on a company — so the rule is derived from
the code's own shape rather than from a hand-written file list. It needs **no exception
list**, and that is load-bearing: the sweep found exactly two offenders and fixing both is
what kept an allow-list out of the file (11t).

⚠️ And a sixth instance of the oldest trap here: `check:tier-palette` scans source
**with comments**, so writing the old hex into the explanatory comment failed the build.
Reworded rather than teaching the guard to strip comments — a naive stripper would cut at
the `//` inside a URL and could hide a real literal after it on the same line.


---

## P6 · not-the-screen — 2026-09-05

The pass for everything a customer meets that nobody ever looks at: the downloadable
report, the transactional emails, the tags a crawler reads, robots/sitemap/canonicals,
and the security headers **in production** rather than on a preview.

⚠️ **Why this pass finds things every other pass cannot.** Every surface here is
invisible on a screen. An email is rendered inside somebody else's inbox; a share card is
assembled by somebody else's crawler; the report is a file that leaves the building. So a
defect in any of them errors nowhere, looks like nothing, and is discovered by a customer.
Nine were found. **Seven had zero test coverage of any kind**, and the two that did were
covered by a guard that could not see the defect (14g).

⚠️ **What could NOT be checked, stated rather than implied.** The 13 **Supabase auth**
templates — confirm signup, reset password, magic link, email change — are not in this
repo. I tried both connectors rather than assuming (11af): the Supabase connector **works**
and simply has no tool that reads auth email templates, and Resend's API log shows one
email ever sent from this account (a health check), because Supabase relays over SMTP and
that does not appear in the API's `/emails` listing. So they are an **owner-side check**:
trigger a real password reset to a real inbox and read what arrives.

### 5A-136 🔴 · The welcome email's plain-text half sent new subscribers to an empty page — ✅ FIXED

The trial-started email's HTML button says `/stocks`; its plain text said `/results`.
The comment directly above the button explains why it cannot be `/results` — *"Results is
empty until a screen has been run, so a brand new subscriber clicking Start exploring
would land on nothing (F3 Step 10)"*. **The fix reached one of the two copies.**

⚠️ **Every email in this codebase is written twice**, once as HTML and once as plain
text, by hand, and nothing compared them. That is CLAUDE.md 11c with the two copies inside
one function — close enough to read together and far enough apart to drift. The guard is
therefore MECHANICAL as well as named: `e2e/email-render.spec.ts` asserts that every
destination the HTML offers also appears in the text, in **one direction only**, because
text legitimately spells out URLs that HTML hangs on words. A two-way check would fail on
correct emails and be loosened within a week (11t).

⚠️ **I reported that nobody had met this, and I was wrong — corrected the same day.**
Resend's API log lists **one** email ever sent from this account, so I concluded the defect
was still theoretical. The owner's own inbox holds the trial-started, trial-ending,
payment-failed, payment-recovered and referral emails, **really delivered on 24 and 31
July**, `/results` and all. Resend's `/emails` endpoint simply does not return them.
**An instrument's silence is not the absence of the thing** (14g) — and the correction cost
one search of the mailbox those emails were addressed to. Two instruments were available,
and I believed the one that could not see.

### 5A-137 🟡 · Every transactional email's footer was a run-on sentence — ✅ FIXED

*"© MajorCycle provides educational information only — not financial advice."* A
copyright symbol glued onto a sentence that is not a copyright notice, with no year, in
all seven emails plus the contact notification. Now two sentences, and **the year is
computed** — a literal would be correct today and wrong on 1 January, silently, in a file
nobody opens in January.

⚠️ Found by rendering the emails and **reading** them, which had never been done. The
markup is valid and the email renders; there is nothing for a machine to object to.

### 5A-138 🟠 · A server action was compiled into the file customers download — ✅ FIXED

`ReportDocument` → `KpiStrip` → `PremiumLock` → `UpgradeDialog` → `SupportDialog` →
`ContactForm` → `app/(public)/contact/actions.ts`. That last file is `'use server'`, and
esbuild compiled all of it into `report.js`: the Resend endpoint, the from/to addresses,
and a live `process.env.RESEND_API_KEY` read, inside a 1 MB document any subscriber can
download and open.

⚠️ **Nothing was ever exposed.** esbuild left the read as a runtime lookup and the
`process` shim makes it `undefined`. **That is the finding, not the mitigation**: the
safety was somebody else's default, which is CLAUDE.md 11a for the sixth time. One
`define` entry — the obvious way to silence a `process.env` warning — bakes a live API
key into a public artifact.

⚠️ **And it is dead code.** `check-report-sections.mjs` says so in its own comment: the
report refuses an unentitled viewer before any data is built, so a lock can never render
inside one. The whole chain was weight and risk for no output. **This is 11d's exact
import chain, one link further along** — the same four components that once shipped a
blank report for four days.

**Fixed by class, not by exclusion**, the same argument as the `process` shim beside it:
an esbuild plugin turns any module whose first statement is `'use server'` into throwing
stubs, so the *next* server action to arrive three components away is neutered on the day
it arrives. `assertNoServerCode()` then re-reads the **emitted file** — the artifact,
never the source (11d) — and refuses to ship on any `process.env` read outside Next's own
internals. Proven both ways: removing the plugin fails naming all three variables, and the
control (the report's own components must still be present) fired *immediately*, because
my first two needles were in the HTML wrapper rather than in `report.js` and matched
nothing at all — the check would have been vacuous in both directions.

**Verified on the artifact, in three states**, since a stub that breaks the report would
look exactly like a stub that works: AAPL, **BHP.AX** (prices AUD, statements USD) and
**AVB** (the quote-basis withholding of 11as). All three mount from `file://`, throw
nothing, draw 190–214 chart elements, carry the disclaimer, and behave correctly — BHP
shows `A$` prices beside `$` statements *and* the reporting-currency note; AVB correctly
shows **no** 52-week gauge and **no** upside-to-target.

### 5A-139 🟡 · Every article named a publisher that did not exist on the page — ✅ FIXED

`articleJsonLd` gives `author` and `publisher` as `{"@id": ".../#organization"}`, and the
Organization node holding that id is emitted **only on the landing page**. JSON-LD `@id`
resolution is per-document, so on all 17 article and Learn pages both properties pointed
at nothing in the page's own graph.

Fixed with `articlePageJsonLd()` — a **function**, not a line added to each page, because
the two callers were written weeks apart and the second would have inherited whichever
version its author remembered (11c-iv). The guard asserts the general rule (**no reference
in a graph may name an id the graph does not define**) rather than "an Organization node
is present", so it catches the next one of the same shape.

### 5A-140 🟡 · Seventeen written pieces declared themselves generic web pages — ✅ FIXED

`og:type: website` on every Learn and Articles page, with no `article:published_time`.
That tag decides whether a URL is treated as a document with an author and a date or as a
page of a site, and **both dates already existed in the two registries**. Stated once in
`pageMetadata()` so a third section gets it free.

### 5A-141 🟡 · The sitemap had no dates, and its own comment said it did — ✅ FIXED

`sitemap.ts` has stated since G1 that *"when G4 adds articles they carry their real
publication dates"*. G4 shipped, seventeen pieces went live, and the field was never
added — every URL went out bare. **A correct sentence describing half-built work is the
11ae trap**: it converts an open question into a closed one, so anyone checking whether
dates were handled would read that line and stop.

The date is the registry's `reviewed`, and the guard fails in **both** directions: too few
is the defect that happened, too many is `new Date()` on every page — the cry-wolf sitemap
the field was originally omitted to avoid. Proven by sabotage at 8 and at 25 against 17.

### 5A-142 🟠 · The contact form could inject markup into an email from our own domain — ✅ FIXED

`renderBrandEmail` drops the preheader straight into a `<div>`. The contact action escaped
the **body** and passed the **preheader** raw, so a name of
`Ayaat</div><a href="…">Click here</a><div>` put an arbitrary link into a message
arriving from `support@majorcycle.com`.

⚠️ `referralEmails.ts` gets this right and **its comment even says so** — *"escaped,
for HTML body + preheader"*. The rule existed, was written down, and this caller never
received it (11c-iv). Guarded with a control proving the name is **escaped rather than
stripped**, since deleting it would satisfy every negative assertion.

### 5A-143 🟡 · The contact form had no length limit on either side — ✅ FIXED

No `maxLength` on any of the three fields, and no server-side cap either, so one POST
could carry an arbitrarily large name into an email subject. Its sibling `sendReferral`
has capped its name at 80 since F2. Now bounded on the server (80 / 254 / 4000) with the
client attributes as a courtesy, and control characters — **including interior newlines,
which `trim()` does not touch** — stripped from anything reaching a header.

⚠️ **Labelled as defence in depth, not as a demonstrated hole.** `name` reaches Resend
as a JSON string in a `subject` field and Resend encodes the header itself; I could not
produce an injection. Recording an unproven claim as a fix is worse than recording the
gap.

⚠️ **And the same fix went to the OTHER caller**, without being asked to. `sendReferral`
puts a user-supplied name into an email subject too, four files away, and `.trim()` does
not touch an interior newline there either. Fixing one of two callers that do the same
thing is the exact defect this repo keeps paying for (11c-iv) — it would have been
peculiar to write that sentence about the preheader and then leave its twin alone.

### 5A-144 🟡 · HTTPS enforcement is Vercel's default, not ours — ⏸ OWNER: LEAVE

`Strict-Transport-Security: max-age=63072000`, with **no `includeSubDomains`** and no
`preload`. `next.config.ts` sets four security headers and HSTS is not among them — the
header comes from Vercel. Same shape as 11a's "safe because of someone else's default".

**Owner decided 2026-09-05 to leave it.** Extending it is a one-way door: browsers cache
the directive for up to two years, so any future subdomain that is not HTTPS becomes
unreachable. There are no subdomains today, and the live site is fully covered. Revisit
when one is added — that is the moment, not before.

### 5A-145 🟢 · DMARC is strict on purpose — ✅ OWNER RULED, and security.txt closed with it

Found on the P6 **re-check** pass, by asking a question the first pass had not: *does mail
from this domain actually get delivered?* Read off DNS and off Resend's own record, live.

The good half, and it is genuinely good: the domain is **verified** in Resend, DKIM is
published on the apex (`resend._domainkey`), Resend's SPF sits on `send.majorcycle.com`
where the envelope sender lives, and `_dmarc` publishes **`p=reject`** — the strongest
policy there is.

⚠️ **The half worth a decision.** That record also sets `aspf=s` and `adkim=s` — *strict*
alignment on both. Resend's envelope-from is `send.majorcycle.com` and our From header is
`majorcycle.com`; under **strict** SPF alignment a subdomain does not match a parent, so
**SPF alignment fails on every email we send**. DMARC passes only because DKIM aligns
(`d=majorcycle.com`, exact). **That is one leg, not two.** Any hop that breaks a DKIM
signature — a forwarding rule, a mailing list, some corporate gateways — leaves nothing
aligned, and with `p=reject` the message is **rejected outright rather than junked**. On
this site that is a password reset or a payment-failure notice.

Relaxing to `aspf=r` would let the Resend subdomain align on SPF as well, giving a second
independent leg. It weakens nothing real: relaxed alignment admits only subdomains of the
domain you already control.

**Owner ruled 2026-09-05: keep it strict.** *"I want it to be very strict. If a user
doesn't get the reset email, they can simply email us."* That is the right trade for this
product — every message we send is one-to-one transactional mail, which is the kind least
likely to travel through a forwarder or a list, and the fallback is a support address that
demonstrably works.

⚠️ **Checked against Cloudflare's current documentation before confirming it, and the
honest finding is that the docs do not take a side.** Cloudflare's DMARC pages define the
mechanisms and say `aspf`/`adkim` are optional; they publish no recommendation on strict
versus relaxed. So there is no best practice being broken here, and saying "the docs say
we're fine" would have been an invention. What settles it is the measurement in 5A-148,
not a citation.

⚠️ Two owner-side checks that go with it, both cheap and both invisible from the repo:
`rua`/`ruf` report to **`security@majorcycle.com`**, and `/.well-known/security.txt`
publishes the same address — if Cloudflare Email Routing has no rule for it, we are
publishing a dead security contact **and** silently discarding every DMARC report. The
contact form's `support@majorcycle.com` is the same question with a customer on the other
end. DNS shows Cloudflare routing is in place; whether these two addresses have rules is
not visible from here.

⚠️ **`security.txt` — ✅ FIXED the same day, structurally rather than by bumping a date.**
It read `Expires: 2027-07-05`, and RFC 9116 makes the whole file *invalid* once that passes:
a researcher who finds a real hole reads it, concludes we no longer accept reports, and goes
elsewhere. Nothing looks wrong on the day it lapses. Date moved a year out **and**
`pnpm check:seo` now fails the build **90 days before** it expires — bounded on both sides,
because "set it to 2099" is the obvious way to silence the check while making the file
non-conforming (RFC 9116 §2.5.5 asks for under a year). Proven both ways: a near date fails
naming the days left, a far one fails naming the rule. A note in the file would have relied
on somebody re-reading it in nine months; **when a trap depends on a human remembering,
spend the minutes and make it mechanical** (11o).

### 5A-146 🔴 · The SAME `/results` defect was live in THREE Supabase auth templates — ✅ FIXED

Found on the second re-check pass, after the owner said to stop assuming the connectors
could not reach them. Both routes were tried (11af). The **Supabase MCP connector works**
and simply has no tool for email templates; **Resend's API log does not list SMTP-relayed
mail**; so the templates were read two ways that do work — the owner's own **inbox**, via
the Gmail connector, and the **dashboard itself** through the browser.

⚠️ **5A-136 has three more copies, and they are the worst-placed ones.** The trial
email's HTML button was moved off `/results` months ago because that page is empty until a
screen has been run; its plain-text half was fixed today. **Three Supabase templates still
send people there** — and none of them is a welcome note. All six Authentication templates
were opened and read:

| Template | `next=` | |
|---|---|---|
| **Confirm sign up** | `/results` | 🔴 the first screen a new account ever sees |
| **Magic link or OTP** | `/results` | 🔴 every passwordless sign-in |
| **Change email address** | `/results` | 🔴 |
| Reset password | `/account/update-password` | ✅ |
| Invite user | `/account/update-password` | ✅ |
| Reauthentication | a code, no link | ✅ |

The seven **Security** templates (password changed, email/phone changed, sign-in method
linked/removed, MFA added/removed) are notifications with no destination link, so only the
footer below applies to them.

⚠️ **Note what makes this the purest example of 11c in the whole audit.** One rule — *"a
new account must not land on an empty page"* — written in **five** places: an HTML button,
a plain-text line, and three rows of somebody else's database. Fixing two of them changed
nothing about the other three, and **no guard this repo can ever write will see them**,
because they are not in the repo. The only instrument that reaches them is a person opening
the dashboard — which is exactly what it took.

### 5A-147 🟡 · The run-on footer was in the Supabase templates too, in two variants — ✅ FIXED

5A-137 fixed `renderBrandEmail`, which covers the seven app emails. The 13 auth templates
carry their own copy of that footer, and they **disagree with each other**:

- Confirm sign up / Magic link / Reset password / Invite: `© MajorCycle provides
  educational information only — not financial advice.`
- Password changed: `© MajorCycle — Information only, not financial advice.`

Neither has a year, both glue `©` to a sentence that is not a copyright notice, and now
neither matches the app emails. **A customer receiving a password reset and a payment
receipt sees two different footers from the same company.**

**✅ BOTH APPLIED 2026-09-05, on the owner's explicit instruction** — *"Let's fix those
three Supabase templates now. Do it yourself using claude in chrome… Check for all templates
that we have set and fix all."* All **13** templates edited and saved in the live dashboard.

⚠️ **How, and why not by typing.** Retyping ~3.5 KB of HTML into a code editor thirteen
times is exactly how a typo lands in `{{ .TokenHash }}` and nobody can sign up. Instead each
template's Monaco model was read, transformed in place by **string replacement only**
(`next=/results` → `next=/stocks`, and the two footer variants → the canonical one), and
written back — with the before/after counts returned for every single template, so each
edit is a number rather than a screenshot. Every save was confirmed by the dashboard's own
*"Successfully updated email template"*.

⚠️ **And then verified from a tab that had never edited anything.** A save toast is the
dashboard telling me what it thinks it did; the control is a **fresh page load in a
read-only tab**, walking all 13 templates and counting. Result: **zero** `next=/results`
anywhere, exactly **one** canonical footer in each, and **zero** of either old variant.
That reads the server's stored copy rather than my session's in-memory model, which a
re-check in the editing tab would not have.

⚠️ **Two things the run itself taught.** The Security templates render **two** *Save
changes* buttons — a disabled one in the sticky header and the live one in the dirty-state
bar — and the first `find()` grabbed the disabled one, so `password-changed` reported the
edit applied and **not saved**. A routine that had assumed success would have left it
silently unsaved. And the dashboard **stops rendering after a burst of saves**: the page
loads blank and Monaco never appears, recovering after about a minute. Both are the reason
each template reports its own save state instead of the batch reporting one.

### 5A-148 🟢 · DMARC — measured on a real delivered message, and it PASSES

The owner asked whether the strict posture is right. Answered from their own mail rather
than from reasoning, by reading the authentication headers Google stamped on a real
`noreply@majorcycle.com` message (31 July):

```
dkim=pass  header.i=@majorcycle.com  header.s=resend
spf=pass   smtp.mailfrom=…@send.majorcycle.com
dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=majorcycle.com
```

So: **`p=reject` is live, and real mail passes it.** The mechanism is exactly as predicted
— DKIM is signed `d=majorcycle.com` on the apex and aligns strictly; SPF passes as a
*mechanism* but its domain is `send.majorcycle.com`, which under `aspf=s` does **not
align**. DMARC needs only one, and DKIM is doing all the work.

⚠️ **Owner decision, 2026-09-05: keep it strict.** Their reasoning, recorded because it is
the right kind: *"If a user doesn't get the reset email, they can simply email us."* The
residual risk is real but narrow — a hop that rewrites the body or strips the signature
(some forwarders, most mailing lists) leaves nothing aligned, and `p=reject` then bounces
rather than junks. We send only one-to-one transactional mail, which is the case least
likely to be forwarded through a list.

⚠️ And the check that turned out to matter more than the record: **`security@` and
`support@` both really deliver.** `security@` has been receiving Google's DMARC aggregate
reports since July, and `support@` receives the contact form. A `p=reject` policy reporting
to a dead address would have been the actual defect, and it is not one.

### 5A-149 🟢 · A production email carrying `http://localhost:3000` — and why it is NOT a defect

The same raw message contains `Go to your account: http://localhost:3000/account`, in a
real email in a real inbox. It was sent from the owner's **local machine** during F3
webhook testing, where `NEXT_PUBLIC_SITE_URL` is localhost by design; production's canonical
tags prove its origin is set correctly. **Recorded rather than "fixed" because chasing it
would have been chasing my own test rig** (11aj) — but noted, because an email is the one
surface where a wrong origin is invisible until a customer clicks it, and there is no guard
that could tell the two environments apart from inside a test.

⚠️ It did expose one real oddity, left alone deliberately: `brandEmail.ts` builds the
header icon from `SITE_ORIGIN` (always production) while `format.ts` builds links from
`NEXT_PUBLIC_SITE_URL`. So that email carried **two different origins**. In production they
coincide; and for an email the icon *should* be absolute-production, or an inbox would
render a broken image. Correct by accident is still correct — but now written down.

### 5A-150 🟢 · `reference/email-templates.html` is now the only record of thirteen live templates

The repository had a visual record of the **eight** emails the app sends — each one rendered
exactly as it arrives, from the real `renderBrandEmail()` chrome. It opened by saying the
Supabase auth emails *"are configured separately in Supabase and are not included here"*,
which was true and is exactly the gap this pass found.

Rebuilt 2026-09-05 to cover all **twenty-one**. The thirteen are shown the same way the
eight are — their real HTML, pulled out of the dashboard, with Supabase's own
`{{ .ConfirmationURL }}` / `{{ .Token }}` / `{{ .Email }}` filled in the way the existing
previews use sample data. Nothing is paraphrased.

⚠️ **Why this matters beyond tidiness.** Those thirteen templates exist in one place: a
form on somebody else's website. There is no file to diff, no build that touches them, and
no test that can read them. **This page is the only artefact in the project that records
what they say.** If it drifts, nothing anywhere will notice.

⚠️ **Three things it now states that it did not before**, each of which had hidden a real
defect: the **plain-text destination** of every email (the record showed only the HTML half,
which is precisely why the welcome email's broken text link was invisible on a page whose
job was to show it); which of the thirteen **actually reach a customer today** (six — there
is no phone sign-in, no two-factor and no invitation flow, so seven are configured and never
fire); and that the two halves use **different card widths** (480px for sign-in, 600px for
the app), which is deliberate and previously undocumented.

⚠️ **Written as a description, not a changelog** — owner's instruction: *"I don't need a
version control or anything. Just write down how it is set up and exactly how it will
render."* The history lives here; the record states what is.

### What P6 checked and found correct

Recorded because 11aj cuts both ways — an audit that lists only its findings implies
everything else was examined, and two of these were suspicions I had to measure away:

- **Apex → www is already a `308`.** That merge-day item is done.
- All five security headers **and the enforcing CSP** on every production page; every
  gated route answering `307` with `private, no-store`; robots.txt with its AI-crawler
  split intact; 25 sitemap URLs; canonicals, titles, descriptions, Open Graph and Twitter
  tags correct on every page sampled.
- **The share card is NOT stale.** I suspected it was — built 8 August, palette retuned
  22 August, and the build script says it draws "from the real design tokens". Measured:
  it uses brand navy and blue only, and decision #25 has not moved. No finding.
- **The brand subtitle matches.** *"Financial Terminal"* on the card is the same string
  `BrandLockup.tsx` renders. Also suspected, also fine.
- Every number in every email derives from its real constant — `TRIAL_PERIOD_DAYS`,
  `GRACE_DAYS`, `PRICE_TABLE`, `CURRENCY_SYMBOL` — asserted with off-by-one controls.
- **No secret value** in the report bundle, before or after the fix.
- **The downloaded report makes no network request — measured.** Opened from `file://`,
  each of the three reports issues **one** request: the document itself. Zero off-site.
  Fonts are inlined as data URIs and the charts draw locally, so the file has no reason
  to reach out, and a stray URL would be invisible to the reader and perfectly visible to
  whoever received the request — from a financial document, opened who-knows-where, years
  later. Now asserted in `report-download.spec.ts` rather than assumed.
  ⚠️ **Stated precisely: the PROPERTY is measured, the ASSERTION is not yet observed.**
  That spec signs in with real credentials and therefore runs only in CI, so the new lines
  have never been seen to pass or fail. A guard nobody has watched carries no information
  (11p) — this one is proven on its first CI run, not before.
- **CSV formula injection: measured, not present, and not the threat model.**
  `csvField` does correct RFC 4180 quoting and has no guard against a leading
  `=` `+` `@`, which Excel and Sheets evaluate as a formula. Across all **873**
  rows, **zero** names, tickers, sectors or industries begin with one. And the shape
  of the feature is wrong for the classic attack: a reader downloads the screen
  *they* ran, so there is no path for one person to place text in another's file.
  ⚠️ Left alone deliberately. The naive fix — prefix every field with an
  apostrophe — would break **every negative number** in the export, which is a real
  defect traded for a hypothetical one. Recorded so the next session does not
  re-derive it (11aj).
- **Mail is correctly authenticated.** The Resend domain is verified, DKIM is on the
  apex, and Resend's SPF sits on `send.majorcycle.com` where the envelope sender
  lives — the apex SPF pointing only at Cloudflare's inbound routing looked like a
  finding and is not, because SPF is evaluated against the envelope, not the From
  header. What IS worth a decision is the alignment mode: 5A-145.
- **The security.txt is valid** — RFC 9116, contact, canonical, `Expires` ten months
  out. Its renewal is the thing to watch, not its contents (5A-145).
- **Every one of the seven emails has a live caller.** An email nobody sends would be
  the same class of defect as one nobody reads; all seven are wired.

⚠️ **Two things I nearly reported were my own test's fault**, caught before writing:
*"update your details within the next `undefined` days"* (I omitted a required argument)
and a wrong deletion date (I used the wrong parameter name). And a third: my first price
assertion typed `CA$` from memory and went red on a **correct** email — the subscription
symbol is `C$`, from the same map `/pricing` renders. The assertion now imports the table
instead of restating it (11c-iii).

⚠️ One nit recorded and NOT changed: the product spells Canadian dollars `C$` for a
subscription and `CA$` for a stock price. Both are real conventions, they sit in different
domains (decision #13 separates them), and no screen shows both. Not worth a repaint.

## Findings ledger

*Findings are numbered `5A-nnn`. The first six come from **P9**, which was added on 2026-08-31
after reading the three platforms' current go-live checklists — before passes P0–P8 have run at
all. That ordering is itself worth noting: **the vendors' checklists ask questions the repo
cannot answer about itself**, and four of the six are account configuration that no amount of
code review would ever surface.*

| # | Pass | Severity | Where | Finding | Status |
|---|---|---|---|---|---|
| ~~5A-001~~ | P9 | ❌ **WITHDRAWN — my error** | Supabase auth | I reported auth emails as going through Supabase's default SMTP. **They do not.** Custom SMTP → Resend (`noreply@majorcycle.com`) was built in Layer F0, with 13 branded templates, and Resend holds an API key literally named `supabase-smtp`. See the correction below | Withdrawn 2026-08-31 |
| ~~5A-002~~ | P9 | ❌ **WITHDRAWN — my error** | Stripe account | Statement descriptor was set during business setup: **`WWW.MAJORCYCLE.COM`**, shortened **`MAJORCYCLE`**, with the support phone deliberately hidden from receipts | Withdrawn 2026-08-31 |
| **5A-003** | P9 | 🟡 **To confirm** | Stripe + Supabase | Two-factor auth. The owner said an *authenticator app* is not set up; `layer-f-audit.md` records them typing a 2FA code to change a live Stripe key, so **some** second factor exists on Stripe. **Confirm what is actually enabled where** rather than assert — my last three assertions here were wrong | Open — owner to check |
| ~~5A-004~~ | P9 | ❌ **WITHDRAWN — my error** | Stripe | Disputes are handled in CODE, which is stronger than an email: `charge.dispute.*` → `billing_blocked` + cancel-on-lost, live-verified in F3 S3 against a real chargeback. Stripe's "Successful payments" email is also already on | Withdrawn 2026-08-31 |
| **5A-005** | P0→P5 | 🟡 **To confirm** | `/` landing | **16 frozen claims**, all `asOf: 2026-08-13` (18 days old) — enumerated in the manifest: the 5-of-7 count, GOOGL as top pick, Tesla's rank and 34.1% fall, Apple's price / 9.1% / 24.7% / 81.4% / 609 falls / 630 recoveries, and "nothing in the Opportunity Zone". 11k records this same run going false in **six** days. ✅ Both snapshots share one `asOf` (the 11k two-dates trap held) and `universeCount` 866 matches the live DB exactly. **Not yet confirmed false — P5 re-derives all 16** | **Re-derived 2026-09-01 → see 5A-013/5A-014.** The Apple half self-corrected; the mag7 half is stale |
| **5A-013** | P5a | 🔴 **LIVE on the landing** | `/` landing | **The two snapshots have drifted 18 days apart, and Apple is in BOTH.** `landing-snapshot.json` is rebuilt and committed by the nightly cron (`asOf 2026-08-31`); `mag7-snapshot.json` is deliberately frozen and is in **no** workflow (`asOf 2026-08-13`). So the live page prints Apple at **−11.3%** in the ranked table and **"8.0% below its high"** three screens later — both correct for their own date, on one page, about one company. This is CLAUDE.md **11k** verbatim (*"two snapshots describing the same subject must carry the same date"*), and P0 recorded them as agreeing because on 31 Aug they did — **the cron moved one of them that night**. Verified on the wire at `www.majorcycle.com`, not from source | **FIXED 2026-09-01.** The two worked examples are now on ONE lifecycle — both frozen, regenerated by hand together. The cron rebuilds only the new `universe-count.json` (a fact, which must never be stale). ⚠️ **The guard already existed and could not fire:** `landing.spec.ts:266` has always asserted the two share an `asOf`, but the cron commits with `[skip ci]`, so CI never ran on the commit that broke it. Running CI nightly is the wrong trade (Actions minutes); **taking the snapshots out of the cron's reach is the right one — a guard cannot cover a write committed past it.** ⚠️ Timeline, corrected: the nightly rebuild step reached `main` only on 31 Aug and first executed on 1 Sep, so the drift was ~10 hours old, not 18 days (14g, in both directions) |
| **5A-014** | P5a | 🔴 **Blocks the 5A-013 fix** | `/` landing | **Regenerating the frozen snapshot is not a mechanical fix — it breaks the page's ARGUMENT, not just its numbers.** Re-derived on 2026-09-01: two tiers move (AAPL Constructive→Neutral, NVDA Neutral→Constructive) and, decisively, **the deepest faller changes from TSLA to META**. The "second question" paragraph is computed by `mag7Facts()`, so it would auto-substitute Meta and read *"Meta has fallen furthest — 27.4% — and still comes second… that's exactly the trap… the biggest discount belongs to the weakest business on it."* **Meta is the 2nd-best-rated company with Health 79.6.** The sentence stays fluent and becomes self-contradicting. ⚠️ **The new lesson, beyond 11k: computing a figure from data protects the FIGURE, not an argument built on a relationship BETWEEN figures.** The old data had one company that was both deepest faller and weakest business; nothing preserves that coincidence, and no guard can see its loss | **FIXED 2026-09-01, owner-approved copy.** Rewritten to state what the numbers now say — Meta and Tesla fell 27.4% and 26.2%, ranked second and seventh — which is a *stronger* illustration than the old coincidence: a controlled comparison instead of one example. ⚠️ **It also fixed a latent bug the old wording hid:** the sentence read *"{deepestFall} … ITS Financial Health is {weakest.healthScore}"*, which was only ever correct because those two rows were the same company; on the new data it would have printed Tesla's 49.8 under Meta's name. Guarded by `e2e/landing-copy.spec.ts`, which asserts the PREMISE (different companies, falls within 5pp, ≥3 places and ≥15 health points apart) with controls proving each assertion can fail |
| **5A-012** | P0 | 🟠 **Plan gap** | executability | **The plan could not have been executed by anyone else.** No URLs, no credentials, no commands, and every data edge case named in the abstract with no ticker attached. Now an **Execution guide**: the three surfaces and how to start each, named tickers for all seven edge cases, how to reach each of the 14 states (and the four that are unreachable by ordinary use), the command list, and what each connector can answer | **Fixed 2026-08-31** |
| **5A-011** | P0 | 🟡 **New edge case** | `/stocks/*` | **A fourth market exists: `market='index'`** (`^GSPC` `^AXJO` `^GSPTSE` `^IXIC`). Browse and peer medians exclude it explicitly; nothing in the plan checked that the URLs refuse. Also newly named: retired stocks are **absent from Browse but resolve at their URL** (both halves need checking), and `.V` tickers **keep their suffix** in the URL | **Closed 2026-09-05 — all three halves checked in P4.** `/stocks/index/^GSPC` refuses (one of ten bad URLs, all refusing); both retired tickers resolve at their URL and are absent from Browse, showing the DelistedNotice; `AE.V` renders at `/stocks/ca/AE.V` while `/stocks/ca/AE` 404s |
| **5A-010** | P0 | ✅ **Plan correction** | edge cases | **"A stock with no fundamentals" does not exist** — 0 rows of 871. Checking it would have produced a tick for a case that cannot occur. Removed | **Fixed 2026-08-31** |
| **5A-009** | P0 | ⚠️ **My error** | the manifest | **I recorded the CONTAINER and called it the contents — twice.** Viewer states listed as **9**; there are **14** (I omitted `unpaid`/`paused`/`incomplete`/`incomplete_expired` — which ARE finding F-005 — and `billing_blocked` entirely, while the Layer F audit's 14-state matrix was already in our docs). Stock Detail listed as **5 anchors**; those hold **23 analytical sections**, and deleting one leaves its anchor rendering perfectly. Both would have produced a green P1 over things never examined. Found by asking `check-report-sections.mjs` and `lib/entitlement.ts`, not by re-reading the manifest | **Fixed 2026-08-31** |
| **5A-008** | P0 | ⚠️ **My error** | the manifest | **P0's first version used the approved artifact for ONE page and the source code for the other twelve.** The artifact is a deck of **eight** approved pages with a shared chrome; I extracted only its rendered text, having stripped the `<script>`/`<style>` blocks — where the design system lives — and reported it "read in full". Deriving pages from code answers *what it does*, never *what was approved* (11j). Manifest revised: shared chrome added, approved copy added for all seven other deck pages | **Fixed 2026-08-31** |
| **5A-007** | P0 | 🟡 **Method note** | `/` landing | The approved artifact states **7 Aug 2026**; the shipped snapshot states **13 Aug 2026**. Different runs. I nearly adopted the artifact's figures as the expected values — which would have marked the page wrong against a spec never shipped, and hidden the real staleness behind a fake one. **Copy the artifact's layout and wording; re-derive its numbers** | Recorded |
| **5A-015** | P5a | 🟠 **Plan gap** | executability | **The execution guide's own start command was wrong.** It said `cd web && pnpm start:fresh` for the `:3200` surface; that script is `pnpm build && next start` with **no port**, so it starts on `:3000` — the one port every measuring script refuses by design (11o). Found by running it. Corrected in the manifest to `pnpm start:fresh --port 3200`, with the reason stated so it is not silently "tidied" back | **Fixed 2026-09-01** |
| **5A-016** | P5a | 🟡 **Owner ruling** | `/learn` | Freezing `landing-snapshot.json` would also have frozen the Learn articles' Apple figures, because `learn/content.tsx` and `DrawdownFigures.tsx` read the same file. **The owner ruled otherwise: *"keep the learn articles as is. Do not drift from what it was before. Keep it separate."*** So the figures were split into a third file, `learn-snapshot.json`, rebuilt nightly by the same cron and written from the SAME computation as the frozen one — they cannot disagree when both are written, and diverge only as the frozen one ages. ⚠️ **The residual is stated, not hidden:** a reader moving from the landing to a Learn article can meet two different Apple drawdowns. Both carry their date, and they are on **different pages** — which is what makes it acceptable where the same thing three screens apart on ONE page was not | **Applied 2026-09-01** |
| **5A-017** | P1 | 🟡 **Manifest gap** | shared chrome | The manifest lists the footer as **7** links (*How it works · Learn · Pricing · Contact · Disclaimer · Terms · Privacy*); the live footer has **9**, adding **Home** first and **Articles** after *How it works*. The manifest's seven appear in the manifest's order, so this is a superset rather than a reordering — and the cause is 5A-007 again: the approved artifact predates the `/articles` section, so the manifest inherited a list that was complete when it was drawn and is not now. **Not a page defect.** Manifest to be corrected; the owner should confirm "Home" was intended | Open — owner to confirm |
| **5A-018** | P1 | ✅ **Verified, first time measured** | all 11 public routes | **Non-negotiable #4 — the disclaimer is visible WITHOUT SCROLLING — had never been measured**; the compliance guard only asserted the disclaimer was *present*. Measured on the live site at 1280×800 across `/`, `/pricing`, `/contact`, `/learn`, `/learn/[slug]`, `/articles`, `/terms`, `/privacy`, `/disclaimer`, `/login`, `/signup`: **every page carries at least one disclaimer above the fold.** Also verified in the same sweep: one sticky site header and one footer per page, the "Markets · Live" pill absent everywhere, and **no horizontal overflow on any page** | **Pass 2026-09-01** |
| **5A-019** | P1 | ✅ **Verified** | `/` landing | All **29** named markers from the manifest's nine sections are present on the live page (11j — *a missing section renders perfectly*, so they are checked by name, never by looking). ⚠️ **Two probe defects found first, both of which would have produced false findings:** counting `<header>` tags flagged `/learn` and `/articles` as having two headers, when the second is the page's own semantic title block; and a case-sensitive match reported four sections missing that are present but CSS-uppercased, which `innerText` returns transformed. **Both were caught by looking at what the probe actually matched before reporting it** (11p) | **Pass 2026-09-01** |
| **5A-020** | P1 | ✅ **Verified on the preview** | signed-in, `free` state | The signed-in half, driven on the **Vercel preview** where `/api/cycle` actually runs (11v — this cannot be measured locally). `/stocks` `/run` `/results` `/request` `/account` and Stock Detail all render; **the disclaimer is above the fold on every one**; no horizontal overflow at 1280px. `/run` and `/results` correctly show the upsell **at the same URL** with honest copy (*"Browsing, price charts and company financials stay free"*). **All five subnav anchors present**, and **all 23 analytical sections accounted for** — including the conditional one in BOTH directions: `DelistedNotice` **absent on AAPL and present on BK**, which is the named case the manifest demands rather than a tick | **Pass 2026-09-01** |
| **5A-021** | P1 | ✅ **The paywall holds at the wire** | Stock Detail, `free` | **CLAUDE.md 11b re-verified on the surface that can actually leak.** A free viewer's Stock Detail carries the premium *labels* beside their locks ("Unlock HEALTH SCORE") and **zero premium keys in the raw HTML** — `overallRating`, `financialHealthScore`, `valuationScore`, `cyclePayoffScore` all absent, searched in the served markup rather than on screen. The free fields are all present and readable: Current Drawdown −8.0%, price history, the cycle bands, every fundamentals section. **This is the check that was worthless when run locally** (Layer 3 returned a perfect result over a page with no cycle block at all) | **Pass 2026-09-01** |
| **5A-022** | P1 | ⚠️ **Instrument, not the product** | method | **Four probe defects in one pass, every one of which would have been a false finding**, and all four were caught by looking at what the probe matched before reporting: counting `<header>` tags flagged pages' own semantic title blocks; a case-sensitive match "lost" four landing sections that CSS uppercases; `/52[- ]week/i` missed `StockHeader` because the page says **52W**; `/market cap/i` missed `KpiStrip` because that strip leads with **P/E**. ⚠️ A fifth was a real race — a `Promise.all` around `waitForURL` reported sign-in as failing at 45s when it had succeeded. **The pattern: a marker written from the manifest's vocabulary, not the page's, fails in the direction that looks like a defect** | Recorded |
| **5A-023** | P1 | ✅ **12 of 14 states, rendered** | the subscription matrix | Driven on the preview against a throwaway account. **11/11 subscription states correct on BOTH halves** — the premium payload served exactly when entitled, the screener reachable exactly when entitled, and in EVERY state the free "Current Drawdown" still visible and the disclaimer still present. Includes the two that only a matrix catches: **`billing_blocked` withholds access despite an otherwise-`active` subscription**, and the 3-day grace boundary flips on the date alone (`past_due` in grace = entitled, expired = not). ⚠️ **METHOD, stated rather than implied:** the states were set by writing `subscription_status` / `grace_until` / `billing_blocked` directly on the throwaway profile, not by driving Stripe — those three columns are the entire input to `hasAccess()`, and no card number was entered anywhere. The Stripe→webhook→profile plumbing is a different question, driven for real with test clocks in F3 S3. **Still to do: `deletion-scheduled` and `password-recovery`** (both hold e2e coverage inside the 714) | **Pass 2026-09-02** |
| **5A-024** | P1 | ✅ **F-005 closed, in the RENDERED copy** | `/run`, denied states | F-005 was that four Stripe states fell through to a screen saying *"no subscription"* — untrue for a reader who has one, and who in three cases has already tried to pay. The code fix was in place; **this is the first time the rendered result was read.** Each now has its own accurate, actionable sentence: `canceled` → *"Your subscription has ended… Resubscribing brings this back straight away"*; `paused` → *"Your subscription is paused… Resuming it from the Account page"*; `incomplete` / `incomplete_expired` → *"didn't finish setting up… **you have not been charged**"*; `unpaid` → *"We couldn't take your last payment… updating your card is usually all it takes — you don't need to buy a new plan."* **None of the five says "no subscription"**, asserted explicitly | **Pass 2026-09-02** |
| **5A-025** | P1 | ✅ **Verified by accident** | state #23 | A brand-new account meets the **first-login methodology + disclaimer gate** before any page content, on every route — decision #23, working. ⚠️ It surfaced as an apparent total failure: the whole 11-state matrix came back `painted=false` because every page was rendering the GATE, which reads exactly like a broken probe. **Correct product behaviour and a wrong-looking measurement are indistinguishable until you look at what is actually on the page** — the tell was that the server payload underneath was varying correctly by state the whole time | **Pass 2026-09-02** |
| **5A-026** | P1 | ✅ **14 of 14 STATES** (⚠️ not all of P1 — see 5A-028) | `password-recovery`, `deletion-scheduled` | The two confinement states, each driven in **both** directions because they fail differently (11f). **`password-recovery`:** a genuine reset link lands on `/account/update-password` with **logo-only chrome** (zero header links, zero footer links), and an attempt to reach `/stocks` stays put — while a **stale marker with no session** correctly goes to `/login` rather than caging the visitor (F0.6). **`deletion-scheduled`:** the REAL "Schedule deletion" button was pressed on a throwaway account; it landed on `/deletion-requested` showing the notice, signing back in lands on `/reactivate`, `/stocks` bounces there, chrome is logo-only, and the reactivate control is present. A **stranger** typing `/deletion-requested` never sees it. ⚠️ **Bonus cross-check:** the stored `deletion_scheduled_at` came out **exactly 30 days** ahead — corroborating, from the live write, the constant `/privacy` states in prose (11c-v) | **Pass 2026-09-02** |
| **5A-027** | P1 | ⚠️ **Instrument** | method | Two more probe defects, both of which produced a **false confinement failure**: rewriting Supabase's `action_link` onto our host hits `/auth/v1/verify`, which does not exist here and 404s to `/login` — indistinguishable from "recovery confinement is broken" (the app verifies a `token_hash` at its OWN `/auth/confirm`); and a fixed 4s wait missed `/account`'s danger zone entirely. **Running total for this sweep: six probe defects, every one failing in the direction that looks like a product defect.** That asymmetry is now the thing to expect rather than a surprise | Recorded |
| **5A-028** | P1 | ⚠️ **MY OVERCLAIM, corrected** | the ledger | I recorded *"P1 COMPLETE — 14 of 14 states"*. The states claim was true; **"P1 complete" was not.** P1's unit is not states, it is the **~77 route × state checks** scoped in Q2, and about **40** had been done. Missing: signed-IN redirect behaviour on the 13 public pages (~13), `/account` in all 14 states (~13 — the only page that renders billing, seen only as a free viewer), `/results` per denial reason (~6), and five of the seven named edge tickers (~6). Also never opened: `/articles/[slug]`, 11 of the 12 Learn articles, the conditional degradations, and the boundaries. ⚠️ **This is the exact trap the sweep exists to catch** — 11j, *"a done row is a claim about the last session's intent, not evidence about the page"* — committed in my own findings ledger, about my own work, one entry after quoting the rule. **Caught only because the owner asked "is anything left?" rather than accepting the report.** Remaining work carried out under 5A-029 | **Corrected 2026-09-02** |
| **5A-029** | P1 | ✅ **P1 GENUINELY COMPLETE — all ~77 checks** | everything 5A-028 listed | The gap closed. **Signed-in redirects: all five correct** (`/`, `/login`, `/signup`, `/deletion-requested` → `/stocks`; `/pricing` → `/account`). **`/account` in all 11 billing states** — the badge reads TRIAL ACTIVE / ACTIVE / PAYMENT DUE / PAUSED correctly, "manage billing" appears exactly when there is a subscription to manage, the upgrade CTA exactly when there is not, and the danger zone is reachable in every state. **`/results`** upsells when denied and renders when entitled. **The five remaining edge tickers**, and **all 12 Learn + 5 Articles pages** (h1, disclaimer above the fold, no overflow, figures present — 17/17). **Zero product defects found** | **Pass 2026-09-02** |
| **5A-030** | P1 | ✅ **The gap I was least comfortable with** | Stock Detail, entitled | **A subscriber genuinely SEES the numbers, not just receives them.** Earlier I had proven only that the premium payload was *served* in entitled states — and the manifest is explicit that absence here renders perfectly, since a page with no rating looks identical to one whose rating failed to load. Measured on the rendered page as an `active` subscriber: **`OVERALL RATING 64/100`, `HEALTH SCORE 83/100`, `CURRENT DRAWDOWN -8.0%`**, the tier word *Neutral*, the Verdict present, and **zero "Unlock" prompts anywhere**. Served **and** painted | **Pass 2026-09-02** |
| **5A-031** | P1 | ✅ **Stated absences, all three** | conditional degradations | The manifest requires each conditional to degrade to a *stated* absence rather than a blank. All three verified live: **cross-currency note** — *"Figures reported in New Zealand dollars (NZD) — the company's reporting currency, not its share price currency (AUD)"* on `A2M.AX`, and the USD/CAD equivalent on `ABX.TO`; **a withheld ratio explains itself** — *"A P/E history isn't shown for this stock: its shares trade in Canadian dollars while its earnings are reported in US dollars, so a price-to-earnings series would divide one currency by another"* (14e-2, visible to the reader); **absent analyst data** — *"No rating changes available."* on `ADD.AX`. ⚠️ Also: `A2M.AX` renders **A$** and **NZ$** distinctly, which is the 14d fix on screen | **Pass 2026-09-02** |
| ~~5A-032~~ | P1 | ✅ **CLOSED — a `.V` stock was pulled in** (see 5A-033/5A-034) | `.V` routing | **No TSX Venture ticker exists in `stocks` at all** — 1,454 `.V` symbols are active in the listings menu, zero in the universe. So rule #14's `.V` carve-out — which exists because stripping the suffix would collide `ABC.V` with `ABC.TO` and serve **another company's data** — has never been exercised against a real covered stock; only its unit test. `/stocks/ca/ABC.V` correctly 404s today because we cover nothing. **Not a defect, and not something to fix by adding a stock** — worth knowing that the first `.V` a reader requests will be the first real exercise of that path | Recorded |
| **5A-033** | P1 | ✅ **The `.V` path works, end to end** | `AE.V` | Owner asked for a real TSX Venture stock rather than leaving the path untested. **`AE.V` (American Eagle Gold) was queued through the REAL mechanism** — a `ticker_requests` row, then `drain_requests` — not inserted by hand. It fetched, enriched, inferred `market=ca` correctly, stored **1,339 bars** back to 2021, marked the request `fetched` and logged itself as `added_by='user_request'`. Then, signed in and entitled: **`/stocks/ca/AE.V` renders the company** (`AE.V · CA · American Eagle Gold`), and **`/stocks/ca/AE` — the suffix stripped — correctly 404s to "Not in our coverage yet"**, which is the collision protection of rule #14 working on real data for the first time. `/stocks/ca/AAAJ-P.V`, an uncovered Venture symbol, 404s. ⚠️ **The universe permanently gained a company**, which is #16 behaving as designed, not residue | **Pass 2026-09-02** |
| **5A-034** | P1 | ✅ **FIXED — a ticker had up to THREE valid URLs** | routing | Pulling the ticker in immediately exposed something no test could have found, because the case did not exist in the data. **`/stocks/us/AE.V` returns 200 and renders the Canadian stock**, where every other cross-market URL 404s. The mechanism, exactly: `layout.tsx` validates that the segment is *a* market but never against the stock's *actual* market; `urlPartsToTicker()` then returns early for a kept-suffix ticker — correctly, so it never builds `AE.V.TO` — and in doing so **ignores the market argument**. For every other ticker the reconstruction saves us (`/stocks/ca/AAPL` → `AAPL.TO` → absent → 404); for `.V` there is nothing to reconstruct. ⚠️ **Impact is genuinely small and worth stating so it is not over-fixed:** the page shows the right company, labels it **CA**, and stock pages are gated (`307` to `/login` signed out), so there is no SEO duplicate and no misinformation. It is an inconsistency, not a defect a customer meets. **FIXED 2026-09-02 on the owner's instruction** — *“It should only work ca. Please fix it.”* ⚠️ **The owner's report was wider than mine and they were right:** I had found `/stocks/us/AE.V` and recorded it as one wrong market; they observed **all three** answer, which is the correct reading — the market argument is not *mismatched*, it is **never consulted**. ⚠️ **And investigating it found the defect is not about `.V` at all.** `us` is the pass-through market, so ANY fully-qualified ticker resolved under it: **`/stocks/us/BHP.AX` served the Australian company**, and `/stocks/us/SHOP.TO` the Canadian one. Every other cross-market URL 404s **by accident** — the reconstruction happens to build a ticker nobody owns (`/stocks/ca/AAPL` → `AAPL.TO`). ⚠️ **The fix went in `lib/ticker.ts`, NOT `layout.tsx` as I first proposed.** Four call sites use the conversion and **`lib/report-data.ts` is one of them** — a route handler does not render through a layout, so a layout-only fix would have left `/stocks/us/AE.V/report` serving a **1 MB paid report** of the Canadian company at a US URL. Fixing the conversion itself means all four inherit it and there is no second list to drift (11c). `urlPartsToTicker` now returns `string | null`, and the round trip IS the check — whatever we build must map back to the market in the URL, read off the same `MARKET_SUFFIXES` table. Making the return nullable is what surfaced the other three consumers: **the type error is the only thing that makes an omission visible** (11c-x). **Proven at the wire on a production build, with controls:** `/stocks/ca/AE.V` 200 *American Eagle Gold*; `/us/` and `/au/` **404**; `/stocks/us/BHP.AX` and `/us/SHOP.TO` **404**; and `/us/AAPL`, `/au/BHP`, `/ca/SHOP` all still **200 with the right company**, `/stocks/ca/AE` still 404. **On the paid report, signed in as an ENTITLED account so a 402 could not mask a 404:** `ca` 200 (1,017,801 bytes, American Eagle), `us`/`au` **404** (46 bytes), `/us/BHP.AX/report` 404, `/au/BHP/report` 200 — every response `private, no-store`. Guarded by `e2e/ticker-routing.spec.ts`, **broken on purpose first**: restoring the old line turned both new tests red for the right reasons while the ten existing ones stayed green | **FIXED 2026-09-02** |
| **5A-035** | P1 | ✅ **Gap found and closed** | `/reset-password` | **The one public route the sweep never opened.** 5A-018 measured eleven public routes and this was not among them — it appears in the route inventory and nowhere in the ledger, so it had been counted by the inventory and checked by nothing. Found on review, by walking the inventory against the ledger rather than re-reading the ledger. Measured live: **200**, h1 *“Reset your password”*, email field, *“Send reset link”* button, full chrome (7 header + 9 footer links, matching 5A-017), no horizontal overflow. ⚠️ **And the check that matters for this route: it works with JavaScript disabled** — the `<form>` and the email input are in the served HTML, which is the whole reason it is `force-dynamic` (11r). Non-negotiable #4 does not bind here (no rating, score or signal on the page); the disclaimer is present regardless | **Pass 2026-09-02** |
| **5A-036** | P1 | ✅ **Gap found and closed** | both error boundaries | **`app/error.tsx` and `app/(app)/error.tsx` had never been rendered — by this sweep or by any test in the 714.** They are in the route inventory as “three error boundaries” and were listed by 5A-028 as never opened; the session-3 log then recorded “the boundaries” as done, which was true of the **404** boundary only. Rendered by adding a throwing route temporarily to each group, building for production and deleting both afterwards. **Root boundary:** 500, *“Something went wrong”*, a working *Try again*, a `/contact` link, **no stack trace or error message leaked**, no overflow at 1280px **or 375px**. **`(app)` boundary:** 500, caught, *Try again* present, and — the reason it exists as a separate file — **the terminal shell survives**, so the reader can navigate away instead of being stranded. Contrast measured on both: lowest reading **4.89:1** on the body line, above the 4.5 floor | **Pass 2026-09-02** |
| **5A-037** | P1 | ⚠️ **Instrument** | method | **The eighth probe defect, and it produced a PASS-shaped result rather than a failure.** The first root-boundary probe reported `status 200, caught: false` — which reads as “the boundary did not fire”. It had not: `/zzboom` is not in `PUBLIC_PATHS`, so the proxy redirected a signed-out request to `/login` **before the throwing page ever ran**, and the probe faithfully measured the sign-in page. ⚠️ **Note the asymmetry has now flipped:** the first seven defects all failed in the direction that looks like a product defect; this one would have had me file a false finding against a boundary that works. The fix was to reach the route **with a session**, and the probe now carries a control asserting it is not on the login page — because “not the thing I meant to measure” is the failure mode a status code cannot show | Recorded |
| **5A-038** | P1 | ✅ **Third review of P1 — the manifest rows with no recorded evidence** | public pages, boundaries | Checked the P0 **manifest** row by row against the ledger, rather than re-reading the ledger. Nine “must contain” items had no evidence either way; **all nine pass on the live site.** The **no-JS forms** — `/login`, `/signup`, `/reset-password` all serve a real `<form>` with real inputs, JavaScript disabled (only `/reset-password` had been checked). **`/pricing`** — monthly↔annual toggle present, *SAVE 30%* badge, the unlocks list, disclaimer, and **A$19** (correct: #13 shows the reader's local currency, so one price is right and three would be wrong). **`/learn`** — h1 *“Before you buy anything”*, 12 article links, **zero dead links**. **`/articles`** — h1, 5 published, *Coming next*. ⚠️ **Theme, which was a genuine unknown:** the manifest commits the product to light *in both themes*; under `prefers-color-scheme: dark` the body still computes `rgb(240,244,248)` on `/`, `/pricing` and `/learn` — identical to light. **Boundaries:** `/learn/nope` and `/articles/nope` both **404**; signed in, `/not-a-real-page`, `/stocks/us/AAPL/nope` and `/stocks/us/NOTREAL` all **404** with the friendly page | **Pass 2026-09-02** |
| **5A-039** | P1 | ⚠️ **Instrument — and the control is what saved it** | method | **The ninth probe defect.** Signed in on live, `/not-a-real-page` and `/stocks/us/AAPL/nope` came back landing on `/login` — which reads as *the site bounces a signed-in reader off unknown URLs*, a plausible and alarming finding. The sign-in had silently failed: the form was filled before hydration, so React never saw the values and Supabase answered *“missing email or phone”*. ⚠️ **I only knew because the second version carried a POSITIVE CONTROL** — load `/stocks` first and refuse to report anything unless it actually renders (11v). The fixed probe waits for the input to be editable, types with `pressSequentially`, and **asserts the values are in the DOM before submitting**. All three URLs then 404 correctly. **Running total: nine probe defects in this sweep**, and the pattern to expect is now explicit — a broken instrument produces a confident, product-shaped finding | Recorded |
| **5A-040** | P1 | 🟡 **Owner to note — by design, not a defect** | boundaries | Signed **out**, an unknown URL answers **307 → `/login`** rather than a 404 — `/not-a-real-page` included. That is the gating posture working (anything not explicitly public needs a session), and it is **stricter**, never looser. The manifest's row says *“unknown public URL → 404, auth-aware”*, which is satisfied for a signed-**in** reader and not for a signed-out one. Worth the owner knowing rather than fixing: a search engine meeting a dead URL gets a redirect instead of a 404, so it is never cleanly de-indexed — bounded by the fact that robots and the sitemap list only the public pages | Open — owner to note |
| **5A-041** | P2 | 🔴 **Same figure, two opposite colours, one page** | Stock Detail | On AAPL, **−5.6% renders GREEN in the header** (`#1B741B`, the *5.6% off high* reading in the 52-week gauge) and **RED in Drawdown Analysis** (`#B22222`, *CURRENT −5.6%*). Numerically identical, three screens apart, opposite meanings implied. ⚠️ **And the header contradicts ITSELF**: the 52W gauge's own track is a gradient running `--c-tier-1 → --c-tier-4` (green at the low end, orange at the high) with the marker at **83.6%** — sitting in the orange “extended” zone — while the number beside it is green. Whatever the right answer is, it cannot be all three | **Closed 2026-09-02** — the fall % carries no colour at all (owner decision) |
| **5A-042** | P2 | 🔴 **Same fact, two colours** | Stock Detail | *“0.2% above target”* in the header is `var(--c-tier-3)` **grey**; *“0.2% above Consensus Target”* in the Analyst Price Target Range card is a hard-typed `#B22222` **red**. One fact, one page, grey in one place and red in another | **Closed 2026-09-02** — neutral track, marker only |
| **5A-043** | P2 | 🟠 **“Middling” and “no data” are nearly the same grey** | sitewide | `--c-tier-3` (**Neutral** / **Adequate**) is `#72696D`; `--text-muted`, which a **null** score renders as, is `#626B77`. Measured with the repo's own CIEDE2000: **ΔE 9.5**. Every other tier sits **25–35** from muted, and `check-tier-palette` check 4 enforces **16–34** between adjacent tiers — so the one distance nobody measured is less than half the smallest guarded one. In plain terms: a Health score of 65 (*Adequate*) and a Health score we do not have look almost the same. The grey was the right answer to a contrast problem and it collided with the “no data” colour, which nothing compares it against. ⚠️ **Probe validated first** — it reproduces the guard's published floors (17.1 / 34.1 / 28.4 / 16.3 vs 17.0 / 34.0 / 28.0 / 16.0) before being trusted on a new pair | **Closed 2026-09-02** — `--data-missing` named; Neutral moving to gold separated them |
| **5A-044** | P2 | 🟠 **The tint layer was never re-based** | sitewide | The tier colours changed on 2026-08-22; **four of the five tints they pair with are still mixed from the pre-August hues.** `--tint-tier-2` is the retired `#228B22`, `--tint-tier-5` the retired `#B22222`, and the tier-1 / tier-4 badge backgrounds are hand-typed `rgba(0,100,0,.12)` and `rgba(255,69,0,.10)` — retired `#006400` and `#FF4500`. Only `--tint-tier-3` was updated, because gold→grey was a hue change nobody could miss while the others only darkened within their hue. ⚠️ **Visual impact is honestly small**: composited on a white card the drift is ΔE 1.4–2.0 for tiers 2, 4 and 5 (at or below just-noticeable) and **ΔE 4.7 for tier 1** — pine-green text on a grass-green wash. A maintenance defect more than a visible one, and 11c-viii's exact mechanism: written as `rgba()`, invisible to a guard that hunts **by hex** | **Closed 2026-09-03** — guard check 7 now measures each badge ink on its real tint |
| **5A-045** | P2 | 🟠 **A third party's rating painted in OUR verdict colour** | Stock Detail | The analyst chips are **not on one palette**: *Sell* and *Downgrade* use `--c-tier-5` — our **Bearish** colour — while *Buy* / *Outperform* / *Overweight* use `INK.up` and *Hold* / *Neutral* use `INK.neutral`. `lib/ink.ts` states the rule being broken in its own header: *“These are DIRECTION colours, not RATING colours… separate on purpose.”* The concern is the one design-system.md §4 already names for this row — a *Sell* chip in our own Bearish colour reads as **our** conclusion, not Yahoo's | **Closed 2026-09-02** — `--analyst-*`, guarded for distance from our tiers |
| **5A-046** | P2 | 🟡 **No amber words anywhere — the question under all of the above** | sitewide | The owner's stated model is *positive green, bad red, cautious yellow*. **The text palette contains no yellow or amber at all.** The rungs run green → green → **grey** → orange-red → dark red: *Neutral* is grey, *Cautious* is `#C73600`, which most readers read as “bad” rather than “careful”. Both were owner-approved for good reasons — gold could not reach the contrast floor **as text** (15,866 candidates searched), and darkening Cautious was needed to separate it from Bearish. ⚠️ **Not a defect and not re-litigating**: the constraint was accessibility, the consequence is semantic, and the consequence has never been put to the owner as its own question. Gold survives as **fills** (§5) — so the site has amber marks and no amber words | **Closed 2026-09-02** — `--status-warning` and its ink/tint/surface/border |
| **5A-047** | P2 | 🟢 **Checked and NOT a defect — recorded so it is not re-raised** | palette | `#D4A017` and `#FF4500` appear in eleven live rendering paths, which reads like retired colours left on the page. **Deliberate**: §5 says a colour that is *“a line, a candle, a dot or a bar”* keeps its original value and only **text** moved to the ink layer. All eleven are fills, swatches, chart bands or gradients. ⚠️ Also measured rather than inherited: `.mt-cat-income` hand-types `#8A6710`, the **superseded** ink, which the doc records at *“4.32:1”*. On the ground it actually sits on (its own 8% tint over a white card) it measures **4.88:1** and passes — the doc's figure was against `--bg-page` (11l: judge a colour where it SITS). Remains a tidy-up: the only one of seven category pills on a value in no token | Recorded — no action |
| **5A-048** | P2 | ⚠️ **The palette reference is wrong in 5 places** | `design-system.md` §2 | All 38 documented tokens compared against `globals.css`: **5 stale.** `--text-muted` documented `#8A97A8`, really `#626B77`; `--c-tier-3-ink` and `--c-neutral-ink` documented `#81600F`, really `#6B6266`; `--tint-tier-3` and `-strong` documented as **gold**, really grey. `check:tier-palette` keeps `globals.css` and `lib/ink.ts` in step and **has never read the doc**, so the document CLAUDE.md points to for *“what the live site actually does”* has been quietly wrong since August | **Closed 2026-09-03** — 2 values were STILL stale 6 weeks on; now guarded by check 10 |
| **5A-049** | P2 | ⚠️ **Instrument — my controls FAILED, which was the useful result** | method | I predicted only the two **hand-typed** badge backgrounds sat on old hues, and used the three token-based ones as controls that must measure zero. **Two of the three drifted**, killing the hypothesis: the problem is not hand-typing, it is that **the tint tokens themselves were never re-based**. Had the controls passed I would have filed a narrower, wrong finding and “fixed” two literals while leaving the tokens. A break that fails to break is a finding about your model of the system (11u) | Recorded |
| **5A-050** | P2 | 🔴 **The most urgent messages in the product are painted in the most neutral colour** | `/account` | Driven across all ten billing states. `SubscriptionCard` has three tones and its **`warn`** tone is `bg-[var(--tint-tier-3)] text-[var(--c-tier-3-ink)]`. Both of those tokens were **gold** until 2026-08-22 and are **grey** now — so *“Payment due”*, *“Access paused”* and *“On hold”* (a disputed payment) render as a **grey chip on a grey wash**, measured live at `#6B6266` on `rgba(114,105,109,.12)`. ⚠️ **Nobody wrote a wrong line and nothing looked broken**: the tone map is correct, the token is correct, and the warning simply stopped being amber when the palette moved underneath it. This is the single clearest instance of 5A-046 — the site has no amber — and it lands on the screen where a customer must be told to act. The states that are FINE (`active`, `trialing`) are brand blue, so a healthy account and a failing one differ only in wording and a grey/blue swap | **Closed 2026-09-02** — `SubscriptionCard` moved onto the status palette |
| **5A-051** | P2 | 🔴 **The site speaks TWO colour languages for one number** | sitewide | This is 5A-041 generalised, and it is the root of it. A drawdown is coloured by **two different conventions that both ship**: (1) the *cycle* convention — deeper fall = greener, because a deeper fall is more cyclically attractive — which paints the landing's worked run (`−25.1%` and `−31.8%` GREEN, `−4.6%` ORANGE) and the KPI ramp; and (2) the *plain* convention — a negative number is red — which paints Drawdown Analysis (`CURRENT −5.6%` RED) and every other change figure. **Both are defensible. Together they are not**, because the reader has no way to know which one a given red or green belongs to. ⚠️ The clearest single expression is the header, where the same `−5.6%` is green beside a 52-week bar whose own gradient puts the marker in the orange zone | **Closed 2026-09-02** — one colour language; raw numbers uncoloured |
| **5A-052** | P2 | 🟢 **The delisting banner is right** | Stock Detail | Measured on `BK`: text `#8B1414` (tier-5 ink) on `rgba(178,34,34,.10)` with a matching left rule — *“Bank of New York Mellon Corp no longer trades. Every figure below is frozen at 23 Jul 2026 and is not current.”* Red is the correct reading here (the figures are stale and must not be acted on), it reuses the rating tokens rather than inventing a colour, and it is the owner's own ruling from F-035. Its tint is on the pre-August red, which is 5A-044 and not a separate finding | **Pass 2026-09-02** |
| **5A-053** | P2 | 🟢 **The public pages are consistent — and are the one place the palette behaves** | `/`, `/pricing`, `/learn`, `/articles` | Every semantically-coloured element on `/pricing`, `/learn`, `/articles` and the long articles is **brand blue or navy** — no rating colours, no direction colours, nothing to misread. The landing is the only public page carrying the rating palette, and its usage is internally coherent: *High Conviction* green, *Healthy* green, *Adequate* grey, *Reasonable* grey, *Elevated* orange, *Expensive* / *At Risk* / *Bearish* red, and the tier chips coloured by their own tier. **It is also the page that makes 5A-051 visible**, because it prints deep drawdowns in green | **Pass 2026-09-02** |
| **5A-054** | P2 | 🟡 **A real figure painted in the “no data” grey** | `/articles` | In the ranked market table the **S&P 500 row** (`−18.9%`, `−19.2%`) is drawn in `--text-muted` — the same token a **missing** value uses — while the ASX row is brand blue. It is a deliberate series colour in `FallByMarketFigure`, so it is not a bug; it is the third meaning now loaded onto one grey (5A-043: *middling*, *no data*, and now *the comparison market*). Small on its own, and it belongs in whatever decision comes out of 5A-043/5A-046 | **RE-MEASURED 2026-09-05 — the finding was half wrong about WHERE, and the answer is "it does not matter to a reader."** It is not in the ranked table, which draws all three market rows in `--text-primary`; it is the featured card's LINE FIGURE, and only on `/articles` — `FIGURES` is consumed by the index page, never by the article itself, so I spent a first pass measuring a page the figure is not on (11aj). Measured there: the S&P line and its two labels are `#626B77` against a `#F0F4F8` ground, **~4.9:1 — above the 4.8 floor** and plainly legible beside teal at 5.95 and brand blue at 6.49. ⚠️ **And the second meaning is not on this page at all**: `--data-missing` renders only in the signed-in results table, so no reader can meet both greys together. Screenshot before/after with `--text-secondary` shown to the owner; the difference is barely perceptible. **The residual is maintenance, not appearance** — the figure BORROWS a text token, so retuning `--text-muted` for a legibility reason silently moves a chart series (5A-059's argument). Owner: *"Leave the colour. Rename it."* | **CLOSED 2026-09-05** — `FIGURE_NEUTRAL` in `lib/ink.ts`, beside `FIGURE_TEAL`, same value (`#626B77`), no longer borrowing a text token. Zero visual change; the figure can no longer be moved by a readability edit to `--text-muted` |
| **5A-055** | P2 | ⚠️ **Instrument — the tenth probe defect, and it reported a CLEAN SITE** | method | A stray early `return` inside the colour probe meant it exited on the first element with children, i.e. `<html>`. It returned **zero coloured elements for `/account` in all ten states, for the delisting banner and for all four public pages** — and every one of those printed as an unremarkable empty result. **A broken instrument reports exactly what a clean system reports** (14g), and this one did it across sixteen pages at once. Fixed by making the probe return its **scan count** alongside its hits, so a zero that comes with a zero scan is refused rather than believed. **Ten probe defects in this sweep now**; the two most recent both produced *false clean*, where the first seven produced *false defect* | Recorded |
| **5A-056** | P2 | ⚠️ **NOT DONE — `/results` was not driven to completion** | `/run`, `/results` | Three attempts on the live site with an entitled throwaway. The basket picks and the real submit control (*“Run Analysis · 7”*) clicks, but the run did not reach a rendered results table inside four minutes, and I will not report a surface I did not see. ⚠️ **What IS covered, and why it is not nothing:** the landing's worked run deliberately reuses the product's own `ResultsTable` classes and helpers (`compositionRamp`, `healthColor`, `metricTintColor`) precisely so the two cannot drift (11m), so the results **colour vocabulary** was measured on the landing — score chips in all five tiers, the three-tier Health ramp, the five-tier Valuation ladder and the drawdown tint. **What is NOT covered is the live page**: column tints, zebra striping, the Opportunity Map's own bands, the export buttons and the skipped-ticker strip | **Closed 2026-09-03** — driven end to end on the Vercel preview; /results rendered 7 rows |
| **5A-057** | P2 | 🔴 **Four groups of tokens hold the SAME colour today — the wrong one is invisible** | palette | Owner-named class: *“if 2 variables has the same color and you are using the wrong one, you won't be able to figure out what is right or wrong.”* Extracted every token from `globals.css` + `lib/ink.ts` and grouped by value. **Three collisions put the RATING palette and the DIRECTION palette on one value**, which `lib/ink.ts` explicitly forbids in its own header (*“separate on purpose”*): `--c-tier-4` **==** `--c-warn-ink` **==** `INK.warn` = `#C73600`; `--c-tier-3-ink` **==** `--c-neutral-ink` **==** `INK.neutral` = `#6B6266`; `--c-tier-5` **==** `--c-tier-5-ink` = `#8B1414` (the doc even notes it). A fourth is benign: `--brand-mid` == `--c-brand-ink` == `INK.brand`. ⚠️ **Nothing can detect a wrong choice while the values agree** — not review, not a screenshot, not a guard. The bug is created the day one of them moves, and it lands on whichever surface picked the wrong name months earlier | **Closed 2026-09-02** — a domain per job, each independently re-pointable |
| **5A-058** | P2 | 🔴 **Four of the five direction inks have a CSS token. `down` does not.** | palette | `--c-up-ink`, `--c-neutral-ink`, `--c-warn-ink` and `--c-brand-ink` all exist in `:root`. There is **no `--c-down-ink`** — so every stylesheet and component that needs “a loss, in words” hand-types `#B22222`, which it does in **20 places**. This is the structural cause of drift for the one direction colour carrying the most weight in a finance product, and it is the only member of the set a future palette change cannot reach by editing one line | **Closed 2026-09-02** — `--c-down-ink`, the fifth ink |
| **5A-059** | P2 | 🟠 **~100 hard-typed colour literals that duplicate a token** | components | Sweep of `components/`, `app/`, `lib/` for hex and `rgba()` literals matching a token value: `#1E5CB3` ×28, `#B22222` ×20, `#1A3A6E` ×18, `#E2E8F0` ×10, `#2E7DE8` ×10, `#F0F4F8` ×9, `#4A5568` ×8. ⚠️ **Most are legitimate in KIND** — a Recharts `fill` or a Lightweight-Charts option is an SVG attribute where `var()` does not resolve, which `lib/ink.ts` documents. **The defect is that they are hand-typed rather than imported**: `ink.ts` exists precisely so a chart prop can hold the value without copying it, and these bypass it. Same shape as 11c-viii | **Largely closed 2026-09-03** — chart props now import instead of hand-typing |
| **5A-060** | P2 | 🔴 **Two range gauges on the SAME page run OPPOSITE gradients** | Stock Detail | Both are a horizontal track with a marker showing where the price sits in a range. **`WeekRangeGauge`** (52-week range) runs `--c-tier-1 → --c-tier-4`, i.e. **green at the LOW end, orange at the high** — cheap is good. **`.target-track`** (Analyst Price Target Range) runs `#B22222 → #006400`, i.e. **red at the LOW end, green at the high** — high is good. Same page, same widget shape, opposite colour direction, no label on either explaining which is which. This is 5A-051's two languages made concrete in two adjacent components | **Closed 2026-09-02** |
| **5A-061** | P2 | 🟠 **Two gauge gradients are built from the ENTIRE retired rating palette** | Stock Detail, Results | `.target-track` is `#B22222 → #FF4500 → #D4A017 → #228B22 → #006400` and `.cyc-track` is `rgba(178,34,34) → rgba(212,160,23) → rgba(0,100,0)` — every stop a pre-August rating colour. §5's “a fill keeps its value” covers the **direction** palette in charts; these two are **rating** scales (a score ramp and a cycle-position band), so the exemption does not obviously reach them. They are the largest surviving blocks of the old palette | **Closed 2026-09-02** — both gauge tracks now neutral |
| **5A-062** | P2 | 🔴 **A drawdown percentage has THREE colours across the site** | sitewide | Measured on live pages: **blue** on `/learn/what-is-a-drawdown` (`-20%` in `--brand-mid`), **green** on the landing (`−25.1%`, deeper-is-greener), **red** on Stock Detail (`CURRENT −5.6%`, negative-is-red). Three surfaces, one quantity, three colour languages — and the Learn article is where a new reader is being *taught* what a drawdown is | **Closed 2026-09-02** |
| **5A-063** | P2 | 🔴 **A coloured 0–100 number with no legend, and thresholds that disagree with the words** | Results | design-system.md §4 justifies not printing the zone words in the Cycle Position cell because *“they're described in its tooltip (75+ Deep Value · 50+ Value · 25+ Fair · below Stretched, as a rough guide)”*. **That tooltip does not exist** — grepped for, absent. So the reader gets a green / grey / red number and nothing anywhere says what the colour means. ⚠️ **And the colour cut-points do not match the zone cut-points even in principle**: `cyclePositionColor` switches at **66 and 33** (three colours) while the zones the doc names switch at **75 / 50 / 25** (four zones). A stock at 30 is painted the WORST red while its zone is the middling *Fair*; one at 60 is painted neutral grey while its zone is the favourable *Value* | **Closed 2026-09-02** |
| **5A-064** | P2 | 🟡 **A fourth copy of the drawdown palette, in the Learn figures** | `/learn` | `components/learn/chartPrimitives.tsx` exports `DD_LINE` / `DD_FILL` / `AVG_LINE` / `LOW_LINE` under a comment naming its source: *“The product's own drawdown palette (`components/stocks/DrawdownOverlay.tsx`)”*. **Checked: all three shared values still agree today**, so this is latent rather than live. It is a copy by construction — the day the overlay changes, the article teaching readers what a drawdown looks like quietly stops matching the product it describes | **Closed 2026-09-02** — Learn primitives derive from `DRAWDOWN`; one had already drifted |
| **5A-065** | P2 | 🟡 **The verdict band dot is always green** | Stock Detail | `VerdictCard` colours the whole card from `RATING_TIER_HEX` (correct, current palette) but the entry-zone band dot is hard-set to `var(--c-tier-2)` — **Constructive green in every state**, including on a *Bearish* card. Possibly intended (“this is the attractive zone”), but it is the one element on the card that does not follow the verdict | **Closed 2026-09-02** — the band dot follows `--verdict-color` |
| **5A-066** | P2 | 🟢 **Legal pages and `/contact` are clean** | `/terms`, `/privacy`, `/disclaimer`, `/contact` | Every semantically-coloured element is brand blue or navy. No rating colours, no direction colours, nothing a reader could misread as a signal on a page that must not carry one | **Pass 2026-09-02** |
| **5A-067** | P2 | 🟢 **Forbidden vocabulary in CSS class names** | `globals.css` | `.card-header--accent-buy` and `.card-header--accent-hold` carry *Buy* and *Hold* — words CLAUDE.md #2 forbids in our scoring outputs. **Not a compliance breach**: a class name is never rendered. Worth renaming with the P2 work, because the names also map a **rating** idea onto **direction** ink (`--c-up-ink` / `--c-neutral-ink`), which is 5A-057's confusion written into the stylesheet | Recorded |
| **5A-068** | P2 | ⚠️ **Instrument — the scan count earned its keep** | method | I probed `/learn/how-long-do-recoveries-actually-take` and it returned almost nothing. Under the old probe that would have read as *a clean page*; with the scan count it read as **6 text nodes**, which is not an article — it was the **404 page**, because I had guessed the slug. **The fix from 5A-055 caught a second false clean within one session** | Recorded |
| **5A-069** | P2 | 🔴 **`/results` reached — and it confirms the drift LIVE** | `/results` | Screener driven end to end (Magnificent Seven, entitled throwaway). ⚠️ **It does not navigate**: the run completes on `/run` and the reader must go to `/results` themselves, which is why three earlier attempts looked like a hang. On the rendered table: the **High Conviction badge sits on the retired `#006400`** and **Constructive on the retired `#228B22`** while their text uses the current pine and green — 5A-044 on the most valuable premium surface. ⚠️ **New here:** the drawdown column uses the **rating** colours, so a stock that has barely fallen (`-0.2%`) is painted **Bearish red** and one down 26.6% is painted **High Conviction green**. The red does not mean “bad company” — it means “has not fallen far” — and nothing on the page says so | **Closed 2026-09-02** |
| **5A-070** | P2 | 🔴 **One palette is doing at least TWELVE unrelated jobs** | sitewide | The rating tokens (`--c-tier-*`, i.e. *our five-tier judgement of a stock*) are referenced in **30+ files**, most of which are not about rating a stock: **delete-account danger** (`DeleteAccountCard`), **form errors and the saved tick** (`ProfileForm`, `PasswordForm`), **CSV import ok/warn/error** (`CsvImport`), **run-progress counts** (`RunProgress` Scored/Skipped), **short-interest bands** (`ShortInterest`), **billing status** (`SubscriptionCard`), **drawdown depth**, **cycle position**, **health**, **valuation**, the **delisting banner** and the **onboarding modal**. ⚠️ **Consequence, in one sentence:** retune *Cautious* because a rating chip looked wrong and you also repaint CSV warnings, skipped-ticker counts, billing warnings and short-interest bands — none of which you were thinking about. This is the owner's question answered: **yes, they must be separated** | **Closed 2026-09-02** — the domain split; the error-colour remainder is 5A-102 |
| **5A-071** | P2 | 🟠 **58 distinct colours exist in no palette at all** | sitewide | 145 occurrences across `components/`, `app/` and `lib/`, excluding comments and the token block itself. Heaviest: `globals.css` (32), `landing.css` (12), `OpportunityMap.tsx` (11), `brandEmail.ts` (10), `EarningsHistory.tsx` (8). These are the colours a palette change can never reach, and each is a place a dark mode would have to be fixed by hand | **Largely closed 2026-09-03** — the drift-prone copies are named and guarded |
| **5A-072** | P2 | 🔴 **The product already needed AMBER twice, and invented it locally both times** | `PremiumLockPage`, Smart Money | The design system has no amber (5A-046) — so where one was genuinely needed, it was written by hand from Tailwind's palette instead: the premium-lock notice uses `#FCD34D` border / `#FFFBEB` fill / `#92400E` text, and `.smart-pill.is-initiate` uses `#D97706` on `rgba(217,119,6,.10)`. **Five stray amber values, two components, none in any token.** ⚠️ This is the strongest evidence for 5A-046: the gap is not theoretical, it has already been filled twice, inconsistently, by whoever hit it | **Closed 2026-09-02** — the two hand-invented ambers consolidated |
| **5A-073** | P2 | 🟡 **Ten hand-typed colours in the transactional emails** | `lib/email/brandEmail.ts` | An email cannot use a CSS custom property, so literals are unavoidable **in kind** — but they are currently typed rather than imported, so the branded emails will silently keep the old brand colours through any palette change. Needs a shared exported constant, the same argument as `lib/ink.ts` | **Closed 2026-09-02** |
| **5A-074** | P2 | 🟡 **The Opportunity Map keeps a private palette** | `/results`, landing | `#1A1A1B`, `#2E3347`, `#E8EAF0`, `#94A3B8` appear only there (plus the still image's copies). It is the one premium chart whose colours are defined nowhere else, so it will not follow a palette change and will need bespoke work for dark mode | **Closed 2026-09-03** — and it was 34 copies across 9 components, not one chart |
| **5A-075** | P2 | 🟢 **Checked and CLEAR — the retired muted grey is never text** | sitewide | `#8A97A8` — the pre-2026-08-22 `--text-muted`, which measured **2.97:1** — survives in six places. All six are **strokes, borders or fills** (`OpportunityMap` reference lines, a landing border, a fade gradient, the `.mt-cat-market` chip's wash), and the chip's own text is `#4A5568`. **No contrast regression.** Recorded because a stale value that once failed accessibility is exactly the thing to check rather than assume | **Pass 2026-09-02** |
| **5A-076** | P2 | 🔴 **A colour variable that does not exist — the documented landmine, live** | `NewsFeed` | `components/stocks/NewsFeed.tsx:79` sets `color: 'var(--c-mid)'`. **`--c-mid` is defined nowhere in the codebase** (the real token is `--brand-mid`). ⚠️ An undefined custom property does **not** fall back — it voids the whole declaration — so the source badge inherits its parent's colour instead of brand blue, on a `rgba(30,92,179,.10)` blue wash. design-system.md §2 documents this exact mechanism as the reason `--text-white` was deleted: *“invisible text that reads as a rendering glitch rather than a typo.”* Found by listing every `var(--x)` read and subtracting every `--x` defined — a check nothing in the repo performs | **Closed 2026-09-02** |
| **5A-077** | P2 | 🟠 **An undefined variable silently kills an animation** | `/articles` | `articles.css:150` — `transition: transform .25s var(--ease)` — and **`--ease` is defined nowhere.** An invalid value in a shorthand voids the declaration, so the arrow on every *Read* link has **no transition at all**; the hover translate happens instantly. Nothing errors and the link works, which is why it has never been noticed | **Closed 2026-09-02** |
| **5A-078** | P2 | 🟡 **Dead CSS pointing at a third undefined variable** | `globals.css` | `.tier-legend-swatch { background: var(--tier); }` — `--tier` is never set, **and no component ever renders that class.** Dead rule, so no live defect; listed because it is the third undefined-variable hit in one file and the class name suggests a tier legend somebody expected to exist | **Closed 2026-09-02** — the whole .tier-legend block deleted |
| **5A-079** | P2 | 🔴 **The alias bug is not a risk — it is already happening** | palette | `--c-warn-ink` is the ONLY colour token in `globals.css` that is **defined and never read**. It is also **exactly equal** to `--c-tier-4` (5A-057). So the correct token for *“the least favourable rung of a ramp, as text”* exists, is documented, and sits unused — while the **rating** token identical to it is used in its place across the app. ⚠️ This converts 5A-057 from a hazard into an observed fact: **somebody has already reached for the wrong name, and nothing could tell them.** The day *Cautious* moves for a rating reason, every one of those usages moves with it | **Closed 2026-09-02** |
| **5A-080** | P2 | 🟠 **The surface scale has no real steps, and two token pairs are visually identical** | palette | Measured every token pair in CIEDE2000. `--c-tier-3` vs `--c-tier-3-ink` = **ΔE 2.8**; `--c-tier-2` vs `--c-up-ink` = **ΔE 3.9** — so the *rating vs direction* separation the docs insist on **does not exist to the eye**, which is precisely why the wrong one gets used (5A-079). Worse for structure: **six surface tokens sit within ΔE 6 of each other** (`--bg-page` / `--bg-hover` 2.2, `--bg-stripe` / white 2.2, `--brand-light` / `--bg-hover` 3.6). There are **14 greys and 6 blues** with **no numeric ramp** — three of the greys are literally the same white (`--bg-surface`, `--bg-sidebar`, `--bg-header`). A dark theme needs elevation steps; there are none to invert | **Closed 2026-09-03** — elevation ramp; values deliberately unchanged |
| **5A-081** | P2 | 🔴 **No `color-scheme`, and that costs something TODAY** | sitewide | Zero occurrences of `color-scheme`, `prefers-color-scheme`, `light-dark()` in the app. The page commits to light in both themes (5A-038 verified the body does stay light) — **but it never tells the browser.** Without `color-scheme: light`, browser-painted UI follows the OS: scrollbars, the native `<select>` popup list (which this app uses for filters), autofill backgrounds and form-control internals can render **dark on a light page** for any visitor whose device is in dark mode. ⚠️ Stated as a known browser behaviour, **not** as something I measured — a native dropdown popup cannot be read from the page. One line fixes it | **Closed 2026-09-02** — `color-scheme: light` |
| **5A-082** | P2 | 🟡 **No Windows High Contrast support** | sitewide | Zero `forced-colors` / `-ms-high-contrast` rules. In forced-colors mode the OS replaces colours wholesale, and anything carrying meaning through a **background or a border** — the tier chips, the gauges, the tints — collapses. Not a WCAG failure on its own, and a real gap for the readers most likely to need it | **Closed 2026-09-03** — first forced-colors rules; owner to confirm on Windows |
| **5A-083** | P2 | 🟡 **Half the shadows are hard-typed black** | `globals.css` | 15 shadow declarations use a literal `rgba(0,0,0,…)` while 22 use a token. A shadow is a colour too: on a dark surface a black shadow is invisible, so every hard-typed one is a place a dark theme would need hand-editing (5A-071's argument, applied to depth rather than hue) | **Closed 2026-09-03** — 5 literals, not 15; two marker shadows kept apart |
| **5A-084** | P2 | 🟡 **No `::selection`, no `caret-color`** | sitewide | Neither is defined anywhere, so highlighting text and the text cursor both use the browser's default blue — which is not the brand blue. Small, cheap, and the kind of thing that reads as unfinished on a premium product | **Closed 2026-09-02** — `::selection`, `caret-color` |
| **5A-085** | P2 | 🟡 **Disabled controls are unreadable** | `/run`, buttons | `.btn-run:disabled` puts white text on `--border-strong` = **1.48:1**. The shared `Button` uses `disabled:opacity-50`, which lands the label at **1.55:1**. ⚠️ **WCAG exempts disabled controls**, so this is not a conformance failure — but *Run Analysis* is the primary action on the screener and its label cannot be read while it waits for input. Control: the same button enabled measures **6.49:1** | **Closed 2026-09-02** — disabled controls; the screener’s primary was 1.48:1, now 4.74 |
| **5A-086** | P2 | 🟢 **The focus ring PASSES — and I nearly filed a false failure** | sitewide | Tabbed through `/login`, `/pricing` and `/`: the indicator is `--brand-bright`, 2px solid, `outline-offset: 2px`, consistent on every control, measuring **3.64–4.03:1** against the surface it sits on. Inputs have no outline but change border `--border-strong` → `--brand-bright` **plus** a 3px glow — a clear, sufficient indicator. ⚠️ **My first pass reported four primary CTAs FAILING at 1.61–1.99:1, and it was wrong twice over:** I sampled 120ms after Tab, mid-`transition-all`, which returned a blended colour and a half-animated offset; and I compared the ring to the button's **own** background when a 2px offset puts it on the **page**. Two independent errors pointing the same way. **Probe defect #11**, and the fix was to sample twice and require the two to agree | **Pass 2026-09-02** |
| **5A-087** | P2 | 🟢 **The offline report inherits the palette correctly** | `report-bundle` | `scripts/build-report-bundle.mjs` concatenates `app/globals.css` into `report.css`, so the downloadable report carries the real tokens rather than a copy — the right architecture, and it means a palette fix reaches the paid artifact. ⚠️ **Caveat for the P2 work:** it is a **second build** (11d), so if tokens move to a new file that script must move with them, or the report silently keeps the old colours. Placeholder text also checked while here: `--text-muted` on white = **5.40:1**, passes | **Pass 2026-09-02** |
| **5A-088** | P2 | 🟠 **Contrast is POSITIONAL, because every tint is alpha** | palette | The tier tints are `rgba()`, so a badge's actual colour depends on what is behind it — the same chip is `#EEEDED` on a white card and `#E1E3E7` on `--bg-page`, and its text contrast moves with it. Measured: **Neutral 5.04:1 on a card, 4.59:1 on the page**; Cautious 5.26 → 4.78. ⚠️ **Two badges sit within 0.3 of the 4.5 floor purely because of WHERE they are placed**, and nothing controls placement — moving a chip from a card onto the page ground costs ~0.45 with no code change and no guard. Control: `--brand-light` is a solid colour and does not move at all, which is the argument for solid tints (or `color-mix` against a declared surface) rather than free alpha | **Closed 2026-09-03** — guard check 7 measures every badge ink on its tint, over BOTH grounds |
| **5A-089** | P2 | 🔴 **A data series is painted the SAME colour as the chart's own axis labels** | Relative Performance | `BENCH_COLOR['^GSPC'] = CHART_INK` — and `CHART_INK` is `#626B77`, the token for **axis ticks, legends and watermarks**. So the **S&P 500 line and the chart furniture are the identical colour (ΔE 0.0)**. A reader cannot tell the benchmark from the grid labelling, and the legend swatch that is supposed to identify it is the same grey as the text around it | **Closed 2026-09-02** — four distinct hues plus a distinct dash per series |
| **5A-090** | P2 | 🔴 **Two benchmark lines are both grey, and one pair collapses for a colour-blind reader** | Relative Performance | `^GSPC` is `#626B77` and `^AXJO` is `#6B6266` — **ΔE 8.8 in normal vision, 7.1 protan, 8.5 deutan.** The tier palette's own guard demands **16–34** between things that must be told apart. Worse, **`^AXJO` vs `^GSPTSE` measures ΔE 2.6 to a protanope**, essentially indistinguishable. Multiple benchmarks render together (`activeBenchTickers.map(...)`), so these can share one chart. ⚠️ **This is also the site's one genuine WCAG 1.4.1 exposure**: a line chart conveys series identity through colour, and a legend cannot disambiguate two series that are the same colour. ⚠️ And the code still says `// ASX 200 — gold` — `INK.neutral` stopped being gold in August | **Closed 2026-09-02** |
| **5A-091** | P2 | 🔴 **The email footer fails contrast — the August fix never reached the emails** | transactional email | `brandEmail.ts` sets the footer text to `#94A3B8` on `#F8FAFC`: **2.45:1** against a 4.5 floor. That grey is the same family as the site's pre-August `--text-muted` (#8A97A8, 2.97:1) which was darkened to fix **258 failing elements** — the emails kept the old value because they are a separate palette (5A-073). Every transactional email we send carries its legal / no-reply line in text that cannot be read comfortably. Controls in the same file all pass: body 17.74, brand name 17.65, sub-heading 7.76 | **Closed 2026-09-02** — footer `#5a6675`, verified in code: 2.45:1 → 5.59:1 |
| **5A-092** | P2 | 🟢 **Hover states are mostly derived** | `globals.css` | 53 `:hover` rules — **38 read a token**, 6 hard-type a colour (all alpha washes of brand or red), the rest change only transform or shadow. Better than the rest of the system; the six belong in 5A-071's cleanup rather than being their own finding | **Pass 2026-09-02** |
| **5A-093** | P2 | 🟢 **Balance Sheet and Opportunity Map series are safe** | charts | Every pair checked in normal vision and two simulated colour blindnesses. Balance Sheet's three stacked series separate by **ΔE 14.2–110**; the Opportunity Map's four quadrant washes by **14.1–138**. Both clear the tier palette's own 16–34 floors in normal vision and stay legible under dichromacy. **Only Relative Performance fails** (5A-089/090) | **Pass 2026-09-02** |
| **5A-094** | P2 | 🟢 **The Learn illustrations — measured, and the docs are ACCURATE** | `/learn` | Sampled the true corner pixels of all three at full resolution. Image 1 sits **5–6 RGB** from `--bg-page` (the corrected one), image 2 at **11–14**, image 3 at **15–19**. design-system.md §11 *“The three Learn skies”* states image 3 at **16** and image 2 at **11**, and records the residual as **knowingly accepted by the owner** — image 3 is the untouched original because every edited version scored worse on the composition. **My measurement reproduces the doc's numbers exactly, so there is nothing new here.** Recorded so a future sweep does not re-raise an accepted decision (the sweep's own rule). ⚠️ Their colours ARE baked in and cannot be re-themed, which belongs in the dark-mode plan rather than in a defect list | **Pass 2026-09-02** |
| **5A-095** | P2 | 🟡 **Two teals, and neither is a token** | charts, `/learn`, `/articles` | `SERIES_TEAL = '#0A7065'` (the TSX line) and the Learn/Articles house-style teal `#0E7C8B` are different colours doing the same job in the same product, and neither exists in `globals.css`. ΔE between them is large enough to read as two different accents on pages a reader moves between | **Closed 2026-09-02** — `FIGURE_TEAL` named |
| **5A-006** | P9 | 🟢 **Opportunity** | Vercel | **Speed Insights closes F-021.** Real-user p75 per route, reaches signed-in pages, immune to a single unlucky run — the instrument the audit said decision #33 was blocked on | **Owner decision.** Turn on before launch, since it needs traffic to report |

---

## Session log

| Session | Date | Passes covered | Findings |
|---|---|---|---|
| 13 | 2026-09-04 | **P3 on the LIVE site, free then entitled** — the first pass of this audit against production. Stock Detail **scrolled sideways at iPad-portrait width** (263 px at 644, breaking #3) with the correct fix already present and bounded at 600 px; **no dialog returned focus to its opener**, on the paywall surface; the signed-in app had **zero headings**, which our axe run could never have seen because the heading rules are tagged `best-practice`, not WCAG. Six fixed, four guards, two proven red by sabotage. ⚠️ **Two ledger entries RETRACTED** — 5A-104 (read at t=0 of a transition; it had been reported to the owner as fact and sat open two sessions) and 5A-113 (Radix uses `aria-hidden` on siblings by design; I came within a commit of "fixing" correct code) | 5A-111…5A-120; 4 instrument failures (13 total) |
| 11 | 2026-09-02 | **The five remaining audit questions, answered.** Two are serious: the **S&P 500 line is the same colour as the chart's own axis labels** (ΔE 0.0), and a second benchmark pair collapses to ΔE 2.6 for a colour-blind reader — the site's one real WCAG 1.4.1 exposure. The **transactional email footer measures 2.45:1**, because the August contrast fix never reached the separate email palette. Hover states, the Balance Sheet and Opportunity Map series all pass. ⚠️ The Learn illustrations were measured and the docs turned out to be **exactly right** — an accepted owner decision, deliberately NOT re-raised | 5A-089…5A-095 |
| 10 | 2026-09-02 | **P2 audited as a design SYSTEM rather than a set of colours**, at the owner's direction. Three variables are **read and never defined** — one is a live rendering bug in `NewsFeed`, one silently kills an animation on `/articles`. `--c-warn-ink` is defined and **never used** while the rating token identical to it is used in its place, which proves the alias problem is already happening rather than merely possible. The surface scale has **no steps** (six tokens within ΔE 6) and there is **no `color-scheme`**, which costs something today. ⚠️ The focus ring **passes** — my first measurement said otherwise and was wrong two ways at once | 5A-076…5A-087 |
| 9 | 2026-09-02 | **`/results` finished, and the token architecture question answered.** The screener was driven end to end — it does **not** navigate to `/results`, which is why it looked like a hang — and the rendered table confirms the badge drift on the most valuable paid surface. Then the owner's question: **one palette is serving at least twelve unrelated jobs across 30+ files**, 58 colours exist in no palette at all, and the missing amber has **already been invented twice by hand**. Proposal in *A palette per job* below | 5A-069…5A-075 |
| 8 | 2026-09-02 | **P2 deepened at the owner's direction — read the CODE, not just the screen.** The class they named turned out to be real and large: **four groups of tokens hold the same value today**, three of which put the rating palette and the direction palette on one colour, so choosing the wrong name is undetectable until one moves. Also: **no `--c-down-ink` exists** while its four siblings do; ~100 hard-typed literals duplicate a token; **two range gauges on one page run opposite gradients**; a drawdown percentage has **three** colours across the site; and the Cycle Position column is a coloured number whose documented legend **does not exist** and whose colour cut-points disagree with its own zones | 5A-057…5A-068 |
| 7 | 2026-09-02 | **P2 continued — `/account` × 10 states, the delisting banner, the public pages.** The finding that matters: the **`warn` tone on `/account` is grey**, so *Payment due* / *Access paused* / *On hold* are the most neutral thing on the screen — the palette moved under them in August and nothing traced it. Also named the root of 5A-041: **two colour conventions for a drawdown both ship**. Public pages are clean. ⚠️ One probe defect reported a clean result across **sixteen** pages before it was caught, and `/results` is honestly unfinished | 5A-050…5A-056 |
| 6 | 2026-09-02 | **P2 started — the palette layer and the paid page.** Nine findings: two places where one figure carries two opposite colours, a “middling” grey 9.5 from the “no data” grey against guarded floors of 16–34, a tint layer never re-based, a third party's rating in our verdict colour, and the design question under them all — **the site has no amber words**. One candidate investigated and **withdrawn** as deliberate. **Nothing changed on any paid surface** (11l). Still to sweep: screener + results, `/account` states, public pages, the delisting banner, Learn/Articles figures | 5A-041…5A-049 |
| 5 | 2026-09-02 | **P1 reviewed a THIRD time, this time against the P0 manifest row by row.** Nine “must contain” rows had no evidence either way; all nine pass, including the theme commitment and every boundary. Also fixed 5A-034 on the owner's instruction — their reading of it was wider and more accurate than mine. **No product defect found in this pass.** | 5A-038…5A-040; 1 more probe defect (9 total) |
| 4 | 2026-09-02 | **P1 reviewed on the owner's challenge, and it was NOT complete.** Walking the route inventory against the ledger — rather than re-reading the ledger — found `/reset-password` never opened and **neither error boundary ever rendered**. Both closed the same day, both clean. Two doc drifts also fixed: the P1 checkbox was still unticked and its line still said “9 viewer states”, corrected to 14 by 5A-009 in the manifest a day earlier. **P1 is complete now; it was not when I said so.** | 5A-035…5A-037; 1 more probe defect (8 total) |
| 3 | 2026-09-02 | **P1 finished properly.** The ~37 checks 5A-028 found missing: signed-in redirects, `/account` × 11 billing states, `/results` by entitlement, the five remaining edge tickers, all 12 Learn + 5 Articles pages, the conditional degradations and the boundaries. **Zero product defects.** A subscriber verified to SEE `64/100` and `83/100`, not merely receive them | 5A-028…5A-032; 1 more probe defect (7 total) |
| 2 | 2026-09-01 | **P5a + P1.** The landing's two snapshots had drifted 18 days apart and printed Apple twice (5A-013); regenerating broke the page's argument (5A-014). Split into four files by lifecycle, owner-approved copy rewritten, three guards added. Then P1: public pages, signed-in free, the 11 subscription states, both confinement states | 5A-013…5A-027; 6 probe defects |
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

---

# Final plan review — the loop, 2026-08-31

⚠️ **The owner asked me to keep interrogating the plan until I was genuinely happy rather than
declaring it.** Eight questions, eight answers, six changes. Written down because *"I reviewed it
and it's fine"* is the sentence that preceded both earlier P0 failures.

### Q1 · Will I re-report things the owner has already ruled on?
**Yes, without this list — and that is the fastest way to waste their time.** Six audits' worth of
accepted debt is scattered across two long documents. **These are KNOWN and must never appear as a
5a finding:**

| Known · accepted · do NOT re-raise | Where it goes |
|---|---|
| 375px overflow in the signed-in shell (~130px, the sidebar) | **Layer H** |
| Direction colours used as text (the remaining six) | **Layer H** |
| `[data-legacy-contrast]` on the screener score chips | **Layer H** |
| Ticker page Lighthouse 83–84 vs the 90 target | **F-021 — blocked on an instrument** |
| Vercel Hobby → Pro | Deferred, owner |
| Four thin subscription states showing "no subscription" | **F-005 → Layer 5b** |
| Five index members that are not fetchable companies | **F-030 — recorded, no action** |
| Legal page TEXT is `BASELINE CONTENT` pending professional review | Owner |
| Results table's bare `$` for USD/AUD/CAD | **Owner explicitly kept it** |
| `/about` and `/glossary` | Dropped 2026-08-22 |
| The public documents' 13px body size | **Genuinely open** — owner decision |
| Replace the dead Stooq source? · the 120 `split_events` rows | **Genuinely open** — owner decision |

**If I find one of these again, the correct action is silence, not a finding.**

### Q2 · Is "22 routes × 14 states" executable? — **No. 308 combinations is not a plan.**
And most are meaningless: a public page renders identically in `active` and `past_due`. Scoped by
**what actually varies**:

| Group | Axis that matters | Checks |
|---|---|---|
| 13 public pages | signed-out vs signed-in (redirect behaviour only) | ~26 |
| `/account/update-password` · `/reactivate` · `/deletion-requested` | their own confinement state, plus a stranger and a stale marker | ~9 |
| `/account` | **all 14** — it is the only page that renders billing | 14 |
| `/run` · `/results` | entitled vs **each denial reason** — where the paywall decision lives | ~12 |
| `/stocks` · `/stocks/[m]/[t]` · `/request` | entitled vs not, plus the 7 edge tickers | ~16 |

**≈ 77 meaningful checks, not 308** — and each of the 231 dropped is dropped *because the page
cannot vary on that axis*, which is a reason, not a shortcut.

### Q3 · Could a later pass invalidate an earlier one? — **Yes, and it would have.**
P5 re-derives the landing's 16 frozen claims. Regenerating that snapshot is a **content change**
(11k): new numbers, possibly a new tier colour, possibly moved Opportunity-Map labels. Doing it
after P1/P2 would invalidate both on the most-viewed page.
**→ Change: re-derive the landing figures FIRST, as step P5a, before P1 opens a page.**

### Q4 · What happens after I fix something? — **Nothing was defined.**
**→ Change: any fix re-runs the passes already completed *for that page*, and `pnpm gates`
locally before any push.** A public mobile fix in P8 can move the colour ground measured in P2.

### Q5 · Am I missing a whole pass? — **No, but I was about to trespass.**
`roadmap.md` shows **Layer H sits between G and launch and owns 375px, accessibility,
cross-browser and Sentry.** So: deep a11y, other browsers and error monitoring are **H's, not
mine**. 5a runs the existing a11y suites as a regression check (P7) and stops there.
⚠️ **This also corrects my own launch-readiness note**, which said *"nothing watches the web app
for errors"* as though it were an oversight. **It is planned — Sentry, Layer H.** Still true that
it is absent at launch if H is skipped; not true that nobody thought of it.

### Q6 · Who does what? — **Undefined.**
**→ Change:** I do the measuring and the fixing of measurable defects on **public** surfaces. The
owner rules on anything touching a **paid** surface (11l), anything that is a matter of taste, and
the four dashboard items. 5b is theirs entirely.

### Q7 · How do findings reach the owner? — **Undefined, and they are non-technical.**
**→ Change: report per PASS, not per finding.** Each report: what was checked, what was found,
severity, and **one recommended action per finding**. Anything blocking launch is raised
immediately rather than held for the pass summary.

### Q8 · Is this sized for 2–4 sessions? — **Now, roughly.**
P5a + P1 + P2 is a session. P3 + P4 is a session. P5–P7 is a session. P8 plus fixes and
re-verification is a session. **If it runs longer I say so rather than thinning the checks** —
this project's own history is that a sweep quietly narrowed is worse than one openly unfinished.

---

## P2 — the owner's decisions, 2026-09-02

Taken before any code was written. Each was put with the measurements behind it.

| # | Decision | Owner's answer |
|---|---|---|
| 1 | **A caution colour** | **Yes — a traffic light: green / yellow / red.** ⚠️ The owner overruled my recommendation to keep amber out of the ratings, and the reasoning is better than mine: *“it is not about visibility, it's about common sense. Traffic lights are typically used to say between good, neutral and bad… going from green, grey and red doesn't make sense.”* |
| 2 | **Which colours may move** | **All five.** *“You are free to move any colors in the rating band.”* |
| 3 | **Yellow, given it cannot be legible text** | **Badge bright, text dark.** The true traffic-light yellow on every chip, bar, dot and gauge; a dark mustard only where a tier must render as bare text |
| 4 | **Brand fit** | **Tuned to the navy brand**, not stock traffic-light colours. Exact swatches + measurements to the owner before anything ships |
| 5 | **The fall percentage** | **Coloured by the stock's VALUATION tier**, because the drawdown is what the valuation is computed from. It stops being green merely for being deep |
| 6 | **Rollout** | **Names first, colours after.** New tokens point at today's exact values so nothing moves visually; every colour change lands afterwards as its own reviewable step |
| 7 | **Dark mode** | **Structure now, no theme.** Build so a dark theme is later a config change, ship nothing dark, and fix the missing `color-scheme` which costs something today |

### The measurements these rest on

**Yellow cannot be a legible word on a light page.** Searched the whole yellow band
(hue 38–66, saturation ≥ .45) for anything reaching 4.5:1 on **both** white and
`--bg-page`: the lightest that qualifies is **`#876B33`**, a dark mustard. Yellow is
intrinsically light, so darkening it to legibility turns it brown. **This is physics,
not taste**, and it is why the August search concluded gold was unsalvageable.

**As a CHIP it works.** `#FACC15` carrying `#713F12` text measures **5.66:1**, and a
five-rung chip ladder separates by **18.5 at worst** including protanopia and
deuteranopia — comfortably past the 16 floor. ⚠️ **This is only possible because the
chip colour and the text colour are different tokens**, which is exactly what the
split in *A palette per job* creates. The architecture work is what unlocks the
owner's traffic light.

**Why amber at *Neutral* failed when Cautious was fixed:** `#B45309` beside the
orange-red `#C73600` measures **0.5** to a deuteranope — the same colour. Freeing all
five (decision 2) is what makes the ladder solvable.

### ✅ APPLIED 2026-09-02 — Neutral is gold, the fall % has no colour

Both approved by the owner on the measurements. Described below as three steps because
that is the order they were built and verified in — but they landed as **one commit**,
deliberately: `globals.css` and `lib/ratings.ts` each carry two of the three, so
splitting them afterwards would have meant hand-reverting and re-applying colour values
on a live palette. Commit tidiness is not worth that risk, and claiming a revert
granularity that does not exist is worse than not having it.

**Step 1 — the borrowers were pinned first, zero visual change.** Eighteen tokens were
added, each holding *byte-identical* the value it had been inheriting, and fourteen
files re-pointed at them. Without this, one edit to Neutral would also have repainted a
CSV import warning, the "Skipped" count on a run, a billing warning on `/account`, the
trial modal's notice, the short-interest band, three Learn figures, the 52-week gauge
and four landing accents — none of them our judgement about a stock. Proven by asserting
every new token's value equals the one it replaced before anything else moved.

⚠️ **Pinning is NOT a decision that these should stay grey** — it makes each one a
visible question instead of a side effect (11l). **The first was answered the same day:
the owner asked for Financial Health's *Adequate* to be gold**, which is what the comment
beside it in `lib/ratings.ts` had claimed since the palette was gold. The other twelve
remain grey and unasked.

⚠️ **Health is the one domain where ALIASING is right, and it is worth saying why**, since
it is the exact opposite of what every other token in that block does.
`--health-good/-adequate/-at-risk` point at `--c-tier-1/3/5` rather than holding their own
literals: green/amber/red for good/adequate/at-risk is genuinely the *same* design
decision as the rating ladder's, so two golds that merely matched today would drift the
next time one moved — and two slightly different golds on one screen is precisely the
defect nobody spots (11c-viii). The gain over where this started is still real: the health
concept now has a **name**, where before `healthColor()` simply reached for
`var(--c-tier-3)` and nothing recorded that a decision had been made. The coupling is
declared instead of accidental, and three lines break it if the two ever need to part.

**Step 2 — `--c-tier-3` `#72696D` → `#9C5B01`**, ink `#6B6266` → `#895001` (the tier ×
0.88), tint rebuilt from the original gold `#D4A017` the way tiers 2 and 5 are built
from their own pre-darkening ancestors. `RATING_TIER_HEX[3]` moved in the same commit;
the two `SEPARATION` ratchets were re-based deliberately, with the reasoning in the
guard.

**Step 3 — Current DD% carries no colour**, in the screener and on the landing. The
`'drawdown'` case was **deleted** from `metricTintColor` and from `TintKind` rather than
left unused, so re-applying it is now a type error — the only thing that makes an
omission visible.

**Verified in the browser, not in the source** (`getComputedStyle` on a running server):
tokens `#9c5b01` / `#895001` / `rgba(212,160,23,.12)`; the Neutral badge drawing
`rgb(137,80,1)` on its gold tint; Neutral score chips `rgb(156,91,1)` under white; all
eight pinned tokens still `#72696d`; every fall-% cell `rgb(15,25,35)`, no tint.
`pnpm gates --no-e2e` 15/15.

⚠️ **Two instrument failures on the way, both worth remembering.** (i) The first reading
said the gold had not applied — `--c-tier-3` still `#72696d` and every new token empty. I
blamed the `.next-dev` cache (11i), deleted it (3,671 files, confirmed gone) and got the
*same* answer. Fetching the stylesheet the page had actually linked showed it contained
the gold all along: **I was measuring a DOM rendered before the restart.** The boring
explanation was one level more boring than the one I reached for. (ii) The undefined-token
probe kept reporting `--c-mid` as missing *after* it was fixed, because the comment
documenting the fix contains the string — the same trap that has bitten this repo's own
guards twice (`public-chrome.spec.ts`, the artifact build). A scan over source text must
strip comments or it will fail on its own documentation.

### ✅ P2 APPLIED IN FULL — 2026-09-02

Four editorial questions went to the owner with the measurements behind them, and all
four were answered before any of this was written:

| Question | Answer |
|---|---|
| A fall is coloured three different ways sitewide | **Never colour a raw market number.** Colour is for our ratings, for status, and for identifying a line on a chart |
| Two range gauges on one page run opposite gradients | **Neutral track, marker only** — the gauge shows *where*, and makes no claim about whether that is good |
| Billing warnings render grey on grey | **A proper amber, on its own token** |
| Yahoo's *Sell* wears our Bearish colour | **Third-party data gets its own quiet palette** |

**What that closed, and how.**

*The colour language* (5A-041 · 042 · 051 · 060 · 062 · 063 · 069). The KPI drawdown ramp,
the screener's Current DD%, the landing's worked run, the Cycle Position cell and both
range gauges no longer carry a verdict. `drawdownColor()` and `cyclePositionColor()` were
**deleted** rather than left unused, and `KpiCard.accentColor` became optional — so a card
without one is a stated fact and a card with one is our judgement, enforced by the type.

*The amber* (5A-046 · 050 · 072 · 079). `--status-warning` and its ink, tint, surface and
border. The values are not new: the product had already needed an amber twice and invented
one by hand both times — five stray literals across the Smart Money pill and the
premium-lock notice — so this consolidates rather than adds. ⚠️ **It sits 1.8 from
*Cautious* to a colour-blind reader and that is accepted, not missed**: the rating ramp
already occupies the whole warm range, every legible dark amber lands in it, the two never
appear as peer chips, and each warning carries its own words.

*The analyst palette* (5A-045). `--analyst-positive / -neutral / -negative`, mirrored in
`lib/ink.ts` for the chart props. (⚠️ That mirror was justified at the time as "chart props
cannot read a variable"; measured on 2026-09-03 that is false for Recharts and true only for
Lightweight Charts' canvas — see the correction below.) Measured 16.8 from
Constructive and 12.6 from Bearish, and **guarded** — check 6 fails if either drifts back.

*The chart series* (5A-089 · 090 · 095). This was the site's one genuine WCAG 1.4.1
exposure: `^GSPC` was painted in `CHART_INK`, the token for axis ticks — the S&P 500 line
and the chart's own furniture were the identical colour — and `^AXJO` vs `^GSPTSE` measured
2.6 to a protanope. Four distinct hues now, plus **a distinct dash per series**, so colour
is never the only channel. ⚠️ The dash is what actually satisfies the rule: the weakest
colour pair is still 5.9, and no five-line palette clears 16 everywhere without turning to
mud (that search was run, twice).

*The copies* (5A-059 · 064 · 073 · 076 · 077 · 095). The Learn drawdown palette now derives
from `DRAWDOWN` in `chartTheme.ts` instead of restating it — and **it had already drifted**:
its average line was `#D4A017`, the pre-August gold, while the product draws that rule in
grey, so the figure teaching a reader what a drawdown looks like no longer matched the chart
it describes. The audit had recorded the three shared values as still agreeing; checking the
fourth showed they did not. Both teals are named (`SERIES_TEAL`, `FIGURE_TEAL` — the second
is welded to the Learn illustrations, which cannot be regenerated). The ten email literals
became one `EMAIL` object, and its footer went from **2.45:1 to 5.59:1**.

*The browser-facing gaps* (5A-081 · 084 · 085). `color-scheme: light` — which costs
something today rather than being dark-mode preparation: without it the native `<select>`
popup the screener filters use, scrollbars and autofill follow the *operating system*, so a
visitor in dark mode could get a dark dropdown over a light page. Plus `::selection`,
`caret-color`, and disabled controls (the screener's primary action had a label at 1.48:1;
now a light fill with dark ink at 4.74).

**Guarded.** `check-tier-palette` gained **check 6** — every non-rating token measured on the
ground it really sits on, plus a distance floor between the analyst palette and our verdict
colours. Broken on purpose three ways before being trusted: the analyst red moved onto
Bearish (caught, 0.0 apart), the warning ink lightened (caught, 2.06), and `--c-down-ink`
deleted (caught twice, by two different assertions).

⚠️ **5A-078 closed on the owner's word, and it was bigger than recorded.** The finding
named one dead rule, `.tier-legend-swatch`, and its undefined `--tier`. Checking before
deleting showed the **whole `.tier-legend*` block** was orphaned — six rules and a media
query, left behind when `/methodology` was deleted in Layer G, still compiled into every
stylesheet the site *and the offline report* ship. Nothing has rendered those classes
since. ⚠️ The landing page's legend, which is the only place all five tiers appear
publicly, was never a consumer: it uses its own inline layout and the real
`.tier-badge--N`, and the contrast guard hooks it by the `data-tier-legend` **attribute**
precisely so a styling change cannot rename it out from under the test. Verified before
removal, not after.

⚠️ **Still open, and deliberately not done.** The Opportunity Map's private palette
(5A-074), the surface-scale ramp (5A-080), the hard-typed shadows (5A-083), Windows High
Contrast (5A-082) and the landing's old-gold washes (5A-098) are recorded and untouched.

### 5A-096 · today's Neutral badge measured 4.59 on `--bg-page`, and the note claims 4.82

Found while choosing the gold's ink. `.tier-badge--3` in grey composited to `#E1E3E7` on
the page ground and its `#6B6266` ink scored **4.59** — above WCAG's 4.5, below this
repo's own 4.8 floor, and `globals.css` states 4.82 for that exact pairing. **The guard
cannot see it**: it measures the ink on the *plain* page, while the badge draws it on a
*tint*, which is darker. Cautious sits at **4.81** on the same measurement, i.e. also on
its floor. Fixed for tier 3 as a side effect (the gold ink scores 5.42 there); tier 4 is
**open**, and the general fix is to measure the ink where the badge actually draws it.

### 5A-097 · Constructive vs Cautious is 3.9 to a DEUTERANOPE, and nothing checked it

The palette's weakest pair by a wide margin — worse than either pair the gold introduces
— and it is **unchanged by any of this work**. It survives because `check-tier-palette`
compares only ADJACENT tiers and those two are two apart, while a results table puts all
five on screen at once, so every pair is a real comparison. Widening the check to all ten
pairs would fail on the day it was written, which is how ratchets get loosened rather
than obeyed; it needs its own decision.

⚠️ **THE FINDING NAMED THE WRONG DEFICIENCY, and that would have cost someone real time.**
Re-measured 2026-09-03: to a **protanope** these two are **15.1** apart; it is a
**deuteranope** who sees 3.9. Both are loosely called "red-green colour blindness" and they
are different simulations — deuteranopia is also the commoner of the two. The number was
right and the reader it described was not, so anyone acting on the original sentence would
have hunted along the wrong axis of the colour space and found nothing wrong.

✅ **SETTLED 2026-09-03 — owner: leave the colours as they are.** The check is now widened to
**all ten pairs**, ratcheted at today's measurements, so nothing is repainted, nothing is
loosened, and the weak pairs are **printed on every guard run** instead of living in a
document nobody re-reads. They can no longer get quietly worse.

### 5A-098 · the landing pairs an old-gold wash with a grey border and heading

`.lp .callout` washes `#fdf9ef` and `.lp .q-br` washes `rgba(212,160,23,…)` — both from
the days when this tier was gold — while the border and heading on top of them had gone
grey in August. Those accents were `--accent-warm`, **pinned to grey** through the first P2
pass, so the mismatch was *preserved* rather than fixed — repainting a marketing page was not
what had been approved.

✅ **CLOSED 2026-09-03, owner-approved as its own decision.** `--accent-warm` and
`--accent-warm-ink` now point at the rating gold, so the callout's rule and heading agree with
the gold wash beneath them. Measured: `#895001` is **6.22** on the callout wash, **6.54** on
white and **5.92** on `--bg-page` — better on every ground than the grey it replaces
(5.60 / 5.89 / 5.33), so this closes a visual mismatch and gains contrast rather than trading it
away. ⚠️ It stays a **separate name pointing at** the rating gold rather than becoming it, so
the next time the rating gold is retuned this is a decision here and not a consequence.

### 5A-099 · `var(--ease)` is referenced and has never been defined

`articles.css` sets `transition: transform .25s var(--ease)` on the read-more arrow. An
undefined custom property does not fall back — it voids the whole declaration — so that
transition has never run. Motion rather than colour, so deliberately left out of this
change. Found by the same sweep that caught `--c-mid` in `NewsFeed` (fixed there: it had
never existed, so the brand blue on the source pill never applied).

✅ **CLOSED 2026-09-03** — `--ease: cubic-bezier(0.4, 0, 0.2, 1)` defined on `:root`,
verified resolving in the browser. The arrow's transition runs for the first time.

## ✅ P2 CLOSED IN FULL — 2026-09-03

The five items the first pass recorded as *"still open, and deliberately not done"* are
done, plus the three loose findings above. **Every one of them was measured before it was
touched, and four of the five turned out to be materially different from what the ledger
said.** That is the part worth reading.

### The findings that were wrong, and how

| Finding | What it recorded | What was measured |
|---|---|---|
| **5A-074** | the Opportunity Map's palette *"appears only there"* | the dark tooltip is hand-typed **34 times across 9 components** — Balance Sheet, Dividend History, Earnings History, Ownership Structure, Quarterly Financials, Relative Performance, Snowflake Radar, Valuation History and the map. It was never one chart's private palette; it is a site-wide surface that nine components each invented separately and identically. Only the four quadrant washes really were private |
| **5A-083** | *"15 shadow declarations use a literal `rgba(0,0,0,…)`"* | **5**, in 3 files. The count was taken before the P2 gauge work, which had already removed most of them. Re-measuring is what stopped an afternoon being spent on ten that no longer existed |
| **5A-097** | Constructive vs Cautious is *"3.9 to a protanope"* | 3.9 to a **deuteranope**; to a protanope they are **15.1** apart. The number was right and the reader it described was not — which would have sent anyone trying to fix it at the wrong axis. Deuteranopia is also the commoner of the two |
| **5A-096** | tier 4's badge ink is *"open"* | already fixed as a side effect of the tier-4 ink change on 2026-09-02. Re-measured on the real tint: **5.14** on a table row, 5.65 on a card. What remained open was the *guard*, not the colour |
| **5A-071** | 145 literal colours | **171** when re-counted — it had *grown* while the finding sat open. 135 after the chart sweep; the remainder are accounted for below |

### And a defect the P2 work itself introduced

⚠️ **The Smart Money chart's "Analyst Event" legend was showing three colours no marker on
that chart used any more.** The 2026-09-02 change moved analyst events onto `ANALYST.*` so
a third party's *Sell* would stop wearing our Bearish colour (5A-045); the markers moved,
the legend beside them did not. It was hard-typed `#228B22 / #D4A017 / #B22222` — the
**pre-August** direction palette — against markers now drawn in `#2E6B57 / #4A5568 /
#7A2F3F`.

Nothing errored. The legend looked completely normal, on a paid surface, and every gate was
green. **It was found by a literal sweep, not by review** — which is 11c-iv again, the
consumer that never received the rule, and a reminder that a change with a guard on it is
not the same as a change that was finished. It is now **derived**: the three swatches ask
`gradeColor()` the same question the markers ask, so a repeat is impossible rather than
merely unlikely.

### What was built

**One dark tooltip** (`CHART_TOOLTIP`), **one candle pair** (`CANDLE`), **one set of chart
furniture** (`CHART_CHROME` — grid, crosshair, crosshair label, axis, identical in all three
Lightweight-Charts components and hand-typed in all three), **one brand triple** (`BRAND`),
and **the profit half of the drawdown overlay** (`PROFIT`) — whose four values sat on the
other branch of the same ternary, eight lines from the `DRAWDOWN` extraction that missed
them.

**The Opportunity Map's zones** now have one definition serving three consumers: the paid
chart, the landing page's still of it, and `landing.css`. Stored as an RGB triplet
(`--zone-good-rgb`) so one value covers both the chart's alphas and the legend's heavier
ones. ⚠️ Two of the four are **retired rating hues** — the pre-August High Conviction green
and the pre-August gold — and they are **named, not repainted**: `/results` is a paid
surface (11l).

**A surface elevation ramp** (`--elev-sunken / -low / -mid / -high`), which the six `--bg-*`
names now alias. ⚠️ **The values are unchanged and that is deliberate.** 5A-080 measured
every surface pair inside ΔE 5 with three at ΔE 0 and reported it as a defect; in a *light*
theme it is not one — surfaces are separated by a border and a shadow, not by contrast, and
spreading them apart would repaint the whole product to fix a number rather than a problem.
What the finding is really about is the next theme: **a dark theme inverts by re-pointing
elevation, and there was no elevation to re-point.** Three of the levels are the same white
today, and naming them separately is exactly what lets a dark theme pull them apart without
touching a single component.

**Shadows and ticks** (5A-083): `--shadow-marker`, `--shadow-marker-sm`, `--marker-ring`,
`--shadow-segment`, `--track-tick`. ⚠️ **Two marker shadows, not one.** My first pass
collapsed them — they are `0 2px 6px` and `0 1px 3px`, for an 18px dot and a 9px one — which
would have doubled the blur under the smaller marker on a Stock Detail card nobody asked me
to touch. A shared *name* is the defect a palette needs fixing; a shared *value* is not
something to manufacture.

**The column-group band palette** (5A-071): the screener's five subject-area headers, which
existed only inside `.results-table .band-*`. Measured before naming — ink on its own wash,
9.76 / 8.15 / 8.66 / 5.99 / 8.24. They are **category** colours, not a ramp: green there
means *price*, not *good*, which is why they must not borrow from the rating palette.

**Windows High Contrast** (5A-082), the site's first `forced-colors` rules: charts and
gauges opt out with `forced-color-adjust: none`, because the colour *is* the data; tinted
chips gain a `currentColor` outline, because the wash is erased and a chip with no wash
stops looking like a chip; cards gain an edge, because `box-shadow` is dropped entirely; the
focus ring moves to the system `Highlight`. ⚠️ I have no Windows High Contrast toggle here,
so this is written from the specification and verified only as far as *"the rules parse,
apply, and aim at elements that exist"*. Seeing it on a real Windows machine is an owner
check worth doing before launch rather than after.

**`--ease`** (5A-099), one line. The read-more arrow's transition had never run.

**The landing's warm accents** (5A-098), owner-approved as its own decision. `--accent-warm`
and its ink now point at the rating gold, so the callout's rule and heading agree with the
gold wash they sit on — a mismatch that had been live since August. Measured: `#895001` is
6.22 on the callout wash, 6.54 on white and 5.92 on `--bg-page`, **better on every ground
than the grey it replaces** (5.60 / 5.89 / 5.33), so this closes a visual mismatch and gains
contrast rather than trading it away. It stays a separate name *pointing at* the rating gold
rather than becoming it, so the next rating retune is a decision here and not a consequence.

### The guard grew from five checks to nine

| Check | What it asserts | Broken on purpose |
|---|---|---|
| **5** → all ten tier pairs | the six NON-adjacent pairs had never been measured, and the site's weakest pair (2–4, 3.9 to a deuteranope) was one of them. Ratcheted at today's numbers, so nothing is loosened and nothing can quietly get worse | nudging Cautious toward Constructive — caught on 3–4, **1–4 and 2–4**, the last two invisible before |
| **7** badge ink on its real tint | every earlier check measures an ink on a FLAT ground; a badge draws on an alpha wash, which is darker | 4 ways, the first being tier 4's pre-fix ink: **caught at 4.69 while check 3 passed**, which is the entire argument for the check |
| **8** the zone pair | the paid chart and the landing's still of it cannot draw different colours | — |
| **8b** the canvas mirrors | `BRAND` and `CHART_CHROME` must equal their tokens. This is the 29-literal drift of August, one library along | 2 ways, and a third **through the new alias** — because "follows an alias" could equally have meant "returns null and passes" |
| **9** the forced-colors block names real things | ⚠️ **written because I made this exact mistake.** My first draft listed `.wk-track` for the 52-week gauge; there is no such class. A CSS selector matching nothing is completely silent — the stylesheet is valid, the build is green, and the one chart element that most needed the opt-out is the one that did not get it. Found by reading the rule back off a running browser, which is the only place the difference shows | reintroducing `.wk-track` — caught by name |

⚠️ **And check 8b went red the moment the elevation ramp landed**, because
`--bg-page: var(--elev-sunken)` made the value unreadable to a token reader that skipped
aliases. That is the right failure and the reason it says *"could not be read"* rather than
passing: a reader that cannot see through the architecture goes blind exactly as the
architecture improves (14g). It now resolves aliases, depth-limited, with a control proving
it still catches drift *through* one.

### A claim in our own docs, corrected by measurement

`lib/ink.ts` said a Recharts `fill`/`stroke` prop *"is an SVG attribute, where `var(--x)` is
not resolved"*. **Measured in Chrome: it resolves.** A presentation attribute is parsed as a
CSS value, so `fill="var(--brand-deep)"` computes to `rgb(26, 58, 110)`, identical to the
literal — and two Opportunity Map quadrant labels have been shipping exactly that.

The line that IS true is the one the file actually rests on: **Lightweight Charts paints to
a `<canvas>`**, where there is no stylesheet behind the colour string and `var()` is simply
unparseable.

⚠️ The same probe found the sharper reason to keep TypeScript constants for Recharts as
well: an **undefined** custom property in a `fill` does not void the declaration the way it
does in a CSS shorthand — it computes to **black**. `fill="var(--typo)"` paints a chart label
plain black on a light chart, which reads as deliberate and errors nowhere. A mistyped
TypeScript identifier is a build failure. *Where both routes work, take the one whose
mistakes are loud.*

### 5A-100 · P2 moved a component and left the doc that REASONED about it

Found on the final P2 re-read, 2026-09-03. `design-system.md`’s delisting-notice section
justified using rating-tier tokens for a red banner on two grounds: that *“the site owns no
warning colour”*, and that the banner it copies (`SubscriptionCard`) *“is already built from
the rating tier tokens”*. **P2 falsified both, two days after they were written** — it created
`--status-warning` and moved `SubscriptionCard` onto it, which was the entire point of 5A-050
(a billing warning borrowing tier 3 had gone grey on grey when the rating palette moved).

The banner itself needs no change: red is an owner decision, a delisting is a terminal fact
rather than a warning, and it measures **8.06** on a card and **7.32** on the page. The defect
is the paragraph — anyone reading it would conclude the product still has no warning colour
and reach for a rating token again.

⚠️ **The shape is worth more than the instance.** P2’s own doc updates were thorough about
everything it TOUCHED; this is a doc that merely CITED one of the things it touched, three
sections away in a different file. **Grep for what a change is cited by, not only for what it
changes.** Same family as 11ae — a correct sentence describing superseded work closes a
question that is open.

### The four surfaces the tier palette is drawn on — all verified

The P2 line says *“tier palette across all 4 surfaces”* and never named them. Enumerated and
checked 2026-09-03:

| Surface | How it was verified |
|---|---|
| The signed-in app | `check:tier-palette` (9 checks) + read back off a running browser |
| The **offline report** | it is a SEPARATE esbuild build and has shipped broken before (11d), so the built artifact was grepped rather than the source: `report.css` carries the new gold, the elevation ramp, the zone triplets, the shadow tokens and the forced-colors block |
| The **`.xlsx` export** | `TIER_ARGB` is derived from `RATING_TIER_HEX`, so it followed the gold with no edit. It writes **white bold text on the tier fill**, which is exactly the guard’s “white-on-it” column — lowest is 5.31. ⚠️ No guard reads a workbook’s fills, so the derivation IS the protection here |
| The landing and public pages | 89 public-surface tests, plus the contrast guard’s “the public site still needs no exemption at all” |

Two surfaces carry **no** tier colour and were checked rather than assumed: the transactional
emails, and the `.csv` export (text only).

### Still open, and why

| Item | Why it is not done |
|---|---|
| **5A-097** · Constructive vs Cautious at 3.9 to a deuteranope | improving it means moving an owner-approved rating colour, which is not mine to do (11l). It is now **printed on every guard run** and ratcheted so it cannot worsen — a decision for the owner with the numbers in front of them, rather than a sentence in a document nobody re-reads |
| **5A-071** · ~135 remaining literals | mostly alphas of the brand blue in shadows and chart fills — `rgba(30,92,179,.08 / .10 / .15 / .25 / .35)`. Each needs its own judgement about whether it is a tint, a shadow or a series fill, and none is a drift risk now that the palettes they orbit are named and guarded. The heavy, drift-prone copies are closed |
| The `--elev-*` ramp having no dark values | that is the dark theme itself, and it is not in Phase 1 scope. The ramp exists so that work is a re-point rather than a rewrite |

### ⚠️ One consequence to settle before building — the fall % is a FREE field

Decision 5 colours the fall percentage by the **Valuation tier**. Valuation is
**premium** (`PREMIUM_FIELDS`), and *Current Drawdown* is **free** — deliberately, and
it is the field every paywall test uses as its readiness signal.

**So colouring a free number by a paid rating leaks the paid rating through colour.**
It is CLAUDE.md **11b** in a new form: the value is withheld from the DOM and its
*meaning* is published anyway, in a channel no entitlement guard inspects. A free
reader could read the Valuation tier off five stocks by eye.

**Proposed resolution, for the owner:** the fall % takes the valuation tier colour
**only for an entitled viewer**; for everyone else it renders in plain text. That keeps
decision 5 intact where it was aimed (the paid analysis) and keeps the paywall whole.
`check:entitlement-gates` to gain an assertion that no free surface carries a
tier colour.

---

## A palette per job — the P2 proposal

⚠️ **Written 2026-09-02, at the owner's direction, and NOT yet applied.** The question was:
*do we need to separate the colour variables per case?* The measured answer is yes — 5A-070
found one palette serving twelve jobs, 5A-057 found four groups of tokens holding the same
value, and 5A-072 found the missing amber already invented by hand twice.

**The failure this prevents.** Today, retuning *Cautious* because a rating chip looks wrong
also repaints CSV import warnings, skipped-ticker counts, billing warnings and short-interest
bands. Nothing links those to the rating, nothing warns you, and every one of them still
renders perfectly afterwards.

### Two layers, and only the bottom one knows a hue

| Layer | What it is | Who reads it |
|---|---|---|
| **Primitives** | the raw ramps — `--green-700`, `--red-800`, `--amber-600`, `--grey-500`, `--blue-600` … | **nothing in a component, ever** |
| **Semantic** | what the colour MEANS in one domain — `--rating-4`, `--status-warning`, `--dir-down` | every component |

A dark mode then re-points the semantic layer at different primitives. **That is the whole
reason for the split**, and it is why a hard-typed literal (5A-071: 58 of them) is not a
tidiness problem — it is a colour that cannot be re-pointed.

### The domains, each with its own names

| Domain | Tokens | Why it cannot share |
|---|---|---|
| **Brand** | `--brand-deep / mid / bright / light`, `--brand-ink` | identity, not meaning |
| **Surface** | `--surface-page / card / raised / sunken / hover / stripe / inverse` | the three whites are one token today by accident |
| **Border** | `--border-subtle / default / strong / focus` | — |
| **Text** | `--text-primary / secondary / muted / disabled / on-dark / link` | — |
| **Rating** (our judgement, 5) | `--rating-1…5` + `-ink`, `-tint`, `-tint-strong` | THE product opinion; must move alone |
| **Health** (3) | `--health-good / adequate / at-risk` | three tiers, not five — aliasing rating is why *Adequate* is grey |
| **Cycle depth** | `--cycle-deep / typical / shallow` | 5A-069: “barely fallen” is painted **Bearish red** today. It is not a verdict |
| **Direction** | `--dir-up / down / flat` + `-ink`, `-tint` | market movement, not our opinion |
| **Analyst (third party)** | `--analyst-positive / neutral / negative` | 5A-045: a Yahoo *Sell* must never wear our Bearish colour |
| **Status / feedback** | `--status-success / warning / danger / info` + `-ink`, `-tint` | forms, CSV import, run progress, toasts |
| **Billing** | `--billing-ok / attention / blocked / inactive` | 5A-050: the warning went grey because it borrowed a rating token |
| **Data state** | `--data-missing` | 5A-043: must be visibly distinct from *Neutral*, which it is not (ΔE 9.5) |
| **Chart** | `--chart-grid / axis / crosshair`, `--series-1…n` | 5A-074: the Opportunity Map has a private palette |
| **Notice** | `--notice-info / warning / critical` | the delisting banner, premium-lock notices |

⚠️ **Several will START as aliases of the same hue, and that is correct** — the point is not
that they look different on day one, it is that each can be changed without touching the
others. A shared *value* is fine; a shared *name* is the defect.

### What has to be true when it is done

1. No component references a primitive; no component hard-types a colour a token could supply.
2. `check:tier-palette` extended to every domain, and it must read **`rgba()` as well as hex** —
   the format blind spot that hid `compositionRamp` for a month (11c-viii) and hides the tier-1
   and tier-4 badge backgrounds today (5A-044).
3. A guard asserting **no two semantic tokens in DIFFERENT domains share a value silently** —
   or, where they must, that the sharing is declared in one place (5A-057).
4. `design-system.md` §2 regenerated FROM `globals.css` rather than maintained beside it, since
   it has been wrong in five places since August (5A-048).

---

## The revised pass order

~~`P5a` re-derive the landing's 16 figures~~ ✅ → ~~`P1` renders + compliant~~ ✅ **DONE 2026-09-02** → `P2` colour →
~~`P3` interaction~~ ✅ → ~~`P4` data edge cases~~ ✅ → ~~`P5` content, copy, links~~ ✅ **DONE 2026-09-05** →
`P6` not-the-screen → `P7` the three unrun gates + a11y regression → `P8` 375px public

**Am I 100% happy now?** With the plan, yes — every set in it is derived from something
executable, its scope is bounded by a stated reason, and it says who does what and what it cannot
see. **Not with my record**: I have said "complete" three times today and been wrong twice. So the
plan carries one last rule — **P1's first finding of a page section absent from the manifest means
the manifest was still incomplete, and P0 reopens.**
