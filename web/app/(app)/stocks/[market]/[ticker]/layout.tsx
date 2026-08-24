import { notFound } from 'next/navigation';

import { isValidMarket } from '@/lib/horizon';
import { stockExists } from '@/lib/stocks';
import { urlPartsToTicker } from '@/lib/ticker';

/**
 * Decide whether this ticker exists BEFORE anything is streamed.
 *
 * ── The bug this fixes (audit F-011, 2026-08-23) ────────────────────────────
 * `/stocks/us/ZZZZNOTREAL` answered **200**, and so did `/stocks/xx/AAPL`. The
 * page called `notFound()` correctly; by then it was too late. `loading.tsx`
 * creates a Suspense boundary, Next flushes that fallback as soon as it can, and
 * the status line goes out with the first byte — so the `notFound()` further down
 * swapped the *body* for the not-found page while the response still said 200.
 * The reader saw the right screen, which is exactly why nobody noticed.
 *
 * CLAUDE.md **11r** records the sitewide version of this, fixed on 2026-08-18 by
 * deleting the root `app/loading.tsx`. That fix never reached the signed-in
 * product, which kept `app/(app)/loading.tsx` and this route's own.
 *
 * ── Why a layout, rather than deleting `loading.tsx` again ──────────────────
 * Next nests a segment as `<Layout>` → `<Suspense fallback={<Loading/>}>` →
 * `<Page/>`. **The layout renders outside the boundary**, so a `notFound()` here
 * happens while the status is still ours to set — and the skeleton survives for
 * the page beneath it. Deleting `loading.tsx` would also have worked and would
 * have cost the reader the skeleton on the heaviest page in the product.
 *
 * ⚠️ Verified by measurement, not by reading the docs: with this file present an
 * unknown ticker answers 404 and a real one still paints its skeleton first. The
 * numbers are in the audit.
 *
 * ── What it costs ───────────────────────────────────────────────────────────
 * One `stocks` row read, which blocks the shell. `stockExists` shares its
 * `cache()`d result with the page's own `fetchStockDetail`, so the route makes
 * the SAME number of database round trips it made before this file existed. The
 * page's heavy work (the cycle analysis, the benchmark series) still streams
 * behind its own Suspense boundaries exactly as before.
 *
 * ⚠️ It did not start that way. The first version asked a deliberately lighter
 * question — one column instead of the row — and that made it a THIRD sequential
 * round trip rather than a shared one. From Australia that is ~500ms, and it cost
 * the page 19 Lighthouse points before anyone looked. The measurement is in
 * `lib/stocks.ts`.
 *
 * ⚠️ Both checks belong HERE rather than being split with the page. The page
 * keeps its own `notFound()` calls as a backstop — they are unreachable while
 * this file exists, and that is the point: if this layout is ever removed, the
 * route degrades to the old soft-404 rather than to a crash on a null stock.
 */
export default async function TickerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ market: string; ticker: string }>;
}) {
  const { market, ticker } = await params;

  // Free — no database involved. `.V` and `.TO` both map to `ca`, so this cannot
  // be inferred from the suffix alone (CLAUDE.md #14).
  if (!isValidMarket(market)) notFound();

  // `isValidMarket` is a type guard, so `market` is a `Market` from here on.
  const stored = urlPartsToTicker(market, ticker);
  if (!stored) notFound();

  // Throws `StockReadError` on a failed read, which reaches the error boundary
  // and becomes a 503 — never a 404. "I could not read it" and "it does not
  // exist" are different answers (CLAUDE.md 11e).
  if (!(await stockExists(stored))) notFound();

  return children;
}
