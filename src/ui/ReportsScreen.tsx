import { useRef } from 'react'
import type { Flag } from '../storage/types.ts'
import { S } from './strings.nl.ts'
import { ICON, ICON_LINE, IconBack, IconDownload } from './icons.ts'

interface Props {
  flags: Flag[]
  onBack: () => void
}

const KIND_LABEL: Record<string, string> = {
  'wrong-content': S.REPORT_KIND_WRONG,
  'also-correct': S.REPORT_KIND_ALSO,
  'audio': S.REPORT_KIND_AUDIO,
}

function shortDate(value: unknown): string {
  const d = new Date(String(value ?? ''))
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('nl-NL')
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
    <div className="page">
      <div className="page-top">
        <button className="icon-btn" onClick={onBack} aria-label={S.BACK}><IconBack {...ICON_LINE} /></button>
        <h1 className="page-title">{S.REPORTS}</h1>
      </div>

      {flags.length === 0 ? (
        <p className="muted">{S.REPORTS_EMPTY}</p>
      ) : (
        <>
          <ul className="item-list" aria-label={S.REPORTS}>
            {[...flags].reverse().map((flag, i) => (
              <li key={String(flag.date ?? i)} className="card report-card">
                <div className="report-top">
                  <span className="pill pill--soft">{KIND_LABEL[String(flag.kind)] ?? String(flag.kind ?? '')}</span>
                  <span className="muted">{shortDate(flag.date)}</span>
                </div>
                <span className="report-id">{String(flag.itemId ?? '')}</span>
                {!!flag.userAnswer && <span className="muted">{S.REPORTS_ANSWER(String(flag.userAnswer))}</span>}
                {!!flag.note && <span className="muted">{String(flag.note)}</span>}
              </li>
            ))}
          </ul>
          <button className="btn btn--primary btn--block" onClick={handleExport}><IconDownload {...ICON} />{S.REPORTS_EXPORT}</button>
        </>
      )}

      {/* Hidden anchor for download trigger */}
      <a ref={linkRef} className="visually-hidden" aria-hidden="true" tabIndex={-1} />
    </div>
  )
}
