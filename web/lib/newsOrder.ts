import type { NewsItem } from '@/lib/types';

/**
 * News newest first. The provider's order is its own ranking, not time, so a 30 September
 * story sat above 1 October ones under dates that read like a list in order (visual audit,
 * 2026-10-07). An item whose date cannot be read goes last, never first.
 */
export function newestFirst(news: readonly NewsItem[]): NewsItem[] {
  const time = (n: NewsItem) => {
    const t = Date.parse(n.publishedAt);
    return Number.isNaN(t) ? -Infinity : t;
  };
  return [...news].sort((a, b) => {
    const ta = time(a);
    const tb = time(b);
    return ta === tb ? 0 : tb > ta ? 1 : -1;
  });
}
