/**
 * The route-level Suspense fallback.
 *
 * ⚠️ `data-route-loading` is a TEST HANDLE, and it exists because its absence
 * caused a real flake. The public layout — header, nav, footer — renders while
 * the page body is still suspended, so any check that waits on the chrome can
 * pass over a page whose content has not arrived. The contrast guard did
 * exactly that on `/`: its stylesheet sentinel went green and the probe then
 * measured 47 elements instead of 168, i.e. the furniture and none of the page.
 *
 * It was caught only by that test's "did we measure anything?" control, which
 * is the whole argument for keeping such controls: the assertion itself was a
 * negative one, and negative assertions pass beautifully against an empty page.
 *
 * Matching on the word "Loading…" instead would tie the harness to display
 * copy, which is the sort of coupling that breaks silently the day someone
 * rewords it.
 */
export default function RootLoading() {
  return (
    <div
      data-route-loading
      className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-[6px] bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] animate-pulse" />
        <span className="text-[11px] text-[var(--text-muted)] font-[var(--font-mono)]">
          Loading…
        </span>
      </div>
    </div>
  );
}
