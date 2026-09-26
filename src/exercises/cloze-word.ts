import { check as engineCheck } from '../engine/checker.ts'
import type { CheckerConfig } from '../engine/checker.ts'
import { buildGap, gapCards } from './choice.ts'
import type { BuildContext, Content, Exercise, ExerciseModule, ReviewResult } from './types.ts'

const TYPE = 'cloze-word'

function cards(content: Content): string[] {
  return gapCards(TYPE, content)
}

function build(cardKey: string, content: Content, ctx?: BuildContext): Exercise {
  return buildGap(TYPE, cardKey, content, ctx?.seq ?? 0)
}

function check(input: string, exercise: Exercise, config: CheckerConfig): ReviewResult {
  return engineCheck(input, exercise.answers, 'cloze', config)
}

const exercise: ExerciseModule = { id: TYPE, typoTolerance: false, cards, build, check }
export default exercise
