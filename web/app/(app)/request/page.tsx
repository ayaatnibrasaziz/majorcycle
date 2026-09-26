import type { Metadata } from 'next';

import { RequestTicker } from '@/components/request/RequestTicker';
import { fetchRecentRequests } from '@/lib/tickerRequests.server';

export const metadata: Metadata = {
  title: 'Request a Ticker',
  description:
    'Search every listed US, Australian, and Canadian stock and request any not yet in the MajorCycle universe.',
};

// Dynamic: the recent list is read per request (it changes whenever anyone requests
// a ticker) and the page sits behind sign-in.
export const dynamic = 'force-dynamic';

export default async function RequestTickerPage() {
  // Rendered with the page rather than fetched after it — that second round trip was
  // 0.55 s of the page's ~1.4 s (2026-09-26). `null` = unreadable: the component then
  // asks the API itself, exactly as it used to.
  const initialRecent = await fetchRecentRequests();
  return <RequestTicker initialRecent={initialRecent} />;
}
