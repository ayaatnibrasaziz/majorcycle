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

**Four scripts run. Three could not, and were DELETED on 2026-09-10 by owner
decision** — `audit_external.py`, `audit_independent.py` and `divfreeze.py`. The
table keeps their row because the finding outlives the files: what those three
were *for* is still not covered, and deleting a broken check must never be
mistaken for closing the gap it left (11f).

| script | |
|---|---|
| `assert_all.py` | ✅ runs — **464 figures, 0 failed** on 2026-09-05 |
| `consistency.py` | ✅ runs — ALL PASS |
| `audit_coverage.py` | ✅ runs — reports 8 printed numbers with no assertion behind them |
| `audit_thresholds.py` | ✅ runs — 1 count would change (PDN.AX, sitting exactly on the −20% line) |
| `audit_external.py` | ❌ never ran — **DELETED 2026-09-10** (`ModuleNotFoundError: No module named 'engine'`) |
| `audit_independent.py` | ❌ same — **DELETED 2026-09-10** |
| `divfreeze.py` | ❌ same — **DELETED 2026-09-10** |

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


---

## Article 6 — ASX tech shares (as at 15 October 2026)

A separate study, seven weeks after the first four, so it has its own files.

```bash
python -I reference/article-drafts/verify/assert_tech.py              # 141 figures, draft AND content.tsx
python -I reference/article-drafts/verify/assert_tech.py --from-raw   # also proves the extract matches the raw freeze
```

| file | what it is |
|---|---|
| `freeze_asx_tech.py` | captured the raw freeze on 2026-10-16: full price history of all 200 ASX 200 members and the index, to 15 October. **Do not re-run it for this article** — prices are re-adjusted every time a company pays a dividend, so a fresh pull is a different measurement |
| `reference/asx-tech-2026-10-15-DATA.json.gz` | that raw freeze, 22 MB, **gitignored** and kept on the owner's machine only |
| `asx_tech_figures.py` | derives every figure using the site's own engine (Medium preset). `--derive` writes the committed extract; `--recovery` and `--companies` print the recovery tables |
| `reference/asx-tech-2026-10-15-DERIVED.json.gz` | the committed extract, 89 KB: each company's drawdown figures and every 20% fall it has had |
| `recovery_episodes.py` | the recovery study's rule, written down for the first time. The original study's code was never committed; run this file directly to compare it against the August study (193 of 195 companies identical, 1,210 of 1,211 waits) |
| `assert_tech.py` | checks every figure against the draft AND against `web/app/(public)/articles/content.tsx`, so the two copies cannot drift |

⚠️ **Weebit Nano's history starts on 3 August 2016**, its first day of trading after the
reverse takeover of Radar Iron (`STARTS` in `asx_tech_figures.py`). Before that the series
is an iron-ore company's. The stock page does not make this cut, so the article says so.

⚠️ **A finding about the August study:** its working notes give the typical ASX wait as
0.94 years. Its own estimator gives 0.92; `assert_all.py`'s ±0.05 tolerance hid the gap.
The published text says "about a year", so nothing a reader sees is wrong.

## Article 7 — Netflix's third-quarter 2026 results (draft 07)

A results article, so two kinds of figure: Netflix's own (typed once in `assert_nflx.py` from
the shareholder letter, every comparison computed) and our price measurements.

```bash
python -I reference/article-drafts/verify/freeze_nflx.py 2026-10-21   # once, after the as-at close lands
python -I reference/article-drafts/verify/nflx_figures.py             # prints every measured figure
python -I reference/article-drafts/verify/assert_nflx.py              # the draft's answer box and body, and the site copy
```

| file | what it is |
|---|---|
| `freeze_nflx.py` | freezes Netflix, the S&P 500 and the Nasdaq to the as-at date; refuses if any series stops short |
| `reference/nflx-q3-2026-DATA.json.gz` | that freeze |
| `nflx_figures.py` | the record close, 52-week high, falls of 40%+ (the recovery study's rule), the 44 results-day moves, and the engine's normal fall |
| `assert_nflx.py` | asserts every figure against the reader-facing text of the draft AND the shipped copy (`content.tsx` body + the registry answer, which must equal the draft's word for word). The fact-check sheet is excluded on purpose: it quotes other sources' wrong figures |

⚠️ **The 44 results dates are 8-K filing dates (Item 2.02).** Netflix reports after the US close, so
the move is the next session's close against the filing day's. Every move, every fall and the record
close were re-computed from **Netflix's own historical prices** (its investor site) and matched
exactly; that is the independent check, since the price history otherwise comes from our own data.


⚠️ **Two one-year highs, on purpose.** The article's 52-week high is the calendar year after the as-at
date a year earlier ($116.73, 13 Nov 2025). The model's is the last 252 trading days, which on
21 Oct 2026 still starts on 21 Oct 2025 ($124.86). The body says so where it uses the model's figure;
`assert_nflx.py` derives the window from the preset and checks that date, so it cannot drift silently.
