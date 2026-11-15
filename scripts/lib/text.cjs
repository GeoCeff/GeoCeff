// Text -> vector outlines. GitHub serves README SVGs through <img>, which cannot load web fonts,
// so every word is drawn as glyph paths (defined once per SVG, reused with <use>).
const fs = require('node:fs');
const path = require('node:path');
const opentype = require('opentype.js');

const nm = p => path.join(__dirname, '..', '..', 'node_modules', p);
const FILES = {
  display: '@fontsource/montserrat/files/montserrat-latin-700-normal.woff',
  heavy: '@fontsource/montserrat/files/montserrat-latin-800-normal.woff',
  body: '@fontsource/montserrat/files/montserrat-latin-500-normal.woff',
  mono: '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff',
  monoBold: '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff',
};
const fonts = {};
function font(name) {
  if (!fonts[name]) {
    const buf = fs.readFileSync(nm(FILES[name]));
    fonts[name] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return fonts[name];
}

const r = x => +x.toFixed(2);

class Glyphs {
  constructor() { this.defs = new Map(); }

  // width of a string in px; spacing is extra px between glyphs
  measure(text, size, face = 'display', spacing = 0) {
    const f = font(face), s = size / f.unitsPerEm;
    const gs = f.stringToGlyphs(text);
    let w = 0;
    gs.forEach((g, i) => {
      w += g.advanceWidth * s;
      if (i < gs.length - 1) w += f.getKerningValue(g, gs[i + 1]) * s + spacing;
    });
    return w;
  }

  // returns an SVG group; opts: face, fill, spacing, anchor ('start'|'middle'|'end'), outline (stroke width px), opacity, extra attrs
  text(text, x, y, size, opts = {}) {
    const { face = 'display', fill = '#fff', spacing = 0, anchor = 'start', outline = 0, attrs = '' } = opts;
    const f = font(face), upm = f.unitsPerEm, s = size / upm;
    if (anchor !== 'start') {
      const w = this.measure(text, size, face, spacing);
      x -= anchor === 'middle' ? w / 2 : w;
    }
    const gs = f.stringToGlyphs(text);
    let at = 0;
    const uses = [];
    gs.forEach((g, i) => {
      const id = `${face[0]}${face.length}${g.index}`;
      if (!this.defs.has(id)) {
        const d = g.getPath(0, 0, upm).toPathData(0);
        this.defs.set(id, d);
      }
      if (this.defs.get(id)) uses.push(`<use href="#${id}" x="${Math.round(at)}"/>`);
      at += g.advanceWidth;
      if (i < gs.length - 1) at += f.getKerningValue(g, gs[i + 1]) + spacing / s;
    });
    const paint = outline
      ? `fill="none" stroke="${fill}" stroke-width="${r(outline / s)}" stroke-linejoin="round"`
      : `fill="${fill}"`;
    return `<g transform="translate(${r(x)} ${r(y)}) scale(${+s.toFixed(5)})" ${paint} ${attrs}>${uses.join('')}</g>`;
  }

  // greedy word wrap into lines that fit maxWidth
  wrap(text, size, maxWidth, face = 'body', spacing = 0) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (this.measure(next, size, face, spacing) > maxWidth && line) { lines.push(line); line = w; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  defsMarkup() {
    return [...this.defs].filter(([, d]) => d).map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('');
  }
}

module.exports = { Glyphs, font };
