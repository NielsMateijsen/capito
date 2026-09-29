import { marked } from 'marked'
import type { GrammarDoc } from '../content/loader.ts'
import type { DrillItem } from '../content/schemas.ts'
import type { SessionItem } from '../engine/session-builder.ts'
import { S } from './strings.nl.ts'
import { ICON_LINE, IconBack } from './icons.ts'

interface Props {
  grammarId: string
  doc: GrammarDoc | undefined
  allCardKeys: string[]
  onBack: () => void
  onDrill: (queue: SessionItem[]) => void
}

function buildDrillQueue(drills: DrillItem[], allCardKeys: string[]): SessionItem[] {
  return drills.flatMap(drill => {
    if (drill.type !== 'conjugate' || !drill.verbs || !drill.tense) return []
    return allCardKeys
      .filter(k => drill.verbs!.some(v => k.startsWith(`conjugate:${v}:${drill.tense}:`)))
      .map(k => ({ kind: 'exercise' as const, cardKey: k, isNew: false }))
  })
}

export default function GrammarScreen({ grammarId: _grammarId, doc, allCardKeys, onBack, onDrill }: Props) {
  const drillQueue = doc?.frontmatter.drills ? buildDrillQueue(doc.frontmatter.drills, allCardKeys) : []
  const canDrill = drillQueue.length > 0

  return (
    <div className="page grammar-screen">
      <div className="page-top">
        <button className="icon-btn" onClick={onBack} aria-label={S.BACK}><IconBack {...ICON_LINE} /></button>
      </div>

      {doc === undefined ? (
        <p className="muted">{S.GRAMMAR_NO_CONTENT}</p>
      ) : (
        <>
          <h1 className="page-title">{doc.frontmatter.title}</h1>
          <div
            className="card grammar-body"
            dangerouslySetInnerHTML={{ __html: marked.parse(doc.body) as string }}
          />
          <button
            className="btn btn--primary btn--block"
            disabled={!canDrill}
            onClick={() => canDrill && onDrill(drillQueue)}
          >
            {S.GRAMMAR_PRACTICE}
          </button>
        </>
      )}
    </div>
  )
}
