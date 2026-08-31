/**
 * "Information only — not financial advice."
 *
 * ⚠️ This sentence is a COMPLIANCE CONTROL, not decoration. CLAUDE.md #4, #12 and
 * #24 require it visible without scrolling on any page carrying a rating, a score
 * or a signal, and its wording was written to be legally sufficient rather than
 * short. Trimming it is not a design decision.
 *
 * It lived inline in `LegalDoc.tsx` and was about to be typed a second time into
 * the Learn article template — which is the exact shape of every 11c incident in
 * CLAUDE.md, and the worst possible field for it. Two copies of a disclaimer do
 * not diverge loudly; one of them simply gets edited, and the other page keeps
 * making a slightly different legal claim while looking completely fine.
 *
 * So: one component, two consumers, no second copy of the words. If a third
 * surface needs the notice, it calls this — it does not retype the sentence.
 *
 * `className` carries only the caller's SPACING. The box itself (hairline border,
 * stripe fill, radius, padding) is fixed here on purpose, so the notice reads
 * identically on `/terms` and on an article: a reader who has learned to
 * recognise it should not have to re-learn it per page.
 *
 * On the fill rather than a brand-blue left bar: the legal contents rail already
 * uses `border-l-2` in --brand-mid to mean "the clause you are reading". Giving
 * the notice the same device would make one mark mean two things on one screen.
 */
export function LegalNotice({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-stripe)] px-4 py-3.5${
        className ? ` ${className}` : ''
      }`}
    >
      <p className="small">
        <strong>Information only — not financial advice.</strong> MajorCycle
        provides educational and informational analysis. It is not a licensed
        financial adviser, and nothing on this site is a recommendation to buy,
        hold, or sell any security.
      </p>
    </div>
  );
}
