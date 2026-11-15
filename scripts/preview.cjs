#!/usr/bin/env node
// Screenshots README.md the way GitHub lays it out (headless Chrome / Edge).
// usage: node scripts/preview.cjs [dark|light] [wide|narrow] [still]
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const [scheme = 'dark', size = 'wide', motion = ''] = process.argv.slice(2);
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'preview');
fs.mkdirSync(OUT, { recursive: true });
const browser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(fs.existsSync);

const md = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const dark = scheme === 'dark';
const inner = size === 'wide' ? 830 : 360;
const css = `body{margin:0;background:${dark ? '#0d1117' : '#fff'};color:${dark ? '#e6edf3' : '#1f2328'};font:16px -apple-system,Segoe UI,sans-serif}
.box{width:${inner}px;margin:16px auto;padding:24px;border:1px solid ${dark ? '#30363d' : '#d1d9e0'};border-radius:6px}
img{max-width:100%;box-sizing:content-box;vertical-align:middle}p{margin:0 0 16px}h3{margin:24px 0 16px}a{color:#4493f8}`;
// emulate prefers-reduced-motion for still previews while keeping compound media queries valid
let body = md;
if (motion === 'still') {
  body = body
    .replace(/ and \(prefers-reduced-motion: reduce\)/g, '')
    .replace(/\(prefers-reduced-motion: reduce\) and /g, '')
    .replace(/\(prefers-reduced-motion: reduce\)/g, 'all');
} else {
  body = body.replace(/\(prefers-reduced-motion: reduce\)/g, '(max-width: 0px)');
}
const html = path.join(OUT, '_page.html');
fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><base href="file:///${ROOT.replace(/\\/g, '/')}/"><style>${css}</style><div class="box">${body}</div>`);
const file = path.join(OUT, `${scheme}-${size}${motion ? '-' + motion : ''}.png`);
execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
  `--blink-settings=preferredColorScheme=${dark ? 0 : 1}`, `--force-prefers-color-scheme=${scheme}`,
  `--window-size=${inner + 82},${size === 'wide' ? 4620 : 5920}`, '--virtual-time-budget=5000',
  `--screenshot=${file}`, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore' });
fs.unlinkSync(html);
console.log('wrote', path.relative(ROOT, file));
