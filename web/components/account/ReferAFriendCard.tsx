'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendReferral } from '@/app/(app)/account/actions';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MAX = 300;

/**
 * Refer-a-friend card (F2 Part C). Sends a one-off branded invite from the
 * signed-in member. The name is prefilled from their profile display name but
 * required + editable, so every invite email is personal (see the server action
 * for the rate-limit / self-referral / duplicate guards). Includes a hidden
 * honeypot field to catch bots.
 */
export function ReferAFriendCard({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [friendEmail, setFriendEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSentTo(null);

    const trimmedName = name.trim();
    const trimmedEmail = friendEmail.trim();
    if (!trimmedName) {
      setError('Please add your name so your friend knows who invited them.');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address for your friend.');
      return;
    }

    setLoading(true);
    const result = await sendReferral({
      friendEmail: trimmedEmail,
      referrerName: trimmedName,
      message,
      website,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not send the invite. Please try again.');
      return;
    }
    // Success: keep the name (they'll likely invite again), clear the rest.
    setSentTo(trimmedEmail);
    setFriendEmail('');
    setMessage('');
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Refer a friend</h2>
      </div>
      <div className="card-body">
        <p className="mb-5 flex items-start gap-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
          <Gift className="mt-px h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} aria-hidden />
          Know someone who&apos;d find MajorCycle useful? Send them a personal invite —
          they&apos;ll get a 7-day free trial.
        </p>

        {/* noValidate: our own EMAIL_RE check drives the (brand-styled) error copy,
            so the browser's native email-field bubble doesn't pre-empt submit. */}
        <form noValidate onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="referrerName">Your name</Label>
            <Input
              id="referrerName"
              type="text"
              autoComplete="name"
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSentTo(null);
              }}
              placeholder="Your name"
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Shown in the invite so your friend knows it&apos;s from you.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="friendEmail">Friend&apos;s email</Label>
            <Input
              id="friendEmail"
              type="email"
              autoComplete="off"
              maxLength={254}
              value={friendEmail}
              onChange={(e) => {
                setFriendEmail(e.target.value);
                setSentTo(null);
              }}
              placeholder="friend@example.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="referralMessage">Personal note (optional)</Label>
            <textarea
              id="referralMessage"
              maxLength={MESSAGE_MAX}
              rows={3}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setSentTo(null);
              }}
              placeholder="Add a short note…"
              className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-[13.5px] font-[var(--font-sans)] text-[var(--text-primary)] outline-none transition-all duration-150 hover:border-[var(--border-strong)] focus:border-[var(--brand-bright)] focus:ring-[3px] focus:ring-[var(--brand-bright)]/15"
            />
            <p className="text-right text-[11px] text-[var(--text-muted)]">
              {message.length}/{MESSAGE_MAX}
            </p>
          </div>

          {/* Honeypot: hidden from users (and screen readers); bots fill it. */}
          <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--tint-tier-5-strong)] bg-[var(--tint-tier-5)] px-3 py-2.5 text-[12px] text-[var(--c-tier-5-ink)]"
            >
              <AlertCircle className="mt-px h-4 w-4 flex-shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="mt-1 flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send invite'}
            </Button>
            {sentTo && (
              <span
                role="status"
                className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--c-tier-2)]"
              >
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                Invite sent to {sentTo}
              </span>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
