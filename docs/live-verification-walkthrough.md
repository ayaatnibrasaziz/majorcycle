# Seeing it for yourself — a live walkthrough

*Written 2026-08-06, after verifying all of it. Plain English throughout; nothing
here needs code.*

This is the walkthrough for checking **majorcycle.com** yourself, in your own
browser, including switching an account between every subscription state — free,
trialing, active, cancelled, payment failed, on hold, and scheduled for deletion.

I have already run every step below and it all passed. **Your run is a second
opinion on something already working, not the first time a problem could be
caught.** If anything looks different from what this document says it should,
that itself is the finding — tell me and stop there.

---

## Before you start — the one safety rule

> ### 🔴 Use a **spare account**, never your own.
>
> Switching states means editing a row in the database. If you edit **your own**
> account and you have a real Stripe subscription attached, two bad things can
> happen: Stripe's next message can overwrite what you typed halfway through
> (so you'd be looking at a state that is no longer set), and a mistake would
> affect your real billing.
>
> A spare account costs nothing and takes two minutes. Step 1 makes one.

You will need two browser tabs open side by side:

| Tab | What it is | Address |
|---|---|---|
| **A — the site** | MajorCycle itself | `https://www.majorcycle.com` |
| **B — the database** | Supabase's spreadsheet-style table editor | `https://supabase.com/dashboard/project/gurrrlogycxawududtyv/editor` |

Use a **private / incognito window** for Tab A, so the spare account's session
never mixes with your own.

---

## Step 1 — Make the spare account (about 2 minutes)

1. In the private window, go to **majorcycle.com**. It sends you to the sign-in
   screen — that is correct, the whole product is behind a login.
2. Click **Sign up**, and use an email you can receive mail at. A `+` trick works
   on Gmail: `ayaatnibrasaziz+statecheck@gmail.com` arrives in your normal inbox
   but counts as a different account.
3. Confirm the email, sign in, and accept the disclaimer box the first time.
4. You are now on the **free** tier. No card was asked for — that is by design.

**Keep this window signed in for the whole walkthrough.** You never sign out; you
only change the database row and press refresh.

---

## Step 2 — Find your spare account's row in the database

1. In Tab B, choose the **`profiles`** table from the list on the left.
2. Use the search box and type the spare email address. One row comes back.
3. The columns that matter are these five. Everything else, leave alone:

| Column | What it means |
|---|---|
| `subscription_status` | the state: empty, `trialing`, `active`, `past_due`, `canceled` |
| `grace_until` | for a failed payment: the moment the 3-day grace period runs out |
| `billing_blocked` | `true` when a payment was disputed with the bank |
| `deletion_scheduled_at` | set when the account is scheduled for permanent deletion |
| `cancel_at_period_end` | `true` when the plan is running out and won't renew |

To change one: click the cell, type the new value, press **Save**. Then go to
Tab A and **refresh the page**. That is the whole loop.

> **Emptying a cell:** Supabase shows a small **Set to NULL** option when you edit
> a cell. "NULL" and "empty" mean the same thing here — *no value*.

---

## Step 3 — Walk the states

For each state below: set the columns in Tab B → refresh Tab A → check the four
things in the right-hand column.

The quickest page to judge from is a stock page — use
**`majorcycle.com/stocks/us/AAPL`**. Look at four places on it:

- **the top-left badge** under the menu (`LICENCE STATUS`)
- the **OVERALL RATING** and **HEALTH SCORE** tiles near the top
- the two sidebar items **Run Analysis** and **Results** (padlocked or not)
- the **Download Report** button on the grey strip

### The states, one at a time

| # | State | What to set | What you must see |
|---|---|---|---|
| 1 | **Free** (no plan) | `subscription_status` → *empty* | Badge **NO PLAN**. Rating and Health both say **Unlock**. Verdict and Scorecard show a short pitch instead of content. Padlocks on Run Analysis and Results. Everything else — price chart, drawdown, financials, analysts, dividends, news — fully there. |
| 2 | **Trialing** | `subscription_status` → `trialing` | Badge **TRIAL ACTIVE**. Rating shows a real number out of 100, Health likewise. No padlocks. `/account` says *"Your free trial is active."* |
| 3 | **Active** | `subscription_status` → `active` | Badge **ACTIVE**. Everything unlocked. `/account` says *"You're on the Monthly plan."* |
| 4 | **Active but ending** | `subscription_status` → `active`, `cancel_at_period_end` → `true`, `current_period_end` → a date a few weeks out | Badge still **ACTIVE**, everything still works — they paid for it. `/account` says *"…active until <date> and won't renew."* |
| 5 | **Payment failed, still in grace** | `subscription_status` → `past_due`, `grace_until` → **tomorrow's date** | Badge **PAYMENT DUE**. Everything still works — this is the 3-day grace period. `/account` says *"We couldn't take your last payment. Update your card to keep access."* |
| 6 | **Payment failed, grace over** | `subscription_status` → `past_due`, `grace_until` → **yesterday's date** | Badge **ACCESS PAUSED**. Rating and Health back to **Unlock**, padlocks back. `/account` says *"…access is paused for now. Update your card and it comes straight back — nothing has been lost."* |
| 7 | **Cancelled** | `subscription_status` → `canceled` | Badge **CANCELLED**. Locked. `/account` offers **Start free trial** again. |
| 8 | **Paused** | `subscription_status` → `paused` | Badge **NO PLAN**, fully locked. **See the note below — this is the one state that can't actually happen.** |
| 9 | **On hold (payment disputed)** | `subscription_status` → `active`, `billing_blocked` → `true` | Badge **ON HOLD**. Locked **even though the subscription says active** — a dispute outranks everything. `/account` offers **Contact support**, *not* an upgrade button. We do not sell to someone whose payment is being clawed back. |
| 10 | **Dispute lost** | `subscription_status` → `canceled`, `billing_blocked` → `true` | Same **ON HOLD** treatment. |
| 11 | **Scheduled for deletion** | `subscription_status` → `active`, `deletion_scheduled_at` → a date next month | **Every page in the app** redirects to a *Reactivate* screen — even though the subscription is active. You cannot browse an account that is on its way out. |

### Putting it back

Set `subscription_status` → *empty*, `billing_blocked` → `false`,
`grace_until` → *empty*, `deletion_scheduled_at` → *empty*,
`cancel_at_period_end` → `false`. That is the free tier again. Or simply delete
the spare account from `/account` → *Delete my account*.

> ### About state 8, "Paused"
>
> Stripe does have a **paused** status, but it never reaches our database. Our
> code deliberately translates it to *no plan*, so a paused subscriber is treated
> exactly like a free reader — locked, politely, with nothing broken. Typing
> `paused` in by hand (state 8 above) is the only way to see it, and it proves the
> important half: an unfamiliar word in that column **locks** rather than unlocks.
> That is the rule the whole paywall rests on — anything we don't recognise is
> refused.

---

## Step 4 — Check the free tier keeps what it was promised

Set the spare account back to **free** (state 1) and open a few stock pages —
try `AAPL`, `BHP` and `ABX`. A free reader is promised *the data, not our
analysis.* Confirm all of this is present and working:

- the price chart, with its time buttons
- the drawdown chart with its bands
- 52-week range, moving averages, analyst price targets
- earnings, quarterly financials, balance sheet, dividends
- the Key Metrics comparison table
- insider transactions, analyst rating changes, short interest, the news list
- the "not financial advice" line, visible without scrolling

And confirm these are **not**: the Overall Rating number, the Health Score number,
the written Verdict, the five-pillar Scorecard, the Download Report button, and
the whole screener.

### The daily browsing limit

A free account may open **25 different stocks per day** (it resets at midnight
UTC, which is mid-morning in Australia). It is an anti-copying measure, not a
sales tactic. Opening the 26th shows a clear explanation — you would have to open
25 stocks to see it, so it is not worth doing by hand; I have tested it and the
wording is honest about what it is and that stocks you already opened still work.

---

## Step 5 — Check the paid side end to end

Set the spare account to **active** (state 3).

1. **Run a screener.** Go to **Run Analysis**, search and add three stocks —
   `AAPL`, `BHP`, `ABX` are a good trio because they span all three countries.
   Press **Run Analysis · 3**. It finishes in a couple of seconds and says
   *ANALYSIS COMPLETE* with a top pick.
2. Click **View Full Results**. Check the opportunity map has three dots and the
   table has three rows with ratings, and that the rating words are only ever
   **High Conviction / Constructive / Neutral / Cautious / Bearish** — never
   "Buy" or "Sell" in *our* columns. (The **Analyst** column is Wall Street's own
   wording, quoted as-is, and will say Buy or Hold. That is deliberate.)
3. **Export ▸ Download CSV**, then **Export ▸ Download Excel**. Open both.
   - The Excel file should be colour-coded — dark green for the strongest
     ratings through to red — with a navy header row.
   - **Pick any number and check the two files agree, and agree with the screen.**
     This is what I fixed today: they used to disagree by one cent on about 4% of
     figures. Barrick's analyst target read `CA$65.76` on the page and in Excel,
     and `65.75` in the CSV.
   - The **FCF Yield** column will be **blank** for BHP and ABX and filled in for
     AAPL. That is correct, not missing data — see the currency note below.
4. **Download Report.** On a stock page, press *Download Report* on the grey
   strip. You get a single `.html` file of about 4 MB. **Open it.** It must show
   the full report with working charts, not a blank page. (It *was* blank for
   every stock between 1 and 5 August; that is fixed and now has a test that
   downloads the real file and opens it.)

---

## Step 6 — The currency check

This is the subtle one, and worth two minutes because it is where the money
mistakes hide.

Open **`/stocks/au/BHP`**:

- The share price is in **A$** — BHP is an Australian listing.
- The **balance sheet and financial statements** carry a line saying
  *"Figures reported in US dollars (USD) — the company's reporting currency, not
  its share price currency (AUD)."* BHP genuinely reports in US dollars while its
  shares trade in Australian ones.
- The **Valuation History (P/E) chart** is deliberately **not drawn**, and says
  so in words: a price-to-earnings chart would divide Australian dollars by US
  dollars. **A missing chart with an explanation is the correct outcome here.**
- In **Key Metrics**, the **FCF Yield** row is absent for the same reason.

Open **`/stocks/ca/ABX`** and expect the same in Canadian dollars. Open
**`/stocks/us/AAPL`** as the control: one currency throughout, so the P/E chart
*is* drawn and FCF Yield *is* shown. 79 of our 863 stocks are in this
cross-currency situation — a third of the Canadian ones.

---

## What I checked, so you know what your run is confirming

Everything in this document, on the live site, on 2026-08-06:

| | |
|---|---|
| Surfaces walked as a **free** account | Browse, three stock pages, Run, Results, Account, Request a Ticker, Pricing, the report route, the analysis API |
| Premium data in the page source for a free reader | **zero** occurrences of all nine paid fields, with a positive control in the same read |
| Subscription states driven | **11**, each on four surfaces |
| Refusals | every one says `private, no-store` and names its own reason |
| Screener | run for real; both exports downloaded and **152 cells** compared one by one — 0 mismatches |
| Offline report | downloaded and opened as a file; mounts, 6 charts, no errors |

---

## The one thing I am not happy with

**The Results table shows every price with a plain `$`, whatever country the
stock is from.** In the run above, the Close column reads `$309.38` for Apple
(US dollars), `$62.54` for BHP (Australian dollars) and `$53.74` for Barrick
(Canadian dollars) — three different currencies, one symbol. The same is true of
the `Close` and `Analyst Target` columns in the CSV and Excel exports, which have
no currency column at all.

It is not *wrong* — the figures are correct and in each stock's home currency,
the Market column beside them says US / AU / CA, and hovering the column heading
explains it. Everywhere else on the site is careful about this: the stock pages
show `A$` and `CA$` properly. But this is the same trap the currency audit
already caught once, where a bare `$` sat under an `A$` with nothing to say they
differed.

**I have not changed it, because it is a design decision about your table, not a
bug to fix quietly.** Three options, and the choice is yours:

1. **Show the symbol per row** — `A$62.54`, `CA$53.74`. Clearest to read, but a
   column of mixed symbols that can still be sorted numerically is arguably worse,
   because sorting prices across three currencies means nothing either way.
2. **Add a Currency column** to the table and both export files. Least pretty,
   most honest, and it makes the exports self-describing.
3. **Leave it**, on the grounds that the Market column and the tooltip already
   say so.

My recommendation is **2** — mainly for the exports, because a spreadsheet leaves
the website behind and the tooltip does not travel with it.

---

## If something looks wrong

Tell me what you saw and on which page. Do not try to fix the database row — if a
state renders wrongly, the row is evidence.

Anything that misbehaves after a change can be undone in seconds: Vercel keeps
every previous version of the site and can switch back to one instantly, with no
code change.
