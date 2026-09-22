import { check as engineCheck } from '../engine/checker.ts'
import type { CheckerConfig } from '../engine/checker.ts'
import type { Content, Exercise, ExerciseModule, ReviewResult } from './types.ts'

const TYPE = 'cloze'

function cards(content: Content): string[] {
  const keys: string[] = []
  for (const sentence of content.sentences.values()) {
    if (!sentence.cloze || sentence.cloze.length === 0) continue
    for (let i = 0; i < sentence.cloze.length; i++) {
      keys.push(`${TYPE}:${sentence.id}:${i}`)
    }
  }
  return keys
}

function build(cardKey: string, content: Content): Exercise {
  const [, sentenceId, idxStr] = cardKey.split(':')
  const sentence = content.sentences.get(sentenceId)
  if (!sentence) throw new Error(`Unknown sentence id: ${sentenceId}`)
  const idx = parseInt(idxStr, 10)
  const item = sentence.cloze?.[idx]
  if (!item) throw new Error(`No cloze item at index ${idx} for sentence ${sentenceId}`)
  const prompt = sentence.it.replace(item.target, '___')
  return { cardKey, typeId: TYPE, prompt, answers: [item.target], hint: item.hint }
}

function check(input: string, exercise: Exercise, config: CheckerConfig): ReviewResult {
  return engineCheck(input, exercise.answers, 'cloze', config)
}

const exercise: ExerciseModule = { id: TYPE, typoTolerance: false, cards, build, check }
export default exercise
