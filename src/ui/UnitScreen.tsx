import type { Unit } from '../content/schemas.ts'
import type { Content } from '../exercises/types.ts'
import type { GrammarDoc } from '../content/loader.ts'
import type { UnitPath } from '../engine/lessons.ts'
import { S } from './strings.nl.ts'
import { playAudio } from './speak.ts'

interface Props {
  unit: Unit
  content: Content
  path: UnitPath
  passed: boolean
  bestScore?: number
  passThreshold: number
  grammarMap?: Map<string, GrammarDoc>
  onBack: () => void
  onStartLesson: (lessonId: string) => void
  onExam: (unitId: string) => void
  onOpenGrammar: (grammarId: string) => void
  onOpenDialogue: (dialogueId: string) => void
}

export default function UnitScreen({ unit, content, path, passed, bestScore, passThreshold, grammarMap, onBack, onStartLesson, onExam, onOpenGrammar, onOpenDialogue }: Props) {
  const itemLabel = (id: string) => content.words.get(id)?.it ?? content.verbs.get(id)?.inf ?? id

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

      {path.lessons.length > 0 && (
        <section>
          <h2>{S.UNIT_PATH_HEADER}</h2>
          <ol className="lesson-path">
            {path.lessons.map(({ lesson, done, available }) => {
              const state = done ? 'done' : available ? 'current' : 'locked'
              return (
                <li key={lesson.id} className={`lesson-step lesson-step--${state}`}>
                  <button
                    className="lesson-btn"
                    disabled={state !== 'current'}
                    aria-current={state === 'current' ? 'step' : undefined}
                    onClick={() => onStartLesson(lesson.id)}
                  >
                    <span className="lesson-mark" aria-hidden="true">
                      {done ? S.LESSON_MARK_DONE : available ? S.LESSON_MARK_CURRENT : S.LESSON_MARK_LOCKED}
                    </span>
                    <span className="lesson-text">
                      <span className="lesson-title">{lesson.final ? S.LESSON_FINAL : S.LESSON(lesson.number)}</span>
                      {lesson.final
                        ? <span className="lesson-words">{S.LESSON_FINAL_INFO}</span>
                        : <span className="lesson-words" lang="it">{lesson.items.map(itemLabel).join(', ')}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      <section className="exam-section">
        <h2>{S.EXAM}</h2>
        <p className="settings-meta">
          {passed || path.doneCount > 0 ? S.EXAM_INFO(Math.round(passThreshold * 100)) : S.EXAM_TESTOUT_INFO}
        </p>
        {bestScore !== undefined && (
          <p className="settings-meta">
            {S.EXAM_BEST(Math.round(bestScore * 100))}{passed && ` · ${S.UNIT_PASSED}`}
          </p>
        )}
        <div>
          <button className={path.current ? 'btn-secondary' : 'btn-primary'} onClick={() => onExam(unit.id)}>
            {S.EXAM}
          </button>
        </div>
      </section>

      {unit.words.length > 0 && (
        <section>
          <h2>{S.UNIT_WORDS_HEADER}</h2>
          <ul className="word-list">
            {unit.words.map(w => (
              <li key={w.id} className="word-item">
                <strong lang="it">{w.it}</strong>
                <span className="word-nl">{w.nl.join(' / ')}</span>
                <button className="btn-secondary" style={{ padding: '2px 8px' }} onClick={() => void playAudio(w.it)}>
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
                <strong lang="it">{v.inf}</strong>
                <span className="word-nl">{v.nl.join(' / ')}</span>
                <button className="btn-secondary" style={{ padding: '2px 8px' }} onClick={() => void playAudio(v.inf)}>
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
    </div>
  )
}
