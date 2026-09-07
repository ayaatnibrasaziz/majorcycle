/**
 * Keep personal data out of the logs.
 *
 * P9 (2026-09-07) audited every `console.*` line in the app against Stripe's
 * go-live checklist item "logs contain no card data or PII", which nothing here
 * had ever been read for. Card data is a non-question — Checkout is hosted, so a
 * card number never reaches this codebase — and 45 of our 47 log lines carry a
 * UUID, a Stripe object id or an error code rather than a person.
 *
 * The exception is the two places that log an UPSTREAM error body verbatim. We do
 * not control what Resend puts in a `validation_error` message, and the request it
 * is complaining about contains a real person's address. Production shows the line
 * firing for real (`sendBrandEmail: Resend send failed 422 {...}` from /account,
 * 2026-09-01), so this is a live path rather than a theoretical one.
 *
 * ⚠️ Redact rather than stop logging. That body is the only thing that says WHY a
 * customer's email did not arrive, and the owner cannot debug from the outside —
 * dropping it would trade a small privacy risk for a blind spot on a support path.
 * Everything except the address survives, which `e2e/log-redaction.spec.ts` asserts
 * as its load-bearing control.
 */

/**
 * Replace every email address in `text` with `[email redacted]`.
 *
 * Deliberately looser than the validator in `sendReferral`: this one is matching
 * text somebody else wrote, so it errs toward masking something that merely looks
 * like an address rather than letting a real one through (11g — where the string is
 * not yours, do not assume its shape). It still requires a dot-and-TLD after the
 * `@`, so a scoped package name or a bare handle is left alone; masking those would
 * remove the part of the message that names the failure.
 */
export function redactEmails(text: string): string {
  return text.replace(
    /[^\s"'<>()[\]{},;:]+@[^\s"'<>()[\]{},;:]+\.[A-Za-z]{2,}/g,
    '[email redacted]',
  );
}
