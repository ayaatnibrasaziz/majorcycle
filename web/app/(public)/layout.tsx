import Image from 'next/image';
import Link from 'next/link';

// Origin of the Supabase project, derived from the public URL — used to warm the
// TLS connection before the auth token exchange fires (see preconnect below).
const supabaseOrigin = process.env['NEXT_PUBLIC_SUPABASE_URL']
  ? new URL(process.env['NEXT_PUBLIC_SUPABASE_URL']).origin
  : null;

/**
 * The footer's links, in one place.
 *
 * Deliberately hand-ordered rather than derived from PUBLIC_PAGES: that list also
 * holds `/login`, `/signup` and `/reset-password`, which belong in the header
 * flow, not a footer nav. It is the reading order a stranger needs — what this is,
 * then what it costs, then the legal shelf.
 */
const FOOTER_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/methodology', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
] as const;

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[var(--bg-page)] flex flex-col">
      {/* Warm the connections the sign-in flow needs before it clicks: Google
          Identity Services (the button + One Tap) and the Supabase Auth endpoint
          (token exchange). Shaves the TLS handshake off the critical path. */}
      <link rel="preconnect" href="https://accounts.google.com" />
      {supabaseOrigin && (
        <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
      )}
      {/* Subtle background texture — fine grid + soft radial highlight (financial terminal feel) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(30,92,179,0.08) 0%, transparent 70%), radial-gradient(circle at 50% 100%, rgba(46,125,232,0.04) 0%, transparent 60%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.4]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(26,58,110,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(26,58,110,0.05) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)',
        }}
      />

      {/* Top status bar — financial terminal touch */}
      <div className="relative z-10 flex items-center justify-between px-6 lg:px-10 py-4 lg:py-5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/logo.png"
            alt="MajorCycle logo"
            width={34}
            height={34}
            priority
            className="w-[34px] h-[34px] rounded-[8px] shadow-[0_2px_8px_rgba(30,92,179,0.3)] transition-transform group-hover:scale-[1.04]"
          />
          <div className="leading-none">
            <div className="text-[13px] font-bold text-[var(--brand-deep)] tracking-[-0.3px]">MajorCycle</div>
            <div className="text-[9px] font-medium uppercase tracking-[0.8px] text-[var(--text-muted)] mt-1 font-mono">
              Financial Terminal
            </div>
          </div>
        </Link>

        {/* Status pill — matches reference's .header-pill style */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[10.5px] font-mono font-medium text-[var(--text-secondary)] tracking-[0.3px]">
            Markets · Live
          </span>
        </div>
      </div>

      {/* Content area. The width lives with the PAGE, via <PageFrame> — this
          used to be a hard-coded max-w-[440px], which put long-form prose down
          a sign-in card. Chrome (above and below) is still defined once here,
          so widening a page can never fork the header or the footer. */}
      <main className="relative z-10 flex-1 flex flex-col px-5 pb-10">
        {children}
      </main>

      {/* Footer — ONE definition for every public page (CLAUDE.md 11c).
          Until now it linked only to /disclaimer, which left five public pages
          with no inbound link from anywhere on the site: a reader could not reach
          them, and neither could a crawler following links. */}
      <footer className="relative z-10 mt-auto border-t border-[var(--border)] px-6 py-7">
        <nav
          aria-label="Site"
          className="mx-auto flex max-w-[var(--measure-wide)] flex-wrap justify-center gap-x-6 gap-y-2.5"
        >
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[length:var(--rd-small)] font-medium text-[var(--text-secondary)] hover:text-[var(--brand-mid)] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {/* --text-secondary, not --text-muted. Muted on --bg-page measures
            2.69:1 (design-system §14) and this is the legally material line on
            every public page — CLAUDE.md #4/#12. A disclaimer nobody can read
            is not a disclaimer. --text-secondary on --bg-page is 6.8:1. */}
        <p className="mx-auto mt-5 max-w-[var(--measure-wide)] text-center text-[length:var(--rd-small)] text-[var(--text-secondary)] leading-relaxed">
          Information only — not financial advice. MajorCycle provides educational
          analysis of US, Australian and Canadian equities.
        </p>
      </footer>
    </div>
  );
}
