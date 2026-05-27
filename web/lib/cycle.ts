import { cache } from 'react';

import { toCamel } from '@/lib/case';
import type { CycleAnalysis } from '@/lib/types';

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/**
 * Fetch cycle analysis for one ticker by calling the co-located Python
 * serverless function at /api/cycle. Cached per render so multiple
 * components on the same page only pay the round-trip once.
 *
 * Returns null on any error (404, 500, network failure) so the UI can
 * degrade gracefully — cycle data is enriching, not blocking.
 */
export const fetchCycleAnalysis = cache(
  async (
    ticker: string,
    preset: 'short' | 'medium' | 'long' = 'medium',
  ): Promise<CycleAnalysis | null> => {
    try {
      const url = `${baseUrl()}/api/cycle?ticker=${encodeURIComponent(ticker)}&preset=${preset}`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return null;
      const raw: unknown = await res.json();
      return toCamel<CycleAnalysis>(raw as never);
    } catch {
      return null;
    }
  },
);
