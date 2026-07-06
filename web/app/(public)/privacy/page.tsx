import type { Metadata } from 'next';
import { LegalDoc } from '@/components/LegalDoc';

export const metadata: Metadata = { title: 'Privacy Policy' };

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
          body: (
            <p>
              Account details you provide (email, and — if you choose — display name
              and country); authentication data when you sign in with Google;
              billing information handled by our payment processor; your analysis
              activity within the app; and standard technical data (such as log and
              device information) needed to operate and secure the Service.
            </p>
          ),
        },
        {
          heading: 'How we use it',
          body: (
            <p>
              To create and manage your account, provide the analysis features, take
              payment and manage your subscription, send you service and transactional
              emails, prevent abuse, and comply with our legal obligations. We do not
              sell your personal information.
            </p>
          ),
        },
        {
          heading: 'Service providers',
          body: (
            <p>
              We share data with the vendors that run the Service on our behalf:
              Supabase (database and authentication), Stripe (payments), Resend
              (email delivery), Vercel (hosting), and Cloudflare (DNS and email
              routing). Each processes data only to provide their service to us.
            </p>
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
              processing. To make a request, or to close your account, contact us and
              we will respond in line with applicable law.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Privacy questions or requests can be sent to{' '}
              <a href="mailto:support@majorcycle.com" className="text-[var(--brand-mid)] font-semibold hover:text-[var(--brand-bright)] transition-colors">support@majorcycle.com</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
