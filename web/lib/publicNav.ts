import { PUBLIC_PAGES } from '@/lib/seo';

/**
 * The public site's navigation, in ONE place.
 *
 * The header is a client component (it needs `usePathname()` to mark the current
 * page and to hide the call-to-action a reader is already looking at); the footer
 * is rendered by the server layout. Two files, one list — because "How it works"
 * pointing at two different URLs is precisely the drift CLAUDE.md 11c is about,
 * and it would look fine in both files.
 */

/**
 * Where "How it works" points. Named rather than inlined because it moves in the
 * next commit: `/methodology` is being folded into a `#how-it-works` section on
 * the landing page, and when it does, this is the one line that changes.
 */
export const HOW_IT_WORKS_HREF = '/methodology';

/** The header's links. Kept short on purpose — the footer carries the long tail. */
export const NAV_LINKS = [
  { href: HOW_IT_WORKS_HREF, label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
] as const;

/**
 * The footer's links.
 *
 * Deliberately hand-ordered rather than derived from PUBLIC_PAGES: that list also
 * holds `/login`, `/signup` and `/reset-password`, which belong in the header
 * flow, not a footer nav. It is the reading order a stranger needs — what this is,
 * then what it costs, then the legal shelf.
 */
export const FOOTER_LINKS = [
  { href: '/', label: 'Home' },
  { href: HOW_IT_WORKS_HREF, label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
] as const;

const OPEN_TO_STRANGERS = new Set(PUBLIC_PAGES.map((p) => p.path));

/**
 * Should this page show the full header — nav plus "Sign in" and "Create free
 * account" — or only the logo?
 *
 * DERIVED from PUBLIC_PAGES rather than listed again, because it is the same
 * question asked once: *may a reader with no session open this page?* If yes, the
 * sign-in links are the right offer. If no, the reader already has a session and
 * is being held somewhere deliberately.
 *
 * The two pages this excludes today are both confinements, enforced server-side in
 * `proxy.ts`: `/account/update-password` (a recovery session, pinned there until a
 * password is set) and `/reactivate` (an account scheduled for deletion). Nobody
 * escapes either by clicking a link — the redirect fires again — so offering links
 * that visibly do nothing is a UX defect rather than a hole, and this removes them.
 *
 * ⚠️ The `(public)` ROUTE GROUP is not the same set as PUBLIC_PAGES; it describes
 * the layout these pages share, not their reachability (see lib/seo.ts). That gap
 * is exactly what this function reads. A genuinely new public page cannot land here
 * by accident: `pageMetadata()` throws at build time for any path missing from
 * PUBLIC_PAGES, and `pnpm check:seo` fails the build on a public page that never
 * calls it.
 */
export function showsFullChrome(pathname: string): boolean {
  return OPEN_TO_STRANGERS.has(pathname);
}
