# Prompt: unit genereren

Wordt gebruikt door de subagent `content-generator`. De aanroeper vult de parameters in. Volg altijd `docs/style-guide.md`.

## Parameters
- `UNIT_ID`, `ORDER`, `TITLE`
- `SCENARIO`: situatie waarin de leerder Italiaans gebruikt (uit SPEC §9)
- `CAN_DO`: 2-4 kan-doelen in het Nederlands ("Ik kan een koffie bestellen en afrekenen")
- `GRAMMAR_FOCUS`: grammaticaonderwerpen en werkwoorden van deze unit
- `TARGET_WORDS`: 20-25 scenariowoorden
- `CORE_WORDS`: kernwoorden om in deze unit te introduceren (uit `content/core-words.json`)
- `KNOWN`: alle woord- en werkwoord-ID's uit eerdere units (mag in zinnen worden gebruikt)

## Opdracht
Schrijf één bestand `content/units/<UNIT_ID>.json` volgens het schema in SPEC §4 (`"schema": 1`) met:
- `canDo`: de kan-doelen uit `CAN_DO`
- `words`: de scenariowoorden plus de kernwoorden van deze unit
- `verbs`: alleen de werkwoorden uit `GRAMMAR_FOCUS` (regelmatig = alleen `conj`, onregelmatig = volledige presente-tabel)
- `sentences`: 30-40 zinnen
- `dialogues`: precies twee, een informele (tu) en een formele (Lei), elk 6-10 regels, dezelfde situatie, samen dekkend voor alle kan-doelen
- `grammar`: verwijzingen naar de grammaticales van deze unit (de lessen zelf zijn aparte `.md`-bestanden in `content/grammar/`; schrijf ze ook, kort en met vergelijking met het Nederlands, in de termen uit de stijlgids)
- `review`: `{ "status": "draft" }`

## Eisen
- Werk vanuit de kan-doelen: elk dialoog of zinnengroep dient minstens één kan-doel
- Niveau A1: korte zinnen (bij voorkeur maximaal 8 woorden), hoogfrequent en praktisch
- Elk woord komt voor in minstens één zin, elk kernwoord in minstens twee
- Elke zin staat op `uses` met alleen woorden uit deze unit of `KNOWN`
- Zinnen moeten de grammaticafocus oefenen, maar mogen geen nog niet behandelde grammatica bevatten (alleen presente)
- Elk zelfstandig naamwoord heeft `article` en `gender`; `plural` alleen bij onregelmatig
- `register` klopt per zin (formeel = Lei met hoofdletter, informeel = tu, anders neutral)
- Nederlandse vertalingen zijn natuurlijk, register gespiegeld (je/u), met gangbare varianten in de `nl`-lijst
- Cijfers, symbolen en afkortingen in `it` krijgen een uitgeschreven `audioText`
- Voeg een paar zinnen toe met `cloze`-doelen op de vervoegingen van deze unit
- Gebruik de vaste cast en het decor uit de stijlgids
- ID-conventies: zie `.claude/rules/content.md`

## Uitvoer
Alleen het bestand (en de grammaticales). Geef daarna een korte lijst met twijfelpunten (ID + reden) en een tabel `kan-doel → dialoog/zinnen die het dekken`.
