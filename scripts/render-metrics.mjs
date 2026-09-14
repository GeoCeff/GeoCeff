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
const bronze = ["#d8b477", "#b98645", "#8f5c2a", "#68401d", "#392819"];
const sky = ["#70b7ee", "#3b86c5", "#235e98", "#18466f", "#102d49"];
const stats = [
  [calendar.totalContributions, "CONTRIBUTIONS / YEAR"],
  [user.repositories.totalCount, "PUBLIC REPOSITORIES"],
  [stars, "STARS EARNED"],
  [user.followers.totalCount, "FOLLOWERS"],
];

let languageX = 52;
const languageBar = languages.map(([name, bytes], index) => {
  const width = 796 * bytes / languageTotal;
  const rect = `<rect x="${languageX.toFixed(1)}" y="254" width="${width.toFixed(1)}" height="12" fill="${index % 2 ? sky[index] : bronze[index]}" />`;
  languageX += width;
  return rect;
}).join("");
const languageLegend = languages.map(([name, bytes], index) => {
  const x = 52 + index * 164;
  const percent = Math.round(bytes / languageTotal * 100);
  return `<circle cx="${x + 5}" cy="296" r="5" fill="${index % 2 ? sky[index] : bronze[index]}" /><text x="${x + 17}" y="300" class="small">${escapeXml(name)} ${percent}%</text>`;
}).join("");

const recentWeeks = calendar.weeks.slice(-52);
const calendarCells = recentWeeks.flatMap((week, weekIndex) => week.contributionDays.map((day) => {
  const level = day.contributionCount === 0 ? -1 : Math.min(4, Math.ceil(day.contributionCount / 4));
  const fill = level < 0 ? "#1d3550" : bronze[level];
  return `<rect x="${151 + weekIndex * 13}" y="${365 + day.weekday * 13}" width="9" height="9" rx="2" fill="${fill}"><title>${day.date}: ${day.contributionCount} contributions</title></rect>`;
})).join("");

const updated = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Manila",
  day: "2-digit",
  month: "short",
  year: "numeric",
}).format(new Date()).toUpperCase();

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520" role="img" aria-labelledby="title desc">
  <title id="title">Geo Ceff GitHub activity snapshot</title>
  <desc id="desc">Public repositories, contributions, stars, followers, language distribution, and contribution calendar.</desc>
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#102d50"/><stop offset="1" stop-color="#071624"/></linearGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#70451f"/><stop offset=".3" stop-color="#d8b477"/><stop offset=".58" stop-color="#8f5c2a"/><stop offset=".8" stop-color="#e0bd7a"/><stop offset="1" stop-color="#68401d"/></linearGradient>
  </defs>
  <style>
    text { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; fill: #f4f1e9; }
    .label { font-size: 11px; letter-spacing: 1.7px; fill: #d8b477; }
    .value { font-size: 31px; font-weight: 700; }
    .small { font-size: 10px; fill: #b8c6d3; }
    .section { font-size: 13px; font-weight: 700; letter-spacing: 1.4px; fill: #d8b477; }
  </style>
  <rect x="2" y="2" width="896" height="516" rx="18" fill="url(#panel)" stroke="url(#frame)" stroke-width="4"/>
  <rect x="12" y="12" width="876" height="496" rx="12" fill="none" stroke="#e0bd7a" stroke-opacity=".35"/>
  <text x="42" y="45" class="section">GITHUB SNAPSHOT</text>
  <text x="858" y="45" text-anchor="end" class="small">UPDATED ${updated}</text>
  ${stats.map(([value, label], index) => `<g transform="translate(${42 + index * 210} 66)"><rect width="190" height="116" rx="12" fill="#061522" fill-opacity=".62" stroke="#8f6a3d"/><text x="18" y="52" class="value">${value}</text><text x="18" y="82" class="label">${label}</text></g>`).join("")}
  <text x="42" y="226" class="section">LANGUAGES BY PUBLIC REPOSITORY BYTES</text>
  <rect x="52" y="254" width="796" height="12" rx="6" fill="#1d3550"/>
  <clipPath id="bar"><rect x="52" y="254" width="796" height="12" rx="6"/></clipPath>
  <g clip-path="url(#bar)">${languageBar}</g>
  ${languageLegend}
  <line x1="42" y1="326" x2="858" y2="326" stroke="#8f6a3d" stroke-opacity=".55"/>
  <text x="42" y="352" class="section">CONTRIBUTION CALENDAR / LAST 52 WEEKS</text>
  <text x="64" y="378" class="small">MON</text><text x="64" y="417" class="small">THU</text><text x="64" y="456" class="small">SUN</text>
  ${calendarCells}
  <text x="42" y="496" class="small">${user.contributionsCollection.totalCommitContributions} COMMITS · ${user.contributionsCollection.totalPullRequestContributions} PULL REQUEST · ${currentStreak}-DAY CURRENT STREAK · ${longestStreak}-DAY LONGEST STREAK</text>
</svg>`;

await mkdir("assets", { recursive: true });
await writeFile("assets/github-metrics.svg", svg);
console.log(`Rendered assets/github-metrics.svg for ${calendar.totalContributions} contributions`);
