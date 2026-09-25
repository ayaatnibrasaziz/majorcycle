// NOT a client component — deliberately, since 2026-08-24.
//
// This table has no state, no effects and no event handlers. Its only claim on
// the client was a `useMemo` around the row build, and a memo is not
// interactivity: it caches a pure computation across re-renders that never
// happen here. The props arrive fixed from the server and nothing on the page
// changes them, so the memo saved nothing while the directive cost ~255 lines of
// client bundle and React's hydration pass over every row.
//
// The rows are now built directly in the render. Same function, same inputs, same
// output — the only thing removed is a cache for a recomputation that cannot occur.
//
// InfoTip stays a client component and hydrates on its own; a server component may
// render one.
//
// ⚠️ Must stay HOOK-FREE. ReportDocument renders this same component in the offline
// report, an esbuild bundle with no server (CLAUDE.md 11d). Hook-free works in both
// builds; a hook would be legal there and illegal here, and the report only fails
// when a customer opens it.
import type { FundamentalsSnapshot } from '@/lib/types';
import type { MedianTables } from '@/lib/medians.server';
import { buildKeyMetricsTable, type MetricCategory, type Verdict } from '@/lib/keyMetrics';
import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  fundamentals: FundamentalsSnapshot;
  industry: string | null;
  sector: string | null;
  market: string;
  medians: MedianTables;
}

// The rows -- which metrics, in which order, with which caps and which direction
// is stronger -- are defined ONCE in lib/keyMetrics.ts, shared with the peer
// medians, and so is building them (`buildKeyMetricsTable`): this file only draws.
// Moved there so e2e/key-metrics.spec.ts drives the REAL formatting and verdicts —
// a pure spec cannot render a component, and a test that re-implemented them would
// guard its own copy (11c-iii). Value is shown neutral; the colour lives on the *relative* columns, so
// green/red means "better/worse than peers", not an arbitrary fixed threshold --
// and a Risk row (`higherBetter: null`) carries no colour claim at all.

const CAT_PILL: Record<MetricCategory, string> = {
  Valuation: 'mt-cat-valuation',
  Profitability: 'mt-cat-profitability',
  Growth: 'mt-cat-growth',
  'Balance Sheet': 'mt-cat-balance',
  Shareholder: 'mt-cat-shareholder',
  Risk: 'mt-cat-risk',
};

const VERDICT_CLASS: Record<Verdict, string> = {
  better: 'km-cmp--better',
  worse: 'km-cmp--worse',
  neutral: 'km-cmp--neutral',
  inline: 'km-cmp--inline',
  na: 'km-cmp--na',
};

export function MetricsTable({ fundamentals, industry, sector, market, medians }: Props) {
  const { industryLabel, sectorLabel, marketLabel, rows } = buildKeyMetricsTable({
    fundamentals,
    industry,
    sector,
    market,
    medians,
  });

  if (rows.length === 0) {
    return (
      <div className="card card--stack-base">
        <div className="card-header"><h3 className="card-title">Key Metrics</h3></div>
        <div className="card-body">
          <div className="km-empty">No fundamental metrics available for this stock.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card card--stack-base km-card">
      <div className="card-header">
        <h3 className="card-title">
          Key Metrics
          <InfoTip title="Key Metrics">
            The headline numbers investors use, each compared with the typical
            company in the same industry, sector, and market (the &quot;median&quot; peer).
            Green means this stock is stronger than that peer, red means weaker,
            grey means about the same. The Risk rows are the exception: they show the gap
            in plain ink, because a more volatile or more heavily shorted share is not
            better or worse, only different. A &quot;—&quot; under Industry means there
            aren&apos;t enough close peers for a reliable comparison. Tap any metric name
            for a plain-English definition.
          </InfoTip>
        </h3>
        <div className="km-subtitle">How it compares with its peers</div>
      </div>
      <div className="card-body card-body--bleed">
        <div className="km-scroll">
          <table className="km-table" aria-label="Key metrics compared with industry, sector and market peers">

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
