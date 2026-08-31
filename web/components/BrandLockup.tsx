import Image from 'next/image';

/**
 * The MajorCycle mark, wordmark and subtitle — the one place the lockup exists.
 *
 * ── Why this is a component and not two tidy copies ──────────────────────────
 *
 * It WAS two copies: `Sidebar` for the signed-in terminal and `PublicHeader` for
 * the public site. They were written weeks apart from the same design, agreed on
 * the sizes, the colours, the tracking and the shadow — and disagreed on the
 * things nobody lists when comparing two files:
 *
 *  · `leading-none` sat on the WORDMARK in the sidebar and on the WRAPPER in the
 *    public header. Inherited, it crushed the subtitle's line box too, so the two
 *    lines sat closer together on the public site than inside the app. That is
 *    what the owner reported (2026-08-17) as the lockup "not rendered the same
 *    way as the live site inside the terminal — the positioning of it".
 *  · The logo carried `flex-shrink-0` in one and not the other.
 *  · The public header used `gap-[10px]` on its linked branch and `gap-2.5` on
 *    its confinement branch — 8.75px at this project's 14px root, not 10 — so
 *    the lockup was a pixel-and-a-quarter tighter on `/account/update-password`
 *    and `/reactivate` than everywhere else. The comment immediately above that
 *    line warns about this exact Tailwind-rem trap, which is the clearest
 *    possible evidence that knowing a rule is not the same as being unable to
 *    break it.
 *
 * ⚠️ None of those is a wrong line. Each file is internally coherent and reads
 * correctly on its own; the defect only exists in the COMPARISON, which is why
 * review never caught it and only the owner putting two screens side by side
 * did. That is CLAUDE.md 11c: extracting the constant is the fix, and "I'll just
 * make the second one match" is how you get a third copy later.
 *
 * ⚠️ The gap lives HERE, inside the lockup, not on the callers' containers. A
 * shared component whose spacing is still supplied by two different parents has
 * only moved the drift somewhere less visible.
 *
 * ⚠️ **Do not "fix" the 9px subtitle.** It measures 2.69:1 and is a deliberate,
 * named exemption in `e2e/contrast.spec.ts` (`KNOWN_DEFERRED`), assigned to the
 * Layer H contrast sweep so the whole site moves at once. Changing its size or
 * colour here would either break that guard or silently widen an exemption that
 * names one element on purpose.
 */
export function BrandLockup({
  /**
   * Hide the "Financial Terminal" line below 520px.
   *
   * The public header does; the sidebar does not, because it only ever renders
   * at the sidebar's own fixed width. Expressed as a prop rather than a second
   * component so the two cannot drift on anything else.
   */
  hideSubtitleOnNarrow = false,
  /** Lift the mark slightly on hover — only meaningful where it is a link. */
  interactive = false,
}: {
  hideSubtitleOnNarrow?: boolean;
  interactive?: boolean;
} = {}) {
  return (
    <span className="flex items-center gap-[10px]">
      <Image
        src="/logo.png"
        alt="MajorCycle logo"
        width={34}
        height={34}
        priority
        className={`w-[34px] h-[34px] rounded-[8px] flex-shrink-0 shadow-[0_2px_8px_rgba(30,92,179,0.3)]${
          interactive ? ' transition-transform group-hover:scale-[1.04]' : ''
        }`}
      />
      {/* No `leading-none` on this wrapper — that was the bug. It inherits, so
          putting it here also flattens the subtitle's line box and lifts the
          whole block relative to the mark. It belongs on the wordmark alone. */}
      <span className="block">
        <span className="block text-[13px] font-bold leading-none tracking-[-0.3px] text-[var(--brand-deep)]">
          MajorCycle
        </span>
        <span
          className={`${
            hideSubtitleOnNarrow ? 'hidden min-[520px]:block' : 'block'
          } mt-[2px] text-[9px] font-medium uppercase tracking-[0.8px] text-[var(--text-muted)]`}
        >
          Financial Terminal
        </span>
      </span>
    </span>
  );
}
