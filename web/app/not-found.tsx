import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--bg-stripe)] border border-[var(--border)] flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35M11 8v3M11 14h.01" />
          </svg>
        </div>
        <h1 className="text-[16px] font-bold text-[var(--text-primary)] mb-2">
          Page not found
        </h1>
        <p className="text-[12px] text-[var(--text-muted)] mb-5 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/results"
          className="inline-flex items-center gap-1.5 bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] text-white text-[12px] font-semibold px-4 py-2 rounded-[var(--radius-sm)] shadow-[0_2px_8px_rgba(30,92,179,.25)] hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(30,92,179,.35)] transition-all"
        >
          Back to Results
        </Link>
      </div>
    </div>
  );
}
