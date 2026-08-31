import { ARTICLES_INDEX_PATH } from '@/lib/articles';
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
 * Where "How it works" points.
 *
 * It USED to be `/methodology`, a page of its own. Naming the destination rather
 * than inlining it is what made the move a one-line change when the explainer was
 * folded into the landing page — header, footer and the landing's own hero button
 * all followed it without being touched.
 *
 * ⚠️ A fragment, not a path, and three things depend on that:
 *   • `/methodology` answers **308 → `/#how-it-works`** (`next.config.ts`), so old
 *     links and anything Google already indexed still land on the content.
 *   • The section carries `scroll-mt`, or the sticky header covers the heading a
 *     reader was just sent to.
 *   • `pathname === href` can never be true for this link, so it is never marked
 *     `aria-current`. Correct — it is a place on a page, not a page.
 */
export const HOW_IT_WORKS_HREF = '/#how-it-works';

/**
 * The header's links. Kept short on purpose — the footer carries the long tail.
 *
 * ⚠️ Articles sits BEFORE Learn, which is the reverse of the order they were
 * built in. The two sections answer different questions and the first is the one
 * a stranger arriving from a search result is more likely to want: Articles is
 * what we found, Learn is what the words mean. A reader who needs the
 * vocabulary first is one click away either way; a reader who wants the finding
 * should not have to go through a glossary to reach it.
 */
export const NAV_LINKS = [
  { href: HOW_IT_WORKS_HREF, label: 'How it works' },
  { href: ARTICLES_INDEX_PATH, label: 'Articles' },
  { href: '/learn', label: 'Learn' },
  { href: '/pricing', label: 'Pricing' },
] as const;

/**
 * The three legal documents, as a set.
 *
 * They are a set in the reader's head — somebody on `/terms` wanting to know what
 * happens to their email is looking for `/privacy` — so each document's contents
 * rail offers the other two. That makes this list a SECOND consumer, and a second
 * consumer is exactly when a hand-typed copy starts to drift (CLAUDE.md 11c): the
 * footer below spreads this array rather than repeating it, so a document can
 * never appear in one place and not the other.
 *
 * Order is deliberate — disclaimer first. It is the one CLAUDE.md #4/#12 make
 * legally material, and the only one of the three a reader may actually need.
 */
export const LEGAL_DOCS = [
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
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
  { href: ARTICLES_INDEX_PATH, label: 'Articles' },
  { href: '/learn', label: 'Learn' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  ...LEGAL_DOCS,
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
