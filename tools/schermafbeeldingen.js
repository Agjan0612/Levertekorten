/* Schermafbeeldingen voor de handleidingen maken, met verzonnen gegevens in de
   nagebootste Supabase (tests/e2e/nep-supabase.js). Er gaat niets naar de echte database.

   Gebruik:  node tools/schermafbeeldingen.js [uitmap] [namen.json]
   - uitmap: standaard handleidingen/afbeeldingen-nieuw (staat niet in git; zie .gitignore)
   - namen.json (optioneel): {"coordinator": "…", "b1": "…", "b2": "…"} om andere namen te tonen.
     Zet echte namen NOOIT in de repository: de handleidingen in de repository gebruiken
     de verzonnen namen hieronder.
   Formaat zoals de bestaande afbeeldingen: viewport 1280×800, deviceScaleFactor 1.5. */
'use strict';
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const Kern = require('../js/kern.js');

const REPO = path.resolve(__dirname, '..');
const UIT = path.resolve(process.argv[2] || path.join(REPO, 'handleidingen/afbeeldingen-nieuw'));
const NAMEN = Object.assign({coordinator: 'Arnout Janse', b1: 'Pieter de Vries', b2: 'Sanne Bakker'},
  process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : {});
const MAIL = {coordinator: 'coordinator@voorbeeld.nl', b1: 'b1@voorbeeld.nl', b2: 'b2@voorbeeld.nl'};
fs.mkdirSync(UIT, {recursive: true});

/* ---------- Server (zoals tests/e2e/gedeeld.js) ---------- */
const VERVANG = {'/vendor/supabase.js': 'tests/e2e/nep-supabase.js', '/js/config.js': 'tests/e2e/nep-config.js'};
const TYPES = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(REPO, VERVANG[p] || p);
  if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f));
}).listen(0);
const BASIS = () => `http://127.0.0.1:${srv.address().port}/`;

/* ---------- Verzonnen oordelen ---------- */
const bron = Kern.indexeerBron(JSON.parse(fs.readFileSync(path.join(REPO, 'data/bron.json'), 'utf8')));
const zindex = JSON.parse(fs.readFileSync(path.join(REPO, 'data/zindex.json'), 'utf8'));
const FP = bron.vingerafdruk;
// te beoordelen regels in de volgorde van de stapweergave
const volgorde = bron.tekorten.flatMap(t => t.keys).filter(k => !Kern.alInOA(bron.regelMap.get(k)));
function kans(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
const TOEL_NIET = ['sterkte past niet bij de gebruikelijke dosering', 'toedieningsvorm past niet bij deze patiëntgroep', 'andere indicatie; niet zonder overleg met de voorschrijver'];
const TOEL_BESPR = ['hulpstoffen nakijken', 'twijfel over de dosering bij kinderen', 'eerst navragen bij de voorschrijver?'];
function oordeel(wie, k) {
  const x = kans(wie + k);
  if (x < 0.07) return {oordeel: 'niet', toelichting: x < 0.04 ? TOEL_NIET[Math.floor(x * 1000) % 3] : ''};
  if (x < 0.13) return {oordeel: 'bespreken', toelichting: x < 0.10 ? TOEL_BESPR[Math.floor(x * 1000) % 3] : ''};
  return {oordeel: 'akkoord', toelichting: ''};
}
const dag = (d, u) => new Date(Date.UTC(2026, 9, d, u - 2, 17)).toISOString();
function oordelen(wie, n, d, u) {
  return volgorde.slice(0, n).map((k, i) => ({email: MAIL[wie], bron: FP, sleutel: k, ...oordeel(wie, k), gewijzigd: dag(d, u + Math.floor(i / 60))}));
}
function zi(prk) { return zindex.prks.find(p => p.prk === prk) || {}; }
function voorstel(wie, id) {
  const p = zi('124'), t = bron.tekortMap.get('226181');
  return {id, email: MAIL[wie], bron: FP, tekort_prk: '226181', prk: '124', categorie: 'AndereFormuleringNietUitwisselbaar', positie: 3,
    toelichting: 'oraal alternatief als transdermaal niet lukt', gemaakt: dag(14, 9),
    gegevens: {tekortNaam: t.stofnaam, generiek: p.generiek, voorbeeld: p.voorbeeld, zi: p.zi, atc: p.atc, route: p.route, inAssortiment: p.inAssortiment}};
}
const panel = [
  {email: MAIL.coordinator, naam: NAMEN.coordinator, beoordelaar: true, coordinator: true},
  {email: MAIL.b1, naam: NAMEN.b1, beoordelaar: true, coordinator: false},
  {email: MAIL.b2, naam: NAMEN.b2, beoordelaar: true, coordinator: false}];

// Verzonnen gepubliceerde lijst: de regels die al in OA staan, aangevuld met paren uit de Z-index (zelfde ATC en toedieningsweg)
function gepubliceerd() {
  const rijen = bron.regels.filter(Kern.alInOA).map(r => ({velden: [r.prk, r.stofT, r.prkAlt, r.stofA, r.categorie]}));
  // en drie regels uit de huidige lijst, zodat de samenvatting laat zien dat de app dubbele regels overslaat
  for (const k of volgorde.slice(0, 3)) { const r = bron.regelMap.get(k); rijen.push({velden: [r.prk, r.stofT, r.prkAlt, r.stofA, r.categorie]}); }
  const inLijst = new Set(bron.tekorten.map(t => t.prk)), perAtc = new Map();
  for (const p of zindex.prks) if (p.atc && !inLijst.has(p.prk)) (perAtc.get(p.atc + p.route) || perAtc.set(p.atc + p.route, []).get(p.atc + p.route)).push(p);
  const cats = ['AndereSterkte', 'AndereFormuleringUitwisselbaar', 'AndereFormuleringNietUitwisselbaar'];
  for (const groep of perAtc.values()) {
    for (const a of groep) for (const b of groep) if (a !== b && rijen.length < 601 && kans(a.prk + b.prk) < 0.5) rijen.push({velden: [a.prk, a.generiek, b.prk, b.generiek, cats[Math.floor(kans(b.prk) * 3)]]});
  }
  return {bestand: 'alternatieve-prk-regels-20260916.csv', rijen, meldingen: [], geladenOp: dag(20, 9)};
}

// Stand A: halverwege de ronde (beoordelaarsscherm en het meeste van het coördinatorscherm)
const standA = {panel, oordelen: [...oordelen('coordinator', 30, 13, 8), ...oordelen('b1', 145, 15, 9), ...oordelen('b2', 110, 14, 8)],
  voorstellen: [voorstel('b1', 'vs-1'), voorstel('b2', 'vs-2')], besluiten: [], coordinatie: []};
// Stand B: na het paneloverleg (Export, Opzoeken en het eindscherm)
function standB() {
  const d = {panel, oordelen: [...oordelen('coordinator', 249, 19, 8), ...oordelen('b1', 247, 19, 9), ...oordelen('b2', volgorde.length, 18, 8)],
    voorstellen: [voorstel('b1', 'vs-1'), voorstel('b2', 'vs-2')], besluiten: [], coordinatie: [{bron: FP, gepubliceerd: gepubliceerd(), verwijder_afgewezen: false}]};
  const u = Kern.berekenUitkomsten(bron, panel, perEmail(d), {}, {});
  u.regels.filter(x => x.cons === 'bespreken').slice(0, 4).forEach((x, i) => d.besluiten.push({bron: FP, soort: 'regel', sleutel: x.r.key,
    besluit: i === 3 ? 'afgewezen' : 'akkoord', categorie: null, positie: null, notitie: 'besproken in panel 20-10', door: MAIL.coordinator, gewijzigd: dag(20, 10)}));
  d.besluiten.push({bron: FP, soort: 'voorstel', sleutel: '226181|124', besluit: 'akkoord', categorie: 'AndereFormuleringNietUitwisselbaar', positie: 3, notitie: '', door: MAIL.coordinator, gewijzigd: dag(20, 10)});
  return d;
}
function perEmail(d) {
  const uit = {};
  for (const p of d.panel) uit[p.email] = {oordelen: {}, voorstellen: []};
  for (const r of d.oordelen) uit[r.email].oordelen[r.sleutel] = {o: r.oordeel, t: r.toelichting};
  return uit;
}

/* ---------- Schermafbeeldingen ---------- */
(async () => {
  const browser = await chromium.launch();
  const fouten = [];
  async function pagina(db, email, {modus = 'stap', uitlegGezien = true, breed = 1280, hoog = 800, schaal = 1.5} = {}) {
    const ctx = await browser.newContext({viewport: {width: breed, height: hoog}, deviceScaleFactor: schaal});
    await ctx.addInitScript(([db, email, modus, gezien]) => {
      if (!sessionStorage.getItem('nep-klaar')) { localStorage.clear(); localStorage.setItem('nep-db', db); sessionStorage.setItem('nep-klaar', '1'); }
      localStorage.setItem('lt:modus', JSON.stringify(modus));
      if (gezien) localStorage.setItem('lt:uitleg-gezien', 'true');
      sessionStorage.setItem('nep-sessie', email);
    }, [JSON.stringify(db), email, modus, uitlegGezien]);
    const p = await ctx.newPage();
    p.on('pageerror', e => fouten.push(e.message));
    await p.goto(BASIS());
    await p.waitForSelector('#main .stap, #main .regel, #slots .slot, #main .stap-einde, #cinhoud');
    await p.waitForTimeout(400);
    return p;
  }
  // doel: een pagina of een element (locator); extra: bijv. {fullPage: true} of {clip: …}
  // plakkende kop- en onderbalk tijdelijk uit, zodat ze niet over een uitsnede heen vallen
  const losseBalken = (p, aan) => p.evaluate(aan => {
    let st = document.getElementById('foto-stijl');
    if (!st) { st = document.createElement('style'); st.id = 'foto-stijl'; document.head.appendChild(st); }
    st.textContent = aan ? '.kop,.balk{position:static!important}.stap-onder{display:none!important}' : '';
  }, aan);
  const foto = async (doel, naam, extra = {}) => { const pg = doel.page ? doel.page() : doel; await pg.mouse.move(1, 1); await doel.screenshot({path: path.join(UIT, naam + '.png'), ...extra}); console.log('  ' + naam); };
  // ga in de stapweergave naar het tekort met dit PRK (via Volgende/Vorige)
  async function gaNaar(p, prk) {
    const doel = bron.tekorten.findIndex(t => t.prk === prk);
    for (let n = 0; n < 200; n++) {
      const nu = await p.$eval('.stap', el => el.dataset.tekort);
      const i = bron.tekorten.findIndex(t => t.prk === nu);
      if (i === doel) return;
      await p.click(i < doel ? '#btnVolgende' : '[data-actie=stapVorige]');
      await p.waitForTimeout(30);
    }
    throw new Error('tekort niet gevonden: ' + prk);
  }

  console.log('Beoordelaars');
  const b1 = MAIL.b1;
  let p = await pagina(standA, b1, {uitlegGezien: false});
  await p.evaluate(() => window.scrollTo(0, 0));
  await foto(p, 'b05-hoofdscherm');
  await p.click('[data-actie=uitlegWeg]');
  // een tekort met alleen nieuwe alternatieven, minstens twee: Akkoord en Niet akkoord laten zien
  const huidig = await p.$eval('.stap', el => el.dataset.tekort);
  const t = bron.tekortMap.get(huidig), nieuw = t.keys.filter(k => !Kern.alInOA(bron.regelMap.get(k)));
  const regel = k => p.locator(`.regel[data-key="${k}"]`);
  await regel(nieuw[0]).locator('button[data-o=akkoord]').click();
  await p.waitForTimeout(200);
  await foto(regel(nieuw[0]), 'b06-akkoord');
  await regel(nieuw[1]).locator('button[data-o=niet]').click();
  await regel(nieuw[1]).locator('textarea.toel').fill('toedieningsvorm past niet bij deze patiëntgroep');
  await p.waitForTimeout(200);
  await foto(regel(nieuw[1]), 'b07-niet-akkoord');
  await foto(p.locator('#stapOnder .rij'), 'b09-onderbalk-open');
  for (const k of nieuw.slice(2)) await regel(k).locator('button[data-o=akkoord]').click();
  await p.mouse.click(5, 300); await p.waitForTimeout(200);
  await foto(p.locator('#stapOnder .rij'), 'b10-onderbalk-klaar');
  // Staat al in OA: een tekort met één gepubliceerd en enkele nieuwe alternatieven
  const gemengd = bron.tekorten.find((x, i) => { const a = x.keys.filter(k => Kern.alInOA(bron.regelMap.get(k))).length; return i > 50 && a === 1 && x.keys.length === 2; });
  await gaNaar(p, gemengd.prk);
  await losseBalken(p, true); await p.waitForTimeout(200);
  await foto(p.locator('.stap .regels'), 'b08-staat-al-in-oa');
  await losseBalken(p, false);
  // Zelf een alternatief voorstellen (bij een tekort met toedieningsweg cutaan)
  const cutaan = bron.tekorten.find(x => x.stofnaam.includes('BETAMETHASON') && x.keys.length >= 3) || gemengd;
  await gaNaar(p, cutaan.prk);
  await p.click('[data-actie=nieuwVoorstel]');
  await p.fill('.vs-form .vs-zoek', 'carmellose');
  await p.waitForSelector('.zr'); await losseBalken(p, true); await p.waitForTimeout(200);
  await foto(p.locator('.vs-form'), 'b11-voorstel-zoeken');
  await p.click('.zr'); await p.waitForTimeout(200);
  await foto(p.locator('.vs-form'), 'b12-voorstel-gekozen');
  await p.click('[data-actie=annuleerVoorstel]'); await losseBalken(p, false);
  // menu Meer
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('.meer-menu summary'); await p.waitForTimeout(200);
  await foto(p, 'b14-menu-meer', {clip: {x: 640, y: 0, width: 640, height: 300}});
  await p.context().close();

  p = await pagina(standA, b1, {modus: 'lijst'});
  await foto(p, 'b13-lijstweergave');
  await p.context().close();

  // telefoon
  p = await pagina(standA, b1, {breed: 390, hoog: 844, schaal: 2});
  await gaNaar(p, bron.tekorten.find(x => x.keys.length >= 2 && x.keys.every(k => !Kern.alInOA(bron.regelMap.get(k))) && bron.tekorten.indexOf(x) > 60).prk);
  await p.locator('.stap-tekort').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
  await p.waitForTimeout(300);
  await foto(p, 'b16-telefoon');
  await p.context().close();

  // eindscherm (tweede beoordelaar is klaar)
  const B = standB();
  p = await pagina(B, MAIL.b2);
  await foto(p, 'b15-eindscherm', {clip: {x: 0, y: 0, width: 1280, height: 508}});
  await p.context().close();

  console.log('Coördinator');
  const co = MAIL.coordinator;
  const tabblad = async (p, tab) => { await p.click(`#ctabs button[data-tab=${tab}]`); await p.waitForTimeout(300); };
  p = await pagina(standA, co, {modus: 'stap'});
  // de coördinator kan in het beoordelaarsscherm openen: dan eerst wisselen
  if (!(await p.$('#slots .slot'))) { await p.click('.wissel button[data-view=coordineren]'); await p.waitForSelector('#slots .slot'); await p.waitForTimeout(300); }
  await foto(p, 'c02-overzicht', {fullPage: true});
  const tegel = p.locator('#slots .slot', {hasText: 'Gepubliceerde lijst'});
  await foto(tegel, 'c08-tegel-gepubliceerd');
  await tabblad(p, 'bespreken');
  await foto(p, 'c03-bespreken');
  const rij = p.locator('.bs-rij').nth(2);
  await rij.locator('.notitie').fill('besproken in panel 20-10: akkoord');
  await rij.locator('button[data-b=akkoord]').click(); await p.waitForTimeout(400);
  await p.click('#ctabs button[data-tab=bespreken]'); await p.waitForTimeout(300);
  await p.click('text=Besloten'); await p.waitForTimeout(300);
  await foto(p.locator('.bs-rij').first(), 'c04-besluit');
  await tabblad(p, 'voorstellen');
  await foto(p, 'c05-voorstellen');
  await tabblad(p, 'alle');
  await foto(p, 'c06-alle-regels');
  await p.context().close();

  p = await pagina(B, co);
  // de coördinator kan in het beoordelaarsscherm openen: dan eerst wisselen
  if (!(await p.$('#slots .slot'))) { await p.click('.wissel button[data-view=coordineren]'); await p.waitForSelector('#slots .slot'); await p.waitForTimeout(300); }
  await tabblad(p, 'opzoeken');
  await p.fill('#zkInvoer', 'tramadol druppels'); await p.waitForTimeout(400);
  await foto(p, 'c07-opzoeken', {fullPage: true});
  await tabblad(p, 'export');
  await foto(p, 'c09-export', {fullPage: true});
  await p.click('#btnCsv'); await p.waitForSelector('#modal .venster'); await p.waitForTimeout(300);
  await foto(p, 'c10-samenvatting-laadbestand');
  await p.context().close();

  await browser.close(); srv.close();
  if (fouten.length) { console.log('Fouten in de pagina:\n' + fouten.join('\n')); process.exit(1); }
  console.log('Klaar: ' + UIT);
})().catch(e => { console.error(e); process.exit(1); });
