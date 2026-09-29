import type { Unit } from '../content/schemas.ts'
import type { GrammarDoc } from '../content/loader.ts'
import type { UnitPath } from '../engine/lessons.ts'
import { S } from './strings.nl.ts'
import { playAudio } from './speak.ts'
import { ICON, ICON_LINE, IconAudio, IconBack, IconCorrect, IconExam, IconOpen } from './icons.ts'

interface Props {
  unit: Unit
  /** Position of the unit on the path, from 1. */
  unitNumber: number
  path: UnitPath
  passed: boolean
  bestScore?: number
  passThreshold: number
  grammarMap?: Map<string, GrammarDoc>
  onBack: () => void
  onExam: (unitId: string) => void
  onOpenGrammar: (grammarId: string) => void
  onOpenDialogue: (dialogueId: string) => void
}

function WordRow({ it, nl }: { it: string; nl: string }) {
  return (
    <li className="word-row">
      <strong className="word-it" lang="it">{it}</strong>
      <span className="word-nl">{nl}</span>
      <button className="icon-btn icon-btn--plain" onClick={() => void playAudio(it)} aria-label={S.SPEAK}>
        <IconAudio {...ICON} />
      </button>
    </li>
  )
}

export default function UnitScreen({ unit, unitNumber, path, passed, bestScore, passThreshold, grammarMap, onBack, onExam, onOpenGrammar, onOpenDialogue }: Props) {
  return (
    <div className="page">
      <div className="page-top">
        <button className="icon-btn" onClick={onBack} aria-label={S.BACK}><IconBack {...ICON_LINE} /></button>
        <span className="page-kicker">{S.UNIT_KICKER(unitNumber)}</span>
      </div>
      <h1 className="page-title">{unit.title}</h1>

      {unit.canDo.length > 0 && (
        <section className="unit-block">
          <h2 className="section-title">{S.UNIT_CANDO_HEADER}</h2>
          <ul className="cando-list">
            {unit.canDo.map((goal, i) => <li key={i}><IconCorrect {...ICON} />{goal}</li>)}
          </ul>
        </section>
      )}

      <section className="card exam-card">
        <div className="exam-card-head">
          <span className="exam-icon"><IconExam {...ICON} /></span>
          <h2 className="exam-card-title">{S.EXAM}</h2>
        </div>
        <p className="muted">
          {passed || path.doneCount > 0 ? S.EXAM_INFO(Math.round(passThreshold * 100)) : S.EXAM_TESTOUT_INFO}
        </p>
        {bestScore !== undefined && (
          <p className="muted">{S.EXAM_BEST(Math.round(bestScore * 100))}{passed && ` · ${S.UNIT_PASSED}`}</p>
        )}
        <div>
          <button className="btn btn--secondary" onClick={() => onExam(unit.id)}><IconExam {...ICON} />{S.EXAM_START}</button>
        </div>
      </section>

      {unit.words.length > 0 && (
        <section className="unit-block">
          <h2 className="section-title">{S.UNIT_WORDS_HEADER}</h2>
          <ul className="word-list">
            {unit.words.map(w => <WordRow key={w.id} it={w.it} nl={w.nl.join(' / ')} />)}
          </ul>
        </section>
      )}

      {unit.verbs.length > 0 && (
        <section className="unit-block">
          <h2 className="section-title">{S.UNIT_VERBS_HEADER}</h2>
          <ul className="word-list">
            {unit.verbs.map(v => <WordRow key={v.id} it={v.inf} nl={v.nl.join(' / ')} />)}
          </ul>
        </section>
      )}

      {unit.dialogues.length > 0 && (
        <section className="unit-block">
          <h2 className="section-title">{S.UNIT_DIALOGUES_HEADER}</h2>
          <ul className="link-list">
            {unit.dialogues.map(d => (
              <li key={d.id}>
                <button className="link-card" onClick={() => onOpenDialogue(d.id)}>
                  <span>{d.title}</span><IconOpen {...ICON_LINE} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unit.grammar.length > 0 && (
        <section className="unit-block">
          <h2 className="section-title">{S.UNIT_GRAMMAR_HEADER}</h2>
          <ul className="link-list">
            {unit.grammar.map(g => (
              <li key={g}>
                <button className="link-card" onClick={() => onOpenGrammar(g)}>
                  <span>{grammarMap?.get(g)?.frontmatter.title ?? g}</span><IconOpen {...ICON_LINE} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
