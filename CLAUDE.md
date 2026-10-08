# CLAUDE.md

Richtlijnen voor Claude Code in deze repository. Taal van code-commentaar, UI, commits en documentatie: **Nederlands**. De gebruiker (Arnout Janse, apotheker, projectleider Levertekorten bij Mosadex) is niet technisch: leg stappen in gewone taal uit en doe zoveel mogelijk zelf.

**Begin elke nieuwe sessie met `VOORTGANG.md`**: daarin staan de genomen besluiten, de stand van zaken en de openstaande punten. Werk dat bestand bij als er iets wezenlijks verandert.

## Wat dit is

Statische webapp (GitHub Pages) waarmee apothekers ieder zelfstandig alternatieven bij levertekorten beoordelen. Oordelen worden centraal opgeslagen in **Supabase**. Eindoordeel = **minimaal twee apothekers eens** (`MIN_EENS` in `js/kern.js`). Zie `README.md` voor de werkwijze.

- `js/kern.js`: pure logica (Excel inlezen, consensus, laadbestand). Draait in browser en Node.
- `js/opslag.js`: Supabase-opslag, of de proefmodus (localStorage) als `js/config.js` leeg is.
- `js/app.js`: schermen. `js/config.js`: Supabase-URL en anon-sleutel.
- **Beoordelaarsscherm heeft twee weergaven** (`MODUS` in `js/app.js`, per browser onthouden in localStorage `lt:modus`): `stap` (standaard, één tekort per scherm, `renderStap()`) en `lijst` (alle tekorten met filters en tabbladen). De stapweergave hergebruikt dezelfde `.regel[data-key]`-markup (`htmlRegel`) en zet zijn inhoud in een container met id `#lijst`, zodat de bestaande klik-, invoer- en toetsenbordluisteraars ongewijzigd werken. `renderTabs()` doet niets zonder `#tabs`; roep in de stapweergave nooit `renderLijst()` aan. Toelichting in de stapweergave: verborgen tot een keuze (CSS op `.o-niet`/`.o-bespreken`/`.toel-open`).
- `supabase/schema.sql`: tabellen en RLS (blind beoordelen, coördinator ziet alles). Herhaalbaar uit te voeren.
- `invoer/*.xlsx` → `node tools/bouw-data.js` → `data/*.json`. De workflow `.github/workflows/publiceren.yml` doet dit, test en publiceert naar Pages.
- Tests: `node --test tests/kern.test.js`, `tests/rls/draai.sh` (lokale PostgreSQL), `node tests/e2e/gedeeld.js` (Playwright, nagebootste Supabase). In `gedeeld.js` opent `tab(email, modus)` standaard de **lijst**weergave; het blok "Stap voor stap" test de stapweergave. Playwright staat in `/opt/node-tools/node_modules/playwright`.
- **Screenshots maken** (UI-review, handleidingen): start een kleine http-server zoals in `tests/e2e/gedeeld.js` (vervang `vendor/supabase.js` door `tests/e2e/nep-supabase.js` en `js/config.js` door `tests/e2e/nep-config.js`), zet testgegevens in localStorage `nep-db` (`{panel, oordelen, voorstellen, besluiten, coordinatie}`; oordelen-rijen hebben de kolommen `oordeel` en `toelichting`) en log in via sessionStorage `nep-sessie` = e-mailadres. Gebruik **verzonnen** namen.
- **Handleidingen** (`handleidingen/`, Word + HTML, beoordelaars en coördinator) staan in de repository; de HTML-versies worden mee gepubliceerd (`…/Levertekorten/handleidingen/…html`). Ze bevatten bewust **geen panelnamen of e-mailadressen** (de repository is openbaar); alleen de opdrachtgever wordt als coördinator genoemd. Werk ze bij als de werkwijze verandert: Word via `word/document.xml` (afbeeldingen in `word/media`, onderschrift "Afbeelding N."), HTML met afbeeldingen als base64 in `<figure>`; houd beide gelijk.
- Het OA-laadbestand moet exact blijven: `AdviesPrk;AdviesPrkNaam;AlternatiefPrk;AlternatiefPrkNaam;Categorie`, UTF-8 zonder BOM, CRLF. Namen letterlijk overnemen (ook dubbele spaties).

## Supabase

Project `levertekorten` (ref `obmjttyruqyqprulojbv`, regio eu-central-1, organisatie "Levertekorten", gratis plan) is ingericht volgens `supabase/schema.sql`. `js/config.js` bevat de URL en de *publishable* sleutel (die mag openbaar zijn; de service-role-sleutel **nooit** in de repository).

- **Let op bij de Supabase-connector:** SQL met `drop …` (ook `drop … if exists`), `delete …` of `apply_migration` liep vast (time-out na 60 s, vermoedelijk een bevestigingsvraag die niet verschijnt). Voer wijzigingen uit als `execute_sql` in kleine stukken, zonder `drop`/`delete`, of laat de gebruiker het SQL-script in de SQL Editor plakken (wissen gaat dus altijd via de gebruiker).
- **Panel:** beheer met `execute_sql` (`insert … on conflict (email) do update …`). **Zet nooit e-mailadressen of panelnamen in de repository** (die is openbaar).
- **Advisors:** 3 waarschuwingen "SECURITY DEFINER function executable" (`is_beoordelaar`, `is_coordinator`, `mijn_profiel`) zijn bewust. Ze geven alleen informatie over de ingelogde gebruiker zelf, en de RLS-regels hebben ze nodig.
- **Handmatige stap voor de gebruiker:** Authentication → URL Configuration → *Site URL* en *Redirect URLs* = het Pages-adres (`https://agjan0612.github.io/Levertekorten/`). Zonder die stap stuurt de inlogmail naar localhost.
- Gratis projecten pauzeren na ongeveer een week zonder gebruik; herstellen kan met `restore_project`. Database-back-ups zijn op het gratis plan niet te downloaden (alleen de knop *Back-up* in de app).
- **Inlogmail (belangrijk):** zonder eigen SMTP stuurt Supabase alleen naar leden van de Supabase-organisatie ("Email address not authorized") en maar een paar per uur. Voor het panel is een eigen SMTP-dienst nodig (Authentication → SMTP). Mail gaat via Brevo (zie `VOORTGANG.md` §5). Zakelijke mailscanners openen links vooraf, en link en code zijn bij Supabase hetzelfde eenmalige inlogbewijs. Daarom linkt de mail (`supabase/inlogmail.html`, sjablonen *Confirm signup* én *Magic Link*) naar de app met `?inlog={{ .TokenHash }}` en logt de app pas in na een klik (`renderLinkInloggen` → `verifieerLink`); daarnaast de code `{{ .Token }}` (`renderCodeInvoer` → `verifieerCode`). Laat die knop nooit automatisch inloggen. Inloggen gebruikt verder `flowType: 'implicit'` en `shouldCreateUser: true` (`js/opslag.js`); de nep-Supabase in `tests/e2e/` kent code `123456` en `?inlog=hash-<adres>`.
- **Logboeken** bekijken kan met `query_logs` (bron `auth_logs` voor inlogpogingen).

## Werkwijze in deze repository

- Werk op de branch die de sessie aangeeft (`claude/…`). GitHub publiceert alleen vanaf `main` (workflow bij push). Maak een pull request en voeg samen **alleen als de opdrachtgever daarom vraagt**; controleer daarna de workflow (*Testen en publiceren*) met de GitHub-tools. `*.github.io` is vanuit de container niet bereikbaar.
- Een samengevoegde PR is af: begin vervolgwerk op een verse branch vanaf `main`.
- Werk na een wezenlijke wijziging ook `README.md` bij (werkwijze voor de apothekers) en `VOORTGANG.md`.
