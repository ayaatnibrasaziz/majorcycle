import { PageFrame } from './PageFrame';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * The narrow-column card behind every auth and short-form page. It carries its
 * own <PageFrame width="narrow">, so the seven pages that render an AuthCard
 * inherit the column the public layout used to impose on everything — and the
 * app keeps the terminal type scale here deliberately: a form is operated, not
 * read, and 13px labels beside a 17px article would look like two products.
 */
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <PageFrame width="narrow">
    {/* One card language, the terminal's: `--radius` (10px) and a named shadow.
        This was a hand-typed 12px radius over a 60px ambient blur, repeated in
        four files — which is why signing in looked like a different product from
        the thing you were signing into. Both values are tokens now, so the next
        card cannot be a fifth opinion (CLAUDE.md 11c). */}
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-lift)] overflow-hidden">
      <div className="px-[20px] py-[24px] sm:px-[32px] sm:py-[30px]">
        {/* Heading */}
        <div className="mb-[24px]">
          {/* Sizes come from --pub-* (globals.css), the ONE place the public
              site's scale is chosen. These were hand-typed 22/24/13 here while the
              legal documents declared the same 24 and 13 as tokens — the same
              number written down twice, which is how a pair of pages quietly
              stops matching (CLAUDE.md 11c). The rendered pixels are unchanged,
              including the 22px step on a phone, and e2e/legal-doc.spec.ts now
              measures both surfaces and fails if they ever disagree. */}
          <h1 className="text-[length:var(--pub-title-sm)] sm:text-[length:var(--pub-title)] font-bold text-[var(--text-primary)] tracking-[-0.4px] leading-[1.2]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[length:var(--pub-body)] text-[var(--text-secondary)] mt-[6px] leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
    </PageFrame>
  );
}
