# Capito: MVP-spec voor Claude Code

## 1. Doel

Naam: **Capito** (reponaam `capito`, PWA-naam "Capito").

Persoonlijke webapp (PWA, mobile-first) om Italiaans te leren als Nederlandstalige beginner (A1-begin).

Verbeteringen t.o.v. Duolingo:
- Snel: geen animaties, geen levens, toetsenbord-first (Enter = controleer / volgende)
- Correcte, natuurlijke zinnen (vooraf gegenereerd en gecontroleerd, nooit live AI)
- Nadruk op grammatica en vervoegingen
- Niet te raden: getypte antwoorden, en altijd oude stof door de nieuwe gemixt
- Uitspraak horen bij woorden en zinnen

Randvoorwaarden: geen kosten, geen accounts, één gebruiker, statisch gehost (GitHub Pages). UI-teksten in het Nederlands.

Succescriteria voor de pilot (unit 1 een week gebruiken) staan in `docs/pilot.md`.

**Belangrijkste eis: bestendig tegen uitbreiding.** Later komen er woorden, units, grammatica, tijden en oefenvormen bij. Dat moet kunnen zonder bestaande code of voortgang te breken.

---

## 2. Ontwerpprincipes (niet van afwijken)

1. **Content is data, code is engine.** Geen Italiaanse woorden of zinnen in `src/`. Alles staat in `content/`.
2. **Stabiele ID's.** Elk woord, elke zin, elk werkwoord en elke unit heeft een permanent ID (bijv. `w_caffe`, `s_u01_003`, `v_parlare`, `u01_greetings`). ID's veranderen of hergebruiken nooit. Voortgang hangt eraan.
3. **Nooit verwijderen, alleen deprecaten.** Wijzigt de betekenis wezenlijk? Nieuw ID + oude op `"deprecated": true`. Kleine correcties (typo, betere vertaling) mogen onder hetzelfde ID.
4. **Ontdekken, niet registreren.** Units, grammaticales, tijden en oefentypen worden automatisch gevonden (`import.meta.glob`). Een nieuw bestand toevoegen is genoeg, geen centrale lijst aanpassen.
5. **Oefeningen worden gegenereerd uit data**, niet per stuk opgeslagen. Meer content = automatisch meer oefeningen.
6. **De SRS kent geen content-types.** Het werkt met opake `cardKey`-strings (zie 5). Nieuwe oefenvormen breken niets.
7. **Versies en migraties.** Elk contentbestand en de opgeslagen voortgang hebben een `schema`-versie. Wijzigt het formaat, dan komt er een migratie.
8. **Validatie als vangnet.** `npm run validate` vangt kapotte referenties, dubbele ID's en ontbrekende velden vóór je deployt.
9. **Eén configbestand** (`config/app.json`) voor alle drempels, limieten en leerbeleid. Geen getallen hardcoden.
10. **De review-log is de bron van waarheid.** Elk antwoord wordt append-only gelogd. Kaartstatus is een afgeleide cache en kan opnieuw worden berekend, bijvoorbeeld bij een ander algoritme.
11. **Alles is te herleiden.** Elke build, export, melding en log-entry draagt een versiestempel (app, commit, content), zodat je weet op welke versie iets gebeurde.

---

## 3. Techniek

- **Node ≥20.19 LTS** (`.nvmrc` is de bron; `engine-strict=true` in `.npmrc`)
- Vite + TypeScript + React
- **zod** als enige bron van waarheid voor schema's (types worden hieruit afgeleid)
- **Vitest** voor tests
- `vite-plugin-pwa` met `registerType: 'prompt'`: bij een nieuwe versie toont de app "Nieuwe versie beschikbaar, herladen" (geen stille, verouderde content)
- Voortgang en review-log in **IndexedDB** (`idb-keyval`) achter een asynchrone `ProgressStorage`-interface
- Deploy via GitHub Actions naar GitHub Pages
- Audio: Python + `edge-tts`, vooraf gegenereerd als mp3
- Grammaticales: Markdown met frontmatter (`gray-matter`)
- Versiestempel bij elke build (zie 5, "Versiestempel")

### Mappenstructuur

```
/content
  /units/            u01_greetings.json ... (één bestand per unit)
  /verbs/            irregular.json (of per werkwoord in de unit)
  /tenses/           presente.json (later: passato_prossimo.json ...)
  /grammar/          g_essere_presente.md ...
  core-words.json    plan voor kernwoorden (zie 8)
  id-registry.json   alle ID's die ooit bestonden (alleen aangroeien, niet handmatig bewerken)
/config/app.json
/prompts/            generate-unit.md, review-unit.md
/docs/               style-guide.md (stijlgids content), pilot.md (pilotweek + succescriteria)
/tests/golden/       conjugation-presente.json (door de gebruiker gecontroleerd)
/audio/              mp3-bestanden (gegenereerd)
/scripts/            validate.ts, generate-audio.py, coverage.ts, reports.ts, stats.ts, version.ts
/src
  /engine/           conjugator, checker, srs, session-builder, unlock, plurals
  /exercises/        één bestand per oefentype + index.ts (auto-registry)
  /storage/          progress-store, migrations
  /ui/               schermen, componenten, strings.nl.ts
  /generated/        audio-manifest.json (door script gemaakt, niet handmatig)
```

---

## 4. Datamodel (content)

Alle bestanden hebben `"schema": 1`. Alle content volgt `docs/style-guide.md`.

### Woord
```json
{
  "id": "w_caffe",
  "it": "caffè",
  "pos": "noun",
  "article": "il",
  "gender": "m",
  "plural": null,
  "nl": ["koffie"],
  "register": "neutral",
  "tags": ["cafe"],
  "core": false,
  "note": null
}
```
- `register`: `informal` | `formal` | `neutral`
- `plural`: alleen invullen bij onregelmatig; de engine leidt regelmatige meervouden af
- `nl` is een lijst geaccepteerde vertalingen

### Zin
```json
{
  "id": "s_u01_003",
  "it": "Come sta, signora?",
  "nl": ["Hoe gaat het met u, mevrouw?"],
  "register": "formal",
  "uses": ["w_come", "v_stare", "w_signora"],
  "audioText": null,
  "cloze": [{ "target": "sta", "hint": "stare" }]
}
```
- `uses` moet verwijzen naar woorden/werkwoorden uit de huidige of eerdere units (validator checkt dit, zodat een zin nooit onbekende stof bevat)
- Elk item uit `uses` moet letterlijk in de zin terug te vinden zijn: een woord als `it` of meervoud, een werkwoord als infinitief of vervoegde vorm. De engine zoekt die plek zelf (voor onderstrepen en invullen); de validator geeft een fout als dat niet lukt
- `cloze` optioneel: expliciete invulplekken
- `audioText` optioneel: tekst voor de audio als de geschreven vorm afwijkt (cijfers, symbolen als €, afkortingen worden uitgeschreven)

### Dialoog
```json
{
  "id": "d_u01_formal",
  "register": "formal",
  "title": "Bij het ontbijt in het hotel",
  "lines": [{ "speaker": "A", "sentence": "s_u01_003" }]
}
```
Regels verwijzen naar zinnen, zodat elke regel audio en SRS-kaarten krijgt zonder dubbel werk.

### Werkwoord
```json
{ "id": "v_parlare", "inf": "parlare", "nl": ["praten", "spreken"], "conj": "are" }
```
```json
{
  "id": "v_andare", "inf": "andare", "nl": ["gaan"], "conj": "are",
  "irregular": {
    "presente": { "io": "vado", "tu": "vai", "lui": "va", "noi": "andiamo", "voi": "andate", "loro": "vanno" }
  }
}
```
- Personen: `io tu lui noi voi loro` (`lui` = lui/lei/Lei)
- `conj`: `are` | `ere` | `ire` | `ire_isc` (finire, capire) | `irregular`
- `reflexive: true` voor o.a. chiamarsi (engine voegt mi/ti/si/ci/vi/si toe)
- Regelmatige werkwoorden hebben **geen** formulieren in de content, die berekent de engine

### Tijd (`content/tenses/presente.json`)
```json
{
  "id": "presente",
  "kind": "simple",
  "nl": "tegenwoordige tijd",
  "endings": {
    "are": { "io": "o", "tu": "i", "lui": "a", "noi": "iamo", "voi": "ate", "loro": "ano" },
    "ere": { "io": "o", "tu": "i", "lui": "e", "noi": "iamo", "voi": "ete", "loro": "ono" },
    "ire": { "io": "o", "tu": "i", "lui": "e", "noi": "iamo", "voi": "ite", "loro": "ono" },
    "ire_isc": { "io": "isco", "tu": "isci", "lui": "isce", "noi": "iamo", "voi": "ite", "loro": "iscono" }
  }
}
```
`kind` is nu alleen `simple`. Het veld bestaat al zodat `compound` (passato prossimo: hulpwerkwoord + participio) later kan worden toegevoegd zonder bestaande bestanden te wijzigen.

Spellingregels in de engine (met tests): -care/-gare krijgen `h` voor `i`/`e` (cerchi, paghi), -iare verliest dubbele `i` (mangi, niet mangii).

### Grammaticales (`content/grammar/*.md`)
```
---
schema: 1
id: g_essere_presente
title: "Essere: zijn"
unit: u01_greetings
drills:
  - { type: conjugate, verbs: [v_essere], tense: presente }
---
Korte uitleg met vergelijking met het Nederlands ...
```

### Unit
```json
{
  "schema": 1,
  "id": "u02_introductions",
  "order": 2,
  "title": "Kennismaken",
  "canDo": ["Ik kan mijn naam en herkomst zeggen", "Ik kan iemand vragen hoe hij of zij heet"],
  "requires": ["u01_greetings"],
  "words": [],
  "verbs": [],
  "sentences": [],
  "dialogues": [],
  "grammar": ["g_chiamarsi", "g_gender_o_a"],
  "tenses": ["presente"],
  "review": { "status": "draft" }
}
```
- Een unit bevat de content die hij **introduceert**; andere units verwijzen via ID
- `canDo`: 2-4 kan-doelen in het Nederlands ("Ik kan een koffie bestellen en afrekenen"). Verplicht (validator). Ze sturen de generator, de reviewer en de eindtoets; elk kan-doel wordt gedekt door minstens één dialoog of zinnengroep
- `review.status`: `draft` | `reviewed` (app toont een subtiele markering bij `draft`)

---

## 5. Engine

### Cards en SRS
Elke oefenbare eenheid is een **card** met een string-sleutel:
```
translate-nl-it:w_caffe
translate-it-nl:w_caffe
conjugate:v_parlare:presente:noi
article:w_casa
cloze:s_u01_003:0
dictation:s_u01_003
mc-sentence:w_caffe
mc-word:v_essere
cloze-word:w_caffe
```
De SRS (SM-2) slaat per `cardKey` op: `ease, interval, due, reps, lapses`. De score per antwoord komt uit `config/app.json` → `grading`. SRS-parameters staan in `srs.*` (`algorithm`, `startEase`, `minEase`, `maxIntervalDays`) en de typfoutdrempels in `checker.*` (`typoMinLength`, `typoMaxDistance`). Kaarten van onbekende of gedeprecateerde content worden genegeerd, niet verwijderd. De kaartstatus is afleidbaar uit de review-log (zie "Review-log").

### Antwoordcontrole (`checker.ts`)
- Normaliseren: trim, kleine letters, dubbele spaties, eind-leestekens, `’` naar `'`
- Meerdere geldige antwoorden (`nl` is een lijst); bij NL-antwoorden optioneel leidend de/het/een negeren
- Uitkomsten: `correct` | `almost` | `wrong`
- **Accentfout** (caffe i.p.v. caffè): `almost`, met de juiste vorm getoond. Uitzondering: als de accentloze vorm zelf een ander geldig woord is (e/è, da/dà), dan `wrong`
- **Typfout** (Levenshtein 1, woord ≥ 5 tekens): `almost`, maar alleen als het oefentype dat toestaat. **Uit** bij vervoegingen, lidwoorden en cloze (parlo ≠ parla)
- Knop "mijn antwoord was ook goed" slaat een melding op (zie 7)

### Conjugator (`conjugator.ts`)
`conjugate(verb, tense, person)`: gebruikt `irregular`-tabel indien aanwezig, anders regels uit de tijd + spellingregels. Tests vergelijken de uitvoer met `tests/golden/conjugation-presente.json` (door de gebruiker gecontroleerd, agents wijzigen dit bestand niet zonder toestemming).

### Sessie-opbouw en leerbeleid (`session-builder.ts`)
Invoer: voortgang, config, ontgrendelde units. **Alle getallen komen uit `config/app.json`.**

- **Mix:** minimaal `session.minOldMaterialRatio` (30%) kaarten uit eerdere units, ook bij "oefen deze unit"
- **Nieuwe woorden en werkwoorden** doorlopen eerst de leerladder (zie "Leerladder")
- **Sessielengte:** maximaal `session.maxReviewsPerSession` (30). Daarna een afrondscherm met de knop "Nog een ronde"
- **Nieuwe herhaalkaarten:** kaarten die vrijkomen als een item de ladder heeft afgerond (bijv. `article`, `conjugate`, `dictation`), maximaal `session.newCardsPerDay` per dag
- **Uitgesloten types:** `session.excludedTypes` (`flashcard`, `cloze`) komen niet in de dagelijkse sessie. De kaarten blijven bestaan
- **Volgorde:** willekeurig (met een seed, dus deterministisch testbaar), ongeacht ladderstatus. Wel geldt: een introductie staat direct voor de eerste vraag over dat item, treden van één item staan in volgorde met minstens `ladder.minGapSameItem` andere kaarten ertussen, en maximaal `session.maxSameTypeInRow` kaarten van hetzelfde type achter elkaar
- **Achterstand:** per dag maximaal `backlog.maxDueShownPerDay` achterstallige kaarten, de meest achterstallige eerst (`backlog.order`). Boven `backlog.pauseNewCardsAboveDue` achterstallige kaarten komen er geen nieuwe kaarten bij
- **Terugkeer na een pauze:** na `backlog.returnAfterDays` dagen afwezigheid krijg je lichte sessies (maximaal `backlog.returnMaxSessionReviews`) met een vriendelijk "welkom terug", zonder nieuwe kaarten tot de achterstand onder de drempel is
- **Fout antwoord:** het juiste antwoord één keer overtypen (`lapse.retypeCorrectAnswer`); de kaart komt in dezelfde sessie terug (`lapse.reinsertInSession`) na `lapse.reinsertAfterCards` kaarten
- **Leech:** na `leech.lapseThreshold` fouten wordt een kaart gemarkeerd als "lastig". Ze komt in de lijst "Lastig", krijgt extra context (voorbeeldzin + audio, `leech.showExtraContext`) en blijft in de SRS
- **Score per antwoord** (`grading`): correct 4, bijna goed (accent/typfout) 3, hint gebruikt (`grading.hintUsed`) 3, fout 1; flashcard opnieuw 1, goed 4, makkelijk 5

### Leerladder (`ladder.ts`, `sentences.ts`, `distractors.ts`)
Elk woord en werkwoord (een **item**) doorloopt de treden uit `ladder.stages`, na een introductie:

0. **Ontmoeten** (geen kaart): een zin met het item onderstreept, de vertaling, audio (`ladder.introAutoplay`), het item met lidwoord bij zelfstandige naamwoorden en een label formeel/informeel als het register niet neutraal is
1. `mc-sentence`: Italiaanse zin met het item onderstreept, kies de Nederlandse vertaling uit `ladder.optionCount` opties
2. `mc-word`: Nederlandse zin + Italiaanse zin met een gat, kies het ontbrekende woord (bij werkwoorden: andere vervoegingen van hetzelfde werkwoord)
3. `cloze-word`: zelfde opzet, het woord zelf typen
4. `translate-nl-it`: alleen het Nederlandse woord, Italiaans typen (zelfstandige naamwoorden met lidwoord)

Een trede die voor een item niet bestaat (bijv. `translate-nl-it` bij werkwoorden) wordt overgeslagen. Na de laatste trede is het item **afgerond** en gaan de herhaalkaarten via de SRS.

- **Trede afleiden uit de log:** een item staat op trede *n* als de log voor zijn tredekaarten *n* keer een goed antwoord op de trede van dat moment bevat, met `ladder.dropOnWrong` treden terug per fout. Afgerond blijft afgerond. Er is geen apart opgeslagen veld
- **Tempo:** een item stijgt maximaal `ladder.maxStepsPerItemPerDay` treden per dag. Daardoor staan items in een sessie op verschillende treden
- **Nieuwe items:** maximaal `ladder.newItemsPerDay` per dag (instelbaar in Instellingen), en alleen zolang er minder dan `ladder.maxItemsInProgress` items op de ladder staan. Volgorde: unit-volgorde, binnen een unit de volgorde waarin items voor het eerst in de zinnen voorkomen
- **Verdeling:** eerst maximaal `ladder.reviewShare` van de sessie aan achterstallige herhalingen, dan de items op de ladder (langst niet geoefend eerst), dan nieuwe items, en de rest weer herhalingen
- **Fout op een trede:** het item zakt, de latere treden van dat item verdwijnen uit de sessie en de lagere trede komt na `lapse.reinsertAfterCards` kaarten terug. Bij meerkeuze wordt het antwoord niet overgetypt
- **Zinnen:** per item de zinnen waarin het voorkomt. De introductiezin is de eerste zin in de unit met dat item; daarna wisselt de zin bij elke kaart van het item (op basis van het aantal eerdere antwoorden op dat item)
- **Afleiders** komen alleen uit bestaande content: vertalingen van andere zinnen, andere woorden van dezelfde woordsoort, of andere vormen van hetzelfde werkwoord. Volgorde van de opties is deterministisch
- Herhaalkaarten van een item (`translate-it-nl`, `article`, `conjugate`) komen pas vrij als het item is afgerond; `dictation` als alle items uit `uses` zijn afgerond. Mastery (ontgrendelen, eindtoets) telt alleen herhaalkaarten

### Ontgrendelen (`unlock.ts`)
Unit ontgrendeld als alle `requires` een mastery ≥ `unlock.masteryThreshold` hebben (standaard 0.8). Mastery = aandeel kaarten van de unit met `reps ≥ unlock.minRepsPerCard` en laatste antwoord goed. Met `unlock.requireExam: true` moet daarnaast de eindtoets gehaald zijn (standaard uit, want dat maakt leren traag). In instellingen: "alles ontgrendelen" (het is je eigen app).

### Eindtoets (`mode: exam`)
Per unit beschikbaar vanaf mastery `exam.availableFromMastery` (0.6).
- `exam.itemCount` (15) kaarten, `exam.unitShare` (60%) uit de unit en de rest uit eerdere units
- Alleen getypte typen (`translate-nl-it`, `sentence-translate`, `conjugate`, `cloze`, `dictation`), geen flashcards met zelfbeoordeling, geen hints (`exam.allowHints: false`)
- Resultaat: percentage, uitsplitsing per grammaticaonderwerp en de gemiste items. Geslaagd bij `exam.passThreshold` (0.8)
- Daarna vraagt de app bij elk kan-doel (`canDo`) "Kan ik dit nu?" (ja / nog niet). Het antwoord wordt bewaard in `unitMeta`
- Antwoorden komen in de review-log met `mode: "exam"`

### Oefentypes (`src/exercises/*.ts`)
Elk bestand exporteert:
```ts
{
  id: string,
  typoTolerance: boolean,
  cards(content): CardKey[],
  build(cardKey, content, ctx?): Exercise,   // prompt, verwachte antwoorden, opties, zin, audio
  check(input, exercise): Result,
  requires?(cardKey, content): ItemId[]      // items die afgerond moeten zijn (standaard het item uit de key)
}
```
`ctx.seq` is het aantal eerdere antwoorden op het item; daarmee wisselen zin en optievolgorde. `index.ts` verzamelt ze automatisch. Types: `flashcard` (zelf beoordelen: opnieuw/goed/makkelijk), `translate-it-nl`, `translate-nl-it` (met lidwoord; zonder lidwoord is "bijna goed"), `sentence-translate`, `conjugate`, `article`, `cloze`, `dictation`, `mc-sentence`, `mc-word`, `cloze-word`. Meerkeuze telt niet mee in de eindtoets.

### Voortgang (`storage/`)
```ts
{
  schema: 1,
  cards: Record<CardKey, CardState>,   // afgeleid van de log (cache)
  reviewLog: ReviewEntry[],            // append-only, bron van waarheid
  introduced: string[],
  unitMeta: Record<UnitId, { examBest?: number, examAt?: string, canDo?: boolean[] }>,
  flags: Flag[],
  settings: Settings,
  meta: { lastExportAt?: string, persistGranted?: boolean }
}
```
- Statistieken worden uit de log afgeleid en niet apart opgeslagen
- `migrations: Record<number, (old) => new>`, uitgevoerd bij laden en bij importeren
- Opslag: IndexedDB via een asynchrone `ProgressStorage`-interface

### Review-log
Elk antwoord wordt direct toegevoegd (append-only, nooit wijzigen of verwijderen):
```ts
ReviewEntry = {
  t: string,        // ISO-tijd
  key: CardKey,
  result: "correct" | "almost" | "wrong" | "again" | "good" | "easy",
  grade: number,    // 0-5, score volgens config.grading
  ms: number,       // antwoordtijd
  hint: boolean,
  answer?: string,  // getypt antwoord (max 100 tekens), alleen bij almost/wrong
  session: string,  // sessie-ID
  mode: "daily" | "unit" | "exam",
  cv: string        // contentversie (zie Versiestempel)
}
```
- `rebuildCards(log, config)` is een pure functie in `src/engine/`. Een test controleert dat opnieuw afspelen van de log dezelfde kaartstatus geeft als de live status. Zo is overstappen naar een ander algoritme (bijvoorbeeld FSRS) een engine-wijziging zonder dataverlies
- Omvang: ongeveer 100 bytes per entry, ruim genoeg voor jaren gebruik

### Back-up en opslag
- Bij de eerste start (en na installatie) vraagt de app `navigator.storage.persist()` aan (`backup.requestPersistentStorage`). De status staat in Instellingen
- Op iOS kan de browser lokale data van een website wissen na een tijd zonder gebruik. Een als app geïnstalleerde PWA ("Zet op beginscherm") loopt dit risico niet op dezelfde manier. Home toont dit advies zolang de app niet standalone draait
- Export: bestandsnaam `capito-backup-JJJJ-MM-DD.json`, gedeeld via de Web Share API (naar Bestanden, iCloud of Drive) met download als fallback. Bevat alles uit "Voortgang" plus `meta.build`
- Herinnering: een banner op Home als de laatste export langer dan `backup.reminderDays` (14) geleden is
- Import: valideert het schema, draait migraties, toont een vergelijking (huidig versus back-up: kaarten, reviews, laatste review) en vraagt bevestiging voordat de huidige data wordt vervangen
- Tests: export → import roundtrip, en import van een backup met een oudere schema-versie

### Versiestempel
- `scripts/version.ts` (aangeroepen vanuit `vite.config.ts` via `define`) maakt bij elke build `__BUILD__ = { app, commit, content, built }`: app-versie uit `package.json`, korte git-hash (of `"dev"`), een hash van alle bestanden in `content/` (8 tekens) en de builddatum
- Zichtbaar in Instellingen, meegestuurd in elke export (`meta.build`), in elke melding (`flags`) en als `cv` in elke log-entry
- Zo weet je bij een gemelde fout op welke contentversie die optrad

### Audio
- Bestandsnaam = korte hash van `tekst|stem` (`audio/3fa9c1d2b0e4.mp3`), waarbij tekst = `audioText` indien aanwezig, anders `it`
- `scripts/generate-audio.py` maakt alleen **ontbrekende** bestanden en schrijft `src/generated/audio-manifest.json`
- Twee stemmen (bijv. `it-IT-ElsaNeural`, `it-IT-DiegoNeural`), dialoogrol A/B gebruikt een eigen stem
- App zoekt audio via het manifest; ontbreekt het, dan **fallback naar `speechSynthesis` (it-IT)**. Nieuwe content werkt dus direct, ook vóór het audioscript draait
- PWA: audio cache-first bij eerste gebruik

---

## 6. Schermen (mobile-first)

1. **Home:** knop "Vandaag" (te herhalen + nieuwe kaarten), unitlijst (vergrendeld/open/voortgang), back-upbanner en installatieadvies (zie "Back-up en opslag")
2. **Unit:** kan-doelen, grammaticales, woordenlijst met audio, dialogen, knoppen "Oefen deze unit" en "Eindtoets"
3. **Sessie:** één oefening per scherm, Enter om te controleren en door te gaan, directe feedback, audio-knop, hint-knop (eerste letters, telt als `hint`; uit tijdens de eindtoets), "meld fout". Meerkeuze met toetsen 1-4. Bij invuloefeningen staat de Nederlandse zin boven de Italiaanse zin met het gat
4. **Grammaticales:** Markdown + knop "oefen dit"
5. **Dialoog:** regels met audio, NL-vertaling aan/uit, wissel informeel/formeel
6. **Instellingen:** nieuwe woorden per dag, autoplay, alles ontgrendelen, back-up (export/import, laatste back-up, opslagbescherming), reset, versie-info (app, commit, content)
7. **Meldingen:** lijst met gemelde fouten, exporteerbaar
8. **Lastig:** lijst met leech-kaarten

---

## 7. Scripts en contentpijplijn

| Commando | Doet |
|---|---|
| `npm run validate` | Zod-schema's, unieke ID's, alle verwijzingen kloppen, `requires` zonder cycli, `uses` alleen uit huidige/eerdere units, audio-dekking, `canDo` aanwezig (2-4 per unit), kernwoordenplan (waarschuwing), **ID-register**: een ID uit `content/id-registry.json` dat in de content ontbreekt is een fout (`--update-registry` voegt nieuwe ID's toe) |
| `npm run audio` | Ontbrekende mp3's + manifest |
| `npm run coverage` | Vergelijkt je woorden met een frequentielijst (bijv. de open FrequencyWords-lijst voor Italiaans) en toont wat ontbreekt |
| `npm run reports` | Leest geëxporteerde meldingen leesbaar uit, om aan Claude te geven |
| `npm run stats -- <export.json>` | Leest een back-up en toont per dag de sessies, mediane sessieduur, aantal antwoorden en % goed, eindtoetsresultaten en de meest gemiste kaarten. Wordt gebruikt voor de pilot |
| `npm test` | Vitest |

**Meldingen:** `{ itemId, kind: "wrong-content" | "also-correct" | "audio", userAnswer, note, date, build }`. Exporteer, geef ze aan Claude Code, laat het de content fixen.

**Genereren en controleren (`/prompts`):**
1. `generate-unit.md`: parameters = scenario, kan-doelen, grammaticafocus, aantal woorden, lijst reeds bekende woorden, kernwoorden voor deze unit. Volgt `docs/style-guide.md`. Uitvoer = unit-JSON volgens het schema.
2. `review-unit.md`: **nieuwe** Claude-sessie controleert naturalijkheid, register (tu/Lei), lidwoorden, meervouden, Nederlandse vertalingen, dekking van de kan-doelen en naleving van de stijlgids. Uitvoer = lijst problemen.
3. Jij: steekproef (~20 zinnen per unit). Daarna `review.status = "reviewed"`.

---

## 8. Kernwoorden (afbouwend)

`content/core-words.json`: ~40 bouwstenen (non, e, di, che, molto, anche, ma, per, con, come, dove, ...), elk met `introduceIn: <unitId>`.

Quota per unit:
- Unit 1-3: ~10 nieuwe kernwoorden per unit
- Unit 4-6: 3-5 per unit
- Unit 7+: geen nieuwe meer

De validator waarschuwt als een unit afwijkt, en checkt dat elke dialoog al geïntroduceerde kernwoorden hergebruikt.

---

## 9. De 10 units

Alle units in volgorde (`requires` = vorige unit). Per unit ~20-25 scenariowoorden, 1 informele en 1 formele dialoog.

| # | ID | Scenario | Grammatica | Werkwoorden |
|---|---|---|---|---|
| 1 | u01_greetings | Begroeten en afscheid | tu vs. Lei, sono/sei/è | essere |
| 2 | u02_introductions | Kennismaken | chiamarsi, di/da, -o/-a | chiamarsi |
| 3 | u03_ordering | Bestellen | lidwoorden, vorrei | avere, regelmatige -are |
| 4 | u04_numbers | Getallen en prijzen | meervoud | costare |
| 5 | u05_places | Locaties en de weg | a/in/di, c'è/ci sono | andare |
| 6 | u06_time | Tijd en dagen | che ore sono | regelmatige -ere |
| 7 | u07_people | Familie en mensen | mio/tuo/suo, bijv. nw. | (herhaling) |
| 8 | u08_shopping | Winkelen en eten | volere/potere | regelmatige -ire, -isc |
| 9 | u09_daily_life | Dagelijks leven | ontkenning, vragen | fare, dovere |
| 10 | u10_travel | Reizen en overnachten | alles combineren | (herhaling) |

---

## 10. Bouwvolgorde

Elke fase eindigt met werkende, geteste code. Begin met een **kleine handgeschreven unit 1** (~10 woorden) om alles te testen. Daarna geldt de **pilotregel**: maak eerst alleen unit 1 volledig af en gebruik die een week (fase 7a) voordat units 2-10 worden gegenereerd. Content opnieuw genereren kost veel meer dan de aanpak bijstellen.

0. **Setup:** repo, Vite/TS/React, zod, Vitest, GitHub Pages-workflow, `CLAUDE.md` (zie 12)
1. **Content-fundament:** zod-schema's, loader (`import.meta.glob`), `validate`-script, mini-unit 1
2. **Engines + tests:** conjugator, plurals/lidwoorden, checker, SRS, review-log + `rebuildCards`, progress-store (IndexedDB) met migraties, versiestempel
3. **Oefentypes + sessie-builder (leerbeleid uit config) + unlock + eindtoets**
4. **UI:** eerst het sessiescherm (speelbaar), dan home, unit, grammatica, dialoog, instellingen
5. **Audio:** script, manifest, TTS-fallback
6. **PWA + deploy:** update-melding, persistente opslag, back-up (export/import) met herinnering
7. **Pilot, daarna content**
   - **7a Pilot:** unit 1 volledig genereren (echte content, audio, review, stijlgids toegepast), deployen en een week zelf gebruiken op je telefoon. Evalueren met `docs/pilot.md` (3 succescriteria en `npm run stats`). Bijsturen kan aan de generator-prompt, stijlgids, config of oefenmix. Pas na een positief besluit door naar 7b
   - **7b Content:** units 2-10 genereren (`/new-unit`), reviewen, `coverage` draaien, aanvullen
8. **Afwerking:** meldingsflow, statistieken, kleine UX-verbeteringen

---

## 11. Uitbreiden: hoe voeg je ... toe

| Wat | Hoe | Code aanpassen? |
|---|---|---|
| Woorden/zinnen aan bestaande unit | JSON aanvullen, `validate`, `audio` | Nee |
| Nieuwe unit | Nieuw bestand `content/units/u11_....json` | Nee |
| Onregelmatig werkwoord | `irregular`-tabel in de unit | Nee |
| Grammaticales | Nieuw `.md`-bestand, verwijs vanuit unit | Nee |
| Nieuwe tegenwoordige/simpele tijd | Nieuw bestand in `content/tenses/`, voeg toe aan `tenses` van een unit | Nee |
| Passato prossimo (`compound`) | Engine uitbreiden voor `kind: compound`; bestaande content blijft werken | Alleen engine |
| Nieuw oefentype | Één bestand in `src/exercises/` | Alleen nieuw bestand |
| Formaat verandert | Schema-versie ophogen + migratie voor content en voortgang | Ja, met migratie |
| Leerbeleid aanpassen (limieten, drempels, scores) | `config/app.json` | Nee |
| Ander leeralgoritme (bijv. FSRS) | Nieuwe scheduler in `src/engine/`; kaartstatus opnieuw berekenen uit de review-log | Alleen engine |
| Stijlkeuze in content wijzigen | `docs/style-guide.md` aanpassen; bestaande content bewust aanpassen | Nee |

---

## 12. Werkafspraken voor Claude Code (ook in `CLAUDE.md` zetten)

- Nooit Italiaanse woorden/zinnen hardcoden in `src/`. UI-strings alleen in `src/ui/strings.nl.ts`.
- Nooit een bestaand ID wijzigen, hergebruiken of verwijderen. Alleen `deprecated`.
- Nieuw content- of voortgangsformaat = schema-versie + migratie + test.
- Voor elke afgeronde fase: `npm run validate` en `npm test` moeten slagen.
- Nieuwe engine-logica krijgt tests (zeker conjugator, checker, SRS, migraties).
- Geen extra betaalde diensten of API-keys; geen live AI-calls in de app.
- Houd het simpel: geen frameworks of abstracties buiten wat hier staat, tenzij nodig.
- Leerbeleid (limieten, drempels, scores) komt uit `config/app.json`, nooit hardcoded.
- De review-log is append-only. Bestaande entries wijzig of verwijder je nooit.
- Content volgt `docs/style-guide.md`.
- Pilotregel: genereer geen units na `u01` zolang `docs/pilot.md` niet op `Pilot-status: afgerond` staat.
