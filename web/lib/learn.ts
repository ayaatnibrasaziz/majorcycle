/**
 * The Learn library — one registry, and it is the only place an article exists.
 *
 * ── Why a registry rather than a folder of pages ─────────────────────────────
 *
 * Five things have to agree about every article: the URL, the sitemap entry, the
 * middleware allow-list, the canonical tag, and the index page's list. Written by
 * hand that is five copies of one fact, and the failure is silent in the way
 * CLAUDE.md 11c keeps describing — an article that renders perfectly and is
 * absent from the sitemap looks completely fine to everyone except Google.
 *
 * So this list is the source, and `lib/seo.ts` DERIVES its `/learn/<slug>`
 * entries from it. That single derivation is what makes the middleware let the
 * page through, the sitemap list it, `pageMetadata()` accept its path, and the
 * public header show its full chrome. Adding an article is one entry here plus
 * its body; nothing else has to be remembered.
 *
 * ⚠️ **NO REACT IN THIS FILE, and that is load-bearing.** `lib/seo.ts` imports
 * it, `proxy.ts` imports `lib/seo.ts`, and `proxy.ts` runs as middleware. Pull a
 * component in here and every article body joins the middleware bundle — which
 * runs on every single request to the site. The bodies live in
 * `app/(public)/learn/content.tsx`, keyed by slug, and TypeScript requires one
 * per slug so the two cannot drift apart.
 *
 * ── Audience (owner decision, G2) ────────────────────────────────────────────
 *
 * Articles target the NEWCOMER. They exist to be found by someone who typed a
 * question into Google and has never heard of us. The paying subscriber mostly
 * will not read them, and that is correct — it must not be "fixed" by making
 * them more advanced.
 */

/**
 * Themes group the index. Grouped by subject rather than by date, because an
 * explainer does not expire and a date column would imply it does. (The weekly
 * market note is the opposite and gets its own dated section — see the briefs.)
 */
export type LearnTheme = 'cycles' | 'quality' | 'using-it';

export interface LearnThemeMeta {
  readonly id: LearnTheme;
  readonly label: string;
  readonly blurb: string;
  /**
   * The topic's illustration.
   *
   * Generated 2026-08-16 on Gemini "Nano Banana Pro" at 4K (5056 × 3392 lossless
   * PNG), then cropped to the size below. ⚠️ **The masters are not reproducible**
   * — the same prompt returns a different picture every time — so the 4K files
   * are the only copies that will ever exist of these exact images. The prompts,
   * the house style they encode, and the four instructions that turned out to be
   * load-bearing are recorded outside the repo; the *reason* they matter is that
   * re-running them will not recreate what is committed here.
   *
   * ⚠️ **OPTIONAL ON PURPOSE, and the page degrades rather than breaks.** With an
   * image the band is the approved two-column layout; without one it renders as a
   * single text block held to the header's 720px measure. That matters because
   * the alternative — a dashed "image goes here" box — is the kind of placeholder
   * that ships to production because everyone assumed somebody else would notice it.
   *
   * ⚠️ That second sentence was FALSE from this file's creation until 2026-08-16,
   * and it is worth keeping the correction visible. The band declared its
   * two-column track unconditionally, so an imageless topic kept both columns and
   * put its text in the first: 532px of content and 588px of nothing beside it, at
   * every desktop width. The sentence described the intent; nobody had opened the
   * page at ≥1024px to check. **Graceful degradation is a claim about rendered
   * output, so it is only ever established by rendering it** — see
   * `learn.spec.ts`, which now measures the imageless band instead of trusting
   * this comment.
   *
   * Crop **1600 × 1000 (16:10)**. The band renders ~588px wide, so this is still
   * well past what a retina screen needs — the headroom is deliberate, for a
   * wider layout later. Stated here rather than on the page: a public page should
   * not print production notes at its readers.
   *
   * Owner decision (2026-08-15): these are CONTENT, not brand furniture. They are
   * not bound by the design system and do not need to match the palette — they
   * need to look good and explain the topic. ⚠️ In practice they DID converge on
   * a house style (navy ground with stepped strata, teal price lines, gold
   * windows, a navy-suited figure seen from behind, and no green, red or arrows),
   * because three pictures that do not share a vocabulary do not read as a set.
   */
  readonly image?: { readonly src: string; readonly alt: string };
  /**
   * Titles that are planned but not written — rendered under the topic as
   * "Coming soon", greyed and NOT linked.
   *
   * ⚠️ **Titles only, and deliberately not `LearnArticle`s.** The moment one of
   * these becomes a registry entry it acquires a URL, a sitemap row, a
   * middleware allow-list entry and a canonical tag — and `content.tsx` would
   * have to hold a body for it, because `Record<LearnSlug, …>` refuses to
   * compile without one. A promise about a future article must cost none of
   * that. These are strings; there is nothing here that can become a link by
   * accident, and `learn.spec.ts` asserts none of them ever does.
   *
   * ⚠️ **A "coming soon" row is a promise to a stranger, and the ratio is the
   * message.** One written article beside eleven promises does not read as a
   * growing library, it reads as a shell. Owner asked to see the whole page
   * assembled (2026-08-16) and this is inside the unmerged PR #89, so nothing
   * is public — but the count is a merge decision, not a design one.
   */
  readonly upcoming?: readonly string[];
}

export const LEARN_THEMES: readonly LearnThemeMeta[] = [
  {
    id: 'cycles',
    label: 'Falls and recoveries',
    blurb: 'What a fall actually is, why the same share tends to fall by similar amounts, and what that can and cannot tell you.',
    image: {
      src: '/learn/falls-and-recoveries.png',
      alt: 'A share price traced along the top edge of a dark navy landscape, rising and falling three times by clearly different amounts. A small figure stands at the bottom of the deepest fall, looking up the slope ahead, with a misty city skyline behind.',
    },
    // Both titles announced here are now written and live above. Kept as a note
    // rather than an empty array: `upcoming: []` and a missing field render
    // identically, so the empty array would be a silent claim that the list was
    // considered when it might just as easily have been forgotten.
  },
  {
    id: 'quality',
    label: 'Judging the business',
    blurb: 'A falling price is not the same as a bargain. What the accounts underneath are being asked, in plain words.',
    image: {
      src: '/learn/judging-the-business.png',
      alt: 'Two office towers of the same height under identical falling share prices. One stands square with warmly lit windows and an open doorway; the other leans, cracked from top to bottom, its windows dark and its highest floor sliding away. A small figure stands between them, looking up.',
    },
    // Announced and now written — see 'is-a-dividend-safe' below.
  },
  {
    id: 'using-it',
    label: 'Using MajorCycle',
    blurb: 'How to read a rating, what the five tiers mean, and what the tool deliberately does not try to do.',
    image: {
      src: '/learn/using-majorcycle.png',
      alt: 'A share price falling through five stepped depth bands to a marker at the bottom of a valley. A small figure stands at the point where the drawn landscape fades away into empty mist, looking out at nothing.',
    },
    // ⚠️ "What the five tiers mean" was announced here and has been FOLDED into
    // "How to read a MajorCycle rating" rather than written separately. Two
    // articles about one rating would compete for the same search and repeat
    // each other — the duplicate-content shape `learn.spec.ts` now polices
    // between articles. Recorded rather than silently dropped.
    // Announced and now written — see 'what-majorcycle-doesnt-do' below. Every
    // theme's "Coming soon" list is now empty, which is the state the field was
    // built for: a promise costs nothing to keep once it is kept.
  },
] as const;

export interface LearnArticle {
  /** URL segment. Lower-case, hyphenated, never changed once published — a
   *  changed slug is a dead link everywhere the old one was ever shared. */
  readonly slug: string;
  /** `<h1>` and the browser title. */
  readonly title: string;
  /**
   * The question a real person types, in their words rather than ours.
   *
   * Kept as its own field because it is what the article is FOR. When the title
   * and the question drift apart, the article has stopped answering anything —
   * and that is invisible unless the two sit side by side.
   */
  readonly question: string;
  /**
   * The direct answer, rendered immediately under the heading before any prose.
   *
   * ⚠️ Structural, not stylistic. The brief calls for "a direct answer
   * immediately underneath rather than a preamble" — that is the shape a search
   * engine quotes and the shape a reader in a hurry needs. Making it a required
   * FIELD means an article physically cannot be published without one; leaving
   * it to the body would make throat-clearing the path of least resistance.
   */
  readonly answer: string;
  /** One honest sentence for the index list and the meta description. */
  readonly summary: string;
  readonly theme: LearnTheme;
  /** ISO date. Real, and shown — an undated explainer about money reads as abandoned. */
  readonly published: string;
  /**
   * Reading time, in whole minutes, shown beside the title on the index.
   *
   * ⚠️ A second copy of a fact about the body (CLAUDE.md 11c/11k) — the body is
   * the truth and this is a claim about it, so it can drift the moment anyone
   * edits the prose, silently and while still looking plausible. It is a field
   * rather than a computed value because the bodies are React components, not
   * text, so there is nothing to count at build time without rendering them.
   *
   * `e2e/learn.spec.ts` therefore counts the words on the RENDERED page and fails
   * if this is more than 2 minutes out — which is the only place the two can be
   * compared, and it closes the drift the field opens.
   */
  readonly minutes: number;
  /**
   * ISO date this was last checked against the running product.
   *
   * ⚠️ CLAUDE.md 11k. An article that quotes a figure or describes a screen is a
   * MEASUREMENT with a shelf life, not a spec. Stating when it was last verified
   * is the honest version, and it is why the worked examples pull from the same
   * nightly snapshot the landing page uses rather than hard-coding numbers.
   */
  readonly reviewed: string;
}

/**
 * ⚠️ `satisfies`, NOT `: readonly LearnArticle[]`.
 *
 * An explicit annotation widens every `slug` to `string`, which quietly destroys
 * the whole point of `LearnSlug` below: the body map in
 * `app/(public)/learn/content.tsx` is keyed by that union, and it is what makes
 * TypeScript refuse to compile an article registered without a body. Annotate
 * this and the map's key type becomes `string`, the compile-time completeness
 * check evaporates, and the first thing anyone notices is a blank article page.
 * `satisfies` gives the same type checking of the CONTENTS while keeping the
 * literals.
 */
export const LEARN_ARTICLES = [
  {
    slug: 'what-is-a-drawdown',
    title: 'What is a drawdown?',
    question: 'What does “drawdown” mean for a stock?',
    answer:
      'A drawdown is how far a share price has fallen from a recent peak, written as a percentage. If a stock reached $100 and now trades at $80, it is in a 20% drawdown. It measures distance from the top — not whether the company is in trouble.',
    summary:
      'What a drawdown is, which peak it is measured from, and what counts as a normal drawdown for a stock — judged against that company’s own record.',
    theme: 'cycles',
    published: '2026-08-15',
    reviewed: '2026-08-19',
    // 2,187 words with its three figure captions — measured, not estimated.
    //
    // ⚠️ Every reading time in this file was re-measured on 2026-08-20 and FOUR
    // of the eight then-published articles were wrong by a minute. All four were
    // inside the guard's ±2 tolerance, so nothing had gone red, and none of them
    // had been edited since the last count — the drift came from re-reading a
    // number that had been rounded once and then treated as settled. A loose
    // tolerance stops a body from being gutted; it does not keep a claim true.
    // Re-measure rather than re-estimate whenever the prose is touched.
    minutes: 11,
  },
  {
    slug: 'dip-correction-crash',
    title: 'Dip, correction, crash — what’s the difference?',
    question: 'What is the difference between a dip, a correction and a crash?',
    answer:
      'A dip is a fall of less than 10%, a correction is 10% or more, and a crash is a fall that is sudden as well as deep. They are conventions rather than rules, and they were built to describe the whole market — not a single company.',
    summary:
      'The three words explained, where their round numbers actually came from, and why a threshold built for an index tells you almost nothing about one company.',
    theme: 'cycles',
    published: '2026-08-19',
    reviewed: '2026-08-19',
    minutes: 7,
  },
  {
    slug: '52-week-high',
    title: 'What a 52-week high really tells you',
    question: 'What does a 52-week high mean for a stock?',
    answer:
      'A 52-week high is the highest price a share has touched in the past year, and it moves every day. It is an intraday figure, so a chart drawn from closing prices will show a lower peak — the same company, two correct numbers.',
    summary:
      'What the number is, why the peak on a closing-price chart never quite reaches the high everyone quotes, and why it describes one year of prices rather than a company.',
    theme: 'cycles',
    published: '2026-08-19',
    reviewed: '2026-08-19',
    minutes: 7,
  },
  {
    slug: 'own-history-vs-market-average',
    title: 'Why your company’s own history beats the market’s average',
    question: 'How much does a stock usually fall?',
    answer:
      'There is no general answer. Market-wide figures describe an index, and an index falls far less than the companies inside it — because they do not all fall at the same time. The only useful benchmark for one share is what that share has done before.',
    summary:
      'Why an index falls less than its own members, what a typical fall means for one company, and when a company’s own record is the wrong record to read.',
    theme: 'cycles',
    published: '2026-08-20',
    reviewed: '2026-08-20',
    minutes: 4,
  },
  {
    slug: 'how-long-do-recoveries-take',
    title: 'How long do recoveries actually take?',
    question: 'How long does it take a stock to recover?',
    answer:
      'Nobody can tell you in advance. But most companies have been through this before, and each of those past falls took a specific amount of time to climb out of. Reading a few of them off the company’s own chart gives you a realistic range, which is the closest thing to an answer that exists.',
    summary:
      'How to read the length of a company’s past recoveries straight off its own chart, why a fall’s depth does not predict its duration, and why we do not average it into one number.',
    theme: 'cycles',
    published: '2026-08-20',
    reviewed: '2026-08-21',
    // 1,392 words — measured on the rendered page, not estimated. Was 4 before
    // the article gained its worked example; the rewrite roughly doubled it.
    minutes: 7,
  },
  {
    slug: 'falling-price-bargain-or-warning',
    title: 'Is a falling share price a bargain or a warning?',
    question: 'Is a falling stock a good time to buy?',
    answer:
      'A falling price tells you what the market did, not what the company is worth. The same 30% fall can be a bargain or a warning, and the chart looks identical either way. The difference is in the accounts underneath.',
    summary:
      'Why a lower price is not the same as good value, the two things that cause a fall, and the five checks that tell a bad year apart from a business getting worse.',
    theme: 'quality',
    published: '2026-08-20',
    reviewed: '2026-08-20',
    minutes: 7,
  },
  {
    slug: 'pe-ratio',
    title: 'What a P/E ratio does and doesn’t tell you',
    question: 'What is a good P/E ratio?',
    answer:
      'A P/E ratio tells you how much you are paying for each dollar the company earns. It is a price tag, not a verdict. There is no “good” number — and a low one is as often a warning as a bargain.',
    summary:
      'What the ratio measures, why no single number is good or bad, the three ways it misleads, and the difference between the trailing and forward versions.',
    theme: 'quality',
    published: '2026-08-20',
    reviewed: '2026-08-20',
    minutes: 6,
  },
  {
    slug: 'is-a-company-financially-healthy',
    title: 'How to check if a company is financially healthy',
    question: 'How do I know if a company is financially healthy?',
    answer:
      'Financial health is whether a business can survive a bad year and still compound in a good one. It comes down to five things: whether it makes money, whether it owes too much, whether it is growing, whether the profit turns into cash, and what it returns to owners.',
    summary:
      'The numbers behind each of the five checks, what good looks like, why the thresholds differ by industry, and why one healthy-looking score can hide very different risks.',
    theme: 'quality',
    published: '2026-08-20',
    reviewed: '2026-08-20',
    minutes: 7,
  },
  {
    slug: 'analyst-price-target',
    title: 'How to read an analyst price target',
    question: 'What is an analyst price target and should I trust it?',
    answer:
      'A price target is one analyst’s estimate of where a share should trade in about twelve months. The figure usually quoted is an average of many such estimates, and the disagreement between them is almost always more informative than the average itself.',
    summary:
      'Where the number comes from, why the spread matters more than the consensus, why targets follow the price rather than lead it, and what they cannot tell you.',
    theme: 'quality',
    published: '2026-08-20',
    reviewed: '2026-08-20',
    minutes: 5,
  },
  {
    slug: 'is-a-dividend-safe',
    title: 'Is a dividend safe, and how would you know?',
    question: 'How do I know if a dividend is safe?',
    answer:
      'A dividend is safe when the company can comfortably afford it — profit and cash cover the payment with room to spare, and the debt does not need the money more. An unusually high yield is usually the market saying it doubts the payment will last.',
    summary:
      'Why a rising yield is often a warning, the four things that decide whether a payment lasts, and what the stock page shows you about each.',
    theme: 'quality',
    published: '2026-08-20',
    reviewed: '2026-08-20',
    minutes: 4,
  },
  {
    slug: 'how-to-read-a-majorcycle-rating',
    title: 'How to read a MajorCycle rating',
    question: 'What does a MajorCycle rating mean?',
    answer:
      'A MajorCycle rating is a score out of 100 built from three parts: the financial health of the business, where today’s price sits inside that company’s own history of falls, and how reliably that history has paid off. The score maps to one of five labels.',
    summary:
      'What the three parts measure, how they are weighted, what the five labels mean, and the questions the rating deliberately refuses to answer.',
    theme: 'using-it',
    published: '2026-08-20',
    reviewed: '2026-08-20',
    minutes: 4,
  },
  {
    slug: 'what-majorcycle-doesnt-do',
    title: 'What MajorCycle deliberately doesn’t do',
    question: 'What can’t MajorCycle tell me?',
    answer:
      'It does not forecast prices, tell you when to act, or know anything about your circumstances. It reads a company’s own record of falls and the health of the business behind it, the same way for every company, and stops there.',
    summary:
      'The limits that are design decisions rather than gaps: no forecasts, no timing, nothing that is not a number, and why leaving them in place is the point.',
    theme: 'using-it',
    published: '2026-08-20',
    reviewed: '2026-08-20',
    minutes: 4,
  },
] as const satisfies readonly LearnArticle[];

/** Slugs, as a type — so a body map keyed by this cannot miss one. */
export type LearnSlug = (typeof LEARN_ARTICLES)[number]['slug'];

/** The one place a Learn URL is spelled. */
export const learnPath = (slug: string): string => `/learn/${slug}`;

export const LEARN_INDEX_PATH = '/learn';

export const findArticle = (slug: string): LearnArticle | undefined =>
  LEARN_ARTICLES.find((a) => a.slug === slug);

/**
 * Articles under one theme, in registry order.
 *
 * Registry order, not alphabetical: the list is a reading order for a newcomer,
 * and the first entry under each theme is the one somebody arriving cold should
 * read first. Alphabetising would sort that intent away silently.
 */
export const articlesByTheme = (theme: LearnTheme): readonly LearnArticle[] =>
  LEARN_ARTICLES.filter((a) => a.theme === theme);

/**
 * A human date — "15 August 2026" — matching the legal pages' `updated` prop.
 *
 * ⚠️ `en-AU` and an explicit UTC timezone. Without the timezone, `new Date('2026-08-15')`
 * is parsed as UTC midnight and then FORMATTED in the runtime's local zone, so a
 * build machine west of Greenwich renders the previous day. That is the same
 * class of bug as CLAUDE.md 14a, one layer up: the date is a calendar fact and
 * must not be pushed through a timezone at all.
 */
export const learnDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
