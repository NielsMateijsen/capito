import type { CheckerConfig } from '../engine/checker.ts'
import { pickSentence, sentencesForItem } from '../engine/sentences.ts'
import { hashString, sentenceOptions } from '../engine/distractors.ts'
import { checkChoice, ladderItemIds } from './choice.ts'
import type { BuildContext, Content, Exercise, ExerciseModule, ReviewResult } from './types.ts'

const TYPE = 'mc-sentence'

function cards(content: Content): string[] {
  return ladderItemIds(content)
    .filter(id => sentencesForItem(id, content).length > 0 && content.sentences.size > 1)
    .map(id => `${TYPE}:${id}`)
}

function build(cardKey: string, content: Content, ctx?: BuildContext): Exercise {
  const itemId = cardKey.slice(TYPE.length + 1)
  const seq = ctx?.seq ?? 0
  const match = pickSentence(itemId, content, seq)
  if (!match) throw new Error(`No sentence for item: ${itemId}`)
  const { sentence, span } = match
  const { options, answer } = sentenceOptions(sentence, itemId, content, ctx?.optionCount, hashString(cardKey) + seq)
  return {
    cardKey,
    typeId: TYPE,
    prompt: sentence.it,
    answers: [answer],
    options,
    sentence: { it: sentence.it, nl: sentence.nl[0], span, mode: 'highlight' },
    audio: sentence.audioText ?? sentence.it,
  }
}

function check(input: string, exercise: Exercise, _config: CheckerConfig): ReviewResult {
  return checkChoice(input, exercise)
}

const exercise: ExerciseModule = { id: TYPE, typoTolerance: false, cards, build, check }
export default exercise
