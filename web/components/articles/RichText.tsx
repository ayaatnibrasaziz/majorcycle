import type { RichPart } from '@/lib/articles';

/**
 * The one renderer for a `RichPart[]`.
 *
 * `lib/articles.ts` may not import React (it reaches the middleware bundle via
 * `lib/seo.ts`), so an article's deck and finding are stored as segments. This
 * is where they become markup, and it is deliberately the ONLY place — a second
 * renderer would be free to disagree about what `figure` means, which is the
 * export-parity defect in miniature (CLAUDE.md 11c iii).
 *
 * ⚠️ `figure` is a number, not merely bold text. It is set in the mono face with
 * `tabular-nums` so a column of findings down the index lines up on the digits;
 * rendering it as `<strong>` would look almost right and quietly break that.
 */
export function RichText({ parts }: { parts: readonly RichPart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') return <span key={i}>{part}</span>;
        if ('strong' in part) return <strong key={i}>{part.strong}</strong>;
        return (
          <b key={i} className="art-fig">
            {part.figure}
          </b>
        );
      })}
    </>
  );
}
