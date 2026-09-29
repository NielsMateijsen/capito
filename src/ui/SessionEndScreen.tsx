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
import { ICON, ICON_LINE, IconCheck, IconCorrect, IconNext, IconPerfect, IconRefresh, IconStreak, IconWrong } from './icons.ts'

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
    <ul className="end-list">
      {keys.map(key => {
        try {
          const ex = exerciseMap.get(key.split(':')[0])?.build(key, content, { seq: 0, optionCount })
          if (!ex) return null
          // A dictation has no written prompt; a conjugation needs its person to make sense
          const prompt = ex.sentence?.nl
            ?? (ex.typeId === 'dictation' ? S.DICTATION_QUESTION : ex.hint ? `${ex.prompt} · ${ex.hint}` : ex.prompt)
          return (
            <li key={key} className="missed">
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

function StreakRow({ days }: { days: number }) {
  return (
    <div className="end-streak">
      <IconStreak {...ICON} />{S.STREAK(days)}
    </div>
  )
}

export default function SessionEndScreen({
  mode, answeredCount, entries, content, progress, config, examUnit, unlocksNext, summary,
  onHome, onContinue, onRefreshMissed, onRetryExam, onSaveCanDo,
}: Props) {
  const [canDo, setCanDo] = useState<boolean[]>(() => progress.unitMeta[examUnit?.id ?? '']?.canDo ?? [])
  const streak = summary?.streak

  const homeButton = (primary: boolean) => (
    <button className={`btn btn--block ${primary ? 'btn--primary' : 'btn--secondary'}`} autoFocus={primary} onClick={onHome}>
      {S.TO_HOME}
    </button>
  )
  const continueButtons = onContinue
    ? <>
        <button className="btn btn--primary btn--block" autoFocus onClick={onContinue}>{S.CONTINUE}<IconNext {...ICON_LINE} /></button>
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
      <div className="end end--exam" data-testid="session" data-phase="done" data-mode={mode}
        data-answered={answeredCount} data-passed={passed}>
        <div className="end-top">
          <div className={`score-ring score-ring--${passed ? 'pass' : 'fail'}`}>{S.PERCENT(Math.round(score * 100))}</div>
          <h2 className="end-title">{S.EXAM}</h2>
          <p className={`verdict verdict--${passed ? 'pass' : 'fail'}`}>
            {passed ? <IconCorrect {...ICON} /> : <IconWrong {...ICON} />}
            {passed ? (unlocksNext ? S.EXAM_PASSED_NEXT : S.EXAM_PASSED) : S.EXAM_FAILED(Math.round(config.exam.passThreshold * 100))}
          </p>
          <p className="visually-hidden">{S.EXAM_SCORE(Math.round(score * 100))}</p>
        </div>

        {missedCardKeys.length > 0 && (
          <section className="end-section">
            <h3 className="end-section-title">{S.EXAM_MISSED_HEADER}</h3>
            <MissedList keys={missedCardKeys} content={content} optionCount={config.ladder.optionCount} />
          </section>
        )}

        <section className="end-section">
          <h3 className="end-section-title">{S.CANDO_QUESTION}</h3>
          <ul className="end-list">
            {examUnit.canDo.map((goal, i) => (
              <li key={i} className="cando-card">
                <p className="cando-text">{goal}</p>
                <div className="cando-toggle">
                  <button className="toggle-btn" aria-pressed={canDo[i] === true} onClick={() => void answer(i, true)}>{S.CANDO_YES}</button>
                  <button className="toggle-btn" aria-pressed={canDo[i] === false} onClick={() => void answer(i, false)}>{S.CANDO_NOT_YET}</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="end-actions">
          {passed ? continueButtons : (
            <>
              {missedCardKeys.length > 0 && onRefreshMissed && (
                <button className="btn btn--primary btn--block" autoFocus onClick={() => onRefreshMissed(missedCardKeys)}>
                  <IconRefresh {...ICON} />{S.EXAM_REFRESH_MISSED}
                </button>
              )}
              {onRetryExam && <button className="btn btn--secondary btn--block" onClick={() => onRetryExam(examUnit.id)}>{S.EXAM_RETRY}</button>}
              {homeButton(missedCardKeys.length === 0 || !onRefreshMissed)}
            </>
          )}
        </div>
      </div>
    )
  }

  const perfect = mode === 'lesson' && isPerfectRun(entries)
  const notDone = mode === 'lesson' && summary?.lessonDone === false
  const title =
    mode === 'lesson' ? (notDone ? S.LESSON_NOT_DONE_TITLE : S.LESSON_DONE_TITLE)
      : mode === 'refresh' ? S.REFRESH_DONE_TITLE
        : S.SESSION_DONE
  const heroKind = perfect ? 'perfect' : notDone ? 'soft' : mode === 'refresh' ? 'refresh' : 'done'
  const HeroIcon = perfect ? IconPerfect : notDone ? IconStreak : mode === 'refresh' ? IconRefresh : IconCheck
  const celebrate = perfect || (mode === 'lesson' && !notDone)

  return (
    <div className="end" data-testid="session" data-phase="done" data-mode={mode} data-answered={answeredCount}>
      <div className="end-center">
        <div className={`hero hero--${heroKind}${celebrate ? ' hero--celebrate' : ''}`} aria-hidden="true">
          {perfect && <><span className="spark spark--1" /><span className="spark spark--2" /><span className="spark spark--3" /><span className="spark spark--4" /></>}
          <HeroIcon {...(heroKind === 'done' ? ICON_LINE : ICON)} />
        </div>
        <h2 className="end-title">{title}</h2>
        {perfect && <p className="perfect-badge"><IconPerfect {...ICON} />{S.PERFECT_LESSON}</p>}
        <p className="end-sub">{S.REVIEWED(answeredCount)}</p>
        {notDone && <p className="end-sub">{S.LESSON_NOT_DONE_INFO}</p>}
        {streak && streak.current > 0 && <StreakRow days={streak.current} />}
      </div>
      <div className="end-actions">{continueButtons}</div>
    </div>
  )
}
