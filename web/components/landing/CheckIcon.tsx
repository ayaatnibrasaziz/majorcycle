/**
 * The three small pictures on the landing page's check cards.
 *
 * Each is the landing film's own scene for that check, reduced to one object: the
 * heartbeat monitor (Financial Health), the ruler against the hillside (Valuation)
 * and the tile bouncing back (Cycle Payoff). They are here so a reader who has just
 * watched the film recognises the card as the same idea, without reading a word.
 *
 * Decorative: the card's heading and question already say what the check is, so
 * the picture is hidden from a screen reader rather than described a second time.
 *
 * The outline is `currentColor`, set to the page ink in landing.css, so the
 * pictures follow the site's ink rather than holding a copy of it.
 */
const FILM = {
  screen: '#10264D',
  pulse: '#3BE08F',
  hill: '#8FC48A',
  sky: '#DCEEFF',
  ruler: '#FFD98A',
  pointer: '#E0652A',
  tile: '#C9F0DA',
  floor: '#D9C08A',
} as const;

export function CheckIcon({ kind }: { kind: 'health' | 'valuation' | 'payoff' }) {
  return (
    <svg
      className="check-icon"
      viewBox="0 0 64 64"
      width="56"
      height="56"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'health' ? (
        <>
          <rect x="5" y="9" width="54" height="38" rx="8" fill={FILM.screen} />
          <path d="M12 29h10l4 -11l7 22l6 -16l4 5h9" stroke={FILM.pulse} strokeWidth="3.5" />
          <path d="M32 47v8M22 56h20" />
        </>
      ) : null}
      {kind === 'valuation' ? (
        <>
          <rect x="5" y="7" width="54" height="50" rx="8" fill={FILM.sky} />
          <path d="M6 22c14 0 16 22 30 22h12v12H13a7 7 0 0 1 -7 -7z" fill={FILM.hill} />
          <path d="M10 33h32" strokeWidth="2.5" strokeDasharray="1 6" />
          <rect x="48" y="11" width="8" height="42" rx="2" fill={FILM.ruler} strokeWidth="2.5" />
          <path d="M48 19h4M48 27h4M48 35h4M48 43h4" strokeWidth="2" />
          <path d="M46 44l-8 -4.5v9z" fill={FILM.pointer} strokeWidth="2.5" />
        </>
      ) : null}
      {kind === 'payoff' ? (
        <>
          <path d="M5 55h54" />
          <path d="M9 52c4 -30 12 -30 16 0" strokeWidth="2.5" strokeDasharray="1 6" />
          <path d="M25 52c3 -16 6 -22 9 -26" strokeWidth="2.5" strokeDasharray="1 6" />
          <rect x="33" y="7" width="24" height="24" rx="7" fill={FILM.tile} />
          <path d="M41 16v2M49 16v2" strokeWidth="2.6" />
          <path d="M41 23q4 3.5 8 0" strokeWidth="2.4" />
        </>
      ) : null}
    </svg>
  );
}
