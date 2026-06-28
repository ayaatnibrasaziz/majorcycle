import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { fetchBenchmarks } from '@/lib/benchmarks.server';
import { fetchCycleAnalysis } from '@/lib/cycle';
import { parseSpec, type RouteSearch } from '@/lib/horizon';
import { fetchMetricMedians } from '@/lib/medians.server';
import type { ReportData } from '@/lib/report-types';
import { fetchStockDetail } from '@/lib/stocks';
import { urlPartsToTicker, tickerDisplay, tickerToUrlParts } from '@/lib/ticker';
import type { Market } from '@/lib/types';

let _logoCache: string | null = null;

/**
 * The brand logo as a data: URL, read once from public/logo.png and cached. The
 * offline report file inlines this so it needs nothing from the network. Returns
 * '' on any read failure (the <img> alt then shows) — never throws.
 */
async function logoDataUrl(): Promise<string> {
  if (_logoCache !== null) return _logoCache;
  try {
    const file = path.join(process.cwd(), 'public', 'logo.png');
    const buf = await fs.readFile(file);
    _logoCache = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    _logoCache = '';
  }
  return _logoCache;
}

/**
 * Gather everything the report needs into one JSON-serializable payload. Reuses
 * the exact same fetchers as the live detail page, so the report can never drift
 * from the page's data. Used by BOTH the /report preview page and the gated
 * /report/data route that powers the one-click download.
 *
 * Read-only — derives scores on demand, persists nothing (#15-compliant). Returns
 * null when the stock can't be found (caller 404s).
 */
export async function buildReportData(
  market: Market,
  urlTicker: string,
  sp: RouteSearch,
): Promise<ReportData | null> {
  const { spec, label: horizonLabel } = parseSpec(sp);
  const stored = urlPartsToTicker(market, urlTicker);

  const [stock, medians] = await Promise.all([
    fetchStockDetail(stored),
    fetchMetricMedians(),
  ]);
  if (!stock) return null;

  const cycle = await fetchCycleAnalysis(stored, spec);

  // Benchmark series for Relative Performance — same cap as the detail page
  // (later of the stock's first bar and ~20y ago, so we never pull decades of
  // unneeded index history).
  const twentyYearsAgo = new Date();
  twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
  const benchFloor = twentyYearsAgo.toISOString().slice(0, 10);
  const firstBar = stock.priceBars[0]?.date;
  const benchSince = firstBar ? (firstBar > benchFloor ? firstBar : benchFloor) : undefined;
  const benchmarks = benchSince ? await fetchBenchmarks(benchSince) : {};

  const display = tickerDisplay(stored);
  const symbol = tickerToUrlParts(stored).symbol;
  const name = stock.name ?? stored;
  const generated = new Date().toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const lastClose =
    stock.priceBars.length > 0 ? stock.priceBars[stock.priceBars.length - 1]!.close : null;

  return {
    stock,
    cycle,
    benchmarks,
    medians,
    market,
    display,
    symbol,
    name,
    horizonLabel,
    generated,
    logoDataUrl: await logoDataUrl(),
    lastClose,
  };
}
