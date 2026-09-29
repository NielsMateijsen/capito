# Pilot: unit 1 en 2 een week gebruiken

Pilot-status: nog niet gestart
<!-- Toegestane waarden: nog niet gestart | bezig | afgerond -->

## Doel
Voordat units 3-10 worden gegenereerd, controleren of de app en de didactiek werken: het lessenpad, opfrissen en de eindtoets. Content opnieuw genereren kost veel meer dan de aanpak bijstellen.

Oorspronkelijk ging de pilot alleen over unit 1. Met het lessenpad is unit 2 erbij gekomen: unit 1 heeft maar een paar lessen, en zonder tweede unit test je de overgang via de eindtoets en het herhalen in latere lessen niet.

## Opzet
- Unit 1 (begroeten) en unit 2 (kennismaken) volledig: echte content, audio, review en stijlgids toegepast
- App gedeployd en als PWA op je telefoon geïnstalleerd
- Een week lang in je eigen tempo lessen doen met "Verder", opfrissen als de app erom vraagt, en de eindtoetsen van unit 1 en 2 maken

## Succescriteria (alle drie moeten kloppen)
| # | Criterium | Meting | Doel |
|---|---|---|---|
| 1 | Snel en prettig | Mediane sessieduur uit `npm run stats`, plus je eigen gevoel | ≤ 10 minuten, en geen "dit is saai/traag/vervelend" |
| 2 | Volhouden | Aantal dagen met een afgeronde les of opfrisronde in 7 dagen (de streak op Home) | ≥ 5 van 7 |
| 3 | Leert echt | Eindtoets unit 1 en unit 2 zonder hints, na de lessen | allebei ≥ 80% |

Vervolgcheck (nog geen criterium, wel noteren): gebruik je de app na 2 weken nog steeds?

## Bewaakpunten (bespreken, geen criterium)
- Voelt het lessenpad leuk, of voelt het als steeds hetzelfde herhalen?
- Klopt de lesgrootte (3 nieuwe woorden)? Zijn lessen te kort of te lang?
- Gebruik je opfrissen? Komt de melding "woorden dreigen weg te zakken" op een goed moment?
- Motiveren de streak en "perfecte les", of maakt het niet uit?
- Aandeel items dat je als inhoudelijke fout meldt (meer dan 5%: generator-prompt of stijlgids aanpassen)
- Welke oefentypes vind je irritant of nutteloos?
- Zijn antwoorden nog te raden?
- Klopt de audio (uitspraak, tempo, stem)?
- Is de grammaticales duidelijk zonder extra uitleg?
- Voelen de kan-doelen van unit 1 en 2 als echt bruikbaar?

## Dagboek
| Dag | Lessen | Opfrissen | Gevoel (1-5) | Opmerkingen |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |

## Evaluatie (na 7 dagen)
1. Maak een back-up (Instellingen) en draai `npm run stats -- capito-backup-<datum>.json`
2. Vul in:
   - Mediane sessieduur: ___ min
   - Dagen met een les of opfrisronde: ___ / 7
   - Eindtoets unit 1: ___ % · unit 2: ___ %
   - Gemelde fouten: ___ van ___ items
   - Gevoel (1-5): ___
3. Besluit:
   - **Alle drie gehaald:** zet `Pilot-status: afgerond` en ga naar fase 7b
   - **Niet alle drie:** stuur bij volgens de tabel hieronder, herhaal de pilot (een week) en beslis opnieuw

| Mislukt criterium | Waarschijnlijke oorzaak | Bijsturen |
|---|---|---|
| 1 Snel en prettig | Lessen te lang, te veel herhaling per les, traagheid in de UI | `lesson.itemsPerLesson`, `lesson.maxReviewsPerLesson` of `lesson.newReviewCardsPerLesson` verlagen; UI-vertragingen opsporen; oefenmix vereenvoudigen |
| 2 Volhouden | Te veel frictie om te starten, geen vaste routine, saai | Home vereenvoudigen, lessen korter, vaste tijd kiezen, oefenmix variëren, `refresh.prominentAboveDueItems` bijstellen |
| 3 Leert echt | Te snel door de lessen, te weinig herhaling, uitleg onduidelijk | `lesson.maxReviewsPerLesson` verhogen, `lesson.itemsPerLesson` verlagen, grammaticales herschrijven, kan-doelen scherper, generator-prompt aanpassen |

## Besluit en datum
_(invullen)_
