---
paths:
  - "e2e/**"
  - "playwright.config.ts"
---

# Rooktest-regels (Playwright)

- Lees eerst `e2e/README.md`: daar staat per soort app-wijziging welk bestand je aanpast
- Teksten alleen via `S` (`src/ui/strings.nl.ts`), nooit letterlijk. Geen Italiaans en geen content-ID's in tests
- Kennis over de app op één plek: navigatie in `support/app.ts`, sessieflow in `support/session-driver.ts`, opslag in `support/storage.ts`. Specs bevatten geen CSS-selectors of test-ID's; zoeken op een tekst uit `S` mag wel
- Eén spec per functionaliteit in `e2e/smoke/`. Tests zijn onafhankelijk (verse opslag per test)
- Ontbrekende content: `test.skip(voorwaarde, reden)`, niet de test verwijderen
- Console-fouten laten de test falen. Uitzonderingen alleen in `ALLOWED_CONSOLE` met een reden
- Een test aanpassen zodat hij groen wordt mag alleen als het nieuwe gedrag bedoeld is. Bij twijfel: melden, niet de assertie afzwakken
- Nieuwe of gewijzigde test: draai hem met `--repeat-each=3` om instabiliteit uit te sluiten
