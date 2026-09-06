import { PublicFooter } from '@/components/PublicFooter';
import { PublicHeader } from '@/components/PublicHeader';

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

      {/* The site header — nav, sign-in and the free-account call to action. One
          definition for every public page (components/PublicHeader.tsx); the
          "Markets · Live" pill it replaced was decoration on a page whose job is
          to explain the product to a stranger and offer them a way in. */}
      <PublicHeader />

      {/* Content area. The width lives with the PAGE, via <PageFrame> — this
          used to be a hard-coded max-w-[440px], which put long-form prose down
          a sign-in card. Chrome (above and below) is still defined once here,
          so widening a page can never fork the header or the footer.

          `pt-7` is not decoration: the header is sticky, and a vertically-centred
          auth card otherwise sits flush against it with its own top edge cropped. */}
      <main className="relative z-10 flex-1 flex flex-col px-5 pt-7 pb-10">
        {children}
      </main>

      {/* Footer — ONE definition for every public page (CLAUDE.md 11c).
          The YEAR is computed here, in the server component, and passed down: see
          the note in PublicFooter for why it must not be read on the client. */}
      <PublicFooter year={new Date().getFullYear()} />
    </div>
  );
}
