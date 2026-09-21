---
name: add-exercise-type
description: Voegt een nieuw oefentype toe aan de app volgens de exercise-interface (bestand, tests, UI, docs). Gebruik wanneer de gebruiker een nieuwe oefenvorm wil of /add-exercise-type aanroept met een naam.
---

# Nieuw oefentype toevoegen

Argument: `$ARGUMENTS` (naam van het type, kebab-case, bijvoorbeeld `listen-choose`).

## Stappen
1. Lees `SPEC.md` §5 (Oefentypes, cards, checker) en een bestaand type in `src/exercises/` als voorbeeld.
2. Maak een plan (plan mode): welke content-velden het type gebruikt, het `cardKey`-formaat, of typfouttolerantie aan of uit moet (uit bij vervoegingen, lidwoorden en cloze) en of er UI-werk nodig is. Wacht op akkoord van de gebruiker.
3. Maak een branch `feat/exercise-<naam>`.
4. Schrijf eerst de tests in `src/exercises/<naam>.test.ts`: cards genereren, `build`, `check` (correct, almost, wrong), en dat het `cardKey`-formaat `<type>:<itemId>[:<variant>]` volgt.
5. Implementeer `src/exercises/<naam>.ts`. Het register pakt het automatisch op; pas de SRS of sessie-builder niet aan.
6. Voeg indien nodig de UI-component toe in `src/ui/`, met teksten in `src/ui/strings.nl.ts`.
7. Voeg het type toe aan de Playwright-rooktest als het een eigen scherm heeft.
8. Werk de lijst met oefentypes bij in `SPEC.md` §5 en `README.md`.
9. Laat subagent **code-reviewer** de wijziging beoordelen en verwerk blokkerende punten.
10. Commit met `feat: add <naam> exercise type`.

## Teruggeven aan de gebruiker
Wat het type doet, welke content het gebruikt, de bevindingen van de reviewer en hoe je het uitprobeert.
