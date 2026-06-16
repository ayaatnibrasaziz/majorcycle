'use client';

import { useMemo } from 'react';

import type { FundamentalsSnapshot } from '@/lib/types';
import type { MedianTables, MetricKey, MetricMedians } from '@/lib/medians.server';
import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  fundamentals: FundamentalsSnapshot;
  industry: string | null;
  sector: string | null;
  market: string;
  medians: MedianTables;
}

type Category = 'Valuation' | 'Profitability' | 'Growth' | 'Balance Sheet';
type Unit = 'pct' | 'mult' | 'ratio';

interface MetricDef {
  key: MetricKey;
  label: string;
  cat: Category;
  unit: Unit;
  higherBetter: boolean;
  tip: string;
  /** Display cap: |value| beyond this shows ">+cap" instead of an absurd figure
   *  (e.g. earnings growth from a near-zero base reads as +30,000%). The true
   *  value stays in the cell tooltip. Outliers are also excluded from the peer
   *  median (see medians.server.ts). */
  cap?: number;
}

// Trimmed to the metrics where a sector/market median comparison is genuinely
// meaningful. Value is shown neutral; the colour now lives on the *relative*
// columns, so green/red means "better/worse than peers", not an arbitrary
// fixed threshold.
const METRICS: MetricDef[] = [
  { key: 'pe', label: 'Trailing P/E', cat: 'Valuation', unit: 'mult', higherBetter: false, cap: 150,
    tip: 'Price ÷ EPS (last 12 months). Lower = cheaper relative to earnings.' },
  { key: 'evToEbitda', label: 'EV / EBITDA', cat: 'Valuation', unit: 'mult', higherBetter: false, cap: 150,
    tip: 'Enterprise Value ÷ EBITDA. Lower = cheaper on a capital-structure-neutral basis.' },
  { key: 'peg', label: 'PEG Ratio', cat: 'Valuation', unit: 'ratio', higherBetter: false, cap: 25,
    tip: 'P/E ÷ earnings growth. Below 1 = cheap for its growth; above 2 = expensive.' },
  { key: 'fcfYieldPct', label: 'FCF Yield', cat: 'Valuation', unit: 'pct', higherBetter: true, cap: 100,
    tip: 'Free Cash Flow ÷ Market Cap. Higher = more cash generated per dollar invested.' },
  { key: 'grossMargin', label: 'Gross Margin', cat: 'Profitability', unit: 'pct', higherBetter: true,
    tip: '(Revenue − COGS) ÷ Revenue. Higher = more pricing power.' },
  { key: 'operatingMargin', label: 'Operating Margin', cat: 'Profitability', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Operating income ÷ Revenue. Profitability after operating costs.' },
  { key: 'netMargin', label: 'Net Margin', cat: 'Profitability', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Net income ÷ Revenue. Bottom-line profit per dollar of sales.' },
  { key: 'roe', label: 'Return on Equity', cat: 'Profitability', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Net income ÷ shareholders equity. How efficiently equity generates profit.' },
  { key: 'roa', label: 'Return on Assets', cat: 'Profitability', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Net income ÷ total assets. How efficiently assets generate profit.' },
  { key: 'revenueGrowthYoy', label: 'Revenue Growth', cat: 'Growth', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Year-over-year revenue growth.' },
  { key: 'earningsGrowthYoy', label: 'Earnings Growth', cat: 'Growth', unit: 'pct', higherBetter: true, cap: 300,
    tip: 'Year-over-year growth in earnings (net profit). Faster = the bottom line is expanding. Very large readings usually mean last year’s earnings were near zero.' },
  { key: 'debtToEquity', label: 'Debt / Equity', cat: 'Balance Sheet', unit: 'ratio', higherBetter: false, cap: 25,
    tip: 'Total debt ÷ equity. Lower = less leverage.' },
  { key: 'currentRatio', label: 'Current Ratio', cat: 'Balance Sheet', unit: 'ratio', higherBetter: true, cap: 25,
    tip: 'Current assets ÷ current liabilities. Above 1 = covers short-term obligations.' },
];

const CAT_PILL: Record<Category, string> = {
  Valuation: 'mt-cat-valuation',
  Profitability: 'mt-cat-profitability',
  Growth: 'mt-cat-growth',
  'Balance Sheet': 'mt-cat-balance',
};

const MARKET_LABEL: Record<string, string> = { us: 'US market', au: 'ASX', ca: 'TSX' };

const UNIT_SUFFIX: Record<Unit, string> = { pct: '%', mult: 'x', ratio: '' };

function fmtVal(v: number, unit: Unit, cap?: number): string {
  if (cap !== undefined && Math.abs(v) > cap) {
    return `${v > 0 ? '>+' : '<−'}${cap}${UNIT_SUFFIX[unit]}`;
  }
  if (unit === 'pct') return `${v.toFixed(1)}%`;
  if (unit === 'mult') return `${v.toFixed(1)}x`;
  return v.toFixed(2);
}

function fmtDelta(delta: number, unit: Unit, cap?: number): string {
  const sign = delta >= 0 ? '+' : '−';
  if (cap !== undefined && Math.abs(delta) > cap) {
    const suffix = unit === 'pct' ? 'pp' : UNIT_SUFFIX[unit];
    return `${delta >= 0 ? '>+' : '<−'}${cap}${suffix}`;
  }
  const a = Math.abs(delta);
  if (unit === 'pct') return `${sign}${a.toFixed(1)}pp`;
  if (unit === 'mult') return `${sign}${a.toFixed(1)}x`;
  return `${sign}${a.toFixed(2)}`;
}

type Verdict = 'better' | 'worse' | 'inline' | 'na';

interface Comparison {
  verdict: Verdict;
  /** Signed favourability score for sorting: + = better than peers. */
  score: number;
  text: string;
  tip: string;
}

function compare(
  def: MetricDef,
  value: number,
  group: MetricMedians | undefined,
  groupLabel: string,
): Comparison {
  const stat = group?.[def.key];
  if (!stat) return { verdict: 'na', score: -Infinity, text: '—', tip: `No ${groupLabel} median available.` };

  const delta = value - stat.median;
  // Relative size of the gap, used to call "in line" when the difference is small.
  const rel = Math.abs(stat.median) > 1e-9 ? delta / Math.abs(stat.median) : delta;
  const favScore = def.higherBetter ? rel : -rel;

  let verdict: Verdict;
  if (Math.abs(rel) < 0.05) verdict = 'inline';
  else verdict = favScore > 0 ? 'better' : 'worse';

  const dir = delta >= 0 ? 'above' : 'below';
  const quality =
    verdict === 'inline' ? 'in line with' : verdict === 'better' ? 'stronger than' : 'weaker than';
  // Tip reveals the true (uncapped) gap; the cell text is capped for absurd values.
  const tip = `${groupLabel} median: ${fmtVal(stat.median, def.unit)} across ${stat.n} peers. ` +
    `This stock is ${fmtDelta(delta, def.unit).replace(/^[+−]/, '')} ${dir} — ${quality} the typical peer.`;

  return { verdict, score: favScore, text: fmtDelta(delta, def.unit, def.cap), tip };
}

interface BuiltRow {
  def: MetricDef;
  value: number;
  disp: string;
  valueTitle?: string;
  industryCmp: Comparison;
  sectorCmp: Comparison;
  marketCmp: Comparison;
}

const VERDICT_CLASS: Record<Verdict, string> = {
  better: 'km-cmp--better',
  worse: 'km-cmp--worse',
  inline: 'km-cmp--inline',
  na: 'km-cmp--na',
};

export function MetricsTable({ fundamentals, industry, sector, market, medians }: Props) {
  // Industries below the peer floor are absent from medians.industry, so this is
  // undefined for them and the "vs Industry" cells render the graceful "—" state.
  const industryGroup = industry ? medians.industry[industry] : undefined;
  const sectorGroup = sector ? medians.sector[sector] : undefined;
  const marketGroup = medians.market[market];
  const industryLabel = industry ?? 'Industry';
  const sectorLabel = sector ?? 'Sector';
  const marketLabel = MARKET_LABEL[market] ?? 'Market';

  const rows: BuiltRow[] = useMemo(() => {
    const f = fundamentals as unknown as Record<MetricKey, number | null>;
    return METRICS.flatMap((def) => {
      const value = f[def.key];
      if (value === null || value === undefined || !Number.isFinite(value)) return [];
      const capped = def.cap !== undefined && Math.abs(value) > def.cap;
      return [{
        def,
        value,
        disp: fmtVal(value, def.unit, def.cap),
        valueTitle: capped ? `Actual ${fmtVal(value, def.unit)} — capped for display` : undefined,
        industryCmp: compare(def, value, industryGroup, industryLabel),
        sectorCmp: compare(def, value, sectorGroup, sectorLabel),
        marketCmp: compare(def, value, marketGroup, marketLabel),
      }];
    });
  }, [fundamentals, industryGroup, sectorGroup, marketGroup, industryLabel, sectorLabel, marketLabel]);

  if (rows.length === 0) {
    return (
      <div className="card card--stack-base">
        <div className="card-header"><div className="card-title">Key Metrics</div></div>
        <div className="card-body">
          <div className="km-empty">No fundamental metrics available for this stock.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card card--stack-base km-card">
      <div className="card-header">
        <div className="card-title">
          Key Metrics
          <InfoTip title="Key Metrics">
            The headline numbers investors use, each compared with the typical
            company in the same industry, sector, and market (the &quot;median&quot; peer).
            Green means this stock is stronger than that peer, red means weaker,
            grey means about the same. A &quot;—&quot; under Industry means there aren&apos;t
            enough close peers for a reliable comparison. Tap any metric name for a
            plain-English definition.
          </InfoTip>
        </div>
        <div className="km-subtitle">How it compares with its peers</div>
      </div>
      <div className="card-body card-body--bleed">
        <div className="km-scroll">
          <table className="km-table">
            <thead>
              <tr>
                <th className="km-th-metric">Metric</th>
                <th className="km-th-cat">Category</th>
                <th className="km-num">Value</th>
                <th className="km-num">vs {industryLabel}</th>
                <th className="km-num">vs {sectorLabel}</th>
                <th className="km-num">vs {marketLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.def.key}>
                  <td className="km-metric-cell">
                    <span className="km-metric-label">
                      {r.def.label}
                      <InfoTip title={r.def.label}>{r.def.tip}</InfoTip>
                    </span>
                  </td>
                  <td className="km-cat-cell">
                    <span className={`mt-cat-pill ${CAT_PILL[r.def.cat]}`}>{r.def.cat}</span>
                  </td>
                  <td className="km-num km-value" title={r.valueTitle}>{r.disp}</td>
                  <td className={`km-num km-cmp ${VERDICT_CLASS[r.industryCmp.verdict]}`} title={r.industryCmp.tip}>
                    {r.industryCmp.text}
                  </td>
                  <td className={`km-num km-cmp ${VERDICT_CLASS[r.sectorCmp.verdict]}`} title={r.sectorCmp.tip}>
                    {r.sectorCmp.text}
                  </td>
                  <td className={`km-num km-cmp ${VERDICT_CLASS[r.marketCmp.verdict]}`} title={r.marketCmp.tip}>
                    {r.marketCmp.text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
