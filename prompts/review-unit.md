# Prompt: unit reviewen

Wordt gebruikt door de subagent `content-reviewer`, in een verse context. Toets ook aan `docs/style-guide.md`.

## Opdracht
Beoordeel `content/units/<UNIT_ID>.json` en de bijbehorende grammaticales op:

1. **Grammatica**: vervoegingen, lidwoorden (il/lo/la/l'/un/uno/una), geslacht, meervouden, voorzetsels, congruentie
2. **Natuurlijkheid**: zou een moedertaalspreker dit zo zeggen? Let op te letterlijke of stijve zinnen
3. **Register**: tu bij informeel, Lei (3e persoon enkelvoud, met hoofdletter) bij formeel, geen mix binnen een zin of dialoog
4. **Nederlands**: juiste en natuurlijke vertaling, register gespiegeld (je/u), gangbare varianten aanwezig, geen valse vrienden
5. **Consistentie**: `uses` klopt met de zin, geen woorden uit latere units, dialogen zijn samenhangend. Elk item staat in minstens drie zinnen en de eerste zin met een item bevat geen andere nieuwe items
6. **Onregelmatige tabellen**: elke vorm apart nalopen
7. **Spelling**: accenten, apostrofs, dubbele medeklinkers
8. **Grammaticales**: kloppen de uitleg en de vergelijking met het Nederlands, en gebruiken ze de termen uit de stijlgids?
9. **Kan-doelen**: is elk `canDo` concreet, toetsbaar en gedekt door minstens één dialoog of zinnengroep? Worden er kan-doelen beloofd die de content niet waarmaakt?
10. **Stijlgids**: cast en decor, realistische prijzen, `audioText` bij cijfers en symbolen, toon (geen stereotypen)

## Uitvoerformaat
Tabel: `ID | ernst (fout / twijfel / suggestie) | probleem | voorstel`, gesorteerd op ernst.
Sluit af met een oordeel (goedkeuren / goedkeuren na fixes / afkeuren), het aantal gecontroleerde items en wat je niet zeker weet.
Verzin geen problemen: als iets goed is, laat het weg.
