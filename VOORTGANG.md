# Voortgang – Beoordelingsapp alternatieven (Project Levertekorten)

*Stand: 8 oktober 2026, middag. Dit document is bedoeld om in een nieuwe sessie verder te bouwen. Lees ook `CLAUDE.md` (technische richtlijnen) en `README.md` (werkwijze voor de gebruikers).*

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
| 6 | GitHub Pages aangezet, Supabase URL-instelling gedaan, panel (3 apothekers) in de database gezet; eerste publicatie geslaagd | Gedaan (7 okt) |
| 7 | UI-analyse met screenshots (Playwright); drie ontwerpopties voor het beoordelaarsscherm gemaakt; opdrachtgever koos **optie B: stap voor stap** | Gedaan (7 okt) |
| 8 | Optie B gebouwd en live gezet via [PR #1](https://github.com/Agjan0612/Levertekorten/pull/1) (samengevoegd in `main`, gepubliceerd) | Gedaan (7 okt) |
| 9 | Handleidingen (beoordelaars en coördinator) in Word en HTML, met screenshots, aan de opdrachtgever geleverd | Gedaan (7 okt); op 8 okt bijgewerkt voor het nieuwe inloggen en in de repository gezet (`handleidingen/`, zonder panelnamen) |
| 10 | Risicoanalyse: twee blokkades voor het inloggen gevonden (eigen mailservice nodig, inlogcode i.p.v. alleen link) | Mailservice **opgelost** (7 okt, Brevo, zie §5); inlogcode nog open (zie §7) |
| 11 | Inlogcode + "klik eerst"-knop gebouwd en live gezet via [PR #3](https://github.com/Agjan0612/Levertekorten/pull/3); Nederlandse mailsjablonen in Supabase ingesteld; met de echte inlogmail getest (code én knop) | Gedaan (7–8 okt) |
| 12 | De eerste echte inlogtest met het panel | **Open** |

## 3. Genomen besluiten

**Werkwijze en beoordeling**
- **Beoordelaarsscherm (7 okt, live):** standaard *stap voor stap*: één tekort per scherm, grote knoppen, onderaan *Volgende tekort* / *Overslaan, later doen* en *Vorige*. Start bij het eerste open tekort; *Volgende* slaat tekorten over die al af zijn. Korte uitleg bij de eerste keer, een eindscherm "Klaar". De oude lijst (met filters en tabbladen) blijft bereikbaar via *Lijst van alle tekorten*; de keuze wordt per browser onthouden (`lt:modus`). Back-up/Excel staan onder *Meer*. Categorieën in gewone taal (code in de tooltip). Ontwerpopties: https://claude.ai/artifact/CiqMq9fee5AFEPkMa4PJQW (privé). Ook: voorraadklasse als "Voorraad Mosadex: …", toelichting pas na een keuze (direct open bij Niet akkoord/Bespreken), op de telefoon scrollen kop- en filterbalk mee.
- **Tekorten zonder alternatief** zitten niet in de stapweergave; die staan in de lijstweergave (tabblad *Geen alternatief*), bereikbaar vanaf het eindscherm.
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
- **Handleidingen** (Word + HTML, beoordelaars en coördinator) staan sinds 8 okt in `handleidingen/`; de HTML-versies staan ook online naast de app (`https://agjan0612.github.io/Levertekorten/handleidingen/Handleiding_beoordelaars_levertekorten.html`). De panelnamen zijn eruit gehaald (de repository is openbaar); de coördinatorhandleiding verwijst naar de tabel `panel` in Supabase. Bijgewerkt op 8 okt: inloggen met knop en code (hoofdstuk 2 beoordelaars, 4 nieuwe schermafbeeldingen) en een paragraaf "De inlogmail: hoe het is ingericht" (coördinator, hoofdstuk 10).

**Werkwijze met Claude**
- Claude werkt op een eigen branch (`claude/…`). Online komt het pas na samenvoegen in `main` (pull request). Dat gebeurt alleen na akkoord van de opdrachtgever; daarna publiceert GitHub de app vanzelf.

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
| GitHub Pages | Aan (Source: GitHub Actions). Adres: `https://agjan0612.github.io/Levertekorten/` |
| Supabase | Organisatie "Levertekorten", project `levertekorten`, ref `obmjttyruqyqprulojbv`, regio Frankfurt (eu-central-1), gratis plan |
| Inlogmail (SMTP) | Via **Brevo**, het account van de MBO-app van de opdrachtgever (gratis plan, 300 mails per dag, gedeeld met de MBO-app). Afzender `Levertekorten <levertekorten@mbo-app.nl>`; het domein mbo-app.nl is bij Brevo geauthenticeerd (DKIM + DMARC). Host `smtp-relay.brevo.com`, poort 587, eigen SMTP-sleutel "Supabase Levertekorten" (los van de MBO-app; staat alleen in Supabase). Maillimiet in Supabase: 30 per uur. Ingesteld 7 okt. |
| Supabase-URL | `https://obmjttyruqyqprulojbv.supabase.co` (staat in `js/config.js`) |
| Sleutel in de app | *publishable* sleutel (bedoeld als openbaar). De service-role-sleutel staat nergens en hoort er ook niet. |
| Database | 5 tabellen (`panel`, `oordelen`, `voorstellen`, `besluiten`, `coordinatie`), 11 toegangsregels, live bijwerken aan voor 4 tabellen. Getest in de echte database (blind, coördinator ziet alles, geen toegang zonder inlog). |
| Advisors | 3 bewuste waarschuwingen over SECURITY DEFINER-functies (zie `CLAUDE.md`) |

**Let op bij de Supabase-connector:** SQL met `drop …`, `delete …` en `apply_migration` liepen vast (time-out). In kleine stukken via `execute_sql`, zonder `drop`/`delete`, lukt het wel; wissen doet de opdrachtgever in de SQL Editor. De connector kan ook geen Auth-instellingen (SMTP, mailsjablonen) wijzigen: dat gaat via het dashboard.

**Supabase Auth:** naast het panel staat er één extra inlogaccount (een tweede adres van de opdrachtgever, gebruikt bij de eerste mailtest, niet op de panellijst). Onschuldig: zonder panelregel ziet dat account niets.

## 6. Tests (laatste stand: alles geslaagd)

- `node --test tests/kern.test.js`: 7 tests, onder meer alle 64 combinaties van drie oordelen en het formaat van het laadbestand.
- `tests/rls/draai.sh`: 23 controles van de toegangsregels in PostgreSQL. Draait ook op GitHub bij elke wijziging.
- `node tests/e2e/gedeeld.js`: 54 controles van de hele werkwijze in de browser met drie apothekers (ook op GitHub groen bij PR #1, #3 en #4). Onder meer: inloggen (code, knop uit de mail, "Ik heb al een inlogcode"), live bijwerken, eindbesluit, laadbestand, werken zonder verbinding, herladen en uitloggen, en de stapweergave.
- **Met de echte Supabase en Brevo** (7–8 okt, adressen van de opdrachtgever): inlogmail komt aan (bij ncontrol na ~2 minuten), inloggen met de oude link, met de **code** en via de **knop** geslaagd; geen vooraf geopende link door een mailscanner gezien. Oefenen met beoordelen werkte (48 oordelen opgeslagen); die zijn gewist, alle tabellen zijn leeg.
- Nog niet getest: inloggen door de andere twee panelleden (andere mailservers), en de echte gepubliceerde lijst `alternatieve-prk-regels-20260916.csv` (het formaat is getest met een nagemaakte versie). Vanuit Claude's omgeving is `github.io` niet bereikbaar; controleren gaat via de status van de workflow.

## 7. Openstaande punten

**A. Blokkades vóór het panel de link krijgt — opgelost (7–8 okt)**
1. ~~Eigen mailservice (SMTP).~~ Gedaan via Brevo, zie §5. Aandachtspunten:
   - De Brevo-SMTP-sleutel vervalt na **1 jaar (7 okt 2027)** en ook na **90 dagen zonder gebruik** (kan gebeuren tussen rondes). Dan komen er geen inlogmails meer. Oplossing: in Brevo (⚙️ → SMTP & API → SMTP) een nieuwe sleutel maken en die in Supabase → Authentication → Emails → SMTP Settings als *Password* plakken. Bestaande afzenders/sleutels van de MBO-app niet aanraken; in Brevo **niet** "Activate for SMTP keys" (IP-blokkade) aanzetten.
   - Later eventueel een netter afzenderdomein (bijv. van Mosadex): alleen de SMTP-instellingen in Supabase wijzigen, de app zelf niet.
2. ~~Inloggen met een code.~~ Gedaan (live 7 okt via PR #3, getest 8 okt). Link en code zijn bij Supabase **hetzelfde eenmalige inlogbewijs**; een vooraf geopende `{{ .ConfirmationURL }}` maakt ook de code ongeldig. Daarom:
   - de knop in de mail gaat naar de app met `?inlog={{ .TokenHash }}`; de app logt pas in na een klik op *Inloggen* (`verifyOtp({token_hash, type: 'email'})`);
   - daaronder de code `{{ .Token }}` (`verifyOtp({email, token, type: 'email'})`); het adres wordt 1 uur onthouden (localStorage `lt:inlog`), "Ik heb al een inlogcode" werkt ook in een andere browser;
   - mailsjabloon `supabase/inlogmail.html`, onderwerp *Inloggen: beoordeling alternatieven*, ingesteld in **beide** sjablonen *Confirm signup* (nieuwe gebruikers) en *Magic Link* (bestaande gebruikers).
3. ~~Handleidingen bijwerken.~~ Gedaan (8 okt, PR #4), zie §3.

**B. Daarna samen**
3. **Panel uitnodigen (volgende stap).** De opdrachtgever stuurt de andere twee panelleden een mail met de link, de inloguitleg en de beoordelaarshandleiding (bijlage of online link). Een kant-en-klare tekst is op 8 okt in de chat opgesteld (onderwerp "Beoordelingspanel levertekorten: de app staat klaar"; datums nog in te vullen). Mail naar de adressen op de panellijst. Daarna kijkt Claude in `auth_logs` of hun inlog lukt (vooral: openen hun mailscanners de knop vooraf?).
3a. Eerste echte ronde: oordelen van meerdere apothekers, Coördineren (Bespreken, Voorstellen), laadbestand en logboek controleren.
4. Testen met de echte gepubliceerde lijst van 16-09, zodra de opdrachtgever die aanlevert.
5. **Vraag aan de opdrachtgever:** voegt OA een laadbestand *toe* aan de bestaande tabel, of *vervangt* het die? Bij vervangen zijn alle bestaande adviezen weg als de gepubliceerde lijst niet is geladen (de app waarschuwt wel).

**C. Bekende beperkingen (gevonden 7 okt), later oplossen**
- **Pauzeren:** gratis project pauzeert na ~7 dagen zonder gebruik, dus zeker tussen rondes. Voorstel: GitHub Action (cron) die elke paar dagen de database aanroept (ongeveer een uur werk; op 8 okt besproken, opdrachtgever wilde eerst handleidingen en panelmail). Herstellen kan via het dashboard of `restore_project`. NB: beoordelaars blijven wel ingelogd na een lange pauze (de sessie verloopt op het gratis plan niet vanzelf); alleen een andere browser/computer, wissen van browsergegevens of uitloggen vraagt een nieuwe inlogmail.
- **Back-ups:** op het gratis plan zijn database-back-ups niet te downloaden. Advies aan de coördinator: knop *Back-up* na elk overleg en vóór elke publicatie.
- **Nieuwe lijstversie halverwege een ronde:** oordelen kunnen per beoordelaar worden overgenomen (alleen als die in de nieuwe versie nog niets heeft), maar **besluiten** (Bespreken/Voorstellen) en de geladen **gepubliceerde lijst** gaan niet mee (gekoppeld aan de vingerafdruk van de bron). Advies: lijst niet wijzigen tijdens een ronde; anders meenemen van besluiten bouwen.
- **Panelwijziging:** iemand uit `panel` halen ⇒ diens oordelen tellen niet meer mee. Met een **vierde** beoordelaar kan het 2–2 worden; `consensus()` in `js/kern.js` geeft dan *Akkoord* (telt akkoord eerst). Eerst aanpassen als het panel groeit.
- **Openbare inlogpagina:** `shouldCreateUser: true`; iedereen kan een inlogmail aanvragen (komt niet verder dan "niet op de panellijst", RLS houdt alles tegen) en zo de maillimiet opmaken. Oplossing: CAPTCHA of aanmelden dichtzetten zodra het panel compleet is.
- **Gedeelde/beheerde werkplekken** die browsergegevens wissen: elke keer opnieuw inloggen (kost een mail), en wijzigingen die offline in de wachtrij staan blijven in die ene browser.
- Kleiner: na een update tot ~10 min de oude versie (Ctrl+F5); een andere opbouw van de Excel laat het publiceren mislukken (oude lijst blijft online, GitHub mailt); voor de AVG biedt Supabase standaard een verwerkersovereenkomst (data in Frankfurt).

**D. Overige ideeën**
- Coördinatorscherm: zichtbare knop "besluit wissen" (nu: nogmaals klikken), categorie-keuzelijst bij Voorstellen breder, kleine grijze tekst iets donkerder.
- **Gegevens:** twee gepubliceerde alternatieven bij PRK 133612 (PRK 49026 en 49034, prednisolon drank) staan niet meer in de Z-index. Het panel zal die waarschijnlijk afwijzen.
- **GitHub Actions:** waarschuwing dat Node 20 verouderd is. Later de actions bijwerken.

## 8. Verder in een nieuwe sessie

Start een sessie met de repository **Levertekorten**, met de Supabase-connector aan, en begin bijvoorbeeld met:

> Lees VOORTGANG.md en CLAUDE.md. Ik heb de panelleden de link gestuurd [of: nog niet]. Kijk in de logboeken of zij al hebben ingelogd en of dat goed ging. Daarna gaan we verder met §7B (eerste echte ronde) of §7C (pauzeren voorkomen).
