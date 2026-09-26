import { check as engineCheck } from '../engine/checker.ts'
import type { CheckerConfig } from '../engine/checker.ts'
import { withArticle } from '../engine/plurals.ts'
import type { Content, Exercise, ExerciseModule, ReviewResult } from './types.ts'

const TYPE = 'translate-nl-it'

function cards(content: Content): string[] {
  return [...content.words.keys()].map(id => `${TYPE}:${id}`)
}

function build(cardKey: string, content: Content): Exercise {
  const id = cardKey.slice(TYPE.length + 1)
  const word = content.words.get(id)
  if (!word) throw new Error(`Unknown word id: ${id}`)
  const needsArticle = word.pos === 'noun' && !!word.article
  return {
    cardKey,
    typeId: TYPE,
    prompt: word.nl.join(' / '),
    answers: [withArticle(word)],
    partialAnswers: needsArticle ? [word.it] : undefined,
    withArticle: needsArticle,
    audio: withArticle(word),
  }
}

function check(input: string, exercise: Exercise, config: CheckerConfig): ReviewResult {
  const result = engineCheck(input, exercise.answers, 'translation', config)
  if (result !== 'wrong' || !exercise.partialAnswers) return result
  return engineCheck(input, exercise.partialAnswers, 'translation', config) === 'wrong' ? 'wrong' : 'almost'
}

const exercise: ExerciseModule = { id: TYPE, typoTolerance: true, cards, build, check }
export default exercise
