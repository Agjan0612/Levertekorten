# Beoordeling alternatieven bij levertekorten

Webapp voor Project Levertekorten (Mosadex). Apothekers beoordelen ieder zelfstandig de voorgestelde alternatieven bij levertekorten. De app voegt de oordelen automatisch samen, en de coördinator maakt daarna het laadbestand voor Optimaal Aanschrijven (OA).

**Link:** https://agjan0612.github.io/Levertekorten/ (werkt zodra de eenmalige inrichting hieronder is gedaan; het exacte adres staat in *Settings → Pages*)

## Hoe het werkt

- Iedere apotheker opent dezelfde link en logt in met een **inloglink per e-mail**. Een wachtwoord is niet nodig.
- **Blind beoordelen:** je ziet alleen je eigen oordelen. De database dwingt dat af, niet alleen het scherm.
- **Eindoordeel:** minimaal **twee apothekers moeten het eens zijn**.

  | Situatie | Uitkomst |
  |---|---|
  | Minimaal twee keer *Akkoord* | **Akkoord** |
  | Minimaal twee keer *Niet akkoord* | **Afgewezen** |
  | Wel minimaal twee oordelen, maar geen twee gelijke (of *Bespreken*) | **Bespreken** |
  | Minder dan twee oordelen | **Onvolledig** |

  Een eindoordeel waar één apotheker het niet mee eens is, wordt gemarkeerd als *afwijkend oordeel*, zodat de coördinator het kan nalopen.
- **De coördinator ziet live** de voortgang per apotheker en de uitkomst per regel:
  - bij *Bespreken* legt de coördinator na het paneloverleg het eindbesluit vast;
  - eigen voorstellen van apothekers neemt de coördinator aan of wijst ze af;
  - daarna maakt de coördinator het OA-laadbestand.

## Voor de apothekers (beoordelen)

1. Open de link en vul je e-mailadres in. Klik in de e-mail die je krijgt op de inloglink. De app onthoudt je daarna in die browser.
2. Je ziet **steeds één tekort** met de voorgestelde alternatieven, gesorteerd op Prio. De app begint bij het eerste tekort dat je nog niet (helemaal) hebt beoordeeld.
   - Per alternatief kies je **Akkoord**, **Niet akkoord** of **Bespreken**. Een toelichting is altijd optioneel: bij *Niet akkoord* en *Bespreken* staat het veld direct open, bij *Akkoord* klik je op *+ Toelichting toevoegen*.
   - Klik nogmaals op een gekozen oordeel om het te wissen.
   - Klik onderaan op **Volgende tekort**. Wil je een tekort later doen, dan heet die knop **Overslaan, later doen**. Met **Vorige** ga je terug.
   - Alles wordt direct opgeslagen; rechtsboven staat "✓ Opgeslagen". Je kunt altijd stoppen en later verdergaan.
   - Valt de verbinding weg, dan bewaart de app je wijzigingen en slaat ze vanzelf op zodra er weer verbinding is.
   - Ben je klaar, dan zegt de app dat. Je hoeft niets op te sturen.
3. **Lijst van alle tekorten:** met deze knop zie je alle tekorten onder elkaar, met filters en zoeken (bijvoorbeeld om een bepaald tekort terug te vinden). Met **Stap voor stap beoordelen** ga je terug.
4. **Zelf een ander alternatief voorstellen:** klik bij een tekort op *+ Ander alternatief voorstellen*.
   - Zoek in de Z-index op stofnaam, artikelnaam, PRK of ZI-nummer.
   - Kies daarna de categorie en de positie in de cascade.
   - De app waarschuwt als de toedieningsweg afwijkt of als het PRK al in de lijst staat.
   - De tekorten zonder voorstel staan in de lijstweergave op het tabblad **Geen alternatief**.
5. **Sneltoetsen** (op een computer):
   - **J** / **K**: volgende of vorige regel
   - **A**: akkoord, **N**: niet akkoord, **B**: bespreken
   - **T**: naar het toelichtingsveld
   - **Esc**: uit het toelichtingsveld
6. Onder **Meer** (rechtsboven) staan een back-up van je beoordeling (JSON) en een leesbaar overzicht in Excel. Die zijn niet nodig: alles staat al in de gedeelde database.

## Voor de coördinator

- Klik rechtsboven op **Coördineren**. Ben je ook beoordelaar, dan wissel je met **Beoordelen** / **Coördineren**. Rond je eigen beoordeling bij voorkeur eerst af, want als coördinator zie je de oordelen van iedereen.
- **Overzicht:** tellingen per uitkomst.
- **Bespreken:** de regels waar geen eindoordeel uit kwam, met alle oordelen en toelichtingen naast elkaar. Leg hier het eindbesluit vast (Akkoord of Afgewezen, met een notitie).
- **Voorstellen:** de eigen voorstellen van de apothekers. Hebben minimaal twee apothekers hetzelfde PRK voorgesteld, dan heet dat *gezamenlijk voorstel*. Een voorstel gaat alleen in het laadbestand als je het aanneemt, met categorie en positie.
- **Export → Laadbestand maken…:** het OA-laadbestand `alternatieve-prk-regels-<jjjjmmdd>.csv`.
  - Precies de kolommen `AdviesPrk;AdviesPrkNaam;AlternatiefPrk;AlternatiefPrkNaam;Categorie`.
  - Puntkomma als scheidingsteken, UTF-8 zonder BOM, regeleinde CRLF.
  - Alleen regels met eindstatus Akkoord.
  - Gesorteerd per tekort, daarbinnen in cascadevolgorde.
  - Laad je eerst de laatst gepubliceerde lijst in, dan bevat het bestand die lijst plus de nieuwe regels, zonder dubbelingen. Je ziet eerst een samenvatting.
- **Logboek exporteren:** Excel met alle oordelen, uitkomsten en besluiten.
- **Back-up:** download van alle oordelen en besluiten (JSON).

## Een nieuwe lijst of Z-index

Zet het nieuwe Excel-bestand in de map **`invoer/`** van deze repository. Dat kan via de GitHub-website: *Add file → Upload files*. Gebruik dezelfde naamgeving:
- `Tekorten_te_beoordelen_<datum>_v<n>.xlsx`;
- `Z_index_….xlsx`.

GitHub zet het bestand automatisch om en publiceert de app opnieuw. Dat duurt een paar minuten. De app gebruikt steeds de nieuwste versie (op bestandsnaam).

Een nieuwe versie van de lijst krijgt eigen oordelen. Bij het openen biedt de app iedere apotheker aan om eerdere oordelen over te nemen voor regels die in beide versies staan.

## Eenmalige inrichting

### 1. GitHub Pages aanzetten
In deze repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Na de volgende wijziging, of via *Actions → Testen en publiceren → Run workflow*, staat de app online.

### 2. Supabase (de gedeelde database)
1. Maak een gratis account op https://supabase.com en een nieuw project. Kies als regio **Central EU (Frankfurt)**. Bewaar het databasewachtwoord dat je kiest; de app gebruikt het niet.
2. **SQL Editor → New query:** plak de inhoud van [`supabase/schema.sql`](supabase/schema.sql) en klik **Run**.
3. **Table Editor → panel → Insert row:** voeg per apotheker een regel toe met:
   - `email`, in kleine letters;
   - `naam`;
   - `beoordelaar` (true/false);
   - `coordinator` (true/false). Zet dit op true voor wie coördineert.
4. **Authentication → URL Configuration:**
   - *Site URL*: het adres van de app, precies zoals GitHub het toont bij *Settings → Pages* (waarschijnlijk `https://agjan0612.github.io/Levertekorten/`);
   - voeg bij *Redirect URLs* hetzelfde adres toe.
5. Optioneel: **Authentication → Emails → Magic Link** om de tekst van de inlogmail in het Nederlands te zetten. Laat `{{ .ConfirmationURL }}` staan als link.
6. **Project Settings → API:** kopieer de *Project URL* en de *anon public* sleutel naar [`js/config.js`](js/config.js). De anon-sleutel is bedoeld om in een webpagina te staan; wie wat mag, regelt de database.

Zolang `js/config.js` leeg is, draait de app in **proefmodus**. Je kiest dan een proefapotheker, en alles blijft alleen in je eigen browser. Zo kun je de app al uitproberen.

## Bekende beperkingen

- **Pauzeren:** een gratis Supabase-project wordt na ongeveer een week zonder gebruik gepauzeerd. Herstel het dan in het Supabase-dashboard (*Restore project*). De gegevens blijven bewaard.
- **Inlogmails:** de ingebouwde e-mail van Supabase verstuurt maar een paar inlogmails per uur. Iedereen blijft lang ingelogd, dus in de praktijk is dat genoeg. Lukt het niet, probeer het dan na een paar minuten opnieuw.
- **Openbare gegevens:** de lijst en de Z-index staan openbaar in deze repository en op de site. De oordelen, namen en e-mailadressen staan alleen in de database.
- **De coördinator ziet alles:** wie coördinator is, kan de oordelen van iedereen lezen, ook als die persoon zelf beoordeelt.

## Voor ontwikkelaars

- `js/kern.js`: rekenlogica (inlezen van de Excel, consensus, laadbestand). Draait in de browser én in Node.
- `js/opslag.js`: opslag via Supabase, of de proefmodus in de browser.
- `js/app.js`: de schermen.
- `tools/bouw-data.js`: zet `invoer/*.xlsx` om naar `data/*.json`.
- `supabase/schema.sql`: de tabellen en de toegangsregels.

Tests:
- `npm test`: rekenlogica.
- `npm run test:rls`: toegangsregels tegen een lokale PostgreSQL.
- `npm run test:browser`: de hele werkwijze met drie apothekers tegen een nagebootste Supabase. Vereist Playwright.
