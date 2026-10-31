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
    title: 'ASX 200 shares furthest below their highs',
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
    title: 'S&P 500 shares furthest below their highs',
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
    title: 'TSX 60 shares furthest below their highs',
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
  {
    slug: 'asx-tech-shares-how-far-have-they-fallen',
    title: 'ASX tech shares are down by half. How unusual is that?',
    question: 'How far have ASX tech shares fallen?',
    answer:
      'The ASX 200 sits 6.2% below its high. The typical technology company in it sits 53.2% below its own, twice the 25.2% it normally falls. Their past falls recovered faster than the rest of the market’s, but eight of the fifteen are now deeper than any fall they have come back from.',
    summary:
      'ASX 200 tech companies against their own history, as at 15 October 2026. Down twice their normal fall, and eight deeper than any they came back from.',
    kind: 'analysis',
    deck: [
      'The index is 6.2% off its high and its technology companies are down 53.2%. ',
      { strong: 'Measured against their own history, this is the fall that is different.' },
    ],
    finding: [
      'The middle technology company is ',
      { figure: '−53.2%' },
      ' below its high against a normal fall of ',
      { figure: '−25.2%' },
      ', and ',
      { figure: '8 of 15' },
      ' are deeper than any fall they have recovered from.',
    ],
    facts: [
      { value: '15', label: 'companies' },
      { value: '−53.2%', label: 'middle company' },
      { value: '8 of 15', label: 'past their record' },
    ],
    region: 'Australia',
    published: '2026-10-17',
    reviewed: '2026-10-17',
    minutes: 8,
  },
  {
    slug: 'netflix-q3-2026-results',
    title: 'Netflix’s third-quarter 2026 results, explained',
    question: 'Why did Netflix shares fall after its Q3 2026 results?',
    answer:
      'Netflix’s third-quarter revenue of $12.87 billion landed almost exactly on its own forecast, and its operating profit came in 4.5% above it. But it cut its 2026 advertising revenue outlook from about $3 billion to about $2.7 billion. The next day the shares fell 5.3%, closing 51.4% below their June 2025 record.',
    summary:
      'Netflix’s Q3 2026 results against its own forecast: revenue, profit, the cut to its ad revenue outlook, the layoffs, and where the shares sit.',
    kind: 'commentary',
    deck: [
      'Profit came in 4.5% above Netflix’s own forecast, and the shares fell 5.3% the next day. ',
      { strong: 'The number that changed was advertising.' },
    ],
    finding: [
      'Operating profit ',
      { figure: '4.5%' },
      ' above its own forecast, ad outlook cut to ',
      { figure: '$2.7B' },
      ', shares ',
      { figure: '−51.4%' },
      ' from their record.',
    ],
    facts: [
      { value: '+4.5%', label: 'profit vs forecast' },
      { value: '$2.7B', label: '2026 ad outlook' },
      { value: '−51.4%', label: 'below its record' },
    ],
    region: 'United States',
    published: '2026-10-22',
    reviewed: '2026-10-22',
    minutes: 9,
  },
  {
    slug: 'meta-q3-2026-results',
    title: 'Meta’s third-quarter 2026 results, explained',
    question: 'Why did Meta shares fall after its Q3 2026 results?',
    answer:
      'Meta’s third-quarter revenue of $64.60 billion came in above the top of its own forecast, up 26% on a year earlier. Its operating profit fell 37% because of a $9.89 billion legal charge, and it announced new non-voting shares that will work like a two-for-one stock split in January. The shares fell 7.0% the next day.',
    summary:
      'Meta’s Q3 2026 results against its own forecast: revenue, the $9.9 billion legal charge, its spending, the new Class C shares, and where the shares sit.',
    kind: 'commentary',
    deck: [
      'Revenue beat Meta’s own forecast, and the shares fell 7.0% the next day. ',
      { strong: 'A legal charge cut its profit, and a new class of shares is coming.' },
    ],
    finding: [
      'Revenue ',
      { figure: '$64.60B' },
      ' above its own range, operating profit ',
      { figure: '−37%' },
      ', shares ',
      { figure: '−7.0%' },
      ' the next day.',
    ],
    facts: [
      { value: '$64.60B', label: 'revenue' },
      { value: '−37%', label: 'operating profit' },
      { value: '−17.9%', label: 'below its record' },
    ],
    region: 'United States',
    published: '2026-10-23',
    reviewed: '2026-10-23',
    minutes: 9,
  },
  {
    slug: 'tesla-q3-2026-results',
    title: 'Tesla’s third-quarter 2026 results, explained',
    question: 'Why did Tesla shares fall after its Q3 2026 results?',
    answer:
      'Tesla’s third-quarter revenue was $28.05 billion, flat on a year earlier. Its operating profit fell 56%, and it cut its 2026 spending plan to more than $20 billion, from more than $25 billion. Its board has formed a committee to explore a closer tie with SpaceX. The shares fell 3.1% the next day.',
    summary:
      'Tesla’s Q3 2026 results from its own filings: revenue, the profit squeeze, spending, Robotaxi, the SpaceX committee, and where the shares sit.',
    kind: 'commentary',
    deck: [
      'Revenue was flat, operating profit fell 56%, and the shares fell 3.1% the next day. ',
      { strong: 'Tesla cut its spending plan, and its board is looking at SpaceX.' },
    ],
    finding: [
      'Revenue ',
      { figure: '$28.05B' },
      ', operating profit ',
      { figure: '−56%' },
      ', shares ',
      { figure: '−23.5%' },
      ' from their record.',
    ],
    facts: [
      { value: '$28.05B', label: 'revenue' },
      { value: '−56%', label: 'operating profit' },
      { value: '−23.5%', label: 'below its record' },
    ],
    region: 'United States',
    published: '2026-10-23',
    reviewed: '2026-10-23',
    minutes: 8,
  },
  {
    slug: 'nextdc-shares-power-poles',
    title: 'Why NEXTDC shares fell 42% in one day',
    question: 'Why did NEXTDC shares fall 42% in one day?',
    answer:
      'NEXTDC shares fell 41.7% on 21 October, wiping about A$2.9 billion off its value, after it cut its forecasts for the year to June 2027. Power work its M3 Melbourne data centre needs has been suspended after community opposition, so it cannot count on billing for that capacity this financial year.',
    summary:
      'NEXTDC lost A$2.9 billion of market value in a day. What residents did, why the power matters, what NEXTDC changed, and how far it has fallen before.',
    kind: 'commentary',
    deck: [
      'The shares fell 41.7% in a day, the worst since NEXTDC listed in 2010. ',
      { strong: 'The power its Melbourne data centre needs is held up by community opposition.' },
    ],
    finding: [
      'Shares ',
      { figure: '−41.7%' },
      ' in a day, about ',
      { figure: 'A$2.9B' },
      ' of value gone, ',
      { figure: '−69.6%' },
      ' from their record.',
    ],
    facts: [
      { value: '−41.7%', label: 'on 21 October' },
      { value: 'A$2.9B', label: 'of value lost' },
      { value: '−69.6%', label: 'below its record' },
    ],
    region: 'Australia',
    published: '2026-10-25',
    reviewed: '2026-10-25',
    minutes: 8,
  },
  {
    slug: 'rba-rate-rises-asx-bank-shares',
    title: 'What happened to ASX bank shares each time the RBA raised rates',
    question: 'What happens to ASX bank shares when the RBA raises rates?',
    answer:
      'Across 17 RBA rate rises since 2022, the big four banks’ shares barely moved on the day: the average move was almost exactly zero, because the rise was usually expected. The big moves came on the two days the RBA surprised the market. In 2026, the banks’ own results moved their shares far more than any decision did.',
    summary:
      'The RBA has raised rates 17 times since 2022. We measured how CBA, Westpac, NAB and ANZ shares moved each time, and what made the big days different.',
    kind: 'commentary',
    deck: [
      'Across 17 rate rises since 2022, the big four banks barely moved on the day. ',
      { strong: 'The big days were the two the RBA surprised the market.' },
    ],
    finding: [
      'An average move of ',
      { figure: '+0.04%' },
      ' on decision day. The surprises: ',
      { figure: '+4.39%' },
      ' and ',
      { figure: '−2.37%' },
      '.',
    ],
    facts: [
      { value: '17', label: 'rate rises since 2022' },
      { value: '+0.04%', label: 'average move on the day' },
      { value: '+4.39%', label: 'the best surprise day' },
    ],
    region: 'Australia',
    published: '2026-10-28',
    reviewed: '2026-10-28',
    minutes: 12,
  },
  {
    slug: 'microsoft-q1-fy27-results',
    title: 'Microsoft’s September-quarter 2026 results, explained',
    question: 'What did Microsoft report for the September quarter of 2026?',
    answer:
      'Microsoft’s revenue for the three months to September 2026 was $92.3 billion, up 19% and above its own forecast. Azure grew 48%. Its cash spending on property and equipment doubled, to $39.4 billion, and free cash flow fell 27%. After hours the shares rose 2.9%, but by the next day’s close they were 0.2% lower.',
    summary:
      'Microsoft’s results for the quarter to September 2026, from its own release: revenue, Azure, the OpenAI effect, spending and free cash flow.',
    kind: 'commentary',
    deck: [
      'Revenue rose 19% and Azure grew 48%. ',
      { strong: 'Spending on property and equipment more than doubled.' },
    ],
    finding: [
      'Azure ',
      { figure: '+48%' },
      ', spending ',
      { figure: '$39.4B' },
      ', shares ',
      { figure: '−0.2%' },
      ' the next day.',
    ],
    facts: [
      { value: '$92.3B', label: 'revenue' },
      { value: '+48%', label: 'Azure growth' },
      { value: '$39.4B', label: 'spent on property and equipment' },
    ],
    region: 'United States',
    published: '2026-10-30',
    reviewed: '2026-10-30',
    minutes: 8,
  },
  {
    slug: 'alphabet-q3-2026-results',
    title: 'Alphabet’s third-quarter 2026 results, explained',
    question: 'Why did Alphabet’s free cash flow turn negative in Q3 2026?',
    answer:
      'Alphabet’s third-quarter revenue was $127.6 billion, up 25%, and Google Cloud’s more than doubled. Its cash spending, $51.4 billion, was more than its operations brought in, and a loss on its SpaceX shares cut net income 24%. The next day, its shares fell 12.6%, their biggest fall after results in more than ten years.',
    summary:
      'Alphabet’s Q3 2026 results from its own release: revenue, Google Cloud, why profit fell, record spending, negative free cash flow and the shares.',
    kind: 'commentary',
    deck: [
      'Revenue rose 25% and Google Cloud more than doubled. ',
      { strong: 'Spending ran ahead of the cash coming in.' },
    ],
    finding: [
      'Cloud ',
      { figure: '+103%' },
      ', free cash flow ',
      { figure: '−$9.1B' },
      ', shares ',
      { figure: '−12.6%' },
      ' the next day.',
    ],
    facts: [
      { value: '$127.6B', label: 'revenue' },
      { value: '+103%', label: 'Google Cloud growth' },
      { value: '−$9.1B', label: 'free cash flow' },
    ],
    region: 'United States',
    published: '2026-10-30',
    reviewed: '2026-10-30',
    minutes: 7,
  },
  {
    slug: 'eli-lilly-q3-2026-results',
    title: 'Eli Lilly’s third-quarter 2026 results, explained',
    question: 'How did Eli Lilly grow revenue 39% while its prices fell 15%?',
    answer:
      'Eli Lilly’s third-quarter revenue rose 39% to $24.4 billion, even though its prices were 15% lower than a year earlier: it sold 53% more. It raised its 2026 revenue outlook for a third time, to $91 billion to $92 billion, and its shares rose 6.6% to a record close.',
    summary:
      'Eli Lilly’s Q3 2026 results from its own filings: lower prices, 53% more volume, Mounjaro and Zepbound, Novo Nordisk, and a forecast raised three times.',
    kind: 'commentary',
    deck: [
      'Revenue rose 39% while prices fell 15%. ',
      { strong: 'Two dollars in every three came from three medicines.' },
    ],
    finding: [
      'Volume ',
      { figure: '+53%' },
      ', prices ',
      { figure: '−15%' },
      ', shares ',
      { figure: '+6.6%' },
      ' on results day.',
    ],
    facts: [
      { value: '$24.4B', label: 'revenue' },
      { value: '$10.7B', label: 'Mounjaro revenue' },
      { value: '66%', label: 'of 2026 revenue from three medicines' },
    ],
    region: 'United States',
    published: '2026-10-30',
    reviewed: '2026-10-30',
    minutes: 8,
  },
  {
    slug: 'intel-q3-2026-results',
    title: 'Intel’s third-quarter 2026 results, explained',
    question: 'Why did Intel’s shares fall 28.6% after it beat its own forecast?',
    answer:
      'Intel’s third-quarter revenue rose 21% to $16.5 billion, ahead of its own forecast, and its data-centre sales rose 78%. But it forecast lower revenue and a gross margin six points lower for the fourth quarter, blaming a memory-driven PC slump, and its shares fell 28.6% the next day, their worst day since at least 1980.',
    summary:
      'Intel’s Q3 2026 results from its own filings: data-centre sales up 78%, a weaker fourth-quarter forecast, a memory-driven PC slump, and the shares’ fall.',
    kind: 'commentary',
    deck: [
      'Revenue rose 21% and data-centre sales 78%. ',
      { strong: 'The forecast for the next quarter was lower.' },
    ],
    finding: [
      'Data centre ',
      { figure: '+78%' },
      ', next quarter’s revenue ',
      { figure: '$15–16B' },
      ', shares ',
      { figure: '−28.6%' },
      ' the next day.',
    ],
    facts: [
      { value: '$16.5B', label: 'revenue' },
      { value: '+78%', label: 'data-centre growth' },
      { value: '$15–16B', label: 'fourth-quarter revenue forecast' },
    ],
    region: 'United States',
    published: '2026-10-31',
    reviewed: '2026-10-31',
    minutes: 7,
  },
  {
    slug: 'amazon-q3-2026-results',
    title: 'Amazon’s third-quarter 2026 results, explained',
    question: 'How did Amazon post its best margin and a $42 billion cash outflow?',
    answer:
      'Amazon’s third-quarter revenue rose 12% to $201.9 billion, AWS grew 39%, its fastest in nearly five years, and its operating margin was its highest ever. But it spent $77.3 billion on property and equipment, its free cash flow over the past year was an outflow of $42.4 billion, and its shares fell 1.4% the next day.',
    summary:
      'Amazon’s Q3 2026 results from its own filings: AWS up 39%, a record operating margin, $77 billion of spending in a quarter, and a $42 billion cash outflow.',
    kind: 'commentary',
    deck: [
      'AWS grew 39% and the operating margin was Amazon’s highest ever. ',
      { strong: 'Over the past year, spending ran $42.4 billion ahead of the cash coming in.' },
    ],
    finding: [
      'AWS ',
      { figure: '+39%' },
      ', free cash flow ',
      { figure: '−$42.4B' },
      ', shares ',
      { figure: '−1.4%' },
      ' the next day.',
    ],
    facts: [
      { value: '$201.9B', label: 'revenue' },
      { value: '+39%', label: 'AWS growth' },
      { value: '$77.3B', label: 'spent on property and equipment' },
    ],
    region: 'United States',
    published: '2026-10-31',
    reviewed: '2026-10-31',
    minutes: 5,
  },
  {
    slug: 'sandisk-q1-fy27-results',
    title: 'Sandisk’s first-quarter fiscal 2027 results, explained',
    question: 'How did Sandisk go from $112 million of profit to $8.1 billion in a year?',
    answer:
      'Sandisk’s revenue rose 378% to $11.0 billion in the three months to 2 October, its gross margin was 85.0%, and it made $8.1 billion of net income, against $112 million a year earlier. It also announced an 8-for-1 share split. The next day, its shares fell 13.5%, to $1,150.89, 50.7% below their June record close.',
    summary:
      'Sandisk’s results from its own filings: revenue up 378%, an 85% gross margin, data-centre sales up 61% in three months, and an 8-for-1 share split.',
    kind: 'commentary',
    deck: [
      'Revenue rose 378%, at a gross margin of 85%. ',
      { strong: 'The memory shortage that hurt Intel paid Sandisk.' },
    ],
    finding: [
      'Revenue ',
      { figure: '+378%' },
      ', net income ',
      { figure: '$8.1B' },
      ', shares ',
      { figure: '−13.5%' },
      ' the next day.',
    ],
    facts: [
      { value: '$11.0B', label: 'revenue' },
      { value: '85.0%', label: 'gross margin' },
      { value: '$8.1B', label: 'net income' },
    ],
    region: 'United States',
    published: '2026-10-31',
    reviewed: '2026-10-31',
    minutes: 5,
  },
  {
    slug: 'servicenow-q3-2026-results',
    title: 'ServiceNow’s third-quarter 2026 results, explained',
    question: 'Why did ServiceNow’s shares fall 26.9% after it beat its own forecast?',
    answer:
      'ServiceNow’s subscription revenue rose 21% to $3.99 billion in the third quarter of 2026, above the top of its own forecast, and it raised its targets for the year. But it forecast slower growth in the revenue it has under contract, and its shares fell 26.9% the next day, their worst day since it listed in 2012.',
    summary:
      'ServiceNow’s Q3 2026 results from its own filings: revenue up 21%, a lower backlog forecast, $9.2 billion of deals, and its worst day since 2012.',
    kind: 'commentary',
    deck: [
      'Subscription revenue rose 21%, above its own forecast. ',
      { strong: 'Its forecast for revenue under contract was the lowest in five quarters.' },
    ],
    finding: [
      'Subscription revenue ',
      { figure: '+21%' },
      ', backlog forecast ',
      { figure: '18.5%' },
      ', shares ',
      { figure: '−26.9%' },
      ' the next day.',
    ],
    facts: [
      { value: '$3.99B', label: 'subscription revenue' },
      { value: '$1.7B', label: 'AI contracts target' },
      { value: '$9.2B', label: 'spent on acquisitions this year' },
    ],
    region: 'United States',
    published: '2026-10-31',
    reviewed: '2026-10-31',
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

/** How many related articles an article page lists. */
export const RELATED_LIMIT = 4;

/** A company's quarterly results piece, by its slug ("…-q3-2026-results", "…-q1-fy27-results"). */
const isResults = (a: Article): boolean => a.slug.endsWith('-results');

/**
 * The few articles worth offering at the foot of `article` (owner, 1 Nov 2026: "if we have 500 articles, you
 * can't list all of them in every article — just list the ones that are related and most likely people will
 * click"). Every listing used to be the whole catalogue, newest first, which reads as a site map and grows
 * without bound.
 *
 * Ranked by what makes a reader of THIS piece likely to want the next one: the same series first (a results
 * piece leads to other results pieces; a study to other studies), then the same market, then the same kind,
 * and the newest within a tie. Pure data, so the order is decided here once and `articles.spec.ts` can drive it.
 */
export function relatedArticles(article: Article, limit = RELATED_LIMIT): readonly Article[] {
  const score = (a: Article): number =>
    (isResults(a) === isResults(article) ? 4 : 0) + (a.region === article.region ? 2 : 0) + (a.kind === article.kind ? 1 : 0);
  return articlesNewestFirst()
    .filter((a) => a.slug !== article.slug)
    .map((a, i) => ({ a, s: score(a), i }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .slice(0, limit)
    .map((x) => x.a);
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
