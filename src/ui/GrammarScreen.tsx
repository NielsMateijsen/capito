import { marked } from 'marked'
import type { GrammarDoc } from '../content/loader.ts'
import type { DrillItem } from '../content/schemas.ts'
import type { SessionItem } from '../engine/session-builder.ts'
import { S } from './strings.nl.ts'

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
    <div className="grammar-screen">
      <button className="btn-secondary" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        {S.BACK}
      </button>

      {doc === undefined ? (
        <>
          <p className="grammar-no-content">{S.GRAMMAR_NO_CONTENT}</p>
        </>
      ) : (
        <>
          <h1>{doc.frontmatter.title}</h1>
          <div
            className="grammar-body"
            dangerouslySetInnerHTML={{ __html: marked.parse(doc.body) }}
          />
          <div>
            <button
              className="btn-primary"
              disabled={!canDrill}
              onClick={() => canDrill && onDrill(drillQueue)}
            >
              {S.GRAMMAR_PRACTICE}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
