---
paths:
  - "src/ui/**"
---

# UI-regels

- Mobile-first (uitgangspunt 360px breed), aanraakdoelen minimaal 44px
- Toetsenbord-first: input krijgt autofocus, Enter = controleren, Enter = volgende
- Snel: geen animaties, geen laadspinners voor lokale data, audio van de volgende oefening vooraf laden
- Alle zichtbare tekst uit `src/ui/strings.nl.ts` (Nederlands). Italiaanse tekst komt uit content en krijgt `lang="it"`
- Ondersteun licht en donker via `prefers-color-scheme`
- Geen zware dependencies toevoegen zonder reden; leg de reden vast in de commit
- Elke wijziging aan een scherm of flow: draai `npm run test:e2e` en werk `e2e/` bij volgens `e2e/README.md`. `SessionScreen` houdt de `data-*`-attributen (`data-phase`, `data-pos`, `data-mode`, `data-card-key`, `data-exercise-type`, `data-answered`) kloppend: de rooktest leunt erop
- Instellingen tonen de versie-info (app, commit, content) en de back-upstatus. Home toont de back-upherinnering en het installatieadvies
- Bij een nieuwe app-versie toont de UI een update-banner. Nooit stil vernieuwen
- Tijdens de eindtoets is de hint-knop verborgen
