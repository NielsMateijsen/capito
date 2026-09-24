import type { CheckerConfig } from '../engine/checker.ts'
import { hashString, wordOptions } from '../engine/distractors.ts'
import { buildGap, checkChoice, gapCards } from './choice.ts'
import type { BuildContext, Content, Exercise, ExerciseModule, ReviewResult } from './types.ts'

const TYPE = 'mc-word'

function cards(content: Content): string[] {
  return gapCards(TYPE, content)
}

function build(cardKey: string, content: Content, ctx?: BuildContext): Exercise {
  const seq = ctx?.seq ?? 0
  const base = buildGap(TYPE, cardKey, content, seq)
  const itemId = cardKey.slice(TYPE.length + 1)
  const { options, answer } = wordOptions(itemId, base.answers[0], content, ctx?.optionCount, hashString(cardKey) + seq)
  return { ...base, answers: [answer], options }
}

function check(input: string, exercise: Exercise, _config: CheckerConfig): ReviewResult {
  return checkChoice(input, exercise)
}

const exercise: ExerciseModule = { id: TYPE, typoTolerance: false, cards, build, check }
export default exercise
