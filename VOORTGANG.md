# Voortgang – Beoordelingsapp alternatieven (Project Levertekorten)

*Stand: 7 oktober 2026. Dit document is bedoeld om in een nieuwe sessie verder te bouwen. Lees ook `CLAUDE.md` (technische richtlijnen) en `README.md` (werkwijze voor de gebruikers).*

## 1. Doel

Bij een levertekort toont Optimaal Aanschrijven (OA) apotheken een advies voor een alternatief product. Een panel van apothekers beoordeelt de voorgestelde alternatieven. Alleen alternatieven waar het panel het over eens is, komen in het OA-laadbestand.

Wens van de opdrachtgever: iedere apotheker drukt op een link en beoordeelt zelfstandig. De app voegt de oordelen automatisch samen, zodat er geen lijsten meer naast elkaar gelegd hoeven te worden.

## 2. Hoe we hier kwamen (korte geschiedenis)

| Stap | Wat | Status |
|---|---|---|
| 1 | Eén HTML-bestand dat lokaal werkt: twee beoordelaars exporteren een JSON-bestand en de coördinator voegt die samen | Gebouwd en getest. Staat als losse bestanden bij de opdrachtgever, niet in deze repository. Blijft bruikbaar als terugvaloptie. |
| 2 | Getest met de echte Z-index; controle per alternatief toegevoegd (toedieningsweg, PRK niet meer in de Z-index, naamverschil) | Gedaan |
| 3 | Toelichting optioneel gemaakt; bestanden ingebouwd in het HTML-bestand | Gedaan (in de losse versie) |
| 4 | Gekozen voor een **gedeelde webapp**: GitHub Pages voor de link, Supabase voor de gedeelde opslag. Een gedeelde map of claude.ai viel af (zie §3). | Gebouwd: deze repository |
| 5 | Supabase-project aangemaakt en ingericht via de Supabase-connector, en de app eraan gekoppeld | Gedaan |
| 6 | Publiceren op GitHub Pages en de eerste echte inlogtest | **Open** (zie §7) |

## 3. Genomen besluiten

**Werkwijze en beoordeling**
- **Eindoordeel:** minimaal **twee apothekers moeten het eens zijn** (`MIN_EENS = 2` in `js/kern.js`).
  - Minimaal twee keer Akkoord → **Akkoord**.
  - Minimaal twee keer Niet akkoord → **Afgewezen**.
  - Wel minimaal twee oordelen, maar geen twee gelijke (of Bespreken) → **Bespreken**.
  - Minder dan twee oordelen → **Onvolledig**.
  - Een eindoordeel met een afwijkende stem wordt gemarkeerd ("afwijkend oordeel").
- **Panel:** drie apothekers, en de opdrachtgever is zowel beoordelaar als coördinator. Namen en e-mailadressen staan alleen in de database (tabel `panel`), **niet** in deze openbare repository.
- **Blind beoordelen:** ieder ziet alleen zijn eigen oordelen; de database dwingt dat af. De coördinator ziet alles, ook als die zelf beoordeelt. De app raadt aan om eerst zelf te beoordelen.
- **Toelichting:** altijd optioneel, ook bij Niet akkoord en bij eigen voorstellen.
- **Eigen voorstellen:**
  - Een voorstel gaat nooit vanzelf in het laadbestand. De coördinator neemt het aan, met categorie en positie.
  - Hetzelfde PRK voorgesteld door minimaal twee apothekers → "gezamenlijk voorstel".

**Laadbestand**
- **Stofnamen** neemt de app letterlijk over uit de Excel, ook als ze afwijken van de Generiek-kolom in de Z-index (22 regels van "Al gepubliceerd (16-09)"). De opdrachtgever koos ervoor dat zo te laten.
- **Laadbestand:** precies `AdviesPrk;AdviesPrkNaam;AlternatiefPrk;AlternatiefPrkNaam;Categorie`, UTF-8 zonder BOM, CRLF, alleen eindstatus Akkoord.
  - Gesorteerd per AdviesPrk, daarbinnen in cascadevolgorde.
  - Met een gepubliceerde lijst erbij: per tekort eerst de bestaande regels, daarna de nieuwe, zonder dubbelingen.
  - Gepubliceerde adviezen die het panel nu afwijst, blijven standaard staan. Een vinkje haalt ze eruit.

**Gegevens**
- De lijst met tekorten en de Z-index mogen openbaar staan (toestemming van de opdrachtgever). De oordelen, namen en e-mailadressen niet.
- Een nieuwe lijst of Z-index zet je in `invoer/`. Een nieuwe versie van de lijst krijgt eigen oordelen; de app biedt aan om eerdere oordelen over te nemen voor regels die in beide versies staan.

## 4. Opbouw

```
index.html, css/app.css     – de pagina
js/kern.js                  – rekenlogica (Excel inlezen, consensus, laadbestand); browser + Node
js/opslag.js                – Supabase (inloggen per e-mail, wachtrij bij geen verbinding, live bijwerken) of proefmodus
js/app.js                   – schermen: inloggen, beoordelen, coördineren
js/config.js                – Supabase-URL en publishable sleutel
supabase/schema.sql         – tabellen + toegangsregels (RLS)
invoer/*.xlsx → tools/bouw-data.js → data/bron.json, data/zindex.json
.github/workflows/publiceren.yml – omzetten, testen (ook RLS), publiceren naar Pages
tests/                      – kern.test.js, rls/ (PostgreSQL), e2e/ (Playwright + nagebootste Supabase)
vendor/                     – SheetJS 0.18.5, supabase-js 2.117.2 (lokaal, geen CDN)
```

## 5. Infrastructuur

| Onderdeel | Gegevens |
|---|---|
| GitHub | `Agjan0612/Levertekorten` (openbaar), branch `main` |
| GitHub Pages | Moet nog aan: Settings → Pages → Source: **GitHub Actions**. Adres daarna: `https://agjan0612.github.io/Levertekorten/` |
| Supabase | Organisatie "Levertekorten", project `levertekorten`, ref `obmjttyruqyqprulojbv`, regio Frankfurt (eu-central-1), gratis plan |
| Supabase-URL | `https://obmjttyruqyqprulojbv.supabase.co` (staat in `js/config.js`) |
| Sleutel in de app | *publishable* sleutel (bedoeld als openbaar). De service-role-sleutel staat nergens en hoort er ook niet. |
| Database | 5 tabellen (`panel`, `oordelen`, `voorstellen`, `besluiten`, `coordinatie`), 11 toegangsregels, live bijwerken aan voor 4 tabellen. Getest in de echte database (blind, coördinator ziet alles, geen toegang zonder inlog). |
| Advisors | 3 bewuste waarschuwingen over SECURITY DEFINER-functies (zie `CLAUDE.md`) |

**Let op bij de Supabase-connector:** SQL met `drop …` en `apply_migration` liepen vast (time-out). In kleine stukken via `execute_sql`, zonder `drop`, lukt het wel.

## 6. Tests (laatste stand: alles geslaagd)

- `node --test tests/kern.test.js`: 7 tests, onder meer alle 64 combinaties van drie oordelen en het formaat van het laadbestand.
- `tests/rls/draai.sh`: 23 controles van de toegangsregels in PostgreSQL. Draait ook op GitHub bij elke wijziging.
- `node tests/e2e/gedeeld.js`: 26 controles van de hele werkwijze in de browser met drie apothekers. Onder meer: live bijwerken, eindbesluit, laadbestand, werken zonder verbinding, herladen en uitloggen.
- Nog niet getest: de echte inlogmail en GitHub Pages, omdat die nog niet aanstonden. Ook nog niet getest: de echte gepubliceerde lijst `alternatieve-prk-regels-20260916.csv` (het formaat is getest met een nagemaakte versie).

## 7. Openstaande punten

**Voor de opdrachtgever (handmatig)**
1. **GitHub Pages aanzetten:** https://github.com/Agjan0612/Levertekorten/settings/pages → Source: *GitHub Actions*. Draai daarna de workflow opnieuw (Actions → *Testen en publiceren* → *Run workflow*), of wacht op de volgende wijziging.
2. **Supabase URL-instelling:** https://supabase.com/dashboard/project/obmjttyruqyqprulojbv/auth/url-configuration
   - *Site URL* = `https://agjan0612.github.io/Levertekorten/`;
   - hetzelfde adres toevoegen bij *Redirect URLs*.
3. **E-mailadressen van de drie panelleden aanleveren.** Die zet Claude via de connector in de tabel `panel`, en niet in de repository.

**Daarna samen**
4. De eerste echte test:
   - inloggen via de e-maillink;
   - een oordeel geven;
   - een tweede apotheker laten beoordelen;
   - wisselen naar Coördineren en de uitkomst controleren;
   - een laadbestand maken.
5. Optioneel: de inlogmail in het Nederlands (Supabase → Authentication → Emails → Magic Link; laat `{{ .ConfirmationURL }}` staan).
6. Testen met de echte gepubliceerde lijst van 16-09, zodra de opdrachtgever die aanlevert.

**Ideeën en aandachtspunten voor later**
- **Gegevens:** twee gepubliceerde alternatieven bij PRK 133612 (PRK 49026 en 49034, prednisolon drank) staan niet meer in de Z-index. Het panel zal die waarschijnlijk afwijzen.
- **Inlogmails:** de ingebouwde mailservice van Supabase verstuurt maar een paar mails per uur. Bij problemen een eigen SMTP-dienst instellen.
- **Pauzeren:** een gratis project pauzeert na ongeveer een week zonder gebruik. Herstellen kan via het dashboard of `restore_project`.
- **GitHub Actions:** geeft een waarschuwing dat Node 20 verouderd is. Later de actions bijwerken naar nieuwere versies.

## 8. Verder in een nieuwe sessie

Start een sessie met de repository **Levertekorten**, met de Supabase-connector aan, en begin bijvoorbeeld met:

> Lees VOORTGANG.md en CLAUDE.md. We gaan verder bij de openstaande punten. [Vermeld wat je al hebt gedaan, bijvoorbeeld: "Pages en de URL-instelling in Supabase staan aan."] De e-mailadressen van het panel zijn: …
