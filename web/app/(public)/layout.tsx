import Image from 'next/image';
import Link from 'next/link';

// Origin of the Supabase project, derived from the public URL — used to warm the
// TLS connection before the auth token exchange fires (see preconnect below).
const supabaseOrigin = process.env['NEXT_PUBLIC_SUPABASE_URL']
  ? new URL(process.env['NEXT_PUBLIC_SUPABASE_URL']).origin
  : null;

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

      {/* Card area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-[440px]">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 pb-6 text-center">
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Information only — not financial advice.{' '}
          <Link href="/disclaimer" className="underline underline-offset-2 hover:text-[var(--brand-mid)] transition-colors">
            Full disclaimer
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
