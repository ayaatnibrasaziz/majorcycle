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
   * The topic's illustration — a Canva image, drawn to explain the idea.
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
   * Intended crop **1200 × 750 (16:10)**. Stated here rather than on the page:
   * a public page should not print production notes at its readers.
   *
   * Owner decision (2026-08-15): these are CONTENT, not brand furniture. They are
   * not bound by the design system and do not need to match the palette — they
   * need to look good and explain the topic.
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
      alt: 'A share price rising and falling four times, each fall a different depth, with shaded bands marking how far each one reached and a marker showing a recovery still in progress.',
    },
    upcoming: [
      'Why shares fall by the same amount, over and over',
      'Dip, correction, crash — what’s the difference?',
      'How long do recoveries actually take?',
      'What a 52-week high really tells you',
    ],
  },
  {
    id: 'quality',
    label: 'Judging the business',
    blurb: 'A falling price is not the same as a bargain. What the accounts underneath are being asked, in plain words.',
    image: {
      src: '/learn/judging-the-business.png',
      alt: 'Two office buildings under identical falling share prices. One stands square and solid; the other’s floors have slipped out of line and its top floor is toppling away.',
    },
    upcoming: [
      'Is a falling share price a bargain or a warning?',
      'How to check if a company is financially healthy',
      'What a P/E ratio does and doesn’t tell you',
      'How to read an analyst price target',
    ],
  },
  {
    id: 'using-it',
    label: 'Using MajorCycle',
    blurb: 'How to read a rating, what the five tiers mean, and what the tool deliberately does not try to do.',
    image: {
      src: '/learn/using-majorcycle.png',
      alt: 'A dial divided into five bands, pale on the left through to deep navy on the right, with a single marker resting on the middle band.',
    },
    upcoming: [
      'How to read a MajorCycle rating',
      'What the five tiers mean',
      'What MajorCycle deliberately doesn’t do',
    ],
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
      'A drawdown is how far a share price has fallen from its most recent peak, as a percentage. If a stock hit $100 and now trades at $80, it is in a 20% drawdown. It is a measure of distance from the top — not of whether the company is in trouble.',
    summary:
      'The plain meaning of drawdown, why it is measured from the peak rather than from what you paid, and what a big number does and does not tell you.',
    theme: 'cycles',
    published: '2026-08-15',
    reviewed: '2026-08-15',
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
