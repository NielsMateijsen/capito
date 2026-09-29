import type { Span } from '../engine/sentences.ts'

interface Props {
  text: string
  span: Span
  mode: 'highlight' | 'gap'
  /** Gap mode: always a space after the gap, so an elided form looks like any other. */
  spaceAfterGap?: boolean
  className?: string
}

export default function SentenceText({ text, span, mode, spaceAfterGap = false, className }: Props) {
  const rest = text.slice(span.end)
  return (
    <div className={className} lang="it">
      {text.slice(0, span.start)}
      {mode === 'highlight'
        ? <mark className="sentence-highlight">{text.slice(span.start, span.end)}</mark>
        : <span className="sentence-gap" aria-label="…">{' '.repeat(6)}</span>}
      {mode === 'gap' && spaceAfterGap && !rest.startsWith(' ') ? ` ${rest}` : rest}
    </div>
  )
}
