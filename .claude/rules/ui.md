---
paths:
  - "src/ui/**"
---

# UI-regels

- Mobile-first (uitgangspunt 360px breed), aanraakdoelen minimaal 44px
- Toetsenbord-first: input krijgt autofocus, Enter = controleren, Enter = volgende
- Snel: geen laadspinners voor lokale data, audio van de volgende oefening vooraf laden. Animaties volgens `SPEC.md` §1
- Gebruik alleen tokens uit theme.css (geen hex-waarden, px-maten of animatieduren in componenten). Iconen alleen via icons.ts. Knoppen met alleen een icoon krijgen een aria-label uit strings.nl.ts. Animaties volgen SPEC §1 en blokkeren nooit invoer.
- Alle zichtbare tekst uit `src/ui/strings.nl.ts` (Nederlands). Italiaanse tekst komt uit content en krijgt `lang="it"`
- Ondersteun licht en donker via `prefers-color-scheme`
- Geen zware dependencies toevoegen zonder reden; leg de reden vast in de commit
- Elke wijziging aan een scherm of flow: draai `npm run test:e2e` en werk `e2e/` bij volgens `e2e/README.md`. `SessionScreen` houdt de `data-*`-attributen (`data-phase`, `data-pos`, `data-mode`, `data-card-key`, `data-exercise-type`, `data-result`, `data-answered`, en op opties `data-option`/`data-state`) kloppend: de rooktest leunt erop
- Instellingen tonen de versie-info (app, commit, content) en de back-upstatus. Home toont de back-upherinnering en het installatieadvies
- Bij een nieuwe app-versie toont de UI een update-banner. Nooit stil vernieuwen
- Tijdens de eindtoets is de hint-knop verborgen
