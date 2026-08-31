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
| **5A-005** | P5 | 🟡 **To confirm** | `/` landing | Published counts and rankings are frozen at **`asOf: 2026-08-13`**, 18 days old. 11k records the same snapshot going false in six days. **Not yet confirmed false — must be re-derived before launch** | Open — P5 |
| **5A-006** | P9 | 🟢 **Opportunity** | Vercel | **Speed Insights closes F-021.** Real-user p75 per route, reaches signed-in pages, immune to a single unlucky run — the instrument the audit said decision #33 was blocked on | **Owner decision.** Turn on before launch, since it needs traffic to report |

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
