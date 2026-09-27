/*
  DividendProjection blog: live fund numbers.

  Every number in a post sits in a tag like <span data-live="SCHD:yield">3.0%</span>.
  The value written in the HTML is what Google reads. It is refreshed every day by
  scripts/refresh-blog.js (GitHub Actions), and refreshed again in the browser when
  a visitor opens the page, so readers always see the latest numbers from the
  TopDividendETFsPRO database.

  Keys: yield, tr, ann, aum, er, freq, decay, inception,
        inc10kYear, inc10kMonth, inc10kPayout, need1kMonth, value10kLaunch
*/
(function (root) {
  var CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxCiod-Cwry7E6k9Un9dgrM_ANymC36_IO_wLyNj-YDo2KI7mp_1ZzyNBnBGZOxT48QPM8TCwtsmA4/pub?gid=0&single=true&output=csv';

  function parseCSV(text) {
    var out = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell.trim()); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); out.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell.trim()); out.push(row); }
    return out;
  }
  function num(s) { var v = parseFloat(String(s == null ? '' : s).replace(/[$,%\s]/g, '')); return isNaN(v) ? null : v; }
  function parseAUM(s) {
    var m = String(s || '').replace(/[$,\s]/g, '').match(/^(-?[\d.]+)([KMBT])?/i);
    return m ? parseFloat(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[2] || '').toUpperCase()] || 1) : null;
  }
  function periodsFor(freq) {
    var f = String(freq || '').toLowerCase();
    if (f.indexOf('week') > -1) return 52;
    if (f.indexOf('quarter') > -1) return 4;
    if (f.indexOf('semi') > -1) return 2;
    if (f.indexOf('annual') > -1 || f.indexOf('year') > -1) return 1;
    return 12;
  }
  // Columns: Symbol, Name, Provider, Yield, Tax grade, Expense ratio, AUM, Total return, Price decay, Inception, Frequency, Rating
  function fundsFromCSV(text) {
    var rows = parseCSV(String(text).trim()).slice(1), funds = {};
    rows.forEach(function (c) {
      if (!c[0] || c.length < 11) return;
      var f = { sym: c[0].toUpperCase(), name: c[1], provider: c[2], yield: num(c[3]), er: num(c[5]), aum: parseAUM(c[6]), tr: num(c[7]), decay: String(c[8] || '').toUpperCase(), inception: c[9], freq: c[10] };
      f.periods = periodsFor(f.freq);
      var d = new Date(f.inception), yrs = (Date.now() - d.getTime()) / 31557600000;
      f.ann = (!isNaN(d.getTime()) && f.tr !== null && yrs >= 1 && 1 + f.tr / 100 > 0) ? (Math.pow(1 + f.tr / 100, 1 / yrs) - 1) * 100 : null;
      if (f.yield !== null) funds[f.sym] = f;
    });
    return funds;
  }

  function usd(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
  function usd2(v) { return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(v, dp) { return v.toFixed(dp).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') + '%'; }
  function signed(v, dp) { return (v > 0 ? '+' : '') + pct(v, dp); }
  function money(v) { return v < 100 ? usd2(v) : usd(v); }

  function format(f, key) {
    if (!f) return null;
    var y = f.yield / 100;
    switch (key) {
      case 'yield': return f.yield.toFixed(2).replace(/0$/, '') + '%';
      case 'tr': return f.tr === null ? null : signed(f.tr, Math.abs(f.tr) >= 100 ? 0 : 1);
      case 'ann': return f.ann === null ? null : signed(f.ann, 1);
      case 'aum': return f.aum === null ? null : (f.aum >= 1e9 ? '$' + (f.aum / 1e9).toFixed(1).replace(/\.0$/, '') + ' billion' : '$' + Math.round(f.aum / 1e6) + ' million');
      case 'er': return f.er === null ? null : pct(f.er, 2);
      case 'freq': return String(f.freq || '').toLowerCase() || null;
      case 'decay': return f.decay === 'NO' ? 'none' : f.decay === 'YES' ? 'yes' : null;
      case 'inc10kYear': return money(10000 * y);
      case 'inc10kMonth': return money(10000 * y / 12);
      case 'inc10kPayout': return money(10000 * y / f.periods);
      case 'need1kMonth': return usd(Math.round(12000 / y / 100) * 100);
      case 'value10kLaunch': return f.tr === null ? null : usd(Math.round(10000 * (1 + f.tr / 100) / 10) * 10);
    }
    return null;
  }
  function asOf(d) { return (d || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }

  var api = { CSV_URL: CSV_URL, fundsFromCSV: fundsFromCSV, format: format, asOf: asOf };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // Browser: refresh numbers on the page with today's database values
  root.DPLive = api;
  function run() {
    var els = document.querySelectorAll('[data-live]');
    if (!els.length || !root.fetch) return;
    fetch(CSV_URL + '&t=' + Date.now()).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (csv) {
      var funds = fundsFromCSV(csv), changed = 0;
      Array.prototype.forEach.call(els, function (el) {
        var p = el.getAttribute('data-live').split(':'), v = format(funds[p[0]], p[1]);
        if (v && el.textContent !== v) { el.textContent = v; changed++; }
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-live-date]'), function (el) { el.textContent = asOf(); });
    }).catch(function () { /* keep the numbers already on the page */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})(this);
