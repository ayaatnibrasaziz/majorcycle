'use client';

import type { FundamentalsSnapshot } from '@/lib/types';

interface Props {
  fundamentals: FundamentalsSnapshot;
}

type Category =
  | 'Valuation'
  | 'Profitability'
  | 'Growth'
  | 'Balance Sheet'
  | 'Cash Flow'
  | 'Income'
  | 'Market';

type ValColor = 'green' | 'amber' | 'red' | '';

interface MetricRow {
  label: string;
  category: Category;
  raw: number | null;
  disp: string;
  tip: string;
  color: ValColor;
}

const CAT_ORDER: Category[] = [
  'Valuation',
  'Profitability',
  'Growth',
  'Balance Sheet',
  'Cash Flow',
  'Income',
  'Market',
];

function fmt(v: number | null, decimals = 2): string {
  if (v === null) return '—';
  return v.toFixed(decimals);
}

// Higher-is-better: green ≥ good, red < warn, amber in between
function hi(v: number | null, good: number, warn: number): ValColor {
  if (v === null) return '';
  if (v >= good) return 'green';
  if (v < warn)  return 'red';
  return '';
}

// Lower-is-better: green ≤ good, red > warn, amber in between
function lo(v: number | null, good: number, warn: number): ValColor {
  if (v === null) return '';
  if (v <= good) return 'green';
  if (v > warn)  return 'red';
  return '';
}

function buildRows(f: FundamentalsSnapshot): MetricRow[] {
  const rows: MetricRow[] = [
    // ── Valuation ──────────────────────────────────────────────────────────
    { label: 'Trailing P/E',      category: 'Valuation', raw: f.pe,            color: '',
      disp: f.pe !== null ? `${fmt(f.pe)}x` : '—',
      tip:  'Trailing P/E — Price ÷ EPS (last 12 months). Lower = cheaper relative to earnings.' },
    { label: 'Forward P/E',       category: 'Valuation', raw: f.forwardPe,     color: '',
      disp: f.forwardPe !== null ? `${fmt(f.forwardPe)}x` : '—',
      tip:  'Forward P/E — Price ÷ estimated next-year EPS. Reflects market growth expectations.' },
    { label: 'PEG Ratio',         category: 'Valuation', raw: f.peg,           color: lo(f.peg, 1, 2),
      disp: f.peg !== null ? fmt(f.peg) : '—',
      tip:  'PEG — P/E ÷ Earnings Growth Rate. Below 1 = potentially undervalued. Above 2 = expensive relative to growth.' },
    { label: 'Price / Book',      category: 'Valuation', raw: f.priceToBook,   color: '',
      disp: f.priceToBook !== null ? `${fmt(f.priceToBook)}x` : '—',
      tip:  'Price/Book — Market Cap ÷ Book Value. Below 1 = trading below asset value.' },
    { label: 'Price / Sales',     category: 'Valuation', raw: f.priceToSales,  color: '',
      disp: f.priceToSales !== null ? `${fmt(f.priceToSales)}x` : '—',
      tip:  'Price/Sales — Market Cap ÷ Revenue. Useful for pre-profit companies. Lower = cheaper.' },
    { label: 'EV / EBITDA',       category: 'Valuation', raw: f.evToEbitda,    color: lo(f.evToEbitda, 10, 20),
      disp: f.evToEbitda !== null ? `${fmt(f.evToEbitda)}x` : '—',
      tip:  'EV/EBITDA — Enterprise Value ÷ EBITDA. Below 10x often considered value territory.' },
    { label: 'FCF Yield',         category: 'Valuation', raw: f.fcfYieldPct,   color: hi(f.fcfYieldPct, 4, 2),
      disp: f.fcfYieldPct !== null ? `${fmt(f.fcfYieldPct)}%` : '—',
      tip:  'FCF Yield % — Free Cash Flow ÷ Market Cap × 100. Above 4% generally considered attractive.' },

    // ── Profitability ───────────────────────────────────────────────────────
    { label: 'Gross Margin',      category: 'Profitability', raw: f.grossMargin,     color: hi(f.grossMargin, 40, 15),
      disp: f.grossMargin !== null ? `${fmt(f.grossMargin, 1)}%` : '—',
      tip:  'Gross Margin % — (Revenue − COGS) ÷ Revenue × 100. Higher = more pricing power.' },
    { label: 'Operating Margin',  category: 'Profitability', raw: f.operatingMargin, color: hi(f.operatingMargin, 20, 5),
      disp: f.operatingMargin !== null ? `${fmt(f.operatingMargin, 1)}%` : '—',
      tip:  'Operating Margin % — Operating Income ÷ Revenue × 100. Above 20% strong for most industries.' },
    { label: 'Net Margin',        category: 'Profitability', raw: f.netMargin,       color: hi(f.netMargin, 15, 3),
      disp: f.netMargin !== null ? `${fmt(f.netMargin, 1)}%` : '—',
      tip:  'Net Margin % — Net Income ÷ Revenue × 100. Bottom-line profit per dollar of sales.' },
    { label: 'EBITDA Margin',     category: 'Profitability', raw: f.ebitdaMargin,    color: hi(f.ebitdaMargin, 20, 8),
      disp: f.ebitdaMargin !== null ? `${fmt(f.ebitdaMargin, 1)}%` : '—',
      tip:  'EBITDA Margin % — EBITDA ÷ Revenue × 100. Operating profitability before non-cash items.' },
    { label: 'ROE',               category: 'Profitability', raw: f.roe,             color: hi(f.roe, 15, 5),
      disp: f.roe !== null ? `${fmt(f.roe, 1)}%` : '—',
      tip:  'Return on Equity % — Net Income ÷ Shareholders Equity × 100. Above 15% generally strong.' },
    { label: 'ROA',               category: 'Profitability', raw: f.roa,             color: hi(f.roa, 8, 2),
      disp: f.roa !== null ? `${fmt(f.roa, 1)}%` : '—',
      tip:  'Return on Assets % — Net Income ÷ Total Assets × 100. Measures efficiency of asset use.' },

    // ── Growth ──────────────────────────────────────────────────────────────
    { label: 'Revenue Growth',    category: 'Growth', raw: f.revenueGrowthYoy,  color: hi(f.revenueGrowthYoy, 10, 0),
      disp: f.revenueGrowthYoy !== null ? `${fmt(f.revenueGrowthYoy, 1)}%` : '—',
      tip:  'Revenue Growth % (YoY) — how much total sales grew vs. prior year.' },
    { label: 'Earnings Growth',   category: 'Growth', raw: f.earningsGrowthYoy, color: hi(f.earningsGrowthYoy, 10, 0),
      disp: f.earningsGrowthYoy !== null ? `${fmt(f.earningsGrowthYoy, 1)}%` : '—',
      tip:  'Earnings Growth % (YoY) — how much EPS grew vs. prior year.' },

    // ── Balance Sheet ────────────────────────────────────────────────────────
    { label: 'Current Ratio',     category: 'Balance Sheet', raw: f.currentRatio,    color: hi(f.currentRatio, 2, 1),
      disp: f.currentRatio !== null ? fmt(f.currentRatio) : '—',
      tip:  'Current Ratio — Current Assets ÷ Current Liabilities. Above 2 = very safe. Below 1 = liquidity risk.' },
    { label: 'Quick Ratio',       category: 'Balance Sheet', raw: f.quickRatio,      color: hi(f.quickRatio, 1.5, 0.8),
      disp: f.quickRatio !== null ? fmt(f.quickRatio) : '—',
      tip:  'Quick Ratio — (Current Assets − Inventory) ÷ Current Liabilities. Stricter liquidity test.' },
    { label: 'Debt / Equity',     category: 'Balance Sheet', raw: f.debtToEquity,    color: lo(f.debtToEquity, 0.5, 1.5),
      disp: f.debtToEquity !== null ? fmt(f.debtToEquity) : '—',
      tip:  'Debt/Equity — Total Debt ÷ Shareholders Equity. Below 0.5 = low leverage. Above 1.5 = high leverage.' },
    { label: 'Interest Coverage', category: 'Balance Sheet', raw: f.interestCoverage, color: hi(f.interestCoverage, 5, 2),
      disp: f.interestCoverage !== null ? `${fmt(f.interestCoverage, 1)}x` : '—',
      tip:  'Interest Coverage — EBIT ÷ Interest Expense. Above 5x = very safe. Below 2x = financial stress risk.' },

    // ── Cash Flow ────────────────────────────────────────────────────────────
    { label: 'FCF Margin',        category: 'Cash Flow', raw: f.fcfMarginPct, color: hi(f.fcfMarginPct, 10, 3),
      disp: f.fcfMarginPct !== null ? `${fmt(f.fcfMarginPct, 1)}%` : '—',
      tip:  'FCF Margin % — Free Cash Flow ÷ Revenue × 100. High FCF margin = strong cash-generating business.' },

    // ── Income ───────────────────────────────────────────────────────────────
    { label: 'Dividend Yield',    category: 'Income', raw: f.dividendYieldPct, color: hi(f.dividendYieldPct, 3, 1),
      disp: f.dividendYieldPct !== null ? `${fmt(f.dividendYieldPct, 2)}%` : '—',
      tip:  'Dividend Yield % — Annual Dividend ÷ Stock Price × 100. Income return per dollar invested.' },
    { label: 'Payout Ratio',      category: 'Income', raw: f.payoutRatioPct,  color: lo(f.payoutRatioPct, 60, 80),
      disp: f.payoutRatioPct !== null ? `${fmt(f.payoutRatioPct, 1)}%` : '—',
      tip:  'Payout Ratio % — Dividends ÷ Net Income × 100. Below 60% = sustainable. Above 80% = potential risk.' },

    // ── Market ───────────────────────────────────────────────────────────────
    { label: 'Beta',              category: 'Market', raw: f.beta,               color: '',
      disp: f.beta !== null ? fmt(f.beta) : '—',
      tip:  'Beta — volatility vs. the market. 1 = market-like. Above 1 = more volatile. Below 1 = more stable.' },
    { label: 'Short % of Float',  category: 'Market', raw: f.shortPctOfFloat,    color: lo(f.shortPctOfFloat, 5, 15),
      disp: f.shortPctOfFloat !== null ? `${fmt(f.shortPctOfFloat, 1)}%` : '—',
      tip:  'Short % of Float — % of available shares sold short. Above 15% = significant bearish conviction.' },
    { label: 'Shares Chg (YoY)', category: 'Market', raw: f.sharesChangeYoyPct, color: lo(f.sharesChangeYoyPct, 0, 2),
      disp: f.sharesChangeYoyPct !== null ? `${fmt(f.sharesChangeYoyPct, 1)}%` : '—',
      tip:  'Shares Outstanding Change % YoY — negative = buybacks (shareholder-friendly). Positive = dilution.' },
  ];
  return rows.filter((r) => r.raw !== null);
}

export function MetricsTable({ fundamentals }: Props) {
  const rows = buildRows(fundamentals);

  const grouped = CAT_ORDER.reduce<Record<Category, MetricRow[]>>((acc, cat) => {
    acc[cat] = rows.filter((r) => r.category === cat);
    return acc;
  }, {} as Record<Category, MetricRow[]>);

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">Key Metrics</div>
      </div>
      <div className="card-body">
        {CAT_ORDER.map((cat) => {
          const catRows = grouped[cat];
          if (!catRows.length) return null;
          return (
            <div key={cat} className="metrics-section">
              <div className="metrics-cat-label">{cat}</div>
              <div className="metrics-tile-grid">
                {catRows.map((row, i) => (
                  <div key={i} className="metric-tile" title={row.tip}>
                    <div className="metric-tile-label">{row.label}</div>
                    <div className={`metric-tile-val${row.color ? ` ${row.color}` : ''}`}>
                      {row.disp}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
