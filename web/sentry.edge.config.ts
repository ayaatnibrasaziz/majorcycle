import * as Sentry from '@sentry/nextjs';

import { sharedOptions } from '@/lib/sentryOptions';

/**
 * Sentry, Edge runtime — `proxy.ts`, which is this site's middleware.
 *
 * ⚠️ Worth naming what runs here, because it is the most security-sensitive code in
 * the repo: the middleware mints the CSP nonce, checks the internal secret, reads
 * the session and issues the 401/402 refusals. An error thrown here is one a reader
 * meets as a broken page with no server log line of its own.
 *
 * Same options as the other two runtimes, for the same reason (11c-iv: the rule
 * existing while one consumer never receives it is this repo's most repeated
 * defect).
 */
Sentry.init({ ...sharedOptions });
