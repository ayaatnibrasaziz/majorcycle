import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalDoc } from '@/components/LegalDoc';

export const metadata: Metadata = pageMetadata({
  path: '/terms',
  title: 'Terms of Service',
  description:
    'The terms governing your use of MajorCycle: accounts, the 7-day free trial, subscription billing and cancellation, acceptable use, and limitation of liability.',
});

// BASELINE CONTENT — owner to review/customise (and ideally have a professional
// check) before wide launch. Reflects the locked pricing/trial/refund decisions.
export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated="5 July 2026"
      intro={
        <p>
          These terms govern your use of MajorCycle (the &ldquo;Service&rdquo;). By
          creating an account or using the Service, you agree to them. If you do not
          agree, do not use the Service.
        </p>
      }
      sections={[
        {
          heading: 'The Service',
          body: (
            <p>
              MajorCycle provides educational and informational analysis of listed
              equities. It is not financial advice (see our{' '}
              <a href="/disclaimer">Disclaimer</a>).
              We may add, change, or remove features at any time.
            </p>
          ),
        },
        {
          heading: 'Accounts',
          body: (
            <p>
              You must provide accurate information and keep your login credentials
              secure. You are responsible for all activity under your account. You
              must be old enough to form a binding contract in your jurisdiction to
              use the Service.
            </p>
          ),
        },
        {
          heading: 'Trial and subscription',
          body: (
            <p>
              New accounts start a 7-day free trial. A valid payment method is
              required upfront; unless you cancel before the trial ends, the
              subscription automatically converts to a paid monthly or annual plan at
              the then-current price for your region, and renews until cancelled. You
              can cancel at any time, effective at the end of the current billing
              period.
            </p>
          ),
        },
        {
          heading: 'Payment and refunds',
          body: (
            <p>
              Subscription fees are billed in advance through our payment processor
              (Stripe). Except where required by law, fees are non-refundable and we
              do not provide partial refunds for unused time.
            </p>
          ),
        },
        {
          heading: 'Acceptable use',
          // Set as a list, not rewritten: every prohibition below is the same
          // text that was in the single sentence this replaces, with the commas
          // turned into bullets. A reader checking whether one specific thing is
          // allowed should not have to parse a four-clause sentence to find out.
          body: (
            <>
              <p>You may not:</p>
              <ul>
                <li>resell, redistribute, scrape, or bulk-export the Service or its data;</li>
                <li>attempt to circumvent access controls or usage limits;</li>
                <li>reverse-engineer the Service; or</li>
                <li>use it to build a competing product.</li>
              </ul>
            </>
          ),
        },
        {
          heading: 'Limitation of liability',
          body: (
            <p>
              To the maximum extent permitted by law, MajorCycle is not liable for any
              loss arising from your use of, or reliance on, the Service, including
              investment losses. Nothing in these terms excludes rights you may have
              under applicable consumer law that cannot lawfully be excluded.
            </p>
          ),
        },
        {
          heading: 'Changes and termination',
          body: (
            <p>
              We may update these terms from time to time; material changes will be
              notified in-app or by email. We may suspend or terminate access for
              breach of these terms. You may stop using the Service and cancel your
              subscription at any time.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Questions about these terms can be sent to{' '}
              <a href="mailto:support@majorcycle.com">support@majorcycle.com</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
