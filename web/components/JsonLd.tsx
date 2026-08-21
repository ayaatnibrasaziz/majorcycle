/**
 * A JSON-LD block.
 *
 * ⚠️ **The only `dangerouslySetInnerHTML` on the public site**, and it is
 * unavoidable: React escapes text children, which would corrupt the JSON into
 * something no parser accepts. So the escaping happens one layer up, in
 * `jsonLdScript()`, which turns every `<` into `\u003c` — the character that
 * could otherwise close this element early and let the rest of the payload be
 * parsed as HTML.
 *
 * ⚠️ **Never pass user input to this.** Everything it renders today is derived
 * from our own constants and the article registry. That is a property to keep,
 * not a coincidence to rely on.
 *
 * ⚠️ `type="application/ld+json"` is a DATA block, not a script: browsers do not
 * execute it, and the site's `script-src 'self'` policy does not need an
 * exception for it. Verified on the wire rather than assumed — a CSP violation
 * report is the sort of thing that goes unnoticed for months.
 */
export function JsonLd({ json }: { json: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
