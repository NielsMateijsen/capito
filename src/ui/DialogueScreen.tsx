import { useState } from 'react'
import type { Dialogue, Sentence } from '../content/schemas.ts'
import { S } from './strings.nl.ts'
import { ICON, ICON_LINE, IconAudio, IconBack } from './icons.ts'
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
    <div className="page dialogue-screen">
      <div className="page-top">
        <button className="icon-btn" onClick={onBack} aria-label={S.BACK}><IconBack {...ICON_LINE} /></button>
      </div>

      <h1 className="page-title">{active.title}</h1>

      <div className="btn-row">
        <button className="btn btn--secondary" onClick={() => setShowNl(v => !v)} aria-pressed={showNl}>
          {S.DIALOGUE_NL_TOGGLE}
        </button>
        {alternate && (
          <button className="btn btn--secondary" onClick={() => setActiveId(alternate.id)}>
            {alternate.register === 'formal' ? S.DIALOGUE_SWITCH_TO_FORMAL : S.DIALOGUE_SWITCH_TO_INFORMAL}
          </button>
        )}
      </div>

      <ol className="dialogue-lines">
        {active.lines.map((line, i) => {
          const sentence = sentences.get(line.sentence)
          return (
            <li key={i} className={`dialogue-line dialogue-line--${line.speaker === 'A' ? 'a' : 'b'}`}>
              <span className="dialogue-speaker">{line.speaker}</span>
              <div className="dialogue-bubble">
                <span className="dialogue-it" lang="it">{sentence?.it ?? line.sentence}</span>
                {showNl && sentence?.nl[0] && <span className="dialogue-nl">{sentence.nl[0]}</span>}
              </div>
              <button
                className="icon-btn icon-btn--plain"
                onClick={() => void playAudio(sentence?.audioText ?? sentence?.it ?? line.sentence, line.speaker === 'A' ? VOICE_A : VOICE_B)}
                aria-label={S.SPEAK}
              >
                <IconAudio {...ICON} />
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
