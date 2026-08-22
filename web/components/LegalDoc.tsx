import { LegalContentsRail } from './LegalContentsRail';
import { LegalNotice } from './LegalNotice';
import { PageFrame } from './PageFrame';

export interface LegalSection {
  heading: string;
  body: React.ReactNode;
}

interface LegalDocProps {
  title: string;
  /** Human-readable date, e.g. "5 July 2026". */
  updated: string;
  intro?: React.ReactNode;
  sections: LegalSection[];
}

/**
 * `#the-service`, from "The Service". Derived, never authored: an id typed by
 * hand beside a heading is a second copy of that heading, and the two drift the
 * first time the wording is edited (CLAUDE.md 11c). The contents rail, the
 * inline list and the section they point at all call this, so all three move
 * together or not at all.
 */
export const sectionId = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * The three legal documents: /disclaimer, /terms, /privacy.
 *
 * ── Why this was rebuilt, 2026-08-12 ─────────────────────────────────────────
 *
 * The owner rejected the previous version: functionally correct, contrast-clean,
 * and it read as a different product from the page you arrived from. Measured on
 * the production build at 1280px, crossing the footer link from /contact:
 *
 *     title 24px → 36px · body 13px → 17px · column 440px → 680px
 *
 * Three findings, none of which "make it look nicer" would have reached:
 *
 * 1. **It was a card pretending to be a page.** /contact's card is 320px tall and
 *    reads correctly as an object. /terms' was 2,223px — a rounded, shadowed slab
 *    using 53% of a viewport whose header spans all of it. A card is a container
 *    for something small. The remaining 600px was empty.
 * 2. **The headings were bigger than the sections.** `h2` at 26px introduced
 *    clauses averaging 45 words: a headline half again the size of the three
 *    lines beneath it, eight times down the page.
 * 3. **Six pieces of furniture before the first clause** — eyebrow, 36px title,
 *    date chip, 20px lead, notice, contents grid — on a document nobody reads
 *    top to bottom.
 *
 * So it is now a DOCUMENT rather than a big card: a masthead closed by a rule,
 * clause numbers as a reference column, and the contents moved into the margin
 * as a sticky rail (≥1024px).
 *
 * ── Sizes, revised 2026-08-13 on owner instruction ───────────────────────────
 *
 * The first rebuild kept 17px body and a 26px title — smaller than before, still
 * larger than the rest of the site. The owner's call was to stop splitting the
 * difference: *"amend the legal pages to match … no need to make it slightly
 * bigger"*, scoped explicitly to **these three pages only**.
 *
 * So the document now runs at the sizes the public site already uses —
 * 24 / 17 / 13 / 12, all four measured off live pages, defined once as `--doc-*`
 * in globals.css. `/contact`'s title is 24px and its body is 13px, so crossing
 * that footer link is now no change at all.
 *
 * ⚠️ The furniture this file used to carry was copied from /methodology, and its
 * comment said so as the justification. /methodology is deleted in the next
 * commit (it becomes the landing's `#how-it-works`), so that rationale had an
 * expiry date on it. These three pages are their own set now.
 *
 * Unchanged and deliberate: the "Information only — not financial advice" notice
 * stays at the TOP, visible without scrolling on a multi-thousand-word document
 * (CLAUDE.md #4/#12/#24), and its wording is untouched — trimming a disclaimer is
 * not a design decision.
 */
export function LegalDoc({ title, updated, intro, sections }: LegalDocProps) {
  const toc = sections.map((s) => ({ id: sectionId(s.heading), heading: s.heading }));

  return (
    <PageFrame width="wide">
      {/* `doc-scale` carries the 24/17/13/12 sizes; `legal-layout` carries the
          contents-rail grid. They used to be one class, which is why the Learn
          pages — which need the scale and not the grid — silently came out at
          `.reading`'s 36/26/20 instead. Two names, two jobs. */}
      <div className="legal-layout doc-scale">
        {/* Desktop only. Below 1024px `.legal-layout` is plain block flow and this
            is `display: none`, with the inline list inside the document taking
            over — the two cannot drift because both map the same `sections`.
            They are not one component moved by CSS because the running order
            differs by design: on a phone the notice must come before the
            contents, and a sibling rail would land above both. */}
        <LegalContentsRail sections={toc} />

        {/* ⚠️ `max-w-[var(--measure-doc)] mx-auto` is not belt-and-braces. Inside
            the grid it is a no-op (the column IS --measure-doc), but the frame
            is `wide` for the rail's sake, and below 1024px `.legal-layout` is
            plain block flow — so without this the document stretched to the full
            frame. Measured at 1023px before the fix: 973px, which is ~110
            characters of 17px body copy per line against a 45–75 band. The
            regression lives in exactly the window where the rail has gone and
            nothing else is holding the measure. */}
        {/* ⚠️ `--shadow-sm` — and this REPLACED a deliberate "no shadow at all",
            on the owner's instruction (2026-08-15), so the old reasoning is worth
            keeping rather than deleting. It ran: `--shadow-lift` is for an object
            floating on the page and `--shadow-sm` still reads as one; a document
            IS the page, and at 2,000px tall an ambient blur underneath looks like
            it is about to slide off.
            What changed the answer is that the card families had drifted apart on
            more than intent: the auth card floats on `--shadow-lift` and this one
            was completely flat, so `/login` → `/terms` read as two products
            rather than two weights of one. `--shadow-sm` is the design system's
            value for a plain `.card` (the auth card's `.card--lift` is the
            exception, not this).
            ✅ SETTLED: the owner was shown the rendered result — the bottom edge
            at the document's real height (1,502px on /terms) — and confirmed the
            shadow stays. The old concern was aimed at `--shadow-lift`; at 1–3px
            the edge reads as resting, not sliding. Don't relitigate this. If a
            future document ever does look wrong, drop the class here — never
            weaken `--shadow-sm`, which four other surfaces read. */}
        <article className="mx-auto max-w-[var(--measure-doc)] overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
          {/* ⚠️ Explicit px, not Tailwind steps. The root font-size is 14px, so
              the rem scale lands at 0.875× — `px-6 py-8 sm:p-10` was computing to
              21/28 then 35/35, where the design system specifies 30/32 desktop and
              24/20 mobile. The auth card was corrected to those numbers first, so
              this card was left disagreeing with the one a reader meets one click
              earlier. Same trap as the header gaps and the landing's bleed. */}
          <div className="px-[20px] py-[24px] sm:px-[32px] sm:py-[30px]">
            {/* ── Masthead. A title, when it was last changed, and a rule. The
                "LEGAL" eyebrow and the pill around the date are both gone: the
                rail, the footer and the title already say what this is, and on a
                reference document the date is a fact, not a badge. */}
            <header>
              <h1 className="doc-title">{title}</h1>
              <p className="small mt-2 text-[var(--text-secondary)]">
                Last updated {updated}
              </p>
            </header>

            <hr className="mt-6 border-0 border-t border-[var(--border)]" />

            {intro && <div className="mt-6">{intro}</div>}

            {/* ⚠️ The notice used to be written out here. It now lives in
                `LegalNotice.tsx`, because the Learn article template needs the
                identical sentence and a second hand-typed copy of a COMPLIANCE
                control is the worst possible instance of 11c — two disclaimers
                do not diverge loudly, one just gets edited. The box styling and
                the reasoning for it moved with the words. */}
            <LegalNotice className="mt-6" />

            {/* The contents, for readers who never see the rail. Generated from
                `sections`, so it cannot list a clause that does not exist or miss
                one that does. `list-none pl-0` / `mt-0` opt it out of the
                `.reading` prose list rules — see the same note in the rail. */}
            <nav aria-label="Contents" className="mt-7 lg:hidden">
              <p className="micro text-[var(--text-secondary)]">On this page</p>
              <ol className="mt-2.5 grid list-none gap-x-6 gap-y-1.5 pl-0 sm:grid-cols-2">
                {toc.map((s, i) => (
                  <li key={s.id} className="mt-0 flex items-baseline gap-2.5">
                    <span className="doc-num text-[length:var(--pub-label)]" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <a href={`#${s.id}`} className="text-[length:var(--pub-body)] no-underline">
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-9 flex flex-col gap-8">
              {sections.map((s, i) => (
                <section
                  key={s.heading}
                  id={toc[i]!.id}
                  // Clears the sticky header when the contents jumps here. Without
                  // it the heading lands underneath the bar and the reader sees the
                  // clause after the one they asked for. The rail's scroll-spy
                  // reads the same `--header-h` token, so the highlight and the
                  // landing position cannot disagree.
                  className="scroll-mt-[calc(var(--header-h)+20px)]"
                >
                  <h2 className="doc-h flex items-baseline gap-2.5">
                    {/* The clause number, hanging beside the heading. A legal
                        document is cited by number, so this is content — which is
                        why it is --brand-mid text rather than the filled chip it
                        used to be, and why it is never below the --rd-micro floor. */}
                    <span className="doc-num flex-shrink-0" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {s.heading}
                  </h2>
                  <div className="mt-2.5">{s.body}</div>
                </section>
              ))}
            </div>

            {/* Nothing follows the last clause, deliberately.
                - "← Back to sign in" dated from before Layer G, when these pages
                  had no chrome and sign-in was genuinely unreachable. The header
                  carries it on every page now, and a reader who arrived from the
                  app was never "going back to sign in" anyway.
                - "Questions about any of this? Contact us." sat immediately under
                  a clause that already says where to send questions — all three
                  documents end with one — so it read as the same offer twice.
                  Where a route to the contact FORM genuinely helps (exercising a
                  privacy right), the link belongs in that clause, not as page
                  furniture; /privacy's "Your rights" carries it. */}
          </div>
        </article>
      </div>
    </PageFrame>
  );
}
