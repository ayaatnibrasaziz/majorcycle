import Link from 'next/link';

export interface LegalSection {
  heading: string;
  body: React.ReactNode;
}

interface LegalDocProps {
  title: string;
  /** Human-readable date, e.g. "5 July 2026". */
  updated: string;
  intro?: React.ReactNode;
  sections: LegalSection[];
}

/**
 * Shared chrome for the static legal pages (/disclaimer, /terms, /privacy).
 * Renders inside the public layout's centred column, styled to match AuthCard so
 * the pages sit visually alongside login/signup. Every page carries the
 * "not financial advice" line (CLAUDE.md #4/#12/#24) and a "Back to sign in" link
 * — the safe destination for the logged-out visitor who follows a footer link.
 */
export function LegalDoc({ title, updated, intro, sections }: LegalDocProps) {
  return (
    <article className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] shadow-[0_24px_60px_-12px_rgba(15,25,35,0.12),0_8px_24px_-8px_rgba(15,25,35,0.08)] overflow-hidden">
      <div className="px-7 py-8 sm:px-9 sm:py-10">
        <h1 className="text-[22px] sm:text-[24px] font-bold text-[var(--text-primary)] tracking-[-0.4px] leading-[1.2]">
          {title}
        </h1>
        <p className="mt-1.5 text-[11px] font-[var(--font-mono)] uppercase tracking-[0.6px] text-[var(--text-muted)]">
          Last updated {updated}
        </p>

        {intro && (
          <div className="mt-5 text-[13px] text-[var(--text-secondary)] leading-relaxed">
            {intro}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-6">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-[13.5px] font-bold text-[var(--text-primary)] tracking-[-0.2px]">
                {s.heading}
              </h2>
              <div className="mt-1.5 text-[13px] text-[var(--text-secondary)] leading-relaxed">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 pt-5 border-t border-[var(--border)]">
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            Information only — not financial advice. MajorCycle provides educational
            and informational analysis. It is not a licensed financial adviser, and
            nothing on this site is a recommendation to buy, hold, or sell any
            security.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-[13px] font-semibold text-[var(--brand-mid)] hover:text-[var(--brand-bright)] transition-colors"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </article>
  );
}
