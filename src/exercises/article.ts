import { check as engineCheck } from '../engine/checker.ts'
import type { CheckerConfig } from '../engine/checker.ts'
import { withArticle } from '../engine/plurals.ts'
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
  const article = word.article!
  return {
    cardKey,
    typeId: TYPE,
    prompt: word.it,
    answers: [article],
    // The noun with a gap for its article, the Dutch meaning above it
    sentence: { it: withArticle(word), nl: word.nl.join(' / '), span: { start: 0, end: article.length }, mode: 'gap', spaceAfterGap: true },
    audio: withArticle(word),
  }
}

function check(input: string, exercise: Exercise, config: CheckerConfig): ReviewResult {
  return engineCheck(input, exercise.answers, 'article', config)
}

const exercise: ExerciseModule = { id: TYPE, typoTolerance: false, cards, build, check }
export default exercise
