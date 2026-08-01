'use client';

import { useSyncExternalStore } from 'react';

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

// No-op store: the value is read once per mount and never changes afterwards, so
// there's nothing to subscribe to. useSyncExternalStore is the lint-clean, hydration-
// safe way to serve a server snapshot (fallback) then a client snapshot (device zone).
const noopSubscribe = () => () => {};

interface LocalDateProps {
  /** Absolute instant as an ISO 8601 string (e.g. a Stripe/DB timestamptz). */
  iso: string;
  /**
   * Server-rendered placeholder (formatted server-side, so first paint and no-JS
   * users aren't blank). Used as the SSR snapshot; the client swaps in the device zone.
   */
  fallback: string;
}

/**
 * Renders an absolute instant as a calendar date in the VIEWER'S DEVICE timezone
 * — the browser is the only place we truly know where the user is right now (their
 * OS timezone, which normally auto-tracks location). We deliberately do NOT derive
 * the zone from `profiles.country` (country drives currency, not date display).
 * See docs/coding-standards.md §16 "Date & timezone display".
 */
export function LocalDate({ iso, fallback }: LocalDateProps) {
  const text = useSyncExternalStore(
    noopSubscribe,
    // Client snapshot: device zone (toLocaleDateString with no explicit timeZone).
    () => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime())
        ? fallback
        : d.toLocaleDateString(undefined, DATE_OPTS);
    },
    // Server snapshot.
    () => fallback,
  );

  return <time dateTime={iso}>{text}</time>;
}
