---
paths:
  - "src/engine/**"
  - "src/exercises/**"
  - "src/storage/**"
---

# Engine-regels

- Pure functies, deterministisch en zonder DOM. Opslag (IndexedDB) alleen via de asynchrone `ProgressStorage`-interface in `src/storage/`
- Elk bestand krijgt een testbestand ernaast (`x.test.ts`). Bugfix = eerst een falende test
- Conjugator en checker worden getest tegen `tests/golden/`. Die bestanden zijn de bron van waarheid en mag je niet aanpassen zonder toestemming
- Geen Italiaanse woorden of zinnen in code of tests, behalve in `tests/golden/` en test-fixtures
- Oefentypes: één bestand per type in `src/exercises/`, conform de interface in `SPEC.md` §5. Geen aanpassingen in de SRS of sessie-builder nodig voor een nieuw type
- `cardKey`-formaat is stabiel: `<type>:<itemId>[:<variant>]`. Wijzig het nooit voor bestaande types (dat breekt voortgang)
- Wijziging aan het voortgangsformaat: schema ophogen, migratie schrijven en een migratietest toevoegen
- Typfouttolerantie staat uit bij vervoegingen, lidwoorden en cloze
- Leerbeleid (limieten, drempels, scores, intervallen) komt uit `config/app.json`. Nooit getallen hardcoden in de engine
- Review-log: append-only. Elk antwoord wordt gelogd met alle velden uit `SPEC.md` §5. Nooit bestaande entries wijzigen of verwijderen
- `rebuildCards(log, config)` moet uit de log dezelfde kaartstatus opleveren als de live status. Houd de test daarvoor groen
- Sessie-builder: schrijf tests voor de limieten (sessielengte, achterstand, terugkeer na pauze, leech, mix met oude stof)
