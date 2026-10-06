/* Tests van de rekenlogica (js/kern.js). Gebruik: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..');
const Kern = require(path.join(REPO, 'js/kern.js'));
Kern.zetXLSX(require(path.join(REPO, 'vendor/xlsx.full.min.js')));
const bron = Kern.indexeerBron(JSON.parse(fs.readFileSync(path.join(REPO, 'data/bron.json'), 'utf8')));

test('consensus: alle 64 combinaties van drie apothekers volgen de regel "minimaal twee eens"', () => {
  const W = ['akkoord', 'niet', 'bespreken', null];
  for (const a of W) for (const b of W) for (const c of W) {
    const oo = [a, b, c];
    const nA = oo.filter(x => x === 'akkoord').length, nN = oo.filter(x => x === 'niet').length, n = oo.filter(Boolean).length;
    const verwacht = nA >= 2 ? 'akkoord' : nN >= 2 ? 'afgewezen' : n >= 2 ? 'bespreken' : 'onvolledig';
    assert.equal(Kern.consensus(oo), verwacht, JSON.stringify(oo));
  }
});

test('consensus met twee apothekers: gelijk aan de oorspronkelijke tabel', () => {
  const t = [['akkoord', 'akkoord', 'akkoord'], ['niet', 'niet', 'afgewezen'], ['akkoord', 'niet', 'bespreken'], ['bespreken', 'akkoord', 'bespreken'],
    ['bespreken', 'bespreken', 'bespreken'], ['akkoord', null, 'onvolledig'], [null, null, 'onvolledig']];
  for (const [a, b, v] of t) assert.equal(Kern.consensus([a, b]), v);
});

test('uitkomsten, voorstellen en laadbestand op de echte lijst', () => {
  const k = bron.tekorten.flatMap(t => t.keys);
  const panel = [{email: 'a', naam: 'A'}, {email: 'b', naam: 'B'}, {email: 'c', naam: 'C'}];
  const zet = (...oo) => Object.fromEntries(oo.map(([key, o]) => [key, {o, t: ''}]));
  const tk = bron.tekorten[1];
  const werk = {
    a: {oordelen: zet([k[0], 'akkoord'], [k[1], 'akkoord'], [k[2], 'niet']), voorstellen: [{tekortPrk: tk.prk, prk: '999', generiek: 'NIEUW  10MG', categorie: 'AndereStof', positie: 1}]},
    b: {oordelen: zet([k[0], 'akkoord'], [k[1], 'niet'], [k[2], 'niet']), voorstellen: [{tekortPrk: tk.prk, prk: '999', generiek: 'NIEUW  10MG', categorie: 'AndereStof', positie: 2}]},
    c: {oordelen: zet([k[1], 'akkoord']), voorstellen: []}
  };
  const u = Kern.berekenUitkomsten(bron, panel, werk, {}, {[tk.prk + '|999']: {b: 'akkoord', categorie: 'AndereStof', positie: 1}});
  const per = Object.fromEntries(u.regels.map(x => [x.r.key, x]));
  assert.equal(per[k[0]].cons, 'akkoord');
  assert.equal(per[k[1]].cons, 'akkoord'); assert.ok(per[k[1]].tegenstem);
  assert.equal(per[k[2]].cons, 'afgewezen');
  assert.equal(per[k[3]].cons, 'onvolledig');
  assert.equal(u.voorstellen.length, 1); assert.equal(u.voorstellen[0].soort, 'gezamenlijk');
  const {regels} = Kern.bouwNieuweRegels(bron, u);
  assert.deepEqual(regels.map(r => r.adviesPrk + '|' + r.altPrk).sort(), [k[0], k[1], tk.prk + '|999'].sort());
  // voorstel op positie 1: staat in het tekort vóór de bestaande regels
  const vanTk = regels.filter(r => r.adviesPrk === tk.prk);
  assert.equal(vanTk[0].altPrk, '999');
  assert.equal(vanTk[0].altNaam, 'NIEUW  10MG');
  // sortering op AdviesPrk
  const prks = regels.map(r => +r.adviesPrk); assert.deepEqual(prks, [...prks].sort((x, y) => x - y));
  // samenvoegen met gepubliceerde lijst
  const pub = Kern.parseGepubliceerd('﻿AdviesPrk;AdviesPrkNaam;AlternatiefPrk;AlternatiefPrkNaam;Categorie\r\n' + `${k[0].replace('|', ';X;')};Y;AndereDosering\r\n1;A;2;B;AndereStof\r\n1;A;2;B;AndereStof\r\n`, 'pub.csv');
  const {rijen, st} = Kern.samenvoegen(pub.rijen, regels, new Set(), false);
  assert.equal(st.bestaand, 3); assert.equal(st.bestaandDubbel, 1); assert.equal(st.dubbel, 1); assert.equal(st.toegevoegd, 2); assert.equal(rijen.length, 4);
  const csv = Kern.naarOaCsv(rijen);
  assert.ok(csv.startsWith('AdviesPrk;AdviesPrkNaam;AlternatiefPrk;AlternatiefPrkNaam;Categorie\r\n'));
  assert.ok(csv.endsWith('\r\n') && !/[^\r]\n/.test(csv));
  assert.equal(csv.split('\r\n').filter(Boolean).length, 5);
});

test('laadbestand weigert puntkomma of onbekende categorie', () => {
  assert.throws(() => Kern.naarOaCsv([{velden: ['1', 'A;B', '2', 'C', 'AndereStof']}]), /kan niet worden gemaakt/);
  assert.throws(() => Kern.naarOaCsv([{velden: ['1', 'A', '2', 'C', 'Onbekend']}]), /geen geldige systeemcode/);
});

test('gepubliceerde lijst: verkeerde kopregel wordt duidelijk gemeld', () => {
  assert.throws(() => Kern.parseGepubliceerd('a,b,c\n1,2,3', 'x.csv'), /komma/);
});

test('toedieningswegen: gecombineerde routes en oraal/rectaal', () => {
  assert.equal(Kern.vergelijkRoute('ORAAL', 'ORAAL'), 'gelijk');
  assert.equal(Kern.vergelijkRoute('PARENTERAAL', 'PARENTERAAL,RECTAAL'), 'gelijk');
  assert.equal(Kern.vergelijkRoute('ORAAL', 'PARENTERAAL,RECTAAL'), 'oraal-rectaal');
  assert.equal(Kern.vergelijkRoute('ORAAL', 'CUTAAN'), 'anders');
  assert.equal(Kern.vergelijkRoute('', 'ORAAL'), null);
});

test('data/ is bijgewerkt: komt overeen met de Excel-bestanden in invoer/', () => {
  const XLSX = require(path.join(REPO, 'vendor/xlsx.full.min.js'));
  const map = path.join(REPO, 'invoer');
  const f = fs.readdirSync(map).filter(x => /^Tekorten_te_beoordelen_.*\.xlsx$/i.test(x)).sort().pop();
  const opnieuw = Kern.parseBron(XLSX.read(fs.readFileSync(path.join(map, f)), {type: 'buffer'}), f);
  assert.equal(bron.vingerafdruk, opnieuw.vingerafdruk, 'draai: node tools/bouw-data.js');
  assert.equal(bron.regels.length, 299);
});
