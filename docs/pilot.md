# Pilot: unit 1 een week gebruiken

Pilot-status: nog niet gestart
<!-- Toegestane waarden: nog niet gestart | bezig | afgerond -->

## Doel
Voordat units 2-10 worden gegenereerd, controleren of de app en de didactiek werken. Content opnieuw genereren kost veel meer dan de aanpak bijstellen.

## Opzet
- Alleen unit 1 (begroeten) volledig: echte content, audio, review en stijlgids toegepast
- App gedeployd en als PWA op je telefoon geïnstalleerd
- Een week lang dagelijks de sessie "Vandaag" doen, en aan het eind de eindtoets van unit 1

## Succescriteria (alle drie moeten kloppen)
| # | Criterium | Meting | Doel |
|---|---|---|---|
| 1 | Snel en prettig | Mediane sessieduur uit `npm run stats`, plus je eigen gevoel | ≤ 10 minuten, en geen "dit is traag/vervelend" |
| 2 | Volhouden | Aantal dagen met een sessie in 7 dagen | ≥ 5 van 7 |
| 3 | Leert echt | Eindtoets unit 1 zonder hints | ≥ 80% |

Vervolgcheck (nog geen criterium, wel noteren): gebruik je de app na 2 weken nog steeds?

## Bewaakpunten (bespreken, geen criterium)
- Aandeel items dat je als inhoudelijke fout meldt (meer dan 5%: generator-prompt of stijlgids aanpassen)
- Welke oefentypes vind je irritant of nutteloos?
- Zijn antwoorden nog te raden?
- Klopt de audio (uitspraak, tempo, stem)?
- Is de grammaticales duidelijk zonder extra uitleg?
- Voelen de kan-doelen van unit 1 als echt bruikbaar?

## Dagboek
| Dag | Sessies | Gevoel (1-5) | Opmerkingen |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |

## Evaluatie (na 7 dagen)
1. Maak een back-up (Instellingen) en draai `npm run stats -- capito-backup-<datum>.json`
2. Vul in:
   - Mediane sessieduur: ___ min
   - Dagen gebruikt: ___ / 7
   - Eindtoets unit 1: ___ %
   - Gemelde fouten: ___ van ___ items
   - Gevoel (1-5): ___
3. Besluit:
   - **Alle drie gehaald:** zet `Pilot-status: afgerond` en ga naar fase 7b
   - **Niet alle drie:** stuur bij volgens de tabel hieronder, herhaal de pilot (een week) en beslis opnieuw

| Mislukt criterium | Waarschijnlijke oorzaak | Bijsturen |
|---|---|---|
| 1 Snel en prettig | Sessies te lang, te veel nieuwe kaarten, traagheid in de UI | `session.maxReviewsPerSession` en `newCardsPerDay` verlagen; UI-vertragingen opsporen; oefenmix vereenvoudigen |
| 2 Volhouden | Te veel frictie om te starten, geen vaste routine, saai | Home vereenvoudigen (één knop), sessie korter, vaste tijd kiezen, oefenmix variëren |
| 3 Leert echt | Te veel nieuwe stof per dag, te weinig herhaling, uitleg onduidelijk | `newCardsPerDay` verlagen, grammaticales herschrijven, kan-doelen scherper, generator-prompt aanpassen |

## Besluit en datum
_(invullen)_
