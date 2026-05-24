export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-[6px] bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] animate-pulse" />
        <span className="text-[11px] text-[var(--text-muted)] font-[var(--font-mono)]">
          Loading…
        </span>
      </div>
    </div>
  );
}
