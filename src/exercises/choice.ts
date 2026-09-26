import { pickSentence, sentencesForItem, withGap } from '../engine/sentences.ts'
import type { CheckerConfig } from '../engine/checker.ts'
import type { Content, Exercise, ExerciseModule, ReviewResult } from './types.ts'

/** Retyping after a mistake only counts when it is fully correct ("almost" is not enough). */
export function isRetypeCorrect(mod: ExerciseModule, input: string, exercise: Exercise, config: CheckerConfig): boolean {
  return input.trim() !== '' && mod.check(input.trim(), exercise, config) === 'correct'
}

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
