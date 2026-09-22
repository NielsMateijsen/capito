import { useRef, useState } from 'react'
import { S } from './strings.nl.ts'

export interface ReportEntry {
  itemId: string
  kind: 'wrong-content' | 'also-correct' | 'audio'
  userAnswer: string
  note: string
  date: string
  build: string
}

interface Props {
  itemId: string
  userAnswer: string
  onSubmit: (entry: ReportEntry) => void
  onClose: () => void
}

export default function ReportModal({ itemId, userAnswer, onSubmit, onClose }: Props) {
  const [kind, setKind] = useState<ReportEntry['kind']>('wrong-content')
  const [note, setNote] = useState('')
  const selectRef = useRef<HTMLSelectElement>(null)

  function handleSubmit() {
    onSubmit({
      itemId,
      kind,
      userAnswer,
      note: note.trim(),
      date: new Date().toISOString(),
      build: 'dev',
    })
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-backdrop" onKeyDown={handleKeyDown} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <h3 id="report-title">{S.REPORT_TITLE}</h3>

        <label>
          <span>Soort melding</span>
          <select ref={selectRef} value={kind} onChange={e => setKind(e.target.value as ReportEntry['kind'])} autoFocus>
            <option value="wrong-content">{S.REPORT_KIND_WRONG}</option>
            <option value="also-correct">{S.REPORT_KIND_ALSO}</option>
            <option value="audio">{S.REPORT_KIND_AUDIO}</option>
          </select>
        </label>

        <label>
          <span>{S.REPORT_NOTE_LABEL}</span>
          <textarea value={note} onChange={e => setNote(e.target.value)} />
        </label>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>{S.REPORT_CANCEL}</button>
          <button className="btn-primary" onClick={handleSubmit}>{S.REPORT_SUBMIT}</button>
        </div>
      </div>
    </div>
  )
}
