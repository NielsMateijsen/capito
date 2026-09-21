import { check as engineCheck } from '../engine/checker.ts'
import type { CheckerConfig } from '../engine/checker.ts'
import type { Content, Exercise, ExerciseModule, ReviewResult } from './types.ts'

const TYPE = 'article'

function cards(content: Content): string[] {
  return [...content.words.values()]
    .filter(w => w.article != null)
    .map(w => `${TYPE}:${w.id}`)
}

function build(cardKey: string, content: Content): Exercise {
  const id = cardKey.slice(TYPE.length + 1)
  const word = content.words.get(id)
  if (!word) throw new Error(`Unknown word id: ${id}`)
  return { cardKey, typeId: TYPE, prompt: word.it, answers: [word.article!] }
}

function check(input: string, exercise: Exercise, config: CheckerConfig): ReviewResult {
  return engineCheck(input, exercise.answers, 'article', config)
}

const exercise: ExerciseModule = { id: TYPE, typoTolerance: false, cards, build, check }
export default exercise
