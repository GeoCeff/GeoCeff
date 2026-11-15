// Everything the README says lives here. Change copy here, then `npm run build`.
const profile = {
  name: 'Geo Ceff Vinzr H. Gabaisen',
  headline: 'GEOCEFF',
  handle: 'VYNZER',
  github: 'GeoCeff',
  leetcode: 'Vinzr',
  role: 'COMPUTER SCIENCE / BUILDER / DATA + GAME SYSTEMS',
  focus: "I build local-first tools, data interfaces, and game systems that turn technical ideas into usable software. I'm a Computer Science student at UP Cebu and a DOST-SEI undergraduate scholar.",
  chips: ['CEBU, PH', 'UP CEBU', 'DOST-SEI SCHOLAR', 'BUILDING'],
  portfolio: 'https://geoceff.github.io/portfolio-website-public/',
  portfolioShort: 'geoceff.github.io/portfolio-website-public',
  footer: 'CEBU, PHILIPPINES · PRACTICAL SYSTEMS · SHIPPED WITH RECEIPTS',
};

// art: which pictogram the card draws (see cards.cjs)
const projects = [
  {
    slug: 'stock-tester-and-simulator', kicker: '01 / MARKET RESEARCH', title: 'Quantitative Trading Platform', art: 'chart',
    text: 'Research and paper-trading workspace for comparing tickers, testing strategies, and reviewing risk metrics.',
    stack: ['python', 'streamlit', 'backtesting'],
  },
  {
    slug: 'perk-the-star', kicker: '02 / GAME SYSTEMS', title: 'Perk the Star', art: 'controller',
    text: 'Godot tower-defense game with custom C++ systems, upgrades, and JSON-driven enemy waves.',
    stack: ['godot', 'c++', 'gdextension'],
  },
  {
    slug: 'chatgpt-thread-optimizer', kicker: '03 / BROWSER TOOLING', title: 'ChatGPT Thread Optimizer', art: 'browser',
    text: 'Browser extension that reduces rendering pressure in long ChatGPT conversations by parking older turns.',
    stack: ['javascript', 'extension', 'performance'],
  },
  {
    slug: 'python-automation-toolkit', kicker: '04 / AUTOMATION', title: 'Python Automation Toolkit', art: 'terminal',
    text: 'Practical command-line utilities for organizing files, generating CSV reports, and creating backups.',
    stack: ['python', 'cli', 'ci'],
  },
];

// icon: Simple Icons slug, or null for a lettered emblem
const stack = [
  { group: 'Languages, Markup and Styling', items: [
    ['C', 'c'], ['C++', 'cplusplus'], ['JavaScript', 'javascript'], ['TypeScript', 'typescript'],
    ['HTML', 'html5'], ['CSS', 'css'], ['Python', 'python'], ['GDScript', 'godotengine']] },
  { group: 'Frameworks and UI', items: [
    ['React', 'react'], ['Next.js', 'nextdotjs'], ['Streamlit', 'streamlit'],
    ['Chrome Extensions', 'googlechrome'], ['GDExtension', 'godotengine']] },
  { group: 'Tools and Platforms', items: [
    ['Git / GitHub', 'git'], ['GitHub Actions', 'githubactions'], ['Pandas / NumPy', 'pandas'],
    ['Plotly', 'plotly'], ['Godot', 'godotengine'], ['Docker', 'docker']] },
];

const contacts = [
  { id: 'email', label: 'Email', value: 'ghgabaisen@up.edu.ph', cmd: 'mail ghgabaisen@up.edu.ph', href: 'mailto:ghgabaisen@up.edu.ph', icon: 'gmail' },
  { id: 'linkedin', label: 'LinkedIn', value: 'Geo Ceff Vinzr Gabaisen', cmd: 'open linkedin.com/in/geo-ceff…', href: 'https://linkedin.com/in/geo-ceff-vinzr-gabaisen-43214a339/', icon: null, letters: 'in' },
  { id: 'leetcode', label: 'LeetCode', value: 'leetcode.com/u/Vinzr', cmd: 'open leetcode.com/u/Vinzr', href: 'https://leetcode.com/u/Vinzr/', icon: 'leetcode' },
  { id: 'datacamp', label: 'DataCamp', value: 'datacamp.com/portfolio/ghgabaisen', cmd: 'open datacamp.com/portfolio', href: 'https://www.datacamp.com/portfolio/ghgabaisen', icon: 'datacamp' },
];

module.exports = { profile, projects, stack, contacts };
