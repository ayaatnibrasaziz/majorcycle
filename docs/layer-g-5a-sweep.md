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
| **5A-005** | P0→P5 | 🟡 **To confirm** | `/` landing | **16 frozen claims**, all `asOf: 2026-08-13` (18 days old) — enumerated in the manifest: the 5-of-7 count, GOOGL as top pick, Tesla's rank and 34.1% fall, Apple's price / 9.1% / 24.7% / 81.4% / 609 falls / 630 recoveries, and "nothing in the Opportunity Zone". 11k records this same run going false in **six** days. ✅ Both snapshots share one `asOf` (the 11k two-dates trap held) and `universeCount` 866 matches the live DB exactly. **Not yet confirmed false — P5 re-derives all 16** | **Re-derived 2026-09-01 → see 5A-013/5A-014.** The Apple half self-corrected; the mag7 half is stale |
| **5A-013** | P5a | 🔴 **LIVE on the landing** | `/` landing | **The two snapshots have drifted 18 days apart, and Apple is in BOTH.** `landing-snapshot.json` is rebuilt and committed by the nightly cron (`asOf 2026-08-31`); `mag7-snapshot.json` is deliberately frozen and is in **no** workflow (`asOf 2026-08-13`). So the live page prints Apple at **−11.3%** in the ranked table and **"8.0% below its high"** three screens later — both correct for their own date, on one page, about one company. This is CLAUDE.md **11k** verbatim (*"two snapshots describing the same subject must carry the same date"*), and P0 recorded them as agreeing because on 31 Aug they did — **the cron moved one of them that night**. Verified on the wire at `www.majorcycle.com`, not from source | **FIXED 2026-09-01.** The two worked examples are now on ONE lifecycle — both frozen, regenerated by hand together. The cron rebuilds only the new `universe-count.json` (a fact, which must never be stale). ⚠️ **The guard already existed and could not fire:** `landing.spec.ts:266` has always asserted the two share an `asOf`, but the cron commits with `[skip ci]`, so CI never ran on the commit that broke it. Running CI nightly is the wrong trade (Actions minutes); **taking the snapshots out of the cron's reach is the right one — a guard cannot cover a write committed past it.** ⚠️ Timeline, corrected: the nightly rebuild step reached `main` only on 31 Aug and first executed on 1 Sep, so the drift was ~10 hours old, not 18 days (14g, in both directions) |
| **5A-014** | P5a | 🔴 **Blocks the 5A-013 fix** | `/` landing | **Regenerating the frozen snapshot is not a mechanical fix — it breaks the page's ARGUMENT, not just its numbers.** Re-derived on 2026-09-01: two tiers move (AAPL Constructive→Neutral, NVDA Neutral→Constructive) and, decisively, **the deepest faller changes from TSLA to META**. The "second question" paragraph is computed by `mag7Facts()`, so it would auto-substitute Meta and read *"Meta has fallen furthest — 27.4% — and still comes second… that's exactly the trap… the biggest discount belongs to the weakest business on it."* **Meta is the 2nd-best-rated company with Health 79.6.** The sentence stays fluent and becomes self-contradicting. ⚠️ **The new lesson, beyond 11k: computing a figure from data protects the FIGURE, not an argument built on a relationship BETWEEN figures.** The old data had one company that was both deepest faller and weakest business; nothing preserves that coincidence, and no guard can see its loss | **FIXED 2026-09-01, owner-approved copy.** Rewritten to state what the numbers now say — Meta and Tesla fell 27.4% and 26.2%, ranked second and seventh — which is a *stronger* illustration than the old coincidence: a controlled comparison instead of one example. ⚠️ **It also fixed a latent bug the old wording hid:** the sentence read *"{deepestFall} … ITS Financial Health is {weakest.healthScore}"*, which was only ever correct because those two rows were the same company; on the new data it would have printed Tesla's 49.8 under Meta's name. Guarded by `e2e/landing-copy.spec.ts`, which asserts the PREMISE (different companies, falls within 5pp, ≥3 places and ≥15 health points apart) with controls proving each assertion can fail |
| **5A-012** | P0 | 🟠 **Plan gap** | executability | **The plan could not have been executed by anyone else.** No URLs, no credentials, no commands, and every data edge case named in the abstract with no ticker attached. Now an **Execution guide**: the three surfaces and how to start each, named tickers for all seven edge cases, how to reach each of the 14 states (and the four that are unreachable by ordinary use), the command list, and what each connector can answer | **Fixed 2026-08-31** |
| **5A-011** | P0 | 🟡 **New edge case** | `/stocks/*` | **A fourth market exists: `market='index'`** (`^GSPC` `^AXJO` `^GSPTSE` `^IXIC`). Browse and peer medians exclude it explicitly; nothing in the plan checked that the URLs refuse. Also newly named: retired stocks are **absent from Browse but resolve at their URL** (both halves need checking), and `.V` tickers **keep their suffix** in the URL | Open — P1/P4 |
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

## The revised pass order

`P5a` re-derive the landing's 16 figures → `P1` renders + compliant → `P2` colour →
`P3` interaction → `P4` data edge cases → `P5` remaining content, copy, links →
`P6` not-the-screen → `P7` the three unrun gates + a11y regression → `P8` 375px public

**Am I 100% happy now?** With the plan, yes — every set in it is derived from something
executable, its scope is bounded by a stated reason, and it says who does what and what it cannot
see. **Not with my record**: I have said "complete" three times today and been wrong twice. So the
plan carries one last rule — **P1's first finding of a page section absent from the manifest means
the manifest was still incomplete, and P0 reopens.**
