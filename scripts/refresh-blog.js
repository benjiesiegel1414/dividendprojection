// Refreshes the live fund numbers written into every blog page.
// Runs daily on GitHub Actions (.github/workflows/refresh-blog.yml).
// Usage: node scripts/refresh-blog.js            (downloads the database)
//        node scripts/refresh-blog.js data.csv   (uses a local copy, for testing)
const fs = require('fs');
const path = require('path');
const live = require('../blog/live.js');

// Keep the FAQ structured data identical to the FAQ readers see on the page
function syncFaqSchema(html) {
  const text = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  const faqs = [...html.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map(m => ({ q: text(m[1]), a: text(m[2]) }));
  if (!faqs.length) return html;
  return html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (m, open, json, close) => {
    let data;
    try { data = JSON.parse(json); } catch (e) { return m; }
    const node = (data['@graph'] || []).find(n => n['@type'] === 'FAQPage');
    if (!node) return m;
    node.mainEntity = faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }));
    return open + '\n' + JSON.stringify(data, null, 1).replace(/</g, '\\u003c') + '\n' + close;
  });
}

async function main() {
  const csv = process.argv[2]
    ? fs.readFileSync(process.argv[2], 'utf8')
    : await (await fetch(live.CSV_URL + '&t=' + Date.now())).text();
  const funds = live.fundsFromCSV(csv);
  if (Object.keys(funds).length < 20) throw new Error('Database looks empty, nothing changed');

  const dir = path.join(__dirname, '..', 'blog');
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  let total = 0;

  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
    const p = path.join(dir, file);
    const before = fs.readFileSync(p, 'utf8');
    let changes = 0;
    let html = before.replace(/(<(\w+)[^>]*\bdata-live="([A-Z.]+):(\w+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, sym, key, text, close) => {
      const v = live.format(funds[sym], key);
      if (!v) { console.warn(`${file}: no value for ${sym}:${key}, kept "${text}"`); return m; }
      if (v !== text) changes++;
      return open + v + close;
    });
    if (changes) {
      html = html
        .replace(/(<(\w+)[^>]*\bdata-live-date[^>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, text, close) => open + live.asOf(today) + close)
        .replace(/"dateModified": "\d{4}-\d{2}-\d{2}"/g, `"dateModified": "${iso}"`)
        .replace(/(<meta property="article:modified_time" content=")[^"]*(")/g, `$1${iso}$2`);
      html = syncFaqSchema(html);
      fs.writeFileSync(p, html);
      console.log(`${file}: ${changes} number${changes > 1 ? 's' : ''} updated`);
      total += changes;
    }
  }
  console.log(total ? `Done, ${total} numbers updated` : 'All numbers already current');
}
main().catch(e => { console.error(e.message); process.exit(1); });
