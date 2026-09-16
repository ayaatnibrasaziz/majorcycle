import * as Sentry from '@sentry/nextjs';

import { sharedOptions } from '@/lib/sentryOptions';

/**
 * Sentry, Node runtime — route handlers, server components, server actions.
 *
 * Loaded by `instrumentation.ts`'s `register()`, which Next calls once per server
 * start. Everything that decides what may leave this machine is in
 * `lib/sentryOptions.ts`; this file exists because the SDK wants one entry point
 * per runtime, and it must stay a thin one — a second opinion about PII here is a
 * second copy of the rule (11c).
 *
 * ⚠️ With no `NEXT_PUBLIC_SENTRY_DSN` this is a no-op, by construction rather than
 * by luck: `sharedOptions.enabled` is the DSN's length.
 */
Sentry.init({ ...sharedOptions });
