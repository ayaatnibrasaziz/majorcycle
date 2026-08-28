/**
 * Articles — one registry, and it is the only place an article exists.
 *
 * ── Why this is a second registry rather than a `kind` field on `lib/learn.ts` ─
 *
 * They answer different questions and they age differently. A Learn article
 * explains a term and does not expire, so `/learn` is grouped by subject and
 * carries no dates in its list. An article here reports a MEASUREMENT taken on a
 * stated day — every one of them will be overtaken, and saying when it was taken
 * is half of being honest about it. Folding both into one list would force one
 * shape onto both, and the shape that loses is the dated one, because a date
 * column on an explainer implies a shelf life it does not have.
 *
 * Everything structural is copied from `lib/learn.ts` deliberately, because that
 * file's reasons all still apply:
 *
 * ⚠️ **NO REACT IN THIS FILE, and it is load-bearing.** `lib/seo.ts` imports it,
 * `proxy.ts` imports `lib/seo.ts`, and `proxy.ts` runs as middleware — on every
 * single request to the site. Pull a component in here and every article body
 * joins the middleware bundle. Bodies and figures live in
 * `app/(public)/articles/content.tsx`, keyed by slug, and TypeScript requires
 * one body per slug so the two cannot drift apart.
 *
 * ⚠️ **`lib/seo.ts` DERIVES its `/articles/<slug>` entries from this list.** That
 * one derivation is what makes the middleware let a signed-out reader through,
 * the sitemap list the page, `pageMetadata()` accept its path, and the public
 * header render full chrome. An article registered here needs nothing else
 * remembered; an article NOT registered here renders perfectly and is invisible
 * to Google, which is the failure mode CLAUDE.md 11c keeps describing.
 */

/** The three kinds of piece this section carries. */
export type ArticleKind = 'analysis' | 'commentary' | 'how-to';

/**
 * A run of text with two kinds of emphasis, expressed as DATA rather than JSX.
 *
 * The index rows and the featured card both need a bolded figure inside a
 * sentence, and this file may not import React (see the header). So the prose is
 * segments, and `components/articles/RichText.tsx` is the single renderer.
 *
 * ⚠️ `figure` is not a styling choice — it marks a NUMBER, and the renderer sets
 * it in the mono face with tabular figures so a column of findings lines up.
 * Using `strong` for a number would look almost right and break the alignment.
 */
export type RichPart =
  | string
  | { readonly strong: string }
  | { readonly figure: string };

export interface ArticleFact {
  /** The number itself — rendered in the mono face. */
  readonly value: string;
  /** What it counts. */
  readonly label: string;
}

export interface Article {
  /**
   * URL segment. Never changed once published — a changed slug is a dead link
   * everywhere the old one was ever shared.
   */
  readonly slug: string;
  /** `<h1>` and the browser title. */
  readonly title: string;
  /** The question a real person types, in their words rather than ours. */
  readonly question: string;
  /**
   * The direct answer, rendered immediately under the heading before any prose.
   *
   * A required FIELD, exactly as in `lib/learn.ts`: an article physically cannot
   * be published without one, so throat-clearing is not the path of least
   * resistance. `ArticleDoc` renders it, and `articles.spec.ts` caps its length
   * so it can never push the compliance notice below the fold at 375px.
   */
  readonly answer: string;
  /** One honest sentence for the meta description and the search result. */
  readonly summary: string;
  readonly kind: ArticleKind;
  /**
   * The featured card's body — the deck.
   *
   * Separate from `summary` because they are written for different readers: the
   * summary is what a stranger sees under a blue link on Google, the deck is
   * what a reader sees on our own page having already decided to look.
   */
  readonly deck: readonly RichPart[];
  /**
   * The row's one-line FINDING — never a summary.
   *
   * Owner's design decision, recorded in `design-system.md`: on this site the
   * number is the thing worth scanning, and it is what replaces the thumbnail
   * every competitor leads with.
   */
  readonly finding: readonly RichPart[];
  /** Up to three figures for the featured card's pills. */
  readonly facts: readonly ArticleFact[];
  /** Which market the piece is about — the row's trailing pill. */
  readonly region: string;
  /** ISO date it went up. */
  readonly published: string;
  /**
   * ISO date its figures were last checked against the running product.
   *
   * ⚠️ CLAUDE.md 11k. An article reporting a measurement has a shelf life; the
   * honest version says when it was taken and when it was last confirmed.
   */
  readonly reviewed: string;
  /**
   * Reading time in whole minutes.
   *
   * ⚠️ A claim ABOUT the body, so it can drift the moment the prose is edited —
   * silently, and while still looking plausible. `articles.spec.ts` counts the
   * words on the RENDERED page and fails if this is more than 2 minutes out,
   * which is the only place the two can be compared.
   */
  readonly minutes: number;
}

/**
 * Titles that are planned but not written — the "Coming next" section.
 *
 * ⚠️ **Plain data, deliberately not `Article`s.** The moment one becomes a
 * registry entry it acquires a URL, a sitemap row, a middleware allow-list entry
 * and a canonical tag, and `content.tsx` would have to hold a body for it because
 * `Record<ArticleSlug, …>` refuses to compile without one. A promise about a
 * future piece must cost none of that. There is nothing here that can become a
 * link by accident, and `articles.spec.ts` asserts none of them ever does.
 */
export interface PlannedArticle {
  readonly title: string;
  readonly blurb: string;
  /** Human month, e.g. "Sep 2026". Not an ISO date — we are not promising a day. */
  readonly due: string;
}

export const PLANNED_ARTICLES: readonly PlannedArticle[] = [
  {
    title: 'How long does an ASX share take to recover?',
    blurb:
      'The companion measurement: once a large company has fallen, how long has it historically taken to get back.',
    due: 'Sep 2026',
  },
  {
    title: 'Which ASX 200 shares sit furthest below their own highs',
    blurb:
      'A ranked list, refreshed each quarter, with the US and Canadian equivalents beside it.',
    due: 'Sep 2026',
  },
  {
    title: 'Do bank shares fall differently to mining shares?',
    blurb:
      'Banks and miners are most of the ASX. Canada is built the same way, which makes the comparison worth running.',
    due: 'Sep 2026',
  },
] as const;

/**
 * ⚠️ `satisfies`, NOT `: readonly Article[]`.
 *
 * An explicit annotation widens every `slug` to `string`, which destroys the
 * point of `ArticleSlug` below: the body map in
 * `app/(public)/articles/content.tsx` is keyed by that union, and it is what
 * makes TypeScript refuse to compile an article registered without a body.
 * Annotate this and the map's key type becomes `string`, the completeness check
 * evaporates, and the first symptom is a blank article page.
 */
export const ARTICLES = [
  {
    slug: 'how-far-do-asx-shares-fall',
    title: 'How far do ASX shares actually fall?',
    question: 'How much does an Australian share normally fall?',
    answer:
      'The typical ASX 200 company falls about 21.7% in an ordinary pullback, against 18.9% in the S&P 500. That gap is about company size rather than about Australia: compare the sixty largest in each and Australia is the shallower of the two, 18.4% against 19.0%.',
    // ⚠️ 147 characters, and it is the META DESCRIPTION as well as the index
    // summary — `seo.spec.ts` caps it at 155 because Google truncates near there.
    // The first version ran to 179 and lost the finding, which is the only part a
    // searcher would click for.
    summary:
      'Every pullback in the ASX 200, S&P 500 and TSX 60 since 2000. Australian shares look like they fall harder — match them for size and that reverses.',
    kind: 'analysis',
    deck: [
      'We measured every pullback in the ASX 200, the S&P 500 and the TSX 60 since 2000. The headline says Australian shares fall harder — ',
      { strong: 'control for company size and that reverses.' },
    ],
    finding: [
      'The whole index falls ',
      { figure: '−21.7%' },
      ' against ',
      { figure: '−18.9%' },
      ' in the US. Match them for size and Australia is the shallower of the two.',
    ],
    facts: [
      { value: '761', label: 'companies' },
      { value: '−21.7%', label: 'whole ASX 200' },
      { value: '−18.4%', label: 'largest 60 only' },
    ],
    region: 'Australia',
    published: '2026-08-26',
    reviewed: '2026-08-29',
    // 1,430 words with its figure captions — measured on the rendered page, not
    // estimated. Re-measure rather than re-estimate whenever the prose is
    // touched: four of the eight Learn articles were a minute out at their first
    // audit, all inside the guard's tolerance, purely from re-rounding a number
    // that had already been rounded once.
    minutes: 6,
  },
] as const satisfies readonly Article[];

export type ArticleSlug = (typeof ARTICLES)[number]['slug'];

export const ARTICLES_INDEX_PATH = '/articles';

export function articlePath(slug: string): string {
  return `${ARTICLES_INDEX_PATH}/${slug}`;
}

export function findArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/**
 * Newest first. The index leads with the most recent piece, so the order is part
 * of the page rather than a detail of how the array happens to be written.
 */
export function articlesNewestFirst(): readonly Article[] {
  return [...ARTICLES].sort((a, b) => b.published.localeCompare(a.published));
}

/** The lead article. `undefined` only if the registry is empty. */
export function featuredArticle(): Article | undefined {
  return articlesNewestFirst()[0];
}

/**
 * The plain text of a rich run — for the meta description, a row's accessible
 * name, and the reading-time guard. Kept beside the type so a second caller
 * cannot invent its own flattening and disagree (CLAUDE.md 11c iii).
 */
export function richText(parts: readonly RichPart[]): string {
  return parts
    .map((p) => (typeof p === 'string' ? p : 'strong' in p ? p.strong : p.figure))
    .join('');
}

/**
 * `26 August 2026` — the same rendering `lib/learn.ts` uses, and it must stay
 * that way. Two date formats on one site is the kind of difference a reader
 * notices without being able to say why.
 *
 * ⚠️ `timeZone: 'UTC'` is not decoration. An ISO date with no time is parsed as
 * UTC midnight, so formatting it in Australian local time renders the day
 * BEFORE — every published date on the site would have been off by one.
 */
export function articleDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** `26 Aug 2026` — the compact form the index rows use. */
export function articleDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
