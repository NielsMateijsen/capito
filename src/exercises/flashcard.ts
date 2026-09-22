import type { CheckerConfig } from '../engine/checker.ts'
import type { Content, Exercise, ExerciseModule, ReviewResult } from './types.ts'

const TYPE = 'flashcard'

function cards(content: Content): string[] {
  return [
    ...[...content.words.keys()].map(id => `${TYPE}:${id}`),
    ...[...content.verbs.keys()].map(id => `${TYPE}:${id}`),
    ...[...content.sentences.keys()].map(id => `${TYPE}:${id}`),
  ]
}

function build(cardKey: string, content: Content): Exercise {
  const id = cardKey.slice(TYPE.length + 1)
  const word = content.words.get(id)
  if (word) return { cardKey, typeId: TYPE, prompt: word.it, answers: word.nl }
  const verb = content.verbs.get(id)
  if (verb) return { cardKey, typeId: TYPE, prompt: verb.inf, answers: verb.nl }
  const sentence = content.sentences.get(id)
  if (sentence) return { cardKey, typeId: TYPE, prompt: sentence.it, answers: sentence.nl }
  throw new Error(`Unknown flashcard id: ${id}`)
}

function check(input: string, _exercise: Exercise, _config: CheckerConfig): ReviewResult {
  if (input === 'again' || input === 'good' || input === 'easy') return input
  throw new Error(`Invalid flashcard input: "${input}" (expected again/good/easy)`)
}

const exercise: ExerciseModule = { id: TYPE, typoTolerance: false, cards, build, check }
export default exercise
