/**
 * The landing film's nine lines and when each one starts.
 *
 * In `lib/` rather than beside the component because the component is a client
 * module and `e2e/landing.spec.ts` has to read these to hold them against the
 * video file's own duration. The reasons for each decision are in
 * `components/landing/LandingFilm.tsx`.
 */
export const FILM_SECONDS = 35;

type Line = { at: number; title: string; n?: number; sub?: string; inPicture?: boolean };

export const FILM_LINES: readonly Line[] = [
  { at: 0, title: 'So many companies.' },
  { at: 4, title: 'Which ones are worth your time?' },
  // Scene 3 is a typed card: its words are drawn in the picture, so this entry is
  // for screen readers and search engines only and is never laid over the video.
  { at: 7, title: 'Nobody has that many evenings.', inPicture: true },
  { at: 9.5, title: 'So we check every one.' },
  { at: 13.5, n: 1, title: 'Financial Health', sub: 'Is the business sound?' },
  { at: 17.7, n: 2, title: 'Valuation', sub: 'How far has it fallen, against how far it usually falls?' },
  { at: 21.9, n: 3, title: 'Cycle Payoff', sub: 'When it falls, how well does it bounce back?' },
  { at: 26.7, title: 'Scored. Ranked.' },
  { at: 30.3, title: 'Your shortlist. In minutes.' },
];
