import type { Unit } from '../content/schemas.ts'
import type { ProgressState } from '../storage/types.ts'
import type { GrammarDoc } from '../content/loader.ts'
import { unitMastery } from '../engine/unlock.ts'
import { S } from './strings.nl.ts'

interface AppConfig {
  unlock: { minRepsPerCard: number }
  exam: { availableFromMastery: number }
}

interface Props {
  unit: Unit
  cardKeysByUnit: Map<string, string[]>
  progress: ProgressState
  config: AppConfig
  grammarMap?: Map<string, GrammarDoc>
  onBack: () => void
  onOefen: (unitId: string) => void
  onEindtoets: (unitId: string) => void
  onOpenGrammar: (grammarId: string) => void
  onOpenDialogue: (dialogueId: string) => void
}

function speak(text: string) {
  if (!window.speechSynthesis) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'it-IT'
  speechSynthesis.speak(u)
}

export default function UnitScreen({ unit, cardKeysByUnit, progress, config, grammarMap, onBack, onOefen, onEindtoets, onOpenGrammar, onOpenDialogue }: Props) {
  const keys = cardKeysByUnit.get(unit.id) ?? []
  const mastery = unitMastery(keys, progress.cards, config.unlock)
  const masteryPct = Math.round(mastery * 100)
  const examAvailable = mastery >= config.exam.availableFromMastery
  const examThresholdPct = Math.round(config.exam.availableFromMastery * 100)

  return (
    <div className="unit-screen">
      <button className="btn-secondary" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        {S.BACK}
      </button>

      <h1>{unit.title}</h1>

      {unit.canDo.length > 0 && (
        <section>
          <h2>{S.UNIT_CANDO_HEADER}</h2>
          <ul className="cando-list">
            {unit.canDo.map((goal, i) => <li key={i}>{goal}</li>)}
          </ul>
        </section>
      )}

      {unit.words.length > 0 && (
        <section>
          <h2>{S.UNIT_WORDS_HEADER}</h2>
          <ul className="word-list">
            {unit.words.map(w => (
              <li key={w.id} className="word-item">
                <strong>{w.it}</strong>
                <span className="word-nl">{w.nl.join(' / ')}</span>
                <button className="btn-secondary" style={{ padding: '2px 8px' }} onClick={() => speak(w.it)}>
                  {S.AUDIO}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unit.verbs.length > 0 && (
        <section>
          <h2>{S.UNIT_VERBS_HEADER}</h2>
          <ul className="word-list">
            {unit.verbs.map(v => (
              <li key={v.id} className="word-item">
                <strong>{v.inf}</strong>
                <span className="word-nl">{v.nl.join(' / ')}</span>
                <button className="btn-secondary" style={{ padding: '2px 8px' }} onClick={() => speak(v.inf)}>
                  {S.AUDIO}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unit.dialogues.length > 0 && (
        <section>
          <h2>{S.UNIT_DIALOGUES_HEADER}</h2>
          <ul className="plain-list">
            {unit.dialogues.map(d => (
              <li key={d.id}>
                <button className="btn-secondary" style={{ textAlign: 'left', width: '100%' }} onClick={() => onOpenDialogue(d.id)}>
                  {d.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unit.grammar.length > 0 && (
        <section>
          <h2>{S.UNIT_GRAMMAR_HEADER}</h2>
          <ul className="plain-list">
            {unit.grammar.map(g => (
              <li key={g}>
                <button className="btn-secondary" style={{ textAlign: 'left', width: '100%' }} onClick={() => onOpenGrammar(g)}>
                  {grammarMap?.get(g)?.frontmatter.title ?? g}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="unit-actions">
        <button className="btn-primary" onClick={() => onOefen(unit.id)}>
          {S.PRACTICE_UNIT}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <button
            className="btn-secondary"
            disabled={!examAvailable}
            onClick={() => examAvailable && onEindtoets(unit.id)}
          >
            {S.EXAM}
          </button>
          {!examAvailable && (
            <span className="exam-unavailable">
              {S.EXAM_UNAVAILABLE(examThresholdPct, masteryPct)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
