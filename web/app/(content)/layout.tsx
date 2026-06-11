import Link from 'next/link';

/**
 * Wide, public reading shell for long-form static pages (Methodology, and the
 * other Layer F legal/info pages to come). Distinct from the (public) auth shell
 * — that one centres a 440px card; this one is a top-aligned ~max-w-3xl reading
 * column. Reuses the brand chrome (logo header, "information only" footer) so it
 * still feels like MajorCycle, and stays reachable without login (SSR/SEO).
 */
export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[var(--bg-page)] flex flex-col">
      {/* Subtle background texture — matches the auth shell's terminal feel */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(30,92,179,0.07) 0%, transparent 70%)',
        }}
      />

      {/* Top bar — logo links home */}
      <header className="relative z-10 flex items-center justify-between px-5 lg:px-8 py-4 border-b border-[var(--border)] bg-[var(--bg-header)]/80 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-[34px] h-[34px] rounded-[8px] bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] flex items-center justify-center shadow-[0_2px_8px_rgba(30,92,179,0.3)] transition-transform group-hover:scale-[1.04]">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
              <path d="M3 17l5-5 4 3 6-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 8h4v4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-bold text-[var(--brand-deep)] tracking-[-0.3px]">MajorCycle</div>
            <div className="text-[9px] font-medium uppercase tracking-[0.8px] text-[var(--text-muted)] mt-1 font-[var(--font-mono)]">
              Financial Terminal
            </div>
          </div>
        </Link>

        <Link
          href="/login"
          className="text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--brand-mid)] transition-colors"
        >
          Sign in →
        </Link>
      </header>

      {/* Reading column */}
      <main className="relative z-10 flex-1 w-full max-w-3xl mx-auto px-5 lg:px-8 py-8 lg:py-12">
        {children}
      </main>

      {/* Footer — full disclaimer block (§15) */}
      <footer className="relative z-10 border-t border-[var(--border)] px-5 lg:px-8 py-6 text-center">
        <p className="text-[12px] text-[var(--text-muted)] leading-relaxed max-w-2xl mx-auto">
          Information only — not financial advice. Past performance does not
          indicate future results. Always conduct your own research.{' '}
          <Link
            href="/disclaimer"
            className="underline underline-offset-2 hover:text-[var(--brand-mid)] transition-colors"
          >
            Full disclaimer
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
