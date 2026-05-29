'use client';

import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { FinancialStatement, FundamentalsSnapshot } from '@/lib/types';

interface Props {
  balanceSheetAnnual?: FinancialStatement;
  fundamentals: FundamentalsSnapshot;
}

function fmtB(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

function stmtVals(stmt: FinancialStatement | undefined, key: string): (number | null)[] {
  if (!stmt) return [];
  const raw = stmt[key];
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((v) => (typeof v === 'number' ? v : null));
}

function toYearLabel(dateStr: string): string {
  return `FY${new Date(dateStr + 'T00:00:00').getFullYear()}`;
}

function ratioColor(val: number | null, thresholds: [number, number]): string {
  if (val === null) return 'var(--text-primary)';
  const [good, ok] = thresholds;
  if (val >= good) return '#228B22';
  if (val >= ok)   return '#D4A017';
  return '#B22222';
}

export function BalanceSheet({ balanceSheetAnnual, fundamentals }: Props) {
  const hasChart = !!balanceSheetAnnual?.labels?.length;

  let chartData: { label: string; cash: number; other: number; debt: number | null }[] = [];

  if (hasChart) {
    const stmt   = balanceSheetAnnual!;
    const labels = [...stmt.labels].reverse();
    const assets = [...stmtVals(stmt, 'total_assets')].reverse();
    const cashA  = [...stmtVals(stmt, 'cash_and_cash_equivalents')].reverse();
    const cashB  = [...stmtVals(stmt, 'cash_cash_equivalents_and_short_term_investments')].reverse();
    const debt   = [...stmtVals(stmt, 'total_debt')].reverse();
    const cashVals = cashA.map((v, i) => v ?? cashB[i] ?? null);

    chartData = labels.slice(0, 5).map((lbl, i) => {
      const totalAssets = assets[i] ?? 0;
      const cashVal     = cashVals[i] ?? 0;
      return {
        label: toYearLabel(lbl),
        cash:  cashVal / 1e9,
        other: Math.max(0, totalAssets - cashVal) / 1e9,
        debt:  debt[i] !== null ? (debt[i]! / 1e9) : null,
      };
    });
  }

  const totalCash = fundamentals.totalCash;
  const totalDebt = fundamentals.totalDebt;
  const netCash   = totalCash !== null && totalDebt !== null ? totalCash - totalDebt : null;
  const isNetCash = netCash !== null ? netCash >= 0 : null;
  const { currentRatio, debtToEquity, interestCoverage } = fundamentals;

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">Balance Sheet Health</div>
        {hasChart && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Bars = Assets · Line = Debt
          </div>
        )}
      </div>
      <div className="card-body">
        {hasChart && chartData.length > 0 && (
          <div className="chart-canvas-wrap chart-h-lg">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#8A97A8', fontSize: 10, fontFamily: 'Sora' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  orientation="right"
                  tick={{
                    fill: '#8A97A8',
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}B`}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div
                        style={{
                          background: '#1A1A1B',
                          border: '1px solid #2E3347',
                          borderRadius: 6,
                          padding: '8px 12px',
                        }}
                      >
                        <div
                          style={{
                            color: '#E8EAF0',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          {label}
                        </div>
                        {payload.map((p) => (
                          <div
                            key={String(p.dataKey)}
                            style={{
                              color: '#94A3B8',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 11,
                            }}
                          >
                            {p.name}: ${Number(p.value ?? 0).toFixed(1)}B
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, fontFamily: 'Sora', paddingTop: 4 }}
                  iconSize={10}
                />
                <Bar
                  dataKey="cash"
                  name="Cash & Equivalents"
                  stackId="assets"
                  fill="#228B22"
                  stroke="#006400"
                  strokeWidth={1.5}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="other"
                  name="Other Assets"
                  stackId="assets"
                  fill="#1E5CB3"
                  stroke="#1A3A6E"
                  strokeWidth={1}
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  dataKey="debt"
                  name="Total Debt"
                  type="monotone"
                  stroke="#B22222"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#B22222', stroke: 'white', strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="summary-strip">
          <div
            className="summary-strip-item"
            title="Net Cash / Net Debt — Cash & Equivalents minus Total Debt. Net Cash = company has more cash than debt (healthy). Net Debt = owes more than it holds in cash."
          >
            <div className="summary-strip-label">
              {isNetCash === null ? 'Net Position' : isNetCash ? 'Net Cash' : 'Net Debt'}
            </div>
            <div
              className="summary-strip-val"
              style={{
                color:
                  isNetCash === null
                    ? 'var(--text-primary)'
                    : isNetCash
                      ? '#228B22'
                      : '#D4A017',
              }}
            >
              {netCash !== null ? fmtB(Math.abs(netCash)) : '—'}
            </div>
          </div>

          <div
            className="summary-strip-item"
            title="Current Ratio — Current Assets ÷ Current Liabilities. Above 2 = very safe · 1–2 = adequate · Below 1 = may struggle to cover short-term obligations."
          >
            <div className="summary-strip-label">Current Ratio</div>
            <div
              className="summary-strip-val"
              style={{ color: ratioColor(currentRatio, [2, 1]) }}
            >
              {currentRatio !== null ? currentRatio.toFixed(2) : '—'}
            </div>
          </div>

          <div
            className="summary-strip-item"
            title="Debt / Equity — Total Debt ÷ Shareholders Equity. Below 0.5 = low leverage · 0.5–1.5 = moderate · Above 1.5 = high leverage, higher risk."
          >
            <div className="summary-strip-label">Debt / Equity</div>
            <div
              className="summary-strip-val"
              style={{
                color:
                  debtToEquity === null
                    ? 'var(--text-primary)'
                    : debtToEquity < 0.5
                      ? '#228B22'
                      : debtToEquity < 1.5
                        ? '#D4A017'
                        : '#B22222',
              }}
            >
              {debtToEquity !== null ? debtToEquity.toFixed(2) : '—'}
            </div>
          </div>

          <div
            className="summary-strip-item"
            title="Interest Coverage — EBIT ÷ Interest Expense. Above 5x = very comfortable · 2–5x = adequate · Below 2x = financial stress risk."
          >
            <div className="summary-strip-label">Interest Coverage</div>
            <div
              className="summary-strip-val"
              style={{ color: ratioColor(interestCoverage, [5, 2]) }}
            >
              {interestCoverage !== null ? `${interestCoverage.toFixed(1)}x` : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
