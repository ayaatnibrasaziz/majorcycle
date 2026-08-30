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
  // ⚠️ Two entries came OUT of this list on 2026-08-30, and they had to: "How
  // long does an ASX share take to recover?" and "Which ASX 200 shares sit
  // furthest below their own highs" are both published below, the second having
  // become three pieces (AU, US, CA) as its blurb promised. A "Coming next" row
  // for an article a reader can already open is not a stale detail — it is the
  // section telling the reader it has not written something it has.
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
      'The typical ASX 200 company falls about 21.7% in an ordinary pullback, against 18.9% in the S&P 500. That gap is about company size rather than about Australia: compare the sixty largest in each and Australia is the shallower of the two, 18.5% against 19.2%.',
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
      { value: '−18.5%', label: 'largest 60 only' },
    ],
    region: 'Australia',
    // ⚠️ 26 August until 2026-08-29, which had become impossible: after the study
    // was re-run so every figure shares ONE as-at date, the price window ends on
    // 27 August — a day AFTER the stated publication. A piece whose credibility
    // rests on saying when it was measured cannot claim to predate its own data.
    published: '2026-08-29',
    reviewed: '2026-08-29',
    // 1,561 words — measured on the rendered page, not estimated. It was 6 at
    // 1,430 words; the banks section added 131 and pushed the honest figure to 8.
    // Re-measure rather than re-estimate whenever the prose is touched: four of
    // the eight Learn articles were a minute out at their first audit, all inside
    // the guard's tolerance, purely from re-rounding a number that had already
    // been rounded once.
    //
    // ⚠️ The measurement excludes the closing call to action, which is why that
    // block is rendered outside `[data-article-body]` — see `ArticleDoc`. Counted
    // in, every article's stated reading time would drift up by the same 40 words
    // of furniture.
    minutes: 8,
  },
  {
    slug: 'how-long-does-an-asx-share-take-to-recover',
    title: 'How long does an ASX share take to recover?',
    question: 'How long does it take for a share to recover after it falls?',
    answer:
      'About half of all 20% falls in the ASX 200 were back to the old price within a year, and three quarters within three years. One in eight is still below its old price today — and almost all of the falls that stay down for years are the very deepest ones.',
    summary:
      'Every 20% fall in the ASX 200 since 2000, and how long each took to come back. Half recover inside a year. One in eight is still down.',
    kind: 'analysis',
    deck: [
      'We started a clock on every 20% fall in the ASX 200 since 2000 and stopped it on the day the price got back. ',
      { strong: 'Half were back inside a year, and the depth of the fall decides almost everything.' },
    ],
    finding: [
      'Half of all 20% falls were back inside a year, and ',
      { figure: '12.4%' },
      ' are still below their old price. The depth of the fall decides almost everything.',
    ],
    facts: [
      { value: '1,260', label: 'falls measured' },
      { value: '51.7%', label: 'back within a year' },
      { value: '3.6%', label: 'down over 5 years' },
    ],
    region: 'Australia',
    published: '2026-08-30',
    reviewed: '2026-08-30',
    // 1,256 words — measured on the rendered page with `innerText`, not estimated
    // from the draft. Re-measure rather than re-round whenever the prose is
    // touched; `articles.spec.ts` is the only place the two can be compared.
    minutes: 6,
  },
  {
    slug: 'asx-200-shares-furthest-below-their-highs',
    title: 'Which ASX 200 shares sit furthest below their own highs',
    question: 'Which ASX shares have fallen the most?',
    answer:
      'Eighty-eight of the 201 companies in the ASX 200 sit more than 20% below their own one-year high, and sixteen are more than half below. The falls are spread right across the market rather than concentrated in one industry, which is what makes this run unusual.',
    summary:
      'Every ASX 200 company ranked by how far it sits below its own one-year high, as at 27 August 2026. Forty-four per cent are down more than 20%.',
    kind: 'analysis',
    deck: [
      'Every ASX 200 company ranked by how far it sits below its own one-year high. ',
      { strong: 'Nearly half the index is down more than 20%, and no industry was spared.' },
    ],
    finding: [
      { figure: '88' },
      ' of the 201 ASX 200 companies sit more than 20% below their own one-year high, and ',
      { figure: '16' },
      ' are more than half below.',
    ],
    facts: [
      { value: '88 of 201', label: 'down over 20%' },
      { value: '−17.5%', label: 'middle company' },
      { value: '6', label: 'near their high' },
    ],
    region: 'Australia',
    published: '2026-08-30',
    reviewed: '2026-08-30',
    // 1,199 words, measured on the rendered page.
    minutes: 6,
  },
  {
    slug: 'sp-500-shares-furthest-below-their-highs',
    title: 'Which S&P 500 shares sit furthest below their own highs',
    question: 'Which S&P 500 stocks are furthest below their 52-week highs?',
    answer:
      'The S&P 500 is close to its high, and that hides an unusual split. One hundred and forty-three of its companies are more than 20% below their own one-year high, and 44 of the 83 technology companies are — while the very largest companies sit near their peaks.',
    summary:
      'Every S&P 500 company ranked by how far it sits below its own one-year high, as at 27 August 2026. The index looks calm. Half of technology does not.',
    kind: 'analysis',
    deck: [
      'The index is near its high and 143 of its companies are more than 20% below theirs. ',
      { strong: 'The split is technology, and it is not the giants.' },
    ],
    finding: [
      { figure: '143' },
      ' of 499 are more than 20% below their own one-year high, and ',
      { figure: '44 of 83' },
      ' technology companies are.',
    ],
    facts: [
      { value: '143 of 499', label: 'down over 20%' },
      { value: '53%', label: 'of technology' },
      { value: '−11.7%', label: 'middle company' },
    ],
    region: 'United States',
    published: '2026-08-30',
    reviewed: '2026-08-30',
    // 1,074 words, measured on the rendered page.
    minutes: 5,
  },
  {
    slug: 'tsx-60-shares-furthest-below-their-highs',
    title: 'Which TSX 60 shares sit furthest below their own highs',
    question: 'Which Canadian shares have fallen the most?',
    answer:
      'Ten of the 60 companies in the S&P/TSX 60 sit more than 20% below their own one-year high, and not one is down more than 40%. Canada is by a wide margin the calmest of the three markets we cover, and almost all of its damage is in a single sector.',
    summary:
      'Every S&P/TSX 60 company ranked by how far it sits below its own one-year high, as at 27 August 2026. Not one is down more than 40%.',
    kind: 'analysis',
    deck: [
      'The whole index, not a selection — all sixty companies ranked on the same day. ',
      { strong: 'Only ten are down more than 20%, and four of them are Canada’s five technology companies.' },
    ],
    finding: [
      'Only ',
      { figure: '10' },
      ' of the 60 are more than 20% below their own high, and not one is down more than ',
      { figure: '40%' },
      '.',
    ],
    facts: [
      { value: '10 of 60', label: 'down over 20%' },
      { value: '−39.1%', label: 'deepest fall' },
      { value: '0', label: 'down over 40%' },
    ],
    region: 'Canada',
    published: '2026-08-30',
    reviewed: '2026-08-30',
    // 879 words, measured on the rendered page.
    minutes: 4,
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

/**
 * The lead article — an EDITORIAL choice, not "whichever went up last".
 *
 * ⚠️ It used to be `articlesNewestFirst()[0]`, which was the same thing while
 * there was one piece. Publishing four more on 2026-08-30 would have moved the
 * lead by arithmetic, and the owner's instruction was to keep the front page
 * where it is. Two reasons that is the right shape rather than a workaround:
 * the lead card is the one place a FIGURE is drawn, and only this piece has one
 * (`FIGURES` is `Partial` on purpose), so a dateless rotation would silently
 * empty it; and a front page choosing its own lead is what a front page is.
 *
 * ⚠️ Falls back to the newest rather than to nothing, because the failure it
 * guards is a slug renamed here and not there — which would otherwise render an
 * index with no lead at all, and look entirely deliberate (CLAUDE.md 11j).
 * `articles.spec.ts` asserts the slug still resolves, so the fallback can never
 * be silently doing the work.
 */
export const FEATURED_SLUG = 'how-far-do-asx-shares-fall';

/** The lead article. `undefined` only if the registry is empty. */
export function featuredArticle(): Article | undefined {
  return findArticle(FEATURED_SLUG) ?? articlesNewestFirst()[0];
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
