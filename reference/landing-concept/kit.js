// Shared drawing kit for the landing film (look sheet + storyboard). Stills only.
const O = '#0F1923';                       // the one outline colour
const TIER = ['#0E8A62', '#3F9B3F', '#D99A1C', '#E0652A', '#B83232'];

/* ── The investor. Drawn around (0,0) = centre of the head. ───────────── */
function person(mood = 'calm', o = {}) {
  const skin = '#F3CFA8', hood = '#1E5CB3', hoodD = '#17478C', hair = '#2B2F3A';
  const eye = mood === 'relieved'
    ? `<path d="M-30 -2q9 -9 18 0M12 -2q9 -9 18 0" fill="none" stroke="${O}" stroke-width="4.5" stroke-linecap="round"/>`
    : mood === 'over'
      ? `<ellipse cx="-21" cy="-2" rx="9" ry="10.5" fill="#fff" stroke="${O}" stroke-width="3"/><ellipse cx="21" cy="-2" rx="9" ry="10.5" fill="#fff" stroke="${O}" stroke-width="3"/><circle cx="${-21 + (o.look || 0)}" cy="-1" r="4.2" fill="${O}"/><circle cx="${21 + (o.look || 0)}" cy="-1" r="4.2" fill="${O}"/>`
      : `<ellipse cx="-21" cy="-2" rx="5" ry="6.5" fill="${O}"/><ellipse cx="21" cy="-2" rx="5" ry="6.5" fill="${O}"/>`;
  const brow = mood === 'over'
    ? `<path d="M-34 -24l20 -7M34 -24l-20 -7" stroke="${O}" stroke-width="4.5" stroke-linecap="round"/>`
    : mood === 'relieved' ? '' : `<path d="M-32 -22h18M14 -22h18" stroke="${O}" stroke-width="4.5" stroke-linecap="round"/>`;
  const mouth = mood === 'over'
    ? `<path d="M-13 27q6.5 -7 13 0t13 0" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`
    : mood === 'relieved' ? `<path d="M-15 21q15 15 30 0" fill="#fff" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>`
      : `<path d="M-10 25q10 7 20 0" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`;
  const sweat = mood === 'over' ? `<g transform="translate(0 ${o.sweatDy || 0})" opacity="${o.sweatOp ?? 1}"><path d="M58 -38c7 10 10 15 10 20a10 10 0 0 1 -20 0c0 -5 3 -10 10 -20z" fill="#8FD0FF" stroke="${O}" stroke-width="3"/></g>` : '';
  const cheek = mood === 'relieved' ? `<ellipse cx="-36" cy="14" rx="8" ry="5" fill="#F0A58C" opacity=".7"/><ellipse cx="36" cy="14" rx="8" ry="5" fill="#F0A58C" opacity=".7"/>` : '';
  return `
  <g>
    <path d="M-64 150c0 -58 22 -92 64 -92s64 34 64 92z" fill="${hood}" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M-44 80c8 -30 80 -30 88 0c-18 16 -70 16 -88 0z" fill="${hoodD}" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M-12 92v28M12 92v28" stroke="#E7EEF8" stroke-width="4" stroke-linecap="round"/>
    <rect x="-56" y="-58" width="112" height="108" rx="40" fill="${skin}" stroke="${O}" stroke-width="5"/>
    <path d="M-56 -22c0 -28 18 -40 44 -40h26c26 0 42 12 42 38c-12 -12 -22 -16 -34 -16c-6 8 -18 10 -26 2c-10 10 -26 10 -34 2c-8 2 -14 8 -18 14z" fill="${hair}" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
    ${cheek}${brow}${eye}${mouth}${sweat}
  </g>`;
}

/* ── A company tile. (0,0) = centre. s = size. ────────────────────────── */
function tile(o = {}) {
  const s = o.s || 70, h = s / 2, fill = o.fill || '#C9D3E0', glow = o.glow || 0;
  const face = o.face === 'sad'
    ? `<path d="M${-s * .13} ${s * .2}q${s * .13} ${-s * .1} ${s * .26} 0" fill="none" stroke="${O}" stroke-width="${s * .05}" stroke-linecap="round"/>`
    : o.face === 'flat' ? `<path d="M${-s * .12} ${s * .17}h${s * .24}" stroke="${O}" stroke-width="${s * .05}" stroke-linecap="round"/>`
      : `<path d="M${-s * .13} ${s * .13}q${s * .13} ${s * .12} ${s * .26} 0" fill="none" stroke="${O}" stroke-width="${s * .05}" stroke-linecap="round"/>`;
  return `<g>
    ${glow ? `<rect x="${-h - 9}" y="${-h - 9}" width="${s + 18}" height="${s + 18}" rx="${s * .34}" fill="${o.glowCol || '#7FE3B3'}" opacity="${.22 + glow * .4}" filter="url(#soft)"/>` : ''}
    <rect x="${-h}" y="${-h + 5}" width="${s}" height="${s}" rx="${s * .26}" fill="${O}" opacity=".16"/>
    <rect x="${-h}" y="${-h}" width="${s}" height="${s}" rx="${s * .26}" fill="${fill}" stroke="${O}" stroke-width="${Math.max(3, s * .055)}"/>
    <rect x="${-h + s * .1}" y="${-h + s * .09}" width="${s * .8}" height="${s * .2}" rx="${s * .08}" fill="#fff" opacity=".28"/>
    <ellipse cx="${-s * .17}" cy="${-s * .05}" rx="${s * .055}" ry="${s * .075}" fill="${O}"/><ellipse cx="${s * .17}" cy="${-s * .05}" rx="${s * .055}" ry="${s * .075}" fill="${O}"/>
    ${face}
    ${o.stamp ? `<g transform="translate(${h - 4} ${-h + 4}) rotate(12)"><circle r="${s * .21}" fill="${o.stamp === 'good' ? '#fff' : '#E5E9F0'}" stroke="${o.stamp === 'good' ? '#0E8A62' : '#7B8798'}" stroke-width="3"/><path d="M0 ${s * .09}c${-s * .2} ${-s * .13} ${-s * .09} ${-s * .26} 0 ${-s * .13}c${s * .09} ${-s * .13} ${s * .2} 0 0 ${s * .13}z" fill="${o.stamp === 'good' ? '#0E8A62' : '#9AA5B5'}"/></g>` : ''}
    ${o.score != null ? `<g transform="translate(0 ${h + 2})"><rect x="-22" y="-13" width="44" height="26" rx="8" fill="#fff" stroke="${O}" stroke-width="3"/><text y="6" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="15" fill="${O}">${o.score}</text></g>` : ''}
  </g>`;
}
const defs = `<defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  <radialGradient id="vig" cx="50%" cy="46%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#020814" stop-opacity=".62"/></radialGradient></defs>`;


/* ── Our mark, redrawn flat for the film (the site's glossy logo file is not used inside the cartoon). (0,0) = centre. ── */
function mark(s = 60, o = {}) {
  const k = s / 100;
  return `<g transform="scale(${k})">
    ${o.glow ? `<rect x="-62" y="-62" width="124" height="124" rx="34" fill="#5FA8FF" opacity="${o.glow}" filter="url(#soft)"/>` : ''}
    <rect x="-50" y="-50" width="100" height="100" rx="24" fill="#12305F" stroke="${O}" stroke-width="${Math.max(5, 4 / k)}"/>
    <path d="M-40 -35q8 -9 22 -9h36q14 0 22 9" fill="none" stroke="#fff" stroke-width="4" opacity=".14" stroke-linecap="round"/>
    <g transform="rotate(${o.spin || 0})"><path d="M32.5 -5.7A33 33 0 1 1 8.5 -31.9" fill="none" stroke="#2E7DE8" stroke-width="5" stroke-linecap="round"/>
    <path d="M0 -46l5 9h-10zM0 46l5 -9h-10z" fill="#5FA8FF"/></g>
    <path d="M-23 -21h10l15 19v13l-15 -18v25l-10 10z" fill="#fff"/>
    <path d="M12 0l11 -11v39l-11 -10z" fill="#DCE6F5"/>
    <path d="M2 -2v13l10 -11z" fill="#DCE6F5"/>
    <path d="M4 4l22 -24" fill="none" stroke="#4C9BFF" stroke-width="10"/>
    <path d="M38 -35l-5 22l-17 -17z" fill="#4C9BFF" stroke="#4C9BFF" stroke-width="2.5" stroke-linejoin="round"/>
  </g>`;
}
