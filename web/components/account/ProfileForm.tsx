'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfile } from '@/app/(app)/account/actions';
import { COUNTRIES } from '@/lib/countries';

interface ProfileFormProps {
  email: string;
  initialDisplayName: string;
  initialCountry: string;
  /**
   * Auto-fill suggestion (the visitor's edge-detected country) used ONLY when no
   * country is saved yet. It pre-selects the dropdown as a changeable default;
   * because the saved baseline is still empty, the form starts "dirty" so the user
   * can save the suggestion in one click. Ignored once a country is saved.
   */
  suggestedCountry?: string;
  /**
   * Country is fixed once a subscription exists (Stripe pins currency per
   * subscription — F3). Passed from the server based on subscription_status.
   */
  countryLocked: boolean;
}

export function ProfileForm({
  email,
  initialDisplayName,
  initialCountry,
  suggestedCountry = '',
  countryLocked,
}: ProfileFormProps) {
  // Pre-fill the dropdown with the saved country, or (if none) the detected
  // suggestion. The saved baseline below stays empty in the suggestion case, so
  // the suggested value reads as an unsaved change the user can Save immediately.
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [country, setCountry] = useState(initialCountry || suggestedCountry);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // The last-persisted values. Seeded from props, then advanced on each
  // successful save so `dirty` reflects "changed since last save" — otherwise it
  // would compare against the stale initial props forever, leaving the form
  // permanently "dirty" (Save never disables, the Saved confirmation never shows).
  const [baseName, setBaseName] = useState(initialDisplayName);
  const [baseCountry, setBaseCountry] = useState(initialCountry);

  const dirty =
    displayName.trim() !== baseName.trim() ||
    (!countryLocked && country !== baseCountry);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    // Persist via a server action: the cookie-bound client there is already
    // authenticated for this request, so the write can't race auth hydration the
    // way a cold browser client could (which silently no-op'd under RLS). Only
    // writable columns are sent; the server re-checks the country lock.
    const result = await updateProfile({
      displayName,
      country: countryLocked ? '' : country,
    });

    if (!result.ok) {
      setError(result.error ?? 'Could not save your changes. Please try again.');
      setLoading(false);
      return;
    }
    // Advance the persisted baseline to what we just wrote → form is no longer
    // dirty, Save disables, and the Saved confirmation shows.
    setBaseName(displayName);
    if (!countryLocked) setBaseCountry(country);
    setSaved(true);
    setLoading(false);
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Profile</h2>
      </div>
      <div className="card-body">
        <p className="mb-5 text-[12px] leading-relaxed text-[var(--text-muted)]">
          How you appear in MajorCycle. Your email is used for sign-in and account
          notices.
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-md">
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              type="text"
              autoComplete="name"
              maxLength={80}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setSaved(false);
              }}
              placeholder="Your name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} disabled readOnly />
            <p className="text-[11px] text-[var(--text-muted)]">
              Email can&apos;t be changed here yet — contact support@majorcycle.com
              if you need it updated.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="country">Country</Label>
            <select
              id="country"
              value={country}
              disabled={countryLocked}
              onChange={(e) => {
                setCountry(e.target.value);
                setSaved(false);
              }}
              className="w-full h-11 px-3.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-[13.5px] font-[var(--font-sans)] outline-none transition-all duration-150 hover:border-[var(--border-strong)] focus:border-[var(--brand-bright)] focus:ring-[3px] focus:ring-[var(--brand-bright)]/15 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">Select your country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            {countryLocked && (
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <Lock className="w-3 h-3 flex-shrink-0" strokeWidth={2} aria-hidden />
                Locked while you have an active subscription. Contact support to
                change it.
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 text-[12px] text-[var(--c-tier-5-ink)] bg-[var(--tint-tier-5)] border border-[var(--tint-tier-5-strong)] rounded-[var(--radius-sm)] px-3 py-2.5"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 mt-1">
            <Button type="submit" disabled={loading || !dirty}>
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
            {saved && !dirty && (
              <span
                role="status"
                className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--c-tier-2)]"
              >
                <CheckCircle2 className="w-4 h-4" strokeWidth={2} aria-hidden />
                Saved
              </span>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
