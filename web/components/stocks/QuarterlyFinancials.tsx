'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { FinancialStatement } from '@/lib/types';

interface Props {
  incomeStatementQuarterly?: FinancialStatement;
  cashflowQuarterly?: FinancialStatement;
}

type Mode = 'rev' | 'gp' | 'op' | 'fcf';

const MODE_LABELS: Record<Mode, string> = {
  rev: 'Revenue',
  gp:  'Gross Profit',
  op:  'Operating Income',
  fcf: 'Free Cash Flow',
};

function fmtB(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

function toQtrLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q}'${String(d.getFullYear()).slice(2)}`;
}

function stmtVals(stmt: FinancialStatement | undefined, key: string): (number | null)[] {
  if (!stmt) return [];
  const raw = stmt[key];
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((v) => (typeof v === 'number' ? v : null));
}

export function QuarterlyFinancials({ incomeStatementQuarterly, cashflowQuarterly }: Props) {
  const [mode, setMode] = useState<Mode>('rev');

  if (!incomeStatementQuarterly?.labels?.length) return null;

  // yfinance gives newest-first — reverse to oldest→newest for the chart
  const allLabels = [...incomeStatementQuarterly.labels].reverse();
  const allRev    = [...stmtVals(incomeStatementQuarterly, 'total_revenue')].reverse();
  const allGp     = [...stmtVals(incomeStatementQuarterly, 'gross_profit')].reverse();
  const allOp     = [...stmtVals(incomeStatementQuarterly, 'operating_income')].reverse();

  // FCF lives in cashflow statement; align length to income statement
  let allFcf: (number | null)[] = [];
  if (cashflowQuarterly?.labels?.length) {
    const raw = [...stmtVals(cashflowQuarterly, 'free_cash_flow')].reverse();
    // Trim or pad to match income statement length
    while (raw.length < allLabels.length) raw.unshift(null);
    allFcf = raw.slice(raw.length - allLabels.length);
  }

  const modeData: Record<Mode, (number | null)[]> = {
    rev: allRev,
    gp:  allGp,
    op:  allOp,
    fcf: allFcf,
  };

  // Last 8 quarters
  const n      = Math.min(8, allLabels.length);
  const labels = allLabels.slice(-n);
  const vals   = modeData[mode].slice(-n);

  const chartData = labels.map((label, i) => ({
    label: toQtrLabel(label),
    val:   vals[i],
    isFirst: i === 0,
    isUp:    i > 0 && vals[i] !== null && vals[i - 1] !== null && (vals[i] as number) >= (vals[i - 1] as number),
  }));

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">Quarterly Financial Trends</div>
        <div className="fin-tabs">
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`fin-tab${mode === m ? ' active' : ''}`}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body">
        <div className="chart-canvas-wrap chart-h-md">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
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
                tickFormatter={(v: number) => fmtB(v)}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                cursor={{ fill: 'rgba(46,125,232,.05)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = chartData.find((d) => d.label === label);
                  const prev = row
                    ? chartData[chartData.indexOf(row) - 1]
                    : null;
                  const qoq =
                    row?.val !== null &&
                    prev?.val !== null &&
                    prev?.val !== undefined &&
                    prev.val !== 0
                      ? +(
                          (((row?.val ?? 0) - (prev.val ?? 0)) /
                            Math.abs(prev.val ?? 1)) *
                          100
                        ).toFixed(1)
                      : null;
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
                      <div
                        style={{
                          color: '#94A3B8',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                        }}
                      >
                        {MODE_LABELS[mode]}:{' '}
                        {row?.val != null ? fmtB(row.val) : '—'}
                      </div>
                      {qoq !== null && (
                        <div
                          style={{
                            color: qoq >= 0 ? '#228B22' : '#B22222',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                          }}
                        >
                          QoQ: {qoq >= 0 ? '+' : ''}
                          {qoq}%
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Bar dataKey="val" name={MODE_LABELS[mode]} radius={[3, 3, 0, 0]}>
                {chartData.map((row, idx) => (
                  <Cell
                    key={idx}
                    fill={row.isFirst ? '#1E5CB3' : row.isUp ? '#228B22' : '#B22222'}
                    stroke={row.isFirst ? '#1A3A6E' : row.isUp ? '#006400' : '#8B0000'}
                    strokeWidth={1.5}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
