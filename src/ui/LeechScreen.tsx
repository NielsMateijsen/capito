import type { Content } from '../exercises/types.ts'
import type { ProgressState } from '../storage/types.ts'
import { isLeech } from '../engine/session-builder.ts'
import { S } from './strings.nl.ts'

interface AppConfig {
  leech: { lapseThreshold: number }
}

interface Props {
  content: Content
  progress: ProgressState
  config: AppConfig
  onBack: () => void
}

function speak(text: string) {
  if (!window.speechSynthesis) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'it-IT'
  speechSynthesis.speak(u)
}

export default function LeechScreen({ content, progress, config, onBack }: Props) {
  const leeches = Object.entries(progress.cards)
    .filter(([, state]) => isLeech(state, config.leech))
    .map(([cardKey, state]) => ({ cardKey, state }))

  return (
    <div className="leech-screen">
      <button className="btn-secondary" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        {S.BACK}
      </button>

      <h1>{S.LEECH}</h1>

      {leeches.length === 0 ? (
        <p className="settings-meta">{S.LEECH_EMPTY}</p>
      ) : (
        <div className="leech-list">
          {leeches.map(({ cardKey, state }) => {
            const parts = cardKey.split(':')
            const itemId = parts[1] ?? ''
            const word = content.words.get(itemId)
            const verb = content.verbs.get(itemId)
            const sentence = content.sentences.get(itemId)
            const it = word?.it ?? verb?.inf ?? sentence?.it ?? itemId
            const nl = word?.nl[0] ?? verb?.nl[0] ?? sentence?.nl[0] ?? ''
            const example = [...content.sentences.values()].find(s => s.uses.includes(itemId))

            return (
              <div key={cardKey} className="leech-card">
                <div className="leech-card-top">
                  <span className="leech-card-it" lang="it">{it}</span>
                  <button
                    className="btn-secondary"
                    style={{ padding: '2px 8px' }}
                    onClick={() => speak(it)}
                    aria-label="Uitspreken"
                  >
                    {S.AUDIO}
                  </button>
                  <span className="leech-card-lapses">{S.LEECH_LAPSES(state.lapses)}</span>
                </div>
                {nl && <div className="leech-card-nl">{nl}</div>}
                {example && (
                  <div className="leech-card-example">
                    <div className="leech-card-example-label">{S.LEECH_EXAMPLE}</div>
                    <div className="leech-card-example-it">
                      <span lang="it">{example.it}</span>
                      <button
                        className="btn-secondary"
                        style={{ padding: '2px 8px' }}
                        onClick={() => speak(example.it)}
                        aria-label="Uitspreken"
                      >
                        {S.AUDIO}
                      </button>
                    </div>
                    <div className="leech-card-example-nl">{example.nl[0]}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
