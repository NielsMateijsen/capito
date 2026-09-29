import { useState } from 'react'
import { S } from './strings.nl.ts'
import { ICON_LINE, IconClose } from './icons.ts'

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

const KINDS: { kind: ReportEntry['kind']; label: string }[] = [
  { kind: 'wrong-content', label: S.REPORT_KIND_WRONG },
  { kind: 'also-correct', label: S.REPORT_KIND_ALSO },
  { kind: 'audio', label: S.REPORT_KIND_AUDIO },
]

export default function ReportModal({ itemId, userAnswer, onSubmit, onClose }: Props) {
  const [kind, setKind] = useState<ReportEntry['kind']>('wrong-content')
  const [note, setNote] = useState('')

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
    <div className="sheet-backdrop" onKeyDown={handleKeyDown} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className="sheet-head">
          <h2 id="report-title" className="sheet-title">{S.REPORT_TITLE}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={S.CLOSE}><IconClose {...ICON_LINE} /></button>
        </div>

        <fieldset className="sheet-field">
          <legend className="sheet-label">{S.REPORT_KIND_LABEL}</legend>
          {KINDS.map((k, i) => (
            <label key={k.kind} className="radio">
              <input
                type="radio"
                name="report-kind"
                value={k.kind}
                checked={kind === k.kind}
                onChange={() => setKind(k.kind)}
                autoFocus={i === 0}
              />
              <span>{k.label}</span>
            </label>
          ))}
        </fieldset>

        <label className="sheet-field">
          <span className="sheet-label">{S.REPORT_NOTE_LABEL}</span>
          <textarea className="textarea" value={note} onChange={e => setNote(e.target.value)} />
        </label>

        <div className="sheet-actions">
          <button className="btn btn--secondary" onClick={onClose}>{S.REPORT_CANCEL}</button>
          <button className="btn btn--primary" onClick={handleSubmit}>{S.REPORT_SUBMIT}</button>
        </div>
      </div>
    </div>
  )
}
