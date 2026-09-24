---
paths:
  - "content/**"
  - "prompts/**"
  - "docs/style-guide.md"
---

# Content-regels

Formaat en velden: zie `SPEC.md` §4. Elk bestand heeft `"schema": 1`. Inhoudelijke stijl: `docs/style-guide.md` (personages, Lei met hoofdletter, prijzen, Nederlandse termen). Volg die altijd.

## ID's
- Woord `w_<italiaans_zonder_accenten>` (bij homoniemen `w_ora_time`), zin `s_uNN_NNN`, dialoog `d_uNN_informal|formal`, werkwoord `v_<infinitief>`, unit `uNN_<slug>`, grammatica `g_<onderwerp>`
- Nooit wijzigen, hergebruiken of verwijderen. Alleen `"deprecated": true`
- `content/id-registry.json` nooit handmatig bewerken. Gebruik `npm run validate -- --update-registry`

## Inhoud
- Niveau A1: korte, hoogfrequente zinnen, geen grammatica die nog niet is behandeld
- Elke unit heeft `canDo`: 2-4 kan-doelen in het Nederlands. Elk kan-doel wordt gedekt door minstens één dialoog of zinnengroep
- Elke zin heeft `uses`, en die verwijst alleen naar woorden/werkwoorden uit de huidige of eerdere units
- Zelfstandige naamwoorden altijd met `article` en `gender`. `plural` alleen bij onregelmatige meervouden
- Regelmatige werkwoorden: alleen `conj`, geen vormen. Onregelmatige werkwoorden: volledige tabel, exact geschreven
- Register: formeel = Lei (3e persoon enkelvoud), informeel = tu. Elke zin en dialoog heeft een `register`
- Nederlands: natuurlijke vertaling, geen woord-voor-woord. Zet gangbare varianten in de `nl`-lijst
- Cijfers, symbolen en afkortingen in `it`: zet een uitgeschreven `audioText` erbij

## Kwaliteit
- Nieuwe content start met `review.status: "draft"`. Alleen de gebruiker zet dit op `reviewed`
- Twijfel over correctheid of natuurlijkheid? Niet verzinnen: houd `draft` en noem het in je samenvatting
- Elk woord en werkwoord komt in minstens drie zinnen voor, elk kernwoord van de unit in minstens twee
- De eerste zin met een item (introductiezin) bevat geen andere nieuwe items. Elk item uit `uses` staat letterlijk in de zin (zie `docs/style-guide.md`)
