// The landing film. One pure function: filmSVG(t) returns the whole picture at time t (seconds).
// Nothing here reads a clock, so the same code can be played in a browser or rendered frame by frame to a video.
// Needs kit.js (O, TIER, person, tile, mark, defs).
const W = 1600, H = 900;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (u, a, b) => clamp((u - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const eio = p => p < .5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
const eo = p => 1 - (1 - p) ** 3;
const pop = p => p <= 0 ? 0 : p >= 1 ? 1 : 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
const f1 = x => x.toFixed(1);
let HIDE_TEXT = false;

const G = `<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1A36"/><stop offset="1" stop-color="#152C57"/></linearGradient>
  <radialGradient id="lamp" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#FFE2A0" stop-opacity=".62"/><stop offset=".55" stop-color="#FFD98A" stop-opacity=".16"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>
  <radialGradient id="scr" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#8FC2FF" stop-opacity=".6"/><stop offset="1" stop-color="#8FC2FF" stop-opacity="0"/></radialGradient>
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#244B8C"/><stop offset="1" stop-color="#15305E"/></linearGradient>
  <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF1D9"/><stop offset="1" stop-color="#EBD9AE"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE0FF"/><stop offset="1" stop-color="#EAF5FF"/></linearGradient>
  <radialGradient id="vigl" cx="50%" cy="46%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#3A2A10" stop-opacity=".34"/></radialGradient>
</defs>`;
const vig = `<rect width="${W}" height="${H}" fill="url(#vig)"/>`;
const vigl = `<rect width="${W}" height="${H}" fill="url(#vigl)"/>`;

// The line at the bottom-left. It rises in over the first quarter second of its scene.
function line(u, t, o = {}) {
  if (HIDE_TEXT) return '';
  const p = eo(seg(u, .05, .3));
  return `<g transform="translate(0 ${f1((1 - p) * 26)})" opacity="${f1(p)}">${o.n ? `<g transform="translate(88 ${o.sub ? 716 : 770})"><circle cx="34" cy="0" r="34" fill="#2E7DE8" stroke="${O}" stroke-width="7"/><text x="34" y="13" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="36" fill="#fff">${o.n}</text></g>` : ''}
  <text x="${o.n ? 176 : 88}" y="${o.sub ? 738 : (o.n ? 792 : 826)}" font-family="Sora" font-weight="700" font-size="${o.size || 70}" letter-spacing="-2.4" fill="#fff" stroke="${O}" stroke-width="10" paint-order="stroke" stroke-linejoin="round">${t}</text>
  ${o.sub ? `<text x="88" y="826" font-family="Sora" font-weight="600" font-size="46" letter-spacing="-1.2" fill="#fff" stroke="${O}" stroke-width="9" paint-order="stroke" stroke-linejoin="round">${o.sub}</text>` : ''}</g>`;
}
const T = (x, y, s, o = {}, r = 0, sy = s) => `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(r)}) scale(${s.toFixed(3)} ${sy.toFixed(3)})">${tile(o)}</g>`;
const at = (cx, cy, k, inner) => `<g transform="translate(${cx} ${cy}) scale(${k.toFixed(3)}) translate(${-cx} ${-cy})">${inner}</g>`;
const draw = p => `pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - clamp(p)).toFixed(3)}"`;

/* ── shared room pieces ─────────────────────────────────────────────── */
const clock = (x, y, hAng, mAng, trail) => `<g transform="translate(${x} ${y})"><circle r="76" fill="#F4F8FF" stroke="${O}" stroke-width="8"/><g stroke="${O}" stroke-width="5" stroke-linecap="round"><path d="M0 -62v10M62 0h-10M0 62v-10M-62 0h10"/></g>
  <path d="M0 0v-38" stroke="${O}" stroke-width="8" stroke-linecap="round" transform="rotate(${f1(hAng)})"/><path d="M0 0v-54" stroke="#E0652A" stroke-width="5" stroke-linecap="round" transform="rotate(${f1(mAng)})"/><circle r="7" fill="${O}"/>
  ${trail ? `<path d="M-104 -30a110 110 0 0 1 60 -74" fill="none" stroke="#8FC2FF" stroke-width="6" stroke-linecap="round" stroke-dasharray="4 16" opacity="${f1(.8 * trail)}"/>` : ''}</g>`;
const windowMoon = `<g transform="translate(1180 96)"><rect width="300" height="230" rx="16" fill="#07122A" stroke="${O}" stroke-width="7"/><circle cx="212" cy="74" r="34" fill="#F4EBC8"/><circle cx="226" cy="64" r="30" fill="#07122A"/>
  <circle cx="60" cy="54" r="3" fill="#fff"/><circle cx="118" cy="120" r="2.5" fill="#fff"/><circle cx="80" cy="170" r="2" fill="#fff"/><circle cx="250" cy="170" r="2.5" fill="#fff"/><path d="M150 0v230M0 115h300" stroke="${O}" stroke-width="7"/></g>`;
const lampCone = (x, k = 1) => `<path d="M${x} -200l-420 1100h840z" fill="url(#lamp)" opacity="${k.toFixed(2)}"/><path d="M${x} -200v270" stroke="${O}" stroke-width="7"/><path d="M${x - 70} 124q70 -84 140 0z" fill="#1E5CB3" stroke="${O}" stroke-width="7" stroke-linejoin="round"/><ellipse cx="${x}" cy="126" rx="42" ry="10" fill="#FFE9B5"/>`;
const flicker = t => .94 + .06 * Math.sin(t * 9) * Math.sin(t * 3.1);
const desk = `<rect x="0" y="690" width="1600" height="210" fill="#5B3A22"/><rect x="0" y="672" width="1600" height="40" rx="6" fill="#7A4E2D" stroke="${O}" stroke-width="7"/>`;
const laptop = glow => `<path d="M636 672l24 -116q4 -16 20 -16h240q16 0 20 16l24 116z" fill="#C9D3E0" stroke="${O}" stroke-width="7" stroke-linejoin="round"/><g transform="translate(800 610)">${mark(64, { glow })}</g>`;
const mugShape = `<path d="M34 -24q34 4 0 40" fill="none" stroke="${O}" stroke-width="15" stroke-linecap="round"/><path d="M34 -24q34 4 0 40" fill="none" stroke="#F4F8FF" stroke-width="6" stroke-linecap="round"/>
  <rect x="-34" y="-44" width="68" height="74" rx="12" fill="#F4F8FF" stroke="${O}" stroke-width="6"/><rect x="-31" y="-6" width="62" height="16" fill="#2E7DE8"/><ellipse cx="0" cy="-37" rx="25" ry="5.5" fill="#6B4226" stroke="${O}" stroke-width="4"/>`;
const steam = t => `<path d="M-10 -66q-10 -14 2 -26M12 -62q-8 -12 2 -22" fill="none" stroke="#DCE8FB" stroke-width="5" stroke-linecap="round" opacity="${f1(.45 + .3 * Math.sin(t * 3))}" transform="translate(0 ${f1(-4 * ((t * .8) % 1))})"/>`;
const tab = (x, y, r, w, col, up) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect width="${w}" height="${w * .66}" rx="12" fill="#F4F8FF" stroke="${O}" stroke-width="5"/><rect width="${w}" height="26" rx="12" fill="#C9D8F2"/><rect y="14" width="${w}" height="12" fill="#C9D8F2"/>
  <circle cx="16" cy="13" r="4.5" fill="#FF8A7A"/><circle cx="31" cy="13" r="4.5" fill="#FFD98A"/><circle cx="46" cy="13" r="4.5" fill="#7FE3B3"/>
  <path d="${up ? `M16 ${w * .54}l${w * .2} -${w * .14}l${w * .16} ${w * .08}l${w * .2} -${w * .22}l${w * .22} ${w * .06}` : `M16 ${w * .3}l${w * .2} ${w * .1}l${w * .16} -${w * .05}l${w * .2} ${w * .2}l${w * .22} -${w * .03}`}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 ${w * .6}h${w * .5}" stroke="#B8C6DD" stroke-width="5" stroke-linecap="round"/></g>`;
const paper = (x, y, r) => `<g transform="translate(${x} ${f1(y)}) rotate(${r})"><rect width="130" height="20" rx="3" fill="#F7F3E8" stroke="${O}" stroke-width="4"/></g>`;
const note = (x, y, r, c) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect width="62" height="62" rx="5" fill="${c}" stroke="${O}" stroke-width="4"/><path d="M12 20h38M12 34h30M12 46h20" stroke="${O}" stroke-width="3.5" opacity=".55" stroke-linecap="round"/></g>`;
const frame = `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="64" fill="none" stroke="#15305E" stroke-width="56"/><rect x="42" y="42" width="${W - 84}" height="${H - 84}" rx="40" fill="none" stroke="${O}" stroke-width="8"/>
  <path d="M60 60l190 0l-320 320z" fill="#fff" opacity=".10"/>`;
const wallBg = `<rect x="-300" y="-300" width="2600" height="1300" fill="url(#wall)"/><path d="M-300 250h2600" stroke="#0A1730" stroke-width="5" opacity=".7"/>`;

/* ── 1 · the overwhelmed investor ───────────────────────────────────── */
function s1(u) {
  const prog = eio(seg(u, .3, 3.4));
  const tabs = [[120, 360, -9, 250, '#B83232', false, .35], [1210, 392, 8, 250, '#0E8A62', true, .85], [420, 250, 5, 200, '#D99A1C', true, 1.45], [980, 236, -6, 200, '#B83232', false, 2.05]]
    .map(a => { const k = pop(seg(u, a[6], a[6] + .28)); return k ? at(a[0] + a[3] / 2, a[1] + a[3] * .33, k, tab(a[0], a[1], a[2], a[3], a[4], a[5])) : ''; }).join('');
  const drop = (i, t0, x, y, r) => { const p = seg(u, t0, t0 + .22); return p ? `<g opacity="${f1(p)}">${paper(x, y - (1 - eo(p)) * 70, r)}</g>` : ''; };
  const papers = [0, 1, 2, 3, 4, 5, 6].map(i => drop(i, .4 + i * .42, 150 + (i % 2) * 8, 652 - i * 19, i % 2 ? -2 : 2)).join('') + [0, 1, 2, 3, 4].map(i => drop(i, .7 + i * .55, 1270 - (i % 2) * 10, 652 - i * 19, i % 2 ? 3 : -2)).join('');
  const notes = [[330, 590, -8, '#FFE08A', 1.0], [1150, 600, 9, '#FF9FB0', 1.7], [410, 616, 6, '#9FE0FF', 2.4]].map(n => { const k = pop(seg(u, n[4], n[4] + .25)); return k ? at(n[0] + 31, n[1] + 31, k, note(n[0], n[1], n[2], n[3])) : ''; }).join('');
  const tiles = [[530, 640, .8, -14], [596, 652, .62, 10], [690, 330, .62, -18], [928, 318, .7, 14], [610, 420, .5, 12], [1010, 440, .52, -10]]
    .map((a, i) => { const k = pop(seg(u, .5 + i * .45, .8 + i * .45)); return k ? T(a[0], a[1] + Math.sin(u * 3 + i * 1.7) * 6, a[2] * k, { face: 'flat' }, a[3] + Math.sin(u * 2.2 + i) * 6) : ''; }).join('');
  const over = u > .9, sw = (u * .9) % 1;
  return `${wallBg}${windowMoon}${clock(250, 190, 210 + 180 * prog, 360 * 6 * prog, seg(u, .5, 1))}${lampCone(800, flicker(u))}${tabs}
  <g transform="translate(800 ${f1(392 + Math.sin(u * 2.4) * 3)}) scale(1.5)">${person(over ? 'over' : 'calm', { look: Math.sin(u * 5.5) * 5, sweatDy: sw * 46, sweatOp: 1 - sw })}</g>${desk}<ellipse cx="800" cy="500" rx="330" ry="210" fill="url(#scr)" opacity="${f1(.85 + .15 * Math.sin(u * 7))}"/>${laptop(.4 + .15 * Math.sin(u * 4))}
  ${papers}${notes}<g transform="translate(1060 628)">${mugShape}${steam(u)}</g>${tiles}${vig}${line(u, 'So many companies.')}`;
}

/* ── 2 · close on the face ──────────────────────────────────────────── */
function s2(u) {
  const ring = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + u * .85, x = 800 + Math.cos(a) * 560, y = 400 + Math.sin(a) * 250, depth = (Math.sin(a) + 1) / 2; ring.push([Math.sin(a) < 0, T(x, y, lerp(.5, .95, depth), { face: 'flat' }, (i * 37) % 40 - 20 + Math.sin(u * 3 + i) * 8)]); }
  const z = 1 + .05 * seg(u, 0, 3);
  return `${wallBg}<ellipse cx="800" cy="760" rx="760" ry="420" fill="url(#scr)" opacity="${f1(.85 + .15 * Math.sin(u * 7))}"/>
  ${at(800, 450, z, `<ellipse cx="800" cy="400" rx="560" ry="250" fill="none" stroke="#8FC2FF" stroke-width="5" stroke-dasharray="3 22" stroke-dashoffset="${f1(-u * 60)}" opacity=".5"/>
  ${ring.filter(r => r[0]).map(r => r[1]).join('')}
  <g transform="translate(800 ${f1(470 + Math.sin(u * 2.4) * 4)}) scale(3.7)">${person('over', { look: 6 * Math.sign(Math.sin(u * 5)) * Math.min(1, Math.abs(Math.sin(u * 5)) * 3), sweatDy: ((u * .9) % 1) * 30, sweatOp: 1 - ((u * .9) % 1) })}</g>
  ${ring.filter(r => !r[0]).map(r => r[1]).join('')}`)}
  ${vig}${line(u, 'Which ones are worth your time?', { size: 64 })}`;
}

/* ── 3 · the navy card ──────────────────────────────────────────────── */
function s3(u) {
  const full = 'Nobody has that many evenings.', n = Math.floor(seg(u, .15, 1.45) * full.length);
  const caret = n < full.length || Math.floor(u * 3.2) % 2 === 0;
  return `<rect width="${W}" height="${H}" fill="#0B1A36"/><rect width="${W}" height="${H}" fill="url(#vig)" opacity=".7"/>
  <text x="168" y="472" font-family="Sora" font-weight="700" font-size="78" letter-spacing="-2.6" fill="#fff" xml:space="preserve">${full.slice(0, n)}<tspan fill="#2E7DE8" opacity="${caret ? 1 : 0}">|</tspan></text>`;
}

/* ── 4 · into the machine ───────────────────────────────────────────── */
function s4(u) {
  const c = eio(seg(u, .5, 2.3)), z = lerp(1.12, .88, c), L = lerp(120, -58, c);          // the camera pulls back and follows the tiles
  const on = seg(u, 1.3, 1.7), hum = on * Math.sin(u * 38) * 1.6;
  let stream = '';
  for (let i = 0; i < 16; i++) { const s0 = .35 + i * .12; if (u < s0) continue; const p = ((u - s0) % 1.92) / 1.0; if (p >= 1) continue;
    const x = 560 + p * 570, y = lerp(560, 455, p) - Math.sin(p * Math.PI) * 300; stream += T(x, y, (.68 + (i % 3) * .1) * (1 - .35 * seg(p, .85, 1)), { face: 'flat' }, i * 31 % 50 - 25 + p * 200); }
  const win = i => { const lit = seg(u, 1.7 + i * .45, 1.9 + i * .45), fl = lit * (.95 + .05 * Math.sin(u * 7 + i * 2));
    return `<g transform="translate(${1210 + i * 190} 660)"><rect x="-78" y="-84" width="156" height="150" rx="24" fill="#0B1A36" stroke="${O}" stroke-width="6"/><rect x="-66" y="-72" width="132" height="126" rx="15" fill="#22396A"/><rect x="-66" y="-72" width="132" height="126" rx="15" fill="#FFE9B5" opacity="${fl.toFixed(2)}"/><circle cx="-56" cy="-92" r="22" fill="#2E7DE8" stroke="${O}" stroke-width="5"/><text x="-56" y="-83" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="24" fill="#fff">${i + 1}</text></g>`; };
  const led = (y, col, ph) => `<circle cx="1034" cy="${y}" r="11" fill="${on && Math.sin(u * 9 + ph) > -.2 ? col : '#3A4F7A'}" stroke="${O}" stroke-width="4"/>`;
  return `<g transform="translate(${f1(-L * z)} ${f1(900 * (1 - z))}) scale(${z.toFixed(4)})">${wallBg}${lampCone(360, flicker(u))}
  <g transform="translate(300 ${f1(410 + Math.sin(u * 2.4) * 3)}) rotate(${f1(-9 * eo(seg(u, .25, .7)))}) scale(1.5)">${person('over', { look: 5, sweatOp: 0 })}</g>
  <rect x="-300" y="690" width="2600" height="400" fill="#5B3A22"/><rect x="-300" y="672" width="1120" height="40" rx="6" fill="#7A4E2D" stroke="${O}" stroke-width="7"/>
  <g transform="translate(500 640) rotate(${f1(24 * eo(seg(u, 0, .4)))})"><path d="M-150 30l24 -116q4 -16 20 -16h212q16 0 20 16l24 116z" fill="#C9D3E0" stroke="${O}" stroke-width="7" stroke-linejoin="round"/></g>
  ${stream}
  <g transform="translate(0 ${f1(hum)})">
  <ellipse cx="1340" cy="560" rx="520" ry="360" fill="url(#scr)" opacity="${(.15 + on * (.5 + .15 * Math.sin(u * 6))).toFixed(3)}"/>
  <path d="M1010 396h240l-52 96h-136z" fill="#2E7DE8" stroke="${O}" stroke-width="7" stroke-linejoin="round"/><path d="M1038 414h184" stroke="#fff" stroke-width="7" opacity=".35" stroke-linecap="round"/>
  <rect x="960" y="486" width="760" height="330" rx="48" fill="url(#body)" stroke="${O}" stroke-width="8"/><rect x="980" y="502" width="700" height="22" rx="11" fill="#fff" opacity=".12"/>
  <g transform="translate(1040 578)">${mark(92, { glow: .15 + on * (.45 + .12 * Math.sin(u * 6)), spin: on ? (u - 1.3) * 200 : 0 })}</g>
  ${[0, 1, 2].map(win).join('')}${led(668, '#7FE3B3', 0)}${led(708, '#FFD98A', 2)}${led(748, '#FF9A8A', 4)}
  <path d="M1060 816v40M1620 816v40" stroke="${O}" stroke-width="20" stroke-linecap="round"/></g></g>
  ${vig}${line(u, 'So we check every one.')}`;
}

/* ── 5 · financial health ───────────────────────────────────────────── */
function s5(u) {
  const monitor = (x, good, p) => `<g transform="translate(${x} 215)"><rect x="-170" y="-110" width="340" height="220" rx="24" fill="#0B1A36" stroke="${O}" stroke-width="8"/><rect x="-150" y="-90" width="300" height="180" rx="12" fill="#10264D"/>
    <path d="M-140 15h280" stroke="#2A4577" stroke-width="5" stroke-linecap="round"/>
    <path d="${good ? 'M-140 10h60l22 -70l34 130l30 -96l20 36h114' : 'M-140 20h80l16 -16l18 22l16 -8h150'}" fill="none" stroke="${good ? '#3BE08F' : '#8FA0B8'}" stroke-width="${good && p >= 1 ? f1(9 + 2.5 * Math.max(0, Math.sin(u * 9))) : 9}" stroke-linecap="round" stroke-linejoin="round" ${draw(p)}/>
    <path d="M0 110v50" stroke="${O}" stroke-width="10"/></g>`;
  const table = x => `<g transform="translate(${x} 540)"><rect x="-150" y="0" width="300" height="34" rx="12" fill="#F4F8FF" stroke="${O}" stroke-width="7"/><path d="M-110 34v62M110 34v62" stroke="${O}" stroke-width="12" stroke-linecap="round"/></g>`;
  const hop = (p, x0, y0, s0, x1, y1, s1, hgt) => [lerp(x0, x1, p), lerp(y0, y1, p) - Math.sin(p * Math.PI) * hgt, lerp(s0, s1, p)];
  const slots = [[300, 592, 1.15], [200, 596, 1.1], [118, 606, .9], [30, 600, 1.0], [-80, 600, 1.0]];
  const adv = eio(seg(u, .25, .6)) + eio(seg(u, 1.75, 2.1));           // the queue shuffles up each time one leaves
  const slot = k => { const a = clamp(k - adv, 0, 4), i = Math.floor(a), fr = a - i, A = slots[i], B = slots[Math.max(0, i - 0)], C = slots[Math.min(4, i + 1)]; return [lerp(A[0], C[0], fr), lerp(A[1], C[1], fr), lerp(A[2], C[2], fr)]; };
  // tile A: to the left table
  const pa = eio(seg(u, .2, .8)), A = hop(pa, 300, 592, 1.15, 500, 462, 2.1, 150), stampA = u > 1.65, bumpA = 1 + .14 * Math.sin(Math.PI * seg(u, 1.65, 1.95));
  // tile B: to the right table
  const pb = eio(seg(u, 1.7, 2.45)), B0 = slot(1), B = u < 1.7 ? B0 : hop(pb, 300, 592, 1.15, 1100, 468, 2.1, 300), stampB = u > 3.35, slump = eo(seg(u, 3.35, 3.6));
  const queue = [2, 3, 4].map(k => { const s = slot(k); return T(s[0], s[1] + Math.sin(u * 4 + k) * 3, s[2], { face: 'flat' }); }).join('');
  return `<rect width="${W}" height="${H}" fill="url(#cream)"/><rect y="640" width="${W}" height="260" fill="#D9C08A"/><path d="M0 640h1600" stroke="${O}" stroke-width="7"/>
  <g transform="translate(800 150)"><rect x="-46" y="-46" width="92" height="92" rx="18" fill="#fff" stroke="${O}" stroke-width="6"/><path d="M-22 0h44M0 -22v44" stroke="#D5483E" stroke-width="14" stroke-linecap="round"/></g>
  ${monitor(500, true, seg(u, .85, 1.6))}${monitor(1100, false, seg(u, 2.5, 3.3))}${table(500)}${table(1100)}${queue}
  ${T(A[0], A[1] - (stampA ? Math.abs(Math.sin(u * 4.5)) * 7 : 0), A[2] * bumpA, stampA ? { stamp: 'good', glow: 1, fill: '#D6F2E4' } : { face: 'flat' })}
  ${T(B[0], B[1] + slump * 6, B[2], stampB ? { stamp: 'weak', face: 'sad' } : { face: 'flat' }, 0, B[2] * (1 - .08 * slump))}
  ${vigl}${frame}${line(u, 'Financial Health', { n: 1, sub: 'Is the business sound?' })}`;
}

/* ── 6 · valuation ──────────────────────────────────────────────────── */
function s6(u) {
  const hillY = x => 150 + 380 * (1 / (1 + Math.exp(-(x - 760) / 210)));
  let d = 'M0 150'; for (let x = 0; x <= 1600; x += 40) d += `L${x} ${f1(hillY(x))}`;
  const sign = (x, y, t, dash) => `<path d="M330 ${y}h1150" stroke="${O}" stroke-width="6" ${dash ? 'stroke-dasharray="16 14"' : ''}/><g transform="translate(${x} ${y})"><rect x="-150" y="-30" width="300" height="52" rx="12" fill="#fff" stroke="${O}" stroke-width="5"/><text y="6" text-anchor="middle" font-family="Sora" font-weight="700" font-size="27" fill="${O}">${t}</text></g>`;
  // four walkers, deepest first so nobody overtakes; each lights up when it stops
  const W4 = [[1240, .1, { stamp: 'good' }, { stamp: 'good', glow: 1, fill: '#C9F0DA' }], [1060, .45, { stamp: 'weak', face: 'sad' }, { stamp: 'weak', face: 'sad', glow: .12, glowCol: '#C9D3E0' }],
    [880, .8, { stamp: 'good' }, { stamp: 'good', glow: .5, fill: '#E3F5EA' }], [560, 1.15, { stamp: 'good' }, { stamp: 'good' }]];
  let deep = 150;
  const walkers = W4.map((w, i) => { if (u < w[1]) return ''; const x = Math.min(w[0], 250 + 420 * (u - w[1])), moving = x < w[0], y = hillY(x) - 40;
    deep = Math.max(deep, hillY(x)); const since = u - (w[1] + (w[0] - 250) / 420);
    return T(x, y - (moving ? Math.abs(Math.sin(x / 34)) * 12 : 0), 1.15 * (moving ? 1 : 1 + .1 * Math.sin(Math.PI * seg(since, 0, .3)) + (w[3].glow >= .5 && since > .3 ? .03 * w[3].glow * Math.sin(u * 6) : 0)), moving || since < .12 ? w[2] : w[3], moving ? Math.sin(x / 34) * 7 : 0); }).reverse().join('');
  const rp = eo(seg(u, 0, .5));
  const ruler = `<g transform="translate(1500 ${f1(lerp(-330, 130, rp))})"><rect x="-26" y="0" width="52" height="420" rx="8" fill="#FFD98A" stroke="${O}" stroke-width="6"/>${Array.from({ length: 14 }, (_, i) => `<path d="M-26 ${20 + i * 28}h${i % 4 ? 16 : 28}" stroke="${O}" stroke-width="4"/>`).join('')}</g>
    <g transform="translate(1462 ${f1(deep)})" opacity="${f1(rp)}"><path d="M0 0l-34 -18v36z" fill="#E0652A" stroke="${O}" stroke-width="5" stroke-linejoin="round"/></g>`;
  return `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="1280" cy="140" r="${f1(56 + 3 * Math.sin(u * 3))}" fill="#FFE9A8"/><circle cx="1280" cy="140" r="${f1(78 + 6 * Math.sin(u * 3))}" fill="#FFE9A8" opacity=".3"/>
  <path d="${d}L1600 900L0 900z" fill="#8FC48A" stroke="${O}" stroke-width="8" stroke-linejoin="round"/>
  <path d="M230 160v-120" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M230 40q50 ${f1(10 + 8 * Math.sin(u * 6))} 100 34q-50 ${f1(24 - 8 * Math.sin(u * 6))} -100 34z" fill="#E0652A" stroke="${O}" stroke-width="7" stroke-linejoin="round"/>
  ${sign(520, 350, 'Usual fall', true)}${sign(520, 490, 'Deepest fall ever', false)}${ruler}${walkers}
  ${vigl}${frame}${line(u, 'Valuation', { n: 2, sub: 'How far has it fallen, against how far it usually falls?' })}`;
}

/* ── 7 · cycle payoff (the approved moving test) ────────────────────── */
const S7 = (() => {
  const FLOOR = 640, TS = 1.8, HALF = 35 * TS, LX = 520, RX = 1080, TOP = 330, REST = FLOOR - HALF, APEX = TOP - 110;
  const T_HOLD = .35, T_DROP = .45, LAND = T_HOLD + T_DROP, DUR = [.62, .54, .46, .4, .34, .3], COUNT = [2, 5, 8, 12, 16, 20];
  const STARTS = []; let a = LAND; for (const d of DUR) { STARTS.push(a); a += d; } const L_END = a, RISE = .34, TOTAL = L_END + RISE + 1.0;
  const CH = { w: 288, h: 300, top: 235, base: 20, D: 90, trend: 130 };
  const bi = t => STARTS.findIndex((s, k) => t < s + DUR[k]);
  const lyAt = t => { if (t < T_HOLD) return TOP; if (t < LAND) { const u = (t - T_HOLD) / T_DROP; return TOP + (REST - TOP) * u * u; }
    if (t < L_END) { const i = bi(t), u = (t - STARTS[i]) / DUR[i]; return REST - (REST - APEX) * (.86 + .14 * Math.min(1, i / 3)) * 4 * u * (1 - u); }
    const u = Math.min(1, (t - L_END) / RISE); return REST - (REST - APEX) * (1 - (1 - u) * (1 - u)); };
  const ryAt = t => { if (t < T_HOLD) return TOP; if (t < LAND) { const u = (t - T_HOLD) / T_DROP; return TOP + (REST - TOP) * u * u; } const a = t - LAND;
    if (a < .16) return REST; if (a < .62) { const u = (a - .16) / .46; return REST - 46 * 4 * u * (1 - u); } if (a < .95) { const u = (a - .62) / .33; return REST - 14 * 4 * u * (1 - u); } return REST; };
  const penX = t => t < LAND ? .12 * t / LAND : t < L_END ? .12 + .7 * (bi(t) + (t - STARTS[bi(t)]) / DUR[bi(t)]) / DUR.length : .82 + .18 * Math.min(1, (t - L_END) / (TOTAL - L_END));
  const chartY = (y, t, rising) => CH.top + CH.h - CH.base - (REST - y) / (REST - TOP) * CH.D - (rising ? CH.trend * clamp((t - LAND) / (L_END + RISE - LAND)) : 0);
  const chart = (cx, col, fn, t, rising) => { const x0 = cx - CH.w / 2, yb = CH.top + CH.h, ys = yb - CH.base - CH.D, pts = []; let x = x0, y = 0;
    for (let s = 0; s <= t; s += 1 / 120) { x = x0 + penX(s) * CH.w; y = chartY(fn(s), s, rising); pts.push(f1(x) + ',' + f1(y)); }
    x = x0 + penX(t) * CH.w; y = chartY(fn(t), t, rising); pts.push(f1(x) + ',' + f1(y));
    return `<rect x="${x0 - 16}" y="${CH.top - 20}" width="${CH.w + 32}" height="${CH.h + 40}" rx="18" fill="#FFFDF6" stroke="${O}" stroke-width="6"/>
    <path d="M${x0} ${CH.top + 75}h${CH.w}M${x0} ${CH.top + 150}h${CH.w}M${x0} ${CH.top + 225}h${CH.w}" stroke="${O}" stroke-width="2" opacity=".1"/><path d="M${x0} ${ys}h${CH.w}" stroke="${O}" stroke-width="4" stroke-dasharray="6 10" opacity=".35"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${f1(x)}" cy="${f1(y)}" r="10" fill="${col}" stroke="${O}" stroke-width="5"/>`; };
  const counter = (x, n, good) => `<g transform="translate(${x} 150)"><rect x="-84" y="-40" width="168" height="80" rx="20" fill="${good ? '#0E8A62' : '#8C97A8'}" stroke="${O}" stroke-width="6"/><text y="15" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="44" fill="#fff">×${n}</text></g>`;
  const place = (x, y, sx, sy, inner, op = 1) => `<g transform="translate(${x} ${f1(y + HALF * (1 - sy))}) scale(${(TS * sx).toFixed(3)} ${(TS * sy).toFixed(3)})" opacity="${op.toFixed(2)}">${inner}</g>`;
  function render(u) {
    const t = Math.min(u, TOTAL - .001);
    let ly = lyAt(t), sx = 1, sy = 1, n = 0;
    if (t >= T_HOLD && t < LAND) { const q = (t - T_HOLD) / T_DROP; sy = 1 + .12 * q; sx = 1 - .08 * q; }
    else if (t >= LAND && t < L_END) { const i = bi(t), q = (t - STARTS[i]) / DUR[i], edge = Math.max(0, 1 - Math.min(q, 1 - q) * 9); n = COUNT[i]; sy = 1 - .22 * edge; sx = 1 + .18 * edge; }
    else if (t >= L_END) n = 20;
    const glow = Math.min(1, n / 10), done = t > L_END + RISE * .6;
    let ry = ryAt(t), rsx = 1, rsy = 1, rn = 0;
    if (t >= T_HOLD && t < LAND) { const q = (t - T_HOLD) / T_DROP; rsy = 1 + .12 * q; rsx = 1 - .08 * q; }
    else if (t >= LAND) { const a = t - LAND; rn = 1;
      if (a < .16) { const q = a / .16; rsy = 1 - .42 * Math.sin(q * Math.PI / 2); rsx = 1 + .34 * Math.sin(q * Math.PI / 2); }
      else if (a < .62) { const q = (a - .16) / .46; rsy = .72 + .2 * Math.sin(q * Math.PI); rsx = 1.2 - .12 * Math.sin(q * Math.PI); }
      else if (a < .95) { rn = 2; rsy = .66; rsx = 1.26; } else { rn = 2; rsy = .62; rsx = 1.3; } }
    const sad = t > LAND + .1, da = t - LAND, dust = da > 0 && da < .5 ? .5 * (1 - da / .5) : (da > .95 && da < 1.3 ? .35 * (1 - (da - .95) / .35) : 0);
    return `<rect width="${W}" height="${H}" fill="url(#cream)"/><rect y="${FLOOR}" width="${W}" height="${H - FLOOR}" fill="#D9C08A"/><path d="M0 ${FLOOR}h${W}" stroke="${O}" stroke-width="7"/>
    <path d="M800 110v530" stroke="${O}" stroke-width="5" stroke-dasharray="10 16" opacity=".3"/>
    ${chart(250, '#0E8A62', lyAt, t, true)}${chart(1350, '#B83232', ryAt, t, false)}
    <ellipse cx="${LX}" cy="${FLOOR + 8}" rx="${f1(70 - 34 * Math.min(1, (REST - ly) / 400))}" ry="12" fill="${O}" opacity=".18"/><ellipse cx="${RX}" cy="${FLOOR + 8}" rx="70" ry="12" fill="${O}" opacity=".18"/>
    ${glow < 1 ? place(LX, ly, sx, sy, tile({ stamp: 'good' }), 1) : ''}${glow > 0 ? place(LX, ly, sx, sy, tile({ stamp: 'good', glow: 1, fill: '#C9F0DA' }), glow) : ''}
    ${place(RX, ry, rsx, rsy, tile({ stamp: 'weak', face: sad ? 'sad' : 'flat' }))}
    <g stroke="${O}" stroke-width="6" stroke-linecap="round" opacity="${dust.toFixed(2)}"><path d="M${RX - 150} 628l-46 -20M${RX + 150} 628l46 -20M${RX - 120} 652l-60 6M${RX + 120} 652l60 6"/></g>
    ${done ? `<g stroke="#0E8A62" stroke-width="8" stroke-linecap="round" transform="translate(${LX} ${f1(ly)})"><path d="M-84 -60l-26 -26M84 -60l26 -26M0 -96v-34"/></g>` : ''}
    ${counter(250, n, true)}${counter(1350, rn, false)}
    ${vigl}${frame}${line(u, 'Cycle Payoff', { n: 3, sub: 'When it falls, how well does it bounce back?' })}`;
  }
  return { render, TOTAL };
})();

/* ── 8 · scored and ranked ──────────────────────────────────────────── */
function s8(u) {
  // tiles leave the chute in no particular order; each lands in its ranked place and the others shuffle along to make room
  const out = [[63, 2], [84, 0], [44, 3], [74, 1], [29, 4], [81, 0], [58, 2], [69, 1], [38, 3], [52, 2]], GAP = .25, T0 = .25, FLY = .36;
  const e = j => T0 + j * GAP;
  const tiles = out.map((r, j) => { if (u < e(j)) return null;
    let rank = 0; out.forEach((q, k) => { if (q[0] > r[0]) rank += eio(seg(u, e(k), e(k) + .22)); });
    const p = eio(seg(u, e(j), e(j) + FLY)), tx = 420 + rank * 118, x = lerp(356, tx, p), y = lerp(346, 458, p) - Math.sin(p * Math.PI) * 130;
    return [x, T(x, y, 1.35 * (1 + .1 * Math.sin(Math.PI * seg(u, e(j) + FLY, e(j) + FLY + .2))), { fill: TIER[r[1]], score: p > .95 ? r[0] : undefined, face: r[1] > 3 ? 'sad' : r[1] > 1 ? 'flat' : undefined }, (1 - p) * 40)]; }).filter(Boolean);
  const count = out.filter((_, j) => u > e(j) + FLY).length;
  const nums = Array.from({ length: count }, (_, i) => `<text x="${420 + i * 118}" y="612" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="30" fill="#DCE8FB">${i + 1}</text>`).join('');
  // the chute never empties: the next tile is always tumbling down it
  const nextJ = Math.max(0, Math.floor((u - T0) / GAP) + 1), q = clamp((u - (e(nextJ) - GAP)) / GAP), nt = TIER[nextJ < out.length ? out[nextJ][1] : [2, 3, 1][nextJ % 3]];   // the tile in the chute is the one that flies next
  const hum = Math.sin(u * 38) * 1.4;
  return `${wallBg}<ellipse cx="900" cy="380" rx="820" ry="330" fill="url(#scr)" opacity="${(.5 + .12 * Math.sin(u * 5)).toFixed(3)}"/>
  <g transform="translate(0 ${f1(hum)})"><rect x="-140" y="120" width="330" height="420" rx="48" fill="url(#body)" stroke="${O}" stroke-width="8"/><g transform="translate(70 250)">${mark(110, { glow: .45 + .12 * Math.sin(u * 6), spin: u * 200 })}</g>
  <path d="M186 300h90l150 110v36h-240z" fill="#2E7DE8" stroke="${O}" stroke-width="7" stroke-linejoin="round"/>
  ${T(lerp(236, 356, q), lerp(258, 346, q), 1.0, { fill: nt, face: 'flat' }, 40 * (1 - q) + 40)}</g>
  <rect x="330" y="520" width="1230" height="30" rx="10" fill="#7A4E2D" stroke="${O}" stroke-width="7"/><path d="M400 550v70M1500 550v70" stroke="${O}" stroke-width="14" stroke-linecap="round"/>
  ${tiles.sort((a, b) => b[0] - a[0]).map(t => t[1]).join('')}${nums}
  ${vig}${line(u, 'Scored. Ranked.')}`;
}

/* ── 9 · the shortlist ──────────────────────────────────────────────── */
function s9(u) {
  const rows = [['GOOGL', 81, 0, 'High Conviction'], ['NVDA', 66, 1, 'Constructive'], ['META', 63, 2, 'Neutral'], ['AMZN', 62, 2, 'Neutral'], ['MSFT', 59, 2, 'Neutral'], ['AAPL', 57, 2, 'Neutral'], ['TSLA', 57, 2, 'Neutral']];
  const pp = pop(seg(u, .3, .85)), sip = eio(seg(u, 1.3, 1.9)) - eio(seg(u, 2.7, 3.3));
  const panel = pp ? `<g transform="translate(${f1(lerp(520, 760, pp))} ${f1(lerp(600, 170, pp))}) scale(${pp.toFixed(3)})"><rect width="600" height="476" rx="22" fill="#F4F8FF" stroke="${O}" stroke-width="7"/><rect width="600" height="56" rx="22" fill="#1A3A6E"/><rect y="30" width="600" height="26" fill="#1A3A6E"/>
    <text x="24" y="37" font-family="Sora" font-weight="700" font-size="22" fill="#fff">Results</text><text x="576" y="36" text-anchor="end" font-family="JetBrains Mono" font-size="15" fill="#C9D8F2">Real run · 9 Oct 2026</text>
    ${rows.map((r, i) => { const a = seg(u, .95 + i * .13, 1.12 + i * .13); return `<g transform="translate(${f1((1 - eo(a)) * 30)} ${70 + i * 57})" opacity="${f1(a)}">${i ? `<path d="M20 0h560" stroke="#D5DEEA" stroke-width="2"/>` : ''}<text x="28" y="38" font-family="JetBrains Mono" font-size="20" fill="#626B77">${i + 1}</text><text x="70" y="38" font-family="JetBrains Mono" font-weight="700" font-size="22" fill="${O}">${r[0]}</text>
      <text x="190" y="38" font-family="Sora" font-weight="600" font-size="19" fill="#4A5568">${r[3]}</text><rect x="500" y="10" width="72" height="38" rx="10" fill="${TIER[r[2]]}"/><text x="536" y="37" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="22" fill="#fff">${r[1]}</text></g>`; }).join('')}
    <ellipse cx="300" cy="128" rx="322" ry="76" fill="none" stroke="#2E7DE8" stroke-width="7" stroke-linecap="round" ${draw(eio(seg(u, 2.9, 3.7)))} transform="rotate(-1.5 300 126)"/></g>` : '';
  // the mug, the hand on its handle, and the sleeve that reaches it from behind the laptop
  const mx = lerp(318, 452, sip), my = lerp(628, 502, sip), mr = 20 * sip, ca = Math.cos(mr * Math.PI / 180), sa = Math.sin(mr * Math.PI / 180);
  const hx = mx + 52 * ca - 8 * sa, hy = my + 52 * sa + 8 * ca;
  const arm = `<path d="M478 590Q${f1((478 + hx) / 2 + 30)} ${f1((590 + hy) / 2 + 26)} ${f1(hx + 6)} ${f1(hy + 8)}" fill="none" stroke="${O}" stroke-width="46" stroke-linecap="round"/><path d="M478 590Q${f1((478 + hx) / 2 + 30)} ${f1((590 + hy) / 2 + 26)} ${f1(hx + 6)} ${f1(hy + 8)}" fill="none" stroke="#1E5CB3" stroke-width="36" stroke-linecap="round"/>`;
  return `${wallBg}${windowMoon}${clock(250, 190, 212, 30 + u * 1.2, 0)}${lampCone(800, flicker(u))}
  <g transform="translate(520 ${f1(400 + Math.sin(u * 2) * 3)}) scale(1.5)">${person('relieved')}</g>${desk}
  ${arm}<g transform="translate(-280 0)">${laptop(.45 + .15 * Math.sin(u * 4))}</g>
  <ellipse cx="1050" cy="430" rx="420" ry="330" fill="url(#scr)" opacity="${f1(pp * (.9 + .1 * Math.sin(u * 5)))}"/>${panel}
  <g transform="translate(${f1(mx)} ${f1(my)}) rotate(${f1(mr)})">${mugShape}${sip < .05 ? steam(u) : ''}</g>
  <ellipse cx="${f1(hx)}" cy="${f1(hy)}" rx="21" ry="19" fill="#F3CFA8" stroke="${O}" stroke-width="5"/>
  ${vig}${line(u, 'Your shortlist. In minutes.')}`;
}

/* ── the cut list ───────────────────────────────────────────────────── */
const SCENES = [[s1, 4.0], [s2, 3.0], [s3, 2.5], [s4, 4.0], [s5, 4.2], [s6, 4.2], [u => S7.render(u), S7.TOTAL], [s8, 3.6], [s9, 4.7]];
const STARTS_AT = []; { let a = 0; for (const s of SCENES) { STARTS_AT.push(a); a += s[1]; } var FILM_LENGTH = a; }
function filmSVG(t) {
  t = ((t % FILM_LENGTH) + FILM_LENGTH) % FILM_LENGTH;
  let i = SCENES.length - 1; while (i > 0 && t < STARTS_AT[i]) i--;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defs}${G}${SCENES[i][0](t - STARTS_AT[i])}</svg>`;
}
