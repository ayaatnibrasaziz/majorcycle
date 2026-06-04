import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  overview?: string | null;
}

/**
 * Company Overview card — first card of the Thesis section, below the Verdict.
 * Visual parity with `renderThesisSection()` in /reference/original-design.html
 * (lines 2647–2650). The reference's "Source: Yahoo Finance" subtitle is
 * intentionally omitted per design direction.
 *
 * Renders nothing when no overview text is available, so the section collapses
 * cleanly for tickers without a business summary.
 */
export function CompanyOverview({ overview }: Props) {
  const text = overview?.trim();
  if (!text) return null;

  return (
    <div className="card card--stack-base fade-in">
      <div className="card-header">
        <div className="card-title">
          Company Overview
          <InfoTip title="Company Overview">
            A plain-language summary of what the company does and how it makes
            money — useful background before reading the numbers below.
          </InfoTip>
        </div>
      </div>
      <div className="card-body">
        <p className="overview-text">{text}</p>
      </div>
    </div>
  );
}
