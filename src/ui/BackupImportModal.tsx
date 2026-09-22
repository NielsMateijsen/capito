import { useEffect, useRef } from 'react'
import type { ProgressState } from '../storage/types.ts'
import { S } from './strings.nl.ts'

interface Props {
  current: ProgressState
  backup: ProgressState
  onConfirm: () => void
  onClose: () => void
}

function cardCount(state: ProgressState): number {
  return Object.keys(state.cards).length
}

function lastReviewDate(state: ProgressState): string {
  if (state.reviewLog.length === 0) return S.BACKUP_COMPARE_NEVER
  // ISO 8601 strings are lexicographically sortable; initial '' is always less than any real timestamp
  const max = state.reviewLog.reduce((m, e) => (e.t > m ? e.t : m), state.reviewLog[0]!.t)
  return new Date(max).toLocaleDateString('nl-NL')
}

export default function BackupImportModal({ current, backup, onConfirm, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  return (
    <div
      className="modal-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-import-title"
        tabIndex={-1}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      >
        <h3 id="backup-import-title">{S.BACKUP_IMPORT_TITLE}</h3>

        <table className="backup-compare">
          <thead>
            <tr>
              <th />
              <th>{S.BACKUP_COMPARE_COL_CURRENT}</th>
              <th>{S.BACKUP_COMPARE_COL_BACKUP}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{S.BACKUP_COMPARE_CARDS}</td>
              <td>{cardCount(current)}</td>
              <td>{cardCount(backup)}</td>
            </tr>
            <tr>
              <td>{S.BACKUP_COMPARE_REVIEWS}</td>
              <td>{current.reviewLog.length}</td>
              <td>{backup.reviewLog.length}</td>
            </tr>
            <tr>
              <td>{S.BACKUP_COMPARE_DATE}</td>
              <td>{lastReviewDate(current)}</td>
              <td>{lastReviewDate(backup)}</td>
            </tr>
          </tbody>
        </table>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>{S.REPORT_CANCEL}</button>
          <button className="btn-primary" onClick={onConfirm}>{S.BACKUP_CONFIRM}</button>
        </div>
      </div>
    </div>
  )
}
