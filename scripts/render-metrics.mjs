import { mkdir, writeFile } from "node:fs/promises";

const token = process.env.GH_METRICS_TOKEN || process.env.GITHUB_TOKEN;
if (!token) throw new Error("Set GH_METRICS_TOKEN or GITHUB_TOKEN");

const query = `query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name } }
        }
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount weekday } }
      }
    }
  }
}`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "User-Agent": "GeoCeff-profile-metrics" },
  body: JSON.stringify({ query, variables: { login: "GeoCeff" } }),
});
const payload = await response.json();
if (!response.ok || payload.errors) throw new Error(JSON.stringify(payload.errors || payload));

const user = payload.data.user;
const calendar = user.contributionsCollection.contributionCalendar;
const days = calendar.weeks.flatMap((week) => week.contributionDays);
const languageBytes = new Map();
let stars = 0;
for (const repo of user.repositories.nodes) {
  stars += repo.stargazerCount;
  for (const { size, node } of repo.languages.edges) {
    languageBytes.set(node.name, (languageBytes.get(node.name) || 0) + size);
  }
}

const languages = [...languageBytes]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);
const languageTotal = [...languageBytes.values()].reduce((sum, bytes) => sum + bytes, 0);

let currentStreak = 0;
for (let index = days.length - 1; index >= 0 && days[index].contributionCount > 0; index--) currentStreak++;
let longestStreak = 0;
let runningStreak = 0;
for (const day of days) {
  runningStreak = day.contributionCount > 0 ? runningStreak + 1 : 0;
  longestStreak = Math.max(longestStreak, runningStreak);
}

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const bronze = ["#e0bd82", "#c59455", "#9f6b35", "#714722", "#49301d"];
const stats = [
  [calendar.totalContributions, "CONTRIBUTIONS / YEAR"],
  [user.repositories.totalCount, "PUBLIC REPOSITORIES"],
  [stars, "STARS EARNED"],
  [user.followers.totalCount, "FOLLOWERS"],
];

let languageX = 50;
const languageBar = languages.map(([name, bytes], index) => {
  const width = 800 * bytes / languageTotal;
  const rect = `<rect x="${languageX.toFixed(1)}" y="190" width="${width.toFixed(1)}" height="8" fill="${bronze[index]}" />`;
  languageX += width;
  return rect;
}).join("");
const languageLegend = languages.map(([name, bytes], index) => {
  const x = 50 + index * 164;
  const percent = Math.round(bytes / languageTotal * 100);
  return `<circle cx="${x + 4}" cy="222" r="4" fill="${bronze[index]}" /><text x="${x + 15}" y="226" class="small">${escapeXml(name)} ${percent}%</text>`;
}).join("");

const recentWeeks = calendar.weeks.slice(-52);
const calendarCells = recentWeeks.flatMap((week, weekIndex) => week.contributionDays.map((day) => {
  const level = day.contributionCount === 0 ? -1 : Math.min(4, Math.ceil(day.contributionCount / 4));
  const fill = level < 0 ? "#193149" : bronze[level];
  return `<rect x="${155 + weekIndex * 13}" y="${302 + day.weekday * 13}" width="9" height="9" rx="2" fill="${fill}"><title>${day.date}: ${day.contributionCount} contributions</title></rect>`;
})).join("");

const updated = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Manila",
  day: "2-digit",
  month: "short",
  year: "numeric",
}).format(new Date()).toUpperCase();

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="460" viewBox="0 0 900 460" role="img" aria-labelledby="title desc">
  <title id="title">Geo Ceff GitHub activity snapshot</title>
  <desc id="desc">Public repositories, contributions, stars, followers, language distribution, and contribution calendar.</desc>
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b2238"/><stop offset="1" stop-color="#07131f"/></linearGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8a592d"/><stop offset=".48" stop-color="#d2aa6c"/><stop offset="1" stop-color="#78502b"/></linearGradient>
  </defs>
  <style>
    text { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; fill: #f4f1e9; }
    .label { font-size: 10px; letter-spacing: 1.5px; fill: #bfcbd5; }
    .value { font-family: Georgia, serif; font-size: 34px; font-weight: 700; fill: #f7f3ea; }
    .small { font-size: 10px; fill: #9fb0bf; }
    .section { font-size: 12px; font-weight: 700; letter-spacing: 1.8px; fill: #d2aa6c; }
  </style>
  <rect x="1" y="1" width="898" height="458" rx="16" fill="url(#panel)" stroke="url(#frame)" stroke-width="2"/>
  <path d="M30 50V28H52 M848 28h22v22" fill="none" stroke="#d2aa6c" stroke-width="1.5"/>
  <text x="50" y="45" class="section">GITHUB / PUBLIC ACTIVITY</text>
  <text x="850" y="45" text-anchor="end" class="small">UPDATED ${updated}</text>
  ${stats.map(([value, label], index) => `<g transform="translate(${50 + index * 210} 68)"><text y="38" class="value">${value}</text><text y="64" class="label">${label}</text></g>`).join("")}
  <path d="M235 72v58 M445 72v58 M655 72v58" stroke="#d2aa6c" stroke-opacity=".28"/>
  <text x="50" y="168" class="section">LANGUAGES</text>
  <rect x="50" y="190" width="800" height="8" rx="4" fill="#193149"/>
  <clipPath id="bar"><rect x="50" y="190" width="800" height="8" rx="4"/></clipPath>
  <g clip-path="url(#bar)">${languageBar}</g>
  ${languageLegend}
  <line x1="50" y1="252" x2="850" y2="252" stroke="#d2aa6c" stroke-opacity=".24"/>
  <text x="50" y="280" class="section">CONTRIBUTIONS / 52 WEEKS</text>
  <text x="64" y="315" class="small">MON</text><text x="64" y="354" class="small">THU</text><text x="64" y="393" class="small">SUN</text>
  ${calendarCells}
  <text x="50" y="435" class="small">${user.contributionsCollection.totalCommitContributions} COMMITS  ·  ${user.contributionsCollection.totalPullRequestContributions} PULL REQUEST  ·  ${currentStreak}-DAY CURRENT STREAK  ·  ${longestStreak}-DAY LONGEST STREAK</text>
</svg>`;

await mkdir("assets", { recursive: true });
await writeFile("assets/github-metrics.svg", svg);
console.log(`Rendered assets/github-metrics.svg for ${calendar.totalContributions} contributions`);
