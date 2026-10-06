# CLAUDE.md

Richtlijnen voor Claude Code in deze repository. Taal van code-commentaar, UI, commits en documentatie: **Nederlands**. De gebruiker (Arnout Janse, apotheker, projectleider Levertekorten bij Mosadex) is niet technisch: leg stappen in gewone taal uit en doe zoveel mogelijk zelf.

## Wat dit is

Statische webapp (GitHub Pages) waarmee apothekers ieder zelfstandig alternatieven bij levertekorten beoordelen. Oordelen worden centraal opgeslagen in **Supabase**. Eindoordeel = **minimaal twee apothekers eens** (`MIN_EENS` in `js/kern.js`). Zie `README.md` voor de werkwijze.

- `js/kern.js`: pure logica (Excel inlezen, consensus, laadbestand). Draait in browser en Node.
- `js/opslag.js`: Supabase-opslag, of de proefmodus (localStorage) als `js/config.js` leeg is.
- `js/app.js`: schermen. `js/config.js`: Supabase-URL en anon-sleutel.
- `supabase/schema.sql`: tabellen en RLS (blind beoordelen, coördinator ziet alles). Herhaalbaar uit te voeren.
- `invoer/*.xlsx` → `node tools/bouw-data.js` → `data/*.json`. De workflow `.github/workflows/publiceren.yml` doet dit, test en publiceert naar Pages.
- Tests: `node --test tests/kern.test.js`, `tests/rls/draai.sh` (lokale PostgreSQL), `node tests/e2e/gedeeld.js` (Playwright, nagebootste Supabase).
- Het OA-laadbestand moet exact blijven: `AdviesPrk;AdviesPrkNaam;AlternatiefPrk;AlternatiefPrkNaam;Categorie`, UTF-8 zonder BOM, CRLF. Namen letterlijk overnemen (ook dubbele spaties).

## Openstaande taak: Supabase inrichten (via de Supabase-connector)

Status bij overdracht: code staat klaar en is getest. `js/config.js` is nog leeg (app draait in proefmodus). GitHub Pages moet de gebruiker zelf aanzetten (Settings → Pages → Source: GitHub Actions); daarna de workflow opnieuw draaien.

Stappen met de Supabase-MCP-tools:
1. `list_organizations`. Geen organisatie? Vraag de gebruiker eerst een (gratis) account op supabase.com te maken.
2. `get_cost` (type project) → `confirm_cost` → `create_project` met naam `levertekorten`, regio `eu-central-1` (Frankfurt). Het gratis plan volstaat; noem de kosten (€0) expliciet voordat je bevestigt.
3. Wacht met `get_project` tot de status `ACTIVE_HEALTHY` is.
4. `apply_migration` met naam `schema` en als query de volledige inhoud van `supabase/schema.sql`.
5. Vraag de gebruiker om de e-mailadressen en namen van het panel (Jan Feenstra, Femke Dieker, Arnout Janse; Arnout is ook coördinator). Voeg ze toe met `execute_sql`: `insert into public.panel (email, naam, beoordelaar, coordinator) values (...) on conflict (email) do update set ...`. E-mailadressen in kleine letters. **Zet nooit e-mailadressen of panelnamen in de repository** (die is openbaar).
6. `get_project_url` en de anon/publishable-sleutel ophalen (`get_publishable_keys` of `get_anon_key`). Zet ze in `js/config.js`, commit en push naar `main`. De anon-sleutel mag openbaar zijn; de service-role-sleutel **nooit**.
7. Controleer met `get_advisors` (security) dat er geen RLS-waarschuwingen zijn.
8. **Eén handmatige stap voor de gebruiker** (de connector kan dit niet): Supabase-dashboard → Authentication → URL Configuration:
   - *Site URL* = het Pages-adres (zie Settings → Pages; waarschijnlijk `https://agjan0612.github.io/Levertekorten/`);
   - hetzelfde adres toevoegen bij *Redirect URLs*.

   Zonder deze stap stuurt de inlogmail naar `localhost`. Leg de klikken stap voor stap uit.
9. Optioneel: Authentication → Emails → Magic Link, Nederlandse tekst (laat `{{ .ConfirmationURL }}` staan).
10. Eerste echte test met de gebruiker: inloggen via de link, een oordeel geven en wisselen naar Coördineren.

Gratis Supabase-projecten pauzeren na ongeveer een week zonder gebruik. Herstellen kan met `restore_project` of in het dashboard.
