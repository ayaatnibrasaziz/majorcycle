import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArticleDoc } from '@/components/ArticleDoc';
import { ArticleCta } from '@/components/articles/ArticleCta';
import { JsonLd } from '@/components/JsonLd';
import {
  ARTICLES,
  ARTICLES_INDEX_PATH,
  articlePath,
  articlesNewestFirst,
  findArticle,
} from '@/lib/articles';
import { articleJsonLd, jsonLdScript } from '@/lib/jsonld';
import { PREFERRED_SOURCE } from '@/lib/preferredSource';
import { pageMetadata } from '@/lib/seo';
import { ARTICLE_BODIES } from '../content';
import '../articles.css';

/**
 * One article: `/articles/[slug]`.
 *
 * ⚠️ **No new design here, by owner decision (2026-08-26): "the article page
 * itself gets no new design — the live Learn article pages already show it."**
 * So this renders `ArticleDoc` and `LegalNotice`, the same card, the same
 * `.doc-scale`, and no second copy of the disclaimer wording. The component was
 * widened from `LearnArticle` to a four-field `DocArticle` to make that literal
 * rather than approximate — a lookalike card would have been a copy free to
 * drift, and the drift would be invisible because both pages would keep
 * rendering perfectly (CLAUDE.md 11c).
 *
 * ⚠️ **The registry is the only way in.** An unknown slug is `notFound()`, not a
 * blank article: a dynamic route that answers 200 with an empty shell for any
 * URL typed at it is a soft-404 farm, and Google treats that far more harshly
 * than an honest 404.
 */

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

/**
 * Belt and braces with `generateStaticParams`: that decides what is
 * PRE-rendered, not what is ALLOWED. Without the `findArticle` check below, a
 * request for `/articles/anything` would be rendered on demand and crash on a
 * missing body rather than 404 cleanly.
 */
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) return { title: 'Not found', robots: { index: false, follow: false } };

  return pageMetadata({
    path: articlePath(article.slug),
    title: article.title,
    // The summary, not the answer. This is the sentence under the blue link in a
    // search result; the answer is what the reader gets by clicking.
    description: article.summary,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) notFound();

  const Body = ARTICLE_BODIES[article.slug as keyof typeof ARTICLE_BODIES];
  // Unreachable while the registry and the body map agree — TypeScript requires
  // one body per registered slug. Kept because "unreachable" is a claim about
  // today's code, and a blank article page is the one outcome that looks
  // entirely deliberate (CLAUDE.md 11j).
  if (!Body) notFound();

  const related = articlesNewestFirst()
    .filter((a) => a.slug !== article.slug)
    .map((a) => ({ href: articlePath(a.slug), label: a.title }));

  return (
    <>
      {/* ⚠️ OUTSIDE `ArticleDoc`, deliberately — the same reason the Learn page
          states. Placed inside, this lands within `[data-article-body]`, and the
          duplicate-prose guard reads that container's TEXT: every article would
          suddenly share long runs reading "context https schema org graph type
          article headline". A `<script>` is invisible on screen and very much
          visible to anything reading text out of the DOM. */}
      <JsonLd json={jsonLdScript([articleJsonLd(article, articlePath(article.slug))])} />
      {/* Google's publisher script, only when the button is switched on — a
          script tag for a control nobody renders is a third party watching a
          page for no reason. `async` and plain `<script>`, as Google documents:
          it is judged by its URL against `script-src`, so it needs no nonce, and
          these pages are prerendered and carry none. */}
      {PREFERRED_SOURCE.enabled && (
        <script async src={PREFERRED_SOURCE.scriptSrc} />
      )}
      <ArticleDoc
        article={article}
        section={{ href: ARTICLES_INDEX_PATH, label: 'Articles' }}
        related={related}
        footerNote={
          // ⚠️ This promised that "every figure here is measured with the same
          // code the product runs" — true of the first piece, and a claim about
          // every future one (owner, 2026-08-29). An article may quote a
          // regulator, a filing or a study we did not run. The same sentence was
          // on the index; both were changed together, because a claim fixed on
          // one surface and left on another is CLAUDE.md 11c in miniature.
          <>
            This article says where its figures came from and which day they were
            taken. <Link href={ARTICLES_INDEX_PATH}>See the other articles</Link>,
            or <Link href="/learn">start with the Learn library</Link> if you want
            the terms explained first.
          </>
        }
        cta={<ArticleCta />}
      >
        <Body />
      </ArticleDoc>
    </>
  );
}
