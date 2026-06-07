'use client';

import { useState } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
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
  incomeStatementAnnual?: FinancialStatement;
  cashflowAnnual?: FinancialStatement;
}

type Period = 'quarterly' | 'annual';
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

function toYearLabel(dateStr: string): string {
  return `FY${new Date(dateStr + 'T00:00:00').getFullYear()}`;
}

function stmtVals(stmt: FinancialStatement | undefined, key: string): (number | null)[] {
  if (!stmt) return [];
  const raw = stmt[key];
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((v) => (typeof v === 'number' ? v : null));
}

// Align Free Cash Flow to the income-statement periods BY DATE, not by position.
// The cashflow statement can carry a different number of periods than the income
// statement (e.g. AAPL: 7 cashflow quarters vs 5 income quarters), so a purely
// positional match could silently label FCF against the wrong quarter.
function buildFcf(
  cashflow: FinancialStatement | undefined,
  targetLabels: string[],
): (number | null)[] {
  if (!cashflow?.labels?.length) return targetLabels.map(() => null);
  const vals = stmtVals(cashflow, 'free_cash_flow'); // index-aligned to cashflow.labels
  const byDate = new Map<string, number | null>();
  cashflow.labels.forEach((lbl, i) => byDate.set(lbl, vals[i] ?? null));
  return targetLabels.map((lbl) => byDate.get(lbl) ?? null);
}

export function QuarterlyFinancials({
  incomeStatementQuarterly,
  cashflowQuarterly,
  incomeStatementAnnual,
  cashflowAnnual,
}: Props) {
  const [mode, setMode]     = useState<Mode>('rev');
  const [period, setPeriod] = useState<Period>('quarterly');

  const hasQuarterly = !!incomeStatementQuarterly?.labels?.length;
  const hasAnnual    = !!incomeStatementAnnual?.labels?.length;

  if (!hasQuarterly && !hasAnnual) return null;

  // If only one period has data, lock to it regardless of state
  const activePeriod: Period = !hasQuarterly ? 'annual' : !hasAnnual ? 'quarterly' : period;

  // --- Quarterly arrays (oldest → newest) ---
  const qLabels = hasQuarterly ? [...incomeStatementQuarterly!.labels].reverse() : [];
  const qRev    = hasQuarterly ? [...stmtVals(incomeStatementQuarterly, 'total_revenue')].reverse()    : [];
  const qGp     = hasQuarterly ? [...stmtVals(incomeStatementQuarterly, 'gross_profit')].reverse()     : [];
  const qOp     = hasQuarterly ? [...stmtVals(incomeStatementQuarterly, 'operating_income')].reverse() : [];
  const qFcf    = buildFcf(cashflowQuarterly, qLabels);

  // --- Annual arrays (oldest → newest) ---
  const aLabels = hasAnnual ? [...incomeStatementAnnual!.labels].reverse() : [];
  const aRev    = hasAnnual ? [...stmtVals(incomeStatementAnnual, 'total_revenue')].reverse()    : [];
  const aGp     = hasAnnual ? [...stmtVals(incomeStatementAnnual, 'gross_profit')].reverse()     : [];
  const aOp     = hasAnnual ? [...stmtVals(incomeStatementAnnual, 'operating_income')].reverse() : [];
  const aFcf    = buildFcf(cashflowAnnual, aLabels);

  const isAnnual  = activePeriod === 'annual';
  const allLabels = isAnnual ? aLabels : qLabels;
  const modeData: Record<Mode, (number | null)[]> = isAnnual
    ? { rev: aRev, gp: aGp, op: aOp, fcf: aFcf }
    : { rev: qRev, gp: qGp, op: qOp, fcf: qFcf };

  // Pair each period with its value for the selected metric and drop periods
  // with no data (e.g. an oldest fiscal year yfinance reports as null) — those
  // would otherwise render as empty/zero bars.
  const paired = allLabels
    .map((label, i) => ({ label, val: modeData[mode][i] ?? null }))
    .filter((p): p is { label: string; val: number } => p.val !== null);

  // Quarterly: last 8 bars; Annual: show all years
  const n     = isAnnual ? paired.length : Math.min(8, paired.length);
  const shown = paired.slice(-n);

  const chartData = shown.map((p, i) => ({
    label:   isAnnual ? toYearLabel(p.label) : toQtrLabel(p.label),
    val:     p.val,
    isFirst: i === 0,
    isUp:    i > 0 && p.val >= shown[i - 1]!.val,
  }));

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">
          {isAnnual ? 'Annual' : 'Quarterly'} Financial Trends
          <InfoTip title="Financial Trends">
            The top-line story of the business over time: Revenue (total sales),
            Gross Profit (after the cost of goods), Operating Income (after running
            costs) and Free Cash Flow (cash left after investment). Rising bars =
            a growing business. Switch between quarterly and annual views.
          </InfoTip>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {hasQuarterly && hasAnnual && (
            <div className="period-toggle">
              {(['quarterly', 'annual'] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`period-btn${activePeriod === p ? ' active' : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === 'quarterly' ? 'Quarterly' : 'Annual'}
                </button>
              ))}
            </div>
          )}
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
      </div>
      <div className="card-body">
        <div className="chart-canvas-wrap chart-h-md">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 220 }}>
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
                  const row  = chartData.find((d) => d.label === label);
                  const prev = row ? chartData[chartData.indexOf(row) - 1] : null;
                  const pct =
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
                      {pct !== null && (
                        <div
                          style={{
                            color: pct >= 0 ? '#228B22' : '#B22222',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                          }}
                        >
                          {isAnnual ? 'YoY' : 'QoQ'}: {pct >= 0 ? '+' : ''}{pct}%
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
