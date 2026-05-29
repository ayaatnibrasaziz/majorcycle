'use client';

import { useState } from 'react';

import type { FundamentalsSnapshot } from '@/lib/types';

interface Props {
  fundamentals: FundamentalsSnapshot;
}

type SortKey = 'label' | 'category' | 'value';
type SortDir = 'asc' | 'desc';

type Category =
  | 'Valuation'
  | 'Profitability'
  | 'Growth'
  | 'Balance Sheet'
  | 'Cash Flow'
  | 'Income'
  | 'Market';

interface MetricRow {
  label: string;
  category: Category;
  raw: number | null;
  disp: string;
  tip: string;
}

const CAT_CLASS: Record<Category, string> = {
  'Valuation':    'mt-cat-valuation',
  'Profitability':'mt-cat-profitability',
  'Growth':       'mt-cat-growth',
  'Balance Sheet':'mt-cat-balance',
  'Cash Flow':    'mt-cat-cashflow',
  'Income':       'mt-cat-income',
  'Market':       'mt-cat-market',
};

function fmt(v: number | null, decimals = 2): string {
  if (v === null) return '—';
  return v.toFixed(decimals);
}

function buildRows(f: FundamentalsSnapshot): MetricRow[] {
  const rows: MetricRow[] = [
    // Valuation
    { label: 'Trailing P/E',   category: 'Valuation',    raw: f.pe,             disp: f.pe !== null ? `${fmt(f.pe)}x` : '—',             tip: 'Trailing P/E — Price ÷ EPS (last 12 months). Lower = cheaper relative to earnings.' },
    { label: 'Forward P/E',    category: 'Valuation',    raw: f.forwardPe,      disp: f.forwardPe !== null ? `${fmt(f.forwardPe)}x` : '—', tip: 'Forward P/E — Price ÷ estimated next-year EPS. Reflects market growth expectations.' },
    { label: 'PEG Ratio',      category: 'Valuation',    raw: f.peg,            disp: f.peg !== null ? fmt(f.peg) : '—',                  tip: 'PEG — P/E ÷ Earnings Growth Rate. Below 1 = potentially undervalued for its growth. Above 2 = expensive relative to growth.' },
    { label: 'Price / Book',   category: 'Valuation',    raw: f.priceToBook,    disp: f.priceToBook !== null ? `${fmt(f.priceToBook)}x` : '—', tip: 'Price/Book — Market Cap ÷ Book Value. Below 1 = trading below asset value. High P/B typical of capital-light businesses.' },
    { label: 'Price / Sales',  category: 'Valuation',    raw: f.priceToSales,   disp: f.priceToSales !== null ? `${fmt(f.priceToSales)}x` : '—', tip: 'Price/Sales — Market Cap ÷ Revenue. Useful for companies with no earnings yet. Lower = cheaper.' },
    { label: 'EV / EBITDA',    category: 'Valuation',    raw: f.evToEbitda,     disp: f.evToEbitda !== null ? `${fmt(f.evToEbitda)}x` : '—', tip: 'EV/EBITDA — Enterprise Value ÷ EBITDA. A capital-structure-neutral valuation metric. Below 10x often considered value territory.' },
    { label: 'FCF Yield',      category: 'Valuation',    raw: f.fcfYieldPct,    disp: f.fcfYieldPct !== null ? `${fmt(f.fcfYieldPct)}%` : '—', tip: 'FCF Yield % — Free Cash Flow ÷ Market Cap × 100. Above 4% generally considered attractive.' },
    // Profitability
    { label: 'Gross Margin',   category: 'Profitability', raw: f.grossMargin,   disp: f.grossMargin !== null ? `${fmt(f.grossMargin, 1)}%` : '—', tip: 'Gross Margin % — (Revenue − COGS) ÷ Revenue × 100. Higher = more pricing power.' },
    { label: 'Operating Margin', category: 'Profitability', raw: f.operatingMargin, disp: f.operatingMargin !== null ? `${fmt(f.operatingMargin, 1)}%` : '—', tip: 'Operating Margin % — Operating Income ÷ Revenue × 100. Shows profitability after all operating costs. Above 20% strong for most industries.' },
    { label: 'Net Margin',     category: 'Profitability', raw: f.netMargin,     disp: f.netMargin !== null ? `${fmt(f.netMargin, 1)}%` : '—', tip: 'Net Margin % — Net Income ÷ Revenue × 100. Bottom-line profit per dollar of sales.' },
    { label: 'EBITDA Margin',  category: 'Profitability', raw: f.ebitdaMargin,  disp: f.ebitdaMargin !== null ? `${fmt(f.ebitdaMargin, 1)}%` : '—', tip: 'EBITDA Margin % — EBITDA ÷ Revenue × 100. Operating profitability before non-cash and financing items.' },
    { label: 'ROE',            category: 'Profitability', raw: f.roe,           disp: f.roe !== null ? `${fmt(f.roe, 1)}%` : '—',          tip: 'Return on Equity % — Net Income ÷ Shareholders Equity × 100. Above 15% generally considered strong.' },
    { label: 'ROA',            category: 'Profitability', raw: f.roa,           disp: f.roa !== null ? `${fmt(f.roa, 1)}%` : '—',          tip: 'Return on Assets % — Net Income ÷ Total Assets × 100. Measures how efficiently assets generate profit.' },
    // Growth
    { label: 'Revenue Growth (YoY)', category: 'Growth', raw: f.revenueGrowthYoy, disp: f.revenueGrowthYoy !== null ? `${fmt(f.revenueGrowthYoy, 1)}%` : '—', tip: 'Revenue Growth % (Year-over-Year) — how much total sales grew vs. prior year.' },
    { label: 'Earnings Growth (YoY)', category: 'Growth', raw: f.earningsGrowthYoy, disp: f.earningsGrowthYoy !== null ? `${fmt(f.earningsGrowthYoy, 1)}%` : '—', tip: 'Earnings Growth % (Year-over-Year) — how much EPS grew vs. prior year.' },
    // Balance Sheet
    { label: 'Debt / Equity',  category: 'Balance Sheet', raw: f.debtToEquity,  disp: f.debtToEquity !== null ? fmt(f.debtToEquity) : '—', tip: 'Debt/Equity — Total Debt ÷ Shareholders Equity. Below 0.5 = low leverage. Above 1.5 = high leverage.' },
    { label: 'Current Ratio',  category: 'Balance Sheet', raw: f.currentRatio,  disp: f.currentRatio !== null ? fmt(f.currentRatio) : '—', tip: 'Current Ratio — Current Assets ÷ Current Liabilities. Above 2 = very safe. Below 1 = potential liquidity risk.' },
    { label: 'Quick Ratio',    category: 'Balance Sheet', raw: f.quickRatio,    disp: f.quickRatio !== null ? fmt(f.quickRatio) : '—',    tip: 'Quick Ratio — (Current Assets − Inventory) ÷ Current Liabilities. Stricter liquidity test than Current Ratio.' },
    { label: 'Interest Coverage', category: 'Balance Sheet', raw: f.interestCoverage, disp: f.interestCoverage !== null ? `${fmt(f.interestCoverage, 1)}x` : '—', tip: 'Interest Coverage — EBIT ÷ Interest Expense. Above 5x = very safe. Below 2x = financial stress risk.' },
    // Cash Flow
    { label: 'FCF Margin',     category: 'Cash Flow',     raw: f.fcfMarginPct,  disp: f.fcfMarginPct !== null ? `${fmt(f.fcfMarginPct, 1)}%` : '—', tip: 'FCF Margin % — Free Cash Flow ÷ Revenue × 100. High FCF margin = strong cash-generating business.' },
    // Income
    { label: 'Dividend Yield', category: 'Income',        raw: f.dividendYieldPct, disp: f.dividendYieldPct !== null ? `${fmt(f.dividendYieldPct, 2)}%` : '—', tip: 'Dividend Yield % — Annual Dividend ÷ Stock Price × 100. Income return per dollar invested.' },
    { label: 'Payout Ratio',   category: 'Income',        raw: f.payoutRatioPct,   disp: f.payoutRatioPct !== null ? `${fmt(f.payoutRatioPct, 1)}%` : '—', tip: 'Payout Ratio % — Dividends ÷ Net Income × 100. Below 60% = sustainable. Above 80% = potential risk.' },
    // Market
    { label: 'Beta',           category: 'Market',        raw: f.beta,          disp: f.beta !== null ? fmt(f.beta) : '—',                tip: 'Beta — measures volatility vs. the market. Beta = 1: moves with market. Above 1: more volatile. Below 1: less volatile.' },
    { label: 'Short % of Float', category: 'Market',      raw: f.shortPctOfFloat, disp: f.shortPctOfFloat !== null ? `${fmt(f.shortPctOfFloat, 1)}%` : '—', tip: 'Short % of Float — % of available shares currently sold short. Above 15% = significant bearish conviction.' },
    { label: 'Shares Change (YoY)', category: 'Market',   raw: f.sharesChangeYoyPct, disp: f.sharesChangeYoyPct !== null ? `${fmt(f.sharesChangeYoyPct, 1)}%` : '—', tip: 'Shares Outstanding Change % YoY — negative = buybacks (shareholder-friendly). Positive = dilution.' },
  ];
  return rows.filter((r) => r.raw !== null);
}

export function MetricsTable({ fundamentals }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const rows = buildRows(fundamentals);

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'label') {
      cmp = a.label.localeCompare(b.label);
    } else if (sortKey === 'category') {
      cmp = a.category.localeCompare(b.category);
    } else {
      const av = a.raw ?? -Infinity;
      const bv = b.raw ?? -Infinity;
      cmp = av - bv;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'value' ? 'desc' : 'asc');
    }
  }

  function arrow(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? '▲' : '▼';
  }

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">Key Metrics</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Click any column to sort
        </div>
      </div>
      <div className="card-body card-body--bleed">
        <table className="table--metrics" aria-label="Key financial metrics">
          <thead>
            <tr>
              <th
                className={sortKey === 'label' ? 'sorted' : ''}
                onClick={() => handleSort('label')}
              >
                Metric
                <span className="sort-arrow">{arrow('label')}</span>
              </th>
              <th
                className={sortKey === 'category' ? 'sorted' : ''}
                onClick={() => handleSort('category')}
              >
                Category
                <span className="sort-arrow">{arrow('category')}</span>
              </th>
              <th
                className={`num${sortKey === 'value' ? ' sorted is-active' : ''}`}
                onClick={() => handleSort('value')}
              >
                Value
                <span className="sort-arrow">{arrow('value')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} title={row.tip}>
                <td className="text-cell">{row.label}</td>
                <td className="text-cell">
                  <span className={`mt-cat-pill ${CAT_CLASS[row.category]}`}>
                    {row.category}
                  </span>
                </td>
                <td className="num">{row.disp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
