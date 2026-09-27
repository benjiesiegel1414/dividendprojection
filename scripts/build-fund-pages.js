// Builds one page per fund at /etf/<ticker>, plus the /etf/ hub, from the live database.
// Runs daily on GitHub Actions (.github/workflows/build-fund-pages.yml).
// To add funds, add an entry to content/funds.json. Only funds listed there get a page.
// Usage: node scripts/build-fund-pages.js            (downloads the database)
//        node scripts/build-fund-pages.js data.csv   (uses a local copy, for testing)
const fs = require('fs');
const path = require('path');
const live = require('../blog/live.js');

const SITE = 'https://dividendprojection.com';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'etf');

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = v => '$' + Math.round(v).toLocaleString('en-US');
const money = v => v < 100 ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : usd(v);
const L = (sym, key, f) => `<span data-live="${sym}:${key}">${esc(live.format(f, key) || '-')}</span>`;

// Same math as the calculator: share price flat, no dividend growth, dividends reinvested each payout
function project(start, monthly, years, periods, yieldPct) {
  const y = yieldPct / 100, dep = monthly * 12 / periods; let bal = start;
  for (let i = 0; i < years * periods; i++) { bal += dep; bal += bal * y / periods; }
  return { value: bal, monthlyIncome: bal * y / 12 };
}

const BRAND = '<a class="brand" href="/"><span class="brand-mark"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="3.5" cy="14" r="1.6" fill="#4FD1A5"/><circle cx="9" cy="14" r="1.6" fill="#4FD1A5"/><circle cx="9" cy="8.8" r="1.9" fill="#4FD1A5"/><circle cx="14.5" cy="14" r="1.6" fill="#4FD1A5"/><circle cx="14.5" cy="8.8" r="1.9" fill="#4FD1A5"/><circle cx="14.5" cy="3.2" r="2.2" fill="#96F2CF"/></svg></span>DividendProjection</a>';
const HEADER = `<header class="site-header">
  <div class="wrap">
    ${BRAND}
    <nav class="nav" aria-label="Main"><a href="/etf/" aria-current="page">ETFs</a><a class="hide-sm" href="/blog/">Blog</a><a class="hide-sm" href="/about">About</a><a class="cta" href="/"><span class="hide-sm">Open </span><span class="cap">calculator</span></a></nav>
  </div>
</header>`;
const FOOTER = `<footer>
  <div class="wrap">
    <div class="foot-row">
      <nav aria-label="Site">
        <a href="/">Calculator</a><a href="/etf/">ETFs</a><a href="/blog/">Blog</a><a href="/about">About</a><a href="/disclaimer">Disclaimer</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:Business@TopDividendETFs.com">Contact</a>
      </nav>
      <nav aria-label="Network">
        <a href="https://topdividendetfs.com/" target="_blank" rel="noopener">TopDividendETFs</a><a href="https://topdividendetfspro.com/" target="_blank" rel="noopener">PRO Terminal</a><a href="https://weeklyetfs.com/" target="_blank" rel="noopener">WeeklyETFs</a><a href="https://monthlyetfs.com/" target="_blank" rel="noopener">MonthlyETFs</a>
      </nav>
    </div>
    <p>DividendProjection is an educational site. Nothing on this site is financial, investment, legal or tax advice. Projections are hypothetical and not a guarantee of future results.</p>
    <p>&copy; ${new Date().getFullYear()} Dividend Empire LLC. All rights reserved.</p>
  </div>
</footer>`;
const EXTRA_CSS = `<style>
.calc { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; margin:0 0 18px; padding:18px 20px; border-radius:16px; background:#F6F8F7; border:1px solid var(--line); }
.calc label { font-weight:600; color:var(--ink); }
.calc input { width:150px; height:44px; padding:0 12px; border:1px solid var(--line-2); border-radius:12px; font:inherit; font-size:18px; font-weight:600; color:var(--ink); background:#fff; }
.calc output { font-size:15px; color:var(--ink-2); }
.calc output b { color:var(--ink); font-size:18px; }
.facts td:first-child { color:var(--ink); font-weight:600; width:38%; }
.fund-table td:first-child a { font-weight:600; }
</style>`;

function head({ title, desc, url, ld, ogtype }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PTEX3Z2R9L"></script>
<script>
  // Visitors who send a Global Privacy Control signal are not tracked
  if (navigator.globalPrivacyControl) window['ga-disable-G-PTEX3Z2R9L'] = true;
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-PTEX3Z2R9L');
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${ogtype}">
<meta property="og:site_name" content="DividendProjection">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<meta name="theme-color" content="#F2F4F3">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-96x96.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<script type="application/ld+json">
${JSON.stringify(ld, null, 1).replace(/</g, '\\u003c')}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/blog/blog.css">
${EXTRA_CSS}
</head>`;
}

const ORG = { '@type': 'Organization', '@id': SITE + '/#org', name: 'Dividend Empire LLC', url: SITE + '/', logo: SITE + '/icon-512.png', email: 'Business@TopDividendETFs.com' };
const payWord = p => ({ 52: 'week', 12: 'month', 4: 'quarter', 2: 'half year', 1: 'year' }[p] || 'payout');

function fundPage(sym, f, c, all, builtSyms, today) {
  const url = `${SITE}/etf/${sym.toLowerCase()}`;
  const y = f.yield, P = f.periods;
  const title = `${sym} Dividend Calculator: What ${sym} Pays Monthly and Yearly`;
  const desc = `${f.name} (${sym}): live ${live.format(f, 'yield')} dividend yield, total return, and how much $1,000 to $100,000 in ${sym} could pay you each month and year.`;
  const amounts = [1000, 10000, 50000, 100000];
  const goals = [500, 1000, 2000, 5000];
  const horizons = [5, 10, 20, 30];
  const high = y >= 20;

  const perCol = P !== 12; // monthly payers don't need a separate per-payout column
  const incomeRows = amounts.map(a => `<tr><td>${usd(a)}</td>${perCol ? `<td class="num">${money(a * y / 100 / P)}</td>` : ''}<td class="num">${money(a * y / 100 / 12)}</td><td class="num">${money(a * y / 100)}</td></tr>`).join('');
  const goalRows = goals.map(g => `<tr><td>${usd(g)} a month</td><td class="num">${usd(Math.round(g * 12 / (y / 100) / 100) * 100)}</td></tr>`).join('');
  const projRows = horizons.map(n => {
    const a = project(10000, 0, n, P, y), b = project(10000, 500, n, P, y);
    return `<tr><td>${n} years</td><td class="num">${usd(a.value)}</td><td class="num">${money(a.monthlyIncome)}/mo</td><td class="num">${usd(b.value)}</td><td class="num">${money(b.monthlyIncome)}/mo</td></tr>`;
  }).join('');

  // Similar funds: the published pages closest in yield
  const similar = builtSyms.filter(s => s !== sym && all[s]).sort((a, b) => Math.abs(all[a].yield - y) - Math.abs(all[b].yield - y)).slice(0, 4);
  const simRows = similar.map(s => `<tr><td><a href="/etf/${s.toLowerCase()}">${s}</a></td><td>${esc(all[s].name)}</td><td class="num">${L(s, 'yield', all[s])}</td><td class="num">${L(s, 'tr', all[s])}</td></tr>`).join('');

  const faqs = [
    [`What is ${sym}'s dividend yield?`, `${sym}'s dividend yield is currently ${live.format(f, 'yield')}, based on the TopDividendETFsPRO database, which is updated daily.`],
    [`How often does ${sym} pay dividends?`, `${sym} pays ${live.format(f, 'freq')}.`],
    [`How much does $10,000 in ${sym} pay per month?`, `At the current yield, about ${live.format(f, 'inc10kMonth')} a month on average, or ${live.format(f, 'inc10kYear')} a year, assuming the yield stays the same.`],
    [`How much do I need in ${sym} to make $1,000 a month?`, `About ${live.format(f, 'need1kMonth')} at the current yield.`],
    ...(f.tr !== null ? [[`What is ${sym}'s total return?`, `${sym} has returned ${live.format(f, 'tr')} since it launched in ${c.inception.split(' ').pop()}, with dividends reinvested${f.ann !== null ? `, about ${live.format(f, 'ann')} a year on average` : ''}.`]] : []),
    ...(c.faq || []),
  ];
  const faqHtml = faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n        ');

  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': url + '#page', url, name: title, description: desc, isPartOf: { '@id': SITE + '/#website' }, publisher: { '@id': SITE + '/#org' }, dateModified: today, inLanguage: 'en-US', about: { '@type': 'FinancialProduct', name: `${f.name} (${sym})`, provider: { '@type': 'Organization', name: c.issuer } } },
    ORG,
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Dividend Calculator', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'ETFs', item: SITE + '/etf/' },
      { '@type': 'ListItem', position: 3, name: sym, item: url }] },
    { '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ] };

  return `${head({ title: title + ' | DividendProjection', desc, url, ld, ogtype: 'website' })}
<body>
${HEADER}
<main>
  <div class="wrap crumbs"><a href="/">Calculator</a> / <a href="/etf/">ETFs</a> / ${sym}</div>
  <div class="wrap page-hero"><p class="eyebrow">${esc(f.name)}</p>
<h1>${sym} dividend calculator</h1>
<p class="lede">What ${sym} pays today, how much you'd need for a monthly income goal, and what reinvesting could add up to, using ${sym}'s live yield of ${L(sym, 'yield', f)}.</p>
<p class="byline"><span>Numbers updated <b data-live-date>${live.asOf(new Date(today + 'T12:00:00'))}</b></span><span>Pays ${L(sym, 'freq', f)}</span></p></div>
  <div class="wrap" style="padding-bottom:72px">
    <article class="doc" style="max-width:none">
      <section id="numbers">
        <dl class="stats">
          <div><dt>Dividend yield</dt><dd>${L(sym, 'yield', f)}</dd></div>
          <div><dt>Total return since launch</dt><dd>${L(sym, 'tr', f)}</dd></div>
          <div><dt>Average per year</dt><dd>${f.ann !== null ? L(sym, 'ann', f) : '-'}</dd></div>
          <div><dt>Expense ratio</dt><dd>${L(sym, 'er', f)}</dd></div>
          <div><dt>Fund size</dt><dd>${L(sym, 'aum', f)}</dd></div>
          <div><dt>Pays dividends</dt><dd style="text-transform:capitalize">${L(sym, 'freq', f)}</dd></div>
        </dl>
        <p class="asof">From the <a href="https://topdividendetfspro.com/" target="_blank" rel="noopener">TopDividendETFsPRO</a> database, updated daily. Total return includes reinvested dividends.</p>
        ${high ? '<div class="callout warn"><p>ETFs yielding 20% or more often pay out more than their holdings earn. Distributions and share prices can decline over time, so projections based on today\'s yield may be less accurate.</p></div>' : ''}
        <h2>What ${sym} pays you</h2>
        <form class="calc" onsubmit="return false"><label for="amt">If I invest</label><input id="amt" type="text" inputmode="numeric" value="$10,000" aria-label="Amount invested"><output id="out" aria-live="polite"></output></form>
        <div class="table-scroll"><table>
          <thead><tr><th>Invested</th>${perCol ? `<th class="num">Per ${payWord(P)}</th>` : ''}<th class="num">${perCol ? 'Per month (avg)' : 'Per month'}</th><th class="num">Per year</th></tr></thead>
          <tbody>${incomeRows}</tbody>
          <caption>At ${sym}'s current ${live.format(f, 'yield')} yield. Yields change and are not guaranteed.</caption>
        </table></div>
        <div class="cta-band">
          <div><p class="h">Plan it in the full calculator</p><p>Add monthly deposits, taxes, dividend growth and see every year.</p></div>
          <a class="btn" href="/?etf=${sym}&amp;a=10000">Open ${sym} in the calculator</a>
        </div>
      </section>

      <section id="goal">
        <h2>How much you need in ${sym} for a monthly income</h2>
        <div class="table-scroll"><table>
          <thead><tr><th>Monthly income goal</th><th class="num">Invested in ${sym}</th></tr></thead>
          <tbody>${goalRows}</tbody>
        </table></div>
      </section>

      <section id="reinvest">
        <h2>What reinvesting ${sym} dividends could grow to</h2>
        <p>Starting with $10,000 and reinvesting every dividend (${sym} pays ${live.format(f, 'freq')}), with and without adding $500 a month.</p>
        <div class="table-scroll"><table>
          <thead><tr><th>After</th><th class="num">$10,000 once</th><th class="num">Income then</th><th class="num">+ $500/month</th><th class="num">Income then</th></tr></thead>
          <tbody>${projRows}</tbody>
          <caption>Hypothetical. Assumes today's yield holds, no change in share price and no dividend growth, the same assumptions as our calculator. Real results will differ.</caption>
        </table></div>
      </section>

      <section id="about">
        <h2>About ${sym}</h2>
        ${c.about.map(p => `<p>${esc(p)}</p>`).join('\n        ')}
        <div class="table-scroll"><table class="facts"><tbody>
          <tr><td>Full name</td><td>${esc(f.name)}</td></tr>
          <tr><td>Issuer</td><td>${esc(c.issuer)}</td></tr>
          <tr><td>Strategy</td><td>${esc(c.strategy)}</td></tr>
          <tr><td>Launched</td><td>${esc(c.inception)}</td></tr>
          <tr><td>Expense ratio</td><td>${L(sym, 'er', f)}</td></tr>
          <tr><td>Pays</td><td style="text-transform:capitalize">${L(sym, 'freq', f)}</td></tr>
        </tbody></table></div>
        ${c.blog ? `<p>Want the full breakdown? Read our <a href="${c.blog}">in-depth ${sym} guide</a>.</p>` : ''}
      </section>

      ${simRows ? `<section id="similar">
        <h2>Similar funds</h2>
        <div class="table-scroll"><table class="fund-table">
          <thead><tr><th>ETF</th><th>Name</th><th class="num">Yield</th><th class="num">Total return</th></tr></thead>
          <tbody>${simRows}</tbody>
        </table></div>
        <p><a href="/etf/">See all ETF pages</a></p>
      </section>` : ''}

      <section id="faq" class="faq">
        <h2>${sym} FAQ</h2>
        ${faqHtml}
      </section>

      <section id="sources">
        <h2>Sources</h2>
        <ul class="sources">
          ${c.sources.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('\n          ')}
          <li>Yield, total return, fund size and expense ratio: <a href="https://topdividendetfspro.com/" target="_blank" rel="noopener">TopDividendETFsPRO.com</a> database</li>
        </ul>
        <p style="font-size:14px">For education only, not investment, tax or legal advice. Yields and distributions change and are not guaranteed. Past performance does not guarantee future results. Read the fund's prospectus before investing.</p>
      </section>
    </article>
  </div>
</main>
${FOOTER}
<script src="/blog/live.js" defer></script>
<script>
(() => {
  const y = ${y}, P = ${P}, box = document.getElementById('amt'), out = document.getElementById('out');
  const fmt = v => v < 100 ? '$' + v.toFixed(2) : '$' + Math.round(v).toLocaleString('en-US');
  const run = () => { const a = parseFloat(box.value.replace(/[^0-9.]/g, '')) || 0; out.innerHTML = a ? 'pays about <b>' + fmt(a * y / 1200) + '</b> a month, <b>' + fmt(a * y / 100) + '</b> a year' : ''; };
  box.addEventListener('input', run);
  box.addEventListener('blur', () => { const a = parseFloat(box.value.replace(/[^0-9.]/g, '')); if (a) box.value = '$' + a.toLocaleString('en-US'); });
  run();
})();
</script>
</body>
</html>
`;
}

function hubPage(syms, all, today) {
  const url = SITE + '/etf/';
  const title = 'Dividend ETF Calculators: What Popular ETFs Pay Monthly | DividendProjection';
  const desc = 'Dividend calculators for popular ETFs like SCHD, JEPI, JEPQ, QQQI and VYM, with live yields, total returns and what an investment could pay each month.';
  const rows = syms.map(s => `<tr><td><a href="/etf/${s.toLowerCase()}">${s}</a></td><td>${esc(all[s].name)}</td><td class="num">${L(s, 'yield', all[s])}</td><td class="num">${L(s, 'tr', all[s])}</td><td class="num">${L(s, 'inc10kMonth', all[s])}</td></tr>`).join('\n          ');
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', '@id': url + '#page', url, name: title, description: desc, isPartOf: { '@id': SITE + '/#website' }, publisher: { '@id': SITE + '/#org' }, dateModified: today,
      mainEntity: { '@type': 'ItemList', itemListElement: syms.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/etf/${s.toLowerCase()}`, name: `${s} dividend calculator` })) } },
    ORG,
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Dividend Calculator', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'ETFs', item: url }] },
  ] };
  return `${head({ title, desc, url, ld, ogtype: 'website' })}
<body>
${HEADER}
<main>
  <div class="wrap page-hero"><p class="eyebrow">ETFs</p>
<h1>Dividend ETF calculators</h1>
<p class="lede">Pick a fund to see what it pays on any amount, how much you'd need for a monthly income goal, and what reinvesting could grow to. Yields update every day.</p>
<p class="byline"><span>Numbers updated <b data-live-date>${live.asOf(new Date(today + 'T12:00:00'))}</b></span></p></div>
  <div class="wrap" style="padding-bottom:72px">
    <div class="table-scroll" style="background:#fff"><table class="fund-table">
      <thead><tr><th>ETF</th><th>Name</th><th class="num">Yield</th><th class="num">Total return</th><th class="num">$10K pays / month</th></tr></thead>
      <tbody>
          ${rows}
      </tbody>
    </table></div>
    <p style="color:var(--ink-3);font-size:14px">Don't see your fund? The <a href="/">calculator</a> covers 150+ dividend ETFs. Want the deeper story? Read our <a href="/blog/">ETF guides</a>.</p>
  </div>
</main>
${FOOTER}
<script src="/blog/live.js" defer></script>
</body>
</html>
`;
}

// Replace the fund-page block in the sitemap and drop the old ?etf= calculator links
function updateSitemap(syms, today) {
  const p = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(p, 'utf8');
  xml = xml.replace(/^\s*<url><loc>https:\/\/dividendprojection\.com\/\?etf=[^<]*<\/loc>.*<\/url>\s*$\n?/gm, '');
  xml = xml.replace(/\s*<!-- fund-pages:start -->[\s\S]*?<!-- fund-pages:end -->/, '');
  const block = ['  <!-- fund-pages:start -->',
    `  <url><loc>${SITE}/etf/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    ...syms.map(s => `  <url><loc>${SITE}/etf/${s.toLowerCase()}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`),
    '  <!-- fund-pages:end -->'].join('\n');
  xml = xml.replace('</urlset>', block + '\n</urlset>');
  fs.writeFileSync(p, xml);
}

// Only write a file when something other than dates changed, so the repo isn't touched every day for nothing
function writeIfChanged(file, html) {
  const strip = s => s.replace(/\d{4}-\d{2}-\d{2}|[A-Z][a-z]+ \d{1,2}, \d{4}/g, '');
  if (fs.existsSync(file) && strip(fs.readFileSync(file, 'utf8')) === strip(html)) return false;
  fs.writeFileSync(file, html);
  return true;
}

async function main() {
  const csv = process.argv[2]
    ? fs.readFileSync(process.argv[2], 'utf8')
    : await (await fetch(live.CSV_URL + '&t=' + Date.now())).text();
  const all = live.fundsFromCSV(csv);
  if (Object.keys(all).length < 20) throw new Error('Database looks empty, nothing changed');
  const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'funds.json'), 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const syms = Object.keys(content).filter(s => {
    if (!all[s]) { console.warn(`${s}: not in the database, skipped`); return false; }
    return true;
  });
  fs.mkdirSync(OUT, { recursive: true });
  let changed = 0;
  for (const s of syms) if (writeIfChanged(path.join(OUT, s.toLowerCase() + '.html'), fundPage(s, all[s], content[s], all, syms, today))) changed++;
  if (writeIfChanged(path.join(OUT, 'index.html'), hubPage(syms, all, today))) changed++;
  if (changed) updateSitemap(syms, today);
  console.log(`${syms.length} fund pages checked, ${changed} file${changed === 1 ? '' : 's'} updated`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
