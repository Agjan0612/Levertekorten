# Voortgang – Beoordelingsapp alternatieven (Project Levertekorten)

*Stand: 7 oktober 2026, avond. Dit document is bedoeld om in een nieuwe sessie verder te bouwen. Lees ook `CLAUDE.md` (technische richtlijnen) en `README.md` (werkwijze voor de gebruikers).*

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
| 9 | Handleidingen (beoordelaars en coördinator) in Word en HTML, met screenshots, aan de opdrachtgever geleverd | Gedaan (7 okt), bewust **niet** in de repository (zie §3) |
| 10 | Risicoanalyse: twee blokkades voor het inloggen gevonden (eigen mailservice nodig, inlogcode i.p.v. alleen link) | Mailservice **opgelost** (7 okt, Brevo, zie §5); inlogcode nog open (zie §7) |
| 11 | De eerste echte inlogtest met het panel | **Open**: pas na punt 10 |

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
- **Handleidingen** (Word + HTML, beoordelaars en coördinator) staan niet in de repository: de coördinatorhandleiding noemt de panelnamen en de repository is openbaar. De opdrachtgever heeft de bestanden. Opnieuw maken kan met dezelfde aanpak als de screenshots (zie `CLAUDE.md`).

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

**Let op bij de Supabase-connector:** SQL met `drop …` en `apply_migration` liepen vast (time-out). In kleine stukken via `execute_sql`, zonder `drop`, lukt het wel.

## 6. Tests (laatste stand: alles geslaagd)

- `node --test tests/kern.test.js`: 7 tests, onder meer alle 64 combinaties van drie oordelen en het formaat van het laadbestand.
- `tests/rls/draai.sh`: 23 controles van de toegangsregels in PostgreSQL. Draait ook op GitHub bij elke wijziging.
- `node tests/e2e/gedeeld.js`: 42 controles (ook op GitHub groen bij de publicatie van PR #1) van de hele werkwijze in de browser met drie apothekers. Onder meer: live bijwerken, eindbesluit, laadbestand, werken zonder verbinding, herladen en uitloggen, en de stapweergave (Volgende/Overslaan/Vorige, uitleg, toelichting, menu Meer).
- Inlogmail via Brevo getest op 7 okt op twee zakelijke adressen van de opdrachtgever (o.a. het ncontrol-adres op de panellijst): mail aangekomen (bij ncontrol na ~2 minuten), link werkte, inloggen gelukt. Geen voorafgaande klik door een mailscanner gezien. De opdrachtgever heeft daarna geoefend met beoordelen (48 oordelen, goed opgeslagen); die oefenoordelen zijn gewist, alle tabellen zijn weer leeg. Nog niet getest bij de andere twee panelleden. De site zelf staat live; vanuit Claude's omgeving is `github.io` niet bereikbaar, dus controleren gaat via de status van de workflow. Ook nog niet getest: de echte gepubliceerde lijst `alternatieve-prk-regels-20260916.csv` (het formaat is getest met een nagemaakte versie).

## 7. Openstaande punten

**A. Eerst oplossen, vóór de beoordelaars de link krijgen (blokkades)**
1. ~~**Eigen mailservice (SMTP) koppelen.**~~ **Gedaan (7 okt)** via Brevo, zie §5. Aandachtspunten:
   - De Brevo-SMTP-sleutel vervalt na **1 jaar (7 okt 2027)** en ook na **90 dagen zonder gebruik** (kan gebeuren tussen rondes). Dan komen er geen inlogmails meer. Oplossing: in Brevo (⚙️ → SMTP & API → SMTP) een nieuwe sleutel maken en die in Supabase → Authentication → Emails → SMTP Settings als *Password* plakken. Bestaande sleutels en de API-sleutel van de MBO-app niet aanraken; in Brevo **niet** "Activate for SMTP keys" (IP-blokkade) aanzetten, want Supabase mailt vanaf wisselende adressen.
   - Later eventueel een netter afzenderdomein (bijv. van Mosadex): alleen de SMTP-instellingen in Supabase wijzigen, de app zelf niet.
2. **Inloggen met een 6-cijferige code** naast de link. Zakelijke mailboxen (Microsoft 365 / Defender) klikken links vooraf aan om ze te controleren; een inloglink werkt maar één keer, dus daarna krijgt de gebruiker "link is invalid or has expired" (door Supabase zelf genoemd als meest voorkomende oorzaak). Bouwen: invoerveld voor de code + `verifyOtp` in `js/opslag.js`, mailsjabloon met `{{ .Token }}` (Nederlandse tekst, link mag blijven).
Uit de logboeken (7 okt, avond): inloggen via Brevo geslaagd op twee adressen van de opdrachtgever; de link werd niet vooraf "opgebruikt". Punt 2 is daardoor minder dringend, maar blijft een vangnet voor de adressen van de andere panelleden. Meenemen: bij "Er is een inloglink gestuurd" vermelden dat het een paar minuten kan duren.

**B. Daarna samen**
3. De eerste echte test: inloggen (met code), oordelen geven, tweede apotheker, Coördineren, laadbestand. Daarna de proefoordelen wissen (via `execute_sql`) zodat het panel leeg begint.
4. Testen met de echte gepubliceerde lijst van 16-09, zodra de opdrachtgever die aanlevert.
5. **Vraag aan de opdrachtgever:** voegt OA een laadbestand *toe* aan de bestaande tabel, of *vervangt* het die? Bij vervangen zijn alle bestaande adviezen weg als de gepubliceerde lijst niet is geladen (de app waarschuwt wel).

**C. Bekende beperkingen (gevonden 7 okt), later oplossen**
- **Pauzeren:** gratis project pauzeert na ~7 dagen zonder gebruik, dus zeker tussen rondes. Voorstel: GitHub Action (cron) die elke paar dagen de database aanroept. Herstellen kan via het dashboard of `restore_project`.
- **Back-ups:** op het gratis plan zijn database-back-ups niet te downloaden. Advies aan de coördinator: knop *Back-up* na elk overleg en vóór elke publicatie.
- **Nieuwe lijstversie halverwege een ronde:** oordelen kunnen per beoordelaar worden overgenomen (alleen als die in de nieuwe versie nog niets heeft), maar **besluiten** (Bespreken/Voorstellen) en de geladen **gepubliceerde lijst** gaan niet mee (gekoppeld aan de vingerafdruk van de bron). Advies: lijst niet wijzigen tijdens een ronde; anders meenemen van besluiten bouwen.
- **Panelwijziging:** iemand uit `panel` halen ⇒ diens oordelen tellen niet meer mee. Met een **vierde** beoordelaar kan het 2–2 worden; `consensus()` in `js/kern.js` geeft dan *Akkoord* (telt akkoord eerst). Eerst aanpassen als het panel groeit.
- **Openbare inlogpagina:** `shouldCreateUser: true`; iedereen kan een inloglink aanvragen (komt niet verder dan "niet op de panellijst", RLS houdt alles tegen) en zo de maillimiet opmaken. Oplossing: CAPTCHA of aanmelden dichtzetten zodra het panel compleet is.
- **Gedeelde/beheerde werkplekken** die browsergegevens wissen: elke keer opnieuw inloggen (kost een mail), en wijzigingen die offline in de wachtrij staan blijven in die ene browser.
- Kleiner: na een update tot ~10 min de oude versie (Ctrl+F5); een andere opbouw van de Excel laat het publiceren mislukken (oude lijst blijft online, GitHub mailt); voor de AVG biedt Supabase standaard een verwerkersovereenkomst (data in Frankfurt).

**D. Overige ideeën**
- Nederlandse inlogmail (komt mee met punt A2).
- Coördinatorscherm: zichtbare knop "besluit wissen" (nu: nogmaals klikken), categorie-keuzelijst bij Voorstellen breder, kleine grijze tekst iets donkerder.
- **Gegevens:** twee gepubliceerde alternatieven bij PRK 133612 (PRK 49026 en 49034, prednisolon drank) staan niet meer in de Z-index. Het panel zal die waarschijnlijk afwijzen.
- **GitHub Actions:** waarschuwing dat Node 20 verouderd is. Later de actions bijwerken.

## 8. Verder in een nieuwe sessie

Start een sessie met de repository **Levertekorten**, met de Supabase-connector aan, en begin bijvoorbeeld met:

> Lees VOORTGANG.md en CLAUDE.md. We gaan verder bij de openstaande punten, te beginnen met §7A (eigen mailservice en inlogcode). [Vermeld wat je al hebt gedaan, bijvoorbeeld: "Ik heb een account bij Resend aangemaakt."]
