# Capito: Italiaans leren-app

Persoonlijke PWA om Italiaans te leren (Nederlandstalig, niveau A1). Volledige spec: `SPEC.md`; lees de relevante sectie of fase vóór je een feature bouwt. Overzicht voor mensen: `README.md`.

## Commando's
- Runtime: Node ≥20.19 (`.nvmrc`); TypeScript-scripts draaien via `tsx`
- `npm run dev` / `build` / `typecheck`
- `npm test` (moet `vitest run` zijn, geen watch-modus)
- `npm run validate` (content) · `npm run audio` · `npm run coverage` · `npm run reports`
- `npm run stats -- <export.json>` (statistieken uit een back-up, voor de pilot)
- `npm run test:e2e` (Playwright)

## Harde regels
1. Geen Italiaanse woorden of zinnen in `src/`. Alleen in `content/`. UI-teksten alleen in `src/ui/strings.nl.ts`.
2. ID's nooit wijzigen, hergebruiken of verwijderen. Alleen `"deprecated": true`.
3. Formaatwijziging = schema-versie ophogen + migratie + test (content én voortgang).
4. Geen live AI-calls, geen betaalde diensten, geen API-keys.
5. `src/engine/` bestaat uit pure functies: geen DOM, geen localStorage.
6. Nieuwe logica krijgt een test. Een bugfix begint met een falende test.
7. Twijfel over Italiaans (grammatica, vervoeging, natuurlijkheid)? Verzin niets. Zet `review.status` op `draft` en meld het.
8. `tests/golden/` bevat door de gebruiker gecontroleerd Italiaans. Nooit aanpassen zonder expliciete toestemming.
9. Leerbeleid (limieten, drempels, scores, intervallen) komt uit `config/app.json`, nooit hardcoded.
10. De review-log is append-only. Wijzig of verwijder nooit bestaande entries. Kaartstatus moet altijd opnieuw uit de log te berekenen zijn.
11. Content volgt `docs/style-guide.md` en elke unit heeft `canDo`-kan-doelen.
12. Pilotregel: genereer geen units na `u01` zolang `docs/pilot.md` niet op `Pilot-status: afgerond` staat.

## Definition of done
- `typecheck`, `validate` en `test` zijn groen (de Stop-hook controleert dit)
- Nieuwe logica is getest, nieuwe content valideert
- `README.md` en/of `SPEC.md` zijn bijgewerkt als structuur of afspraken veranderden
- Kleine, duidelijke commit op een branch
- Bij een nieuw of gewijzigd opslagformaat: schema-versie, migratie, migratietest en een werkende export/import-roundtrip
- Stop je toch met een falende check? Meld dat expliciet in je samenvatting.

## Werkwijze
- Raakt een taak meer dan 2 bestanden of is hij onduidelijk: eerst een plan maken en op akkoord wachten.
- Werk op een branch (`feat/...`, `content/...`, `fix/...`), nooit direct op `main`. Pushen en mergen doet de gebruiker.
- Commits in het Engels, Conventional Commits (`feat:`, `fix:`, `content:`, `test:`, `docs:`).
- Werk in kleine stappen en draai de tests vaak.
- Gebruik de subagents en skills hieronder in plaats van het zelf uit het hoofd te doen.

## Taal
Praat met de gebruiker in het Nederlands. Code, comments en commit-berichten in het Engels.

## Subagents en skills
| Doel | Gebruik |
|---|---|
| Nieuwe unit end-to-end | skill `/new-unit <unit-id>` |
| Gemelde fouten verwerken | skill `/process-reports <pad>` |
| Nieuw oefentype toevoegen | skill `/add-exercise-type <naam>` |
| Content schrijven of uitbreiden | subagent `content-generator` |
| Content controleren (verse context, alleen lezen) | subagent `content-reviewer` |
| Code reviewen vóór merge | subagent `code-reviewer` |

Pad-specifieke regels staan in `.claude/rules/` (content, engine, ui) en laden vanzelf.

## Hooks (automatisch, niet omzeilen)
- `guard`: blokkeert `rm -rf` buiten bouwmappen, force-push, push naar main, `reset --hard` en handmatige edits aan `content/id-registry.json`
- `post-edit`: valideert content direct na elke edit
- `stop-check`: draait typecheck, validate en test voordat je mag stoppen (bij wijzigingen)

Faalt een hook? Los de oorzaak op. Schakel hooks nooit uit en werk er niet omheen.

## Leren van fouten
Herhaalt zich een fout of reviewcommentaar? Stel voor om een regel toe te voegen aan dit bestand of aan `.claude/rules/`. Houd dit bestand onder de 200 regels.
