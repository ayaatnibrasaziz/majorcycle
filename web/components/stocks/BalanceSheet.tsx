'use client';

import { useState } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
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
import { CHART_RIGHT_AXIS_WIDTH, fmtCompact, makeCompactAxisFormatter } from '@/lib/format';

interface Props {
  balanceSheetAnnual?: FinancialStatement;
  fundamentals: FundamentalsSnapshot;
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

  // Clickable legend — toggles each series (cash / other / debt) on and off.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggleSeries = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  let chartData: { label: string; cash: number; other: number; debt: number | null }[] = [];

  if (hasChart) {
    const stmt   = balanceSheetAnnual!;
    const labels = [...stmt.labels].reverse(); // oldest → newest
    const assets = [...stmtVals(stmt, 'total_assets')].reverse();
    const cashA  = [...stmtVals(stmt, 'cash_and_cash_equivalents')].reverse();
    const cashB  = [...stmtVals(stmt, 'cash_cash_equivalents_and_short_term_investments')].reverse();
    const debt   = [...stmtVals(stmt, 'total_debt')].reverse();
    const cashVals = cashA.map((v, i) => v ?? cashB[i] ?? null);

    // Drop years with no balance-sheet data (null assets → empty bar), then keep
    // the most recent five years.
    chartData = labels
      .map((lbl, i) => ({ label: lbl, assets: assets[i] ?? null, cashVal: cashVals[i] ?? null, debt: debt[i] }))
      .filter((r): r is { label: string; assets: number; cashVal: number | null; debt: number | null } => r.assets !== null)
      .slice(-5)
      .map((r) => {
        const cashVal = r.cashVal ?? 0;
        // Plot raw currency values — the Y-axis adapts its unit to the company's
        // scale (M for small caps, B for large) so a small-cap's axis isn't all "$0B".
        return {
          label: toYearLabel(r.label),
          cash:  cashVal,
          other: Math.max(0, r.assets - cashVal),
          debt:  r.debt,
        };
      });
  }

  const totalCash = fundamentals.totalCash;
  const totalDebt = fundamentals.totalDebt;
  const netCash   = totalCash !== null && totalDebt !== null ? totalCash - totalDebt : null;
  const isNetCash = netCash !== null ? netCash >= 0 : null;
  const { currentRatio, debtToEquity, interestCoverage } = fundamentals;
  const currency = fundamentals.currency;

  // Banks & REITs structurally don't report Debt/Equity, Current Ratio or
  // Interest Coverage (no classified current assets/liabilities), so those pills
  // show "—". Caption it so a beginner reads the dashes as "not applicable" rather
  // than missing/broken data — mirrors the Scorecard's withheld-pillar note.
  const ratiosWithheld = debtToEquity === null && interestCoverage === null;

  // Largest value currently drawn — cash + other STACK, debt is a separate line.
  // Reacts to the legend toggles so the axis unit follows what's actually plotted
  // (e.g. Cash-only rescales to millions instead of staying on the billions scale).
  const axisMax = chartData.reduce((mx, r) => {
    const stacked = (hidden.has('cash') ? 0 : r.cash) + (hidden.has('other') ? 0 : r.other);
    const line = hidden.has('debt') || r.debt == null ? 0 : r.debt;
    return Math.max(mx, stacked, line);
  }, 0);

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">
          Balance Sheet Health
          <InfoTip title="Balance Sheet Health">
            A snapshot of what the company owns versus what it owes. &quot;Net cash&quot;
            means it holds more cash than debt (resilient); &quot;net debt&quot; means the
            reverse. Lower debt relative to equity generally means lower financial risk.
          </InfoTip>
        </div>
        {hasChart && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Bars = Assets · Line = Debt
          </div>
        )}
      </div>
      <div className="card-body">
        {hasChart && chartData.length > 0 && (
          <div className="chart-canvas-wrap chart-h-sm">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 200 }}>
              <ComposedChart
                data={chartData}
                margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
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
                  tickFormatter={makeCompactAxisFormatter(axisMax, currency)}
                  axisLine={false}
                  tickLine={false}
                  width={CHART_RIGHT_AXIS_WIDTH}
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
                            {p.name}: {fmtCompact(Number(p.value ?? 0), currency)}
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, fontFamily: 'Sora', paddingTop: 4, cursor: 'pointer' }}
                  iconSize={10}
                  onClick={(data) => {
                    const key = (data as { dataKey?: unknown }).dataKey;
                    if (typeof key === 'string') toggleSeries(key);
                  }}
                  formatter={(value, entry) => {
                    const key = (entry as { dataKey?: unknown }).dataKey;
                    const off = typeof key === 'string' && hidden.has(key);
                    // Only restyle hidden series; visible labels keep recharts'
                    // default series-coloured text.
                    return off ? (
                      <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        {value}
                      </span>
                    ) : (
                      <span>{value}</span>
                    );
                  }}
                />
                <Bar
                  dataKey="cash"
                  name="Cash & Equivalents"
                  stackId="assets"
                  fill="#228B22"
                  stroke="#006400"
                  strokeWidth={1.5}
                  radius={[0, 0, 0, 0]}
                  hide={hidden.has('cash')}
                />
                <Bar
                  dataKey="other"
                  name="Other Assets"
                  stackId="assets"
                  fill="#1E5CB3"
                  stroke="#1A3A6E"
                  strokeWidth={1}
                  radius={[3, 3, 0, 0]}
                  hide={hidden.has('other')}
                />
                <Line
                  dataKey="debt"
                  name="Total Debt"
                  type="monotone"
                  stroke="#B22222"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#B22222', stroke: 'white', strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                  hide={hidden.has('debt')}
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
              {netCash !== null ? fmtCompact(Math.abs(netCash), currency) : '—'}
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
        {ratiosWithheld && (
          <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-muted)' }}>
            Some ratios show &ldquo;—&rdquo; because banks &amp; REITs don&apos;t
            report them in the usual way (no classified current assets/liabilities).
          </div>
        )}
      </div>
    </div>
  );
}
