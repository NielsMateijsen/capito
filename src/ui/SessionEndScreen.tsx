import { useState } from 'react'
import type { Content } from '../exercises/types.ts'
import type { ProgressState } from '../storage/types.ts'
import type { ReviewEntry } from '../engine/review-log.ts'
import type { Unit } from '../content/schemas.ts'
import type { ExamConfig } from '../engine/exam.ts'
import { examOutcomes, scoreExam } from '../engine/exam.ts'
import { isPerfectRun } from '../engine/lessons.ts'
import { exerciseMap } from '../exercises/index.ts'
import type { SessionMode, SessionSummary } from './SessionScreen.tsx'
import { S } from './strings.nl.ts'

interface Props {
  mode: SessionMode
  answeredCount: number
  /** The answers given in this session. */
  entries: ReviewEntry[]
  content: Content
  progress: ProgressState
  config: { exam: ExamConfig; ladder: { optionCount: number } }
  examUnit?: Unit
  /** Passing this exam opens another unit. */
  unlocksNext?: boolean
  summary?: SessionSummary
  onHome: () => void
  onContinue?: () => void
  onRefreshMissed?: (cardKeys: string[]) => void
  onRetryExam?: (unitId: string) => void
  onSaveCanDo: (unitId: string, answers: boolean[]) => Promise<void>
}

function MissedList({ keys, content, optionCount }: { keys: string[]; content: Content; optionCount: number }) {
  return (
    <ul className="missed-list">
      {keys.map(key => {
        try {
          const ex = exerciseMap.get(key.split(':')[0])?.build(key, content, { seq: 0, optionCount })
          if (!ex) return null
          // A dictation has no written prompt; a conjugation needs its person to make sense
          const prompt = ex.sentence?.nl
            ?? (ex.typeId === 'dictation' ? S.DICTATION_QUESTION : ex.hint ? `${ex.prompt} · ${ex.hint}` : ex.prompt)
          return (
            <li key={key}>
              <span className="missed-prompt">{prompt}</span>
              <strong className="missed-answer" lang="it">{ex.answers[0]}</strong>
            </li>
          )
        } catch {
          return null
        }
      })}
    </ul>
  )
}

export default function SessionEndScreen({
  mode, answeredCount, entries, content, progress, config, examUnit, unlocksNext, summary,
  onHome, onContinue, onRefreshMissed, onRetryExam, onSaveCanDo,
}: Props) {
  const [canDo, setCanDo] = useState<boolean[]>(() => progress.unitMeta[examUnit?.id ?? '']?.canDo ?? [])
  const streak = summary?.streak

  const homeButton = (primary: boolean) => (
    <button className={primary ? 'btn-primary' : 'btn-secondary'} autoFocus={primary} onClick={onHome}>{S.TO_HOME}</button>
  )
  const continueButtons = onContinue
    ? <>
        <button className="btn-primary" autoFocus onClick={onContinue}>{S.CONTINUE}</button>
        {homeButton(false)}
      </>
    : homeButton(true)

  if (mode === 'exam' && examUnit) {
    const first = new Map<string, ReviewEntry['result']>()
    for (const e of entries) if (!first.has(e.key)) first.set(e.key, e.result)
    const { missedCardKeys } = scoreExam(first, config.exam)
    // Score and verdict both come from the log, as unlocking does
    const outcome = examOutcomes(entries, config.exam)[0]
    const score = outcome?.score ?? 0
    const passed = outcome?.passed ?? false
    const answer = async (i: number, value: boolean) => {
      const next = examUnit.canDo.map((_, j) => (j === i ? value : canDo[j] ?? false))
      setCanDo(next)
      await onSaveCanDo(examUnit.id, next)
    }
    return (
      <div className="end-screen end-screen--exam" data-testid="session" data-phase="done" data-mode={mode}
        data-answered={answeredCount} data-passed={passed}>
        <h2>{S.EXAM}</h2>
        <p className="exam-score">{S.EXAM_SCORE(Math.round(score * 100))}</p>
        <p className={`exam-verdict ${passed ? 'passed' : 'failed'}`}>
          {passed ? (unlocksNext ? S.EXAM_PASSED_NEXT : S.EXAM_PASSED) : S.EXAM_FAILED(Math.round(config.exam.passThreshold * 100))}
        </p>

        {missedCardKeys.length > 0 && (
          <section className="end-section">
            <h3>{S.EXAM_MISSED_HEADER}</h3>
            <MissedList keys={missedCardKeys} content={content} optionCount={config.ladder.optionCount} />
          </section>
        )}

        <section className="end-section">
          <h3>{S.CANDO_QUESTION}</h3>
          <ul className="cando-check">
            {examUnit.canDo.map((goal, i) => (
              <li key={i}>
                <span>{goal}</span>
                <span className="cando-answers">
                  <button className="btn-secondary" aria-pressed={canDo[i] === true} onClick={() => void answer(i, true)}>{S.CANDO_YES}</button>
                  <button className="btn-secondary" aria-pressed={canDo[i] === false} onClick={() => void answer(i, false)}>{S.CANDO_NOT_YET}</button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="end-actions">
          {passed ? continueButtons : (
            <>
              {missedCardKeys.length > 0 && onRefreshMissed && (
                <button className="btn-primary" autoFocus onClick={() => onRefreshMissed(missedCardKeys)}>{S.EXAM_REFRESH_MISSED}</button>
              )}
              {onRetryExam && <button className="btn-secondary" onClick={() => onRetryExam(examUnit.id)}>{S.EXAM_RETRY}</button>}
              {homeButton(missedCardKeys.length === 0 || !onRefreshMissed)}
            </>
          )}
        </div>
      </div>
    )
  }

  const perfect = mode === 'lesson' && isPerfectRun(entries)
  const title =
    mode === 'lesson' ? (summary?.lessonDone === false ? S.LESSON_NOT_DONE_TITLE : S.LESSON_DONE_TITLE)
      : mode === 'refresh' ? S.REFRESH_DONE_TITLE
        : S.SESSION_DONE

  return (
    <div className="end-screen" data-testid="session" data-phase="done" data-mode={mode} data-answered={answeredCount}>
      <h2>{title}</h2>
      {perfect && <p className="perfect-badge">{S.PERFECT_LESSON}</p>}
      <p>{S.REVIEWED(answeredCount)}</p>
      {mode === 'lesson' && summary?.lessonDone === false && <p className="end-info">{S.LESSON_NOT_DONE_INFO}</p>}
      {streak && streak.current > 0 && <p className="end-streak">{S.STREAK(streak.current)}</p>}
      <div className="end-actions">{continueButtons}</div>
    </div>
  )
}
