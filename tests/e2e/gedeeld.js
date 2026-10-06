/* Browsertest van de gedeelde werkwijze (drie apothekers + coördinator) tegen de
   nagebootste Supabase. Gebruik: node tests/e2e/gedeeld.js  (vereist Playwright). */
'use strict';
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '../..');
const VERVANG = {'/vendor/supabase.js': 'tests/e2e/nep-supabase.js', '/js/config.js': 'tests/e2e/nep-config.js'};
const TYPES = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json'};
let geslaagd = 0, mislukt = 0;
const ok = (c, m) => { c ? geslaagd++ : mislukt++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(REPO, VERVANG[p] || p);
  if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f));
}).listen(0);
const BASIS = () => `http://127.0.0.1:${srv.address().port}/`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 1440, height: 900}, acceptDownloads: true});
  const fouten = [];
  async function tab(email) {
    const p = await ctx.newPage();
    p.on('pageerror', e => fouten.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fouten.push(m.text()); });
    if (email) await p.addInitScript(e => sessionStorage.setItem('nep-sessie', e), email);
    await p.goto(BASIS());
    return p;
  }
  // panel vullen
  const beheer = await tab(null);
  await beheer.evaluate(() => localStorage.setItem('nep-db', JSON.stringify({panel: [
    {email: 'jan@test.nl', naam: 'Jan Test', beoordelaar: true, coordinator: false},
    {email: 'femke@test.nl', naam: 'Femke Test', beoordelaar: true, coordinator: false},
    {email: 'arnout@test.nl', naam: 'Arnout Test', beoordelaar: true, coordinator: true}], oordelen: [], voorstellen: [], besluiten: [], coordinatie: []})));

  console.log('Inloggen');
  await beheer.reload(); await beheer.waitForSelector('#frmLogin');
  await beheer.fill('#inEmail', 'Jan@Test.nl'); await beheer.click('#frmLogin button');
  await beheer.waitForSelector('#loginMelding .melding');
  const links = await beheer.evaluate(() => JSON.parse(localStorage.getItem('nep-links')));
  ok(links[0].email === 'jan@test.nl' && links[0].redirect === BASIS(), 'inloglink aangevraagd (e-mail in kleine letters, juist terugkeeradres)');
  const vreemd = await tab('vreemde@test.nl'); await vreemd.waitForSelector('.melding.fout');
  ok((await vreemd.textContent('main')).includes('staat (nog) niet op de panellijst'), 'iemand buiten het panel krijgt een duidelijke melding');

  console.log('Jan en Femke beoordelen los van elkaar');
  const bron = JSON.parse(fs.readFileSync(path.join(REPO, 'data/bron.json'), 'utf8'));
  const k = bron.tekorten.flatMap(t => t.keys); // regels in volgorde van de kaarten
  const jan = await tab('jan@test.nl'); await jan.waitForSelector('.kaart');
  ok((await jan.textContent('#kopRechts')).includes('Jan Test') && !(await jan.textContent('#kopRechts')).includes('Coördineren'), 'Jan ziet zijn naam, geen coördinatorknop');
  const geef = async (p, key, o, t) => { await p.click(`.regel[data-key="${key}"] button[data-o=${o}]`); if (t) await p.fill(`.regel[data-key="${key}"] textarea`, t); };
  for (const key of k.slice(0, 5)) await geef(jan, key, 'akkoord');
  await geef(jan, k[5], 'niet', 'sterkte past niet');
  await jan.waitForFunction(() => document.querySelector('#opslagStatus').textContent.includes('Opgeslagen'), null, {timeout: 5000});
  const tk = bron.tekorten[0].prk;
  await jan.click(`.kaart[data-tekort="${tk}"] [data-actie=nieuwVoorstel]`);
  await jan.fill(`.vs-form[data-form="${tk}"] .vs-zoek`, 'estradiol');
  await jan.waitForSelector(`.vs-form[data-form="${tk}"] .zr`);
  await jan.click(`.vs-form[data-form="${tk}"] .zr >> nth=0`);
  await jan.selectOption(`.vs-form[data-form="${tk}"] .vs-cat`, 'AndereFormuleringNietUitwisselbaar');
  await jan.click(`.vs-form[data-form="${tk}"] [data-actie=bewaarVoorstel]`);
  await jan.waitForFunction(() => window.LT.WERK.voorstellen.length === 1);
  ok(true, 'Jan: 6 oordelen en 1 voorstel opgeslagen');

  const femke = await tab('femke@test.nl'); await femke.waitForSelector('.kaart');
  ok((await femke.textContent('#vgTekst')).startsWith('0 van 299'), 'Femke ziet niets van Jan (blind)');
  for (const key of k.slice(0, 3)) await geef(femke, key, 'akkoord');
  await geef(femke, k[3], 'niet', 'liever niet');
  await geef(femke, k[4], 'bespreken');
  await femke.waitForFunction(() => document.querySelector('#opslagStatus').textContent.includes('Opgeslagen'));
  await femke.click(`.kaart[data-tekort="${tk}"] [data-actie=nieuwVoorstel]`);
  await femke.fill(`.vs-form[data-form="${tk}"] .vs-zoek`, 'estradiol');
  await femke.waitForSelector(`.vs-form[data-form="${tk}"] .zr`);
  await femke.click(`.vs-form[data-form="${tk}"] .zr >> nth=0`);
  await femke.selectOption(`.vs-form[data-form="${tk}"] .vs-cat`, 'AndereFormuleringNietUitwisselbaar');
  await femke.click(`.vs-form[data-form="${tk}"] [data-actie=bewaarVoorstel]`);
  await femke.waitForFunction(() => window.LT.WERK.voorstellen.length === 1);

  console.log('Coördinator ziet de uitkomst direct');
  const arnout = await tab('arnout@test.nl'); await arnout.waitForSelector('.kaart');
  ok((await arnout.textContent('#kopRechts')).includes('Coördineren'), 'Arnout (beoordelaar én coördinator) kan wisselen');
  await arnout.click('.wissel button[data-view=coordineren]'); await arnout.waitForSelector('.slots .slot');
  const slots = await arnout.textContent('#slots');
  ok(slots.includes('Jan Test') && slots.includes('6 van 299') && slots.includes('5 van 299') && slots.includes('0 van 299'), 'voortgang per apotheker zichtbaar');
  const cons = async () => arnout.evaluate(ks => { const u = window.LT.U(); return ks.map(x => u.regels.find(y => y.r.key === x)); }, k.slice(0, 6));
  let c = await cons();
  ok(c[0].cons === 'akkoord' && c[1].cons === 'akkoord' && c[2].cons === 'akkoord', 'Jan + Femke akkoord → Akkoord');
  ok(c[3].cons === 'bespreken' && c[4].cons === 'bespreken' && c[5].cons === 'onvolledig', 'oneens → Bespreken; één oordeel → Onvolledig');
  const v = await arnout.evaluate(() => window.LT.U().voorstellen);
  ok(v.length === 1 && v[0].soort === 'gezamenlijk', 'zelfde voorstel van Jan en Femke → gezamenlijk voorstel');

  // live: Femke past iets aan, coördinator ziet het zonder herladen
  await geef(femke, k[5], 'niet', 'eens met Jan');
  await arnout.waitForFunction(key => window.LT.U().regels.find(y => y.r.key === key).cons === 'afgewezen', k[5], {timeout: 8000});
  ok(true, 'live bijgewerkt: Femke sluit zich aan bij Jan → Afgewezen, zonder herladen');

  // Arnout als derde stem
  await arnout.click('.wissel button[data-view=beoordelen]'); await arnout.waitForSelector('.kaart');
  ok((await arnout.textContent('#vgTekst')).startsWith('0 van 299'), 'Arnout ziet als beoordelaar alleen zijn eigen werk');
  await geef(arnout, k[3], 'akkoord'); await geef(arnout, k[4], 'akkoord');
  await arnout.waitForFunction(() => document.querySelector('#opslagStatus').textContent.includes('Opgeslagen'));
  await arnout.click('.wissel button[data-view=coordineren]'); await arnout.waitForSelector('.slots .slot');
  c = await cons();
  ok(c[3].cons === 'akkoord' && c[3].tegenstem, 'Jan akkoord, Femke niet, Arnout akkoord → Akkoord (met afwijkend oordeel)');
  ok(c[4].cons === 'akkoord', 'Jan akkoord, Femke bespreken, Arnout akkoord → Akkoord');

  // eindbesluit na overleg op een open bespreekpunt
  await geef(femke, k[6], 'akkoord'); await geef(jan, k[6], 'niet', 'twijfel');
  await arnout.waitForFunction(key => window.LT.U().regels.find(y => y.r.key === key).cons === 'bespreken', k[6], {timeout: 8000});
  await arnout.click('#ctabs button[data-tab=bespreken]');
  await arnout.waitForSelector(`.bs-rij[data-key="${k[6]}"]`);
  await arnout.fill(`.bs-rij[data-key="${k[6]}"] .notitie`, 'overleg 12-10');
  await arnout.click(`.bs-rij[data-key="${k[6]}"] button[data-b=akkoord]`);
  await arnout.waitForFunction(key => (JSON.parse(localStorage.getItem('nep-db')).besluiten.find(b => b.sleutel === key) || {}).besluit === 'akkoord', k[6]);
  ok(true, 'eindbesluit na overleg opgeslagen in de database');
  const voorstelGk = `${tk}|${v[0].prk}`;
  await arnout.click('#ctabs button[data-tab=voorstellen]');
  await arnout.click(`.bs-rij[data-gk="${voorstelGk}"] button[data-b=akkoord]`);
  await arnout.waitForFunction(gk => (JSON.parse(localStorage.getItem('nep-db')).besluiten.find(b => b.sleutel === gk) || {}).besluit === 'akkoord', voorstelGk);
  ok(true, 'gezamenlijk voorstel aangenomen');

  // laadbestand
  await arnout.click('#ctabs button[data-tab=export]');
  await arnout.click('#btnCsv'); await arnout.waitForSelector('#modal .venster');
  const [d] = await Promise.all([arnout.waitForEvent('download'), arnout.click('#modal .acties button.primair')]);
  const csvPad = path.join(require('os').tmpdir(), d.suggestedFilename()); await d.saveAs(csvPad);
  const buf = fs.readFileSync(csvPad), txt = buf.toString('utf8');
  ok(buf[0] !== 0xEF && !/[^\r]\n/.test(txt) && txt.endsWith('\r\n'), 'CSV: geen BOM, CRLF');
  const regels = txt.split('\r\n').filter(Boolean).slice(1).map(l => l.split(';'));
  const paren = new Set(regels.map(f => f[0] + '|' + f[2]));
  const verwacht = [k[0], k[1], k[2], k[3], k[4], k[6], `${tk}|${v[0].prk}`];
  ok(verwacht.every(x => paren.has(x)) && !paren.has(k[5]) && regels.length === verwacht.length, `CSV bevat precies de ${verwacht.length} akkoord-regels (incl. besluit en voorstel)`);

  // Femke kan geen besluiten zien of maken
  const femkeBesluiten = await femke.evaluate(async () => (await Opslag.besluiten(LT.BRON.vingerafdruk)));
  ok(!Object.keys(femkeBesluiten.regels).length, 'Femke ziet geen besluiten');
  let geweigerd = false; try { await femke.evaluate(async () => Opslag.zetBesluit(LT.BRON.vingerafdruk, 'regel', 'x|y', {b: 'akkoord'})); } catch (e) { geweigerd = true; }
  ok(geweigerd, 'Femke kan geen besluit vastleggen');

  console.log('Zonder verbinding');
  await jan.evaluate(() => localStorage.setItem('nep-offline', '1'));
  await geef(jan, k[7], 'akkoord');
  await jan.waitForFunction(() => document.querySelector('#opslagStatus').textContent.includes('nog niet opgeslagen'), null, {timeout: 5000});
  ok(true, 'zonder verbinding: melding "nog niet opgeslagen"');
  await jan.evaluate(() => localStorage.removeItem('nep-offline'));
  await jan.waitForFunction(() => document.querySelector('#opslagStatus').textContent.includes('Opgeslagen'), null, {timeout: 15000});
  ok(await jan.evaluate(key => JSON.parse(localStorage.getItem('nep-db')).oordelen.some(o => o.email === 'jan@test.nl' && o.sleutel === key), k[7]), 'na herstel automatisch alsnog opgeslagen');

  console.log('Herladen en uitloggen');
  await jan.reload(); await jan.waitForSelector('.kaart');
  ok((await jan.textContent('#vgTekst')).startsWith('8 van 299') && await jan.evaluate(() => LT.WERK.voorstellen.length === 1), 'Jan: na herladen alles terug uit de database');
  ok((await jan.inputValue(`.regel[data-key="${k[5]}"] textarea`)) === 'sterkte past niet', 'toelichting bewaard');
  await jan.click('#btnUit'); await jan.waitForSelector('#frmLogin');
  ok(true, 'uitloggen brengt terug naar het inlogscherm');

  await arnout.screenshot({path: path.join(require('os').tmpdir(), 'lt_coord.png')});
  ok(!fouten.length, 'geen fouten in de browser' + (fouten.length ? ': ' + fouten.join(' | ') : ''));
  console.log(`\nGedeelde werkwijze: ${geslaagd} geslaagd, ${mislukt} mislukt`);
  await browser.close(); srv.close();
  process.exit(mislukt ? 1 : 0);
})().catch(e => { console.error(e); srv.close(); process.exit(2); });
