import { useEffect, useRef } from 'react'
import type { Unit } from '../content/schemas.ts'
import type { Content } from '../exercises/types.ts'
import type { ProgressState } from '../storage/types.ts'
import type { Overview } from '../engine/overview.ts'
import type { LessonStatus } from '../engine/lessons.ts'
import { needsBackup } from '../storage/persist.ts'
import { S } from './strings.nl.ts'
import {
  ICON, ICON_LINE, IconAlmost, IconCheck, IconExam, IconFinal, IconInfo, IconLocked, IconNext, IconOpen, IconRefresh,
  IconSettings, IconStart, IconStreak,
} from './icons.ts'

interface AppConfig {
  backup: { reminderDays: number }
}

interface Props {
  units: Unit[]
  content: Content
  overview: Overview
  progress: ProgressState
  config: AppConfig
  flagCount?: number
  leechCount?: number
  onContinue: () => void
  onRefresh: () => void
  onStartLesson: (lessonId: string) => void
  onExam: (unitId: string) => void
  onOpenUnit: (unitId: string) => void
  onOpenSettings: () => void
  onOpenReports: () => void
  onOpenLeech: () => void
  onExport: () => Promise<void>
}

/** Nodes swing left and right along the path; the position cycles through these CSS steps. */
const SWING_STEPS = 8

type NodeState = 'done' | 'current' | 'locked'

function stateOf(status: LessonStatus, unlocked: boolean): NodeState {
  if (status.done) return 'done'
  return unlocked && status.available ? 'current' : 'locked'
}

const STATE_LABEL: Record<NodeState, string> = { done: S.STATE_DONE, current: S.STATE_START, locked: S.STATE_LOCKED }

export default function HomeScreen({
  units, content, overview, progress, config, flagCount = 0, leechCount = 0,
  onContinue, onRefresh, onStartLesson, onExam, onOpenUnit, onOpenSettings, onOpenReports, onOpenLeech, onExport,
}: Props) {
  const sorted = [...units].sort((a, b) => a.order - b.order)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const showBackup = needsBackup(progress.meta.lastExportAt, config.backup.reminderDays)
  const { next, refresh, streak } = overview
  const titleOf = (unitId: string) => units.find(u => u.id === unitId)?.title ?? unitId
  const itemLabel = (id: string) => content.words.get(id)?.it ?? content.verbs.get(id)?.inf ?? id
  const currentRef = useRef<HTMLButtonElement>(null)

  // Open on the lesson that is next, wherever it is on the path
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  const nextLabel =
    next.kind === 'lesson'
      ? next.lesson.final
        ? S.NEXT_FINAL(titleOf(next.lesson.unitId))
        : S.NEXT_LESSON(titleOf(next.lesson.unitId), next.lesson.number)
      : next.kind === 'exam'
        ? S.NEXT_EXAM(titleOf(next.unitId))
        : null
  const currentLessonId = next.kind === 'lesson' ? next.lesson.id : undefined

  let step = 0
  const swing = () => `path-step--${step++ % SWING_STEPS}`

  return (
    <div className="home">
      <header className="home-head">
        <h1 className="brand">{S.APP_NAME}</h1>
        <div className="home-head-actions">
          {streak.longest > 0 && (
            <div
              className={`streak${streak.today ? '' : ' streak--open'}`}
              role="img"
              aria-label={streak.today ? S.STREAK(streak.current) : S.STREAK_OPEN(streak.current)}
            >
              <IconStreak {...ICON} /><span aria-hidden="true">{streak.current}</span>
            </div>
          )}
          <button className="icon-btn" onClick={onOpenSettings} aria-label={S.NAV_SETTINGS}>
            <IconSettings {...ICON} />
          </button>
        </div>
      </header>

      <div className="home-stack">
        {refresh.prominent && (
          <div className="banner banner--refresh">
            <div className="banner-row"><IconRefresh {...ICON} /><span>{S.REFRESH_WARNING(refresh.dueItems)}</span></div>
            <button className="btn btn--primary" onClick={onRefresh}>{S.REFRESH}</button>
          </div>
        )}
        {refresh.dueCards > 0 && !refresh.prominent && (
          <div>
            <button className="btn btn--secondary" onClick={onRefresh}><IconRefresh {...ICON} />{S.REFRESH_COUNT(refresh.dueCards)}</button>
          </div>
        )}
        {showBackup && (
          <div className="banner banner--warn">
            <div className="banner-row"><IconAlmost {...ICON} /><span>{S.BACKUP_BANNER}</span></div>
            <button className="btn btn--secondary" onClick={() => void onExport()}>{S.BACKUP_BTN}</button>
          </div>
        )}
        {!isStandalone && (
          <div className="banner banner--info">
            <div className="banner-row"><IconInfo {...ICON} /><span>{S.IOS_ADVICE}</span></div>
          </div>
        )}
      </div>

      <h2 className="visually-hidden">{S.UNIT_LIST_HEADER}</h2>
      {sorted.map((unit, unitIndex) => {
        const unlocked = overview.unlocked.has(unit.id)
        const passed = overview.passed.has(unit.id)
        const path = overview.paths.get(unit.id)
        const lessons = path?.lessons ?? []
        const best = overview.bestScore.get(unit.id)
        const headState = !unlocked ? 'locked' : passed ? 'passed' : 'open'
        return (
          <section key={unit.id} className="unit-section" aria-label={unit.title}>
            <button
              className={`unit-head unit-head--${headState}`}
              data-unit-head
              disabled={!unlocked}
              onClick={() => onOpenUnit(unit.id)}
              aria-label={unlocked ? undefined : S.UNIT_LOCKED_LABEL(unit.title)}
            >
              <span className="unit-head-text">
                <span className="unit-kicker">{S.UNIT_KICKER(unitIndex + 1)}</span>
                <span className="unit-title" data-unit-title>{unit.title}</span>
                {unlocked && (
                  <span className="unit-meta">
                    {passed && <span className="pill pill--ok"><IconCheck {...ICON_LINE} />{S.UNIT_PASSED}</span>}
                    {S.UNIT_LESSONS(path?.doneCount ?? 0, lessons.length)}
                  </span>
                )}
              </span>
              {unlocked ? <IconOpen {...ICON_LINE} /> : <IconLocked {...ICON} />}
            </button>

            <ol className="path" aria-label={S.UNIT_PATH_HEADER}>
              {lessons.map(status => {
                const { lesson } = status
                const state = stateOf(status, unlocked)
                const name = lesson.final ? S.LESSON_FINAL : S.LESSON(lesson.number)
                const isCurrent = state === 'current' && lesson.id === currentLessonId
                const Icon = state === 'done' ? IconCheck : state === 'current' ? IconStart : lesson.final ? IconFinal : IconLocked
                return (
                  <li key={lesson.id} className={`path-step ${swing()}`}>
                    <div className="path-node">
                      <button
                        ref={isCurrent ? currentRef : undefined}
                        className={`node node--${state}${lesson.final ? ' node--final' : ''}`}
                        data-lesson-state={state}
                        disabled={state !== 'current'}
                        aria-current={state === 'current' ? 'step' : undefined}
                        aria-label={`${name}, ${STATE_LABEL[state]}`}
                        onClick={() => onStartLesson(lesson.id)}
                      >
                        <Icon {...(state === 'done' ? ICON_LINE : ICON)} />
                      </button>
                      {state === 'current' ? (
                        <div className="bubble">
                          <span className="bubble-title">{name}</span>
                          <span className="bubble-words" lang={lesson.final ? undefined : 'it'}>
                            {lesson.final ? S.LESSON_FINAL_INFO : lesson.items.map(itemLabel).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="node-label" aria-hidden="true">{name}</span>
                      )}
                    </div>
                  </li>
                )
              })}
              {lessons.length > 0 && (
                <li className={`path-step ${swing()}`}>
                  <div className="path-node">
                    <button
                      className="node node--exam"
                      disabled={!unlocked}
                      aria-label={passed && best !== undefined ? `${S.EXAM}, ${S.EXAM_NODE_PASSED(Math.round(best * 100))}` : S.EXAM_NODE}
                      onClick={() => onExam(unit.id)}
                    >
                      <IconExam {...ICON} />
                      {passed && <span className="node-badge"><IconCheck {...ICON_LINE} /></span>}
                    </button>
                    <span className="node-label" aria-hidden="true">
                      {passed && best !== undefined ? S.EXAM_NODE_PASSED(Math.round(best * 100)) : S.EXAM}
                    </span>
                  </div>
                </li>
              )}
            </ol>
          </section>
        )
      })}

      <nav className="home-links" aria-label={S.NAV_MORE}>
        <button className="btn btn--secondary" onClick={onOpenReports}>
          {S.NAV_REPORTS}{flagCount > 0 && <span className="count-badge">{flagCount}</span>}
        </button>
        <button className="btn btn--secondary" onClick={onOpenLeech}>
          {S.NAV_LEECH}{leechCount > 0 && <span className="count-badge">{leechCount}</span>}
        </button>
      </nav>

      <div className="dock">
        {nextLabel ? (
          <>
            <button className="btn btn--primary btn--block" onClick={onContinue}>{S.CONTINUE}<IconNext {...ICON_LINE} /></button>
            <span className="dock-sub">{nextLabel}</span>
          </>
        ) : (
          <p className="dock-done">{S.ALL_DONE}</p>
        )}
      </div>
    </div>
  )
}
