# CLAUDE.md

Richtlijnen voor Claude Code in deze repository. Taal van code-commentaar, UI, commits en documentatie: **Nederlands**. De gebruiker (Arnout Janse, apotheker, projectleider Levertekorten bij Mosadex) is niet technisch: leg stappen in gewone taal uit en doe zoveel mogelijk zelf.

**Begin elke nieuwe sessie met `VOORTGANG.md`**: daarin staan de genomen besluiten, de stand van zaken en de openstaande punten. Werk dat bestand bij als er iets wezenlijks verandert.

## Wat dit is

Statische webapp (GitHub Pages) waarmee apothekers ieder zelfstandig alternatieven bij levertekorten beoordelen. Oordelen worden centraal opgeslagen in **Supabase**. Eindoordeel = **minimaal twee apothekers eens** (`MIN_EENS` in `js/kern.js`). Zie `README.md` voor de werkwijze.

- `js/kern.js`: pure logica (Excel inlezen, consensus, laadbestand). Draait in browser en Node.
- `js/opslag.js`: Supabase-opslag, of de proefmodus (localStorage) als `js/config.js` leeg is.
- `js/app.js`: schermen. `js/config.js`: Supabase-URL en anon-sleutel.
- `supabase/schema.sql`: tabellen en RLS (blind beoordelen, coördinator ziet alles). Herhaalbaar uit te voeren.
- `invoer/*.xlsx` → `node tools/bouw-data.js` → `data/*.json`. De workflow `.github/workflows/publiceren.yml` doet dit, test en publiceert naar Pages.
- Tests: `node --test tests/kern.test.js`, `tests/rls/draai.sh` (lokale PostgreSQL), `node tests/e2e/gedeeld.js` (Playwright, nagebootste Supabase).
- Het OA-laadbestand moet exact blijven: `AdviesPrk;AdviesPrkNaam;AlternatiefPrk;AlternatiefPrkNaam;Categorie`, UTF-8 zonder BOM, CRLF. Namen letterlijk overnemen (ook dubbele spaties).

## Supabase

Project `levertekorten` (ref `obmjttyruqyqprulojbv`, regio eu-central-1, organisatie "Levertekorten", gratis plan) is ingericht volgens `supabase/schema.sql`. `js/config.js` bevat de URL en de *publishable* sleutel (die mag openbaar zijn; de service-role-sleutel **nooit** in de repository).

- **Let op bij de Supabase-connector:** SQL met `drop …` (ook `drop … if exists`) of `apply_migration` liep vast (time-out na 60 s, vermoedelijk een bevestigingsvraag die niet verschijnt). Voer wijzigingen uit als `execute_sql` in kleine stukken, zonder `drop`, of laat de gebruiker het SQL-script in de SQL Editor plakken.
- **Panel:** beheer met `execute_sql` (`insert … on conflict (email) do update …`). **Zet nooit e-mailadressen of panelnamen in de repository** (die is openbaar).
- **Advisors:** 3 waarschuwingen "SECURITY DEFINER function executable" (`is_beoordelaar`, `is_coordinator`, `mijn_profiel`) zijn bewust. Ze geven alleen informatie over de ingelogde gebruiker zelf, en de RLS-regels hebben ze nodig.
- **Handmatige stap voor de gebruiker:** Authentication → URL Configuration → *Site URL* en *Redirect URLs* = het Pages-adres (`https://agjan0612.github.io/Levertekorten/`). Zonder die stap stuurt de inlogmail naar localhost.
- Gratis projecten pauzeren na ongeveer een week zonder gebruik; herstellen kan met `restore_project`.
