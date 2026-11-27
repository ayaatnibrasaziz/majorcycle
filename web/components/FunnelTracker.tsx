'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { track } from '@/lib/analytics';
import { STOCK_SECTION_IDS } from '@/lib/stockSections';

/**
 * The actions no single component owns (Analytics, 2026-11-27 — the owner asked for
 * every step a reader takes to be readable, so the product can be steered by what
 * people actually do):
 *
 *   view_item       a Stock Detail page opened. Google's recommended event, so its item
 *                   reports list the most-viewed stocks with no custom setup.
 *   view_section    a Stock Detail section (Thesis, Scorecard, Cycle, Fundamentals,
 *                   Sentiment) scrolled into view — once each per page visit.
 *   select_content  a link to sign up, sign in or see pricing (content_type 'cta'), with
 *                   WHERE it sat, so the landing's buttons can be compared.
 *   ui_click        every other button, link, tab or menu item pressed, by its visible
 *                   label and where it sat. This is the catch-all: a feature nobody
 *                   presses shows up as a label with no clicks.
 *   read_article    how far into a Learn or Articles piece a reader got: 25/50/75/100%.
 *
 * Labels are the words ON our buttons — copy we wrote. A label carrying an "@" (the
 * account menu shows the reader's email) or a long run of digits is never sent.
 * Nothing a reader types is read. `track()` is a no-op off the live host.
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
const CLICKABLE = 'a[href], button, [role="button"], [role="tab"], [role="menuitem"], [role="option"], summary';

/** Where on the page an element sits: a named place if the page gave one, else its landmark. */
export function ctaPlace(el: Element): string {
  const named = el.closest('[data-cta-place]')?.getAttribute('data-cta-place');
  if (named) return named;
  if (el.closest('[role="dialog"]')) return 'dialog';
  if (el.closest('header')) return 'header';
  if (el.closest('nav, aside')) return 'nav';
  if (el.closest('footer')) return 'footer';
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

/**
 * The label we may send for a pressed control, or null. Our own copy only: anything
 * that could be a reader's data — an email address, a long number — is dropped, and
 * a label is cut to 60 characters (GA keeps 100).
 */
export function uiLabel(raw: string | null | undefined): string | null {
  const label = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!label) return null;
  if (label.includes('@') || /\d{6,}/.test(label)) return null;
  return label.slice(0, 60);
}

export function FunnelTracker() {
  const pathname = usePathname();

  // Every press, anywhere. One listener, so no control needs editing and a new one is
  // counted on the day it is written.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(CLICKABLE);
      if (!el) return;
      const page = window.location.pathname;
      const place = ctaPlace(el);
      if (el instanceof HTMLAnchorElement) {
        const to = ctaTarget(el.getAttribute('href') ?? '', window.location.origin);
        if (to) {
          track('select_content', { content_type: 'cta', content_id: to, place, page });
          return;
        }
      }
      const label = uiLabel(el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.textContent);
      if (!label) return;
      track('ui_click', { label, place, page });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  // A Stock Detail page opened, and which of its sections were actually reached.
  useEffect(() => {
    const m = STOCK_PATH.exec(pathname ?? '');
    if (!m) return;
    const market = m[1]!;
    const ticker = decodeURIComponent(m[2]!).toUpperCase();
    track('view_item', { items: [{ item_id: ticker, item_name: ticker, item_category: market }] });

    const seen = new Set<string>();
    let observer: IntersectionObserver | null = null;
    const watch = () => {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = entry.target.id;
            if (!entry.isIntersecting || seen.has(id)) continue;
            seen.add(id);
            track('view_section', { section: id.replace(/^sec-/, ''), ticker, market });
          }
        },
        { threshold: 0.25 },
      );
      for (const id of STOCK_SECTION_IDS) {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      }
    };
    // The page streams in; give the sections a moment to exist.
    const t = window.setTimeout(watch, 1200);
    return () => {
      window.clearTimeout(t);
      observer?.disconnect();
    };
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
