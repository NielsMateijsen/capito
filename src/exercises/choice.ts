import { pickSentence, sentencesForItem, withGap } from '../engine/sentences.ts'
import type { Content, Exercise, ReviewResult } from './types.ts'

export const GAP = '___'

export function ladderItemIds(content: Content): string[] {
  return [...content.words.keys(), ...content.verbs.keys()]
}

function norm(s: string): string {
  return s.normalize('NFC').trim().toLowerCase()
}

export function checkChoice(input: string, exercise: Exercise): ReviewResult {
  return exercise.answers.some(a => norm(a) === norm(input)) ? 'correct' : 'wrong'
}

export function gapCards(type: string, content: Content): string[] {
  return ladderItemIds(content)
    .filter(id => sentencesForItem(id, content).length > 0)
    .map(id => `${type}:${id}`)
}

export function buildGap(type: string, cardKey: string, content: Content, seq: number): Exercise {
  const itemId = cardKey.slice(type.length + 1)
  const match = pickSentence(itemId, content, seq)
  if (!match) throw new Error(`No sentence for item: ${itemId}`)
  const { sentence, span } = match
  const target = sentence.it.slice(span.start, span.end)
  return {
    cardKey,
    typeId: type,
    prompt: withGap(sentence.it, span, GAP),
    answers: [target],
    sentence: { it: sentence.it, nl: sentence.nl[0], span, mode: 'gap' },
    audio: sentence.audioText ?? sentence.it,
  }
}
