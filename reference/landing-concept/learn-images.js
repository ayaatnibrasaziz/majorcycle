// The three Learn pictures, drawn with the film's own kit so the Learn page and the landing film are one world.
// Needs kit.js and film.js. Each returns a 1600 x 1000 still. learnSVG(n) -> svg string, n = 1..3.
const LH = 1000;
const lvig = `<rect width="1600" height="${LH}" fill="url(#vigl)"/>`;
const dvig = `<rect width="1600" height="${LH}" fill="url(#vig)"/>`;

/* ── 1 · Falls and recoveries: one company walks its own price line ──── */
function learn1() {
  const sig = v => 1 / (1 + Math.exp(-v)), bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
  const base = x => 480 - .04 * x - 110 * sig((x - 1335) / 36);
  const yAt = x => base(x) + 196 * bell(x, 330, 106) + 200 * bell(x, 740, 106) + 408 * bell(x, 1130, 104);
  let d = `M-10 ${f1(yAt(-10))}`; for (let x = 0; x <= 1610; x += 10) d += `L${x} ${f1(yAt(x))}`;
  const usual = 662, deepest = yAt(1130);
  const sign = (x, y, t, dash) => `<path d="M0 ${f1(y)}h1600" stroke="${O}" stroke-width="6" ${dash ? 'stroke-dasharray="16 14"' : ''} opacity=".8"/><g transform="translate(${x} ${f1(y)})"><rect x="-190" y="-38" width="380" height="74" rx="16" fill="#fff" stroke="${O}" stroke-width="6"/><text y="13" text-anchor="middle" font-family="Sora" font-weight="700" font-size="40" fill="${O}">${t}</text></g>`;
  const S = 1.6, lift = 35 * S + 4;
  const hopArc = (x0, x1, h) => { const y0 = yAt(x0) - lift - 70, y1 = yAt(x1) - lift - 70; return `<path d="M${x0} ${f1(y0)}Q${(x0 + x1) / 2} ${f1(Math.min(y0, y1) - h)} ${x1} ${f1(y1)}" fill="none" stroke="#1E5CB3" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 18"/>`; };
  return `<rect width="1600" height="${LH}" fill="url(#sky)"/><circle cx="1010" cy="130" r="58" fill="#FFE9A8"/><circle cx="1010" cy="130" r="84" fill="#FFE9A8" opacity=".3"/>
  <g fill="#fff" opacity=".85"><ellipse cx="250" cy="150" rx="110" ry="30"/><ellipse cx="320" cy="128" rx="70" ry="30"/><ellipse cx="640" cy="96" rx="80" ry="22"/></g>
  <path d="${d}L1610 ${LH}L-10 ${LH}z" fill="#8FC48A" stroke="${O}" stroke-width="8" stroke-linejoin="round"/>
  ${sign(535, usual + 4, 'Usual fall', true)}${sign(1380, deepest + 6, 'Deepest fall', false)}
  ${hopArc(330, 740, 150)}${hopArc(740, 1130, 150)}${hopArc(1130, 1420, 190)}
  ${T(330, yAt(330) - lift, S, { face: 'flat' })}${T(740, yAt(740) - lift, S, { face: 'flat' })}
  ${T(1130, yAt(1130) - lift, S, { face: 'sad' })}
  <path d="M1530 ${f1(yAt(1530))}v-170" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M1530 ${f1(yAt(1530) - 170)}q-40 12 -80 30q40 18 80 30z" fill="#E0652A" stroke="${O}" stroke-width="7" stroke-linejoin="round"/>
  ${T(1420, yAt(1420) - lift, S, { glow: 1, fill: '#C9F0DA' })}
  ${lvig}`;
}

/* ── 2 · Judging the business: the same fall, two different patients ─── */
function learn2() {
  const monitor = (x, good) => `<g transform="translate(${x} 250)"><rect x="-170" y="-110" width="340" height="220" rx="24" fill="#0B1A36" stroke="${O}" stroke-width="8"/><rect x="-150" y="-90" width="300" height="180" rx="12" fill="#10264D"/>
    <path d="M-140 15h280" stroke="#2A4577" stroke-width="5" stroke-linecap="round"/>
    <path d="${good ? 'M-140 10h60l22 -70l34 130l30 -96l20 36h114' : 'M-140 20h80l16 -16l18 22l16 -8h150'}" fill="none" stroke="${good ? '#3BE08F' : '#8FA0B8'}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M0 110v64" stroke="${O}" stroke-width="10"/></g>`;
  const table = x => `<g transform="translate(${x} 640)"><rect x="-170" y="0" width="340" height="36" rx="12" fill="#F4F8FF" stroke="${O}" stroke-width="7"/><path d="M-124 36v64M124 36v64" stroke="${O}" stroke-width="12" stroke-linecap="round"/></g>`;
  // the identical price card each patient arrived with: same line, same fall
  const card = (x, r) => `<g transform="translate(${x} 470) rotate(${r})"><rect x="-92" y="-70" width="184" height="140" rx="16" fill="#FFFDF6" stroke="${O}" stroke-width="6"/><path d="M-70 26h140" stroke="${O}" stroke-width="3" opacity=".15"/>
    <path d="M-66 -40l30 12l22 -14l30 44l24 -10l22 34" fill="none" stroke="#B83232" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M62 26l4 -28l-26 12z" fill="#B83232" stroke="#B83232" stroke-width="4" stroke-linejoin="round"/></g>`;
  return `<rect width="1600" height="${LH}" fill="url(#cream)"/><g transform="translate(0 56)">
  <g transform="translate(800 150)"><rect x="-50" y="-50" width="100" height="100" rx="20" fill="#fff" stroke="${O}" stroke-width="6"/><path d="M-24 0h48M0 -24v48" stroke="#D5483E" stroke-width="15" stroke-linecap="round"/></g>
  ${monitor(440, true)}${monitor(1160, false)}
  <g transform="translate(800 548) scale(1.55)">${person('calm')}</g>
  <rect y="740" width="1600" height="260" fill="#D9C08A"/><path d="M0 740h1600" stroke="${O}" stroke-width="7"/>
  <ellipse cx="440" cy="748" rx="150" ry="14" fill="${O}" opacity=".14"/><ellipse cx="1160" cy="748" rx="150" ry="14" fill="${O}" opacity=".14"/>
  ${table(440)}${table(1160)}${card(170, -7)}${card(1430, 7)}
  ${T(440, 562, 2.1, { stamp: 'good', glow: 1, fill: '#D6F2E4' })}
  ${T(1160, 568, 2.1, { stamp: 'weak', face: 'sad' }, 0, 1.94)}</g>
  ${lvig}`;
}

/* ── 3 · Using MajorCycle: five tiers, read from the top step down ───── */
function learn3() {
  const scores = [84, 71, 58, 41, 27], faces = [undefined, undefined, 'flat', 'flat', 'sad'], X0 = 706, SW = 172, TOP0 = 392, DROP = 62, FLOOR = 732;
  const steps = scores.map((s, i) => { const x = X0 + i * SW, y = TOP0 + i * DROP;
    return `<rect x="${x}" y="${y}" width="${SW}" height="${FLOOR - y + 30}" fill="#F4F8FF" stroke="${O}" stroke-width="7"/><rect x="${x + 7}" y="${y + 7}" width="${SW - 14}" height="14" fill="${TIER[i]}"/>
    <text x="${x + SW / 2}" y="${y + 84}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="46" fill="#9FB0C8">${i + 1}</text>`; }).join('');
  const tiles = scores.map((s, i) => T(X0 + i * SW + SW / 2, TOP0 + i * DROP - 74, 1.75, { fill: TIER[i], face: faces[i], score: s, glow: i === 0 ? .6 : 0 })).join('');
  return `<g transform="translate(0 44)"><g transform="translate(0 60)">${wallBg}${windowMoon}${clock(170, 170, 212, 30, 0)}${lampCone(400, 1)}
  <ellipse cx="1130" cy="430" rx="560" ry="360" fill="url(#scr)" opacity=".8"/>
  <g transform="translate(400 402) scale(1.5)">${person('relieved')}</g>
  <rect x="0" y="690" width="1600" height="320" fill="#5B3A22"/><rect x="0" y="672" width="1600" height="40" rx="6" fill="#7A4E2D" stroke="${O}" stroke-width="7"/>
  <g transform="translate(-400 0)">${laptop(.5)}</g>
  <g transform="translate(150 628)">${mugShape}${steam(0)}</g></g>
  ${steps}<rect x="0" y="732" width="1600" height="40" rx="6" fill="#7A4E2D" stroke="${O}" stroke-width="7"/><rect x="0" y="768" width="1600" height="240" fill="#5B3A22"/>
  <g transform="translate(0 60)"><g transform="translate(-400 0)">${laptop(.5)}</g><g transform="translate(150 628)">${mugShape}${steam(0)}</g></g>
  ${tiles}</g>${dvig}`;
}

/* ── 4 · Articles index, featured piece: how far each market's shares usually fall ──
   Depths are drawn to scale from the article's own whole-index medians (ASX 200 -21.7%, S&P 500 -18.9%, TSX 60 -15.7%). */
function articleFalls() {
  const AW = 1200, AH = 760, bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2)), PX = 15, TOPY = 262;
  const M = [['ASX 200', 21.7, 215, 'sad'], ['S&P 500', 18.9, 600, 'flat'], ['TSX 60', 15.7, 985, undefined]];
  const yAt = x => TOPY + M.reduce((a, m) => a + m[1] * PX * bell(x, m[2], 112), 0);
  let d = `M-10 ${f1(yAt(-10))}`; for (let x = 0; x <= AW + 10; x += 10) d += `L${x} ${f1(yAt(x))}`;
  const S = 1.75, lift = 35 * S + 4;
  const sign = (x, t) => `<path d="M${x} 150v${f1(yAt(x) - lift - 35 * S - 160)}" stroke="${O}" stroke-width="6" stroke-dasharray="4 16" stroke-linecap="round" opacity=".55"/><g transform="translate(${x} 104)"><rect x="-165" y="-48" width="330" height="96" rx="20" fill="#fff" stroke="${O}" stroke-width="7"/><text y="19" text-anchor="middle" font-family="Sora" font-weight="700" font-size="54" letter-spacing="-1.5" fill="${O}">${t}</text></g>`;
  return `<svg viewBox="0 0 ${AW} ${AH}" xmlns="http://www.w3.org/2000/svg">${defs}${G}<rect width="${AW}" height="${AH}" fill="url(#sky)"/>
  <path d="${d}L${AW + 10} ${AH}L-10 ${AH}z" fill="#8FC48A" stroke="${O}" stroke-width="9" stroke-linejoin="round"/>
  ${M.map(m => sign(m[2], m[0])).join('')}
  ${M.map(m => T(m[2], yAt(m[2]) - lift, S, { face: m[3], ...(m[3] ? {} : { fill: '#C9F0DA' }) })).join('')}
  <rect width="${AW}" height="${AH}" fill="url(#vigl)"/></svg>`;
}

function learnSVG(n) { if (n === 4) return articleFalls(); return `<svg viewBox="0 0 1600 ${LH}" xmlns="http://www.w3.org/2000/svg">${defs}${G}${[learn1, learn2, learn3][n - 1]()}</svg>`; }
