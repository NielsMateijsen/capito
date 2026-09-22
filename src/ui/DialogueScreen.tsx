import { useState } from 'react'
import type { Dialogue, Sentence } from '../content/schemas.ts'
import { S } from './strings.nl.ts'
import { playAudio, VOICE_A, VOICE_B } from './speak.ts'

interface Props {
  dialogue: Dialogue
  unitDialogues: Dialogue[]
  sentences: Map<string, Sentence>
  onBack: () => void
}

export default function DialogueScreen({ dialogue, unitDialogues, sentences, onBack }: Props) {
  const [showNl, setShowNl] = useState(false)
  const [activeId, setActiveId] = useState(dialogue.id)

  const active = unitDialogues.find(d => d.id === activeId) ?? dialogue
  const alternate = unitDialogues.find(d => d.id !== active.id && d.register !== active.register)

  return (
    <div className="dialogue-screen">
      <button className="btn-secondary" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        {S.BACK}
      </button>

      <h1>{active.title}</h1>

      <div className="dialogue-controls">
        <button
          className="btn-secondary"
          onClick={() => setShowNl(v => !v)}
          aria-pressed={showNl}
        >
          {S.DIALOGUE_NL_TOGGLE}
        </button>
        {alternate && (
          <button
            className="btn-secondary"
            onClick={() => setActiveId(alternate.id)}
          >
            {alternate.register === 'formal' ? S.DIALOGUE_SWITCH_TO_FORMAL : S.DIALOGUE_SWITCH_TO_INFORMAL}
          </button>
        )}
      </div>

      <div className="dialogue-lines">
        {active.lines.map((line, i) => {
          const sentence = sentences.get(line.sentence)
          return (
            <div key={i} className="dialogue-line">
              <div className="dialogue-line-top">
                <span className="speaker">{line.speaker}:</span>
                <span className="dialogue-it" lang="it">{sentence?.it ?? line.sentence}</span>
                <button
                  className="btn-secondary"
                  style={{ padding: '2px 8px' }}
                  onClick={() => void playAudio(sentence?.audioText ?? sentence?.it ?? line.sentence, line.speaker === 'A' ? VOICE_A : VOICE_B)}
                  aria-label={S.SPEAK}
                >
                  {S.AUDIO}
                </button>
              </div>
              {showNl && sentence?.nl[0] && (
                <span className="dialogue-nl">{sentence.nl[0]}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
