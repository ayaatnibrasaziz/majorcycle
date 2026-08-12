import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalDoc } from '@/components/LegalDoc';

export const metadata: Metadata = pageMetadata({
  path: '/privacy',
  title: 'Privacy Policy',
  description:
    'What personal information MajorCycle collects, how it is used, which service providers process it, how long it is kept, and the choices and rights you have.',
});

// BASELINE CONTENT — owner to review/customise before wide launch. Describes the
// data actually handled by the current stack (Supabase, Stripe, Resend, Vercel).
export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="5 July 2026"
      intro={
        <p>
          This policy explains what personal information MajorCycle collects, how we
          use it, and the choices you have. We aim to collect only what we need to
          run the Service.
        </p>
      }
      sections={[
        {
          heading: 'Information we collect',
          // The three clauses below were single sentences carrying five and six
          // semicolon-separated items. Set as lists, with the items and their
          // wording unchanged — the only additions are the lead-in lines the
          // grammar needs ("We collect:", "We use your information to:"). What
          // the policy SAYS is untouched; a privacy clause a reader has to
          // re-read to count is a presentation failure, not a drafting one.
          body: (
            <>
              <p>We collect:</p>
              <ul>
                <li>
                  account details you provide (email, and — if you choose — display
                  name and country);
                </li>
                <li>authentication data when you sign in with Google;</li>
                <li>billing information handled by our payment processor;</li>
                <li>your analysis activity within the app; and</li>
                <li>
                  standard technical data (such as log and device information) needed
                  to operate and secure the Service.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: 'How we use it',
          body: (
            <>
              <p>We use your information to:</p>
              <ul>
                <li>create and manage your account;</li>
                <li>provide the analysis features;</li>
                <li>take payment and manage your subscription;</li>
                <li>send you service and transactional emails;</li>
                <li>prevent abuse; and</li>
                <li>comply with our legal obligations.</li>
              </ul>
              <p>We do not sell your personal information.</p>
            </>
          ),
        },
        {
          heading: 'Service providers',
          body: (
            <>
              <p>
                We share data with the vendors that run the Service on our behalf:
              </p>
              <ul>
                <li>
                  <strong>Supabase</strong> — database and authentication
                </li>
                <li>
                  <strong>Stripe</strong> — payments
                </li>
                <li>
                  <strong>Resend</strong> — email delivery
                </li>
                <li>
                  <strong>Vercel</strong> — hosting
                </li>
                <li>
                  <strong>Cloudflare</strong> — DNS and email routing
                </li>
              </ul>
              <p>Each processes data only to provide their service to us.</p>
            </>
          ),
        },
        {
          heading: 'Cookies',
          body: (
            <p>
              We use cookies that are necessary to keep you signed in and to secure
              the Service (including the authentication session). We do not use them
              to build advertising profiles.
            </p>
          ),
        },
        {
          heading: 'Data retention',
          body: (
            <p>
              We keep your personal information for as long as your account is active
              and as needed to provide the Service, then for any period required to
              meet legal, tax, or accounting obligations, after which it is deleted or
              anonymised.
            </p>
          ),
        },
        {
          heading: 'Your rights',
          body: (
            <p>
              Depending on where you live, you may have rights to access, correct,
              or delete your personal information, or to object to certain
              processing. To make a request, or to close your account,{' '}
              <a href="/contact">contact us</a> and we will respond in line with
              applicable law.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Privacy questions or requests can be sent to{' '}
              <a href="mailto:support@majorcycle.com">support@majorcycle.com</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
