'use client';

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

import type { FundamentalsSnapshot } from '@/lib/types';

interface Props {
  dividendHistory: Array<{ year: number; amount: number }>;
  fundamentals: FundamentalsSnapshot;
  currentClose?: number | null;
}

export function DividendHistory({ dividendHistory, fundamentals, currentClose }: Props) {
  const noDividend = dividendHistory.length === 0;

  if (noDividend) {
    return (
      <div className="card card--stack-base">
        <div className="card-header">
          <div className="card-title">Dividend History</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Annual dividend per share
          </div>
        </div>
        <div className="card-body">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 0',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                maxWidth: 380,
                lineHeight: 1.55,
              }}
            >
              Does not pay a dividend — typical for high-growth businesses
              reinvesting cash into expansion.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // sorted ascending by year (from yfinance groupby)
  const chartData = dividendHistory.map((d, i) => ({
    label: String(d.year),
    val:   d.amount,
    isFirst: i === 0,
    isUp:    i > 0 && d.amount >= dividendHistory[i - 1]!.amount,
  }));

  const last     = dividendHistory[dividendHistory.length - 1]!;
  const currYield =
    currentClose && currentClose > 0
      ? ((last.amount / currentClose) * 100).toFixed(2) + '%'
      : fundamentals.dividendYieldPct !== null
        ? fundamentals.dividendYieldPct.toFixed(2) + '%'
        : null;

  // Consecutive years of growth streak
  let streak = 0;
  for (let i = dividendHistory.length - 1; i > 0; i--) {
    if (dividendHistory[i]!.amount > dividendHistory[i - 1]!.amount) streak++;
    else break;
  }

  const { payoutRatioPct } = fundamentals;

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">
          Dividend History
          <InfoTip title="Dividend History">
            A dividend is cash a company pays its shareholders, usually each year.
            This shows the dividend per share over time — green bars are increases,
            red are cuts. Many companies pay no dividend and reinvest instead.
          </InfoTip>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Annual dividend per share · Green = increase · Red = cut
        </div>
      </div>
      <div className="card-body">
        <div className="chart-canvas-wrap chart-h-sm">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 200 }}>
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
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ fill: 'rgba(46,125,232,.05)' }}
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
                        Year {label}
                      </div>
                      <div
                        style={{
                          color: '#94A3B8',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                        }}
                      >
                        Dividend: ${Number(payload[0]?.value ?? 0).toFixed(2)} per share
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="val" name="Annual Dividend" radius={[3, 3, 0, 0]}>
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

        <div className="summary-strip">
          {currYield && (
            <div
              className="summary-strip-item"
              title="Dividend Yield % — Annual Dividend ÷ Current Stock Price × 100. Shows the income return as a percentage of price."
            >
              <div className="summary-strip-label">Current Yield</div>
              <div className="summary-strip-val" style={{ color: '#228B22' }}>
                {currYield}
              </div>
            </div>
          )}

          <div
            className="summary-strip-item"
            title="Annual Dividend per Share (DPS) — total dividend paid per share over the last 12 months."
          >
            <div className="summary-strip-label">Annual DPS</div>
            <div className="summary-strip-val">${last.amount.toFixed(2)}</div>
          </div>

          <div
            className="summary-strip-item"
            title="Dividend Growth Streak — consecutive years of dividend increases. 10+ years signals exceptional financial discipline."
          >
            <div className="summary-strip-label">Growth Streak</div>
            <div
              className="summary-strip-val"
              style={{ color: streak >= 5 ? '#228B22' : 'var(--text-primary)' }}
            >
              {streak} yrs
            </div>
          </div>

          {payoutRatioPct !== null && (
            <div
              className="summary-strip-item"
              title="Payout Ratio % — Dividends ÷ Net Income × 100. Below 60% = sustainable and room to grow · 60–80% = moderately high · Above 80% = potentially unsustainable."
            >
              <div className="summary-strip-label">Payout Ratio</div>
              <div
                className="summary-strip-val"
                style={{
                  color:
                    payoutRatioPct < 60
                      ? '#228B22'
                      : payoutRatioPct < 80
                        ? '#D4A017'
                        : '#B22222',
                }}
              >
                {payoutRatioPct.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
