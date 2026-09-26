'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';

import { DrawdownOverlay } from '@/components/stocks/DrawdownOverlay';
import { PriceChart } from '@/components/stocks/PriceChart';
import { RelativePerformance } from '@/components/stocks/RelativePerformance';
import { SmartMoneyActivity } from '@/components/stocks/SmartMoneyActivity';
import { historyUrl, unpackBars, type PackedBars } from '@/lib/priceHistory';
import { useHydrated } from '@/lib/useHydrated';
import type { PriceBar } from '@/lib/types';

/**
 * The Stock Detail page's price history, shared by its four interactive charts.
 *
 * The page arrives with the last two years (`RECENT_BARS`) — enough for every chart's
 * default one-year view — and the full history is fetched ONCE, straight after, from
 * `/api/bars` (`lib/priceHistory.ts` says why). Charts render from whatever is here;
 * when the rest arrives they re-render with it. The numbers are identical either way;
 * only WHEN the older ones arrive has changed.
 *
 * The drawdown chart is the exception: its series and its markers run over the whole
 * history from the first bar, so it waits for `complete` rather than drawing a partial
 * picture and then redrawing a different one.
 */

interface History {
  bars: PriceBar[];
  /** True once the whole history is here (or the page already carried all of it). */
  complete: boolean;
  /** True when fetching the rest failed, so a waiting chart can say so. */
  failed: boolean;
}

const Ctx = createContext<{ current: History; initial: History } | null>(null);

/**
 * ⚠️ The FIRST render in the browser must match the server's, or React throws a
 * hydration error and redraws. The drawdown chart streams in AFTER the page, by which
 * time the full history has often arrived — found by the first test run (2026-09-26):
 * the server had sent "Loading…" and the browser drew the chart. So until this part of
 * the page has hydrated, every chart sees exactly what the server rendered with (the
 * recent window), and switches to the full history on the very next render.
 */
function useHistory(): History {
  const h = useContext(Ctx);
  const hydrated = useHydrated();
  if (!h) throw new Error('PriceHistoryProvider is missing above this chart');
  return hydrated ? h.current : h.initial;
}

export function PriceHistoryProvider({
  ticker,
  recent,
  total,
  version,
  children,
}: {
  ticker: string;
  recent: PackedBars;
  /** How many bars the full history holds — equal to recent's length when it IS the full history. */
  total: number;
  version: string;
  children: ReactNode;
}) {
  const recentBars = useMemo(() => unpackBars(recent), [recent]);
  const needsRest = recentBars.length < total;
  const [full, setFull] = useState<PriceBar[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!needsRest) return;
    const ctrl = new AbortController();
    const url = historyUrl(ticker, version);
    void (async () => {
      // One retry: a cold function or a busy database is the likely failure, and
      // it is usually gone a second later.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(url, { signal: ctrl.signal });
          if (res.ok) {
            setFull(unpackBars((await res.json()) as PackedBars));
            return;
          }
        } catch {
          if (ctrl.signal.aborted) return;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      if (!ctrl.signal.aborted) setFailed(true);
    })();
    return () => ctrl.abort();
  }, [needsRest, ticker, version]);

  const value = useMemo(() => {
    const initial: History = { bars: recentBars, complete: !needsRest, failed: false };
    const current: History = full ? { bars: full, complete: true, failed: false } : { ...initial, failed };
    return { current, initial };
  }, [full, recentBars, needsRest, failed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

type Without<T> = Omit<T, 'priceBars'>;

export function LivePriceChart(props: Without<ComponentProps<typeof PriceChart>>) {
  return <PriceChart {...props} priceBars={useHistory().bars} />;
}

export function LiveRelativePerformance(props: Without<ComponentProps<typeof RelativePerformance>>) {
  return <RelativePerformance {...props} priceBars={useHistory().bars} />;
}

export function LiveSmartMoneyActivity(props: Without<ComponentProps<typeof SmartMoneyActivity>>) {
  return <SmartMoneyActivity {...props} priceBars={useHistory().bars} />;
}

export function LiveDrawdownOverlay(props: Without<ComponentProps<typeof DrawdownOverlay>>) {
  const { bars, complete, failed } = useHistory();
  if (complete) return <DrawdownOverlay {...props} priceBars={bars} />;
  return (
    <div className="card" role="status" aria-live="polite">
      <div className="h-[220px] flex items-center justify-center text-[12px] text-[var(--text-muted)]">
        {failed
          ? 'The full price history could not be loaded. Reload the page to try again.'
          : 'Loading the full price history…'}
      </div>
    </div>
  );
}
