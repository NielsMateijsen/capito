import { useMemo } from 'react'
import type { Content } from '../exercises/types.ts'
import type { ProgressState } from '../storage/types.ts'
import { isLeech } from '../engine/session-builder.ts'
import { S } from './strings.nl.ts'
import { playAudio } from './speak.ts'
import { ICON, ICON_LINE, IconAudio, IconBack } from './icons.ts'

interface AppConfig {
  leech: { lapseThreshold: number }
}

interface Props {
  content: Content
  progress: ProgressState
  config: AppConfig
  onBack: () => void
}

export default function LeechScreen({ content, progress, config, onBack }: Props) {
  const leeches = Object.entries(progress.cards)
    .filter(([, state]) => isLeech(state, config.leech))
    .map(([cardKey, state]) => ({ cardKey, state }))

  const exampleByItem = useMemo(() => {
    const map = new Map<string, { it: string; nl: string[] }>()
    for (const s of content.sentences.values()) {
      const sentence = s as { it: string; nl: string[]; uses: string[] }
      for (const id of sentence.uses) {
        if (!map.has(id)) map.set(id, sentence)
      }
    }
    return map
  }, [content.sentences])

  return (
    <div className="page">
      <div className="page-top">
        <button className="icon-btn" onClick={onBack} aria-label={S.BACK}><IconBack {...ICON_LINE} /></button>
        <h1 className="page-title">{S.LEECH}</h1>
      </div>

      {leeches.length === 0 ? (
        <p className="muted">{S.LEECH_EMPTY}</p>
      ) : (
        <ul className="item-list" aria-label={S.LEECH}>
          {leeches.map(({ cardKey, state }) => {
            const itemId = cardKey.split(':')[1] ?? ''
            const word = content.words.get(itemId)
            const verb = content.verbs.get(itemId)
            const sentence = content.sentences.get(itemId)
            const it = word?.it ?? verb?.inf ?? sentence?.it ?? itemId
            const nl = word?.nl.join(', ') ?? verb?.nl.join(', ') ?? sentence?.nl[0] ?? ''
            const example = exampleByItem.get(itemId)

            return (
              <li key={cardKey} className="card leech-card">
                <div className="leech-top">
                  <div className="leech-word">
                    <span className="leech-it" lang="it">{it}</span>
                    {nl && <span className="muted">{nl}</span>}
                  </div>
                  <span className="pill pill--wrong">{S.LEECH_LAPSES(state.lapses)}</span>
                  <button className="icon-btn icon-btn--plain" onClick={() => void playAudio(it)} aria-label={S.SPEAK}>
                    <IconAudio {...ICON} />
                  </button>
                </div>
                {example && (
                  <div className="leech-example">
                    <div className="leech-example-text">
                      <span className="muted">{S.LEECH_EXAMPLE}</span>
                      <span className="leech-example-it" lang="it">{example.it}</span>
                      <span className="muted">{example.nl[0]}</span>
                    </div>
                    <button className="icon-btn icon-btn--plain" onClick={() => void playAudio(example.it)} aria-label={S.SPEAK}>
                      <IconAudio {...ICON} />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
