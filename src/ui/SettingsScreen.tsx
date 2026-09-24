import { useRef, useState } from 'react'
import type { ProgressState, Settings } from '../storage/types.ts'
import { importJson } from '../storage/migrations.ts'
import BackupImportModal from './BackupImportModal.tsx'
import { S } from './strings.nl.ts'

interface AppConfig {
  session: { minNewCardsPerDay: number; maxNewCardsPerDay: number }
  ladder: { newItemsPerDay: number }
  backup: { reminderDays: number }
}

interface Props {
  progress: ProgressState
  config: AppConfig
  onSave: (settings: Settings) => Promise<void>
  onReset: () => Promise<void>
  onBack: () => void
  onExport: () => Promise<void>
  onImport: (state: ProgressState) => Promise<void>
}

export default function SettingsScreen({ progress, config, onSave, onReset, onBack, onExport, onImport }: Props) {
  const settings = (progress.settings ?? {}) as Settings
  // Stored as newCardsPerDay (existing settings field); it sets the number of new ladder items per day
  const newPerDay = settings.newCardsPerDay ?? config.ladder.newItemsPerDay
  const autoplay = settings.autoplayAudio ?? false
  const unlockAll = settings.unlockAll ?? false

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingBackup, setPendingBackup] = useState<ProgressState | null>(null)

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const backup = importJson(reader.result as string)
        setPendingBackup(backup)
      } catch (err) {
        setImportError(err instanceof Error ? err.message : S.BACKUP_IMPORT_ERROR)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleConfirmImport() {
    if (!pendingBackup) return
    await onImport(pendingBackup)
    setPendingBackup(null)
  }

  return (
    <div className="settings-screen">
      {pendingBackup && (
        <BackupImportModal
          current={progress}
          backup={pendingBackup}
          onConfirm={() => void handleConfirmImport()}
          onClose={() => setPendingBackup(null)}
        />
      )}

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
            min={config.session.minNewCardsPerDay}
            max={config.session.maxNewCardsPerDay}
            value={newPerDay}
            onChange={e => {
              const v = Math.max(config.session.minNewCardsPerDay, Math.min(config.session.maxNewCardsPerDay, Number(e.target.value)))
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
            {unlockAll ? S.SETTINGS_UNLOCK_DISABLE : S.SETTINGS_UNLOCK_ENABLE}
          </button>
        </div>
      </section>

      {/* Back-up */}
      <section className="settings-section">
        <h2>{S.SETTINGS_BACKUP}</h2>
        <p className="settings-meta">{S.SETTINGS_LAST_BACKUP(progress.meta.lastExportAt)}</p>
        <p className="settings-meta">{S.SETTINGS_STORAGE(progress.meta.persistGranted)}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={() => void onExport()}>{S.SETTINGS_EXPORT}</button>
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>{S.SETTINGS_IMPORT}</button>
        </div>
        {importError && <p className="settings-error">{importError}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
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
