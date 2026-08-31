// Backstop for the `notFound()` calls the page still makes. Unreachable while
// `layout.tsx` does the check first — deliberately, so removing that layout
// degrades to the old soft-404 rather than to a blank screen.
export { default } from '@/components/stocks/NotInCoverage';
