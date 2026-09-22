import type { Unit } from '../content/schemas.ts'
import type { ProgressState } from '../storage/types.ts'
import { isUnitUnlocked, unitMastery } from '../engine/unlock.ts'
import { S } from './strings.nl.ts'

interface AppConfig {
  backup: { reminderDays: number }
  unlock: { masteryThreshold: number; minRepsPerCard: number; requireExam: boolean; passThreshold: number }
  exam: { availableFromMastery: number }
}

interface Props {
  units: Unit[]
  cardKeysByUnit: Map<string, string[]>
  progress: ProgressState
  config: AppConfig
  unlockAll?: boolean
  flagCount?: number
  leechCount?: number
  onStartSession: () => void
  onOpenUnit: (unitId: string) => void
  onOpenSettings: () => void
  onOpenReports: () => void
  onOpenLeech: () => void
}

function needsBackup(progress: ProgressState, reminderDays: number): boolean {
  if (!progress.meta.lastExportAt) return true
  const ms = Date.now() - Date.parse(progress.meta.lastExportAt)
  return ms > reminderDays * 86_400_000
}

export default function HomeScreen({ units, cardKeysByUnit, progress, config, unlockAll = false, flagCount = 0, leechCount = 0, onStartSession, onOpenUnit, onOpenSettings, onOpenReports, onOpenLeech }: Props) {
  const sorted = [...units].sort((a, b) => a.order - b.order)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const showBackup = needsBackup(progress, config.backup.reminderDays)

  return (
    <div className="home">
      <div className="home-header">
        <h1>Capito</h1>
      </div>

      <button className="btn-primary" style={{ fontSize: '1.1rem', padding: '0.8rem 1.6rem' }} onClick={onStartSession}>
        {S.TODAY}
      </button>

      {showBackup && (
        <div className="banner">
          <span>{S.BACKUP_BANNER}</span>
          <button className="btn-secondary" disabled>{S.BACKUP_BTN}</button>
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
          const unlocked = unlockAll || isUnitUnlocked(unit, cardKeysByUnit, progress, config.unlock)
          const keys = cardKeysByUnit.get(unit.id) ?? []
          const mastery = unitMastery(keys, progress.cards, config.unlock)
          const pct = Math.round(mastery * 100)

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
                <div className="unit-card-meta">
                  {unlocked ? S.MASTERY(pct) : S.LOCKED}
                </div>
              </div>
              {unlocked && (
                <div className="progress-bar-wrap" title={`${pct}%`}>
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              )}
              {!unlocked && <span aria-hidden="true">🔒</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
