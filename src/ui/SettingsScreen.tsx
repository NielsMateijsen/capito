import { useRef, useState } from 'react'
import type { ProgressState, Settings } from '../storage/types.ts'
import { importJson } from '../storage/migrations.ts'
import BackupImportModal from './BackupImportModal.tsx'
import { S } from './strings.nl.ts'
import { ICON, ICON_LINE, IconBack, IconDownload, IconMinus, IconPlus } from './icons.ts'

interface AppConfig {
  lesson: { itemsPerLesson: number; minItemsPerLesson: number; maxItemsPerLesson: number }
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
  onTestSession: () => void
}

export default function SettingsScreen({ progress, config, onSave, onReset, onBack, onExport, onImport, onTestSession }: Props) {
  const settings = (progress.settings ?? {}) as Settings
  const newItemsPerLesson = settings.newItemsPerLesson ?? config.lesson.itemsPerLesson
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

  const setPerLesson = (value: number) => {
    const v = Math.max(config.lesson.minItemsPerLesson, Math.min(config.lesson.maxItemsPerLesson, value))
    if (!isNaN(v)) void save({ newItemsPerLesson: v })
  }

  return (
    <div className="page">
      {pendingBackup && (
        <BackupImportModal
          current={progress}
          backup={pendingBackup}
          onConfirm={() => void handleConfirmImport()}
          onClose={() => setPendingBackup(null)}
        />
      )}

      <div className="page-top">
        <button className="icon-btn" onClick={onBack} aria-label={S.BACK}><IconBack {...ICON_LINE} /></button>
        <h1 className="page-title">{S.SETTINGS}</h1>
      </div>

      <h2 className="section-title">{S.SETTINGS_LEARNING}</h2>
      <div className="card settings-group">
        <div className="setting">
          <div className="setting-text">
            <label className="setting-label" htmlFor="new-items-per-lesson">{S.SETTINGS_NEW_ITEMS_PER_LESSON}</label>
            <span className="muted">{S.SETTINGS_RANGE(config.lesson.minItemsPerLesson, config.lesson.maxItemsPerLesson)}</span>
          </div>
          <div className="stepper">
            <button
              className="stepper-btn"
              onClick={() => setPerLesson(newItemsPerLesson - 1)}
              disabled={newItemsPerLesson <= config.lesson.minItemsPerLesson}
              aria-label={S.STEP_DOWN}
            ><IconMinus {...ICON_LINE} /></button>
            <input
              id="new-items-per-lesson"
              className="stepper-input"
              type="number"
              inputMode="numeric"
              min={config.lesson.minItemsPerLesson}
              max={config.lesson.maxItemsPerLesson}
              value={newItemsPerLesson}
              onChange={e => setPerLesson(Number(e.target.value))}
            />
            <button
              className="stepper-btn"
              onClick={() => setPerLesson(newItemsPerLesson + 1)}
              disabled={newItemsPerLesson >= config.lesson.maxItemsPerLesson}
              aria-label={S.STEP_UP}
            ><IconPlus {...ICON_LINE} /></button>
          </div>
        </div>
        <div className="setting">
          <span className="setting-label" id="autoplay-label">{S.SETTINGS_AUTOPLAY}</span>
          <button
            className="switch"
            role="switch"
            aria-checked={autoplay}
            aria-labelledby="autoplay-label"
            onClick={() => void save({ autoplayAudio: !autoplay })}
          />
        </div>
        <div className="setting">
          <div className="setting-text">
            <span className="setting-label" id="unlock-label">{S.SETTINGS_UNLOCK}</span>
            <span className="muted">{unlockAll ? S.SETTINGS_UNLOCK_ON : S.SETTINGS_UNLOCK_OFF}</span>
          </div>
          <button
            className="switch"
            role="switch"
            aria-checked={unlockAll}
            aria-labelledby="unlock-label"
            onClick={() => void handleToggleUnlock()}
          />
        </div>
      </div>

      <h2 className="section-title">{S.SETTINGS_BACKUP}</h2>
      <div className="card settings-group">
        <p className="muted">{S.SETTINGS_LAST_BACKUP(progress.meta.lastExportAt)}</p>
        <p className="muted">{S.SETTINGS_STORAGE(progress.meta.persistGranted)}</p>
        <div className="btn-row">
          <button className="btn btn--secondary" onClick={() => void onExport()}><IconDownload {...ICON} />{S.SETTINGS_EXPORT}</button>
          <button className="btn btn--secondary" onClick={() => fileInputRef.current?.click()}>{S.SETTINGS_IMPORT}</button>
        </div>
        {importError && <p className="form-error" role="alert">{importError}</p>}
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFileChange}
        />
      </div>

      <h2 className="section-title">{S.SETTINGS_TEST}</h2>
      <div className="card settings-group">
        <p className="muted">{S.SETTINGS_TEST_INFO}</p>
        <div className="btn-row">
          <button className="btn btn--secondary" onClick={onTestSession}>{S.SETTINGS_TEST_START}</button>
        </div>
      </div>

      <h2 className="section-title">{S.SETTINGS_DANGER}</h2>
      <div className="card settings-group">
        <div className="btn-row">
          <button className="btn btn--danger" onClick={() => void handleReset()}>{S.SETTINGS_RESET}</button>
        </div>
      </div>

      <h2 className="section-title">{S.SETTINGS_VERSION}</h2>
      <div className="card settings-group settings-version">
        <span>{S.SETTINGS_VERSION_APP(__BUILD__.app)}</span>
        <span>{S.SETTINGS_VERSION_COMMIT(__BUILD__.commit)}</span>
        <span>{S.SETTINGS_VERSION_CONTENT(__BUILD__.content)}</span>
      </div>
    </div>
  )
}
