# Capito

Persoonlijke webapp (PWA) om Italiaans te leren als Nederlandstalige beginner (A1). Sneller dan Duolingo, met nadruk op grammatica en vervoegingen, getypte oefeningen (niet te raden), spaced repetition en audio. Alles draait in de browser: geen accounts, geen kosten.

**Spec:** `SPEC.md` · **Afspraken voor agents:** `CLAUDE.md`

## Hoe het werkt

```
content/ (JSON + Markdown)  →  validate  →  audio genereren  →  app bouwt oefeningen uit de content
```

- **Content is data, code is engine.** Woorden, zinnen, units en grammatica staan in `content/`. De code in `src/` kent geen Italiaans.
- **Elke oefening is een "card"** met een sleutel (`conjugate:v_parlare:presente:noi`). De SRS houdt per sleutel bij wanneer je iets weer moet zien.
- **Leerladder:** een nieuw woord of werkwoord maak je eerst mee in een zin (onderstreept, met audio, lidwoord en formeel/informeel). Daarna volgen de treden: de zin begrijpen (meerkeuze), het woord kiezen in een zin (meerkeuze), het woord typen in een zin, en zelf vertalen van NL naar IT. Elke keer staat het woord in een andere zin. Een item stijgt hooguit twee treden per dag, dus in een sessie lopen de treden door elkaar. De volgorde in een sessie is willekeurig. Na de laatste trede gaat het woord naar de gewone herhaling (zie `SPEC.md` §5 "Leerladder").
- **Voortgang en review-log** (elk antwoord, append-only) staan lokaal in je browser (IndexedDB). De kaartstatus wordt uit de log afgeleid.
- **Back-up:** installeer de app op je beginscherm en maak elke ~2 weken een export (de app herinnert je eraan). Zonder back-up kan de browser je data wissen.
- **Versiestempel:** Instellingen toont app-versie, commit en content-versie. Die staan ook in elke export en foutmelding.

## Mappen

| Map | Inhoud |
|---|---|
| `content/units/` | Eén JSON per unit (woorden, zinnen, dialogen, werkwoorden) |
| `content/tenses/` | Werkwoordstijden (nu: presente) |
| `content/grammar/` | Grammaticales in Markdown |
| `content/id-registry.json` | Alle ID's die ooit bestonden (niet handmatig bewerken) |
| `src/engine/` | Conjugator, antwoordcontrole, SRS, leerladder, zinnen en afleiders, sessie-opbouw, ontgrendelen |
| `src/exercises/` | Eén bestand per oefentype, vanzelf geregistreerd |
| `src/storage/` | Voortgang opslaan + migraties |
| `src/ui/` | Schermen; alle tekst in `strings.nl.ts` |
| `scripts/` | validate, audio, coverage, reports |
| `prompts/` | Prompts voor het genereren en reviewen van content |
| `docs/` | `style-guide.md` (stijlgids content) en `pilot.md` (pilotweek, succescriteria, besluit) |
| `tests/golden/` | Door mij gecontroleerde vervoegingen (bron van waarheid) |
| `config/app.json` | Alle drempels (nieuwe woorden per dag, treden van de ladder, ontgrendelpercentage, ...) |
| `.claude/` | Agent-setup (zie hieronder) |

## Commando's

`npm run dev` · `build` · `typecheck` · `test` · `validate` · `audio` · `coverage` · `reports` · `stats` · `test:e2e`

## Agent-setup: wie doet wat

| Onderdeel | Bestand | Doel |
|---|---|---|
| Afspraken | `CLAUDE.md` | Regels, commando's en werkwijze die elke sessie geladen zijn |
| Regels per map | `.claude/rules/` | Extra regels voor `content/`, `src/engine/` en `src/ui/` |
| Hooks | `.claude/hooks/` | `guard` blokkeert gevaarlijke acties, `post-edit` valideert content, `stop-check` draait typecheck + validate + test voordat Claude stopt |
| Permissions | `.claude/settings.json` | Wat zonder vragen mag en wat nooit |
| Subagents | `.claude/agents/` | `content-generator`, `content-reviewer` (alleen lezen), `code-reviewer` (alleen lezen) |
| Skills | `.claude/skills/` | `/new-unit`, `/process-reports`, `/add-exercise-type` |
| CI | `.github/workflows/` | `ci.yml` test elke PR; `deploy.yml` zet de app online (nog handmatig) |

## Veelgebruikte workflows

- **Nieuwe unit:** `/new-unit u03_ordering` (pas na de pilot) → steekproef van ~20 zinnen → zelf `review.status` op `reviewed`
- **Pilot evalueren:** back-up exporteren → `npm run stats -- capito-backup-<datum>.json` → invullen in `docs/pilot.md`
- **Fouten uit de app:** exporteer meldingen → `/process-reports pad/naar/export.json`
- **Nieuwe feature:** plan mode → branch → CI groen → `code-reviewer` → zelf mergen
- **Nieuw oefentype:** `/add-exercise-type naam`
- **Woorden toevoegen:** JSON aanpassen (of content-generator vragen) → `npm run validate` → `npm run audio`

## Spelregels

1. ID's nooit wijzigen of verwijderen, alleen `deprecated`
2. Formaatwijziging = schema-versie + migratie + test
3. Geen Italiaans in `src/`
4. Nieuwe logica heeft een test
5. Nooit direct op `main` werken
6. Leerbeleid alleen in `config/app.json`; de review-log is append-only
7. Eerst unit 1 volledig af en een week gebruiken, dan pas units 2-10 (pilotregel)

## Starten

```
claude
> Lees SPEC.md en CLAUDE.md. Voer fase 0 en 1 uit en stop daarna.
```

Voortgang per fase (uit `SPEC.md` §10):

- [x] 0 Setup
- [x] 1 Content-fundament
- [x] 2 Engines + tests
- [x] 3 Oefentypes + sessie
- [x] 4 UI
- [x] 5 Audio
- [x] 6 PWA + deploy
- [ ] 7a Pilot: unit 1 + een week gebruiken (`docs/pilot.md`)
- [ ] 7b Units 2-10 (na positief pilotbesluit)
- [ ] 8 Afwerking

## Eenmalige setup

- Reponaam: `capito`. PWA-naam op je beginscherm: "Capito"
- Node 20.19+ (`nvm use` pikt `.nvmrc` automatisch op); `.npmrc` blokkeert installatie op een oudere versie (`engine-strict=true`)
- Python met `pip install edge-tts` (voor audio)
- GitHub: zet branch protection op `main` (CI moet groen zijn) en kies bij Settings → Pages als bron "GitHub Actions"
- Fase 6: stel `base` in `vite.config.ts` in op `/capito/` en zet de push-trigger in `deploy.yml` aan
