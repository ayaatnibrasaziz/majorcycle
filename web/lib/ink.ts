/**
 * Text ink for the semantic (direction / series) palette.
 *
 * A colour that is a **line, a candle, a dot or a bar** keeps the value it has
 * always had. The same colour used as **words** points at one of these instead.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * Green-for-up is a convention every trading tool follows, and the owner scoped
 * it out of the 2026-08-22 rating-colour work for exactly that reason. Measuring
 * the signed-in pages for the first time then showed that the direction palette
 * is not only fills and lines: on ONE stock page it was **57 pieces of text**,
 * worst 2.11:1 against a 4.5 floor — the "Key Risks" heading, Current Drawdown,
 * the analyst consensus figure, every earnings beat and dividend streak.
 *
 * A rising candle and the sentence describing it are different objects with
 * different rules. So they get different values, and the candle is untouched.
 *
 * ⚠️ THIS IS THE SECOND COPY of the `--c-*-ink` custom properties in
 * `app/globals.css`, and it cannot be the first: CSS cannot be imported into
 * TypeScript. Two copies of a rule drift, so the drift is made impossible rather
 * than discouraged — `pnpm check:tier-palette` parses both files and fails the
 * build if any value disagrees. Same arrangement, and same reasoning, as
 * `RATING_TIER_HEX`.
 *
 * ⚠️ THIS BLOCK GAVE THE WRONG REASON UNTIL 2026-09-03, and a wrong reason is
 * worse than none: it said a Recharts `fill`/`stroke` prop "is an SVG attribute,
 * where `var(--x)` is not resolved". **Measured in Chrome — it resolves.** An SVG
 * presentation attribute is parsed as a CSS value, so `fill="var(--brand-deep)"`
 * computes to `rgb(26, 58, 110)`, identical to the literal. Two of the four
 * Opportunity Map quadrant labels have been shipping exactly that.
 *
 * The line that IS true, and the one this file actually rests on: **Lightweight
 * Charts paints to a `<canvas>`**, and a canvas takes a colour string with no
 * stylesheet behind it, so `var()` there is simply an unparseable colour. Price
 * Chart, the drawdown overlay and the Smart Money markers are all canvas.
 *
 * ⚠️ And there is a second, sharper reason to keep the TS constants even for
 * Recharts, which the same measurement turned up: an **undefined** custom property
 * in a `fill` does not void the declaration the way it does in CSS shorthand — it
 * computes to **black**. `fill="var(--typo)"` paints a chart label in plain black
 * on a light chart, which reads as a deliberate choice and errors nowhere. A
 * mistyped TypeScript identifier is a build failure. Where both routes work, take
 * the one whose mistakes are loud (CLAUDE.md 11q).
 *
 * ⚠️ These are DIRECTION colours, not RATING colours. `INK.up` means the number
 * went up; `--c-tier-2` means our judgement is Constructive. Several values
 * coincide today and the two sets are still separate on purpose — they must be
 * free to move apart, and one shared token is how they would silently stop being
 * (CLAUDE.md 11c, and the note above `RATING_TIER_HEX`).
 */
export const INK = {
  /** Up, better, a beat, a buy. Was #228B22 — 3.86:1 on a 10% green tint. */
  up: '#1B741B',
  /** Mixed, average, stretched, "hold". Was #D4A017 / #9A7010 / #B58800. */
  neutral: '#6B6266',
  /** The least favourable rung of a ramp. Was #FF4500 — 3.11:1 as a KPI value. */
  warn: '#C73600',
  /** Down, worse, a miss, a sell. Already legible at 6.68:1 — unchanged, and
   *  named here so callers stop hand-typing it beside three that did change. */
  down: '#B22222',
  /** Brand blue as text on its own tint. Was #2E7DE8 — 3.67:1 on the DMA chip. */
  brand: '#1E5CB3',
} as const;

/**
 * Benchmark-index series colours for Relative Performance.
 *
 * ⚠️ These are the one place a SERIES colour changed rather than only its label,
 * and the reason is that Recharts paints a legend entry in the series' own
 * colour — so the line and the words are the same value by construction. The ASX
 * gold measured **2.38:1**, which fails the 3.0 a chart line owes on its own,
 * never mind as text; the TSX teal passed as a line (3.30) and failed as a label.
 * Darkening both keeps each legend entry matched to the line it names.
 */
/**
 * THIRD-PARTY analyst opinion — Wall Street's Buy / Hold / Sell, shown verbatim
 * (CLAUDE.md #17). Mirrors `--analyst-*` in globals.css.
 *
 * ⚠️ NOT our rating colours, and not the direction colours either. A Yahoo *Sell*
 * chip drawn in `--c-tier-5` reads as OUR conclusion about the stock — which is
 * exactly what the pills did until 2026-09-02, hard-typing `#8B1414` (audit
 * 5A-045). On a product whose whole compliance posture is "information only", the
 * line between what we say and what we are reporting has to be visible. Measured
 * 16.8 from Constructive and 12.6 from Bearish, and every chip still carries the
 * word itself, so nothing rests on the colour alone.
 */
export const ANALYST = {
  positive: '#2E6B57',
  neutral: '#4A5568',
  negative: '#7A2F3F',
} as const;

export const SERIES_TEAL = '#00695C';

/**
 * The teal the Learn and Articles figures draw a PRICE LINE in.
 *
 * ⚠️ A SECOND TEAL, AND IT MUST STAY ONE. `SERIES_TEAL` above is a chart series
 * colour and free to move; this one is welded to the three `/learn`
 * illustrations, whose teal is baked into the image files. Those images cannot
 * be regenerated — the same prompt returns a different picture, so the committed
 * file is the only copy that will ever exist (CLAUDE.md 11p). Change this and the
 * figures stop matching the artwork beside them.
 *
 * It was hand-typed in `FallByMarketFigure` and `PeFigure` and existed in no
 * palette at all (audit 5A-095); naming it is what stops a third copy appearing.
 */
export const FIGURE_TEAL = '#0E7C8B';

/**
 * The third series in a comparison figure — the market being compared AGAINST,
 * drawn quieter than the subject on purpose.
 *
 * ⚠️ It was `var(--text-muted)`, and that is why it needed a name (audit 5A-054).
 * `--text-muted` is a **text** token, and it is also the value `--data-missing`
 * holds, so a chart line was borrowing a colour whose job is "prose the reader can
 * skip" and whose twin means "we have no figure for this". Nothing was wrong on
 * screen — measured on the real ground it is ~4.9:1, above the 4.8 floor, and the
 * "no data" meaning renders only in the signed-in results table, which no reader of
 * `/articles` can see at the same time. The cost was that darkening `--text-muted`
 * for a legibility reason would silently move a data series (5A-059).
 *
 * Same value as `--text-muted` today, and no longer tied to it.
 */
export const FIGURE_NEUTRAL = '#626B77';
