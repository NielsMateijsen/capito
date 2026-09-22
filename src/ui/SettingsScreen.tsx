import type { ProgressState, Settings } from '../storage/types.ts'
import { S } from './strings.nl.ts'

interface AppConfig {
  session: { newCardsPerDay: number }
  backup: { reminderDays: number }
}

interface Props {
  progress: ProgressState
  config: AppConfig
  onSave: (settings: Settings) => Promise<void>
  onReset: () => Promise<void>
  onBack: () => void
}

export default function SettingsScreen({ progress, config, onSave, onReset, onBack }: Props) {
  const settings = (progress.settings ?? {}) as Settings
  const newPerDay = settings.newCardsPerDay ?? config.session.newCardsPerDay
  const autoplay = settings.autoplayAudio ?? false
  const unlockAll = settings.unlockAll ?? false

  async function save(patch: Partial<Settings>) {
    await onSave({ ...settings, ...patch })
  }

  async function handleToggleUnlock() {
    if (!unlockAll) {
      if (!window.confirm(S.SETTINGS_UNLOCK_CONFIRM)) return
    }
    await save({ unlockAll: !unlockAll })
  }

  async function handleReset() {
    if (!window.confirm(S.SETTINGS_RESET_CONFIRM)) return
    await onReset()
  }

  return (
    <div className="settings-screen">
      <button className="btn-secondary" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        {S.BACK}
      </button>

      <h1>{S.SETTINGS}</h1>

      {/* Leerbeleid */}
      <section className="settings-section">
        <h2>{S.SETTINGS_LEARNING}</h2>
        <div className="settings-row">
          <label htmlFor="new-per-day">{S.SETTINGS_NEW_PER_DAY}</label>
          <input
            id="new-per-day"
            type="number"
            min={1}
            max={50}
            value={newPerDay}
            onChange={e => {
              const v = Math.max(1, Math.min(50, Number(e.target.value)))
              if (!isNaN(v)) void save({ newCardsPerDay: v })
            }}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="autoplay">{S.SETTINGS_AUTOPLAY}</label>
          <input
            id="autoplay"
            type="checkbox"
            checked={autoplay}
            onChange={e => void save({ autoplayAudio: e.target.checked })}
          />
        </div>
      </section>

      {/* Ontgrendelen */}
      <section className="settings-section">
        <h2>{S.SETTINGS_UNLOCK}</h2>
        <div className="settings-row">
          <span className="settings-meta">{unlockAll ? S.SETTINGS_UNLOCK_ON : S.SETTINGS_UNLOCK_OFF}</span>
          <button className="btn-secondary" onClick={() => void handleToggleUnlock()}>
            {unlockAll ? S.SETTINGS_UNLOCK_ON : S.SETTINGS_UNLOCK_OFF}
          </button>
        </div>
      </section>

      {/* Back-up */}
      <section className="settings-section">
        <h2>{S.SETTINGS_BACKUP}</h2>
        <p className="settings-meta">{S.SETTINGS_LAST_BACKUP(progress.meta.lastExportAt)}</p>
        <p className="settings-meta">{S.SETTINGS_STORAGE(progress.meta.persistGranted)}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" disabled>{S.SETTINGS_EXPORT}</button>
          <button className="btn-secondary" disabled>{S.SETTINGS_IMPORT}</button>
        </div>
      </section>

      {/* Reset */}
      <section className="settings-section">
        <h2>{S.SETTINGS_DANGER}</h2>
        <div>
          <button className="btn-danger" onClick={() => void handleReset()}>
            {S.SETTINGS_RESET}
          </button>
        </div>
      </section>

      {/* Versie-info */}
      <section className="settings-section">
        <h2>{S.SETTINGS_VERSION}</h2>
        <div className="settings-version">
          <span>{S.SETTINGS_VERSION_APP(__BUILD__.app)}</span>
          <span>{S.SETTINGS_VERSION_COMMIT(__BUILD__.commit)}</span>
          <span>{S.SETTINGS_VERSION_CONTENT(__BUILD__.content)}</span>
        </div>
      </section>
    </div>
  )
}
