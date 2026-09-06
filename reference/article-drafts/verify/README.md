# Verifying the four drafts

Two scripts, no database and no credentials. Both read the frozen study data, so
they give the same answer in a year as they do today.

⚠️ **Ask `_data.py` for the data — never open a file.** The study is stored as
`reference/drawdown-recovery-2026-08-27-DATA.json.gz` (0.37 MB; it was 2.47 MB
uncompressed, and the owner chose the small form on 2026-08-30). Five scripts each
held the absolute path and their own `json.load`, which is five copies of one
decision: change how the data is stored and any one that is missed fails weeks
later with a FileNotFoundError nobody can date. `_data.load()` is now the only
place that knows. Want a readable copy? `python _data.py out.json` writes an
indented one wherever you point it — gitignored, so it cannot double the repo.

```bash
python reference/article-drafts/verify/assert_all.py
python reference/article-drafts/verify/consistency.py
```

**`assert_all.py`** re-derives every figure printed in the four articles from the
frozen data and compares it with what the article says. **464 figures.** It found
seven real disagreements on its first run, including one company sitting exactly
on the 20% line and one number I had estimated rather than counted.

**`consistency.py`** checks the things that live in two files at once — the depth
ladder appears in two articles, the three-market comparison restates figures from
the other two — plus the house rules: one as-at date everywhere, no italics in a
body, no "buy" or "sell", the disclaimer present, and Monster Beverage never
ranked in a body.

Both were broken on purpose before being trusted. `assert_all.py` was given three
wrong expected values (a looped assertion, a second-column value and a sector
count) and caught all three; `consistency.py` was given a drifted ladder value
and caught it.


---

## ⚠️ Which of these actually RUN (checked 2026-09-05, audit 5A-132)

**Four of the seven scripts run. Three cannot, and have never been able to.**

| script | |
|---|---|
| `assert_all.py` | ✅ runs — **464 figures, 0 failed** on 2026-09-05 |
| `consistency.py` | ✅ runs — ALL PASS |
| `audit_coverage.py` | ✅ runs — reports 8 printed numbers with no assertion behind them |
| `audit_thresholds.py` | ✅ runs — 1 count would change (PDN.AX, sitting exactly on the −20% line) |
| `audit_external.py` | ❌ **`ModuleNotFoundError: No module named 'engine'`** |
| `audit_independent.py` | ❌ same |
| `divfreeze.py` | ❌ same |

`engine.py` is **not in the repository and has no git history** — it was never
committed. Whoever ran those three had it in the working directory, read the output
once, and wrote the results into the section below. So the audit results recorded
here are real observations from a run that **cannot be reproduced**, and two of the
three dead scripts are the ones that check our figures against an **external**
source — which is the question that found a year of dividend drift (CLAUDE.md 11ae).

⚠️ That is 11f in this file's own subject matter: **a record saying a check exists is
not the check.** Left as a finding rather than reconstructed, because rebuilding a
module from three callers' usage is guesswork, and guesswork wearing the name of an
independent audit is worse than an obvious gap. **Owner's call.**

⚠️ Note what P4 already answers: on 2026-09-05 every one of the **864** active
tickers had its stored history compared against a fresh provider pull, and 850 matched
to 0.0000%. That is the same question `audit_external.py` was written to ask, asked of
a wider population — but of the LIVE database rather than of this frozen study file.

## The audit (2026-08-30)

Four more scripts, run after the articles were approved, because 464 passing
assertions only prove the numbers I *chose* to check.

| Script | What it does | What it found |
|---|---|---|
| `audit_coverage.py` | Pulls every number out of the four bodies and diffs against what the assertions actually cover | **24 printed numbers had nothing checking them**, including the whole S&P sector table beyond four rows, GPT's 93% fall, Intel, Vistra and every peak date in all three tables. All now asserted. |
| `audit_independent.py` | A second implementation of the fall-detection logic, vectorised instead of an index walk | **Exact agreement** on all 5,522 falls — counts, depths, dates, durations, recovery flags. Max difference 0.00005, which is the rounding in the frozen file. |
| `audit_external.py` | Re-fetches the 76 companies named in the articles and recomputes both printed columns | 72 match. **4 differ** (CBA, GPT, Lendlease, Centuria) — all Australian, all high-yield, all in the same direction. |
| `audit_thresholds.py` | Re-fetches every company within 5 points of a published line | **24 companies sit on the wrong side of a threshold**, moving several counts by 1–3. |
| `divfreeze.py` | Re-runs article 2's dividend comparison and freezes it | Reproduces exactly: 86.7% / 81.8%, Westpac 2.09 / 5.12, all four zero-dividend controls identical. |

**The cause of the four disagreements**, confirmed rather than assumed: our stored
history is not back-adjusted for a company's most recent dividend until the whole
series is next rebuilt. The ratio of our prices to a fresh pull is a constant
1.017–1.035 on every bar before that company's last ex-dividend date and exactly
1.0000 after it. Woolworths, which agreed perfectly, shows 1.0 throughout — the
control.


---

## The re-run (2026-08-30, after the dividend fix)

The audit's fourth finding turned out to be a real defect in the pipeline rather
than a caveat to disclose, so it was fixed and the whole study re-derived. See
`architecture.md` §4a and CLAUDE.md 11ae for the fix itself.

**81 of the 464 figures moved.** The articles were edited from this list — the
assertion suite was the worklist, which is the return on having written it. The
largest movements: the ASX "more than 20% down" count 90 → **88**, "more than 50%"
18 → **16**, the S&P "more than 20%" 147 → **143**, and ASX fifteenth place changed
hands from Centuria to **Xero**. The S&P and Canadian ranked tables are identical
in membership and order.

⚠️ **Two of these scripts were themselves wrong, and both would have failed on a
CORRECT system.** `consistency.py` held the literals `17.9` and `11.9` for the two
medians it exists to keep in sync, making the checker a third copy of the number;
`audit_independent.py` held the article's headline values, so when the correction
moved them the two implementations agreed with each other and only the AUDIT
printed `*** DIFFERS`. Both now derive their expectations. **A guard that restates
a number is not guarding it — it is joining the drift** (CLAUDE.md 11c).

⚠️ `audit_independent.py` also compared depths at `1e-6`, which is tighter than the
four decimals the frozen file stores. It reported **5,514 "disagreements" whose
largest was 0.0000499975** — a guard crying wolf loudly enough to hide a real
difference. The tolerance is now `1e-4`, and the second implementation agrees on
all 5,519 episodes across all six measures with **zero** disagreements.

**The audit's own findings are now closed:** the "our prices lag" disclosure has
been removed from all four fact-check sheets, because the lag was fixed rather than
disclosed. `audit_external.py` and `audit_thresholds.py` are kept — they re-fetch
from outside our database, which is the only check that can catch the next thing
our own data and our own code agree about.
