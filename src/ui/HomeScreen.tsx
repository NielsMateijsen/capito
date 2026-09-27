import type { Unit } from '../content/schemas.ts'
import type { ProgressState } from '../storage/types.ts'
import type { Overview } from '../engine/overview.ts'
import { needsBackup } from '../storage/persist.ts'
import { S } from './strings.nl.ts'

interface AppConfig {
  backup: { reminderDays: number }
}

interface Props {
  units: Unit[]
  overview: Overview
  progress: ProgressState
  config: AppConfig
  flagCount?: number
  leechCount?: number
  onContinue: () => void
  onRefresh: () => void
  onOpenUnit: (unitId: string) => void
  onOpenSettings: () => void
  onOpenReports: () => void
  onOpenLeech: () => void
  onExport: () => Promise<void>
}

export default function HomeScreen({ units, overview, progress, config, flagCount = 0, leechCount = 0, onContinue, onRefresh, onOpenUnit, onOpenSettings, onOpenReports, onOpenLeech, onExport }: Props) {
  const sorted = [...units].sort((a, b) => a.order - b.order)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const showBackup = needsBackup(progress.meta.lastExportAt, config.backup.reminderDays)
  const { next, refresh, streak } = overview
  const titleOf = (unitId: string) => units.find(u => u.id === unitId)?.title ?? unitId

  const nextLabel =
    next.kind === 'lesson'
      ? next.lesson.final
        ? S.NEXT_FINAL(titleOf(next.lesson.unitId))
        : S.NEXT_LESSON(titleOf(next.lesson.unitId), next.lesson.number)
      : next.kind === 'exam'
        ? S.NEXT_EXAM(titleOf(next.unitId))
        : null

  return (
    <div className="home">
      <div className="home-header">
        <h1>{S.APP_NAME}</h1>
        {streak.longest > 0 && (
          <div className={`streak${streak.today ? ' streak--today' : ''}`}>
            <span className="streak-days">{S.STREAK(streak.current)}</span>
            <span className="streak-longest">{S.STREAK_LONGEST(streak.longest)}</span>
          </div>
        )}
      </div>

      {refresh.prominent && (
        <div className="banner refresh-banner">
          <span>{S.REFRESH_WARNING(refresh.dueItems)}</span>
          <button className="btn-primary" onClick={onRefresh}>{S.REFRESH}</button>
        </div>
      )}

      {nextLabel ? (
        <div className="continue">
          <button className="btn-primary btn-continue" onClick={onContinue}>{S.CONTINUE}</button>
          <span className="continue-label">{nextLabel}</span>
        </div>
      ) : (
        <p className="all-done">{S.ALL_DONE}</p>
      )}

      {refresh.dueCards > 0 && !refresh.prominent && (
        <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onRefresh}>
          {S.REFRESH_COUNT(refresh.dueCards)}
        </button>
      )}

      {showBackup && (
        <div className="banner">
          <span>{S.BACKUP_BANNER}</span>
          <button className="btn-secondary" onClick={() => void onExport()}>{S.BACKUP_BTN}</button>
        </div>
      )}

      {!isStandalone && (
        <div className="banner info">
          {S.IOS_ADVICE}
        </div>
      )}

      <nav className="home-nav">
        <button className="nav-btn" onClick={onOpenSettings}>{S.NAV_SETTINGS}</button>
        <button className="nav-btn" onClick={onOpenReports}>
          {S.NAV_REPORTS}{flagCount > 0 && <span className="nav-badge">{flagCount}</span>}
        </button>
        <button className="nav-btn" onClick={onOpenLeech}>
          {S.NAV_LEECH}{leechCount > 0 && <span className="nav-badge">{leechCount}</span>}
        </button>
      </nav>

      <div className="unit-list">
        <h2>{S.UNIT_LIST_HEADER}</h2>
        {sorted.map(unit => {
          const unlocked = overview.unlocked.has(unit.id)
          const passed = overview.passed.has(unit.id)
          const path = overview.paths.get(unit.id)
          const total = path?.lessons.length ?? 0
          const done = path?.doneCount ?? 0
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          const meta = !unlocked
            ? S.LOCKED
            : passed ? `${S.UNIT_PASSED} · ${S.UNIT_LESSONS(done, total)}` : S.UNIT_LESSONS(done, total)

          return (
            <div
              key={unit.id}
              className={`unit-card${unlocked ? '' : ' unit-card--locked'}`}
              onClick={() => unlocked && onOpenUnit(unit.id)}
              role={unlocked ? 'button' : undefined}
              tabIndex={unlocked ? 0 : undefined}
              onKeyDown={e => { if (unlocked && e.key === 'Enter') onOpenUnit(unit.id) }}
            >
              <div>
                <div className="unit-card-title">{unit.title}</div>
                <div className="unit-card-meta">{meta}</div>
              </div>
              {unlocked && (
                <div className="progress-bar-wrap" title={`${pct}%`}>
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              )}
              {!unlocked && <span aria-hidden="true">{S.LESSON_MARK_LOCKED}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
