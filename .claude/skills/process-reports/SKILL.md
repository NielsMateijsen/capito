---
name: process-reports
description: Verwerkt foutmeldingen die de gebruiker uit de app heeft geëxporteerd (JSON) naar correcties in content/. Gebruik wanneer de gebruiker gemelde fouten wil laten oplossen of /process-reports aanroept met het pad naar het exportbestand.
---

# Foutmeldingen verwerken

Argument: `$ARGUMENTS` (pad naar het geëxporteerde meldingenbestand). Ontbreekt het, vraag ernaar.

## Stappen
1. Maak een branch `fix/reports-<datum>`.
2. Draai `npm run reports -- <pad>` voor een leesbare lijst. Groepeer per ID.
3. Behandel elke melding per `kind`:
   - `wrong-content`: onderzoek het item. Klopt de melding, corrigeer dan onder **hetzelfde ID**. Verandert de betekenis wezenlijk, maak dan een nieuw ID en zet het oude op `deprecated`.
   - `also-correct`: beoordeel of het antwoord van de gebruiker echt goed is. Zo ja, voeg het toe als variant in `nl` (of het juiste veld). Zo nee, leg uit waarom niet.
   - `audio`: verwijder niets handmatig. Draai `npm run audio` opnieuw voor het item en meld als het probleem in de tekst zit.
4. Twijfel je over Italiaanse correctheid, laat dan subagent **content-reviewer** de gewijzigde items controleren.
5. Draai `npm run validate` en `npm test`.
6. Commit per soort wijziging, bijvoorbeeld `content: fix reported items`.

## Teruggeven aan de gebruiker
Een tabel per melding: `ID | melding | actie | reden`. Markeer wat je niet zeker weet of afwees, zodat de gebruiker daarover beslist.
