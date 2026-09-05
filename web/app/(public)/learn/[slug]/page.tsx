import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArticleDoc } from '@/components/ArticleDoc';
import {
  LEARN_ARTICLES,
  LEARN_INDEX_PATH,
  LEARN_THEMES,
  articlesByTheme,
  findArticle,
  learnPath,
} from '@/lib/learn';
import { pageMetadata } from '@/lib/seo';
import { articlePageJsonLd, jsonLdScript } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { ARTICLE_BODIES } from '../content';

/**
 * One Learn article: `/learn/[slug]`.
 *
 * ⚠️ **The registry is the only way in.** An unknown slug is `notFound()`, not a
 * blank article — a dynamic route that renders an empty shell for any URL typed
 * at it is a soft-404 farm, and Google reads a page that answers 200 with nothing
 * on it far more harshly than an honest 404.
 *
 * ⚠️ **`generateMetadata`, not `export const metadata`** — the path is only known
 * per request. It still goes through `pageMetadata()` like every other public
 * page, which is what guarantees the canonical, the Open Graph object and the
 * noindex rule are stated the same way everywhere. That call also THROWS at build
 * time for a path missing from `PUBLIC_PAGES`, which for these pages is
 * impossible by construction: `PUBLIC_PAGES` derives its `/learn/<slug>` entries
 * from the same registry this file reads.
 *
 * ⚠️ The static guard `pnpm check:seo` scans for `export const metadata: Metadata
 * = pageMetadata({` and therefore cannot see this file's call at all. That is why
 * it has its own rule in `check-seo.mjs` naming this route explicitly, and why
 * `e2e/learn.spec.ts` asserts the RENDERED canonical rather than the source.
 */

export function generateStaticParams() {
  return LEARN_ARTICLES.map((a) => ({ slug: a.slug }));
}

/**
 * Nothing outside the registry may render.
 *
 * Belt and braces with `generateStaticParams` on purpose: that function decides
 * what is PRE-rendered, not what is ALLOWED. Without this, a request for
 * `/learn/anything-at-all` is rendered on demand and would crash on a missing
 * body rather than 404 cleanly.
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
    path: learnPath(article.slug),
    title: article.title,
    // The summary, not the answer. This is the sentence under the blue link in a
    // search result, and it should say what the page covers — the answer itself
    // is what the reader gets by clicking.
    description: article.summary,
    // The registry's own dates, so this page announces itself as a document with
    // an author and a date rather than as a page of a site (audit 5A-140).
    article: { published: article.published, modified: article.reviewed },
  });
}

export default async function LearnArticlePage({
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
  // completely deliberate (11j).
  if (!Body) notFound();

  const related = articlesByTheme(article.theme)
    .filter((a) => a.slug !== article.slug)
    .map((a) => ({ href: learnPath(a.slug), label: a.title }));
  const theme = LEARN_THEMES.find((t) => t.id === article.theme);

  return (
    <>
      {/* ⚠️ OUTSIDE `ArticleDoc`, deliberately. Placed inside, this landed within
          `[data-article-body]` — and `learn.spec.ts` reads that container's text
          to check no two articles repeat each other's prose, so every article
          suddenly shared 20+ eight-word runs reading "context https schema org
          graph type article headline". A `<script>` is invisible on screen and
          very much visible to anything that reads text out of the DOM. */}
      <JsonLd
        json={jsonLdScript(articlePageJsonLd(article, learnPath(article.slug), theme?.label))}
      />
      <ArticleDoc
        article={article}
        section={{
          href: LEARN_INDEX_PATH,
          label: `Learn${theme ? ` · ${theme.label}` : ''}`,
        }}
        related={related}
        footerNote={
          <>
            MajorCycle runs this analysis on listed companies across the US, Australia
            and Canada. <Link href="/">See how it works</Link>, or{' '}
            <Link href={LEARN_INDEX_PATH}>browse the rest of the library</Link>.
          </>
        }
      >
        <Body />
      </ArticleDoc>
    </>
  );
}
