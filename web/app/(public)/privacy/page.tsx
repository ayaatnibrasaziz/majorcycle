import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { SENTRY_DSN } from '@/lib/sentryOptions';
import { CAPTCHA_REQUIRED } from '@/lib/turnstile';
import { LegalDoc } from '@/components/LegalDoc';

export const metadata: Metadata = pageMetadata({
  path: '/privacy',
  title: 'Privacy Policy',
  description:
    'What personal information MajorCycle collects, how it is used, who processes it, how long it is kept, and the rights and choices you have.',
});

// BASELINE CONTENT — owner to review/customise before wide launch. Describes the
// data actually handled by the current stack (Supabase, Stripe, Resend, Vercel).
export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      // ⚠️ Conditional for the same reason as the Sentry recipient line below, and
      // it is worth the odd look: a policy whose text changed under a reader while
      // the date says otherwise is the thing an "updated" date exists to prevent.
      // The two move together or neither does.
      updated={
        CAPTCHA_REQUIRED ? '22 September 2026' : SENTRY_DSN ? '16 September 2026' : '15 August 2026'
      }
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
                <li>your analysis activity within the app;</li>
                <li>
                  standard technical data (such as log and device information) needed
                  to operate and secure the Service; and
                </li>
                {/* Added 2026-08-15 (legal audit, finding 1). Refer-a-Friend takes
                    a third party's email and message, stores both in `referrals`,
                    and emails that person — the only personal information we hold
                    about someone who has never visited the site. APP 5 requires
                    telling an individual when their information is collected from
                    someone else; APP 3.6 governs collecting it at all. */}
                <li>
                  an email address and optional message you supply when you refer a
                  friend — we use these once to send that person your invitation, and
                  we tell them who referred them.
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
                {/* "and site performance measurement" added 2026-09-07 (P9, 5A-006),
                    the same day `<SpeedInsights />` went into the root layout. Vercel was
                    already a listed processor, so this adds no RECIPIENT — but it widens
                    the PURPOSE from hosting to hosting plus measurement, and APP 6 is
                    about purpose. Precedent: the legal audit's finding 4 added Google to
                    this list the day Google Identity Services started loading.
                    ⚠️ The Cookies clause below is deliberately NOT touched, and that was
                    verified rather than assumed: the package's own source contains no
                    `document.cookie`, no `localStorage`, no `sessionStorage` and no
                    `navigator.userAgent` read. If that ever stops being true, this
                    paragraph and the cookie clause both have to move (11c-v: a sentence
                    stating a fact IS a copy of that fact). */}
                <li>
                  <strong>Vercel</strong> — hosting and site performance measurement
                </li>
                {/* ✅ Verified in the Cloudflare dashboard 2026-08-15: DNS Setup
                    "Full" (12 records, all DNS-only — Cloudflare is authoritative
                    DNS and registrar, and does NOT proxy site traffic), and Email
                    Routing is Enabled with two active rules forwarding
                    support@ and security@. Both halves of this line are true. */}
                {/* ⚠️ The Turnstile half is CONDITIONAL ON THE SITE KEY, for the same
                    reason as the Sentry line below: the check sends Cloudflare
                    signals about the visitor's browser and their IP address, so it
                    makes Cloudflare a recipient the moment it is on — and only then.
                    NEXT_PUBLIC_ vars are baked at build time and this page is
                    prerendered, so the disclosure and the check ship in one deploy. */}
                <li>
                  <strong>Cloudflare</strong> — DNS and email routing
                  {CAPTCHA_REQUIRED ? (
                    <>
                      , and a security check (Turnstile) on the sign-in, sign-up and
                      password pages that tells people apart from automated abuse. To do
                      that it receives your IP address and technical signals from your
                      browser; it does not receive your email address or password
                    </>
                  ) : null}
                </li>
                {/* Added 2026-08-15 (legal audit, finding 4). The collection
                    clause already acknowledged Google sign-in, but Google was
                    absent from the list that actually discharges APP 6 / APP 8.
                    `GoogleSignIn.tsx` loads Google Identity Services on /login
                    and /signup, so Google is a live recipient. */}
                <li>
                  <strong>Google</strong> — optional Google Sign-In. If you choose it,
                  Google confirms your identity to us and receives the fact that you
                  signed in; we never receive your Google password.
                </li>
                {/* Added with Layer H2, 2026-09-16 — error monitoring.
                    ⚠️ **CONDITIONAL ON THE DSN, AND THAT IS THE POINT.** Sentry is a
                    RECIPIENT of personal information the moment it is switched on, so
                    APP 6 and APP 8 need it named — and the ordering trap is real in
                    both directions: name it while monitoring is off and the policy
                    describes a disclosure that is not happening; forget to name it
                    when the DSN is set and the policy is a false statement about what
                    we do, which is 11c-v exactly (a sentence stating a fact IS a copy
                    of that fact, and prose is where copies go to drift unnoticed).
                    Tying the line to `NEXT_PUBLIC_SENTRY_DSN` removes the question:
                    Vercel bakes NEXT_PUBLIC_ vars at BUILD time and this page is
                    prerendered, so the disclosure and the feature ship in the same
                    deploy and cannot be out of step. A trap that depends on a human
                    remembering is one worth making structural (11o).
                    ⚠️ What actually reaches them is deliberately narrow — no cookies,
                    no headers, no IP address, no session replay — and `lib/sentryOptions.ts`
                    is where that is enforced rather than merely intended. */}
                {SENTRY_DSN ? (
                  <li>
                    <strong>Sentry</strong> — error monitoring. When something goes wrong
                    we send a technical report of the failure: what broke, on which page,
                    and the account identifier it happened to. We do not send your name,
                    your email address, your IP address, the contents of your session, or
                    any recording of your screen.
                  </li>
                ) : null}
              </ul>
              <p>
                Each processes data only to provide their service to us, under
                contract.
              </p>
              {/* Added 2026-08-15 (legal audit, finding 2) — APP 8, cross-border
                  disclosure. Verified live: the Supabase project and the Resend
                  account are both us-east-1; Stripe and Vercel are US-based. The
                  business is Australian and nothing anywhere said data leaves
                  Australia. ⚠️ CLAUDE.md 11n — `us-east-1` had been written down
                  correctly TWICE in architecture.md as a LATENCY fact, and nobody
                  had connected it to jurisdiction. */}
              <p>
                <strong>Where your information is stored.</strong> These providers
                host and process data outside Australia, principally in the United
                States. By using the Service you agree to your personal information
                being disclosed to these overseas recipients. We take reasonable steps
                to ensure they handle it consistently with this policy, but Australian
                Privacy Principle 8.1 may not apply to them and you may not be able to
                seek redress under the Privacy Act 1988 in respect of their handling.
              </p>
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
          // Second paragraph added 2026-08-15 (legal audit, finding 3). The clause
          // above implied deletion is immediate and total; two things in the real
          // system say otherwise, and both are deliberate:
          //   • deletion is a 30-day SCHEDULED purge (ACCOUNT_DELETION_GRACE_DAYS),
          //     recoverable by signing back in during the window;
          //   • `trial_tombstones` keeps a SHA-256 hash of the email FOREVER, on
          //     purpose and deliberately not a foreign key, so a purged account
          //     cannot farm a second free trial.
          // The hash is strongly pseudonymised and defensible — but retaining
          // anything derived from a deleted user's email has to be stated.
          body: (
            <>
              <p>
                We keep your personal information for as long as your account is active
                and as needed to provide the Service, then for any period required to
                meet legal, tax, or accounting obligations, after which it is deleted or
                anonymised.
              </p>
              <p>
                If you ask us to delete your account, we schedule it and permanently
                delete it after 30 days — you can cancel during that window by signing
                back in. After deletion we retain a one-way cryptographic hash of your
                email address, which cannot be reversed to identify you, solely to
                enforce our one-free-trial-per-person limit. We also keep billing
                records for as long as tax law requires.
              </p>
            </>
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
