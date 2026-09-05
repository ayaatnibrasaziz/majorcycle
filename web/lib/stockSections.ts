/**
 * The five groups a Stock Detail page is divided into — the single source for the
 * sub-nav pills, the section anchors, and the headings a screen reader navigates by.
 *
 * ⚠️ AUDIT 5A-114, option B. Until 2026-09-04 the signed-in product contained no
 * headings at all: every visible section title was a `div` styled bold, so a screen
 * reader's "list the headings" returned one entry for the whole page. Sighted readers
 * had the sub-nav; nobody else had anything. The page now renders one `h1` (the shared
 * header), an `h2` per group, and an `h3` per card.
 *
 * ⚠️ **The h2s are `sr-only` on purpose, and that is a real trade-off worth stating.**
 * The groups have no visible titles by design — the sticky sub-nav is their label, and
 * the owner's approved layout has cards running straight into one another. A visible
 * heading per group would be a design change nobody asked for. So the heading exists
 * for the accessibility tree and not on screen, which is exactly what `sr-only` is for
 * — but it means the structure is invisible to review: if a group is renamed here and
 * the pill is renamed elsewhere, nothing looks wrong. Hence one list, imported by both.
 *
 * ⚠️ It was two lists before this file: `SECTIONS` in `StockSubnav.tsx` and `NAV` in
 * `ReportDocument.tsx`, identical and unlinked (11c). The report keeps its own nav
 * COMPONENT — deliberately, so `check-report-sections.mjs` ignores it — but it no
 * longer keeps its own copy of the labels. A constant is not a component.
 */
export const STOCK_SECTIONS = [
  { id: 'sec-thesis', label: 'Thesis' },
  { id: 'sec-scorecard', label: 'Scorecard' },
  { id: 'sec-cycle', label: 'Cycle' },
  { id: 'sec-fundamentals', label: 'Fundamentals' },
  { id: 'sec-sentiment', label: 'Sentiment' },
] as const;

export const STOCK_SECTION_IDS = STOCK_SECTIONS.map((s) => s.id);

export type StockSectionId = (typeof STOCK_SECTIONS)[number]['id'];

/** The accessible name for a group, e.g. "Thesis" → "Thesis section". */
export function sectionHeading(id: StockSectionId): string {
  return STOCK_SECTIONS.find((s) => s.id === id)!.label;
}
