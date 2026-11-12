'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendContact, type ContactState } from './actions';

const initialState: ContactState = { status: 'idle' };

/** Only reached when the call itself fails — the action's own errors come back as state. */
export const CONTACT_SEND_FAILED = {
  stale:
    'MajorCycle was updated while this page was open, so your message was not sent. Copy it, reload the page, then paste it back and press Send.',
  network: 'Your message could not be sent. Check your connection and press Send again.',
} as const;

/**
 * Next's `UnrecognizedActionError`, recognised by its NAME rather than by importing
 * `unstable_isUnrecognizedActionError` from `next/navigation`: this form is compiled into
 * the offline report too (via SupportDialog), and that import drags Next's server-variable
 * reads into a file a customer opens from disk — `assertNoServerCode()` refuses the build.
 */
function isStaleDeploy(err: unknown): boolean {
  return err instanceof Error && err.name === 'UnrecognizedActionError';
}

/**
 * The server action, wrapped so a FAILED CALL keeps the reader's message on screen.
 *
 * ⚠️ MAJORCYCLE-WEB-D (2026-09-25 → 11-08, 11 events): a Contact page opened before a
 * deploy posts an action id the new deployment does not know, the call throws, and
 * without this the form fell through to the error page and the message was lost. Vercel
 * prevents that only with Skew Protection, a Pro feature; on Hobby the reader's page is
 * the one place it can be caught. React clears a form after its action, so the typed
 * values are handed back exactly as the action's own errors do.
 */
async function sendOrExplain(prev: ContactState, formData: FormData): Promise<ContactState> {
  try {
    return await sendContact(prev, formData);
  } catch (err) {
    return {
      status: 'error',
      message: isStaleDeploy(err) ? CONTACT_SEND_FAILED.stale : CONTACT_SEND_FAILED.network,
      values: {
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        message: String(formData.get('message') ?? ''),
      },
    };
  }
}

/**
 * Also rendered inside the app, in the support dialog a dispute-locked reader opens
 * from a lock (see components/SupportDialog.tsx) — hence the props: a signed-in user
 * shouldn't retype what we already know.
 *
 * ⚠️ It ended with "← Back to sign in" until 2026-10-03 (beta review A-20) — odd on a
 * public page most visitors reach from the footer, and the page cannot tell who is
 * signed in without losing its prerendering (architecture.md §7.2c). The site's own
 * header and footer are the way on.
 */
export function ContactForm({
  defaultName = '',
  defaultEmail = '',
}: {
  defaultName?: string;
  defaultEmail?: string;
} = {}) {
  const [state, formAction, pending] = useActionState(sendOrExplain, initialState);

  if (state.status === 'success') {
    return (
      <div className="bg-gradient-to-br from-white to-[var(--brand-light)] border border-[var(--brand-light-border)] rounded-[var(--radius)] p-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-white shadow-[var(--shadow-md)] flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7 text-[var(--status-success)]" strokeWidth={2} />
        </div>
        <p className="text-[14px] text-[var(--text-primary)] leading-relaxed">
          Thanks — your message is on its way. We&apos;ll reply by email.
        </p>
      </div>
    );
  }

  if (state.status === 'unconfigured') {
    return (
      <div className="bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[var(--radius)] p-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-white shadow-[var(--shadow-md)] flex items-center justify-center mb-4">
          <Mail className="w-7 h-7 text-[var(--brand-mid)]" strokeWidth={2} />
        </div>
        <p className="text-[13.5px] text-[var(--text-primary)] leading-relaxed">
          The contact form isn&apos;t connected yet. Please email us directly at{' '}
          <a
            href="mailto:support@majorcycle.com"
            className="font-semibold text-[var(--brand-mid)] hover:text-[var(--brand-deep)] transition-colors"
          >
            support@majorcycle.com
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Honeypot — hidden from real users; bots that fill it are dropped. */}
      <div className="absolute w-px h-px -m-px overflow-hidden" aria-hidden="true">
        <label htmlFor="company">Company (leave blank)</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* maxLength on all three: the SERVER caps them too (audit 5A-143, where
          neither side did). A client attribute is a courtesy that stops the
          reader at the keyboard; it is never the control. */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          placeholder="Your name"
          defaultValue={state.values?.name ?? defaultName}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          defaultValue={state.values?.email ?? defaultEmail}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          placeholder="How can we help?"
          defaultValue={state.values?.message ?? ''}
          className="flex w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-[var(--shadow-sm)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mid)] focus-visible:border-[var(--brand-mid)] resize-y leading-relaxed"
        />
      </div>

      {state.status === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-2 text-[12px] text-[var(--status-danger-ink)] bg-[var(--status-danger-tint)] border border-[var(--status-danger-tint-strong)] rounded-[var(--radius-sm)] px-3 py-2.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
          <span className="leading-relaxed">{state.message}</span>
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full mt-1">
        {pending ? 'Sending…' : 'Send message'}
      </Button>

    </form>
  );
}
