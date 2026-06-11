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

import { fmtPerShare } from '@/lib/format';
import type { FundamentalsSnapshot } from '@/lib/types';

interface Props {
  dividendHistory: Array<{ year: number; amount: number }>;
  fundamentals: FundamentalsSnapshot;
  currentClose?: number | null;
}

export function DividendHistory({ dividendHistory, fundamentals, currentClose }: Props) {
  // The current calendar-year bucket only holds dividends paid SO FAR this year
  // (yfinance sums by calendar year), so it understates the year — it would
  // render as a fake "cut", reset the growth streak, and halve Annual DPS +
  // Current Yield. Drop it so every bar/stat reflects a COMPLETE year.
  const currentYear = new Date().getFullYear();
  const completeHistory = dividendHistory.filter((d) => d.year < currentYear);

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

  // A payer with dividends only in the current (incomplete) year — no complete
  // year to show yet. Treat as "history building" rather than misreport.
  if (completeHistory.length === 0) {
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 380, lineHeight: 1.55 }}>
              Dividend history is building — a full year of payments has not yet
              completed.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // sorted ascending by year (from yfinance groupby), current incomplete year dropped
  const chartData = completeHistory.map((d, i) => ({
    label: String(d.year),
    val:   d.amount,
    isFirst: i === 0,
    isUp:    i > 0 && d.amount >= completeHistory[i - 1]!.amount,
  }));

  const last     = completeHistory[completeHistory.length - 1]!;
  // Prefer the trailing yield off the last complete year's DPS and current price;
  // fall back to the stored snapshot yield only when we have no price.
  const yieldPct =
    currentClose && currentClose > 0
      ? (last.amount / currentClose) * 100
      : fundamentals.dividendYieldPct;
  const currYield = yieldPct !== null ? yieldPct.toFixed(2) + '%' : null;
  // A trailing yield this high almost always reflects a collapsed share price (a
  // dividend cut is usually coming) rather than income you can rely on. Show the
  // real number, but flag it and drop the reassuring green (S9 sanity-bounds).
  const DISTRESS_YIELD = 20;
  const yieldDistressed = yieldPct !== null && yieldPct > DISTRESS_YIELD;

  // Consecutive years of growth streak
  let streak = 0;
  for (let i = completeHistory.length - 1; i > 0; i--) {
    if (completeHistory[i]!.amount > completeHistory[i - 1]!.amount) streak++;
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
                tickFormatter={(v: number) => fmtPerShare(v, fundamentals.currency)}
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
                        Dividend: {fmtPerShare(Number(payload[0]?.value ?? 0), fundamentals.currency)} per share
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
              title={
                yieldDistressed
                  ? 'Dividend Yield % — Annual Dividend ÷ Current Stock Price × 100. Unusually high: this typically means the share price has fallen sharply and a dividend cut may be coming — not income you can rely on.'
                  : 'Dividend Yield % — Annual Dividend ÷ Current Stock Price × 100. Shows the income return as a percentage of price.'
              }
            >
              <div className="summary-strip-label">Current Yield</div>
              <div
                className="summary-strip-val"
                style={{ color: yieldDistressed ? '#D4A017' : '#228B22' }}
              >
                {currYield}{yieldDistressed ? ' ⚠' : ''}
              </div>
            </div>
          )}

          <div
            className="summary-strip-item"
            title="Annual Dividend per Share (DPS) — total dividend paid per share over the last 12 months."
          >
            <div className="summary-strip-label">Annual DPS</div>
            <div className="summary-strip-val">{fmtPerShare(last.amount, fundamentals.currency)}</div>
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
              title={
                Math.abs(payoutRatioPct) > 300
                  ? `Payout Ratio % — Dividends ÷ Net Income × 100. Actual ${payoutRatioPct.toFixed(1)}% (capped for display). A reading this far above 100% means the company is paying out far more than it earns — usually unsustainable.`
                  : 'Payout Ratio % — Dividends ÷ Net Income × 100. Below 60% = sustainable and room to grow · 60–80% = moderately high · Above 80% = potentially unsustainable.'
              }
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
                {Math.abs(payoutRatioPct) > 300
                  ? `${payoutRatioPct > 0 ? '>+' : '<−'}300%`
                  : `${payoutRatioPct.toFixed(1)}%`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
