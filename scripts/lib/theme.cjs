// One palette, two page themes. Cards and the banner are opaque night-blue panels in both themes;
// only artwork drawn straight onto the page (section headers, intro, footer) needs the light set.
const NIGHT = {
  page: 'none',
  bg: '#010712',      // deepest night, banner + card base
  panel: '#061226',   // card body
  raise: '#0b1b36',   // tiles, pills
  strip: '#1d4fb8',   // terminal strip (the profile's "ink" blue)
  line: '#1c2f52',    // hairlines on dark
  edge: '#6ba9ff',    // frame strokes (used with opacity)
  accent: '#4a92ff',
  soft: '#6ba9ff',
  pale: '#9dccff',
  ink: '#f4f9ff',
  mute: '#c5d8f3',
  dim: '#7f97bd',
  ok: '#3fb950', easy: '#2cbb5d', medium: '#ffb800', hard: '#ef4743',
};
const LIGHT = {
  ...NIGHT,
  line: '#c8d6ec',
  accent: '#1f63d6',
  soft: '#2a6fd8',
  pale: '#1a4fae',
  ink: '#0b1830',
  mute: '#2c3f63',
  dim: '#5b7096',
  edge: '#2a6fd8',
  raise: '#e3ecfa',
};
module.exports = { NIGHT, LIGHT };
