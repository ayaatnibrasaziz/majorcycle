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

export const LEARN_THEMES: readonly {
  readonly id: LearnTheme;
  readonly label: string;
  readonly blurb: string;
}[] = [
  {
    id: 'cycles',
    label: 'Falls and recoveries',
    blurb: 'What a drawdown is, why the same stock tends to fall by similar amounts, and what that can and cannot tell you.',
  },
  {
    id: 'quality',
    label: 'Judging the business',
    blurb: 'Why a falling price is not the same as a bargain, and what the accounts underneath are being asked.',
  },
  {
    id: 'using-it',
    label: 'Using MajorCycle',
    blurb: 'How to read a rating, what the numbers on a stock page mean, and what the tool deliberately does not do.',
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
