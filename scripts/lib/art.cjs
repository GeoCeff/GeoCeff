// Every picture in the README. Each builder returns an SVG string; `animated:false` gives the
// reduced-motion still (same layout, no SMIL).
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { SVG, icon, drawIcon, fadeIn, typing, esc } = require('./svg.cjs');
const { font } = require('./text.cjs');
const { NIGHT } = require('./theme.cjs');

const ART = path.join(__dirname, '..', '..', 'art');
// decode indexed portrait.png once into an active silhouette cell grid + outer sky stars
const _pGrids = new Map();
function portraitCells(cols = 64, rows = 44) {
  const key = `${cols}x${rows}`;
  if (_pGrids.has(key)) return _pGrids.get(key);
  const b = fs.readFileSync(path.join(ART, 'portrait.png'));
  let pos = 8, w = 0, h = 0, plte, trns, idats = [];
  while (pos < b.length) {
    const len = b.readUInt32BE(pos), type = b.slice(pos + 4, pos + 8).toString('ascii');
    const data = b.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idats.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idats)), px = Buffer.alloc(w * h), stride = w + 1;
  const paeth = (a, bc, c) => {
    const p = a + bc - c, pa = Math.abs(p - a), pb = Math.abs(p - bc), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : (pb <= pc ? bc : c);
  };
  for (let y = 0; y < h; y++) {
    const f = raw[y * stride], rOff = y * stride + 1, oOff = y * w;
    for (let x = 0; x < w; x++) {
      const v = raw[rOff + x], a = x ? px[oOff + x - 1] : 0, up = y ? px[oOff - w + x] : 0, ul = (x && y) ? px[oOff - w + x - 1] : 0;
      px[oOff + x] = f === 0 ? v : f === 1 ? (v + a) & 255 : f === 2 ? (v + up) & 255 : f === 3 ? (v + ((a + up) >> 1)) & 255 : (v + paeth(a, up, ul)) & 255;
    }
  }
  const cells = [], occ = Array.from({ length: rows }, () => new Uint8Array(cols)), cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sA = 0, sL = 0, n = 0;
      for (let yy = Math.floor(r * ch); yy < Math.floor((r + 1) * ch); yy++) {
        for (let xx = Math.floor(c * cw); xx < Math.floor((c + 1) * cw); xx++) {
          const idx = px[yy * w + xx], al = trns && idx < trns.length ? trns[idx] : 255;
          const R = plte[idx * 3], G = plte[idx * 3 + 1], B = plte[idx * 3 + 2];
          sA += al; sL += (.2 * R + .5 * G + .3 * B) * (al / 255); n++;
        }
      }
      const lAvg = sL / n;
      if (sA / n > 14 && lAvg > 12) { cells.push({ c, r, lum: lAvg }); occ[r][c] = 1; }
    }
  }
  // deterministic sky stars outside silhouette (kept 1 cell away from borders & body)
  const stars = [];
  for (let r = 2; r < Math.floor(rows * 0.62); r += 2) {
    for (let c = 2; c < cols - 2; c += 3) {
      const hsh = (Math.imul(c + 7, 73856093) ^ Math.imul(r + 13, 19349663)) >>> 0;
      if (hsh % 11 !== 0) continue;
      let near = false;
      for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -2; dc <= 2; dc++) if (occ[r + dr]?.[c + dc]) near = true;
      if (!near) stars.push({ c, r, phase: (hsh % 628) / 100 });
    }
  }
  const out = { cols, rows, cells, stars };
  _pGrids.set(key, out);
  return out;
}

const dataUri = (file, mime) => `data:${mime};base64,${fs.readFileSync(path.join(ART, file)).toString('base64')}`;

// ---------------------------------------------------------------- pictograms (24-unit grid, stroked)
const PICTO = {
  chart: '<path d="M3 20.5h18"/><path d="M4.5 16l4.5-4.5 3.5 3 7-7.5"/><path d="M15.5 7h4v4"/>',
  controller: '<path d="M6.5 7.5h11a3.8 3.8 0 013.7 4.7l-.8 3.5a2.1 2.1 0 01-3.6.9l-2-2.1H9.2l-2 2.1a2.1 2.1 0 01-3.6-.9l-.8-3.5a3.8 3.8 0 013.7-4.7z"/><path d="M7.6 10v3.2M6 11.6h3.2"/><circle cx="15" cy="12.6" r="1" fill="currentColor" stroke="none"/><circle cx="17.2" cy="10.6" r="1" fill="currentColor" stroke="none"/>',
  browser: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M2.5 9h19"/><path d="M5.5 6.8h.01M8 6.8h.01M10.5 6.8h.01" stroke-width="2.2"/><path d="M7 13.5h6M7 16.5h9"/>',
  terminal: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M6.5 10l3 2.5-3 2.5"/><path d="M12 15.5h5"/>',
  code: '<rect x="2.5" y="3.5" width="19" height="17" rx="2.5"/><path d="M2.5 8h19"/><path d="M9.5 11.5L7 14l2.5 2.5M14.5 11.5L17 14l-2.5 2.5"/>',
  layers: '<path d="M12 3.5l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16l9 4.5 9-4.5"/>',
  bars: '<path d="M3.5 20.5h17"/><path d="M6.5 17v-5M10.5 17V7M14.5 17v-7M18.5 17V4.5"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3 6.5l9 6.5 9-6.5"/>',
};
function picto(name, x, y, size, color, bodyOverride = '') {
  const k = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${k})" fill="none" stroke="${color}" color="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${bodyOverride || PICTO[name]}</g>`;
}
function projectPicto(name, x, y, size, color, animated) {
  if (!animated) return picto(name, x, y, size, color);
  if (name === 'chart') {
    return picto(name, x, y, size, color,
      '<path d="M3 20.5h18"/>'
      + '<path d="M4.5 16l4.5-4.5 3.5 3 7-7.5" stroke-dasharray="28"><animate attributeName="stroke-dashoffset" values="28;0;0;28" keyTimes="0;.42;.85;1" calcMode="spline" keySplines=".3 .8 .3 1;0 0 1 1;.4 0 .6 1" dur="3.6s" begin="-1.6s" repeatCount="indefinite"/></path>'
      + '<path d="M15.5 7h4v4"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.32;.45;.85;1" dur="3.6s" begin="-1.6s" repeatCount="indefinite"/></path>'
      + '<circle cx="19.5" cy="7" r="1.5" fill="currentColor" stroke="none"><animate attributeName="opacity" values="0;0;1;.3;1;0" keyTimes="0;.38;.46;.65;.84;1" dur="3.6s" begin="-1.6s" repeatCount="indefinite"/></circle>');
  }
  if (name === 'controller') {
    return picto(name, x, y, size, color,
      '<g><path d="M6.5 7.5h11a3.8 3.8 0 013.7 4.7l-.8 3.5a2.1 2.1 0 01-3.6.9l-2-2.1H9.2l-2 2.1a2.1 2.1 0 01-3.6-.9l-.8-3.5a3.8 3.8 0 013.7-4.7z"/>'
      + '<path d="M7.6 10v3.2M6 11.6h3.2"/>'
      + '<circle cx="15" cy="12.6" r="1" fill="currentColor" stroke="none"><animate attributeName="opacity" values="1;.25;1" dur="1.4s" calcMode="discrete" repeatCount="indefinite"/></circle>'
      + '<circle cx="17.2" cy="10.6" r="1" fill="currentColor" stroke="none"><animate attributeName="opacity" values=".25;1;.25" dur="1.4s" calcMode="discrete" repeatCount="indefinite"/></circle>'
      + '<animateTransform attributeName="transform" type="rotate" values="0 12 12;-7 12 12;6 12 12;0 12 12" keyTimes="0;.3;.7;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" dur="3.4s" repeatCount="indefinite"/></g>');
  }
  if (name === 'browser') {
    return picto(name, x, y, size, color,
      '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M2.5 9h19"/>'
      + '<circle cx="5.5" cy="6.8" r=".85" fill="currentColor" stroke="none"><animate attributeName="opacity" values=".35;1;.35" dur="1.8s" begin="0s" repeatCount="indefinite"/></circle>'
      + '<circle cx="8" cy="6.8" r=".85" fill="currentColor" stroke="none"><animate attributeName="opacity" values=".35;1;.35" dur="1.8s" begin=".3s" repeatCount="indefinite"/></circle>'
      + '<circle cx="10.5" cy="6.8" r=".85" fill="currentColor" stroke="none"><animate attributeName="opacity" values=".35;1;.35" dur="1.8s" begin=".6s" repeatCount="indefinite"/></circle>'
      + '<path d="M7 13h6"><animate attributeName="opacity" values="1;.25;1" dur="2.6s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0" dur="2.6s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>'
      + '<path d="M7 16h9"><animate attributeName="opacity" values=".3;1;.3" dur="2.6s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 1;0 0;0 1" dur="2.6s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>');
  }
  if (name === 'terminal') {
    return picto(name, x, y, size, color,
      '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/>'
      + '<path d="M6.5 10l3 2.5-3 2.5"><animateTransform attributeName="transform" type="translate" values="0 0;1.6 0;0 0" keyTimes="0;.4;1" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .6 1" dur="2.2s" repeatCount="indefinite"/></path>'
      + '<path d="M12 15.5h5"><animate attributeName="opacity" values="1;0;1" dur="1.05s" calcMode="discrete" repeatCount="indefinite"/></path>');
  }
  return picto(name, x, y, size, color);
}

function headerPicto(name, x, y, size, color, animated) {
  if (!animated) return picto(name, x, y, size, color);
  if (name === 'bars') {
    const bar = (bx, by, len, minS, dur, begin) =>
      `<path d="M${bx} 17V${by}"><animateTransform attributeName="transform" type="scale" values="1 1;1 ${minS};1 1" additive="sum" dur="${dur}s" begin="${begin}s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>`;
    // oscillate individual bars anchored from baseline y=17 via transform-origin trick (translate 0 17, scale, translate 0 -17)
    const animBar = (bx, topY, dur, begin) =>
      `<g transform="translate(${bx} 17)"><path d="M0 0V${topY - 17}"><animateTransform attributeName="transform" type="scale" values="1 1;1 .45;1 1.12;1 1" dur="${dur}s" begin="${begin}s" calcMode="spline" keyTimes="0;.35;.7;1" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path></g>`;
    return picto(name, x, y, size, color,
      '<path d="M3.5 20.5h17"/>'
      + animBar(6.5, 12, 2.2, 0)
      + animBar(10.5, 7, 2.5, .4)
      + animBar(14.5, 10, 2.0, .8)
      + animBar(18.5, 4.5, 2.7, 1.2));
  }
  if (name === 'code') {
    return picto(name, x, y, size, color,
      '<rect x="2.5" y="3.5" width="19" height="17" rx="2.5"/><path d="M2.5 8h19"/>'
      + '<circle cx="5.2" cy="5.8" r=".75" fill="currentColor" stroke="none"><animate attributeName="opacity" values="1;.25;1" dur="1.6s" calcMode="discrete" repeatCount="indefinite"/></circle>'
      + '<path d="M9.5 11.5L7 14l2.5 2.5"><animateTransform attributeName="transform" type="translate" values="0 0;-1 0;0 0" dur="2.4s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>'
      + '<path d="M14.5 11.5L17 14l-2.5 2.5"><animateTransform attributeName="transform" type="translate" values="0 0;1 0;0 0" dur="2.4s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>');
  }
  if (name === 'layers') {
    return picto(name, x, y, size, color,
      '<path d="M12 3.5l9 4.5-9 4.5-9-4.5z"><animateTransform attributeName="transform" type="translate" values="0 0;0 -1.2;0 0" dur="2.8s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>'
      + '<path d="M3 12l9 4.5 9-4.5"><animate attributeName="opacity" values=".55;1;.55" dur="2.8s" repeatCount="indefinite"/></path>'
      + '<path d="M3 16l9 4.5 9-4.5"><animateTransform attributeName="transform" type="translate" values="0 0;0 1;0 0" dur="2.8s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>');
  }
  if (name === 'mail') {
    return picto(name, x, y, size, color,
      '<g><rect x="2.5" y="5" width="19" height="14" rx="2.5"/>'
      + '<path d="M3 6.5l9 6.5 9-6.5"><animate attributeName="opacity" values="1;.45;1" dur="2.4s" repeatCount="indefinite"/></path>'
      + '<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.3;0 0" dur="3.2s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></g>');
  }
  return picto(name, x, y, size, color);
}

// corner brackets, the profile's signature frame detail
const brackets = (x, y, w, h, len, color, op = .65, animated = false) =>
  `<path d="M${x} ${y + len}V${y}h${len}M${x + w - len} ${y}h${len}v${len}M${x + w} ${y + h - len}v${len}h-${len}M${x + len} ${y + h}h-${len}v-${len}" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="1.5">`
  + (animated ? `<animate attributeName="stroke-opacity" values="${+(op * .6).toFixed(2)};${Math.min(.95, +(op * 1.45).toFixed(2))};${+(op * .6).toFixed(2)}" dur="4.8s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>` : '</path>');

// ---------------------------------------------------------------- banner
function banner(profile, { animated = true, narrow = false } = {}) {
  const t = NIGHT;
  const W = narrow ? 600 : 1000, H = narrow ? 632 : 400;
  const s = new SVG(W, H, `${profile.headline}: ${profile.role}. Open the portfolio.`,
    `${profile.name}'s banner: his blue ASCII portrait over the portfolio forest at night, ${profile.headline}, roles, and a terminal prompt that opens ${profile.portfolioShort}.`);
  s.def(`<clipPath id="frame"><rect width="${W}" height="${H}" rx="18"/></clipPath>`);
  s.def(`<linearGradient id="shade"${narrow ? ' x2="0" y2="1"' : ''}><stop stop-color="#010712" stop-opacity="${narrow ? .32 : .94}"/><stop offset=".52" stop-color="#010712" stop-opacity="${narrow ? .74 : .68}"/><stop offset="1" stop-color="#010712" stop-opacity="${narrow ? .96 : .15}"/></linearGradient>`);
  s.def('<linearGradient id="fade" x2="0" y2="1"><stop stop-color="#010712" stop-opacity=".25"/><stop offset="1" stop-color="#010712" stop-opacity=".75"/></linearGradient>');
  s.def('<linearGradient id="accentLine"><stop stop-color="#6ba9ff"/><stop offset="1" stop-color="#6ba9ff" stop-opacity="0"/></linearGradient>');
  s.def('<radialGradient id="glow"><stop stop-color="#3186ff" stop-opacity=".24"/><stop offset="1" stop-color="#3186ff" stop-opacity="0"/></radialGradient>');
  s.def('<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#6ba9ff" stroke-opacity=".09"/></pattern>');

  const forest = narrow
    ? `<image href="${dataUri('forest.jpg', 'image/jpeg')}" x="-250" y="0" width="1125" height="632" preserveAspectRatio="none"/>`
    : `<image href="${dataUri('forest.jpg', 'image/jpeg')}" x="0" y="-81" width="1000" height="562" preserveAspectRatio="none"/>`;
  const P = narrow ? { x: 164, y: 68, w: 272, h: 268 } : { x: 652, y: 68, w: 276, h: 272 };
  const portraitImg = `<image id="asc" href="${dataUri('portrait.png', 'image/png')}" x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}"/>`;
  const portrait = portraitImg;

  const L = narrow ? 36 : 66; // left text column
  const parts = [];
  parts.push(forest, `<rect width="${W}" height="${H}" fill="url(#shade)"/>`, `<rect width="${W}" height="${H}" fill="url(#fade)"/>`);
  parts.push(`<rect x="30" y="56" width="${narrow ? 540 : 590}" height="${H - 94}" fill="url(#grid)" opacity=".45"/>`);
  if (animated) {
    // subtle drifting night-forest firefly particles behind portrait and copy
    const motes = narrow
      ? [[96, 260, 1.5, 8.2, 0], [490, 210, 1.8, 9.6, 1.4], [210, 140, 1.4, 7.8, 2.5], [440, 310, 1.6, 10.4, .8], [130, 560, 1.5, 9, 3.1]]
      : [[560, 140, 1.6, 8.4, 0], [920, 120, 1.8, 9.6, 1.3], [610, 310, 1.5, 7.6, 2.2], [890, 290, 1.7, 10.2, .7], [510, 220, 1.4, 8.8, 3.4], [740, 90, 1.5, 9.2, 1.9]];
    for (const [mx, my, mr, mdur, mbg] of motes) {
      parts.push(`<circle cx="${mx}" cy="${my}" r="${mr}" fill="#9dccff" opacity="0"><animateTransform attributeName="transform" type="translate" values="0 10;0 -26" dur="${mdur}s" begin="-${mbg}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.75;0" dur="${mdur}s" begin="-${mbg}s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></circle>`);
    }
  }
  const glow = `<ellipse cx="${P.x + P.w / 2}" cy="${P.y + P.h / 2}" rx="${P.w * .58}" ry="${P.h * .55}" fill="url(#glow)">`
    + (animated ? '<animate attributeName="opacity" values=".65;1;.65" dur="4.6s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></ellipse>' : '</ellipse>');
  parts.push(glow);
  if (animated) {
    // 8 asynchronous cell groups x 5 randomized character states -> smooth ~25 updates/sec shimmer preserving portrait shape
    const { cols, rows, cells, stars } = portraitCells(54, 40);
    const cellW = P.w / cols, cellH = P.h / rows, fSz = cellH * .92;
    const RAMP = '.:-=+*#%@';
    const COLORS = ['#4c8ef0', '#6fb0ff', '#a3d1ff', '#e0eeff', '#ffffff'];
    const gMap = {};
    let upm = 1000;
    for (const ch of new Set([...RAMP, '*'])) {
      const info = s.g.glyph(ch, 'mono');
      gMap[ch] = info.id;
      upm = info.upm;
    }
    const sc = +(fSz / upm).toFixed(5);
    const hash = (a, b, k) => {
      let x = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263) + Math.imul(k + 1, 1442695041)) >>> 0;
      x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
      return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
    };

    const G = 8, S = 5;
    const DURS = [1.05, 1.22, 1.38, 1.54, 1.71, 1.87, 2.04, 2.21];
    const kt = Array.from({ length: S }, (_, i) => +(i / S).toFixed(3)).join(';');
    const grouped = Array.from({ length: G }, () => []);
    for (const cell of cells) {
      const g = Math.floor(hash(cell.c, cell.r, 91) * G);
      grouped[g].push(cell);
    }

    const out = [];
    for (let g = 0; g < G; g++) {
      const dur = `${DURS[g]}s`;
      const begin = `-${+((g * 0.19) % DURS[g]).toFixed(2)}s`;
      for (let st = 0; st < S; st++) {
        const phi = (2 * Math.PI * st) / S;
        const buckets = Array.from({ length: COLORS.length }, () => []);
        for (const { c, r, lum } of grouped[g]) {
          const base = Math.pow(Math.min(1, Math.max(0, (lum - 10) / 110)), 0.62);
          const u = c / cols, v = r / rows;
          const wave = 0.08 * Math.sin(u * 8.0 + v * 3.2 - phi);
          const rand = (hash(c, r, st * 13 + g) - 0.5) * 0.28; // randomized character swap within local density band
          const glint = base > 0.58 && hash(c, r, st * 29 + 7) > 0.92;
          const m = Math.max(0.10, Math.min(1, base + wave + rand + (glint ? 0.14 : 0)));
          const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(m * RAMP.length))];
          const ci = glint ? 4 : Math.min(3, Math.floor(m * 3.85));
          const gx = Math.round((c * cellW) / sc), gy = Math.round(((r + 0.82) * cellH) / sc);
          if (gMap[ch]) buckets[ci].push(`<use href="#${gMap[ch]}" x="${gx}" y="${gy}"/>`);
        }
        const vis = Array.from({ length: S }, (_, i) => (i === st ? 'visible' : 'hidden')).join(';');
        const layers = buckets.map((b, ci) => b.length ? `<g fill="${COLORS[ci]}">${b.join('')}</g>` : '').join('');
        out.push(`<g transform="translate(${P.x} ${P.y}) scale(${sc})" visibility="${st === 0 ? 'visible' : 'hidden'}">${layers}<animate attributeName="visibility" values="${vis}" keyTimes="${kt}" calcMode="discrete" dur="${dur}" begin="${begin}" repeatCount="indefinite"/></g>`);
      }
    }

    // staggered randomized sky star twinkles outside portrait silhouette
    const starBuckets = Array.from({ length: 4 }, () => []);
    for (const st of stars) starBuckets[Math.floor(hash(st.c, st.r, 53) * 4)].push(st);
    for (let b = 0; b < 4; b++) {
      const sdur = `${(1.8 + b * 0.45).toFixed(2)}s`;
      const sbegin = `-${(b * 0.37).toFixed(2)}s`;
      for (let stIdx = 0; stIdx < 3; stIdx++) {
        const layers = [[], [], []];
        for (const st of starBuckets[b]) {
          const r = hash(st.c, st.r, stIdx * 17 + 3);
          if (r < 0.42) continue;
          const ch = r > 0.82 ? '*' : '.';
          const ci = r > 0.90 ? 2 : r > 0.68 ? 1 : 0;
          const gx = Math.round((st.c * cellW) / sc), gy = Math.round(((st.r + 0.82) * cellH) / sc);
          if (gMap[ch]) layers[ci].push(`<use href="#${gMap[ch]}" x="${gx}" y="${gy}"/>`);
        }
        const fills = ['#6fb0ff', '#e0eeff', '#ffffff'];
        const vis = Array.from({ length: 3 }, (_, i) => (i === stIdx ? 'visible' : 'hidden')).join(';');
        const body = layers.map((items, ci) => items.length ? `<g fill="${fills[ci]}">${items.join('')}</g>` : '').join('');
        out.push(`<g transform="translate(${P.x} ${P.y}) scale(${sc})" visibility="${stIdx === 0 ? 'visible' : 'hidden'}">${body}<animate attributeName="visibility" values="${vis}" keyTimes="0;0.333;0.667" calcMode="discrete" dur="${sdur}" begin="${sbegin}" repeatCount="indefinite"/></g>`);
      }
    }
    parts.push(`<g>${out.join('')}</g>`);
  } else {
    parts.push(portrait);
  }

  // top bar
  parts.push(`<rect width="${W}" height="44" fill="#010712" fill-opacity=".72"/><path d="M0 44H${W}" stroke="#6ba9ff" stroke-opacity=".28"/>`);
  parts.push(`<rect x="22" y="13" width="18" height="18" rx="4" fill="${t.strip}" stroke="#9dccff" stroke-opacity=".4">${animated ? '<animate attributeName="stroke-opacity" values=".2;.9;.2" dur="3.2s" repeatCount="indefinite"/></rect>' : '</rect>'}`
    + s.text('V', 31, 27, 12, { face: 'heavy', fill: t.ink, anchor: 'middle' }));
  parts.push(s.text(`${profile.handle} / PORTFOLIO`, 50, 27, 11.5, { face: 'mono', fill: t.pale, spacing: 2.2 }));
  if (!narrow) {
    let x = W - 22;
    const nav = [['04', 'CONTACT'], ['03', 'STACK'], ['02', 'WORK'], ['01', 'METRICS']];
    for (const [n, label] of nav) {
      const lw = s.measure(label, 11, 'mono', 1);
      parts.push(s.text(label, x, 27, 11, { face: 'mono', fill: t.mute, spacing: 1, anchor: 'end' }));
      x -= lw + 6;
      const nw = s.measure(`[${n}]`, 11, 'mono', 0);
      parts.push(s.text(`[${n}]`, x, 27, 11, { face: 'mono', fill: t.accent, anchor: 'end' }));
      x -= nw + 18;
    }
  } else {
    parts.push(s.text('CEBU, PH', W - 22, 27, 11, { face: 'mono', fill: t.mute, spacing: 1, anchor: 'end' }));
  }

  // headline
  const hy = narrow ? 396 : 150;
  const hsize = narrow ? 62 : 76;
  const solid = s.text(profile.headline, L, hy, hsize, { face: 'heavy', fill: t.ink, spacing: 2 });
  if (animated) {
    // restrained two-tone glitch on the headline, once every 7 s
    const ghost = (dx, color, y0, h) => `<clipPath id="g${dx}"><rect x="0" y="${y0}" width="${W}" height="${h}"/></clipPath>`
      + `<g clip-path="url(#g${dx})" opacity="0">${s.text(profile.headline, L + dx, hy, hsize, { face: 'heavy', fill: color, spacing: 2 })}`
      + `<animate attributeName="opacity" values="0;0;.9;0;.6;0" keyTimes="0;.9;.92;.94;.97;1" calcMode="discrete" dur="7s" repeatCount="indefinite"/></g>`;
    parts.push(`<g>${solid}<animateTransform attributeName="transform" type="translate" values="0 0;0 0;2 0;-2 0;0 0" keyTimes="0;.91;.93;.96;1" calcMode="discrete" dur="7s" repeatCount="indefinite"/></g>`);
    parts.push(ghost(6, '#4a92ff', hy - 38, 6), ghost(-5, '#9dccff', hy - 16, 5));
  } else parts.push(solid);
  const accW = narrow ? 240 : 340;
  parts.push(`<path d="M${L + 3} ${hy + 20}h${accW}" stroke="url(#accentLine)" stroke-opacity=".7"/>`);
  if (animated) {
    parts.push(`<path d="M${L + 3} ${hy + 20}h${accW}" stroke="#9dccff" stroke-width="1.5" stroke-dasharray="38 ${accW + 40}" stroke-linecap="round"><animate attributeName="stroke-dashoffset" values="38;-${accW}" dur="4.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.85;.85;0" keyTimes="0;.15;.8;1" dur="4.2s" repeatCount="indefinite"/></path>`);
  }
  parts.push(`<path d="M${L + 3} ${hy + 26}v8m20-8v5m20-5v5" stroke="#6ba9ff" stroke-opacity=".55">${animated ? '<animate attributeName="stroke-opacity" values=".3;.9;.3" dur="3.4s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>' : '</path>'}`);
  const roleY = hy + (narrow ? 56 : 58);
  const roleSize = narrow ? 10.5 : 13;
  parts.push(s.text(profile.role, L, roleY, roleSize, { face: 'mono', fill: t.mute, spacing: narrow ? .5 : 1.25 }));

  // terminal prompt -> portfolio
  const bx = L, by = roleY + (narrow ? 20 : 24), bw = narrow ? W - 2 * L : 566, bh = 60;
  parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" fill="#061226" fill-opacity=".88" stroke="#6ba9ff" stroke-opacity=".55"/>`);
  parts.push(`<path d="M${bx} ${by + 10}v${bh - 20}" stroke="${t.accent}" stroke-width="3"/>`);
  parts.push(s.text('EXPLORE THE PORTFOLIO', bx + 18, by + 22, 9.5, { face: 'mono', fill: t.accent, spacing: 2 }));
  const cmd = `open ${profile.portfolioShort}`;
  const cmdSize = narrow ? 11.5 : 13;
  parts.push(s.text('$', bx + 18, by + 45, cmdSize, { face: 'mono', fill: t.soft }));
  const cx = bx + 18 + s.measure('$ ', cmdSize, 'mono');
  const cw = s.measure(cmd, cmdSize, 'mono');
  const cmdArt = s.text(cmd, cx, by + 45, cmdSize, { face: 'mono', fill: t.ink });
  if (animated) {
    const ty = typing('tcmd', cx, by + 29, 22, cw, cmd.length, { dur: 9, hold: .5 });
    parts.push(ty.clip, `<g clip-path="url(#tcmd)">${cmdArt}</g>`, ty.caret(0, by + 32, 7, 16, t.pale));
  } else parts.push(cmdArt, `<rect x="${cx + cw + 3}" y="${by + 32}" width="7" height="16" fill="${t.pale}"/>`);
  parts.push(`<rect x="${bx + bw - 42}" y="${by + 18}" width="28" height="24" rx="5" fill="none" stroke="${t.soft}" stroke-opacity=".7">${animated ? '<animate attributeName="stroke-opacity" values=".35;.95;.35" dur="2.6s" repeatCount="indefinite"/></rect>' : '</rect>'}`);
  parts.push(`<path d="M${bx + bw - 22} ${by + 24}v7h-10m3-3-3 3 3 3" fill="none" stroke="${t.pale}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${animated ? '<animateTransform attributeName="transform" type="translate" values="0 0;-1.5 0;0 0" dur="2.6s" calcMode="spline" keyTimes="0;.45;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>' : '</path>'}`);

  // chips
  let chx = L;
  const chy = by + bh + (narrow ? 18 : 20);
  profile.chips.forEach(c => {
    const live = c === 'BUILDING';
    const w = s.measure(c, 10, 'mono', 1.2) + (live ? 30 : 20);
    if (narrow && chx + w > W - L) return;
    parts.push(`<rect x="${chx}" y="${chy}" width="${w}" height="24" rx="12" fill="#061226" fill-opacity=".8" stroke="#6ba9ff" stroke-opacity="${live ? .7 : .35}"/>`);
    if (live) {
      parts.push(`<circle cx="${chx + 12}" cy="${chy + 12}" r="3" fill="${t.pale}">${animated ? '<animate attributeName="opacity" values="1;.25;1" dur="2s" repeatCount="indefinite"/>' : ''}</circle>`);
    }
    parts.push(s.text(c, chx + (live ? 21 : 10), chy + 16, 10, { face: 'mono', fill: live ? t.pale : t.mute, spacing: 1.2 }));
    chx += w + 10;
  });

  // footer rule
  const fy = H - 26;
  parts.push(`<path d="M${L + 3} ${fy}h${narrow ? 340 : 510}" stroke="url(#accentLine)" stroke-opacity=".55"/>`);
  parts.push(s.text('LOCAL-FIRST BY DEFAULT', W - (narrow ? 28 : 36), fy + 4, 9.5, { face: 'mono', fill: t.soft, spacing: 1.6, anchor: 'end' }));

  parts.push(brackets(narrow ? 24 : 36, 56, W - (narrow ? 48 : 72), H - 100, narrow ? 26 : 34, '#6ba9ff', .55, animated));
  parts.push(`<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="17" fill="none" stroke="#6ba9ff" stroke-opacity=".43" stroke-width="2"/>`);
  s.add(`<g clip-path="url(#frame)">${parts.join('')}</g>`);
  return s.finish();
}

// ---------------------------------------------------------------- morse circuit-trace timing divider
// 4 continuous channels per divider; all 7 dividers (28 channels) transmit NIKI - "La La Lost You"
// in standard ITU Morse Code (1u dot, 3u dash, 1u symbol gap, 3u letter gap, 7u word gap),
// with cursor packet speed keyed word-by-word to the song's vocal phrasing (100 BPM @ 0.5x = 1.2s/beat).
const TIMED_LYRICS = [
  "While:0.5 I'm:0.4 on:0.4 Sunset,:1.6 are:0.5 you:0.5 on:0.4 the:0.4 subway?:2.2",
  "While:0.5 I:0.4 drive,:1.4 are:0.5 you:0.5 gettin':0.7 on:0.4 the:0.4 L-train?:2.3",
  "I:0.5 mean,:1.0 Manhattan's:1.2 nice,:1.5 but:0.4 so:0.6 are:0.5 Malibu:1.3 nights:2.4",
  "You:0.5 would:0.4 know:0.7 if:0.4 you:0.5 stayed,:1.6 you:0.5 would:0.4 know:0.7 if:0.4 you:0.4 put:0.5 up:0.4 a:0.3 fight:2.5",
  "Your:0.5 toes:0.7 turn:0.6 blue:0.8 in:0.4 winter,:1.4 I'm:0.6 gettin':0.7 red,:1.3 rum:1.9",
  "Does:0.6 the:0.4 trick:0.8 for:0.4 all:0.6 of:0.3 the:0.3 things:0.7 left:0.6 unsaid,:1.6 I'm:1.1",
  "Missin':0.9 our:0.5 drunken:0.9 2:0.7 A.M.:1.1 strolls:0.9 in:0.4 K-Town:2.2",
  "Now:0.6 you're:0.5 chasing:0.9 fake:0.8 highs:0.9 in:0.4 the:0.4 Upper:0.8 West:0.8 Side:2.2",
  "And:0.5 fuckin':0.9 on:0.5 Brooklyns:1.2 in:0.5 Brooklyn:2.1",
  "Your:0.6 Chelseas:1.2 in:0.6 Chelsea:2.3",
  "Hope:0.7 that:0.5 eases:1.0 the:0.4 pain,:1.5 so:0.6 you:0.5 remember:1.2 to:0.5 miss:0.9 me:2.4",
  "And:0.4 you:0.4 sold:0.7 your:0.5 car,:1.3 now:0.5 you:0.5 walk:0.8 for:0.5 miles:2.2",
  "Bet:0.9 your:0.8 feet:1.2 feel:1.4 numb:3.0",
  "(Crosswalks:1.3 in:0.6 my:0.6 mind:1.0 are:0.6 shaky,:1.7 so:0.7 please:0.9 hold:1.0 on:0.7 tight):2.6",
  "All:1.0 my:0.8 demons:1.4 run:1.2 wild:2.9",
  "All:1.0 my:0.8 demons:1.4 have:0.9 your:0.8 smile:3.1",
  "In:0.7 the:0.6 city:1.2 of:0.6 angels,:2.4 in:0.7 the:0.6 city:1.2 of:0.6 angels:3.0",
  "Hope:1.1 New:0.9 York:1.2 holds:1.8 you:2.6",
  "Hope:1.1 it:0.7 holds:1.5 you:1.2 like:1.1 I:1.1 do:3.2",
  "While:1.0 my:0.8 demons:1.5 stay:1.4 faithful:3.0",
  "In:0.8 the:0.6 city:1.4 of:0.7 angels:3.6",
];
const SEC_PER_BEAT = 1.2; // 100 BPM half-time (0.60s quarter x 2 for calm visual readability)
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', '2': '..---',
  '.': '.-.-.-', ',': '--..--', '-': '-....-', '?': '..--..', "'": '.----.',
  '(': '-.--.', ')': '-.--.-',
};
const wordMorseUnits = w => {
  let u = 0, chars = 0;
  for (const ch of w.toUpperCase()) {
    const code = MORSE[ch];
    if (!code) continue;
    if (chars++) u += 3;
    for (let i = 0; i < code.length; i++) {
      if (i) u += 1;
      u += code[i] === '-' ? 3 : 1;
    }
  }
  return u;
};
const LYRIC_LANES = (() => {
  const LANES = 28;
  const words = TIMED_LYRICS.join(' ').trim().split(/\s+/).map(tok => {
    const k = tok.lastIndexOf(':');
    return { w: tok.slice(0, k), b: +tok.slice(k + 1) };
  });
  const total = words.reduce((a, x) => a + wordMorseUnits(x.w) + 7, 0);
  const out = Array.from({ length: LANES }, () => []);
  let idx = 0, acc = 0;
  for (const x of words) {
    out[idx].push(x);
    acc += wordMorseUnits(x.w) + 7;
    if (idx < LANES - 1 && acc >= (idx + 1) * (total / LANES) - 18) idx++;
  }
  return out;
})();
const CIRCUIT_PAL = {
  dark: {
    pad: '#2f5a9e', wire: '#152744', label: '#6088c4',
    fam: [
      { mark: '#2c6bd1', wake: '#4791ff', core: '#99cbff', peak: '#ffffff' }, // night cobalt
      { mark: '#3578e0', wake: '#5ba2ff', core: '#b3daff', peak: '#ffffff' }, // icy azure
    ],
  },
  light: {
    pad: '#5678ad', wire: '#c9d9f0', label: '#5574a6',
    fam: [
      { mark: '#316ed1', wake: '#1f5ed1', core: '#0f3c8f', peak: '#071429' },
      { mark: '#2561c4', wake: '#164eb2', core: '#0b2f73', peak: '#071429' },
    ],
  },
};

function laneTraceGeom(laneWords, x0, x1, yHi, yLo) {
  const bits = [];
  const wordEnds = [];
  laneWords.forEach(({ w }, wi) => {
    let chars = 0;
    for (const ch of w.toUpperCase()) {
      const code = MORSE[ch];
      if (!code) continue;
      if (chars++) bits.push(0, 0, 0); // 3u inter-letter gap
      for (let i = 0; i < code.length; i++) {
        if (i) bits.push(0); // 1u intra-letter gap
        if (code[i] === '-') bits.push(1, 1, 1); // 3u dash
        else bits.push(1); // 1u dot
      }
    }
    const symEndBit = bits.length;
    if (wi < laneWords.length - 1) bits.push(0, 0, 0, 0, 0, 0, 0); // 7u inter-word gap
    wordEnds.push({ symEndBit, gapEndBit: bits.length });
  });

  const lead = Math.min(14, (x1 - x0) * 0.018);
  const totalBits = bits.length;
  const uw = (x1 - x0 - 2 * lead) / totalBits;
  const pts = [[x0, yLo], [x0 + lead, yLo]];
  let curY = yLo;
  let len = lead;

  const f = n => +n.toFixed(2);
  const marks = [];
  let runStart = null;
  const lenAtBit = new Float64Array(totalBits + 1);
  lenAtBit[0] = lead;

  for (let i = 0; i < totalBits; i++) {
    const ny = bits[i] ? yHi : yLo;
    const bx0 = x0 + lead + i * uw;
    const bx1 = bx0 + uw;
    if (bits[i]) {
      if (runStart === null) runStart = bx0;
    } else if (runStart !== null) {
      marks.push(`M${f(runStart)} ${f(yHi)}H${f(bx0)}`);
      runStart = null;
    }
    if (ny !== curY) {
      pts.push([bx0, ny]);
      len += Math.abs(ny - curY);
      curY = ny;
    }
    pts.push([bx1, ny]);
    len += uw;
    lenAtBit[i + 1] = len;
  }
  if (runStart !== null) marks.push(`M${f(runStart)} ${f(yHi)}H${f(x1 - lead)}`);
  if (curY !== yLo) {
    pts.push([x1 - lead, yLo]);
    len += Math.abs(yLo - curY);
  }
  pts.push([x1, yLo]);
  len += lead;

  const d = 'M' + pts.map(([px, py]) => `${f(px)} ${f(py)}`).join('L');
  const wordSpans = wordEnds.map((e, wi) => ({
    b: laneWords[wi].b,
    w: laneWords[wi].w,
    sSymEnd: lenAtBit[e.symEndBit],
    sGapEnd: lenAtBit[e.gapEndBit],
  }));
  return { d, marksPath: marks.join(''), len: +len.toFixed(1), lead, wordSpans };
}

function circuitTrace(s, { x = 4, y, w, lanes = 4, laneOffset = 0, t, animated = true, seed = 0, meta = true } = {}) {
  const pal = t.ink === '#f4f9ff' ? CIRCUIT_PAL.dark : CIRCUIT_PAL.light;
  const narrow = w < 700;
  const sx0 = x + (narrow ? 19 : 21);
  const sx1 = x + w - 6;
  const stepH = 6.5, laneGap = 13.5;
  const sw = narrow ? 1.0 : 1.15;
  const markW = narrow ? 1.95 : 2.2;
  const padR = narrow ? 2.2 : 2.6;

  const baseG = [], marksG = [], animG = [], padsG = [], metaG = [];
  if (meta) {
    const yMeta = y + 8;
    const fz = narrow ? 7.6 : 8.4;
    const ch0 = String(laneOffset + 1).padStart(2, '0');
    const ch1 = String(laneOffset + lanes).padStart(2, '0');
    const leftTxt = narrow
      ? `MORSE // LA LA LOST YOU · CH${ch0}-${ch1} · VOCAL`
      : `MORSE // NIKI · LA LA LOST YOU · CH ${ch0}-${ch1} · VOCAL TEMPO`;
    metaG.push(s.text(leftTxt, x + 1, yMeta, fz, { face: 'mono', fill: pal.label, spacing: narrow ? 0.5 : 1.0 }));

    // visual legend on right: [1u bar] DOT   [3u bar] DASH
    const dotLbl = 'DOT', dashLbl = 'DASH';
    const wDotL = s.measure(dotLbl, fz, 'mono', 0.8);
    const wDashL = s.measure(dashLbl, fz, 'mono', 0.8);
    const barDot = 4, barDash = 11, symGap = 5, itemGap = narrow ? 10 : 14;
    const xDashTxt = sx1 - wDashL;
    const xDashBar = xDashTxt - symGap - barDash;
    const xDotTxt = xDashBar - itemGap - wDotL;
    const xDotBar = xDotTxt - symGap - barDot;
    const ySym = yMeta - 2.8;
    metaG.push(
      `<line x1="${xDotBar.toFixed(1)}" y1="${ySym}" x2="${(xDotBar + barDot).toFixed(1)}" y2="${ySym}" stroke="${pal.fam[0].mark}" stroke-width="2.2" stroke-linecap="butt"/>`,
      s.text(dotLbl, xDotTxt, yMeta, fz, { face: 'mono', fill: pal.label, spacing: 0.8 }),
      `<line x1="${xDashBar.toFixed(1)}" y1="${ySym}" x2="${(xDashBar + barDash).toFixed(1)}" y2="${ySym}" stroke="${pal.fam[0].mark}" stroke-width="2.2" stroke-linecap="butt"/>`,
      s.text(dashLbl, xDashTxt, yMeta, fz, { face: 'mono', fill: pal.label, spacing: 0.8 }),
    );
  }

  const yLanes = meta ? y + 20 : y;
  for (let lane = 0; lane < lanes; lane++) {
    const yHi = yLanes + lane * laneGap;
    const yLo = yHi + stepH;
    const cFam = pal.fam[(lane + seed) % 2];
    const chNum = String(laneOffset + lane + 1).padStart(2, '0');
    const laneWords = LYRIC_LANES[(laneOffset + lane) % LYRIC_LANES.length];
    const { d, marksPath, len, lead, wordSpans } = laneTraceGeom(laneWords, sx0, sx1, yHi, yLo);

    if (meta) {
      metaG.push(s.text(chNum, x + 1, (yHi + yLo) / 2 + 2.6, narrow ? 7.2 : 7.6, { face: 'mono', fill: pal.label, spacing: 0.3 }));
    }
    baseG.push(`<path d="${d}" fill="none" stroke="${pal.wire}" stroke-width="${sw}" stroke-linejoin="miter"/>`);
    if (marksPath) {
      marksG.push(`<path d="${marksPath}" fill="none" stroke="${cFam.mark}" stroke-width="${markW}" stroke-linecap="butt"/>`);
    }

    if (animated) {
      const wakeLen = 58, coreLen = 14;
      // Build exact piecewise SMIL milestones matching word-by-word singing speed
      let timeSec = 0.22; // crisp entry off left terminal pad
      const milestones = [{ t: 0, s: 0 }, { t: timeSec, s: lead }];
      wordSpans.forEach((ws, wi) => {
        const dt = ws.b * SEC_PER_BEAT;
        if (wi < wordSpans.length - 1) {
          const hasPause = /[,?)]$/.test(ws.w);
          const symShare = hasPause ? 0.65 : 0.80;
          timeSec += dt * symShare;
          milestones.push({ t: timeSec, s: ws.sSymEnd });
          timeSec += dt * (1 - symShare);
          milestones.push({ t: timeSec, s: ws.sGapEnd });
        } else {
          timeSec += dt;
          milestones.push({ t: timeSec, s: ws.sSymEnd });
        }
      });
      timeSec += 0.22; // exit onto right terminal pad
      const tArriveSec = timeSec;
      milestones.push({ t: tArriveSec, s: len });
      const dtWake = Math.max(0.28, (wakeLen / len) * tArriveSec);
      const dur = +(tArriveSec + dtWake).toFixed(2);
      milestones.push({ t: dur, s: len + wakeLen });

      const ktArr = milestones.map((m, idx) => idx === milestones.length - 1 ? 1 : +(m.t / dur).toFixed(4));
      for (let idx = 1; idx < ktArr.length - 1; idx++) {
        if (ktArr[idx] <= ktArr[idx - 1]) ktArr[idx] = +(ktArr[idx - 1] + 0.0005).toFixed(4);
      }
      const keyTimes = ktArr.join(';');
      const motionPts = milestones.map(m => m.s >= len ? '1' : +(m.s / len).toFixed(4)).join(';');
      const wakeVals = milestones.map(m => +(wakeLen - m.s).toFixed(1)).join(';');
      const coreVals = milestones.map(m => +(coreLen - m.s).toFixed(1)).join(';');
      const frac = ktArr[ktArr.length - 2];
      const fracOff = Math.min(0.995, +(frac + 0.012).toFixed(4));

      // Stagger cursors across the 4 channels in each divider
      const begin = (-((lane * (dur / 4) + seed * 0.85) % dur)).toFixed(2);
      const dashGap = Math.ceil(len + 120);

      animG.push(
        `<path d="${d}" fill="none" stroke="${cFam.wake}" stroke-width="${markW}" stroke-dasharray="${wakeLen} ${dashGap}" stroke-linecap="square" stroke-linejoin="miter">`
        + `<animate attributeName="stroke-dashoffset" values="${wakeVals}" keyTimes="${keyTimes}" calcMode="linear" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></path>`
        + `<path d="${d}" fill="none" stroke="${cFam.core}" stroke-width="${markW + 0.45}" stroke-dasharray="${coreLen} ${dashGap + wakeLen}" stroke-linecap="square" stroke-linejoin="miter">`
        + `<animate attributeName="stroke-dashoffset" values="${coreVals}" keyTimes="${keyTimes}" calcMode="linear" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></path>`
        + `<rect x="-2.4" y="-2.4" width="4.8" height="4.8" rx="0.6" fill="${cFam.peak}">`
        + `<animateMotion path="${d}" keyPoints="${motionPts}" keyTimes="${keyTimes}" calcMode="linear" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`
        + `<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${frac};${fracOff};1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></rect>`
      );

      const tArr = Math.max(0.06, Math.min(0.94, +(tArriveSec / dur).toFixed(3)));
      padsG.push(
        `<circle cx="${sx0.toFixed(1)}" cy="${yLo.toFixed(1)}" r="${padR}" fill="${pal.pad}"><animate attributeName="fill" values="${cFam.core};${pal.pad};${pal.pad}" keyTimes="0;0.10;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle>`,
        `<circle cx="${sx1.toFixed(1)}" cy="${yLo.toFixed(1)}" r="${padR}" fill="${pal.pad}"><animate attributeName="fill" values="${pal.pad};${cFam.core};${pal.pad};${pal.pad}" keyTimes="0;${+(tArr - 0.03).toFixed(3)};${Math.min(0.99, +(tArr + 0.06).toFixed(3))};1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle>`
      );
    } else {
      const off = -(len * (0.22 + ((lane + seed) % 4) * 0.16));
      animG.push(
        `<path d="${d}" fill="none" stroke="${cFam.wake}" stroke-width="${markW}" stroke-dasharray="52 ${Math.ceil(len + 80)}" stroke-dashoffset="${off.toFixed(1)}"/>`
        + `<path d="${d}" fill="none" stroke="${cFam.core}" stroke-width="${markW + 0.45}" stroke-dasharray="14 ${Math.ceil(len + 80)}" stroke-dashoffset="${off.toFixed(1)}"/>`
      );
      padsG.push(
        `<circle cx="${sx0.toFixed(1)}" cy="${yLo.toFixed(1)}" r="${padR}" fill="${pal.pad}"/>`,
        `<circle cx="${sx1.toFixed(1)}" cy="${yLo.toFixed(1)}" r="${padR}" fill="${pal.pad}"/>`
      );
    }
  }
  return `<g>${metaG.join('')}${baseG.join('')}${marksG.join('')}${animG.join('')}${padsG.join('')}</g>`;
}

// ---------------------------------------------------------------- section header (transparent, themed)
const SECTION_SEED = { '01': 0, '02': 1, '03': 2, '04': 3 };
function header(sec, t, { animated = true, narrow = false } = {}) {
  const yCircuit = narrow ? 120 : 128;
  const W = narrow ? 600 : 1000, H = yCircuit + 72;
  const s = new SVG(W, H, `${sec.num} / ${sec.kicker}: ${sec.title}`, sec.sub);
  const p = [];
  const kSize = narrow ? 13.5 : 13;
  p.push(s.text(`[${sec.num}]`, 2, 26, kSize, { face: 'monoBold', fill: t.accent }));
  p.push(s.text(`/ ${sec.kicker}`, 2 + s.measure(`[${sec.num}] `, kSize, 'monoBold'), 26, kSize, { face: 'mono', fill: t.soft, spacing: 1.4 }));
  p.push(s.text(sec.title, 0, narrow ? 74 : 80, narrow ? 35 : 40, { face: 'display', fill: t.ink, spacing: .2 }));
  const subSize = narrow ? 11.2 : 12.5;
  const subSpacing = narrow ? .4 : 1.1;
  const subY = narrow ? 104 : 112;
  p.push(s.text(sec.sub, 2, subY, subSize, { face: 'mono', fill: t.mute, spacing: subSpacing }));

  if (!narrow) {
    p.push(`<rect x="916" y="18" width="60" height="60" rx="12" fill="${NIGHT.strip}"/><rect x="916.5" y="18.5" width="59" height="59" rx="11.5" fill="none" stroke="#9dccff" stroke-opacity=".35">${animated ? '<animate attributeName="stroke-opacity" values=".22;.75;.22" dur="3.6s" repeatCount="indefinite"/></rect>' : '</rect>'}`);
    p.push(headerPicto(sec.icon, 930, 32, 32, NIGHT.ink, animated));
  } else {
    p.push(`<rect x="540" y="14" width="54" height="54" rx="11" fill="${NIGHT.strip}"/><rect x="540.5" y="14.5" width="53" height="53" rx="10.5" fill="none" stroke="#9dccff" stroke-opacity=".35">${animated ? '<animate attributeName="stroke-opacity" values=".22;.75;.22" dur="3.6s" repeatCount="indefinite"/></rect>' : '</rect>'}`);
    p.push(headerPicto(sec.icon, 553, 27, 28, NIGHT.ink, animated));
  }

  const seed = SECTION_SEED[sec.num] ?? 0;
  p.push(circuitTrace(s, { x: 4, y: yCircuit, w: W - 8, lanes: 4, laneOffset: (seed + 1) * 4, t, animated, seed }));
  s.add(...p);
  return s.finish();
}

// ---------------------------------------------------------------- intro (transparent, themed)
function intro(profile, t, { animated = true, narrow = false } = {}) {
  const W = narrow ? 600 : 1000;
  const s = new SVG(W, 10, `Profile: ${profile.focus}`, `Status: ${profile.chips.join(', ')}.`);
  const p = [];
  p.push(circuitTrace(s, { x: 4, y: 6, w: W - 8, lanes: 4, laneOffset: 0, t, animated, seed: 4 }));
  const buildingDot = (cx, cy, r) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.accent}">${animated ? '<animate attributeName="opacity" values="1;.2;1" dur="1.7s" repeatCount="indefinite"/></circle>' : '</circle>'}`;
  if (!narrow) {
    const lines = s.wrap(profile.focus, 17, 610, 'body');
    const H = Math.max(224, 130 + lines.length * 28 + 14);
    s.h = H;
    p.push(s.text('PROFILE / CURRENT FOCUS', 0, 94, 11.5, { face: 'mono', fill: t.accent, spacing: 2 }));
    lines.forEach((l, i) => p.push(s.text(l, 0, 130 + i * 28, 17, { face: 'body', fill: i === 0 ? t.ink : t.mute })));
    p.push(`<path d="M672 80V${H - 22}" stroke="${t.line}"/>`);
    p.push(s.text('STATUS / LOCATION', 700, 94, 11.5, { face: 'mono', fill: t.accent, spacing: 2 }));
    let x = 700, y = 116;
    profile.chips.forEach(c => {
      const live = c === 'BUILDING';
      const w = s.measure(c, 11, 'mono', 1.2) + (live ? 32 : 22);
      if (x + w > W) { x = 700; y += 38; }
      p.push(`<rect x="${x}" y="${y}" width="${w}" height="28" rx="6" fill="none" stroke="${t.accent}" stroke-opacity="${live ? .9 : .45}"/>`);
      if (live) p.push(buildingDot(x + 13, y + 14, 3.5));
      p.push(s.text(c, x + (live ? 23 : 11), y + 18.5, 11, { face: 'mono', fill: live ? t.accent : t.ink, spacing: 1.2 }));
      x += w + 10;
    });
    p.push(`<path d="M0 ${H - 1}H${W}" stroke="${t.line}"/>`);
  } else {
    const lines = s.wrap(profile.focus, 19, 592, 'body');
    const focusEnd = 128 + lines.length * 30;
    p.push(s.text('PROFILE / CURRENT FOCUS', 0, 94, 13, { face: 'mono', fill: t.accent, spacing: 2 }));
    lines.forEach((l, i) => p.push(s.text(l, 0, 128 + i * 30, 19, { face: 'body', fill: i === 0 ? t.ink : t.mute })));
    const midY = focusEnd + 14;
    p.push(`<path d="M0 ${midY}H${W}" stroke="${t.line}"/>`);
    p.push(s.text('STATUS / LOCATION', 0, midY + 34, 13, { face: 'mono', fill: t.accent, spacing: 2 }));
    let x = 0, y = midY + 56;
    profile.chips.forEach(c => {
      const live = c === 'BUILDING';
      const w = s.measure(c, 12.5, 'mono', 1.2) + (live ? 34 : 24);
      if (x + w > W) { x = 0; y += 40; }
      p.push(`<rect x="${x}" y="${y}" width="${w}" height="30" rx="6" fill="none" stroke="${t.accent}" stroke-opacity="${live ? .9 : .45}"/>`);
      if (live) p.push(buildingDot(x + 14, y + 15, 3.5));
      p.push(s.text(c, x + (live ? 25 : 12), y + 20, 12.5, { face: 'mono', fill: live ? t.accent : t.ink, spacing: 1.2 }));
      x += w + 10;
    });
    const H = y + 52;
    s.h = H;
    p.push(`<path d="M0 ${H - 1}H${W}" stroke="${t.line}"/>`);
  }
  s.add(...p);
  return s.finish();
}

// ---------------------------------------------------------------- shared card chrome
// Cards include a transparent outer gutter (`PAD`) so inline rows on GitHub keep clean,
// consistent horizontal and vertical gaps on both desktop (2x2) and mobile (stacked).
const CARD = { fill: NIGHT.panel, stroke: NIGHT.edge };
function cardShell(s, w, h, id, pad = 0, animated = false) {
  const iw = w - pad * 2, ih = h - pad * 2;
  s.def(`<clipPath id="${id}"><rect x="${pad}" y="${pad}" width="${iw}" height="${ih}" rx="10"/></clipPath>`);
  const borderAnim = animated ? '<animate attributeName="stroke-opacity" values=".38;.72;.38" dur="4.6s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/>' : '';
  return {
    iw, ih,
    open: `<g clip-path="url(#${id})"><rect x="${pad}" y="${pad}" width="${iw}" height="${ih}" fill="${CARD.fill}"/>`,
    close: `</g><rect x="${pad + .75}" y="${pad + .75}" width="${iw - 1.5}" height="${ih - 1.5}" rx="9.5" fill="none" stroke="${CARD.stroke}" stroke-opacity=".5" stroke-width="1.5">${borderAnim}</rect>`,
  };
}
// terminal strip with a typed command: `prefix` is drawn dim, `cmd` types on loop
function strip(s, { x = 0, y, w, h = 28, prefix = '$', cmd, right = '', animated, id, dur = 7, begin = 0 }) {
  const t = NIGHT, size = 11.5, base = y + h / 2 + 4;
  const out = [`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${t.strip}"/>`];
  const px = x + 16;
  out.push(s.text(prefix, px, base, size, { face: 'mono', fill: t.pale }));
  const cx = px + s.measure(prefix + ' ', size, 'mono');
  const cw = s.measure(cmd, size, 'mono');
  const art = s.text(cmd, cx, base, size, { face: 'mono', fill: t.ink });
  if (animated) {
    const ty = typing(id, cx, y, h, cw, cmd.length, { dur, begin });
    out.push(ty.clip, `<g clip-path="url(#${id})">${art}</g>`, ty.caret(0, y + h / 2 - 7, 7, 14, t.pale));
  } else out.push(art, `<rect x="${cx + cw + 3}" y="${y + h / 2 - 7}" width="7" height="14" fill="${t.pale}"/>`);
  if (right) out.push(right);
  return out.join('');
}
const pill = (s, text, xRight, y, { dot = NIGHT.ok, arrow = true, animated = false } = {}) => {
  const t = NIGHT, w = s.measure(text, 10, 'mono') + (arrow ? 36 : 24);
  const x = xRight - w;
  return `<rect x="${x}" y="${y}" width="${w}" height="20" rx="10" fill="${t.raise}" stroke="${t.edge}" stroke-opacity=".35"/>`
    + `<circle cx="${x + 10}" cy="${y + 10}" r="3" fill="${dot}">${animated ? '<animate attributeName="opacity" values="1;.25;1" dur="1.8s" repeatCount="indefinite"/></circle>' : '</circle>'}`
    + s.text(text, x + 18, y + 14, 10, { face: 'mono', fill: t.mute })
    + (arrow ? `<path d="M${x + w - 14} ${y + 13.5}l5-5m-4 0h4v4" fill="none" stroke="${t.mute}" stroke-width="1.2" stroke-linecap="round">${animated ? '<animateTransform attributeName="transform" type="translate" values="0 0;1 -1;0 0" dur="2.8s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>' : '</path>'}` : '');
};

// ---------------------------------------------------------------- project card (380 inner + 6px gutter = 392)
const CPAD = 6, CW = 380;
function projectLines(p) {
  const s = new SVG(1, 1, '');
  return s.wrap(p.text, 11.5, CW - 36, 'body');
}
function projectCard(p, { animated = true, lines = 3, begin = 0 } = {}) {
  const t = NIGHT, W = CW + CPAD * 2;
  const innerH = 92 + Math.max(0, lines - 1) * 18 + 24 + 30;
  const H = innerH + CPAD * 2;
  const s = new SVG(W, H, `${p.title}, public repository`, `${p.text} Built with ${p.stack.join(', ')}.`);
  const sh = cardShell(s, W, H, 'c', CPAD, animated);
  const o = [sh.open];
  const fade = (i) => animated ? fadeIn(.15 + i * .12) : '';
  const ox = CPAD, oy = CPAD;
  o.push(`<rect x="${ox + 18}" y="${oy + 18}" width="50" height="50" rx="9" fill="${t.strip}"/>`);
  o.push(projectPicto(p.art, ox + 28, oy + 28, 30, t.ink, animated));
  o.push(`<g>${s.text(p.kicker, ox + 82, oy + 34, 9.5, { face: 'mono', fill: t.soft, spacing: 1.4 })}${fade(0)}</g>`);
  const tsize = Math.min(16.5, 16.5 * 276 / s.measure(p.title, 16.5, 'display'));
  o.push(`<g>${s.text(p.title, ox + 82, oy + 58, tsize, { face: 'display', fill: t.ink })}${fade(1)}</g>`);
  o.push(pill(s, 'repo', ox + CW - 16, oy + 16, { animated }));
  const desc = s.wrap(p.text, 11.5, CW - 36, 'body');
  o.push(`<g>${desc.map((l, i) => s.text(l, ox + 18, oy + 92 + i * 18, 11.5, { face: 'body', fill: t.mute })).join('')}${fade(2)}</g>`);
  o.push(strip(s, { x: ox, y: oy + innerH - 30, w: CW, h: 30, cmd: p.stack.join('  '), animated, id: 'ty', dur: 7, begin }));
  o.push(sh.close);
  s.add(...o);
  return s.finish();
}

// ---------------------------------------------------------------- stack banner (matches portfolio skills marquee)
function wireframeToolbox(x, y, scale, animated) {
  const f = animated
    ? '<animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="4.8s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/>'
    : '';
  return `<g transform="translate(${x} ${y}) scale(${scale})"><g>`
    // soft fill volumes + crisp isometric wireframe matching portfolio toolbox art
    + '<polygon points="44,4 114,22 106,48 36,30" fill="#17417e" fill-opacity=".28" stroke="#7cb6ff" stroke-width="1.4" stroke-linejoin="round"/>'
    + '<polygon points="8,46 36,30 106,48 78,64" fill="#0d2954" fill-opacity=".42" stroke="#6ba9ff" stroke-width="1.4" stroke-linejoin="round"/>'
    + '<polygon points="8,46 78,64 78,89 8,71" fill="#123466" fill-opacity=".34" stroke="#7cb6ff" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<polygon points="78,64 106,48 106,73 78,89" fill="#0a2247" fill-opacity=".45" stroke="#6ba9ff" stroke-width="1.5" stroke-linejoin="round"/>'
    // lid rim highlight + inner wall creases
    + '<path d="M44 4l-3 7 70 18 3-7M36 30v19M18 48l18-10 58 15" fill="none" stroke="#9dccff" stroke-opacity=".65" stroke-width="1.15" stroke-linejoin="round"/>'
    // front clasp plate
    + '<polygon points="38,57 48,59.5 48,69.5 38,67" fill="#6ba9ff" fill-opacity=".28" stroke="#9dccff" stroke-width="1.35" stroke-linejoin="round"/>'
    + `${f}</g></g>`;
}

function stackPillSvg(s, [name, slug, letters], x, y, h = 44, compact = false) {
  const size = 13, iconSize = 19, padL = compact ? 13 : 16, gap = compact ? 8 : 10, padR = compact ? 14 : 18;
  const tw = Math.ceil(s.measure(name, size, 'body'));
  const w = padL + iconSize + gap + tw + padR;
  const iy = y + (h - iconSize) / 2;
  const parts = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#081326" fill-opacity=".92" stroke="#6ba9ff" stroke-opacity=".24" stroke-width="1.2"/>`,
  ];
  if (slug) {
    parts.push(`<g filter="url(#iglow)">${drawIcon(icon(slug), x + padL, iy, iconSize, '#f2f7ff')}</g>`);
  } else {
    parts.push(`<rect x="${x + padL}" y="${iy + 1}" width="${iconSize}" height="${iconSize - 2}" rx="4" fill="#163b72" stroke="#9dccff" stroke-opacity=".5"/>`);
    parts.push(s.text(letters, x + padL + iconSize / 2, y + h / 2 + 3.5, 8.5, { face: 'monoBold', fill: '#f2f7ff', anchor: 'middle' }));
  }
  parts.push(s.text(name, x + padL + iconSize + gap, y + h / 2 + 4.5, size, { face: 'body', fill: '#dceaff' }));
  return { svg: parts.join(''), w };
}

function stackBanner(stack, { animated = true, narrow = false } = {}) {
  const t = NIGHT;
  const W = narrow ? 600 : 1000, topH = 30, padX = narrow ? 28 : 40;
  const pillH = 44, pillGap = animated ? 18 : (narrow ? 10 : 9);

  // pre-measure layout height before instantiating final SVG canvas height
  const probe = new SVG(1, 1, '');
  const summaryText = 'Project-backed languages, frameworks, platforms, and workflows across games, data systems, browser tooling, and automation.';
  const introWrapW = W - padX - (narrow ? 166 : 240);
  const introLines = probe.wrap(summaryText, 12, introWrapW, 'body');
  const rowsStart = topH + 34 + introLines.length * 18 + 20;

  // compute wrapped static rows when still, or 1 track row per group when animated
  const compact = !animated;
  const padLR = compact ? 27 : 34, gapIC = compact ? 8 : 10;
  const groupLayouts = stack.map(grp => {
    if (animated) return { group: grp.group, rows: [grp.items], height: 22 + pillH + 18 };
    const rows = [];
    let cur = [], curW = 0, maxW = W - padX * 2;
    for (const item of grp.items) {
      const pw = padLR + 19 + gapIC + Math.ceil(probe.measure(item[0], 13, 'body'));
      const nextW = cur.length ? curW + pillGap + pw : pw;
      if (cur.length && nextW > maxW) {
        rows.push(cur);
        cur = [item]; curW = pw;
      } else {
        cur.push(item); curW = nextW;
      }
    }
    if (cur.length) rows.push(cur);
    return { group: grp.group, rows, height: 22 + rows.length * pillH + (rows.length - 1) * 10 + 18 };
  });

  const H = rowsStart + groupLayouts.reduce((a, g) => a + g.height, 0) + 12;
  const s = new SVG(W, H, 'Technical stack and tools marquee',
    stack.map(g => `${g.group}: ${g.items.map(i => i[0]).join(', ')}`).join('. '));

  s.def('<pattern id="sgrid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#6ba9ff" stroke-opacity=".06"/></pattern>');
  s.def('<linearGradient id="sscrim" x2=".3" y2="1"><stop stop-color="#050e1f" stop-opacity=".76"/><stop offset=".55" stop-color="#061226" stop-opacity=".86"/><stop offset="1" stop-color="#040d1d" stop-opacity=".95"/></linearGradient>');
  s.def('<radialGradient id="tglow"><stop stop-color="#3186ff" stop-opacity=".28"/><stop offset="1" stop-color="#3186ff" stop-opacity="0"/></radialGradient>');
  s.def('<filter id="iglow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="2.4" flood-color="#9dccff" flood-opacity=".58"/></filter>');
  if (animated) {
    s.def('<linearGradient id="fadeL"><stop stop-color="#051022"/><stop offset="1" stop-color="#051022" stop-opacity="0"/></linearGradient>');
    s.def('<linearGradient id="fadeR"><stop stop-color="#051022" stop-opacity="0"/><stop offset="1" stop-color="#051022"/></linearGradient>');
  }

  const sh = cardShell(s, W, H, 'sc', 0, animated);
  const o = [sh.open];
  // subtle forest night backdrop + dark blue scrim matching portfolio aesthetic
  const forest = narrow
    ? `<image href="${dataUri('forest.jpg', 'image/jpeg')}" x="-140" y="0" width="880" height="495" opacity=".42" preserveAspectRatio="none"/>`
    : `<image href="${dataUri('forest.jpg', 'image/jpeg')}" x="0" y="-75" width="1000" height="562" opacity=".42" preserveAspectRatio="none"/>`;
  o.push(forest, `<rect x="0" y="${topH}" width="${W}" height="${H - topH}" fill="url(#sscrim)"/>`);
  o.push(`<rect x="0" y="${topH}" width="${W}" height="${H - topH}" fill="url(#sgrid)"/>`);
  const tbX = narrow ? W - 140 : W - 186, tbScale = narrow ? .74 : .98;
  o.push(`<ellipse cx="${tbX + 58 * tbScale}" cy="${48 + 44 * tbScale}" rx="${76 * tbScale}" ry="${54 * tbScale}" fill="url(#tglow)"/>`);
  o.push(wireframeToolbox(tbX, narrow ? 49 : 45, tbScale, animated));

  const rightPill = livePill(s, animated ? '3 tracks · live' : '3 categories', animated, W, topH);
  o.push(strip(s, { y: 0, w: W, h: topH, prefix: '>', cmd: 'skills --stack', right: rightPill, animated, id: 'sty', dur: 7 }));

  o.push(s.text('LANGUAGES / SOFTWARE / DATA / SYSTEMS', padX, topH + 28, 10, { face: 'mono', fill: '#9bc0ff', spacing: 1.8 }));
  o.push(introLines.map((l, i) => s.text(l, padX, topH + 49 + i * 18, 12, { face: 'body', fill: '#a9c0e2' })).join(''));

  let curY = rowsStart;
  groupLayouts.forEach((grp, gi) => {
    o.push(s.text(grp.group.toUpperCase(), padX, curY + 12, 9.5, { face: 'monoBold', fill: '#9ab4db', spacing: 1.6 }));
    const rowTop = curY + 22;
    if (animated) {
      // build 1 seamless repeating strip in <defs> wide enough to cover W without gaps
      let unitPills = [], ux = 0;
      const items = grp.rows[0];
      while (ux < W + 40) {
        for (const item of items) {
          const p = stackPillSvg(s, item, ux, 0, pillH);
          unitPills.push(p.svg);
          ux += p.w + pillGap;
        }
      }
      const unitW = ux;
      s.def(`<g id="tr${gi}">${unitPills.join('')}</g>`);
      s.def(`<clipPath id="rc${gi}"><rect x="2" y="${rowTop - 4}" width="${W - 4}" height="${pillH + 8}"/></clipPath>`);
      const reverse = gi % 2 === 1;
      const from = reverse ? -unitW : 0, to = reverse ? 0 : -unitW;
      const dur = +(unitW / 38).toFixed(1);
      o.push(`<g clip-path="url(#rc${gi})"><g transform="translate(0 ${rowTop})"><g>`
        + `<use href="#tr${gi}" x="0"/><use href="#tr${gi}" x="${unitW}"/>`
        + `<animateTransform attributeName="transform" type="translate" values="${from} 0;${to} 0" dur="${dur}s" repeatCount="indefinite"/>`
        + '</g></g></g>');
    } else {
      grp.rows.forEach((rowItems, ri) => {
        const y = rowTop + ri * (pillH + 10);
        let px = padX;
        for (const item of rowItems) {
          const p = stackPillSvg(s, item, px, y, pillH, true);
          o.push(p.svg);
          px += p.w + pillGap;
        }
      });
    }
    curY += grp.height;
  });

  if (animated) {
    const fw = narrow ? 52 : 84;
    o.push(`<rect x="1" y="${rowsStart - 4}" width="${fw}" height="${H - rowsStart - 8}" fill="url(#fadeL)"/>`);
    o.push(`<rect x="${W - fw - 1}" y="${rowsStart - 4}" width="${fw}" height="${H - rowsStart - 8}" fill="url(#fadeR)"/>`);
  }
  o.push(brackets(14, topH + 14, W - 28, H - topH - 28, 18, '#6ba9ff', .32, animated));
  o.push(sh.close);
  s.add(...o);
  return s.finish();
}

// ---------------------------------------------------------------- live cards (252 x 212)
const LW = 252, LH = 212;
const RAMP = ['#0f2140', '#173d72', '#256bc4', '#4a92ff', '#9dccff'];
function liveShell(s, cmd, right, animated, id) {
  const sh = cardShell(s, LW, LH, 'c');
  return [sh.open, strip(s, { y: 0, w: LW, h: 28, prefix: '>', cmd, animated, id, dur: 8, right }), sh, ];
}
const livePill = (s, label, animated, w = LW, h = 28) => {
  const t = NIGHT, x = w - 16 - s.measure(label, 10.5, 'mono');
  return `<circle cx="${x - 9}" cy="${h / 2}" r="3" fill="${t.ink}">${animated ? '<animate attributeName="opacity" values="1;.2;1" dur="2s" repeatCount="indefinite"/>' : ''}</circle>`
    + s.text(label, x, h / 2 + 4, 10.5, { face: 'mono', fill: t.ink });
};

function contributionsCard(gh, { animated = true } = {}) {
  const t = NIGHT;
  const s = new SVG(LW, LH, `GitHub contributions: ${gh.total} in the last 12 months`,
    `${gh.week} in the last 7 days, current streak ${gh.streak.current} days, best ${gh.streak.best}.`);
  const [open, top, sh] = liveShell(s, 'github contributions', livePill(s, 'live', animated), animated, 'ty');
  const o = [open, top];
  const fade = i => animated ? fadeIn(.1 + i * .12) : '';
  o.push(`<g>${s.text(String(gh.total), 16, 74, 32, { face: 'display', fill: t.ink })}${s.text('in 12 months', 22 + s.measure(String(gh.total), 32, 'display'), 74, 12, { face: 'body', fill: t.mute })}${fade(0)}</g>`);
  // heatmap: last 22 weeks, aligned so the final column ends today
  const days = gh.days;
  const weeks = 22, cell = 8, gap = 2, x0 = 16, y0 = 92;
  const lastDow = new Date(days[days.length - 1][0] + 'T00:00:00Z').getUTCDay();
  const span = (weeks - 1) * 7 + lastDow + 1;
  const recent = days.slice(-span);
  const max = Math.max(1, ...recent.map(d => d[1]));
  const level = c => c === 0 ? 0 : Math.min(4, Math.ceil(c / max * 4));
  recent.forEach(([date, c], i) => {
    const col = Math.floor(i / 7), row = i % 7;
    const x = x0 + col * (cell + gap), y = y0 + row * (cell + gap);
    const a = animated ? `<animate attributeName="opacity" values="0;1" dur=".35s" begin="${(.25 + col * .045).toFixed(2)}s" fill="freeze"/>` : '';
    o.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1.6" fill="${RAMP[level(c)]}">${a}</rect>`);
    if (i === recent.length - 1) {
      o.push(`<rect x="${x - 1.5}" y="${y - 1.5}" width="${cell + 3}" height="${cell + 3}" rx="2.5" fill="none" stroke="${t.ink}" stroke-width="1.2">${animated ? '<animate attributeName="opacity" values="1;.2;1" dur="1.6s" repeatCount="indefinite"/>' : ''}</rect>`);
    }
  });
  o.push(`<g>${s.text(`${gh.week} this week · streak ${gh.streak.current} · best ${gh.streak.best}`, 16, 194, 10, { face: 'mono', fill: t.dim })}${fade(3)}</g>`);
  o.push(sh.close);
  s.add(...o);
  return s.finish();
}

function leetcodeCard(lc, { animated = true } = {}) {
  const t = NIGHT;
  const s = new SVG(LW, LH, `LeetCode: ${lc.solved} problems solved`,
    `${lc.easy} easy, ${lc.medium} medium, ${lc.hard} hard.${lc.latest ? ` Latest: ${lc.latest.title}.` : ''}`);
  const [open, top, sh] = liveShell(s, 'leetcode solved', livePill(s, 'live', animated), animated, 'ty');
  const o = [open, top];
  const fade = i => animated ? fadeIn(.1 + i * .12) : '';
  o.push(`<g>${s.text(String(lc.solved), 16, 74, 32, { face: 'display', fill: t.ink })}${s.text('problems solved', 22 + s.measure(String(lc.solved), 32, 'display'), 74, 12, { face: 'body', fill: t.mute })}${fade(0)}</g>`);
  const rows = [['Easy', lc.easy, t.easy], ['Medium', lc.medium, t.medium], ['Hard', lc.hard, t.hard]];
  const top3 = Math.max(1, lc.easy, lc.medium, lc.hard);
  rows.forEach(([label, n, color], i) => {
    const y = 104 + i * 24, bx = 82, bw = 124;
    o.push(s.text(label, 16, y + 4, 11, { face: 'mono', fill: color }));
    o.push(`<rect x="${bx}" y="${y - 3}" width="${bw}" height="6" rx="3" fill="${t.raise}"/>`);
    const w = Math.max(n ? 6 : 0, bw * n / top3);
    o.push(`<rect x="${bx}" y="${y - 3}" width="${w.toFixed(1)}" height="6" rx="3" fill="${color}">${animated ? `<animate attributeName="width" values="0;${w.toFixed(1)}" dur=".9s" begin="${.3 + i * .15}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .7 .2 1"/>` : ''}</rect>`);
    o.push(s.text(String(n), LW - 16, y + 4, 11, { face: 'monoBold', fill: t.ink, anchor: 'end' }));
  });
  if (lc.latest) {
    let title = lc.latest.title;
    while (s.measure(`latest  ${title}`, 10, 'mono') > LW - 32 && title.length > 4) title = title.slice(0, -2).trimEnd() + '…';
    o.push(`<g>${s.text('latest', 16, 194, 10, { face: 'mono', fill: t.soft })}${s.text(title, 16 + s.measure('latest  ', 10, 'mono'), 194, 10, { face: 'mono', fill: t.dim })}${fade(3)}</g>`);
  }
  o.push(sh.close);
  s.add(...o);
  return s.finish();
}

function languagesCard(gh, { animated = true } = {}) {
  const t = NIGHT;
  const top = gh.languages.slice(0, 6);
  const rest = Math.max(0, 100 - top.reduce((a, l) => a + l.share, 0));
  const s = new SVG(LW, LH, `Languages across ${gh.repos} public repositories`,
    top.map(l => `${l.name} ${l.share.toFixed(1)}%`).join(', ') + '.');
  const [open, topStrip, sh] = liveShell(s, 'repos languages', livePill(s, `${gh.repos} repos`, animated), animated, 'ty');
  const o = [open, topStrip];
  const shades = ['#9dccff', '#6ba9ff', '#4a92ff', '#2f74e0', '#1f5bbf', '#173d72'];
  // stacked bar
  let x = 16;
  const bw = LW - 32;
  s.def(`<clipPath id="bar"><rect x="16" y="48" width="${bw}" height="10" rx="5"/></clipPath>`);
  const segs = [];
  top.forEach((l, i) => {
    const w = bw * l.share / 100;
    segs.push(`<rect x="${x.toFixed(1)}" y="48" width="${(w + .5).toFixed(1)}" height="10" fill="${shades[i]}"/>`);
    x += w;
  });
  if (rest > 0) segs.push(`<rect x="${x.toFixed(1)}" y="48" width="${(16 + bw - x).toFixed(1)}" height="10" fill="${t.raise}"/>`);
  const grow = animated ? `<animateTransform attributeName="transform" type="scale" values="0 1;1 1" dur="1s" begin=".3s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .7 .2 1"/>` : '';
  o.push(`<g clip-path="url(#bar)"><g transform="translate(16 0)"><g>${grow}<g transform="translate(-16 0)">${segs.join('')}</g></g></g></g>`);
  top.forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = 16 + col * 116, ly = 88 + row * 34;
    const a = animated ? fadeIn(.4 + i * .08) : '';
    o.push(`<g><rect x="${lx}" y="${ly - 9}" width="9" height="9" rx="2" fill="${shades[i]}"/>`
      + s.text(l.name, lx + 15, ly, 11, { face: 'body', fill: t.ink })
      + s.text(`${l.share.toFixed(1)}%`, lx + 15, ly + 15, 10, { face: 'mono', fill: t.dim }) + `${a}</g>`);
  });
  o.push(s.text(`${gh.stars} stars · public repos only`, 16, 194, 10, { face: 'mono', fill: t.dim }));
  o.push(sh.close);
  s.add(...o);
  return s.finish();
}

// ---------------------------------------------------------------- metrics banner (wraps live lowlighter/metrics SVG)
function syncIsocalendar(svg, days) {
  if (!Array.isArray(days) || !days.length) return svg;
  const lastDow = new Date(`${days[days.length - 1][0]}T00:00:00Z`).getUTCDay();
  const recent = days.slice(-(26 * 7 + lastDow + 1));
  const reference = Math.max(1, ...recent.map(([, c]) => c));
  const colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  const size = 6;
  const f = n => +n.toFixed(4);
  const weeks = [];
  for (let idx = 0; idx < recent.length; idx += 7) weeks.push(recent.slice(idx, idx + 7));
  const body = weeks.map((week, i) => {
    const tiles = week.map(([, count], j) => {
      const lvl = count === 0 ? 0 : Math.min(4, Math.ceil((count / reference) * 4));
      const color = colors[lvl];
      const ratio = count / reference || 0;
      const h = ratio * size;
      return `<g transform="translate(${f(j * -1.7)}, ${f(j + (1 - ratio) * size)})">` +
        `<path fill="${color}" d="M1.7,2 0,1 1.7,0 3.4,1 z"/>` +
        `<path fill="${color}" filter="url(#brightness1)" d="M0,1 1.7,2 1.7,${f(2 + h)} 0,${f(1 + h)} z"/>` +
        `<path fill="${color}" filter="url(#brightness2)" d="M1.7,2 3.4,1 3.4,${f(1 + h)} 1.7,${f(2 + h)} z"/>` +
        `</g>`;
    }).join('');
    return `<g transform="translate(${f(i * 1.7)}, ${i})">${tiles}</g>`;
  }).join('');
  return svg.replace(
    /(<svg[^>]*viewBox="0,0 480,170"[^>]*>[\s\S]*?<g transform="scale\(4\) translate\(12, 0\)">)[\s\S]*?(<\/g>\s*<\/svg>)/i,
    `$1${body}$2`
  );
}

function animateIsocalendar(svg) {
  return svg.replace(/(<svg[^>]*viewBox="0,0 480,170"[^>]*>)([\s\S]*?)(<\/svg>)/i, (_, open, inner, close) => {
    let w = -1, d = 0;
    const dh = 1.25, dur = 3.6;
    const f = n => +n.toFixed(4);
    const animD = (d0, d1, delay) =>
      `<animate attributeName="d" values="${d0};${d1};${d0}" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${dur}s" begin="-${delay}s" repeatCount="indefinite"/>`;
    // Match outer week group openings vs 3-path isometric blocks
    const body = inner.replace(
      /<g transform="translate\([^)]+\)">\s*(?=<g transform=)|(<path\b[^>]*\/>\s*<path\b[^>]*\/>\s*<path\b[^>]*\/>)/g,
      (m, triplet) => {
        if (!triplet) {
          w++; d = 0;
          return m;
        }
        const paths = [...triplet.matchAll(/<path\b([^>]*?)d="([^"]+)"([^>]*)\/>/g)];
        if (paths.length !== 3) { d++; return m; }
        // Base bottom vertex y is anchored on the fixed calendar floor (`B = 2 + height`)
        const B = +paths[1][2].trim().split(/\s+/)[2].split(',')[1];
        if (!Number.isFinite(B)) { d++; return m; }
        const topD = h => `M1.7,${f(2 - h)} 0,${f(1 - h)} 1.7,${f(-h)} 3.4,${f(1 - h)} z`;
        const leftD = h => `M0,${f(1 - h)} 1.7,${f(2 - h)} 1.7,${f(B)} 0,${f(B - 1)} z`;
        const rightD = h => `M1.7,${f(2 - h)} 3.4,${f(1 - h)} 3.4,${f(B - 1)} 1.7,${f(B)} z`;
        const delay = ((w * 0.14 + d * 0.12) % dur).toFixed(2);
        d++;
        const gens = [topD, leftD, rightD];
        return paths.map(([, pre, origD, post], idx) =>
          `<path${pre}d="${origD}"${post}>${animD(gens[idx](0), gens[idx](dh), delay)}</path>`
        ).join('');
      }
    );
    return `${open}${body}${close}`;
  });
}

function rearrangeMetrics(svg) {
  // Move isocalendar's Commits streaks / Commits per day column and Repositories up beside Activity / Community stats.
  let streaksCol = null;
  let out = svg.replace(
    /(<section>\s*<h2 class="field">[\s\S]*?Contributions calendar[\s\S]*?<\/h2>\s*)<div class="row">\s*<section>\s*<\/section>\s*(<section>[\s\S]*?Commits streaks[\s\S]*?<\/section>)\s*<\/div>(\s*<svg\b[^>]*?)style="margin-top:\s*-130px;"([^>]*?)viewBox="0,0 480,170"([^>]*>)/i,
    (_, head, col, svgPre, svgMid, svgPost) => {
      streaksCol = col.replace(/<(\/?)h3\b/g, '<$1h2');
      return `${head}${svgPre}style="display:block;margin:-4px 0 0 16px;width:510px;height:auto;"${svgMid}viewBox="4,4 232,154"${svgPost}`;
    }
  );
  if (!streaksCol) return svg;

  let reposCol = null;
  out = out.replace(
    /\s*<section class="largeable largeable-inline-flex">\s*<div class="row">\s*<section>\s*(<h2 class="field">(?:(?!<\/h2>)[\s\S])*?\d+\s+Repositories\s*<\/h2>)\s*<div class="row">\s*<section>([\s\S]*?)<\/section>\s*<section>([\s\S]*?)<\/section>\s*<\/div>\s*<\/section>\s*<\/div>\s*<\/section>/i,
    (_, heading, leftFields, rightFields) => {
      reposCol = `<section>${heading}${leftFields}${rightFields}</section>`;
      return '';
    }
  );

  const extraCols = reposCol ? `${streaksCol}\n                ${reposCol}` : streaksCol;
  out = out.replace(
    /(<section class="largeable largeable-inline-flex)(">)\s*<div class="row">(\s*<section>\s*<h2 class="field">(?:(?!<\/h2>)[\s\S])*?Activity\s*<\/h2>[\s\S]*?Community stats[\s\S]*?<\/section>\s*)<\/div>\s*(<\/section>)/i,
    (_, open, gt, mid, close) =>
      `${open}" style="width:100%${gt}<div class="row" style="justify-content:space-between;flex-wrap:nowrap;">${mid}${extraCols}\n                </div>\n            ${close}`.replace(
        /<section>/g, '<section style="flex:0 0 auto;">'
      )
  );
  // Align the header's contribution squares + "Contributed to N repositories" flush-right above the 4-column grid.
  out = out.replace(
    /(<div class="row">\s*<section>[\s\S]*?Followed by[\s\S]*?<\/section>\s*)<section>(\s*<div class="field calendar">[\s\S]*?<\/svg>\s*<\/div>\s*<div class="field">[\s\S]*?Contributed to[\s\S]*?<\/div>\s*)<\/section>(\s*<\/div>)/i,
    (_, leftSec, rightInner, close) => {
      const aligned = rightInner
        .replace('<div class="field calendar">', '<div class="field calendar" style="margin:4px 5px 4px 0;justify-content:flex-end;">')
        .replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 11"', '<svg style="margin:0;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 11"');
      return `${leftSec}<section style="flex:0 0 auto;margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;">${aligned}</section>${close}`;
    }
  );

  // Adjust outer metrics height for the removed bottom Repositories section and tightened calendar crop.
  const heightDelta = reposCol ? 68 : 10;
  out = out.replace(/(<svg\b[^>]*\bheight=")(\d+(?:\.\d+)?)(")/i, (_, pre, h, post) => `${pre}${Math.round(+h - heightDelta)}${post}`);
  return out;
}

function donutAscii(s, { cx, cy, animated = true } = {}) {
  const RAMP = '.\`\':*1zxkm8#@';
  const FILLS = ['#1f5bbf', '#1f5bbf', '#1f5bbf', '#3b82f6', '#3b82f6', '#3b82f6', '#6ba9ff', '#6ba9ff', '#6ba9ff', '#9dccff', '#9dccff', '#f4f9ff', '#f4f9ff'];
  const cols = 52, rows = 27, fSz = 9.0, cellW = fSz * 0.6, cellH = 9.5;
  const mono = font('mono'), upm = 200;
  const gMap = {};
  for (let idx = 0; idx < RAMP.length; idx++) {
    const ch = RAMP[idx];
    const id = `d${idx.toString(16)}`;
    const d = mono.charToGlyph(ch).getPath(0, 0, upm).toPathData(0);
    if (d) s.def(`<path id="${id}" d="${d}"/>`);
    gMap[ch] = d ? id : '';
  }
  const sc = +(fSz / upm).toFixed(5);
  const x0 = +(cx - (cols * cellW) / 2).toFixed(1);
  const y0 = +(cy - (rows * cellH) / 2).toFixed(1);
  const xs = Array.from({ length: cols }, (_, c) => Math.round((c * cellW) / sc));
  const ys = Array.from({ length: rows }, (_, r) => Math.round(((r + 0.8) * cellH) / sc));

  const renderFrame = (A, B) => {
    const buf = Array(cols * rows).fill(-1);
    const z = Array(cols * rows).fill(0);
    const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
    for (let j = 0; j < 6.2832; j += 0.038) {
      const ct = Math.cos(j), st = Math.sin(j);
      for (let i = 0; i < 6.2832; i += 0.013) {
        const sp = Math.sin(i), cp = Math.cos(i);
        const h = ct + 2, D = 1 / (sp * h * sA + st * cA + 5), t = sp * h * cA - st * sA;
        const x = Math.round(cols / 2 + 29 * D * (cp * h * cB - t * sB));
        const y = Math.round(rows / 2 + 16.5 * D * (cp * h * sB + t * cB));
        const o = x + cols * y;
        const lum = Math.floor(10 * ((st * sA - sp * ct * cA) * cB - sp * ct * sA - st * cA - cp * ct * sB));
        if (y >= 0 && y < rows && x >= 0 && x < cols && D > z[o]) {
          z[o] = D;
          buf[o] = Math.max(0, Math.min(RAMP.length - 1, lum));
        }
      }
    }
    const buckets = new Map();
    for (let r = 0; r < rows; r++) {
      const rowBuckets = new Map();
      for (let c = 0; c < cols; c++) {
        const idx = buf[r * cols + c];
        if (idx < 0) continue;
        const gid = gMap[RAMP[idx]];
        if (!gid) continue;
        const fill = FILLS[idx];
        if (!rowBuckets.has(fill)) rowBuckets.set(fill, []);
        rowBuckets.get(fill).push([gid, xs[c]]);
      }
      for (const [fill, cells] of rowBuckets) {
        if (!buckets.has(fill)) buckets.set(fill, []);
        if (cells.length >= 5) {
          buckets.get(fill).push(`<g transform="translate(0 ${ys[r]})">${cells.map(([gid, x]) => `<use href="#${gid}" x="${x}"/>`).join('')}</g>`);
        } else {
          for (const [gid, x] of cells) buckets.get(fill).push(`<use href="#${gid}" x="${x}" y="${ys[r]}"/>`);
        }
      }
    }
    return [...buckets].map(([fill, items]) => `<g fill="${fill}">${items.join('')}</g>`).join('');
  };

  const A0 = 0.55, B0 = 0.7;
  if (!animated) {
    return `<g transform="translate(${x0} ${y0}) scale(${sc})">${renderFrame(A0, B0)}</g>`;
  }

  // 60 fps seamless loop (180 frames over 3.0s)
  const F = 180, dur = '3s';
  const frames = [];
  for (let f = 0; f < F; f++) {
    const A = A0 + (Math.PI * 2 * f) / F;
    const B = B0 + (Math.PI * 2 * f) / F;
    const layers = renderFrame(A, B);
    let anim;
    if (f === 0) {
      anim = `<animate attributeName="visibility" values="visible;hidden" keyTimes="0;${(1 / F).toFixed(4)}" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/>`;
    } else if (f === F - 1) {
      anim = `<animate attributeName="visibility" values="hidden;visible" keyTimes="0;${((F - 1) / F).toFixed(4)}" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/>`;
    } else {
      anim = `<animate attributeName="visibility" values="hidden;visible;hidden" keyTimes="0;${(f / F).toFixed(4)};${((f + 1) / F).toFixed(4)}" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/>`;
    }
    frames.push(`<g visibility="${f === 0 ? 'visible' : 'hidden'}">${layers}${anim}</g>`);
  }
  return `<g transform="translate(${x0} ${y0}) scale(${sc})">${frames.join('')}</g>`;
}

function metricsBanner(rawSvg, { animated = true, days = null } = {}) {
  const synced = syncIsocalendar(rawSvg, days);
  const prepared = rearrangeMetrics(animated ? animateIsocalendar(synced) : synced);
  const openTag = prepared.match(/<svg[^>]*>/i)?.[0] || '';
  const innerW = +(openTag.match(/\bwidth="(\d+(?:\.\d+)?)"/)?.[1] || 960);
  const innerH = +(openTag.match(/\bheight="(\d+(?:\.\d+)?)"/)?.[1] || 1393);
  const W = 1000, padX = Math.round((W - innerW) / 2), topH = 30, padTop = 28, padBot = 32;
  const H = topH + padTop + innerH + padBot;
  const s = new SVG(W, H, 'GitHub and LeetCode metrics banner',
    'Live GitHub activity, 3D contribution calendar, languages, LeetCode stats and skills, and repository summary.');
  s.def('<pattern id="mgrid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#6ba9ff" stroke-opacity=".06"/></pattern>');
  const sh = cardShell(s, W, H, 'mc', 0, animated);
  const o = [sh.open];
  o.push(`<rect x="0" y="${topH}" width="${W}" height="${H - topH}" fill="url(#mgrid)"/>`);
  const mPill = livePill(s, 'daily sync', animated, W, topH);
  o.push(strip(s, { y: 0, w: W, h: topH, prefix: '>', cmd: 'lowlighter/metrics --live', right: mPill, animated, id: 'mty', dur: 8 }));

  // strip XML prolog / outer <svg> attrs and position the live metrics SVG cleanly inside the panel
  const body = prepared
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[^>]*\?>\s*/i, '')
    .replace(/<svg\b[^>]*>/i, m => {
      const cls = m.match(/\bclass="([^"]*)"/)?.[1] || 'large';
      return `<svg xmlns="http://www.w3.org/2000/svg" x="${padX}" y="${topH + padTop}" width="${innerW}" height="${innerH}" class="${esc(cls)}">`;
    });
  o.push(body);
  o.push(donutAscii(s, { cx: 765, cy: 538, animated }));
  o.push(brackets(14, topH + 14, W - 28, H - topH - 28, 18, '#6ba9ff', .32, animated));
  o.push(sh.close);
  s.add(...o);
  return s.finish();
}

function metricsBannerNarrow(stats, { animated = true } = {}) {
  const t = NIGHT, gh = stats.github, lc = stats.leetcode;
  const W = 600, topH = 30, padX = 28, iw = W - padX * 2, H = 642;
  const s = new SVG(W, H, `GitHub and LeetCode metrics: ${gh.total} contributions, ${lc.solved} LeetCode solved`,
    `${gh.total} contributions in 12 months, ${gh.repos} public repositories, ${lc.solved} LeetCode problems solved.`);
  s.def('<pattern id="mgrid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#6ba9ff" stroke-opacity=".06"/></pattern>');
  const sh = cardShell(s, W, H, 'mn', 0, animated);
  const o = [sh.open];
  o.push(`<rect x="0" y="${topH}" width="${W}" height="${H - topH}" fill="url(#mgrid)"/>`);
  const mPill = livePill(s, 'daily sync', animated, W, topH);
  o.push(strip(s, { y: 0, w: W, h: topH, prefix: '>', cmd: 'lowlighter/metrics --live', right: mPill, animated, id: 'mnty', dur: 8 }));

  // 1) GitHub contributions + 31-week mobile-readable heatmap
  o.push(s.text('GITHUB CONTRIBUTIONS', padX, 64, 10, { face: 'mono', fill: '#9bc0ff', spacing: 1.8 }));
  const ghStr = String(gh.total);
  o.push(s.text(ghStr, padX, 104, 34, { face: 'display', fill: t.ink }));
  o.push(s.text('in the last 12 months', padX + 10 + s.measure(ghStr, 34, 'display'), 104, 13, { face: 'body', fill: t.mute }));
  o.push(s.text(`${gh.week} this week · streak ${gh.streak.current}d · best ${gh.streak.best}d`, padX, 126, 11.5, { face: 'mono', fill: t.dim }));

  const days = gh.days;
  const weeks = 31, cell = 13, gap = 4, hx0 = padX + Math.round((iw - (weeks * cell + (weeks - 1) * gap)) / 2), hy0 = 144;
  const lastDow = new Date(days[days.length - 1][0] + 'T00:00:00Z').getUTCDay();
  const recent = days.slice(-((weeks - 1) * 7 + lastDow + 1));
  const maxD = Math.max(1, ...recent.map(d => d[1]));
  recent.forEach(([, c], i) => {
    const col = Math.floor(i / 7), row = i % 7;
    const cx = hx0 + col * (cell + gap), cy = hy0 + row * (cell + gap);
    const lvl = c === 0 ? 0 : Math.min(4, Math.ceil((c / maxD) * 4));
    const anim = animated ? `<animate attributeName="opacity" values="0;1" dur=".3s" begin="${(0.18 + col * 0.03).toFixed(2)}s" fill="freeze"/>` : '';
    o.push(`<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="2.5" fill="${RAMP[lvl]}">${anim}</rect>`);
    if (i === recent.length - 1) {
      o.push(`<rect x="${cx - 1.5}" y="${cy - 1.5}" width="${cell + 3}" height="${cell + 3}" rx="3.2" fill="none" stroke="${t.ink}" stroke-width="1.3">${animated ? '<animate attributeName="opacity" values="1;.25;1" dur="1.6s" repeatCount="indefinite"/>' : ''}</rect>`);
    }
  });

  // 2) Languages bar + 2x3 grid
  o.push(`<path d="M${padX} 280H${W - padX}" stroke="${t.line}"/>`);
  o.push(s.text(`MOST USED LANGUAGES · ${gh.repos} REPOS · ${gh.stars} STARS`, padX, 306, 10, { face: 'mono', fill: '#9bc0ff', spacing: 1.6 }));
  const top = gh.languages.slice(0, 6);
  const rest = Math.max(0, 100 - top.reduce((a, l) => a + l.share, 0));
  const shades = ['#9dccff', '#6ba9ff', '#4a92ff', '#2f74e0', '#1f5bbf', '#173d72'];
  s.def(`<clipPath id="mnbar"><rect x="${padX}" y="320" width="${iw}" height="12" rx="6"/></clipPath>`);
  let lx = padX;
  const barSegs = top.map((l, i) => {
    const bw = iw * l.share / 100;
    const seg = `<rect x="${lx.toFixed(1)}" y="320" width="${(bw + .5).toFixed(1)}" height="12" fill="${shades[i]}"/>`;
    lx += bw;
    return seg;
  });
  if (rest > 0) barSegs.push(`<rect x="${lx.toFixed(1)}" y="320" width="${(padX + iw - lx).toFixed(1)}" height="12" fill="${t.raise}"/>`);
  const barGrow = animated ? `<animateTransform attributeName="transform" type="scale" values="0 1;1 1" dur=".9s" begin=".25s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .7 .2 1"/>` : '';
  o.push(`<g clip-path="url(#mnbar)"><g transform="translate(${padX} 0)"><g>${barGrow}<g transform="translate(-${padX} 0)">${barSegs.join('')}</g></g></g></g>`);

  top.forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const ix = padX + col * 280, iy = 360 + row * 28;
    o.push(`<rect x="${ix}" y="${iy - 10}" width="10" height="10" rx="2.5" fill="${shades[i]}"/>`);
    o.push(s.text(l.name, ix + 18, iy, 13, { face: 'body', fill: t.ink }));
    o.push(s.text(`${l.share.toFixed(1)}%`, ix + 258, iy, 12, { face: 'mono', fill: t.dim, anchor: 'end' }));
  });

  // 3) LeetCode progress
  o.push(`<path d="M${padX} 446H${W - padX}" stroke="${t.line}"/>`);
  o.push(s.text('LEETCODE PROGRESS', padX, 472, 10, { face: 'mono', fill: '#9bc0ff', spacing: 1.8 }));
  const lcStr = String(lc.solved);
  o.push(s.text(lcStr, padX, 510, 34, { face: 'display', fill: t.ink }));
  o.push(s.text('solved', padX + 10 + s.measure(lcStr, 34, 'display'), 510, 13, { face: 'body', fill: t.mute }));
  if (lc.latest?.title) {
    let lt = `latest · ${lc.latest.title}`;
    while (s.measure(lt, 11.5, 'mono') > 280 && lt.length > 10) lt = lt.slice(0, -2).trimEnd() + '…';
    o.push(s.text(lt, W - padX, 510, 11.5, { face: 'mono', fill: t.dim, anchor: 'end' }));
  }
  const lcRows = [['Easy', lc.easy, t.easy], ['Medium', lc.medium, t.medium], ['Hard', lc.hard, t.hard]];
  const lcMax = Math.max(1, lc.easy, lc.medium, lc.hard);
  lcRows.forEach(([label, n, color], i) => {
    const ry = 542 + i * 28, bx = padX + 76, bw = iw - 122;
    o.push(s.text(label, padX, ry + 4, 12.5, { face: 'mono', fill: color }));
    o.push(`<rect x="${bx}" y="${ry - 4}" width="${bw}" height="8" rx="4" fill="${t.raise}"/>`);
    const rw = Math.max(n ? 8 : 0, (bw * n) / lcMax);
    o.push(`<rect x="${bx}" y="${ry - 4}" width="${rw.toFixed(1)}" height="8" rx="4" fill="${color}">${animated ? `<animate attributeName="width" values="0;${rw.toFixed(1)}" dur=".85s" begin="${(0.25 + i * 0.14).toFixed(2)}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .7 .2 1"/>` : ''}</rect>`);
    o.push(s.text(String(n), W - padX, ry + 4, 12.5, { face: 'monoBold', fill: t.ink, anchor: 'end' }));
  });

  o.push(brackets(14, topH + 14, W - 28, H - topH - 28, 18, '#6ba9ff', .32, animated));
  o.push(sh.close);
  s.add(...o);
  return s.finish();
}

// ---------------------------------------------------------------- contact card (380 inner + 6px gutter = 392)
function contactCard(c, { animated = true, begin = 0 } = {}) {
  const t = NIGHT, innerH = 104, W = CW + CPAD * 2, H = innerH + CPAD * 2;
  const ox = CPAD, oy = CPAD;
  const s = new SVG(W, H, `${c.label}: ${c.value}`);
  const sh = cardShell(s, W, H, 'c', CPAD, animated);
  const o = [sh.open];
  o.push(strip(s, { x: ox, y: oy, w: CW, h: 30, cmd: c.cmd, animated, id: 'ty', dur: 7, begin }));
  o.push(`<rect x="${ox + 18}" y="${oy + 44}" width="44" height="44" rx="9" fill="${t.raise}" stroke="${t.edge}" stroke-opacity=".3"/>`);
  const glyph = c.icon
    ? drawIcon(icon(c.icon), ox + 30, oy + 56, 20, t.pale)
    : s.text(c.letters, ox + 40, oy + 72, 17, { face: 'heavy', fill: t.pale, anchor: 'middle' });
  o.push(animated
    ? `<g>${glyph}<animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur="3s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></g>`
    : glyph);
  o.push(s.text(c.label, ox + 76, oy + 63, 15.5, { face: 'display', fill: t.ink }));
  o.push(s.text(c.value, ox + 76, oy + 82, 10.5, { face: 'mono', fill: t.dim }));
  o.push(`<circle cx="${ox + CW - 32}" cy="${oy + 66}" r="14" fill="${t.raise}" stroke="${t.edge}" stroke-opacity=".35">${animated ? '<animate attributeName="stroke-opacity" values=".28;.78;.28" dur="2.6s" repeatCount="indefinite"/></circle>' : '</circle>'}`
    + `<path d="M${ox + CW - 36} ${oy + 70}l8-8m-6 0h6v6" fill="none" stroke="${t.pale}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${animated ? '<animateTransform attributeName="transform" type="translate" values="0 0;1.5 -1.5;0 0" dur="2.6s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>' : '</path>'}`);
  o.push(sh.close);
  s.add(...o);
  return s.finish();
}

// ---------------------------------------------------------------- pre-portrait circuit-trace divider (after Contact)
function traceDivider(t, { animated = true, narrow = false } = {}) {
  const W = narrow ? 600 : 1000, H = 78;
  const s = new SVG(W, H, 'La La Lost You bridge timing trace divider');
  s.add(circuitTrace(s, { x: 4, y: 6, w: W - 8, lanes: 4, laneOffset: 20, t, animated, seed: 5 }));
  return s.finish();
}

// ---------------------------------------------------------------- footer (transparent, themed: caption above bottom 4-line circuit)
function footer(profile, updated, t, { animated = true, narrow = false } = {}) {
  const W = narrow ? 600 : 1000;
  const yCircuit = updated ? (narrow ? 56 : 52) : (narrow ? 36 : 34);
  const H = yCircuit + 72;
  const s = new SVG(W, H, profile.footer);
  s.add(s.text(profile.footer, W / 2, narrow ? 18 : 16, narrow ? 11.5 : 11, { face: 'mono', fill: t.dim, spacing: narrow ? 1.1 : 1.6, anchor: 'middle' }));
  if (updated) {
    const updText = `METRICS REFRESHED ${updated}`;
    const uy = narrow ? 38 : 34, us = narrow ? 10 : 9, uw = s.measure(updText, us, 'mono', 1.4);
    s.add(`<circle cx="${W / 2 - uw / 2 - 10}" cy="${uy - 3.5}" r="2.4" fill="${t.accent}" opacity=".75">${animated ? '<animate attributeName="opacity" values="1;.2;1" dur="2s" repeatCount="indefinite"/></circle>' : '</circle>'}`);
    s.add(s.text(updText, W / 2, uy, us, { face: 'mono', fill: t.dim, spacing: 1.4, anchor: 'middle', attrs: 'opacity=".7"' }));
  }
  s.add(circuitTrace(s, { x: 4, y: yCircuit, w: W - 8, lanes: 4, laneOffset: 24, t, animated, seed: 6 }));
  return s.finish();
}

// ---------------------------------------------------------------- bottom ASCII artwork (188x64, frameless, density-locked char randomization)
let _asciiCache = null;
function asciiArt({ animated = true } = {}) {
  if (!_asciiCache) _asciiCache = JSON.parse(fs.readFileSync(path.join(ART, 'ascii-art.json'), 'utf8'));
  const { columns: cols, text, colors } = _asciiCache;
  let rows = _asciiCache.rows;
  while (rows > 0 && !text[rows - 1].trim()) rows--;
  const W = 1000, H = Math.round((W * rows / _asciiCache.rows) * 620 / 1106);
  const s = new SVG(W, H, 'ASCII portrait artwork', 'Animated ASCII art portrait in midnight blues and highlights.');
  const parts = [];

  const RAMP = ['.', '-', ':', ';', '=', '+', 's', 'S', 'x', '0', 'X', '8', '#', '@'];
  const gMap = {};
  let upm = 1000;
  for (const ch of RAMP) {
    const info = s.g.glyph(ch, 'mono');
    gMap[ch] = info.id;
    upm = info.upm;
  }
  const cellW = W / cols, cellH = H / rows, fSz = cellH * .98;
  const sc = +(fSz / upm).toFixed(5);
  const hash = (a, b, k) => {
    let x = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263) + Math.imul(k + 1, 1442695041)) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  const qHex = hex => {
    const R = parseInt(hex.slice(1, 3), 16), G = parseInt(hex.slice(3, 5), 16), B = parseInt(hex.slice(5, 7), 16);
    if (R + G + B < 10) return null;
    return '#' + [R, G, B].map(v => Math.min(15, Math.round(v / 17)).toString(16)).join('');
  };

  if (!animated) {
    const buckets = new Map();
    for (let r = 0; r < rows; r++) {
      const row = text[r];
      for (let c = 0; c < cols; c++) {
        const ch = row[c];
        if (!gMap[ch]) continue;
        const fill = qHex(colors[r][c]);
        if (!fill) continue;
        if (!buckets.has(fill)) buckets.set(fill, []);
        const gx = Math.round((c * cellW) / sc), gy = Math.round(((r + 0.80) * cellH) / sc);
        buckets.get(fill).push(`<use href="#${gMap[ch]}" x="${gx}" y="${gy}"/>`);
      }
    }
    const layers = [...buckets].map(([fill, items]) => `<g fill="${fill}">${items.join('')}</g>`).join('');
    parts.push(`<g transform="scale(${sc})">${layers}</g>`);
  } else {
    const G = 8, S = 3;
    const DURS = [0.91, 1.07, 1.23, 1.39, 1.57, 1.73, 1.91, 2.09];
    const kt = Array.from({ length: S }, (_, i) => +(i / S).toFixed(3)).join(';');
    const grouped = Array.from({ length: G }, () => []);

    for (let r = 0; r < rows; r++) {
      const row = text[r];
      for (let c = 0; c < cols; c++) {
        const ch = row[c];
        const idx = RAMP.indexOf(ch);
        if (idx < 0) continue;
        const fill = qHex(colors[r][c]);
        if (!fill) continue;
        const lo = Math.max(0, Math.min(RAMP.length - 4, idx - 1));
        const pool = RAMP.slice(lo, lo + 4);
        const rem = [0, 1, 2, 3];
        const s0 = rem.splice(Math.floor(hash(c, r, 11) * 4), 1)[0];
        const s1 = rem.splice(Math.floor(hash(c, r, 23) * 3), 1)[0];
        const s2 = rem[Math.floor(hash(c, r, 37) * 2)];
        const chars = [pool[s0], pool[s1], pool[s2]];
        const gx = Math.round((c * cellW) / sc), gy = Math.round(((r + 0.80) * cellH) / sc);
        const g = Math.floor(hash(c, r, 91) * G);
        grouped[g].push({ gx, gy, fill, chars });
      }
    }

    const out = [];
    for (let g = 0; g < G; g++) {
      const dur = `${DURS[g]}s`;
      const begin = `-${+((g * 0.23) % DURS[g]).toFixed(2)}s`;
      for (let st = 0; st < S; st++) {
        const buckets = new Map();
        for (const cell of grouped[g]) {
          const gid = gMap[cell.chars[st]];
          if (!gid) continue;
          if (!buckets.has(cell.fill)) buckets.set(cell.fill, []);
          buckets.get(cell.fill).push(`<use href="#${gid}" x="${cell.gx}" y="${cell.gy}"/>`);
        }
        const vis = Array.from({ length: S }, (_, i) => (i === st ? 'visible' : 'hidden')).join(';');
        const layers = [...buckets].map(([fill, items]) => `<g fill="${fill}">${items.join('')}</g>`).join('');
        out.push(`<g visibility="${st === 0 ? 'visible' : 'hidden'}">${layers}<animate attributeName="visibility" values="${vis}" keyTimes="${kt}" calcMode="discrete" dur="${dur}" begin="${begin}" repeatCount="indefinite"/></g>`);
      }
    }
    parts.push(`<g transform="scale(${sc})">${out.join('')}</g>`);
  }

  s.add(...parts);
  return s.finish();
}

module.exports = { banner, header, intro, projectCard, projectLines, stackBanner, contributionsCard, leetcodeCard, languagesCard, metricsBanner, metricsBannerNarrow, contactCard, traceDivider, footer, asciiArt, CW, CPAD, LW, LH };
