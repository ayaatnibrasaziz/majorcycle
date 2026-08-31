# Layer G audit · Layer 1 — the coverage map

**Built 2026-08-23 on `feat/layer-g`.** What the test suite actually covers, and — the
point of the exercise — **what it does not**.

**No test was written from this document.** Layer 1's job is to produce the uncovered list
and stop, so the owner decides what is worth guarding before any code is added. That
sequencing is deliberate: a list written *and* acted on in one pass is a list nobody
reviewed.

---

## The instrument

The suite is **523 Playwright tests in 26 files**, and `pytest` is **153**. *(⚠️ Those are the figures on the day this map was built, 2026-08-23, and this document is a dated record — do not read them as current. As at 2026-08-25 the suite is **617 Playwright in 34 files** and **188 pytest**; the merge-gate table in `layer-g-audit.md` is the row that stays current.)*

⚠️ **A grep for `test(` returns 406, not 523** — a third of the suite is generated inside
loops, so counting the source undercounts it by 117. Every number below comes from
`npx playwright test --list`, which enumerates what the runner will actually execute.
The local list agrees exactly with CI run `32585813431`, which is the only reason to
believe either.

---

## Dimension 1 — routes

Forty-three routes, transcribed from the production build's own output rather than from
the `app/` directory, so a route that fails to build cannot silently drop off the list.

### Covered, and by how many spec files

| Route | Files | | Route | Files |
|---|---|---|---|---|
| `/` | 26 | | `/learn` | 6 |
| `/login` | 18 | | `/privacy` | 6 |
| `/stocks` | 16 | | `/disclaimer` | 6 |
| `/account` | 15 | | `/signup` | 6 |
| `/results` | 10 | | `/request` | 5 |
| `/pricing` | 9 | | `/reset-password` | 5 |
| `/run` | 8 | | `/account/update-password` | 4 |
| `/stocks/[market]/[ticker]` | 8 | | `/learn/[slug]` | 4 |
| `…/report` | 8 | | `/deletion-requested` | 3 |
| `/contact` | 8 | | `/reactivate` | 2 |
| `/terms` | 8 | | | |

API: `/auth/signout` 5 · `/auth/recovery-done` 3 · `/api/portal` 2 · `/api/stripe/webhook` 2 ·
`/auth/confirm` 2 · `/api/checkout` 1 · `/api/billing-context` 1 · `/api/analyze-dev` 1 ·
`/auth/callback` 1. Python: `/api/cycle` 4 · `/api/analyze` 2.

### 🔴 Zero coverage

⚠️ **Verified individually, not inferred from the absence of a string.** A first pass
listed eight routes; two of those turned out to be words in comments (`purge` in a test
*title*, `listings` in a sentence), and two more are out of scope by design. What survives:

| | Route | What it does | Why it matters |
|---|---|---|---|
| 🔴 | `/api/cron/purge-accounts` | **Permanently deletes accounts** after the 30-day window | The highest-stakes route we own. Verified by hand in live-check S3, never since, and nothing would go red if it broke |
| 🟠 | `/api/request-ticker` | Queues a ticker for the universe (decisions #12/#16) | Per-user write. Has a 5-branch refusal ladder — 400 / 404 / 409 / 500 / success — none exercised |
| 🟡 | `/api/search` | Ticker autocomplete inside Run Analysis | Gated route; feeds the screener |
| 🟡 | `/api/listings/search` | The Request-a-Ticker menu | |
| 🟡 | `/api/listings/status` | Same menu's status column | |
| 🟡 | `/_not-found` | The 404 page itself | See dimension 3 — the soft-404 |

**Out of scope, not gaps:** `/dev-fixtures` is gitignored and local-only, so on CI the
route does not exist and a test would pass because its subject is *absent* — the 14g
failure, worse than no test. `/icon.png` is a static file emitted by the build.

---

## Dimension 2 — viewer states

`lib/entitlement.ts` recognises eight subscription statuses. How often each appears across
`entitlement.spec.ts`, `entitlement-routes.spec.ts` and `stripe-webhook.spec.ts`:

| State | Mentions | |
|---|---|---|
| `active` | 36 | ✅ |
| `past_due` | 19 | ✅ |
| `canceled` | 15 | ✅ |
| `trialing` | 14 | ✅ |
| `paused` | 2 | 🟡 |
| `incomplete` | 1 | 🟡 |
| `unpaid` | 1 | 🟡 |
| `incomplete_expired` | **0** | 🟠 |

⚠️ **Entitlement itself is correct for all eight by construction** — `LIVE_STATES` is
`{active, trialing}` and everything else falls through to "no". The gap is not access, it
is **what the reader is told**: `AccessDenialReason` has four values, and all four thin
states collapse to `no_subscription`, which says *"you don't have a subscription"* to
someone whose card merely failed to complete. That is finding **F-005**, already open for
the owner's decision.

---

## Dimension 3 — the soft-404, guarded on one route of many

**The entire suite contains one assertion on a 404 status code**, in `learn.spec.ts:493`,
for an unknown article slug. Every status assertion in 523 tests:

`200`×10 · `403`×4 · `401`×3 · `402`×2 · `307`×2 · `500` · `405` · `404` · `400` · `303`

CLAUDE.md **11r** records that until 2026-08-18 *every* `notFound()` on this site answered
**200** — a sitewide soft-404 caused by `app/loading.tsx` flushing the Suspense shell
before the status was set. It was fixed by deleting that file.

**So the bug is guarded on exactly one of the routes it affected.** An unknown ticker —
`/stocks/us/ZZZZ` — is not tested anywhere in the suite, by any string. The route that
would regress most quietly is the one with no assertion on it.

---

## Dimension 4 — 🟠 four API responses send no `Cache-Control` (new)

Measured **on the wire**, signed in, against the production build on `:3200`:

```
GET   /api/search?q=AAP           200   cache-control: (NONE)
GET   /api/listings/search?q=AAP  200   cache-control: (NONE)
POST  /api/listings/status        200   cache-control: (NONE)
POST  /api/request-ticker         400   cache-control: (NONE)
```

This is the CLAUDE.md **11a** family — **the fifth instance**. The mechanism is the one
already written down there: *Next attaches no `Cache-Control` to route handlers*, so a
habit formed on pages does not carry over, and "I didn't see a bad header" is not the same
as "the header is right."

⚠️ **Nothing is exposed today**, and I nearly reported this wrong in both directions.
Reading the source alone said *five* routes send nothing; on the wire, the signed-**out**
refusals all carry `private, no-store` correctly, because the proxy sets it on its own 307
before any handler runs. What genuinely sends nothing is the signed-**in** 200. Vercel
shared-caches only on `s-maxage`, so there is no live leak — which is exactly 11a's
complaint: **safe because of someone else's default, not because we said so.**
`/api/cron/purge-accounts` likewise answers its 401 bare.

Stakes are lower than the four previous instances — the payloads are ticker names, the
same for every signed-in reader — but `/api/search` and `/api/listings/*` **are gated**,
so a shared cache storing one would serve gated content at a URL a signed-out reader can
type. And none of the four is covered by `check:entitlement-gates`, which guards the
billing endpoints only.

---

## Dimension 5 — Python modules no test references

`pytest` is 153 tests across 12 files. Eleven modules are referenced by none of them.

⚠️ **A first pass listed seventeen, and six of those were wrong** — `financial_health`,
`overall`, `valuation`, `normalize`, `sources` and `base` have no file named after them and
are all covered by `test_scoring.py` and `test_field_spec.py`. **A module is not untested
because nothing is named after it**; the list below comes from grepping what the tests
actually import.

| Module | What it is | |
|---|---|---|
| `presets` | The three Run Analysis presets + Custom (decision #15) | 🟠 product logic |
| `drain_requests` | The cron that fulfils reader ticker requests (#16) | 🟠 |
| `build_mag7_snapshot` | The landing page's seven real stocks | 🟡 and see 11k — its numbers expire |
| `build_landing_snapshot` | The landing's Apple figures | 🟡 same |
| `refresh_listings` | Nightly exchange symbol directories | 🟡 |
| `refresh_index_membership` | Nightly SPY/IOZ/XIU holdings | 🟡 |
| `fmp_provider` | Phase 2 stub, deliberately unimplemented | ℹ️ not a gap |
| `config` | Constants | ℹ️ |
| `fix_split_history` | Repairs split-corrupted price history | ℹ️ **KEEP — not dead.** See correction below |
| `fix_pe_history` | Recomputes thin `pe_history` | ℹ️ **KEEP** — see correction below |
| `fix_insider_transactions` | Repairs insider dates stored as row indices | ✅ **DELETED 2026-08-23** — owner-approved |

### ⚠️ Correction — I recommended deleting three scripts and was wrong about two

The table above originally read *"one-off historical repair scripts … arguably should be
archived rather than tested"*, and the owner approved acting on it. Checking before
deleting — the owner's standing rule, and CLAUDE.md **11h**'s "grep the audit docs before
deriving a diagnosis" — showed the premise was false for two of the three:

- **`fix_split_history.py` is a live operational tool.** `architecture.md` §73 names it as
  *the* remedy for an already-corrupted ticker, with its flags, and records a standing
  case (**DD**, where yfinance lists a split but never back-adjusts the prices). Deleting
  it would have removed the documented answer to a problem the docs say still happens.
- **`fix_pe_history.py` repairs thin `pe_history`**, which is a condition that recurs for
  newly added tickers rather than a one-time historical mess.
- **`fix_insider_transactions.py`** is the only genuinely spent one: it repairs dates
  stored as row indices by a bug that was fixed at source and cannot recur.

**Nothing was deleted at the time.** One clearly-dead script is not the three the owner
agreed to, so the decision went back rather than being quietly narrowed — and the owner then
authorised the one. `fix_insider_transactions.py` is gone; the other two remain. ⚠️ The general lesson is the
one this audit keeps re-learning in new costumes: **"no test references it" and "nothing
needs it" are different claims**, and I had let the first stand in for the second. A
maintenance tool is *supposed* to have no automated caller — that is what makes it a
maintenance tool, not what makes it dead.

---

## What this layer did NOT examine

Stated so silence is not mistaken for a clean bill:

- **Depth.** This maps *whether* a route is touched, never *how well*. `/reactivate` appears
  in two files; that is not evidence its logic is covered.
- **Assertion quality.** A test that visits a page and checks it returns 200 counts the
  same here as one that drives a form.
- **The offline report artifact.** `report-download.spec.ts` is one test. Per 11d it is the
  right *kind* of test — it opens the built file over `file://` — but one is one.
- **Data edge cases** (nulls, cross-currency, missing fields). Layer 4.

---

## ✅ What was done about it (2026-08-23)

The owner approved acting on all eight. **Playwright 523 → 589, pytest 153 → 170**, and
acting on the list turned up **two defects nobody knew about**.

| | Gap | Outcome |
|---|---|---|
| 1 | `/api/cron/purge-accounts` | 16 tests. Row selection driven by a stub client; the Bearer comparison extracted and tested **with an invented secret**. ⚠️ No test may hold the real one: the day someone loosens the check to a substring match, such a test stops being a refusal and becomes a live purge of the production database |
| 2 | Unknown ticker → 404 | **Was a live bug** — F-011, fixed, skeleton kept |
| 3 | `/api/request-ticker` | All five refusal branches. **Found F-012** — a failed read read as “not covered”, which would have queued a duplicate request |
| 4 | Missing `Cache-Control` | Fixed on 5 routes; guard widened from 2 files to 7 |
| 5 | `presets`, `drain_requests` | 17 Python tests |
| 6 | search + listings | 18 tests |
| 7 | Four thin subscription states | F-005 fixed — each now says what actually happened |
| 8 | Three `fix_*` scripts | Narrowed to one, deleted |

**Not driven, and stated rather than left to silence:** a *valid* call to the purge cron (it
would really delete accounts — there is no test database), and a *successful*
`POST /api/request-ticker` (it writes a real row and the nightly cron would then permanently
expand the universe from a test run).

⚠️ **Two of this document's own first-pass numbers were wrong**, and both are corrected
above: seventeen “untested” Python modules were really eleven, and eight “untested” routes
were really six. In each case the check that fixed it was cheap and the confident version
would have sent someone chasing work that did not exist.

---

## The list that goes to the owner

Ranked by what would hurt most if it broke silently:

1. 🔴 **`/api/cron/purge-accounts`** — deletes accounts, no automated test at all
2. 🟠 **Unknown ticker → 404** — the sitewide soft-404 is guarded on one route of several
3. 🟠 **`/api/request-ticker`** — five refusal branches, none exercised
4. 🟠 **Four API routes send no `Cache-Control`** — 11a, fifth instance
5. 🟠 **`presets` and `drain_requests`** — product logic with no Python test
6. 🟡 **`/api/search`, `/api/listings/*`** — gated routes, no test
7. 🟡 **Four thin subscription states** — already F-005, awaiting the owner
8. ✅ ~~Three `fix_*` scripts — propose archiving~~ → **narrowed to one, then done.** Two are
   live tools and stay; `fix_insider_transactions.py` deleted 2026-08-23

---

# Layer 1 · the delta re-run — 2026-08-31

**Why this section exists.** Everything above was measured on **2026-08-23**. Between then
and 2026-08-30 the branch gained **73 files and ~28,500 lines**, including two new public
routes and a rewrite of the function every signed-in page uses to decide entitlement. A
coverage map is a dated record of one instrument, and the instrument moved — so the owner's
question ("does the new work need the same audit?") is answered here in numbers rather than
in judgement.

⚠️ **This is a re-measurement, not a re-write.** The 2026-08-23 body above stays exactly as
it was, because a map quietly edited to match today stops being evidence of what was true on
the day its decisions were taken.

## The instrument, then and now

| | 2026-08-23 | 2026-08-31 |
|---|---|---|
| Playwright | 523 in 26 files | **675 in 36 files** |
| pytest | 153 | **244** |
| Next routes in the build | 43 | **44** |

Both counts come from `npx playwright test --list` and `pytest -q`, never from a `grep` for
`test(` — a third of the suite is generated inside loops, and the source undercounts it.

## What closed since the first map

Every route on the original zero-coverage list now has a spec, which is worth stating because
the list was written to be acted on and it was:

| Route | Then | Now |
|---|---|---|
| `/api/cron/purge-accounts` | 🔴 no test | `purge-cron.spec.ts` |
| `/api/request-ticker` | 🟠 no test | `universe-api.spec.ts` |
| `/api/search` · `/api/listings/*` | 🟡 no test | `universe-api.spec.ts` |
| Unknown ticker → 404 | 🟠 one assertion sitewide | fixed in the ticker `layout.tsx` (11r) |

## The new section — `/articles`, `/articles/[slug]`

Five published articles behind one registry. Covered by **4 spec files** (`articles.spec.ts`
25 tests, plus `auth.spec.ts`, `contrast.spec.ts`, `learn.spec.ts`) — comparable with
`/learn`'s 6, and better than several routes that predate it.

⚠️ **The contrast coverage is DERIVED from the registry, and both halves of that claim were
proven on 2026-08-31 rather than read off the comment asserting it.** (a) All five slugs and
the index appear in `--list`. (b) A pale `#c9c9c9` planted on `.reading p` in `articles.css`
made the probe report **1.58–1.66:1** and fail. Without (b) the derivation would only have
proved the tests *exist*, which is not the same as their being able to see anything.

⚠️ **And the first attempt at (b) went red for the WRONG reason** — the page answered
*"Page not found"* with `readingEls: 0`, because `next dev` was still recompiling the
stylesheet the edit had just invalidated. Read as a pass for the guard that would have been a
false confirmation; read as a failure it would have condemned a working test. The rule from
11i applies to wrong-reason reds as much as to green sabotages: **run it again before
concluding anything.** The second run measured the real defect.

## 🔴 Three guards are SILENT about the new section, not clean about it

Each has a hand-written list of pages. `/articles` is on none of them, so each reports a pass
having never visited it — 14g, and the same shape as 11c-iv.

✅ **All three CLOSED the same day — 2026-08-31 — and each new row was broken on purpose
before it was believed.** The table below is the finding as it stood; what was done about it
is in *The four fixes* at the end.

| | Guard | What it could not see |
|---|---|---|
| 🟠 | `check:page-weight` | No budget for `/articles` or an article page |
| 🟠 | `check:csp` | `/articles` absent from its `ROUTES`. It is also the **only** part of the site whose policy can gain two extra Google origins (`lib/preferredSource.ts`), so the one page whose CSP can differ is the one the CSP guard never read. Switched off today (`enabled: false`), which bounds the risk without closing it |
| 🟠 | `e2e/a11y.spec.ts` | Neither `/articles` nor any article page in its route list, so **the whole new public section had no axe evidence**. Colour contrast *was* covered — which is precisely what made this easy to miss: a section with some accessibility evidence looks like a section with accessibility evidence |

## 🔴 F-033 — the acknowledgement WRITE has four protections and no test

`acknowledgeDisclaimer` in `app/(app)/actions.ts` is the function that destroyed the owner's
June compliance record on 2026-08-27 (F-031). The **read** half of that fix is now guarded by
`e2e/onboarding-gate.spec.ts` — 7 tests, and on 2026-08-31 the fix was reverted on purpose and
the exact guard went red (*Expected false, Received true*) while the other six stayed green.

**The write half is guarded by nothing.** It carries four distinct protections — no session,
read-before-write, already-acknowledged, and a `.is(…, null)` race clause — and not one of
them is exercised.

⚠️ **The two halves fail in opposite directions, which is why the tested half does not cover
the other.** A broken *read* shows the gate to someone who already agreed. A broken *write*
destroys the record of the one who really did agree — and no read test would notice.

⚠️ **Why it has no test, precisely:** the action imports `createServerSupabaseClient`
directly rather than receiving it, so a credential-free spec cannot substitute a stub. It is
not `server-only` that blocks it — `lib/supabase/server.ts` carries no such import; the
blocker is the direct import. The fix has a precedent here: `viewerFromProfileRead` was
extracted from `entitlement.server.ts` for exactly this reason, and
`stock-read-errors.spec.ts` drives the real readers with a stub client. **Owner's call**,
because it edits a compliance path to make it testable.

## Guards proven able to fail in this delta — 2026-08-31

Every one broken on purpose, each with a control run after the revert, and `git status`
confirmed clean between each.

| Guard | Sabotage | Result |
|---|---|---|
| `check:seo` (articles half) | `notFound()` → `return null` in the article route | **exit 1**, named the file and "soft-404 farm". Correctly ignored the *comment* on line 33 that also contains `notFound()` |
| `check:seo` (articles half) | registry `as const satisfies` → `as readonly Article[]` | **exit 1**, explained that widening the slug type evaporates the body-per-entry check |
| `check:render-modes` | moved `articles/how-far-do-asx-shares-fall.html` aside | **exit 1**, named the route, the expected file and the usual cause |
| `contrast.spec.ts` (derived articles) | `.reading p { color: #c9c9c9 }` | **red at 1.58–1.66:1** — see the two-run note above |
| `test_retry_pass.py` | `_RETRY_MIN_ALWAYS` 25 → 0, then → 1 | **2 failed**, then **1 failed** |
| `test_retry_pass.py` | `_RETRY_MAX_SHARE` 0.25 → 1.0 | **3 failed** |
| `onboarding-gate.spec.ts` | deleted `if (viewer.profileUnreadable) return false` | **1 failed of 7** — the right one, the other six green |

⚠️ **One honest limit found while proving `test_retry_pass`.** Its first assertion builds its
input *from the constant it is testing* (`range(_RETRY_MIN_ALWAYS)`), so at a floor of 0 it
fails only because the list is empty — a degenerate pass-by-accident. What actually holds the
line is the **second** assertion, which pins the floor/share boundary. The pair therefore
proves the *mechanism* (floor first, then share) and **not the value 25** — a floor of 50
would pass both. That is acceptable, because 25 is a time-budget judgement rather than a
correctness boundary, but it is written down rather than left to look like more coverage than
it is (11c-ix: say which half a guard can see).

**Already proven in earlier sessions, not re-run:** `test_market_cap_from_provider.py` (9
tests), `test_dividend_readjust.py` (each half of the condition separately),
`test_stale_tickers.py` (six sabotages), and the `alignRight` guard in `articles.spec.ts`
(three sabotages, plus the nullity-control lesson).

## The four fixes — all applied 2026-08-31, owner-approved

Playwright **675 → 687** (+6 axe scans, +6 write-once tests). pytest unchanged at **244**.
Every new guard was broken on purpose *before* its green result was believed, each with a
control run after the revert, and `git status` checked clean between them — a probe written
five minutes ago has never been observed failing, so a pass from it carries no information
(11p).

### 1 ✅ `e2e/a11y.spec.ts` now scans the articles

**Derived from the registry, not hand-listed** — `'/articles'` plus
`...ARTICLES.map(a => articlePath(a.slug))`, six scans.

⚠️ **Deliberately unlike the Learn line directly above it**, which picks one article of
twelve. That is sound where twelve pages share a template. These do not: the featured piece
draws an inline SVG figure and three others are ranked data tables, and table markup is
exactly where axe has the most to say. "One stands for the rest" would have been false here.

**All six passed first time** — the articles were already accessible. Proven able to fail by
planting `<img src="/logo.png">` with no alt on the article route: **`[critical] image-alt`,
naming the element.** Reverted; six green.

### 2 ✅ `check:page-weight` now budgets both

`/articles` **340 KB** (measured 268) · `/articles/how-far-do-asx-shares-fall` **350 KB**
(measured 272). Three consecutive measurements each, identical to the KB, so the ~28%
headroom is headroom and not noise. Proven able to fail by dropping the index budget to 100:
**`OVER /articles 268 KB / 100`, exit 1** — and it printed `OVER` rather than `ok`, which was
the F-010 defect.

⚠️ **The measurement corrected the reasoning that produced the finding.** This audit predicted
the articles would be the heaviest public pages we ship — frozen datasets, ranked tables, an
inline figure. They are among the **lightest**: 268 and 272 against `/learn`'s 290 and the
landing's 279. Tables are HTML and the figure is inline SVG, so the content that *felt* heavy
costs almost nothing to send. **The finding was right and its stated urgency was wrong**, and
saying so matters: a prediction left standing next to a fix reads as confirmed by it.

Two entries rather than five — the featured piece is the heaviest and carries the figure, so
a shared-bundle regression surfaces there first; the three ranked pieces measured 267 KB.
This is already more coverage than `/learn`, which budgets its index and no article.

### 3 ✅ `check:csp` now reads the articles' policy

12 → **14 routes**, 7 prerendered, zero violations. Both rows `wantsNonce: false` — a nonce on
a prerendered page kills every script on it (G7, measured).

⚠️ **Of everything missing from that list these two mattered most.** Every other public page
gets an identical policy, so a sibling standing in for it is a fair approximation. These are
the only routes whose policy can legitimately differ. Proven able to fail by flipping the
index to `wantsNonce: true`: **two problems, `nonce MISSING` and the "policy that lies" check**
— so the row is genuinely evaluated rather than merely listed.

### 4 ✅ F-033 — the acknowledgement write is now guarded

`acknowledgeWriteDecision` extracted into `lib/entitlement.ts`, beside `shouldShowOnboarding`,
and consumed by the action — so there is **one** copy of the rule, not two (11c). Behaviour is
byte-for-byte the same: same three outcomes, same order, same logging. Six new tests.

⚠️ **The extraction is the fix.** Nothing was wrong with the rules; they were unreachable. The
action builds its own Supabase client, so no credential-free spec could substitute a stub, and
four real protections sat unexercised on the one path already known to have destroyed a
compliance record. Same move, same reason, as `viewerFromProfileRead`.

⚠️ **The session check was deliberately left OUT of the extracted function.** It stays one line
above the call site, because the read cannot be issued without a user id; putting it in both
places would be a second copy of one rule, and a branch in the pure function that nothing calls.
Stated here rather than left to look like an oversight.

Four sabotages, and the fourth is the one that justifies the design:

| Sabotage | Result |
|---|---|
| delete the write-once skip | **red**: *an EXISTING date is never overwritten* — Expected `skip_already_acknowledged`, Received `write`. The June date, exactly |
| ignore `readFailed` | **red**: *a FAILED read is refused even when a row comes back* |
| delete `.is(…, null)` from the UPDATE | **red**, naming the race and its consequence |
| **return `refuse_unreadable` for everyone** | **3 red, incl. *a genuine first acknowledgement DOES write*** |

⚠️ **That last row is the control, and without it the file would have been worthless.** Every
refusal test is satisfied by a function that refuses *everything* — which would also mean no
reader could ever clear the modal. A guard has to prove the door opens as well as that it
shuts, the same reason `db-grants.spec.ts` asserts a real customer can still save their name.

⚠️ **One test is weaker than the rest and says so in the file.** The `.is(…, null)` race clause
is a property of the QUERY, not a decision, and there is no test database here (the same reason
a valid purge-cron call is never driven). So it is asserted against the **source**, with
comments stripped first. It would catch somebody deleting the line and would **not** catch a
client that silently stopped applying `.is()`. Named as a limit rather than counted as
equivalent coverage (11c-ix).

## Still open after this delta

⬜ **Layers 3, 3b and 4 need their own delta re-run.** The wire sweep predates the entitlement
rewrite; the data sweep predates the dividend re-pull of the whole universe. Vercel MCP was
confirmed working on 2026-08-31 — a READY preview for `fbf97fc` returned the real
`/articles` page through the SSO gate — so Layer 3 is **not** blocked, contrary to an earlier
claim in this session that was taken from a warning banner instead of from trying it.
