'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendContact, type ContactState } from './actions';

const initialState: ContactState = { status: 'idle' };

export function ContactForm() {
  const [state, formAction, pending] = useActionState(sendContact, initialState);

  if (state.status === 'success') {
    return (
      <div className="bg-gradient-to-br from-white to-[var(--brand-light)] border border-[#bfdbfe] rounded-[var(--radius)] p-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-white shadow-[var(--shadow-md)] flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7 text-[var(--c-tier-2)]" strokeWidth={2} />
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
            className="font-semibold text-[var(--brand-mid)] hover:text-[var(--brand-bright)] transition-colors"
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" required minLength={2} placeholder="Your name" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          rows={5}
          placeholder="How can we help?"
          className="flex w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-[var(--shadow-sm)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mid)] focus-visible:border-[var(--brand-mid)] resize-y leading-relaxed"
        />
      </div>

      {state.status === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-2 text-[12px] text-[var(--c-tier-5-ink)] bg-[var(--tint-tier-5)] border border-[var(--tint-tier-5-strong)] rounded-[var(--radius-sm)] px-3 py-2.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
          <span className="leading-relaxed">{state.message}</span>
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full mt-1">
        {pending ? 'Sending…' : 'Send message'}
      </Button>

      <p className="mt-3 pt-5 border-t border-[var(--border)] text-center text-[13px] text-[var(--text-secondary)]">
        <Link
          href="/login"
          className="text-[var(--brand-mid)] font-semibold hover:text-[var(--brand-bright)] transition-colors"
        >
          ← Back to sign in
        </Link>
      </p>
    </form>
  );
}
