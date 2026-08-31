import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { PREFERRED_SOURCE } from '@/lib/preferredSource';

/**
 * The block that closes every article.
 *
 * Two invitations, deliberately unequal in weight.
 *
 * ── 1. The account, which is the one that matters ────────────────────────────
 *
 * Someone who has just read 1,600 words of measurement is the warmest reader
 * this site will ever have, and until now the article ended with a grey
 * sentence. This is the offer, made once, at the end — the brief's "a quiet
 * invitation, never a wall". It sits AFTER the whole argument rather than
 * interrupting it, and it makes no claim the free tier does not honour: an
 * account is free, takes no card, and keeps the price chart, the drawdown
 * overlay and every fundamentals section (CLAUDE.md, free vs premium).
 *
 * ── 2. Google's Preferred Sources button, which is off until it is earned ────
 *
 * Google added a publisher button in August 2026: two lines of HTML render a
 * localised control that lets a reader mark this site as a source they want to
 * see more of, and Google's own figures say a reader is about twice as likely
 * to click a source once they have. That is the domain-authority effect the
 * owner was after, and it is a real, documented feature rather than a trick.
 *
 * ⚠️ **IT IS SHIPPED OFF, AND THE FLAG IS NOT TIMIDITY.** Google's requirement
 * is that the site already appears in its source-preferences tool, and that
 * cannot be checked from here — it needs the owner's own Google account. What
 * CAN be checked is what the button does when the site is unknown, and the
 * answer is the uncomfortable one: **it renders anyway.** Measured on the
 * production build against `localhost:3200`, a domain Google has certainly never
 * heard of, the pill drew perfectly — "Add to Preferred Sources", Google's own
 * styling, 1230×60, zero console errors — inside an iframe whose URL carried
 * `publicationId=publication-id-free`, a placeholder. That is CLAUDE.md 11h
 * exactly: a third party's widget RENDERING is not a third party's APPROVAL, and
 * the last time this project read one for the other, the owner clicked it and
 * Google answered `Error 400`. A button that looks live and fails on click is
 * worse for a reader than no button.
 *
 * So: built, measured, and switched on in one line by whoever confirms the
 * domain is listed. See `lib/preferredSource.ts` for the two CSP origins it
 * needs and why they are scoped to this section rather than granted site-wide.
 */
export function ArticleCta() {
  return (
    <aside
      data-article-cta
      className="mt-10 rounded-[var(--radius)] border border-[var(--brand-light-border)] bg-[var(--brand-light)] px-[20px] py-[18px] sm:px-[24px] sm:py-[20px]"
    >
      <p className="micro font-bold uppercase tracking-[.14em] text-[var(--brand-mid)]">
        Try it yourself
      </p>
      {/* ⚠️ A `<p>`, not a heading. The article's own h2s carry its argument, and
          dropping a same-level heading into the furniture at the end would put
          "Try it yourself" into the document outline beside "What we measured" —
          which is what a screen-reader user navigates by, and what a crawler
          reads as the page's structure. */}
      <p className="mt-[6px] text-[var(--text-primary)]">
        The same measurement runs on every stock we cover in the US, Australia and
        Canada — where a company sits today against its own history of falls and
        recoveries.
      </p>
      <div className="mt-[14px] flex flex-wrap items-center gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Create a free account</Link>
        </Button>
        <span className="small text-[var(--text-secondary)]">
          Free, and it takes no card.
        </span>
      </div>

      {PREFERRED_SOURCE.enabled && (
        <div className="mt-[16px] border-t border-[var(--brand-light-border)] pt-[14px]">
          <p className="small text-[var(--text-secondary)]">
            Want more of this in your Google results?
          </p>
          {/* Google renders its own control into this element. It is left empty
              and unstyled on purpose: the button's appearance, language and
              theme are Google's to decide, and anything we paint here would be
              a second, drifting copy of a control we do not own. */}
          <div className="mt-[8px]" data-preferred-source-slot>
            <div {...{ 'google-add-preferred-source-btn': '' }} data-theme="light" />
          </div>
        </div>
      )}
    </aside>
  );
}
