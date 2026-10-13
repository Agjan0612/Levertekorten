# Voortgang – Beoordelingsapp alternatieven (Project Levertekorten)

*Stand: 13 oktober 2026. Dit document is bedoeld om in een nieuwe sessie verder te bouwen. Lees ook `CLAUDE.md` (technische richtlijnen) en `README.md` (werkwijze voor de gebruikers).*

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
| 9 | Handleidingen (beoordelaars en coördinator) in Word en HTML, met screenshots, aan de opdrachtgever geleverd | Gedaan (7 okt); op 8 okt bijgewerkt voor het nieuwe inloggen en in de repository gezet (`handleidingen/`); 8 okt middag nieuwe schermafbeeldingen met verzonnen namen ([PR #5](https://github.com/Agjan0612/Levertekorten/pull/5)) |
| 10 | Risicoanalyse: twee blokkades voor het inloggen gevonden (eigen mailservice nodig, inlogcode i.p.v. alleen link) | Beide **opgelost** (7–8 okt, zie §5 en §7A) |
| 11 | Inlogcode + "klik eerst"-knop gebouwd en live gezet via [PR #3](https://github.com/Agjan0612/Levertekorten/pull/3); Nederlandse mailsjablonen in Supabase ingesteld; met de echte inlogmail getest (code én knop) | Gedaan (7–8 okt) |
| 12 | Coördinatorscherm gebruiksvriendelijker (punten 7–11 uit de UI-analyse van 7 okt): zichtbare knop *Besluit wissen*, categorieën in gewone taal (ook bij Voorstellen), paneltegels markeren wie het verst achterloopt met een knop *Herinnering mailen* (mailto, verstuurt niets zelf), uitleg bij *Back-up* (tooltip, melding, blok in Export), grijze tekst donkerder | Live 8 okt via [PR #5](https://github.com/Agjan0612/Levertekorten/pull/5) |
| 13 | Database wakker houden: functie `wakker()` (alleen `true`, voor anon) en workflow *Database wakker houden* die hem elke drie dagen aanroept | Live 8 okt via [PR #6](https://github.com/Agjan0612/Levertekorten/pull/6); functie staat in de echte database; eerste (handmatige) run groen, aanroep zichtbaar in de logboeken van Supabase |
| 14 | Uitnodiging aan de twee andere panelleden (link, inlogstappen, link naar de online handleiding) als concept in de Gmail van de opdrachtgever gezet | Gedaan 8 okt; **nog niet verstuurd** (de opdrachtgever vult eerst twee datums in) |
| 15 | De eerste echte inlogtest met het panel | **Open** |
| 16 | Laadbestand aangepast: OA **voegt toe** aan de bestaande tabel (antwoord opdrachtgever 11 okt). Het laadbestand bevat nu alleen de nieuwe regels; daarnaast een *volledige lijst* voor de volgende ronde. 12 okt: OA kan **geen regels verwijderen**, dus het lijstje *te verwijderen regels* en het vinkje zijn er weer uit; afgewezen gepubliceerde adviezen blijven in OA en in de volledige lijst, de app meldt ze alleen. De samenvatting waarschuwt het bestand goed te controleren. Handleiding coördinator (hoofdstuk 7, afbeeldingen 7–9) bijgewerkt | Live 12 okt via [PR #8](https://github.com/Agjan0612/Levertekorten/pull/8) |
| 17 | Regels die al in OA staan (niveau "Al gepubliceerd (16-09)", 44 regels) worden **niet meer beoordeeld**: alleen ter informatie zichtbaar ("✓ Staat al in OA", zonder knoppen), status *Staat al in OA*, tellen niet mee (nu 255 te beoordelen i.p.v. 299). Nieuwe alternatieven bij die tekorten (65 regels bij 29 tekorten) worden wel beoordeeld en aangevuld. *Volgende tekort* slaat tekorten over waar alles al in OA staat (5 tekorten). Handleidingen bijgewerkt | Live 12 okt via [PR #8](https://github.com/Agjan0612/Levertekorten/pull/8) (samen met stap 16) |
| 18 | Tabblad **Opzoeken** in het coördinatorscherm (aanleiding: vraag per mail of tramadol druppels en Xarelto suspensie in de lijst zitten). Zoekt op naam, merknaam, PRK of ZI (via de Z-index) in de huidige lijst (tekort/alternatief, stand van het panel, voorstellen) en in de gepubliceerde lijst (advies in OA / alternatief in OA). `opzoeken()` in `js/kern.js` | Live 12 okt via [PR #10](https://github.com/Agjan0612/Levertekorten/pull/10) |

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
  - **OA voegt het laadbestand toe aan de bestaande tabel** (bevestigd door de opdrachtgever, 11 okt). Het laadbestand bevat daarom alleen de **nieuwe** regels: wat al in de gepubliceerde lijst staat (combinatie AdviesPrk + AlternatiefPrk), gaat er niet nog eens in. De gepubliceerde lijst moet dus geladen zijn; zonder die lijst waarschuwt de app voor dubbele regels in OA.
  - Gesorteerd per AdviesPrk, daarbinnen in cascadevolgorde.
  - **Volledige lijst** (`alternatieve-prk-regels-volledig-<datum>.csv`): gepubliceerd + nieuw, per tekort eerst de bestaande regels. Niet voor OA; dit is de gepubliceerde lijst voor de volgende ronde.
  - **OA kan geen regels verwijderen** (opdrachtgever, 12 okt). Wat eenmaal in OA staat, blijft staan; daarom moet de juiste lijst gepubliceerd worden (verantwoordelijkheid van het project). Gepubliceerde adviezen die het panel nu afwijst, blijven in OA en in de volledige lijst; de app toont ze alleen ter informatie. (De databasekolom `coordinatie.verwijder_afgewezen` wordt niet meer gebruikt.)
  - Gevolg (besluit opdrachtgever, 12 okt): regels met niveau "Al gepubliceerd (…)" worden **niet beoordeeld**; het panel ziet ze als context. Doel: bij tekorten met een beperkt gepubliceerd advies het palet zo breed mogelijk aanvullen met de nieuwe alternatieven. Die komen in OA achter de bestaande adviezen (OA voegt toe). De herkenning gaat op de kolom Niveau van de Excel (`alInOA()` in `js/kern.js`).

**Gegevens**
- De lijst met tekorten en de Z-index mogen openbaar staan (toestemming van de opdrachtgever). De oordelen, namen en e-mailadressen niet.
- Een nieuwe lijst of Z-index zet je in `invoer/`. Een nieuwe versie van de lijst krijgt eigen oordelen; de app biedt aan om eerdere oordelen over te nemen voor regels die in beide versies staan.
- **Handleidingen** (Word + HTML, beoordelaars en coördinator) staan sinds 8 okt in `handleidingen/`; de HTML-versies staan ook online naast de app (`https://agjan0612.github.io/Levertekorten/handleidingen/Handleiding_beoordelaars_levertekorten.html`). De panelnamen zijn eruit gehaald (de repository is openbaar); de coördinatorhandleiding verwijst naar de tabel `panel` in Supabase. Bijgewerkt op 8 okt: inloggen met knop en code (hoofdstuk 2 beoordelaars, 4 nieuwe schermafbeeldingen) en een paragraaf "De inlogmail: hoe het is ingericht" (coördinator, hoofdstuk 10). Middag 8 okt: coördinatorhandleiding bijgewerkt voor de nieuwe knoppen (besluit wissen, herinnering mailen, back-up), en schermafbeeldingen vernieuwd met **verzonnen namen** (Pieter de Vries, Sanne Bakker; alleen de opdrachtgever bij naam). In de eerdere versies stonden in de schermafbeeldingen nog de echte namen van twee panelleden; die oude versies staan nog wel in de geschiedenis van de repository. Ze zijn nooit naar de panelleden verstuurd. **Besluit (8 okt):** de geschiedenis voorlopig niet wissen (wissen is niet terug te draaien); kan later alsnog.

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
.github/workflows/wakker-houden.yml – elke drie dagen rpc/wakker aanroepen (Supabase niet laten pauzeren)
handleidingen/              – handleidingen beoordelaars en coördinator (Word + HTML)
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
| Database | 5 tabellen (`panel`, `oordelen`, `voorstellen`, `besluiten`, `coordinatie`), 11 toegangsregels, live bijwerken aan voor 4 tabellen. Functie `wakker()` (8 okt) is het enige wat zonder inlog aan te roepen is; ze geeft alleen `true`. Getest in de echte database (blind, coördinator ziet alles, geen toegang zonder inlog). |
| Advisors | 3 bewuste waarschuwingen over SECURITY DEFINER-functies (zie `CLAUDE.md`) |

**Let op bij de Supabase-connector:** SQL met `drop …` en `apply_migration` liepen vast (time-out). In kleine stukken via `execute_sql`, zonder `drop`, lukt het wel.

## 6. Tests (laatste stand: alles geslaagd)

- `node --test tests/kern.test.js`: 7 tests, onder meer alle 64 combinaties van drie oordelen en het formaat van het laadbestand.
- `tests/rls/draai.sh`: 25 controles van de toegangsregels in PostgreSQL. Draait ook op GitHub bij elke wijziging.
- `node --test tests/kern.test.js`: nu 9 tests (ook "Staat al in OA" en Opzoeken).
- `node tests/e2e/gedeeld.js`: 68 controles (5 voor laadbestand en volledige lijst met een gepubliceerde lijst, 11–12 okt), eerder 59 (12 voor inlogcode en inlogknop, 7 okt; 5 voor het coördinatorscherm, 8 okt) (ook op GitHub groen bij de publicatie van PR #1) van de hele werkwijze in de browser met drie apothekers. Onder meer: live bijwerken, eindbesluit, laadbestand, werken zonder verbinding, herladen en uitloggen, en de stapweergave (Volgende/Overslaan/Vorige, uitleg, toelichting, menu Meer).
- Inlogmail via Brevo getest op 7 okt op twee zakelijke adressen van de opdrachtgever (o.a. het ncontrol-adres op de panellijst): mail aangekomen (bij ncontrol na ~2 minuten), link werkte, inloggen gelukt. Geen voorafgaande klik door een mailscanner gezien. De opdrachtgever heeft daarna geoefend met beoordelen (48 oordelen, goed opgeslagen); die oefenoordelen zijn gewist, alle tabellen zijn weer leeg. Nog niet getest bij de andere twee panelleden. De site zelf staat live; vanuit Claude's omgeving is `github.io` niet bereikbaar, dus controleren gaat via de status van de workflow. **Echte gepubliceerde lijst getest (9 okt):** `alternatieve-prk-regels-20260916.csv` (601 regels) geladen in een proefronde in de browser (nagebootste Supabase, verzonnen oordelen van drie apothekers op de echte lijst van 299 regels). Het laadbestand had dezelfde kopregel, geen BOM en CRLF; alle 601 bestaande regels stonden er letterlijk in (ook dubbele spaties), de nieuwe akkoord-regels kwamen erachter per tekort, en dubbelingen werden overgeslagen. De lijst zelf staat niet in de repository.
- Workflow *Database wakker houden* op 8 okt handmatig gestart: groen, en in de logboeken van Supabase (`edge_logs`) staat `POST | 200 | …/rest/v1/rpc/wakker`.

## 7. Openstaande punten

**A. Eerst oplossen, vóór de beoordelaars de link krijgen (blokkades) — beide opgelost, het panel kan de link krijgen**
1. ~~**Eigen mailservice (SMTP) koppelen.**~~ **Gedaan (7 okt)** via Brevo, zie §5. Aandachtspunten:
   - De Brevo-SMTP-sleutel vervalt na **1 jaar (7 okt 2027)** en ook na **90 dagen zonder gebruik** (kan gebeuren tussen rondes). Dan komen er geen inlogmails meer. Oplossing: in Brevo (⚙️ → SMTP & API → SMTP) een nieuwe sleutel maken en die in Supabase → Authentication → Emails → SMTP Settings als *Password* plakken. Bestaande sleutels en de API-sleutel van de MBO-app niet aanraken; in Brevo **niet** "Activate for SMTP keys" (IP-blokkade) aanzetten, want Supabase mailt vanaf wisselende adressen.
   - Later eventueel een netter afzenderdomein (bijv. van Mosadex): alleen de SMTP-instellingen in Supabase wijzigen, de app zelf niet.
2. ~~**Inloggen met een code.**~~ **Gedaan (live 7 okt, getest 8 okt):** beide sjablonen ingesteld; inloggen met de code en via de knop geslaagd op het ncontrol-adres (één `/verify` per keer, geen vooraf geopende link). Zakelijke mailscanners openen links vooraf; een inloglink werkt maar één keer. Belangrijk inzicht: link en code zijn bij Supabase **hetzelfde eenmalige inlogbewijs**, dus een vooraf geopende `{{ .ConfirmationURL }}` maakt ook de code ongeldig. Daarom:
   - de knop in de mail gaat naar de app met `?inlog={{ .TokenHash }}`; de app logt pas in na een klik op *Inloggen* (`verifyOtp({token_hash, type: 'email'})`), een scanner klikt niet;
   - daaronder de code `{{ .Token }}` (`verifyOtp({email, token, type: 'email'})`), in te vullen in de app; het adres wordt 1 uur onthouden (localStorage `lt:inlog`), en "Ik heb al een inlogcode" werkt ook in een andere browser;
   - mailsjabloon: `supabase/inlogmail.html`, onderwerp *Inloggen: beoordeling alternatieven*, in **beide** sjablonen *Confirm signup* (nieuwe gebruikers, zoals de andere panelleden) en *Magic Link* (bestaande gebruikers).
   - **Volgorde:** eerst de PR samenvoegen en de publicatie afwachten, dan pas de sjablonen in Supabase aanpassen (de oude app kent `?inlog=` en het codeveld niet). Oude mails met de gewone link blijven werken.
Uit de logboeken (7 okt, avond): inloggen via Brevo geslaagd op twee adressen van de opdrachtgever; de link werd niet vooraf "opgebruikt". Punt 2 is daardoor minder dringend, maar blijft een vangnet voor de adressen van de andere panelleden. De melding dat de mail een paar minuten kan duren staat inmiddels in de app.

**B. Nu aan de beurt**
0. **Uitnodiging versturen** (opdrachtgever): het concept staat in zijn Gmail (aan de twee andere panelleden). Eerst de twee datums invullen (uiterste datum beoordelen, datum paneloverleg). De Word-handleiding is niet bijgevoegd (de online link staat in de mail); eventueel zelf toevoegen. Daarna: in de logboeken (`auth_logs`) kijken of het inloggen lukt, ook bij de mailscanners van Mosadex en de Service Apotheek.
3. De eerste echte test: inloggen (met code), oordelen geven, tweede apotheker, Coördineren, laadbestand. Daarna de proefoordelen wissen (via `execute_sql`) zodat het panel leeg begint.
   - **Werkwijze per ronde voor de coördinator:** (1) bovenaan de gepubliceerde lijst laden (nu `alternatieve-prk-regels-20260916.csv`; daarna steeds de *volledige lijst* uit de vorige ronde); (2) na het paneloverleg *Laadbestand maken…*, samenvatting controleren en naar OA sturen (OA voegt toe en kan niets verwijderen); (3) *Volledige lijst maken…* en bewaren voor de volgende ronde; (4) *Logboek* en *Back-up* bewaren.
   - Vragen als "zit product X in de advieslijst?" beantwoorden via **Coördineren → Opzoeken** (naam, merknaam, PRK of ZI). Voorbeeld 12 okt: tramadol druppels (PRK 40967, prio 18, 6 alternatieven) en Xarelto suspensie (PRK 209872, prio 49, 5 alternatieven) staan in de huidige lijst, nog geen advies in OA; de opdrachtgever heeft de vraagsteller zelf beantwoord.
4. ~~Testen met de echte gepubliceerde lijst van 16-09.~~ **Gedaan (9 okt)**, zie §6. De opdrachtgever kreeg een voorbeeld van het Logboek (Excel) en het laadbestand (CSV). Laad deze lijst bij de echte ronde in het coördinatorscherm (*Gepubliceerde lijst*); 44 regels uit de huidige tekortenlijst staan er al in (niveau "Al gepubliceerd (16-09)").
5. ~~Voegt OA toe of vervangt het?~~ **Beantwoord (11 okt): OA voegt toe.** De app is daarop aangepast (zie §2, stap 16, en §3 *Laadbestand*). OA kan geen regels verwijderen (12 okt). Of OA zelf ontdubbelt is onbekend; de app voorkomt dubbelingen zolang de juiste (laatste volledige) lijst als gepubliceerde lijst is geladen.

**C. Bekende beperkingen (gevonden 7 okt), later oplossen**
- ~~**Pauzeren**~~ **Opgelost (8 okt):** de workflow `.github/workflows/wakker-houden.yml` roept elke drie dagen (05:23 UTC op dag 1, 4, 7, … van de maand) `rpc/wakker` aan met de publieke sleutel uit `js/config.js`. Mislukt dat, dan wordt de workflow rood en mailt GitHub. Pauzeert het project toch: herstellen via het dashboard of `restore_project`. **Let op:** GitHub zet geplande workflows in een openbare repository uit na 60 dagen zonder wijzigingen in de repository (mailt vooraf); weer aanzetten via Actions → *Database wakker houden* → *Enable workflow*.
- **Back-ups:** op het gratis plan zijn database-back-ups niet te downloaden. Advies aan de coördinator: knop *Back-up* na elk overleg en vóór elke publicatie.
- **Nieuwe lijstversie halverwege een ronde:** oordelen kunnen per beoordelaar worden overgenomen (alleen als die in de nieuwe versie nog niets heeft), maar **besluiten** (Bespreken/Voorstellen) en de geladen **gepubliceerde lijst** gaan niet mee (gekoppeld aan de vingerafdruk van de bron). Advies: lijst niet wijzigen tijdens een ronde; anders meenemen van besluiten bouwen.
- **Panelwijziging:** iemand uit `panel` halen ⇒ diens oordelen tellen niet meer mee. Met een **vierde** beoordelaar kan het 2–2 worden; `consensus()` in `js/kern.js` geeft dan *Akkoord* (telt akkoord eerst). Eerst aanpassen als het panel groeit.
- **Openbare inlogpagina:** `shouldCreateUser: true`; iedereen kan een inloglink aanvragen (komt niet verder dan "niet op de panellijst", RLS houdt alles tegen) en zo de maillimiet opmaken. Oplossing: CAPTCHA of aanmelden dichtzetten zodra het panel compleet is.
- **Gedeelde/beheerde werkplekken** die browsergegevens wissen: elke keer opnieuw inloggen (kost een mail), en wijzigingen die offline in de wachtrij staan blijven in die ene browser.
- Kleiner: na een update tot ~10 min de oude versie (Ctrl+F5); een andere opbouw van de Excel laat het publiceren mislukken (oude lijst blijft online, GitHub mailt); voor de AVG biedt Supabase standaard een verwerkersovereenkomst (data in Frankfurt).

**D. Overige ideeën**
- ~~Coördinatorscherm: besluit wissen, categorie-keuzelijst, paneltegels, uitleg back-up, grijze tekst~~ **Gedaan (8 okt).** Handleidingen bijgewerkt (tekst en schermafbeeldingen).
- **Gegevens:** twee gepubliceerde alternatieven bij PRK 133612 (PRK 49026 en 49034, prednisolon drank) staan niet meer in de Z-index. Sinds 12 okt beoordeelt het panel regels die al in OA staan niet meer; die twee blijven dus in OA staan (OA kan niets verwijderen). Eventueel apart melden bij OA/Mosadex.
- **Handleiding beoordelaars:** een paar oudere schermafbeeldingen tonen nog "… van 299" (nu 255 te beoordelen). De tekst klopt; de afbeeldingen kunnen bij gelegenheid opnieuw.
- **GitHub Actions:** waarschuwing dat Node 20 verouderd is. Later de actions bijwerken.

## 8. Verder in een nieuwe sessie

**Waar we staan (13 okt):** de app staat online en is klaar voor de eerste echte ronde. Sinds 9 okt toegevoegd en live: laadbestand met alleen nieuwe regels plus een volledige lijst voor de volgende ronde (PR #8), regels die al in OA staan worden niet meer beoordeeld (255 i.p.v. 299 regels; PR #8) en het tabblad *Opzoeken* voor de coördinator (PR #10). Alles staat op GitHub (`main`); er staat niets open op een branch. De database is leeg (geen oefenoordelen). Wat nu moet gebeuren: de opdrachtgever verstuurt de uitnodiging (concept in Gmail, eerst twee datums invullen); daarna volgen we in de logboeken of het panel kan inloggen en doorlopen we de eerste ronde (§7B).

Start een sessie met de repository **Levertekorten**, met de Supabase-connector aan, en begin bijvoorbeeld met:

> Lees eerst VOORTGANG.md en CLAUDE.md helemaal, en vat in een paar zinnen samen waar we staan.
>
> Stand van mijn kant: [bijvoorbeeld: ik heb de uitnodiging (concept in Gmail) verstuurd op …, met als uiterste datum …].
>
> Wat ik vandaag wil: [bijvoorbeeld: kijk in de logboeken of de panelleden al hebben ingelogd / de eerste echte ronde doorlopen (§7B)].
>
> Werk op een eigen branch. Maak een pull request en voeg samen alleen als ik dat vraag. Werk na afloop VOORTGANG.md bij.
