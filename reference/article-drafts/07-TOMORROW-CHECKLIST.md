# Netflix (article 7 + video 2): what changes on 22 October, and how to fix it fast

Everything else is final and checked. Only the items below depend on the **close of 21 October in New
York** (07:00 on 22 October, Sydney) and on our nightly price update storing it (the US run is
01:30 UTC = 12:30 Sydney, and GitHub often starts it a few hours late).

## 0. Is the data in? (one query)

```sql
select date, close from price_bars where ticker='NFLX' and date >= '2026-10-19' order by date;
```
Need rows for **2026-10-20 (expect 68.69)** and **2026-10-21**. Netflix's own price page
(ir.netflix.net → Stock Information → Historical Stock Quote) is the independent check.

## 1. The numbers (both article and video read these)

1. `reference/article-drafts/verify/nflx_figures.py`: add `"2026-10-20"` to the end of `RELEASES`
   (its next-day close now exists), so the results-day count becomes 44 and the streak becomes six
   if the shares fell.
2. `python -I reference/article-drafts/verify/freeze_nflx.py 2026-10-21`
3. `python -I reference/article-drafts/verify/nflx_figures.py` and note: last close, below record,
   below one-year high, YTD, the 20 Oct → 21 Oct move, the streak, the S&P 500 below its high, the
   engine's "now" figure, the median / 10%+ counts (they include the new release now).
4. Rating: `rating-env/Scripts/python.exe -I rating_nflx.py "<repo>" 2026-10-21 rating_nflx_1021.json`
   (in `mc-video-tools`).

## 2. Article (`07-netflix-q3-2026-results.md`) — the places to edit

| Where | Now | Change to |
|---|---|---|
| Publishing details · As at | ⏳ | "Share prices: the close on 21 October 2026" |
| Answer box | "fell after the results" | confirm direction with the 21 Oct close; state the move |
| How the shares reacted | ⏳ placeholder | the 21 Oct close and its % move against 20 Oct (68.69) |
| Same section, 3 bullets | figures at 20 Oct | keep "On 20 October, the day of the results…" OR move them to 21 Oct; one date only |
| S&P 500 sentence | "On 19 October … 1.6%" | the as-at date and figure |
| How Netflix shares usually react | 43 releases, streak of five | 44 if the new release is counted; "sixth in a row" only if it fell |
| Its own normal | "On 19 October it was 44.1% below" | the as-at date and figure |
| Fact-check sheet | spot-check 5 | add the 21 Oct close |

Then `python -I reference/article-drafts/verify/assert_nflx.py` must print **every figure found**.

## 3. Video — seven narrated lines depend on the close (marked `tbd` in `video2/make_script.py`)

| Line | Says now | If the shares FELL on 21 Oct | If they ROSE |
|---|---|---|---|
| 2 | "For the sixth time in a row after its results." | keep | **replace** with "They had fallen after each of its last five results." and change line 1 to "And the shares fell after hours anyway." |
| 52 | "about forty-nine per cent below their record close" | the new figure, rounded | same |
| 53 | "the S and P five hundred is sitting close to its own high" | check the S&P figure still supports it | same |
| 73 | "normally falls about twenty-seven per cent" | the new engine figure | same |
| 74 | "Today, it's about forty-five per cent below" | the new figure | same |
| 76 | "High Conviction, eighty-one out of one hundred" | the new rating | same |
| 77 | "Financial health, eighty-three. Valuation … sixty-six. … one hundred" | the new pillar scores | same |

Steps (in `mc-video-tools/video2`):

1. Edit those lines in `make_script.py`, run `python -I make_script.py`.
2. Delete the old takes of only those lines from `audio/` and `audio_v3/` (e.g. `L52-s*.wav`),
   remove them from `qa.json` and `choices.json`, then re-voice them:
   `../cb-env/Scripts/python.exe narrate.py jobs-tomorrow.json` with `[[2,7],[52,7],…]`
   (about 3 minutes a line; re-run with seed 11 for any that fail the check).
3. `../kokoro-env/Scripts/python.exe qa_audio.py L02-s7 L52-s7 …` → every one PASS.
4. `CHOICES=choices.json ../kokoro-env/Scripts/python.exe process_v3.py`
5. `python -I extract.py "<repo>" ../rating_nflx_1021.json` (the cold-open arrows, the charts, the
   rating card and the thumbnails all redraw from this; the sixth arrow fills itself in)
6. `python -I check_facts.py` → **0 without a source** (today it flags exactly lines 52 and 74, as
   designed: their numbers belong to the 21 Oct figures)
7. `../kokoro-env/Scripts/python.exe -I build_timeline.py --final`, then `build_sfx.py`, `build_short.py`
8. `../kokoro-env/Scripts/python.exe finish.py Video2 "<repo>/reference/video-02/final/MajorCycle-video-02-Netflix.mp4"`
   and the same with `Short2`; then `build_meta.py` for the description, and re-render the two thumbnails (`SHORT=1 node stills2.mjs <dir>` → Thumb2A = video, ShortCover = Short): their −48% comes from the data, so it updates itself.

The Short reuses lines 0–3 (including line 2) and needs the same re-render.

## 4. Before publishing (owner)

- Watch the video and the Short; check the cold open's six arrows and the rating card.
- Upload as unlisted first, as with video 1. Title (owner's choice): "Netflix Beat Its Forecast. The Shares Fell Anyway." Video thumbnail = thumbnail-video.png; Short cover = thumbnail-short.png.
- Vercel stays on Hobby (owner decision).

## Done 22 October (videos only)

- Data in: NFLX 21 Oct close **$65.04** (−5.31% on 20 Oct's $68.69), matched on Netflix IR's own price feed.
  Data refrozen at 2026-10-21; `"2026-10-20"` added to `RELEASES` (44 releases, six falls in a row).
- Rating at 21 Oct: **High Conviction 85** (Financial Health 87.6, Valuation 71.7, Cycle Payoff 100). Health
  moved because the post-results refresh pulled in the Q3 statements.
- Re-voiced lines 3 ("more than half below"), 52 (51%), 56 (44 results), 74 (48%), 76 (85), 77 (88 / 72 / 100).
  Lines 2, 53, 73 unchanged and still true. Old takes in `video2/archive-pre1021/`.
- Final files in `reference/video-02/final/`. YouTube text now says 44 releases to October 2026.
- Article updated to the 21 Oct close (answer box, reaction, results record, falls table, model line,
  fact-check sheet). `assert_nflx.py`: 74 of 74, and it caught three planted errors. Prices
  re-checked against Netflix IR; S&P close against market reports.
