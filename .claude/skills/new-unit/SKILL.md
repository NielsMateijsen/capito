---
name: new-unit
description: Maakt een complete nieuwe leerunit end-to-end (genereren, valideren, onafhankelijk reviewen, audio, coverage). Gebruik wanneer de gebruiker een nieuwe unit of scenario wil, of /new-unit aanroept met een unit-ID uit SPEC.md §9.
---

# Nieuwe unit maken

Argument: `$ARGUMENTS` (unit-ID zoals `u03_ordering`). Ontbreekt het, vraag dan welke unit uit `SPEC.md` §9.

## Pilotpoort (eerst controleren)
Lees `docs/pilot.md`. Is de unit niet `u01_greetings` en staat er niet `Pilot-status: afgerond`, stop dan. Meld dat units na unit 1 pas worden gemaakt na de pilotweek, en verwijs naar `docs/pilot.md`.

## Stappen
1. Controleer dat de vorige unit bestaat in `content/units/` (behalve bij unit 1) en dat `content/units/<unit-id>.json` nog niet bestaat.
2. Maak een branch `content/<unit-id>`.
3. Zoek scenario, grammatica en werkwoorden voor deze unit op in `SPEC.md` §9 en de kernwoordenquota in `SPEC.md` §8 en `content/core-words.json`. Formuleer 2-4 kan-doelen (`canDo`) voor het scenario en leg ze voor aan de gebruiker als er twijfel is.
4. Laat subagent **content-generator** de unit schrijven, met deze parameters, de kan-doelen en `docs/style-guide.md`.
5. Draai `npm run validate -- --update-registry`. Laat fouten door content-generator repareren.
6. Laat subagent **content-reviewer** de unit beoordelen. Geef alleen het pad mee, geen eigen mening over de kwaliteit (verse context).
7. Laat content-generator alle bevindingen met ernst *fout* repareren. Herhaal stap 5 en 6, maximaal 2 rondes.
8. Draai `npm run audio` (als Python en `edge-tts` beschikbaar zijn; anders overslaan en melden).
9. Draai `npm run coverage` en noteer welke frequente woorden nog ontbreken.
10. Commit met `content: add <unit-id>`.

## Teruggeven aan de gebruiker
- Aantallen (woorden, zinnen, dialogen), kan-doelen en geïntroduceerde kernwoorden
- Welke dialoog welk kan-doel dekt
- Openstaande *twijfel*-punten van de reviewer (ID + reden)
- Voorstel voor een steekproef van ~20 zinnen om zelf na te lopen
- Zet `review.status` **niet** op `reviewed`; dat doet de gebruiker na de steekproef
