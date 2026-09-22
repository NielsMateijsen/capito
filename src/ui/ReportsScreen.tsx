import { useRef } from 'react'
import type { Flag } from '../storage/types.ts'
import { S } from './strings.nl.ts'

interface Props {
  flags: Flag[]
  onBack: () => void
}

export default function ReportsScreen({ flags, onBack }: Props) {
  const linkRef = useRef<HTMLAnchorElement>(null)

  function handleExport() {
    const blob = new Blob([JSON.stringify(flags, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = linkRef.current
    if (!a) return
    a.href = url
    a.download = 'capito-reports.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <div className="reports-screen">
      <button className="btn-secondary" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        {S.BACK}
      </button>

      <h1>{S.REPORTS}</h1>

      {flags.length === 0 ? (
        <p className="settings-meta">{S.REPORTS_EMPTY}</p>
      ) : (
        <>
          <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={handleExport}>
            {S.REPORTS_EXPORT}
          </button>
          <div className="reports-list">
            {[...flags].reverse().map((flag, i) => (
              <div key={String(flag.date ?? i)} className="report-card">
                <div className="report-card-meta">
                  {String(flag.date ?? '—')} · {String(flag.kind ?? '—')} · {String(flag.itemId ?? '—')}
                </div>
                {!!flag.userAnswer && (
                  <div className="report-card-answer">{S.REPORTS_ANSWER(String(flag.userAnswer))}</div>
                )}
                {!!flag.note && <div>{String(flag.note)}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Hidden anchor for download trigger */}
      <a ref={linkRef} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  )
}
