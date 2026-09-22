import * as Sentry from '@sentry/nextjs';

import { BROWSER_NOISE, sharedOptions } from '@/lib/sentryOptions';

/**
 * Sentry, in the reader's browser.
 *
 * ⚠️ **THE FILENAME IS THE WHOLE POINT.** Sentry's older guides say
 * `sentry.client.config.ts`, and under Turbopack — which is Next 16's default
 * bundler and therefore ours — that file is **never imported**. It sits in the
 * repository, reads correctly, is picked up by `pnpm lint` and `pnpm typecheck`,
 * and does nothing at all. `instrumentation-client.ts` is the file Next itself
 * loads on the client, and it is the only one that works here.
 *
 * That failure is this repo's recurring shape: not a wrong line, an inert one
 * (11ak — a CSS selector that matches nothing is completely silent). There is no
 * error, no warning, and the only symptom is that browser errors stop arriving —
 * which is indistinguishable from a quiet week. `e2e/observability.spec.ts`
 * therefore asserts that this file exists and that `sentry.client.config.ts` does
 * NOT, because the wrong one being present is the state that looks like coverage.
 *
 * ⚠️ With no `NEXT_PUBLIC_SENTRY_DSN` this is a no-op and no network request is
 * made — see `lib/sentryOptions.ts`.
 */
Sentry.init({ ...sharedOptions, ignoreErrors: [...BROWSER_NOISE] });

/**
 * Report slow or failed client-side route changes.
 *
 * Exported because Next looks for it by name; it is a no-op while the SDK is
 * disabled. It is the one piece of navigation instrumentation kept with tracing
 * off, because it costs nothing until an error actually occurs.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
