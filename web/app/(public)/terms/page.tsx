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
      updated="15 August 2026"
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
          // Added 2026-08-15 (legal audit, finding 5). "Acceptable use" below
          // forbids circumventing "usage limits" — a term we ENFORCE
          // (FREE_VIEW_DAILY_LIMIT = 25 in lib/freeViews.ts) and had never
          // stated. The Terms did not mention that a free account exists at all.
          // The free/premium split itself is the owner-agreed F3 Step 10 rule in
          // lib/entitlement.ts: the DATA is free, our ANALYSIS is paid.
          heading: 'Free accounts',
          body: (
            <p>
              A free account requires no payment method and gives you the price chart,
              the drawdown cycle overlay, and company fundamentals. Our own analysis —
              the Overall Rating, Health Score, the Verdict and scorecard, downloadable
              reports, and the screener — requires a subscription. Free accounts may
              open up to 25 new stocks per day. We may change these limits, and will
              not reduce them without notice.
            </p>
          ),
        },
        {
          heading: 'Trial and subscription',
          // Was ONE 60-word sentence hinging on a semicolon and carrying six
          // separate commitments — the clause a reader is most likely to be
          // checking before they hand over a card, and the hardest on the page to
          // read. Now four short sentences in one paragraph (owner's call: split
          // into three paragraphs first, which broke a single clause into three
          // visual blocks and made the page look longer than it is).
          // ⚠️ Every term is unchanged: 7 days free, payment method required
          // upfront, automatic conversion unless cancelled, monthly or annual,
          // regional price, renews until cancelled, cancellation effective at the
          // end of the current billing period. Nothing added, softened or dropped.
          body: (
            <p>
              Your first 7 days are free. A payment method is required to start the
              trial, and you are not charged during it. Unless you cancel before the
              trial ends, your subscription begins automatically on a monthly or
              annual plan, at the current price for your region, and renews each
              period until you cancel. You can cancel at any time, and cancellation
              takes effect at the end of your current billing period.
            </p>
          ),
        },
        {
          heading: 'Payment and refunds',
          // Grace sentence added 2026-08-15 (legal audit, finding 7). GRACE_DAYS = 3
          // in the Stripe webhook: a failed payment keeps access open for three days
          // with an email, then hard-locks. A real benefit that was undocumented —
          // and stating it also sets the expectation that access DOES end after.
          body: (
            <p>
              Subscription fees are billed in advance through our payment processor
              (Stripe). Except where required by law, fees are non-refundable and we
              do not provide partial refunds for unused time. If a payment fails we
              will email you and keep your access open for 3 days while you update
              your payment method; after that, paid features are paused until payment
              succeeds. Nothing here limits your rights under the Australian Consumer
              Law.
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
          // Added 2026-08-15 (legal audit, finding 6). There was no governing-law
          // or jurisdiction clause at all, on a product sold to US and Canadian
          // customers — only the Disclaimer said "operated from Australia". The
          // tax sentence exists because the live Stripe prices carry
          // `tax_behavior: "unspecified"`, which matters at the A$75,000 GST
          // registration threshold.
          //
          // ⚠️ OWNER INSTRUCTION, 2026-08-15: no ABN and no entity type here. The
          // audit's draft named both ("a sole trader registered with ABN …"); the
          // owner's call was to keep it general — a business in Australia. Do not
          // reinstate either without being asked. An ABN printed on a public page
          // is a fact about a real registry that has to be verified and kept
          // current, and nothing on this page depends on it.
          heading: 'Governing law',
          body: (
            <p>
              MajorCycle is operated by a business based in Australia. These terms are
              governed by the laws of Australia, and you and we submit to the
              non-exclusive jurisdiction of its courts. Nothing in this clause limits
              any right you have to bring proceedings in your own country of residence
              where the law gives you that right. Prices are shown inclusive of any
              taxes that apply; if tax obligations change, we will tell you before the
              change affects your next payment.
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
