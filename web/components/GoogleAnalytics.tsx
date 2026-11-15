'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { installAnalytics, trackPageView } from '@/lib/analytics';

/**
 * Google Analytics, loaded AFTER the page and only on the live host (lib/analytics.ts).
 *
 * Page views are sent here, by hand, on every path change. The tag is installed on the
 * first page whose address is safe to share (`isShareableAddress`): a reader who lands
 * on `/login?next=…` is not counted on that page, and is counted from their next move
 * onward. The tag's own first hit sends the raw address, so it must never load on a
 * page that has one.
 *
 * ⚠️ `usePathname`, not `useSearchParams`: reading the query here would force every
 * page under the root layout out of static rendering (11s). `window.location` is read
 * at the moment of each attempt instead.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const ready = useRef(false);
  const loaded = useRef(false);

  useEffect(() => {
    const start = () => {
      loaded.current = true;
      const idle =
        (window as Window & { requestIdleCallback?: (cb: () => void) => number })
          .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
      idle(() => {
        // The install sends this page's view itself (lib/analytics.ts, `config`).
        if (!ready.current && installAnalytics()) ready.current = true;
      });
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => window.removeEventListener('load', start);
  }, []);

  useEffect(() => {
    if (ready.current) {
      trackPageView();
      return;
    }
    // Not installed yet because the landing address was not shareable: try again now
    // that the reader has moved. The install sends this page's view itself.
    if (loaded.current && installAnalytics()) ready.current = true;
  }, [pathname]);

  return null;
}
