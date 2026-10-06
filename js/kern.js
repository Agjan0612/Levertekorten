/* Kern van de beoordelingsapp: pure logica zonder scherm of opslag.
   Werkt in de browser (window.Kern) en in Node (require), zodat de bouwstap
   en de tests precies dezelfde code gebruiken als de app. */
(function (root) {
'use strict';

const APP = 'beoordelingsapp_alternatieven';
const FORMAAT = 1;
/* Minimaal zoveel apothekers moeten het eens zijn met het eindoordeel. */
const MIN_EENS = 2;
class Fout extends Error {}
const voornaam = naam => String(naam || '').split(' ')[0];

/* SheetJS: in de browser de globale XLSX, in Node via zetXLSX(require(...)). */
let XLSX_ = typeof root.XLSX !== 'undefined' ? root.XLSX : null;
function zetXLSX(x) { XLSX_ = x; }
function xlsx() { if (!XLSX_ && typeof root.XLSX !== 'undefined') XLSX_ = root.XLSX; if (!XLSX_) throw new Fout('SheetJS (het onderdeel dat Excel leest) is niet geladen.'); return XLSX_; }

const CATEGORIEEN = ['AndereStof', 'AndereDosering', 'AndereFormuleringUitwisselbaar', 'AndereDoseringAndereFormulering', 'AndereFormuleringNietUitwisselbaar'];

const CAT_UITLEG = {
  AndereStof: 'Andere werkzame stof',
  AndereDosering: 'Zelfde stof en vorm, andere sterkte',
  AndereFormuleringUitwisselbaar: 'Andere formulering, uitwisselbaar',
  AndereDoseringAndereFormulering: 'Andere sterkte én andere formulering',
  AndereFormuleringNietUitwisselbaar: 'Andere formulering, niet uitwisselbaar'
};

const OORDEEL_LABEL = {akkoord: 'Akkoord', niet: 'Niet akkoord', bespreken: 'Bespreken'};

const OA_KOP = ['AdviesPrk', 'AdviesPrkNaam', 'AlternatiefPrk', 'AlternatiefPrkNaam', 'Categorie'];

const MIP_MELDING = naam => `"${naam}" is beveiligd (bijvoorbeeld met een Microsoft Information Protection-label of een wachtwoord) en kan daardoor niet worden gelezen. Lever een onbeschermde export aan: open het bestand in Excel, zet de vertrouwelijkheid op een label zonder versleuteling (of verwijder de beveiliging) en sla het opnieuw op als .xlsx.`;

const V_TB = {
  prio: 'Prio', prk: 'PRK', stofT: 'Stofnaam tekort', voorbeeldT: 'Voorbeeldartikel tekort',
  indicatieT: 'Indicatie tekort', consT: 'Conservering tekort', voorraadklasse: 'Voorraadklasse',
  volgorde: 'Volgorde', niveau: 'Niveau', categorie: 'Categorie', prkAlt: 'PRK alternatief',
  stofA: 'Stofnaam alternatief', voorbeeldA: 'Voorbeeldartikel alternatief', consA: 'Conservering alternatief',
  atcA: 'ATC alternatief', signaal: 'Signaal', onderbouwing: 'Onderbouwing / opmerking', bron: 'Bron'
};

const VERPLICHT_TB = ['prk', 'stofT', 'volgorde', 'categorie', 'prkAlt', 'stofA'];

const V_OV = {
  prk: 'PRK', stofnaam: 'Stofnaam', atc: 'ATC', voorraadklasse: 'Voorraadklasse',
  voorraadMsx: 'Voorraad Mosadex (werkdagen)', dagenTot: 'Dagen tot product in PRK weer leverbaar',
  afzet: 'Afzet L3m (verp)', backorder: 'Backorder (verp)', alGepubliceerd: 'Al gepubliceerd advies',
  indicatie: 'Indicatie', uitgesloten: 'Bewust uitgesloten (andere stof)'
};

const V_GA = {prio: 'Prio', prk: 'PRK', stofnaam: 'Stofnaam', voorraadklasse: 'Voorraadklasse', afzet: 'Afzet L3m (verp)', reden: 'Reden'};

const V_WC = {prk: 'PRK', prkAlt: 'PRK alternatief', stofA: 'Stofnaam alternatief', artikelen: 'Artikelen alternatief (conservering)'};

const V_ZI = {
  prk: 'PRK code', generiek: 'Generiek', omschrijving: 'Artikelomschrijving', zi: 'ZI-nummer',
  atc: 'ATC code', route: 'Toedieningsweg', status: 'Artikelstatus', assortiment: 'In assortiment MSX'
};

function normKop(s) { return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase(); }

function tekst(v) { return v == null ? '' : String(v); }

function prkStr(v) {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

function prkNorm(s) { s = String(s ?? '').trim(); return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s; }

function num(v) { if (typeof v === 'number') return v; const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? NaN : n; }

function fmtNum(v) { return typeof v === 'number' && !isNaN(v) ? v.toLocaleString('nl-NL') : tekst(v); }

function pad(n) { return String(n).padStart(2, '0'); }

function stempel(d = new Date()) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }

function leesbareDatum(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? iso : `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function prkSort(a, b) {
  const na = /^\d+$/.test(a) ? +a : NaN, nb = /^\d+$/.test(b) ? +b : NaN;
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  if (!isNaN(na)) return -1; if (!isNaN(nb)) return 1;
  return String(a).localeCompare(String(b));
}

function prkUit(p) { return /^\d+$/.test(p) ? Number(p) : p; }

function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0));
}

function vingerafdruk(str) { return cyrb53(str, 1).toString(16).padStart(14, '0') + cyrb53(str, 7).toString(16).padStart(14, '0'); }

function klasseCls(v) { const s = normKop(v); return s.startsWith('0 dag') ? 'k0' : s.startsWith('0-1') ? 'k1' : 'k2'; }

function nivCls(v) { const s = normKop(v); return s.startsWith('al gepubliceerd') ? 'gepubl' : s.startsWith('andere stof') ? 'andere' : ''; }

const ONVEILIG_CSV = /[;\r\n"]/;

function bevatUtf16(u8, woord) {
  const pat = []; for (const c of woord) { pat.push(c.charCodeAt(0), 0); }
  outer: for (let i = 0; i <= u8.length - pat.length; i++) {
    if (u8[i] !== pat[0]) continue;
    for (let j = 1; j < pat.length; j++) if (u8[i + j] !== pat[j]) continue outer;
    return true;
  }
  return false;
}

function isVersleuteld(u8) {
  const cfb = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  if (u8.length < 8 || !cfb.every((b, i) => u8[i] === b)) return false;
  return bevatUtf16(u8, 'EncryptedPackage') || bevatUtf16(u8, 'DataSpaces');
}

function vindBlad(wb, naam) {
  if (wb.Sheets[naam]) return wb.Sheets[naam];
  const n = wb.SheetNames.find(s => normKop(s) === normKop(naam));
  return n ? wb.Sheets[n] : null;
}

function leesTabel(ws, velden, verplicht, blad, meldingen) {
  const rows = xlsx().utils.sheet_to_json(ws, {header: 1, raw: true, defval: null, blankrows: true});
  const eerste = normKop(velden[verplicht[0]]);
  let kopIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) { if ((rows[i] || []).some(c => normKop(c) === eerste)) { kopIdx = i; break; } }
  if (kopIdx < 0) throw new Fout(`Tabblad "${blad}": geen kopregel gevonden met de kolom "${velden[verplicht[0]]}".`);
  const kop = (rows[kopIdx] || []).map(normKop);
  const idx = {}, mist = [];
  for (const [veld, naam] of Object.entries(velden)) {
    const i = kop.indexOf(normKop(naam));
    if (i < 0) { if (verplicht.includes(veld)) mist.push(naam); else meldingen.push(`Tabblad "${blad}": de verwachte kolom "${naam}" ontbreekt; dit gegeven blijft leeg.`); }
    else idx[veld] = i;
  }
  if (mist.length) throw new Fout(`Tabblad "${blad}": verplichte kolom${mist.length > 1 ? 'men' : ''} ontbreekt: ${mist.map(n => '"' + n + '"').join(', ')}. Gevonden kolommen: ${(rows[kopIdx] || []).filter(c => c != null && c !== '').join(', ')}.`);
  const uit = [];
  for (let i = kopIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => c == null || String(c).trim() === '')) continue;
    const o = {_rij: i + 1};
    for (const veld in velden) o[veld] = idx[veld] == null ? null : (r[idx[veld]] ?? null);
    uit.push(o);
  }
  return uit;
}

function parseBron(wb, bestand) {
  const meldingen = [];
  const wsTB = vindBlad(wb, 'Te beoordelen');
  if (!wsTB) throw new Fout(`Het tabblad "Te beoordelen" is niet gevonden in "${bestand}". Gevonden tabbladen: ${wb.SheetNames.join(', ')}.`);
  const tb = leesTabel(wsTB, V_TB, VERPLICHT_TB, 'Te beoordelen', meldingen);
  const regels = [], gezien = new Set();
  for (const r of tb) {
    const prk = prkNorm(prkStr(r.prk)), prkAlt = prkNorm(prkStr(r.prkAlt));
    if (!prk || !prkAlt) { meldingen.push(`Tabblad "Te beoordelen", rij ${r._rij}: PRK of PRK alternatief ontbreekt; regel overgeslagen.`); continue; }
    const key = prk + '|' + prkAlt;
    if (gezien.has(key)) { meldingen.push(`Tabblad "Te beoordelen", rij ${r._rij}: de combinatie ${prk} → ${prkAlt} staat er dubbel in; alleen de eerste regel is gebruikt.`); continue; }
    gezien.add(key);
    const categorie = tekst(r.categorie).trim();
    if (!CATEGORIEEN.includes(categorie)) meldingen.push(`Tabblad "Te beoordelen", rij ${r._rij}: onbekende categorie "${categorie}" (verwacht: ${CATEGORIEEN.join(', ')}).`);
    const regel = {
      key, prk, prkAlt, prio: num(r.prio), volgorde: num(r.volgorde),
      stofT: tekst(r.stofT), voorbeeldT: tekst(r.voorbeeldT), indicatieT: tekst(r.indicatieT), consT: tekst(r.consT),
      voorraadklasse: tekst(r.voorraadklasse).trim(), niveau: tekst(r.niveau).trim(), categorie,
      stofA: tekst(r.stofA), voorbeeldA: tekst(r.voorbeeldA), consA: tekst(r.consA), atcA: tekst(r.atcA).trim(),
      signaal: tekst(r.signaal).trim(), onderbouwing: tekst(r.onderbouwing).trim(), bron: tekst(r.bron).trim()
    };
    for (const [veld, lbl] of [['stofT', 'Stofnaam tekort'], ['stofA', 'Stofnaam alternatief']]) {
      if (ONVEILIG_CSV.test(regel[veld])) meldingen.push(`Tabblad "Te beoordelen", rij ${r._rij}: "${lbl}" bevat een puntkomma, aanhalingsteken of regeleinde; deze regel kan niet in het OA-laadbestand.`);
    }
    regels.push(regel);
  }
  if (!regels.length) throw new Fout('Het tabblad "Te beoordelen" bevat geen regels.');

  // Tekorten, in volgorde van Prio
  const perPrk = new Map();
  regels.forEach((r, i) => { r._i = i; if (!perPrk.has(r.prk)) perPrk.set(r.prk, []); perPrk.get(r.prk).push(r); });
  const tekorten = [];
  for (const [prk, rr] of perPrk) {
    rr.sort((a, b) => (isNaN(a.volgorde) ? 1e9 : a.volgorde) - (isNaN(b.volgorde) ? 1e9 : b.volgorde) || a._i - b._i);
    const e = rr[0];
    if (new Set(rr.map(r => r.stofT)).size > 1) meldingen.push(`PRK ${prk}: de "Stofnaam tekort" verschilt tussen de regels; de eerste ("${e.stofT}") wordt getoond.`);
    tekorten.push({prk, prio: e.prio, stofnaam: e.stofT, voorbeeld: e.voorbeeldT, indicatie: e.indicatieT, cons: e.consT, voorraadklasse: e.voorraadklasse, keys: rr.map(r => r.key)});
  }
  regels.forEach(r => delete r._i);
  const prioSort = (a, b) => (isNaN(a.prio) ? 1e9 : a.prio) - (isNaN(b.prio) ? 1e9 : b.prio) || prkSort(a.prk, b.prk);
  tekorten.sort(prioSort);

  // Overzicht tekorten
  const overzicht = {};
  const wsOV = vindBlad(wb, 'Overzicht tekorten');
  if (!wsOV) meldingen.push('Het tabblad "Overzicht tekorten" ontbreekt; afzet en bewust uitgesloten alternatieven worden niet getoond.');
  else {
    for (const r of leesTabel(wsOV, V_OV, ['prk'], 'Overzicht tekorten', meldingen)) {
      const prk = prkNorm(prkStr(r.prk)); if (!prk) continue;
      overzicht[prk] = {
        stofnaam: tekst(r.stofnaam), atc: tekst(r.atc).trim(), voorraadklasse: tekst(r.voorraadklasse).trim(),
        voorraadMsx: r.voorraadMsx, dagenTot: r.dagenTot, afzet: r.afzet, backorder: r.backorder,
        alGepubliceerd: tekst(r.alGepubliceerd).trim(), indicatie: tekst(r.indicatie).trim(), uitgesloten: tekst(r.uitgesloten).trim()
      };
    }
    const zonder = tekorten.filter(t => !overzicht[t.prk]).map(t => t.prk);
    if (zonder.length) meldingen.push(`${zonder.length} tekort(en) staan niet op "Overzicht tekorten" (PRK ${zonder.slice(0, 8).join(', ')}${zonder.length > 8 ? ', …' : ''}).`);
  }

  // Geen alternatief
  const geenAlt = [];
  const wsGA = vindBlad(wb, 'Geen alternatief');
  if (!wsGA) meldingen.push('Het tabblad "Geen alternatief" ontbreekt.');
  else {
    for (const r of leesTabel(wsGA, V_GA, ['prk', 'stofnaam'], 'Geen alternatief', meldingen)) {
      const prk = prkNorm(prkStr(r.prk)); if (!prk) continue;
      if (perPrk.has(prk)) { meldingen.push(`PRK ${prk} staat zowel op "Geen alternatief" als op "Te beoordelen"; het wordt alleen bij "Te beoordelen" getoond.`); continue; }
      if (ONVEILIG_CSV.test(tekst(r.stofnaam))) meldingen.push(`Tabblad "Geen alternatief", rij ${r._rij}: de stofnaam bevat een puntkomma, aanhalingsteken of regeleinde.`);
      geenAlt.push({prk, prio: num(r.prio), stofnaam: tekst(r.stofnaam), voorraadklasse: tekst(r.voorraadklasse).trim(), afzet: r.afzet, reden: tekst(r.reden).trim()});
    }
    geenAlt.sort(prioSort);
  }

  // Weggelaten conservering (alleen ter informatie)
  const weggelaten = {};
  const wsWC = vindBlad(wb, 'Weggelaten conservering');
  if (wsWC) {
    try {
      for (const r of leesTabel(wsWC, V_WC, ['prk'], 'Weggelaten conservering', [])) {
        const prk = prkNorm(prkStr(r.prk)); if (!prk) continue;
        (weggelaten[prk] = weggelaten[prk] || []).push({prkAlt: prkNorm(prkStr(r.prkAlt)), stofA: tekst(r.stofA), artikelen: tekst(r.artikelen)});
      }
    } catch (e) { /* alleen informatief */ }
  }

  const fpTekst = regels.map(r => [r.key, r.stofT, r.stofA, r.categorie, r.volgorde].join('\u0001')).sort().join('\n') + '\n#' + geenAlt.map(g => g.prk).sort().join(',');
  return {
    app: APP, soort: 'bron', bestand, vingerafdruk: vingerafdruk(fpTekst), geladenOp: new Date().toISOString(),
    regels, tekorten, overzicht, geenAlt, weggelaten, meldingen
  };
}

function indexeerBron(bron) {
  bron.regelMap = new Map(bron.regels.map(r => [r.key, r]));
  bron.tekortMap = new Map();
  for (const t of bron.tekorten) bron.tekortMap.set(t.prk, {prk: t.prk, stofnaam: t.stofnaam, prio: t.prio, soort: 'alt', aantal: t.keys.length, keys: t.keys});
  for (const g of bron.geenAlt) bron.tekortMap.set(g.prk, {prk: g.prk, stofnaam: g.stofnaam, prio: g.prio, soort: 'geen', aantal: 0, keys: []});
  return bron;
}

function bronNaarData(bron) { const {regelMap, tekortMap, ...rest} = bron; return rest; }

function parseBronnen(s) {
  const uit = [];
  if (!s) return uit;
  for (let deel of s.split(/;\s*/)) {
    deel = deel.trim(); if (!deel) continue;
    let m = deel.match(/^(.*?)\s*\(\s*(https?:\/\/[^\s)]+)\s*\)\s*(.*)$/);
    if (m) { uit.push({label: (m[1] || m[2]).trim(), url: m[2]}); const rest = m[3].replace(/^[\s:;,.-]+/, ''); if (rest) uit.push({tekst: rest}); continue; }
    m = deel.match(/^(.*?):\s*(https?:\/\/\S+)\s*$/);
    if (m) { uit.push({label: m[1].trim() || m[2], url: m[2]}); continue; }
    m = deel.match(/https?:\/\/\S+/);
    if (m) { const voor = deel.slice(0, m.index).trim(), na = deel.slice(m.index + m[0].length).trim(); uit.push({label: voor || m[0], url: m[0]}); if (na) uit.push({tekst: na}); continue; }
    uit.push({tekst: deel});
  }
  return uit;
}

function isJa(v) { return /^(ja|j|y|yes|1|true|waar|x)$/i.test(String(v ?? '').trim()); }

function parseZindex(wb, bestand) {
  const meldingen = [];
  let rijen = null, laatsteFout = null;
  for (const sn of wb.SheetNames) {
    try { rijen = leesTabel(wb.Sheets[sn], V_ZI, ['prk', 'generiek', 'omschrijving'], sn, meldingen); break; }
    catch (e) { laatsteFout = e; meldingen.length = 0; }
  }
  if (!rijen) throw laatsteFout || new Fout('Geen bruikbaar tabblad gevonden in de Z-index.');
  const routeAlle = new Map(), per = new Map(), bekend = new Set();
  let verborgen = 0, artikelen = 0;
  for (const r of rijen) {
    const prk = prkNorm(prkStr(r.prk)); if (!prk) continue;
    artikelen++; bekend.add(prk);
    const route = tekst(r.route).trim();
    if (route) { const m = routeAlle.get(prk) || new Map(); m.set(route, (m.get(route) || 0) + 1); routeAlle.set(prk, m); }
    const status = normKop(r.status);
    if (status.includes('gaat uit de handel') || status.includes('vervallen')) { verborgen++; continue; }
    if (!per.has(prk)) per.set(prk, {prk, gen: new Map(), art: []});
    const g = per.get(prk), gen = tekst(r.generiek);
    g.gen.set(gen, (g.gen.get(gen) || 0) + 1);
    g.art.push({oms: tekst(r.omschrijving), zi: prkStr(r.zi), atc: tekst(r.atc).trim(), route, ass: isJa(r.assortiment)});
  }
  const meest = m => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const prks = [];
  for (const g of per.values()) {
    const vb = g.art.find(a => a.ass) || g.art[0];
    const generiek = meest(g.gen);
    prks.push({
      prk: g.prk, generiek, voorbeeld: vb.oms, zi: vb.zi, atc: vb.atc || (g.art.find(a => a.atc) || {}).atc || '',
      route: vb.route || (g.art.find(a => a.route) || {}).route || '', inAssortiment: g.art.some(a => a.ass), aantalArtikelen: g.art.length,
      zoek: (generiek + ' ' + g.art.map(a => a.oms + ' ' + a.zi).join(' ') + ' ' + g.prk).toLowerCase()
    });
  }
  prks.sort((a, b) => a.generiek.localeCompare(b.generiek));
  const routeVan = new Map([...routeAlle].map(([p, m]) => [p, meest(m)]));
  return {bestand, geladenOp: new Date().toISOString(), artikelen, verborgen, prks, byPrk: new Map(prks.map(p => [p.prk, p])), routeVan, bekend, meldingen};
}

function zindexNaarData(z) { return {bestand: z.bestand, geladenOp: z.geladenOp, artikelen: z.artikelen, verborgen: z.verborgen, prks: z.prks, routeVan: [...z.routeVan], bekend: [...z.bekend], meldingen: z.meldingen || []}; }

function routeSet(s) { return new Set(String(s ?? '').split(',').map(normKop).filter(Boolean)); }

function vergelijkRoute(tekortRoute, altRoute) {
  const a = routeSet(tekortRoute), b = routeSet(altRoute);
  if (!a.size || !b.size) return null;            // onbekend
  if ([...a].some(x => b.has(x))) return 'gelijk';
  const or = new Set(['oraal', 'rectaal']);
  if ([...a].some(x => or.has(x)) && [...b].some(x => or.has(x))) return 'oraal-rectaal';
  return 'anders';
}

function geldigOordeel(oo) { return !!(oo && oo.o); }

function beoordelingNaarJson(werk, bron) {
  const nu = new Date();
  const regels = bron.regels.map(r => {
    const oo = werk.oordelen[r.key];
    const ok = geldigOordeel(oo);
    return {
      prk: prkUit(r.prk), prkAlternatief: prkUit(r.prkAlt), stofnaamTekort: r.stofT, stofnaamAlternatief: r.stofA,
      volgorde: r.volgorde, categorie: r.categorie,
      oordeel: ok ? OORDEEL_LABEL[oo.o] : null, toelichting: oo ? (oo.t || '') : '', tijdstip: oo && oo.tijd || null
    };
  });
  return {
    app: APP, soort: 'beoordeling', formaatversie: FORMAAT,
    beoordelaar: werk.beoordelaar, datum: nu.toISOString(),
    bronbestand: bron.bestand, bronVingerafdruk: bron.vingerafdruk,
    aantalRegels: bron.regels.length, aantalBeoordeeld: regels.filter(r => r.oordeel).length,
    regels,
    voorstellen: werk.voorstellen.map(v => ({
      tekortPrk: prkUit(v.tekortPrk), tekortStofnaam: v.tekortNaam, prk: prkUit(v.prk), generiek: v.generiek,
      voorbeeldartikel: v.voorbeeld, zi: v.zi, atc: v.atc, toedieningsweg: v.route, categorie: v.categorie,
      positie: v.positie, toelichting: v.toelichting, tijdstip: v.tijd, id: v.id
    }))
  };
}

const LABEL_NAAR_CODE = {'akkoord': 'akkoord', 'niet akkoord': 'niet', 'bespreken': 'bespreken', 'niet': 'niet'};

function parseBeoordeling(obj, bestandsnaam) {
  if (!obj || typeof obj !== 'object' || obj.app !== APP || (obj.soort && obj.soort !== 'beoordeling'))
    throw new Fout(`"${bestandsnaam}" is geen beoordelingsbestand van deze app.`);
  if (!obj.beoordelaar || typeof obj.beoordelaar !== 'string') throw new Fout(`"${bestandsnaam}": de naam van de beoordelaar ontbreekt.`);
  const oordelen = {};
  for (const r of obj.regels || []) {
    const key = prkNorm(r.prk) + '|' + prkNorm(r.prkAlternatief);
    const code = r.oordeel ? LABEL_NAAR_CODE[normKop(r.oordeel)] : null;
    if (r.oordeel && !code) throw new Fout(`"${bestandsnaam}": onbekend oordeel "${r.oordeel}" bij ${key}.`);
    const t = r.toelichting || '';
    if (code || t) oordelen[key] = {o: code, t, tijd: r.tijdstip || null};
  }
  const voorstellen = [];
  for (const v of obj.voorstellen || []) {
    if (!v || v.prk == null || v.tekortPrk == null) continue;
    voorstellen.push({
      id: v.id || ('v' + Math.random().toString(36).slice(2, 10)), tekortPrk: prkNorm(v.tekortPrk), tekortNaam: v.tekortStofnaam || '',
      prk: prkNorm(v.prk), generiek: v.generiek || '', voorbeeld: v.voorbeeldartikel || '', zi: v.zi || '', atc: v.atc || '',
      route: v.toedieningsweg || '', categorie: v.categorie || '', positie: num(v.positie), toelichting: v.toelichting || '', tijd: v.tijdstip || null
    });
  }
  return {beoordelaar: obj.beoordelaar, datum: obj.datum || null, bronbestand: obj.bronbestand || '', bronVingerafdruk: obj.bronVingerafdruk || '', bestand: bestandsnaam, oordelen, voorstellen};
}

function consensus(oo, minEens = MIN_EENS) {
  const n = o => oo.filter(x => x === o).length;
  if (n('akkoord') >= minEens) return 'akkoord';
  if (n('niet') >= minEens) return 'afgewezen';
  if (oo.filter(Boolean).length >= minEens) return 'bespreken';
  return 'onvolledig';
}

function redenConsensus(per, minEens = MIN_EENS) {
  const c = consensus(per.map(p => p.o), minEens);
  const nog = per.filter(p => !p.o).map(p => voornaam(p.naam));
  const nogTekst = nog.length ? `${nog.join(' en ')}: nog niet` : '';
  if (c === 'akkoord' || c === 'afgewezen') {
    const doel = c === 'akkoord' ? 'akkoord' : 'niet';
    const anders = per.filter(p => p.o && p.o !== doel).map(p => `${voornaam(p.naam)}: ${OORDEEL_LABEL[p.o].toLowerCase()}`);
    return [`${per.filter(p => p.o === doel).length} van ${per.length} eens`, ...anders, nogTekst].filter(Boolean).join(' · ');
  }
  if (c === 'bespreken') {
    const b = per.filter(p => p.o === 'bespreken').map(p => voornaam(p.naam));
    return [b.length ? `${b.join(' en ')}: bespreken` : 'geen twee gelijke oordelen', nogTekst].filter(Boolean).join(' · ');
  }
  const n = per.filter(p => p.o).length;
  return n ? `nog ${minEens - n} oordeel nodig` : 'nog door niemand beoordeeld';
}

function eindStatus(cons, besluit) {
  if (cons === 'bespreken' && besluit && (besluit.b === 'akkoord' || besluit.b === 'afgewezen')) return besluit.b;
  return cons;
}

function statusLabel(eind, cons) {
  if (eind === 'akkoord') return cons === 'bespreken' ? 'Akkoord (na overleg)' : 'Akkoord';
  if (eind === 'afgewezen') return cons === 'bespreken' ? 'Afgewezen (na overleg)' : 'Afgewezen';
  return {bespreken: 'Bespreken', onvolledig: 'Onvolledig'}[eind] || eind;
}

function bouwNieuweRegels(bron, U) {
  const perKey = new Map(U.regels.map(x => [x.r.key, x]));
  const voorstelPer = new Map();
  for (const v of U.voorstellen) if (v.eind === 'akkoord') { if (!voorstelPer.has(v.tekortPrk)) voorstelPer.set(v.tekortPrk, []); voorstelPer.get(v.tekortPrk).push(v); }
  const lijst = [...bron.tekorten.map(t => ({prk: t.prk, naam: t.stofnaam, keys: t.keys})), ...bron.geenAlt.map(g => ({prk: g.prk, naam: g.stofnaam, keys: []}))];
  // voorstellen bij een tekort dat niet in de bron staat (zou niet moeten voorkomen)
  for (const tp of voorstelPer.keys()) if (!lijst.some(t => t.prk === tp)) { const v = voorstelPer.get(tp)[0]; lijst.push({prk: tp, naam: v.tekortNaam, keys: []}); }
  lijst.sort((a, b) => prkSort(a.prk, b.prk));
  const uit = [], gezien = new Set();
  let dubbel = 0;
  for (const t of lijst) {
    const cascade = t.keys.map(k => ({soort: 'lijst', x: perKey.get(k)}));
    const vs = (voorstelPer.get(t.prk) || []).map((v, i) => ({v, i, pos: num(v.besluit.positie)}))
      .sort((a, b) => (isNaN(a.pos) ? 1e9 : a.pos) - (isNaN(b.pos) ? 1e9 : b.pos) || a.i - b.i);
    for (const {v, pos} of vs) {
      const idx = isNaN(pos) ? cascade.length : Math.max(0, Math.min(cascade.length, Math.round(pos) - 1));
      cascade.splice(idx, 0, {soort: 'voorstel', x: v});
    }
    for (const c of cascade) {
      let rij;
      if (c.soort === 'lijst') {
        if (!c.x || c.x.eind !== 'akkoord') continue;
        const r = c.x.r;
        rij = {adviesPrk: r.prk, adviesNaam: r.stofT, altPrk: r.prkAlt, altNaam: r.stofA, categorie: r.categorie, herkomst: c.x.cons === 'bespreken' ? 'lijst (na overleg)' : 'lijst (consensus)', niveau: r.niveau};
      } else {
        const v = c.x;
        rij = {adviesPrk: t.prk, adviesNaam: t.naam, altPrk: v.prk, altNaam: v.generiek, categorie: v.besluit.categorie, herkomst: v.soort === 'gezamenlijk' ? 'voorstel (gezamenlijk)' : 'voorstel (één beoordelaar)', niveau: 'Voorstel panel'};
      }
      const k = prkNorm(rij.adviesPrk) + '|' + prkNorm(rij.altPrk);
      if (gezien.has(k)) { dubbel++; continue; }
      gezien.add(k); uit.push(rij);
    }
  }
  return {regels: uit, dubbel};
}

function samenvoegen(bestaand, nieuw, afgewezenKeys, verwijderAfgewezen) {
  const sl = (a, b) => prkNorm(a) + '|' + prkNorm(b);
  const groepen = new Map(), gezien = new Set();
  const st = {bestaand: bestaand ? bestaand.length : 0, bestaandDubbel: 0, nieuw: nieuw.length, toegevoegd: 0, dubbel: 0, verwijderd: 0, afgewezenInBestaand: []};
  const voegToe = (adviesPrk, velden, herkomst) => { const g = prkNorm(adviesPrk); if (!groepen.has(g)) groepen.set(g, []); groepen.get(g).push({velden, herkomst}); };
  for (const b of bestaand || []) {
    const k = sl(b.velden[0], b.velden[2]);
    if (gezien.has(k)) { st.bestaandDubbel++; continue; }
    if (afgewezenKeys.has(k)) { st.afgewezenInBestaand.push(b); if (verwijderAfgewezen) { st.verwijderd++; continue; } }
    gezien.add(k); voegToe(b.velden[0], b.velden, 'bestaand');
  }
  for (const n of nieuw) {
    const k = sl(n.adviesPrk, n.altPrk);
    if (gezien.has(k)) { st.dubbel++; continue; }
    gezien.add(k); st.toegevoegd++;
    voegToe(n.adviesPrk, [n.adviesPrk, n.adviesNaam, n.altPrk, n.altNaam, n.categorie], 'nieuw');
  }
  const rijen = [];
  for (const g of [...groepen.keys()].sort(prkSort)) for (const r of groepen.get(g)) rijen.push(r);
  st.totaal = rijen.length;
  return {rijen, st};
}

function naarOaCsv(rijen) {
  const fouten = [];
  const lijnen = [OA_KOP.join(';')];
  rijen.forEach((r, i) => {
    const v = r.velden.map(x => String(x ?? ''));
    v.forEach((x, j) => { if (ONVEILIG_CSV.test(x)) fouten.push(`regel ${i + 2}, ${OA_KOP[j]}: "${x}"`); });
    if (!CATEGORIEEN.includes(v[4])) fouten.push(`regel ${i + 2}: categorie "${v[4]}" is geen geldige systeemcode`);
    if (!v[0] || !v[2]) fouten.push(`regel ${i + 2}: AdviesPrk of AlternatiefPrk is leeg`);
    lijnen.push(v.join(';'));
  });
  if (fouten.length) throw new Fout('Het laadbestand kan niet worden gemaakt:\n' + fouten.slice(0, 15).join('\n') + (fouten.length > 15 ? `\n… en ${fouten.length - 15} meer` : ''));
  return lijnen.join('\r\n') + '\r\n';
}

function splitCsvRegel(l) {
  const uit = []; let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && cur === '') q = true;
    else if (c === ';') { uit.push(cur); cur = ''; }
    else cur += c;
  }
  uit.push(cur); return uit;
}

function parseGepubliceerd(txt, bestand) {
  const meldingen = [];
  if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
  const lijnen = txt.split(/\r\n|\n|\r/);
  while (lijnen.length && !lijnen[lijnen.length - 1].trim()) lijnen.pop();
  if (!lijnen.length) throw new Fout(`"${bestand}" is leeg.`);
  const kop = splitCsvRegel(lijnen[0]).map(s => s.trim());
  if (kop.length !== 5 || kop.some((k, i) => k.toLowerCase() !== OA_KOP[i].toLowerCase())) {
    const hint = !lijnen[0].includes(';') && lijnen[0].includes(',') ? ' Het lijkt erop dat komma\'s als scheidingsteken zijn gebruikt in plaats van puntkomma\'s.' : '';
    throw new Fout(`"${bestand}" heeft niet de verwachte kopregel. Verwacht: ${OA_KOP.join(';')}. Gevonden: ${lijnen[0]}.${hint}`);
  }
  const rijen = [];
  for (let i = 1; i < lijnen.length; i++) {
    if (!lijnen[i].trim()) continue;
    const v = splitCsvRegel(lijnen[i]);
    if (v.length !== 5) { meldingen.push(`regel ${i + 1} heeft ${v.length} velden in plaats van 5 en is overgeslagen: ${lijnen[i]}`); continue; }
    rijen.push({velden: v});
  }
  return {bestand, rijen, meldingen, geladenOp: new Date().toISOString()};
}


/* ---------- Z-index als compacte data (bouwstap) en terug ---------- */
function zindexUitData(d) {
  return {...d, byPrk: new Map(d.prks.map(p => [p.prk, p])), routeVan: new Map(d.routeVan), bekend: new Set(d.bekend)};
}
function zoekZindex(zindex, q, max = 40) {
  if (!zindex) return {totaal: 0, items: []};
  const termen = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!termen.length || q.trim().length < 2) return {totaal: 0, items: []};
  const qq = q.trim().toLowerCase(), qn = prkNorm(q.trim());
  const res = [];
  for (const p of zindex.prks) {
    if (!termen.every(t => p.zoek.includes(t))) continue;
    let score = 3;
    if (p.prk === qn) score = 0; else if (p.zi === q.trim()) score = 1; else if (p.generiek.toLowerCase().startsWith(qq)) score = 2;
    res.push([score, p.inAssortiment ? 0 : 1, p]);
  }
  res.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].generiek.localeCompare(b[2].generiek));
  return {totaal: res.length, items: res.slice(0, max).map(x => x[2])};
}

/* ---------- Uitkomsten over het hele panel ----------
   panel: [{email, naam}] (de beoordelaars)
   werkPer: {email: {oordelen: {sleutel: {o, t}}, voorstellen: [...]}}
   besluiten / voorstelBesluiten: {sleutel: {b, notitie, categorie, positie}} */
function berekenUitkomsten(bron, panel, werkPer, besluiten, voorstelBesluiten, minEens = MIN_EENS) {
  werkPer = werkPer || {}; besluiten = besluiten || {}; voorstelBesluiten = voorstelBesluiten || {};
  const regels = bron.regels.map(r => {
    const per = panel.map(p => {
      const w = werkPer[p.email], oo = w && w.oordelen[r.key];
      return {email: p.email, naam: p.naam, o: geldigOordeel(oo) ? oo.o : null, t: (oo && oo.t) || ''};
    });
    const cons = consensus(per.map(p => p.o), minEens), besluit = besluiten[r.key] || null;
    const doel = cons === 'akkoord' ? 'akkoord' : cons === 'afgewezen' ? 'niet' : null;
    return {r, per, cons, reden: redenConsensus(per, minEens), tegenstem: !!doel && per.some(p => p.o && p.o !== doel), besluit, eind: eindStatus(cons, besluit)};
  });
  const groepen = new Map();
  for (const p of panel) {
    const w = werkPer[p.email]; if (!w) continue;
    for (const v of w.voorstellen || []) {
      const gk = v.tekortPrk + '|' + v.prk;
      if (!groepen.has(gk)) groepen.set(gk, {gk, tekortPrk: v.tekortPrk, prk: v.prk, per: {}});
      const g = groepen.get(gk);
      if (!g.per[p.email]) g.per[p.email] = v; // per apotheker het eerste voorstel voor deze combinatie
    }
  }
  const voorstellen = [...groepen.values()].map(g => {
    const vs = Object.values(g.per), v = vs[0];
    const soort = vs.length >= minEens ? 'gezamenlijk' : 'enkel';
    const besluit = voorstelBesluiten[g.gk] || null;
    const t = bron.tekortMap.get(g.tekortPrk);
    const inLijst = !!bron.regelMap.get(g.tekortPrk + '|' + g.prk);
    let eind = 'bespreken';
    if (besluit && besluit.b === 'akkoord' && CATEGORIEEN.includes(besluit.categorie)) eind = 'akkoord';
    else if (besluit && besluit.b === 'afgewezen') eind = 'afgewezen';
    return {...g, aantal: vs.length, soort, generiek: v.generiek, voorbeeld: v.voorbeeld, atc: v.atc, route: v.route, tekort: t || null,
      tekortNaam: t ? t.stofnaam : v.tekortNaam, besluit, eind, inLijst,
      label: soort === 'gezamenlijk' ? 'Bespreken (gezamenlijk voorstel)' : 'Bespreken (voorstel van één beoordelaar)'};
  });
  voorstellen.sort((x, y) => {
    const px = x.tekort ? x.tekort.prio : NaN, py = y.tekort ? y.tekort.prio : NaN;
    return (isNaN(px) ? 1e9 : px) - (isNaN(py) ? 1e9 : py) || prkSort(x.tekortPrk, y.tekortPrk) || prkSort(x.prk, y.prk);
  });
  return {regels, voorstellen};
}
function standaardVoorstelBesluit(v) {
  const vs = Object.values(v.per);
  const cats = vs.map(x => x.categorie).filter(c => CATEGORIEEN.includes(c));
  const pos = vs.map(x => x.positie).filter(p => !isNaN(p) && p !== null && p !== '');
  return {categorie: new Set(cats).size === 1 ? cats[0] : '', positie: pos.length ? Math.min(...pos) : ''};
}

const Kern = {
  APP, FORMAAT, MIN_EENS, Fout, voornaam, zetXLSX,
  CATEGORIEEN, CAT_UITLEG, OORDEEL_LABEL, OA_KOP, MIP_MELDING, ONVEILIG_CSV, LABEL_NAAR_CODE,
  normKop, tekst, prkStr, prkNorm, num, fmtNum, pad, stempel, leesbareDatum, prkSort, prkUit, vingerafdruk, klasseCls, nivCls,
  isVersleuteld, parseBron, indexeerBron, bronNaarData, parseBronnen, parseZindex, zindexNaarData, zindexUitData, zoekZindex, vergelijkRoute,
  geldigOordeel, beoordelingNaarJson, parseBeoordeling, consensus, redenConsensus, eindStatus, statusLabel,
  berekenUitkomsten, standaardVoorstelBesluit, bouwNieuweRegels, samenvoegen, naarOaCsv, parseGepubliceerd
};
if (typeof module === 'object' && module.exports) module.exports = Kern; else root.Kern = Kern;
})(typeof window !== 'undefined' ? window : globalThis);
