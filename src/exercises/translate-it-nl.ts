import { check as engineCheck } from '../engine/checker.ts'
import type { CheckerConfig } from '../engine/checker.ts'
import type { Content, Exercise, ExerciseModule, ReviewResult } from './types.ts'

const TYPE = 'translate-it-nl'

function cards(content: Content): string[] {
  return [...content.words.keys()].map(id => `${TYPE}:${id}`)
}

function build(cardKey: string, content: Content): Exercise {
  const id = cardKey.slice(TYPE.length + 1)
  const word = content.words.get(id)
  if (!word) throw new Error(`Unknown word id: ${id}`)
  return { cardKey, typeId: TYPE, prompt: word.it, answers: word.nl }
}

function check(input: string, exercise: Exercise, config: CheckerConfig): ReviewResult {
  return engineCheck(input, exercise.answers, 'translation', config)
}

const exercise: ExerciseModule = { id: TYPE, typoTolerance: true, cards, build, check }
export default exercise
