import type { Metadata } from 'next';
import { LegalDoc } from '@/components/LegalDoc';

export const metadata: Metadata = { title: 'Disclaimer' };

// BASELINE CONTENT — owner to review and, if needed, have checked against ASIC
// guidance before wide launch. Educational/informational posture per CLAUDE.md #24.
export default function DisclaimerPage() {
  return (
    <LegalDoc
      title="Disclaimer"
      updated="5 July 2026"
      intro={
        <p>
          MajorCycle is an educational and informational analysis tool. It is{' '}
          <strong className="text-[var(--text-primary)]">not financial advice</strong>{' '}
          and must not be relied on as a substitute for professional advice tailored
          to your personal circumstances.
        </p>
      }
      sections={[
        {
          heading: 'No financial advice',
          body: (
            <p>
              Nothing on MajorCycle — including the Major Cycle analysis, health and
              valuation scores, ratings (High Conviction, Constructive, Neutral,
              Cautious, Bearish), charts, or any other output — is a recommendation
              to buy, hold, or sell any security, or to adopt any investment
              strategy. We do not consider your objectives, financial situation, or
              needs. Our ratings reflect a quantitative model, not the judgement of a
              licensed adviser.
            </p>
          ),
        },
        {
          heading: 'Third-party data',
          body: (
            <p>
              Some information (including Wall Street analyst recommendations,
              fundamentals, and price history) is sourced from third parties and is
              displayed as-is. We do not guarantee its accuracy, completeness, or
              timeliness, and it may contain errors or be delayed. Analyst
              recommendations shown verbatim are the views of those third parties,
              not MajorCycle.
            </p>
          ),
        },
        {
          heading: 'No warranty',
          body: (
            <p>
              MajorCycle is provided on an &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; basis without warranties of any kind. Past performance
              and historical cycle patterns are not a reliable indicator of future
              results. Investing carries risk, including the loss of capital.
            </p>
          ),
        },
        {
          heading: 'Your responsibility',
          body: (
            <p>
              You are solely responsible for your own investment decisions. Always
              conduct your own independent due diligence and, where appropriate, seek
              advice from a licensed financial adviser, accountant, or other
              professional before acting.
            </p>
          ),
        },
        {
          heading: 'Jurisdiction',
          body: (
            <p>
              MajorCycle is operated from Australia. Content is general in nature and
              is not tailored to the laws or regulations of any particular
              jurisdiction. It is your responsibility to ensure your use of the
              service complies with the laws that apply to you.
            </p>
          ),
        },
      ]}
    />
  );
}
