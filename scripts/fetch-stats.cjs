#!/usr/bin/env node
// Pulls the live numbers that the profile cards draw: GitHub contributions + languages, LeetCode solves.
// Token: STATS_TOKEN / GITHUB_TOKEN in CI, or the local `gh auth token`.
// A source that fails keeps its previous values, so a flaky API never blanks a card.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { profile } = require('./content.cjs');

const OUT = path.join(__dirname, '..', 'data', 'stats.json');
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

function token() {
  const env = process.env.STATS_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (env) return env;
  try { return execSync('gh auth token', { encoding: 'utf8' }).trim(); } catch { return null; }
}

async function gql(url, query, variables, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'geoceff-profile', ...headers },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function github() {
  const t = token();
  if (!t) throw new Error('no GitHub token');
  const data = await gql('https://api.github.com/graphql', `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
        }
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
          totalCount
          nodes { name stargazerCount languages(first: 12) { edges { size node { name color } } } }
        }
      }
    }`, { login: profile.github }, { authorization: `bearer ${t}` });
  const u = data.user;
  const days = u.contributionsCollection.contributionCalendar.weeks.flatMap(w => w.contributionDays)
    .map(d => [d.date, d.contributionCount]);
  // streaks, counted the way GitHub does: today may still be empty without breaking the run
  let current = 0, best = 0, run = 0;
  days.forEach(([, c]) => { run = c ? run + 1 : 0; best = Math.max(best, run); });
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i][1]) current++;
    else if (i !== days.length - 1) break;
  }
  const langs = {};
  for (const r of u.repositories.nodes) for (const e of r.languages.edges) {
    langs[e.node.name] ??= { bytes: 0, color: e.node.color };
    langs[e.node.name].bytes += e.size;
  }
  const total = Object.values(langs).reduce((a, l) => a + l.bytes, 0) || 1;
  const languages = Object.entries(langs).sort((a, b) => b[1].bytes - a[1].bytes)
    .map(([name, l]) => ({ name, color: l.color, share: +(l.bytes / total * 100).toFixed(2) }));
  return {
    total: u.contributionsCollection.contributionCalendar.totalContributions,
    week: days.slice(-7).reduce((a, [, c]) => a + c, 0),
    streak: { current, best },
    days,
    repos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0),
    languages,
  };
}

async function leetcode() {
  const data = await gql('https://leetcode.com/graphql', `
    query($u: String!) {
      allQuestionsCount { difficulty count }
      matchedUser(username: $u) {
        profile { ranking }
        submitStatsGlobal { acSubmissionNum { difficulty count } }
      }
      recentAcSubmissionList(username: $u, limit: 1) { title timestamp }
    }`, { u: profile.leetcode }, { referer: 'https://leetcode.com' });
  const pick = (arr, d) => (arr.find(x => x.difficulty === d) || {}).count || 0;
  const solved = data.matchedUser.submitStatsGlobal.acSubmissionNum;
  const recent = data.recentAcSubmissionList[0];
  return {
    solved: pick(solved, 'All'),
    easy: pick(solved, 'Easy'), medium: pick(solved, 'Medium'), hard: pick(solved, 'Hard'),
    totals: { easy: pick(data.allQuestionsCount, 'Easy'), medium: pick(data.allQuestionsCount, 'Medium'), hard: pick(data.allQuestionsCount, 'Hard') },
    ranking: data.matchedUser.profile.ranking,
    latest: recent ? { title: recent.title, date: new Date(recent.timestamp * 1000).toISOString().slice(0, 10) } : null,
  };
}

(async () => {
  const out = { ...previous };
  for (const [key, fn] of [['github', github], ['leetcode', leetcode]]) {
    try { out[key] = await fn(); console.log(`${key}: ok`); }
    catch (e) { console.warn(`${key}: kept previous (${e.message})`); }
  }
  const before = JSON.stringify({ ...previous, updated: undefined });
  const after = JSON.stringify({ ...out, updated: undefined });
  if (before !== after || !previous.updated) out.updated = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
})();
