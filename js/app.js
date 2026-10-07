/* Beoordelingsapp alternatieven – schermen.
   Logica: js/kern.js · opslag: js/opslag.js · gegevens: data/bron.json en data/zindex.json */
'use strict';
const {APP, MIN_EENS, Fout, voornaam, CATEGORIEEN, CAT_UITLEG, OORDEEL_LABEL, OA_KOP, normKop, tekst, prkNorm, num, fmtNum, stempel,
  leesbareDatum, prkUit, klasseCls, nivCls, indexeerBron, parseBronnen, zindexUitData, zoekZindex, vergelijkRoute, geldigOordeel,
  beoordelingNaarJson, parseBeoordeling, statusLabel, berekenUitkomsten, standaardVoorstelBesluit, bouwNieuweRegels, samenvoegen,
  naarOaCsv, parseGepubliceerd} = Kern;

let BRON = null, ZINDEX = null, GEBRUIKER = null, WERK = null, C = null, VIEW = null;
let TAB = 'alt', CTAB = 'overzicht', ACTIEF = null;
// Beoordelen: 'stap' = één tekort per scherm (standaard), 'lijst' = alle tekorten onder elkaar met filters
let MODUS = 'stap', STAP = 0, STAP_EINDE = false;
const FILTER = {klasse: '', niveau: '', open: false, zoek: ''};
const CFILTER = {bespreken: 'open', alle: '', zoek: '', voorstel: 'open'};
const FORMS = {}; // open voorstel-formulieren per tekort

const $ = (s, el = document) => el.querySelector(s);

const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])); }

const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  keys(prefix) { try { return Object.keys(localStorage).filter(k => k.startsWith(prefix)); } catch (e) { return []; } }
};

function toast(msg, soort = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + soort; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), soort === 'fout' ? 9000 : 4000);
}

function download(naam, inhoud, type) {
  const blob = inhoud instanceof Blob ? inhoud : new Blob([inhoud], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = naam; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

function kiesBestanden(accept, meerdere = false) {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.multiple = meerdere;
    inp.addEventListener('change', () => resolve([...inp.files]));
    inp.addEventListener('cancel', () => resolve([]));
    inp.click();
  });
}

function modal(titel, html, knoppen) {
  return new Promise(resolve => {
    const m = $('#modal');
    m.innerHTML = `<div class="venster" role="dialog" aria-modal="true"><h2>${esc(titel)}</h2><div class="inhoud">${html}</div><div class="acties">${knoppen.map((k, i) => `<button class="knop ${k.primair ? 'primair' : ''} ${k.gevaar ? 'gevaar' : ''}" data-i="${i}">${esc(k.tekst)}</button>`).join('')}</div></div>`;
    m.classList.remove('verborgen');
    const sluit = w => { m.classList.add('verborgen'); m.innerHTML = ''; document.removeEventListener('keydown', esc_); resolve(w); };
    const esc_ = e => { if (e.key === 'Escape') sluit(null); };
    document.addEventListener('keydown', esc_);
    $$('.acties button', m).forEach(b => b.addEventListener('click', () => sluit(knoppen[+b.dataset.i].waarde)));
  });
}

const bevestig = (titel, html, ja = 'Doorgaan') => modal(titel, html, [{tekst: 'Annuleren', waarde: false}, {tekst: ja, waarde: true, primair: true}]);

const meld = (titel, html) => modal(titel, html, [{tekst: 'Sluiten', waarde: true, primair: true}]);


async function leesTekstbestand(file) {
  const buf = await file.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
  return t;
}

function maakWerkmap(bladen) {
  const wb = XLSX.utils.book_new();
  for (const [naam, aoa, breedtes] of bladen) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (breedtes) ws['!cols'] = breedtes.map(w => ({wch: w}));
    if (aoa.length > 1) ws['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: aoa.length - 1, c: aoa[0].length - 1}})};
    XLSX.utils.book_append_sheet(wb, ws, naam);
  }
  return new Blob([XLSX.write(wb, {bookType: 'xlsx', type: 'array'})], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

function renderTabs() {
  if (!$('#tabs')) return; // stapweergave heeft geen tabbladen
  const tabs = [['alt', 'Tekorten met alternatieven', BRON.tekorten.length], ['geen', 'Geen alternatief', BRON.geenAlt.length], ['mijn', 'Mijn voorstellen', WERK.voorstellen.length]];
  $('#tabs').innerHTML = tabs.map(([k, l, n]) => `<button data-tab="${k}" class="${TAB === k ? 'actief' : ''}">${l} <span class="n">(${n})</span></button>`).join('');
  $$('#tabs button').forEach(b => b.addEventListener('click', () => { TAB = b.dataset.tab; renderLijst(); window.scrollTo(0, 0); }));
}

function updateVoortgang() {
  const n = aantalBeoordeeld(), tot = BRON.regels.length;
  const el = $('#vgTekst'); if (!el) return;
  el.innerHTML = `<b>${n}</b> van ${tot} regels beoordeeld · ${WERK.voorstellen.length} eigen voorstel${WERK.voorstellen.length === 1 ? '' : 'len'}`;
  $('#vgVul').style.width = (tot ? 100 * n / tot : 0) + '%';
  updateStapBalk();
}

function zoekMatch(q, ...velden) { q = q.trim().toLowerCase(); if (!q) return true; return velden.some(v => String(v ?? '').toLowerCase().includes(q)); }

function regelZichtbaar(r) {
  if (FILTER.klasse && r.voorraadklasse !== FILTER.klasse) return false;
  if (FILTER.niveau && r.niveau !== FILTER.niveau) return false;
  if (FILTER.open && geldigOordeel(WERK.oordelen[r.key])) return false;
  return true;
}

function renderLijst() {
  renderTabs();
  const el = $('#lijst');
  if (TAB === 'alt') {
    let nT = 0, nR = 0, html = '';
    for (const t of BRON.tekorten) {
      const rr = t.keys.map(k => BRON.regelMap.get(k));
      const tekortMatch = zoekMatch(FILTER.zoek, t.stofnaam, t.prk);
      const zicht = rr.filter(r => regelZichtbaar(r) && (tekortMatch || zoekMatch(FILTER.zoek, r.stofA, r.prkAlt)));
      if (!zicht.length) continue;
      nT++; nR += zicht.length;
      html += htmlTekortKaart(t, zicht);
    }
    $('#telling').textContent = `${nT} tekorten, ${nR} regels getoond`;
    el.innerHTML = html || `<div class="leeg-staat">Geen regels die aan de filters voldoen.</div>`;
  } else if (TAB === 'geen') {
    const lijst = BRON.geenAlt.filter(g => (!FILTER.klasse || g.voorraadklasse === FILTER.klasse) && zoekMatch(FILTER.zoek, g.stofnaam, g.prk));
    $('#telling').textContent = `${lijst.length} tekorten zonder alternatief getoond`;
    el.innerHTML = lijst.length ? `<div class="melding">Voor deze tekorten is geen alternatief voorgesteld. Je kunt hier zelf een alternatief voorstellen (Z-index nodig).</div>` + lijst.map(htmlGeenAltKaart).join('') : `<div class="leeg-staat">Geen tekorten zonder alternatief die aan de filters voldoen.</div>`;
  } else {
    $('#telling').textContent = '';
    el.innerHTML = htmlMijnVoorstellen();
  }
  // open formulieren herstellen
  for (const tp of Object.keys(FORMS)) { const kaart = el.querySelector(`.kaart[data-tekort="${CSS.escape(tp)}"]`); if (kaart) renderVoorstelForm(tp); }
  if (ACTIEF) { const r = el.querySelector(`.regel[data-key="${CSS.escape(ACTIEF)}"]`); if (r) r.classList.add('actief'); }
}

function badgeVoorraad(k) { return k ? `<span class="badge klasse ${klasseCls(k)}" title="Voorraadklasse bij Mosadex">Voorraad Mosadex: ${esc(k)}</span>` : ''; }

function infoRegel(label, waarde, cls = '') { return waarde == null || waarde === '' ? '' : `<div class="${cls}"><b>${esc(label)}</b><span>${esc(waarde)}</span></div>`; }

function htmlTekortInfo(prk, basis) {
  const ov = BRON.overzicht[prk] || {};
  const route = ZINDEX ? (ZINDEX.routeVan.get(prk) || 'onbekend (PRK niet in Z-index)') : '';
  const weg = BRON.weggelaten[prk] || [];
  return `<div class="k-info">
    ${infoRegel('Voorbeeldartikel', basis.voorbeeld, 'breed')}
    ${infoRegel('Indicatie', basis.indicatie || ov.indicatie, 'breed')}
    ${infoRegel('Conservering', basis.cons, 'breed')}
    ${infoRegel('Afzet L3m (verp)', fmtNum(basis.afzet ?? ov.afzet))}
    ${infoRegel('Backorder (verp)', fmtNum(ov.backorder))}
    ${infoRegel('Dagen tot leverbaar', fmtNum(ov.dagenTot))}
    ${infoRegel('ATC', ov.atc)}
    ${infoRegel('Toedieningsweg', route)}
    ${infoRegel('Al gepubliceerd advies', ov.alGepubliceerd)}
    ${infoRegel('Reden geen alternatief', basis.reden, 'breed')}
    ${infoRegel('Bewust uitgesloten', ov.uitgesloten, 'breed let')}
    ${weg.map(w => infoRegel('Weggelaten (conservering)', `${w.stofA} (PRK ${w.prkAlt}): ${w.artikelen}`, 'breed')).join('')}
  </div>`;
}

function tekortVoortgangTekst(t) {
  const n = t.keys.filter(k => geldigOordeel(WERK.oordelen[k])).length;
  return [n, t.keys.length];
}

function htmlTekortKaart(t, zicht) {
  const [n, tot] = tekortVoortgangTekst(t);
  return `<section class="kaart" data-tekort="${esc(t.prk)}">
    <div class="k-kop"><span class="prio">Prio ${esc(fmtNum(t.prio))}</span><h2>${esc(t.stofnaam)}</h2><span class="prk">PRK ${esc(t.prk)}</span>
      ${badgeVoorraad(t.voorraadklasse)}
      <span class="k-vg ${n === tot ? 'klaar' : ''}" data-vg="${esc(t.prk)}">${n} van ${tot} beoordeeld</span></div>
    ${htmlTekortInfo(t.prk, t)}
    <div class="regels-kop"><div>Vlg</div><div>Alternatief</div><div>Categorie · niveau</div><div>Onderbouwing en bronnen</div><div>Jouw oordeel</div></div>
    <div class="regels">${zicht.map(htmlRegel).join('')}${zicht.length < tot ? `<div class="regel" style="display:block;color:var(--g2);font-size:12px">${tot - zicht.length} andere regel(s) bij dit tekort verborgen door de filters.</div>` : ''}</div>
    ${htmlVoorstellenBlok(t.prk)}
  </section>`;
}

function htmlGeenAltKaart(g) {
  return `<section class="kaart" data-tekort="${esc(g.prk)}">
    <div class="k-kop"><span class="prio">Prio ${esc(fmtNum(g.prio))}</span><h2>${esc(g.stofnaam)}</h2><span class="prk">PRK ${esc(g.prk)}</span>
      ${badgeVoorraad(g.voorraadklasse)}
      <span class="k-vg">geen alternatief in de lijst</span></div>
    ${htmlTekortInfo(g.prk, g)}
    ${htmlVoorstellenBlok(g.prk)}
  </section>`;
}

function htmlOordeelKnoppen(o) {
  return `<div class="oordeelknoppen">${['akkoord', 'niet', 'bespreken'].map(k => `<button type="button" data-o="${k}" class="${o === k ? 'aan' : ''}" title="${OORDEEL_LABEL[k]} (${{akkoord: 'A', niet: 'N', bespreken: 'B'}[k]})">${{akkoord: '✓ ', niet: '✗ ', bespreken: '? '}[k]}${OORDEEL_LABEL[k]}</button>`).join('')}</div>`;
}

function htmlZiControle(r) {
  if (!ZINDEX) return '';
  const p = ZINDEX.byPrk.get(r.prkAlt);
  if (!p) return `<div class="zi-let">⚠ ${ZINDEX.bekend.has(r.prkAlt) ? 'Z-index: alle artikelen van dit PRK zijn vervallen of gaan uit de handel' : 'Z-index: PRK niet gevonden (mogelijk niet meer in het assortiment)'}</div>`;
  const rt = ZINDEX.routeVan.get(r.prk), vr = vergelijkRoute(rt, p.route);
  let uit = '';
  if (p.route) uit += `<div class="zi-info">Toedieningsweg ${esc(p.route)}${vr === 'anders' ? ` <span class="zi-let">– wijkt af van tekort (${esc(rt)})</span>` : vr === 'oraal-rectaal' ? ` <span class="zi-info">(tekort ${esc(rt)}; oraal/rectaal toegestaan)</span>` : ''}</div>`;
  if (p.generiek !== r.stofA) uit += `<div class="zi-info">Generiek in Z-index: ${esc(p.generiek)}</div>`;
  return uit;
}

function htmlRegel(r) {
  const oo = WERK.oordelen[r.key] || {}, o = oo.o || '', t = oo.t || '';
  return `<div class="regel ${o ? 'o-' + o : ''} ${t ? 'toel-open' : ''}" data-key="${esc(r.key)}">
    <div class="r-vlg" title="Positie in de cascade">${esc(fmtNum(r.volgorde))}</div>
    <div class="r-alt"><div class="naam">${esc(r.stofA)}</div><div class="art">${esc(r.voorbeeldA)}</div><div class="meta">PRK ${esc(r.prkAlt)}${r.atcA ? ' · ATC ' + esc(r.atcA) : ''}</div>${r.consA ? `<div class="cons">Conservering: ${esc(r.consA)}</div>` : ''}${htmlZiControle(r)}</div>
    <div class="r-cat"><span class="cat" title="Code in het laadbestand: ${esc(r.categorie)}">${esc(CAT_UITLEG[r.categorie] || r.categorie)}</span><span class="niv ${nivCls(r.niveau)}">${esc(r.niveau)}</span>${r.signaal ? `<div class="signaal">⚠ ${esc(r.signaal)}</div>` : ''}</div>
    <div class="r-onder">${r.onderbouwing ? `<div>${esc(r.onderbouwing)}</div>` : ''}${htmlBronnen(r.bron)}</div>
    <div class="r-oordeel">${htmlOordeelKnoppen(o)}<textarea class="toel" rows="2" placeholder="Toelichting (optioneel)" aria-label="Toelichting (optioneel)">${esc(t)}</textarea><button type="button" class="toel-knop" data-actie="toelOpen">+ Toelichting toevoegen (optioneel)</button></div>
  </div>`;
}

function updateRegelDom(key) {
  const el = $(`.regel[data-key="${CSS.escape(key)}"]`);
  const oo = WERK.oordelen[key] || {}, o = oo.o || '';
  if (el) {
    el.classList.remove('o-akkoord', 'o-niet', 'o-bespreken');
    if (o) el.classList.add('o-' + o);
    $$('.oordeelknoppen button', el).forEach(b => b.classList.toggle('aan', b.dataset.o === o));
  }
  const r = BRON.regelMap.get(key);
  const t = BRON.tekorten.find(x => x.prk === r.prk);
  const vg = $(`.k-vg[data-vg="${CSS.escape(r.prk)}"]`);
  if (vg && t) { const [n, tot] = tekortVoortgangTekst(t); vg.textContent = `${n} van ${tot} beoordeeld`; vg.classList.toggle('klaar', n === tot); }
  updateVoortgang();
}

function zetActief(key, scroll) {
  $$('.regel.actief').forEach(e => e.classList.remove('actief'));
  ACTIEF = key;
  const el = key && $(`.regel[data-key="${CSS.escape(key)}"]`);
  if (el) { el.classList.add('actief'); if (scroll) el.scrollIntoView({block: 'center', behavior: 'smooth'}); }
}

function zichtbareRegelKeys() { return $$('#lijst .regel[data-key]').map(e => e.dataset.key); }

function verplaatsActief(stap) {
  const keys = zichtbareRegelKeys(); if (!keys.length) return;
  let i = keys.indexOf(ACTIEF);
  i = i < 0 ? (stap > 0 ? 0 : keys.length - 1) : Math.max(0, Math.min(keys.length - 1, i + stap));
  zetActief(keys[i], true);
}

function htmlVoorstellenBlok(tekortPrk) {
  const mijn = WERK.voorstellen.filter(v => v.tekortPrk === tekortPrk);
  return `<div class="voorstellen" data-vs="${esc(tekortPrk)}">
    ${mijn.length ? `<h3>Mijn voorstellen voor een ander alternatief</h3>${mijn.map(htmlVoorstelItem).join('')}` : ''}
    <div class="vs-form-plek"></div>
    <button class="knop klein" data-actie="nieuwVoorstel" data-tekort="${esc(tekortPrk)}" ${FORMS[tekortPrk] ? 'style="display:none"' : ''}>+ Ander alternatief voorstellen</button>
  </div>`;
}

function htmlVoorstelItem(v) {
  return `<div class="vs-item"><div class="r-vlg" title="Gewenste positie in de cascade">${esc(fmtNum(v.positie))}</div>
    <div><div class="naam">${esc(v.generiek)}</div><div class="meta">${esc(v.voorbeeld)}${v.zi ? ' (ZI ' + esc(v.zi) + ')' : ''} · PRK ${esc(v.prk)}${v.atc ? ' · ATC ' + esc(v.atc) : ''}${v.route ? ' · ' + esc(v.route) : ''}</div>
      <div><span class="cat" style="display:inline">${esc(v.categorie)}</span></div><div style="margin-top:3px;white-space:pre-wrap">${esc(v.toelichting)}</div></div>
    <div><button class="knop klein gevaar" data-actie="verwijderVoorstel" data-id="${esc(v.id)}">Verwijderen</button></div></div>`;
}

function htmlMijnVoorstellen() {
  if (!WERK.voorstellen.length) return `<div class="leeg-staat">Je hebt nog geen eigen voorstellen gedaan. Gebruik bij een tekort de knop "Ander alternatief voorstellen".</div>`;
  const per = new Map();
  for (const v of WERK.voorstellen) { if (!per.has(v.tekortPrk)) per.set(v.tekortPrk, []); per.get(v.tekortPrk).push(v); }
  return [...per].map(([tp, vs]) => {
    const t = BRON.tekortMap.get(tp);
    return `<section class="kaart"><div class="k-kop">${t ? `<span class="prio">Prio ${esc(fmtNum(t.prio))}</span>` : ''}<h2>${esc(t ? t.stofnaam : vs[0].tekortNaam)}</h2><span class="prk">PRK ${esc(tp)}</span>
      <button class="knop klein" style="margin-left:auto" data-actie="gaNaar" data-tekort="${esc(tp)}" data-soort="${t ? t.soort : ''}">Ga naar tekort</button></div>
      <div class="voorstellen">${vs.map(htmlVoorstelItem).join('')}</div></section>`;
  }).join('');
}

function renderVoorstelForm(tekortPrk) {
  const blok = $(`.voorstellen[data-vs="${CSS.escape(tekortPrk)}"]`);
  if (!blok) return;
  const plek = $('.vs-form-plek', blok), knop = $('[data-actie=nieuwVoorstel]', blok);
  const f = FORMS[tekortPrk];
  if (!f) { plek.innerHTML = ''; if (knop) knop.style.display = ''; return; }
  if (knop) knop.style.display = 'none';
  const t = BRON.tekortMap.get(tekortPrk);
  const max = (t ? t.aantal : 0) + 1;
  if (!ZINDEX) {
    plek.innerHTML = `<div class="vs-form"><p>De Z-index is niet beschikbaar; voorstellen is nu niet mogelijk.</p><button class="knop" data-actie="annuleerVoorstel" data-tekort="${esc(tekortPrk)}">Annuleren</button></div>`;
    return;
  }
  plek.innerHTML = `<div class="vs-form" data-form="${esc(tekortPrk)}">
    <div class="rij"><label>Zoek in Z-index</label><div><input type="search" class="vs-zoek" placeholder="Stofnaam, artikelnaam, PRK of ZI-nummer" value="${esc(f.q || '')}" autocomplete="off"><div class="zoekres"></div></div></div>
    <div class="rij"><label>Gekozen PRK</label><div class="vs-gekozen"></div></div>
    <div class="rij"><label>Categorie</label><div><select class="vs-cat"><option value="">– kies categorie –</option>${CATEGORIEEN.map(c => `<option value="${c}" ${f.categorie === c ? 'selected' : ''}>${c} – ${esc(CAT_UITLEG[c])}</option>`).join('')}</select></div></div>
    <div class="rij"><label>Positie in cascade</label><div><input type="number" class="vs-pos" min="1" max="${max}" value="${esc(f.positie ?? max)}"> <small style="color:var(--g2)">1 = als eerste getoond; ${max} = achteraan (dit tekort heeft nu ${max - 1} alternatie${max - 1 === 1 ? 'f' : 'ven'})</small></div></div>
    <div class="rij"><label>Toelichting</label><div><textarea class="vs-toel" rows="3" placeholder="Waarom dit alternatief en deze sterkte (optioneel)">${esc(f.toelichting || '')}</textarea></div></div>
    <div class="rij"><label></label><div><button class="knop primair" data-actie="bewaarVoorstel" data-tekort="${esc(tekortPrk)}">Voorstel opslaan</button> <button class="knop" data-actie="annuleerVoorstel" data-tekort="${esc(tekortPrk)}">Annuleren</button> <span class="vs-fout" style="color:var(--terra);font-size:12px;margin-left:8px"></span></div></div>
  </div>`;
  const form = $('.vs-form', plek);
  const zoek = $('.vs-zoek', form);
  zoek.addEventListener('input', () => { f.q = zoek.value; toonZoekresultaten(tekortPrk); });
  zoek.addEventListener('keydown', e => {
    const items = $$('.zr', form); if (!items.length) return;
    let i = items.findIndex(x => x.classList.contains('sel'));
    if (e.key === 'ArrowDown') { i = Math.min(items.length - 1, i + 1); } else if (e.key === 'ArrowUp') { i = Math.max(0, i - 1); } else if (e.key === 'Enter') { if (i < 0) i = 0; kiesZiPrk(tekortPrk, items[i].dataset.prk); e.preventDefault(); return; } else return;
    e.preventDefault(); items.forEach((x, j) => x.classList.toggle('sel', j === i)); items[i].scrollIntoView({block: 'nearest'});
  });
  $('.vs-cat', form).addEventListener('change', e => { f.categorie = e.target.value; });
  $('.vs-pos', form).addEventListener('input', e => { f.positie = e.target.value; });
  $('.vs-toel', form).addEventListener('input', e => { f.toelichting = e.target.value; });
  toonZoekresultaten(tekortPrk);
  toonGekozen(tekortPrk);
}

function toonZoekresultaten(tekortPrk) {
  const form = $(`.vs-form[data-form="${CSS.escape(tekortPrk)}"]`); if (!form) return;
  const f = FORMS[tekortPrk], box = $('.zoekres', form);
  const q = (f.q || '').trim();
  if (q.length < 2) { box.innerHTML = ''; return; }
  const res = zoekZindex(ZINDEX, q);
  if (!res.items.length) { box.innerHTML = `<div class="zr-leeg">Niets gevonden voor "${esc(q)}" (vervallen artikelen en artikelen die uit de handel gaan worden niet getoond).</div>`; return; }
  box.innerHTML = res.items.map(p => `<div class="zr" data-prk="${esc(p.prk)}"><div class="g">${esc(p.generiek)}${p.inAssortiment ? '<span class="ass">assortiment MSX</span>' : '<span class="ass nee">niet in assortiment</span>'}</div><div class="m">PRK ${esc(p.prk)} · ${esc(p.voorbeeld)}${p.zi ? ' (ZI ' + esc(p.zi) + ')' : ''}${p.atc ? ' · ' + esc(p.atc) : ''}${p.route ? ' · ' + esc(p.route) : ''}</div></div>`).join('') + (res.totaal > res.items.length ? `<div class="zr-leeg">${res.totaal - res.items.length} resultaten meer; typ verder om te verfijnen.</div>` : '');
  $$('.zr', box).forEach(el => el.addEventListener('click', () => kiesZiPrk(tekortPrk, el.dataset.prk)));
}

function kiesZiPrk(tekortPrk, prk) {
  FORMS[tekortPrk].prk = prk;
  toonGekozen(tekortPrk);
  const form = $(`.vs-form[data-form="${CSS.escape(tekortPrk)}"]`);
  if (form) { $('.zoekres', form).innerHTML = ''; const c = $('.vs-cat', form); if (!c.value) c.focus(); }
}

function voorstelWaarschuwingen(tekortPrk, p) {
  const w = [];
  const t = BRON.tekortMap.get(tekortPrk);
  if (p.prk === tekortPrk) w.push('Dit is hetzelfde PRK als het tekort zelf.');
  const inLijst = t && t.keys.map(k => BRON.regelMap.get(k)).find(r => r.prkAlt === p.prk);
  if (inLijst) w.push(`Dit PRK staat al in de lijst als alternatief voor dit tekort (positie ${fmtNum(inLijst.volgorde)}).`);
  const elders = BRON.regels.filter(r => r.prkAlt === p.prk && r.prk !== tekortPrk).length;
  if (elders && !inLijst) w.push(`Dit PRK staat al in de lijst als alternatief bij ${elders} ander${elders === 1 ? '' : 'e'} tekort${elders === 1 ? '' : 'en'}.`);
  const zelfTekort = BRON.tekortMap.get(p.prk);
  if (zelfTekort) w.push(`Dit PRK staat zelf op de tekortenlijst (prio ${fmtNum(zelfTekort.prio)}).`);
  if (WERK.voorstellen.some(v => v.tekortPrk === tekortPrk && v.prk === p.prk)) w.push('Je hebt dit PRK al eerder voorgesteld bij dit tekort.');
  const rt = ZINDEX.routeVan.get(tekortPrk), vr = vergelijkRoute(rt, p.route);
  if (vr === 'anders' || vr === 'oraal-rectaal') w.push(`Toedieningsweg wijkt af: tekort ${rt}, voorstel ${p.route}${vr === 'oraal-rectaal' ? ' (oraal en rectaal zijn volgens de selectieregels samen toegestaan)' : ''}.`);
  else if (!rt) w.push('Toedieningsweg van het tekort is onbekend (PRK niet gevonden in de Z-index); controleer zelf.');
  if (!p.inAssortiment) w.push('Dit PRK heeft geen artikel in het Mosadex-assortiment.');
  return w;
}

function toonGekozen(tekortPrk) {
  const form = $(`.vs-form[data-form="${CSS.escape(tekortPrk)}"]`); if (!form) return;
  const f = FORMS[tekortPrk], el = $('.vs-gekozen', form);
  const p = f.prk && ZINDEX.byPrk.get(f.prk);
  if (!p) { el.innerHTML = `<span style="color:var(--g2);font-size:13px;line-height:30px">Nog geen PRK gekozen – zoek hierboven en klik op een resultaat.</span>`; return; }
  el.innerHTML = `<div class="gekozen"><div class="g">${esc(p.generiek)}</div>
    <div>Voorbeeldartikel: ${esc(p.voorbeeld)}${p.zi ? ' (ZI ' + esc(p.zi) + ')' : ''}</div>
    <div>PRK ${esc(p.prk)} · ATC ${esc(p.atc || '–')} · Toedieningsweg ${esc(p.route || '–')}</div>
    ${voorstelWaarschuwingen(tekortPrk, p).map(x => `<div class="waarsch">${esc(x)}</div>`).join('')}</div>`;
}

function vervangVoorstellenBlok(tekortPrk) {
  const blok = $(`.voorstellen[data-vs="${CSS.escape(tekortPrk)}"]`);
  if (blok) { blok.outerHTML = htmlVoorstellenBlok(tekortPrk); renderVoorstelForm(tekortPrk); }
}

function exporteerBeoordelingXlsx() {
  if (typeof XLSX === 'undefined') return meld('Excel niet beschikbaar', '<p>SheetJS is niet geladen.</p>');
  const obj = beoordelingNaarJson(WERK, BRON);
  const regels = [['Prio', 'PRK', 'Stofnaam tekort', 'Volgorde', 'Niveau', 'Categorie', 'PRK alternatief', 'Stofnaam alternatief', 'Voorbeeldartikel alternatief', 'Oordeel', 'Toelichting']];
  for (const t of BRON.tekorten) for (const k of t.keys) {
    const r = BRON.regelMap.get(k), oo = WERK.oordelen[k];
    regels.push([isNaN(r.prio) ? '' : r.prio, prkUit(r.prk), r.stofT, isNaN(r.volgorde) ? '' : r.volgorde, r.niveau, r.categorie, prkUit(r.prkAlt), r.stofA, r.voorbeeldA, geldigOordeel(oo) ? OORDEEL_LABEL[oo.o] : '', oo ? oo.t || '' : '']);
  }
  const vs = [['PRK tekort', 'Stofnaam tekort', 'PRK voorstel', 'Generiek', 'Voorbeeldartikel', 'ATC', 'Toedieningsweg', 'Categorie', 'Positie', 'Toelichting']];
  for (const v of WERK.voorstellen) vs.push([prkUit(v.tekortPrk), v.tekortNaam, prkUit(v.prk), v.generiek, v.voorbeeld, v.atc, v.route, v.categorie, v.positie, v.toelichting]);
  const info = [['Beoordelaar', GEBRUIKER.naam], ['Datum', leesbareDatum(obj.datum)], ['Bronbestand', BRON.bestand], ['Vingerafdruk bron', BRON.vingerafdruk], ['Beoordeeld', `${obj.aantalBeoordeeld} van ${obj.aantalRegels}`], ['Eigen voorstellen', WERK.voorstellen.length], [], ['Let op', 'Dit Excel-bestand is alleen om te lezen. Lever het JSON-bestand aan de coördinator.']];
  download(`Beoordeling_${GEBRUIKER.naam.replace(/\s+/g, '_')}_${stempel()}.xlsx`, maakWerkmap([['Beoordeling', regels, [6, 9, 40, 8, 24, 32, 10, 40, 50, 13, 50]], ['Voorstellen', vs, [10, 40, 10, 40, 50, 10, 14, 32, 8, 50]], ['Info', info, [20, 70]]]));
}

function stBadge(eind, cons) { return `<span class="st ${esc(eind)}">${esc(statusLabel(eind, cons))}</span>`; }

function ooBadge(o) { return o ? `<span class="oo ${o}">${OORDEEL_LABEL[o]}</span>` : `<span class="oo leeg">nog niet</span>`; }

function htmlCOverzicht(u) {
  const c = k => u.regels.filter(k).length;
  const akC = c(x => x.cons === 'akkoord'), akO = c(x => x.cons === 'bespreken' && x.eind === 'akkoord');
  const afC = c(x => x.cons === 'afgewezen'), afO = c(x => x.cons === 'bespreken' && x.eind === 'afgewezen');
  const bOpen = c(x => x.eind === 'bespreken'), bTot = c(x => x.cons === 'bespreken');
  const onv = u.regels.filter(x => x.cons === 'onvolledig');
  const tegenA = c(x => x.cons === 'akkoord' && x.tegenstem), tegenN = c(x => x.cons === 'afgewezen' && x.tegenstem);
  const vG = u.voorstellen.filter(v => v.soort === 'gezamenlijk').length, vE = u.voorstellen.length - vG;
  const vA = u.voorstellen.filter(v => v.eind === 'akkoord').length, vAf = u.voorstellen.filter(v => v.eind === 'afgewezen').length;
  const redenen = {};
  u.regels.filter(x => x.cons === 'bespreken').forEach(x => { redenen[x.reden] = (redenen[x.reden] || 0) + 1; });
  const nieuw = bouwNieuweRegels(BRON, u).regels.length;
  return `<div class="tegels">
      <div class="tegel akkoord"><div class="getal">${akC + akO}</div><div class="lbl">Akkoord</div><small>${akC} consensus (${tegenA} met afwijkend oordeel) · ${akO} na overleg</small></div>
      <div class="tegel afgewezen"><div class="getal">${afC + afO}</div><div class="lbl">Afgewezen</div><small>${afC} consensus (${tegenN} met afwijkend oordeel) · ${afO} na overleg</small></div>
      <div class="tegel bespreken"><div class="getal">${bOpen}</div><div class="lbl">Bespreken (open)</div><small>${bTot} in totaal te bespreken</small></div>
      <div class="tegel onvolledig"><div class="getal">${onv.length}</div><div class="lbl">Onvolledig</div><small>minder dan twee oordelen</small></div>
      <div class="tegel bespreken"><div class="getal">${u.voorstellen.length}</div><div class="lbl">Voorstellen</div><small>${vG} gezamenlijk · ${vE} van één beoordelaar<br>${vA} aangenomen · ${vAf} afgewezen</small></div>
      <div class="tegel akkoord"><div class="getal">${nieuw}</div><div class="lbl">Regels voor laadbestand</div><small>alleen eindstatus Akkoord</small></div>
    </div>
    <div class="blok"><h2>Uitkomst per regel</h2>
      <table class="samenv">
        <tr><td>Akkoord (minimaal twee apothekers akkoord)</td><td>${akC}</td></tr>
        ${tegenA ? `<tr><td>&nbsp;&nbsp;waarvan met een afwijkend oordeel</td><td>${tegenA}</td></tr>` : ''}
        <tr><td>Afgewezen (minimaal twee apothekers niet akkoord)</td><td>${afC}</td></tr>
        ${tegenN ? `<tr><td>&nbsp;&nbsp;waarvan met een afwijkend oordeel</td><td>${tegenN}</td></tr>` : ''}
        ${Object.entries(redenen).map(([r, n]) => `<tr><td>Bespreken – ${esc(r)}</td><td>${n}</td></tr>`).join('')}
        <tr><td>Onvolledig</td><td>${onv.length}</td></tr>
        <tr class="totaal"><td>Totaal</td><td>${u.regels.length}</td></tr>
      </table>
      ${onv.length ? `<details><summary>Welke regels zijn onvolledig?</summary><table class="tabel" style="margin-top:8px"><tr><th>Tekort</th><th>Alternatief</th>${C.panel.map(p => `<th>${esc(voornaam(p.naam))}</th>`).join('')}</tr>${onv.slice(0, 400).map(x => `<tr><td class="naam">${esc(x.r.stofT)}</td><td class="naam">${esc(x.r.stofA)}</td>${x.per.map(p => `<td>${ooBadge(p.o)}</td>`).join('')}</tr>`).join('')}</table></details>` : ''}
    </div>`;
}

function htmlBesprekenRij(x) {
  const r = x.r, b = x.besluit || {};
  return `<div class="bs-rij" data-key="${esc(r.key)}">
    <div class="r-vlg">${esc(fmtNum(r.volgorde))}</div>
    <div class="r-alt"><div class="naam">${esc(r.stofA)}</div><div class="art">${esc(r.voorbeeldA)}</div><div class="meta">PRK ${esc(r.prkAlt)}</div><span class="cat">${esc(r.categorie)}</span><span class="niv ${nivCls(r.niveau)}">${esc(r.niveau)}</span>${r.signaal ? `<div class="signaal">⚠ ${esc(r.signaal)}</div>` : ''}${r.onderbouwing ? `<div style="margin-top:4px;font-size:12px;color:var(--g1)">${esc(r.onderbouwing)}</div>` : ''}${htmlBronnen(r.bron)}</div>
    ${x.per.map(p => `<div><b>${esc(voornaam(p.naam))}</b> ${ooBadge(p.o)}<div class="toel ${p.t ? '' : 'leeg'}">${esc(p.t || 'geen toelichting')}</div></div>`).join('')}
    <div class="besluit"><div style="margin-bottom:4px;font-size:12px;color:var(--g1)">${esc(x.reden)} · ${stBadge(x.eind, x.cons)}</div>
      <div class="knoppenrij"><button data-b="akkoord" class="${b.b === 'akkoord' ? 'aan' : ''}">✓ Akkoord</button><button data-b="afgewezen" class="${b.b === 'afgewezen' ? 'aan' : ''}">✗ Afgewezen</button></div>
      <input type="text" class="notitie" placeholder="Notitie bij het besluit (optioneel)" value="${esc(b.notitie || '')}"></div>
  </div>`;
}

function groepeerPerTekort(items, prkVan) {
  const per = new Map();
  for (const x of items) { const p = prkVan(x); if (!per.has(p)) per.set(p, []); per.get(p).push(x); }
  return per;
}

function tekortKopHtml(tp) {
  const t = BRON.tekortMap.get(tp);
  const ov = BRON.overzicht[tp] || {};
  return `<div class="k-kop">${t ? `<span class="prio">Prio ${esc(fmtNum(t.prio))}</span>` : ''}<h2>${esc(t ? t.stofnaam : '')}</h2><span class="prk">PRK ${esc(tp)}</span>${badgeVoorraad(ov.voorraadklasse)}${ov.uitgesloten ? `<span style="font-size:12px;color:var(--terra)">Bewust uitgesloten: ${esc(ov.uitgesloten)}</span>` : ''}</div>`;
}

function renderCBespreken(u) {
  const alle = u.regels.filter(x => x.cons === 'bespreken');
  const lijst = alle.filter(x => CFILTER.bespreken === 'alle' || (CFILTER.bespreken === 'open' ? x.eind === 'bespreken' : x.eind !== 'bespreken'));
  const per = groepeerPerTekort(lijst, x => x.r.prk);
  const volgorde = BRON.tekorten.map(t => t.prk).filter(p => per.has(p));
  $('#cinhoud').innerHTML = `<div class="filters" style="margin-bottom:10px">
      <label><input type="radio" name="bf" value="open" ${CFILTER.bespreken === 'open' ? 'checked' : ''}> Open (${alle.filter(x => x.eind === 'bespreken').length})</label>
      <label><input type="radio" name="bf" value="besloten" ${CFILTER.bespreken === 'besloten' ? 'checked' : ''}> Besloten (${alle.filter(x => x.eind !== 'bespreken').length})</label>
      <label><input type="radio" name="bf" value="alle" ${CFILTER.bespreken === 'alle' ? 'checked' : ''}> Alle (${alle.length})</label>
      <span class="telling">Leg na het paneloverleg per regel het eindbesluit vast; ook dan moeten minimaal twee apothekers het eens zijn. Klik nogmaals op een gekozen besluit om het te wissen.</span></div>
    ${volgorde.length ? volgorde.map(tp => `<section class="kaart">${tekortKopHtml(tp)}<div class="bs-kop"><div>Vlg</div><div>Alternatief</div>${C.panel.map(p => `<div>${esc(p.naam)}</div>`).join('')}<div>Eindbesluit</div></div>${per.get(tp).map(htmlBesprekenRij).join('')}</section>`).join('') : `<div class="leeg-staat">${alle.length ? 'Geen regels in deze selectie.' : 'Er zijn geen regels om te bespreken.'}</div>`}`;
  $$('input[name=bf]').forEach(i => i.addEventListener('change', () => { CFILTER.bespreken = i.value; renderCBespreken(U()); }));
}

function htmlVoorstelRij(v) {
  const b = v.besluit || {}, std = standaardVoorstelBesluit(v);
  const cat = b.categorie != null && b.categorie !== '' ? b.categorie : std.categorie;
  const pos = b.positie != null && b.positie !== '' ? b.positie : std.positie;
  const kol = (wie, x) => x ? `<div><b>${wie}</b><div style="font-size:12px"><span class="cat" style="display:inline">${esc(x.categorie)}</span> · positie ${esc(fmtNum(x.positie))}</div><div class="toel">${esc(x.toelichting)}</div></div>` : `<div><b>${wie}</b><div class="toel leeg">geen voorstel</div></div>`;
  const max = (v.tekort ? v.tekort.aantal : 0) + 1;
  return `<div class="bs-rij" data-gk="${esc(v.gk)}">
    <div class="r-vlg">+</div>
    <div class="r-alt"><div class="naam">${esc(v.generiek)}</div><div class="art">${esc(v.voorbeeld)}</div><div class="meta">PRK ${esc(v.prk)}${v.atc ? ' · ATC ' + esc(v.atc) : ''}${v.route ? ' · ' + esc(v.route) : ''}</div>
      <div style="margin-top:4px"><span class="st bespreken">${esc(v.soort === 'gezamenlijk' ? `Gezamenlijk voorstel (${v.aantal} apothekers)` : 'Voorstel van één beoordelaar')}</span></div>
      ${v.inLijst ? `<div class="waarsch">Dit PRK staat al in de lijst bij dit tekort; bij aannemen wordt een dubbele combinatie overgeslagen.</div>` : ''}</div>
    ${C.panel.map(p => kol(voornaam(p.naam), v.per[p.email])).join('')}
    <div class="besluit"><div style="margin-bottom:4px;font-size:12px"><span class="st ${esc(v.eind)}">${{akkoord: 'Aangenomen', afgewezen: 'Afgewezen', bespreken: esc(v.label)}[v.eind]}</span></div>
      <div class="knoppenrij"><button data-b="akkoord" class="${b.b === 'akkoord' ? 'aan' : ''}">✓ Aannemen</button><button data-b="afgewezen" class="${b.b === 'afgewezen' ? 'aan' : ''}">✗ Afwijzen</button></div>
      <div class="klein-veld"><select class="vb-cat" title="Categorie"><option value="">– categorie –</option>${CATEGORIEEN.map(c => `<option ${cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select><input type="number" class="vb-pos" min="1" max="${max}" value="${esc(pos)}" title="Positie in de cascade (1–${max})"></div>
      <input type="text" class="notitie" placeholder="Notitie (optioneel)" value="${esc(b.notitie || '')}">
      ${b.b === 'akkoord' && !CATEGORIEEN.includes(b.categorie) ? '<div class="waarsch">Kies een categorie; zonder categorie gaat het voorstel niet in het laadbestand.</div>' : ''}</div>
  </div>`;
}

function renderCVoorstellen(u) {
  const alle = u.voorstellen;
  const lijst = alle.filter(v => CFILTER.voorstel === 'alle' || (CFILTER.voorstel === 'open' ? v.eind === 'bespreken' : v.eind !== 'bespreken'));
  const per = groepeerPerTekort(lijst, v => v.tekortPrk);
  $('#cinhoud').innerHTML = `<div class="filters" style="margin-bottom:10px">
      <label><input type="radio" name="vf" value="open" ${CFILTER.voorstel === 'open' ? 'checked' : ''}> Open (${alle.filter(v => v.eind === 'bespreken').length})</label>
      <label><input type="radio" name="vf" value="besloten" ${CFILTER.voorstel === 'besloten' ? 'checked' : ''}> Besloten (${alle.filter(v => v.eind !== 'bespreken').length})</label>
      <label><input type="radio" name="vf" value="alle" ${CFILTER.voorstel === 'alle' ? 'checked' : ''}> Alle (${alle.length})</label>
      <span class="telling">Een voorstel gaat alleen in het laadbestand als je het aanneemt, met categorie en positie.</span></div>
    ${per.size ? [...per].map(([tp, vs]) => `<section class="kaart">${tekortKopHtml(tp)}<div class="bs-kop"><div></div><div>Voorgesteld alternatief</div>${C.panel.map(p => `<div>${esc(p.naam)}</div>`).join('')}<div>Besluit · categorie · positie</div></div>${vs.map(htmlVoorstelRij).join('')}</section>`).join('') : `<div class="leeg-staat">${alle.length ? 'Geen voorstellen in deze selectie.' : 'Er zijn geen eigen voorstellen gedaan.'}</div>`}`;
  $$('input[name=vf]').forEach(i => i.addEventListener('change', () => { CFILTER.voorstel = i.value; renderCVoorstellen(U()); }));
}

function renderCTabsAlleenKop() {
  const u = U();
  const nB = u.regels.filter(x => x.cons === 'bespreken').length, nBo = u.regels.filter(x => x.cons === 'bespreken' && x.eind === 'bespreken').length;
  const nV = u.voorstellen.length, nVo = u.voorstellen.filter(v => v.eind === 'bespreken').length;
  const b = $('#ctabs button[data-tab=bespreken] .n'); if (b) b.textContent = `(${nBo} open / ${nB})`;
  const v = $('#ctabs button[data-tab=voorstellen] .n'); if (v) v.textContent = `(${nVo} open / ${nV})`;
}

function renderCAlle(u) {
  const statussen = ['akkoord', 'afgewezen', 'bespreken', 'onvolledig'];
  const lijst = u.regels.filter(x => (!CFILTER.alle || (CFILTER.alle === 'tegenstem' ? x.tegenstem && x.eind !== 'bespreken' : x.eind === CFILTER.alle)) && zoekMatch(CFILTER.zoek, x.r.stofT, x.r.stofA, x.r.prk, x.r.prkAlt));
  const volg = new Map(BRON.tekorten.map((t, i) => [t.prk, i]));
  lijst.sort((a, b) => volg.get(a.r.prk) - volg.get(b.r.prk) || a.r.volgorde - b.r.volgorde);
  $('#cinhoud').innerHTML = `<div class="filters" style="margin-bottom:10px">
      <select id="caStatus"><option value="">Alle eindstatussen</option>${statussen.map(s => `<option value="${s}" ${CFILTER.alle === s ? 'selected' : ''}>${statusLabel(s, '')}</option>`).join('')}<option value="tegenstem" ${CFILTER.alle === 'tegenstem' ? 'selected' : ''}>Eindoordeel met afwijkend oordeel</option></select>
      <input type="search" id="caZoek" placeholder="Zoek op stofnaam of PRK" value="${esc(CFILTER.zoek)}"><span class="telling">${lijst.length} regels</span></div>
    <table class="tabel"><thead><tr><th>Prio</th><th>Tekort</th><th>Vlg</th><th>Alternatief</th><th>Categorie</th>${C.panel.map(p => `<th>${esc(voornaam(p.naam))}</th>`).join('')}<th>Eindstatus</th></tr></thead><tbody>
    ${lijst.map(x => `<tr><td>${esc(fmtNum(x.r.prio))}</td><td class="naam">${esc(x.r.stofT)}<br><small style="color:var(--g2)">PRK ${esc(x.r.prk)}</small></td><td>${esc(fmtNum(x.r.volgorde))}</td><td class="naam">${esc(x.r.stofA)}<br><small style="color:var(--g2)">PRK ${esc(x.r.prkAlt)} · ${esc(x.r.niveau)}</small></td><td class="mono">${esc(x.r.categorie)}</td>${x.per.map(p => `<td>${ooBadge(p.o)}${p.t ? `<div style="font-size:12px;white-space:pre-wrap">${esc(p.t)}</div>` : ''}</td>`).join('')}<td>${stBadge(x.eind, x.cons)}${x.tegenstem && x.eind !== 'bespreken' ? ' <span class="st tegen">afwijkend oordeel</span>' : ''}${x.reden ? `<div style="font-size:12px;color:var(--g2)">${esc(x.reden)}</div>` : ''}${x.besluit && x.besluit.notitie ? `<div style="font-size:12px">${esc(x.besluit.notitie)}</div>` : ''}</td></tr>`).join('')}
    </tbody></table>`;
  $('#caStatus').addEventListener('change', e => { CFILTER.alle = e.target.value; renderCAlle(U()); });
  $('#caZoek').addEventListener('input', e => { CFILTER.zoek = e.target.value; const pos = e.target.selectionStart; renderCAlle(U()); const z = $('#caZoek'); z.focus(); z.setSelectionRange(pos, pos); });
}

function afgewezenKeys(u) {
  const s = new Set();
  u.regels.filter(x => x.eind === 'afgewezen').forEach(x => s.add(prkNorm(x.r.prk) + '|' + prkNorm(x.r.prkAlt)));
  return s;
}

function maakLaadbestand(u) {
  const {regels: nieuw, dubbel: dubbelIntern} = bouwNieuweRegels(BRON, u);
  const pub = C.coordinatie.gepubliceerd;
  const {rijen, st} = samenvoegen(pub ? pub.rijen : null, nieuw, afgewezenKeys(u), !!C.coordinatie.verwijderAfgewezen);
  return {nieuw, dubbelIntern, rijen, st, pub};
}

function renderCExport(u) {
  const L = maakLaadbestand(u);
  const open = u.regels.filter(x => x.eind === 'bespreken').length, onv = u.regels.filter(x => x.eind === 'onvolledig').length;
  const vOpen = u.voorstellen.filter(v => v.eind === 'bespreken').length;
  const vAk = u.voorstellen.filter(v => v.besluit && v.besluit.b === 'akkoord' && !CATEGORIEEN.includes(v.besluit.categorie)).length;
  const afgPub = L.st.afgewezenInBestaand;
  $('#cinhoud').innerHTML = `
    <div class="blok"><h2>OA-laadbestand (CSV)</h2>
      <p>Alleen regels met eindstatus <b>Akkoord</b> (consensus of besluit na overleg) en aangenomen voorstellen. Formaat: <span class="mono">${OA_KOP.join(';')}</span>, puntkomma, UTF-8 zonder BOM, regeleinde CRLF. Sortering per tekort (PRK), daarbinnen de cascadevolgorde.</p>
      <table class="samenv">
        <tr><td>Nieuwe akkoord-regels uit de lijst</td><td>${L.nieuw.filter(n => n.herkomst.startsWith('lijst')).length}</td></tr>
        <tr><td>Aangenomen voorstellen</td><td>${L.nieuw.filter(n => n.herkomst.startsWith('voorstel')).length}</td></tr>
        ${L.dubbelIntern ? `<tr><td>Overgeslagen (voorstel gelijk aan een regel uit de lijst)</td><td>${L.dubbelIntern}</td></tr>` : ''}
        ${L.pub ? `<tr><td>Bestaande regels in ${esc(L.pub.bestand)}</td><td>${L.st.bestaand}</td></tr>` : ''}
      </table>
      ${open || onv || vOpen ? `<div class="melding waarsch">Nog niet afgerond: ${open} regel(s) Bespreken zonder besluit, ${onv} Onvolledig, ${vOpen} voorstel(len) zonder besluit. Deze komen <b>niet</b> in het laadbestand.</div>` : ''}
      ${vAk ? `<div class="melding fout">${vAk} aangenomen voorstel(len) hebben nog geen categorie en worden niet meegenomen.</div>` : ''}
      ${!L.pub ? `<div class="melding">Er is geen gepubliceerde lijst geladen; het bestand bevat dan alleen de nieuwe regels. Laad bovenaan de meest recente lijst om die aan te vullen.</div>` : ''}
      ${afgPub.length ? `<div class="melding waarsch"><b>${afgPub.length} regel(s) uit de gepubliceerde lijst zijn nu door het panel afgewezen:</b><ul>${afgPub.map(b => `<li class="mono">${esc(b.velden.join(';'))}</li>`).join('')}</ul>
        <label style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="chkVerwijder" ${C.coordinatie.verwijderAfgewezen ? 'checked' : ''}> Verwijder deze regels uit het laadbestand</label></div>` : ''}
      <button class="knop primair" id="btnCsv" ${L.rijen.length ? '' : 'disabled'}>Laadbestand maken…</button>
      ${L.rijen.length ? '' : '<span style="color:var(--g2);margin-left:8px">Er zijn nog geen akkoord-regels.</span>'}
    </div>
    <div class="blok"><h2>Logboek (Excel)</h2><p>Het volledige consensusoverzicht: per regel alle oordelen en toelichtingen, de consensus, het besluit na overleg en of de regel in het laadbestand staat. Plus de voorstellen.</p>
      <button class="knop" id="btnLog">Logboek exporteren</button></div>`;
  const chk = $('#chkVerwijder'); if (chk) chk.addEventListener('change', () => { C.coordinatie.verwijderAfgewezen = chk.checked; bewaarCoordinatie(); renderCExport(U()); });
  $('#btnCsv').addEventListener('click', () => toonCsvSamenvatting());
  $('#btnLog').addEventListener('click', exporteerLogboek);
}

async function toonCsvSamenvatting() {
  const u = U(), L = maakLaadbestand(u);
  let csv;
  try { csv = naarOaCsv(L.rijen); } catch (e) { return meld('Laadbestand niet gemaakt', `<pre class="voorbeeld">${esc(e.message)}</pre>`); }
  const naam = `alternatieve-prk-regels-${stempel()}.csv`;
  const regels = csv.split('\r\n');
  const html = `<p>Bestandsnaam: <b>${esc(naam)}</b></p>
    <table class="samenv">
      ${L.pub ? `<tr><td>Bestaande regels (${esc(L.pub.bestand)})</td><td>${L.st.bestaand}</td></tr>` : ''}
      ${L.pub && L.st.bestaandDubbel ? `<tr><td>&nbsp;&nbsp;waarvan dubbel in de bestaande lijst (eenmaal behouden)</td><td>${L.st.bestaandDubbel}</td></tr>` : ''}
      ${L.pub && L.st.verwijderd ? `<tr><td>&nbsp;&nbsp;waarvan verwijderd (nu afgewezen)</td><td>−${L.st.verwijderd}</td></tr>` : ''}
      <tr><td>Nieuwe akkoord-regels</td><td>${L.st.nieuw}</td></tr>
      <tr><td>&nbsp;&nbsp;waarvan overgeslagen dubbelingen (combinatie AdviesPrk + AlternatiefPrk staat er al)</td><td>${L.st.dubbel}</td></tr>
      <tr><td>&nbsp;&nbsp;waarvan toegevoegd</td><td>${L.st.toegevoegd}</td></tr>
      <tr class="totaal"><td>Regels in het bestand (zonder kopregel)</td><td>${L.st.totaal}</td></tr>
    </table>
    <p>Voorbeeld van de eerste regels:</p><pre class="voorbeeld">${esc(regels.slice(0, 12).join('\n'))}${L.rijen.length > 11 ? '\n…' : ''}</pre>`;
  if (!await modal('Samenvatting laadbestand', html, [{tekst: 'Annuleren', waarde: false}, {tekst: 'Opslaan', waarde: true, primair: true}])) return;
  download(naam, new Blob([new TextEncoder().encode(csv)], {type: 'text/csv'}));
  toast(`${naam} opgeslagen (${L.st.totaal} regels).`, 'ok');
}

function exporteerLogboek() {
  if (typeof XLSX === 'undefined') return meld('Excel niet beschikbaar', '<p>SheetJS is niet geladen.</p>');
  const u = U(), L = maakLaadbestand(u);
  const inLaad = new Set(L.rijen.map(r => prkNorm(r.velden[0]) + '|' + prkNorm(r.velden[2])));
  const reg = [['Prio', 'PRK', 'Stofnaam tekort', 'Voorraadklasse', 'Volgorde', 'Niveau', 'Categorie', 'PRK alternatief', 'Stofnaam alternatief', 'Voorbeeldartikel alternatief', 'Signaal', ...C.panel.flatMap(p => ['Oordeel ' + p.naam, 'Toelichting ' + p.naam]), 'Consensus', 'Reden', 'Afwijkend oordeel', 'Besluit na overleg', 'Notitie', 'Eindstatus', 'In laadbestand']];
  const volg = new Map(BRON.tekorten.map((t, i) => [t.prk, i]));
  const rr = u.regels.slice().sort((a, b) => volg.get(a.r.prk) - volg.get(b.r.prk) || a.r.volgorde - b.r.volgorde);
  for (const x of rr) {
    const r = x.r;
    reg.push([isNaN(r.prio) ? '' : r.prio, prkUit(r.prk), r.stofT, r.voorraadklasse, isNaN(r.volgorde) ? '' : r.volgorde, r.niveau, r.categorie, prkUit(r.prkAlt), r.stofA, r.voorbeeldA, r.signaal,
      ...x.per.flatMap(p => [p.o ? OORDEEL_LABEL[p.o] : '', p.t]), statusLabel(x.cons, ''), x.reden, x.tegenstem ? 'ja' : '',
      x.besluit && x.besluit.b ? (x.besluit.b === 'akkoord' ? 'Akkoord' : 'Afgewezen') : '', x.besluit ? x.besluit.notitie || '' : '', statusLabel(x.eind, x.cons), inLaad.has(prkNorm(r.prk) + '|' + prkNorm(r.prkAlt)) ? 'ja' : 'nee']);
  }
  const vs = [['PRK tekort', 'Stofnaam tekort', 'PRK voorstel', 'Generiek', 'Voorbeeldartikel', 'Soort', ...C.panel.flatMap(p => ['Categorie ' + voornaam(p.naam), 'Positie ' + voornaam(p.naam), 'Toelichting ' + voornaam(p.naam)]), 'Besluit', 'Categorie (besluit)', 'Positie (besluit)', 'Notitie', 'In laadbestand']];
  for (const v of u.voorstellen) {
    const b = v.besluit || {};
    vs.push([prkUit(v.tekortPrk), v.tekortNaam, prkUit(v.prk), v.generiek, v.voorbeeld, v.label, ...C.panel.flatMap(p => { const x = v.per[p.email]; return x ? [x.categorie, x.positie, x.toelichting] : ['', '', '']; }),
      b.b === 'akkoord' ? 'Aangenomen' : b.b === 'afgewezen' ? 'Afgewezen' : 'Open', b.categorie || '', b.positie || '', b.notitie || '', inLaad.has(prkNorm(v.tekortPrk) + '|' + prkNorm(v.prk)) ? 'ja' : 'nee']);
  }
  const laad = [OA_KOP.concat(['Herkomst']), ...L.rijen.map(r => r.velden.concat([r.herkomst]))];
  const info = [['Datum', leesbareDatum(new Date().toISOString())], ['Bronbestand', BRON.bestand], ['Vingerafdruk bron', BRON.vingerafdruk],
    ...C.panel.map(p => ['Beoordeling ' + p.naam, `${aantalBeoordeeldDoor(p.email)} van ${BRON.regels.length} regels beoordeeld`]),
    ['Gepubliceerde lijst', C.coordinatie.gepubliceerd ? C.coordinatie.gepubliceerd.bestand : 'niet geladen'], [],
    ['Consensusregels', 'Minimaal twee apothekers moeten het eens zijn met het eindoordeel. Minimaal twee keer Akkoord = Akkoord; minimaal twee keer Niet akkoord = Afgewezen; wel minimaal twee oordelen maar geen twee gelijke (of Bespreken) = Bespreken; minder dan twee oordelen = Onvolledig. Bij Bespreken legt de coördinator na het paneloverleg het eindbesluit vast.']];
  download(`Logboek_consensus_${stempel()}.xlsx`, maakWerkmap([['Consensus', reg, [6, 9, 36, 11, 7, 22, 30, 10, 36, 44, 24, ...C.panel.flatMap(() => [13, 40]), 12, 34, 10, 14, 30, 20, 12]], ['Voorstellen', vs, [10, 36, 10, 36, 44, 34, ...C.panel.flatMap(() => [28, 8, 40]), 12, 28, 8, 30, 12]], ['Laadbestand', laad, [10, 40, 12, 40, 34, 22]], ['Info', info, [26, 100]]]));
}


function htmlBronnen(s) {
  const b = parseBronnen(s);
  if (!b.length) return '';
  return `<div class="bronnen">${b.map(x => x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" title="${esc(x.url)}">${esc(x.label)} ↗</a>` : `<span class="tekst">${esc(x.tekst)}</span>`).join('')}</div>`;
}

function renderBeoordelaar() {
  if (MODUS === 'stap') return renderStap();
  renderBeoordelaarKop();
  const klassen = [...new Set(BRON.regels.map(r => r.voorraadklasse).filter(Boolean))];
  const niveaus = [...new Set(BRON.regels.map(r => r.niveau).filter(Boolean))];
  $('#main').innerHTML = `${bronMeldingenHtml()}
    <div class="balk">
      <div class="voortgang"><div class="vg-tekst" id="vgTekst"></div><div class="vg-bar"><div id="vgVul"></div></div></div>
      <div class="filters">
        <select id="fKlasse" title="Voorraadklasse"><option value="">Alle voorraadklassen</option>${klassen.map(k => `<option ${FILTER.klasse === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
        <select id="fNiveau" title="Niveau"><option value="">Alle niveaus</option>${niveaus.map(k => `<option ${FILTER.niveau === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
        <label><input type="checkbox" id="fOpen" ${FILTER.open ? 'checked' : ''}> Alleen nog niet beoordeeld</label>
        <input type="search" id="fZoek" placeholder="Zoek op stofnaam of PRK" value="${esc(FILTER.zoek)}">
        <span class="telling" id="telling"></span>
      </div>
      <div class="sneltoetsen"><kbd>J</kbd>/<kbd>K</kbd> volgende/vorige · <kbd>A</kbd> akkoord · <kbd>N</kbd> niet akkoord · <kbd>B</kbd> bespreken · <kbd>T</kbd> toelichting</div>
      <button type="button" class="knop" data-actie="naarStap">Stap voor stap beoordelen</button>
    </div>
    <div class="tabs" id="tabs"></div>
    <div id="lijst"></div>`;
  const zet = () => { FILTER.klasse = $('#fKlasse').value; FILTER.niveau = $('#fNiveau').value; FILTER.open = $('#fOpen').checked; FILTER.zoek = $('#fZoek').value; renderLijst(); };
  ['#fKlasse', '#fNiveau', '#fOpen'].forEach(s => $(s).addEventListener('change', zet));
  $('#fZoek').addEventListener('input', zet);
  renderLijst();
  updateVoortgang();
}

/* ---------- Stap voor stap: één tekort per scherm ---------- */
const tekortOpen = t => t.keys.some(k => !geldigOordeel(WERK.oordelen[k]));
function eersteOpenStap(vanaf = 0) {
  const i = BRON.tekorten.findIndex((t, j) => j >= vanaf && tekortOpen(t));
  return i;
}
function uitlegGezien() { return !!LS.get('lt:uitleg-gezien'); }
function renderStap() {
  renderBeoordelaarKop();
  const tot = BRON.tekorten.length;
  STAP = Math.max(0, Math.min(tot - 1, STAP));
  $('#main').innerHTML = `${bronMeldingenHtml()}
    <div class="stap-balk">
      <div class="voortgang"><div class="vg-tekst" id="vgTekst"></div><div class="vg-bar"><div id="vgVul"></div></div></div>
      <span class="stap-nr" id="stapNr"></span>
      <button type="button" class="knop" data-actie="naarLijst">Lijst van alle tekorten</button>
    </div>
    ${uitlegGezien() ? '' : `<div class="uitleg">
      <div><b>Zo werkt het</b><ol>
        <li>Je ziet steeds één tekort met de voorgestelde alternatieven.</li>
        <li>Kies per alternatief <b>Akkoord</b>, <b>Niet akkoord</b> of <b>Bespreken</b>. Een toelichting is niet verplicht.</li>
        <li>Klik op <b>Volgende tekort</b>. Alles wordt meteen opgeslagen; je kunt altijd stoppen en later verdergaan.</li>
      </ol></div>
      <button type="button" class="knop" data-actie="uitlegWeg">Begrepen</button></div>`}
    <div id="lijst" class="stap-lijst"></div>
    <div class="stap-onder" id="stapOnder"><div class="rij">
      <button type="button" class="knop groot" data-actie="stapVorige">Vorige</button>
      <span class="stap-status" id="stapStatus"></span>
      <button type="button" class="knop groot" data-actie="stapVolgende" id="btnVolgende"></button>
    </div></div>`;
  renderStapInhoud();
  updateVoortgang();
}
function renderStapInhoud() {
  const el = $('#lijst'); if (!el) return;
  ACTIEF = null;
  $('#stapOnder').classList.toggle('verborgen', STAP_EINDE);
  if (STAP_EINDE) { el.innerHTML = htmlStapEinde(); updateStapBalk(); return; }
  const t = BRON.tekorten[STAP];
  if (!t) { el.innerHTML = `<div class="leeg-staat">Er staan geen tekorten met alternatieven in de lijst.</div>`; return; }
  const ov = BRON.overzicht[t.prk] || {};
  const route = ZINDEX ? ZINDEX.routeVan.get(t.prk) : '';
  const chip = (txt, cls = '') => txt ? `<span class="chip ${cls}">${esc(txt)}</span>` : '';
  el.innerHTML = `<section class="stap" data-tekort="${esc(t.prk)}">
    <div class="stap-tekort">
      <div class="boven"><span class="prio">Prio ${esc(fmtNum(t.prio))}</span><span>Tekort · PRK ${esc(t.prk)}</span></div>
      <h2>${esc(t.stofnaam)}</h2>
      ${t.voorbeeld ? `<div class="vb">Voorbeeld: ${esc(t.voorbeeld)}</div>` : ''}
      <div class="chips">${t.voorraadklasse ? chip('Voorraad Mosadex: ' + t.voorraadklasse, klasseCls(t.voorraadklasse) === 'k2' ? '' : 'rood') : ''}${ov.dagenTot != null && ov.dagenTot !== '' ? chip('Weer leverbaar: ' + (isNaN(ov.dagenTot) ? ov.dagenTot : 'over ' + fmtNum(ov.dagenTot) + ' dagen')) : ''}${chip(route)}${ov.alGepubliceerd === 'ja' ? chip('Al gepubliceerd advies') : ''}</div>
      ${t.indicatie || ov.indicatie ? `<div class="ind"><b>Indicatie:</b> ${esc(t.indicatie || ov.indicatie)}</div>` : ''}
      ${ov.uitgesloten ? `<div class="ind let"><b>Bewust niet voorgesteld:</b> ${esc(ov.uitgesloten)}</div>` : ''}
      <details class="meer"><summary>Meer gegevens</summary>${htmlTekortInfo(t.prk, t)}</details>
    </div>
    <p class="stap-vraag">Is dit een goed alternatief? Kies per alternatief.</p>
    <div class="regels">${t.keys.map(k => htmlRegel(BRON.regelMap.get(k))).join('')}</div>
    ${htmlVoorstellenBlok(t.prk)}
  </section>`;
  if (FORMS[t.prk]) renderVoorstelForm(t.prk);
  updateStapBalk();
}
function htmlStapEinde() {
  const open = BRON.regels.filter(r => !geldigOordeel(WERK.oordelen[r.key])).length;
  const nT = BRON.tekorten.filter(tekortOpen).length;
  const geen = BRON.geenAlt.length ? `<p class="klein">Optioneel: bij <a href="#" data-actie="naarGeenAlt">${BRON.geenAlt.length} tekorten zonder alternatief</a> kun je zelf een alternatief voorstellen.</p>` : '';
  if (!open) return `<section class="stap-einde"><div class="vink" aria-hidden="true">✓</div><h2>Klaar, dank je wel!</h2>
    <p>Je hebt alle ${BRON.regels.length} alternatieven beoordeeld. Alles is opgeslagen; je hoeft niets op te sturen. Tot het panelbesluit kun je je oordelen nog aanpassen.</p>
    ${geen}<p><button type="button" class="knop groot" data-actie="stapBegin">Mijn oordelen nog eens bekijken</button></p></section>`;
  return `<section class="stap-einde"><h2>Je bent bij het einde van de lijst</h2>
    <p>Er ${open === 1 ? 'is' : 'zijn'} nog <b>${open}</b> alternatie${open === 1 ? 'f' : 'ven'} open bij ${nT} tekort${nT === 1 ? '' : 'en'} die je hebt overgeslagen.</p>
    <p><button type="button" class="knop groot primair" data-actie="stapEersteOpen">Naar het eerste open tekort</button></p>${geen}</section>`;
}
function updateStapBalk() {
  const st = $('#stapStatus'); if (!st || MODUS !== 'stap') return;
  const t = BRON.tekorten[STAP];
  $('#stapNr').textContent = STAP_EINDE ? '' : `Tekort ${STAP + 1} van ${BRON.tekorten.length}`;
  if (!t || STAP_EINDE) return;
  const [n, tot] = tekortVoortgangTekst(t);
  st.textContent = n === tot ? `Alle ${tot} alternatieven beoordeeld` : `${n} van ${tot} beoordeeld`;
  const knop = $('#btnVolgende');
  knop.textContent = n === tot ? 'Volgende tekort' : 'Overslaan, later doen';
  knop.classList.toggle('primair', n === tot);
  $('[data-actie=stapVorige]').disabled = STAP === 0;
}
function gaNaarStap(i, einde = false) {
  STAP_EINDE = einde;
  if (!einde) STAP = i;
  renderStapInhoud();
  window.scrollTo(0, 0);
}
function stapVolgende() {
  const i = eersteOpenStap(STAP + 1);
  if (i >= 0) gaNaarStap(i); else gaNaarStap(STAP, true);
}

function renderCTabs() {
  const u = U();
  const nB = u.regels.filter(x => x.cons === 'bespreken').length, nBo = u.regels.filter(x => x.cons === 'bespreken' && x.eind === 'bespreken').length;
  const nV = u.voorstellen.length, nVo = u.voorstellen.filter(v => v.eind === 'bespreken').length;
  const tabs = [['overzicht', 'Overzicht', ''], ['bespreken', 'Bespreken', `${nBo} open / ${nB}`], ['voorstellen', 'Voorstellen', `${nVo} open / ${nV}`], ['alle', 'Alle regels', BRON.regels.length], ['export', 'Export', '']];
  $('#ctabs').innerHTML = tabs.map(([k, l, n]) => `<button data-tab="${k}" class="${CTAB === k ? 'actief' : ''}">${l}${n !== '' ? ` <span class="n">(${n})</span>` : ''}</button>`).join('');
  $$('#ctabs button').forEach(b => b.addEventListener('click', () => { CTAB = b.dataset.tab; renderCTabs(); }));
  const el = $('#cinhoud');
  if (CTAB === 'overzicht') el.innerHTML = htmlCOverzicht(u);
  else if (CTAB === 'bespreken') renderCBespreken(u);
  else if (CTAB === 'voorstellen') renderCVoorstellen(u);
  else if (CTAB === 'alle') renderCAlle(u);
  else renderCExport(u);
}

function bronMeldingenHtml() {
  if (!BRON.meldingen || !BRON.meldingen.length) return '';
  return `<details class="melding waarsch"><summary><b>${BRON.meldingen.length} melding(en) bij het inlezen van ${esc(BRON.bestand)}</b></summary><ul>${BRON.meldingen.map(m => `<li>${esc(m)}</li>`).join('')}</ul></details>`;
}


/* =====================================================================
   Start, inloggen en kopbalk
   ===================================================================== */
async function haalJson(url) {
  const r = await fetch(url, {cache: 'no-cache'});
  if (!r.ok) throw new Error(`${url} (${r.status})`);
  return r.json();
}
function laden(tekst = 'Laden…') { $('#main').innerHTML = `<div class="leeg-staat">${esc(tekst)}</div>`; }
function toonFout(titel, e) {
  if (e && !(e instanceof Fout)) console.error(e);
  $('#main').innerHTML = `<div class="melding fout"><b>${esc(titel)}</b><br>${esc(e && e.message || e || '')}<br><br><button class="knop" onclick="location.reload()">Opnieuw proberen</button></div>`;
}
async function start() {
  laden('Gegevens laden…');
  try {
    const [b, z] = await Promise.all([haalJson('data/bron.json'), haalJson('data/zindex.json')]);
    BRON = indexeerBron(b); ZINDEX = zindexUitData(z);
  } catch (e) { return toonFout('De lijst of de Z-index kon niet worden geladen.', e); }
  $('#kopBron').textContent = BRON.bestand;
  Opslag.opStatus(toonOpslagStatus);
  try { GEBRUIKER = (await Opslag.init()).gebruiker; }
  catch (e) { return toonFout('Inloggen controleren is mislukt.', e); }
  if (!GEBRUIKER) return Opslag.modus === 'proef' ? renderProefKeuze() : renderInloggen();
  if (!GEBRUIKER.opPanel) return renderNietOpPanel();
  let v = LS.get('lt:view');
  if (v !== 'coordineren' || !GEBRUIKER.coordinator) v = GEBRUIKER.beoordelaar ? 'beoordelen' : 'coordineren';
  naarView(v);
}
function introHtml() {
  return `<h1>Beoordeling alternatieven bij levertekorten</h1>
    <p class="intro">Een alternatief komt alleen in de adviestabel van Optimaal Aanschrijven als minimaal ${MIN_EENS} apothekers het eens zijn met het eindoordeel. Iedere apotheker beoordeelt zelfstandig; de app voegt de oordelen automatisch samen.</p>`;
}
function renderInloggen() {
  renderKop('', false);
  $('#main').innerHTML = `<div class="start">${introHtml()}
    <div class="blok"><h2>Inloggen</h2>
      <p>Vul je e-mailadres in. Je krijgt een e-mail met een inloglink; klik daarop en je bent ingelogd. Een wachtwoord is niet nodig.</p>
      <form id="frmLogin" style="display:flex;gap:8px;flex-wrap:wrap"><input type="email" id="inEmail" required placeholder="naam@voorbeeld.nl" autocomplete="email" style="flex:1;min-width:240px;padding:7px 9px;border:1px solid var(--rand);border-radius:4px"><button class="knop primair" type="submit">Stuur inloglink</button></form>
      <div id="loginMelding"></div>
    </div></div>`;
  $('#frmLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const knop = $('#frmLogin button'), email = $('#inEmail').value.trim();
    knop.disabled = true;
    try {
      await Opslag.stuurInloglink(email, location.origin + location.pathname);
      $('#loginMelding').innerHTML = `<div class="melding" style="margin-top:12px">Er is een inloglink gestuurd naar <b>${esc(email)}</b>. Kijk in je mailbox (soms bij ongewenste e-mail) en klik op de link. Je mag dit venster sluiten.</div>`;
    } catch (err) { $('#loginMelding').innerHTML = `<div class="melding fout" style="margin-top:12px">${esc(err.message)}</div>`; knop.disabled = false; }
  });
}
function renderProefKeuze() {
  renderKop('', false);
  $('#main').innerHTML = `<div class="start">${introHtml()}
    <div class="melding waarsch"><b>Proefmodus.</b> Deze app is nog niet gekoppeld aan de gedeelde database (Supabase). Alles wat je doet blijft alleen in deze browser. Kies een proefapotheker om de app uit te proberen; je kunt wisselen om te zien hoe de oordelen worden samengevoegd.</div>
    <div class="blok"><h2>Wie ben je (proef)?</h2><div class="rollen">
      ${Opslag.proefPanel.map(p => `<button class="rol" data-email="${esc(p.email)}"><b>${esc(p.naam)}</b><span>${p.coordinator ? 'Beoordelaar en coördinator' : 'Beoordelaar'}</span></button>`).join('')}
    </div></div></div>`;
  $$('.rol').forEach(b => b.addEventListener('click', async () => { GEBRUIKER = (await Opslag.kiesProefpersoon(b.dataset.email)).gebruiker; naarView(GEBRUIKER.beoordelaar ? 'beoordelen' : 'coordineren'); }));
}
function renderNietOpPanel() {
  renderKop('', true);
  $('#main').innerHTML = `<div class="start">${introHtml()}<div class="melding fout">Je bent ingelogd als <b>${esc(GEBRUIKER.email)}</b>, maar dit e-mailadres staat (nog) niet op de panellijst. Vraag de coördinator om je toe te voegen, en log daarna opnieuw in.</div></div>`;
}
/* Kopbalk: naam, wisselen tussen beoordelen en coördineren, uitloggen. */
function renderKop(extra = '', metGebruiker = true) {
  const g = GEBRUIKER;
  const wissel = g && g.opPanel && g.beoordelaar && g.coordinator ? `<span class="wissel"><button class="${VIEW === 'beoordelen' ? 'aan' : ''}" data-view="beoordelen">Beoordelen</button><button class="${VIEW === 'coordineren' ? 'aan' : ''}" data-view="coordineren">Coördineren</button></span>` : '';
  $('#kopRechts').innerHTML = `${Opslag.modus === 'proef' ? '<span class="wie proef">Proefmodus</span>' : ''}
    ${metGebruiker && g ? `<span class="bewaard" id="opslagStatus"></span><span class="wie">${esc(g.naam || g.email)}</span>${wissel}` : ''}
    ${extra}
    ${metGebruiker && g ? `<button class="knop" id="btnUit">${Opslag.modus === 'proef' ? 'Andere proefpersoon' : 'Uitloggen'}</button>` : ''}`;
  $$('.wissel button').forEach(b => b.addEventListener('click', () => { if (b.dataset.view !== VIEW) naarView(b.dataset.view); }));
  const uit = $('#btnUit');
  if (uit) uit.addEventListener('click', async () => {
    if (heeftOpenWijzigingen() && !await bevestig('Nog niet alles is opgeslagen', '<p>Er zijn wijzigingen die nog niet in de database staan. Als je nu uitlogt, blijven ze in deze browser bewaard en worden ze opgeslagen zodra je weer inlogt.</p>', 'Toch uitloggen')) return;
    stopCoordinator();
    await Opslag.uitloggen(); GEBRUIKER = null; WERK = null; C = null; VIEW = null;
    start();
  });
  toonOpslagStatus(OPSLAG_STATUS.status, OPSLAG_STATUS.n);
}
function naarView(v) {
  VIEW = v; LS.set('lt:view', v); ACTIEF = null;
  if (v === 'beoordelen') { stopCoordinator(); startBeoordelaar(); } else startCoordinator();
}

/* ---------- Opslagstatus ---------- */
const OPSLAG_STATUS = {status: 'opgeslagen', n: 0};
const toelTimers = new Map();
function heeftOpenWijzigingen() { return toelTimers.size > 0 || OPSLAG_STATUS.status !== 'opgeslagen'; }
function toonOpslagStatus(status, n) {
  OPSLAG_STATUS.status = status; OPSLAG_STATUS.n = n;
  const el = $('#opslagStatus'); if (!el) return;
  if (VIEW !== 'beoordelen') { el.textContent = ''; return; }
  el.classList.toggle('let', status === 'wacht');
  el.textContent = status === 'wacht' ? `⚠ ${n} wijziging${n === 1 ? '' : 'en'} nog niet opgeslagen – wordt opnieuw geprobeerd` : status === 'bezig' || toelTimers.size ? 'Opslaan…' : Opslag.modus === 'proef' ? '✓ Bewaard in deze browser' : '✓ Opgeslagen';
}
window.addEventListener('beforeunload', e => { if (VIEW === 'beoordelen' && heeftOpenWijzigingen()) { e.preventDefault(); e.returnValue = ''; } });

/* =====================================================================
   Beoordelaar
   ===================================================================== */
async function startBeoordelaar() {
  renderKop();
  laden('Je beoordelingen ophalen…');
  try { WERK = {beoordelaar: GEBRUIKER.naam, ...(await Opslag.mijnWerk(BRON.vingerafdruk))}; }
  catch (e) { return toonFout('Je beoordelingen konden niet worden opgehaald.', e); }
  TAB = 'alt';
  MODUS = LS.get('lt:modus') === 'lijst' ? 'lijst' : 'stap';
  STAP_EINDE = false;
  STAP = eersteOpenStap();
  if (STAP < 0) { STAP = 0; STAP_EINDE = true; }
  renderBeoordelaar();
  if (!Object.keys(WERK.oordelen).length) biedOvernameAan();
}
/* Nieuwe versie van de lijst: eerder gegeven oordelen voor dezelfde regels overnemen. */
async function biedOvernameAan() {
  let andere;
  try { andere = await Opslag.mijnAndereVersies(BRON.vingerafdruk); } catch (e) { return; }
  const per = new Map();
  for (const r of andere) if (BRON.regelMap.has(r.sleutel) && (r.o || r.t)) { const x = per.get(r.sleutel); if (!x || String(r.tijd) > String(x.tijd)) per.set(r.sleutel, r); }
  if (!per.size) return;
  if (!await bevestig('Oordelen overnemen?', `<p>Er is een nieuwe versie van de lijst (<b>${esc(BRON.bestand)}</b>). Je hebt ${per.size} regel(s) die ook in deze versie staan al eerder beoordeeld.</p><p>Wil je die oordelen overnemen? Je kunt ze daarna gewoon aanpassen.</p>`, 'Overnemen')) return;
  for (const [k, r] of per) { WERK.oordelen[k] = {o: r.o, t: r.t, tijd: new Date().toISOString()}; Opslag.zetOordeel(BRON.vingerafdruk, k, WERK.oordelen[k]); }
  renderBeoordelaar();
  toast(`${per.size} oordelen overgenomen.`, 'ok');
}
function renderBeoordelaarKop() {
  renderKop(`<details class="meer-menu"><summary class="knop">Meer</summary><div class="menu">
    <p>Je oordelen worden automatisch opgeslagen. Deze knoppen zijn alleen nodig voor een eigen kopie.</p>
    <button class="knop" id="btnExpJson" title="Download een back-up van je beoordeling">Back-up downloaden</button>
    <button class="knop" id="btnExpXlsx" title="Je beoordeling als leesbaar Excel-bestand">Overzicht in Excel</button>
    <button class="knop" id="btnImp" title="Zet een eerder geëxporteerde beoordeling terug">Back-up terugzetten</button></div></details>`);
  $$('.meer-menu .menu button').forEach(b => b.addEventListener('click', () => b.closest('details').removeAttribute('open')));
  $('#btnExpJson').addEventListener('click', exporteerBeoordeling);
  $('#btnExpXlsx').addEventListener('click', exporteerBeoordelingXlsx);
  $('#btnImp').addEventListener('click', importeerBeoordeling);
}
function aantalBeoordeeld() { return BRON.regels.filter(r => geldigOordeel(WERK.oordelen[r.key])).length; }
function zetOordeel(key, o) {
  const oo = WERK.oordelen[key] || {o: null, t: ''};
  oo.o = oo.o === o ? null : o; // nogmaals klikken = wissen
  oo.tijd = new Date().toISOString();
  WERK.oordelen[key] = oo;
  updateRegelDom(key);
  Opslag.zetOordeel(BRON.vingerafdruk, key, oo);
  return oo.o;
}
function zetToelichting(key, t) {
  const oo = WERK.oordelen[key] || {o: null, t: ''};
  oo.t = t; oo.tijd = new Date().toISOString();
  WERK.oordelen[key] = oo;
  clearTimeout(toelTimers.get(key));
  toelTimers.set(key, setTimeout(() => { toelTimers.delete(key); Opslag.zetOordeel(BRON.vingerafdruk, key, WERK.oordelen[key]); toonOpslagStatus(OPSLAG_STATUS.status, OPSLAG_STATUS.n); }, 700));
  toonOpslagStatus(OPSLAG_STATUS.status, OPSLAG_STATUS.n);
}
async function bewaarVoorstel(tekortPrk) {
  const f = FORMS[tekortPrk], form = $(`.vs-form[data-form="${CSS.escape(tekortPrk)}"]`);
  const fout = m => { $('.vs-fout', form).textContent = m; };
  const p = f.prk && ZINDEX.byPrk.get(f.prk);
  const t = BRON.tekortMap.get(tekortPrk);
  const max = (t ? t.aantal : 0) + 1;
  const pos = parseInt($('.vs-pos', form).value, 10);
  const cat = $('.vs-cat', form).value, toel = $('.vs-toel', form).value;
  if (!p) return fout('Kies eerst een PRK uit de Z-index.');
  if (!CATEGORIEEN.includes(cat)) return fout('Kies een categorie.');
  if (!(pos >= 1 && pos <= max)) return fout(`Kies een positie van 1 tot en met ${max}.`);
  const knop = $('[data-actie=bewaarVoorstel]', form);
  knop.disabled = true; fout('Opslaan…');
  try {
    const v = await Opslag.voegVoorstelToe(BRON.vingerafdruk, {
      tekortPrk, tekortNaam: t ? t.stofnaam : '', prk: p.prk, generiek: p.generiek, voorbeeld: p.voorbeeld, zi: p.zi, atc: p.atc, route: p.route,
      inAssortiment: p.inAssortiment, categorie: cat, positie: pos, toelichting: toel
    });
    WERK.voorstellen.push(v);
  } catch (e) { knop.disabled = false; return fout(e.message); }
  delete FORMS[tekortPrk];
  vervangVoorstellenBlok(tekortPrk);
  renderTabs(); updateVoortgang();
  toast('Voorstel opgeslagen.', 'ok');
}

/* Menu "Meer" sluiten bij een klik ernaast */
document.addEventListener('click', e => { $$('.meer-menu[open]').forEach(d => { if (!d.contains(e.target)) d.removeAttribute('open'); }); });

/* Gebeurtenissen in de beoordelaarslijst (één luisteraar voor alles) */
document.addEventListener('click', async e => {
  if (VIEW !== 'beoordelen' || !$('#lijst')) return;
  const link = e.target.closest('a[data-actie=naarGeenAlt]');
  if (link) { e.preventDefault(); MODUS = 'lijst'; LS.set('lt:modus', MODUS); TAB = 'geen'; renderBeoordelaar(); window.scrollTo(0, 0); return; }
  const knop = e.target.closest('button');
  const regel = e.target.closest('.regel[data-key]');
  if (regel && !e.target.closest('a')) zetActief(regel.dataset.key, false);
  if (!knop) return;
  if (knop.dataset.o && regel) { zetOordeel(regel.dataset.key, knop.dataset.o); return; }
  const a = knop.dataset.actie;
  if (a === 'toelOpen' && regel) { regel.classList.add('toel-open'); $('textarea', regel).focus(); return; }
  if (a === 'uitlegWeg') { LS.set('lt:uitleg-gezien', true); const u = $('.uitleg'); if (u) u.remove(); return; }
  if (a === 'stapVolgende') return stapVolgende();
  if (a === 'stapVorige') { if (STAP > 0) gaNaarStap(STAP - 1); return; }
  if (a === 'stapBegin') return gaNaarStap(0);
  if (a === 'stapEersteOpen') { const i = eersteOpenStap(); return gaNaarStap(i < 0 ? 0 : i, i < 0); }
  if (a === 'naarLijst' || a === 'naarStap') {
    MODUS = a === 'naarLijst' ? 'lijst' : 'stap'; LS.set('lt:modus', MODUS);
    if (MODUS === 'stap') { STAP = eersteOpenStap(); STAP_EINDE = STAP < 0; if (STAP < 0) STAP = 0; }
    renderBeoordelaar(); window.scrollTo(0, 0); return;
  }
  if (a === 'nieuwVoorstel') { FORMS[knop.dataset.tekort] = {positie: null}; renderVoorstelForm(knop.dataset.tekort); const z = $(`.vs-form[data-form="${CSS.escape(knop.dataset.tekort)}"] .vs-zoek`); if (z) z.focus(); }
  else if (a === 'annuleerVoorstel') { delete FORMS[knop.dataset.tekort]; renderVoorstelForm(knop.dataset.tekort); }
  else if (a === 'bewaarVoorstel') bewaarVoorstel(knop.dataset.tekort);
  else if (a === 'verwijderVoorstel') {
    const v = WERK.voorstellen.find(x => x.id === knop.dataset.id); if (!v) return;
    if (!await bevestig('Voorstel verwijderen', `<p>Weet je zeker dat je het voorstel <b>${esc(v.generiek)}</b> (PRK ${esc(v.prk)}) bij ${esc(v.tekortNaam)} wilt verwijderen?</p>`, 'Verwijderen')) return;
    try { await Opslag.verwijderVoorstel(v.id); } catch (err) { return toast(err.message, 'fout'); }
    WERK.voorstellen = WERK.voorstellen.filter(x => x.id !== v.id);
    if (MODUS === 'lijst' && TAB === 'mijn') renderLijst(); else { vervangVoorstellenBlok(v.tekortPrk); renderTabs(); }
    updateVoortgang();
  } else if (a === 'gaNaar') {
    TAB = knop.dataset.soort === 'geen' ? 'geen' : 'alt';
    FILTER.klasse = FILTER.niveau = FILTER.zoek = ''; FILTER.open = false;
    renderBeoordelaar();
    const k = $(`.kaart[data-tekort="${CSS.escape(knop.dataset.tekort)}"]`); if (k) k.scrollIntoView({block: 'start'});
  }
});
document.addEventListener('input', e => {
  if (VIEW !== 'beoordelen' || !e.target.classList.contains('toel')) return;
  const regel = e.target.closest('.regel[data-key]'); if (!regel) return;
  if (e.target.value) regel.classList.add('toel-open'); // getypte toelichting blijft zichtbaar, ook als het oordeel later Akkoord wordt
  zetToelichting(regel.dataset.key, e.target.value);
});
document.addEventListener('focusin', e => {
  if (VIEW !== 'beoordelen') return;
  const regel = e.target.closest && e.target.closest('.regel[data-key]');
  if (regel && ACTIEF !== regel.dataset.key) zetActief(regel.dataset.key, false);
});
document.addEventListener('keydown', e => {
  if (VIEW !== 'beoordelen' || !$('#lijst') || !$('#modal').classList.contains('verborgen')) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'input' || tag === 'select') { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'j') { verplaatsActief(1); e.preventDefault(); return; }
  if (k === 'k') { verplaatsActief(-1); e.preventDefault(); return; }
  if (!ACTIEF) return;
  const el = $(`.regel[data-key="${CSS.escape(ACTIEF)}"]`); if (!el) return;
  const map = {a: 'akkoord', n: 'niet', b: 'bespreken'};
  if (map[k]) {
    e.preventDefault();
    if ((WERK.oordelen[ACTIEF] || {}).o === map[k]) return; // sneltoets wist niet; klik daarvoor op de knop
    zetOordeel(ACTIEF, map[k]);
    verplaatsActief(1);
  } else if (k === 't') { e.preventDefault(); el.classList.add('toel-open'); $('textarea', el).focus(); }
});

/* Export / import (back-up) */
function exporteerBeoordeling() {
  const obj = beoordelingNaarJson(WERK, BRON);
  download(`Beoordeling_${GEBRUIKER.naam.replace(/\s+/g, '_')}_${stempel()}.json`, JSON.stringify(obj, null, 2), 'application/json');
  toast(`Back-up gedownload (${obj.aantalBeoordeeld} van ${obj.aantalRegels} regels, ${obj.voorstellen.length} voorstellen).`, 'ok');
}
async function importeerBeoordeling() {
  const [f] = await kiesBestanden('.json,application/json');
  if (!f) return;
  try {
    let obj; try { obj = JSON.parse(await f.text()); } catch (e) { throw new Fout(`"${f.name}" is geen geldig JSON-bestand.`); }
    const rv = parseBeoordeling(obj, f.name);
    const oordelen = Object.entries(rv.oordelen).filter(([k]) => BRON.regelMap.has(k));
    const nieuweVs = rv.voorstellen.filter(v => BRON.tekortMap.has(v.tekortPrk) && !WERK.voorstellen.some(x => x.tekortPrk === v.tekortPrk && x.prk === v.prk));
    const ander = rv.beoordelaar !== GEBRUIKER.naam ? `<div class="melding waarsch">Dit bestand is de beoordeling van <b>${esc(rv.beoordelaar)}</b>. Het wordt opgeslagen als jouw beoordeling (${esc(GEBRUIKER.naam)}).</div>` : '';
    const ok = await bevestig('Beoordeling importeren', `${ander}<p>Bestand: <b>${esc(f.name)}</b> (${esc(leesbareDatum(rv.datum))})<br>${oordelen.length} oordelen en ${nieuweVs.length} nieuwe voorstellen voor deze versie van de lijst.</p><p>Oordelen uit het bestand vervangen je huidige oordelen voor dezelfde regels.</p>`, 'Importeren');
    if (!ok) return;
    for (const [k, oo] of oordelen) { WERK.oordelen[k] = {o: oo.o, t: oo.t, tijd: new Date().toISOString()}; Opslag.zetOordeel(BRON.vingerafdruk, k, WERK.oordelen[k]); }
    for (const v of nieuweVs) { const {id, ...rest} = v; WERK.voorstellen.push(await Opslag.voegVoorstelToe(BRON.vingerafdruk, rest)); }
    renderBeoordelaar();
    toast(`Geïmporteerd: ${oordelen.length} oordelen en ${nieuweVs.length} voorstellen.`, 'ok');
  } catch (e) { meld('Importeren mislukt', `<p>${esc(e.message)}</p>`); if (!(e instanceof Fout)) console.error(e); }
}

/* =====================================================================
   Coördinator
   ===================================================================== */
let vernieuwTimer = null, vernieuwPlan = null, stopLuisteren = null, wachtOpBlur = false;
function stopCoordinator() {
  if (stopLuisteren) { stopLuisteren(); stopLuisteren = null; }
  clearInterval(vernieuwTimer); clearTimeout(vernieuwPlan);
}
async function laadCoordinatie() {
  const fp = BRON.vingerafdruk;
  const [panel, werkPer, besluiten, coordinatie] = await Promise.all([Opslag.panel(), Opslag.alleWerk(fp), Opslag.besluiten(fp), Opslag.coordinatie(fp)]);
  C = {allen: panel, panel: panel.filter(p => p.beoordelaar).map(p => ({email: p.email, naam: p.naam})), werkPer, besluiten, coordinatie, geladen: new Date()};
}
async function startCoordinator() {
  renderKop();
  laden('Alle beoordelingen ophalen…');
  try { await laadCoordinatie(); }
  catch (e) { return toonFout('De beoordelingen konden niet worden opgehaald.', e); }
  renderCoordinator();
  stopCoordinator();
  stopLuisteren = Opslag.luister(BRON.vingerafdruk, () => planVernieuwing());
  vernieuwTimer = setInterval(planVernieuwing, 120000); // vangnet als live bijwerken niet werkt
}
function planVernieuwing() { clearTimeout(vernieuwPlan); vernieuwPlan = setTimeout(vernieuw, 800); }
const typtInLijst = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#cinhoud') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
async function vernieuw() {
  if (VIEW !== 'coordineren') return;
  try { await laadCoordinatie(); }
  catch (e) { const el = $('#liveStatus'); if (el) el.textContent = '⚠ Bijwerken mislukt'; return; }
  if (typtInLijst()) { wachtOpBlur = true; renderSlots(); return; } // niet storen tijdens typen
  renderCoordinatorInhoud();
}
document.addEventListener('focusout', () => {
  if (!wachtOpBlur || VIEW !== 'coordineren') return;
  setTimeout(() => { if (wachtOpBlur && !typtInLijst()) { wachtOpBlur = false; renderCoordinatorInhoud(); } }, 300);
});
function U() { return berekenUitkomsten(BRON, C.panel, C.werkPer, C.besluiten.regels, C.besluiten.voorstellen); }
function aantalBeoordeeldDoor(email) { const w = C.werkPer[email]; return w ? BRON.regels.filter(r => geldigOordeel(w.oordelen[r.key])).length : 0; }
function renderCoordinator() {
  renderKop(`<span class="bewaard" id="liveStatus"></span><button class="knop" id="btnVernieuw">Vernieuwen</button><button class="knop" id="btnBackup" title="Download alle oordelen en besluiten als back-up">Back-up</button>`);
  $('#btnVernieuw').addEventListener('click', () => vernieuw());
  $('#btnBackup').addEventListener('click', exporteerBackup);
  $('#main').innerHTML = `${bronMeldingenHtml()}
    ${GEBRUIKER.beoordelaar ? `<div class="melding">Als coördinator zie je de oordelen van iedereen. Rond je eigen beoordeling bij voorkeur eerst af (knop <b>Beoordelen</b>), zodat je niet wordt beïnvloed.</div>` : ''}
    <div class="slots" id="slots"></div>
    <div id="coordMelding"></div>
    <div class="tabs" id="ctabs"></div>
    <div id="cinhoud"></div>`;
  renderCoordinatorInhoud();
}
function renderCoordinatorInhoud() {
  document.documentElement.style.setProperty('--n', Math.max(1, C.panel.length));
  renderSlots();
  $('#coordMelding').innerHTML = C.panel.length < MIN_EENS ? `<div class="melding fout">Er staan minder dan ${MIN_EENS} beoordelaars op het panel. Voeg ze toe in Supabase (tabel <i>panel</i>).</div>` : '';
  renderCTabs();
}
function renderSlots() {
  const p = C.coordinatie.gepubliceerd;
  const laatste = email => { const w = C.werkPer[email]; if (!w) return ''; const t = Object.values(w.oordelen).map(o => o.tijd).filter(Boolean).sort().pop(); return t ? 'laatst ' + leesbareDatum(t) : ''; };
  $('#slots').innerHTML = `
    <div class="slot"><h3>Lijst</h3><div class="status ok">${esc(BRON.bestand)}</div><small>${BRON.regels.length} regels · ${BRON.tekorten.length} tekorten · ${BRON.geenAlt.length} zonder alternatief</small></div>
    ${C.panel.map(x => { const n = aantalBeoordeeldDoor(x.email), w = C.werkPer[x.email]; return `<div class="slot"><h3>${esc(x.naam)}</h3>
      <div class="status ${n === BRON.regels.length ? 'ok' : n ? '' : 'leeg'}">${n} van ${BRON.regels.length} beoordeeld</div>
      <div class="vg-bar" style="margin:4px 0"><div style="width:${100 * n / BRON.regels.length}%"></div></div>
      <small>${w ? w.voorstellen.length : 0} eigen voorstel(len)${laatste(x.email) ? ' · ' + esc(laatste(x.email)) : ''}</small></div>`; }).join('')}
    <div class="slot"><h3>Gepubliceerde lijst (optioneel)</h3>${p ? `<div class="status ok">✓ ${esc(p.bestand)}</div><small>${p.rijen.length} bestaande regels</small>` : `<div class="status leeg">Niet geladen</div><small>bijv. alternatieve-prk-regels-20260916.csv</small>`}
      <div class="knoppen"><button class="knop klein" id="btnLaadPub">${p ? 'Vervangen…' : 'Lijst laden…'}</button>${p ? '<button class="knop klein gevaar" id="btnPubWeg">Verwijderen</button>' : ''}</div></div>`;
  $('#btnLaadPub').addEventListener('click', laadGepubliceerd);
  if ($('#btnPubWeg')) $('#btnPubWeg').addEventListener('click', async () => {
    if (!await bevestig('Verwijderen', '<p>De gepubliceerde lijst wordt uit de coördinatie gehaald.</p>', 'Verwijderen')) return;
    C.coordinatie.gepubliceerd = null; await bewaarCoordinatie(); renderCoordinatorInhoud();
  });
  const el = $('#liveStatus'); if (el) el.textContent = 'Bijgewerkt ' + leesbareDatum(C.geladen.toISOString()).slice(11);
}
async function bewaarCoordinatie() {
  try { await Opslag.zetCoordinatie(BRON.vingerafdruk, C.coordinatie); return true; }
  catch (e) { toast('Niet opgeslagen: ' + e.message, 'fout'); return false; }
}
async function laadGepubliceerd() {
  const [f] = await kiesBestanden('.csv,text/csv,.txt'); if (!f) return;
  try {
    C.coordinatie.gepubliceerd = parseGepubliceerd(await leesTekstbestand(f), f.name);
    await bewaarCoordinatie(); renderCoordinatorInhoud();
    if (C.coordinatie.gepubliceerd.meldingen.length) meld('Gepubliceerde lijst geladen, met meldingen', `<ul>${C.coordinatie.gepubliceerd.meldingen.slice(0, 20).map(m => `<li>${esc(m)}</li>`).join('')}</ul>`);
    else toast(`Gepubliceerde lijst geladen: ${C.coordinatie.gepubliceerd.rijen.length} regels.`, 'ok');
  } catch (e) { meld('Gepubliceerde lijst niet geladen', `<p>${esc(e.message)}</p>`); }
}
async function bewaarBesluit(soort, sleutel, b) {
  const deel = soort === 'voorstel' ? 'voorstellen' : 'regels', oud = C.besluiten[deel][sleutel];
  if (b) C.besluiten[deel][sleutel] = b; else delete C.besluiten[deel][sleutel];
  try { await Opslag.zetBesluit(BRON.vingerafdruk, soort, sleutel, b); return true; }
  catch (e) { if (oud) C.besluiten[deel][sleutel] = oud; else delete C.besluiten[deel][sleutel]; toast('Besluit niet opgeslagen: ' + e.message, 'fout'); return false; }
}
function herteken(rijSel, html) { const el = $(rijSel); if (el) el.outerHTML = html; }
/* Besluiten: één luisteraar voor de coördinatorlijsten */
document.addEventListener('click', async e => {
  if (VIEW !== 'coordineren') return;
  const knop = e.target.closest('.besluit button[data-b]'); if (!knop) return;
  const rij = knop.closest('.bs-rij');
  if (rij.dataset.key) {
    const k = rij.dataset.key, b = {...(C.besluiten.regels[k] || {})};
    b.b = b.b === knop.dataset.b ? null : knop.dataset.b; b.notitie = $('.notitie', rij).value;
    await bewaarBesluit('regel', k, !b.b && !b.notitie ? null : b);
    herteken(`.bs-rij[data-key="${CSS.escape(k)}"]`, htmlBesprekenRij(U().regels.find(y => y.r.key === k)));
  } else if (rij.dataset.gk) {
    const gk = rij.dataset.gk, b = {...(C.besluiten.voorstellen[gk] || {})};
    b.b = b.b === knop.dataset.b ? null : knop.dataset.b;
    b.categorie = $('.vb-cat', rij).value; b.positie = $('.vb-pos', rij).value; b.notitie = $('.notitie', rij).value;
    await bewaarBesluit('voorstel', gk, !b.b && !b.notitie ? null : b);
    herteken(`.bs-rij[data-gk="${CSS.escape(gk)}"]`, htmlVoorstelRij(U().voorstellen.find(y => y.gk === gk)));
  }
  renderCTabsAlleenKop();
});
document.addEventListener('change', async e => {
  if (VIEW !== 'coordineren') return;
  const rij = e.target.closest && e.target.closest('.bs-rij'); if (!rij) return;
  if (rij.dataset.key && e.target.classList.contains('notitie')) {
    const k = rij.dataset.key, b = {...(C.besluiten.regels[k] || {b: null}), notitie: e.target.value};
    await bewaarBesluit('regel', k, !b.b && !b.notitie ? null : b);
  } else if (rij.dataset.gk) {
    const gk = rij.dataset.gk, b = {...(C.besluiten.voorstellen[gk] || {b: null})};
    b.categorie = $('.vb-cat', rij).value; b.positie = $('.vb-pos', rij).value; b.notitie = $('.notitie', rij).value;
    await bewaarBesluit('voorstel', gk, b);
    if (e.target.classList.contains('vb-cat') && b.b === 'akkoord') herteken(`.bs-rij[data-gk="${CSS.escape(gk)}"]`, htmlVoorstelRij(U().voorstellen.find(y => y.gk === gk)));
  }
});
function exporteerBackup() {
  download(`Levertekorten_backup_${stempel()}.json`, JSON.stringify({app: APP, soort: 'coordinatie-backup', datum: new Date().toISOString(), bronbestand: BRON.bestand, bronVingerafdruk: BRON.vingerafdruk,
    panel: C.allen, beoordelingen: C.werkPer, besluiten: C.besluiten, coordinatie: C.coordinatie}, null, 2), 'application/json');
}

/* Testhaak (alleen voor de geautomatiseerde tests) */
window.LT = {get BRON() { return BRON; }, get WERK() { return WERK; }, get C() { return C; }, get ZINDEX() { return ZINDEX; }, get GEBRUIKER() { return GEBRUIKER; }, U: () => U(), vernieuw: () => vernieuw()};

start();
