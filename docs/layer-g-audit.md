# Layer G audit — findings log

**Started 2026-08-23, on `feat/layer-g` (PR #89), before merge.**
Method: `https://claude.ai/code/artifact/980cf128-2b42-4f2b-ba9b-0b148f1e8f4e` (rev 4).

The audit runs in layers, each proving something no other layer can: **step zero** (sync +
fold-ins) → **0** prove the instruments → **1** the coverage map → **2** the machine sweep →
**3** the wire sweep → **3b** the platform sweep → **4** the data sweep → **5a** my visual
sweep → **5b** the owner's judgement sweep.

**Definition of done:** every enumerated case sits in exactly one of three states — *passed*,
*fixed and guarded*, or *accepted risk with the owner's sign-off*. **Zero cases in "unknown".**

**Severity key.** 🔴 blocks merge · 🟠 fix in this layer · 🟡 hardening / record ·
🔵 owner decision · ℹ️ no action, recorded so it is a checked fact rather than an assumption.

---

## Step zero — sync with main

`git merge origin/main` into `feat/layer-g` (**merge, not rebase** — PR #89 is open and 119
commits are pushed; a rebase would rewrite published history). Clean, one file:
`web/components/results/columns.ts`, 2 lines, from PR #90.

⚠️ **Why this had to come first:** the plan's revision 1 would have audited the branch as it
stood, and PR #90 changes a **paid surface**. Every measurement taken before the merge would
have described code that will never ship. My first check for this reported *no difference* —
it was reading a stale local copy of `main`. **The instrument was out of date**, which is the
same failure this audit exists to catch, one level up.

---

## Findings

### F-001 🔴 The bounds are described two different ways on two screens, and one of them is advice

**Found:** step zero, by asking what else PR #90's correction touched.

PR #90 corrected the Results table tooltips because they called a record *"not
unprecedented"* — i.e. they described the bounds as a **typical band** when the bounds are in
fact the **extremes**. The corrected copy now reads:

> Lower Bound % — The deepest confirmed fall in this stock's whole history … **A still-forming
> dip can run below it.**

The same concept is described on the Stock Detail page, in
`web/components/stocks/DrawdownOverlay.tsx:377-378`, and it was **not** corrected:

> Lower Bound — The deepest drawdown ever recorded … **Stocks rarely breach this level.** If
> Current approaches Lower Bound, **risk/reward is very favourable**.

> Upper Bound — The highest profit recovery peak ever recorded … If Current approaches Upper
> Bound, **consider taking profits**.

**Two separate defects in one tooltip pair.**

**(a) A direct contradiction.** The Results table now tells a reader a dip *can* run below the
lower bound. Stock Detail tells the same reader stocks *rarely breach* it. Both describe the
same number, on the same product, to the same person. This is CLAUDE.md **11c** exactly —
one claim, two copies, and PR #90 fixed the copy it was looking at. Nothing errored, nothing
went red, and both sentences read as confident and deliberate.

**(b) 🔴 It is financial advice, which is a non-negotiable.** *"Consider taking profits"* is
an instruction to sell. *"Risk/reward is very favourable"* is a recommendation to buy. This
breaches **non-negotiable #12 / decision #24** (educational and informational only,
ASIC-compliant, never financial advice) and the spirit of **decision #16**, which bans
Buy/Sell framing in our own outputs — the ban is on the *judgement*, and rephrasing it into
plain English does not exempt it.

⚠️ **Note how invisible this was.** The words are in a `title` attribute, so they appear only
on hover: no automated check reads them, no screenshot shows them, and a visual review never
triggers them. The compliance guard asserts the *disclaimer is present*, which it is — the
page is compliant everywhere except inside a tooltip nobody measured.

### ⚠️ Two errors of MINE in the first report of F-001, both corrected before any code changed

**(i) My advice sweep was built from the phrases I had already seen.** I reported the problem
as *"isolated to two tooltips"*. It was **six clauses across three pills** in the same
component. My pattern searched for `consider taking/buying/selling`, `risk/reward is`,
`good time|entry` — and so missed *"better entry opportunities"*, *"historically an attractive
entry zone"* and *"nearing an exit zone"*. This is CLAUDE.md **11g** committed by the person
quoting it: **a matcher tested only against its own source phrases has not been tested.**
A confident "isolated" is worse than no answer, because it closes the question.

**(ii) I graded an owner-approved feature as a compliance breach.** Widening the sweep
surfaced a whole named **Entry Zone** concept — UI labels in `VerdictCard` (*"Entry Zone ·
Active"*, *"Wait for Entry Zone"*), a formula in `MethodologyModal`, and generated bullets in
`ThesisInsights`. Grepping the audit docs *before* forming a view (CLAUDE.md **11h**) found it
in `layer-c-audit.md`: **"Thesis follow-up — … + entry-zone …. Owner-driven refinements …
design questions signed off via AskUserQuestion before building"** (2026-06-11), and **Fix 2**
records the owner engaging with the exact phrase *"historically attractive entry zone"* and
choosing to **gate it on Financial Health** rather than remove it.

So the house voice is a settled decision, and I nearly re-opened it — the same mistake as the
colour reversal (**11l**). **Grep the audit docs before deriving a diagnosis** turned a
"compliance breach" into a "one factual contradiction plus one question", which is what it
actually was.

**Owner's ruling (2026-08-23):** fix the contradiction, change *"consider taking profits"*,
and treat PR #90's terser wording as **a one-off correction, not a house-style shift** — the
remaining entry/exit language stays.

**Status:** ✅ **FIXED**, exactly and only as ruled.

| | Before | After |
|---|---|---|
| Lower Bound | "…**Stocks rarely breach this level.** If Current approaches Lower Bound, risk/reward is very favourable." | "…**A still-forming dip can run below it.** If Current approaches Lower Bound, risk/reward is very favourable." |
| Upper Bound | "…If Current approaches Upper Bound, **consider taking profits**." | "…**A still-forming rally can run above it.** If Current approaches Upper Bound, **the stock is near the top of its historical range**." |

**Left alone by ruling:** the `Current` and `Typical` pills keep *"better entry
opportunities"*, *"historically an attractive entry zone"* and *"nearing an exit zone"*.

⚠️ **No shared constant was extracted, deliberately.** My first proposal was to make both
screens import one string. The ruling that the two screens keep their own voice makes that
wrong — a shared constant would force an identity the owner explicitly declined. What is
shared is the *fact* (a live move can exceed the bound), now stated on both.

⚠️ **This component is imported by the offline report** (`ReportDocument.tsx:9`), so the
downloadable file carries the same tooltips. Per **11d** the source being right is not
evidence the artifact is: verified in Layer 2 by opening the built file, not here.

**Why no guard caught it, and none has been added yet:** nothing reads tooltip text. The words
live in a `title` attribute, so they surface only on hover — no test reads them, no screenshot
shows them, no visual review triggers them. A guard asserting neither bound tooltip claims the
level is rarely breached would hold this fix. **Not built:** the owner asked for a copy fix,
and adding a test unasked is the scope-widening this log already records me doing once. Raised
for decision instead.

### F-002 🟡 Signed-out visitors kept a write permission that signed-in users had removed

**Found:** the platform sweep, while checking whether a customer can grant themselves premium.

⚠️ **The headline is that I was wrong, and checking is what showed it.** The `profiles` UPDATE
policy is `auth.uid() = id` with **no `WITH CHECK` and no column restriction**, so on the face of
it any signed-in person could `update({ subscription_status: 'active' })` from the browser
console and take the paid product for free — a total paywall bypass, invisible to every guard we
own. **That is not what happens.** Underneath the policy sit column-level grants, and
`authenticated` holds UPDATE on exactly three columns:

```
acknowledged_disclaimer_at, country, display_name
```

The billing columns are unreachable. **The defence is real and it is good** — and it is
defence-in-depth, since the policy restricts the *row* and the grant restricts the *columns*.
Had I reported the alarm instead of testing it, I would have sent the owner chasing a
vulnerability that does not exist.

**The actual finding is an asymmetry.** `anon` still holds UPDATE on **all 20** `profiles`
columns, including `subscription_status`, `billing_blocked`, `grace_until` and
`stripe_customer_id`.

**Not exploitable today.** RLS denies it: for an unauthenticated request `auth.uid()` is NULL,
`NULL = id` is NULL rather than TRUE, so zero rows match. Safety rests on the policy alone.

**Why it is still worth fixing.** Someone deliberately narrowed those grants for
`authenticated` — that is a considered act, not a default — and did not mirror it to `anon`.
That is CLAUDE.md **11c-iv** precisely: *the rule existed and one of its consumers never
received it.* Today the policy covers for it; a future migration that adds any anon-reachable
policy to `profiles` makes the wide grant live, and nothing would go red.

**Proposed fix:** `REVOKE UPDATE ON public.profiles FROM anon;` — anon has no legitimate reason
to write any profile column. Plus a guard asserting the privilege posture, so it cannot widen
silently. **Not applied:** it is a live-database change, and the owner asked to be consulted
before anything is removed.

### F-003 🟡 The stock universe is 129 rows from a silent truncation limit

`stocks` holds **871** rows. PostgREST returns at most **1000** to an unpaginated read and says
nothing about it — no error, no warning, no flag (CLAUDE.md **14c**). The universe auto-expands
every time a reader requests a ticker, so this arrives with *growth*, not with a commit.
`selectAll()` / `_select_all()` and `pnpm check:data-integrity` exist to prevent it. **Layer 0
proves that guard can actually fail** rather than assuming it.

### F-004 ℹ️ Seven tables cannot tell a reader that their configuration is deliberate

Nine tables have row-level security enabled with **no policies** — the correct, deny-all posture
for server-only tables, and the reason the database's own advisor lists nine notices. Two
(`stripe_events`, `trial_tombstones`) carry a table comment saying the notice is intentional.
The other seven do not, so the next person to read the advisor output cannot distinguish
*deliberate* from *forgotten* — and will either re-investigate it or, worse, "fix" it.
One-line comment each.

### F-005 🔵 Four subscription states show a screen that does not describe them

The billing layer maps **eight** Stripe statuses. Four — `incomplete`, `incomplete_expired`,
`paused`, `unpaid` — fall through `hasAccess()`'s catch-all and produce the denial reason
`no_subscription`, whose entry in `PremiumLockPage` is `null` (the generic panel).

**Correct and safe** — the rule fails closed by design, so nobody gets in who should not.
**Possibly unfair** — telling someone whose payment is *unpaid*, or whose subscription is
*paused*, that they "don't have a subscription" is not true and gives them nothing to act on.
Owner's call; the four screens go to them in Layer 5b.

### F-006 🟠 The launch-gate table's evidence is three weeks stale

`roadmap.md` §3 is the formal definition of ready, and every row is supposed to cite a reading.
It cites **E2E 105/105 and pytest 86**, measured 2026-08-02 on `ab11e18`. Several rows are
🟡 *partly proven*. The table is not wrong so much as **out of date in a way that reads as
current** — the same shape as CLAUDE.md **11j**, where three documents said a page was
finished.

✅ **The test row is fixed (2026-08-23).** Re-read from CI run `32585813431` on `f17866a`:
**E2E 523 passed, pytest 153**, with no `flaky` and no `skipped` line in either summary
(read the whole block — CLAUDE.md 11i). Local `pytest` re-run the same day independently
gave 153, agreeing. The row now cites the run id and the SHA, which is the thing that
stops a number ageing invisibly: without one, *"all tests passing"* stays true-looking
forever. ⚠️ **Noted in the row itself:** the audit's own commits were local and unpushed
at the time, so CI has not seen them — the citation is the last SHA it actually ran, not
a claim about the working tree.

**The remaining rows are re-verified in Layer 2.**

### F-011 🔵 An unknown ticker answers 200, not 404 — the August soft-404 fix never reached the signed-in app

**Found:** Layer 1, by writing the test the coverage map said was missing.

Measured on the production build, signed in, 2026-08-23:

| URL | Status | Should be |
|---|---|---|
| `/stocks/us/ZZZZNOTREAL` | **200** | 404 |
| `/stocks/xx/AAPL` (no such market) | **200** | 404 |
| `/learn/not-a-real-article` | 404 ✅ | 404 |

CLAUDE.md **11r** records a sitewide soft-404 — every `notFound()` answering 200 —
fixed on 2026-08-18 by deleting the root `app/loading.tsx`. That fix was correct and
it was **incomplete**: `app/(app)/loading.tsx` and the ticker route's own
`loading.tsx` are still present, so inside the signed-in product the Suspense shell
is still flushed before the status is set. Same bug, same mechanism, the half of the
site nobody re-checked — 11c's "one rule, one place" and 14g's "a guard scoped to
public routes is silent, not clean, about the rest."

⚠️ **Nothing on screen is wrong**, which is why it survived: the reader gets the
correct "Not in our coverage yet" page with its Request button. Only the status line
disagrees.

**Cause proven, not theorised.** Moving both `loading.tsx` files aside and rebuilding
turned both 200s into **404s**; restoring them turned them back. Two builds, both
directions.

**🔵 Why this is the owner's call and not a fix.** Removing those files removes the
loading skeleton from the slowest page in the product — the ticker page took
**~4 seconds** to render in the same measurement, and without a `loading.tsx` there
is no shell to stream, so that becomes 4 seconds of blank. Against that: the harm
today is small. `/stocks` is `Disallow`ed, so no crawler ever sees it; a human
reader sees the right page. The cost is to anything reading the status
programmatically, and to the honesty of the response.

**✅ FIXED the same day, and the trade-off turned out to be avoidable.** The owner
asked for the fix *and* for a way that costs nothing, and there is one. Next nests a
segment as `<Layout>` → `<Suspense fallback={<Loading/>}>` → `<Page/>`, so **a layout
renders outside the boundary**. The existence check moved into a new
`stocks/[market]/[ticker]/layout.tsx` and only the *group-level*
`app/(app)/loading.tsx` was removed — the ticker route keeps its own detailed
skeleton.

Measured after, on the production build:

| | Before | After |
|---|---|---|
| `/stocks/us/ZZZZNOTREAL` | 200 | **404** |
| `/stocks/xx/AAPL` | 200 | **404** |
| real ticker | 200 | 200 |
| ticker-page skeleton | 430ms | **389ms** |
| `/stocks` · `/run` · `/results` · `/account` · `/request` | group skeleton | 812 · 380 · 453 · 945 · 387 ms to full load |

The four routes that lost the group skeleton all load in under a second, and Next's
router keeps the previous page on screen during a client navigation anyway, so the
skeleton was buying them a flash rather than a wait.

⚠️ **Two wrong turns, both caught by measuring rather than reasoning.** (i) My first
attempt added the layout and kept `app/(app)/loading.tsx` — still 200, because that
file's boundary sits *above* the new layout. The theory was right and the placement
was wrong, and only the wire said so. (ii) The fix then silently broke the
reader-facing half: **a `notFound()` thrown by a layout is caught by the boundary
ABOVE that segment**, so `[ticker]/not-found.tsx` stopped firing and the friendly
"Not in our coverage yet" page was replaced by the generic 404 — statuses green,
customer experience quietly worse. The e2e tests written an hour earlier caught it.
Fixed by extracting `components/stocks/NotInCoverage.tsx` and re-exporting it from
both boundaries, rather than copying the markup into the second one (11c).

Guarded by `e2e/stock-not-found.spec.ts`: the two 404s, a 200 control, the friendly
page and its Request link, **and that the skeleton still appears** — because the
cheap "fix" for this is to delete the last `loading.tsx`, which would keep every
status green and hand the reader a blank screen for three seconds.

### F-012 🟠 `/api/request-ticker` treated a failed database read as "not covered" — FIXED

**Found:** Layer 1, by a flaky test — the kind of result that is easiest to re-run and ignore.

The 409 case ("this stock is already covered") passed in isolation and **failed once in
the full suite**. Both of the route's lookups destructured only `data` and discarded
`error`, so a transient read failure was indistinguishable from an absent row — CLAUDE.md
**11e**, on a route that had no tests at all until that morning.

The two failures point in opposite directions and the second one writes:

- a `listings` error told a reader their real stock was **"not a known US/AU/CA listed
  stock"** — wrong, but a refusal;
- a `stocks` error fell through to the upsert and **queued a request for a ticker we
  already cover**, so the nightly cron would go and re-fetch it. Nothing errored, nothing
  logged, and the row was indistinguishable from a genuine reader request.

Both now check `error` first and answer **503 + `Retry-After`**, matching the report
route. ⚠️ **Checked before assuming:** the live queue holds 9 rows, all from June, so no
spurious row was ever written — by the tests or otherwise.

⚠️ And the fix tripped the paywall guard for the wrong reason: its regex matched
`headers: NO_STORE` but not `headers: { ...NO_STORE, 'Retry-After': '5' }`, so a
correctly-guarded 503 read as unguarded. The report-route section a few checks above had
already widened its pattern; the two had drifted (11c). Widened and re-proven able to
catch a genuinely missing header.



### ✅ Verified clean — recorded so these are checked facts, not assumptions

| Check | Result |
|---|---|
| Row-level security enabled on every table | **12 / 12** |
| Tables denying all public access (server-only) | **9**, correctly |
| Tables with policies | **3** — `profiles`, `analysis_runs`, `referrals`, each scoped to `auth.uid()` |
| Can a signed-in customer escalate their own entitlement? | **No** — column grants block it (F-002) |
| Preview deployments protected | **Yes** — sign-in required on all but the custom domain |
| Live Stripe webhook | **1**, enabled, `https://www.majorcycle.com/api/stripe/webhook`, 13 events, livemode |
| Database performance advisors | 10, all INFO unused-index — expected at 3 accounts |

---

## Step zero — the five fold-ins

### 1 ✅ Two cron scripts crashed instead of explaining — FIXED

`daily_refresh.py` and `check_field_units.py` read `os.environ["SUPABASE_URL"]` strictly, while
six sibling scripts accepted `NEXT_PUBLIC_SUPABASE_URL` as a fallback. Running either by hand
off `.env.local` raised a bare `KeyError` naming a variable the operator has never heard of.

Both now use the same fallback, with the reasoning inline. **Verified:** all **11** Python
readers of `SUPABASE_URL` (9 in `analytics/`, 2 in `web/api/`) now accept either name; strict
readers remaining = **0**. `mypy` clean on 42 files, `pytest` **153 passed**.

ℹ️ **Noted, not changed:** three different fallback *shapes* now exist. Six use
`os.environ.get(A) or os.environ[B]` — which raises a clear error naming `B` if neither is set.
Two one-off repair scripts (`fix_pe_history.py`, `fix_insider_transactions.py`) use
`os.environ.get(A) or os.environ.get(B, "")`, which **silently yields an empty string** and
defers the failure to a confusing place. Not changed: they are hand-run repair tools, not the
nightly pipeline, and churning them mid-audit buys little. Recorded so it is a known
inconsistency rather than an unnoticed one.

### 2 ✅ Two guards never ran automatically — now a required merge gate

`pnpm check:page-weight` and `pnpm lighthouse` exist but sit outside CI. Both need a
**production** build on `:3200` plus a real signed-in session, which the CI jobs do not provide:
the frontend job builds but has no browser or secrets, and the E2E job has both but deliberately
runs `next dev`.

They are now a **required pre-merge gate** (below), with their numbers recorded so a regression
has to be *seen and waved through* rather than passing unnoticed.

🔵 **Recommendation for the owner, not actioned:** these two are not equally automatable, and
treating them the same would be a mistake.

- **`check:page-weight` could go into CI.** It measures *bytes over the wire*, which is
  deterministic — the same commit yields the same number on any machine. Adding a production
  build and server to the E2E job would cost a few minutes and buy permanent protection.
- **`lighthouse` should stay manual.** It measures *timing*, which depends on the CPU it runs
  on, and shared CI runners are noisy. This repo already learned that one run is not a number
  (85→62 across five runs) — a perf gate that flaps gets loosened rather than obeyed, which is
  worse than no gate. Manual, median-of-3, on a known machine, is the honest form.

Not actioned because changing the CI pipeline days before a merge is a scope expansion I was
not asked for, and the approved fold-in was the manual gate.

### 3 🔵 Apex redirect is still temporary — owner's, at merge

Cannot be done from code; it is a hosting/DNS setting. On the merge-day list below.

### 4 🔵 Public document text size — owner's decision, prepared in Layer 5b

Both sizes to be built and shown side by side.

### 5 ℹ️ Supabase legacy API keys expire end of 2026 — recorded, not actioned

Rotating live database keys during a pre-launch audit adds risk for no benefit. Belongs in the
roadmap as a dated item.

---

## The merge gate — every box ticked before PR #89 merges

Numbers get filled in during Layer 2 (the machine sweep) and re-checked immediately before
merge. An empty number is an unticked box.

| | Gate | Required | Last reading |
|---|---|---|---|
| ⬜ | `pnpm typecheck` | zero errors | — |
| ⬜ | `pnpm lint` | zero errors | — |
| ⬜ | `pnpm build` | succeeds | — |
| ⬜ | `pnpm e2e` | 0 failed, 0 skipped, count reconciled with CI | — |
| ⬜ | `pytest analytics/` | all pass | 153 ✅ (step zero) |
| ⬜ | `mypy analytics/` | no issues | 42 files ✅ (step zero) |
| 🟡 | The eight `check:*` guards | all green, **each proven able to fail** in Layer 0 | **all 8 proven able to fail** ✅ (Layer 0, 2026-08-23 — 13 sabotages, each with a control). Green readings re-taken in Layer 2 |
| 🟡 | `pnpm check:page-weight` | within budget — **manual, production build** | all 6 pages within budget ✅ 2026-08-23; heaviest `/stocks/us/AAPL` **1223 / 1400 KB**. Re-taken at merge |
| ⬜ | `pnpm lighthouse` | meets decision #33 — **manual, median of 3** | — |
| ⬜ | Launch-gate table re-verified | every row's evidence current, not from 2026-08-02 | — |
| ⬜ | Deferred list GA-1…GA-5 re-verified | closed *today*, not closed *once* | — |
| 🟡 | Layer 1 coverage map | built, and the uncovered list ruled on by the owner | map built 2026-08-23 → `docs/layer-g-coverage-map.md`; **8 items awaiting the owner's ruling** |
| ⬜ | All findings resolved | passed / fixed+guarded / accepted with sign-off. **Zero unknown** | — |

**At merge, owner-only:**

| | Action | Why it matters |
|---|---|---|
| ⬜ | Flip apex → `www` from a temporary to a permanent redirect | Search engines consolidate ranking only across a permanent one, and Layer G declares `www` canonical in ten places |
| ⬜ | Move hosting off the free tier | It forbids commercial use — this blocks taking payment, not just launch |
| ⬜ | Submit the sitemap, **after** deploy | Submitting while it still redirects teaches the crawler to distrust it |

---

## Layer 0 — proving the instruments

Each guard broken on purpose and required to go red **for the stated reason**, with a control
run after every revert. Exit codes measured **without a pipe** — see the method note below.

| Guard | Sabotage | Exit | Message |
|---|---|---|---|
| `check:entitlement-gates` | `/api/portal` header → `public, s-maxage=60` | **1** ✅ | named the file, the directive, and *why* a shared cache leaks a Stripe session URL |
| `check:report-sections` | **delete** the `<DrawdownOverlay>` render | **1** ✅ | `DRIFT: … on the Stock Detail page but NOT in the report — DrawdownOverlay` |
| `check:report-sections` | **comment out** the same render | **0** 🔴 | *nothing* — see F-007 |
| `check:data-integrity` | unpaginated `.from('stocks').select()` | **1** ✅ | named the file, the table, the 1000-row cap and the three valid fixes |
| `check:seo` | `/pricing` → `index: false` | **1** ✅ | named the page and that it "keeps working, so nothing looks wrong" |
| `check:tier-palette` | change tier 4 in **one** copy | **1** ✅ | caught the two copies drifting apart |
| `check:tier-palette` | collide tiers 4+5 in **both** copies | **1** ✅ | 3 messages: 1.0 vs floor 16, protanope 3.2 vs 17.5, deuteranope 1.6 vs 16 |
| `check:render-modes` | move `.next/server/app/terms.html` aside | **1** ✅ | `/terms is NOT prerendered` — and named `app/not-found.tsx` as the usual culprit |
| `check:render-modes` | plant a `login.html` (the opposite direction) | **1** ✅ | `/login IS prerendered and must not be`, **plus** a second message: the nonce interlock, unprompted |
| `check:csp` | `proxy.ts` header → `…-Report-Only` | **1** ✅ | all 12 routes `sent NO Content-Security-Policy` — correct, Report-Only enforces nothing |
| `check:page-weight` | `/learn` budget 380 → 100 | **1** ✅ | named the overage **and the five heaviest resources** |
| `check:page-weight` | budget a route that 308s (`/methodology`) | **1** ✅ | `redirected to / — that is not the page this budget describes` |
| `check:page-weight` | budget a route that barely loads (`/robots.txt`) | **1** ✅ | `transferred only 1 KB over 0 requests — it did not load` (the 14g floor) |

**All eight `check:*` guards are now proven able to fail.** The three added 2026-08-23
needed a production build on `:3200` and a running server; the CSP one needed two full
rebuilds, because the header is set in `proxy.ts`, which Next compiles at build time —
editing the source and re-running the guard would have measured the previous build
(CLAUDE.md 11i). **The sabotage was confirmed on the wire with `curl -I` before the guard
ran**, so a green result could not have been the sabotage silently failing to land.

### ✅ F-010 The page-weight guard printed `ok` next to a failing page — FIXED

⚠️ **Two of the three page-weight sabotages printed `ok` in the summary table while
failing.** The `ok`/`OVER` column reports the budget comparison only, so a page that
redirected somewhere else, or never loaded, is labelled `ok` on the very line meant to
summarise it — `ok /methodology 277 KB / 400 … landed /` and `ok /robots.txt 1 KB / 400
0 reqs`. The problem block underneath catches both and the exit code is 1, so nothing is
missed by a reader who scrolls; it is cosmetic. Recorded because the theme of this whole
layer is checks that look clean while blind, and a column that says `ok` next to a
failure is one careless skim from being believed.

**Owner's ruling (2026-08-23): fix it.** The flag was `kb > maxKB ? 'OVER' : '  ok'`,
computed from the budget alone and printed *before* the other two checks had run. Now the
row's problems are collected first and the label is derived from all three, giving three
states that each mean something: **OVER** (too heavy), **FAIL** (redirected, or never
loaded), **ok** (genuinely nothing wrong). Re-ran all three sabotages against the fix —
`/learn` OVER, `/methodology` FAIL, `/robots.txt` FAIL, exit 1 — then a clean control:
six rows `ok`, exit 0. `pnpm lint` and `pnpm typecheck` both clean.

### ⚠️ Two method errors of mine in this layer, both caught by controls

**(i) I measured an exit code through a pipe.** `pnpm … | tail; echo $?` reports `tail`'s
status, not the guard's — so my first sabotage printed two correct failures beside
`exit=0`, which reads exactly like *"the guard prints red but CI stays green"*, the most
alarming result a guard can give. Re-measured without the pipe: **1 when broken, 0 when
clean.** The guard was always fine; the instrument was not. Every row above is now measured
directly, with a control.

**(ii) My first tier-palette sabotage tested a different check than I intended.** Changing
tier 4 in `ratings.ts` alone failed the *two-copies-in-step* check, and the printed adjacency
numbers were **identical to the clean run** — which is what gave it away. Had I stopped at
"exit 1, guard works", **the adjacency check would still be unproven** while I recorded it as
verified. Changing both copies exercised it properly. This is CLAUDE.md **11u**: a break that
fails in an unexpected way is a finding about your model, not a verdict on the test.

### F-007 🟡 `check:report-sections` is blind to a commented-out section

The guard collects components imported from `@/components/stocks/…`, then tests whether
`<Name` appears anywhere in the file. **It never strips comments**, so
`{/* <DrawdownOverlay … /> */}` still matches and the section counts as rendered.

Deleting a section is caught. **Commenting one out is not** — and commenting out is the more
likely real action: someone disables a section while debugging and forgets. The report would
silently lose a section a paying customer downloads, with the guard green.

⚠️ Note this is the *same* defect shape the repo already fixed once elsewhere:
`public-chrome.spec.ts` reads source **with comments stripped**, because its first version
failed on the very sentence documenting the fix. The lesson was learned in one guard and not
carried to this one — **11c-iv** again.

**Not fixed:** it is a CI guard change and the owner asked to see changes before they land.
**Proposed:** strip block and line comments before matching, and prove it by re-running the
comment-out sabotage — which must then exit 1.

### F-008 🟡 Two adjacent rating tiers are near-indistinguishable to a red-blind reader

From the *passing* baseline, not a sabotage:

```
tier 1-2   apart 17.1   protanope 18.6   deuteranope 24.6
tier 2-3   apart 28.8   protanope  2.8   deuteranope  7.3   ← Constructive vs Neutral
tier 3-4   apart 26.8   protanope 12.7   deuteranope  5.9
tier 4-5   apart 16.3   protanope 18.0   deuteranope 16.1
```

**Constructive (`#1E7C1E` green) against Neutral (`#87660F` gold) is 2.8 apart to a
protanope**, where every other pair sits between 12.7 and 26.1. Protanopia affects roughly 1%
of men. Constructive-versus-Neutral is also the most consequential boundary we draw — it is
the line between *our analysis likes this* and *our analysis is indifferent*.

**The guard is working exactly as designed.** It is a **ratchet** (CLAUDE.md **11t**): it
records today's measurement as the floor so a colour can never get *closer*, deliberately
rather than inventing a threshold that would fail on the day it was written. It therefore
prevents worsening and says nothing about adequacy — 2.8 is locked in as *acceptable* purely
because it was the value on the day.

**Graded 🟡, not 🔴, and here is the honest reason:** colour is not the only channel. Rating
tiers render with their **word** (`High Conviction` / `Constructive` / …) and score chips
carry the **number**, so a reader who cannot separate the hues still gets the information.
That keeps it clear of the accessibility rule that colour must never be the sole means. It is
a loss of *redundancy*, not of meaning.

**Status: ✅ FIXED 2026-08-23. Neutral is now a true grey, `#87660F` → `#72696D`.** Owner chose
it from three equivalent options after seeing them rendered under all three vision types.

| Pair | Protanope before → after | Deuteranope before → after |
|---|---|---|
| 2–3 | **2.8 → 25.2** | **7.3 → 22.0** |
| 3–4 | 12.7 → 27.0 | **5.9 → 24.6** |

Worst case across the scale: **2.8 → 16.1**, which is the ceiling — pairs 1–2 and 4–5 bind it
and neither was touched. Contrast is unchanged at 5.31 / 4.80. Verified on the rendered page,
not just the tokens: **11 grey elements measured, worst 5.07** against a 4.5 floor.

**Why gold could not be kept, measured rather than asserted.** All **15,866** golds clearing
both floors were searched; the best scores 12.9 and only by becoming `#3E301E`, a near-black
brown. A true yellow is worse — `#FFD700` scores **1.27** as text and the original `#D4A017`
scored **2.15**. Green and gold both lose the same channel for a red-blind reader and converge
on olive, which *is* the 2–3 collapse.

⚠️ **A test of mine that proved nothing.** I assumed the binding constraint was *white numerals
sit on this colour*, re-ran the search without it, and got **identical results** — which is how
I learned the test was a no-op. The real constraint is the *other* floor: Neutral is also used
**as text** on the light page, demanding luminance ≤ `0.1479` where white-on-it demands
`0.1688`. I had removed the requirement I suspected, and it was never the one binding.
**A control that changes nothing is telling you your model is wrong, not that the thing is
irrelevant** (11u).

**What moved:** `--c-tier-3`, `--c-tier-3-ink`, `--c-neutral-ink`, both `--tint-tier-3*`, the
profitability-pill border, `ratings.ts` tier 3, `ink.ts` neutral, and the guard's ink ground
plus its 2–3 / 3–4 floors, re-based upward so the new separation is now the ratchet.

⚠️ **The ink is NOT the colour.** `#72696D` scores **4.67** on its own 10% tint — just under
the floor — so the ink is `#6B6266` (5.18). Computing it rather than assuming they could be the
same is what caught that.

⚠️ **Two floors, two of my own errors, both caught by the guard rather than by me.** I set the
2–3 deuteranope floor to `22.0` when the measured value *displays* as 22.0 but is fractionally
below it, so the guard went red on the change that fixed it — the boundary-versus-margin lesson
(11i-b) in miniature. And I missed `--c-neutral-ink` entirely, because the guard's ink regex
matches `--c-<letters>-ink` and the one I had already fixed is `--c-tier-3-ink`; two variables,
one concept, and only one of them is what the ink layer reads.

### F-009 🟡 The composition bar still paints the pre-August palette, in a form the guard cannot see

Found while fixing F-008. `compositionRamp()` in `lib/ratings.ts` — which colours the
Health / Valuation / Cycle Payoff micro-bar under every Overall score — holds its own copy of
the tier palette as **`r,g,b` strings**:

```
1: '0,100,0'   2: '34,139,34'   3: '212,160,23'   4: '255,69,0'   5: '178,34,34'
```

Those are the **original pre-2026-08-22 colours**. The G6 contrast fix never reached them, so
the bar beneath a score chip has been drawn in the old palette while the chip itself uses the
new one.

⚠️ **The guard walks 278 files for stray copies and cannot see this**, because it searches for
**hex**. A copy written as `212,160,23` is invisible to it — so the one control that exists for
exactly this class of drift has a blind spot the width of a format change. Same family as F-007:
the guard is right about what it looks at and silent about the rest.

**Tier 3 only is fixed here** (`212,160,23` → `114,105,109`), because leaving it would have made
the approved change incoherent — a gold bar under a grey chip. **Tiers 1, 2, 4 and 5 are left
alone and raised for the owner**: repainting four more colours is not what was approved, and the
difference is subtle since G6 only darkened them. The guard should also learn to match `r,g,b`
form.

---

*Log continues as the audit proceeds.*
