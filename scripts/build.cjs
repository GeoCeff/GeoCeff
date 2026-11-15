#!/usr/bin/env node
// Draws every asset and writes README.md. Run `npm run fetch` first for fresh numbers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const A = require('./lib/art.cjs');
const { NIGHT, LIGHT } = require('./lib/theme.cjs');
const { profile, projects, stack, contacts } = require('./content.cjs');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stats.json'), 'utf8'));
const rawMetrics = fs.readFileSync(path.join(ROOT, 'data', 'github-metrics.svg'), 'utf8');

// start from a clean assets/ so renamed or removed cards never linger
fs.rmSync(ASSETS, { recursive: true, force: true });
const hashes = {};
function write(rel, svg) {
  const file = path.join(ASSETS, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, svg);
  hashes[rel] = crypto.createHash('sha1').update(svg).digest('hex').slice(0, 8);
}
const both = (rel, fn) => { write(`${rel}.svg`, fn(true)); write(`${rel}-still.svg`, fn(false)); };

// ---- draw
both('banner', a => A.banner(profile, { animated: a }));
both('banner-narrow', a => A.banner(profile, { animated: a, narrow: true }));
for (const [mode, t] of [['dark', NIGHT], ['light', LIGHT]]) {
  write(`intro-${mode}.svg`, A.intro(profile, t, { animated: true }));
  write(`intro-still-${mode}.svg`, A.intro(profile, t, { animated: false }));
  write(`intro-narrow-${mode}.svg`, A.intro(profile, t, { animated: true, narrow: true }));
  write(`intro-narrow-still-${mode}.svg`, A.intro(profile, t, { animated: false, narrow: true }));
}

const sections = {
  metrics: { num: '01', kicker: 'GITHUB METRICS', title: 'Activity, on record.', sub: 'Activity · contributions · languages · LeetCode · featured repos', icon: 'bars' },
  work: { num: '02', kicker: 'SELECTED WORK', title: 'Selected work.', sub: 'Public projects · data systems · game development · automation', icon: 'code' },
  stack: { num: '03', kicker: 'STACK', title: 'Tools I reach for.', sub: 'Languages · frameworks · UI · tools · platforms', icon: 'layers' },
  contact: { num: '04', kicker: 'CONTACT', title: 'Open a channel.', sub: 'Portfolio · email · LinkedIn · LeetCode · DataCamp', icon: 'mail' },
};
for (const [id, sec] of Object.entries(sections)) {
  for (const [mode, t] of [['dark', NIGHT], ['light', LIGHT]]) {
    write(`headers/${id}-${mode}.svg`, A.header(sec, t, { animated: true }));
    write(`headers/${id}-still-${mode}.svg`, A.header(sec, t, { animated: false }));
    write(`headers/${id}-narrow-${mode}.svg`, A.header(sec, t, { animated: true, narrow: true }));
    write(`headers/${id}-narrow-still-${mode}.svg`, A.header(sec, t, { animated: false, narrow: true }));
  }
}

const lines = Math.max(...projects.map(p => A.projectLines(p).length));
projects.forEach((p, i) => both(`projects/${p.slug}`, a => A.projectCard(p, { animated: a, lines, begin: +(-(i * 1.7)).toFixed(2) })));

both('stack-banner', a => A.stackBanner(stack, { animated: a }));
both('stack-banner-narrow', a => A.stackBanner(stack, { animated: a, narrow: true }));

both('metrics-banner', a => A.metricsBanner(rawMetrics, { animated: a }));
both('metrics-banner-narrow', a => A.metricsBannerNarrow(stats, { animated: a }));

contacts.forEach((c, i) => both(`contact/${c.id}`, a => A.contactCard(c, { animated: a, begin: +(-(i * 1.55)).toFixed(2) })));
for (const [mode, t] of [['dark', NIGHT], ['light', LIGHT]]) {
  write(`footer-${mode}.svg`, A.footer(profile, stats.updated, t, { animated: true }));
  write(`footer-still-${mode}.svg`, A.footer(profile, stats.updated, t, { animated: false }));
  write(`footer-narrow-${mode}.svg`, A.footer(profile, stats.updated, t, { animated: true, narrow: true }));
  write(`footer-narrow-still-${mode}.svg`, A.footer(profile, stats.updated, t, { animated: false, narrow: true }));
}
both('ascii-art', a => A.asciiArt({ animated: a }));

// ---- README
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const v = rel => `?v=${hashes[rel]}`; // cache-buster so GitHub's image proxy picks up redraws
const src = (media, rel) => `<source media="${media}" srcset="assets/${rel}${v(rel)}">`;
const RM = '(prefers-reduced-motion: reduce)', DK = '(prefers-color-scheme: dark)', NW = '(max-width: 600px)';

// animated + still, single theme (opaque cards)
function motion(base, alt, attrs) {
  return `<picture>${src(RM, `${base}-still.svg`)}<img src="assets/${base}.svg${v(`${base}.svg`)}" alt="${esc(alt)}" ${attrs}></picture>`;
}
// dark/light (+ optional still, optional narrow), for art drawn straight on the page
function themed(base, alt, attrs, { still = false, narrow = false } = {}) {
  const s = [];
  if (narrow) {
    if (still) {
      s.push(src(`${NW} and ${RM} and ${DK}`, `${base}-narrow-still-dark.svg`));
      s.push(src(`${NW} and ${RM}`, `${base}-narrow-still-light.svg`));
    }
    s.push(src(`${NW} and ${DK}`, `${base}-narrow-dark.svg`));
    s.push(src(NW, `${base}-narrow-light.svg`));
  }
  if (still) {
    s.push(src(`${RM} and ${DK}`, `${base}-still-dark.svg`));
    s.push(src(RM, `${base}-still-light.svg`));
  }
  s.push(src(DK, `${base}-dark.svg`));
  return `<picture>${s.join('')}<img src="assets/${base}-light.svg${v(`${base}-light.svg`)}" alt="${esc(alt)}" ${attrs}></picture>`;
}
const gh = `https://github.com/${profile.github}`;
const h3 = (id, sec, href) => `<h3><a href="${href}">${themed(`headers/${id}`, `${sec.num} / ${sec.kicker}: ${sec.title} ${sec.sub}`, 'width="100%"', { still: true, narrow: true })}</a></h3>`;

const out = [];
out.push(`<!--
  GeoCeff / profile README. Every image is drawn by scripts/ (npm run build).
  Copy lives in scripts/content.cjs; live numbers in data/stats.json (npm run fetch).
  Edit those, not this file or assets/: the daily workflow regenerates both.
-->`);
out.push(`<a href="${profile.portfolio}#home"><picture>${src(`${NW} and ${RM}`, 'banner-narrow-still.svg')}${src(NW, 'banner-narrow.svg')}${src(RM, 'banner-still.svg')}<img src="assets/banner.svg${v('banner.svg')}" alt="${esc(`${profile.name}: ${profile.role}. UP Cebu, DOST-SEI scholar. Open the portfolio at ${profile.portfolioShort}.`)}" width="100%"></picture></a>`);
out.push(`<p><a href="${profile.portfolio}#about">${themed('intro', `${profile.focus} Status: ${profile.chips.join(', ')}.`, 'width="100%"', { still: true, narrow: true })}</a></p>`);

out.push(h3('metrics', sections.metrics, `${gh}?tab=overview`));
out.push(`<a href="${gh}"><picture>${src(`${NW} and ${RM}`, 'metrics-banner-narrow-still.svg')}${src(NW, 'metrics-banner-narrow.svg')}${src(RM, 'metrics-banner-still.svg')}<img src="assets/metrics-banner.svg${v('metrics-banner.svg')}" alt="Geo's GitHub activity, contribution calendar, languages, LeetCode statistics, and featured repositories" width="100%"></picture></a>`);

const cardW = A.CW + A.CPAD * 2;
const grid2 = items => `<p align="center">\n${items.slice(0, 2).join('\n')}<br>\n${items.slice(2).join('\n')}\n</p>`;

out.push(h3('work', sections.work, `${gh}?tab=repositories`));
out.push(grid2(projects.map(p => `<a href="${gh}/${p.slug}">${motion(`projects/${p.slug}`, `${p.title}: ${p.text} Built with ${p.stack.join(', ')}.`, `width="${cardW}"`)}</a>`)));

out.push(h3('stack', sections.stack, `${profile.portfolio}#skills`));
const stackAlt = stack.map(g => `${g.group}: ${g.items.map(i => i[0]).join(', ')}`).join('. ');
out.push(`<a href="${profile.portfolio}#skills"><picture>${src(`${NW} and ${RM}`, 'stack-banner-narrow-still.svg')}${src(NW, 'stack-banner-narrow.svg')}${src(RM, 'stack-banner-still.svg')}<img src="assets/stack-banner.svg${v('stack-banner.svg')}" alt="${esc(stackAlt)}" width="100%"></picture></a>`);

out.push(h3('contact', sections.contact, contacts[0].href));
out.push(grid2(contacts.map(c => `<a href="${c.href}">${motion(`contact/${c.id}`, `${c.label}: ${c.value}`, `width="${cardW}"`)}</a>`)));
out.push(`<p><a href="${gh}/${profile.github}">${themed('footer', profile.footer, 'width="100%"', { still: true, narrow: true })}</a></p>`);
out.push(`<p>${motion('ascii-art', 'Animated ASCII art portrait at the bottom of the profile', 'width="100%"')}</p>`);

fs.writeFileSync(path.join(ROOT, 'README.md'), out.join('\n\n') + '\n');
const total = Object.keys(hashes).length;
const bytes = Object.keys(hashes).reduce((a, r) => a + fs.statSync(path.join(ASSETS, r)).size, 0);
console.log(`drew ${total} assets (${(bytes / 1024).toFixed(0)} KB) and README.md`);
