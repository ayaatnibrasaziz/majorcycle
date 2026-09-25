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

/**
 * Replace anything shaped like a CREDENTIAL — added with Layer H2, 2026-09-16.
 *
 * ⚠️ **The question that produced this was "what is the worst thing that could end
 * up in a string we forward?", and the answer was already in the building.** Every
 * Supabase key is a JWT — the `anon` key, the `service_role` key, and every signed-in
 * reader's own session token all begin `eyJ`. A console line is a Vercel log; an
 * error sent to Sentry leaves the building entirely. Neither should ever be able to
 * carry one.
 *
 * Nothing has been observed doing so, and that is the point: the routes this could
 * arrive by are the ones nobody controls — an upstream error body that echoes the
 * request it rejected, a stack frame holding a local variable, a breadcrumb built
 * from a URL. `redactEmails` already exists because Resend put a real address in a
 * message we forward (5A-163); this is the same argument about a worse value.
 *
 * ⚠️ **Deliberately NARROW.** Each pattern is long and distinctive enough that a
 * match is a credential rather than prose, because over-masking destroys the part of
 * the message that names the failure — which `log-redaction.spec.ts` holds as its
 * load-bearing control and which applies here unchanged.
 */
export function redactSecrets(text: string): string {
  return (
    text
      // A JWT: three base64url segments, the first of which always starts `eyJ`
      // because it encodes `{"`. Supabase's anon key, its service_role key and every
      // user session token are all this shape.
      .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)?/g, '[token redacted]')
      // Stripe secret, restricted, publishable and webhook-signing keys. The
      // publishable one is not a secret, but it is no use in a crash report either.
      .replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}/g, '[stripe key redacted]')
      .replace(/\bwhsec_[A-Za-z0-9+/=_-]{10,}/g, '[stripe key redacted]')
      // Supabase's NEW keys are not JWTs, so the first rule cannot see them. The
      // service-role key is being replaced by an `sb_secret_…` key (2026-09-25,
      // after the old one leaked through a CI artifact); without this line the
      // replacement would pass every log and crash report unmasked.
      .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}/g, '[supabase key redacted]')
      // An Authorization header value, wherever one has been stringified.
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, 'Bearer [redacted]')
  );
}

/**
 * Both, in the one order that works.
 *
 * ⚠️ Secrets FIRST. A JWT's payload can contain an email, and masking the address
 * first would leave `eyJ…[email redacted]…` — a string that no longer matches the
 * token pattern and still carries most of a credential. Order is load-bearing here,
 * which is why there is one function rather than two calls at each site (11c).
 */
export function redactSensitive(text: string): string {
  return redactEmails(redactSecrets(text));
}
