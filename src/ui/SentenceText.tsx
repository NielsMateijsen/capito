import type { Span } from '../engine/sentences.ts'

interface Props {
  text: string
  span: Span
  mode: 'highlight' | 'gap'
  className?: string
}

export default function SentenceText({ text, span, mode, className }: Props) {
  return (
    <div className={className} lang="it">
      {text.slice(0, span.start)}
      {mode === 'highlight'
        ? <mark className="sentence-highlight">{text.slice(span.start, span.end)}</mark>
        : <span className="sentence-gap" aria-label="…">{' '.repeat(6)}</span>}
      {text.slice(span.end)}
    </div>
  )
}
