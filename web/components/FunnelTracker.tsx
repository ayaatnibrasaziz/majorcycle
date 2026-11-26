'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { track } from '@/lib/analytics';

/**
 * The funnel steps no single component owns (Analytics, 2026-11-27 — the Philippines
 * campaign needs the path from ad to payment readable end to end):
 *
 *   - `view_stock`    — a Stock Detail page opened (market + the URL's symbol).
 *   - `select_cta`    — a link to sign up, sign in or see pricing was pressed, and
 *                       WHERE it sat (header / footer / page body, or a named
 *                       `data-cta-place`), so the landing's buttons can be compared.
 *   - `read_article`  — how far into a Learn or Articles piece a reader got: 25, 50,
 *                       75 and 100% of the article body, each once per visit.
 *
 * Everything is a label we write ourselves or a path on this site — never what a
 * reader typed. `track()` is a no-op off the live host, so this costs nothing in dev.
 *
 * ⚠️ `usePathname`, not `useSearchParams` — the root layout must stay static (11s).
 */

const STOCK_PATH = /^\/stocks\/(us|au|ca)\/([^/]+)$/;
const ARTICLE_PATH = /^\/(learn|articles)\/([^/]+)$/;
const CTA_TARGETS: Record<string, string> = {
  '/signup': 'signup',
  '/login': 'login',
  '/pricing': 'pricing',
};
const DEPTHS = [25, 50, 75, 100] as const;

/** Where on the page a link sits: a named place if the page gave one, else its landmark. */
export function ctaPlace(el: Element): string {
  const named = el.closest('[data-cta-place]')?.getAttribute('data-cta-place');
  if (named) return named;
  if (el.closest('header')) return 'header';
  if (el.closest('footer')) return 'footer';
  if (el.closest('[role="dialog"]')) return 'dialog';
  return 'body';
}

/** The CTA a link is, or null. Same-site paths only; another site's link is not ours. */
export function ctaTarget(href: string, origin: string): string | null {
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin) return null;
    return CTA_TARGETS[url.pathname] ?? null;
  } catch {
    return null;
  }
}

export function FunnelTracker() {
  const pathname = usePathname();

  // Pressed a sign-up / sign-in / pricing link, anywhere. One listener, so no link
  // needs editing and a new one is counted on the day it is written.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a) return;
      const to = ctaTarget(a.getAttribute('href') ?? '', window.location.origin);
      if (!to) return;
      track('select_cta', { to, place: ctaPlace(a), page: window.location.pathname });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  // A Stock Detail page opened.
  useEffect(() => {
    const m = STOCK_PATH.exec(pathname ?? '');
    if (m) track('view_stock', { market: m[1]!, ticker: decodeURIComponent(m[2]!).toUpperCase() });
  }, [pathname]);

  // Reading depth on an article.
  useEffect(() => {
    const m = ARTICLE_PATH.exec(pathname ?? '');
    if (!m) return;
    const section = m[1]!;
    const slug = m[2]!;
    const sent = new Set<number>();
    let frame = 0;
    const measure = () => {
      frame = 0;
      const body = document.querySelector('[data-article-body]');
      if (!body) return;
      const r = body.getBoundingClientRect();
      if (r.height <= 0) return;
      // How much of the body has passed the bottom of the screen.
      const read = Math.min(1, Math.max(0, (window.innerHeight - r.top) / r.height));
      for (const d of DEPTHS) {
        if (read * 100 >= d && !sent.has(d)) {
          sent.add(d);
          track('read_article', { section, article: slug, depth: d });
        }
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const first = window.setTimeout(measure, 1000);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(first);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
