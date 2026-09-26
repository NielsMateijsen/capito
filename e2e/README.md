# Rooktest (Playwright)

Snelle end-to-end-controle of de belangrijkste flows van de app nog werken: starten, navigeren, instellingen, elke oefenvorm, een dagelijkse sessie, een unit en fouten melden. Draait tegen de productiebuild (`vite preview`) in Chromium op 360 px breed (mobile-first).

```sh
npm run test:e2e                       # alles (bouwt eerst de app)
npx playwright test e2e/smoke/unit.spec.ts   # één bestand
npx playwright test -g "dialogue"      # op naam filteren
npx playwright show-report             # rapport van de laatste run
npx playwright show-trace test-results/<test>/trace.zip   # stap voor stap terugkijken na een fout
```

Eerste keer lokaal: `npx playwright install chromium`. De test bouwt altijd de huidige code en start een eigen preview op poort 4175, los van `npm run preview` (4173). Een oude build testen kan dus niet. In CI hergebruikt hij de build uit de stap ervoor.

Lokaal en in CI gedraagt de test zich hetzelfde: service workers staan uit en mp3's worden geweigerd (in CI bestaan ze niet, want `public/audio/` staat niet in git). De app valt dan terug op spraaksynthese.

## Opbouw

| Pad | Inhoud |
|---|---|
| `smoke/*.spec.ts` | Eén bestand per functionaliteit. Beschrijft **wat** er moet werken |
| `support/app.ts` | `App`: hoe je bij een scherm komt (knoppen, koppen, navigatie) |
| `support/session-driver.ts` | `runSession()`: speelt elke sessie uit tot het eindscherm, ongeacht welke kaarten erin zitten |
| `support/storage.ts` | Leest de opgeslagen voortgang uit IndexedDB. Enige plek die het opslagformaat kent |
| `support/exercise-types.ts` | Leest de geregistreerde oefentypes uit `src/exercises/` |
| `support/fixtures.ts` | `test` met de `app`-fixture en de console-bewaker: elke `console.error` of crash laat de test falen (met een allowlist mét reden) |

## Afspraken

- **Teksten alleen via `S`** uit `src/ui/strings.nl.ts` (geïmporteerd via `support/app.ts`). Nooit een label letterlijk in een test. Verandert een tekst, dan blijft de test werken.
- **Geen Italiaans en geen content-ID's in tests.** Tests kiezen "de eerste unit", "de eerste dialoog" enz. Zo overleven ze nieuwe of gewijzigde content.
- **Sessies volgen via `data-*`-attributen** op `[data-testid="session"]`: `data-phase`, `data-pos`, `data-mode`, `data-card-key`, `data-exercise-type`, en `data-answered` op het eindscherm. Wijzig je `SessionScreen.tsx`, houd deze attributen dan kloppend.
- **Specs bevatten geen CSS-selectors of test-ID's.** Alles wat de plek van iets op een scherm kent, staat in `support/app.ts`. Zoeken op een tekst uit `S` (`getByText`, `getByLabel`) mag wel in een spec.
- **Toetsenbordmodus controleert ook de focus.** Vóór elke toets wacht de driver tot de focus binnen de sessie staat; staat hij daar niet, dan faalt de test met "focus is not inside the session".
- **Elke test begint schoon:** Playwright geeft elke test een eigen browsercontext, dus een lege IndexedDB. Tests zijn onafhankelijk en draaien parallel.
- **Ontbreekt content voor een flow** (bijvoorbeeld nog geen grammatica), gebruik dan `test.skip(voorwaarde, 'reden')` in plaats van de test weg te laten. Zodra de content er is, draait hij vanzelf.
- **Controleer gedrag, niet de opmaak.** Liever `getByRole`/`getByTestId` dan CSS-klassen; CSS-klassen alleen waar geen rol of tekst bestaat.

## Wat pas je aan als de app verandert?

| Verandering in de app | Aanpassen in `e2e/` |
|---|---|
| Label of knoptekst | Niets (komt uit `S`) |
| Route naar een scherm (andere knop, ander menu) | Alleen de methode in `support/app.ts` |
| Nieuw oefentype met bestaande vraagvorm (keuzelijst, tekstveld, flashcard) | Niets: `exercise-types.spec.ts` pakt het via de testsessie automatisch op. Wel moet er content zijn waarvan een kaart van dat type te bouwen is, anders faalt de test (terecht). Het `id` moet gelijk zijn aan de bestandsnaam; `tests/exercises/index.test.ts` bewaakt dat |
| Nieuw oefentype met een nieuwe vraagvorm | `answerQuestion()` in `support/session-driver.ts` uitbreiden. De driver geeft een foutmelding die hiernaar verwijst |
| Nieuwe sessiefase in `SessionScreen.tsx` | Een tak in `runSession()` toevoegen. Ook hier wijst de foutmelding de weg |
| Opslagformaat (sleutel, database) | Alleen `support/storage.ts` |
| Nieuw scherm of nieuwe functionaliteit | Navigatie in `support/app.ts`, en een nieuw `smoke/<functionaliteit>.spec.ts` |
| Verwachte console-melding (bijvoorbeeld een bekende waarschuwing) | Entry in `ALLOWED_CONSOLE` in `support/fixtures.ts`, mét reden |

## Een flow toevoegen

1. Bestaat er nog geen methode om bij het scherm te komen, zet die in `support/app.ts`.
2. Maak `smoke/<functionaliteit>.spec.ts`, importeer `test`/`expect` uit `../support/fixtures.ts` en `S` uit `../support/app.ts`.
3. Test het pad van de gebruiker (openen → iets doen → resultaat zien, liefst ook na `app.reload()` als het om opslaan gaat).
4. Draai `npm run test:e2e` en daarna een paar keer `npx playwright test <bestand> --repeat-each=3` om te zien of hij stabiel is.

## Een falende rooktest

Eerst uitzoeken of de **app** of de **test** fout zit: bekijk de screenshot en trace in `test-results/`. Klopt het nieuwe gedrag, pas dan de test aan (op de plek uit de tabel hierboven). Is het een bug, dan is de falende rooktest je reproductie (harde regel 6): fix de app en laat de test groen worden.
