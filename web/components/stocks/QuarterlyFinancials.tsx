'use client';

import { CANDLE, CHART_INK, CHART_TOOLTIP } from '@/lib/chartTheme';
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

import type { Currency, FinancialStatement } from '@/lib/types';
import { CHART_RIGHT_AXIS_WIDTH, fmtCompact, makeCompactAxisFormatter } from '@/lib/format';
import { INK } from '@/lib/ink';

interface Props {
  incomeStatementQuarterly?: FinancialStatement;
  cashflowQuarterly?: FinancialStatement;
  incomeStatementAnnual?: FinancialStatement;
  cashflowAnnual?: FinancialStatement;
  /** Revenue / net income / free cash flow are statement figures, so this is the
   *  REPORTING currency — pass `statementCurrency(fundamentals)`. */
  currency: Currency | string;
  /** From `reportingCurrencyNote(fundamentals)` — non-null only when the company
   *  reports in a currency other than the one its shares trade in. */
  currencyNote?: string | null;
}

type Period = 'quarterly' | 'annual';
type Mode = 'rev' | 'gp' | 'op' | 'fcf';

const MODE_LABELS: Record<Mode, string> = {
  rev: 'Revenue',
  gp:  'Gross Profit',
  op:  'Operating Income',
  fcf: 'Free Cash Flow',
};

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
  currency,
  currencyNote,
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

  // Largest plotted magnitude → drives a uniform-decimal Y-axis (single series).
  const axisMax = chartData.reduce((mx, d) => Math.max(mx, Math.abs(d.val)), 0);

  /*
   * The summary strip — added 2026-09-11 on the owner's approval. This was the
   * one card in the fundamentals run with nothing under its chart, so the reader
   * had to hover a bar to learn anything the chart did not already draw.
   *
   * ⚠️ Every figure here describes the PERIODS PLOTTED, not the whole history —
   * quarterly view shows the last eight, so a streak is counted inside that
   * window and the tooltips say so. Reporting a streak the chart cannot show
   * would be a number nobody could check against the thing beside it.
   *
   * ⚠️ The trend rule is EarningsHistory's, deliberately: latest against the
   * third period back, two outcomes, absent below three periods. Two cards on one
   * page should not mean two definitions of "accelerating" (CLAUDE.md 11c).
   */
  const latest = chartData[chartData.length - 1] ?? null;

  /*
   * ⚠️ QUARTER-ON-QUARTER IS THE WRONG COMPARISON FOR A SEASONAL BUSINESS, and
   * building this strip is what made that visible. The first version printed
   * Apple's latest quarter as −22.7% beside "▲ Accelerating" — both true, both
   * measuring something real, and together they read as a contradiction. The
   * December quarter is Apple's biggest every single year, so the March quarter
   * "falling" says nothing at all about the business.
   *
   * So a quarter is compared with the SAME QUARTER A YEAR EARLIER wherever four
   * quarters of room exist, which is how every filing reports it, and the tile is
   * labelled with whichever comparison it actually made. A card with too little
   * history says QoQ and means it.
   */
  const lag = !isAnnual && chartData.length > 4 ? 4 : 1;
  const against = chartData.length > lag ? chartData[chartData.length - 1 - lag]! : null;
  const changePct =
    latest && against && against.val !== 0
      ? +(((latest.val - against.val) / Math.abs(against.val)) * 100).toFixed(1)
      : null;
  const changeLabel = lag === 4 || isAnnual ? 'YoY' : 'QoQ';

  /*
   * The trend tile is EarningsHistory's rule — latest against the third period
   * back — and it appears on the ANNUAL view only, for the same seasonality
   * reason. "Accelerating" across three consecutive quarters of a seasonal series
   * is a statement about the calendar, not about the company.
   */
  const trending =
    isAnnual && chartData.length >= 3
      ? chartData[chartData.length - 1]!.val > chartData[chartData.length - 3]!.val
      : null;

  // Consecutive periods that beat the period `lag` back — so in quarterly view
  // this is the familiar "N quarters of year-on-year growth". Strictly greater,
  // so a flat period ends the run: the same rule the dividend streak uses,
  // because "unchanged" is not "growing".
  let streak = 0;
  for (let i = chartData.length - 1; i - lag >= 0; i--) {
    if (chartData[i]!.val > chartData[i - lag]!.val) streak++;
    else break;
  }

  const periodWord = isAnnual ? 'year' : 'quarter';
  const periodUnit = isAnnual ? 'yrs' : 'qtrs';

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <h3 className="card-title">
          {isAnnual ? 'Annual' : 'Quarterly'} Financial Trends
          <InfoTip title="Financial Trends">
            The top-line story of the business over time: Revenue (total sales),
            Gross Profit (after the cost of goods), Operating Income (after running
            costs) and Free Cash Flow (cash left after investment). Rising bars =
            a growing business. Switch between quarterly and annual views.
          </InfoTip>
        </h3>
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
        {chartData.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 0',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.55 }}>
              {`No ${MODE_LABELS[mode]} data reported for this company — try another metric above. (Some companies, such as banks, don't report every line.)`}
            </div>
          </div>
        ) : (
        <div className="chart-canvas-wrap chart-h-sm">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 0, height: 200 }}>
            <BarChart
              data={chartData}
              margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fill: CHART_INK, fontSize: 10, fontFamily: 'Sora' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                orientation="right"
                tick={{
                  fill: CHART_INK,
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                tickFormatter={makeCompactAxisFormatter(axisMax, currency)}
                axisLine={false}
                tickLine={false}
                width={CHART_RIGHT_AXIS_WIDTH}
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
                        background: CHART_TOOLTIP.bg,
                        border: `1px solid ${CHART_TOOLTIP.border}`,
                        borderRadius: 6,
                        padding: '8px 12px',
                      }}
                    >
                      <div
                        style={{
                          color: CHART_TOOLTIP.text,
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
                          color: CHART_TOOLTIP.muted,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                        }}
                      >
                        {MODE_LABELS[mode]}:{' '}
                        {row?.val != null ? fmtCompact(row.val, currency) : '—'}
                      </div>
                      {pct !== null && (
                        <div
                          style={{
                            color: pct >= 0 ? INK.up : INK.down,
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
                    stroke={row.isFirst ? '#1A3A6E' : row.isUp ? CANDLE.up : CANDLE.down}
                    strokeWidth={1.5}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
        {latest && (
          <div className="summary-strip">
            <div
              className="summary-strip-item"
              title={`Latest ${periodWord} — ${MODE_LABELS[mode]} for the most recent ${periodWord} reported. A measured figure, so it never changes colour.`}
            >
              <div className="summary-strip-label">Latest {periodWord}</div>
              <div className="summary-strip-val">{fmtCompact(latest.val, currency)}</div>
            </div>

            {changePct !== null && (
              <div
                className="summary-strip-item"
                title={
                  lag === 4
                    ? `Year on year — how ${MODE_LABELS[mode]} compares with the same quarter a year earlier. Quarters are compared like with like, because most businesses are seasonal and the quarter before is not a fair yardstick.`
                    : `${isAnnual ? 'Year on year' : 'Quarter on quarter'} — how ${MODE_LABELS[mode]} changed against the ${periodWord} before it.${isAnnual ? '' : ' There is not yet a full year of history to compare against.'}`
                }
              >
                <div className="summary-strip-label">{changeLabel}</div>
                <div
                  className="summary-strip-val"
                  style={{ color: changePct >= 0 ? INK.up : INK.down }}
                >
                  {changePct >= 0 ? '+' : ''}{changePct}%
                </div>
              </div>
            )}

            {trending !== null && (
              <div
                className="summary-strip-item"
                title={`Recent trend — compares the latest year with the one two years earlier. Accelerating = momentum is building. Shown on the annual view only: across consecutive quarters this would describe the calendar rather than the company.`}
              >
                <div className="summary-strip-label">Recent Trend</div>
                <div
                  className="summary-strip-val"
                  style={{ color: trending ? INK.up : INK.down }}
                >
                  {trending ? '▲ Accelerating' : '▼ Decelerating'}
                </div>
              </div>
            )}

            <div
              className="summary-strip-item"
              title={
                lag === 4
                  ? `Growth streak — consecutive quarters that beat the same quarter a year earlier, among the ${chartData.length} plotted above. A flat quarter ends the run. A count, so it carries no colour.`
                  : `Growth streak — consecutive ${periodUnit} of growth among the ${chartData.length} periods plotted above. A flat ${periodWord} ends the run. A count, so it carries no colour.`
              }
            >
              <div className="summary-strip-label">Growth Streak</div>
              <div className="summary-strip-val">
                {streak} {streak === 1 ? (isAnnual ? 'yr' : 'qtr') : periodUnit}
              </div>
            </div>
          </div>
        )}

        {currencyNote && (
          <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-muted)' }}>
            {currencyNote}
          </div>
        )}
      </div>
    </div>
  );
}
