// Builds the explore pages (/what-it-covers/, /your-plan/, ...) from index.html.
// index.html is the single source: each page is the same calculator with a different data-view,
// so the homepage stays short (hero + tiles) and every tile click is a real page view.
// Run: node scripts/build-views.js   (the "Build explore pages" workflow runs it on every index.html change)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SITE = 'https://dividendprojection.com/';

const VIEWS = [
  { key: 'covers', slug: 'what-it-covers', name: 'What it covers',
    title: 'What Your Dividends Could Pay For: Bills Calculator | DividendProjection',
    desc: 'See which everyday bills your dividend ETF income could cover, from your phone bill to rent and a full salary, year by year with live yields.',
    h1: 'What your dividends could pay for' },
  { key: 'plan', slug: 'your-plan', name: 'Your plan',
    title: 'Dividend Plan Calculator: DRIP, Taxes and Dividend Growth | DividendProjection',
    desc: 'Tune your dividend plan: reinvest dividends, pick Taxable, Roth or IRA, set a tax rate and dividend growth, and watch your monthly income update instantly.',
    h1: 'Tune your dividend plan' },
  { key: 'goal', slug: 'income-goal', name: 'Income goal',
    title: 'Dividend Income Goal Calculator: When Do You Hit It? | DividendProjection',
    desc: 'Set a monthly dividend income goal and see the exact year your dividend ETF gets you there, plus how much you would need invested at today\'s yield.',
    h1: 'Dividend income goal calculator' },
  { key: 'compare', slug: 'compare-funds', name: 'Compare funds',
    title: 'Compare Dividend ETFs: Same Plan, Different Fund | DividendProjection',
    desc: 'Run your exact dividend plan through similar dividend ETFs and compare the monthly income each one could pay you, using live yields updated daily.',
    h1: 'Compare dividend ETFs on your plan' },
  { key: 'years', slug: 'year-by-year', name: 'Year by year',
    title: 'Dividend Growth Table: Year by Year Income and Balance | DividendProjection',
    desc: 'A year by year dividend table for your plan: money put in, dividends each year, monthly income and account balance, with your goal year highlighted.',
    h1: 'Year by year dividend breakdown' },
  { key: 'payouts', slug: 'every-payout', name: 'Every payout',
    title: 'Every Dividend Payout You Would Receive, Visualized | DividendProjection',
    desc: 'See every dividend payout your ETF could send you as a dot, from the first payment to the last, with weekly, monthly and quarterly payers.',
    h1: 'Every dividend payout you would receive' },
  { key: 'fund', slug: 'fund-facts', name: 'Fund facts',
    title: 'Dividend ETF Facts: Yield, Fees, Tax Grade and Rating | DividendProjection',
    desc: 'Live facts for any dividend ETF: dividend yield, payout frequency, expense ratio, assets, total return, tax grade and rating, plus what fees cost you.',
    h1: 'Dividend ETF facts' }
];

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function swap(html, re, to, label) {
  if (!re.test(html)) throw new Error('build-views: could not find ' + label);
  return html.replace(re, () => to);
}

for (const v of VIEWS) {
  const url = SITE + v.slug + '/';
  let h = src;
  h = swap(h, /<body class="intro" data-view="home">/, `<body class="intro" data-view="${v.key}">`, 'body');
  h = swap(h, /<title>[^<]*<\/title>/, `<title>${esc(v.title)}</title>`, 'title');
  h = swap(h, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(v.desc)}">`, 'description');
  h = swap(h, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(v.h1)} | DividendProjection">`, 'og:title');
  h = swap(h, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(v.desc)}">`, 'og:description');
  h = swap(h, /<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(v.h1)} | DividendProjection">`, 'twitter:title');
  h = swap(h, /<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(v.desc)}">`, 'twitter:description');
  h = swap(h, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`, 'og:url');
  // Canonical is the clean view URL, with or without ?etf= and plan settings
  h = swap(h, /l\.href = 'https:\/\/dividendprojection\.com\/' \+ \(e \? '\?etf=' \+ encodeURIComponent\(e\) : ''\);/, `l.href = '${url}';`, 'canonical');
  h = swap(h, /<h1 class="hero-h1" id="pageH1">[^<]*<\/h1>/, `<h1 class="hero-h1" id="pageH1">${esc(v.h1)}</h1>`, 'h1');
  h = swap(h, /<b id="crumbHere">[^<]*<\/b>/, `<b id="crumbHere">${esc(v.name)}</b>`, 'crumb');
  h = swap(h, /gtag\('config', 'G-PTEX3Z2R9L'\);/, `gtag('config', 'G-PTEX3Z2R9L', { content_group: '${v.key}' });`, 'gtag config');
  // Structured data: breadcrumb + web page (the FAQ lives on the homepage only)
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': url + '#page', url, name: v.title.replace(/ \| DividendProjection$/, ''), description: v.desc,
        isPartOf: { '@id': SITE + '#website' }, inLanguage: 'en-US' },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Dividend calculator', item: SITE },
        { '@type': 'ListItem', position: 2, name: v.name, item: url } ] }
    ]
  };
  h = swap(h, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">\n${JSON.stringify(ld, null, 1)}\n</script>`, 'ld+json');
  fs.mkdirSync(path.join(ROOT, v.slug), { recursive: true });
  fs.writeFileSync(path.join(ROOT, v.slug, 'index.html'), h);
  console.log('Built /' + v.slug + '/');
}

// Sitemap: keep one managed block for the explore pages
const smPath = path.join(ROOT, 'sitemap.xml');
let sm = fs.readFileSync(smPath, 'utf8');
const today = new Date().toISOString().slice(0, 10);
const block = '  <!-- views:start -->\n' + VIEWS.map(v =>
  `  <url><loc>${SITE}${v.slug}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`).join('\n') + '\n  <!-- views:end -->';
const prev = sm.match(/  <!-- views:start -->[\s\S]*?<!-- views:end -->/);
const prevLocs = prev ? prev[0].replace(/<lastmod>[^<]*<\/lastmod>/g, '') : null;
if (prevLocs !== block.replace(/<lastmod>[^<]*<\/lastmod>/g, '')) {
  sm = prev ? sm.replace(prev[0], block) : sm.replace(/(<url><loc>https:\/\/dividendprojection\.com\/<\/loc>[^\n]*\n)/, `$1${block}\n`);
  fs.writeFileSync(smPath, sm);
  console.log('sitemap.xml updated');
}
