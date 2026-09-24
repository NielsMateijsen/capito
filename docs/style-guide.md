# Stijlgids voor content

Uitgangspunt voor alle units. Pas dit bestand aan als je iets anders wilt; agents en reviewers volgen het. Wijzigingen gelden voor nieuwe content. Bestaande content pas je bewust aan.

## Italiaans
- Modern standaarditaliaans, geen dialect of streekwoorden
- Informeel = *tu*. Formeel = *Lei* (3e persoon enkelvoud). De formele aanspreekvorm schrijf je met hoofdletter: *Lei*, *La*, *Le*
- Accenten en apostrofs altijd correct (è, é, à, ò, ù; l'acqua, un po')
- Begroetingen: informeel *ciao*; formeel *buongiorno* (tot de middag) en *buonasera* (vanaf de late middag); *salve* is neutraal
- Zinnen op A1-niveau: bij voorkeur maximaal 8 woorden, alleen presente, geen grammatica die nog niet is behandeld
- Natuurlijk boven letterlijk: kies wat een Italiaan echt zegt
- Geen straattaal, verkleinwoorden of afkortingen die niet zijn behandeld

## Nederlands
- Natuurlijk Nederlands, nooit woord-voor-woord
- Spiegel het register: *tu* wordt je/jij, *Lei* wordt u
- Zet de meest gangbare vertaling eerst in `nl`, daarna de varianten
- Gebruik overal (ook in grammaticales) deze termen:

| Italiaans | Nederlands |
|---|---|
| articolo determinativo / indeterminativo | bepaald / onbepaald lidwoord |
| sostantivo | zelfstandig naamwoord |
| aggettivo | bijvoeglijk naamwoord |
| verbo, infinito | werkwoord, hele werkwoord (infinitief) |
| coniugazione | vervoeging |
| presente | tegenwoordige tijd (presente) |
| soggetto, pronome personale | onderwerp, persoonlijk voornaamwoord |
| maschile / femminile | mannelijk / vrouwelijk |
| singolare / plurale | enkelvoud / meervoud |
| preposizione | voorzetsel |
| aggettivo possessivo | bezittelijk voornaamwoord |
| verbo riflessivo | wederkerend werkwoord |

## Personages en decor
Een vaste cast helpt om zinnen te onthouden.
- **Sam**: Nederlander uit Utrecht, verblijft een tijd in Bologna. Sam is de leerder
- **Giulia** en **Marco**: vrienden van Sam (informeel, tu)
- **Signora Rossi**: verhuurster (formeel, Lei)
- **Luca**: barista en receptionist (formeel of informeel, afhankelijk van de situatie)
- Steden: Bologna, Roma, Milano, Firenze, Napoli. Geen clichés als pizza en mandoline in elke dialoog
- Beroepen wisselen af tussen mannelijke en vrouwelijke vormen

## Getallen, prijzen en tijd
- Schrijf getallen in `it` als woorden, behalve als het scenario cijfers vraagt (prijzen, tijden). Dan staan de cijfers in `it` en staat een uitgeschreven versie in `audioText`
- Prijzen in euro en realistisch (caffè aan de bar ongeveer € 1,20-1,50, cappuccino ongeveer € 1,50-2,00)
- Weekdagen en maanden met kleine letter (*lunedì*, *settembre*)
- Datum als dd/mm, tijd in 24-uursnotatie in tekst en gesproken vorm in `audioText`

## Audio
- Alles wat TTS verkeerd kan uitspreken (cijfers, symbolen, afkortingen) staat uitgeschreven in `audioText`
- Dialoogrol A gebruikt de stem Elsa, B de stem Diego. Laat A daarom een vrouwelijk en B een mannelijk personage zijn (beperking van de MVP)
- Korte zinnen met gewone leestekens geven de beste uitspraak

## Toon en inhoud
- Vriendelijk, praktisch, neutraal. Humor mag, maar is niet nodig
- Geen stereotypen over Italianen, Nederlanders of eten
- Geen politiek of religie
- Realistische situaties: dingen die je echt zou zeggen

## Structuur van een unit
- 2-4 kan-doelen (`canDo`). Elk dialoog of zinnengroep dient minstens één kan-doel
- Twee dialogen van 6-10 regels: dezelfde situatie, één informeel (Sam met Giulia of Marco), één formeel (Sam met signora Rossi of Luca)
- Elk woord en werkwoord komt in minstens drie zinnen voor (`ladder.minSentencesPerItem`), zodat de oefeningen steeds een andere zin kunnen tonen. Elk kernwoord van de unit in minstens twee
- Items worden geleerd in de volgorde waarin ze voor het eerst in de zinnen van de unit voorkomen. De eerste zin met een item is de introductiezin: daarin is dat item het enige nieuwe item (de andere items uit `uses` zijn al eerder in de unit of in een eerdere unit gebruikt)
- Elk item uit `uses` staat letterlijk in de zin: een woord in zijn `it`-vorm (of meervoud), een werkwoord als infinitief of vervoegde vorm uit de behandelde tijden
- Nieuwe units hergebruiken personages en woorden uit eerdere units
