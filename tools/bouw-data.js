#!/usr/bin/env node
/* Zet de Excel-bestanden in invoer/ om naar data/bron.json en data/zindex.json.
   Gebruikt precies dezelfde inleescode als de app (js/kern.js).
   - Lijst:   de nieuwste invoer/Tekorten_te_beoordelen_*.xlsx (op bestandsnaam)
   - Z-index: de nieuwste invoer/Z_index*.xlsx
   Gebruik: node tools/bouw-data.js */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..');
const XLSX = require(path.join(REPO, 'vendor/xlsx.full.min.js'));
const Kern = require(path.join(REPO, 'js/kern.js'));
Kern.zetXLSX(XLSX);

function nieuwste(patroon, omschrijving) {
  const map = path.join(REPO, 'invoer');
  const lijst = fs.readdirSync(map).filter(f => patroon.test(f) && !f.startsWith('~$')).sort();
  if (!lijst.length) throw new Error(`Geen ${omschrijving} gevonden in invoer/ (verwacht: ${patroon}).`);
  return path.join(map, lijst[lijst.length - 1]);
}
const lees = p => XLSX.read(fs.readFileSync(p), {type: 'buffer'});

const bronPad = nieuwste(/^Tekorten_te_beoordelen_.*\.xlsx$/i, 'lijst met te beoordelen tekorten');
const ziPad = nieuwste(/^Z_index.*\.xlsx$/i, 'Z-index');
const bron = Kern.parseBron(lees(bronPad), path.basename(bronPad));
const z = Kern.parseZindex(lees(ziPad), path.basename(ziPad));
delete bron.geladenOp; // houdt de uitvoer gelijk zolang de invoer gelijk is

fs.mkdirSync(path.join(REPO, 'data'), {recursive: true});
fs.writeFileSync(path.join(REPO, 'data/bron.json'), JSON.stringify(Kern.bronNaarData(bron)));
const zd = Kern.zindexNaarData(z); delete zd.geladenOp;
fs.writeFileSync(path.join(REPO, 'data/zindex.json'), JSON.stringify(zd));

console.log(`Lijst:   ${path.basename(bronPad)} – ${bron.regels.length} regels, ${bron.tekorten.length} tekorten, ${bron.geenAlt.length} zonder alternatief (versie ${bron.vingerafdruk.slice(0, 12)})`);
for (const m of bron.meldingen) console.log('  melding: ' + m);
console.log(`Z-index: ${path.basename(ziPad)} – ${z.prks.length} PRK's, ${z.artikelen} artikelen (${z.verborgen} vervallen of uit de handel)`);
for (const m of z.meldingen) console.log('  melding: ' + m);
