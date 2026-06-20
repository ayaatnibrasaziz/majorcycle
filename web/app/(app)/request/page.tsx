import type { Metadata } from 'next';

import { RequestTicker } from '@/components/request/RequestTicker';

export const metadata: Metadata = {
  title: 'Request a Ticker',
  description:
    'Search every listed US, Australian, and Canadian stock and request any not yet in the MajorCycle universe.',
};

// Reads only via client fetch to the (auth-gated) API routes — no request-time
// Supabase read here — but keep it dynamic for consistency with the other app
// pages and to avoid any static-prerender attempt.
export const dynamic = 'force-dynamic';

export default function RequestTickerPage() {
  return <RequestTicker />;
}
